"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDisplayName } from "@/lib/role-context";

interface ProfileData {
  name: string;
  email: string;
  role: "superadmin" | "admin";
  createdAt: string;
}

function initialsOf(name: string) {
  return name.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function Card({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl p-6" style={{ background: "#FFFFFF", border: "1px solid #E3E7EF", boxShadow: "0 1px 4px rgba(15,27,60,0.06)" }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111111" }}>{title}</h3>
      {sub && <p style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>{sub}</p>}
      <div className="mt-5 flex flex-col gap-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function Input({
  value, onChange, type = "text", disabled, autoComplete, right,
}: { value: string; onChange?: (v: string) => void; type?: string; disabled?: boolean; autoComplete?: string; right?: ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative">
      <input
        type={type} value={value} disabled={disabled} autoComplete={autoComplete}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        className="w-full rounded-lg px-3"
        style={{
          height: 38, paddingRight: right ? 56 : undefined,
          border: `1.5px solid ${focused ? "#2FBEB3" : "#E3E7EF"}`, fontSize: 13,
          color: disabled ? "#6B7280" : "#111111", background: disabled ? "#F9FAFB" : "#FFFFFF", outline: "none",
        }}
      />
      {right && <div className="absolute" style={{ right: 10, top: "50%", transform: "translateY(-50%)" }}>{right}</div>}
    </div>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className="w-full rounded-lg px-3"
      style={{ height: 38, border: `1.5px solid ${focused ? "#2FBEB3" : "#E3E7EF"}`, fontSize: 13, color: "#111111", background: "#FFFFFF", outline: "none" }}
    >
      {children}
    </select>
  );
}

function PrimaryButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="rounded-lg font-semibold"
      style={{ height: 38, paddingInline: 18, fontSize: 13, color: "#FFFFFF", background: disabled ? "#A7E7E2" : "#2FBEB3", cursor: disabled ? "not-allowed" : "pointer" }}
      onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = "#0E7A70"; }}
      onMouseLeave={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = "#2FBEB3"; }}>
      {children}
    </button>
  );
}

function Message({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  return (
    <p role={kind === "error" ? "alert" : "status"} style={{ fontSize: 12, color: kind === "error" ? "#DC2626" : "#16A34A" }}>{children}</p>
  );
}

export function Profile() {
  const { setName: setSessionName, setRole: setSessionRole } = useDisplayName();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadError, setLoadError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"superadmin" | "admin">("admin");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/profile");
        const result = (await response.json()) as { profile?: ProfileData; error?: string };
        if (!response.ok || !result.profile) { setLoadError(result.error ?? "Unable to load profile."); return; }
        setProfile(result.profile);
        setName(result.profile.name);
        setEmail(result.profile.email);
        setRole(result.profile.role);
        setSessionName(result.profile.name);
      } catch {
        setLoadError("Unable to reach the server. Please refresh and try again.");
      }
    };
    void load();
  }, []);

  const saveAccount = async () => {
    if (!profile) return;
    setNameMsg(null);
    if (!name.trim()) { setNameMsg({ kind: "error", text: "Name is required." }); return; }
    const canEditAccess = profile.role === "superadmin";
    if (canEditAccess && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setNameMsg({ kind: "error", text: "Enter a valid email address." });
      return;
    }
    setSavingName(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(canEditAccess ? { name, email, role } : { name }),
      });
      const result = (await response.json()) as { profile?: ProfileData; error?: string };
      if (!response.ok || !result.profile) { setNameMsg({ kind: "error", text: result.error ?? "Unable to update account." }); return; }
      if (result.profile.email !== profile.email) await createClient().auth.refreshSession();
      setProfile(result.profile);
      setName(result.profile.name);
      setEmail(result.profile.email);
      setRole(result.profile.role);
      setSessionName(result.profile.name);
      setSessionRole(result.profile.role);
      setNameMsg({ kind: "success", text: "Account updated." });
    } catch {
      setNameMsg({ kind: "error", text: "Unable to reach the server. Please try again." });
    } finally {
      setSavingName(false);
    }
  };

  const changePassword = async () => {
    setPwMsg(null);
    if (!currentPw || !newPw || !confirmPw) { setPwMsg({ kind: "error", text: "Fill in all password fields." }); return; }
    if (newPw.length < 8) { setPwMsg({ kind: "error", text: "New password must be at least 8 characters." }); return; }
    if (newPw !== confirmPw) { setPwMsg({ kind: "error", text: "New password and confirmation don't match." }); return; }
    if (newPw === currentPw) { setPwMsg({ kind: "error", text: "New password must be different from the current one." }); return; }

    setSavingPw(true);
    try {
      const response = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) { setPwMsg({ kind: "error", text: result.error ?? "Unable to change password." }); return; }
      setCurrentPw(""); setNewPw(""); setConfirmPw(""); setShowPw(false);
      setPwMsg({ kind: "success", text: "Password changed successfully." });
    } catch {
      setPwMsg({ kind: "error", text: "Unable to reach the server. Please try again." });
    } finally {
      setSavingPw(false);
    }
  };

  if (loadError) return <div style={{ padding: 24 }}><Message kind="error">{loadError}</Message></div>;
  if (!profile) return <div style={{ padding: 24, fontSize: 13, color: "#6B7280" }}>Loading profile…</div>;

  const canEditAccess = profile.role === "superadmin";
  const accountUnchanged = name.trim() === profile.name
    && (!canEditAccess || (email.trim().toLowerCase() === profile.email.toLowerCase() && role === profile.role));

  const showToggle = (
    <button type="button" onClick={() => setShowPw((v) => !v)} style={{ fontSize: 11, fontWeight: 600, color: "#0E7A70" }}>
      {showPw ? "Hide" : "Show"}
    </button>
  );

  return (
    <div style={{ padding: 24, maxWidth: 640 }}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="rounded-full flex items-center justify-center text-white shrink-0"
          style={{ width: 56, height: 56, fontSize: 18, fontWeight: 700, background: "#2FBEB3" }}>
          {initialsOf(profile.name)}
        </div>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111111" }}>{profile.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-2.5 py-0.5 rounded-full text-white" style={{ fontSize: 11, fontWeight: 700, background: profile.role === "superadmin" ? "#0E7A70" : "#9CA3AF" }}>
              {profile.role === "superadmin" ? "Superadmin" : "Admin"}
            </span>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>
              Member since {new Date(profile.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <Card title="Account details" sub={canEditAccess ? "You can update your name, email, and role." : "Your email and role are managed by a Superadmin."}>
          <Field label="Full name"><Input value={name} onChange={setName} autoComplete="name" /></Field>
          <Field label="Email">
            {canEditAccess
              ? <Input value={email} onChange={setEmail} type="email" autoComplete="email" />
              : <Input value={profile.email} disabled />}
          </Field>
          <Field label="Role">
            {canEditAccess
              ? (
                <Select value={role} onChange={(value) => setRole(value === "superadmin" ? "superadmin" : "admin")}>
                  <option value="superadmin">Superadmin</option>
                  <option value="admin">Admin</option>
                </Select>
              )
              : <Input value="Admin" disabled />}
          </Field>
          <div className="flex items-center gap-3">
            <PrimaryButton onClick={() => void saveAccount()} disabled={savingName || accountUnchanged}>
              {savingName ? "Saving…" : "Save changes"}
            </PrimaryButton>
            {nameMsg && <Message kind={nameMsg.kind}>{nameMsg.text}</Message>}
          </div>
        </Card>

        <Card title="Change password" sub="Use at least 8 characters. You'll stay signed in on this device.">
          <Field label="Current password">
            <Input type={showPw ? "text" : "password"} value={currentPw} onChange={setCurrentPw} autoComplete="current-password" right={showToggle} />
          </Field>
          <Field label="New password">
            <Input type={showPw ? "text" : "password"} value={newPw} onChange={setNewPw} autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password">
            <Input type={showPw ? "text" : "password"} value={confirmPw} onChange={setConfirmPw} autoComplete="new-password" />
          </Field>
          <div className="flex items-center gap-3">
            <PrimaryButton onClick={() => void changePassword()} disabled={savingPw}>
              {savingPw ? "Updating…" : "Update password"}
            </PrimaryButton>
            {pwMsg && <Message kind={pwMsg.kind}>{pwMsg.text}</Message>}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default Profile;