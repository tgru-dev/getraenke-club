import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

const Body = z.object({
  label: z.string().trim().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  freetext: z.boolean().default(false),
  sortOrder: z.number().int().optional(),
});

async function ensureAdmin() {
  const session = await getSession();
  if (!session.userId) return { error: "unauthorized" as const, status: 401 };
  if (session.role !== "admin") return { error: "forbidden" as const, status: 403 };
  return { session };
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
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

  // Custom-Key generieren, der nicht mit kat1..kat5 oder bestehenden Keys kollidiert.
  const base = `c-${slugify(parsed.data.label) || "kategorie"}`;
  let key = base;
  let n = 2;
  while (await prisma.category.findUnique({ where: { key } })) {
    key = `${base}-${n}`;
    n += 1;
  }

  const maxSort = await prisma.category.aggregate({ _max: { sortOrder: true } });
  const sortOrder = parsed.data.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1;

  const cat = await prisma.category.create({
    data: {
      key,
      label: parsed.data.label,
      color: parsed.data.color,
      freetext: parsed.data.freetext,
      sortOrder,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.session.userId!,
      action: "create_category",
      targetTable: "Category",
      targetId: cat.id,
      after: JSON.stringify({
        key: cat.key,
        label: cat.label,
        color: cat.color,
        freetext: cat.freetext,
      }),
    },
  });

  return NextResponse.json({ id: cat.id, key: cat.key });
}
