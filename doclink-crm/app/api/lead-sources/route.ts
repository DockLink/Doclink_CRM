import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile, checkRateLimit, requireRole } from "@/lib/api-auth"; // adjust path to match your actual auth helper location

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002";
}

export async function GET(request: Request) {
  const limited = checkRateLimit(request, "lead-sources");
  if (limited) return limited;

  const { profile, response } = await requireProfile(request);
  if (response) return response;

  const forbidden = requireRole(profile, "superadmin");
  if (forbidden) return forbidden;

  const sources = await prisma.leadSource.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { leads: true } } },
  });

  return NextResponse.json({
    sources: sources.map((s) => ({ id: s.id, name: s.name, leads: s._count.leads })),
  });
}

export async function POST(request: Request) {
  const limited = checkRateLimit(request, "lead-sources");
  if (limited) return limited;

  const { profile, response } = await requireProfile(request);
  if (response) return response;

  const forbidden = requireRole(profile, "superadmin");
  if (forbidden) return forbidden;

  const body = (await request.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Source name is required." }, { status: 400 });
  }

  try {
    const source = await prisma.leadSource.create({ data: { name } });
    return NextResponse.json({ source: { id: source.id, name: source.name, leads: 0 } }, { status: 201 });
  } catch (err: unknown) {
    if (isUniqueConstraintError(err)) {
      return NextResponse.json({ error: "A source with that name already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to create source." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const limited = checkRateLimit(request, "lead-sources");
  if (limited) return limited;

  const { profile, response } = await requireProfile(request);
  if (response) return response;

  const forbidden = requireRole(profile, "superadmin");
  if (forbidden) return forbidden;

  const body = (await request.json().catch(() => null)) as { id?: string; name?: string } | null;
  if (!body?.id || !body.name?.trim()) {
    return NextResponse.json({ error: "id and name are required." }, { status: 400 });
  }

  try {
    const source = await prisma.leadSource.update({
      where: { id: body.id },
      data: { name: body.name.trim() },
      include: { _count: { select: { leads: true } } },
    });
    return NextResponse.json({ source: { id: source.id, name: source.name, leads: source._count.leads } });
  } catch (err: unknown) {
    if (isUniqueConstraintError(err)) {
      return NextResponse.json({ error: "A source with that name already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to update source." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const limited = checkRateLimit(request, "lead-sources");
  if (limited) return limited;

  const { profile, response } = await requireProfile(request);
  if (response) return response;

  const forbidden = requireRole(profile, "superadmin");
  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const inUse = await prisma.lead.count({ where: { sourceId: id } });
  if (inUse > 0) {
    return NextResponse.json(
      { error: `Cannot remove — in use by ${inUse} lead${inUse === 1 ? "" : "s"}.` },
      { status: 409 }
    );
  }

  await prisma.leadSource.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}