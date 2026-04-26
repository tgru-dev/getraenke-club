import { prisma } from "@/lib/db";
import { BrandingClient } from "./BrandingClient";

export const dynamic = "force-dynamic";

export default async function BrandingPage() {
  const branding = await prisma.branding.findUnique({ where: { id: "default" } });
  return (
    <BrandingClient
      hasCustomLogo={Boolean(branding?.logoBytes && branding.logoMime)}
      mime={branding?.logoMime ?? null}
      updatedAt={branding?.updatedAt?.toISOString() ?? null}
    />
  );
}
