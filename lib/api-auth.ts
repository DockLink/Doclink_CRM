import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

type RateLimitEntry = { count: number; resetAt: number };

const rateLimits = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;

export async function requireProfile(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const profile = await prisma.user.findFirst({
    where: { id: user.id, isActive: true },
  });
  if (!profile) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { profile };
}

export function checkRateLimit(request: Request, key: string, max = MAX_REQUESTS) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const entry = rateLimits.get(`${key}:${address}`);
  if (!entry || entry.resetAt <= now) {
    rateLimits.set(`${key}:${address}`, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }
  entry.count += 1;
  if (entry.count > max) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
  }
  return null;
}

export function requireRole(profile: { role: string }, role: "superadmin" | "admin") {
  return profile.role === role ? null : NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function leadAccessWhere(profile: { id: string; role: string }) {
  return profile.role === "superadmin" ? {} : { assigneeId: profile.id };
}