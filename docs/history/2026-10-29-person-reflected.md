# A person left out of mirrors: `<id>_reflected` (2026-10-29)

**Why.** «Кентервильское привидение» (`moood-me/works-007-29-finished-scenarios`, `worlds/the-canterville-ghost`,
scene `tapestry`, beat `rehearse`): the ghost stands before the old mirror and the scenario says he is not in it. The
engine had no such word — `"seen": "reflection"` is the other way round (only in mirrors) and only for cards and
planes; no per-person flag, no mirror include/exclude list, no layer mask. The scene's notes called it an engine gap.
Asked by the owner through the coordinator.

**What.** A person's state key `<id>_reflected`: `false` — no mirror image shows them (mirroring planes and panes of
glass); `true` by default. A key, as `_here` and `_still` are, so it can start false in the scene's `state` and be set
true at a dramatic moment (the ghost appearing in the glass); the director's verb `.reflected(yes)`. Shadows, the
main view (outlines, picking, the highlight), blobs and other views are untouched.

**How.** `engines/3/people/people.js`: the key read each step (`H.reflected`; a change is `version + 1`, so the
mirrors that see them are drawn again); `draw(…, mirrored)` leaves out who is not reflected — one test per person in a
mirror's pass, nothing when unused; `reflected(id)` for RENDER. `render/mirrors.js` `stale`: only those reflected
count in a mirror's signature (one left out moving does not redraw it). `world/kit.js`: the key known to the state;
`play/director.js`: the verb. Docs: `people.md` (state table, verbs), `scene-format-3.md` (mirrors, the verbs),
`contracts.md` (person keys, PP8, PP10).
