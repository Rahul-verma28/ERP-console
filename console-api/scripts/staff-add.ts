// Adds the first Admin (or any AHEAD team member) from the command line. After that, people are
// added from the Console's Team page. The person gets an email with a link to set their password.
//
//   npm run staff:add -- --email you@ahead.in --name "Your Name"
//   npm run staff:add -- --email new@ahead.in --name "New Person" --role staff
import 'dotenv/config';
import { prisma } from '../src/kernel/db';
import { normaliseEmail } from '../src/kernel/crypto';
import { sendAccountLink } from '../src/modules/auth/service';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const email = arg('email');
  const name = arg('name');
  const role = (arg('role') ?? 'admin') as 'admin' | 'staff' | 'sales' | 'vendor';
  if (!email || !name) throw new Error('Give --email and --name');
  if (!['admin', 'staff', 'sales', 'vendor'].includes(role)) throw new Error('--role is admin, staff, sales or vendor');
  const e = normaliseEmail(email);
  const user = (await prisma.consoleUser.findUnique({ where: { email: e } })) ?? (await prisma.consoleUser.create({ data: { email: e, name: name.trim(), role } }));
  await sendAccountLink(user.id, user.passwordHash ? 'reset' : 'invite');
  console.log(`✔ ${user.name} (${user.role}) — a link to set the password was emailed to ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
