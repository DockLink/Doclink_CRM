"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertIcon, EyeIcon, SpinnerIcon, XIcon } from "./icons";
import { inputBase, inputDefault, inputErrorCls, inputFilled } from "./input-styles";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showError, setShowError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setShowError(false);
    setTimeout(() => {
      setIsLoading(false);
      if (email.trim() && password) {
        router.push("/dashboard");
      } else {
        setShowError(true);
      }
    }, 1200);
  };

  const emailCls = () => {
    if (showError && email) return `${inputBase} ${inputErrorCls}`;
    if (emailFocused || email) return `${inputBase} ${inputFilled}`;
    return `${inputBase} ${inputDefault}`;
  };
  const pwCls = () => {
    if (showError && password) return `${inputBase} pr-10 ${inputErrorCls}`;
    if (passwordFocused || password) return `${inputBase} pr-10 ${inputFilled}`;
    return `${inputBase} pr-10 ${inputDefault}`;
  };

  return (
    <div className="w-full max-w-[380px] flex flex-col gap-7">
      <div className="flex flex-col gap-1">
        <h1 style={{ fontSize: 28, fontWeight: 600, color: "#111111", lineHeight: 1.2 }}>Welcome back</h1>
        <p style={{ fontSize: 14, color: "#6B7280" }}>Sign in to your DocLink CRM account</p>
      </div>

      {showError && (
        <div
          className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg border text-sm"
          style={{ background: "#FEF2F2", borderColor: "#FCA5A5", color: "#DC2626" }}
          role="alert"
        >
          <span className="mt-0.5 shrink-0">
            <AlertIcon />
          </span>
          <span className="flex-1" style={{ fontWeight: 500 }}>
            Incorrect email or password.
          </span>
          <button
            type="button"
            onClick={() => setShowError(false)}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <XIcon />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="login-email" style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            placeholder="you@doclink.com"
            className={emailCls()}
            autoComplete="email"
            disabled={isLoading}
          />
          {showError && email && (
            <p style={{ fontSize: 12, color: "#DC2626" }}>Please check your email address.</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="login-password" style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
            Password
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              placeholder="Enter your password"
              className={pwCls()}
              autoComplete="current-password"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              style={{ fontSize: 13, color: "#2FBEB3", fontWeight: 500 }}
              className="hover:text-[#0E7A70] transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          {showError && password && (
            <p style={{ fontSize: 12, color: "#DC2626" }}>Please check your password.</p>
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
              <span>Signing in…</span>
            </>
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>
        © DocLink Technologies — Internal Use Only
      </p>
    </div>
  );
}
