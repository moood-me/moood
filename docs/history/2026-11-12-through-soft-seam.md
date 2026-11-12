# A through-light's `soft: 0`, and the seam of two panes that touch (2026-11-12)

**Why.** moood-me/moood#10: a far light let in `through` panes (the sun on a floor) seemed to answer too steeply to
its `strength`, and its edge seemed soft whatever `soft` said. The engine's owner decided: the answer to `strength` is
the light model (each light adds its colour × e_lin(strength × how it faces), render/wgsl/light.js `e_term`) — left
as it is; an edge no sharper than a cell of the pane's mask (5 cm, a big pane's size / 120) is a resolution limit —
left as it is. Mended now, the two faults found beside them.

**What was found and changed.**
- `soft: 0` was taken as 0.3 (`engines/3/world/light.js`: `l.soft > 0 ? l.soft : 0.3`): a sharp edge could not be
  asked. Now any number of metres ≥ 0 is taken, 0 too; left out (or not such a number), 0.3. No scene of
  moood-me/works-011-scenes-respirit (cc04ad0) writes `soft: 0`: none changes. Docs: scene-format-3 ("soft" (metres,
  0.3; 0: sharp)), contracts.md WT4 `soft`.
- Two panes of one light that touch, with a soft edge, left a dark band along their seam: each pane's mask is blurred
  on its own (render/lights.js `rasterPanes`), and `e_through` (render/wgsl/light.js) took the largest of them — about
  half at the seam on each side. It now takes their sum, at most 1: a blur of two panes that touch is the sum of their
  blurs. Panes farther apart than their soft edges are as before; nearer ones now light the strip between them a
  little more, as two penumbras add (works-011 `house`: two windows 0.41 m apart, `soft` 0.4 — not rendered). The air's shafts read the same function.
  Draft scene on the dev studio (a floor, a sun 40° up through two panes 1.2 m wide touching, `soft` 0.3): render 43655
  (main cd0cd31) shows the band; render 43657 (this branch, 37cc2d1) shows the patch whole.

**Not done here (held by the owner).** A through-light's patch on what is not a receiver of a casting light is worked
out at the quad's vertices (render/wgsl/quad.js), so its edge comes out jagged and soft — render 43646 against 43647
(the same scene with one caster). A mend was tried and dropped: 2026-11-12-light-edges-dropped.md.

**Checks.** `node --test test/through-soft.test.js` — 2 of 2; `test/gpu/check.mjs` — no errors.
