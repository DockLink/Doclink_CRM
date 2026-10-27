import type { UserRole } from "@/lib/types";

/** Idle timeout before forced sign-out (role-based). */
export const IDLE_MS: Record<UserRole, number> = {
  admin: 30 * 60_000,
  superadmin: 15 * 60_000,
};

/** Absolute max session lifetime regardless of activity. */
export const MAX_SESSION_MS = 8 * 60 * 60_000;

/** Failed password attempts allowed inside the fail window. */
export const MAX_FAILED_LOGINS = 5;

/** Window used to count failed logins (email + IP). */
export const FAIL_WINDOW_MS = 15 * 60_000;

/** How long the account stays locked after hitting the fail limit. */
export const LOCK_MS = 15 * 60_000;

/** Cookie / storage key for when the current session began (epoch ms). */
export const SESSION_STARTED_COOKIE = "dl_session_started";
export const SESSION_STARTED_STORAGE_KEY = "dl_session_started";

export function normalizeLoginEmail(email: string) {
  return email.trim().toLowerCase();
}

export function clientIpFromRequest(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export function retryAfterSeconds(lockedUntil: Date, now = Date.now()) {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - now) / 1000));
}

export function sessionAgeExceeded(startedAtMs: number, now = Date.now()) {
  return now - startedAtMs >= MAX_SESSION_MS;
}
