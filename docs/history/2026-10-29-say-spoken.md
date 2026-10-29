# A game's line heard in other words than shown: `spoken` (2026-10-29)

**Why.** A game author asked for a line spoken in one language and subtitled in the player's (a mother speaking
Chinese, the subtitle in English or Russian). `bespoke.say` showed and voiced one and the same text, so the game made
the Chinese the line (translated to itself) and drew the subtitle on a layer of its own.

**What.** `bespoke.say(who, text, { spoken })` (and `think`, `tr.line`, `tr.thought`): `text` is the line as before —
shown, translated by the game's `lang/`; `spoken` is what the voice says instead, as written, never translated (inline
tags heard, as in any line). Nothing new below the runtime: the page's speech (`engines/1/speech.js` `say(id, words,
{shown})`) already said one text and showed another (a thought's frame); the host's `speak` takes `{text, voice, how}`
and the studio's TTS keys a voice by those, its language read from the text — the spoken words go there as they are.

**How.** `play/runtime.js` `utter`: the voice asked for `spoken ?? line`, the bubble `line`; a kept line carries
`spoken` (`i18n/i18n.js` `kept`), and one said with `how` or `spoken` beside it is refused, as `how` was. Check
(`packages/check`): `extract.js` takes a game's `spoken` (a literal — else `spoken-not-literal`; beside a kept line —
`line-kept-how`), `index.js` tells lines apart by it, `lines.js` lists its words as the voice heard in every language.
Docs: `docs/worlds/README.md` (Texts and languages), `packages/check/README.md`. Tests: `test/spoken.test.js`.
