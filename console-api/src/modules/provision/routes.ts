import { randomUUID } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { Prisma, type OnboardedBy } from '@prisma/client';
import { checkSignedCall } from '@contracts/signedCall';
import { env } from '../../config/env';
import { prisma } from '../../kernel/db';
import { AppError } from '../../kernel/errors';
import { audit } from '../../kernel/audit';
import { normaliseEmail, normaliseMobile } from '../../kernel/crypto';
import { validate } from '../../middleware/request';
import { getSetting } from '../system/settings';
import { issueLicence } from '../licences/service';
import { closeBusiness, reopenBusiness, trialEnd, type Actor } from '../businesses/service';
import { OrderInput, createOrder, previewOrder, sendPaymentLink } from '../billing/service';

// What an ERP installation asks of the Console (docs/architecture/console-erp-split.md): a new
// self-serve business, plans and coupons for its pages, the owner's Plan & billing, closing and
// reopening, the daily usage report and the licence check-in. Every call is signed with the
// installation's key (PROVISION_KEY) and accepted once.

const router = Router();

/** Only correctly signed calls from the ERP, each once */
async function requireErp(req: Request, _res: Response, next: NextFunction) {
  try {
    const out = checkSignedCall(env.PROVISION_KEY, req.header('authorization'), req.method, req.originalUrl, req.rawBody ?? Buffer.alloc(0));
    if ('error' in out) throw new AppError('UNAUTHENTICATED', out.error);
    const fresh = await prisma.seenCall.createMany({ data: [{ nonce: out.nonce }], skipDuplicates: true });
    if (!fresh.count) throw new AppError('UNAUTHENTICATED', 'This call was already received.');
    next();
  } catch (e) {
    next(e);
  }
}
router.use(requireErp);

/** Changes asked by the business's owner through the ERP act with the Console's full rights over that one business */
const OWNER: Actor = { id: 'erp-owner', role: 'admin', partnerId: null };
const latestLicence = async (businessId: string) => (await prisma.licence.findFirstOrThrow({ where: { businessId }, orderBy: { seq: 'desc' }, select: { token: true } })).token;

// ── Plans and coupons for the ERP's public pages ──

router.get('/plans', async (_req, res) => {
  const [plans, monthly, yearly, trialDays] = await Promise.all([
    prisma.plan.findMany({ where: { active: true, isPublic: true }, orderBy: { sortOrder: 'asc' }, select: { key: true, name: true, tagline: true, monthlyPaise: true, yearlyPaise: true, limits: true, modules: true, isFree: true, isTrial: true } }),
    getSetting<number>('extra_user.monthly_paise'),
    getSetting<number>('extra_user.yearly_paise'),
    getSetting<number>('trial.days'),
  ]);
  res.json({ plans, extraUserPaise: { monthly: monthly ?? 0, yearly: yearly ?? 0 }, trialDays: trialDays ?? 14, currency: 'INR' });
});

router.get('/coupons/:code', async (req, res) => {
  const c = await prisma.coupon.findUnique({ where: { code: String(req.params.code).trim().toUpperCase() } });
  const valid = !!c && c.active && (!c.validUntil || c.validUntil > new Date()) && (c.maxUses == null || c.used < c.maxUses);
  if (!c || !valid) return void res.json({ valid: false, message: c ? 'This coupon has run out' : "We couldn't find this coupon" });
  const off = c.percentOff ? `${c.percentOff}% off` : `₹${((c.amountOffPaise ?? 0) / 100).toLocaleString('en-IN')} off`;
  res.json({ valid: true, message: `${off} your first paid plan${c.planKeys.length ? ` (${c.planKeys.join(', ')})` : ''}` });
});

// ── Self-serve signup ──

const Signup = z.object({
  name: z.string().trim().min(2).max(100),
  legalName: z.string().trim().max(160).nullish(),
  industryKey: z.string().min(2).max(60),
  gstin: z.string().trim().toUpperCase().nullish(),
  stateCode: z.string().regex(/^\d{2}$/).nullish(),
  owner: z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().email().transform(normaliseEmail), mobile: z.string().trim().transform(normaliseMobile) }),
  referralCode: z.string().trim().toUpperCase().max(20).nullish(),
  couponCode: z.string().trim().toUpperCase().max(20).nullish(),
});

/**
 * A business signing up on the ERP's website: the one-trial rule, who referred it, the trial
 * subscription and its licence. The ERP makes the workspace, then confirms; one never confirmed
 * is removed by the hourly clean-up.
 */
router.post('/signups', validate(Signup), async (req, res) => {
  const b = req.body as z.infer<typeof Signup>;
  const used = await prisma.business.findFirst({
    where: { OR: [{ ownerEmail: b.owner.email }, { ownerMobile: b.owner.mobile }, ...(b.gstin ? [{ gstin: b.gstin }] : [])], subscription: { trialEndsAt: { not: null } } },
    select: { id: true },
  });
  // A trial was used with these details before: the new business starts on Free (it can buy a plan at once)
  const trialPlan = await prisma.plan.findFirstOrThrow({ where: { isTrial: true, active: true } });
  const freePlan = await prisma.plan.findFirstOrThrow({ where: { isFree: true, active: true } });
  const referrer = b.referralCode ? await prisma.consoleUser.findFirst({ where: { referralCode: b.referralCode, status: 'active' }, select: { id: true, role: true } }) : null;
  const onboardedBy: OnboardedBy = referrer ? (referrer.role === 'vendor' ? 'vendor' : 'sales') : 'website';
  const days = (await getSetting<number>('trial.days')) ?? 14;
  const id = randomUUID();
  const licence = await prisma.$transaction(async (tx) => {
    await tx.business.create({
      data: {
        id, deployment: env.DEPLOYMENT_ID, name: b.name, legalName: b.legalName ?? null, industryKey: b.industryKey, gstin: b.gstin ?? null, stateCode: b.stateCode ?? b.gstin?.slice(0, 2) ?? null,
        ownerName: b.owner.name, ownerEmail: b.owner.email, ownerMobile: b.owner.mobile, onboardedBy, onboardedById: referrer?.id ?? null, referralCode: referrer ? b.referralCode : null,
        facts: (b.couponCode ? { signupCoupon: b.couponCode } : {}) as Prisma.InputJsonValue,
      },
    });
    await tx.subscription.create({ data: used ? { businessId: id, planKey: freePlan.key, status: 'free' } : { businessId: id, planKey: trialPlan.key, status: 'trialing', trialEndsAt: trialEnd(new Date(), days) } });
    const { licence: l } = await issueLicence(tx, id);
    await audit({ action: 'business.signed_up', entity: 'business', entityId: id, after: { name: b.name, onboardedBy, trial: !used } }, tx);
    return l.token;
  });
  res.status(201).json({ businessId: id, licence, trial: !used });
});

/** The ERP made the workspace: the business is live */
router.post('/signups/:id/confirm', validate(z.object({ id: z.string().uuid() }), 'params'), async (req, res) => {
  await prisma.business.update({ where: { id: String(req.params.id) }, data: { provisionedAt: new Date(), ownerLinkSentAt: null } });
  await prisma.licence.updateMany({ where: { businessId: String(req.params.id), deliveredAt: null }, data: { deliveredAt: new Date() } });
  res.status(204).end();
});

// ── The owner's Plan & billing ──

const Id = z.object({ id: z.string().uuid() });

router.get('/businesses/:id/billing', validate(Id, 'params'), async (req, res) => {
  const id = String(req.params.id);
  const b = await prisma.business.findUnique({
    where: { id },
    include: {
      partner: { select: { name: true } },
      subscription: { include: { plan: { select: { key: true, name: true, monthlyPaise: true, yearlyPaise: true, limits: true } } } },
      orders: { where: { status: { in: ['awaiting_payment', 'pending_approval'] } }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!b) throw new AppError('NOT_FOUND', 'Business not found.');
  const invoices = await prisma.invoice.findMany({ where: { businessId: id }, orderBy: { issuedAt: 'desc' }, take: 50, select: { id: true, number: true, issuedAt: true, totalPaise: true, creditNote: { select: { number: true } } } });
  const s = b.subscription;
  res.json({
    billedBy: b.partner ? { kind: 'partner', name: b.partner.name } : { kind: 'ahead' },
    subscription: s && { status: s.status, plan: s.plan, cycle: s.cycle, extraUsers: s.extraUsers, trialEndsAt: s.trialEndsAt, periodEnd: s.periodEnd, graceEndsAt: s.graceEndsAt, cancelAtPeriodEnd: s.cancelAtPeriodEnd },
    openOrder: b.orders[0] ? { id: b.orders[0].id, status: b.orders[0].status, planKey: b.orders[0].planKey, cycle: b.orders[0].cycle, totalPaise: b.orders[0].totalPaise, linkUrl: b.orders[0].linkUrl, expiresAt: b.orders[0].expiresAt } : null,
    invoices: invoices.map((i) => ({ ...i, creditNote: i.creditNote?.number ?? null })),
  });
});

/** The owner may use a coupon, never a manual discount */
const OwnerOrder = OrderInput.innerType().omit({ discountPct: true });
const noPartner = async (id: string) => {
  const b = await prisma.business.findUnique({ where: { id }, select: { partnerId: true } });
  if (!b) throw new AppError('NOT_FOUND', 'Business not found.');
  if (b.partnerId) throw new AppError('PERMISSION_DENIED', 'Your plan is managed by your partner. Ask them to change it.');
};

router.post('/businesses/:id/billing/quote', validate(Id, 'params'), validate(OwnerOrder), async (req, res) => {
  await noPartner(String(req.params.id));
  res.json(await previewOrder(OWNER, String(req.params.id), req.body));
});
router.post('/businesses/:id/billing/orders', validate(Id, 'params'), validate(OwnerOrder), async (req, res) => {
  await noPartner(String(req.params.id));
  const o = await createOrder(OWNER, String(req.params.id), req.body);
  res.status(201).json({ id: o.id, status: o.status, totalPaise: o.totalPaise, linkUrl: o.linkUrl });
});
router.post('/businesses/:id/billing/orders/:orderId/link', validate(z.object({ id: z.string().uuid(), orderId: z.string().uuid() }), 'params'), async (req, res) => {
  const o = await prisma.order.findFirst({ where: { id: String(req.params.orderId), businessId: String(req.params.id) }, select: { id: true } });
  if (!o) throw new AppError('NOT_FOUND', 'Order not found.');
  res.json(await sendPaymentLink(o.id));
});
router.get('/businesses/:id/invoices/:invoiceId', validate(z.object({ id: z.string().uuid(), invoiceId: z.string().uuid() }), 'params'), async (req, res) => {
  const inv = await prisma.invoice.findFirst({ where: { id: String(req.params.invoiceId), businessId: String(req.params.id) }, include: { creditNote: true, order: { select: { payments: { select: { method: true, reference: true, receivedAt: true, amountPaise: true } } } } } });
  if (!inv) throw new AppError('NOT_FOUND', 'Invoice not found.');
  res.json(inv);
});

// ── The owner closes or reopens the business; the new licence comes back at once ──

router.post('/businesses/:id/close', validate(Id, 'params'), async (req, res) => {
  const id = String(req.params.id);
  await closeBusiness(OWNER, id);
  const s = await prisma.subscription.findUniqueOrThrow({ where: { businessId: id }, select: { purgeAt: true } });
  res.json({ licence: await latestLicence(id), purgeAt: s.purgeAt });
});
router.post('/businesses/:id/reopen', validate(Id, 'params'), async (req, res) => {
  const id = String(req.params.id);
  await reopenBusiness(OWNER, id);
  res.json({ licence: await latestLicence(id) });
});

// ── Daily: usage from the ERP, and the licences it should hold ──

const Usage = z.object({
  reports: z.array(z.object({
    businessId: z.string().uuid(),
    users: z.number().int().min(0),
    invoicesThisMonth: z.number().int().min(0),
    customers: z.number().int().min(0),
    storageBytes: z.number().int().min(0),
    lastActiveAt: z.string().datetime().nullable(),
  })).max(5000),
});
router.post('/usage', validate(Usage), async (req, res) => {
  const now = new Date();
  let known = 0;
  for (const r of (req.body as z.infer<typeof Usage>).reports) {
    const b = await prisma.business.findUnique({ where: { id: r.businessId }, select: { facts: true } });
    if (!b) continue;
    await prisma.business.update({ where: { id: r.businessId }, data: { facts: { ...((b.facts ?? {}) as object), usage: r } as Prisma.InputJsonValue, factsAt: now } });
    known++;
  }
  res.json({ received: known });
});

router.get('/licences', validate(z.object({ since: z.string().datetime().optional() }), 'query'), async (req, res) => {
  const since = (req.query as { since?: string }).since;
  const rows = await prisma.$queryRaw<{ business_id: string; token: string; seq: number }[]>`
    SELECT DISTINCT ON (l.business_id) l.business_id, l.token, l.seq
      FROM licences l JOIN businesses b ON b.id = l.business_id
     WHERE b.deployment = ${env.DEPLOYMENT_ID} AND b.provisioned_at IS NOT NULL ${since ? Prisma.sql`AND l.issued_at >= ${new Date(since)}` : Prisma.empty}
     ORDER BY l.business_id, l.seq DESC`;
  res.json({ data: rows.map((r) => ({ businessId: r.business_id, seq: r.seq, licence: r.token })) });
});

export default router;
