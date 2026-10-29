# The host: what the pages need

The pages here — a scene (`scene/`) and a bespoke play (`play/`) — know nothing of where worlds, games and plays come
from. Whatever serves them is their **host**: the local player, the studio, the public site. A host serves this
repository's folders as they lie (the pages load the engines, `i18n/` and each other by relative paths) and answers
the requests below. Nothing else is asked of it; the pages ask nothing else.

## Where the host is

Each page has `<meta name="moood-host" content="/api/">`: the address every request below is relative to (itself
relative to the page). A host that answers elsewhere puts its own address there. In what follows, `H` is it.

## The pages

- `scene/?world=<world>&scene=<folder>&lang=<lang>` — a scene of a world, alive: its film (`showcase`), music, lines,
  captions, widgets. No `scene` — the world's first scene (its main one).
- `play/?game=<game>&lang=<lang>` — my play of the game (begun if there is none), run by the game's own code.

A host that serves a page at an address of its own (the public site: `/<lang>/play/<slug>`) says what it shows in
`<meta name="moood-page" content="game=<game>&lang=<lang>">` — the same query, in place of the address's.

`<world>` and `<game>` are the host's names for them — the local player's (`player/`): their folders in the
repository (`classics/usher`; `.` the root); moood's studio's: `owner/repo@ref:path` (a branch's is its head now). `lang` — one of `i18n/languages.json`; none — the browser's choice (a
`lang` cookie, else its languages, else English). Every request below carries the language the page is shown in; the
host answers in it — or refuses it, if the world or the game does not say it is in that language.

## Requests

JSON in, JSON out. A refusal is any status but 2xx, with `{"code": "…", "values": {…}, "detail": "…"}` (Refusals,
below): what it means is the page's to say, in its own words, in its language; `detail` is for developers (the page
logs it, never shows it).

| Request | Answer |
|---|---|
| `GET H world?world=&lang=` | `{title, scenes: [{folder, title}]}` — the main scene first |
| `GET H scene?world=&scene=&lang=` | `{spec, title, strings, modules, files}` (below); the play page's scenes with `&play=` — the play they are shown in |
| `GET H <files><sha>` | a file of the world by its content (a module's code, data, translation) — the same for good |
| `POST H play` `{game}` | `{id}` — my play of the game, begun now if there is none |
| `GET H play?play=&lang=` | `{id, game: {id, title, mine}, world, code, people, save, back?}` (below) |
| `PUT H play?play=` *save* | 204 — what the game keeps of the play (a JSON object, ≤ 1 MB) in place of what it kept |
| `POST H restart?play=` | `{id}` — the play gone, a new one begun (it is "my play" of the game from now on) |
| `POST H continue?play=` | 204 — the play, what the game kept with it, moved to the commits its game and world are at now (a host whose plays are pinned to commits: below) |
| `GET H <code><path>` | a file of the game's `bespoke/` folder, as it is (`game.js` and what it imports, its `lang/`, pictures, sounds) |
| `POST H speak` `{text, voice, how}` | `{url}` — a line's voice (relative to the request), ready-made or made once by its key: these fields (below) |
| `POST H music` `{music: {prompts, config}}` | `{key}` — a scene's music, by its description (`MooodMusic.asked(spec.music)`, `engines/1/music.js`: what a host that makes it ahead makes); its recording begun, if it is neither recorded nor being made (below) |
| `GET H music?key=` | its recording, as a stream of frames (`engines/1/music.js`: Opus seconds, events) — only listened to: whole, or as it is made; none being made, the stream ends (below) |
| `GET H changes?world=` or `?game=` | an event stream (`text/event-stream`): a message each time a file of the world (the game's or its world's) is saved; the page is shown anew (a play goes on from what the game kept). Of a game, a host whose plays are pinned to commits tells instead an event `newer` each time my play of it could continue on newer commits (at once, if it could already): the page offers to (`continue`). A host that does not tell answers 204 |

- **A scene** — `spec`: put together from its folder (below), as written (not translated); `title` — in the language;
  `strings` — its translation into the language (the entries of its `lang/<lang>.json`; `[]` for English);
  `modules` — the world's modules the spec lists, each by the content's id of its files: `{name: {code, data, strings}}`
  (`data`: `modules/<name>.data.json` or null; `strings`: `modules/<name>.<lang>.json` or null); `files` — the address
  (relative to `H`) that, followed by such an id, gives the file. Ids name contents (git's blob sha does): the pages
  fetch each once.
- **A play** — `game.mine`: the player is its author (the author's tools of the mini-games); `world`: the world the
  play is on, as the host names it (a game names it in its `game.json`: a path from its folder, or `repo@ref:path`;
  a host that keeps plays keeps the world's commit too); `code`: the address (relative to `H`, ending in `/`) of the
  game's `bespoke/` folder; `people`: the game's people — its `bespoke/people.json` as it is, `{}` if it has none
  (`player/folder.js` `peopleOf`); `save`: what the game kept (`{}` at first); `back` — the host's own page of the game
  (an address relative to `H`; none — none): the bar's first, "← its title".
- **A line's voice** — `text`: what is said, as written — inline tags in it (`<sigh>`, `<short pause>`, in English) are
  how it is said there, heard and never shown; `voice`: the voice's name (who it is: its timbre, age, accent); `how`: the
  manner ("quietly, with a smile"; English; may be empty) — a game's line: its person's lasting manner, then the line's
  own, then a thought's whisper, joined by `; ` (`play/voices.js`), so a line in its own manner is another voice. Nothing else: a host that makes voices gives its
  model the line as the transcript and the manner apart from it (a model of speech reads aloud whatever is in the
  transcript).
- **A scene's music** — only `POST music` begins a recording (a host that counts it counts it there); `GET music` only
  listens: a recording whole is heard round and round, one being made as it is made. A stream that ends (an event
  `ended`, or the stream closed) ended before the recording was whole — its making failed or was lost: the page asks
  `POST music` again (a few times, while nothing more is heard). What a host making it with Lyria RealTime takes
  (`MooodMusic.LIMITS`; more — refused, `request`; `check` says it of a scene's spec): `bpm` 60–200 (a whole number:
  the page rounds it), `density` and `brightness` 0–1, `scale` one of Lyria's (`C_MAJOR_A_MINOR` …), at most 20
  descriptions that sound (weight over 0), each at most 500 characters.
- **What is opened** — a host that counts what people open (a quota) counts a scene's page as the scene it asks for
  without `play`, and a play's page as `GET play`; the scenes a play shows are the play's.
- **Pinned plays** — a host that reads games from git (the studio) keeps a play on the commits it began on: its game's
  and its world's; the game's branch moves on, the play does not. When the branch (or the world's, if it names one)
  is at another commit, `changes?game=` tells `newer` (its data — anything; the page reads none of it), and the page
  offers, beside ↺, to continue on the new commits — warning that what the game kept may not fit the new code (if it
  breaks, ↺); `continue` moves the play there, and there is no going back. A host whose plays are its files as they
  are now (the local player) never tells `newer` and has no `continue`.

## Refusals

| `code` | `values` | the page says |
|---|---|---|
| `not-found` | `name` | there is no such world, scene, game, play or file |
| `language` | `lang` | it is not in that language (it does not say it is) |
| `untranslated` | `file`, `text` | a text has no translation in that file |
| `content` | `file` | a file is not as it must be (`check` says what) |
| `elsewhere` | `ref` | another repository's (`repo@ref:path`): not this host's |
| `no-voices` | — | this host makes no voices: the page asks no more, says so once, the lines go on unheard |
| `no-music` | — | this host makes no music: the scenes go silent |
| `unmade` | — | this voice or this music is not made yet, and this host does not make it (it only takes what is made: The workshop, below): the line goes unheard, the scene silent; the next is asked for |
| `quota` | `count`, `window`, `again` | the person has done what their quota lets them for now (`count` in `window` seconds): again in `again` seconds (null — their quota is none) |
| `busy` | `again` | what makes it (a voice: `speak`) is busy for now: again in `again` seconds (null — later) |
| `streams` | `most` | the person has `most` streams open (`changes`, `music`): one more is refused till one is closed |
| `request` | — | the request is wrong (a page's mistake) |
| `failed` | — | the host itself failed |

A code the page does not know (a host's own) is named as it is. `values` are names, paths and texts as written —
nothing in them is a host's words.

## The workshop

Voices and music — and pictures, renders, measurings, motions — are made by moood's **workshop**: moood's studio,
`studio.moood.me` (closed). It keeps each thing by its **key**, a hash (SHA-256) of what made it — a line's model,
voice, manner and text; a track's model, descriptions and settings; a scene's spec, words and modules' contents; a
motion's ask —, and the same thing is made once. A host that makes none itself (the local player)
takes them from a workshop: here is what it asks it (`W` — the studio's address).

| Request | Answer |
|---|---|
| `POST W/workshop/speech.key` `{args: {text, voice, how}}` | `{key, kept}` — the line's key (as `speak` takes it, above), and whether it is voiced |
| `POST W/workshop/speech.speak` `{args: {text, voice, how}}`, a person's token | `{key}` — voiced now if it was not, under that person's quota there (it may wait seconds) |
| `GET W/workshop/speech/<key>` | the voice: Opus in WebM (`audio/webm`; ranges) |
| `POST W/workshop/music.key` `{args: {music: {prompts, config}}}` | `{key, whole, making}` — the track's key, whether it is recorded whole, or being recorded |
| `POST W/workshop/music.track` `{args: {music}}`, a person's token | `{key}` — its recording begun if it is neither, under that person's quota there |
| `GET W/workshop/music/<key>` | its recording as `GET H music` streams it (above) |
| `GET W/workshop/recording/<key>` | a whole recording as an Ogg Opus file |
| `GET W/workshop/picture/<key>` (`?small`), `file/<kind>:<key>`, `motion/<key>/<body\|person\|clip>` | a scene's picture, a render's file (an hour after it is made), what was made of a motion |

- **A person's token** — `Authorization: Bearer <token>`: made on their profile in that studio (Agents → Tokens).
  Without it nothing is made — what is not made yet is only not there. With it, what is made is the person's action
  there: their roles and quotas (refused `quota`, `busy`, `no-voices`, `no-music`, `request` — as above). A token it
  does not take: 401.
- **By key, by anyone** — what a key names is read by whoever has the key, no token. A key is a hash of what made the
  thing: it is guessed only by one who has that (the line, the music, the scene), and it gives away nothing but the thing
  itself — what the pages that asked for it play anyway.
- **The local player** (`player/README.md`): `MOOOD_WORKSHOP=<W>` — the voices and music its pages ask for are taken
  ready from that workshop by their key (`speech.key`, `music.key`: not made — refused `unmade`); with `MOOOD_TOKEN=<a
  person's token there>` too, what is not made yet is made under that person's quota (`speech.speak`, `music.track`);
  without them — refused `no-voices`, `no-music`. What it takes it passes on to its pages as `speak` and `music` (above).

## A scene from its folder

Every host puts it together with one assembly, `player/folder.js`, reading the repository through a source of its
files (`packages/check/repository.js`: `list`, `read` — and `id`, a file's content's id): the local player's is a
folder on disk, the studio's a git tree at a commit.

`<world>/scenes/<folder>/`: `scene.json` is the spec without what lies in files of its own: `script.js`, `lib.js`,
`relief.js`, `notes.md` → `script`, `lib`, `relief`, `notes`; for each of `objects` (by its `id`) `elements/<id>.js` →
`code`, `<id>.script.js` → `script`; for each of `widgets`, `widgets/<id>.html` → `html`; and, in a scene of engine 3,
`showcase.js` → `showcase`, `elements/<id>.animate.js` → `animate`, `elements/<id>.wgsl` → `shader`. A file nothing
names is an error; `lang/<lang>.json` is the scene's translation, not the spec's; a file or folder whose name begins
with a dot (an editor's, the system's) is not the scene's. A spec with `"engine": 3` runs on engine 3, one with none on
engine 1; another engine is refused.

## Renders

`engines/1/render.html` (a picture: the scene at its start, or its film's moments), `engines/1/stand.html` (a
scene measured on the real clock) and `engines/1/motion.html` (a motion on its body) are opened by a renderer, not
asked for anything: what they show is handed in as `window.__mooodSpec`, `__mooodModules` (`{name: {code, data,
strings}}`), `__mooodWords` (`{lang, strings}`), `__mooodDevice` (an engine-3 scene's tier), `__mooodMotion`,
`__mooodMotionShow`; what goes wrong is in `window.__mooodErrors` and `__mooodWarnings`. A scene's pages say when
everything the scene loads by itself has loaded — the scene built with what it fetches (its people's engine, their
bodies), the fonts, its widgets' pictures: `window.__mooodLoaded`, a promise of `true` (`false`: the scene could not be
shown — why, in `__mooodErrors`); a renderer waits for it before it moves the clock. Each page's head says the rest.

## In the page

- **What people do** — a host that counts it puts `globalThis.MooodSeen` on the page before the pages' scripts run:
  `say(kind, data)` (`play.begin`, `play.scene`, `play.step`, `play.choice`, `minigame.end`… — as the pages say them),
  `context(o)`, `described(o)`, and `watch(camera)` → `{shown(engine, title), ready(stage, which), frames(m),
  hidden()}` for each stage. Without it nothing is counted.
- **Its scripts** — every script of the scene and play pages is a file (none inline): a host's Content-Security-Policy may be
  `script-src 'self' 'unsafe-eval'` (a scene's code is made into functions: `MooodI18n.bind`).
- **In a frame** — a scene page in another page's frame tells it what the scene waits for: `{moood: 'waits', text,
  cannot?}` (`postMessage`, to the same origin).
