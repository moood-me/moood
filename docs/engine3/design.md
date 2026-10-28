# Engine 3 — the design, as it is

For an agent who must change engine 3 and has an hour. It says what the engine is, how a frame comes about, where
each thing lives, what a change must keep, and what is known to be open. Depth is in `architecture.md` (the plan, the
one source of truth; "plan 2.3" below is its section 2.3); every interface by its id (PG4, SH10…) is in
`contracts.md`, as the code has it.

## 1. What engine 3 is, and why

moood draws scenes in the browser: painted sheets (an element's code paints in Canvas 2D), people, land, sky,
light, all moved by a scene's script and a film. Engines 1 and 2 do it with three.js and WebGL. Engine 3 is a third
engine, on WebGPU, written so that a scene **plays smoothly on weak devices** (a 9th-generation Intel laptop, a
2022 Mali phone) and **looks good by cheap means**: paint is rastered once on the CPU and kept, the frame is a few
forward passes, light per pixel only where it pays.

It stands **beside** engines 1 and 2 (the owner's decision, 2026-10-11). Nothing of theirs is changed: a scene is
engine 3's only when its spec says `"engine": 3`, and every place that chose between 1 and 2 gained a third choice
and nothing else (the seams: plan 1.6). Every NEW scene is engine 3's; a scene that exists keeps its engine. Engine 3
has no three.js and no dependency: the GPU layer, the mathematics (`world/m34.js`, the 4 × 4 forms in
`render/views.js` and the camera's lens) and the kit are its own. It imported nothing from engine 2 (gone from moood since); what
fitted was taken as text (plan 1.7, 8.4).

It runs only where WebGPU is (section 7 of the plan lists what the viewer and the author see differently; the
Android app does not show it). Its pictures are drawn by the studio on a machine with a graphics card.

The design in one breath (plan 1.1, seventeen lines): the world is flat typed tables, the same rows are the GPU's
storage buffers; everything drawn is a sheet laid on a rectangle or a small grid, placed by a formula on the scene's
thread, so the pages a view needs are computed there — no GPU feedback, no read-back; paint code never runs on the
scene's thread; one step function moves time, seen or unseen; time stands while the picture is held, and the picture
is held only where nothing can live meanwhile — a cut that is not ready makes the story wait while the picture lives,
a scene replaced lives on till the next is whole; every cut that can be known is made ready ahead; work in a tick is rationed by count,
never by clock; a closed set of pipelines, built once; one pacer; one device tier decided once.

## 2. The threads

| Thread | Code | Does |
|---|---|---|
| the page | `engines/1/stage.js` (shared by all engines) → `engines/3/page.js` for an engine-3 scene | gathers input into one message a display frame; places the HTML layers (captions, widgets, speech, rings) from the thread's `frame` message; sound; pause when not watched; decides the device tier once; the wait sign; restart after a lost device |
| the scene's thread | `engines/3/thread.js` (a module worker with the OffscreenCanvas) | the loop and the pacer, the step (director, state, tables, animates, people's poses, camera, lights), cull and order, the page asks, the GPU commands, one message a tick to the page |
| the artist (one per scene shown) | `engines/3/sheets/artist.js` | runs every element's paint code into display lists (recordings), and the land's height field |
| painters (`clamp(cores − 3, 1, 4)`) | `engines/3/sheets/painters.js` | raster a 256 px page of a display list in a CPU 2D canvas → its bytes as read, and say if the page is opaque, mixed or empty; the scene's thread writes them and the GPU makes them the cache's colour and half level (`sheets/upload.js`) |
| the GPU | through `engines/3/gpu/gpu.js` | one encoder and one submit a frame |

The scene's thread never runs paint code, never rasters, never reads pixels back, never waits on a timer: slicing is
`turn()` (`base.js`), and pipelines, pages, makes and builds are promises and messages. stage.js stays a classic
script; it loads `page.js` with `import()` when the first engine-3 spec arrives and hands it its closure
(`stageSide(hand)`; plan 1.6 row 1 lists every place).

## 3. One tick, from input to frame

1. The page posts one `{ t: 'in', evs }` a display frame; the thread applies the events in order and steps nothing.
2. The display callback `tick(ts)` asks the pacer (`engines/3/play/pace.js`, plan 5.1) whether this callback runs. The pacer
   runs every n-th callback (n = 1 on a 60–100 Hz display, more on faster ones), halves that rate when frames were
   really lost, and tries the full rate again, with a doubling back-off, when the thread's time and the GPU's time
   of a frame each fit the step (the GPU's by timestamps where the device has them).
3. `step(dt, seen)` (`engines/3/play/step.js`), always in this order: the director (actions, sequences, the film's beats; a cut
   sets its values now — one that waits for its shot stands the whole story till that is ready, the rest of the step
   running on the world's time) → the world's tables from the changed keys (paintings that arrived written in, nodes placed)
   → animates people depend on → `people.frame` → other animates, emitters, camera, sky, lights → on a seen step the
   changed rows flushed to the GPU.
4. `show()`: what must be painted is asked of the artist (rationed: one make in flight an element), each live shot's
   people prepared, and the frame record `f` filled (RN4).
5. `R.frame(f)` (`render/renderer.js`): pages that arrived are placed in the cache; views placed (the frame's, each
   shot's ahead, mirrors, shadow views); cull and order; `sheets.ask(view)` for every view due; `sheets.request()` sends
   what is wanted to the painters; the outcome — **0 held, 1 idle, 2 drawn**; the passes recorded; one submit.
6. One `frame` message to the page if anything in it changed (points projected with this tick's camera). On a held
   tick nothing that places things goes, so page layers never move over a picture that stands.
7. With the stand on, `stand.tick(row)` (`engines/3/stand.js`).

Painters and the artist answer any time; their answers are only kept for the next place / step. Plan 2.1 has the
tick step by step; 1.4 the data flow in one picture.

## 4. The world as tables

The world (`world/world.js`, `world/tables.js`) is flat typed arrays owned by the scene's thread: **nodes** (a place
and turn), **quads** (one drawn rectangle: a sheet shown at a node, with its kind — flat, draped on the land, sky,
form, particle, insert…), **layers**, **lights**, emitters' histories, forms' points. The same rows, less the render
origin, are the GPU's storage buffers, read in WGSL by the chunk `world` (`world/world.wgsl.js`). No scene graph, no
materials, no per-object state on the GPU.

A frame writes only the rows that changed, and a write of the value already there changes nothing. Each write
**stamps** its row with the tick (`tables.js` `since`, `stampedAt`): that one rule is how culls, asks, shadow cells and
mirrors know what to do again and what to skip. `world/place.js` (with its WGSL twin) is the one formula that puts a
point of a sheet into the world for every kind of quad. Layouts with byte offsets: `contracts.md` section 5 (plan
3.4, 4.1).

## 5. Sheets, pages and asks

**A sheet** is what an element's code painted: a display list (`sheets/recorder.js` — the artist records Canvas 2D
calls, it does not raster them) with its rectangle, cut into **pages** of 256 px at each level of detail; the
coarsest level, the **top**, is one small page and is always there. Pages are rastered by the painters on the CPU
(`sheets/page.js`), kept in **one cache texture** (`sheets/cache.js`, a fixed number of 2D-array layers by tier, never
grown), and found by the shaders through **a page table** with one read (`sheets/table.js`, WGSL in
`sheets/sheets.wgsl.js`; a window for levels wider than 2⁷ pages).

Why on the CPU: rastered on the CPU, a page is exact Canvas 2D, costs the GPU nothing after its upload, and the
cost of a painting is paid once, not every frame. Why there is no GPU feedback: every drawable's mapping to the screen
is a formula or a small grid known on the scene's thread, so which pages a view needs is computed there (engine 2
read it back from the GPU, and that delay made cuts late). The price: sheets hidden behind opaque ones are asked too.

A page whose recording leaves it one opaque colour all over (a sky's base sheet: one rect filled, coloured by its
shader) or draws nothing in it is never painted and takes no cell: the table says so, with the colour.

**An ask** (`sheets/ask.js`, SH10) is that computation for one view: for each quad of the view's list, the pages its
pixels read at the level they need (plan 4.8: one formula, shared with the WGSL; a pixel at level λ reads the page of
⌊λ + ⅛⌋, so a sheet the screen needs at 0.9 of a level is read a level up, slightly magnified), with a weight; the answer is how
many of them are not in the cache (0: the view is whole). It allocates nothing and touches no GPU. It is kept **per
quad** (the cache remembers what each quad named): a quad is asked again only when what its pages are computed from
changed — the view as a whole (size, field, overrides, cache pressure), the part of the camera that its kind reads
(the sky: only the turn; an insert: nothing; others: the eye too), its own rows' stamps, or the wind's look for
quads it bends. Curved kinds keep their sampled points between asks. An own shader's further sheets are asked with
its base quad only, and one laid out and placed as its base names the base's pages without a descent of its own.
Every page a view names is named after its **parent** (the page a level coarser), so a missing page is read a level
soft at worst while the painters keep up (coarse to fine) — but in a whole call: a held frame waits only for the
pages it shows. `sheets.weigh()` and `sheets.request()` (SH12) then choose what goes to the painters, never more
than the frame can place: the views' own pages first (by weight — the frame's 1, a shot's 0.5, the film's next beat
1 outside a whole call —, × levels lacking), then **closed inserts'** pages (preparation: in no view's pressure, only in the room the
views leave). A pan's leading strip is read a level soft for a moment.

When a painting is redone: a key it read (`made.reads`) changed; a shot's own painting when a key it read that is
not among the shot's values changed. A repainted sheet is a new handle; it waits as a **swap** and is written into
`quads.sheet` on the first tick its pages are all there — except while the frame is held (`f.whole`), when it goes
straight in. When the cache cannot hold a view, the view is asked coarser (the bias, plan 5.19) rather than
flickering, and falls back a quarter level once a **probe** — the view asked a quarter level finer, counted only —
fits in 0.8 of the room (the band between 0.8 and all of it keeps it from turning round); a view is **drawn** at a
new bias only once its pages are there (`View.drawn`). A place is asked at the level its sheet needs whatever its
speed: motion LOD (a place asked coarser by its on-screen speed, plan SH10) was dropped by the owner 2026-10-15 —
softness in motion is not visible; coarse-to-fine already shows a missing page one level soft.

## 6. The frame's passes

In order (plan 4.4, as coded; `render/renderer.js` drives them, `render/wgsl/*` are the shaders):
`bake` (land atlases, a few tiles a frame) · `shadow-static` (cells due) · `shadow-movers` · `blob` (people's
contact shadows) · `air` (shafts and lamp halos, two small passes) · `mirror` × m (each after its own clip masks) · `masks` (the frame's) · **`main-solid`**
(opaque paint, land, people near to far with depth; then the sky — its base carried on past its painting, one
triangle, then its sheets; then the air over the sky) · **`main-blend`**
(everything not wholly opaque, own-shader quads — but the opaque paint they shade, laid in `main-solid` —, particles, glows, far to near, depth read-only; then a beam's cone
in the haze, per pixel) · `bloom` (five
small passes) · `gather` (bounce, every second frame, when the look has it) · `canvas` (one full-screen pass: bounce,
people's lines, bloom, tone map, grade, edge smoothing, grain, the stage's veil, dither).

The frame is the whole canvas (plan RN5): scenes are laid out for the safe rect — the canvas's shape held to
4:3…21:9, fitted whole in its middle; its height is the focal length — and the world is drawn round it on a wider or
taller screen, never stretched, no bars; the inserts lie on the safe rect, and the sky goes on past what it paints
(`render/sky.js`). `scene.view` / `e.view` tell a scene what the screen shows — read-only, no state.

Opaque paint hides by depth whatever sheet it is in: an opaque sheet, and the opaque pixels of a sheet with holes,
are drawn in the solid pass (`cut`); the rest of that sheet in the blend pass (`edge`) (plan 5.17). Light is at the
vertices for what blends, per pixel only on opaque receivers and only for the two key lights with their shadow maps
(plan 5.5). No compute pipelines; particles and air are closed forms (5.18). The pipelines are a closed set asked
once when the spec is compiled (`render/library.js`, plan 4.5): a repaint, a change of clothes or a cut never makes
one.

## 7. People

`engines/3/people/**`: the motion player (`player.js`), the rig (`rig.js`, reads the shared data in
`engines/1/people/**` and `soma.bin` by URL), figures and their drawing API (`figure.js`, `shapes.js`), clothes and
cloth (`wardrobe.js`, `cloth.js`), and `people.js` — the area's face to the thread: built at the scene's build (models,
figures, motions made ready; `createPeople`), stepped each step (`people.frame`: poses, points; the root copied into
the person's node row), shown in the frame (`people.show`), prepared for a shot's values (`people.prepare`,
`pointFor` — a person's point as the cut will pose them), saved and restored with the director. A person is drawn by
its own pipelines (`person.wgsl.js`, `render/wgsl/person.js`) in the solid pass. Their code is held to the
no-allocation rule hardest (plan 5.16; the history note of 2026-10-11 lists the four ways V8 allocates unseen).
Contracts: section 7 (PP1–PP11).

## 8. Shots made ahead, cuts, waits, a scene replaced, the veil

A **shot** is the values a cut goes to (`engines/3/play/shots.js`). A script makes one ahead (`scene.shot(values)`,
`s.shot(values)`; the page's `prepare`); at most two live a maker. While it lives the thread paints what its values
need, prepares its people, and the renderer asks its views as `f.ahead[i]` beside the frame's. `shot.ready` = painted
and its views whole. A view that moves is made whole at the sharpness its motion allows: if pages keep entering, its
`coarser` rises by quarter levels, so `ready` always comes (plan 2.3 step 4).

**A cut to a ready shot is not held** — its first frame is drawn at once, whole (briefly held only where the shot
became ready coarser than the frame needs: it did not fit in the cache beside the view before it). **A cut whose
shot is not ready makes the story wait, not the picture** (plan 2.4, the owner's decision of 2026-10-22): the
director keeps the cut (a shot made for its values if none was), and stands — actions, sequences, the film, its
time, the voices (at once) and the people its actions move (their pose held) — while the picture before the cut
lives on with the world's time (animates, emitters, people at rest breathing, the camera's operator); a wait with
nothing coming is a fault, as a hold is; what the story asks meanwhile is kept in order (`later`) and done after the cut,
the step its shot is ready. What the story reads meanwhile is the state before the cut; `director.time` is the
world's time less the waits. Where nothing is being played (an unseen step, a render, before a scene's first frame,
the instant mode) a cut is made at once. **The picture is held** only where nothing can live: a scene's first
frame in its thread, an unseen jump's, a render's, and that brief coarser cut — `R.frame` returns 0 and the scene's
time stands until the frame is whole.

**A scene replaced** (plan 2.9) keeps the old one living — its film, scripts, voices as they would go, its events
tagged as its own (a draft, the same scene shown with `keep`, alone stops it) — while the new one is made beside it
in the same thread: its own artist, world, people, pipelines, and its opening view asked in each frame of the old
one after the frame's own views (`f.next`), or in cycles of its own while the old one's loop stands (paused,
covered, its fault) — the new scene's preparation never waits on the old one. The cache is shared: the next view has
a share kept (what it needs, at most half the room), the living picture the rest, each coarser where it does not
fit — so the switch always comes. Nothing of the new scene reaches the page before the switch; the page's scene
(state, listeners, spec) changes with `switched` (PG16). When it is whole — through black where `show`'s
`start.fade` asks — `R.use` switches in one task and the old scene is let go; a show that fails leaves the old one
the scene, on the page and in the thread.

**The veil** (plan 2.10) is the stage's fade: a black over the canvas, 0…1, moved only by the page and the game
(`stage.fade`, `bespoke.fade`; PG15) over the frames drawn (at once where none are; standing under a held frame),
laid last in the canvas pass (`f.veil`); the thread tells the page each level it comes to; not the scene's state,
never in a still, a shot or a render. A fade that lifts waits for a cut that waits. A scene has no fade
of its own: the key `fade` is gone (a spec still starting it is told so).

**The wait sign** (`page.js`) is one sign, the page's: over a held picture (an opening, a seek, a coarser cut, a
draft's stopped scene, the device lost), over a living picture while a scene is made beside it (with the share of its
opening view's pages and pipelines), and over a living picture while the story waits on a shot — a cut that waits
(`waits: { shot, story }`), or a script's own `await s.until(() => shot.ready)` (`waits: { shot }`; the director
knows both exactly: `director.awaiting`). It shows after `WAIT.SHOWN` (0.25 s) and, once shown, stands at least
`WAIT.LEAST` (0.5 s; a wait that comes again meanwhile keeps it), with the share done when the frame's own pages or
pipelines can be counted. Shown over a picture that stands (`waits.held`, the device lost), it pauses the voices and
the music through the page's pause path (`hand.stands`, the `onPause` listeners) — the thread is not paused — till a
frame is drawn; shown over a story that stands (`waits.story`) it pauses the voices alone (`hand.story`, `onStory`).
A held frame with nothing in flight is an engine fault, thrown with `R.missing()`'s words — never a sign for ever; so
is a switch that cannot come.

The opening (plan 2.2): the device, the tables, the pipelines asked at once, the people built, ONE unseen step (the
first beat's cut happens in it; a game's jump, `start.then`, is made right after it in the instant mode, silent),
then everything painted for that state while painters raster the opening view's pages, then one whole first frame.
Unseen jumps (seek, a render's moment, a draft resumed) step `1/60` a task with `turn()` between and end in
`settle()`, the one waiting loop (plan 2.5). Pause (2.6), the device lost (2.8: the page restarts the thread and
restores the saved moment) and a scene replaced (2.9) are one path each.

## 9. Points of interaction

Everything a player can press is tied to a point the scene names; a press is a hit on a finger-sized ring round that
point (plan 3.11, 5.22). The thread projects the tracked points with each frame's camera and sends them in the
`frame` message; the page answers `stage.screenOf` from them and draws the rings (`engines/1/actions.js`,
stacked by depth). The highlight is the thing's own draw, pulsing in brightness (`OFFERED` / `SELECTED` bits, the
quad's glow). The author's selection on a scene's page is a ray on the thread (IN6), approximate by design.
Contracts: section 2 (IN1–IN6).

## 10. The render service and the stand

**Where pictures come from.** An engine-3 scene is drawn only on a graphics card: never on SwiftShader. A host's render
service draws it: `engines/1/render.html`, the virtual clock installed, the scene brought unseen to each moment and
`stage.still(view)` per view, then a screenshot (RS3, RS4; the page's side: `docs/host.md`, Renders).

**Measuring.** The stand plays the scene on the real clock through a fixed scenario (film, wheel, drag, lean…), in
three profiles given to the page — `desktop`, `laptop`, `phone` (the tier rows; never guessed from the machine). The
service reads what the thread kept of each display callback (`engines/3/stand.js`, ST2) and judges it
(ST3): frame times, the thread's JS a tick, bytes allocated a frame, GC pauses, the GPU's pass times, and a view's
weight by profile — `soft run` (in every segment, by the cache's pressure or by motion: the tier's painters as a queue
of the pages first wanted, behind by more than `host.ahead` of their work), `pages again`, `insert late`, with `view
pages` told — each with the segment it is worst in. `?stand=detail` splits a tick into its parts (pace, step, show,
render, the asks by kind of quad, the culls) and profiles the heap. Contracts: section 8.

## 11. Checking work without a GPU

`engines/3/gpu/check.js` is the engine's side of the offline check: `lib.all` for a world that has everything, then
`lib.exercise` — RENDER's stand-in frame, not the real `R.frame` —, validated on Dawn's GPU-less device (Chrome's WGSL
compiler and validation, not a driver: it does not see driver bugs, the platform's shader compiler, the picture, or
the real frame's code paths). Its runner is `test/gpu/check.mjs <scene folder>…` (`npm ci` there first) — every WGSL
module, layout, pipeline, the scenes' own shaders, a stand-in frame of every pass; moood's CI runs it with no scene.

The most useful check of the first rounds — the real `thread.js` run in node on Dawn's GPU-less device with real
worker threads and the scenes — was never brought into a repository either.

Nothing headless checks a real browser: a picture is the render service's, on a graphics card.

## 12. Where each thing lives

| Area (plan 1.5) | Files | What |
|---|---|---|
| GPU | `engines/3/gpu/gpu.js`, `layouts.js`, `wgsl.js`, `check.js` | device, tables as storage buffers, pipelines by key, layouts, WGSL assembly from chunks, the offline check's side |
| SCENE | `engines/3/thread.js`, `base.js`; `world/` (`spec.js` compile, `state.js`, `tables.js`, `world.js`, `element.js`, `place.js`, `world.wgsl.js`, `space.js`, `relief.js` land, `light.js`, `emitters.js`, `kit.js`, `m34.js`); `play/` (`step.js`, `pace.js`, `director.js`, `shots.js`, `showcase.js`, `camera.js`, `messages.js`, `inspect.js`) | the loop, the step, the world, the director and film, shots, the camera, messages to the page |
| SHEETS | `engines/3/sheets/` (`recorder.js`, `easel.js`, `artist.js`, `painters.js`, `page.js`, `table.js`, `cache.js`, `ask.js`, `sheets.wgsl.js`) | paint code's canvas, display lists, rastering, the cache and the page table, the asks |
| PEOPLE | `engines/3/people/` | motions, rig, figures, clothes, cloth, the person's shaders |
| RENDER | `engines/3/render/` (`renderer.js`, `library.js`, `views.js`, `quads.js`, `lights.js`, `shadows.js`, `mirrors.js`, `sky.js`, `land.js`, `particles.js`, `air.js`, `post.js`, `own.js`, `timing.js`, `survey.js`, `wgsl/*`) | the frame: views, cull and order, every pass, the stand's detailed rows |
| PAGE | `engines/3/page.js`; seams in `engines/1/stage.js`, `actions.js`, `clock.js` and the page layers, `play/runtime.js` | the stage's engine-3 side |
| SERVICE | `engines/3/stand.js` | the stand's rows |
| LANGUAGE | `docs/worlds/scene-format-3.md` | what a scene may say; a new scene is engine 3's |

## 13. Rules every change keeps

- **The plan is the source of truth and moves with the code.** A change that alters an interface, a layout, a
  sequence or a number changes `architecture.md` and `contracts.md` in the same commit. A writer who finds the plan
  wrong does not write around it: stop and return with the contradiction (plan, header).
- **Engine 1 is untouched.** Engine 1's files in `engines/1/`, its docs and scenes (plan 1.5 "not touched"; engine 2
  is gone from moood). At a seam, what a line does for engine 1 stays the same to the letter.
- **No allocation in the tick.** Nothing made per frame: numbers go through arrays, not as arguments and returns of
  hot functions; no closures over arguments in hot functions; no records of several shapes through one field; rare
  heavy branches out of hot functions (plan 5.16; the target is ≤ 1 KB a frame).
- **Rationed by count, never by clock**; no `setTimeout`, `setInterval`, `requestIdleCallback`, no real-clock reads
  outside the pacer and the stand. Time moves only through the step.
- **Whole frames**: never a new framing with old or half-made pictures; the picture is held only where nothing can
  live meanwhile (a scene's first frame in its thread, an unseen jump, a render, briefly a coarser cut), never for
  continuous motion — a cut that is not ready makes the story wait while the picture lives, a scene replaced lives on
  till the next is whole; a hold or a wait is shown as loading, never a silent freeze; a hold, or a switch, with
  nothing coming is a fault.
- **Fades are the stage's**: the veil, moved by the page and the game; a scene's state, its stills and renders never
  carry one.
- **No pipeline in a tick**, no compute, no read-back, no fallback to another format or API; per-device numbers only
  in the tier table (plan 4.9).
- **No workarounds.** If something does not work, mend it in the right direction or say so; nothing is built that
  the final engine does not need.
- Pictures only on a graphics card (the render service), in whole rounds (write all → review → mend all → draw); never a render-fix loop over one
  scene or one shader.

## 14. What is open, and where the numbers are

**Limits not met** (the stand's thresholds, judged for engine 3 by plan ST3: frames p95 16.7 ms, the thread's JS
3 ms median and 6 ms p99 a tick, ≤ 1 KB allocated a frame,
no GC pause over 2 ms). After the round of 2026-10-13, on a T4 at 1080p: the thread's JS 5–12.5 ms median, 24–77 KB
allocated a frame, worst GC pauses 8–14 ms, frames p95 33 ms (the half rate) in most scene and profile pairs. What is left of
the tick's work is `proposal-tick.md` steps D, E, F and the allocation sweep (its section 4: what still allocates,
the land baked on the scene's thread, the looks built during a film, the pages' buffers feeding major collections).
`iz-okna-poezda`'s allocation did not fall and is not understood.

**Known open items** (history notes 2026-10-11-engine3, 2026-10-13-engine3-round, 2026-10-22-transitions):
- not yet seen live: the story's wait at a cut, a scene made beside a living one, the veil (2026-10-22);
- a cut is still held where its shot did not fit in the cache beside the frame's view, and where layers are shown by a
  scene's `animate` on a key the cut sets;
- the stand's `cull … look` column is always 0 (`render/survey.js`);
- the offline harness is outside the repository (section 11);
- nothing of the last round was seen in a live browser; the reference laptop and phones were never measured — what
  the plan says of them is arithmetic (plan 5.2, 5.17, 5.21, section 11).

**Views that ask too much** (2026-10-14, `proposal-perf-2.md`'s reading; the plan's RN4, SH10–SH13, WT5, PG8, ST2–ST3,
built in `e3-build`): closed inserts quiet, outside pressure; coarse to fine; the fall by a probe; a bias drawn once
placed; the insert's opening SCENE's; `f.toward` `host.ahead` on, prefetch only; the wait sign at least 0.5 s and
voices and music paused under it; the stand's rows of a view's weight. Since 2026-10-15 (history note
2026-10-15-engine3-motion-lod-dropped): only a break holds — the loading hold is gone —; `soft run` by the cache or
by motion; the cache a fifth larger on computers and laptops (29, 22 layers), phones as they are (plan 4.9, 5.19).
Motion LOD (plan SH10) was built and dropped by the owner the same day.

**Open questions and unchecked assumptions:** plan 9a (for the coordinator), 9b (told to the owner), 11 (what the
design rests on and could not be checked). **What is not built and can come:** `dropped.md`.

**The numbers:** the stand's tables in the history notes (2026-10-13-engine3-round: before/after per scene and
profile; 2026-10-13-engine3-tick: the asks by step), the raw reports in `engine3-renders/<scene>/*.json` (outside the
repository); the plan's arithmetic of a frame's cost in 5.17, of the opening and a cut in 5.21, of the cache in 5.19.
