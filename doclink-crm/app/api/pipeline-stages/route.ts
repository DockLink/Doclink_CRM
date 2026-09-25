import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile, requireRole } from "@/lib/api-auth";

export async function GET(request: Request) {
  const { profile, response } = await requireProfile(request);
  if (response) return response;
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stages = await prisma.pipelineStage.findMany({
    orderBy: { position: "asc" },
    include: { _count: { select: { leads: true } } },
  });
  return NextResponse.json({ stages: stages.map((stage: (typeof stages)[number]) => ({
    id: stage.id,
    name: stage.name,
    color: stage.color,
    leads: stage._count.leads,
    active: stage.isActive,
    isDefault: stage.isDefault,
    position: stage.position,
  })) });
}

export async function POST(request: Request) {
  const { profile, response } = await requireProfile(request);
  if (response) return response;
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireRole(profile, "superadmin");
  if (forbidden) return forbidden;

  const body = await request.json() as { name?: string; color?: string };
  const name = body.name?.trim() ?? "";
  const color = body.color?.trim() ?? "#2FBEB3";
  if (!name) return NextResponse.json({ error: "Stage name is required" }, { status: 400 });

  const duplicate = await prisma.pipelineStage.findFirst({ where: { name } });
  if (duplicate) return NextResponse.json({ error: "A stage with this name already exists" }, { status: 409 });
  const last = await prisma.pipelineStage.findFirst({ orderBy: { position: "desc" }, select: { position: true } });
  const stage = await prisma.pipelineStage.create({ data: { name, color, position: (last?.position ?? -1) + 1 } });
  return NextResponse.json({ id: stage.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { profile, response } = await requireProfile(request);
  if (response) return response;
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireRole(profile, "superadmin");
  if (forbidden) return forbidden;

  const body = await request.json() as {
    id?: string;
    isActive?: boolean;
    name?: string;
    color?: string;
    order?: string[];
  };
  if (Array.isArray(body.order)) {
    await prisma.$transaction(body.order.map((id, position) => prisma.pipelineStage.update({ where: { id }, data: { position } })));
    return NextResponse.json({ updated: body.order.length });
  }
  if (!body.id) return NextResponse.json({ error: "Stage id is required" }, { status: 400 });

  const stage = await prisma.pipelineStage.findUnique({ where: { id: body.id }, include: { _count: { select: { leads: true } } } });
  if (!stage) return NextResponse.json({ error: "Stage not found" }, { status: 404 });
  if (body.isActive === false && stage._count.leads > 0) {
    return NextResponse.json({ error: "Cannot deactivate a stage that contains leads" }, { status: 409 });
  }
  const nextName = body.name?.trim();
  if (nextName && nextName !== stage.name) {
    const duplicate = await prisma.pipelineStage.findFirst({ where: { name: nextName, NOT: { id: stage.id } } });
    if (duplicate) return NextResponse.json({ error: "A stage with this name already exists" }, { status: 409 });
  }
  const data: { isActive?: boolean; name?: string; color?: string } = {};
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (nextName) data.name = nextName;
  if (body.color?.trim()) data.color = body.color.trim();
  await prisma.pipelineStage.update({ where: { id: body.id }, data });
  return NextResponse.json({ updated: 1 });
}