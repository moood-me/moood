# Engine 3: three world authors' reports — eave drips, a hem through a wall, `then` that waits in vain (2026-10-29)

**Why.** Reports from world authors, passed on by the coordinator: «Дама с собачкой» (`moood-me/works-005-five-games`,
`r3/lady`, `worlds/lady-with-the-dog`) — no particles drip from an eave in the thaw (`town-s`); the wife at the window
upstairs leaves her skirt's hem as a dark wedge on the wall under the sill (`moscow`, beats `school` / `porch_end`,
`wife_knows` 1); «Человек, который сажал деревья» (`moood-me/works-007-29-finished-scenarios`, `r3/trees-game`) — a
game passed `beat` in `bespoke.show`'s `then` and waited 180 s for each step.

**1. Drips along an edge — nothing to build.** An emitter's particles are born uniformly in its `source` box round its
point, turned with its element (`render/wgsl/particles.js`: `p0 = at + turned(q, source · rnd)`); a box with two sizes
0 is a line. So drips off an eave are a particles element `on` the house at the eave, `"source": [length, 0, 0]`,
falling (`kind` `drops` with `flat` false, `gravity` 9.8, `ground` `splash`). Only words: `scene-format-3.md` gives the
line in `source` and an `eave_drips` example; `test/particles-line.test.js` compiles it with no warning.

**2. The hem through the wall — not the outline; no engine change.** From code the people's lines (`post.js e_line`) are
drawn only on pixels whose `ids` are a person's, and every card's opaque paint clears `ids` in front of them: a solid
and a mixed sheet's `cut` write `ids` 0, and a card drawn wholly blended is laid again by the `marks` list (pipeline
`mark`, fixes-2 item 3) where its paint is ≥ `SHEET.OPAQUE`. The house front in `moscow` is such a blended card (an order
rule names it: `home_windows` `inFront` `house`), so `marks` covers it. What is left: the wife stands at across 3.9
(`lib.js UPSTAIRS`), the front's plane is at 3.6, and the dress's skirt flares ×1.45 at the hem (`wardrobe.js` `dress`,
`flare` 0.45) and hangs as cloth — the hem most likely crosses the wall's plane and is seen in front of it, a wedge under
the sill (a cone cut by a plane). Not rendered here; the author's fix is to stand her farther in. The engine's only
known gap of the kind — paint between half and `SHEET.OPAQUE` over a person hides their colour mostly but not their
line — is not this scene's (the front is opaque under the sill).

**3. `then` — said in the scene's warnings.** A jump (`thread.js`, `start.then`: the director `simulating` in its
`instant` mode) tells the game nothing; a piece set there runs to its end and its `scene.tell` / `signal` is dropped —
a game waiting for it waits for its own timeout. Now `play/director.js hear`: a `tell` or a `signal` while simulating
in the instant mode is a warning (`the game's jump (bespoke.show's "then"): the scene told "…" …`; said once — the
messages' dedupe). A seek's or a restore's unseen steps (simulating alone) and the page's `bespoke.instant` (instant
alone: its tells are heard) say nothing. Words: `play/runtime.js` (`bespoke.show`), `docs/games/games.md` (§6, the author). Not in
`@moood/check`: whether a key in `then` starts a piece that tells is the scene's code, not readable statically.
`test/jump-tells.test.js`.
