import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { UserRole } from "@/lib/types";
import {
  SESSION_STARTED_COOKIE,
  sessionAgeExceeded,
} from "@/lib/session-policy";

const publicPaths = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/api/auth/login",
];

async function getRole(
  supabase: ReturnType<typeof createServerClient>,
  user: { id: string },
): Promise<UserRole | null> {
  const { data: profile, error } = await supabase
    .from("users")
    .select("role,is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!error && profile) {
    if (!profile.is_active) return null;
    return profile.role === "superadmin" || profile.role === "admin" ? profile.role : null;
  }

  return null;
}

function clearSessionCookies(response: NextResponse) {
  response.cookies.set(SESSION_STARTED_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set(`${SESSION_STARTED_COOKIE}_client`, "", { path: "/", maxAge: 0 });
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const isPublicPath = publicPaths.some((path) => request.nextUrl.pathname.startsWith(path));

  if (user) {
    const startedRaw = request.cookies.get(SESSION_STARTED_COOKIE)?.value;
    const startedAt = startedRaw ? Number(startedRaw) : NaN;

    if (!Number.isFinite(startedAt)) {
      // Existing sessions created before this cookie existed: stamp "now"
      // so they get a full 8-hour window from first request after deploy.
      const now = String(Date.now());
      response.cookies.set(SESSION_STARTED_COOKIE, now, {
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 8 * 60 * 60,
      });
      response.cookies.set(`${SESSION_STARTED_COOKIE}_client`, now, {
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        httpOnly: false,
        maxAge: 8 * 60 * 60,
      });
    } else if (sessionAgeExceeded(startedAt)) {
      await supabase.auth.signOut();
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "reason=expired";
      const redirect = NextResponse.redirect(loginUrl);
      clearSessionCookies(redirect);
      return redirect;
    }
  }

  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = user ? await getRole(supabase, user) : null;

  if (user && !role && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("error", "role_not_configured");
    return NextResponse.redirect(loginUrl);
  }

  if (user && request.nextUrl.pathname.startsWith("/settings") && role !== "superadmin") {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
