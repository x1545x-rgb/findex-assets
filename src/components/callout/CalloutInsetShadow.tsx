import { CalloutContent, liveProps, type CalloutProps } from "./CalloutContent";

/**
 * ✅ Pattern 2 — inset box-shadow accent.
 * ------------------------------------------------------------------
 *     box-shadow: inset 4px 0 0 0 <accent>;
 *
 * Unlike `border-left`, an inset box-shadow is painted INSIDE the
 * border-box and is clipped by `border-radius`, so the accent band
 * curves smoothly with the rounded corners instead of producing a
 * miter wedge. It's the most literal, drop-in replacement for the
 * border-left accent — same 4px bar on the left, no corner artifact,
 * and it doesn't consume layout box like a real border would.
 *
 * The pale tonal surface also carries the meaning redundantly, but the
 * defining trait of this pattern is the inset-shadow bar.
 */
export function CalloutInsetShadow({ variant, title, children, className }: CalloutProps) {
  return (
    <div
      data-callout-variant={variant}
      {...liveProps(variant)}
      className={[
        "rounded-xl p-4",
        "bg-[var(--callout-surface)]",
        // Inset shadow follows the radius → no clipped wedge.
        "shadow-[inset_4px_0_0_0_var(--callout-accent)]",
        className ?? "",
      ].join(" ")}
    >
      <CalloutContent variant={variant} title={title}>
        {children}
      </CalloutContent>
    </div>
  );
}
