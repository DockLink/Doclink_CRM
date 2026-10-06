"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertIcon, ArrowLeftIcon, CheckIcon, MailIcon, SpinnerIcon } from "./icons";
import { inputBase, inputDefault, inputErrorCls, inputFilled } from "./input-styles";
import { createClient } from "@/lib/supabase/client";

const RESEND_SECONDS = 30;

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [state, setState] = useState<"default" | "loading" | "success" | "error">("default");
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state === "success") {
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(timerRef.current!);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state]);

  const sendResetLink = async () => {
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (!error) setCountdown(RESEND_SECONDS);
    setState(error ? "error" : "success");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setState("error");
      return;
    }
    setState("loading");
    await sendResetLink();
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setState("loading");
    await sendResetLink();
  };

  const isLoading = state === "loading";
  const isSuccess = state === "success";
  const isError = state === "error";

  const emailCls = () => {
    if (isError) return `${inputBase} ${inputErrorCls}`;
    if (emailFocused || email) return `${inputBase} ${inputFilled}`;
    return `${inputBase} ${inputDefault}`;
  };

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="w-full max-w-[380px] flex flex-col gap-7">
      <Link
        href="/login"
        className="flex items-center gap-1.5 w-fit transition-colors"
        style={{ fontSize: 13, color: "#2FBEB3", fontWeight: 500 }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#0E7A70")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#2FBEB3")}
      >
        <ArrowLeftIcon />
        Back to login
      </Link>

      {isSuccess ? (
        <div className="flex flex-col items-center gap-5 py-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "#E3F7F5", color: "#0E7A70" }}
          >
            <CheckIcon />
          </div>

          <div className="flex flex-col gap-2 text-center">
            <h2 style={{ fontSize: 22, fontWeight: 600, color: "#111111" }}>Check your email</h2>
            <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6, maxWidth: 320 }}>
              We&apos;ve sent a password reset link to{" "}
              <span style={{ color: "#111111", fontWeight: 500 }}>{email}</span>. It expires in 30 minutes.
            </p>
          </div>

          <div className="flex flex-col items-center gap-2 w-full mt-2">
            <button
              type="button"
              onClick={handleResend}
              disabled={countdown > 0}
              className="w-full h-10 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all duration-150"
              style={{
                background: "white",
                border: `1px solid ${countdown > 0 ? "#E5E7EB" : "#0E7A70"}`,
                color: countdown > 0 ? "#9CA3AF" : "#0E7A70",
                cursor: countdown > 0 ? "not-allowed" : "pointer",
              }}
            >
              <MailIcon />
              {countdown > 0 ? `Resend in 00:${pad(countdown)}` : "Resend link"}
            </button>
            <p style={{ fontSize: 12, color: "#9CA3AF" }}>Check your spam folder if you don&apos;t see it.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <h1 style={{ fontSize: 28, fontWeight: 600, color: "#111111", lineHeight: 1.2 }}>
              Reset your password
            </h1>
            <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.5 }}>
              Enter the email associated with your account and we&apos;ll send a reset link.
            </p>
          </div>

          {isError && (
            <div
              className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg border text-sm"
              style={{ background: "#FEF2F2", borderColor: "#FCA5A5", color: "#DC2626" }}
              role="alert"
            >
              <span className="mt-0.5 shrink-0">
                <AlertIcon />
              </span>
              <span style={{ fontWeight: 500 }}>No account found with this email.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fp-email" style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
                Email address
              </label>
              <input
                id="fp-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (state === "error") setState("default");
                }}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                placeholder="you@doclink.com"
                className={emailCls()}
                autoComplete="email"
                disabled={isLoading}
                required
              />
              {isError && (
                <p style={{ fontSize: 12, color: "#DC2626" }}>We couldn&apos;t find an account with that email.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 rounded-lg text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-150"
              style={{
                background: "#2FBEB3",
                opacity: isLoading ? 0.8 : 1,
                cursor: isLoading ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (!isLoading) (e.currentTarget as HTMLButtonElement).style.background = "#0E7A70";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#2FBEB3";
              }}
            >
              {isLoading ? (
                <>
                  <SpinnerIcon />
                  <span>Sending…</span>
                </>
              ) : (
                "Send Reset Link"
              )}
            </button>
          </form>
        </>
      )}

      <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>
        © DocLink Technologies — Internal Use Only
      </p>
    </div>
  );
}
