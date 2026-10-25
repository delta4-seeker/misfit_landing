import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import { directDatabaseUrl } from "../src/lib/database-url";

const prisma = new PrismaClient({ datasourceUrl: directDatabaseUrl() });
const publicDirectory = path.resolve(process.cwd(), "public");

function localUploadPath(url: string | null) {
  if (!url?.startsWith("/uploads/")) return null;
  const resolved = path.resolve(publicDirectory, url.slice(1));
  return resolved.startsWith(`${publicDirectory}${path.sep}`) ? resolved : null;
}

function contentType(filename: string, bytes: Buffer) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  throw new Error(`Unsupported image signature: ${filename}`);
}

async function createAsset(url: string, folder: string) {
  const filename = localUploadPath(url);
  if (!filename) throw new Error(`Unsafe local upload path: ${url}`);
  const bytes = await readFile(filename);
  const id = crypto.randomUUID();
  return {
    id,
    url: `/media/${id}`,
    data: {
      id,
      data: bytes,
      contentType: contentType(filename, bytes),
      size: bytes.byteLength,
      checksum: createHash("sha256").update(bytes).digest("hex"),
      folder,
      originalName: path.basename(filename),
    },
  };
}

async function main() {
  const [users, products, events, photos] = await Promise.all([
    prisma.user.findMany({ where: { profilePicture: { startsWith: "/uploads/" } }, select: { id: true, profilePicture: true } }),
    prisma.product.findMany({ where: { logoUrl: { startsWith: "/uploads/" } }, select: { id: true, logoUrl: true } }),
    prisma.event.findMany({ where: { coverImageUrl: { startsWith: "/uploads/" } }, select: { id: true, coverImageUrl: true } }),
    prisma.galleryPhoto.findMany({ where: { imageUrl: { startsWith: "/uploads/" } }, select: { id: true, imageUrl: true } }),
  ]);

  let migrated = 0;
  for (const user of users) {
    const asset = await createAsset(user.profilePicture!, `profiles/${user.id}`);
    await prisma.$transaction([
      prisma.mediaAsset.create({ data: asset.data }),
      prisma.user.update({ where: { id: user.id }, data: { profilePicture: asset.url } }),
    ]);
    migrated += 1;
  }
  for (const product of products) {
    const asset = await createAsset(product.logoUrl!, `products/${product.id}`);
    await prisma.$transaction([
      prisma.mediaAsset.create({ data: asset.data }),
      prisma.product.update({ where: { id: product.id }, data: { logoUrl: asset.url } }),
    ]);
    migrated += 1;
  }
  for (const event of events) {
    const asset = await createAsset(event.coverImageUrl!, "events");
    await prisma.$transaction([
      prisma.mediaAsset.create({ data: asset.data }),
      prisma.event.update({ where: { id: event.id }, data: { coverImageUrl: asset.url } }),
    ]);
    migrated += 1;
  }
  for (const photo of photos) {
    const asset = await createAsset(photo.imageUrl, "gallery");
    await prisma.$transaction([
      prisma.mediaAsset.create({ data: asset.data }),
      prisma.galleryPhoto.update({ where: { id: photo.id }, data: { imageUrl: asset.url } }),
    ]);
    migrated += 1;
  }

  console.log(JSON.stringify({ status: "passed", migrated }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
