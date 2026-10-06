import { NextResponse } from "next/server";
import { requireProfile, checkRateLimit } from "@/lib/api-auth";

export async function GET(request: Request) {
  const limited = checkRateLimit(request, "session");
  if (limited) return limited;

  const { profile, response } = await requireProfile(request);
  if (response || !profile) {
    return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    session: {
      id: profile.id,
      name: profile.name,
      role: profile.role,
    },
  });
}
