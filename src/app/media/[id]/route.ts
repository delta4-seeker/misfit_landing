import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function validId(id: string) {
  return /^[a-zA-Z0-9_-]{8,64}$/.test(id);
}

function mediaHeaders(asset: { contentType: string; size: number; checksum: string }) {
  return new Headers({
    "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    "Content-Length": String(asset.size),
    "Content-Type": asset.contentType,
    ETag: `"${asset.checksum}"`,
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!validId(id)) return new Response("Not found", { status: 404 });
  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    select: { data: true, contentType: true, size: true, checksum: true },
  });
  if (!asset) return new Response("Not found", { status: 404 });
  const headers = mediaHeaders(asset);
  if (request.headers.get("if-none-match") === headers.get("etag")) {
    headers.delete("content-length");
    return new Response(null, { status: 304, headers });
  }
  return new Response(new Uint8Array(asset.data), { headers });
}

export async function HEAD(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!validId(id)) return new Response(null, { status: 404 });
  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    select: { contentType: true, size: true, checksum: true },
  });
  return asset ? new Response(null, { headers: mediaHeaders(asset) }) : new Response(null, { status: 404 });
}
