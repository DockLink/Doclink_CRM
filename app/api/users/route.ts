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

async function findAuthUserId(admin: ReturnType<typeof createAdminClient>, user: { id: string; email: string }) {
  const { data: byId } = await admin.auth.admin.getUserById(user.id);
  if (byId?.user) return byId.user.id;

  const email = user.email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

export async function PATCH(request: Request) {
  const profile = await getSuperadmin();
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as { id?: string; name?: string; email?: string; role?: "admin" | "superadmin"; password?: string; isActive?: boolean };
  if (!body.id) return NextResponse.json({ error: "User id is required" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id: body.id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const data: { name?: string; email?: string; role?: "admin" | "superadmin"; isActive?: boolean } = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    data.name = name;
  }

  if (body.email !== undefined) {
    const email = body.email.trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
    if (email !== target.email.toLowerCase()) {
      const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" }, NOT: { id: target.id } } });
      if (existing) return NextResponse.json({ error: "A CRM user with this email already exists" }, { status: 409 });
      data.email = email;
    }
  }

  if (body.role !== undefined) {
    const role = body.role === "superadmin" ? "superadmin" : "admin";
    if (target.id === profile.id && role !== "superadmin") {
      return NextResponse.json({ error: "You cannot remove your own superadmin role" }, { status: 400 });
    }
    data.role = role;
  }

  if (body.isActive !== undefined) {
    if (!body.isActive && target.role === "superadmin") {
      return NextResponse.json({ error: "Cannot deactivate a superadmin" }, { status: 400 });
    }
    data.isActive = body.isActive;
  }

  const password = body.password;
  if (password !== undefined && password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  if (password !== undefined || data.email) {
    if (isPublicSupabaseKey(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
      return NextResponse.json({ error: "Server configuration error: SUPABASE_SERVICE_ROLE_KEY must be the Supabase service_role secret, not the anon public key" }, { status: 500 });
    }
    const admin = createAdminClient();
    const authUserId = await findAuthUserId(admin, target);
    if (!authUserId) return NextResponse.json({ error: "No login account found for this user" }, { status: 404 });

    const { error: authError } = await admin.auth.admin.updateUserById(authUserId, {
      ...(password !== undefined ? { password } : {}),
      ...(data.email ? { email: data.email, email_confirm: true } : {}),
    });
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const user = Object.keys(data).length > 0
    ? await prisma.user.update({ where: { id: target.id }, data })
    : target;
  return NextResponse.json({ user: serializeUser(user) });
}