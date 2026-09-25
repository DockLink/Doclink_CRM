import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile, checkRateLimit, requireRole } from "@/lib/api-auth"; // adjust path to match your actual auth helper location
import { CustomFieldType } from "../../../../generated/prisma/client"; // adjust relative depth if this file moves

type ApiFieldType = "text" | "number" | "date" | "dropdown" | "toggle" | "url";

const TYPE_TO_DB: Record<ApiFieldType, CustomFieldType> = {
  text: "TEXT",
  number: "NUMBER",
  date: "DATE",
  dropdown: "DROPDOWN",
  toggle: "TOGGLE",
  url: "URL",
};

const TYPE_FROM_DB: Record<CustomFieldType, ApiFieldType> = {
  TEXT: "text",
  NUMBER: "number",
  DATE: "date",
  DROPDOWN: "dropdown",
  TOGGLE: "toggle",
  URL: "url",
};

function serialize(field: {
  id: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  isActive: boolean;
  options: unknown;
}) {
  return {
    id: field.id,
    label: field.label,
    type: TYPE_FROM_DB[field.type],
    required: field.required,
    active: field.isActive,
    options: Array.isArray(field.options) ? (field.options as string[]) : undefined,
  };
}

export async function GET(request: Request) {
  const limited = checkRateLimit(request, "custom-fields");
  if (limited) return limited;

  const { profile, response } = await requireProfile(request);
  if (response) return response;

  const forbidden = requireRole(profile, "superadmin");
  if (forbidden) return forbidden;

  const fields = await prisma.customField.findMany({ orderBy: { label: "asc" } });
  return NextResponse.json({ fields: fields.map(serialize) });
}

export async function POST(request: Request) {
  const limited = checkRateLimit(request, "custom-fields");
  if (limited) return limited;

  const { profile, response } = await requireProfile(request);
  if (response) return response;

  const forbidden = requireRole(profile, "superadmin");
  if (forbidden) return forbidden;

  const body = (await request.json().catch(() => null)) as {
    label?: string;
    type?: string;
    required?: boolean;
    options?: string[];
  } | null;

  const label = body?.label?.trim();
  const type = body?.type && body.type in TYPE_TO_DB ? TYPE_TO_DB[body.type as ApiFieldType] : undefined;

  if (!label || !type) {
    return NextResponse.json({ error: "Label and a valid type are required." }, { status: 400 });
  }

  const cleanOptions = (body?.options ?? []).map((o) => o.trim()).filter(Boolean);
  if (type === "DROPDOWN" && cleanOptions.length === 0) {
    return NextResponse.json({ error: "Dropdown fields need at least one option." }, { status: 400 });
  }

  const field = await prisma.customField.create({
    data: {
      label,
      type,
      required: body?.required ?? false,
      options: type === "DROPDOWN" ? cleanOptions : undefined,
    },
  });

  return NextResponse.json({ field: serialize(field) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const limited = checkRateLimit(request, "custom-fields");
  if (limited) return limited;

  const { profile, response } = await requireProfile(request);
  if (response) return response;

  const forbidden = requireRole(profile, "superadmin");
  if (forbidden) return forbidden;

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    label?: string;
    type?: string;
    required?: boolean;
    active?: boolean;
    options?: string[];
  } | null;

  if (!body?.id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const data: {
    label?: string;
    type?: CustomFieldType;
    required?: boolean;
    isActive?: boolean;
    options?: string[];
  } = {};

  if (body.label !== undefined) data.label = body.label.trim();
  if (body.type !== undefined && body.type in TYPE_TO_DB) data.type = TYPE_TO_DB[body.type as ApiFieldType];
  if (body.required !== undefined) data.required = body.required;
  if (body.active !== undefined) data.isActive = body.active;
  if (body.options !== undefined) data.options = body.options.map((o) => o.trim()).filter(Boolean);

  const effectiveType = data.type ?? (await prisma.customField.findUnique({ where: { id: body.id }, select: { type: true } }))?.type;
  if (effectiveType === "DROPDOWN" && data.options !== undefined && data.options.length === 0) {
    return NextResponse.json({ error: "Dropdown fields need at least one option." }, { status: 400 });
  }

  const field = await prisma.customField.update({ where: { id: body.id }, data });
  return NextResponse.json({ field: serialize(field) });
}