# Engine 3: e.point on a card is where the eye sees the point (2026-11-12)

**Why.** Issue #13: a painted boy's hand put at a candle flame by `e.point` missed it by some 15 cm (the scaffold), and a
rower's hand missed the oar (the ferry); both scenes worked the points out in their animates instead. The cause was not
the eye's height: `world.toPainting` put a point onto a card straight along the card's normal — the point's own foot
on the card's plane — and never looked at the eye, so a point a step before or behind the card (the flame 0.5 m before
the boy) came out where it is not seen. The engine's owner decided: e.point on a card answers where the eye now sees
the point on the card as drawn — one meaning with the sky's; a point on the card's own plane answers as before.
The ferry's "stale mark" was not one: animates run in the order of `objects`, and the oar comes before the rower, so
its mark of the step is there; a mark of an element later in the order is not yet there for an earlier one (now said
in the language). No engine change for the order.

**How.** `engines/3/world/world.js` `toPainting`: for a card the line from the eye (`world.eye`) through the point meets
the card's plane as drawn — one turned to the eye by the view's yaw, else its node's plane — and that point is given in
the card's units; none when the line meets it behind the eye, runs along it, or the eye is edge-on. Animates run before
the camera steps (the camera frames what they mark), so they read the eye of the step before: one step behind a moving
camera — kept. But a cut's step read the shot before's eye, and the scene's first step the eye's place before any
step (0, 1.7, 0); a cut's frame drawn at once (its shot made ready) showed it. `engines/3/play/step.js`: a step that
begins a shot (its number other than the one the camera last stepped in — the first, a cut, a restore) places the camera
for it, of no time, before the animates, as the opening's view does (`thread.js` `prepare`). Docs:
`docs/worlds/scene-format-3.md` (e.point's meaning, that it follows the camera, the order of marks),
`docs/engine3/design.md` (the step). Test: `test/point-seen.test.js`.
