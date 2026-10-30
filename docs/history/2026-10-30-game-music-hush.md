# A game hushes the scene's music (2026-10-30)

**Why.** A game author: in «Кентервильское привидение», as the clock strikes twelve «the whole house fell silent at
once» — the game silences its background (`bespoke.background({})`), but the scene's music went on: a game had no
way to change the music within a scene. The music is the scene's (`spec.music`, played by `engines/1/music.js` as
the play shows the scene: `play/runtime.js` show → `MooodMusic.show`); the game could only pause the whole play.

**What.** `bespoke.music(level, seconds)`: how loud the game wants the scene's music from now on — 0 silent … 1 as
the scene has it (the default) —, moved there over `seconds` (the music's crossfade, `FADE` = 4 s, by default; 0 at
once). It holds for the scenes after too (their music crossfades in at that level) till the game says another. The
listener's volume and the play's pause (the music's fade out and standing, `2026-10-29-music-pause.md`) stay over it
as they were.

**How.** `engines/1/music.js`: a gain of the game's level between the decks and the output (`MooodMusic.level`),
moved from where it is by a linear ramp on the sound's clock — a pause meanwhile holds the move and it goes on with
the play; a level said before the music has begun is where it begins. `play/runtime.js`: `bespoke.music`.
`docs/games/games.md` says it to games. Tests: `test/music-pause.test.js` (the level beside the pause).
