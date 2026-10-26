import "server-only";

import { createHash } from "node:crypto";

export type WhatsAppDateOrder = "DMY" | "MDY";

export type ImportedWhatsAppMessage = {
  externalId: string;
  senderExternalId: string;
  senderLabel: string;
  phone: string | null;
  sentAt: Date;
  kind: string;
};

type PendingMessage = {
  senderLabel: string;
  sentAt: Date;
  body: string;
};

const IOS_LINE = /^\[([^,]+),\s*([^\]]+)\]\s+([^:]+):\s?(.*)$/;
const ANDROID_LINE = /^([^,]+),\s*([^\-]+?)\s+-\s+([^:]+):\s?(.*)$/;

function stableHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function cleanExportText(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/[\u200e\u200f]/g, "")
    .replace(/\u202f/g, " ")
    .replace(/\r\n?/g, "\n");
}

function parseExportDate(dateValue: string, timeValue: string, order: WhatsAppDateOrder) {
  const dateParts = dateValue.trim().split(/[/.\-]/).map((part) => Number(part));
  if (dateParts.length !== 3 || dateParts.some((part) => !Number.isInteger(part))) return null;
  const [first, second] = dateParts;
  let year = dateParts[2];
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  const day = order === "DMY" ? first : second;
  const month = order === "DMY" ? second : first;

  const normalizedTime = timeValue.trim().toUpperCase();
  const match = normalizedTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const secondValue = Number(match[3] || 0);
  const meridiem = match[4];
  if (meridiem) {
    if (hour === 12) hour = 0;
    if (meridiem === "PM") hour += 12;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || secondValue > 59) return null;
  const date = new Date(year, month - 1, day, hour, minute, secondValue);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function messageKind(body: string) {
  const normalized = body.toLowerCase();
  if (/image omitted|photo omitted/.test(normalized)) return "image";
  if (/video omitted/.test(normalized)) return "video";
  if (/audio omitted|voice message omitted/.test(normalized)) return "audio";
  if (/sticker omitted/.test(normalized)) return "sticker";
  if (/document omitted|file omitted/.test(normalized)) return "document";
  if (/contact card omitted/.test(normalized)) return "contact";
  if (/location omitted/.test(normalized)) return "location";
  if (/poll/.test(normalized)) return "poll";
  return "text";
}

function phoneFromLabel(label: string) {
  const compact = label.replace(/[^\d+]/g, "");
  const digits = compact.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return compact.startsWith("+") ? `+${digits}` : digits;
}

export function parseWhatsAppExport(text: string, groupKey: string, dateOrder: WhatsAppDateOrder) {
  const pending: PendingMessage[] = [];
  let current: PendingMessage | null = null;
  let ignoredLines = 0;

  for (const rawLine of cleanExportText(text).split("\n")) {
    const line = rawLine.trimEnd();
    const match = IOS_LINE.exec(line) || ANDROID_LINE.exec(line);
    if (match) {
      const sentAt = parseExportDate(match[1], match[2], dateOrder);
      const senderLabel = match[3].trim();
      if (sentAt && senderLabel) {
        if (current) pending.push(current);
        current = { senderLabel, sentAt, body: match[4] || "" };
        continue;
      }
    }
    if (current) {
      current.body += `\n${line}`;
    } else if (line.trim()) {
      ignoredLines += 1;
    }
  }
  if (current) pending.push(current);

  const occurrences = new Map<string, number>();
  const messages = pending.map<ImportedWhatsAppMessage>((message) => {
    const senderKey = message.senderLabel.trim().toLocaleLowerCase("en-US");
    const digest = stableHash(`${message.sentAt.toISOString()}\n${senderKey}\n${message.body}`);
    const occurrence = (occurrences.get(digest) || 0) + 1;
    occurrences.set(digest, occurrence);
    return {
      externalId: `import:${digest.slice(0, 32)}:${occurrence}`,
      senderExternalId: `import:${stableHash(`${groupKey}\n${senderKey}`).slice(0, 32)}`,
      senderLabel: message.senderLabel,
      phone: phoneFromLabel(message.senderLabel),
      sentAt: message.sentAt,
      kind: messageKind(message.body),
    };
  });

  return { messages, ignoredLines };
}
