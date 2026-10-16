"use client";

import React from "react";

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

/** Command Center / Home Hub Icon */
export function IconHome({ size = 18, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.75" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.75" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.75" />
      <path d="M13.5 17.25h7.5M17.25 13.5v7.5" />
    </svg>
  );
}

/** Book Studio Icon: Open spread with spine seam & trim ticks */
export function IconBookStudio({ size = 18, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M12 5.5C10.2 4.3 7.4 4 4.5 4.5A1.5 1.5 0 0 0 3 6v12a1.5 1.5 0 0 0 1.5 1.5c2.9-.5 5.7-.2 7.5 1 1.8-1.2 4.6-1.5 7.5-1A1.5 1.5 0 0 0 21 18V6a1.5 1.5 0 0 0-1.5-1.5c-2.9-.5-5.7-.2-7.5 1Z" />
      <path d="M12 5.5v15" strokeDasharray="2.5 2" />
      <path d="M6 9h3M6 12.5h3M15 9h3M15 12.5h3" strokeWidth={1.4} opacity={0.75} />
    </svg>
  );
}

/** Preflight Studio Icon: Page geometry with precision target loupe */
export function IconPreflightStudio({ size = 18, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4.5" />
      <path d="M14 3v4h4" />
      <circle cx="16.5" cy="16.5" r="3.5" />
      <path d="m19.2 19.2 2.3 2.3" />
      <path d="M7.5 9h5M7.5 12.5h3" strokeWidth={1.4} opacity={0.75} />
    </svg>
  );
}

/** Imposing Studio Icon: Press sheet with 4-up imposed signatures & registration marks */
export function IconImposingStudio({ size = 18, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <rect x="6" y="7" width="4.75" height="4.25" rx="0.75" strokeWidth={1.5} />
      <rect x="13.25" y="7" width="4.75" height="4.25" rx="0.75" strokeWidth={1.5} />
      <rect x="6" y="12.75" width="4.75" height="4.25" rx="0.75" strokeWidth={1.5} />
      <rect x="13.25" y="12.75" width="4.75" height="4.25" rx="0.75" strokeWidth={1.5} />
    </svg>
  );
}

/** Contour Studio Icon: Vector Bezier die-cut path with anchor nodes */
export function IconContourStudio({ size = 18, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M5 19C5 11 11 5 19 5" />
      <rect x="3" y="17" width="4" height="4" rx="0.75" />
      <rect x="17" y="3" width="4" height="4" rx="0.75" />
      <circle cx="9.5" cy="9.5" r="2" />
      <path d="m11 11 6 6M14.5 17H17v-2.5" strokeWidth={1.5} />
    </svg>
  );
}

/** Flipbook Studio Icon: 3D perspective turning pages */
export function IconFlipbookStudio({ size = 18, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M4 6.5v12c2.5-1 5.5-1 8 0v-12c-2.5-1-5.5-1-8 0Z" />
      <path d="M12 6.5c2.5-1 5.5-1 8 0v12c-2.5-1-5.5-1-8 0" />
      <path d="M12 6.5c1.8-2.2 4.3-3.2 6.5-2.5v11.5c-2.2-.7-4.7.3-6.5 2.5" opacity={0.75} />
    </svg>
  );
}

/** Crop & Split Module Icon: Crop frame with vertical split seam */
export function IconToolCropSplit({ size = 15, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M6 2v14a2 2 0 0 0 2 2h14" />
      <path d="M18 22V8a2 2 0 0 0-2-2H2" />
      <path d="M12 6v12" strokeDasharray="2.5 2.5" />
    </svg>
  );
}

/** Deskew Module Icon: Tilted baseline leveling to horizon */
export function IconToolDeskew({ size = 15, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M3 19h18" strokeDasharray="2.5 2.5" opacity={0.65} />
      <rect x="5" y="5" width="14" height="11" rx="1.5" transform="rotate(-10 12 10.5)" />
      <path d="M8.5 10.5h7" transform="rotate(-10 12 10.5)" strokeWidth={1.5} />
    </svg>
  );
}

/** Print Bleed Module Icon: Trim box with 4 corner printers' crop marks */
export function IconToolBleed({ size = 15, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="6.5" y="6.5" width="11" height="11" rx="1" />
      <path d="M2 6.5h2.5M6.5 2v2.5M17.5 2v2.5M22 6.5h-2.5M2 17.5h2.5M6.5 22v-2.5M17.5 22v-2.5M22 17.5h-2.5" />
    </svg>
  );
}

/** Restoration & Cleanup Module Icon: Contrast/Paper tone enhancer */
export function IconToolCleanup({ size = 15, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v17" />
      <path d="M12 7.5l5-2M12 12l6.5-2.5M12 16.5l5-2" opacity={0.75} strokeWidth={1.5} />
    </svg>
  );
}

/** Auto-Detect Bounds Reticle Icon */
export function IconAutoDetect({ size = 14, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 7v2M12 15v2M7 12h2M15 12h2" strokeWidth={1.5} />
    </svg>
  );
}

/** Technical Caliper / Dimension Ruler Icon (for Preview Notch) */
export function IconDimensionRuler({ size = 13, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="2" y="7" width="20" height="10" rx="2" />
      <path d="M6 7v4M10 7v2.5M14 7v4M18 7v2.5" />
    </svg>
  );
}

/** Vertical Cut Axis Icon (left/right page split) */
export function IconSplitVertical({ size = 12, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="3" y="4" width="18" height="16" rx="2" opacity={0.45} />
      <path d="M12 3v18" strokeDasharray="3 2" />
    </svg>
  );
}

/** Horizontal Cut Axis Icon (top/bottom strip split) */
export function IconSplitHorizontal({ size = 12, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="3" y="4" width="18" height="16" rx="2" opacity={0.45} />
      <path d="M3 12h18" strokeDasharray="3 2" />
    </svg>
  );
}

/** Split A/B Scan Comparison Icon (Original vs Edited) */
export function IconCompareScan({ size = 14, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M12 4v16" />
      <path d="M6.5 9h2.5M6.5 13h2.5" opacity={0.5} />
      <path d="M15 9h2.5M15 13h2.5" />
    </svg>
  );
}

/** Hand / Pan Tool Icon */
export function IconHandPan({ size = 14, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M18 11V6a2 2 0 0 0-4 0v4" />
      <path d="M14 10V4a2 2 0 0 0-4 0v6" />
      <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  );
}
