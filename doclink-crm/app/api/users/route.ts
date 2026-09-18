import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const USER_COLORS = ["#2FBEB3", "#6366F1", "#F97316", "#16A34A", "#F59E0B", "#EC4899"];

function isPublicSupabaseKey(key: string | undefined) {
  if (!key) return true;
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8")) as { role?: string };
    return payload.role === "anon";
  } catch {
    return false;
  }
}

async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.user.findFirst({
    where: {
      OR: [
        { id: user.id },
        { email: { equals: user.email ?? "", mode: "insensitive" } },
      ],
      isActive: true,
    },
  });
}

async function getSuperadmin() {
  const profile = await getProfile();
  return profile?.role === "superadmin" ? profile : null;
}

function serializeUser(user: { id: string; name: string; email: string; role: "superadmin" | "admin"; isActive: boolean; createdAt: Date }) {
  const initials = user.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const color = USER_COLORS[user.name.length % USER_COLORS.length];
  return { id: user.id, name: user.name, email: user.email, role: user.role, status: user.isActive ? "active" : "inactive", initials, color, createdAt: user.createdAt.toISOString() };
}

export async function GET() {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ users: users.map(serializeUser) });
}

export async function POST(request: Request) {
  const profile = await getSuperadmin();
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as { name?: string; email?: string; password?: string; role?: "admin" | "superadmin" };
  const name = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const role = body.role === "superadmin" ? "superadmin" : "admin";
  if (!name || !email || !password) return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

  const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (existing) return NextResponse.json({ error: "A CRM user with this email already exists" }, { status: 409 });

  if (isPublicSupabaseKey(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    return NextResponse.json({ error: "Server configuration error: SUPABASE_SERVICE_ROLE_KEY must be the Supabase service_role secret, not the anon public key" }, { status: 500 });
  }

  const admin = createAdminClient();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (authError || !authData.user) return NextResponse.json({ error: authError?.message ?? "Unable to create login account" }, { status: 400 });

  try {
    const user = await prisma.user.create({ data: { id: authData.user.id, name, email, passwordHash: "managed-by-supabase", role } });
    return NextResponse.json({ user: serializeUser(user) }, { status: 201 });
  } catch {
    await admin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: "Unable to create CRM profile" }, { status: 500 });
  }
}