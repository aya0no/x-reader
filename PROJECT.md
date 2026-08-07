# X Reader 引き継ぎメモ

## 基準

- リポジトリ: `aya0no/x-reader`
- PWA: `index.html`、`app.js`、`style.css`
- Userscript最新版: `x-reader.user.js`
- 更新確認ファイル: `x-reader.meta.js`
- 利用環境: iPhone Safari＋Userscripts

## 現在のUserscript

- 基準版: `X Reader Accordion v7.0.4-step11-light`
- モノクロでコンパクトなフィード
- 通常表示と簡素表示をアイコンで切り替え
- 投稿詳細を専用の簡素画面で表示
- 投稿画像は詳細画面ではカラー表示
- いいね数、日時、ブックマーク操作を表示
- ブックマーク一覧への導線を表示
- 不要なSVG再生成と定期処理を抑えた軽量版

## 更新時のルール

1. `x-reader.user.js` を変更する。
2. `x-reader.user.js` と `x-reader.meta.js` の `@version` を同じ値へ上げる。
3. `x-reader.meta.js` のメタデータを実行ファイルと一致させる。
4. JavaScriptの構文確認を行う。
5. 変更内容と確認結果を記録する。

機能変更の指示がない更新では、表示や動作を変えない。
