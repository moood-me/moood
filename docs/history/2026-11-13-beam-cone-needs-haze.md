# A beam's cone in the air needs real haze (issue #12, part 1)

**What called for it.** `anyone` / `desk` (works-011) wanted a desk lamp's cone seen in the air and got nothing at
`hazeGlow` 0.15. The scene language promises a beam's cone in a haze that glows.

**What was found.** The engine keeps the promise. A beam's glow is worked out per pixel in its own pass
(`engines/3/render/wgsl/post.js`, `render.beam`): the stretch of the eye's ray inside the cone, four samples, the
cone's own edge. Its strength is `hazeGlow × 12 / hazeReach(haze)`, and the desk's `haze` is 0.012 — a reach of about
39 km, so the glow is next to nothing whatever `hazeGlow` says. The lamp's beam is also 130° wide with `soft` 0.7:
in real haze that is a low tent of veil, not a cone.

Shown with a draft scene (two lamps over two tables, 50° and 130°, renders on dev): at `haze` 0.3 and `hazeGlow` 3
the narrow beam is a cone with crisp edges ending on the table (43752); at the desk's own values nothing is seen in
the air (43753).

**What was done.** No engine change. `docs/worlds/scene-format-3.md` (`hazeGlow`) now says the glow is of the haze
itself and grows with its thickness, what a room needs for a cone to show, and that the cone is as wide as the beam.

**Decided by** the engine's owner session; the blade of daylight (part 2 of the issue) is not being built.
