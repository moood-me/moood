# For agents

Writing worlds and games: [docs/README.md](docs/README.md) — start there.

- **Changes to this repository** — the engines, the scene and play pages, mini-games, `check`, the player, these docs —
  are asked for through GitHub issues here (what, where, how to reproduce, why the engine and not a scene). An agent
  writing a world or a game does not patch the engine around a problem: it reports it.
- **No workarounds**: if something doesn't work, fix it the right way or say what's missing; no fallbacks, no special
  cases for one scene, no dead code.
- **Everything multilingual**: English is the source, translations beside it (`lang/`); a text a person reads is a
  literal through `tr`/`tr.n`/`tr.c`/`say`/`think`/`tr.line`/`tr.thought` or a read field of JSON; `check` finds and
  checks them. A missing translation is an error, never English in its place.
- **History**: a change here gets a short note in `docs/history/` (what was done, why — what called for it, what was
  decided and by whom —, and how, so another agent can repeat it). A note about a world or a game goes into that world's or game's repository, not here.
