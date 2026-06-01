# Callout — 角丸パネルのアクセント表現パターン

角丸パネルに「左の細いカラーアクセント線」を付ける定番装飾は、`border-left: 4px`
と `border-radius` を併用すると角でマイター結合の楔ができ、角丸にクリップされて
違和感が出る。本ディレクトリはその回避策を比較できるショーケース。

| パターン | ファイル | 角の挙動 | 備考 |
| --- | --- | --- | --- |
| 1. border-left + radius | `CalloutBorderLeftBad.tsx` | ❌ 楔/クリップ発生 | **使用禁止**（反面教師） |
| 2. inset box-shadow | `CalloutInsetShadow.tsx` | ✅ 角丸に追従 | border-left の素直な置換 |
| 3. inset 疑似要素バー | `CalloutPseudoBar.tsx` | ✅ 衝突なし | 余白付き独立ピル |
| 4. tonal fill + icon | `CalloutTonal.tsx` | ✅ 完全にクリーン | **推奨** |

- 色トークンは `tokens.css` に集約（直書き禁止）。各 variant は
  `data-callout-variant` で選択し、コンポーネントは `var(--callout-*)` のみ参照。
- ライト/ダーク両対応（`prefers-color-scheme` と Tailwind `.dark` の両方）。
- 意味は色だけに依存させない：アクセント色＋アイコン＋スクリーンリーダー用の
  ラベル（`sr-only`）＋ role（error=alert / warning・success=status / info=note）。

比較ページ: `app/_dev/callout/page.tsx`

## 推奨

**tonal fill + icon（パターン4）を推奨。** 角丸 UI ではエッジ装飾そのものが
border-radius と競合する原因なので、縦線を廃して「淡いトーナル背景＋意味アイコン」で
severity を表すと、どの角丸半径でも角がクリーンに保たれ、形状もそのままスケールする。
これは Atlassian SectionMessage / Material Design 3 の `*-container` ロールと同じ
事実上の標準で、色のみ依存も自然に避けられる。バーの見た目がどうしても必要な箇所だけ
パターン2（inset box-shadow）を補助的に使う。

### NextPlay 採用案

NextPlay では **パターン4（tonal fill + icon）を標準 Callout として採用**する。
