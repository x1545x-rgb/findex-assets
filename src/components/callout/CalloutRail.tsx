import { CalloutContent, liveProps, type CalloutProps } from "./CalloutContent";

/**
 * ✅ Pattern 7 — external rounded rail.
 * ------------------------------------------------------------------
 * For when a vertical accent line is genuinely wanted: put the bar
 * OUTSIDE the rounded panel as its own element, separated by a gap.
 *
 *   [rail]  [ rounded panel ]
 *
 * A flex row holds an independent `rounded-full` bar that stretches to
 * the panel's height, next to the panel. Because the bar is a sibling
 * (not an edge of the panel), it has zero interaction with the panel's
 * border-radius — no wedge, no clipping, no taper — while still reading
 * as the classic "colored line on the left". This is the treatment used
 * by timeline / activity-feed rails.
 *
 * The wrapper carries `data-callout-variant` so both the rail and the
 * panel resolve the same accent/surface tokens.
 */
export function CalloutRail({ variant, title, children, className }: CalloutProps) {
  return (
    <div
      data-callout-variant={variant}
      {...liveProps(variant)}
      className={["flex items-stretch gap-2.5", className ?? ""].join(" ")}
    >
      {/* Independent bar, outside the panel — immune to the panel radius. */}
      <span aria-hidden="true" className="w-1 shrink-0 rounded-full bg-[var(--callout-accent)]" />
      <div className="min-w-0 flex-1 rounded-xl bg-[var(--callout-surface)] p-4">
        <CalloutContent variant={variant} title={title}>
          {children}
        </CalloutContent>
      </div>
    </div>
  );
}
