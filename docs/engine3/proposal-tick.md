# Engine 3 — the scene thread's tick: where the time goes, and how to bring it to the plan's limits

Steps 1–4 are built (branch `e3-tick`; what was done and measured: the studio's history) — section 1
describes the engine before them; what is left is D, E, F and the allocation.

A proposal, not code. Written 2026-10-13 from the stand's breakdown (branch `e3-measure`, afe6072;
`engine3-renders/<scene>/e3-stand-parts.json`), from reading `sheets/ask.js`, `sheets/cache.js`,
`render/renderer.js`, `render/quads.js`, and from counts taken in the offline harness (the real `thread.js` in node,
no pixels; the engine copied and counters added to the copy — nothing of it is in the repository). The plan's limits:
scene thread ≤ 3 ms median a tick, ≤ 1 KB allocated a frame, 60 frames a second with a margin on weak devices.

Numbers marked **T4** are the stand's (desktop profile, film, drawn ticks, median ms). Numbers marked **harness** are
counts a tick on the machine it ran on; counts are the same on any machine, milliseconds are not.

## 1. What the asks do each tick, and why it costs this

**What an ask is.** For every view (the frame's, the view the camera moves to, each shot ahead with its mirrors and
shadow cells, each mirror, each static shadow cell due) the thread works out which pages of which sheets that view
reads. For every quad in the view's list it places the sheet's corners in the view, cuts the piece by the view's
sides, works out the level the screen needs at the corners (three placings a corner: the point and two points a small
step away), names the pages, and goes down into the four quarters wherever a finer level is needed. A flat quad (a
card, a plane) costs four placings and then only arithmetic between its corners. A curved one — **the sky, a plane
draped on the land** — is placed point by point through `place()` at every node: four corners, four side middles, the
middle, and three placings for each level sample. That is 15–40 calls of `place` a node, and for a draped plane each
ends in the scene's own land function.

**The plan already says "ask only when something changed"** (SH10), and the code does it — but the test is by the
whole view: a view is asked anew when its camera, size or list is another, or **when any one quad in its list had a
row stamped since the last ask** (`e.touched`). Then every quad of the view is worked out again, the sky included.

**Counts (harness, a tick that asks, film):**

| scene | views asked | of them anew | anew because: camera · a listed row stamped | quads worked out | nodes | calls of `place` | of them the sky's · the draped land's | pages named |
|---|--:|--:|---|--:|--:|--:|---|--:|
| main | 34 | 24 | 2 · 24 | 530 | 3 900 | 20 400 | 88 % · — | 3 070 |
| gavan | 4–10 | 3–8 | 0.3–3.7 · 3–7 | 410–800 | 2 600–4 600 | 18 000–34 000 | 91 % · — | 1 600–3 000 |
| iz-okna-poezda (first minute) | 3.4 | 1.7 | 1.7 · 0.2 | 47 | 3 350 | 50 600 | 85 % · 12 % | 1 990 |
| sevil-rou | 34 | 13.5 | 5 · 8 | 440–510 | 1 700–2 100 | 8 900–11 100 | 70 % · — | 1 160–1 390 |

(dzhungli was not counted: the harness runs it only at the weak tier. It must be counted on the stand: step 0.)

So the cost is, in this order:

1. **The sky.** 70–91 % of all placings are the sky's, in every scene counted. Its sheet is large, it is curved, so
   its descent begins at the top and places every node point by point; and it is in the list of nearly every view.
2. **Whole views asked anew for one stamped row.** In main 24 views are asked anew every tick while only 2 cameras
   moved.
3. **The number of views**: a shot ahead brings its own view, its mirrors' and its shadow cells' — main asks 34 views
   a tick.

**Oddity 1 — main asks 24 views anew every tick with a steady camera.** Measured: the cause is `touched`, not the
camera. Six elements have rows stamped every tick — `clock` (57 % of the stamped quads), `table`, `crowd`,
`fogg_chair`, `armchair`, `felt`; 29 % of the listed quads are stamped ones. Each of them stands in most views' lists,
so every such view is asked anew — all 530 quads and the sky, 24 times over — though the pages of the clock alone
could have changed. Not yet known: whether `table`, `armchair` and `felt` really move every tick or are stamped with
values that did not change (to be looked at in step 1: a row is stamped only when a number in it is another, but
their animates may write a number that jitters).

**Oddity 2 — iz-okna-poezda: 2 views a tick cost 23 ms.** Measured: 1.7 views anew (the camera rides, so it is
another every tick), only 47 quads — and 50 600 calls of `place`, 85 % of them the sky's and 12 % the draped land's.
The cost is the point-by-point descent of two curved quads, 3 350 nodes at about 15 placings each. The train's
camera does not turn while it rides straight: the sky it sees is the same sky every tick, and it is worked out again
every tick because the eye moved.

**What is still to be measured on the stand** (T4 milliseconds cannot be had from the harness): the `ask` stage split
by the kind of quad (sky · draped · flat · form · read whole), with nodes, placings and pages named a tick; views
asked / anew by cause (camera, stamped row, list, size, swaps, the cache's pressure). These are the counters used
above; they belong in `render/timing.js` beside the rows of `e3-measure` (step 0).

## 2. The options for the asks

Milliseconds are estimates of `ask` + `ask ahead` + `ask mirrors` on T4 (now: main 12 · dzhungli ≥ 9 · gavan 6–8 ·
iz-okna-poezda 23 · sevil-rou 3), from the counts above. Each is to be confirmed by its own stand run.

**A. A quad is asked again only when what its pages depend on changed** (SH10 made finer: by quad, not by view).
A view keeps what each quad of its list named. A tick the view's camera, size and bias stand, only the quads whose
own rows (node, layer, sheet, swap) were stamped are worked out again; the others' pages are named again uncomputed.
- Design: SH10's rule ("what it named last is named again while nothing it was worked out from changed") stays; its
  grain changes. `cache.js` keeps a view's names by quad; `quads.js` tells which listed quads were stamped, not only
  that one was; `renderer.js` `ask` passes that on. Plan: SH10, 2.1 step 8f, 3.4's test.
- Brings: main 12 → about 2 (22 of 24 views work out a handful of flat quads instead of 530 and the sky); gavan
  6–8 → about 1.5 in the film (the boats rock, the camera mostly stands); sevil-rou 3 → about 1.5. Nothing for a
  camera that moves every tick (the train, a zoom, a drag).
- Risk: none to the picture if the dependency list is right — the pages named are the same pages. The risk is a
  dependency missed (a quad read through another's node, an own shader's further sheets, wind bound, the land's
  height under a draped quad): a page then comes late. Guard: the old ask kept in the harness and run beside the new
  one over the five films, as batch 2 did (0 differing names in 9.9 million then).
- Size: medium (three files, the comparison harness exists).

**B. The sky asked by what it depends on.** A sky's pages depend on the camera's turn, its projection and the
view's size — not on where the eye stands. With A in place this is one more line of the dependency list: a camera
that moved without turning does not ask its sky again.
- Brings: iz-okna-poezda 23 → about 4 while the train rides straight (the draped land is left); the same for any
  travelling shot. Nothing while the camera turns.
- Risk: none (exact). Size: small, after A.

**C. A cheaper descent for curved quads.** Three changes inside `ask.js`, no contract touched:
  1. *Points shared.* A node's corners are its neighbours' corners, its side middles and its middle are its
     children's corners. Kept on a lattice a level (typed arrays, stamped a view), each point is placed once, not up
     to six times.
  2. *The level from one placing.* Today a level sample is three placings (finite differences). For a sky the level
     follows from the direction and the sheet's mapping in closed form; for a draped plane from the lattice's own
     neighbouring points. One placing a sample, or none.
  3. *A start below the top.* A curved quad's descent begins at the level where what is seen of it is a few pages,
     as a flat piece's already does, not at the sheet's top.
- Brings: 4–6 times fewer placings a curved node. iz-okna-poezda while turning 23 → 4–5; gavan's zoom and drag
  (ask 12 + ask ahead 9) → about 5; dzhungli's zoom (ask 15.7) → to be seen after step 0 (its share of sky and
  draped land is not measured).
- Risk: the level worked out a little differently at a node's corner names a page one level off at a boundary — a
  patch a hair softer or a page asked a tick late. The slack (an eighth of a level) is there for this; the
  side-by-side run counts every differing name, and a film rendered before and after shows it.
- Size: medium (one file, the hardest arithmetic of the three).

**D. A camera that moved less than the guard is not asked anew.** A view is asked two pixels wider than it is and
its levels an eighth wider (GUARD, SLACK) so that a pixel's own rounding never misses a page. The same margin can
carry a camera that breathes: the view remembers the camera it was asked with, and is asked anew only when the new
camera moves any point by more than the guard (a turn: angle × focal length; a shift: by the nearest listed quad's
depth, which the cull knows).
- Design: SH10's `changed` for a camera becomes "moved past the guard"; the guard is then spent partly on motion —
  the plan must say how it is shared (e.g. half for rounding, half for motion). Plan: SH10, 4.8, `views.js`
  `sameCamera`'s use in `renderer.js` `ask`.
- Brings: the views of a camera that follows a head that breathes or a boat that rocks (main's 2, sevil-rou's 5, the
  shots ahead that frame a person: `ask ahead` 5.7 in main, 3.1 in sevil-rou) are asked every few ticks, not every
  tick: together with A, main → about 1, sevil-rou → under 1.
- Risk: a page at the very edge of the frame named up to a pixel later than now — where the margin's pages (an
  eighth of the view, already asked for a moving frame) are usually there. To be looked at in a film with a slow pan.
- Size: small. It is the one option that changes when a page is named, so it goes last and alone.

**E. Fewer views.** Not asked for speed alone; noted because the count multiplies everything: a static shadow
cell's view names the same pages until a caster in it moves (it is asked anew today whenever any row of the world
that may stand in a cell is stamped — the same too-coarse test as A's, and A's per-quad rule cures it); a shot ahead
that only differs from the frame by its camera could share the frame's shadow cells' asks. To be decided after A,
with the per-view rows of step 0.

**F. Another division of the work — the asks on a thread of their own.** The descent needs only the tables' rows and
the cameras; it could run in a worker and hand back names. It would take the asks off the tick altogether.
- Design: a large change — the plan has the asks on the scene's thread, synchronously, before the pages are
  requested (2.1 step 8f–g; SH10–SH12; "no read-back"); the names would come a tick late, the whole-frame rounds
  (repeat until the pressure stands) would need a protocol, the land function would have to run in that worker too.
- Risk: pages a tick later after every cut and under motion; two copies of the tables kept in step.
- Size: large. **Not recommended** unless A–D leave a scene over the limit: they remove work, this only moves it.

## 3. Recommendation and order

Each step ends with a stand run (T4, the five scenes, three profiles) and the side-by-side name comparison in the
harness; each is judged by the row named.

0. **Measure finer** (merge `e3-measure`; rows: `ask` by kind of quad; nodes, placings, pages named; views asked /
   anew by cause; the same for `ask ahead` and `ask mirrors`; dzhungli's split). No behaviour change. Judged by: the
   rows exist and sum to `ask`.
1. **A — by quad.** Judged by: main's `ask` + `ask ahead` ≤ 3 ms, "views anew" in main ≈ the cameras that moved;
   0 differing names. Also answers why `table`, `armchair`, `felt` are stamped every tick.
2. **B — the sky by the camera's turn.** Judged by: iz-okna-poezda's `ask` in the film ≤ 5 ms; 0 differing names.
3. **C — the cheaper curved descent.** Judged by: placings a curved node ≤ 4; zoom / drag segments of gavan and
   iz-okna-poezda ≤ 5 ms of asks; differing names counted and each kind explained; a film before and after.
4. **The culls by the same rule** (section 4), then **the allocation sweep of `R.frame`**.
5. **D — the guard spent on motion**, alone, with a film looked at.
6. Only if a scene is still over 3 ms: E, then F.

Expected after steps 1–3, film, T4: main ≈ 2 ms of asks (tick ≈ 5), gavan ≈ 1.5, sevil-rou ≈ 1.5, iz-okna-poezda
≈ 4 riding straight, dzhungli unknown until step 0. After 4–5 the film ticks of four scenes should be at or near the
limit; zoom and drag will still be above it (every quad is worked out again every tick by right) — how far above is
what step 3's rows will say, and whether F is needed is decided then, not now.

## 4. The rest of the tick

**The culls** (`cull shadows` 2.2 ms in dzhungli; `cull ahead` 2.3 ms in sevil-rou; quads in the world / listed by
the culls a tick: 531 / 3 406 in dzhungli). A view that is only asked is culled again whenever *any* row of the
world was stamped (`renderer.js` `listed`: `e.seenRows === stamps.rows`) — the same too-coarse test. The right rule:
a view whose camera stands is culled again only when a stamped quad is in its list or its sphere now enters the
view; the tables already keep the lists of rows changed in a tick (`quads.changed`, `nodes.changed`), so the test
is the changed quads against each view, not all quads against each view. Brings the culls of standing views to
near nothing; a moving view is culled whole, as now. Plan: 2.1 step 8e, `views.js`' header. Size: small–medium.
Risk: a dependency missed (the land's reach, the look's wind bound are already in the test and stay).

**The allocation left.**
- *In `R.frame`* (42–118 KB a tick on the stand): the same four causes found in PEOPLE (history, 2026-10-11: a
  number handed to or back from a function; a function with a function inside that shares its arguments; a number
  read from a record's field where records of several shapes pass; a rare heavy branch inside a hot function). By
  the harness's heap profile the places are `sheets/cache.js` `ask`, `world/place.js:83` `place`, `render/quads.js`
  `cull` (:463), `sphereOf` (:250), `edgeOf` (:346), `render/views.js` `mirrorCamera` (:61), `ahead` (:131),
  `render/lights.js` `choose` (:180), `render/shadows.js` `blobs`, `worthOf`, `world/m34.js`, `world/emitters.js`
  `frame`, `gpu/gpu.js` `pass` (a descriptor object a pass). Most of it falls by itself with steps 1–3 (fewer calls);
  what is left is swept function by function with the heap profile, as PEOPLE was. Size: medium. Expected: under
  5 KB a tick in a warm film; the 1 KB limit holds only for code the browser has compiled — the first seconds after
  a scene opens and after a new kind of moment are above it in any JavaScript.
- *In PEOPLE, left by the first pass* (each small): `F.worn` works its rings out at every reading
  (`people/shapes.js:620`, `:1020` — keep them a pose, as `facesNow` does); `F.trunk` makes its arrays at every
  call (`:262` — only when a draw calls it each frame); a person's points are found by name each step
  (`people/people.js:440` — a list beside the names); a motion is found by name eight times a person a tick
  (`people/player.js:302` — kept with the act and the gait); `people.js` `step` and `player.js` `update` are thrown
  back to slow code by rare branches (split as `hang` / `lap` was). Together under 3 KB a tick in a film.
- *Looks built during a film.* A `wear` or a `with` a beat sets builds a model on the scene's thread, megabytes in
  slices — the largest single allocation in main's and dzhungli's films (20–25 KB a tick averaged), and the likely
  feed of the major collections. The right way: a film's looks are known from its beats — built before the film
  plays (the shot's `prepare` already builds and holds what its values name; the film module should prepare the
  next beat's looks, or the build moves to the artist's thread, which already runs the scene's drawing code).
  Plan: PP4, 5.20. Size: medium.
- *The world's cast* (`modules/cast.js`: its own vectors make an array a call, its draws make lists every frame —
  4.5–17.5 KB a tick): content. For the language text (people.md): draw with `MooodShapes.V`, keep sizes and lists
  with `F.keep`. Not the engine's to edit.

**The major collections** (8–19 ms, one or two a film). A pause that long is the old space collected, not the
young. What grows it is not yet measured; the likely feeders, in order: models built during the film (above); the
pages' buffers — every page arrives as a message with typed arrays, megabytes a second while a view fills, counted
by V8 as external memory, which itself starts a major collection; the steady garbage that survives two young
collections. Steps: (a) the stand's GC rows get each collection's cause (the trace has it) and the external memory
at it — one run tells which feeder it is; (b) pages' buffers go back to the painter that sent them and are used
again (a pool: nothing is freed, nothing is counted anew) — plan SH11–SH12, W7; (c) the looks, as above. Expected:
no major collection in a film once (b) and (c) are in; young ones a few a minute at under 1 ms once the tick
allocates a few kilobytes.

**The land, left by the first pass.**
- *Land no field holds* (a shot far from the frame's eye: 480 ticks; a camera that rides: the frame's own field is
  baked one tile a frame, fewer than enter — plan section 7, item 36). The ration protects the tick from the land
  function. The right way is to take the function off the tick: tiles baked on the artist's thread, which already
  has the land function and makes the height field for the rays, and handed over as arrays; a field then fills as
  fast as that thread bakes. Plan: RN4, 4.9, the artist's messages (`land` / `landed`). Size: medium. Brings: a
  shot over new land ready in a second or two instead of eight; the riding camera's finest levels kept up.
- *The shadow of a field ahead* is baked only when the field becomes the frame's — up to 576 tile draws in the
  cut's whole frame (`render/land.js:309`). Where the far lights are the same, a field ahead can bake its shadow
  by the frame's own ration while it waits (the pass is the GPU's; `host.field` points a frame). Brings a lighter
  first frame after a cut over land; to be measured on the stand's cut rows first. Size: small.
