English · [Русский](README.ru.md) · [Українська](README.uk.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [日本語](README.ja.md) · [Беларуская](README.be.md) · [Français](README.fr.md) · [繁體中文](README.zh-hant.md) · [Português (Brasil)](README.pt.md) · [Polski](README.pl.md) · [한국어](README.ko.md)

# moood

[moood](https://moood.me) is living, animated worlds and the games played on them. A **world** is a set of scenes —
places with their mood, painted in code, lit and moving; a **game** is a story played on a world, written by its
author as code of its own (a *bespoke* game): chapters, choices, voiced lines, mini-games.

This repository is the open part of moood: the engines that run scenes, the runtime that plays a game, the language
of mini-games, `check` for texts and translations, a local player — and the docs for those who make worlds and
games. Write your own; we'd be glad to see them on moood.

## Making worlds and games

Your worlds and games live in your own git repository — any number of them, in any folders: a folder with
`world.json` is a world, with `game.json` a game, with `article.json` an article (for moood's site: the local player
shows worlds and games). Work the way you like:

- **On your computer** — run the local player over your repository and play what you make as you save it
  ([player/README.md](player/README.md)).
- **In the studio** — `studio.moood.me` (being built): your profile, your repositories, renders, voices, music and
  motions made for you. Access: ask [pavel-zhur](https://github.com/pavel-zhur) — completely.real@gmail.com.
- **With an AI agent** — Claude Code, ChatGPT, Gemini or any other, on your machine or in a cloud session: point it
  at [docs/](docs/README.md) — it is written for agents as much as for people.

To have a game published on moood.me, ask in the studio; it is reviewed before it is shown.

## Changes to moood

Ask through GitHub issues in this repository (`AGENTS.md`).

## Docs

[docs/README.md](docs/README.md) — where to start: principles, the scene's language, people and motion, how a game
is built, mini-games, how to write a game's story. Most of it is in Russian for now; English is coming.

## Layout

- `engines/1/` — engine 1 (paintings in Canvas 2D, drawn by three.js on WebGL2) and the stage every page shows a scene on (`stage.js`: either engine
  behind one API; speech, music, captions, widgets, volume); its pages for renderers (`render.html`, `stand.html`,
  `motion.html`); the people's data both engines read.
- `engines/3/` — engine 3 (WebGPU): a scene with `"engine": 3` — every new scene.
- `scene/` — the scene's page; `host.js` — the pages' side of the host.
- `play/` — the bespoke play's page, its runtime (`runtime.js`: what a game's code is given) and the language of
  mini-games (`minigame/`).
- `i18n/` — the languages (`languages.json`), the translator every text goes through (`i18n.js`), the pages' words.
- `packages/check/` — `@moood/check`: a repository of worlds, games and articles checked.
- `player/` — the local player: a folder's worlds and games, shown and played by the pages (`Dockerfile` — its image).
- `test/` — the tests (`node --test test/*.test.js`, once `packages/check` is built: `npm ci && npm run build` there)
  and their fixture; `test/gpu/` — engine 3's GPU programs checked in node (`npm ci && node check.mjs` there);
  `.github/workflows/ci.yml` — check, the tests and the GPU check on every push and pull request; from `main` the player's image, `ghcr.io/moood-me/moood-player`; from a tag
  `check-v<version>` `@moood/check` on npm (npm's trusted publishing: the package trusts this repository's `ci.yml`; no token).
- `docs/host.md` — what the pages ask of whatever serves them; `docs/engine3/` — engine 3's own documents (its design,
  contracts, plan: for whoever changes it); `docs/history/` — what was done and how.

The studio, the public site and what makes voices, music, pictures and motions (the workshop) are not here; the pages
ask their host for those, and a host that makes none — the local player — takes them ready from a studio's workshop by
key (`docs/host.md`: The workshop).

## License

MIT (`LICENSE`). Third parties' work inside keeps its own: three.js (MIT, its notice at the head of
`engines/1/three.js`), the bodies and clothes (`engines/1/bodies/bodies.md`), SOMA (`engines/1/soma.md`) — the
Apache-2.0 parts of them in `engines/1/NOTICE`, the licence beside it (`engines/1/LICENSE-Apache-2.0.txt`) —, the
mini-games' sounds (`play/minigame/sounds/LICENSE.md`).
