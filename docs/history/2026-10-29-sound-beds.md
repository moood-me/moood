# A game's background is declared and changes with the scene's music; all sound waits in one place (2026-10-29)

**Why.** Pavel heard a game's sounds fade in, out and in again at a scene change. The games switched their beds (sea,
wind, clock) themselves around `bespoke.show` — set before the show, so they changed while the old picture was still
on; and the earlier change of the day (`2026-10-29-sounds-like-music.md`) held all the game's sounds while a scene was
being made ready (`opening` in `play/runtime.js`), cutting them out between scenes and fading them back after. Agreed
with Pavel: sounds belong to the game (its `sound.js`, the language of mini-games), music to the scene (`scene.json`
`music`, begun by the page at the cut). A game's background is *declared* by the game — «from now on my background is
…», data: its beds and levels — and the page applies it where the picture changes, at the moment and over the seconds
of the music's crossfade, one fade out and one fade in together; with no scene change under way, at once. No rule «no
music → no sounds». One-off sounds (hooves, a bell, a waltz in the world, a mini-game's) the game starts when it wants,
as lines. The pause, the phone upright, the page hidden, an engine 3 scene standing: the music and all sounds fade out
and come back together — one place, one fade (the music's hush).

**What.** `bespoke.show(scene, {background})`, `bespoke.background(levels)`, `bespoke.onBackground(fn)` —
`fn(levels, seconds)`: the game's code takes each named bed to its level, every other to silence, over `seconds`
(music.js `FADE`, 4 s; `IN`, 0.3 s, where no background sounded — the play's start, as a music comes in where none
did). A show's background waits for its cut (runtime `take()`, beside `MooodMusic.show`); a show that ends without one
(failed) sounds it then; a later show's declaration waits for the later cut; the same background declared again
changes nothing. The holding of sounds while a scene is made ready is gone (`opening`, the show wrapper, runtime's
own `standing` and `sounds()`): `MooodMusic.pause` — told by the stage's `Moood.onPause` (engine 3: the play paused,
the page hidden, out of sight, covered) and by the runtime's pause on engine 1 — holds `MooodVolume` with it, over its
`HUSH`. Kept: the page owns the AudioContext through `MooodVolume.output`, games do not suspend or resume it,
`feel.js` does not pause itself.

**How.** `play/background.js` (`createBackground`: declare, awaits(show, levels), cut(show), on); `play/runtime.js`
(show numbers itself and tells the background; take() cuts it; the header says the API); `engines/1/music.js`
(`pause` → `MooodVolume.hold(held, HUSH)`; `FADE`, `IN` exported); `engines/1/volume.js` (`hold(on, seconds)` — the
music's seconds, no fade of its own). Docs: `docs/games/README.md`, `games.md` §7. Tests: `test/background.test.js`,
`test/music-pause.test.js` (music.js and volume.js together: the game's output fades with the music),
`test/sounds-hold.test.js`. The games of moood-me/works-003 (Usher), works-005, works-006 declare their beds so
(branch `sound-beds`).
