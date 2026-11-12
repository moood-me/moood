# A standing thing fades by its distance from the eye (2026-11-12)

**Why.** moood-me/moood#8: the fade of a card passed close by (5.17: gone at `PASS.FROM` 0.204 m, whole from
`PASS.TO` 0.595 m — so a curtain of leaves can be walked through) took the card's depth ALONG THE GAZE. In a close
shot over a desk — the lens over it and looking down — the desk's front, its sides and an open drawer's front lay at a
small depth along the gaze though well aside of the lens, and turned see-through (works-011 `not-my-fault/letter`,
`anyone/desk`: both films kept their cameras 60 cm clear for it). The engine's owner decided: the fade goes by
nearness to the eye itself — what walking through leaves needs —, not by a new word by which an element opts out.

**What changed.**
- `render/wgsl/quad.js`: the factor is worked out in the fragment (`e_passing`) from the pixel's own point of the
  world — `distance(in.world, e_view.eye)` — not carried from the vertices (a distance is not linear across a card:
  carried, a card wider than the eye's reach would fade by its corners). Same kinds (a card, what faces the eye),
  same views (the frame's, not a mirror's, not a light's), same two numbers. The `uvA` varying lost its fourth
  number; `e_ahead` (frame.js) had no other reader and went.
- `render/quads.js`: the cull's test of whether a card may fade at all — so it is drawn as a mixed sheet at most,
  its `cut` laying the depth of what does not fade — is the eye's distance to the card's nearest point
  (`nearestOf`: to its plane where the eye's foot is on it, else to its nearest side; its sphere first, by the
  distance of its middle less its radius).
- `play/inspect.js`: the layout's `fade` goes by the same distance (of the element's anchor, else of the nearest of
  what of it is before the eye).
- Docs: `architecture.md` 5.17 and its table, `base.js`, `scene-format-3.md` (the sentence on moving past near things).

**Walking through leaves** still fades well: a curtain across the gaze is now see-through first where it is
nearest — straight ahead — and stays a little longer toward the frame's sides; at the near plane (0.1 m) every part
of the frame within some 60° of the gaze is already gone, so nothing pops.

**What it does not give.** The fade band is still 20…60 cm from the eye: in a close-up with the lens 35 cm over a
desk, the desk's front edge some 40 cm from the eye is half there. Things more than 60 cm from the lens no longer
fade, however near they are along the gaze.

**Seen.** Renders on the dev studio, works-011 `not-my-fault/letter`, the lens 34 cm over the desk by its front
(`camera_x` 0.1, `camera_z` 0.5, `camera_h` −0.6, `camera_yaw` 31, `camera_pitch` −45): before (main) 43666 — the
drawer's sides, the desk's apron, the chair and him behind them all ghosts; after (ffd30c3) 43667 — he, his chair and
the desk's far side are whole; the drawer's front and its near side, within 60 cm of the lens, still fade, as
designed. A sheer curtain 32 cm before the eye (43668): fades softly, no seam. Test: `test/near-fade.test.js`.
