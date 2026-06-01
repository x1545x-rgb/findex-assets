import { CalloutContent, liveProps, type CalloutProps } from "./CalloutContent";

/**
 * ✅ Pattern 6 — leading accent icon tile.
 * ------------------------------------------------------------------
 * No edge stripe at all. The accent lives in a filled, separately
 * rounded "tile" holding a white icon at the leading edge of the panel
 * (the panel itself stays a neutral/very-faint tonal surface).
 *
 * This is the "leading element" pattern used by Atlassian and Material
 * Design (a colored container + icon expresses severity). Because the
 * accent is an inset, independently-rounded square, it never touches the
 * panel's corners — fully radius-safe — and the solid color block reads
 * as a stronger severity signal than a thin line.
 */
export function CalloutIconTile({ variant, title, children, className }: CalloutProps) {
  return (
    <div
      data-callout-variant={variant}
      {...liveProps(variant)}
      className={[
        "rounded-xl p-4",
        "bg-[var(--callout-surface)]",
        "ring-1 ring-inset ring-[var(--callout-hairline)]",
        className ?? "",
      ].join(" ")}
    >
      <CalloutContent variant={variant} title={title} iconStyle="tile">
        {children}
      </CalloutContent>
    </div>
  );
}
