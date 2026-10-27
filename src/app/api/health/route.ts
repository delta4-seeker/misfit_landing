import { connection, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  await connection();
  try {
    await prisma.siteSettings.findFirst({ select: { id: true } });
    return NextResponse.json({ ok: true, service: "misfit-founders-club", database: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Health check could not read SiteSettings", error);
    return NextResponse.json({ ok: false, service: "misfit-founders-club", database: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
