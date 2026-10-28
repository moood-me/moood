# 2026-10-28 — тексты карточки через сборку

Ветка `studio-4` (для этапа 4 студии: каталог опубликованного — карточка игры или мира говорит его собственные тексты,
из `game.json`/`world.json` и их переводов, не из базы). Сборка (`player/folder.js`) отдавала только название.

## Что и как

- `worldText(source, w, field, lang)`, `gameText(source, g, field, lang)` — поле `world.json` / `game.json`, которое
  читается (`i18n.js` `FIELDS`: у мира `title`, `description`; у игры `title`, `description`, `line`, `source`), на
  языке — тем же переводом, что и название (нет перевода — отказ `untranslated`, не английский); пустое — `''`.
  `worldTitle`, `gameTitle` — через них.

## Как проверено

Студия (`moood-me/studio`, этап 4): карточки каталога на en и ru из опубликованных коммитов.
