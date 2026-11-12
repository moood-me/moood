# Per-pixel edges for through-lights and beams: tried and dropped (2026-11-12)

**Why it was tried.** moood-me/moood#10 and #12: the patch of a light through panes and a beam's pool came out
saw-toothed and soft on a surface that is not a receiver of a casting light — such a surface is lit only at the
corners of its grid (cells up to 96 px, `LIT.CELL`); on a receiver, while the light is one of the two key lights, the
pixels work it out and the edge is clean. Drafts on the dev studio showed it: a sun through one pane, nothing casting
— 43646 teeth; the same with one caster — 43647 clean; a beam with nothing casting — 43690 teeth.

**What was tried** (branch engine3-issue-10, f1e59b1 … b0f50dd, reverted): those lights worked out at the pixels of
every opaque quad and the land; then, at the owner's word, a pane's mask read only past its plane, and the pixels
only of quads a CPU test of their sphere said the patch may cross. The edges came out clean (43681, 43692, 43715,
43716).

**What it cost** (measure_scene, dev stand, T4, phone profile; GPU p95 / main-solid / mirror, ms; the shadows head
4659a31 → the narrowed build 5db72fb): `tram` (neither kind) 2.94 / 0.97 / 0.45 → 2.97 / 1.00 / 0.48; `airport` (10
panes, a mirror floor) 4.03 / 1.51 / 0.66 → 4.32 / 1.60 / 0.84 (+7%); `desk` (4 panes, two beams) 3.58 / 1.70 / 0.30
→ 4.10 / 2.09 / 0.33 (+15%). In those scenes the patches reach nearly every surface in view, so narrowing spared
little.

**Why it was dropped.** The owner's word, with Pavel's: the engine must be neither heavy nor cleverly made — better
to give a feature up. All of it was reverted. What stays is said in scene-format-3: the edge is clean on what takes
shadows while the light is one of the two key casting lights, soft and uneven elsewhere.
