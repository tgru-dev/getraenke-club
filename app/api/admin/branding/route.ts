import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

const MAX_BYTES = 1024 * 1024; // 1 MB
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

async function ensureAdmin() {
  const session = await getSession();
  if (!session.userId) return { error: "unauthorized" as const, status: 401 };
  if (session.role !== "admin") return { error: "forbidden" as const, status: 403 };
  return { session };
}

export async function POST(req: Request) {
  const auth = await ensureAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ error: "unsupported_mime" }, { status: 415 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  await prisma.branding.upsert({
    where: { id: "default" },
    update: { logoBytes: buf, logoMime: mime },
    create: { id: "default", logoBytes: buf, logoMime: mime },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.session.userId!,
      action: "upload_logo",
      targetTable: "Branding",
      targetId: "default",
      after: JSON.stringify({ mime, size: buf.length }),
    },
  });

  return NextResponse.json({ ok: true, size: buf.length, mime });
}

export async function DELETE() {
  const auth = await ensureAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  await prisma.branding.upsert({
    where: { id: "default" },
    update: { logoBytes: null, logoMime: null },
    create: { id: "default" },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.session.userId!,
      action: "remove_logo",
      targetTable: "Branding",
      targetId: "default",
    },
  });

  return NextResponse.json({ ok: true });
}
