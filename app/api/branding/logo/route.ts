import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const branding = await prisma.branding.findUnique({ where: { id: "default" } });

  if (!branding?.logoBytes || !branding.logoMime) {
    // Fallback: Default-Icon im public-Ordner
    return NextResponse.redirect(new URL("/icon-192.png", req.url), 302);
  }

  return new NextResponse(new Uint8Array(branding.logoBytes), {
    headers: {
      "Content-Type": branding.logoMime,
      "Cache-Control": "no-cache",
      "Last-Modified": branding.updatedAt.toUTCString(),
    },
  });
}
