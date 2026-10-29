# 2026-10-29 — Traditional Chinese (`zh-hant`)

Why: Павел: ещё язык — традиционный китайский.

- `i18n/languages.json`: `zh-hant` — `{ "name": "繁體中文", "locale": "zh_TW" }`, after `ru`. Readers in Taiwan and
  Hong Kong; where the two differ, Taiwan's usage. One plural form (`Intl.PluralRules('zh-hant')`: `other` only).
- moood's own pages translated beside the Russian: `engines/1/lang/zh-hant.json`, `engines/3/lang/zh-hant.json`,
  `play/lang/zh-hant.json`, `player/lang/zh-hant.json`, `scene/lang/zh-hant.json`,
  `packages/check/problems/lang/zh-hant.json`. From the English source, the Russian read beside it; full-width
  punctuation, 「」 for quotes; the interface short and plain; the code's own words (`"languages"`, `tr(…)`, field
  names) kept as they are.
- The tests that name moood's languages (`test/check.test.js`, `test/player.test.js`) — `en, ru, zh-hant`.
- How it was checked: `npm ci && npm run build` in `packages/check`, `node packages/check/cli.js <folder> --write` for
  each folder of moood's pages, filled, then each says «all right»; the two tests pass (run in a Linux container: on
  Windows their fixture paths do not resolve).
