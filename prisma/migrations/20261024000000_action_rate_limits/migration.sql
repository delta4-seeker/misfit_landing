-- Durable, per-action abuse controls for public and authenticated mutations.
CREATE TABLE "ActionRateLimit" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "subjectHash" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionRateLimit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActionRateLimit_expiresAt_idx" ON "ActionRateLimit"("expiresAt");
