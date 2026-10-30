# A game hushes the scene's music (2026-10-30)

**Why.** A game author: in «Кентервильское привидение», as the clock strikes twelve «the whole house fell silent at
once» — the game silences its background (`bespoke.background({})`), but the scene's music went on: a game had no
way to change the music within a scene. The music is the scene's (`spec.music`, played by `engines/1/music.js` as
the play shows the scene: `play/runtime.js` show → `MooodMusic.show`); the game could only pause the whole play.

**What.** `bespoke.music(level, seconds)`: how loud the game wants the shown scene's music — 0 silent … 1 as the
scene has it —, moved there over `seconds` (the music's crossfade, `FADE` = 4 s, by default; 0 at once). A hush is a
moment inside a scene: the next scene shown is heard at 1 again (its new music crossfades in at 1; the same music
going on comes back to 1 over `FADE`), so a game that forgets cannot silence later scenes and a jump needs nothing;
a game wanting the next scene silent too calls `music(0, 0)` after its show. The listener's volume and the play's
pause (the music's fade out and standing, `2026-10-29-music-pause.md`) stay over it as they were.

**How.** `engines/1/music.js` (`MooodMusic.level`): the open scene's deck comes in to the game's level instead of
1, and a level said moves that deck's gain from where it is by a linear ramp on the sound's clock — a pause meanwhile
holds the move and it goes on with the play; a deck giving way to another fades out from where it is. `show` sets
the level back to 1 (the same music: its deck ramped back over `FADE`); a level said after a show and before its
music is pushed (200 ms later) is what the new music comes in to. `play/runtime.js`: `bespoke.music`.
`docs/games/games.md` says it to games. Tests: `test/music-pause.test.js` (the level beside the pause).
