# Games

A game played on worlds is a folder with `game.json` in a git repository — the author's on GitHub with moood's App, or
one moood made for them (`u-…`) — beside its world or in another repository: `game.json` (its title, description,
languages, the world it is played on — a path in the repository, or another's `repo@ref:path`) and `bespoke/`, the
game's own code — `game.js` and what it imports (what is not the game — scripts the author runs, its own checks — lies
beside `bespoke/`, not in it: all of `bespoke/` is served and checked). Its address is `owner/name@ref:path`, as a
world's. A play keeps the commits it began on — the game's and its world's — and is
offered to continue on newer ones.

Work on it as on a world (worlds/README.md): clone the repository, a branch of your own, push; the studio plays any
branch at its address. Through moood's MCP: `list_games`, `read_game` (game.json, its world, its files), `read_files`,
`voice_line` and `list_lines` (its people's lines voiced), `check`, `ask_to_publish`.

How a bespoke game is built — chapters and steps, the map of the play (a scene of its world), what it keeps,
replays, the page's ⏭ and ☰, the author's mark: `games.md`. Its mini-games (on engine-3 scenes) are made in the
language of mini-games — how, and how to choose a mechanic that is the character's action and the player's feeling:
`minigames.md`.

A game's own sounds (Web Audio in `bespoke/`) obey the listener's third slider, "sounds" (beside music and voices;
`engines/1/volume.js`): the game puts `MooodVolume.output(ctx)` — a gain of its `AudioContext` that follows the
slider — between its sounds and `ctx.destination`, and never reads the slider itself. Sounds are the game's; music
is the scene's (its `scene.json` `music`, begun by the page at the scene's cut).

- **The background** — what lasts under a scene (the sea, the wind, a clock) — the game *declares*, never switches:
  `bespoke.show(scene, {background: {sea: 0.4, clock: 0.15}})` — its beds and their levels from that scene on (every
  other bed of its silent, `{}` none), or `bespoke.background(levels)` — from now on. The page sounds it where the
  picture changes: at the show's cut, at the moment the scene's music crossfades and over the same seconds — one fade
  out, one fade in, together; at the play's start it comes in as the music does. Declared with no show under way (a
  change within a scene), it changes at once, over the same crossfade. A scene without music still has the declared
  background. The game's code makes the sounds: `bespoke.onBackground(fn)` — `fn(levels, seconds)` takes each bed it
  names to its level and every other to silence over `seconds`; the game never times its background itself.
- **One-off sounds** — hooves, a bell, a waltz played in the world, a mini-game's — the game starts when it likes, as
  it says its lines.
- **All of them wait with the music**: the play paused, the phone turned upright, the page hidden, the scene standing
  (nobody watching it) — the music and every sound fade out together in the music's fade and their audio's clock
  stands; going on, they fade back in together (`engines/1/music.js` pause holds `MooodVolume` — one place). The
  context is the page's to run: it sounds as soon as the browser lets sound begin (at the first touch); the game never
  suspends or resumes it and needs no pause of its own for its sounds.

Lines of speech go through `MooodSpeech` and obey "voices". The play's pause, ⏭ and menu are the page's, the same for every game: a game draws no ⏸, ⏭ or ☰ of its own
— it stops what else is its own on `bespoke.onPause(fn)`, gives `bespoke.forward(fn)`
what ⏭ does where the player may forward (the page speeds a line heard up first; `null` — no ⏭), and
`bespoke.menu(open)` what ☰ opens — the map of the play, for every player (`games.md`). `bespoke/` may hold files other than code — a recording (MP3), a picture — served as
they are beside it: the code fetches them by its own address, `new URL('sounds/sea.mp3', import.meta.url)`. Only what
is free to put in a public repository (CC0, or the author's own), and a few hundred KB each: every file is loaded by
whoever plays.

Everything a game (or a scene) loads is its own: nothing from another address — no fonts from Google Fonts, no scripts,
styles or pictures from a CDN. The pages allow only their own address (and `data:`; their Content-Security-Policy), so
anything else is blocked — and a stylesheet whose `@import` is blocked fails, which stops the game («no stylesheet
ui.css»). A font goes in `bespoke/` with the game — its `woff2` files, or as `data:` in `@font-face` (`fonts.css` of
the games in moood-me/works-003, works-005 do so) —, under a free licence (SIL OFL), with the subsets of every
language the game speaks (Latin with its extended letters, Cyrillic …; a language whose letters the font lacks falls
back to another font).
