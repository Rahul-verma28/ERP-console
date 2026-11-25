import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../kernel/db';
import { audit } from '../../kernel/audit';
import { validate } from '../../middleware/request';
import { allow, requireStaff } from '../../middleware/auth';
import { scopeOf } from '../businesses/service';

// The Console's home (what needs someone today, for the person's own scope) and Admin's settings.

const router = Router();
router.use(requireStaff);

router.get('/overview', async (req, res) => {
  const scope = scopeOf(req.staff!);
  const now = new Date();
  const ist = new Date(now.getTime() + 330 * 60_000);
  const monthStart = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - 330 * 60_000);
  const week = new Date(now.getTime() + 7 * 86_400_000);
  const team = req.staff!.role === 'admin' || req.staff!.role === 'staff';
  const [byStatus, trialsEnding, awaiting, approvals, recent, paidThisMonth, applications, stuck, unpaidBills] = await Promise.all([
    prisma.subscription.groupBy({ by: ['status'], where: { business: scope }, _count: true }),
    prisma.subscription.count({ where: { business: scope, status: 'trialing', trialEndsAt: { lte: week } } }),
    prisma.order.aggregate({ where: { business: scope, status: 'awaiting_payment' }, _count: true, _sum: { totalPaise: true } }),
    prisma.order.count({ where: { business: scope, status: 'pending_approval' } }),
    prisma.business.findMany({ where: scope, orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, name: true, createdAt: true, ownerName: true, subscription: { select: { status: true, planKey: true } } } }),
    prisma.payment.aggregate({ where: { receivedAt: { gte: monthStart }, order: { business: scope } }, _sum: { amountPaise: true } }),
    team ? prisma.application.count({ where: { status: 'new' } }) : Promise.resolve(0),
    team ? prisma.delivery.count({ where: { doneAt: null, attempts: { gte: 12 } } }) : Promise.resolve(0),
    req.staff!.partnerId
      ? prisma.partnerBill.aggregate({ where: { partnerId: req.staff!.partnerId, status: 'awaiting_payment' }, _count: true, _sum: { totalPaise: true } })
      : team
        ? prisma.partnerBill.aggregate({ where: { status: 'awaiting_payment' }, _count: true, _sum: { totalPaise: true } })
        : Promise.resolve(null),
  ]);
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  res.json({
    businesses: { total: byStatus.reduce((t, b) => t + b._count, 0), trialing: count('trialing'), active: count('active'), pastDue: count('past_due'), free: count('free'), incomplete: count('incomplete'), closed: count('closed') },
    trialsEndingThisWeek: trialsEnding,
    awaitingPayment: { orders: awaiting._count, totalPaise: awaiting._sum.totalPaise ?? 0 },
    approvals,
    paidThisMonthPaise: paidThisMonth._sum.amountPaise ?? 0,
    applications,
    stuckDeliveries: stuck,
    unpaidBills: unpaidBills ? { count: unpaidBills._count, totalPaise: unpaidBills._sum.totalPaise ?? 0 } : null,
    recent,
  });
});

// ── Settings (Admin) ──

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const Settings = z.object({
  seller: z.object({
    legalName: z.string().trim().min(2).max(160),
    gstin: z.string().trim().toUpperCase().refine((v) => !v || GSTIN.test(v), 'Enter a valid GSTIN'),
    stateCode: z.string().refine((v) => !v || /^\d{2}$/.test(v), 'Choose the state'),
    address: z.string().trim().max(300),
    email: z.string().trim().max(120).optional(),
    sac: z.string().regex(/^99\d{4}$/, 'SAC has 6 digits and starts with 99'),
    gstRateBp: z.number().int().min(0).max(2800),
  }).refine((s) => !s.gstin || s.gstin.slice(0, 2) === s.stateCode, { message: 'The GSTIN is from another state', path: ['gstin'] }),
  'trial.days': z.number().int().min(1).max(90),
  'extra_user.monthly_paise': z.number().int().min(0),
  'extra_user.yearly_paise': z.number().int().min(0),
  'discount.limits': z.object({ admin: z.number().int().min(0).max(100), staff: z.number().int().min(0).max(100), sales: z.number().int().min(0).max(100), vendor: z.number().int().min(0).max(100), partner_owner: z.number().int().min(0).max(100), partner_staff: z.number().int().min(0).max(100) }),
  'referral.welcome_discount_percent': z.number().int().min(0).max(50),
  'orders.pay_within_days': z.number().int().min(1).max(60),
  'renewal.notice_days': z.number().int().min(1).max(30),
  'renewal.grace_days': z.number().int().min(0).max(30),
  'closed.keep_days': z.number().int().min(30).max(365),
  /** The Console's look for everyone in it; light or dark stays each person's own choice */
  appearance: z.object({ preset: z.string().max(40), brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like #2450D8'), font: z.string().max(40), density: z.enum(['comfortable', 'compact']) }),
}).partial();

router.get('/settings', allow('admin'), async (_req, res) => {
  const rows = await prisma.setting.findMany();
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

router.put('/settings', allow('admin'), validate(Settings), async (req, res) => {
  const changes = req.body as Record<string, Prisma.InputJsonValue>;
  const before = await prisma.setting.findMany({ where: { key: { in: Object.keys(changes) } } });
  await prisma.$transaction(Object.entries(changes).map(([key, value]) => prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } })));
  await audit({ actorId: req.staff!.id, action: 'settings.updated', entity: 'settings', before: Object.fromEntries(before.map((b) => [b.key, b.value])), after: changes });
  const rows = await prisma.setting.findMany();
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

export default router;
