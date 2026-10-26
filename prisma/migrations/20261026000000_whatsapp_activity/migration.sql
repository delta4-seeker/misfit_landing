-- CreateEnum
CREATE TYPE "WhatsAppRecordSource" AS ENUM ('LIVE', 'IMPORT');

-- CreateEnum
CREATE TYPE "WhatsAppConnectionStatus" AS ENUM ('NOT_CONFIGURED', 'PAIRING', 'CONNECTING', 'CONNECTED', 'RECONNECTING', 'DISCONNECTED', 'LOGGED_OUT', 'ERROR');

-- CreateTable
CREATE TABLE "WhatsAppGroup" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMember" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "displayName" TEXT,
    "phone" TEXT,
    "linkedUserId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppImportBatch" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "fileName" TEXT,
    "importedMessages" INTEGER NOT NULL DEFAULT 0,
    "skippedMessages" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "importBatchId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "source" "WhatsAppRecordSource" NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "reactorId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "reactedAt" TIMESTAMP(3) NOT NULL,
    "removedAt" TIMESTAMP(3),
    "source" "WhatsAppRecordSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppConnectionState" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "status" "WhatsAppConnectionStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "accountExternalId" TEXT,
    "displayName" TEXT,
    "lastConnectedAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConnectionState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppAuthState" (
    "key" TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "authTag" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppAuthState_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppGroup_externalId_key" ON "WhatsAppGroup"("externalId");
CREATE INDEX "WhatsAppGroup_enabled_idx" ON "WhatsAppGroup"("enabled");
CREATE UNIQUE INDEX "WhatsAppMember_externalId_key" ON "WhatsAppMember"("externalId");
CREATE INDEX "WhatsAppMember_linkedUserId_idx" ON "WhatsAppMember"("linkedUserId");
CREATE INDEX "WhatsAppMember_lastSeenAt_idx" ON "WhatsAppMember"("lastSeenAt");
CREATE INDEX "WhatsAppImportBatch_createdAt_idx" ON "WhatsAppImportBatch"("createdAt");
CREATE UNIQUE INDEX "WhatsAppMessage_groupId_externalId_key" ON "WhatsAppMessage"("groupId", "externalId");
CREATE INDEX "WhatsAppMessage_authorId_sentAt_idx" ON "WhatsAppMessage"("authorId", "sentAt");
CREATE INDEX "WhatsAppMessage_groupId_sentAt_idx" ON "WhatsAppMessage"("groupId", "sentAt");
CREATE INDEX "WhatsAppMessage_importBatchId_idx" ON "WhatsAppMessage"("importBatchId");
CREATE UNIQUE INDEX "WhatsAppReaction_messageId_reactorId_key" ON "WhatsAppReaction"("messageId", "reactorId");
CREATE INDEX "WhatsAppReaction_recipientId_reactedAt_idx" ON "WhatsAppReaction"("recipientId", "reactedAt");
CREATE INDEX "WhatsAppReaction_reactorId_reactedAt_idx" ON "WhatsAppReaction"("reactorId", "reactedAt");

-- AddForeignKey
ALTER TABLE "WhatsAppMember" ADD CONSTRAINT "WhatsAppMember_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhatsAppImportBatch" ADD CONSTRAINT "WhatsAppImportBatch_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "WhatsAppGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "WhatsAppGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "WhatsAppMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "WhatsAppImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhatsAppReaction" ADD CONSTRAINT "WhatsAppReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "WhatsAppMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsAppReaction" ADD CONSTRAINT "WhatsAppReaction_reactorId_fkey" FOREIGN KEY ("reactorId") REFERENCES "WhatsAppMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsAppReaction" ADD CONSTRAINT "WhatsAppReaction_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "WhatsAppMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
