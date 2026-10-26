import { createServer } from "node:http";

import makeWASocket, {
  Browsers,
  DisconnectReason,
  isJidGroup,
  makeCacheableSignalKeyStore,
  normalizeMessageContent,
  toNumber,
  type WAMessage,
  type WAMessageKey,
} from "@whiskeysockets/baileys";
import { PrismaClient } from "@prisma/client";
import pino from "pino";
import qrcode from "qrcode-terminal";

import { databaseAuthState } from "./auth-store";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const prisma = new PrismaClient({ log: ["error", "warn"] });
const healthPort = Number(process.env.PORT || 8080);
let shuttingDown = false;
let reconnectTimer: NodeJS.Timeout | undefined;
let currentStatus = "STARTING";
const groupNames = new Map<string, string>();

function jidPhone(jid?: string | null) {
  if (!jid || (!jid.endsWith("@s.whatsapp.net") && !jid.includes(":"))) return null;
  const digits = jid.split("@")[0].split(":")[0].replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

function messageDate(message: WAMessage) {
  const value = message.messageTimestamp;
  if (!value) return new Date();
  return new Date(toNumber(value) * 1000);
}

function messageKind(message: WAMessage) {
  const content = normalizeMessageContent(message.message);
  if (!content) return "unknown";
  if (content.imageMessage) return "image";
  if (content.videoMessage) return "video";
  if (content.audioMessage) return "audio";
  if (content.documentMessage) return "document";
  if (content.stickerMessage) return "sticker";
  if (content.contactMessage || content.contactsArrayMessage) return "contact";
  if (content.locationMessage || content.liveLocationMessage) return "location";
  if (content.pollCreationMessage) return "poll";
  if (content.conversation || content.extendedTextMessage) return "text";
  return "other";
}

function participantFromKey(key: WAMessageKey) {
  return key.participantAlt || key.participant || (key.fromMe ? key.remoteJidAlt : undefined) || key.remoteJid;
}

async function upsertMember(externalId: string, displayName: string | null, seenAt: Date) {
  return prisma.whatsAppMember.upsert({
    where: { externalId },
    create: { externalId, displayName, phone: jidPhone(externalId), firstSeenAt: seenAt, lastSeenAt: seenAt },
    update: { ...(displayName ? { displayName } : {}), ...(jidPhone(externalId) ? { phone: jidPhone(externalId) } : {}), lastSeenAt: seenAt },
    select: { id: true },
  });
}

async function groupName(sock: ReturnType<typeof makeWASocket>, jid: string) {
  const cached = groupNames.get(jid);
  if (cached) return cached;
  try {
    const metadata = await sock.groupMetadata(jid);
    const name = metadata.subject || "WhatsApp group";
    groupNames.set(jid, name);
    return name;
  } catch {
    return "WhatsApp group";
  }
}

async function upsertGroup(sock: ReturnType<typeof makeWASocket>, externalId: string, lastMessageAt?: Date) {
  const name = await groupName(sock, externalId);
  const group = await prisma.whatsAppGroup.upsert({
    where: { externalId },
    create: { externalId, name, lastMessageAt },
    update: { name },
    select: { id: true, enabled: true },
  });
  if (lastMessageAt) {
    await prisma.whatsAppGroup.updateMany({ where: { id: group.id, OR: [{ lastMessageAt: null }, { lastMessageAt: { lt: lastMessageAt } }] }, data: { lastMessageAt } });
  }
  return group;
}

async function storeMessage(sock: ReturnType<typeof makeWASocket>, message: WAMessage) {
  const groupJid = message.key.remoteJid;
  const externalId = message.key.id;
  const participant = participantFromKey(message.key);
  if (!groupJid || !externalId || !participant || !isJidGroup(groupJid)) return;
  const content = normalizeMessageContent(message.message);
  if (content?.reactionMessage || content?.protocolMessage) return;
  const sentAt = messageDate(message);
  const [group, author] = await Promise.all([
    upsertGroup(sock, groupJid, sentAt),
    upsertMember(participant, message.pushName || null, sentAt),
  ]);
  if (!group.enabled) return;
  await prisma.whatsAppMessage.upsert({
    where: { groupId_externalId: { groupId: group.id, externalId } },
    create: { groupId: group.id, authorId: author.id, externalId, sentAt, kind: messageKind(message), source: "LIVE" },
    update: { authorId: author.id, sentAt, kind: messageKind(message), deletedAt: null },
  });
  await prisma.whatsAppConnectionState.upsert({ where: { id: 1 }, create: { id: 1, status: "CONNECTED", lastEventAt: sentAt }, update: { lastEventAt: sentAt } });
}

async function storeReaction(sock: ReturnType<typeof makeWASocket>, targetKey: WAMessageKey, reaction: { key?: WAMessageKey | null; text?: string | null; senderTimestampMs?: number | Long | null }) {
  const groupJid = targetKey.remoteJid;
  const targetExternalId = targetKey.id;
  const targetAuthorJid = participantFromKey(targetKey);
  const reactorJid = reaction.key ? participantFromKey(reaction.key) : undefined;
  if (!groupJid || !targetExternalId || !targetAuthorJid || !reactorJid || !isJidGroup(groupJid)) return;
  const reactedAt = reaction.senderTimestampMs ? new Date(toNumber(reaction.senderTimestampMs) * 1000) : new Date();
  const [group, recipient, reactor] = await Promise.all([
    upsertGroup(sock, groupJid),
    upsertMember(targetAuthorJid, null, reactedAt),
    upsertMember(reactorJid, null, reactedAt),
  ]);
  if (!group.enabled) return;
  const target = await prisma.whatsAppMessage.upsert({
    where: { groupId_externalId: { groupId: group.id, externalId: targetExternalId } },
    create: { groupId: group.id, authorId: recipient.id, externalId: targetExternalId, sentAt: reactedAt, kind: "unknown", source: "LIVE" },
    update: {},
    select: { id: true, authorId: true },
  });
  const emoji = reaction.text || "";
  await prisma.whatsAppReaction.upsert({
    where: { messageId_reactorId: { messageId: target.id, reactorId: reactor.id } },
    create: { messageId: target.id, reactorId: reactor.id, recipientId: target.authorId, emoji, reactedAt, removedAt: emoji ? null : reactedAt, source: "LIVE" },
    update: { recipientId: target.authorId, emoji, reactedAt, removedAt: emoji ? null : reactedAt },
  });
}

async function markDeleted(keys: WAMessageKey[]) {
  for (const key of keys) {
    if (!key.remoteJid || !key.id) continue;
    const group = await prisma.whatsAppGroup.findUnique({ where: { externalId: key.remoteJid }, select: { id: true } });
    if (group) await prisma.whatsAppMessage.updateMany({ where: { groupId: group.id, externalId: key.id }, data: { deletedAt: new Date() } });
  }
}

async function updateConnection(status: "PAIRING" | "CONNECTING" | "CONNECTED" | "RECONNECTING" | "DISCONNECTED" | "LOGGED_OUT" | "ERROR", data: { accountExternalId?: string | null; displayName?: string | null; error?: string | null } = {}) {
  currentStatus = status;
  await prisma.whatsAppConnectionState.upsert({
    where: { id: 1 },
    create: { id: 1, status, accountExternalId: data.accountExternalId, displayName: data.displayName, lastError: data.error, ...(status === "CONNECTED" ? { lastConnectedAt: new Date() } : {}) },
    update: { status, ...(data.accountExternalId !== undefined ? { accountExternalId: data.accountExternalId } : {}), ...(data.displayName !== undefined ? { displayName: data.displayName } : {}), ...(data.error !== undefined ? { lastError: data.error } : {}), ...(status === "CONNECTED" ? { lastConnectedAt: new Date(), lastError: null } : {}) },
  });
}

async function connect() {
  await updateConnection("CONNECTING");
  const { state, saveCreds } = await databaseAuthState(prisma);
  const socket = makeWASocket({
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    logger,
    browser: Browsers.ubuntu("Misfit Founders Club"),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
  });

  socket.ev.on("creds.update", saveCreds);
  socket.ev.on("messages.upsert", async ({ messages }) => {
    for (const message of messages) await storeMessage(socket, message).catch((error) => logger.error({ error }, "Failed to store WhatsApp message metadata"));
  });
  socket.ev.on("messages.reaction", async (items) => {
    for (const item of items) await storeReaction(socket, item.key, item.reaction).catch((error) => logger.error({ error }, "Failed to store WhatsApp reaction"));
  });
  socket.ev.on("messages.delete", async (event) => {
    if ("keys" in event) await markDeleted(event.keys).catch((error) => logger.error({ error }, "Failed to mark deleted WhatsApp messages"));
  });
  socket.ev.on("groups.upsert", async (groups) => {
    for (const group of groups) {
      if (!group.id) continue;
      groupNames.set(group.id, group.subject || "WhatsApp group");
      await prisma.whatsAppGroup.upsert({ where: { externalId: group.id }, create: { externalId: group.id, name: group.subject || "WhatsApp group" }, update: { name: group.subject || "WhatsApp group" } });
    }
  });
  socket.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      await updateConnection("PAIRING");
      logger.info("Scan this QR code from WhatsApp → Linked devices");
      qrcode.generate(qr, { small: true });
    }
    if (connection === "open") {
      await updateConnection("CONNECTED", { accountExternalId: socket.user?.id || null, displayName: socket.user?.name || null });
      logger.info({ account: socket.user?.id }, "WhatsApp collector connected");
    }
    if (connection === "close" && !shuttingDown) {
      const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      const message = lastDisconnect?.error instanceof Error ? lastDisconnect.error.message : `Connection closed (${statusCode || "unknown"})`;
      await updateConnection(loggedOut ? "LOGGED_OUT" : "RECONNECTING", { error: message });
      if (loggedOut) {
        logger.error("WhatsApp logged out. Run the worker interactively and scan a new QR code.");
      } else {
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => connect().catch(handleFatal), 5_000);
      }
    }
  });
}

function handleFatal(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  logger.error({ error }, "WhatsApp collector failed");
  updateConnection("ERROR", { error: message }).catch(() => undefined);
  if (!shuttingDown) {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => connect().catch(handleFatal), 15_000);
  }
}

const healthServer = createServer((request, response) => {
  if (request.url !== "/health") {
    response.writeHead(404).end();
    return;
  }
  const healthy = currentStatus !== "ERROR" && currentStatus !== "LOGGED_OUT";
  response.writeHead(healthy ? 200 : 503, { "content-type": "application/json" });
  response.end(JSON.stringify({ status: currentStatus }));
});
healthServer.listen(healthPort, "0.0.0.0", () => logger.info({ port: healthPort }, "Collector health endpoint ready"));

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  clearTimeout(reconnectTimer);
  logger.info({ signal }, "Stopping WhatsApp collector");
  await updateConnection("DISCONNECTED").catch(() => undefined);
  healthServer.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

connect().catch(handleFatal);
