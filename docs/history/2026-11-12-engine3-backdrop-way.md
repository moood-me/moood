# The pale patch beside the mirrored moon: a backdrop's way made a unit for drawing (2026-11-12)

**Why.** moood-me/moood#6: in works-011's `not-even-mum` / `river`, with the eye low and turned (the boat's shot:
`camera_x −0.42, camera_z 2.6, camera_h −0.8, camera_look 0.02, camera_yaw −10`), the water showed a pale upright
patch with stepped edges beside the mirrored crescent; straight ahead it was smaller, but there too (render 43654).

**What was found** (renders on the dev studio's GPU service). Not the sky's glow (the mirror drawn without sky glows
still had it: 43649), not what blends (43663), not the half levels or the further-sheet shortcut of the ask (43661,
43660); it went with the sky's sheets (43664). Drawing the mirror's sky reads as their levels showed it: at a corner of
every cell of the sky's grid (16 × 16 cells over its painting) a small triangle read a level coarser than SHEETS had
asked there, so the table gave the finest page above it that was there — near the top: the moon blurred into a pale
block, cut by the cell's sides and by the level's line (43674, 43680). Elsewhere the same triangles read the sky's own
smooth gradient, where a coarse page looks no different.

The cause: `world.wgsl.js e_skyWayIn` made a backdrop's way a unit at each corner of a cell. The ask (sheets/ask.js)
takes a backdrop as a flat piece — its way (the gaze) + o · (its right) + up · (up), affine in the sheet's point
(place.js `backdropWay`) — and names the levels a flat piece needs, with an eighth of slack. A way made a unit is the
same direction but another weight at each corner, so the rasterizer's perspective interpolation is no longer that
mapping: inside a cell the sheet's point drifts and the footprint swells, by up to about a sixth of a level near one
corner — past the slack. Why the frame did not show it (inferred, not measured): it mostly reads the sheet's finest level, where nothing finer is asked; the mirror's
image, finer since `engine3-mirror-density` (a5478d0 drew the same shot whole: 43656), reads a middle level, where a
level more is one not asked.

**What changed.** `e_skyWayIn` writes a backdrop's way as `backdropWay` does, not made a unit (the round sky is
unchanged: it is curved and asked as such). The way is used only to place the vertex and for the turn's test
(`e_backdropSees`), which does not care for its length. Comments in place.js and world.wgsl.js, architecture.md
3.5 (it said "made a unit only for drawing"). Test: `test/sky-backdrop-way.test.js` runs the shader's own
`e_skyWayIn` in node against `backdropWay` and checks that interpolation between a cell's corners lands on the sheet's
own point (both fail with the old line). `test/gpu/check.mjs`: no errors.

**After** (engine 9f8fff5): the boat's shot at yaw −22 (43705) and 0 (43706) — the mirrored moon whole; works-009
`hope` / `lake` (43707) as on main (43708) — its square-ish blurred moon in the water is there on main too.

**Not looked into.** The dark upright block a `reflect` plane of puddles laid over the ground in `the-pasture` (its
notes): the scene no longer has that mirror and its history here has none, so it could not be drawn again.
