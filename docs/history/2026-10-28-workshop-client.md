# 2026-10-28 — клиент мастерской: локальный плеер берёт голоса и музыку по ключу (studio-4c)

Ветка `studio-4c`. Что нужно было студии на её этапе 4c (её docs/history/2026-10-28-stage-4c.md: одна мастерская на все
деплойменты). По договорённостям (в закрытом rpg, «Открытый репо»): в открытом репо — только клиент, как
рантайм берёт у мастерской готовое по ключу.

## Что и как

- **docs/host.md, «The workshop»** — контракт мастерской студии (закрытой), как её зовёт хост, который сам ничего не
  делает: `POST W/workshop/speech.key {args: {text, voice, how}}` → `{key, kept}`, `music.key {args: {music}}` →
  `{key, whole, making}` — ключ и готово ли, ничего не делая; с токеном человека (`Authorization: Bearer`, сделан в его
  профиле там) — `speech.speak`, `music.track`: сделать, чего нет, по его квоте там; `GET W/workshop/speech/<key>`,
  `music/<key>` (поток, как `GET H music`), `recording/<key>`, `picture/<key>`, `file/<kind>:<key>`,
  `motion/<key>/<data>` — готовое по ключу, кому угодно, у кого ключ (ключ — хэш того, из чего сделано: его угадает
  только тот, у кого это есть, и он не открывает ничего, кроме самой вещи).
- **Отказ `unmade`** — в таблице отказов: этого голоса или музыки ещё нет, а этот хост их не делает. Страница
  (`scene/host.js`) говорит его своими словами («Это ещё не сделано, а здесь не делается.», перевод рядом), реплика
  идёт без голоса, сцена без музыки; следующую просит как обычно (это не `no-voices`, который глушит всё).
- **player/workshop.js** — клиент: `speak(asked)` → ключ (`speech.key`; с токеном — `speech.speak`), `track(music)` →
  ключ (`music.key`: записана целиком или пишется; с токеном — `music.track`), `read(path)` — готовое по ключу.
  Токен, который мастерская не берёт (401), — `failed` с объяснением для разработчика (в консоли страницы).
- **player/server.js** — `MOOOD_WORKSHOP` (адрес студии), `MOOOD_TOKEN` (токен человека там; без `MOOOD_WORKSHOP` —
  ошибка на старте). `POST speak` → `{url: speech/<key>}`, `GET speech/<key>` и `GET music?key=` — отданы страницам
  из мастерской (с диапазоном, поток отпускается, когда страница ушла); `POST music` → `{key}`. Без
  `MOOOD_WORKSHOP` — как было: `no-voices`, `no-music`.
- **player/README.md, Dockerfile, README** — переменные и `docker run … -e MOOOD_WORKSHOP=… -e MOOOD_TOKEN=…`.

## Как проверено

- `node --test test/*.test.js`: новый `test/workshop.test.js` — мастерская подменена HTTP-сервером по контракту
  docs/host.md: без `MOOOD_WORKSHOP` — `no-voices`, `no-music`; с ним — готовая реплика отдана (`audio/wav`), её
  ключ; несделанная — `unmade`; музыка — ключ и поток; ничего не просили сделать; с `MOOOD_TOKEN` — `speech.speak`
  с токеном, голос по ключу с ним же; чужой токен — `failed`.
- `check` по `engines/1 engines/3 scene play player packages/check/problems test/fixture` (en → ru).
- В студии (её e2e 4c, docker compose): плеер этого образа с `MOOOD_WORKSHOP` на «прод»-студию отдаёт голос,
  сделанный там по просьбе «dev».
