import { CalloutContent, liveProps, type CalloutProps } from "./CalloutContent";

/**
 * ❌ 使用禁止 / DO NOT USE — anti-pattern, kept only for comparison.
 * ------------------------------------------------------------------
 * The classic "thin colored accent on the left + rounded panel":
 *
 *     border-left: 4px solid <accent>;   (border-l-4)
 *     border-radius: 12px;               (rounded-xl)
 *
 * Because the left border is a real CSS border, at the top-left and
 * bottom-left it MITER-JOINS with the (transparent) top/bottom borders.
 * That join is a diagonal seam, and the border-radius then CLIPS the
 * square top of the 4px bar — you get an ugly little wedge / notch where
 * the straight bar tries to round the corner. The thicker the bar or the
 * larger the radius, the more obvious the artifact.
 *
 * This component exists ONLY so the showcase can show the defect next to
 * the correct alternatives. Never ship it.
 */
export function CalloutBorderLeftBad({ variant, title, children, className }: CalloutProps) {
  return (
    <div
      data-callout-variant={variant}
      {...liveProps(variant)}
      className={[
        "rounded-xl p-4",
        "bg-[var(--callout-surface)]",
        // The offending combination: solid left border + rounded corners.
        "border-l-4 border-[var(--callout-accent)]",
        className ?? "",
      ].join(" ")}
    >
      <CalloutContent variant={variant} title={title}>
        {children}
      </CalloutContent>
    </div>
  );
}
