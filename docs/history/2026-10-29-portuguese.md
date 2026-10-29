# 2026-10-29 — Brazilian Portuguese (`pt`)

Why: Павел: «Португальский (бразильский) еще запусти» — a further language, after the nine on `languages`.

- Branch `pt`, from `languages` (en, ru and the seven merged there).
- `i18n/languages.json`: `pt` — `{ "name": "Português (Brasil)", "locale": "pt_BR" }`, after `zh-hant`.
- moood's own pages translated: `engines/1/lang/pt.json`, `engines/3/lang/pt.json`, `play/lang/pt.json`,
  `player/lang/pt.json`, `scene/lang/pt.json`, `packages/check/problems/lang/pt.json`. Translated from the English
  source, the Russian and the French read beside it; Brazilian usage — «você», Brazilian spelling and words (tela,
  celular, arquivo, time…); plural forms are Portuguese's `one`, `many` (`1 milhão de dias`), `other`.
- The tests that name moood's languages (`test/check.test.js`, `test/player.test.js`) — `…, zh-hant, pt`.
- How it was checked: `npm ci && npm run build` in `packages/check`, then `node packages/check/cli.js <folder>` for each
  folder of moood's pages — `--write` laid the files out, then each says «all right»; the two tests pass (in a Linux
  container: their fixture paths are POSIX).
