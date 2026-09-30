import { prisma } from "@/lib/prisma";
import {
  DISCOVERY_CALL_LABEL,
  MONTHLY_REVENUE_LABEL,
  YES_NO_OPTIONS,
  type StandardFieldKey,
} from "@/lib/lead-custom-fields";

const STANDARD_FIELDS = [
  { key: "monthlyRevenue", label: MONTHLY_REVENUE_LABEL, type: "TEXT", options: undefined },
  { key: "discoveryCall", label: DISCOVERY_CALL_LABEL, type: "DROPDOWN", options: [...YES_NO_OPTIONS] },
] as const;

export type StandardFieldIds = Record<StandardFieldKey, string>;

let pending: Promise<StandardFieldIds> | null = null;

async function loadStandardFieldIds(): Promise<StandardFieldIds> {
  const existing = await prisma.customField.findMany({
    where: { label: { in: STANDARD_FIELDS.map((field) => field.label), mode: "insensitive" } },
    orderBy: { isActive: "desc" },
    select: { id: true, label: true },
  });

  const ids = {} as StandardFieldIds;
  for (const field of STANDARD_FIELDS) {
    const match = existing.find((entry) => entry.label.trim().toLowerCase() === field.label.toLowerCase());
    ids[field.key] = match
      ? match.id
      : (await prisma.customField.create({
          data: { label: field.label, type: field.type, options: field.options },
          select: { id: true },
        })).id;
  }
  return ids;
}

// Field ids never change once created (custom fields can only be renamed or deactivated),
// so the lookup is cached for the lifetime of the server process.
export function ensureStandardCustomFields() {
  pending ??= loadStandardFieldIds().catch((error) => {
    pending = null;
    throw error;
  });
  return pending;
}

export function standardFieldKey(ids: StandardFieldIds, fieldId: string): StandardFieldKey | undefined {
  return (Object.keys(ids) as StandardFieldKey[]).find((key) => ids[key] === fieldId);
}
