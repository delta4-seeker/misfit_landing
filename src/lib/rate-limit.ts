import "server-only";

import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function consumeRateLimit(action: string, subject: string, limit: number, windowMs: number) {
  const now = Date.now();
  const windowNumber = Math.floor(now / windowMs);
  const subjectHash = hash(subject.toLowerCase());
  const id = hash(`${action}:${subjectHash}:${windowNumber}`);
  const entry = await prisma.actionRateLimit.upsert({
    where: { id },
    create: {
      id,
      action,
      subjectHash,
      count: 1,
      expiresAt: new Date((windowNumber + 1) * windowMs),
    },
    update: { count: { increment: 1 } },
    select: { count: true },
  });

  // Opportunistic cleanup keeps this table bounded without a cron dependency.
  if (Math.random() < 0.01) {
    void prisma.actionRateLimit.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }).catch(() => undefined);
  }
  return entry.count <= limit;
}
