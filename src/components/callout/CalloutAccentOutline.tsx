import { CalloutContent, liveProps, type CalloutProps } from "./CalloutContent";

/**
 * ✅ Pattern 5 — full accent outline + tonal fill.
 * ------------------------------------------------------------------
 *     border: 1.5px solid <accent>;  border-radius: 12px;
 *
 * The miter-wedge problem with `border-left` only happens because the
 * left border is a DIFFERENT color from the (transparent) top/bottom
 * borders, so the diagonal join is visible. When ALL FOUR sides share
 * one accent color, the rounded corner is uniform and renders perfectly
 * — no wedge, no clipping. This is exactly how Bootstrap / Ant Design /
 * GitHub-style alerts get a colored accent that coexists with radius.
 *
 * The accent therefore "outlines" the whole panel instead of striping
 * one edge, paired with a pale tonal fill for redundancy.
 */
export function CalloutAccentOutline({ variant, title, children, className }: CalloutProps) {
  return (
    <div
      data-callout-variant={variant}
      {...liveProps(variant)}
      className={[
        "rounded-xl p-4",
        "bg-[var(--callout-surface)]",
        // Uniform full-perimeter accent border → corners stay clean.
        "border border-[var(--callout-accent)]",
        className ?? "",
      ].join(" ")}
    >
      <CalloutContent variant={variant} title={title}>
        {children}
      </CalloutContent>
    </div>
  );
}
