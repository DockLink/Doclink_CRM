import type { ReactNode } from "react";

function GeometricPattern() {
  return (
    <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <pattern id="geo" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
          <circle cx="40" cy="40" r="1" fill="#4A6FA5" opacity="0.25" />
          <circle cx="0" cy="0" r="1" fill="#4A6FA5" opacity="0.25" />
          <circle cx="80" cy="0" r="1" fill="#4A6FA5" opacity="0.25" />
          <circle cx="0" cy="80" r="1" fill="#4A6FA5" opacity="0.25" />
          <circle cx="80" cy="80" r="1" fill="#4A6FA5" opacity="0.25" />
        </pattern>
        <pattern id="lines" x="0" y="0" width="160" height="160" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="160" y2="160" stroke="#3D5A8A" strokeWidth="0.5" opacity="0.15" />
          <line x1="160" y1="0" x2="0" y2="160" stroke="#3D5A8A" strokeWidth="0.5" opacity="0.1" />
          <polygon points="80,20 140,60 140,100 80,140 20,100 20,60" fill="none" stroke="#4A6FA5" strokeWidth="0.5" opacity="0.12" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#lines)" />
      <rect width="100%" height="100%" fill="url(#geo)" />
    </svg>
  );
}

function DocLinkLogoMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 4h6v16H4zM14 4h6v16h-6z" fill="white" opacity="0.9" />
      <rect x="10" y="9" width="4" height="6" fill="white" opacity="0.5" />
    </svg>
  );
}

function LeftPanel() {
  return (
    <div
      className="hidden lg:flex relative flex-col"
      style={{ width: "55%", background: "#0F1B3C", minHeight: "100vh" }}
    >
      <GeometricPattern />

      <div className="relative z-10 p-8">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#2FBEB3" }}>
            <DocLinkLogoMark />
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.3px" }}>
            DocLink CRM
          </span>
        </div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-center px-16 pb-24">
        <h2 style={{ fontSize: 36, fontWeight: 600, color: "#FFFFFF", lineHeight: 1.2, letterSpacing: "-0.5px", maxWidth: 420, marginBottom: 16 }}>
          Manage every lead.
          <br />
          Miss nothing.
        </h2>
        <p style={{ fontSize: 16, color: "#9AA6C3", maxWidth: 380, lineHeight: 1.6 }}>
          The internal sales pipeline system for DocLink Technologies.
        </p>

        <div className="mt-16 flex gap-8">
          {[
            { value: "1,240+", label: "Active leads" },
            { value: "94%", label: "Follow-up rate" },
            { value: "38", label: "Deals closed this month" },
          ].map(({ value, label }) => (
            <div key={label}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#2FBEB3" }}>{value}</div>
              <div style={{ fontSize: 12, color: "#9AA6C3", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 h-1 w-full" style={{ background: "linear-gradient(to right, #2FBEB3, #0E7A70, transparent)" }} />
    </div>
  );
}

function MobileLogo() {
  return (
    <div className="lg:hidden absolute top-6 left-6 flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#2FBEB3" }}>
        <DocLinkLogoMark size={16} />
      </div>
      <span style={{ fontSize: 16, fontWeight: 700, color: "#0E7A70" }}>DocLink CRM</span>
    </div>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      <LeftPanel />
      <div
        className="flex-1 flex flex-col items-center justify-center relative"
        style={{ background: "#FFFFFF", minHeight: "100vh" }}
      >
        <MobileLogo />
        <div className="w-full px-8 flex items-center justify-center" style={{ maxWidth: 480 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
