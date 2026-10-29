# The play's pause holds the scene's music, fading it out and back in (2026-10-29)

**Why.** Pavel: «пауза игры не останавливает музыку сцены… пусть будет fade out fade in». On moood.me (The Chrysalids,
The Fall of the House of Usher — engine 3 scenes) the ⏸ left the music's AudioContext running.

**Root cause.** For an engine 3 scene the play's pause leaves the voices and the music to the stage's `onPause`
(`play/runtime.js` `pause`); the music subscribed through the page-wide `Moood.onPause` with
`globalThis.Moood?.onPause(stands)` (`engines/1/music.js` `init`). But `Moood` is a `const` of a classic script
(`engines/1/stage.js`): a binding of the page's scripts, never a property of `globalThis` — so the music never
subscribed, and nothing held it: not the ⏸, not the phone turned upright (`play/landscape.js`), not the page hidden
or the scene out of sight. Engine 1 scenes were paused (the runtime calls `MooodMusic.pause` itself), at once.

**What.** The music subscribes to `Moood` itself (`typeof Moood !== 'undefined'` — a host's page without a stage has
none). Held — the play paused, an engine 3 scene standing — the music's output fades to 0 over `HUSH` (0.8 s), then
its AudioContext is suspended; going on, the context resumes and the output fades back in to the volume set
(`MooodVolume.get('music')`). One state (`held`) for both reasons, as before (going on ends an engine 3 scene's
standing too).

**How.** `engines/1/music.js` `hush()`: the output gain's fade taken over from where it is (its value read, the
schedule cancelled, a linear ramp to 0 or to the volume); the suspend after the fade by the browser's own timer
(`__mooodTimers` — a play's clock stands while the play is paused, `engines/1/clock.js`), cancelled if the play goes
on meanwhile — the sound never stands then. The volume slider moves the output only while the music is not held.
A pause as the music begins: `start()` suspends instead of resuming and leaves the output at 0. Speech
(`engines/1/speech.js`) subscribes to its stage directly (`stage.onPause`) and was not affected; a game's own sounds
are the game's (`bespoke.onPause`). Tests: `test/music-pause.test.js` (music.js in a vm with a stand-in
AudioContext and stage). Checked on the local player (works-003, an engine 3 Chrysalids scene): ⏸ — the output at
0.24 after 0.3 s, the context suspended at 0.8 s; ▶ — running, the output back at 0.4 after a second.
