import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

const acceptedImages = new Set(["image/jpeg", "image/png", "image/webp"]);
const imageExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function safeFolder(folder: string) {
  return folder
    .split("/")
    .map((part) => part.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/(^-|-$)/g, ""))
    .filter(Boolean)
    .join("/");
}

function hasValidSignature(bytes: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/webp") return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  return false;
}

async function saveLocally(bytes: Buffer, mimeType: string, folder: string) {
  const relativeFolder = safeFolder(folder) || "misc";
  const filename = `${crypto.randomUUID()}.${imageExtensions[mimeType]}`;
  const uploadDirectory = path.join(process.cwd(), "public", "uploads", relativeFolder);
  await mkdir(uploadDirectory, { recursive: true });
  await writeFile(path.join(uploadDirectory, filename), bytes);
  return `/uploads/${relativeFolder}/${filename}`;
}

export async function uploadImage(file: File, folder: string, maxMb: number) {
  if (!acceptedImages.has(file.type)) throw new Error("Use a JPG, PNG, or WebP image.");
  if (file.size > maxMb * 1024 * 1024) throw new Error(`Image must be ${maxMb} MB or smaller.`);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasValidSignature(bytes, file.type)) throw new Error("The selected file is not a valid image.");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "misfit-media";
  if (!url || !serviceKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Image storage is not configured. Add the Supabase URL and service-role key.");
    }
    return saveLocally(bytes, file.type, folder);
  }

  const client = createClient(url, serviceKey, { auth: { persistSession: false } });
  const extension = imageExtensions[file.type];
  const path = `${folder}/${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage.from(bucket).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
