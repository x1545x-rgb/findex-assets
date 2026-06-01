import type { ReactNode } from "react";

/**
 * The four semantic variants. Meaning is conveyed by accent color,
 * icon, AND a visually-hidden text label — never color alone.
 */
export type CalloutVariant = "info" | "success" | "warning" | "error";

export interface VariantMeta {
  /** Visually-hidden prefix so screen readers announce the meaning. */
  srLabel: string;
  /** Inline SVG icon (decorative; aria-hidden). Uses currentColor. */
  Icon: (props: { className?: string }) => ReactNode;
  /**
   * Live-region semantics via implicit role mapping (no explicit
   * aria-live, to avoid contradicting a role's built-in politeness):
   *   - error   → role="alert"  (implicitly assertive)
   *   - warning → role="status" (implicitly polite)
   *   - success → role="status" (implicitly polite)
   *   - info    → role="note"   (not a live region)
   */
  role: "alert" | "status" | "note";
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" {...stroke} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <circle cx="12" cy="7.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SuccessIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" {...stroke} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" {...stroke} aria-hidden="true">
      <path d="M12 3.5L21 19H3z" />
      <line x1="12" y1="9.5" x2="12" y2="14" />
      <circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" {...stroke} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <line x1="9" y1="9" x2="15" y2="15" />
      <line x1="15" y1="9" x2="9" y2="15" />
    </svg>
  );
}

export const VARIANTS: Record<CalloutVariant, VariantMeta> = {
  info: { srLabel: "情報:", Icon: InfoIcon, role: "note" },
  success: { srLabel: "成功:", Icon: SuccessIcon, role: "status" },
  warning: { srLabel: "警告:", Icon: WarningIcon, role: "status" },
  error: { srLabel: "エラー:", Icon: ErrorIcon, role: "alert" },
};
