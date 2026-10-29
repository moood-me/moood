# 2026-10-29 — Portuguese, Polish, Korean merged into `languages`

Why: Павел: bring them all into `languages`.

- Branches `pt` (Brazilian Portuguese), `pl` (Polish), `ko` (Korean) merged into `languages` (not into main): it has
  all twelve now — en, ru, uk, de, es, ja, be, fr, zh-hant, pt, pl, ko.
- `i18n/languages.json` and the tests naming moood's languages (`test/check.test.js`, `test/player.test.js`) — the
  union, in that order. Each branch's own files came in as they were.
- Checked: `node packages/check/cli.js` on `engines/1`, `engines/3`, `play`, `player`, `scene`,
  `packages/check/problems` — «all right».
