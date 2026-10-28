# Study: real 3D forms in engine 2 — data, not a decision

Status: a STUDY. Nothing here is decided, nothing was run, `architecture.md` was not edited. Reasoned from
revision 3 as it stands, from `study-scenes.md` and from the scenes' sources in `scratchpad\study-src`. Sizes of
work are estimates by reading; every number marked ≈ is an orientation. What could not be checked is listed at
the end.

Words. *Form* — a surface that is not flat. *Grid* — a rectangle of points, N × M, that a sheet is stretched
over. *Flat assembly* — a thing put together from flat sheets (what the engine has: a house from walls).

---

## 0. What the question touches in revision 3

Four things of revision 3 rest on "everything is a flat rectangle", and each level below is measured by how far
it moves them:

1. **Rule 3 (1.1): which pages a view needs is computed on the scene's thread from a formula**, with no GPU
   feedback. `sheets.ask` places a quad's rect by `place` (WT7), clips it to the view and takes the level by 4.8.
2. **5.17: order and depth.** Solid quads near to far with depth; everything else far to near, sorted quad by
   quad, no depth written. A flat rectangle never hides a part of itself; a form does.
3. **Light**: one turn (normal) a quad; light at the vertices for what blends, two key lights per pixel on opaque
   receivers. Shadows: a caster is in sets (`cast`), a receiver names what falls on it (`recv`) — a quad never
   shades itself.
4. **One closed set of pipelines and one vertex layout** (4.1, 4.5): every quad pipeline reads `corner`, the order
   row, and the tables `nodes`, `quads`, `layers`. The vertex stage is at 6 of the 8 storage buffers core WebGPU
   gives; the families (particles, people) use the other two. **A new storage buffer for forms does not fit in
   `frame`** without taking one from them (4.2's last paragraph).

One thing already in revision 3 is not flat: **`DRAPE`** (a plane lifted onto the land's height field, drawn with
the `GRID` / `FINE` shapes, asked by "a descent from the top where the level varies across it", its points placed
through `relief.field`). It is the precedent every level below leans on: a sheet stretched over a grid of points.

The owner's rule of the same day (LG14: flat sheets only, no imitation) is what stands now. Each level below
replaces a part of that rule by a supported thing.

---

## A and B — the centre of this study (the owner's present leaning)

His leaning, as passed on: **(A)** opaque forms given by a function; **(B)** raw triangles "if cheap for us",
documented as supported but discouraged. The three levels below (section 1) are the background; in their words A
is L2a with L1 inside it, B is L2b. In short:

| | L1 bent sheet | **A: form = function (u, v) → point** | **B: raw triangles on top of A** | L3 imported models |
|---|---|---|---|---|
| gives | arcs, tubes, cones | everything of L1, and hulls, rocks, domes, vases | shapes that are not one stretched rectangle: branching, holes, hard creases, many parts in one | anything a file holds |
| engine, ≈ lines (of ≈ 21 000) | 300–500 | 1000–1400 | + 150–250 if A was shaped for it (below); + 600–900 and its own pipelines if not | 2500–4000 |
| new pipelines / passes | 0 / 0 | 0 / 0 (shared vertex stage) | 0 / 0 (if shaped for it) | 8–12 / 0 |
| pages asked by formula (rule 3) | yes | yes, exactly | yes, but loosely (more pages than needed) | no |
| cost of a thing bounded by | its kind | its kind: one sheet, one grid, detail chosen by the engine | a cap only (triangles a form) | nothing |

### A — a form is a function (u, v) → point; opaque; painted like a sheet

**The design, as it would sit in revision 3.**
- *In the language*: an element (a card or a plane today) may have a form. In its code, beside the painting:
  `e.form((u, v) => [x, y, z], { closed?: "u" | "v" | "both", sides?: 1 | 2 })` — u, v run 0…1 across the
  painting's rectangle; the point is in the element's own metres (what `e.at` uses, with depth added). The
  function is pure: it may read the state and the element's numbers, nothing else. **The constructors are plain
  functions that return such a function**, in the kit: `kit.bend(…)`, `kit.revolve(profile, …)`,
  `kit.extrude(profile, path)`, `kit.loft(ribs, …)`, `kit.lump(outline, height, seed)` — ≈ 150 lines together,
  no engine machinery of their own. An author uses a constructor or writes the function.
- *Who evaluates it*: the artist, at the element's make, with its painting (paint code never runs on the scene's
  thread — rule 5 holds). The engine samples it on a grid of 33 × 33 points (65 × 65 for a form that can fill the
  frame — the engine's choice by the element's box, never the author's), works out the normals from neighbours,
  and — because a function can crowd its points — measures lengths along u and v so that it can say when paint
  is stretched (a warning with the number; the ready constructors are spaced by length and do not stretch one
  way). The grid rides in SH6's `made` beside the recording. A form that depends on a key is made again when the
  key changes, as a painting is; an animate cannot change it (it moves the node and the layer, as for a card).
- *On the GPU*: the points and normals go into a texture `formPoints` (`rgba32float`, `textureLoad` in the vertex
  stage; a storage buffer does not fit — section 0.4). The quad's row says where (16 more bytes a row). The
  shared vertex stage reads the point at the corner's (i, j); **detail by size on screen is a stride** over the
  same grid (33 → 17 → 9 → 5 a side: the shapes `FINE`, `MID` and one new), chosen each frame by RENDER per view.
  No new pipeline, pass or buffer; one binding added to `frame`.
- *Opaque only*: the form's sheet must be wholly opaque (`sheets.solid = 2`) — otherwise an error of the scene's
  build. It is drawn in `main-solid` with depth, two-sided or one-sided by `sides`. So it hides itself and
  everything behind it correctly from every direction, and blended sheets in front of it and behind it sort
  against its depth as they do against a wall. No glass, no holes, no soft painted outline (the outline is
  smoothed in the canvas pass, as people's is).
- *The ask of pages*: the grid's cells are regular in u, v, so a block of cells IS a rectangle of the painting: a
  block is asked as a flat piece between its corner points (split while not flat enough), at the level 4.8 gives
  there; a block of a one-sided form that faces away is not asked. Exact, on the scene's thread, tens of pieces
  a form.
- *Light, shadows, mirrors, points, people*: as under L2a below — smooth light from the grid's normals (at the
  vertices, and the two key lights per pixel); casts through the same stage; does not receive its own shadow;
  `e.at(x, y)` gives the point on the form; picking is a ray against the grid's triangles; people stand on planes
  and the land (and on a `lump`, which is a height field), not on other forms.
- *What the guarantees become*: cost by construction — kept (one sheet, one grid, the engine's detail); pages by
  formula — kept; one set of pipelines — kept; "a quad never hides a part of itself" — replaced by "a form is
  opaque". New and not guaranteed: paint stretch on double-curved surfaces (measured and said, not prevented);
  a faceted outline at some size; that a function is sane (a function that folds through itself or returns NaN:
  the engine can refuse NaN and a zero-area grid, not ugliness).

**Size**: ≈ 1000–1400 lines in SCENE, SHEETS, RENDER, GPU (one binding), LANGUAGE; 5–7 % of the engine.

### B — what raw triangles add beyond A

**What they are**: the element's code gives points, triangles (indices) and a (u, v) into the painting for every
point: `e.mesh({ points, uv, triangles, sides? })`. Opaque, like A.

**What they add**: only shapes that are not one stretched rectangle — a thing that branches (antlers, a
candelabrum), a thing with a hole through it (a ring, an arch as one piece), hard creases where the author wants
them, several separate pieces in one element. Everything else a function reaches.

**What they cost on top of A — two cases.**
- *A built with no thought of B*: the grid's u, v are implied by position in the grid, the ask walks blocks of
  cells, the shapes are regular grids. B then needs its own vertex data, its own index buffers, a second vertex
  layout and so its own pipelines (solid plain and receiver, cast, mask: + 4–6, each world that has a mesh), its
  own ask and its own picking: ≈ 600–900 lines, and 4.1's "one vertex layout" given up.
- *A shaped for B* (the answer to "can A be built so that B is a small later addition": **yes**, by four choices
  inside A):
  1. `formPoints` holds a record a point — place, normal, **and its (u, v)** — instead of implying u, v from the
     grid (3 texels a point instead of 2: 33 × 33 × 48 bytes ≈ 52 KB a form);
  2. the ask is written over triangles with a (u, v) at each corner (a grid's cell is two such triangles), not
     over an implied regular grid;
  3. picking is a ray against triangles (it is, for a grid, anyway);
  4. one more shape in the shapes buffer: a plain run of numbers 0 … 3 · T (a "soup": the vertex stage reads
     record number `corner.x`), so a mesh is drawn by the same pipelines.
  With these, B is: taking the three arrays from the artist, checking them (indices in range, no NaN, a cap),
  normals by averaging the triangles that share a point, the soup shape, the docs — ≈ 150–250 lines, no
  pipeline. The price of the four choices inside A: the larger record; an ask that is a little less tight than
  a grid-only one could be; nothing else.

**What of revision 3's guarantees B breaks, even in the cheap case.**
- *Cost by construction*: the engine no longer chooses the detail — a mesh has the triangles its author wrote, in
  every view it is drawn in (the frame, each mirror, each shadow cell it is in), near or a kilometre off. Only a
  cap bounds it (say 2000 triangles a mesh; and a guidance row for meshes a scene). No level of detail: a far
  mesh of small triangles shimmers and costs as when near.
- *The ask of pages*: a triangle's pages are the pages under its box in (u, v) at its level — exact for a grid's
  cell, loose for a long thin or slanted triangle; a mesh whose UVs are scattered over the painting asks most of
  the painting. Still a formula on the thread (rule 3 stands), at ≈ 2000 triangles × meshes in view × views of
  work where A has tens of blocks.
- *The painting's mapping*: the author's. Stretch, seams (a seam needs doubled points, which also breaks the
  smooth normal there), islands of UV whose 8-px page borders bleed into each other when packed close — none of
  it is the engine's to prevent. The painting no longer has a shape the author can picture: paint code draws into
  a rectangle whose parts land wherever the UVs say.
- *One look of the light*: normals from averaging depend on how the author shared points; a crease or a faceted
  look is an accident of the index list.
- Unchanged by B: opaque only; pipelines (cheap case); passes; the frame's account per pixel.

**As data about the authors**: nothing in the 20 scenes is a triangle list or has UVs; what agents wrote well are
short tables of numbers and functions of a few parameters (section 1, L2). "Supported but discouraged" has a
known course in these scenes: what exists is used wherever it is the shortest way to a wish (the 133-layer horse
with its own projection; 187 elements for 17 arches) — and by the owner's principle of the same day (LG14) an
agent may not imitate what is missing, so whatever is allowed is the only outlet.

---

## 1. The three levels (background to the above)

### L1 — bent sheets: a painted sheet bent by a formula

**What it is.** One more kind of quad: the sheet's rectangle is mapped to a surface by a closed formula with a few
numbers — `arc` (a part of a cylinder: radius, angle), `tube` (a whole cylinder), `cone` (two radii), `revolve`
of a short profile is already L2 (a profile is data, not a formula). In the language: a word on a card or a
plane, e.g. `"bend": { "arc": 90, "radius": 2.1 }`. The painting is unchanged: the author paints the unrolled
rectangle.

**How it would sit in revision 3.**
- *Tables*: one of the two free kind codes (`QUAD.BENT = 6`; bits 0–2 hold 0…5 today). Its numbers (≤ 4 floats)
  need a place: the `quads` row is full (64 bytes); the `layers` row has two spare floats (`opts2.zw`), not four.
  So either the `quads` row grows to 80 bytes (16 spare), or a bent quad always has a layer row of its own.
- *The vertex stage*: `quadPoint` (WT6, SCENE's chunk) gets one branch on the kind, as it has for DRAPE; the same
  formula once more in JS in `place` (WT7). Drawn with the existing `MID` / `FINE` shapes. **No new pipeline, no
  new buffer, no new pass.**
- *The ask of pages*: `place` is already point by point, so the descent that DRAPE uses works: the rect is split in
  u, v until a piece is flat enough, each piece asked as a flat one. SHEETS must not use a flat-only shortcut for
  this kind. A piece turned away from the eye can be left out (its normal is a formula) — a tube asks about half
  its pages.
- *Cull*: a box of the bent rect instead of the rect's four corners (RENDER; a formula).
- *Order, opaque or blended*: an arc under 180° seen from outside does not cover itself — it may be solid or
  blended like any quad. A tube, or an arc seen from inside and outside at once, covers itself: blended, its far
  wall and near wall are one item in the far-to-near list and come out in the order of the grid's triangles —
  wrong from half the directions. By construction this is closed only one way: **a bent sheet that can cover
  itself is drawn solid or not at all** (its sheet wholly opaque — `sheets.solid = 2`); a mixed or translucent one
  is refused at the scene's build. So: a translucent tube (a glass, a lamp's chimney) is not available.
- *Light*: the normal becomes a function of the vertex (a formula) instead of a constant of the quad. Light at the
  vertices then shades the bend smoothly with the `MID` grid; opaque receivers need the normal interpolated to the
  pixel for the two key lights (one more inter-stage vec3; 16 are allowed).
- *Shadows*: cast — the cast pipeline uses the same vertex stage, nothing new. Received — as any quad. A bent
  sheet does not shade itself (it is not in its own `recv`), as now.
- *Mirrors, masks, ids*: same pipelines, same vertex stage. Points (`e.at`) go through `place`; picking needs a
  ray against the formula instead of a ray against a plane (SCENE, short).
- *Own shaders*: the contract (`at`, `uv`, `layer`, `at_dx`) does not change; `at_dx` / `at_dy` vary across the
  bend, as they do on a plane seen at an angle.
- *People*: stand on planes and the land, as now. Not on a bent sheet.
- *Accounts*: 5.17 — a solid bent sheet is a solid receiver's pixel (≈ 30 bytes), cheaper than the blended facets
  it replaces. 5.21 — pages as any sheet; none more. Pipelines and first-open compile: unchanged.

**Size.** Areas touched: SCENE (spec word, `place`, the chunk, picking), SHEETS (the ask's descent for one more
kind), RENDER (normal, box, the solid-only rule), LANGUAGE (the text, the rule of LG14 reworded). ≈ 300–500 lines
of the engine — against the present engine's ≈ 21 000 lines of JavaScript (main's engine 2 (gone) without three.js)
that is about 2 %. No new area, no new interface entry; four entries reworded (WT2, WT6, WT7, SH10).

**What can no longer be guaranteed by construction.** (a) "A quad never hides a part of itself" — kept only by
the solid-only rule above. (b) The level of a sheet is right across the whole quad: at a tube's edge the surface
is seen along itself and one plain tap goes soft there (2 taps as on planes halve it). (c) A flat silhouette: the
edge of a bent sheet is a line of the grid's facets; smoothed by the canvas pass like people's rims, but a tube of
the `MID` grid (4 cells round a quarter) shows corners close up — the grid must be chosen by size on screen.

**What it does not give**: a boat's hull, a rock, a vault with a painted rib pattern that tapers — anything curved
two ways.

### L2 — forms made by scene code

Two designs were asked to be compared.

**L2a — a closed set of constructors, the painting mapped by the engine.** The smallest honest design is this:
*a form is one sheet stretched over a grid of points*, and a constructor is a function that makes the grid:

| Constructor | Given by the author | The painting's rectangle is | For |
|---|---|---|---|
| `bend` | L1's numbers | the unrolled sheet | arcs, vaults, towers, masts |
| `revolve` | a profile: 3–12 points (radius, height); an angle | height × way round | vases, columns, domes, casks, funnels |
| `extrude` | a profile: 3–12 points; a length or a path of a few points | profile's length × the path | mouldings, rails, a keel, a gutter |
| `loft` | 3–9 ribs, each 4–8 points, at stations along a line; `mirror` | along the line × round the rib | **a boat's hull**, a horse's barrel, a trunk |
| `lump` | an outline and a height function with a seed (as the land has) | the outline seen from above | **rocks**, mounds, drifts |

Every one gives an N × M grid (the engine chooses N, M ≤ 33 by the form's size; the author does not). The
painting's u, v are the grid's own, spaced by length along the surface, so the author paints "the hull unrolled:
keel at the bottom, rail at the top, bow at the right" and never sees a triangle or a UV. L1 is the first row of
this table: with L2a built, L1 is not a separate thing.

How it would sit in revision 3:
- *Where the points live*: not a storage buffer (0.4 above). A texture of points — `formPoints`, `rgba32float`,
  read with `textureLoad` in the vertex stage (sampled textures: 16 a stage; no filtering needed, so core) — one
  small rectangle a form. One more binding in `frame` (4.2 is final: this is a change of a final layout). The
  quad row needs the rectangle's place in it: 16 more bytes (the same widening as L1).
- *Who makes the grid*: the constructors run where paint code runs — in the artist — or on the scene's thread at
  the build. The grid is data of the element, made once; a form that changes shape with a key is a repaint-like
  make (a new grid), not an animate. An animate moves a form as it moves a card: node and layer pose.
- *The vertex stage*: one branch in `quadPoint`: the point is read from the grid at the corner's (i, j). The
  shapes `MID` (4 × 4) and `FINE` (16 × 16) and a new 32 × 32 serve as levels of detail by stride. No new
  pipeline if the branch lives in the shared stage; **every quad pipeline's vertex stage then carries a texture
  read it mostly does not use** — nothing on a laptop, unmeasured on the phones' drivers.
- *Normals*: the engine works them out from the grid (differences of neighbours), once, into the same texture.
- *The ask of pages*: by cells — a block of grid cells is asked as a flat piece between its corner points, split
  while it is not flat enough; a block facing away is left out for a closed form. Cost on the thread: tens of
  pieces a form in view; with 5.12's guidance of 3000 quads, some tens of forms cost what a few hundred quads do.
  It stays a formula on the scene's thread — rule 3 holds.
- *Cull*: a sphere from the grid's points.
- *Order; can a form be translucent?* The same as L1, sharper: a hull, a rock, a vase cover themselves from
  nearly every side. **Forms are solid: wholly opaque paint, depth written.** Not available by construction: a
  translucent form; a form with holes in its paint (an alpha-0 pixel in the solid pass would need a `discard` in
  the solid pipelines — 4.6 forbids it, and on tile GPUs it is the cost revision 3 removed with the cores step);
  a form with soft painted edges — its outline is geometry, not paint. The painted style of the scenes ("nearly
  every edge is painted and already soft", 4.3) does not reach a form's outline: it is as hard as a person's and
  is smoothed the same way, in the canvas pass.
- *An open form seen from inside* (an open boat): the inside is the back of the hull's sheet. Drawn two-sided
  with depth it is right; its paint is the outside's, mirrored. A different inside is a second form (the same
  grid, another painting) a centimetre in — or the language gives a form two paintings (`inside`). One more thing
  to design.
- *Light*: smooth, from the grid's normals — at vertices for all, plus the two key lights per pixel with the
  interpolated normal. This is new look, not only new code: a lit rounded surface next to painted flat sheets
  whose roundness is in the paint. A painting on a form must not paint its own shading, or it is shaded twice
  (the same thing the two Asher scenes are being edited for in 5.20).
- *Shadows*: cast — same stage. Received — a form would want its own shadow on itself (the rail's on the hull's
  inside); a caster receiving its own shadow on a curved surface is where shadow acne comes from. By
  construction: **a form does not receive its own shadow** (as a quad does not); it receives others'.
- *Mirrors*: same pipelines. Drawn two-sided, no winding variants (people need them only because they are culled).
- *ids, points*: `e.at(x, y)` in the painting's units → `place` → the point on the form: works unchanged, and is
  the reason to keep the painting's rectangle as the form's coordinates. Picking: a ray against the grid's
  triangles (SCENE; ≈ 100 lines, new).
- *People on or in a form*: a person stands on a plane or the land. In a boat they stand `on` a flat deck plane
  inside the hull, as they stand on the `secret`'s deck planes today; depth then cuts their legs by the rail
  correctly — better than cards do now. Walking on a `lump` is possible at little cost (it is a height field: the
  land's own query); on a `loft` or a `revolve` it is not offered.
- *Own shaders*: unchanged contract; on a form the result is lit by the form's normals.
- *Accounts*: 5.17 — forms are solid receivers: 30 bytes a pixel, and they HIDE what is behind them, where the
  flat assembly they replace is often blended. 5.21 — a form's sheet is asked like any; a hull painted as one
  sheet of 34 × 8 m is one painting instead of seven plates. The grid texture: 33 × 33 × 2 × 16 bytes ≈ 35 KB a
  form. Pipelines: none new if the branch is shared; + 4–6 (solid plain and receiver, cast, mask) if forms get
  their own vertex stage to keep the texture read out of every quad's. First-open compile: + ≤ 20 %.

Size of L2a: SCENE (the spec's words, the constructors, grids, `place`, picking, `lump`'s floor) ≈ 500–700
lines; SHEETS (the ask by cells) ≈ 150; RENDER (normals in light and receivers, the level of detail, sphere cull,
the solid-only rule, `formPoints` in the layouts) ≈ 250–400; GPU (one binding; 4.2 changed); LANGUAGE (five
constructors explained so that an agent uses them, with the painting's layout for each) — the largest unknown.
≈ 1000–1400 lines, 5–7 % of the engine, five areas; interface entries changed: WT2, WT6, WT7, SH10, 4.1, 4.2, 4.7,
LG (five words), and one new (the grid of an element in SH6's `made`).

**L2b — raw triangles with author-given mapping.** The element's code returns positions, triangles and a UV for
every vertex. In the engine it is not smaller than L2a (the points live in the same texture or a vertex buffer of
its own — then a second vertex layout and its own pipelines: + 6–10), and it removes what L2a guarantees: the
ask cannot assume a grid (it must walk triangles and UV space: a triangle's pages are found by rastering it in
UV), level of detail is the author's, normals need welding rules, seams are wherever the author put them, and a
painting no longer has a rectangle the author can picture.

**Which of these an AI author can use well** (data from what the 20 scenes' authors already did):
- They wrote tables of a few numbers a thing and let code place it: `HOUSES` (Полёт, 41 assemblies), `CHURCH`
  (three frames, a tier, a drum, a cupola by sizes), dzhungli's `tower: [[2.1, 0], [1.75, 3.6], [0.85, 6.0]]` —
  half-width and height by stage. That last line IS a profile for `revolve` / `loft`. A profile of 3–12 points
  and a handful of ribs is the kind of data they produce reliably.
- They generated geometry by tools where it repeated (the arcade's 187 elements, the ship's 22, the forest).
- Nothing in the 20 scenes is a list of vertices and triangles, and nothing has UVs. Writing a triangle list
  blind — winding, shared vertices, a UV unwrap that matches a painting — is what language models do poorly, and
  the faults (a hole, a flipped face, a stretched patch) show only in a render.
- `lump` asks least of an author (an outline, a height, a seed) and `loft` most (ribs that must agree along the
  hull). A hull's ribs are the one place in L2a where an author can produce a plausible-looking table that makes
  an ugly boat.

**What can no longer be guaranteed by construction (L2a).** Paint stretches where the surface curves two ways
(bounded by the constructor, not zero: a `revolve` narrows to a pole; a `lump`'s steep sides are stretched as
the land's are). The outline is faceted at some size. The two looks (lit round forms, painted flat sheets) agree
only by the authors' care. With L2b, in addition: that pages can be asked cheaply, that a seam is closed, that
the cost of a thing is bounded by its kind.

### L3 — imported models

A file (glTF) made elsewhere: triangles, UVs, its own pictures, often its own materials, sometimes bones.

- *Where it comes from*: no part of moood makes one. The scenes' authors are agents that write code and numbers;
  a model is a binary made in a modelling tool or by another generator. The world's repository would hold binary
  files of megabytes; the scene's opening would fetch them (5.21: a new leg); the render machine gets them with
  the scene.
- *Tables, pipelines*: a model is not a sheet. Its own vertex layout (position, normal, UV, perhaps skin), its own
  buffers, its own family of pipelines × passes (solid, cast, mask, mirrored): + 8–12; a pass list per material.
- *Its pictures*: either a second kind of texture outside the page cache (its own memory account, its own mips,
  upload at the opening) — or each picture becomes a sheet whose recording is one image (SH7: a recording may
  carry images), which keeps one cache but then the ask must find which pages a triangle soup needs: by rastering
  triangles in UV space on the thread, or by asking everything coarse. Rule 3 does not survive whole.
- *Light*: its normals and its materials against a light model made for painted sheets (light at vertices, two
  key lights a pixel, no speculars): a model is either relit flat by our model (and looks unlike its source) or
  brings shading the engine does not have.
- *Translucent parts, people on it, points*: each needs its own rule; points would be named nodes of the file.
- *Size*: a loader (glTF with its extensions, or three's — section 5), a mesh family in RENDER, memory and
  opening accounts, the service's bundling, the language, a source of models and their licences. ≈ 2500–4000
  lines and a new area's worth of decisions: 12–20 % of the engine, every area touched.
- *Cannot be guaranteed*: cost by construction (a file has whatever it has), one look, pages by formula, "the
  scene is code an agent wrote and can edit".

---

## 2. What would likely need fixing after the first run

| | L1 bent sheets | L2a constructors | L2b raw triangles | L3 models |
|---|---|---|---|---|
| seams | none (one sheet; a tube's join is a line of the painting — its two edges must be painted to meet) | the join of a closed form (`revolve` 360°, a hull's keel line with `mirror`): the page border (8 px) covers the filter, but the PAINT must meet — authors will leave visible joins; a pole where a profile reaches radius 0 pinches | wherever the author put them; cracks between triangles that do not share vertices | the file's; usually clean |
| paint stretching | none (bent one way: length is kept) | on `lump`'s steep sides (as the land's drapes); near a `revolve`'s pole; along a hull where ribs differ much in girth | arbitrary | the file's |
| sharpness at grazing angles | a tube's edges go soft with one tap; the 2-tap rule of planes extended to forms | the same on every outline of every form; the level changes fast across one grid cell — shimmer on small forms far off (the same question as 11.17's tops) | the same | own mips |
| depth fighting against sheets | where a bent sheet touches a flat one of the same thing (a vault meeting its wall): the half-centimetre offsets the scenes use today stay needed | the same, plus sheets laid ON a form (a name on a hull, a rope on a rock): a flat sheet cannot lie on a curve — it floats or cuts in; authors will ask for decals | the same | the same |
| faceted outline | visible on big arcs near the eye until the grid is chosen by size on screen | the main look fault to expect: hull and rock outlines against the sky; needs the level of detail tuned, perhaps 33 × 33 is not enough for a hull filling the frame | author's | the file's |
| shadow acne | none (no self-shadow) | none on itself (by the rule); a form's shadow on a form touching it (a boat on a rock) at grazing light: bias to tune | the same | the same |
| light | the bend is shaded once the normal varies; a painting that also shades itself is shaded twice — scene by scene | the same, stronger; forms look "3D" beside painted sheets — a look question the owner will judge | the same | unlike everything else |
| cost | none expected | vertex work: 33 × 33 a form × views (frame, mirrors, shadow cells) — a harbour of 20 boats ≈ 22 000 vertices a view, inside 5.12's 120 000 lit points; the texture read in every quad's vertex stage on phones (unmeasured) | unbounded by kind | unbounded |
| order | a mixed sheet bent past half a turn refused — authors meet the refusal | authors want glass, nets, sails as forms — refused; sails stay sheets with their cloth shader | the same | the same |

---

## 3. Misuse by scene-drawing agents

What they would do, by what they have already done in the 20 scenes:

1. **Everything becomes a form.** Trees as revolved trunks with lumps for crowns, clouds as lumps, people's
   props, every stone. The forest scene has 298 crowns and 87 stones; as forms that is 400 grids and 400
   paintings on forms where cards do. (Now: 1462 of 1935 painted elements come from templates.)
2. **Count.** A generator loop makes hundreds (the arcade: 187 elements for 17 arches; Полёт: 529 objects).
3. **Detail by geometry instead of paint**: planks as separate extrusions, window frames as forms, a rope as a
   tube — where the engine's way is one painting.
4. **Raw triangles (L2b) as an escape hatch**: once it exists, anything is built with it, heads and bodies too —
   a second people system written by scenes.
5. **Imitating what forms cannot do**: translucent forms faked by many thin shells; holes faked by forms round
   them; forms animated by remaking the grid every frame (a "repaint while playing", 5.12's last row).
6. **Double shading**: painting light and volume into a sheet that the engine then lights as a volume.
7. **L3**: models taken from anywhere, of any size and licence; a scene that no agent can edit afterwards.

What the engine can close by construction, and what it cannot:

| | By construction | Only by the authors' principles and the guidance |
|---|---|---|
| tessellation | the engine chooses N × M (≤ 33) by the form's size; the author cannot give it | — |
| a form's cost | bounded by its kind: one sheet, one grid | how many forms a scene has (a guidance row, as "quads in the world 3000"; no gate — W7) |
| profile and rib sizes | caps in the spec (points a profile, ribs a loft): over the cap is an error of the build (LG13) | whether a thing should be a form at all |
| translucency, holes | refused at the build (solid only) | not faking them with shells |
| grids remade | a grid is made at a make, not in animate — an animate has no call that changes it | a key that drives remakes every frame (the stand shows it) |
| raw triangles | not offered (L2a without L2b) | — |
| double shading | nothing | the language's text: "a form's painting carries colour and pattern, not light" |
| "a round thing painted on a flat sheet is still the first way" | nothing | the principle (LG14's wider one): the medium is painted sheets; a form is for what turns in view or is walked round |

---

## 4. The 20 scenes: what would use it today, and whether an edit would be forced

Read in the sources (`study-src`), not only in the study:

| Scene | The thing | Built now as | Would use | Forced? |
|---|---|---|---|---|
| Ашеры «Мэдлин проходит» | 17 arches' curved undersides | 4 + 4 flat tilted strips an arch: 136 elements (38 distinct pictures), by `tools/medlin-prokhodit-gen.js` | L1 `arc`: 17 bent sheets (or 34 halves) — 119 elements fewer | no (LG14 is what touches it now; with L1 the generator makes it one edit) |
| «Диканька» — the church | three log frames, a tier, a **square** drum (4 walls), a cupola as a **four-sided hipped pyramid** (`hip(g, side, 4.3 → 0.43, 3)`), a cross: 54 faces | flat faces, four to a storey | nothing needed: it is a flat assembly, not an imitation of a curve. A round drum and an onion dome would be `revolve` | no |
| «Диканька» — the well | a wattle box 0.96 m square and its snow | flat faces; the crane's round poles are a card facing the eye | nothing | no |
| dzhungli — the temple tower | two stages, three faces each (`tower_front_lo` …), trapezoids leaning in | flat faces: a square tapering tower | nothing | no |
| «Полёт» — the windmill | a log tower of 4 walls, a roof of 4, sails as one layer | flat faces | nothing | no |
| Алые паруса — the `secret` (main, dom-longrena) | hull of **7 flat plates** (side, bow, quarter × 2, transom) "each face seen, the light falls by its turn" (`korabli.md`), 2 deck planes, a break, rig and masts as cards, 9 sails as sheets with the cloth shader: 22 elements by `tools/korabl.js` | a flat assembly that stands for a curved hull with three plates a side | L2a `loft`: the 7 plates → 1 form; decks stay planes (people walk them), sails stay sheets (translucent, own shader), masts could be `tube`s or stay cards | no; by LG14 as written she is on the border — three plates a side is an assembly, not "many thin facets" |
| Алые паруса — «Палуба» | the same ship from on board; 33 paintings serving two ships; square sails as two half cards hinged at the mast | flat assembly | the hull's inside seen from the deck would be a form's inside (the two-paintings question of L2a) | no |
| Вокруг света — «Гавань»: the steamer, the pilot boat | things of cards on unseen anchors: `steamer_hull`, `_bow`, `_stern`, `_house`, `_rig`, `_funnel`, `_deck` (6–7 cards each) | flat assembly; the funnel is a card | `loft` for the hulls, `tube` for the funnel | no |
| «Гавань»: 11 small craft | one flat card each with a `boat` layer that bobs and rolls (4 of them sail across an 824 m box) | a picture of a boat | nothing forced; as forms they are 11 lofts seen from one side at 20–400 m — where a card does the same | no |
| «Лес у моря»: stones | 87 parts of one card (`stones`), a function of a seed | painted | `lump` only if the camera goes round them; it does (the scene's note: "a film's camera looks round") | no |
| Ашеры «Подъезд»: the horse | one flat card of 133 layers with its own projection tilted by `camera_z` | volume imitated inside a painting | not a form of L1 / L2a (it is jointed and animated: that is the people system's kind of thing) | no |

Summary: **one** scene has a curve imitated by facets (the arcade) and L1 covers it; the four "undecided" things
are square assemblies — not imitations; the ships and boats are flat assemblies that L2a's `loft` would replace
(1 form for 7 plates) but nothing forces it. No level forces an edit of any scene. If forms existed and were then
used in the 20 scenes, the candidates are 3–4 scenes (the arcade; the `secret` in three scenes through one tool;
the harbour's steamer and pilot boat).

---

## 5. three.js: what would actually be used without its renderer — facts

The engine as revision 3 has it holds no three.js (1.1 rule 2): the reason was the renderer (it cannot carry raw
shaders; its objects are not tables). What three has besides the renderer, by level:

| Level | What of three would be used | What comes with it |
|---|---|---|
| L1 | nothing: a bend is one formula in WGSL and once in JS | — |
| L2a | the idea of three geometry builders: `LatheGeometry` (revolve), `TubeGeometry` / `ExtrudeGeometry` (extrude along a path, with `Curve` classes and, for caps, the `Earcut` triangulator). Each builder is a few hundred lines; each returns a `BufferGeometry` — three's own container (attributes, groups, bounding volumes) — with normals and a UV. There is no loft and no lump among them (`ParametricGeometry`, in the examples folder, is the nearest: a function (u, v) → point on a grid — which is L2a's whole mechanism in ≈ 100 lines) | `BufferGeometry` + `BufferAttribute` + the maths classes (`Vector3`, `Matrix4`, `Box3`, `Sphere`, …). The engine's grids are plain typed arrays with u, v fixed by the grid; three's builders give indexed triangle soups whose UVs are not by surface length, so their output would be converted back to a grid. The engine's mathematics is its own (`world/m34.js`); three's maths would be a second set of vector types |
| L2b | `BufferGeometry` utilities: `computeVertexNormals`, `mergeVertices`, `toTrianglesDrawMode` (`BufferGeometryUtils`, examples folder) | the same container and maths |
| L3 | `GLTFLoader` (examples folder) — the one substantial thing: it parses glTF and its extensions into three's objects (`Mesh`, `BufferGeometry`, `Material`s, `Texture`s, `Skeleton`, `AnimationClip`); for compressed files it needs `DRACOLoader` / `MeshoptDecoder` / `KTX2Loader` with their WebAssembly decoders | it does not run without three's core: its output IS three's scene graph, from which our tables, buffers and sheets would be filled, the materials dropped. Its texture loading uses `ImageBitmapLoader` (works in a worker) |

Sizes that could be read here: the present build of all of three r186 for engine 2 (engine 2 (gone),
minified by esbuild) is **750 013 bytes**; engine 1's cut (`engines/1/three.js`) is 540 783 bytes. Since r171
three's package splits the build into a core (everything but renderers) and the renderers; the core alone is
roughly half of the whole — not measured here (no `node_modules` in the trees I could read). `GLTFLoader.js` is
about 4.7 thousand lines of source, `BufferGeometryUtils.js` about 1.4 thousand, the geometry builders 150–800
lines each, `Earcut` about 800 — from memory of the r18x sources, not read here.

Facts that bear on "does it make three worth bringing back": at L1 and L2a nothing of three is used as it is
(the builders would be re-read for their arithmetic, as revision 3 already treats main's code — 8.4). At L2b its
utilities save a few hundred lines and bring its container. Only at L3 does three save a large piece of work (a
glTF parser), and there it brings its core (≈ 350–400 KB, estimated) into the scene's thread, and a conversion
from its objects to the engine's tables. Its renderer is not needed at any level and the reason it left stands.

---

## 6. Now or later: what revision 3 would have to shape now so that adding later costs nothing extra

If no form is built in this piece, these are the places where a later L1 / L2a would otherwise force a change of
something revision 3 calls final, or a scene or interface edit:

| # | In revision 3 | Shaped now | Cost now |
|---|---|---|---|
| 1 | `quads` row: 64 bytes, full (4.1) | 80 bytes with 16 spare (`form: vec4u/f` — a bend's numbers, or a grid's place) | 16 bytes × 3000 quads ≈ 48 KB; one line of the layout |
| 2 | quad kinds 0…5 in bits 0–2 of `flags` (4.7) | reserve 6 = `FORM` (and say 7 is free) | none |
| 3 | `frame`'s bindings "final" (4.2), 11 of them; storage buffers at the limit | say now that forms' points would be a TEXTURE in `frame` (binding 11), not a storage buffer; reserve the number | none (the binding is added when built; a bind group layout cannot hold an unused slot for free — so this is a note, not a slot) |
| 4 | SH10 "how a quad is asked": rect placed by WT7, clipped, level by 4.8 | SHEETS writes ONE descent that calls `place` point by point for every kind (DRAPE already needs it) and uses the flat shortcut only as a named fast path for CARD / PLANE / FACING; `place`'s signature stays as it is (it is already point-wise) | none: it is how DRAPE must be done anyway — but it must be said, or SHEETS will write the flat case as the general one |
| 5 | the normal of a quad: a constant (RENDER's light) | the light functions take the normal as an argument from the vertex stage (a constant for flat kinds) instead of reading it from the node's matrix inside | none in cost; a rule for RENDER's chunks |
| 6 | `quadPoint` / `quadWorld` (WT6) | a third function `quadNormal(q, uv) -> vec3f` in SCENE's chunk, constant today | a few lines |
| 7 | 5.17's lists: "solid = wholly opaque sheet and …" | add the sentence "a quad that can cover itself is drawn solid or refused" — true vacuously today | none |
| 11 | (only if B may come) a form's record and ask | the four choices of section "A and B": (u, v) stored per point, the ask over triangles, picking by triangles, a "soup" shape | inside A when A is built; nothing before |
| 8 | the shapes buffer: `FLAT`, `COLUMN`, `MID`, `FINE`, `GRID` (5.12) | the corner's (i, j) recoverable from `corner` for `MID` and `FINE` (they are regular grids: yes if `corner` is the uv) | none |
| 9 | picking and `world.pointOf` (WT7, WT8) | both go through `place` only (no second copy of the flat arithmetic elsewhere) | none |
| 10 | the language: LG14's text "curved surfaces are not supported" | worded as "not supported now; can come" — it is already on `dropped.md`'s list | none |

Not needed now even if forms come later: any pipeline key, pass, tier row, or message. L2b and L3 cannot be
prepared for cheaply: they need their own vertex layout and family of pipelines whenever they come.

If L1 were built NOW instead: the 300–500 lines above inside SCENE, SHEETS, RENDER and LANGUAGE's specs, rows 1–9
done as part of it, and the arcade's edit added to 5.20 (one generator). If L2a were built now: the 1000–1400
lines, a change of 4.2's final layout, the look question of lit forms beside painted sheets added to section 7's
"may cross" items, and — by W8 — one more family in the one whole-set check. Either adds no pass and (shared
stage) no pipeline; neither changes the frame's account for the worse.

---

## 7. Cheap and dear, named

- **Cheap**: L1 (≈ 2 % of the engine, no new pipeline, pass or buffer; covers the one imitation the scenes have).
  Section 6's ten shapings (near nothing now; they keep L1 / L2a additive later).
- **Middling**: A = L2a, a form as a function with the constructors on top (≈ 5–7 %; five areas; one change to a final layout; forms are solid only — no glass, no
  holes, no soft outline; boats and rocks are within it; its dear part is not code but the look — lit volumes
  beside painted sheets — and teaching agents five constructors without the misuse of section 3).
- **Cheap on top of A if A is shaped for it** (four choices, section "A and B"): B, raw triangles — ≈ 150–250 lines, no pipeline; what it costs is not code but guarantees (detail and cost by construction, a tight ask, the mapping) and it is the level agents use worst. **Dear** if A was built without those choices (+ 600–900 lines, own pipelines).
- **Dear**:
  L3 (≈ 12–20 %, every area, rule 3 and "a scene is code an agent wrote" given up, and the only level at which
  three.js saves real work — its glTF loader with its core).

## Unchecked

1. Every line count is an estimate by reading the design, not by writing code.
2. three's file sizes other than the two builds measured; the size of its core build alone.
3. The cost of a `textureLoad` in the vertex stage of every quad pipeline on Mali and Adreno (L2a's shared stage).
4. Whether 33 × 33 points are enough for a hull that fills the frame; whether light at the grid's vertices is
   smooth enough on it.
5. How well an agent writes a hull's ribs: nothing in the 20 scenes is a loft; the nearest things are tables of
   half-widths by height.
6. The scenes were read for the things named in section 4; a thing imitating a curve in a scene's paint code
   that the study did not name could have been missed.

---

# Part 2. Picking — the design I would put into revision 4

Not yet in `architecture.md`. Read, not run: revision 3 keeps main's model (PG4 `pick`, `pickSpec`; PP5
`people.pick(origin, way)`; SH4 `sheets.coverage`; `ids` written by people only), so it does not meet the
requirement. The fault of that model is one: "where a thing is and whether it is there" is worked out a second
time, apart from the picture (a ray, a plane at rest, a coverage threshold, capsules) — and the second answer
differs from the first for own shaders, moved layers, soft paint, things on the frame, people's outlines.

**The rule: one source.** Where a thing is on the screen comes only from what draws it — RENDER's placing of that
frame, and the pixels themselves. Two cases, one way each; no ray model of the scene is left for pressing.

## P1. What the game offers to press — real buttons of the page, placed by the frame

- A thing offered (`offer`: an element, a part of it, a person, a point; in the world or on the frame — a sky
  sheet, an insert) gets **one invisible HTML `<button>` in the page's layer over the scene**. The browser then
  does what it does for every button: the hand cursor, hover, touch, the keyboard, any window size and zoom, and
  the press arrives at once, in the page, with no question to the thread.
- **Where the button lies** is told by the thread in the `frame` message, as tracked points are now (PG5): for
  each offered thing its box on the screen — `[x, y, w, h, depth]` in CSS px. The box is RENDER's: the screen box
  of what it drew of that thing in this frame's view — the painted extent of its shown quads after their layers'
  poses (for a person: PP5's box; for a form: its grid's box), through the same matrices as the draw. It is
  computed for the offered things only (a handful), in the cull RENDER already does.
- The page grows a box to **at least 44 × 44 CSS px** about its middle (so the knot of «Трещина», whose dense
  paint is about 1 % of the frame's height, is a finger-sized target) and clips it to the stage. Boxes that
  overlap are stacked by `depth`, nearest on top. A thing out of the frame has no button.
- **Offered means pressable**: the button is there whether or not something stands in front of the thing; the
  offered glow (drawn by RENDER from the same `f.highlight`, by the same quads) shows through, so what glows is
  what presses. Hover is the page's: it tells the thread which offer is under the pointer, for the glow only.
- The action menu, speech pop-ups and widgets are already placed this way; this makes offers the same kind.
- **Cost a frame**: a box for each offered thing (eight corners through one matrix) and five numbers in the
  `frame` message when they changed; on the page a transform on a few elements. No GPU work, no read-back, no
  request per pointer move (main asks the thread every 120 ms while the mouse moves; that goes).

## P2. The author's selection — the picture's own ids, read at one point

- The editor asks "what is under this pixel" (`pick`, `pickSpec`, the hover outline). The answer is taken from
  the GPU: **a `pick` pass, drawn only when asked**, with the frame's own lists, tables and `View` — the same
  vertex stages, the same sheets and pages, the same own shaders, people as their real outline — into a target of
  ids (`r32uint`: element, part or layer, kind) with a scissor of one pixel at the pointer. Solid things write
  with depth; then the blended list in its order, a fragment writing its id where the alpha it would have drawn
  is above a small threshold (one constant, `PICK.ALPHA`) — so the last writer is the topmost paint the eye sees
  there. Sky sheets, inserts, particles' emitters, glass, forms: all are in the lists, so all are pickable.
- One pixel is copied to a buffer and read (`mapAsync`): the answer comes a frame or two later and is the answer
  for the frame that was on the screen at the click (the pass is drawn in the click's tick, before anything
  steps). Hover in the editor: at most one such pass a frame while the pointer moves.
- **Cost**: nothing in a frame nobody picks in. A pick: the frame's vertex work once more and one pixel of
  fragment work. Memory: one `r32uint` target of the frame's size, made only when the page is an editor
  (≈ 6 MB at 1600 × 900). Pipelines: a `pick` variant of the quad, own-shader and person pipelines, asked by
  `lib.all` only with `has.pick` (an editor's page) — a viewer's and a game's page compile none of them.
- Why not write ids for everything in the main passes, always: an integer target cannot blend, a blended pipeline
  may drop a fragment only at alpha 0 (4.6), so soft glows would own their pixels; and it would add 4 bytes a
  blended pixel to every frame of every viewer. `ids` stays what it is in revision 3 (people's lines).

## What leaves, what changes (for revision 4)

- Gone: `world.raycast` as a way to find a thing, SH4 `sheets.coverage` and the top's mask sent for it,
  `people.pick` (PP5), the page's timed `pick` requests, the kinds skipped by the search (sky, insert).
- Kept, because it is geometry and not "what is seen": `ground` (where on the land or a floor a press lands —
  the hero's way).
- Changed entries: PG4 (`offer` takes the things; `pick`, `pickSpec` answered by P2), PG5 (`offers`: the boxes),
  RN4 (`f.offered`; R fills the boxes; `f.pick: { x, y } | null`), 4.3–4.5 (the `pick` target, pass and variants,
  only with `has.pick`), 4.7 (`PICK.ALPHA`, `PRESS.LEAST` 44 px), PAGE's `select.js` / `actions.js`, the stand's
  rows untouched.
- Size: ≈ 300–450 lines (RENDER: boxes, the pass and variants; SCENE: messages, the read-back; PAGE: the buttons,
  the editor's use) against what is deleted (the ray, the coverage masks, capsule picking) — about even.

## What the viewer and the author get

- The viewer: every offered thing is a button — pressable by finger and mouse on any device and window, with the
  hand cursor at once, never smaller than a finger, wherever the thing is and however it is drawn or moves; the
  press is taken in the frame it was made in. «Трещина»'s knot becomes pressable with no edit of the scene.
- The author (the editor): a click selects exactly the topmost thing painted under the pointer, as seen — its own
  shader, its moved layers, a person's outline, a sheet on the frame.
- The price, named: an offered thing's press area is a box, not its outline (two offered things whose boxes
  overlap are told apart by which is nearer, not by paint); a press on something NOT offered is not a press on a
  thing at all in a game (if a game needs "press anywhere on X", it offers X); the editor's answer comes a frame
  or two after the click.

Unchecked: that `mapAsync` of one pixel answers within a frame or two on the reference devices; that a scissored
pass over the frame's lists costs only its vertex work on tile GPUs; which uses of `pick` outside the editor
exist in the games and the site (read: `select.js`, `actions.js`, the Asher game's `hub.offer` — not every game).
