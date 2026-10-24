import { readFile, rmdir, unlink } from "node:fs/promises";
import path from "node:path";

import { uploadImage } from "../src/lib/storage";

async function main() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("This check is only for the local folder-storage fallback.");
  }

  const onePixelPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  const image = new File([onePixelPng], "pixel.png", { type: "image/png" });
  const publicUrl = await uploadImage(image, "backend-check", 1);
  const diskPath = path.join(process.cwd(), "public", publicUrl.replace(/^\/+/, ""));
  const saved = await readFile(diskPath);

  if (!saved.equals(onePixelPng)) throw new Error("The local upload did not match the source image.");

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

  await unlink(diskPath);
  await rmdir(path.dirname(diskPath));
  console.log(JSON.stringify({
    status: "passed",
    storage: "local folder fallback",
    publicUrlPattern: "/uploads/backend-check/<uuid>.png",
    spoofedImageRejected,
    unsafeMimeRejected,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
