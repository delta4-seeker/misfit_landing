import { prisma } from "../src/lib/prisma";
import { mediaAssetId, uploadImage } from "../src/lib/storage";

async function main() {
  const onePixelPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  const image = new File([onePixelPng], "pixel.png", { type: "image/png" });
  const publicUrl = await uploadImage(image, "backend-check", 1);
  const id = mediaAssetId(publicUrl);
  if (!id) throw new Error("The uploaded image did not return a database media URL.");
  const saved = await prisma.mediaAsset.findUnique({ where: { id } });

  if (!saved || !Buffer.from(saved.data).equals(onePixelPng)) throw new Error("The database upload did not match the source image.");

  let spoofedImageRejected = false;
  try {
    await uploadImage(new File([Buffer.from("<script>alert(1)</script>")], "fake.png", { type: "image/png" }), "backend-check", 1);
  } catch {
    spoofedImageRejected = true;
  }
  if (!spoofedImageRejected) throw new Error("A spoofed PNG signature was accepted.");

  let unsafeMimeRejected = false;
  try {
    await uploadImage(new File([onePixelPng], "fake.svg", { type: "image/svg+xml" }), "backend-check", 1);
  } catch {
    unsafeMimeRejected = true;
  }
  if (!unsafeMimeRejected) throw new Error("An unsafe image MIME type was accepted.");

  await prisma.mediaAsset.delete({ where: { id } });
  console.log(JSON.stringify({
    status: "passed",
    storage: "Supabase Postgres media table",
    publicUrlPattern: "/media/<asset-id>",
    spoofedImageRejected,
    unsafeMimeRejected,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
