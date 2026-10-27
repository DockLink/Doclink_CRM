import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  FAIL_WINDOW_MS,
  LOCK_MS,
  MAX_FAILED_LOGINS,
  MAX_SESSION_MS,
  SESSION_STARTED_COOKIE,
  clientIpFromRequest,
  normalizeLoginEmail,
  retryAfterSeconds,
} from "@/lib/session-policy";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

function lockedResponse(lockedUntil: Date) {
  const seconds = retryAfterSeconds(lockedUntil);
  return NextResponse.json(
    { error: "Too many failed attempts. Try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(seconds) },
    },
  );
}

async function recordFailure(
  email: string,
  ip: string,
  attempt: { failCount: number; windowStartedAt: Date } | null,
) {
  const now = new Date();
  const nextCount = (attempt?.failCount ?? 0) + 1;
  const shouldLock = nextCount >= MAX_FAILED_LOGINS;
  const lockedUntil = shouldLock ? new Date(now.getTime() + LOCK_MS) : null;

  await prisma.loginAttempt.upsert({
    where: { email_ip: { email, ip } },
    create: {
      email,
      ip,
      failCount: nextCount,
      windowStartedAt: attempt?.windowStartedAt ?? now,
      lockedUntil,
    },
    update: {
      failCount: nextCount,
      lockedUntil,
    },
  });

  return { shouldLock, lockedUntil };
}

export async function POST(request: Request) {
  const limited = checkRateLimit(request, "auth-login", 30);
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null;
  const email = normalizeLoginEmail(body?.email ?? "");
  const password = body?.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const ip = clientIpFromRequest(request);
  const now = new Date();

  let attempt = await prisma.loginAttempt.findUnique({
    where: { email_ip: { email, ip } },
  });

  if (attempt?.lockedUntil && attempt.lockedUntil > now) {
    return lockedResponse(attempt.lockedUntil);
  }

  if (attempt?.lockedUntil && attempt.lockedUntil <= now) {
    attempt = await prisma.loginAttempt.update({
      where: { email_ip: { email, ip } },
      data: { failCount: 0, lockedUntil: null, windowStartedAt: now },
    });
  }

  if (attempt && now.getTime() - attempt.windowStartedAt.getTime() >= FAIL_WINDOW_MS) {
    attempt = await prisma.loginAttempt.update({
      where: { email_ip: { email, ip } },
      data: { failCount: 0, windowStartedAt: now, lockedUntil: null },
    });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  const pendingCookies: CookieToSet[] = [];
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll(cookiesToSet) {
        pendingCookies.splice(0, pendingCookies.length, ...cookiesToSet);
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    const { shouldLock, lockedUntil } = await recordFailure(email, ip, attempt);
    if (shouldLock && lockedUntil) return lockedResponse(lockedUntil);
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  const profile = await prisma.user.findFirst({
    where: { id: data.user.id, isActive: true },
    select: { id: true },
  });
  if (!profile) {
    await supabase.auth.signOut();
    const { shouldLock, lockedUntil } = await recordFailure(email, ip, attempt);
    if (shouldLock && lockedUntil) return lockedResponse(lockedUntil);
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  await prisma.loginAttempt.deleteMany({ where: { email, ip } });

  const response = NextResponse.json({ ok: true });
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options);
  }

  const startedAt = String(Date.now());
  const cookieBase = {
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.floor(MAX_SESSION_MS / 1000),
  };
  response.cookies.set(SESSION_STARTED_COOKIE, startedAt, { ...cookieBase, httpOnly: true });
  response.cookies.set(`${SESSION_STARTED_COOKIE}_client`, startedAt, {
    ...cookieBase,
    httpOnly: false,
  });

  return response;
}
