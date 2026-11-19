import type { CSSProperties } from "react";

/** Shared geometry for HTML and PDF corner graphics. */
export const INVOICE_CORNER = {
  band: "#FDCF30",
  triangle: "#104C98",
  line: "#F1DA64",
  viewBox: "0 0 160 160",
  bandPoints: "1,0 43,0 159,116 159,158",
  trianglePoints: "60,0 159,0 159,99",
  lineCoords: { x1: 65, y1: -5, x2: 164, y2: 94, strokeWidth: 4.7 },
  sizePercent: "31%",
  sizePx: 160,
} as const;

type InvoiceCornerHeaderProps = {
  className?: string;
  style?: CSSProperties;
};

/**
 * Decorative top-right invoice corner: yellow band, white gap, blue triangle
 * with a thin yellow line. Matches the DOCLINK invoice template artwork.
 */
export function InvoiceCornerHeader({ className, style }: InvoiceCornerHeaderProps) {
  const { band, triangle, line, viewBox, bandPoints, trianglePoints, lineCoords, sizePercent } =
    INVOICE_CORNER;

  return (
    <div
      aria-hidden
      className={className}
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: sizePercent,
        maxWidth: INVOICE_CORNER.sizePx,
        aspectRatio: "1 / 1",
        overflow: "hidden",
        pointerEvents: "none",
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
        ...style,
      }}
    >
      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMaxYMin meet"
        width="100%"
        height="100%"
        style={{ display: "block", overflow: "hidden" }}
      >
        <polygon points={bandPoints} fill={band} />
        <polygon points={trianglePoints} fill={triangle} />
        <line
          x1={lineCoords.x1}
          y1={lineCoords.y1}
          x2={lineCoords.x2}
          y2={lineCoords.y2}
          stroke={line}
          strokeWidth={lineCoords.strokeWidth}
        />
      </svg>
    </div>
  );
}
