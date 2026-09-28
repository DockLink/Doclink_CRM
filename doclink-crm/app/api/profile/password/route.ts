import { NextResponse } from "next/server";
import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, checkRateLimit } from "@/lib/api-auth"; // adjust path to your auth helper

const MIN_LENGTH = 8;
const MAX_LENGTH = 72;

export async function POST(request: Request) {
  // strict limit: this endpoint checks a password, so it must not be brute-forceable
  const limited = checkRateLimit(request, "profile-password", 5);
  if (limited) return limited;

  const { response } = await requireProfile(request);
  if (response) return response;

  const body = (await request.json().catch(() => null)) as { currentPassword?: string; newPassword?: string } | null;
  const currentPassword = body?.currentPassword ?? "";
  const newPassword = body?.newPassword ?? "";

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Current and new password are required." }, { status: 400 });
  }
  if (newPassword.length < MIN_LENGTH || newPassword.length > MAX_LENGTH) {
    return NextResponse.json({ error: `New password must be ${MIN_LENGTH}–${MAX_LENGTH} characters.` }, { status: 400 });
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: "New password must be different from the current one." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1) Verify the current password with a throwaway client so the user's session cookies aren't touched.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.json({ error: "Server is not configured." }, { status: 500 });

  const verifier = createStatelessClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: verifyError } = await verifier.auth.signInWithPassword({ email: user.email, password: currentPassword });
  if (verifyError) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });

  // 2) Update the password on the signed-in user.
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}