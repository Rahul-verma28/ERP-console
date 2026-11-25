import type { Prisma } from '@prisma/client';
import { prisma, type Tx } from './db';

/** A person's id, or null when the change was made by the system or an ERP installation */
export const personId = (id: string | null | undefined) => (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null);

/** Kept silently in the background (no reason dialogs on normal edits); Admin can read it */
export async function audit(e: { actorId?: string | null; action: string; entity: string; entityId?: string | null; before?: unknown; after?: unknown; ip?: string | null }, tx: Tx | typeof prisma = prisma) {
  await tx.auditEntry.create({
    data: {
      actorId: personId(e.actorId),
      action: e.action,
      entity: e.entity,
      entityId: e.entityId ?? null,
      before: (e.before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (e.after ?? undefined) as Prisma.InputJsonValue | undefined,
      ip: e.ip ?? null,
    },
  });
}
