import { CalloutContent, liveProps, type CalloutProps } from "./CalloutContent";

/**
 * ✅ Pattern 4 — tonal fill + leading icon (RECOMMENDED).
 * ------------------------------------------------------------------
 * No vertical line at all. Meaning is carried by:
 *   - a pale tonal surface tinted toward the accent hue, and
 *   - a leading semantic icon in the accent color.
 *
 * This is the de-facto modern standard: Atlassian's SectionMessage and
 * Material Design 3's `*-container` color roles both express severity
 * with a filled tonal container + icon rather than an edge stripe.
 *
 * It is the pattern that "just works" with rounded UIs: there is no
 * edge decoration to fight the border-radius, so corners stay clean at
 * any radius, the whole shape scales cleanly, and a faint hairline keeps
 * the panel defined on busy backgrounds. Contrast (body text on the
 * tonal surface) is tuned in tokens.css to meet WCAG AA in both themes.
 */
export function CalloutTonal({ variant, title, children, className }: CalloutProps) {
  return (
    <div
      data-callout-variant={variant}
      {...liveProps(variant)}
      className={[
        "rounded-xl p-4",
        "bg-[var(--callout-surface)]",
        // Hairline keeps the tonal panel legible on any background.
        "ring-1 ring-inset ring-[var(--callout-hairline)]",
        className ?? "",
      ].join(" ")}
    >
      <CalloutContent variant={variant} title={title}>
        {children}
      </CalloutContent>
    </div>
  );
}
