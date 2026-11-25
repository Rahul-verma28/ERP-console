import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../kernel/db';
import { validate } from '../../middleware/request';
import { allow, requireStaff } from '../../middleware/auth';
import { createOrder } from '../billing/service';
import { CreateInput, closeBusiness, createBusiness, extendTrial, findScoped, refreshFacts, reopenBusiness, resendOwnerLink, scopeOf, setModule, setPlan } from './service';

const router = Router();
router.use(requireStaff);

const Id = z.object({ id: z.string().uuid() });

const ListQuery = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['incomplete', 'trialing', 'active', 'past_due', 'free', 'closed']).optional(),
  plan: z.string().max(40).optional(),
  onboardedBy: z.enum(['website', 'team', 'sales', 'vendor', 'partner']).optional(),
  partnerId: z.string().uuid().optional(),
  /** Owner hasn't signed in yet */
  notSignedIn: z.enum(['1']).optional(),
  sort: z.enum(['newest', 'oldest', 'name', 'name_desc', 'trial_end']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const BUSINESS_SORT: Record<string, Prisma.BusinessOrderByWithRelationInput> = { newest: { createdAt: 'desc' }, oldest: { createdAt: 'asc' }, name: { name: 'asc' }, name_desc: { name: 'desc' }, trial_end: { subscription: { trialEndsAt: 'asc' } } };

router.get('/', validate(ListQuery, 'query'), async (req, res) => {
  const q = req.query as unknown as z.infer<typeof ListQuery>;
  const scope = scopeOf(req.staff!);
  const where: Prisma.BusinessWhereInput = {
    ...scope,
    ...(q.search ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { ownerName: { contains: q.search, mode: 'insensitive' } }, { ownerEmail: { contains: q.search, mode: 'insensitive' } }, { ownerMobile: { contains: q.search } }, { gstin: { contains: q.search.toUpperCase() } }] } : {}),
    ...(q.status || q.plan ? { subscription: { ...(q.status ? { status: q.status } : {}), ...(q.plan ? { planKey: q.plan } : {}) } } : {}),
    ...(q.onboardedBy ? { onboardedBy: q.onboardedBy } : {}),
    ...(q.partnerId ? { partnerId: q.partnerId } : {}),
  };
  // Owner not signed in yet: not a website signup, and the ERP has never seen them use the link or sign in
  if (q.notSignedIn) {
    const ids = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM businesses WHERE onboarded_by <> 'website' AND facts->'owner'->>'lastLoginAt' IS NULL AND facts->'ownerLink'->>'usedAt' IS NULL`;
    where.AND = [{ id: { in: ids.map((r) => r.id) } }, { subscription: { status: { not: 'closed' } } }];
  }
  const [total, rows, counts] = await Promise.all([
    prisma.business.count({ where }),
    prisma.business.findMany({
      where, orderBy: BUSINESS_SORT[q.sort], skip: (q.page - 1) * q.limit, take: q.limit,
      include: { subscription: { include: { plan: { select: { name: true } } } }, partner: { select: { name: true } }, onboarder: { select: { name: true } } },
    }),
    prisma.subscription.groupBy({ by: ['status'], where: { business: scope }, _count: true }),
  ]);
  const data = rows.map(({ facts, ...b }) => {
    const f = (facts ?? {}) as { owner?: { lastLoginAt?: string | null }; ownerLink?: { usedAt?: string | null }; setupDone?: boolean; lastActiveAt?: string | null; usage?: { lastActiveAt?: string | null } };
    return { ...b, progress: { signedIn: b.onboardedBy === 'website' || !!(f.owner?.lastLoginAt || f.ownerLink?.usedAt), setupDone: !!f.setupDone, lastActiveAt: f.usage?.lastActiveAt ?? f.lastActiveAt ?? null } };
  });
  res.json({ data, total, counts: { all: counts.reduce((t, c) => t + c._count, 0), ...Object.fromEntries(counts.map((c) => [c.status, c._count])) } });
});

router.post('/', allow('admin', 'staff', 'sales', 'vendor', 'partner_owner', 'partner_staff'), validate(CreateInput), async (req, res) => {
  const b = await createBusiness(req.staff!, req.body);
  // Starting on a paid plan: the first order and its payment link go out at once
  const start = req.body.start as CreateInput['start'];
  const order = start.kind === 'paid' ? await createOrder(req.staff!, b.id, { planKey: start.planKey, cycle: start.cycle, extraUsers: start.extraUsers, couponCode: start.couponCode, discountPct: start.discountPct }) : null;
  res.status(201).json({ ...b, firstOrder: order && { id: order.id, status: order.status, totalPaise: order.totalPaise, linkUrl: order.linkUrl } });
});

router.get('/:id', validate(Id, 'params'), async (req, res) => {
  const id = String(req.params.id);
  await findScoped(req.staff!, id);
  const [business, live] = await Promise.all([
    prisma.business.findUniqueOrThrow({
      where: { id },
      include: {
        subscription: { include: { plan: true } }, partner: { select: { id: true, name: true } }, onboarder: { select: { id: true, name: true, role: true } },
        overrides: true, notes: { orderBy: { createdAt: 'desc' }, take: 50 },
        licences: { orderBy: { seq: 'desc' }, take: 1, select: { seq: true, status: true, planKey: true, issuedAt: true, expiresAt: true, deliveredAt: true } },
      },
    }),
    refreshFacts(id),
  ]);
  const deliveries = await prisma.delivery.findMany({ where: { businessId: id, doneAt: null }, orderBy: { createdAt: 'desc' }, select: { kind: true, attempts: true, lastError: true, nextAttemptAt: true } });
  res.json({ ...business, facts: live.facts, factsLive: live.live, pending: deliveries });
});

const staffOnly = allow('admin', 'staff');

router.post('/:id/plan', allow('admin', 'staff', 'partner_owner', 'partner_staff'), validate(Id, 'params'), validate(z.object({ planKey: z.string().min(1), cycle: z.enum(['monthly', 'yearly']).default('monthly') })), async (req, res) => {
  res.json(await setPlan(req.staff!, String(req.params.id), req.body.planKey, req.body.cycle));
});
router.post('/:id/trial', staffOnly, validate(Id, 'params'), validate(z.object({ days: z.number().int().min(1, 'At least 1 day').max(60, 'At most 60 days') })), async (req, res) => {
  res.json(await extendTrial(req.staff!, String(req.params.id), req.body.days));
});
router.post('/:id/close', staffOnly, validate(Id, 'params'), async (req, res) => {
  res.json(await closeBusiness(req.staff!, String(req.params.id)));
});
router.post('/:id/reopen', staffOnly, validate(Id, 'params'), async (req, res) => {
  res.json(await reopenBusiness(req.staff!, String(req.params.id)));
});
router.put(
  '/:id/modules/:moduleKey',
  staffOnly,
  validate(z.object({ id: z.string().uuid(), moduleKey: z.string().min(2).max(30) }), 'params'),
  validate(z.object({ state: z.enum(['on', 'off']).nullable(), until: z.string().datetime().nullish() })),
  async (req, res) => {
    await setModule(req.staff!, String(req.params.id), String(req.params.moduleKey), req.body.state, req.body.until ? new Date(req.body.until) : null);
    res.status(204).end();
  },
);
router.post('/:id/owner-link', validate(Id, 'params'), async (req, res) => {
  await resendOwnerLink(req.staff!, String(req.params.id));
  res.status(202).json({ queued: true });
});
router.post('/:id/notes', allow('admin', 'staff', 'sales', 'vendor'), validate(Id, 'params'), validate(z.object({ text: z.string().trim().min(1, 'Write the note').max(2000) })), async (req, res) => {
  await findScoped(req.staff!, String(req.params.id));
  res.status(201).json(await prisma.note.create({ data: { businessId: String(req.params.id), authorId: req.staff!.id, text: req.body.text } }));
});

export default router;
