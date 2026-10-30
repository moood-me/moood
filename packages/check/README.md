# @moood/check

A moood repository checked. A repository is a folder: every folder in it — at any depth, the root too — with
`world.json` is a world, with `game.json` a game, with `article.json` an article; a folder that is one is not searched
further, and one with two of these files is wrong. Each says the languages it is in (`"languages": ["en", "ru"]`, of
moood's: `i18n/languages.json`) and is checked in those, and only those. A game names its world (`"world"`) by a
path from its own folder (`"../usher"`), or as `owner/repo@ref:path` in another repository (only the form is checked:
nothing is fetched); it is in a language only if its world is. An article names the worlds, games and scenes it is about (`"about"`) the same way.

Every text a person reads or hears is written in the code as a literal (`tr`, `tr.n`, `tr.c`, `tr.line`, `tr.thought`;
a line someone says — `say`, `think`) or in a read JSON field (scene.json `title`, `description`, `caption`,
`captions[].text`; world.json `title`, `description`; game.json `title`, `description`, `line`,
`source`; `bespoke/people.json` `*.short`), and translated into each language it is in (English is the source). A
line's manner (`how`: a person's in people.json, a line's own in `say`, `think`, `tr.line`, `tr.thought`) is a
direction to its voice, in English, a literal — never shown, never translated; `--json`'s lines carry it as the page
asks for it (the person's, then the line's: `play/voices.js`). A game's line's `spoken` (in `say`, `think`, `tr.line`,
`tr.thought`) is what its voice says instead of it — a literal, never translated: the same words heard in every
language, the line shown in it.

    npm i -g @moood/check
    moood-check <repo> --write   # each language's file laid out anew from what the code says (translations kept)
    moood-check <repo>           # checked: "all right", or what is wrong — exits 1
    moood-check <repo> --json    # the whole report: every text; every line heard, in each language, as its voice is asked for

Where the translations lie (from the world's or the game's folder): a scene's — `scenes/<folder>/lang/<lang>.json`; a
module's — `modules/<name>.<lang>.json`; the world's — `lang/<lang>.json`; a game's — `bespoke/lang/<lang>/strings.json`
(its data by language beside it: `bespoke/lang/<lang>/<name>.json`, the same files in every language). One entry a
line: `{text, translation, where}` (`plural` — its forms in the language; `context`, `who` — what tells it apart).
Translate `translation`; nothing else changes by hand. An entry twice (a merge leaves it so) is wrong: `--write` keeps
one. An article is translated whole, by hand: `article.json` (`title`, `date`, `summary`) and `story.md`; beside them
`article.<lang>.json` (`title`, `summary`) and `story.<lang>.md`.

What it finds wrong in the code: a text that is not a literal (`tr(x)`; a bare text in a line, `say('who', a ? 'x' : 'y')`
— each written whole, or marked where it is written: `tr.line`, `tr.thought`), `tr` made a value or a tag (`T = tr`,
`f(tr)`, ``tr`…` ``), `tr`, `say`, `think` declared or set by the code, a line's voice not in literals (a scene's
`{voice, how}`; a game's line its own manner and spoken words only, `{how, spoken}` — of `say`, `think`, `tr.line`,
`tr.thought`; a kept line said with either; `who` is not heard). In a game's people (`bespoke/people.json`: `{who: {voice, how, short}}`) anything else; in a
line's translation, other inline tags than the line's (`<sigh>`, `<short pause>` — heard as written, in English). A
scene's `"engine"` other than 3 or none (engine 1) — engine 2 is gone. In a cast's styles, an old word for its hands (`fingers: true` — write `hands: 'fingers'`). In a scene's music, what a host making it with
Lyria does not take (`engines/1/music.js`: `MooodMusic.LIMITS` — `bpm` 60–200, `density` and `brightness` 0–1, one of
Lyria's scales, at most 20 descriptions that sound, 500 characters each).

It reads a repository through a source of its files (`repository.js`: `folder(root)` — a folder on disk, read as git
reads it: a symbolic link is not followed nor written through, nothing outside it is read; a host's own — the studio
reads a git tree so): `check(source, {write})`, `lines(source, report)`. What it finds wrong is data —
`{at, code, values}` —, said in words by `problems/problems.js`: `say(problem, tr)` in the language of the translator
it is given (English on the command line; a page in its own — the translations beside it, `problems/lang/`; it
imports nothing of Node's: a browser's page says them too). The hosts read a repository by the same rules
(`repository.js`): `units` (what it holds), `languagesOf` (the languages one says — a value that is not moood's makes
it in none), `reference` (how they name each other), `blobId` (a file's content's id: git's blob sha).

A folder with no world, game or article in it is a folder of moood's own pages (`engines/1`, `play`, …): its code and
pages, translated beside them (`lang/<lang>.json`) into every language moood has.

`npm run build` copies what it shares with the runtime into the package: `i18n/`, the play's `voices.js` and words,
and `engines/1/music.js`.
moood's CI publishes it to npm from a tag `check-v<version>` — the version `package.json` says (bump it there first).
