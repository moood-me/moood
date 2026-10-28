# 2026-10-28 — правки по ревью открытого репо (review-fixes)

Ветка `review-fixes`. Ревью `main` 42e8218 перед тем, как репо станет открытым: что исправлено и как.

## Что и как

- **`"scenes"` игры ушёл** (сцены других миров — из старого типа asked; ни одна страница их не играла): из check
  (`scopes.js`; `sceneAt` и проблемы `scenes-not-list`, `scene-not-there`, `ref-not-scene` — с переводом), доков
  (`docs/games/README.md`, README check, плеера). Рантайм знает сцену только по папке: `bespoke.scenes` —
  `[{folder, title}]`, `show`/`specOf` — по папке, сцена в событиях (`tell`, `line`…) — её папка. Студии: её
  `checks.js`, `publications.js` ещё читают `json.scenes`.
- **Движок 2 check отказывает словами**: `"engine": 2` — `engine-gone` («движка 2 больше нет: сцена пишется заново для
  движка 3»), другое не 1 и не 3 — `engine`; тест.
- **Люди игры — в ответе `GET play`** (`people`: `bespoke/people.json` как есть, `{}` — нет; `player/folder.js`
  `peopleOf`): страница партии не просит `people.json` и не пишет 404 у игры без людей. docs/host.md; студии — отвечать
  так же.
- **Потеря видеокарты** словами страницы (`engines/3/page.js`: «графическое устройство потеряно», перевод в
  `engines/3/lang`), подробность — в консоль. Кнопка `copy` панели кадров (P) — через `tr` (engines/1/lang).
- **Плеер**: отказы всегда с `values`; токен человека — только на `speech.speak`/`music.track`, чтение по ключу без
  него (тест); комментарии.
- **Мёртвое**: `look: v.key`, `voiceless` рантайма, неиспользуемые переменные и импорты (ESLint `no-unused-vars`).
  `play.continue` при открытии с сохранением — теперь `play.resume` (`play.continue` — только переход на новые коммиты).
- **Проверка GPU-программ движка 3 — в CI**: `test/gpu/check.mjs` (раннер из rpg: npm `webgpu` 0.6.2, Dawn без GPU;
  сцены собирает `player/folder.js` `sceneOf`), шаг `ci.yml`. У `packages/check` — `package-lock.json`, CI — `npm ci`.
- **Лицензии**: `engines/1/LICENSE-Apache-2.0.txt` и `engines/1/NOTICE` (SOMA — Kimodo, Anny, SOMA-X; своих NOTICE у них
  нет), уведомление MIT three.js — в начале `engines/1/three.js`; README.
- **Доки**: что видит чужой — без личного о владельце (`docs/writing/*`: ревью — владельца игры, тому, для кого
  работают), без ноутбука владельца и путей его машины, без адресов закрытых репо (примеры — словами); `docs/engine3/`
  — пути rpg на здешние (`engines/3/…`, `test/gpu`) или словами («сервис рендера студии», «MCP студии», «движок 2
  (его больше нет)»: скрипт по префиксам, потом вручную), Pavel → the owner; `render_scene` без `set`, `views`; без
  Biome; начало `scene-format-*.md` — автору сцены, не промпт художника; уроки — строка «история: инструменты и API
  тогдашние», «MCP dev», «стек», «прод», `scene_history` убраны; `docs/host.md` — без прод/dev; README — сборка check
  перед тестами, плеер статей не показывает.

## Как проверено

`check` на `engines/1`, `engines/3`, `scene`, `play`, `player`, `packages/check/problems`, `test/fixture` — all right.
Тесты (10): `engine-gone`, `people` в `GET play`, токен не идёт на чтение по ключу. `test/gpu/check.mjs` — без ошибок
(и со сценами «Вокруг света» с своими шейдерами; сломанный WGSL — найден). Chromium (Playwright): страница плеера,
сцена движка 1 и партия фикстуры на en и ru — без ошибок и 404 в консоли; панель P на ru — «копировать».
