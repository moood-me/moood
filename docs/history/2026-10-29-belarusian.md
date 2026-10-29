# 2026-10-29 — Belarusian (`be`)

Why: Павел: ещё язык — белорусский.

- `i18n/languages.json`: `be` — `{ "name": "Беларуская", "locale": "be_BY" }`, after `ru`. Its plural forms are
  Russian's (`one`, `few`, `many`, `other`: Intl.PluralRules).
- moood's own pages translated into Belarusian beside the Russian: `engines/1/lang/be.json`, `engines/3/lang/be.json`,
  `play/lang/be.json`, `player/lang/be.json`, `scene/lang/be.json`, `packages/check/problems/lang/be.json`.
  Modern standard Belarusian, the official orthography; translated from the English source, the Russian read beside it;
  the player and the reader are «ты»; a play is «партыя»; spans of time (`scene/span.js`) are in the accusative, as
  `again in {again}` («зноў праз {again}») needs.
- The tests that name moood's languages (`test/check.test.js`, `test/player.test.js`) — `en, ru, be`.
- How it was checked: `npm ci && npm run build` in `packages/check`, then `node packages/check/cli.js <folder> --write`
  for each folder of moood's pages (`engines/1`, `engines/3`, `play`, `player`, `scene`, `packages/check/problems`) —
  the files laid out, translated, then each says «all right».
