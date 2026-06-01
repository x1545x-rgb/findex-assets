import type { ReactNode } from "react";
import { VARIANTS, type CalloutVariant } from "./variants";

export interface CalloutProps {
  variant: CalloutVariant;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Shared inner layout for every Callout pattern: accent icon + a
 * visually-hidden semantic label + optional title + body. Keeping this
 * in one place means accessibility (sr label, icon) is identical across
 * all patterns; only the surrounding panel chrome differs per pattern.
 *
 * The icon uses `text-[var(--callout-accent)]` and body text uses
 * `text-[var(--callout-body)]` — all sourced from tokens.css.
 */
export function CalloutContent({
  variant,
  title,
  children,
  iconStyle = "plain",
}: Omit<CalloutProps, "className"> & {
  /** "plain" = accent-colored glyph; "tile" = white glyph on an accent tile. */
  iconStyle?: "plain" | "tile";
}) {
  const { Icon, srLabel } = VARIANTS[variant];
  return (
    <div className="flex gap-3">
      {iconStyle === "tile" ? (
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--callout-accent)] text-white">
          <Icon />
        </span>
      ) : (
        <Icon className="mt-0.5 shrink-0 text-[var(--callout-accent)]" />
      )}
      <div className="min-w-0 text-[var(--callout-body)]">
        {/* Meaning is never color-only: announce it to AT, hide visually. */}
        <span className="sr-only">{srLabel}</span>
        {title ? (
          <p className="font-semibold leading-snug text-[var(--callout-title)]">{title}</p>
        ) : null}
        <div className="text-sm leading-relaxed [&_a]:underline">{children}</div>
      </div>
    </div>
  );
}

/** Resolves the ARIA role for the outer panel from the variant. */
export function liveProps(variant: CalloutVariant) {
  return { role: VARIANTS[variant].role };
}
