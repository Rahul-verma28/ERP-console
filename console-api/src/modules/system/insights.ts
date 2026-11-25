import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../kernel/db';
import { AppError } from '../../kernel/errors';
import { audit } from '../../kernel/audit';
import { validate } from '../../middleware/request';
import { allow, requireStaff } from '../../middleware/auth';
import { scopeOf, type Actor } from '../businesses/service';

// The Console's home, its analytics and its audit trail. Every number is worked out within the
// person's own scope: the team sees every business, sales and vendors their own, partners theirs.

const router = Router();
router.use(requireStaff);

const DAY = 86_400_000;
const isTeam = (a: Actor) => a.role === 'admin' || a.role === 'staff';

interface Facts {
  owner?: { lastLoginAt?: string | null } | null;
  ownerLink?: { sentAt?: string; usedAt?: string | null } | null;
  setupDone?: boolean;
  usage?: { lastActiveAt?: string | null };
}
const factsOf = (v: unknown) => (v ?? {}) as Facts;
/** The owner has been in: a website signup made the account themselves, others used the login link */
const signedIn = (f: Facts, by?: string) => by === 'website' || !!(f.owner?.lastLoginAt || f.ownerLink?.usedAt);

/** Monday 00:00 IST of the week a date falls in */
function weekStart(d: Date) {
  const ist = new Date(d.getTime() + 330 * 60_000);
  const day = (ist.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - day) - 330 * 60_000);
}
/** First day of the month (IST), n months back from this one */
function monthStart(n = 0, from = new Date()) {
  const ist = new Date(from.getTime() + 330 * 60_000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - n, 1) - 330 * 60_000);
}
const monthKey = (d: Date) => {
  const ist = new Date(d.getTime() + 330 * 60_000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}`;
};

// ── Activity: the audit trail in plain words ──

const WORDS: Record<string, string> = {
  'business.created': 'added', 'business.signed_up': 'signed up', 'business.plan_set': 'changed the plan of', 'business.trial_extended': 'extended the trial of',
  'business.closed': 'closed', 'business.reopened': 'reopened', 'business.module_switch': 'switched a module for', 'business.owner_link': 'sent a login link to the owner of',
  'business.trial_ended': 'trial ended for', 'business.past_due': 'payment went overdue for', 'business.unpaid_to_free': 'moved to Free (unpaid):', 'business.ended_to_free': 'moved to Free:',
  'business.unpaid_closed': 'closed (first order lapsed):', 'order.created': 'made an order for', 'order.approved': 'approved the discount for', 'order.cancelled': 'cancelled an order for',
  'order.paid': 'payment received from', 'invoice.credit_note': 'issued a credit note to', 'partner.created': 'added the partner', 'partner.updated': 'changed the partner',
  'partner_bill.paid': 'partner bill paid by', 'partner_bill.recorded': 'recorded a bill payment from', 'application.approved': 'approved an application', 'application.rejected': 'turned down an application',
  'plan.updated': 'changed the plan', 'coupon.created': 'added the coupon', 'coupon.on': 'turned on the coupon', 'coupon.off': 'turned off the coupon', 'settings.updated': 'changed the Console settings',
  'team.invited': 'invited', 'team.changed': 'changed the access of', 'team.mfa_reset': 'reset two-step sign-in for', 'file.added': 'added a KYC paper', 'file.removed': 'removed a KYC paper',
  'auth.signed_in': 'signed in', 'auth.wrong_password': 'typed a wrong password', 'auth.wrong_code': 'typed a wrong two-step code', 'auth.mfa_enabled': 'turned on two-step sign-in',
  'auth.mfa_disabled': 'turned off two-step sign-in', 'auth.password_changed': 'changed their password', 'auth.password_set': 'set their password', 'auth.invite_sent': 'sent an invite to',
  'auth.reset_sent': 'sent a password link to', 'auth.signed_out_others': 'signed out of other devices', 'me.updated': 'updated their details', 'session.ended': 'ended a session of',
};

async function describe(rows: { id: string; actorId: string | null; action: string; entity: string; entityId: string | null; at: Date; ip: string | null; before?: unknown; after?: unknown }[]) {
  const ids = (entity: string) => [...new Set(rows.filter((r) => r.entity === entity && r.entityId).map((r) => r.entityId!))];
  const orderIds = ids('order').filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  const invoiceIds = ids('invoice').filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  const [people, businesses, partners, plans, orders, invoices] = await Promise.all([
    prisma.consoleUser.findMany({ where: { id: { in: [...new Set([...rows.map((r) => r.actorId).filter(Boolean) as string[], ...ids('console_user')])] } }, select: { id: true, name: true } }),
    prisma.business.findMany({ where: { id: { in: ids('business') } }, select: { id: true, name: true } }),
    prisma.partner.findMany({ where: { id: { in: ids('partner') } }, select: { id: true, name: true } }),
    prisma.plan.findMany({ where: { key: { in: ids('plan') } }, select: { key: true, name: true } }),
    prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, businessId: true, business: { select: { name: true } } } }),
    prisma.invoice.findMany({ where: { id: { in: invoiceIds } }, select: { id: true, number: true, businessId: true, order: { select: { business: { select: { name: true } } } } } }),
  ]);
  const name = (list: { id: string; name: string }[], id: string | null) => list.find((x) => x.id === id)?.name;
  return rows.map((r) => {
    // No person: the owner acting in their ERP (sign-up, close, reopen, payment) or the Console's own jobs
    const who = name(people, r.actorId) ?? (r.actorId ? 'Someone' : ['business.signed_up', 'business.closed', 'business.reopened', 'order.created'].includes(r.action) ? 'The owner' : 'AHEAD');
    const target =
      r.entity === 'business' ? name(businesses, r.entityId) ?? 'a business'
        : r.entity === 'partner' ? name(partners, r.entityId) ?? 'a partner'
          : r.entity === 'plan' ? plans.find((p) => p.key === r.entityId)?.name ?? r.entityId
            : r.entity === 'console_user' && r.entityId !== r.actorId ? name(people, r.entityId) ?? 'a person'
              : r.entity === 'coupon' ? r.entityId
                : r.entity === 'order' ? orders.find((o) => o.id === r.entityId)?.business.name ?? 'a business'
                  : r.entity === 'invoice' ? (() => { const i = invoices.find((x) => x.id === r.entityId); return i ? `${i.order.business.name} (${i.number})` : 'an invoice'; })() : '';
    const verb = WORDS[r.action] ?? r.action.replace(/[._]/g, ' ');
    const system = ['business.trial_ended', 'business.past_due', 'business.unpaid_to_free', 'business.ended_to_free', 'business.unpaid_closed', 'order.paid'].includes(r.action);
    const text = system ? `${target} — ${verb.replace(/ (for|from|of)$|:$/, '')}` : `${who} ${verb}${target ? ` ${target}` : ''}`;
    const bizOf = r.entity === 'order' ? orders.find((o) => o.id === r.entityId)?.businessId : r.entity === 'invoice' ? invoices.find((i) => i.id === r.entityId)?.businessId : null;
    const href = bizOf ? `/businesses/${bizOf}?tab=billing` : r.entity === 'business' && r.entityId ? `/businesses/${r.entityId}` : r.entity === 'partner' && r.entityId ? `/partners/${r.entityId}` : r.entity === 'plan' ? '/plans' : null;
    return { id: r.id, at: r.at, action: r.action, area: r.action.split('.')[0], text, href, actor: name(people, r.actorId) ?? (who === 'The owner' ? 'The owner' : null), ip: r.ip, before: r.before ?? null, after: r.after ?? null };
  });
}

// ── Home ──

router.get('/home', async (req, res) => {
  const a = req.staff!;
  const scope = scopeOf(a);
  const team = isTeam(a);
  const now = new Date();
  const weeks = 12;
  const since = weekStart(new Date(now.getTime() - (weeks - 1) * 7 * DAY));
  const [subs, businesses, orders, paidMonth, firstPays, approvals, audits, me] = await Promise.all([
    prisma.subscription.findMany({ where: { business: scope }, select: { status: true, planKey: true, trialEndsAt: true, plan: { select: { name: true } } } }),
    prisma.business.findMany({ where: { ...scope, createdAt: { gte: new Date(now.getTime() - 120 * DAY) } }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, createdAt: true, facts: true, onboardedBy: true, industryKey: true, ownerName: true, subscription: { select: { status: true, trialEndsAt: true } } } }),
    prisma.order.findMany({ where: { business: scope, status: 'awaiting_payment' }, orderBy: { expiresAt: 'asc' }, take: 20, select: { id: true, totalPaise: true, expiresAt: true, business: { select: { id: true, name: true } } } }),
    prisma.payment.aggregate({ where: { receivedAt: { gte: monthStart() }, order: { business: scope } }, _sum: { amountPaise: true } }),
    prisma.order.findMany({ where: { business: scope, kind: 'new', status: 'paid', paidAt: { gte: since } }, select: { paidAt: true } }),
    a.role === 'admin' ? prisma.order.findMany({ where: { status: 'pending_approval' }, take: 10, select: { id: true, totalPaise: true, discountPct: true, couponCode: true, business: { select: { name: true } } } }) : Promise.resolve([]),
    team ? prisma.auditEntry.findMany({ where: { action: { notIn: ['auth.signed_in', 'auth.wrong_password', 'auth.wrong_code', 'auth.signed_out_others', 'me.updated'] } }, orderBy: { at: 'desc' }, take: 8 }) : Promise.resolve([]),
    prisma.consoleUser.findUniqueOrThrow({ where: { id: a.id }, select: { referralCode: true } }),
  ]);
  const count = (s: string) => subs.filter((x) => x.status === s).length;
  const trialsSoon = subs.filter((s) => s.status === 'trialing' && s.trialEndsAt && s.trialEndsAt.getTime() - now.getTime() < 7 * DAY);
  const notSignedIn = businesses.filter((b) => !signedIn(factsOf(b.facts), b.onboardedBy) && b.subscription && !['closed'].includes(b.subscription.status));
  const settingUp = businesses.filter((b) => signedIn(factsOf(b.facts), b.onboardedBy) && !factsOf(b.facts).setupDone && b.subscription?.status !== 'closed');
  const waiting = orders.reduce((t, o) => t + o.totalPaise, 0);

  const todo = [
    ...approvals.map((o) => ({ kind: 'discount', title: `Approve a discount for ${o.business.name}`, detail: `${o.couponCode ?? `${o.discountPct}% off`} · ₹${(o.totalPaise / 100).toLocaleString('en-IN')}`, href: '/billing?tab=orders&status=pending_approval', action: 'Review' })),
    ...orders.filter((o) => o.expiresAt.getTime() - now.getTime() < 3 * DAY).slice(0, 5).map((o) => ({ kind: 'unpaid', title: `${o.business.name} hasn’t paid yet`, detail: `₹${(o.totalPaise / 100).toLocaleString('en-IN')} · link ends ${o.expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`, href: `/businesses/${o.business.id}`, action: 'Open' })),
    ...notSignedIn.slice(0, 5).map((b) => ({ kind: 'signin', title: `${b.name}: owner hasn’t signed in`, detail: `${b.ownerName} · added ${b.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`, href: `/businesses/${b.id}`, action: 'Send link' })),
    ...businesses.filter((b) => b.subscription?.status === 'trialing' && b.subscription.trialEndsAt && b.subscription.trialEndsAt.getTime() - now.getTime() < 7 * DAY).slice(0, 5).map((b) => ({ kind: 'trial', title: `${b.name}: trial ends soon`, detail: `ends ${b.subscription!.trialEndsAt!.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`, href: `/businesses/${b.id}`, action: 'Call' })),
  ];

  const growth = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(since.getTime() + i * 7 * DAY);
    const end = new Date(start.getTime() + 7 * DAY);
    return {
      weekStart: start,
      newBusinesses: businesses.filter((b) => b.createdAt >= start && b.createdAt < end).length,
      firstPayments: firstPays.filter((o) => o.paidAt && o.paidAt >= start && o.paidAt < end).length,
    };
  });
  const planMix = Object.values(
    subs.filter((s) => s.status !== 'closed').reduce<Record<string, { key: string; name: string; count: number }>>((m, s) => {
      const key = s.status === 'trialing' ? 'trial' : s.planKey;
      m[key] ??= { key, name: s.status === 'trialing' ? 'On trial' : s.plan.name, count: 0 };
      m[key].count++;
      return m;
    }, {}),
  ).sort((x, y) => y.count - x.count);

  // A partner pays AHEAD one monthly bill, not per order: its money cards are about those bills
  const bills = a.partnerId ? await prisma.partnerBill.findMany({ where: { partnerId: a.partnerId }, orderBy: { month: 'desc' }, take: 12, select: { status: true, totalPaise: true, month: true } }) : [];
  const unpaidBills = bills.filter((x) => x.status === 'awaiting_payment');
  const money = a.partnerId
    ? [
        { key: 'waiting', label: 'Unpaid bills', value: unpaidBills.reduce((t, x) => t + x.totalPaise, 0), money: true, hint: unpaidBills.length ? `${unpaidBills.length} bill${unpaidBills.length === 1 ? '' : 's'} to pay` : 'All paid up', href: '/bills' },
        { key: 'received', label: 'Last bill', value: bills[0]?.totalPaise ?? 0, money: true, hint: bills[0] ? `${new Date(bills[0].month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} · ${bills[0].status === 'paid' ? 'paid' : 'unpaid'}` : 'First bill on the 1st of next month', href: '/bills' },
      ]
    : [
        { key: 'waiting', label: 'Waiting for payment', value: waiting, money: true, hint: `${orders.length} open order${orders.length === 1 ? '' : 's'}`, href: '/billing?status=awaiting_payment' },
        { key: 'received', label: 'Received this month', value: paidMonth._sum.amountPaise ?? 0, money: true, hint: 'Payments on orders', href: '/billing/payments' },
      ];
  res.json({
    stats: [
      { key: 'businesses', label: 'Businesses', value: subs.filter((s) => s.status !== 'closed').length, hint: `${count('trialing')} on trial · ${count('free')} on Free`, href: '/businesses' },
      { key: 'paying', label: a.partnerId ? 'Live on a plan' : 'Paying', value: count('active') + count('past_due'), hint: count('past_due') ? `${count('past_due')} payment overdue` : 'All paid up', href: '/businesses?status=active' },
      ...money,
      { key: 'attention', label: 'Need attention', value: todo.length, hint: `${trialsSoon.length} trial${trialsSoon.length === 1 ? '' : 's'} end this week`, href: '/' },
    ],
    todo,
    growth,
    planMix,
    onboarding: [...notSignedIn, ...settingUp].slice(0, 6).map((b) => ({ id: b.id, name: b.name, createdAt: b.createdAt, signedIn: signedIn(factsOf(b.facts), b.onboardedBy), percent: signedIn(factsOf(b.facts), b.onboardedBy) ? 50 : 25 })),
    recent: businesses.slice(0, 6).map((b) => ({ id: b.id, name: b.name, createdAt: b.createdAt, industryKey: b.industryKey, status: b.subscription?.status ?? null })),
    activity: team ? await describe(audits) : [],
    referral: me.referralCode ? await referralStats(a, me.referralCode) : null,
  });
});

async function referralStats(a: Actor, code: string) {
  const mine = await prisma.business.findMany({ where: { onboardedById: a.id }, select: { referralCode: true, subscription: { select: { status: true } } } });
  const viaCode = mine.filter((b) => b.referralCode === code);
  return { code, businesses: mine.length, viaCode: viaCode.length, paying: mine.filter((b) => b.subscription?.status === 'active' || b.subscription?.status === 'past_due').length };
}

router.get('/referral', allow('sales', 'vendor'), async (req, res) => {
  const me = await prisma.consoleUser.findUniqueOrThrow({ where: { id: req.staff!.id }, select: { referralCode: true } });
  if (!me.referralCode) throw new AppError('NOT_FOUND', 'You have no referral code.');
  const recent = await prisma.business.findMany({ where: { onboardedById: req.staff!.id }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, name: true, createdAt: true, referralCode: true, subscription: { select: { status: true, plan: { select: { name: true } } } } } });
  res.json({ ...(await referralStats(req.staff!, me.referralCode)), recent });
});

// ── Analytics ──

router.get('/analytics', validate(z.object({ months: z.coerce.number().int().refine((m) => [3, 6, 12].includes(m)).default(6) }), 'query'), async (req, res) => {
  const a = req.staff!;
  const scope = scopeOf(a);
  const months = (req.query as unknown as { months: number }).months;
  const since = monthStart(months - 1);
  const keys = Array.from({ length: months }, (_, i) => monthKey(monthStart(months - 1 - i)));
  const [created, payments, firstPaid, closed, subs, sources, partners] = await Promise.all([
    prisma.business.findMany({ where: { ...scope, createdAt: { gte: since } }, select: { createdAt: true, subscription: { select: { status: true } } } }),
    prisma.payment.findMany({ where: { receivedAt: { gte: since }, order: { business: scope } }, select: { receivedAt: true, amountPaise: true } }),
    prisma.order.findMany({ where: { business: scope, kind: 'new', status: 'paid', paidAt: { gte: since } }, select: { paidAt: true } }),
    prisma.subscription.findMany({ where: { business: scope, closedAt: { gte: since } }, select: { closedAt: true } }),
    prisma.subscription.findMany({ where: { business: scope }, select: { status: true, planKey: true, cycle: true, extraUsers: true, plan: { select: { name: true, monthlyPaise: true, yearlyPaise: true } } } }),
    prisma.business.groupBy({ by: ['onboardedBy'], where: { ...scope, createdAt: { gte: since } }, _count: true }),
    isTeam(a) ? prisma.business.groupBy({ by: ['partnerId'], where: { partnerId: { not: null }, subscription: { status: { in: ['active', 'past_due', 'trialing'] } } }, _count: true }) : Promise.resolve([]),
  ]);
  const by = <T>(rows: T[], at: (r: T) => Date | null, val: (r: T) => number = () => 1) => keys.map((k) => rows.filter((r) => at(r) && monthKey(at(r)!) === k).reduce((t, r) => t + val(r), 0));
  const live = subs.filter((s) => s.status === 'active' || s.status === 'past_due');
  // Monthly recurring revenue: list price of every paying plan, yearly plans spread over 12 months
  const mrr = live.reduce((t, s) => t + (s.cycle === 'yearly' ? Math.round((s.plan.yearlyPaise ?? 0) / 12) : s.plan.monthlyPaise ?? 0), 0);
  const trials = created.length;
  const converted = created.filter((b) => b.subscription?.status === 'active' || b.subscription?.status === 'past_due').length;
  const partnerNames = await prisma.partner.findMany({ where: { id: { in: partners.map((p) => p.partnerId!).filter(Boolean) } }, select: { id: true, name: true } });
  res.json({
    months: keys,
    newBusinesses: by(created, (b) => b.createdAt),
    firstPayments: by(firstPaid, (o) => o.paidAt),
    revenuePaise: by(payments, (p) => p.receivedAt, (p) => p.amountPaise),
    closed: by(closed, (s) => s.closedAt),
    totals: {
      mrrPaise: mrr,
      paying: live.length,
      revenuePaise: payments.reduce((t, p) => t + p.amountPaise, 0),
      newBusinesses: created.length,
      conversionPercent: trials ? Math.round((converted / trials) * 100) : 0,
      closed: closed.length,
    },
    plans: Object.values(subs.filter((s) => s.status !== 'closed').reduce<Record<string, { key: string; label: string; value: number }>>((m, s) => {
      m[s.planKey] ??= { key: s.planKey, label: s.plan.name, value: 0 };
      m[s.planKey].value++;
      return m;
    }, {})).sort((x, y) => y.value - x.value),
    sources: sources.map((s) => ({ key: s.onboardedBy, value: s._count })).sort((x, y) => y.value - x.value),
    partners: partners.map((p) => ({ key: p.partnerId!, label: partnerNames.find((n) => n.id === p.partnerId)?.name ?? 'Partner', value: p._count })).sort((x, y) => y.value - x.value).slice(0, 8),
  });
});

// ── Audit trail and sessions (Admin) ──

const AuditQuery = z.object({
  area: z.string().max(30).optional(),
  actorId: z.string().uuid().optional(),
  businessId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
router.get('/audit', validate(AuditQuery, 'query'), async (req, res) => {
  const q = req.query as unknown as z.infer<typeof AuditQuery>;
  // A business's own history is open to whoever can see the business; the whole trail is Admin's
  if (q.businessId) {
    const b = await prisma.business.findFirst({ where: { id: q.businessId, ...scopeOf(req.staff!) }, select: { id: true } });
    if (!b) throw new AppError('NOT_FOUND', 'Business not found.');
  } else if (req.staff!.role !== 'admin') throw new AppError('PERMISSION_DENIED', 'Only an Admin can read the audit trail.');
  const where: Prisma.AuditEntryWhereInput = {
    ...(q.area ? { action: { startsWith: `${q.area}.` } } : {}),
    ...(q.actorId ? { actorId: q.actorId } : {}),
    ...(q.businessId ? { entity: 'business', entityId: q.businessId } : {}),
    ...(q.search ? { action: { contains: q.search.toLowerCase().replace(/\s+/g, '_') } } : {}),
  };
  const [total, rows] = await Promise.all([prisma.auditEntry.count({ where }), prisma.auditEntry.findMany({ where, orderBy: { at: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit })]);
  res.json({ data: await describe(rows), total });
});

router.get('/sessions', allow('admin'), async (_req, res) => {
  const rows = await prisma.consoleSession.findMany({ where: { revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastUsedAt: 'desc' }, take: 200, select: { id: true, ip: true, userAgent: true, createdAt: true, lastUsedAt: true, user: { select: { id: true, name: true, email: true, role: true } } } });
  res.json({ data: rows });
});
router.delete('/sessions/:id', allow('admin'), validate(z.object({ id: z.string().uuid() }), 'params'), async (req, res) => {
  const s = await prisma.consoleSession.update({ where: { id: String(req.params.id) }, data: { revokedAt: new Date() }, select: { userId: true } });
  await audit({ actorId: req.staff!.id, action: 'session.ended', entity: 'console_user', entityId: s.userId });
  res.status(204).end();
});

export default router;
