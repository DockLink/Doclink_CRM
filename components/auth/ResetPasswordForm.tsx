"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  CheckIcon,
  EyeIcon,
  LockIcon,
  SmallCheckIcon,
  SmallCrossIcon,
  SpinnerIcon,
  WarningClockIcon,
} from "./icons";
import { inputBase, inputDefault, inputErrorCls, inputFilled } from "./input-styles";
import { getPasswordStrength, STRENGTH_COLORS, STRENGTH_LABELS } from "./password-utils";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const linkExpired = searchParams.get("expired") === "1";

  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [state, setState] = useState<"default" | "loading" | "success">("default");
  const [error, setError] = useState(false);
  const [newFocus, setNewFocus] = useState(false);
  const [confFocus, setConfFocus] = useState(false);

  const strength = getPasswordStrength(newPw);
  const hasLength = newPw.length >= 8;
  const hasNumber = /[0-9]/.test(newPw);
  const passwordsMatch = newPw.length > 0 && newPw === confirmPw;
  const allValid = hasLength && hasNumber && passwordsMatch;

  const isLoading = state === "loading";
  const isSuccess = state === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allValid) return;
    setState("loading");
    const { error: updateError } = await createClient().auth.updateUser({ password: newPw });
    if (updateError) {
      setError(true);
      setState("default");
      return;
    }
    setState("success");
  };

  const inputCls = (focused: boolean, hasVal: boolean, isErr?: boolean) => {
    if (isErr) return `${inputBase} pr-10 ${inputErrorCls}`;
    if (focused || hasVal) return `${inputBase} pr-10 ${inputFilled}`;
    return `${inputBase} pr-10 ${inputDefault}`;
  };

  const confirmMismatch = confirmPw.length > 0 && newPw !== confirmPw;

  if (linkExpired) {
    return (
      <div className="w-full max-w-[380px] flex flex-col items-center gap-6 py-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: "#FEF3C7", color: "#D97706" }}
        >
          <WarningClockIcon />
        </div>
        <div className="flex flex-col gap-2 text-center">
          <h2 style={{ fontSize: 22, fontWeight: 600, color: "#111111" }}>This link has expired</h2>
          <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6, maxWidth: 300 }}>
            Reset links are valid for 30 minutes. Request a new one to continue.
          </p>
        </div>
        <Link
          href="/forgot-password"
          className="w-full h-11 rounded-lg text-white text-sm font-semibold flex items-center justify-center transition-all duration-150"
          style={{ background: "#2FBEB3" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "#0E7A70")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "#2FBEB3")}
        >
          Request a new link
        </Link>
        <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>
          © DocLink Technologies — Internal Use Only
        </p>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="w-full max-w-[380px] flex flex-col items-center gap-6 py-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: "#E3F7F5", color: "#0E7A70" }}
        >
          <CheckIcon />
        </div>
        <div className="flex flex-col gap-2 text-center">
          <h2 style={{ fontSize: 22, fontWeight: 600, color: "#111111" }}>Password updated</h2>
          <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6, maxWidth: 300 }}>
            Your password has been changed successfully. You can now sign in.
          </p>
        </div>
        <Link
          href="/login"
          className="w-full h-11 rounded-lg text-white text-sm font-semibold flex items-center justify-center transition-all duration-150"
          style={{ background: "#2FBEB3" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "#0E7A70")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "#2FBEB3")}
        >
          Sign in
        </Link>
        <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>
          © DocLink Technologies — Internal Use Only
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[380px] flex flex-col gap-7">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: "#E3F7F5", color: "#0E7A70" }}
          >
            <LockIcon />
          </div>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: "#111111", lineHeight: 1.2 }}>
          Set a new password
        </h1>
        <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.5 }}>
          Choose a strong password for your DocLink CRM account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        {error && (
          <p style={{ fontSize: 13, color: "#DC2626" }}>We could not update your password. Please request a new reset link.</p>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rp-new" style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
            New password
          </label>
          <div className="relative">
            <input
              id="rp-new"
              type={showNew ? "text" : "password"}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              onFocus={() => setNewFocus(true)}
              onBlur={() => setNewFocus(false)}
              placeholder="Enter new password"
              className={inputCls(newFocus, newPw.length > 0)}
              autoComplete="new-password"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
              tabIndex={-1}
              aria-label={showNew ? "Hide password" : "Show password"}
            >
              <EyeIcon open={showNew} />
            </button>
          </div>

          {newPw.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((seg) => (
                  <div
                    key={seg}
                    className="h-1 flex-1 rounded-full transition-all duration-300"
                    style={{ background: strength >= seg ? STRENGTH_COLORS[strength] : "#E5E7EB" }}
                  />
                ))}
              </div>
              {strength > 0 && (
                <p style={{ fontSize: 11, color: STRENGTH_COLORS[strength], fontWeight: 500 }}>
                  {STRENGTH_LABELS[strength]}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="rp-confirm" style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
            Confirm password
          </label>
          <div className="relative">
            <input
              id="rp-confirm"
              type={showConfirm ? "text" : "password"}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              onFocus={() => setConfFocus(true)}
              onBlur={() => setConfFocus(false)}
              placeholder="Re-enter new password"
              className={inputCls(confFocus, confirmPw.length > 0, confirmMismatch)}
              autoComplete="new-password"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
              tabIndex={-1}
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              <EyeIcon open={showConfirm} />
            </button>
          </div>
          {confirmMismatch && <p style={{ fontSize: 12, color: "#DC2626" }}>Passwords do not match.</p>}
        </div>

        <div
          className="flex flex-col gap-2 px-3.5 py-3 rounded-lg"
          style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}
        >
          {[
            { label: "At least 8 characters", met: hasLength },
            { label: "Contains a number", met: hasNumber },
            { label: "Passwords match", met: passwordsMatch },
          ].map(({ label, met }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="shrink-0">{met ? <SmallCheckIcon color="#16A34A" /> : <SmallCrossIcon />}</span>
              <span
                style={{
                  fontSize: 13,
                  color: met ? "#16A34A" : "#9CA3AF",
                  fontWeight: met ? 500 : 400,
                  transition: "color 0.15s",
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={!allValid || isLoading}
          className="w-full h-11 rounded-lg text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-150"
          style={{
            background: allValid && !isLoading ? "#2FBEB3" : "#9CA3AF",
            cursor: allValid && !isLoading ? "pointer" : "not-allowed",
          }}
          onMouseEnter={(e) => {
            if (allValid && !isLoading) (e.currentTarget as HTMLButtonElement).style.background = "#0E7A70";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              allValid && !isLoading ? "#2FBEB3" : "#9CA3AF";
          }}
        >
          {isLoading ? (
            <>
              <SpinnerIcon />
              <span>Updating…</span>
            </>
          ) : (
            "Update Password"
          )}
        </button>
      </form>

      <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>
        © DocLink Technologies — Internal Use Only
      </p>
    </div>
  );
}
