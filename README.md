# AHEAD Console

Central management, subscription billing, licensing, and partner portal for AHEAD ERP.

## Structure

- **`console-api/`**: Express.js + Prisma service managing staff authentication, tenant provisioning, Ed25519 signed license generation, subscription plans, Razorpay payments, and partner management.
- **`console-web/`**: Next.js dashboard application for AHEAD administrators, operations staff, and partners.
- **`docs/`**: UI rules and architecture documentation.

## Getting Started

### Backend (`console-api`)
```bash
cd console-api
npm install
cp .env.example .env
# Configure database credentials in .env
npm run db:prepare
npm run dev
```

### Frontend (`console-web`)
```bash
cd console-web
npm install
npm run dev
```
