# A game's own sounds wait with the play as its music does (2026-10-29)

**Why.** Pavel: «пауза ставит на паузу музыку с фейдом, а звуки без фейда. и еще, пока сцена только открывается … звуки
начинаются еще пока она готовится, а музыка начинается только когда сцена готова. сделай звуки как музыку.» The music
fades out over 0.8 s on the play's pause and waits while an engine 3 scene stands (`2026-10-29-music-pause.md`); a new
scene's music begins once the scene is shown (`play/runtime.js` show: `MooodMusic.show` as it is taken). The games'
own sounds (their `bespoke/sound.js`) each suspended their AudioContext at once on `bespoke.onPause`, and sounded
whenever the game asked — a game sets its scene's beds before `b.show`, so they were heard while the scene was being
made ready (the play's start, between scenes).

**What.** Done once in moood, for every game: the "sounds" output (`MooodVolume.output(ctx)`) runs its context. Held,
every output fades to 0 over 0.8 s, then its context is suspended (what the game asks meanwhile waits on the stopped
audio clock and begins as the play goes on); going on, the context resumes and the output fades back in to the
volume set — the music's way (`engines/1/music.js` hush), a change meanwhile taking the fade over from where it is.
The output also resumes its context as soon as the browser lets sound begin (at once, and again at any touch or key
of the page) — a game no longer wakes it itself. The play (`play/runtime.js`) holds the sounds while the play is
paused, while its stage stands (`stage.onPause`: an engine 3 scene nobody watches, a layer over it, a picture held
under the sign — what the music waits for) and while a show is under way (`bespoke.show`, from its call till the
scene is shown). The language of mini-games (`play/minigame/feel.js`), on the same output, no longer suspends its
context itself on the pause or the page hidden (that cut its sound at once): it waits with the rest; `feel.wake()`
resumes it at a touch only while the sounds are not held (`MooodVolume.held`).

**How.** `engines/1/volume.js`: `output(ctx)` keeps its outputs; `hold(on)`, `held`; the suspend after the fade by
the browser's own timer (`__mooodTimers` — a play's clock stands while it is paused). `play/runtime.js`: `sounds()`
= `MooodVolume.hold(paused || standing || opening > 0)`; `show` counts `opening` around the old show (now `open`);
going on over an engine 1 scene ends a standing left over from an engine 3 scene, as the music's does.
`docs/games/README.md` says it to games: the context is the page's to run, no pause of their own for the sounds.
The games in moood-me/works-003, works-005, works-006 (branch `sounds-like-music`) dropped their `pause`, `wake` and
`ctx.suspend/resume`. Tests: `test/sounds-hold.test.js` (volume.js in a vm with stand-in contexts).
