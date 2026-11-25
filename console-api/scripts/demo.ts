import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { prisma } from '../src/kernel/db';
import { signAccess } from '../src/kernel/tokens';

// Demo data for a development Console, made through the API exactly as a person would make it, so
// each business also gets its workspace in the ERP: businesses on trial, paying (bank and UPI),
// waiting for payment, one closed; a coupon; a salesperson; and a website application.
// Acts as the first active Admin. Run against servers with email off:
//   PORT=5101 SMTP_HOST= npx tsx src/server.ts   then   npm run demo
// Development only: refuses to run in production.

const API = `${process.env.DEMO_BASE ?? 'http://127.0.0.1:5101'}/api/v1`;
let token = '';
async function call<T = any>(method: string, path: string, body?: unknown): Promise<{ status: number; body: T }> {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { json = text; }
  if (r.status >= 400) console.warn(`  ! ${method} ${path} → ${r.status} ${json?.error?.message ?? ''}`);
  return { status: r.status, body: json };
}
const mobile = () => `9${String(800000000 + Math.floor(Math.random() * 199999999)).slice(0, 9)}`;
const tag = randomBytes(2).toString('hex');

const BUSINESSES = [
  { name: 'Sharma Electronics', industryKey: 'retail', stateCode: '27', owner: 'Ravi Sharma', start: { kind: 'paid', planKey: 'standard', cycle: 'monthly', extraUsers: 2 }, pay: { method: 'bank', reference: 'HDFC24112610231' } },
  { name: 'Shree Ganesh Medicals', industryKey: 'health', stateCode: '24', owner: 'Mehul Patel', start: { kind: 'paid', planKey: 'professional', cycle: 'yearly', couponCode: 'DIWALI20' }, pay: { method: 'upi', reference: 'UPI/432112345678' } },
  { name: 'Glow Beauty Studio', industryKey: 'beauty_wellness', stateCode: '29', owner: 'Ananya Rao', start: { kind: 'trial' } },
  { name: 'FitZone Gym', industryKey: 'fitness', stateCode: '07', owner: 'Karan Malhotra', start: { kind: 'trial' } },
  { name: 'Bright Minds Coaching', industryKey: 'education', stateCode: '09', owner: 'Pooja Srivastava', start: { kind: 'paid', planKey: 'standard', cycle: 'monthly' } },
  { name: 'Annapurna Caterers', industryKey: 'food', stateCode: '33', owner: 'Lakshmi Iyer', start: { kind: 'trial' }, close: true },
] as const;

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo data is for development only.');
  const admin = await prisma.consoleUser.findFirst({ where: { role: 'admin', status: 'active' }, orderBy: { createdAt: 'asc' } });
  if (!admin) throw new Error('No active Admin yet. Add one first: npm run staff:add -- --email … --name …');
  const session = await prisma.consoleSession.create({ data: { userId: admin.id, refreshHash: randomBytes(24).toString('hex'), expiresAt: new Date(Date.now() + 3_600_000) } });
  token = signAccess({ sub: admin.id, role: admin.role, pid: admin.partnerId, sid: session.id });
  console.log(`Demo data as ${admin.name}`);

  if (!(await prisma.coupon.findUnique({ where: { code: 'DIWALI20' } }))) {
    await call('POST', '/catalog/coupons', { code: 'DIWALI20', percentOff: 20, validUntil: new Date(Date.now() + 30 * 86_400_000).toISOString(), maxUses: 100, planKeys: [] });
    console.log('  ✔ coupon DIWALI20');
  }

  for (const b of BUSINESSES) {
    // A second run adds a short tag so names stay unique
    const name = (await prisma.business.findFirst({ where: { name: b.name }, select: { id: true } })) ? `${b.name} ${tag}` : b.name;
    const email = `${b.owner.split(' ')[0].toLowerCase()}.${tag}@example.test`;
    const made = await call<{ id: string; firstOrder: { id: string; totalPaise: number } | null }>('POST', '/businesses', { name, legalName: null, industryKey: b.industryKey, gstin: null, stateCode: b.stateCode, owner: { name: b.owner, email, mobile: mobile() }, start: b.start });
    if (made.status !== 201) continue;
    console.log(`  ✔ ${name} (${b.start.kind})`);
    if ('pay' in b && made.body.firstOrder) {
      const paid = await call('POST', `/billing/orders/${made.body.firstOrder.id}/payments`, { method: b.pay.method, reference: b.pay.reference, amountPaise: made.body.firstOrder.totalPaise });
      if (paid.status === 201) console.log(`    paid by ${b.pay.method}`);
    }
    if ('close' in b && b.close) {
      // The ERP makes the workspace first; closing waits for it
      for (let i = 0; i < 20 && !(await prisma.business.findUnique({ where: { id: made.body.id }, select: { provisionedAt: true } }))?.provisionedAt; i++) await new Promise((r) => setTimeout(r, 1000));
      if ((await call('POST', `/businesses/${made.body.id}/close`)).status === 200) console.log('    closed');
    }
  }

  if (!(await prisma.consoleUser.findFirst({ where: { email: `neha.kapoor.${tag}@example.test` } }))) {
    const sales = await call('POST', '/team', { name: 'Neha Kapoor', email: `neha.kapoor.${tag}@example.test`, mobile: mobile(), role: 'sales' });
    if (sales.status === 201) console.log('  ✔ salesperson Neha Kapoor (invited)');
  }
  token = '';
  const app = await call('POST', '/public/applications', { kind: 'vendor', name: 'Rohit Verma', company: 'Verma Digital Services', email: `rohit.${tag}@example.test`, mobile: mobile(), city: 'Lucknow', stateCode: '09', gstin: null, message: 'I run a small IT shop and look after 40+ local businesses. I would like to offer AHEAD to them.', website: '' });
  if (app.status === 201) console.log('  ✔ vendor application from Rohit Verma');

  await prisma.consoleSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  console.log('Done. The ERP makes each workspace within a few seconds.');
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
