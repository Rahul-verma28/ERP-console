import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../../kernel/db';
import { AppError } from '../../kernel/errors';
import { normaliseEmail, normaliseMobile } from '../../kernel/crypto';
import { audit } from '../../kernel/audit';
import { readStep } from '../../kernel/tokens';
import { validate } from '../../middleware/request';
import { requireStaff } from '../../middleware/auth';
import { testing } from '../../config/env';
import { changePassword, turnOffMfa, turnOnMfa, enableMfa, linkInfo, login, loginWithCode, logout, mfaSecretFor, refresh, sendAccountLink, setPassword } from './service';

const router = Router();
// Ten tries a minute per address for anything that checks a secret
const limiter = rateLimit({ windowMs: 60_000, limit: testing ? 10_000 : 10, standardHeaders: true, legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Too many tries. Wait a minute and try again.' } } });

const Email = z.string().trim().email('Enter a valid email').transform(normaliseEmail);
const Code = z.string().regex(/^\d{6}$/, 'Enter the 6-digit code');

router.post('/login', limiter, validate(z.object({ email: Email, password: z.string().min(1, 'Enter your password').max(128) })), async (req, res) => {
  res.json(await login(req, res, req.body.email, req.body.password));
});

router.post('/mfa', limiter, validate(z.object({ mfaToken: z.string(), code: Code })), async (req, res) => {
  res.json(await loginWithCode(req, res, readStep('mfa', req.body.mfaToken), req.body.code));
});

/** Two-step setup during sign-in (roles that must have it) */
router.post('/mfa/setup', limiter, validate(z.object({ setupToken: z.string() })), async (req, res) => {
  res.json(await mfaSecretFor(readStep('mfa_setup', req.body.setupToken)));
});
router.post('/mfa/enable', limiter, validate(z.object({ setupToken: z.string(), code: Code })), async (req, res) => {
  res.json(await enableMfa(req, res, readStep('mfa_setup', req.body.setupToken), req.body.code));
});

router.post('/refresh', async (req, res) => {
  res.json(await refresh(req, res));
});

router.post('/logout', async (req, res) => {
  await logout(req, res);
  res.status(204).end();
});

/** Forgot password: the same answer whether or not the email has an account here */
router.post('/forgot', limiter, validate(z.object({ email: Email })), async (req, res) => {
  const user = await prisma.consoleUser.findUnique({ where: { email: req.body.email }, select: { id: true, status: true } });
  if (user && user.status !== 'disabled') await sendAccountLink(user.id, 'reset');
  res.json({ sent: true });
});

router.get('/link/:token', limiter, async (req, res) => {
  const l = await linkInfo(String(req.params.token));
  res.json({ name: l.user.name, email: l.user.email, purpose: l.purpose });
});
router.post('/link/:token', limiter, validate(z.object({ password: z.string().min(1).max(128) })), async (req, res) => {
  await setPassword(String(req.params.token), req.body.password);
  res.json({ done: true });
});

export default router;

/** The signed-in person: who they are, their own name and mobile, their password and sessions */
export const meRoute = Router();
meRoute.use(requireStaff);
const meSelect = { id: true, name: true, email: true, mobile: true, role: true, referralCode: true, mfaEnabledAt: true, partner: { select: { id: true, name: true, code: true } } } as const;
meRoute.get('/', async (req, res) => {
  const [u, look] = await Promise.all([prisma.consoleUser.findUniqueOrThrow({ where: { id: req.staff!.id }, select: meSelect }), prisma.setting.findUnique({ where: { key: 'appearance' } })]);
  res.json({ ...u, mfaEnabled: !!u.mfaEnabledAt, appearance: look?.value ?? null });
});
meRoute.patch('/', validate(z.object({ name: z.string().trim().min(2, 'Enter your name').max(100), mobile: z.string().trim().regex(/^(\+91)?[6-9]\d{9}$/, 'Enter a 10-digit mobile').transform(normaliseMobile).nullable() })), async (req, res) => {
  const u = await prisma.consoleUser.update({ where: { id: req.staff!.id }, data: { name: req.body.name, mobile: req.body.mobile }, select: meSelect });
  await audit({ actorId: req.staff!.id, action: 'me.updated', entity: 'console_user', entityId: u.id, after: { name: u.name, mobile: u.mobile } });
  res.json({ ...u, mfaEnabled: !!u.mfaEnabledAt });
});
meRoute.post('/password', limiter, validate(z.object({ current: z.string().min(1, 'Enter your current password').max(128), password: z.string().min(1, 'Enter a new password').max(128) })), async (req, res) => {
  await changePassword(req.staff!.id, req.staff!.sessionId, req.body.current, req.body.password);
  res.json({ done: true });
});
/** Two-step sign-in from My account: start (a new secret), turn on with the first code, or turn off */
meRoute.post('/mfa/setup', limiter, async (req, res) => {
  const u = await prisma.consoleUser.findUniqueOrThrow({ where: { id: req.staff!.id }, select: { mfaEnabledAt: true } });
  if (u.mfaEnabledAt) throw new AppError('CONFLICT', 'Two-step sign-in is already on.');
  res.json(await mfaSecretFor(req.staff!.id));
});
meRoute.post('/mfa/enable', limiter, validate(z.object({ code: Code })), async (req, res) => {
  await turnOnMfa(req.staff!.id, req.body.code, req.ip);
  res.json({ done: true });
});
meRoute.post('/mfa/disable', limiter, validate(z.object({ password: z.string().min(1, 'Enter your password').max(128) })), async (req, res) => {
  await turnOffMfa(req.staff!.id, req.staff!.role, req.body.password, req.ip);
  res.json({ done: true });
});
meRoute.get('/sessions', async (req, res) => {
  const rows = await prisma.consoleSession.findMany({ where: { userId: req.staff!.id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, select: { id: true, ip: true, userAgent: true, createdAt: true } });
  res.json({ data: rows.map((r) => ({ ...r, current: r.id === req.staff!.sessionId })) });
});
meRoute.post('/sessions/sign-out-others', async (req, res) => {
  const out = await prisma.consoleSession.updateMany({ where: { userId: req.staff!.id, revokedAt: null, id: { not: req.staff!.sessionId } }, data: { revokedAt: new Date() } });
  await audit({ actorId: req.staff!.id, action: 'auth.signed_out_others', entity: 'console_user', entityId: req.staff!.id });
  res.json({ ended: out.count });
});
