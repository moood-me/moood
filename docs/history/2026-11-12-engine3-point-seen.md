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
the card's units — a flat painting's only: a card, a plane not draped on the land (the review: a form's paint and a draped plane's are not on that plane, so they answer as before, the point's foot along the face); none when the line meets it behind the eye, runs along it, or the eye is edge-on. Animates run before
the camera steps (the camera frames what they mark), so they read the eye of the step before: one step behind a moving
camera; a cut's step reads the shot before's eye, the scene's first step the eye before any step (1.7 m up at the
start, looking ahead) — kept so, and said. A first try placed the camera for a new shot before the animates (a second
`camera.step` of no time in `play/step.js`); the review found it used up the operator's snap of the cut on people not
yet posed (they are posed after the animates), so a plain cut eased from a wrong framing; and the shot's pure pose
(`cameraFor`) is not the camera's first frame in every mode (sway, lean, the panorama's run, a platformer). The owner's
word: the camera steps once a step and nothing touches it early — with no pure pose true in every case, the early
placing was dropped. Docs: `docs/worlds/scene-format-3.md` (e.point's meaning, that it follows
the camera a step late, the order of marks), `docs/engine3/design.md` (the step). Test: `test/point-seen.test.js`.
