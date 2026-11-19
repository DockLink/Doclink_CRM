"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function InvoiceButtonFeedback({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button");
      if (!button || !container.contains(button)) return;

      button.dataset.clicked = "true";
      window.setTimeout(() => {
        delete button.dataset.clicked;
      }, 900);
    };

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="invoice-button-feedback" style={{ display: "contents" }}>
      {children}
    </div>
  );
}
