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
slider — between its sounds and `ctx.destination`, and never reads the slider itself. Its context is then the page's
to run, and the sounds wait with the play as the scene's music does: while the play is paused, while its scene stands
(nobody watching it) and while a scene is being made ready (from `bespoke.show` till it is shown — the play's start,
between scenes) they fade out and their audio's clock stands — what the game asks meanwhile begins as the play goes on,
fading back in; it sounds as soon as the browser lets sound begin (at the first touch). So the game never suspends or
resumes its context, and needs no pause of its own for them. Lines of speech go through `MooodSpeech` and obey
"voices". The play's pause, ⏭ and menu are the page's, the same for every game: a game draws no ⏸, ⏭ or ☰ of its own
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
