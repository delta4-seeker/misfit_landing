import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import type { AuthenticationCreds, AuthenticationState, SignalDataSet, SignalDataTypeMap } from "@whiskeysockets/baileys";
import { BufferJSON, initAuthCreds } from "@whiskeysockets/baileys";
import type { PrismaClient } from "@prisma/client";

function encryptionKey() {
  const encoded = process.env.WHATSAPP_AUTH_ENCRYPTION_KEY;
  if (!encoded) throw new Error("WHATSAPP_AUTH_ENCRYPTION_KEY is required.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("WHATSAPP_AUTH_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return key;
}

function encode(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value, BufferJSON.replacer), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

function decode<T>(record: { ciphertext: Uint8Array; iv: Uint8Array; authTag: Uint8Array }) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(record.iv));
  decipher.setAuthTag(Buffer.from(record.authTag));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(record.ciphertext)), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"), BufferJSON.reviver) as T;
}

export async function databaseAuthState(prisma: PrismaClient): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const savedCreds = await prisma.whatsAppAuthState.findUnique({ where: { key: "creds" } });
  const creds = savedCreds ? decode<AuthenticationCreds>(savedCreds) : initAuthCreds();

  const saveValue = async (key: string, value: unknown) => {
    const encrypted = encode(value);
    await prisma.whatsAppAuthState.upsert({
      where: { key },
      create: { key, ...encrypted },
      update: encrypted,
    });
  };

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
        const keys = ids.map((id) => `${type}:${id}`);
        const records = await prisma.whatsAppAuthState.findMany({ where: { key: { in: keys } } });
        const byKey = new Map(records.map((record) => [record.key, record]));
        const result: Partial<Record<string, SignalDataTypeMap[T]>> = {};
        for (const id of ids) {
          const record = byKey.get(`${type}:${id}`);
          if (record) result[id] = decode<SignalDataTypeMap[T]>(record);
        }
        return result as { [id: string]: SignalDataTypeMap[T] };
      },
      set: async (data: SignalDataSet) => {
        const writes: Promise<unknown>[] = [];
        for (const type of Object.keys(data) as Array<keyof SignalDataTypeMap>) {
          const values = data[type];
          if (!values) continue;
          for (const [id, value] of Object.entries(values)) {
            const key = `${type}:${id}`;
            writes.push(value === null
              ? prisma.whatsAppAuthState.deleteMany({ where: { key } })
              : saveValue(key, value));
          }
        }
        await Promise.all(writes);
      },
      clear: async () => {
        await prisma.whatsAppAuthState.deleteMany();
      },
    },
  };

  return { state, saveCreds: () => saveValue("creds", state.creds) };
}
