import "server-only";

import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";

const acceptedImages = new Set(["image/jpeg", "image/png", "image/webp"]);
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

export async function uploadImage(file: File, folder: string, maxMb: number) {
  if (!acceptedImages.has(file.type)) throw new Error("Use a JPG, PNG, or WebP image.");
  if (!file.size) throw new Error("Choose an image.");
  if (file.size > maxMb * 1024 * 1024) throw new Error(`Image must be ${maxMb} MB or smaller.`);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasValidSignature(bytes, file.type)) throw new Error("The selected file is not a valid image.");

  const asset = await prisma.mediaAsset.create({
    data: {
      data: bytes,
      contentType: file.type,
      size: bytes.byteLength,
      checksum: createHash("sha256").update(bytes).digest("hex"),
      folder: safeFolder(folder) || "misc",
      originalName: file.name.slice(0, 255) || null,
    },
  });
  return `/media/${asset.id}`;
}

export function mediaAssetId(imageUrl: string | null | undefined) {
  const match = imageUrl?.match(/^\/media\/([a-zA-Z0-9_-]{8,64})$/);
  return match?.[1];
}

export async function deleteStoredImage(imageUrl: string | null | undefined) {
  const id = mediaAssetId(imageUrl);
  if (id) await prisma.mediaAsset.deleteMany({ where: { id } });
}
