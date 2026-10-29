# 2026-10-29 — голос из мастерской — Opus в WebM

Павел: «надо чтобы студия не wav а opus хранила. и сайту легче, и стиму и андроиду легче, и базе легче…».

Студия (`moood-me/studio`, её `docs/history/2026-10-29-speech-opus.md`) теперь хранит и отдаёт реплики как Opus в WebM
(`audio/webm`), не WAV; ключ реплики тот же. Здесь поменялась только строка контракта в `docs/host.md`
(`GET W/workshop/speech/<key>`). Код moood не менялся: движок играет голос через `<audio>` (`engines/1/speech.js`),
локальный плеер передаёт тип мастерской как есть (`player/server.js` `passed`). WebM, не Ogg: Safari играет WebM Opus
с 17.4, Ogg Opus — только с 18.4 и с неверной длительностью (WebKit bug 293310).
