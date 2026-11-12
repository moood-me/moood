# Lights whose patch has an edge are worked out per pixel on what is opaque (2026-11-12)

**Why.** moood-me/moood#10 (a through-light's patch soft whatever `soft` says) and #12 (a beam's pool on the desk
cut as a saw's teeth). Both are one fault: what is not a receiver of a casting light — and every surface, for a
light that nothing casts for — was lit only at the corners of its grid (render/wgsl/quad.js; cells up to 96 px,
`LIT.CELL`), so an edge that changes faster than that came out as teeth or a smear. The engine's owner decided the
shape: one rule for the lights whose patch has an edge, not a case per kind; built on engine3-issue-shadows
(450f07f, merged in), whose agent works on `e_shadowAt` and the casters' depth bias — not touched here.

**What changed.**
- `render.light` (render/wgsl/light.js): `e_lightOn` has `edges` — set, it skips the lit set's rows after the far
  lights and before the points: the through-lights and the beams (`farN … farN + throughN + spotN`, at most
  `THROUGH_MOST + SPOT_MOST` = 6). `e_edges` works those rows out at a pixel, each in its shadow as `e_lightOn`
  has it there (a key light is `e_keys`' and is left to it, so nothing is counted twice). A scene with neither kind
  pays one compare a pixel.
- `render.quad` (render/wgsl/quad.js): every `solid` program (solid, cut, their receivers, an own shader's cut, the
  land's solid, and the same in a mirror's set) passes `edges` at its vertices and adds `e_edges` at its pixels — a
  receiver with its key lights (times its brightness, under its air, as they are), a plain one through the new flat
  `lit.yzw` (its brightness, the same over the quad; 0 for what glows) times its air's clear share. `sheer` rides
  in `lit.x`. What blends, particles and people stay lit at their vertices.
- Docs: architecture.md (the rule in 1 and 5.5, the mirror's set, what an opaque pixel reads), the headers of
  light.js, quad.js, library.js.

**Seen** (dev studio, GPU service): a floor and a wall under a sun through one pane, nothing casting — main 43646
saw-toothed, branch 43681 clean; a beam (`soft` 0.14) on a floor, nothing casting — main 43690 teeth, branch 43692 a
clean oval; `airport` 43682 and `letter` 43683 as before (their lit floors and walls were receivers already);
`desk` 43684 → 43685: the city's patches on the sideboard now cut clean, the pool as the scene softened it
(`soft` 0.7); `house` 43686 beside main's picture: the strip between its two patches (after the panes' sum) reads
right.

**#12's other point.** "A beam that casts no shadow passes through the desk's top onto its faces" is what no shadow
means: a light that nothing casts for lights every face turned to it within its cone (render/wgsl/light.js `e_term`:
nothing in it asks what lies between). Not changed.

**Cost** (measure_scene on the dev stand, T4, phone profile; GPU p95 / main-solid / mirror, ms). The first build
(every opaque quad, every pixel) against main cd0cd31: `desk` 3.52 → 4.05, `airport` 3.99 → 4.33. Then, by the
owner's word, a pane's mask read only past its plane, and the per-pixel work only on quads a light with an edge may
change across (`L.edged`, SHAPE.EDGES). Against the shadows branch's head 4659a31 alone (43712–43714) → 5db72fb
(43718–43720):
- `habits-remain` / `tram` (neither kind): 2.94 / 0.97 / 0.45 → 2.97 / 1.00 / 0.48 — the same, within the noise.
- `airport` (one through-light of 10 panes, a floor that mirrors): 4.03 / 1.51 / 0.66 → 4.32 / 1.60 / 0.84 (+7%).
- `desk` (a through-light of 4 panes, two beams, one 130° wide): 3.58 / 1.70 / 0.30 → 4.10 / 2.09 / 0.33 (+15%).
In these two the patches reach nearly every opaque surface in view, so the per-quad test spares little; frames held
at 16.7 ms on this stand. 5db72fb's `L.edged` allocated (Math.hypot, numbers passed as arguments): fixed in 3ad1aa2,
not measured again. Brought to the owner before going further.

**Checks.** `node --test test/light-edges.test.js` — 3 of 3; `test/gpu/check.mjs` (with `letter`, an own shader) —
no errors.
