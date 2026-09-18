"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import type { UserRole } from "@/lib/types";

// ─── Sub-nav sections ─────────────────────────────────────────────────────────

type SettingsSection = "users" | "stages" | "sources" | "custom-fields" | "export";

const SUB_NAV: { key: SettingsSection; label: string; icon: ReactNode }[] = [
  { key: "users",         label: "Users",           icon: <UsersIcon /> },
  { key: "stages",        label: "Pipeline Stages", icon: <StagesIcon /> },
  { key: "sources",       label: "Lead Sources",    icon: <SourcesIcon /> },
  { key: "custom-fields", label: "Custom Fields",   icon: <FieldsIcon /> },
  { key: "export",        label: "Data Export",     icon: <ExportIcon /> },
];

// ─── Icons ────────────────────────────────────────────────────────────────────

function UsersIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function StagesIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
}
function SourcesIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
}
function FieldsIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function ExportIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
}
function PencilIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function KeyIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>;
}
function TrashIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
}
function DragIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="9" y1="5" x2="9" y2="19"/><line x1="15" y1="5" x2="15" y2="19"/></svg>;
}
function KebabIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/></svg>;
}
function XIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
function CopyIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
}
function CheckIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>;
}
function DownloadIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
}
function ChevronDownIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>;
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function PrimaryBtn({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 rounded-lg font-semibold" style={{ height: 36, paddingInline: 16, fontSize: 13, background: "#2FBEB3", color: "#FFFFFF" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#0E7A70"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#2FBEB3"; }}>
      {children}
    </button>
  );
}

function SecondaryBtn({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 rounded-lg font-semibold" style={{ height: 36, paddingInline: 16, fontSize: 13, background: "#FFFFFF", color: "#0E7A70", border: "1.5px solid #0E7A70" }}>
      {children}
    </button>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="rounded-full flex items-center shrink-0" style={{ width: 40, height: 22, background: on ? "#2FBEB3" : "#D1D5DB", padding: "0 2px", transition: "background 150ms" }}>
      <span className="rounded-full" style={{ width: 18, height: 18, background: "#FFFFFF", transform: on ? "translateX(18px)" : "translateX(0)", transition: "transform 150ms", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </button>
  );
}

function TextInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      className="w-full rounded-lg px-3"
      style={{ height: 36, border: `1.5px solid ${focused ? "#2FBEB3" : "#E3E7EF"}`, fontSize: 13, color: "#111111", outline: "none", background: "#FFFFFF" }} />
  );
}

function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111111" }}>{title}</h2>
        {sub && <p style={{ fontSize: 13, color: "#6B7280", marginTop: 3 }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

function TableCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid #E3E7EF", boxShadow: "0 1px 4px rgba(15,27,60,0.06)" }}>
      {children}
    </div>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,27,60,0.45)" }} onClick={onClose}>
      <div className="flex flex-col" style={{ width: 480, maxHeight: "90vh", background: "#FFFFFF", borderRadius: 12, boxShadow: "0 8px 48px rgba(15,27,60,0.18)", border: "1px solid #E3E7EF" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid #E3E7EF" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111111" }}>{title}</h3>
          <button onClick={onClose} className="flex items-center justify-center rounded-lg" style={{ width: 28, height: 28, background: "#F3F4F6", color: "#6B7280" }}><XIcon /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">{children}</div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 shrink-0" style={{ borderTop: "1px solid #E3E7EF" }}>{footer}</div>
      </div>
    </div>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
        {label}{required && <span style={{ color: "#DC2626", marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Frame 1: Users ───────────────────────────────────────────────────────────

interface User {
  id: string;
  name: string;
  email: string;
  role: "superadmin" | "admin";
  status: "active" | "inactive";
  initials: string;
  color: string;
}

function AddUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (user: User) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("admin");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const generate = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
    setPassword(Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""));
  };

  const copy = () => { navigator.clipboard.writeText(password).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const createUser = async () => {
    setError("");
    if (!name.trim() || !email.trim() || !password) {
      setError("Name, email, and password are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const result = await response.json() as { user?: User; error?: string };
      if (!response.ok || !result.user) {
        setError(result.error ?? "Unable to create user.");
        return;
      }
      onCreated(result.user);
      onClose();
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Add New User" onClose={onClose} footer={
      <>
        <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
        <PrimaryBtn onClick={() => void createUser()}>{saving ? "Creating..." : "Create User"}</PrimaryBtn>
      </>
    }>
      <FormField label="Full Name" required><TextInput value={name} onChange={setName} placeholder="e.g. Sarah Blake" /></FormField>
      <FormField label="Email Address" required><TextInput value={email} onChange={setEmail} placeholder="sarah@company.io" type="email" /></FormField>
      <FormField label="Temporary Password" required>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input value={password} readOnly placeholder="Generate or type a password"
              className="w-full rounded-lg px-3 font-mono"
              style={{ height: 36, border: "1.5px solid #E3E7EF", fontSize: 12, color: "#111111", background: "#F9FAFB", outline: "none" }} />
          </div>
          <button onClick={generate} className="rounded-lg font-semibold shrink-0" style={{ height: 36, paddingInline: 12, fontSize: 12, background: "#E3F7F5", color: "#0E7A70", border: "1px solid #A7F3D0" }}>Generate</button>
          {password && (
            <button onClick={copy} className="flex items-center justify-center rounded-lg shrink-0" style={{ width: 36, height: 36, background: copied ? "#E3F7F5" : "#F3F4F6", color: copied ? "#2FBEB3" : "#6B7280" }}>
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          )}
        </div>
      </FormField>
      <FormField label="Role">
        <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full rounded-lg px-3 appearance-none" style={{ height: 36, border: "1.5px solid #E3E7EF", fontSize: 13, color: "#111111", background: "#FFFFFF", outline: "none" }}>
          <option value="admin">Admin</option>
          <option value="superadmin">Superadmin</option>
        </select>
      </FormField>
      {error && <p role="alert" style={{ fontSize: 12, color: "#DC2626" }}>{error}</p>}
    </Modal>
  );
}

function UsersFrame() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await fetch("/api/users");
        const result = await response.json() as { users?: User[]; error?: string };
        if (!response.ok) {
          setError(result.error ?? "Unable to load users.");
          return;
        }
        setUsers(result.users ?? []);
      } catch {
        setError("Unable to reach the server. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    };
    void loadUsers();
  }, []);

  const toggleStatus = (id: string) => setUsers((prev) => prev.map((u) => u.id === id ? { ...u, status: u.status === "active" ? "inactive" : "active" } : u));

  return (
    <div>
      <SectionHeader title="User Management" action={<PrimaryBtn onClick={() => setShowAdd(true)}>+ Add User</PrimaryBtn>} />
      <TableCard>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E3E7EF" }}>
              {["User", "Email", "Role", "Status", "Actions"].map((h, i) => (
                <th key={h} className={i === 4 ? "text-right" : "text-left"} style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#6B7280", fontSize: 13 }}>Loading users...</td></tr>}
            {!loading && error && <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#DC2626", fontSize: 13 }}>{error}</td></tr>}
            {!loading && !error && users.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#6B7280", fontSize: 13 }}>No users found.</td></tr>}
            {!loading && !error && users.map((u, i) => {
              const inactive = u.status === "inactive";
              return (
                <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? "1px solid #F3F4F6" : "none", opacity: inactive ? 0.55 : 1 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#E3F7F5"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
                  {/* User */}
                  <td style={{ padding: "12px 16px" }}>
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ background: inactive ? "#D1D5DB" : u.color, fontSize: 11 }}>{u.initials}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#111111" }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#6B7280" }}>{u.email}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: u.role === "superadmin" ? "#0E7A70" : "#F1F5F9", color: u.role === "superadmin" ? "#FFFFFF" : "#64748B" }}>
                      {u.role === "superadmin" ? "Superadmin" : "Admin"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: u.status === "active" ? "#16A34A" : "#9CA3AF" }} />
                      <span style={{ fontSize: 13, color: u.status === "active" ? "#16A34A" : "#9CA3AF", fontWeight: 500 }}>{u.status === "active" ? "Active" : "Inactive"}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div className="flex items-center justify-end gap-1">
                      <IconBtn title="Edit"><PencilIcon /></IconBtn>
                      <IconBtn title="Reset password"><KeyIcon /></IconBtn>
                      <span title={u.role === "superadmin" ? "Cannot deactivate superadmin" : ""}>
                        <Toggle on={u.status === "active"} onChange={() => u.role !== "superadmin" && toggleStatus(u.id)} />
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableCard>
      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onCreated={(user) => setUsers((prev) => [...prev, user])} />}
    </div>
  );
}

function IconBtn({ children, title, danger }: { children: ReactNode; title?: string; danger?: boolean }) {
  return (
    <button title={title} className="flex items-center justify-center rounded-lg" style={{ width: 30, height: 30, color: danger ? "#DC2626" : "#6B7280", background: "transparent" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = danger ? "#FEE2E2" : "#F3F4F6"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
      {children}
    </button>
  );
}

// ─── Frame 2: Pipeline Stages ─────────────────────────────────────────────────

interface Stage { id: string; name: string; color: string; leads: number; active: boolean; }

const INITIAL_STAGES: Stage[] = [
  { id: "s1", name: "New Lead",       color: "#94A3B8", leads: 24, active: true },
  { id: "s2", name: "No Answer",      color: "#FB923C", leads: 18, active: true },
  { id: "s3", name: "Try Again",      color: "#F97316", leads: 11, active: true },
  { id: "s4", name: "Conversation",   color: "#38BDF8", leads: 42, active: true },
  { id: "s5", name: "Proposal Sent",  color: "#6366F1", leads: 27, active: true },
  { id: "s6", name: "Meeting Booked", color: "#F59E0B", leads: 15, active: true },
  { id: "s7", name: "Estimate Sent",  color: "#0891B2", leads: 8,  active: true },
  { id: "s8", name: "Closed Won",     color: "#16A34A", leads: 63, active: true },
  { id: "s9", name: "Closed Lost",    color: "#57534E", leads: 35, active: true },
  { id: "s10",name: "Dead Lead",      color: "#DC2626", leads: 21, active: true },
];

const PRESET_COLORS = ["#94A3B8","#FB923C","#F97316","#38BDF8","#6366F1","#F59E0B","#0891B2","#16A34A","#57534E","#DC2626","#EC4899","#8B5CF6","#06B6D4","#84CC16"];

function StagesFrame() {
  const [stages, setStages] = useState(INITIAL_STAGES);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#2FBEB3");
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const toggleActive = (id: string) => setStages((p) => p.map((s) => s.id === id ? { ...s, active: !s.active } : s));

  const handleDragStart = (id: string) => setDragging(id);
  const handleDragOver = (id: string) => { if (id !== dragging) setDragOver(id); };
  const handleDrop = (targetId: string) => {
    if (!dragging || dragging === targetId) { setDragging(null); setDragOver(null); return; }
    setStages((prev) => {
      const arr = [...prev];
      const fromIdx = arr.findIndex((s) => s.id === dragging);
      const toIdx = arr.findIndex((s) => s.id === targetId);
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr;
    });
    setDragging(null); setDragOver(null);
  };

  return (
    <div>
      <SectionHeader title="Pipeline Stages" sub='Drag to reorder. Changes apply immediately across all views.' action={<PrimaryBtn onClick={() => setShowAdd(true)}>+ Add Stage</PrimaryBtn>} />

      <TableCard>
        {stages.map((s, i) => {
          const isDragging = dragging === s.id;
          const isDragOver = dragOver === s.id;
          return (
            <div key={s.id}>
              {isDragOver && dragging && (
                <div style={{ height: 3, background: "#2FBEB3", margin: "0 16px", borderRadius: 2 }} />
              )}
              <div
                draggable
                onDragStart={() => handleDragStart(s.id)}
                onDragOver={(e) => { e.preventDefault(); handleDragOver(s.id); }}
                onDrop={() => handleDrop(s.id)}
                onDragEnd={() => { setDragging(null); setDragOver(null); }}
                className="flex items-center gap-3 px-4"
                style={{
                  height: 52,
                  borderBottom: i < stages.length - 1 ? "1px solid #F3F4F6" : "none",
                  background: isDragging ? "#F9FAFB" : "#FFFFFF",
                  boxShadow: isDragging ? "0 4px 16px rgba(15,27,60,0.12)" : "none",
                  opacity: isDragging ? 0.7 : 1,
                  cursor: "grab",
                  transform: isDragging ? "rotate(1deg)" : "none",
                  transition: "box-shadow 120ms, opacity 120ms",
                }}
              >
                <span style={{ color: "#D1D5DB" }}><DragIcon /></span>
                <div className="w-4 h-4 rounded-full shrink-0" style={{ background: s.color }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#111111" }}>{s.name}</span>
                <span className="px-2 py-0.5 rounded-full" style={{ fontSize: 11, color: "#6B7280", background: "#F1F5F9" }}>{s.leads} leads</span>
                <span className="px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", background: "#F1F5F9", textTransform: "uppercase", letterSpacing: "0.05em" }}>Default</span>
                <Toggle on={s.active} onChange={() => s.leads === 0 ? toggleActive(s.id) : undefined} />
                <StageKebab stage={s} />
              </div>
            </div>
          );
        })}
      </TableCard>

      {/* Add Stage popover */}
      {showAdd && (
        <div className="fixed inset-0 z-40 flex items-center justify-center" style={{ background: "rgba(15,27,60,0.3)" }} onClick={() => setShowAdd(false)}>
          <div className="rounded-xl flex flex-col gap-4 p-5" style={{ width: 340, background: "#FFFFFF", border: "1px solid #E3E7EF", boxShadow: "0 8px 32px rgba(15,27,60,0.14)" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111111" }}>Add Stage</h3>
            <TextInput value={newName} onChange={setNewName} placeholder="Stage name…" />
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 8 }}>Color</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button key={c} onClick={() => setNewColor(c)} className="w-6 h-6 rounded-full" style={{ background: c, border: newColor === c ? "2.5px solid #111111" : "2px solid transparent", boxSizing: "border-box" }} />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <SecondaryBtn onClick={() => setShowAdd(false)}>Cancel</SecondaryBtn>
              <PrimaryBtn onClick={() => { if (newName.trim()) { setStages((p) => [...p, { id: `s-${Date.now()}`, name: newName.trim(), color: newColor, leads: 0, active: true }]); setNewName(""); setShowAdd(false); } }}>Add</PrimaryBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StageKebab({ stage }: { stage: Stage }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center justify-center rounded-lg" style={{ width: 28, height: 28, color: "#9CA3AF", background: "transparent" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F3F4F6"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
        <KebabIcon />
      </button>
      {open && (
        <div className="absolute right-0 z-30 rounded-lg overflow-hidden" style={{ top: "calc(100% + 4px)", minWidth: 160, background: "#FFFFFF", border: "1px solid #E3E7EF", boxShadow: "0 4px 16px rgba(15,27,60,0.12)" }}>
          {["Rename", "Change Color", "Deactivate"].map((item) => (
            <button key={item} onClick={() => setOpen(false)} className="w-full text-left px-4 py-2.5"
              style={{ fontSize: 13, color: item === "Deactivate" && stage.leads > 0 ? "#9CA3AF" : "#374151", cursor: item === "Deactivate" && stage.leads > 0 ? "not-allowed" : "pointer" }}
              disabled={item === "Deactivate" && stage.leads > 0}
              title={item === "Deactivate" && stage.leads > 0 ? `Cannot deactivate — leads exist in this stage` : ""}
              onMouseEnter={(e) => { if (!(item === "Deactivate" && stage.leads > 0)) (e.currentTarget as HTMLButtonElement).style.background = "#F9FAFB"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Frame 3: Lead Sources ────────────────────────────────────────────────────

interface Source { id: string; name: string; leads: number; }

const INITIAL_SOURCES: Source[] = [
  { id: "src1", name: "Referral",       leads: 38 },
  { id: "src2", name: "Website",        leads: 52 },
  { id: "src3", name: "Cold Call",      leads: 27 },
  { id: "src4", name: "LinkedIn",       leads: 44 },
  { id: "src5", name: "Trade Show",     leads: 15 },
  { id: "src6", name: "Email Campaign", leads: 21 },
  { id: "src7", name: "Partner",        leads: 9  },
  { id: "src8", name: "Event",          leads: 0  },
];

function SourcesFrame() {
  const [sources, setSources] = useState(INITIAL_SOURCES);
  const [newName, setNewName] = useState("");

  const addSource = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setSources((p) => [{ id: `src-${Date.now()}`, name: trimmed, leads: 0 }, ...p]);
    setNewName("");
  };

  const removeSource = (id: string) => setSources((p) => p.filter((s) => s.id !== id));

  return (
    <div>
      <SectionHeader title="Lead Sources" action={<PrimaryBtn onClick={() => {}}>+ Add Source</PrimaryBtn>} />
      <TableCard>
        {/* Inline add row */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid #E3E7EF", background: "#F9FAFB" }}>
          <div style={{ flex: 1 }}>
            <TextInput value={newName} onChange={setNewName} placeholder="New source name…" />
          </div>
          <button onClick={addSource} className="flex items-center justify-center rounded-lg" style={{ width: 36, height: 36, background: "#2FBEB3", color: "#FFFFFF" }}>
            <CheckIcon />
          </button>
        </div>
        {sources.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3 px-4" style={{ height: 48, borderBottom: i < sources.length - 1 ? "1px solid #F3F4F6" : "none" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#E3F7F5"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#111111" }}>{s.name}</span>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>{s.leads > 0 ? `${s.leads} leads` : "No leads yet"}</span>
            <IconBtn title="Edit"><PencilIcon /></IconBtn>
            <span title={s.leads > 0 ? `Cannot remove — in use by ${s.leads} leads` : ""}>
              <IconBtn danger={s.leads === 0} title={s.leads > 0 ? `In use by ${s.leads} leads` : "Remove"}>
                <span style={{ opacity: s.leads > 0 ? 0.35 : 1 }}><TrashIcon /></span>
              </IconBtn>
            </span>
          </div>
        ))}
      </TableCard>
    </div>
  );
}

// ─── Frame 4: Custom Fields ───────────────────────────────────────────────────

type FieldType = "text" | "number" | "date" | "dropdown" | "toggle" | "url";

interface CustomField { id: string; label: string; type: FieldType; required: boolean; active: boolean; }

const FIELD_TYPE_META: Record<FieldType, { label: string; color: string; bg: string }> = {
  text:     { label: "Text",     color: "#374151", bg: "#F3F4F6" },
  number:   { label: "Number",   color: "#0E7A70", bg: "#E3F7F5" },
  date:     { label: "Date",     color: "#6366F1", bg: "#EDE9FE" },
  dropdown: { label: "Dropdown", color: "#D97706", bg: "#FEF3C7" },
  toggle:   { label: "Toggle",   color: "#16A34A", bg: "#DCFCE7" },
  url:      { label: "URL",      color: "#2563EB", bg: "#DBEAFE" },
};

const INITIAL_FIELDS: CustomField[] = [
  { id: "cf1", label: "Company Size",    type: "dropdown", required: false, active: true },
  { id: "cf2", label: "Annual Revenue",  type: "number",   required: false, active: true },
  { id: "cf3", label: "Decision Date",   type: "date",     required: false, active: true },
  { id: "cf4", label: "NDA Signed",      type: "toggle",   required: false, active: true },
  { id: "cf5", label: "Case Study Sent", type: "toggle",   required: false, active: true },
  { id: "cf6", label: "LinkedIn Profile",type: "url",      required: false, active: true },
  { id: "cf7", label: "Notes (Custom)",  type: "text",     required: false, active: false },
];

function AddCustomFieldModal({ onClose }: { onClose: () => void }) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState<string[]>(["Option 1"]);

  return (
    <Modal title="Add Custom Field" onClose={onClose} footer={
      <>
        <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
        <PrimaryBtn onClick={onClose}>Save Field</PrimaryBtn>
      </>
    }>
      <FormField label="Field Label" required><TextInput value={label} onChange={setLabel} placeholder="e.g. Decision Date" /></FormField>
      <FormField label="Field Type">
        <div className="relative">
          <select value={type} onChange={(e) => setType(e.target.value as FieldType)} className="w-full appearance-none rounded-lg px-3 pr-8" style={{ height: 36, border: "1.5px solid #E3E7EF", fontSize: 13, color: "#111111", background: "#FFFFFF", outline: "none" }}>
            {(Object.keys(FIELD_TYPE_META) as FieldType[]).map((t) => <option key={t} value={t}>{FIELD_TYPE_META[t].label}</option>)}
          </select>
          <span className="absolute pointer-events-none" style={{ right: 8, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }}><ChevronDownIcon /></span>
        </div>
      </FormField>

      {type === "dropdown" && (
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>Options</label>
          <div className="flex flex-col gap-2">
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <TextInput value={opt} onChange={(v) => setOptions((p) => p.map((o, j) => j === i ? v : o))} placeholder={`Option ${i + 1}`} />
                {options.length > 1 && (
                  <button onClick={() => setOptions((p) => p.filter((_, j) => j !== i))} className="flex items-center justify-center rounded-lg shrink-0" style={{ width: 36, height: 36, color: "#9CA3AF", background: "#F3F4F6" }}><XIcon /></button>
                )}
              </div>
            ))}
            <button onClick={() => setOptions((p) => [...p, ""])} style={{ fontSize: 12, fontWeight: 600, color: "#2FBEB3", background: "none", border: "none", textAlign: "left", cursor: "pointer", padding: "4px 0" }}>+ Add option</button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <label style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>Required field</label>
        <Toggle on={required} onChange={() => setRequired((v) => !v)} />
      </div>
    </Modal>
  );
}

function CustomFieldsFrame() {
  const [fields, setFields] = useState(INITIAL_FIELDS);
  const [showAdd, setShowAdd] = useState(false);

  const toggleActive = (id: string) => setFields((p) => p.map((f) => f.id === id ? { ...f, active: !f.active } : f));

  return (
    <div>
      <SectionHeader title="Custom Fields" sub="These fields appear on every lead's detail panel and forms." action={<PrimaryBtn onClick={() => setShowAdd(true)}>+ Add Custom Field</PrimaryBtn>} />
      <TableCard>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E3E7EF" }}>
              {["Field Name", "Type", "Required", "Status", "Actions"].map((h, i) => (
                <th key={h} className={i === 4 ? "text-right" : "text-left"} style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map((f, i) => {
              const meta = FIELD_TYPE_META[f.type];
              return (
                <tr key={f.id} style={{ borderBottom: i < fields.length - 1 ? "1px solid #F3F4F6" : "none", opacity: f.active ? 1 : 0.5 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#E3F7F5"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#111111" }}>{f.label}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: f.required ? "#FEE2E2" : "#F1F5F9", color: f.required ? "#DC2626" : "#6B7280" }}>
                      {f.required ? "Yes" : "No"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <Toggle on={f.active} onChange={() => toggleActive(f.id)} />
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div className="flex items-center justify-end gap-1">
                      <IconBtn title="Edit"><PencilIcon /></IconBtn>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableCard>
      {showAdd && <AddCustomFieldModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

// ─── Frame 5: Data Export ─────────────────────────────────────────────────────

function ExportFrame() {
  const [format, setFormat] = useState<"csv" | "xlsx">("xlsx");
  const [showToast, setShowToast] = useState(false);
  const [toastProgress, setToastProgress] = useState(0);
  const [toastDone, setToastDone] = useState(false);
  const [priorities, setPriorities] = useState({ hot: true, warm: true, cold: false });

  const handleExport = () => {
    setShowToast(true); setToastProgress(0); setToastDone(false);
    const timer = setInterval(() => {
      setToastProgress((p) => {
        if (p >= 100) { clearInterval(timer); setToastDone(true); return 100; }
        return p + 8;
      });
    }, 100);
    setTimeout(() => { setShowToast(false); setToastDone(false); }, 4500);
  };

  return (
    <div>
      <SectionHeader title="Data Export" sub="Export lead data with all standard fields, custom fields, and activity counts." />

      {/* Filter card */}
      <div className="rounded-xl p-6 mb-5" style={{ background: "#FFFFFF", border: "1px solid #E3E7EF", boxShadow: "0 1px 4px rgba(15,27,60,0.06)" }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Filter Export</h3>
        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Date Range — From</label>
            <input type="date" className="w-full rounded-lg px-3" style={{ height: 36, border: "1.5px solid #E3E7EF", fontSize: 13, color: "#111111", outline: "none" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Date Range — To</label>
            <input type="date" className="w-full rounded-lg px-3" style={{ height: 36, border: "1.5px solid #E3E7EF", fontSize: 13, color: "#111111", outline: "none" }} />
          </div>
          {["Stage", "Assignee", "Niche"].map((field) => (
            <div key={field}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>{field}</label>
              <div className="relative">
                <select className="w-full appearance-none rounded-lg px-3 pr-8" style={{ height: 36, border: "1.5px solid #E3E7EF", fontSize: 13, color: "#6B7280", background: "#FFFFFF", outline: "none" }}>
                  <option>All {field}s</option>
                </select>
                <span className="absolute pointer-events-none" style={{ right: 8, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }}><ChevronDownIcon /></span>
              </div>
            </div>
          ))}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>Priority</label>
            <div className="flex flex-col gap-2">
              {([["hot", "#EF4444", "Hot"], ["warm", "#F59E0B", "Warm"], ["cold", "#3B82F6", "Cold"]] as const).map(([k, color, label]) => (
                <label key={k} className="flex items-center gap-2 cursor-pointer">
                  <div onClick={() => setPriorities((p) => ({ ...p, [k]: !p[k] }))} className="flex items-center justify-center rounded" style={{ width: 16, height: 16, border: `1.5px solid ${priorities[k] ? "#2FBEB3" : "#D1D5DB"}`, background: priorities[k] ? "#2FBEB3" : "#FFFFFF" }}>
                    {priorities[k] && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                  <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span style={{ fontSize: 13, color: "#374151" }}>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Format selector */}
      <div className="rounded-xl p-5 mb-5" style={{ background: "#FFFFFF", border: "1px solid #E3E7EF", boxShadow: "0 1px 4px rgba(15,27,60,0.06)" }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Export Format</h3>
        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {([["csv", "CSV", "#64748B"], ["xlsx", "Excel (.xlsx)", "#16A34A"]] as const).map(([val, label, iconColor]) => (
            <button key={val} onClick={() => setFormat(val)} className="flex flex-col items-center gap-3 rounded-xl p-5"
              style={{ border: `2px solid ${format === val ? "#2FBEB3" : "#E3E7EF"}`, background: format === val ? "#E3F7F5" : "#FAFAFA", transition: "all 140ms" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
              </svg>
              <span style={{ fontSize: 14, fontWeight: 700, color: format === val ? "#0E7A70" : "#374151" }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Summary + Export */}
      <div className="flex items-center justify-between px-4 py-3 rounded-lg mb-4" style={{ background: "#F9FAFB", border: "1px solid #E3E7EF" }}>
        <p style={{ fontSize: 13, color: "#6B7280" }}>
          This export will include approximately <strong style={{ color: "#111111" }}>87 leads</strong> based on your filters.
        </p>
      </div>
      <div className="flex justify-end">
        <button onClick={handleExport} className="flex items-center gap-2 rounded-lg font-semibold" style={{ height: 40, paddingInline: 24, fontSize: 14, background: "#2FBEB3", color: "#FFFFFF" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#0E7A70"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#2FBEB3"; }}>
          <DownloadIcon /> Export Data
        </button>
      </div>

      {/* Toast */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl flex items-center gap-3 px-4 py-3" style={{ background: "#FFFFFF", border: "1px solid #E3E7EF", boxShadow: "0 4px 20px rgba(15,27,60,0.14)", minWidth: 280 }}>
          {toastDone ? (
            <span style={{ color: "#16A34A" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span>
          ) : (
            <span style={{ color: "#2FBEB3" }}><DownloadIcon /></span>
          )}
          <div className="flex-1">
            <p style={{ fontSize: 13, fontWeight: 600, color: "#111111" }}>
              {toastDone ? `export_2026-09-15.${format} downloaded` : "Generating export…"}
            </p>
            {!toastDone && (
              <div className="mt-1.5 rounded-full overflow-hidden" style={{ height: 3, background: "#E3E7EF" }}>
                <div style={{ height: "100%", width: `${toastProgress}%`, background: "#2FBEB3", transition: "width 100ms linear", borderRadius: 9999 }} />
              </div>
            )}
          </div>
          <button onClick={() => setShowToast(false)} style={{ color: "#9CA3AF" }}><XIcon /></button>
        </div>
      )}
    </div>
  );
}

// ─── Settings shell ───────────────────────────────────────────────────────────

export function Settings({ role }: { role: UserRole }) {
  const [section, setSection] = useState<SettingsSection>("users");

  if (role !== "superadmin") {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: "calc(100vh - 64px)" }}>
        <p style={{ fontSize: 14, color: "#6B7280" }}>Settings are only accessible to Superadmins.</p>
      </div>
    );
  }

  return (
    <div className="flex" style={{ minHeight: "calc(100vh - 64px)" }}>
      {/* Secondary sub-nav */}
      <div className="flex flex-col shrink-0" style={{ width: 200, background: "#FFFFFF", borderRight: "1px solid #E5E7EB", paddingTop: 20, paddingBottom: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 16px 10px" }}>Settings</p>
        {SUB_NAV.map(({ key, label, icon }) => {
          const active = section === key;
          return (
            <button
              key={key}
              onClick={() => setSection(key)}
              className="flex items-center gap-2.5 mx-2 rounded-lg px-3 py-2.5 text-left"
              style={{
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? "#0E7A70" : "#374151",
                background: active ? "#E3F7F5" : "transparent",
                border: "none",
                cursor: "pointer",
                transition: "background 120ms, color 120ms",
              }}
              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "#F9FAFB"; }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <span style={{ color: active ? "#0E7A70" : "#9CA3AF" }}>{icon}</span>
              {label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: "28px 32px", background: "#F9FAFB" }}>
        {section === "users"         && <UsersFrame />}
        {section === "stages"        && <StagesFrame />}
        {section === "sources"       && <SourcesFrame />}
        {section === "custom-fields" && <CustomFieldsFrame />}
        {section === "export"        && <ExportFrame />}
      </div>
    </div>
  );
}

export default Settings;
