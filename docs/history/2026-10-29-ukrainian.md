# 2026-10-29 — третий язык: украинский

Павел: третий язык — украинский. Ветка `uk` (в `main` не слита).

## Что

- `i18n/languages.json`: `"uk": { "name": "Українська", "locale": "uk_UA" }` — после `ru`, тем же видом.
- Переводы собственных страниц moood на украинский — `lang/uk.json` рядом с `ru.json`: `engines/1`, `engines/3`, `play`
  (с мини-играми), `scene`, `player`, `packages/check/problems`. Переведено с английского исходника, русский — второй
  взгляд на смысл и тон; `{…}` и формы `tr.n` (украинские `one`, `few`, `many`, `other` — `Intl.PluralRules('uk')`)
  сохранены.
- Код и исходные тексты не менялись. `test/fixture` остаётся на en и ru (это пример для тестов, не страницы).

## Как проверено

`npm ci && npm run build` в `packages/check` (сборка копирует `i18n/` с новым языком), затем, как в CI,
`node packages/check/cli.js <папка>` для каждой папки — all right для всех шести и для `test/fixture`.
