import { prisma } from "../src/lib/prisma";
import { deleteStoredImage, mediaAssetId, uploadGalleryThumbnail } from "../src/lib/storage";

async function main() {
  const photos = await prisma.galleryPhoto.findMany({
    where: { thumbnailUrl: null },
    select: { id: true, imageUrl: true },
    orderBy: { createdAt: "asc" },
  });
  let created = 0;
  let skipped = 0;

  for (const photo of photos) {
    const assetId = mediaAssetId(photo.imageUrl);
    if (!assetId) { skipped++; continue; }
    const asset = await prisma.mediaAsset.findUnique({ where: { id: assetId }, select: { data: true } });
    if (!asset) { skipped++; continue; }
    const thumbnailUrl = await uploadGalleryThumbnail(Buffer.from(asset.data));
    try {
      const result = await prisma.galleryPhoto.updateMany({
        where: { id: photo.id, thumbnailUrl: null },
        data: { thumbnailUrl },
      });
      if (!result.count) {
        await deleteStoredImage(thumbnailUrl);
        skipped++;
        continue;
      }
    } catch (error) {
      await deleteStoredImage(thumbnailUrl);
      throw error;
    }
    created++;
  }

  console.log(`Gallery thumbnails: ${created} created, ${skipped} skipped.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
