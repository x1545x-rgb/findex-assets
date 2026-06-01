"use client";

import { useState } from "react";
import {
  CalloutBorderLeftBad,
  CalloutInsetShadow,
  CalloutPseudoBar,
  CalloutTonal,
  CalloutAccentOutline,
  CalloutIconTile,
  CalloutRail,
  type CalloutProps,
  type CalloutVariant,
} from "@/components/callout";

/**
 * Dev-only showcase: every accent pattern × every variant, so the
 * corner handling can be compared by eye in both light and dark.
 *
 * Path: app/_dev/callout/page.tsx
 * NOTE: the import uses the `@/` alias → ensure tsconfig maps
 *       "@/*" to "src/*" (Next.js default for the `src` dir).
 */

const VARIANTS: CalloutVariant[] = ["info", "success", "warning", "error"];

const COPY: Record<CalloutVariant, { title: string; body: string }> = {
  info: { title: "情報", body: "この操作はいつでも取り消せます。" },
  success: { title: "保存しました", body: "変更内容は正常に反映されました。" },
  warning: { title: "注意", body: "下書きは7日後に自動削除されます。" },
  error: { title: "送信に失敗しました", body: "ネットワークを確認して再試行してください。" },
};

type PatternComponent = (props: CalloutProps) => React.ReactNode;

const PATTERNS: {
  id: string;
  label: string;
  note: string;
  bad?: boolean;
  Component: PatternComponent;
}[] = [
  {
    id: "border-left-bad",
    label: "1. border-left + radius（❌ 使用禁止）",
    note: "角で楔/クリップが発生する反面教師。左上・左下を拡大して確認。",
    bad: true,
    Component: CalloutBorderLeftBad,
  },
  {
    id: "inset-shadow",
    label: "2. inset box-shadow",
    note: "帯が角丸に追従して曲がる。border-left の素直な置き換え。",
    Component: CalloutInsetShadow,
  },
  {
    id: "pseudo-bar",
    label: "3. inset 疑似要素バー",
    note: "::before を余白付きで浮かせた独立バー。角と衝突しない。",
    Component: CalloutPseudoBar,
  },
  {
    id: "tonal",
    label: "4. tonal fill + icon（推奨）",
    note: "縦線なし。淡トーナル背景＋意味アイコン。角丸と素直に噛み合う。",
    Component: CalloutTonal,
  },
  {
    id: "accent-outline",
    label: "5. 全周アクセント枠 + tonal（Bootstrap / Ant / GitHub系）",
    note: "4辺同色の枠なので角が均一に丸まり楔が出ない。色枠で意味を伝える。",
    Component: CalloutAccentOutline,
  },
  {
    id: "icon-tile",
    label: "6. 先頭アイコンタイル（Atlassian / Material のleading element）",
    note: "縦線なし。塗りつぶしの角丸タイル＋白アイコン。角と無関係で強い意味表現。",
    Component: CalloutIconTile,
  },
  {
    id: "rail",
    label: "7. 外付けレール（縦線をパネルの外に出す）",
    note: "バーをパネルの外の独立要素にし、隙間で離す。border-radius と一切干渉しない。",
    Component: CalloutRail,
  },
];

export default function CalloutShowcasePage() {
  const [dark, setDark] = useState(false);

  return (
    <div className={dark ? "dark" : ""}>
      <main className="min-h-screen bg-white p-8 text-zinc-900 transition-colors dark:bg-zinc-950 dark:text-zinc-100">
        <div className="mx-auto max-w-5xl">
          <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Callout — accent パターン比較</h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                角丸パネルにおける「左の細いアクセント線」の正しい表現方法を比較。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDark((d) => !d)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {dark ? "☀️ ライト表示" : "🌙 ダーク表示"}
            </button>
          </header>

          <div className="space-y-12">
            {PATTERNS.map(({ id, label, note, bad, Component }) => (
              <section key={id} aria-labelledby={`h-${id}`}>
                <h2
                  id={`h-${id}`}
                  className={[
                    "text-lg font-semibold",
                    bad ? "text-red-600 dark:text-red-400" : "",
                  ].join(" ")}
                >
                  {label}
                </h2>
                <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">{note}</p>

                <div className="grid gap-4 sm:grid-cols-2">
                  {VARIANTS.map((variant) => (
                    <Component key={variant} variant={variant} title={COPY[variant].title}>
                      {COPY[variant].body}
                    </Component>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <footer className="mt-16 rounded-xl border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            <strong className="text-zinc-800 dark:text-zinc-200">確認ポイント:</strong> パターン1の
            左上・左下の角を拡大すると、4px の直線バーが border-radius に切り取られて楔状の
            欠けが見える。パターン2〜4ではいずれも角がクリーンに保たれている。
          </footer>
        </div>
      </main>
    </div>
  );
}
