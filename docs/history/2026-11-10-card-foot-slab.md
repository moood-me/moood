# The dark slab before a card's foot is the paint's straight cut (2026-11-10)

**Why.** moood-me/moood#5: before every copy of a grass card (`tussock` in works-011's `well`) a dark rectangle seemed
to lie on the ground, from the foot toward the eye — steps of dark tiles where the tufts crowd. The question was
whether the engine darkens the ground there.

**What was found.** It does not. Renders on the GPU service (dev studio, engine d4e6ca0a889d): the scene without its
`wet` plane (43431) and with `bounce: 0` (43432) show the same; a box three times as wide (43433) does not widen the
patches; three tussocks alone on the scene's ground (43434) and one on a striped ground (43435), measured: the ground
below the foot has the very values of the ground beside it at the same rows, and the stripes run through unchanged.
Every blade starts on the foot line, so the pale clump ends in one straight horizontal cut over dark ground: the eye
fills a dark rectangle under it. Nothing in the engine lays anything there (no slab quad, no tilt: world/place.js;
transparent texels lay no depth: render/wgsl/quad.js `cut`).

**What changed.** One paragraph in `docs/worlds/scene-format-3.md` (beside "what a card paints below its foot"): what
the straight cut looks like and what a painting gives its foot instead.

**And the line beside it.** scene-format-3 said that what a card paints below its foot "lies on the ground toward the
eye". A card painting a bright band 0.3 m below its foot (box reaching there) on flat striped ground, the eye low
(render 43436): none of that band is seen — the ground hides it, but for a hair at the foot line. The line now says so.
