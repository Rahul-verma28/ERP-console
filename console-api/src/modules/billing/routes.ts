import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { isDev } from '../../config/env';
import { prisma } from '../../kernel/db';
import { AppError } from '../../kernel/errors';
import { validate } from '../../middleware/request';
import { allow, requireStaff } from '../../middleware/auth';
import { findScoped, scopeOf } from '../businesses/service';
import { OfflinePayment, OrderInput, approveOrder, cancelOrder, createOrder, creditNote, handleWebhook, previewOrder, recordOfflinePayment, sendPaymentLink } from './service';
import { rupees } from './money';
import { testWebhook } from './gateway';

const Id = z.object({ id: z.string().uuid() });

// ── Signed in ──
const router = Router();
router.use(requireStaff);
const makers = allow('admin', 'staff', 'sales', 'vendor', 'partner_owner', 'partner_staff');
const team = allow('admin', 'staff');

/** What an order would cost (shown before it is made) */
router.post('/businesses/:id/quote', makers, validate(Id, 'params'), validate(OrderInput), async (req, res) => {
  res.json(await previewOrder(req.staff!, String(req.params.id), req.body));
});
router.post('/businesses/:id/orders', makers, validate(Id, 'params'), validate(OrderInput), async (req, res) => {
  res.status(201).json(await createOrder(req.staff!, String(req.params.id), req.body));
});

const List = z.object({
  status: z.enum(['pending_approval', 'awaiting_payment', 'paid', 'cancelled', 'expired']).optional(),
  kind: z.enum(['new', 'renewal', 'change']).optional(),
  businessId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(['newest', 'oldest', 'total_desc', 'total_asc']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
const ORDER_SORT = { newest: { createdAt: 'desc' }, oldest: { createdAt: 'asc' }, total_desc: { totalPaise: 'desc' }, total_asc: { totalPaise: 'asc' } } as const;
router.get('/orders', validate(List, 'query'), async (req, res) => {
  const q = req.query as unknown as z.infer<typeof List>;
  const where: Prisma.OrderWhereInput = {
    business: { ...scopeOf(req.staff!), ...(q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}) },
    ...(q.status ? { status: q.status } : {}), ...(q.kind ? { kind: q.kind } : {}), ...(q.businessId ? { businessId: q.businessId } : {}),
  };
  const [total, data, counts] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, orderBy: ORDER_SORT[q.sort], skip: (q.page - 1) * q.limit, take: q.limit, include: { business: { select: { name: true } }, invoice: { select: { id: true, number: true } } } }),
    prisma.order.groupBy({ by: ['status'], where: { business: scopeOf(req.staff!) }, _count: true }),
  ]);
  res.json({ data, total, counts: { all: counts.reduce((t, c) => t + c._count, 0), ...Object.fromEntries(counts.map((c) => [c.status, c._count])) } });
});

router.post('/orders/:id/approve', allow('admin'), validate(Id, 'params'), async (req, res) => {
  res.json(await approveOrder(req.staff!, String(req.params.id)));
});
router.post('/orders/:id/cancel', makers, validate(Id, 'params'), validate(z.object({ reason: z.string().trim().min(3, 'Say why').max(200) })), async (req, res) => {
  await cancelOrder(req.staff!, String(req.params.id), req.body.reason);
  res.status(204).end();
});
router.post('/orders/:id/link', makers, validate(Id, 'params'), async (req, res) => {
  const o = await prisma.order.findUniqueOrThrow({ where: { id: String(req.params.id) }, select: { businessId: true } });
  await findScoped(req.staff!, o.businessId);
  res.json(await sendPaymentLink(String(req.params.id), { resend: true }));
});
router.post('/orders/:id/payments', team, validate(Id, 'params'), validate(OfflinePayment), async (req, res) => {
  const out = await recordOfflinePayment(req.staff!, String(req.params.id), req.body);
  res.status(201).json({ invoice: out?.invoice.number, periodEnd: out?.periodEnd });
});

/** Money received: online through the link, or recorded by the team */
const PayList = z.object({ method: z.string().max(10).optional(), search: z.string().trim().max(100).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) });
router.get('/payments', validate(PayList, 'query'), async (req, res) => {
  const q = req.query as unknown as z.infer<typeof PayList>;
  const where: Prisma.PaymentWhereInput = {
    order: { business: { ...scopeOf(req.staff!), ...(q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}) } },
    ...(q.method ? { method: q.method } : {}),
  };
  const [total, data, sum] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({ where, orderBy: { receivedAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit, include: { order: { select: { id: true, planKey: true, cycle: true, business: { select: { id: true, name: true } }, invoice: { select: { id: true, number: true } } } } } }),
    prisma.payment.aggregate({ where, _sum: { amountPaise: true } }),
  ]);
  const byMethod = await prisma.payment.groupBy({ by: ['method'], where, _sum: { amountPaise: true }, _count: true });
  res.json({ data, total, sumPaise: sum._sum.amountPaise ?? 0, byMethod: Object.fromEntries(byMethod.map((m) => [m.method, { paise: m._sum.amountPaise ?? 0, count: m._count }])) });
});

/** Businesses whose paid period ends in the next 30 days, and whether the renewal order is out */
router.get('/renewals', async (req, res) => {
  const until = new Date(Date.now() + 30 * 86_400_000);
  const subs = await prisma.subscription.findMany({
    where: { business: scopeOf(req.staff!), status: { in: ['active', 'past_due'] }, periodEnd: { lte: until } },
    orderBy: { periodEnd: 'asc' },
    select: { businessId: true, planKey: true, cycle: true, status: true, periodEnd: true, graceEndsAt: true, plan: { select: { name: true } }, business: { select: { name: true, partnerId: true, orders: { where: { kind: 'renewal', status: { in: ['awaiting_payment', 'pending_approval'] } }, select: { id: true, totalPaise: true, linkUrl: true }, take: 1 } } } },
  });
  res.json({ data: subs.map((s) => ({ id: s.businessId, businessId: s.businessId, name: s.business.name, plan: s.plan.name, cycle: s.cycle, status: s.status, periodEnd: s.periodEnd, graceEndsAt: s.graceEndsAt, partnerBilled: !!s.business.partnerId, renewalOrder: s.business.orders[0] ?? null })), total: subs.length });
});

const InvList = z.object({ businessId: z.string().uuid().optional(), search: z.string().trim().max(100).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25) });
router.get('/invoices', validate(InvList, 'query'), async (req, res) => {
  const q = req.query as unknown as z.infer<typeof InvList>;
  const where: Prisma.InvoiceWhereInput = {
    order: { business: scopeOf(req.staff!) },
    ...(q.businessId ? { businessId: q.businessId } : {}),
    ...(q.search ? { OR: [{ number: { contains: q.search.toUpperCase() } }, { order: { business: { name: { contains: q.search, mode: 'insensitive' } } } }] } : {}),
  };
  const [total, data] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({ where, orderBy: { issuedAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit, include: { creditNote: { select: { number: true } }, order: { select: { business: { select: { name: true } } } } } }),
  ]);
  res.json({ data, total });
});
router.get('/invoices/:id', validate(Id, 'params'), async (req, res) => {
  const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: String(req.params.id) }, include: { creditNote: true, order: { include: { payments: true } } } });
  await findScoped(req.staff!, inv.businessId);
  res.json(inv);
});
router.post('/invoices/:id/credit-note', allow('admin'), validate(Id, 'params'), validate(z.object({ reason: z.string().trim().min(3, 'Say why').max(300), endPlan: z.boolean().default(false) })), async (req, res) => {
  res.status(201).json(await creditNote(req.staff!, String(req.params.id), req.body.reason, req.body.endPlan));
});

export default router;

// ── Public: gateway webhooks, and the development test gateway's pay page ──
export const publicBilling = Router();

publicBilling.post('/webhooks/:gateway', async (req, res) => {
  const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  const out = await handleWebhook(String(req.params.gateway), raw, req.header('x-razorpay-signature'), req.body, req.header('x-razorpay-event-id') ?? undefined);
  res.json(out);
});

const page = (body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AHEAD test payment</title>
<style>body{font-family:system-ui,sans-serif;background:#f4f5f7;display:grid;place-items:center;min-height:100vh;margin:0}main{background:#fff;padding:32px;border-radius:16px;box-shadow:0 8px 30px #0001;max-width:380px;text-align:center}button{background:#2450d8;color:#fff;border:0;border-radius:10px;padding:12px 24px;font-size:16px;cursor:pointer}small{color:#777;display:block;margin-top:16px}</style></head><body><main>${body}</main></body></html>`;

/** What a test link is for: an order, or a partner's monthly bill */
async function linkTarget(linkId: string) {
  const o = await prisma.order.findUnique({ where: { linkId }, include: { business: { select: { name: true } } } });
  if (o) return { totalPaise: o.totalPaise, paid: o.status === 'paid', label: `AHEAD ${o.kind === 'renewal' ? 'renewal' : 'plan'} for ${o.business.name}` };
  const b = await prisma.partnerBill.findUnique({ where: { linkId }, include: { partner: { select: { name: true } } } });
  if (b) return { totalPaise: b.totalPaise, paid: b.status === 'paid', label: `AHEAD partner bill ${b.month} for ${b.partner.name}` };
  throw new AppError('NOT_FOUND', 'No such payment link.');
}

/** Development only: what a Razorpay payment page would be */
publicBilling.get('/pay/test/:linkId', async (req, res) => {
  if (!isDev) throw new AppError('NOT_FOUND', 'Not found.');
  const t = await linkTarget(String(req.params.linkId));
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'");
  res.type('html').send(
    t.paid
      ? page(`<h2>Paid</h2><p>${rupees(t.totalPaise)} for ${t.label} was received.</p>`)
      : page(`<h2>Pay ${rupees(t.totalPaise)}</h2><p>${t.label}</p><form method="post"><button>Pay now (test)</button></form><small>Development test gateway: no real money moves.</small>`),
  );
});
publicBilling.post('/pay/test/:linkId', async (req, res) => {
  if (!isDev) throw new AppError('NOT_FOUND', 'Not found.');
  const linkId = String(req.params.linkId);
  const t = await linkTarget(linkId);
  const hook = testWebhook(linkId, t.totalPaise);
  const out = await handleWebhook('test', Buffer.from(hook.body), hook.signature, JSON.parse(hook.body), hook.eventId);
  res.type('html').send(page(out.status === 'processed' || out.status === 'duplicate' ? `<h2>Payment received</h2><p>${rupees(t.totalPaise)}. The invoice is on its way by email.</p>` : `<h2>Something went wrong</h2><p>${out.detail ?? out.status}</p>`));
});
