import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

const Body = z.object({
  name: z.string().trim().min(1).max(64),
  pin: z.string().regex(/^\d{4}$/),
  role: z.enum(["member", "admin"]).default("member"),
});

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

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { name: parsed.data.name } });
  if (exists) {
    return NextResponse.json({ error: "name_taken" }, { status: 409 });
  }

  const pinHash = await bcrypt.hash(parsed.data.pin, 10);
  const user = await prisma.user.create({
    data: { name: parsed.data.name, role: parsed.data.role, pinHash },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.session.userId!,
      action: "create_user",
      targetTable: "User",
      targetId: user.id,
      after: JSON.stringify({ name: user.name, role: user.role }),
    },
  });

  return NextResponse.json({ id: user.id });
}
