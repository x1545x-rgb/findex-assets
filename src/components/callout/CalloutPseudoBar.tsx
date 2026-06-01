import { CalloutContent, liveProps, type CalloutProps } from "./CalloutContent";

/**
 * ✅ Pattern 3 — inset pseudo-element bar.
 * ------------------------------------------------------------------
 * A `::before` is absolutely positioned and floated INSIDE the panel
 * with top/bottom/left insets, so it is a fully independent, separately
 * rounded vertical pill:
 *
 *     position: relative;            (relative)
 *     ::before {
 *       content: "";                 (before:content-[''])
 *       position: absolute;          (before:absolute)
 *       left/top/bottom: 0.5rem;     (before:left-2 before:inset-y-2)
 *       width: 4px;                  (before:w-1)
 *       border-radius: 9999px;       (before:rounded-full)
 *       background: <accent>;        (before:bg-[var(--callout-accent)])
 *     }
 *
 * Because the bar sits inset from every edge, it never reaches the
 * panel's rounded corners and therefore can't collide with or be
 * clipped by them. It also reads as a deliberate "pill" marker rather
 * than a structural border. Slightly more markup than Pattern 2, but
 * the most visually polished bar treatment.
 */
export function CalloutPseudoBar({ variant, title, children, className }: CalloutProps) {
  return (
    <div
      data-callout-variant={variant}
      {...liveProps(variant)}
      className={[
        "relative rounded-xl p-4 pl-6",
        "bg-[var(--callout-surface)]",
        // Independent, inset, separately-rounded vertical pill.
        "before:absolute before:inset-y-2 before:left-2 before:w-1",
        "before:rounded-full before:bg-[var(--callout-accent)] before:content-['']",
        className ?? "",
      ].join(" ")}
    >
      <CalloutContent variant={variant} title={title}>
        {children}
      </CalloutContent>
    </div>
  );
}
