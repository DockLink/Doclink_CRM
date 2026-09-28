import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile, checkRateLimit } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type AppRole = "superadmin" | "admin";

function serializeProfile(user: { name: string; email: string; role: string; createdAt: Date }) {
  return {
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function GET(request: Request) {
  const limited = checkRateLimit(request, "profile");
  if (limited) return limited;

  const { profile, response } = await requireProfile(request);
  if (response || !profile) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ profile: serializeProfile(profile) });
}

// Admins can edit their name. A superadmin can also change their own email and role.
export async function PATCH(request: Request) {
  const limited = checkRateLimit(request, "profile", 20);
  if (limited) return limited;

  const { profile, response } = await requireProfile(request);
  if (response || !profile) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { name?: string; email?: string; role?: string } | null;
  const name = body?.name?.trim();
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (name.length > 100) return NextResponse.json({ error: "Name is too long (max 100 characters)." }, { status: 400 });

  const isSuperadmin = profile.role === "superadmin";
  let email = profile.email;
  let role: AppRole = profile.role === "superadmin" ? "superadmin" : "admin";

  if (!isSuperadmin) {
    const requestedEmail = body?.email?.trim().toLowerCase();
    const requestedRole = body?.role;
    if ((requestedEmail && requestedEmail !== profile.email.toLowerCase()) || (requestedRole && requestedRole !== profile.role)) {
      return NextResponse.json({ error: "Only a superadmin can change email or role." }, { status: 403 });
    }
  } else {
    if (typeof body?.email === "string") {
      email = body.email.trim().toLowerCase();
      if (!isEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (body?.role === "admin" || body?.role === "superadmin") role = body.role;
    else if (body?.role) return NextResponse.json({ error: "Role must be admin or superadmin." }, { status: 400 });
  }

  const emailChanged = email.toLowerCase() !== profile.email.toLowerCase();
  const roleChanged = role !== profile.role;

  if (roleChanged && role !== "superadmin") {
    const otherSuperadmins = await prisma.user.count({
      where: { role: "superadmin", isActive: true, id: { not: profile.id } },
    });
    if (otherSuperadmins === 0) {
      return NextResponse.json({ error: "Add another active superadmin before changing your own role." }, { status: 400 });
    }
  }

  if (emailChanged) {
    const taken = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, id: { not: profile.id } },
    });
    if (taken) return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
  }

  if (emailChanged || roleChanged) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: existing } = await admin.auth.admin.getUserById(user.id);
    const { error: authError } = await admin.auth.admin.updateUserById(user.id, {
      ...(emailChanged ? { email, email_confirm: true } : {}),
      app_metadata: { ...(existing.user?.app_metadata ?? {}), role },
    });
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: profile.id },
      data: { name, email, role },
    });
    return NextResponse.json({ profile: serializeProfile(updated) });
  } catch {
    if (emailChanged || roleChanged) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const admin = createAdminClient();
        const { data: existing } = await admin.auth.admin.getUserById(user.id);
        await admin.auth.admin.updateUserById(user.id, {
          ...(emailChanged ? { email: profile.email, email_confirm: true } : {}),
          app_metadata: { ...(existing.user?.app_metadata ?? {}), role: profile.role },
        });
      }
    }
    return NextResponse.json({ error: "Unable to update profile." }, { status: 500 });
  }
}
