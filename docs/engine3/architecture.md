# Engine 3 — the architecture: everything that crosses a boundary, and the frame as a whole

Status: the plan of code that is written. Three review rounds by reading; the first pictures drawn on the GPU
machine (the five scenes of «Вокруг света v3» beside engine 2's) and the first measured stand; what they showed
is decided here. ONE author for every seam: this
file. Each area's code conforms to it; an area that finds it wrong does not write around it — it returns
with the contradiction (requirement D4). `docs/engine3/design.md` (the one design document, from sections 1, 2,
5–7) and `docs/engine3/contracts.md` (sections 3–4) are written from it and from the code (8.5).

**Engine 3 is built BESIDE engines 1 and 2** (the owner's decision, 2026-10-11; it stands above every source
below). Nothing of engine 1 or engine 2 is deleted, rewritten or changed in behaviour: every scene, world and game
there is keeps working exactly as it does. Engine 3 is new code in folders of its own (1.5); a scene is its when
its spec says `"engine": 3`; every place that today chooses between engines 1 and 2 gains a third choice and
nothing else (1.6). One world is carried over: «Вокруг света v2» is copied into a new world, «Вокруг света v3»,
whose five scenes become engine 3's (5.20); everything is debugged on it; no other world is converted. **A new
scene is engine 3's** (the owner's ruling, 2026-10-11): what makes a new world or a new scene stamps `"engine": 3`
and speaks engine 3's language; a scene that exists keeps its engine and its language (what follows from it: 1.6). The work's deployment was a local stack of its own (its own deployment branch, running this
branch's code): the world is made and merged there; dev is not touched (5.20). Where
`requirements.md`, `decisions.md` or a ruling speaks of "engine 2" as the thing being remade, of deleting its code
or of converting the 20 scenes, read: engine 3, beside; the 20 scenes of the five «-v2» worlds stay the knowledge
the design was built from.

Sources, in order of weight: `requirements.md`; `decisions.md` §9 (W1–W8) over its §0–§8; `rulings-round2.md`;
the studies (`study-webgpu.md`, `study-webgpu-devices.md`, `study-scenes.md`); the validations of both rounds; the round-1 specifications and the present code — as
knowledge of the problem, not as a base (W6). "The present code", and **main** wherever this file says it, is
engine 2 as the branch the work's branch has it (560f640; `origin/main` at 30a8178 is in it — `engine2-cheap-light` and
the press-points work, both merged on 2026-10-11, are engine 2's present state); the seams of 1.6 were read there.

Words. *Sheet* — what an element's code painted (a display list and its pages). *Page* — a 256 px square of one
level of a sheet. *Top* — a sheet's coarsest level, one small page. *Quad* — one drawn rectangle of the world: a
sheet shown at a node. *Node* — a place and turn in the world. *View* — a camera something is drawn through this
tick (the frame's, a shot's ahead, a mirror's, a shadow's). *Shot* — the values a cut goes to. *Tick* — one display
callback in which the scene is stepped. *Seen / unseen step* — a step whose result is drawn / is not. *Whole* (of a
frame) — every page its views read at the level they need is in the cache, and nothing it shows is still being made.

Numbers marked ≈ are orientations (the owner's numbers are orientations with a margin, not thresholds).

---

## 1. The shape of the engine

### 1.1 The design in seventeen lines

1. **The world is tables.** Nodes, quads, layers, lights are flat typed arrays owned by the scene's thread; the same
   rows, less the render origin, are the GPU's storage buffers. No scene graph, no per-object materials, no library
   renderer. A frame writes only the rows that changed; a write of the value already there changes nothing.
   (W1, C15, S6.)
2. **Engine 3 has no three.js.** The GPU layer is ours and thin (1.3); the mathematics is one 3 × 4 table module of
   ours (`world/m34.js`) and the few 4 × 4 forms written where they are made (`render/views.js`, the camera's lens). Reason: three's WebGPU renderer cannot carry raw shaders and
   its objects are not tables (study-webgpu §3). Engines 1 and 2 keep their own three.js files and their build.
   (W1; T4 is a wish — the owner is told: 9b.)
3. **Everything is a sheet with a place worked out on the scene's thread** — a flat rectangle, or a sheet
   stretched over a grid of points (a drape on the land; a form, 5.23) — so which pages a view needs is computed
   there: no GPU feedback, no readback for pages. Asking the GPU is the usual way for arbitrary geometry; here
   every drawable is a rectangle of painting whose mapping to the screen is a formula or a small grid, and the
   read-back's delay was what made cuts late.
   Its price: sheets hidden behind opaque ones are asked too (5.19). (E4, E5, R1.)
4. **Sheets are display lists, rastered in pages by workers on the CPU, kept in one cache texture, found through a
   page table with one read.** As browsers draw pages. The table's scheme — one pre-resolved entry a page, a
   window for levels wider than 2⁷ pages — is main's and would be designed so anew:
   a blended pixel's reads are the frame's cost. (C11, K2, B5.)
5. **Paint code never runs on the scene's thread.** One artist thread per scene shown runs every element's paint
   code and the land's field; painter threads raster pages. (A4, A5, C14.)
6. **One thread steps the scene and records the GPU's commands.** (A second drawing thread needs shared memory
   across workers and adds a frame of delay.)
7. **One step function** moves the scene through time, seen or unseen, one step a task: play, a seek, a render's
   moment, a draft resumed. `instant` moves no time: it finishes actions (K4). (R3.)
8. **Time never runs while the picture is held, and the picture is held only where nothing can live meanwhile, for
   a whole frame**: a scene's first in its thread, the first after an unseen jump (a seek, a restore, the instant
   mode left, a camera key set at once — 5.16), a render's, and briefly the first of a cut to a ready shot that
   became ready coarser than the frame needs (5.19). **A cut whose frame is not whole makes the story wait, not the
   picture** (the owner's decision, 2026-10-22): the director, the film and the voices stand while the picture
   before the cut lives on — its wind, particles, people breathing — till the cut's frame is whole (2.4); and **a
   scene replaced keeps the one before it living** while the new one is made beside it, till that is whole (2.9).
   **Continuous camera motion is never
   held** — the viewer's (a drag, the wheel, the lean, keys, a platformer) or the scene's (a script's or a film's
   move, an operator's glide, a followed thing): what it brings into view is shown at most a level coarser for a
   moment (the coarser level is kept first: SH10), and coarser still, until the painters catch up, where a device
   cannot keep up even with that — which the stand catches when the scene is made (ST3 `soft run`). A view the
   cache cannot hold even loaded is never held either — it is shown honestly coarser, and the stand fails it (5.19, ST3). (A4, A9.)
9. **Every first frame of a new shot is whole** — never the new framing with old, blurred or half-made pictures —
   **and every cut that can be known ahead is made ready ahead**: a cut to a ready shot is not held, unless the
   shot did not fit in the cache beside the view before it — then it is held briefly for its finer pages (5.19);
   a cut to a shot not ready waits for it with the story standing (2.4). **A fade is the stage's, never the
   scene's**: one black veil over the canvas that the page and the game move (2.10) — not a key of the scene's
   state, not saved, not in a shot, not in a still or a render: a scene at rest is always seen. (A9, R5; rulings
   2-C5, 3-1.2; the owner, 2026-10-22.)
10. **Work in a tick is rationed by count**, never by a clock; a whole frame takes all it needs. (R2.)
11. **Forward drawing in few passes; opaque paint first.** Opaque paint — a wholly opaque sheet, and the opaque
    pixels of a sheet that has holes or soft edges —, the land and people are drawn
    once with depth; then what blends, tested against that depth, its fully transparent pixels dropped: opaque
    paint hides by depth, whatever sheet it is in (5.17). Light at
    the vertices for what blends; per pixel on opaque receivers only the two key lights and their shadow maps.
    One full-screen pass after the main ones. (K5, S1, S6, C8, C9; rulings 2-A1, 3-2.1, 3-2.2.)
12. **Pipelines are a small closed set built in parallel as soon as the spec is compiled**; "ready" is one promise.
    A repaint, a change of clothes, a cut never makes a pipeline. No compute pipelines. (S8, W1.)
13. **One pacer**, in the loop (5.1). (T2, A2, A4.)
14. **One device tier, decided once on the page from the graphics adapter**; every per-device number is a row of
    one table (4.9). No lowering of resolution on the run. (E1, A6, C17; ruling 2-A4.)
15. **The engine is served as it is written** — loose modules under the site's fingerprinted folder, beside
    engines 1 and 2, as they are. **An engine-3 scene's pictures are drawn
    only on the machine with a graphics card** (W2); engine 1's and engine 2's are drawn where they are today.
    (S12, C1, C10; ruling 2-D1.)
16. **What the 20 scenes use, the language keeps.** The language is built from what the 20 engine-2 scenes use
    (3.10), so a scene of theirs can be carried over with the edits of 5.20's kinds and no others; in this piece
    one world is — the copy «Вокруг света v3» (5.20). (C21, W4.)
17. **Everything a player can interact with is tied to a point the scene names; a press is a hit on a circle
    round that point.** The page shows the circle from the points the thread tells it with each frame; the
    highlight is the thing's own draw, pulsing. Nothing is worked out a second time. (The owner's decision; 3.11,
    5.22.)

### 1.2 Threads

| Thread | Entry | Does | Never does |
|---|---|---|---|
| the page | `engines/1/stage.js` and, for an engine-3 scene, `engines/3/page.js` (1.6) | input gathered into one message a frame; HTML layers (bar, captions, widgets, speech pop-ups, menus — W3) placed from the thread's `frame` message; sound; pause when not watched; the tier | projects points for engine 3; runs a loop of its own |
| the scene's thread | `engines/3/thread.js` | the loop, the pacer, the step (director, state, world tables, animates, people's poses, camera, lights), culling and order, the page asks, GPU commands for the frame, the one message to the page | runs paint code; rasters; reads pixels back; waits for the GPU; makes a pipeline in a tick; waits on a timer |
| the artist (one per scene shown) | `engines/3/sheets/artist.js` | runs elements' paint code into display lists; the land's height field | touches the GPU; keeps time |
| painters (N by cores) | `engines/3/sheets/painters.js` | raster a page of a display list in a CPU 2D canvas → its bytes as read, with what the page is (opaque / mixed / empty) and the top's mask; the GPU converts them and makes the half level | run scene code |

Not in engine 3, against engine 2: a rehearsal thread (R3); a cloth thread (S5 — it also made motions ready: PP1
does that at the build). Engine 1's worker, which the stage starts at its mount (most scenes are engine 1's), is
let go when the first scene is engine 3's — as it is today when it is engine 2's (S10). Painters: `clamp(cores − 3, 1, 4)` threads; how many of
them work at once is the tier's (4.9).

### 1.3 The GPU layer (`engines/3/gpu/`), area GPU

One object, `gpu`, made once per mount (3.2): the device, its queue, the canvas's context; **tables** (a storage buffer with its typed array and a dirty range); buffers, textures and targets,
each counted in bytes; **modules** — WGSL assembled from named chunks by plain JS functions (no preprocessor, no
`override`s); **pipelines by key**, always created asynchronously, `gpu.ready()` the promise of those pending;
**layouts** by name; **the frame's encoder** (one a frame, one submit); loss and errors told to the thread; pass
timestamps for the stand's detail run and, where the device has them, for the pacer at half rate (5.1).
It does NOT: keep a scene or objects; sort or batch; own any shader's content; choose formats (4.3 does); fall back
to another format, feature level or API; resize by itself; hide WebGPU — areas hold pass encoders and call
`setPipeline` / `draw` themselves.

### 1.4 Data flow of a tick

```
state keys ──► director (actions, sequences, shots) ──► keys changed
   ──► world tables: nodes, quads, layers, lights, emitters' histories                         [scene's thread]
   ──► animates (write layer poses, uniforms, glows) ──► people.frame (poses, points) ──► camera
   ──► makes asked of the artist ─► display lists ─► sheets (handles) ─► painters ─► pages ─► cache texture
   ──► RN4 frame: views placed ─► people.show ─► pages placed ─► cull, order ─► asks ─► pages requested
        ─► passes (4.4): bake · shadows · blob · air · mirrors (each made ready) · masks · main-solid · main-blend · bloom · canvas
        ─► submit
   ──► one `frame` message to the page
```

### 1.5 Areas, owners, files

Eight areas. `engines/3` — engine 3's folder, beside `engines/1` (engine 1, and the page's
stage and layers for every engine) and engine 2 (gone). Every NEW file and folder has exactly one
area. An EXISTING file is touched only at a seam of 1.6, by the area named there, with the third choice and
nothing else; a file with two seams has an owner for each. The Android app is in no area (5.14).

| Area | Owns (new) | Its seams in existing files (1.6) |
|---|---|---|
| **GPU** | `engines/3/gpu/**` (`gpu.js`, `layouts.js`, `wgsl.js`, `check.js`); `test/gpu` (the runner of both offline checks of 5.11: `node --check` over every module, and the GPU programs) | none |
| **SCENE** | `engines/3/thread.js`; `engines/3/base.js` (`turn()`, `empty()`); `engines/3/world/**` (`spec.js`, `state.js`, `tables.js`, `m34.js`, `world.js`, `element.js`, `place.js`, `world.wgsl.js`, `space.js`, `relief.js`, `light.js`, `emitters.js`, `kit.js` — engine 3's own kit, a module, used by the thread and the artist); `engines/3/play/**` (`step.js`, `pace.js`, `director.js`, `shots.js`, `showcase.js`, `camera.js`, `messages.js`, `inspect.js`) | none |
| **SHEETS** | `engines/3/sheets/**` (`recorder.js`, `easel.js`, `artist.js`, `painters.js`, `page.js`, `table.js`, `cache.js`, `ask.js`, `sheets.wgsl.js`) | none |
| **PEOPLE** | `engines/3/people/**` (with `person.wgsl.js`) | none (it reads, unchanged, the data in `engines/1/`: `people/**`, `soma.bin` — 1.7) |
| **RENDER** | `engines/3/render/**` (`renderer.js`, `library.js`, `views.js`, `quads.js`, `lights.js`, `shadows.js`, `mirrors.js`, `sky.js`, `land.js`, `particles.js`, `air.js`, `post.js`, `own.js`, `timing.js`, `wgsl/**`) | none |
| **PAGE** | `engines/3/page.js` (engine 3's side of the stage — everything of 3.1 and 3.11 that is the page's: the tier, the thread's start, the messages, the points, pause, `lost` and the restart, the wait sign over a held picture and over a story that waits on a shot) | `engines/1/stage.js`; the page's layers and styles where an engine-3 scene needs another behaviour (`actions.js`, `showcase.js`, `select.js`, `viewer.js`, `scene.css`, `captions.js`, `widgets.js`, `speech.js`, `directions.js`, `music.js`); `play/play.js`, the old site's pages (its loop over an engine-3 scene goes to `stage.onFrame`); the old site's pages; `engines/1/clock.js` (row 28: the browser's own timers given, nothing else). Not touched: the app's pages (5.14) |
| **SERVICE** | `engines/3/stand.js` | `engines/1/render.html`, `stand.html` |
| **LANGUAGE** | `docs/worlds/scene-format-3.md` (the one text of engine 3's language; the `\n---\n` separator as in the other two); `docs/engine3/dropped.md` (the one list "not built, can come", D14); `docs/engine3/README.md` (the list of this folder's documents); the history note (D20; 8.5); the world «Вокруг света v3» — its repository, the copy and the edits of 5.20 | `principles.md`, `people.md` (the mention of the third engine and where its text is) |

`docs/engine3/design.md` and `contracts.md` are written by the integrator from this file (8.5).

**Not touched by anyone** — engines 1 and 2 and everything that is only theirs: engine 2 (gone); engine 1's
files in `engines/1/` (`thread.js`, `engine.js`, `world.js`, `kit.js`, `figure.js`, `shapes.js`, `people.js`,
`motion.js`, `skeleton.js`, `ink.js`, `pick.js`, `scenestate.js`, `three.js`, `motion.html`, `bodies/**`);
the five «-v2» worlds, every
other world, every game; and the Android app with its pages and docs (the Android app,
the old site's pages,
the Android app).

### 1.6 The seams — where two engines are told apart today, and what the third choice is

Read in the code (branch the work's branch; the line numbers are 6f1f579's). The rule at every seam: what a line does
for a spec of engine 1 or of engine 2 stays the same to the letter. Where engine 3 takes the very behaviour
engine 2 has at a line (the rings of `actions.js`, the director's actions, `instant`, the showcase's calls and its
test) the test gains "or 3" and nothing else of the line changes; where engine 3 behaves otherwise it is a branch
of its own that hands over to engine 3's code. A spec is engine 3's only when it says `"engine": 3`. **A new scene
is engine 3's** (the owner's ruling): every place that stamps the engine of a new world's or a new scene's spec,
or says which language a new scene is written in, is a seam; a scene that exists keeps the engine
its spec says and its language, and the texts of engines 1 and 2 stay served (`scene_format(engine=1 | 2)`). What
follows from that default is said under the table.

| # | File (under `moood/` unless said) | Today | The third choice | Area |
|---|---|---|---|---|
| 1 | `engines/1/stage.js` — every place where the stage acts by the engine; each is listed under the table ("Row 1 in full") | `engine === 2 ? … : …` — engine 2's thread is engine 2 (gone), a module worker; anything else is engine 1 | `engineOf` answers 3 for `"engine": 3`; `THREADS[3]` is `engines/3/thread.js`; at each place of the list the third choice named there, and nothing else. Stage.js stays what it is — one classic script loaded by the twelve pages, `render.html` and `stand.html`, the owner of the canvas and of the surface pages and layers use (`Moood.mount`, the stage's methods, `MooodState`). `page.js` is an ES module it loads with `import()`, together with the tier (PG13), when the first engine-3 spec arrives: a page that shows only old scenes fetches nothing new and runs nothing new but the comparisons with 3. What is asked of the stage while that thread is being started is kept in order and posted after `mount`; none of it starts engine 1's thread. How stage.js hands its closure over (one owner on both sides): `page.js` exports `stageSide(hand)`, called once a page; `hand` is the stage's closure — the place, the flags, the clock, what was told, the listeners, the tells, and the functions through which page.js fills what the stage keeps. Each `use(3)` is a use: `begin(was, canvas, overlay)` is given that use's canvases; what was handed for a use that has ended does nothing; `end()` runs only for a use that began | PAGE |
| 2 | `engines/1/actions.js` — `two()` (`:31`) and its uses: `picks` (`:36`), the pointer's cursor request (`:38–44`), the rings (`:46–93`; `where` `:53–58`), `show` and `box` (`:95–126`), `offer` (`:144–150`); `engines/1/select.js:37–41` (the two overlay canvases given to the stage) | engine 2: a ring at each offered point (`stage.screenOf`, `id@` for a bare id), no cursor request, a click on the scene only clears; engine 1: the pick and the cursor | engine 3 takes engine 2's side of every one of these tests — the same rings by the same lines (IN2): `two()` becomes "engine 2 or 3". One thing more, for an engine-3 scene only: rings that overlap are stacked by their points' depths (IN2 — `screenOf`'s third number orders their `z-index`). Where the point is comes from `stage.screenOf`, which `page.js` answers for an engine-3 scene. `select.js` is not edited: its canvases are made as today and stay empty for an engine-3 scene (row 1: `selecting`) | PAGE |
| 3 | `play/play.js:103–125` (`two`: the jump), `where` and `frame` (`:150–154`), `offer` (`:156`), `prepare` (`:162`), `pause` (`:181–188`) | engine 2 jumps by `instant`, engine 1 by `catchUp` | engine 3: the jump by `instant` (2.5) — `two` becomes "engine 2 or 3"; `prepare` / `unprepare` of PG11; `where` with `depth`, `onFrame`, `pointer` of IN5 (new members of `bespoke`, working on every engine's stage through `stage.screenOf` and `stage.onFrame`); `pause`: it reaches an engine-3 thread through the `play` term of 2.6, and for an engine-3 scene it leaves voices and music to the `onPause` listeners (with both, `pause(false)` would start a voice under a viewer); for engines 1 and 2 as it is | PAGE |
| 4 | the old site's pages (`engineOf`; `otherEngine` at `:66–71`; the comparing page's label, `compare.js:40`) | 2, else 1 | 3 for `"engine": 3` — so the comparing page finds a scene's last version on another engine (for «Вокруг света v3»: its engine-2 copy beside its engine-3 version) | PAGE |
| 5 | `engines/1/stand.html:31`; `engines/1/render.html:41–42` | the stand's page calls `stage.showcase.start()` in the moment it shows an engine-2 scene with a showcase; the render's page shows a scene the same way for both engines (its film is started later) | both stay the one page for three engines. For an engine-3 scene the film is asked in the moment the scene is shown — `stage.showcase.start()` in the same task as `stage.show`, which the stage's third branch carries in `show`'s `start.showcase` (PG4; 2.2; RS4): `stand.html` when the spec has a showcase (its test becomes "engine 2 or 3"), `render.html` when the spec is engine 3's and its query has `showcase` | SERVICE |
| 28 | `engines/1/clock.js` (`MooodClock`, where it keeps the browser's own `setTimeout` and `requestAnimationFrame`, `:16–17`) | it keeps them to itself and gives only the real clock's read (`__mooodClock`) | it gives them too: `globalThis.__mooodTimers = { setTimeout, clearTimeout, requestAnimationFrame, cancelAnimationFrame }` — the browser's own, bound —, set where `__mooodClock` is. Nothing of the virtual clock, and nothing engines 1 and 2 read, changes. `page.js` counts its own waits by them where they are set (PG2) | PAGE |

**Row 1 in full — the places of `stage.js`** (ruling: the third branches are minimal and change no behaviour of
engines 1 and 2; "page.js" below is `engines/3/page.js`, reached only when the scene is engine 3's):

| Place | Today (engines 1 and 2: unchanged) | For an engine-3 scene |
|---|---|---|
| `THREADS`, `engineOf` (`:35–36`) | 2, else 1 | `THREADS[3]`; `engineOf` answers 3 when `spec.engine === 3`; for every other spec its answer is today's |
| `post` (`:59`) | a call before any thread is used starts engine 1's (`use(1)`) | while engine 3's thread is being started (`page.js` and the tier awaited) page.js keeps the calls in order and posts them after `mount`: they never reach `use(1)` |
| `atOnce` (`:69–85`) | engine 2: a `show` and a `MooodState.start` of one moment go as one `call('show', spec, modules, start)`; engine 1: one after the other | a `show`, a `MooodState.start` and a `stage.showcase.start()` of one moment go as ONE `call('show', spec, modules, start)` with PG4's `start` |
| `send` (`:88`), `stage.input` (`:356`) | one `{ t: 'in', ev }` an event | the event is given to page.js, which posts PG3's one `in` a display frame; the `onInput` listeners are called as today |
| `size` (`:90`), the `ResizeObserver` (`:248`) | `{ t: 'size', w, h, dpr }` at once | page.js: PG2 (after `SETTLED`, with `pw`, `ph`) |
| the clock's wrappers (`:93–100`) | `__mooodTime.pause(on)` → `call('pause', on)`; `__mooodTime.run(ms)` → `call('run', ms)` | `pause`: the `play` term of 2.6 (page.js works out `paused` and calls PG10); `run`: nothing is sent to an engine-3 thread (its clock is moved by `to`: 2.7) |
| `begin` (`:104–108`), `ready` (`:109`), `use` (`:110–145`) | engine 1's worker begun at the mount; a module worker for engine 2; a fresh canvas; `mount` (`:137`); what the thread before was told, told again (`:138–144`) | `use(3)`: the thread before ended and the canvas made by the same lines; then page.js — the module worker `THREADS[3]`, PG1's `mount` (no `'2d'` flag; `flags.stand`: PG1), and what was told, told again: the view, the listeners, `pickSpec`, `select`, `offer`, every tracked point. `told.selecting` is not given |
| `standing` (`:146`, `:159`) | with `?stand`, the time of each `frame` message in `window.__mooodStandFrames` | not filled: an engine-3 scene's rows are the thread's (ST2) |
| `heard` (`:147–187`) | by the message's type | every message of an engine-3 thread goes to page.js (PG5–PG8, PG14), which through the closure fills what the stage keeps (`last`, `values`, the listeners, the wait sign, the P panel, the page's actions and events, `sayLine` / `unsay`) and calls the `onFrame` listeners in the animation frame in which it applies a `frame` message; a tell's `at` (PG7) is handed on to the page's `tell(text, about, at)` — engines 1 and 2 send none and their pages read two arguments |
| `ground`, `project` (`:193–222`), `stage.screenOf` (`:361–366`) | engine 2: projected on the page from the thread's table of points; engine 1: tracked by a call | `screenOf(ref, lift, over)` is answered by page.js from the last PG5 `points` of the slot it tracks for those arguments (PG9; null until the first frame after the `track`) |
| `giveSelecting` (`:296–303`), `stage.selecting` (`:346`) | the selection's overlay canvases are given to the thread (`{ t: 'selecting' }`) | nothing is given: engine 3 has no such message and no overlays (IN3, IN6); the canvases `select.js` made stay empty |
| `act` (`:308–331`; the test at `:328`) | the director's actions are engine 2's; another engine: ended at once with a warning | engine 3's too (the test: "engine 2 or 3") |
| `stage.show` (`:336`), `state.start` (`:380–391`; `keep` at `:383`) | `use(engineOf(spec))`; `keep` holds only for engine 2 with the same thread | `use(3)`; `keep` holds for engine 3 with the same thread too (→ `start.keep`, PG4) |
| `stage.draw` (`:342`) | `call('draw', how)` | no call (not in PG4): it resolves `undefined` — a render of an engine-3 scene never asks it (RS4) |
| `resetCamera`, `setView`, `ready`, `seen`, `still`, `inspect`, `ground`, `pickSpec`, `pick`, `select`, `offer` (`:338–352`) | `call(fn, …)` | the same calls (PG4) |
| `selected`, `frame`, `camera`, `hero` (`:350`, `:358–360`), `showcase.info` (`:374`) | read from the last `frame` message | read from what page.js keeps (PG5's fields come only when they change) |
| `showcase.start` / `play` / `pause` / `seek` (`:369–373`) | calls for engine 2, `null` for engine 1 | calls for engine 3 too (PG12); a `start()` in the moment of `show` rides in it (`atOnce`) |
| `waitSign` (`:408–427`) | engine 2's `waits`, said after a second | not changed and not used: an engine-3 scene's sign is page.js's own (2.4: `WAIT.SHOWN`, PG8's fields, the share done); it stands where this one stands — on `body`, over the place's middle |
| `MooodState.catchUp` (`:463`) | engine 1's | never asked for an engine-3 scene (row 3) |
| `MooodState.prepare` (`:468`) | `call('prepare', values, seconds)` | `call('prepare', values) → id` (PG11) |
| `MooodState.instant` (`:481`) | engine 2 only | engine 3 too (the test: "engine 2 or 3") |
| new members | — | `MooodState.unprepare(id)` (PG11; for engines 1 and 2 it resolves and does nothing); `stage.cover(on)` and `stage.onPause(fn)` (2.6, IN5: they act only while the scene shown is engine 3's); page-wide, for layers that are no stage's: `Moood.onPause(fn)` (`music.js`) and `Moood.cover(on)` (`viewer.js`); `stage.onFrame(fn)` returns the function that takes `fn` off; `speech.pause(false)` ends the standing an engine-3 scene's pause began, and that standing holds a voice only while the stage is engine 3's |

**What a new scene being engine 3's brings** (said to the owner: 9b).
- Every picture of a new scene is drawn by the studio on a machine with a graphics card.
- A new scene opens only in a browser with WebGPU (section 7 item 1) and not in the Android app (5.14).

A deployment whose code has no engine 3 runs an `"engine": 3` spec as an old scene (stage.js's `engineOf` there
sends everything that is not 2 to engine 1). So an engine-3 scene is merged only into a
deployment that has engine 3 (5.20).

### 1.7 What engine 3 shares, and what it owns

Decided by the code.

**Engine 3 imports nothing from engine 2 (gone).** Two reasons. (a) Nearly every module there reaches three.js:
`core/camera.js`, `element.js`, `light.js`, `particles.js`, `space.js`, `world.js`, `inspect.js`, `paint/vt.js`,
`people/rig.js`, `shapes.js`, `shading.js`, `body.js`, `people.js` import `three.module.js`; `core/spec.js` has it
through `particles.js`, `people/player.js` and `cloth.js` through `rig.js` — an import would bring three.js into
engine 3 (rule 2). (b) The few that do not (`core/director.js`, `relief.js`, `state.js`, `paint/recorder.js`,
`page.js`, `table.js`, `people/wardrobe.js`) are the very modules this design changes — shots without seconds and
the emitters' histories in the director's save, runs for long paths in the recorder, the page table on a storage
buffer, forms in the easel: shared, either engine 2's file would have to change for engine 3, or engine 3 would
be held to engine 2's behaviour. And a mend in one must never move the other's pictures. So what of engine 2 fits (8.4) is taken as text into `engines/3/` and is
engine 3's own from then on.

**Shared, by reference, unchanged** — what is independent of the engine and is already shared by engines 1 and 2:
- `engines/1/clock.js` — a render's virtual clock and a play's; `engines/3/thread.js` imports it by relative path,
  as engine 2's thread does (its one seam is row 28 of 1.6: it gives the browser's own timers beside the real clock);
- the people's data in `engines/1/`: `soma.bin`, `people/**` — read by URL from `engines/3/people/rig.js` (BD2);
  `bodies/**` is not read (LG7);
- the page: `stage.js` and its layers, `render.html`, `stand.html`, the site's pages — one page for every
  engine, with the seams of 1.6;
- the world's repository layout, the people's motions — one of each.

**Owned, though an older engine has its like**: the kit (`engines/3/world/kit.js`, a module — engine 2 fetches engine
1's classic `kit.js` and runs it; that file is not touched); the people's figures, player, rig and wardrobe;
the director; the recorder; the stand's rows; the language's text.

---

## 2. The sequences

Owners in brackets: PAGE; SCENE (the scene's thread's own code); R (RENDER); SH (SHEETS, on the scene's thread
unless "artist" / "painter" is said); P (PEOPLE); GPU; SVC (SERVICE).

**One job apart at a time.** Work that takes more than a task — a scene's build, a seek or `to`, a restore — is a
*job apart*: the loop asks for no frames while one runs. The thread has at most one: a newer `show`, `seek` or `to`
replaces the running one at its next `turn()` (the replaced call is replied `{ replaced: true }`); `pause(false)`
asks for a frame only when no job runs; a device lost ends the job (2.8). (Closes v2-consistency 9.)

### 2.1 A tick (a viewer's)

1. [PAGE] Pointer, wheel, key, lean go into a list; one `requestAnimationFrame` posts `{ t: 'in', evs }` (PG3).
2. [SCENE] The message's task: each `ev` applied in order (the camera's and the state's pending moves;
   `stand.input(ev.type)` when the stand is on). Nothing is stepped.
3. [SCENE] The display callback `tick(ts)`: asks for the next one first.
4. [SCENE] `pace.run(ts, fresh) → boolean` (5.1). False: `stand.tick(row)` with `ran = false`; return.
5. [SCENE] `dt = min((ts − tsOfLastRun) / 1000, DT_MOST)`; `dt = 0` when `fresh` or when the frame before was held.
6. [SCENE] `step(dt, seen = true)`, in this order, always:
   a. the director: actions, sequences, the showcase's beats; a cut sets its values now and gives a new shot number
      — a cut that waits for its shot (2.4) is made here, the step its shot is ready; while it waits the director
      does nothing else: the story's time stands, the steps below run on the world's;
   b. keys changed → `world.frame`: answered makes taken (only on a seen step), swaps whose pages are there
      written into `quads.sheet` (SH2 — here, before the flush of 6f, so the row the thread sorts by and the row
      the GPU reads are the same), nodes placed, what reads a changed key marked to paint;
   c. animates of the elements `people.reads(values)` names;
   d. [P] `people.frame(t, values, shot)`; SCENE copies each person's root into its node row (`people.root`);
   e. the other animates — of elements whose node is shown (5.16), emitters' histories, `camera.step(t, dt)`,
      sky animates, lights' rows;
   f. on a seen step: the world's GPU tables flushed (the rows marked since the last flush).
7. [SCENE] `show()`: marked elements asked of the artist (one make in flight an element; at most `MAKES_AHEAD` for
   shots); `people.prepare(values)` for each live shot; the frame record `f` filled (RN4).
8. [R] `RN4 R.frame(f)`:
   a. the targets sized if `R.resize()` was called since the last frame drawn (the canvas itself only in a call
      that draws: RN3);
   b. [SH] `sheets.place(count)` — arrived pages into the cache, before anything of the call reads a sheet: what
      a page tells of its sheet, opaque or not, is known before the cover is judged (RN4) and before the lists are made;
   c. views placed: the frame's, each `f.ahead[i]`'s, the mirrors in view, the shadow views; the cover judged; the
      lit set and the casting lights chosen (5.5); its own tables written where changed;
   d. [P] `people.show(seen)`;
   e. cull and order of quads for each view; the solid and the blended lists (5.17). The views drawn in the call
      (the frame's, its mirrors') are culled in every call — their lists are the order's. A view that is only asked
      (`toward`'s, a shot's own, its mirrors', its cells') and a static shadow cell that stands as it was drawn are
      culled again only when what a cull reads of the VIEW changed (its camera, its size, the land's reach,
      its swaps or overrides) or a row stamped since its last cull is its matter — the look's stamp counts as one of every quad the wind bends, and of nothing else — a quad that comes into its list
      or leaves it; for a cell, whose lists are drawn, any quad of its list (`render/quads.js` `changes`: the rows
      stamped are tested against the view, not every quad against it; one test of "may this view show this quad"
      serves it and the cull);
   f. [SH] `sheets.ask(view)` for every view due (SH10: of a view only the quads whose pages are worked out from
      something that changed are worked out again); R writes `f.ahead[i].whole` and `.bias`;
   g. [SH] `sheets.request()` — what is wanted goes to the painters; the cycle ends;
   h. the outcome: 0 held (a whole frame not yet whole: RN4) · 1 idle · 2 drawn;
   i. the passes of 4.4 on the frame's encoder (a held call draws only bakes and shadow cells; mirrors are
      drawn in the call that draws the frame); [GPU] submit.
9. [SCENE] One `{ t: 'frame', … }` to the page if anything in it changed (points projected with this tick's
   camera). **On a tick whose frame was held (outcome 0) nothing that places things goes**: no `points`,
   `camera`, `hero`, `selected`, `frame` — they go with the tick that draws, so page layers never move over a
   picture that stands (PG5).
10. [SCENE] `stand.tick(row)` when the stand is on.
11. [SH painter / artist, their own threads, any time] a page's bytes arrive → kept for the next `sheets.place`;
    a make's answer arrives → kept for the next seen step's 6b. Neither draws or steps anything.

A tick the pacer skips steps nothing; input that came is applied by the next tick that runs.

### 2.2 The opening of a scene, to its first frame

Awaited things in **bold**; until step 10 the viewer sees the page's wait sign. This is a scene's first opening in
its thread (and a render's): nothing lives yet, so its first frame is held (rule 8). A scene shown where another is
drawn is 2.9: the same legs, the one before living on meanwhile.

1. [PAGE] The spec arrives and says `"engine": 3` → `engines/3/page.js` is loaded and the tier is known (PG13) —
   both awaited once a page → `use(3)`: the worker
   `engines/3/thread.js` started, `{ t: 'mount', … }` posted, then `call('show', spec, modules, start)` — `start`:
   PG4's `{ values, showcase, restore, keep, save }` — what the scene opens with (the state a play has, a film to
   start, a saved moment, a draft going on): the page knows it before it shows the scene, and gives it WITH the
   scene — whatever the page asked in the moment it showed it (`MooodState.start`, `stage.showcase.start()`) is
   gathered into that one call (1.6, row 1: `atOnce`).
2. [SCENE] mount: `host` ← the message's fields and the tier's row (4.9); **`gpu = await createGpu(canvas, host)`**
   — fails → the error `renderer: <words>` posted with `mounted`; the page shows "cannot show the scene". A thread
   that does not start at all (a module of it fails to load: the worker's `error` before `mounted`) is the same to
   the page — final (PG7).
3. [SCENE] `sheets = createSheets(gpu, host)` [SH: the cache allocated once, painters started]; every area's
   `layouts(gpu)` called (GP7); **`R = await createRenderer(gpu, sheets, host)`** [R: the pipelines every world
   has]; `{ t: 'mounted' }`.
4. [SCENE] show (a job apart): a new artist started — one for each scene there is (2.9: the scene shown before
   keeps its own till it is let go) — and told the scene at once (SH6 `show`: it makes its copy of the scene's code — the spec compiled, the kit, the modules, the
   land function — while everything below is made; 2026-10-15);
   `C = compile(spec)`; `R.prepare(C.has)`
   [R: the world's closed set of pipelines asked now — they compile while everything below is made]; the
   state started with `start.values` and the world's tables made (they are placed from it); **`people = await createPeople(…)`** [P: models, figures, motions made ready — a `turn()`
   between slices; it needs the tables, `R.lib` and the modules, no painting]. **Then the opening's moment, before
   anything is painted**: a saved moment is restored (`start.restore`; people
   too: PP6), the scripts and — with `start.showcase` — the film are started, and ONE step `step(0, seen =
   false)` is made: the first beat's cut happens in it, and the actions it starts on people have their real
   lengths, because the people are there (19 of the 20 scenes open on a beat that cuts at once). Nothing was
   painted for the state before it. **A jump** (`start.then`: where a game has got to in the scene — values and
   cuts, PG4) is made here too, after that step and before anything is painted: the instant mode on, silent (the
   director's `simulating`: no event, line or action told), each value set and each cut made in order with a
   `turn()` after each (the sequences go on at once between them), the instant mode off, one more `step(0, seen =
   false)` — the scene opens where the game is, painted once. Then the artist is told that state. **The opening is not
   simulated**: what its scripts and that step tell — events, lines, actions' progress — is posted to the page as
   on any step (PG7; beside a scene still living, when it is shown: 2.9); only a state restored (`start.restore`,
   `start.keep`) and a jump are brought up silently.
5. [SCENE] **`await world.build()`**: every element with paint code asked of the artist — for the state after
   that first cut —, answers taken as they come [SH artist]; the land's height field [SH artist]. **The first
   frame's pages are rastered meanwhile**: after each answer taken SCENE works out the opening's view again — the
   camera after the first cut, its way round chosen again with each painting taken (SH4: the camera is stepped with
   no time before each ask, so the pages rastered are for the camera the first frame will have), every quad there
   is so far (a View of its own making, SH10). Where another scene is shown and its loop runs (2.9) that view is
   asked in each of its frames, after the frame's own views — one cycle, so the pages the living picture names keep
   their cells and the new view has its share (5.19's order of service) —; where none is shown, or its loop stands
   (paused, hidden, covered, the instant mode, a fault), SCENE runs a whole cycle for it after each answer (and,
   beside a scene shown, at each wake after the build): `sheets.place(Infinity)`, then { `sheets.ask`;
   `sheets.weigh()` } until `weigh` returns false, then `sheets.request()` (SH12) —; all `host.painters` work, and a page
   that arrives between two answers is only placed (`sheets.place(Infinity)`): no view is asked again for it — its painter goes on at once with the next page of the list the last cycle ordered (SH12), so the painters work through the whole build, also after the artist's last answer. `waits` told to the page meanwhile — after each answer taken, and once
   before `R.build`.
6. [R] **`made = await R.build(world)`**: the painted particle sprites; resolves when the pipelines step 4 asked
   are made (RN2); then `R.use(made)` — the switch: R draws this world from here.
7. [SCENE] The loop starts (`fresh`). The state and the film were started in step 4; A `MooodState.start` or a
   `stage.showcase.start()` that the page asks in a LATER moment is a call of its own (PG4 `start`: the state and
   the scripts anew; PG12 `'start'`: the film from its beginning) — as on engine 2.
8. [SCENE] Each callback until the first frame is drawn: `step(0, true)`, `show()` with `f.whole = true` — the
   scene's clock stands.
9. [R] `R.frame(f)` returns 0 until the frame is whole (RN4); [SH] painters send tops first (many to a job), then
   the first view's pages; a held call places all that arrived. A held frame with nothing in flight (no page
   asked, no make, no build) is the fault of 2.5 step 3 — thrown with `R.missing()`'s words, shown by the page in
   the scene's place — never a wait sign for ever.
10. [R] The first frame drawn (2). [SCENE] The first `frame` message (all fields). Time starts with the next tick.

What the viewer waits for, leg by leg, with an orientation in seconds: 5.21. Pipelines compile and people are
built beside the painting; a painting's pages can start only when its paint code has ended, and the one artist
paints in turn — so the wait lies between the longest leg and the sum of two. No opening time is promised
(section 7 item 2).

### 2.3 A shot made ready ahead, and its cut

1. [SCENE] `shots.make(values) → shot` — by a script's `scene.shot(values)` / `s.shot(values)` (the worlds' film
   module does it for every beat's opening: 5.20) or the page's `call('prepare', values)`. At most `SHOTS_LIVE` (2)
   live **for each maker** — each sequence; outside sequences each code by itself: the scene's script, an element's
   script, the showcase's code (so the film module's shots are the film's own; such a maker is the code's own API
   object, never its name — two elements may share a name); the
   page —; a maker's third cancels that maker's oldest (its `ready` stays false; its `cut()` is a plain cut). So
   a beat's own shots never cancel the film's shot of the next beat. A shot that has been cut to is no longer cancelled —
   not by `cancel()`, not by its maker's third, not by its sequence ending in the cut's own tick: it ends with the cut's step
   (step 6).
2. [SCENE] Every tick while it lives: makes `as: values` asked of the artist (≤ `MAKES_AHEAD` in flight) and taken;
   each answer is a swap `(quad, sheet)` of the shot; **a painting of a live shot is made again when a key it
   read (`made.reads`) that is not among the shot's values changes** — the film's shot lives a whole beat —;
   [P] `people.prepare(values)`;
   `shot.painted = none of its makes is left to ask or in flight && people.prepare(values)`.
3. [SCENE] `f.ahead[i]` for each live shot (RN4): the shot's camera; its swaps; the nodes its values place
   elsewhere, the rows they hide and the rows they show (overrides) — an insert it opens with its parts' and copies' nodes;
   a card that leans, leaned as the world's own placing leans it —, and the entry's `stamp` (RN4).
4. [R] Places that shot's views — its camera's, its mirrors', its shadow views' — and culls the world with the
   overrides; [SH] asks them (weight 0.5; the shot's own view at 1, as the frame's, where the shot is the film's next
   beat — made by the showcase's own code, not a beat's sequence: `a.next` — and the call is not whole: a held frame
   comes first); [R] writes `a.whole`, `a.pages` (the pages its views still lack, of all of them: what a story that waits on the shot is shown to wait for — step 5) and `a.bias` — the most any of the shot's views
   (its own, its mirrors', its shadow cells') is asked coarser by than the frame will ask it: its `coarser` and the
   greatest pressure among them (5.19) — a mirror's view that did not fit holds the cut's frame as the shot's own
   would.
   **A shot's view that stands** (its camera the same as at its last ask) is whole when every one of those asks
   returned 0 and the land has what that view draws. **A shot's view that moves** — its camera is counted every
   tick as things are now, so a shot of a camera that rides a train moves with the train — is made whole at the
   sharpness its motion allows: while it moves, every tick in which something ENTERED what its views ask — a
   page no view named in the cycle before (SH10 `entered`), a tile of its land's field (a window of it moved) —
   and what it lacks (the pages its asks returned, and the land's tiles lacking at the levels it reads) is not
   less than the least it has lacked at its present `coarser`, R raises the `coarser` of all its views by a
   quarter level (SH10); it is whole when it lacks nothing, and at `BIAS.MOST` with what is there (5.19: the
   rest is read from the coarser levels; tops and the land's coarsest level are always there). **A camera that
   moves and brings nothing new into its views is not coarsened** — one that follows a head that breathes, a
   boat that rocks: its camera is another every tick by a hair, the pages it names are the same, and what it
   lacks is on its way (the first stand: such shots climbed to `BIAS.MOST` in a second and their cuts were held
   for every finer page). A tick it lacks nothing and nothing entered, its `coarser` falls a quarter level: a
   page or two that once crossed into such a view do not leave it soft for the rest of its life (a riding
   camera's views are entered every tick: theirs does not fall; `ready` is false for the few ticks the finer
   pages take). A tick its camera stood, its views begin anew at 0. So `a.whole` — and `ready` — always comes:
   a view into which pages keep entering is coarsened until the painters keep up or it is at the bias's end;
   one into which none enter lacks fewer with every page placed. Within a few tens of ticks of the paintings and the people — and of its land's field where another field holds its tiles (RN4: a view
   ahead of a camera that stands where the frame's does takes the frame's, a level's window a frame); over land no field holds, no sooner than
   that is baked (`host.land` tiles a frame: 4.9).
5. [SCENE] `shot.ready = shot.painted && a.whole` — computed here only. On an unseen step, in a thread with no
   loop, and before a scene's first frame it is `true` (nothing is shown there). **`ready` always comes**
   (step 4): a script may wait on it whatever the camera rides.
   **A story that waits on `ready` is shown as loading** (the owner's decision). A script that makes a shot and
   waits for it before its cut — `await s.until(() => shot.ready); shot.cut()` — holds no picture: the shot
   before goes on living, and the story stands in it for as long as the shot takes. The director knows that
   wait exactly, by what the script asks: an `until` whose condition, as it was last tried, read the `ready` of
   a shot that lives and was told `false` is the story waiting on that shot (`director.awaiting`; not an `until`
   that is paused, not a shot that has ended — its `ready` never comes —, not a condition that did not get as
   far as `ready`). While there is one, a viewer's tick tells `waits: { shot: true }` (PG8) — with the pages that
   shot's views still lack (`a.pages`: step 4) and the pipelines being made, so the share done is shown as for a
   hold — and the page shows
   its wait sign over the living picture once that has lasted `WAIT.SHOWN` (2.4); it goes with the `until` —
   the shot ready, cancelled, the sequence ended or paused, the scene replaced. A shot that is only being made
   ready — the film's next beat, the page's `prepare`, a `ready` nobody asks or one read outside an `until` —
   tells nothing. Where nothing is being played `ready` is true, so a render and a seek have no such wait. **A
   cut to a shot that is not ready** — `shot.cut()` too early, a plain cut nobody made ready — is the same wait
   made by the engine and stronger: the whole story stands, not one sequence (2.4); the director's `awaiting` is
   that cut's shot, and the tick tells `waits: { shot: true, story: true }`.
6. [SCENE] `cut(values)` / `shot.cut()` — of a ready shot, or where nothing is being played (2.4: else it waits):
   in this tick's step 6a — or, made between ticks by a script, at once — the values are set, the shot's swaps written into
   `quads.sheet`, the camera takes the shot's pose — the scene's operator goes on from the shot's own (its pose, its way round), so the new shot's first frame is seen by the very camera the shot's views were asked from, and asks the pages they asked. For that the shot's camera must be the camera after the cut, also where the cut changes the pose of the person it frames (a cut that seats someone who stands): **a person's point under a shot's values is PEOPLE's answer for the person posed as that cut will set them** (`people.pointFor`, PP5) — never their point of now carried with their node; a thing's point is carried with its node, as the values place it. So at any `camera_glide`, 0 too, the operator handed over is already on its goal and nothing eases after a cut —, a new shot number. **An element whose painting was made for
   this shot is not marked to paint again**: its make saw, for every key it read (`made.seen`), the values the
   state has after the cut. At the end of that step `people.unprepare(values)`; the shot ends.
7. [R] The frame of a new `f.shot` is whole (rule 9). **A cut to a ready shot is not held, unless the shot
   became ready coarser than the frame needs — it did not fit in the cache beside the view before it, or its
   camera was moving (step 4) — then it is held briefly for its finer pages** (5.19: the
   shot became ready at a coarser bias; by the count this is where a view of the heavier half has a shot
   ahead, and dzhungli everywhere; under a hold time stands, so a riding camera's ground stops entering and the
   hold ends). Never a sharpening in view. A shot that fitted is drawn at once, with every static shadow cell and mirror it needs drawn in that one frame
   (the film's longest frame, at the moment the eye sees it least; the pacer does not count it).

### 2.4 A cut that is not ready: the story waits

The owner's decision (2026-10-22): **a cut whose frame is not whole does not freeze the scene — its story waits
while the picture lives**, as a script's own `await s.until(() => shot.ready)` waits (2.3 step 5), but for the whole
story. The old rule — the values set at once, the picture held, the scene's time standing — is gone.

1. [SCENE] `cut(values)` (a script's, a film's, the page's `call('cut')`, `shot.cut()`) where something is being
   played (a viewer's loop, the scene's first frame drawn, no job apart, not the instant mode — `shots.playing`)
   and its shot is not ready: the shot it is by, or the live one of those very values, or — none — one made now
   for them (`shots.make(values, 'cut', next = true)`: its own view asked at the frame's weight). The director
   keeps the cut as **waiting** (`{ values, shot, later }`) and does nothing of it yet: the state is as it was.
2. [SCENE] **What waits with it — the story**: the director stands — no action, sequence, wait, `until`,
   `scene.every`, line read by the clock or film beat goes on; its time (`director.time`, `scene.time`, the film's
   bar) stands; what the story asks while the cut waits — an action begun, a value set, another cut, a signal, a
   `tell` — is kept in order in `later` (an action is made, awaitable, and begins only then: `a.later`), so code
   after a cut goes on after it; what it READS meanwhile is the state as it is (before the cut). The page's
   voices wait at once (the page's `onStory`: the line heard stands, none begins); the music goes on. **People**:
   one on whose body an action of the story is (a walk, a go, a motion done once, a turn: their body's track —
   `director.stands(id)`) stands with it — their player's time stands, the pose of that moment held, as `_still`
   holds it; one doing nothing timed (standing, a looped motion) lives on: breathing, their cloth. **What lives —
   the world**: the step runs on with the world's time (`stepper.t`: the frame's `t`, the shaders' time): every
   animate (wind, grass, the sky), the emitters, the people not held so, the camera's operator (it eases where it
   was going), the lights; nothing is held, the frame is drawn as ever. Keys a story's action drove stand where they
   were, and so what an animate shows by them.
3. [SCENE] Every seen tick the waiting shot is made ready as any (2.3 steps 2–4); one cancelled meanwhile (its
   maker's third) is made again for the values. The tick tells `waits: { shot: true, story: true, pages }` (PG8);
   the page shows its sign over the living picture after `WAIT.SHOWN`, the sign alone (2.3 step 5). **A wait with
   nothing coming is a fault**, as a hold is: what the shot lacks — its pages, its land's tiles (`a.land`), its
   paintings and its people's looks — and its bias standing, and nothing on its way (the one test every wait asks:
   a page in flight or arrived, a make, a people's build, the build, R's own work — pipelines being made, the land
   baked by its ration: `R.working()`) for `WAITS_EVERY` frames running — thrown with those words, the scene's
   fault (PG7 c). (The land of a shot ahead is baked a ration a frame — `host.land` tiles —, so a shot that lacks
   only land is not stuck: its `land` falls each frame.)
4. [SCENE] The step in which the shot is `ready` — in its step 6a, before anything else of the director: the cut
   is made by it (2.3 step 6: the values set, its swaps in, the camera from its operator, a new shot number), then
   what `later` kept, in order (a cut among it may wait again: the rest waits behind it); the director goes on,
   its time from where it stood (the world's time ran on: `director.time` is the world's less the waits). The cut's
   frame is drawn at once, whole — or briefly held where the shot became ready coarser (2.3 step 7).
5. Where nothing is being played — an unseen step (a seek, a render's moment), a thread with no loop, before a
   scene's first frame, the instant mode — a cut is made at once, as ever; a cut waiting as the instant mode
   begins is made then (with what it kept). A restore, `stop` and a scene's scripts started anew drop a waiting
   cut (its kept actions cancelled — one cancelled never begins —; its own shot let go). A save while a cut waits
   keeps the cut's values (`cut`): restored, the cut is made at once, plainly — the scene is past it; what waited
   behind it is code, as a sequence is (the scripts started anew go on from the state).
How long (5.21): the same framing with nothing painted anew — a tick or two; a new framing — its pages must be
rastered: about 0.4–2 s on the reference laptop, 0.4–3 s on the ordinary phone; more where the cut also repaints
paintings (gavan's `port`, paluba's `ship`: tens of paintings). That is why every cut that can be known is made
ready (5.4).

**What still holds the picture** (rule 8): a scene's first frame in its thread, an unseen jump's first frame (2.5),
a render's frames, and briefly a cut to a ready shot that became ready coarser (2.3 step 7) or whose layers an
animate shows by a key of the cut (design 14, open). **A hold is shown as loading, never a silent freeze** (the
owner's decision): after `WAIT.SHOWN` (0.25 s, so a hold of a tick or two does not flash it) the page shows over the
standing picture the same wait sign as at a scene's opening (2.2), from `waits` (PG8), with progress where it is
known: the page keeps the largest `waits.pages` seen since the hold began, and the pipelines asked and settled since
it began (`pipelines` counts from the thread's start: PG8), and shows the share done; while the `waits` of the
moment names nothing countable (paint code running: neither `pages` nor `pipelines`) the sign alone. One sign, one
look, PAGE's — on `body`, over the place's middle; the words that a scene cannot be shown stand the same way. Under
a hold the scene's time stands (`dt = 0` on the ticks after a held one). **Only a break holds**: a camera that moves
on — the viewer's or the scene's — is never held, so the sign never stands over continuous motion. **The sign
never flickers**: once shown it stays at least `WAIT.LEAST` (0.5 s) — a picture that plays on before that plays
under it, the sign alone, its share hidden; a wait that comes again meanwhile keeps the same sign. **Voices and
music under a hold**, as a player does while it buffers: when the sign comes up over a held picture the page
pauses the voices and the music as it does for a pause (2.6, the `onPause` listeners), and resumes them with the
first frame drawn after; a hold shorter than `WAIT.SHOWN` leaves them going. **Under a story's wait** (a cut that
waits) only the voices wait (`onStory`), at once — the story stands at once; the music, as the picture, goes on. A script's own
`until` on a shot pauses nothing. A make or a build that fails is reported and counts as done (the old sheet stays:
a painting whose code threw answers `rec: null`, SH6).

### 2.5 An unseen jump (a seek, a draft resumed, a render's moment)

1. [SCENE] `seek(t)` / `to(t)` — a job apart: `t` behind → the director restores the last checkpoint at or before
   `t` ([P] `people.restore`; emitters' histories restored with it).
2. [SCENE] `advance(t)`: `step(1/60, seen = false)` until the scene's time is `t` (the last step shorter), **one
   step a task** (`await turn()` between). On an unseen step: nothing asked of the artist, nothing taken, no
   `R.frame`, no `people.show`, no GPU write; cuts at once; `shot.ready` true. `waits` (`apart: true`) is worked out every
   15th step and told when it changed (PG8).
3. [SCENE] A new shot number — the frame's (`f.shot`): the picture is whole. **The people are not set again**:
   they were stepped to the moment with everything else, and what they are told is the state's count of cuts
   (PP3), which a jump does not move — a sought moment shows a walker in his stride and facing his way, as the
   played film does there. Then `settle()` — the one waiting loop of the engine:
   ```
   loop {
     step(0, true); show();                    // f.whole = true; f.wait as RN4 says
     s = R.frame(f);                           // a whole frame is never idle: 0 or 2
     if (s === 2) break;
     if (nothing is in flight) throw fault(R.missing());   // not whole and nothing coming: an engine fault
     await arrival();
   }
   ```
   "In flight": a page asked of a painter, a make asked of the artist, a people's build. `arrival()` resolves on
   the next of those ending. `R.frame` places the pages that arrived BEFORE it asks, does its uncounted work
   (bakes, cells, mirrors) before it judges "whole", and repeats its asks inside the call until the cache's
   pressure stands (5.19) — so the iteration woken by the last arrival draws. A painting taken while `f.whole` is
   written straight into `quads.sheet` (2.4 step 1), so a whole frame never waits on a swap. No timer, no polling.
4. [SCENE] `await gpu.done()`; the loop resumes (`fresh`); the call's reply is posted.
`instant(true)`: the director finishes every action as it begins, the clock stands; `instant(false)` ends with
step 3. A viewer's seek and a render's moment are the same code. One difference, of what is told: in a viewer's
thread unseen steps post no `event`, `say` or `action` (a seek is silent); in a thread mounted with `clock` (a
render, where unseen steps are the only way time moves) an unseen step that takes the scene's time past the
furthest moment it has reached posts what a seen step posts, and a replay of time already reached (after a
restore) posts nothing (PG7).

### 2.6 Pause and resume

1. [PAGE] `paused = play || hidden || away || covered` (the play's own pause; `document.hidden`; the place not
   intersecting the viewport; `stage.cover(true)` — IN5) — worked out while the scene shown is engine 3's. On a
   change: `call('pause', paused)` to the engine-3 thread, and the `onPause` listeners (speech, music) called.
2. [SCENE] `pause(true)`: the frame request cancelled. No ticks, no messages. Painters and the artist finish what
   is in flight; arrivals are kept. `pause(false)`: a frame requested (unless a job apart runs); its callback is
   `fresh`. The veil (2.10) stands with the ticks: a fade goes on from where it stood.
3. [SCENE] A `size` while paused: `host` ← size; `R.resize()`; one `show()` with no step — drawn in the same task
   (a resize is never idle). A frame drawn with no step is still a reading of the tables: the rows marked since the last
   step are flushed and `world.tick` moves on before it (3.4).
A render's page never pauses. A scene of engine 1 or 2 is paused as it is today — by the play's own pause and by
the browser stopping a hidden tab's display callbacks —, and its voices and music go on as they do today (5.13).

### 2.7 A render

1. [SVC] A picture of an engine-3 scene is drawn by the studio on a machine with a graphics card.
2. [SVC] The page `scene/render.html`; the page's tier given
   by the asker (`window.__mooodDevice`, PG13); `MooodClock(start)` installed on the page and (by the mount's
   `clock`) in the scene's thread.
3. [SCENE] Mounted with `clock`: no loop, no pacer. Opening as 2.2 steps 2–7 (promises and `turn()` only).
4. [SVC] `await stage.ready(); await stage.seen()` → [SCENE] 2.5 step 3.
5. [SVC] For each moment `t`: each `set` due before it — `stage.state.call('to', second)` then the set or the cut (made
   at once: nothing is being played); then `stage.state.call('to', t)` (with `showcase`: `render.html` gave `start.showcase` with `show`, so the film is
   started — 2.2 step 4 —; here `stage.showcase.seek(t)`); the page's own clock run for the same span (`__mooodTime.run`) so captions stand
   at the moment; for each of `views`: `stage.still(view)`; then `page.screenshot` (RS3).
6. [SCENE] `to` / `seek`: 2.5. `still`: one whole frame from the other camera with no step — 2.5 step 3's loop
   with `show()` alone in place of `step(0, true); show()`.
What moves time: only `advance` (inside each unseen step the thread's virtual clock is run by the same `dt` — in whole milliseconds, the remainder carried to the next step: the clock ends a run on a whole millisecond, and a step is 16.67 —, so a
script's `scene.every` and its timers fire at scene time, and the thread's clock and the page's read the same moment). The engine has no `setTimeout`, no `setInterval`, no
`requestIdleCallback`: slicing is `turn()`; pipelines, pages, makes, builds are promises and messages. The bound of
a render is the asker's, ONE for the whole render: one clock over everything it asks of the page; when it runs out it asks
`call('waits')` once and throws with what that answers — `waits` and `R.missing()`'s words.

### 2.8 The device lost

1. [GPU] `device.lost` resolves → `host.lost(reason)`.
2. [SCENE] The job apart, if any, ends; the loop stops; `{ t: 'lost', saved: director.save() | null, reason }` is
   posted. The thread does nothing more.
3. [PAGE] Ends the worker. Calls in flight are rejected with the loss as their reason (their callers did not get
   what they asked), the actions the page holds are ended as on a change of engine, and on a render's page the
   loss is an error (`__mooodErrors`). When the page is next not paused (2.6; at once if it is watched now — a device is
   most often lost in a tab that went to the background, and a thread started there would get no display
   callback): makes a new canvas in the place and a new thread (the path of `use()` — it exists); `mount`,
   and the `show` of the scene the viewer was at (2.2: nothing is painted for a state nobody sees) — the scene shown, with
   `{ restore: saved }`; when its film was loaded, with `{ showcase: { at, playing } }` of the last `showcase` the page was
   told, over what it was opened with (a film is code: it is begun and sought there, as a draft's is — PG4); when the loss
   came while a `show` was in flight, that `show` as it was asked (its caller was rejected with every caller in flight; the
   scene comes all the same). A restart's `show` that fails says so in the place (PG7 c). What the page
   had told the thread (view, listeners, selection, what is offered — `offer` again —,
   and every tracked point — `track` again; the page keeps its refs and takes the new slots) is told again. The
   wait sign stands meanwhile; the first frame is held as any first frame.
4. [PAGE] A second `lost` before that thread's first `frame`, or that thread's mount failing (PG7): "cannot show
   the scene" — final.
One path, the one a page load takes (ruling 2-D4). A tab the browser discarded and reloads is a page load.

### 2.9 A scene replaced, the stage unmounted

The owner's decision (2026-10-22): **a scene shown where another is drawn keeps that one living** while the new one is
made beside it, in the same thread, and switches to it when it is whole — no black, no frozen picture meanwhile.

1. [SCENE] `show(spec2, …)` while a scene is shown: **the old scene goes on exactly as it would** — its director,
   film, scripts, lines, its artist, its shots, its frames; what it does meanwhile is the game's business (a game
   usually shows the next scene at the end of a beat). The engine has no opinion on its story; what its director
   tells — events, lines, actions — carries its show's tag (`start.tag`, the page's name for it: PG4), so the page
   knows whose it is (a game hears the old scene's as the old scene's). Only a draft — the same scene shown again
   with `start.keep` — stops it at once (its `director.save()` is what the new one goes on from; its director
   stopped, its artist ended: it is drawn as it stands, step 5's stopped scene).
2. [SCENE] The new scene is made beside it (2.2 steps 4–6): its own artist, world, people, director, scripts (its
   opening step, its jump), pipelines (`R.prepare`) — and **its opening view's pages are rastered whatever the old
   one does**: while the old scene's loop runs, asked in each of its frames after the frame's own views (2.2 step
   5: one cycle, `f.next`, RN4); while it does not (the page paused, hidden, covered — a letter over the scene —, the
   old scene in the instant mode or stopped by its fault) in cycles of the job's own, at each wake. **The cache is
   shared** (SH13): the opening view (`next`) has a share kept for it — what it needs at its bias, at most half the
   room —, the old picture's views the rest, served first: neither starves; each view that does not fit rises in
   bias as any (5.19), so the switch always comes, and the living picture keeps at least half. The new scene is
   not stepped meanwhile (it stands at its opening's moment). **Nothing of it reaches the page before the switch**:
   its state's events are not told, its director's events, lines and actions are kept (so no voice of a scene not
   seen is heard); the page's scene — its state, who hears what it tells, the game's spec and offers — stays the
   old one; `select` and `offer` are of the scene shown (the paths are of the spec the page has). Two scenes are
   held at once for the switch's length (the owner accepts the memory).
3. [SCENE] **Whole, then the switch.** `R.build(world2)` resolved (its pipelines, its sprites: `made`, RN2), the
   artist's last answer taken, and the opening view's last ask lacking nothing (`sheets.whole(world2)` too): the
   new scene is whole. With `start.fade` the veil is first drawn to black over those seconds (2.10), the old scene
   living under it (at once where no frames are drawn). Then in one task, with nothing that can throw or be
   replaced in between: `R.use(made)` — R draws the new world —; what the old scene told and the page has not heard
   is posted; the new scene becomes the one shown; the old one is let go: [SCENE] its director stopped (its lines
   unsaid), its shots let go, its artist ended; [P] `people.dispose()`; [SH] its sheets released; then the page is
   told **`switched`** (PG16) — the new scene's whole state, which the page takes as it takes the new scene's
   start (its state, who hears what it tells) —, and after it what the new scene kept to tell, in order. What
   follows the switch (a film sought to where it was) can no longer undo it. The new scene's first frame is a new
   shot, whole (its land is baked in that whole call, its shadow cells drawn); held only for what the cache could not
   hold beside the old picture — its view then asked finer than its share let it be (5.19) —, briefly, as a cut to a
   coarser shot. With `start.fade` the veil goes back to clear over the same seconds from the first frame drawn
   after the switch — of whichever scene is shown then: a newer show that switches before that frame (one with no
   fade) does not leave the black standing; a fade of the page's asked meanwhile takes the lift over. A scene's
   music changes with the picture (the page: `bespoke.show`, at the switch), so a scene seen is heard.
   Where no scene is shown (a first show, a render) the opening is 2.2's: the new scene's pages asked in cycles of
   their own, the switch as `R.build` resolves, its first frame held till whole.
4. A build that fails (a shader of the scene does not compile, a module throws), or a switch that cannot come (the
   new view lacking pages while nothing is on its way — after a cycle of its own, or for `WAITS_EVERY` frames running
   with neither its lack nor its bias moving: an engine fault): the reply of `show` carries the error; what was made
   for the new scene is let go (`R.drop(made)`); the scene shown before stays the scene — living (and so the page's:
   the page took nothing of the new one; nothing of the old is refused), or stopped where a draft stopped it (then,
   as with no scene before, what needs it is refused with the error: step 5). A show replaced by a newer one before
   its switch is let go the same way (its veil, if it drew one, lifted again over its seconds).
5. **A stopped scene** (a draft's old one; one left on the canvas by a failed draft) is drawn as it stands and
   nothing more: it is not stepped and asks nothing (it has no artist), and every call that would change it or
   needs a whole frame of it — `start`, `set`, `cut`, `turn`, `path`, `act`, `control`, `signal`, `restore`,
   `instant`, `showcase`, `to`, `still`, `prepare` — is rejected with the failed build's error, as `ready` and
   `seen` are; what only reads it (`inspect`, `ground`, `pick`, `save`, `track`) answers. The next `show` is the way
   on. While it stands under a show the tick tells `waits.held` (its picture stands: voices and music wait under the
   sign, 2.4).
6. [PAGE] `unmount`, or `use()` of another engine (the next scene is engine 1's or 2's — a scene cannot live beside
   one of another thread): the worker is terminated — the browser frees the device with it; nothing else.

### 2.10 The stage's fade — the veil

The owner's decision (2026-10-22): **fades are the stage's**, one mechanism, never the scene's. The veil is a black
over the scene's picture, a level 0…1; it is no key of the scene's state — not saved, not in a shot, not in a still,
a tile or a render (a scene at rest is always seen) — and only the page and the game move it:
1. [PAGE] `stage.fade(level, seconds) → promise` (the game's `bespoke.fade`): over an engine-3 scene `call('fade',
   level, seconds)` (PG15); over a scene of engine 1 or 2 the page's own black layer in the place, over its canvas,
   under every page layer (its opacity animated; the stage pauses it with the play's pause). The level the stage
   keeps (`told.veil`) is the one the veil is at — over engine 3 the thread tells each level it comes to (`veil`,
   PG15): one truth, carried at once to a thread started anew and to another engine's canvas.
2. [SCENE] `fade(level, seconds)`: the veil goes from where it is to `level` over `seconds` of the frames drawn (the
   ticks' timestamps, each callback's share at most `DT_MOST` as the step's — not the scene's time: it moves while a
   cut waits; it stands while a frame is held — nothing is drawn — and goes on from what was last seen), eased; it
   answers when it is there — when its seconds are gone by, never judged by the level (an eased level can round to
   where it goes a frame before its time is up) —, or as a newer fade takes it over. Where no frames are drawn to show it going — no
   scene, the loop stopped (paused, hidden, covered, the instant mode, a fault, a job apart), a render — it is there
   at once, and a fade going on as the loop stops is too. `f.veil` is its level in each tick's frame (RN4); the
   canvas pass lays it last (4.4); a frame whose veil moved is never idle. A fade that **lifts** the veil while a
   cut waits (2.4) waits for that cut's frame: a cut through black (`fade(1)`, the cut, `fade(0)`) never shows the
   picture the story is leaving. `still` draws with no veil.
3. **Where it is used** (by the page and the game, never a scene): a scene change through black (`show`'s
   `start.fade`, 2.9 step 3 — the default is none: a scene is never begun from black); a cut through black (the
   game's cut with a fade); a dim under a text (a letter: a level, held); black at the end. A scene has no fade of its
   own: the scene key `fade` (with `fade_color`, the look's) is gone (2026-10-27) — a spec whose `state` still
   starts one, not describing it in `states` as its own, is told so (`world/spec.js`), and nothing is drawn by it.

---

## 3. The interfaces

Every entry has a prefixed number: PG page ⇄ scene's thread, GP the GPU layer, RN scene ⇄ renderer, WT the
world's tables, SH sheets, PP people, ST the stand, BD files and addresses, RS the render service, LG language,
IN interaction.
(Decisions keep W, R, K, S, L, T; requirements A–H: no prefix is shared.) "Thread" is the scene's thread unless
said. Specifications quote entries by these numbers and do not re-word them.

### 3.1 PAGE ⇄ SCENE (messages between `engines/3/page.js`, behind `stage.js`'s third branch, and `engines/3/thread.js`)

**PG1 `mount`** (page → thread, once, first):
`{ t: 'mount', canvas, overlay, w, h, dpr, pw, ph, budget, tier, phone, cores, flags: { debug, stand }, clock, real, speech }`
— `canvas`: OffscreenCanvas (transferred); `overlay`: OffscreenCanvas | null (`?debug`); `w, h`: CSS px of the
place; `dpr`; `pw, ph`: device px, integers (`round(w · dpr)`, `round(h · dpr)` — in every browser); `budget`: px a
frame may have; `tier`: `'weak' | 'normal'`; `phone`: boolean (PG13); `cores`: `navigator.hardwareConcurrency || 4`
— read for the painters' count only; `flags.stand`: `null | 'rows' | 'detail'` — from the page's query: `?stand` →
`'rows'`, `?stand=detail` → `'detail'` (the stand opens `stand.html` with it);
`flags.debug`: string | null; `clock`: ms | null (a render's virtual clock's start); `real`: boolean (a play's
clock); `speech`: boolean. The thread copies them into `host` and adds the tier's row (4.9).

**PG2 `size`** (page → thread): `{ t: 'size', w, h, dpr, pw, ph }` — when the place's size or dpr changed and has
stood 150 ms. The thread: `host` ← fields; `R.resize()`; the camera of the scene shown, and of one
being built, takes the size. **The page's own waits go by the browser's clock**: `SETTLED`, the one `in` a display frame
(PG3), the layers' placing (PG5) and the wait sign's `WAIT.SHOWN` are counted by the browser's own timers, never by a
play's or a render's clock, which stands while the play is paused — where `MooodClock` is installed `page.js` takes them
from `__mooodTimers` (1.6 row 28).

**PG3 `in`** (page → thread): `{ t: 'in', evs: [ev, …] }` — at most one a display frame, events in order. `ev`:
`{ type: 'pointerdown' | 'pointermove', pointerId, x, y }` (CSS px in the place), `{ type: 'pointerup' |
'pointercancel', pointerId }`, `{ type: 'wheel', deltaX, deltaY, x, y }`, `{ type: 'lean', x, y }` (−1…1),
`{ type: 'keydown' | 'keyup', key, code }`, `{ type: 'blur' }`. In the list a `pointermove` replaces the last entry
if that is a `pointermove` of the same pointer; a `lean` likewise.

**PG4 `call`** (page → thread): `{ t: 'call', id, fn, args }` → `{ t: 'reply', id, value | error }`. The closed list
of `fn`: `show(spec, modules, start)` (`start` — what it opens with: below and 2.2), `start`, `stop`, `resetCamera`, `setView`, `ready`, `seen`, `still(view)`,
`inspect`, `ground`, `set`, `cut`, `turn`, `path`, `check`, `unknown`, `listen`, `act`, `control`, `signal`, `said`,
`save`, `restore(data)`, `instant(on)`, `showcase(how[, at])` (`how`: `'start' | 'play' | 'pause' | 'seek'`), `pick`,
`pickSpec`, `select` (the thing picked — by a ring's press, IN2, or by the author's click, IN6), `offer(paths)` (which things pulse: IN3), `track`, `prepare`, `unprepare`, `pause(on)`, `to(seconds)`, `waits`, `stand(how)`,
`fade(level, seconds)` (PG15).
Not in this list, though engine 2's thread has them: `rehearse`, `draw`, `run` (a render's clock is moved by `to`:
2.7), `all`.
**Arguments and replies.** One page API serves the three engines, so every `fn` not spelled out in this section
takes and replies what engine 2's thread does on this branch (engine 2 (gone), `calls`, `:819–894`):
`set(key, value, over, ease, opts)`, `cut(values, opts)`, `turn(key, degrees, over, ease)`, `path(keys, points,
opts)`, `check(keys, who)`, `unknown()`, `listen(key)` (a no-op here: every move is told, PG5), `act(id, actor, verb, args)`, `control(id, how)`,
`signal(name, data)`, `said(id, ev, duration)`, `save()`, `restore(data)`, `instant(on)`, `inspect()`,
`ground(across, distance)`, `resetCamera()`, `setView(left, right)`, `pickSpec(spec)`, `pick(x, y, allowed) →
{ path, background } | null`, `select(path)`, `offer(paths)` (the paths — `objects[i]` — of the elements offered
now, as `select.js` sends them today: which things pulse, IN3), `start(spec, values, opts)` (asked apart from a
`show`: the state and the scripts anew), `stop()`.
Engine 3's own: **`show`'s `start`** — `{ values, showcase, restore, keep, save, then, fade }`, each optional: `values` — the
state over the spec's (what `MooodState.start` was given in the moment of the `show`); `showcase: true` —
`stage.showcase.start()` was asked in that moment; `showcase: { at, playing }` — the film begun and, after the switch,
sought to `at` with no frame between (what `keep` does for a draft; the restart after a loss gives it: 2.8); `restore` — the data of a `save` (2.8); `keep: true` — the same
scene shown again in this thread (a draft: `MooodState.start`'s `keep`): the thread takes the new scene from what
went on in the one before — the old scene's `director.save()` at the moment it was stopped (2.9 step 1),
restored as `restore` is, the values the new spec adds started as it starts them, and a film that was playing
started again and sought to where it was (2.5) — what engine 2 does for a draft (engine 2 (gone));
`save: true` — the game keeps what the scene saves (PG5's `save` is sent, from its switch on); `tag` — the page's
name for the scene (a game's scene id): its director's messages carry it (PG16); `then` — a jump: where a game has got
to in the scene, `[[key, value] | ['cut', values] | ['wait', s] | ['heard', …], …]`, made before anything is painted
(2.2 step 4; `wait` and `heard` need no time there); `fade` — seconds: the switch through black (2.9 step 3, 2.10;
none: no fade). And `prepare(values) → id`,
`unprepare(id)` (PG11), `still(view)`, `to(seconds)`, `waits`, `pause(on)`, `track` (PG9), `stand(how)` (ST3).
`ready` resolves when the scene shown is built (2.2 step 6) or rejects with
its error; `seen` resolves after the frame last asked is drawn whole and `gpu.done()` (it rejects with the scene's fault: PG7); `to(seconds)` — 2.5;
`still(view)` — one whole frame of this very moment from a camera whose keys are `view` over the scene's (no step;
the scene's own camera untouched); `waits` → `{ waits, missing: R.missing() }`.
**What holds for the thread, not for a scene**: `setView(left, right)` is the page's layout — the thread keeps it and
every camera made takes it (it is told before any `show`, and again after a loss). **What is asked of the scene is asked
of the newest**: a call that changes the scene or needs a frame of it waits for the `show` asked last — `check` and `unknown` among
them (`resetCamera`, `setView`, `listen`, `pick`, `pickSpec`, `ground`, `said`, `track`, `pause`, `waits`, `stand` and `fade` act at once); a `seen`
asked of a scene that is replaced before its frame is answered by the scene that replaces it; a `show` replies `true`
when shown; one replied `{ replaced: true }` showed nothing (the page does not take it for the scene shown).

**PG5 `frame`** (thread → page): `{ t: 'frame', … }` after a tick, only if something in it changed; every field
present only when it changed since last sent (all present in the first after a mount and after a scene is shown):
`frame { x, y, w, h }` (CSS px: where the stage lies in the place); `camera { x, z, h, look, yaw, roll }`;
`hero { across, elevation, ground } | null`; `fixed` boolean; `selected { path, x, y, w, h } | null` (IN6);
`showcase { at, length, known, playing, ended, beat } | null` (seconds; `known`: the length is exact);
`beats` string[] (when a showcase is loaded; null when it is let go); `points` Float32Array of 3 × tracked slots — `[x, y, depth]`,
CSS px and metres (x NaN: not there or behind the eye — a point outside `frame` keeps its numbers; depth Infinity: a sky point; 0: an insert's — there only
inside its iris as far as it is open). Things on the frame have points like any other (IN1). **`frame`, `camera`,
`hero`, `fixed`, `selected` and `points` are not sent by a tick whose frame was held** (2.1 step 9) — an idle tick sends
them like a drawn one, and a newly tracked slot makes the next such message carry `points`;
`changes` `[key, value, …]` ('change' events in order; null: gone); `moves` `[key, value, …]` (each key once);
`save` `{ key: value }` (what the game keeps, changed since last told — what a seek or a restore changed of it
too). The page applies `changes` then `moves`:
`old = values[key]`, set (delete on null), listeners `(value, old, key)`; then `save` to the listener the game gave.
The page keeps the last `points`, so `stage.screenOf(ref)` and `stage.frame()` stay synchronous for a game's code
(`bespoke.where`). The page takes a `frame` message's state, points and fields at once, in the message's task (so
a `state` message that follows cannot overtake its `changes`); it PLACES its layers from them in its next
animation frame (`stage.onFrame`, IN4).

**PG6 `state`** (thread → page): `{ t: 'state', changes?, moves?, save? }` — the same three fields when they must go
before another message (`action`, `event`, `say`, `unsay`, `reply`) or no tick runs. There is no `change`, `move` or `save` message.

**PG7 the other messages** (thread → page), as engine 2's thread sends them: `mounted { keys }`, `reply`, `lost` (PG14), `action { id, ev, remaining,
duration }`, `event { type, data, at }` (arrived, line, cut, signal, tell; `at`: the scene's seconds when it
happened), `say { id, who, text, opts }`, `unsay`, `perf { text }`, `failed` (below); `errors: [string]` and
`warnings: [string]` ride on any message.
**Errors the page shows in the scene's place** start with `renderer: `: (a) with `mounted` — the mount failed
(GP1); final: the worker is ended and every later `show` is refused; a worker that raises `error` before
`mounted` is the same; (b) with `{ t: 'failed' }` — the engine itself failed after the mount (a painter's thread
died: SH5); the thread posts nothing more; final as (a); (c) on any other message — the fault of the scene shown
(RN12's; an exception of a tick or of `settle`): the words stand in that scene's place, its loop is stopped and
`seen` rejected; the thread lives, and a `show` takes the words away — when it is asked, and when one that was in flight is
answered shown (so a fault of the scene before never stands over the scene that replaced it). **Everything else is an error of the
scene and never begins `renderer: `**: what `host.error` tells (an uncaptured GPU error, a shader that does not
compile, a page a painter could not raster) is reported as `engine: <words>`; a `show` that fails carries its
error in its reply (2.9 step 4).
**What unseen steps tell**: nothing in a viewer's thread (a seek, a state restored); the opening's step is not
one of them (2.2 step 4); a thread mounted with `clock` — 2.5.

**PG8 `waits`** (thread → page): `{ t: 'waits', waits: W | null }`, `W = { building?: true, pipelines?: [made,
asked], pages?: n, land?: true, shadows?: true, apart?: true, shot?: true, story?: true, held?: true }` — non-null ONLY while the picture stands (`held`: the tick's `R.frame`
returned 0, or a draft's stopped scene stands under a show — which the page's sign and its pause of voices and music read — 2.4, 2.9), a scene is being built, a job apart runs, or the scene's story waits on a shot being made ready (`shot` — 2.3
step 5; the picture is not held then — with `story`, at once, the page's voices wait (2.4): with `shot` alone `pages` is that shot's — the pages its views still lack, `a.pages` — and `pipelines` as ever; `story` with it: a cut waits, the whole story stands — the page's voices wait, 2.4; the other fields, which are the frame's, are told only with one of the first
three; while a scene is built beside a living one, `pages` is what its opening view lacks — 2.9): sent when it changes then (a job apart works it out every `WAITS_EVERY`th
step), and as a job apart ends — before its reply: a `show` is answered with its build's wait already told over;
`null` otherwise — a frame that was drawn tells none, whatever pages it still lacks.
`pipelines` is `gpu.waiting()` (GP6) — counted since the thread began; the page's share done counts from what was
settled when the hold began (2.4). The page's wait sign reads it: non-null is "held" — or, with `shot` alone, a story that waits. The reply of a `show` —
its error too — ends the opening's hold.

**PG9 `track`**: `call('track', ref, lift, over) → slot` — the refs of the scene language as it is on this branch
(engine 2's table of points, engine 2 (gone); IN1). `ref`: an element's or a person's id — its own
point (the point its code marks with an unnamed `e.at`, else its anchor; a person's: the head; an insert's: the
point it marks, else its iris's centre; a sky element's: only if it marks one), and with `over` true its top when
it marks none (its anchor its `height` up: where a line said stands); `'id@'` — where it is pressed (IN1);
`'id#name'`; a copy's — `'id:k'`, `'id:k@'`, `'id:k#name'`; `[across, distance, elevation]` (metres; the
elevation over the land); or `{ on: id, at: [across, distance, elevation] }` (in that element's own frame). `lift`: metres up (a sky's and an insert's point is not lifted). The same slot for the
same arguments; slots live as long as the thread. A point given as numbers is a slot like any other: a game
follows a moving thing by its ref, not by numbers that change with every call.

**PG10 `pause`**: `call('pause', on)` — 2.6. Idempotent.

**PG11 shots**: `call('prepare', values) → id`; `call('unprepare', id)`; `call('cut', values)`.
`MooodState.prepare(values) → Promise<id>`, `MooodState.unprepare(id)` on the page (engines 1 and 2 keep their own
`prepare(values, seconds)` behind the same function, in `stage.js`, as it is).

**PG12 the showcase**: `call('showcase', 'start')` starts it at once; `'play'` (a film that has ended: sought to 0,
playing), `'pause'`; `'seek', seconds` — 2.5;
replies when the seek's frame is drawn; a seek moves the place, not the play state (a paused film stays paused — also
when the seek is replaced by a newer one). `stage.showcase.info → { at, length, known, playing, ended, beat, beats }`.
A `stage.showcase.start()` asked in the moment a scene is shown is not this call: it rides in `show`'s
`start.showcase` (PG4).

**PG13 the tier** (PAGE, `engines/3/page.js`; found once a page, before the first engine-3 thread is started — a page
that shows only scenes of engines 1 and 2 never asks for it):
```
device = window.__mooodDevice                           // given by a render or the stand: { phone, weak } — then nothing below runs
info   = (await navigator.gpu?.requestAdapter()).info   // no navigator.gpu or no adapter: an engine-3 scene "cannot show"
phone  = matchMedia('(pointer: coarse)').matches
weak   = classOf(info.vendor, info.architecture) === 'weak'  // exact name, else a `*`-ended name as a prefix; a pair not in the table is weak
tier   = weak ? 'weak' : 'normal'
budget = phone ? (weak ? 960*540 : 1280*720) : (weak ? 1600*900 : 1920*1080)      // E1
```
`TIERS` — one closed table in `page.js`, an orientation; the strings are Chrome's (Dawn's names, lower case:
v3-webgpu N8 read them in the source; Chrome gives a page `vendor` and `architecture` only):
`intel`: `gen-7` … `gen-12lp` weak (the reference laptop is `gen-9`), `gen-12hp`, `xe-lpg` and later normal;
`amd`: `gcn-1` … `gcn-5` weak, `rdna-*` normal; `nvidia`, `apple`: normal;
`qualcomm`: `adreno-4xx` … `adreno-6xx` weak, `adreno-7xx` and later normal;
`arm`: `midgard`, `bifrost`, **`valhall` weak**, `gen-5` normal — one row for the whole architecture, chosen for
its weakest common member (the Galaxy A53's Mali-G68: at 1280 × 720 an ordinary view has a margin of about 1.25
and a heavy one does not fit; at 960 × 540 the margins are 2.2 and 1.25–1.9 — 5.17); so a 2022 flagship with
`valhall` graphics (the owner's Pixel 7) is the 960 × 540 row too. No reported memory is read (it is clamped and
does not tell these phones apart);
`samsung` (Xclipse graphics) and `img-tec`: weak — today Chrome refuses WebGPU to the first and gives it to the
second only from Android 16; the rows say where they land when it does.
`requestAdapter()` is called with no options here and in GP1, so both name the same adapter (on a laptop with two
graphics cards: the browser's own choice). A wrong class is not a wrong picture: the pacer puts such a device at
the even half rate.
`window.__mooodDevice` is set before the page's scripts run (`addInitScript`) by SERVICE: a render gives
`{ phone: false, weak: false }` (a render's pictures are the normal computer's row: 5.2); the stand gives its
profile's — `desktop` `{ phone: false, weak: false }`, `laptop` `{ phone: false, weak: true }`, `phone`
`{ phone: true, weak: true }`.

**PG14 `lost`** (thread → page): `{ t: 'lost', saved, reason }` — once, when the graphics device was lost (2.8);
`saved`: `director.save()` or null when no scene was shown. After it the thread posts nothing more.

**PG15 `fade`** (the veil, 2.10): `call('fade', level, seconds)` — `level` 0…1 (clamped), `seconds` ≥ 0 (0: at
once); acts at once, of no scene (it is not waited behind a `show`); replies `null` when the veil is at `level` — at
once where no frames are drawn; one replaced by a newer `fade` replies as it is replaced. Thread → page `{ t: 'veil',
level }` each time the veil comes to a level (a fade ended, set at once, the loop stopped — a show's own fades too):
the stage keeps it (`told.veil`) and tells it to a thread started anew (`fade(level, 0)`, with what else it
re-tells). `stage.fade` over engine 1 or 2 is the page's own layer (2.10) and calls nothing.

**PG16 `switched`** (thread → page, 2.9 step 3): `{ t: 'switched', scene, show, values }` — the scene shown is the new
one from here: `scene` its show's tag, `show` the stage's number of that show (`start.show`), `values` its whole state.
The page takes then what it was given with that very show (by `show`: a show asked while an earlier one is switching
never gives the earlier one its own)
(`MooodState.start`'s: who hears what it tells, its states) and `values` as its state; before it, the page holds the
scene shown before. Every `event`, `action`, `say` of an engine-3 director carries `scene` (its show's tag, PG4
`start.tag`), and the page gives it to whoever hears it (`stage` events, `tells.tell`): `bespoke.on(…, fn(data,
scene))`.

### 3.2 GPU ⇄ every engine area (`engines/3/gpu/gpu.js`; on the scene's thread)

**GP1 `createGpu(canvas, host[, { device }]) → Promise<gpu>`** — SCENE at mount. Throws (the message becomes
`renderer: …`) when: `navigator.gpu` is missing; `requestAdapter()` gives null; the adapter lacks the feature of
4.6; `requestDevice` fails or the device is lost before it returns; the canvas gives no `webgpu` context; a `device`
given lacks one of `features(host)`. Configures the canvas (`format: gpu.format`,
`alphaMode: 'opaque'`). With `device` given and `canvas` null (the whole-set check in node, 5.11) it wraps that
device and configures nothing; `gpu.canvasView()` then gives a view of a small texture of `gpu.format` that GPU
makes for it (`gpu.format` is `'bgra8unorm'` there). Fields: `gpu.device`, `gpu.queue`, **`gpu.size(w, h)`** (sets the canvas's
buffer's size — RENDER calls it, RN3; never called without a canvas), `gpu.format`
(`navigator.gpu.getPreferredCanvasFormat()`), `gpu.info` (for the stand's report only — nothing in the engine
branches on it). `features(host)`, exported by `gpu/gpu.js`: the features GP1 asks of a device — the check makes its
device with it (5.11).

**GP2 `gpu.table(name, { stride, capacity }) → Table`** — a storage buffer (`STORAGE | COPY_DST`) and its mirror.
`Table = { buffer, bytes: ArrayBuffer, f32: Float32Array, u32: Uint32Array, capacity, version, mark(firstRow,
rows), flush(), grow(capacity) }`. `mark` widens the dirty range; `flush()` sends it with one `queue.writeBuffer`
and clears it (nothing dirty: no call). `grow` makes a larger buffer, copies the mirror, marks all, `version++`
(whoever holds a bind group with it re-makes that group). This is the one mechanism by which rows reach the GPU:
the owner marks as it writes and flushes on seen steps only.

**GP3 `gpu.buffer(name, size, usage) → GPUBuffer`**, `gpu.write(buffer, offset, data, dataOffset?, size?)`.

**GP4 `gpu.texture(name, descriptor) → GPUTexture`**, `gpu.drop(bufferOrTexture)` — every byte made or dropped
through GP2–GP4 is counted (a texture of a format that is not 4.3's throws; `drop` of what was not made here throws).

**GP5 `chunk(name, text | (options) => text)`, `assemble(names: string[], options) → wgsl`** (`gpu/wgsl.js`: plain
strings, no GPU, importable in node); **`gpu.module(name, wgsl[, heard]) → GPUShaderModule | null`** — a text's faults are told ONCE, each as
`{ chunk, line, message }` (the chunk's name and the line in it — for an author's shader the line in the author's text):
its compilation errors, and a `requires` or `enable` directive, which is refused (the viewers' browsers may be older than
the checker's). Of an engine text they go to `host.error` (a refused directive there is thrown: an engine fault). Of a text
given with `heard` — an author's own, RENDER's — they go to `heard(faults)` and nowhere else, and a refused text gives null:
RENDER says them with the elements (LG13). **`gpu.reported() → Promise<void>`** — every module's report pending at the
call is in (the check waits on it: 5.11). `forget(name)` (`gpu/wgsl.js`) lets a chunk go (GP6); it throws on a name that is
not there.

**GP6 `gpu.pipeline(key, descriptor) → Promise<GPURenderPipeline>`** — by key; always
`createRenderPipelineAsync`. **`gpu.ready() → Promise<void>`** — resolves when every pipeline pending at the call
is made; rejects with the first of THOSE that failed (a failure does not poison later calls).
`gpu.waiting() → [settled, asked]` — of the pipelines asked and not forgotten, how many are no longer pending: one
that failed is settled (it is not waited for; its failure is told by its own promise and by `ready()` — and, when its text did not compile, by
GP5).
**`gpu.forget(key)`** — drops a pipeline by key, and its module when no other key has it (RENDER: an own
shader's, when the world that had its text is replaced by one that lacks it — RN2); it throws on a key that is not there (RENDER forgets only what it asked). No pipeline is asked in a
tick. There are no compute pipelines.

**GP7 `gpu.layout(name[, entries]) → GPUBindGroupLayout`** — with `entries`: registered under that name by its
owner (once); without: looked up. GPU's own `layouts.js` registers `frame`, `view`, `viewCast`, `none` exactly as
4.2 writes them; every other layout is registered by the area that owns its family: **each of PEOPLE and
RENDER exports one `layouts(gpu)`** — from `people/person.wgsl.js` and `render/library.js`
(modules that import nothing of a browser; SHEETS has no family — its three bindings are in `frame`) —, called by
SCENE at the mount
before `createRenderer` and by the whole-set check — so people's layouts are there before `R.prepare` asks their
pipelines. **`gpu.bind(name, entries) →
GPUBindGroup`**, **`gpu.sampler(name) → GPUSampler`** (the three of 4.3).

**GP8 the frame**: `gpu.begin()` (R; one encoder a frame — an encoder left unsubmitted by a frame that threw is let
go by the next `begin`: it holds nothing); `gpu.pass(name, descriptor) → GPURenderPassEncoder`
(the caller ends it; `name` is one of 4.4's passes — `PASSES` in `base.js`, another throws —, set as the
descriptor's label); `gpu.canvasView() → GPUTextureView` (this frame's; asked in the task that draws);
`gpu.submit()` (R, once); **`gpu.done() → Promise<void>`** — `onSubmittedWorkDone()` of the last submit; it always resolves, after a loss too
(GP9);
`gpu.flying → integer` — submits whose `done` has not resolved yet (the pacer's witness, 5.1); `gpu.submits` —
submits made; `gpu.stamps` — the device has `timestamp-query`; `gpu.hear({ done(n), timed(ms) })` — the pacer's one
listener, set once: the n-th submit's work done (in order), a timed frame's GPU time (its passes summed);
`gpu.timeFrames(on)` — the pacer's: every frame's passes timed while on (nothing where there are no stamps).

**GP9 loss and errors**: `host.lost(reason: string)` once when `device.lost` resolves; `host.error(err)` on an
uncaptured error. After a loss nothing more is told through `host.error` and no promise of `gpu` is left to reject unhandled;
its methods go on answering against the lost device (they must return what their callers hold — the thread is
about to be ended: 2.8).

**GP10 `gpu.memory() → { textures, targets, buffers, total }`** — bytes allocated now.

**GP11 `gpu.timing(on)`**, `gpu.times: Float64Array` (ms of each pass of 4.4, of the last frame whose stamps
were read back — a frame or two after its submit;
−1 for a pass that did not run in that frame, and for every pass until a frame has been read back; a name used more
than once in a frame — `air`, `bloom`, `mirror` — is summed, and a difference of two stamps below 0 counts as 0) — only
with `flags.stand === 'detail'`; the device is then made with `timestamp-query` and GP1 throws without it.
Otherwise `timestamp-query` is taken when the adapter has it (`gpu.stamps`), for the pacer (5.1).

### 3.3 SCENE ⇄ RENDER

**RN1 `createRenderer(gpu, sheets, host) → Promise<R>`** (`render/renderer.js`) — once per mount. Makes the
targets of fixed size (the shadow atlases, `blob`, `air`) and the pipelines every world has (the frame's end, the
sky); resolves on `gpu.ready()`. The full-frame targets are made at the first `R.frame` (RN3). Reads of `host`: of
the tier's row (4.9) `budget, shadow, pages, cells, land, field`; `pw, ph, w, h`; `error`. (RENDER's warnings go
through `world.warn`.)

**RN2 `R.prepare(has)`** — SCENE, right after a spec is compiled (2.2 step 4): asks, all at once, the closed set
of pipelines for a world that has `has` (4.5). `has = { relief, people, emitters, casters, reflects, glass, clips,
inserts, own: [{ text, names }] }` (booleans, and the distinct own-shader texts; `casters`: something casts — an
element with `shadow`, a person whose `shadow` is not `false`, or an emitter whose particles cast (`shadow` above 0:
5.5); nothing in it is guessed from a text — what only
paint code tells, a `multiply` layer or a painted light, has its pipelines in every world: 4.5) — a field of the
compiled spec (WT9). **`R.build(world) → Promise<made>`** — SCENE, after `world.build()` resolved: what is made for
the world before it is drawn — the painted particle sprites (`sheets.picture` of each `world.emitters[i].sprite`:
awaited here, so no frame ever lacks one); resolves when every pipeline its `R.prepare` asked is made (not on
`gpu.ready()`, which would also wait for — and fail by — the pipelines of a draft replaced before its build). It
switches nothing: R draws the world it drew, the scene before living on (2.9). **`R.use(made)` is the switch** —
synchronous, in the task SCENE switches the scene shown in: R holds the new world (its tables, every area's
`build`) and lets go of what it held for the one before — its sprites and (`gpu.forget`, GP6) the pipelines,
modules and chunks of own-shader texts the new world lacks; the engine's own pipelines are a closed set and stay
for the mount; nothing kept of the views' asks. `R.frame` draws the world of the last `R.use`. **`R.drop(made)`** —
a `made` that will not be used (its show replaced or failed before the switch): its sprites, and the chunks,
modules and pipelines of the own texts neither the world drawn nor the one being prepared has, let go. When
`R.build` rejects nothing changed, and what was made for the new world is dropped the same way. One module is made for each distinct assembled text, whatever number of pipeline keys it serves. An own
text that does not compile, or is refused, rejects `R.build` with LG13's words — said once, by RENDER, from the faults
`gpu.module` handed it (GP5). A painted sprite made again after the build (its code read a key that changed) is
pictured when its recording is another — awaited beside the frames, the old picture drawn until the new one is
in; a sprite whose recording is empty draws nothing (SCENE says it once, with the element). **`lib.all(gpu, has) → Promise<void>`** (`render/library.js`) is
the one function behind `R.prepare` — the whole-set check calls it with a `has` that has everything (5.11). It settles when every pipeline it asked has and every report of its own texts is in (`gpu.reported()`); when an own text of `has.own` has faults it rejects with THEM, whatever else failed — a line a fault: `own shader <k>` (the text's place in `has.own`, from 1), the line in the author's text, the message —, so the check prints an author's mistake as a line of its own, and `R.build`, which waits on it, says the same faults with the elements (LG13: one message, RENDER's). **`lib.ownKeys(prefix[, set])`** (`set`: `':mirror'` for the mirror's set) lists only the keys that have a pipeline: a refused text has none, and `lib.exercise` draws none for it.
**`lib.exercise(gpu) → void`** (RENDER, `render/library.js`) — for that check only: with small targets, tables and
bind groups of its own making it encodes one frame of every pass of 4.4, binds and draws every pipeline once
(people's through PP10's `exercisePeople`), and submits. Nothing else calls it.

**RN3 `R.resize()`** — after SCENE copied a `size` into `host`. `k = min(1, sqrt(budget / (pw · ph)))`; the
canvas's buffer (`gpu.size`) and every full-frame target become `floor(pw · k) × floor(ph · k)` — the targets at the start of the next
`R.frame`; the canvas's own size only in the call that draws, right before `gpu.canvasView()` (setting a canvas's
size clears it: a held call sizes nothing, and the picture kept stands). CSS stretches. The frame after a resize
is never idle.

**RN4 `R.frame(f) → 0 | 1 | 2`** — SCENE, at most once a tick, and in `settle`. `f` is one object SCENE reuses:
```
f = { t, dt,              // scene seconds; this step's
      shot,               // integer: one more at every cut, every unseen jump, every restore, every scene shown —
                          //   and at a camera key set at once outside a cut (5.16)
      whole,              // boolean: true from the first frame of a new `shot` until that frame is drawn;
                          //   always true in a thread with no loop (a render)
      wait,               // boolean: a make of something shown is in flight, or people.building()
      camera,             // Camera (RN5) — the frame's
      toward,             // Camera | null — where the camera will be `host.ahead` seconds on, along a path the
                          //   engine knows: the viewer's ease to a target he set, the operator's glide, camera
                          //   keys moved over time (a film's, a shot's, a sequence's move: `director.ahead(h)`,
                          //   written into one object reused — the keys' values h on by the moves running now,
                          //   each its own ease to its target; a sequence's later steps are not foreseen); a
                          //   camera that follows a thing takes the thing's point as it is now (a walk is not
                          //   foreseen); the path's end where it ends sooner. Worked out with the frame's
                          //   operator's way round as it stands (no rays of its own), and PLACED AGAIN only by
                          //   scene time — every `host.ahead` / 2 —, and at once as it begins and at a new
                          //   `f.shot` (not as a camera move begins or ends — a script may begin one each tick —,
                          //   nor at each new target of a drag) — between, its camera is the same, so its view
                          //   stands and its items are named again uncomputed (SH10). Its cost: an ask of a view that stands
                          //   each tick, a moving view's ask every `host.ahead` / 2. Asked ahead like a shot's
                          //   view, without overrides. Prefetch only: nothing waits for it; the stand counts its pages as
                          //   the painters' work (ST3 `soft run`)
      rect,               // { x, y, w, h } the safe rect inside the canvas, CSS px (RN5)
      seen,               // { x, y, w, h } the whole canvas, CSS px: what the frame's, toward's and a shot's
                          //   projections map onto (RN5)
      stage,              // Float64Array(4): the safe rect in the frame's clip space — its middle across, its top,
                          //   a stage height across and down: where an insert is laid
      over, overN,        // the frame's swaps (SH2) — they ride in its own view, its mirrors' and its shadow views';
                          //   always empty while `whole`
      ahead,              // [{ camera, over, overN, nodes: Float64Array, nodeOf: Int32Array, nodesN,
                          //    hidden: Int32Array, hiddenN, shown: Int32Array, shownN, stamp, whole, bias }] — one per
                          //   live shot, the same objects while it lives: its swaps; (node row, its 3 × 4 matrix)
                          //   for the nodes its values place elsewhere; node rows its values hide; node rows its
                          //   values show; `stamp`: the `world.tick` at which its overrides or its swaps last became
                          //   other than they were (SCENE writes it, comparing — 3.4's rule; R culls the shot's
                          //   views again on it); R writes `whole`, `pages`, `land` (its land's tiles still
                          //   lacking, at the levels it reads) and `bias`, nothing else
      moving,             // boolean: the camera moved since the last tick
      veil,               // the stage's veil, 0…1 (2.10): laid last in the canvas pass; 0 in a still
      next }              // a View of ANOTHER world (SH10: its own `world`) — the opening view of a scene being made
                          //   beside this one (2.9) — or null: asked in every round of the call after all of the
                          //   frame's views (last in the order of service, with its share of the room kept: 5.19 —
                          //   the View's `next`), at weight 0.5, as a shot's (`ahead`); R writes `next.lacking` —
                          //   what its last ask returned. Nothing of it is drawn
```
Outcome:
- **0 held** — `f.whole` and the frame is not whole: no frame goes to the canvas (it keeps its last picture);
  only bakes and shadow cells may be drawn and submitted. "Whole" = `!f.wait`, and `sheets.whole(world)`, and
  every ask of the FRAME's own views (the frame's, its mirrors', its shadow views') returned 0 at a bias that
  stands (5.19), and the land has what the frame's view draws. It is judged after the call's work: in a call with
  `f.whole` nothing is rationed — `sheets.place(Infinity)`, every land node, every static cell; the mirrors are
  drawn in the call that draws the frame.
  **A call without `f.whole` is never held** (rule 8): whatever its views lack — a moving camera's new strip, a page
  let go, a region opened anew, a layer a script shows within a shot (not a break: it comes coarse to fine from
  its top; what must appear whole is made a shot; a painting made again waits as a swap: SH2) — is read from the coarser pages there are (its parent first: SH10), and the frame is
  drawn; time goes on. That the painters keep up with what a scene's motion brings into view is the stand's to judge
  where the scene is made (ST3 `soft run`), never the viewer's to wait for.
- **1 idle** — not `f.whole`, and nothing the picture depends on changed since the frame drawn last: no node,
  quad, layer or light row marked since, no pane's stamp, no own shader's values of a quad in view
  (`world.own[i].stamp`); the camera equal; no page placed for a sheet in the frame's view or a
  mirror's; `people.show` returned false; no quad in view moves by itself (wind, drift, shimmer, flicker, an own
  shader that reads `u_time` or calls `cycle` — the two names of LG2 that read the time —, a mirror's or a pane's overlay that ripples: `ripple` above 0); no shining light flickers; no particle alive; no rationed work waiting; no quad
  with `OFFERED` in view (it pulses: IN3); no `R.resize()` since; `f.veil` the same. Nothing is drawn.
- **2 drawn**.
RENDER's own tables that follow the world — the lit set, the grid, a land field's nodes — are written where they
changed, in any call (2.1 step 8c); what only a drawn frame reads — the order, the views' uniforms, the emitters' rows,
the land's leaves — only in a call that draws. A call that ends idle has written nothing.
`a.whole`, `a.pages`, `a.bias` — 2.3 step 4. R bakes land and prepares nothing else for views ahead. A view ahead has a land
field of its own while its shot lives; `a.whole` is never true without its land — all of it for a view that
stands; for one that moves, its levels from the one the view reads (`coarser` / 4) up, and at `BIAS.MOST` the
coarsest (2.3 step 4). A field ahead is baked by a ration of
its own (`host.land` a field a frame: 4.9), in a call with `f.whole` too — "every land node" there is of the frame's field.
A tile is the same in every field (its level and its place say it), and each field keeps the heights of the tiles
it holds (2.4 MB a field, the thread's): before it bakes, a field takes the tiles it lacks that another field holds
— the kept heights written again, no call of the land function —, `SLOTS` (36: a level's window) a frame, every
one in a whole call. So the ration is of the land function alone; a field ahead about the frame's eye is whole in
as many frames as it has levels, and two fields over the same land bake each tile once (the frame's first: what
it has just baked the others take).
**A solid insert that covers the whole canvas hides the world**: while an insert's opening is 1, it has no
`iris` (so it is seen from edge to edge), its painting's rect covers all the screen shows (`world.view.seen`: a
screen wider than the widest frame, or taller than the stage, sees the world round it — drawn), and its base sheet
is wholly opaque (SH13 — read after this call's `sheets.place`: a page with a hole lifts the cover in the very call that places it), R draws nothing
of the world for the frame (it still culls: the asks need the lists) — no world quads, people, particles, mirrors, shadow views, bakes — only the inserts; what is skipped so is not "rationed work waiting": a still close-up is idle. A land node's heights are not among what is skipped: they are the thread's data for a view, as pages are, and are baked by the ration under a cover as always — the frame's field's and the shots'. An
insert seen through an iris, or still opening, has the world round it, drawn as always. While the world is
hidden its views are still ASKED, at weight 0.5 (SH10), so its pages stay: when the insert closes — which is not
a cut and holds nothing — the world is there whole at once. A shot that begins under the cover is whole without the
world's passes; the call in which the cover then lifts does a whole call's work for the world before it draws — every
land node, every static cell due —, so the world is there whole in that case too.
**A closed insert is asked ahead, quietly**: an insert whose opening is 0 is asked in the frame's view (SH10
`inserts`), so that when its key leaves 0 its pages are there. Its pages are preparation, not the frame's own: they
take cells only from the room every view's own pages leave, and count toward no view's pressure (5.19) — a closed
close-up never makes the picture on screen coarser. Opening an insert is not a new shot and holds nothing.
**An insert opens only when it is finished, and SCENE says when.** `world.inserts[i].open` (WT5) is the opening
SCENE shows, not its key: it stays 0, the key above 0, while the insert is `making` — a make of it asked or in
flight, or its painting waiting as a swap (a script set who is in the close-up and opened it in one tick) — or while
a page the frame's view named of the insert's quads in the cycle before is not in the cache (SH3's count of each
of their sheets; a page denied at the bias's end is not counted, so it always opens). From the tick its key leaves 0 its quads
are listed — asked as the view's own —, so what it waits for is painted first. When it is ready its opening begins:
the key's move (from, to, ease, length) run from that moment, and the opening shown is the smaller of that delayed
move and the key — so it never pops in half open, and a key that turns back is followed at once; a key with no move
(set at once, or by an animate or a path every tick) opens as the key is — such a key may show the insert half open
the moment it is ready; closing never waits. In a whole frame (a
render, a seek, a cut's first frame) the opening is the key at once. Its points (PG5) and what it offers (IN1) follow
that opening: nothing is pressable that is not drawn. Where its pages were there it opens at once; where the room was
full, late, the scene going on under it — never soft; the stand judges how late (ST3 `insert late`). Opened, it is
the frame's view's own: where the view and the insert together are over the room, the pressure rises for the view as
a whole — the world round the iris and the insert alike, honestly coarser (5.19); the stand counts a scene's largest
closed insert into its view's pages (ST3). An insert already open goes on showing its old sheet until the swap lands
(SH2).

**RN5 `Camera`** (SCENE makes the frame's and the shots'; R makes its own for mirrors and shadow views in the same
form; nobody keeps another area's Camera past the tick except `f.ahead[i].camera`):
```
Camera = { eye:  Float64Array(3),   // world metres (x across, y up, z = −distance)
           rot:  Float32Array(9),   // world → eye rotation, column-major; the eye looks down −z, +y is up
           proj: Float32Array(16),  // eye → clip, column-major, WebGPU clip space, depth reversed (near → 1, far → 0);
                                    //   perspective: near 0.1 m, far at infinity
           yaw:  number,            // radians about world y: the turn quads that face the eye take in this view
           ortho: boolean,
           pose: null | object }    // the camera module's own (where it is: play/camera.js); null in R's
```
Every Camera is made by `render/views.js` `newCamera` — one shape (5.16: records of two shapes passing one place make
their fractions on the heap where they are read).
`proj` maps the eye's space onto the view's own rectangle. For the frame's Camera, `f.toward` and a shot's that is
the WHOLE CANVAS (`f.seen`): clip ±1 are the canvas's edges. Scenes are laid out for the SAFE rect (`f.rect`): the
canvas's shape held to 4:3…21:9 (`NARROWEST`, `WIDEST`), fitted whole — never cropped — in the canvas's middle; its
height is the focal length and its eye's line the principal point (a rolled camera's focal length is that much
longer that the picture still fills the safe rect), and the canvas round it is the world going on, projected the
same way — never stretched, no bars. Between 4:3 and 21:9 the two are one. RENDER draws such a view with the
viewport and the scissor at the whole buffer, and that size is the View's `width, height` (SH10) and `View.size`
(4.1); the opening's view (2.2 step 5) is sized the same way. What is about where the story is keeps the safe rect:
the operator's framing (`camera_frame`, the shot sizes), the viewer's limits, the controls' thirds of a
platformer, an insert (laid over it: `f.stage`, the safe rect in the view's clip space — the frame's uniform
`e_stage`, a View's `stage`), the frame message's `frame` (PG5) and `stage.frame()`, the ground-edge check (the
widest safe frame, then what a 32:9 screen sees past it — said as such). The sky: a sky element paints its `box`
(stage heights; by default the stage and its margins, at most a whole turn across and −3…4 down — a sheet like any,
its pages asked where seen; a whole turn at `MAX_PPM` is about 13 000 px, 51 pages a row: within the table's window).
A backdrop's sheet that reaches into more turns of the circle than one (a sky painted a whole turn round) is drawn by
a row of the order for each turn it reaches into (render/quads.js `turnsOf`: its posed corners' turns, as far as the
wind may bend it — as SHEETS asks its pages), the turn in the shape word from bit 8 (signed): the vertex stage lays
every point of the row in that turn (world.wgsl.js `e_skyWayIn`), and the fragment keeps only what lies within the
turn's sides (`e_backdropSees` in `e_amount` — the way interpolated is the pixel's own; the quad's `info.z` says it is a
backdrop). One row with each point in its own nearest turn tore the grid's cell across the turn's back — its corners
72° apart either side of the gaze — and drew it over the view (2026-10-27).
Past what the first SHOWN sky element paints it is carried on softly (render/sky.js, decisions S7) — one triangle,
drawn in the frame's view only while the view shows anything past the painting (`stage.past`: the view's border
brought back to the sky), each pixel read at its own level at the edge and ever coarser away from it. The tier's pixel budget (4.9) is
the whole canvas's, as the buffer always was: on a screen of 4:3…21:9 nothing changes; wider or taller, the frame
draws all of the budget's pixels where it drew the safe rect's share — the cost of a frame grows to the budget's
(5.17's arithmetic is of the budget), the resolution does not change.

**RN6 the world's tables** — 3.4.

**RN7 `R.waits() → W | null`** (PG8's shape, the renderer's part); **`R.missing() → string[]`** — plain words of
what a held frame still waits for. `R.waits()` answers for the call just made; SCENE tells it to the page only
while the frame is held, a scene is being built or a job apart runs (PG8). **`R.pipelines() → [made, asked] | undefined`** — the pipelines being
made (`gpu.waiting()`; undefined: all are made): `R.waits()`'s own, and what SCENE tells with a wait on a shot alone.
**`R.working() → boolean`** — R's own work still under way that gets there by itself frame by frame: pipelines being
made, the land baked by its ration (the frame's field, a shot's ahead); one of the things SCENE's one test of "something
is on its way" asks (2.4 step 3, RN12, 2.9 step 4).

**RN12 the fault of a held frame**: when `R.frame` returns 0 and nothing is in flight (no page in flight or arrived,
no make asked, no people's build, no build, not `R.working()`), SCENE throws the fault of 2.5 step 3 with `R.missing()`'s words — in a viewer's loop as in
`settle`.

**RN8 counters**: `R.counters = { frames, drawn, held, idle, pixels, draws, triangles, placed, lit, blended }`
(`frames`, `drawn`, `held`, `idle`: counted since the mount; the others are of the last `R.frame` call, all its
views together, people's draws and triangles among them (PP10), 0 where the call drew nothing — `pixels`: the buffer's width × height; `placed`: pages placed in that call; `lit`: lit points
drawn; `blended`: quads in the blended list — what the content guidance names, measured: 5.12);
for the stand's detail, beside them (numbers rewritten in place, of the last call): `R.counters.shapes` — the lit
points by shape (an Int32Array by `SHAPE`'s numbers — six —, and after them the SCREEN shape's, whatever its
grid), `R.counters.mirrored` — the lit points drawn in mirrors' passes, `R.counters.particles` — the particles
of the emitters drawn (each one's whole count while anything of it may be in the air: how many are alive the GPU
alone knows), `R.counters.people` — people's triangles (they are in
`triangles` too), and what the call worked on: `quads` (the world's), `listed` (the quads listed by the culls of the
frame's view, its mirrors' and its shadow cells'), `asked` (the quads the asks worked out — SH10's items: a quad
worked out for three views counts three), `persons` (the world's), `shown` (the persons shown: here and in any
of the call's views — `people.shown()`, PP7); `R.stamped()` — the elements with quads stamped in the frame's view, by calls where its camera
stood and moved, by table (quad, node, layer) and how far a node or layer moved (`world/tables.js` `T.measure`: kept
only while measuring) — the stand keeps its running sum at each segment's start (`call('stand', 'segment', name)`); **`R.lacks`** — what the call's frame still lacked: `{ wait, sheets, pages, mirrors, cells, land }` (`wait`:
`f.wait`; `sheets`: not `sheets.whole(world)`; the others numbers — `land` in tiles; what `R.missing()` words);
`R.wide`, `R.wideNames` — the detail run's counts of the asks and culls (`render/survey.js`, ST2 `wide`);
`R.detailed(on)` → `gpu.timing(on)` and its own per-stage JS timers; `R.timing` — ONE object made once, `{ [stage]:
{ js, gpu } }`, ms, its numbers rewritten in place, of the last `R.frame` call: first the stages before the
passes, in their order — `place` (2.1 step 8b); the views placed (8c): `view`, `lights`, `land`, `mirrors`, `shadows`,
`ahead`, `particles`; `people` (8d); the culls (8e): `cull`, `cull mirrors`, `cull shadows`, `cull ahead`; `ask`,
`ask mirrors`, `ask shadows`, `ask ahead` (the views asked), `weigh`, `judge` (8f), `request` (8g); `outcome` (the rationed things, the held-or-idle judgement), `write` (the buffers
written before the passes) and `submit` —, `gpu` −1 in each; then every pass name of 4.4 in 4.4's order. A stage or a
pass that did not run in the call reads −1
in both (GP11) — every pass, after an idle call; a held call's stages are there (its time is the heaviest:
the whole-frame rounds); null when not detailed.

**RN9** — there is no `R.dispose`: a world replaced is let go inside `R.build` (RN2), and at the stage's end the
worker is terminated (2.9 step 5). **RN10 `R.lib`** — the pipelines' library, given by SCENE to
`createPeople` as `lib`.

**RN11 the pacer** is SCENE's alone (`engines/3/play/pace.js`, 5.1). R gives it the outcome of RN4; GPU gives `gpu.flying`.

### 3.4 The world's tables (SCENE owns and writes; RENDER, SHEETS, PEOPLE read)

`world/tables.js`. Typed arrays indexed by row. A row freed is reused; arrays grow by doubling (never in a tick
that only moves things). `world.tick` is the number of the step — it moves on at the END of every step, and before a frame drawn with no
step (2.6 step 3, a `still`: the rows marked since are flushed first) — whenever the tables are shown to a reader —, so a
row written after a step, in a message's task (`select`, `offer`), carries a tick no reader has seen: **a reader that
keeps the tick `T` of a call of its own sees as changed since exactly the rows with `stamp ≥ T`**; a row's `stamp` is the `world.tick` at which a
DIFFERENT value was last written to it — writing what is already there does not stamp (so an animate that sets the
same numbers every frame costs a comparison and nothing after it). Readers never write. Every table has `cap` (the rows
allocated). Beside the tables RENDER reads `world.tick`, `world.C` (the compiled spec — `C.has`), `world.gpu = {
nodes, quads, layers (the GP2 tables), forms (the texture), formsRows, formsVersion }`, and of an element only what WT11
lists.

**WT1 nodes** — `world.nodes = { n, m: Float64Array(12 · cap), parent: Int32Array, stamp: Uint32Array, shown:
Uint8Array }`. `m`: the node's world matrix, 3 × 4, column-major (x axis, y axis, z axis, origin — metres, world).
One node per element; per copy of a copied element; per copy of each part of a painting; per pane given as a
polygon (`world/light.js`); per
person — a person's row holds their root, copied by SCENE from `people.root` each step (PP3); the person's ANCHOR
— where SCENE's placing puts them — is not in the table (PP1 `anchor`: a row written with the anchor and then with
the root would be stamped every step, and no scene with a person would rest). A sky element's row is not a
matrix: it holds the sky's map (the horizon, the stage's width, whether it goes round), read only by SCENE's
`skyWay`, in `place` and in the chunk. `shown[i]`: 0 for a
closed insert, a person not here — nothing of it is drawn, lit or animated, and nothing of it is asked but a closed
insert's pages (asked ahead: RN4).

**WT2 quads** — `world.quads = { n, node, sheet, layer, el: Int32Array; kind: Uint8Array; flags, recv, cast, own, clip:
Uint32Array; rect: Float32Array(4 · cap); tint: Float32Array(4 · cap); seed: Float32Array; stamp: Uint32Array }`.
`node`: its node; `sheet`: the sheet's handle (SH1), −1 none yet (not drawn); `layer`: its row of WT3 or −1;
`sheer` (Float32Array): the element's `translucent` (0 … 1) — how much of the light from behind it comes through
(5.5); 0 else;
`el`: the element's index — its row of `world.elements` and of `C.elements` (WT9); `kind`: `QUAD.CARD = 0` (stands turned its own way), `FACING = 1` (upright, turned to
the eye about its node's vertical), `PLANE = 2`, `DRAPE = 3` (lies on the land — only in a world with a land function: a `drape` plane of a world without one is
a `PLANE`), `SKY = 4`, `INSERT = 5`,
`FORM = 6` (stretched over a grid: WT10; `form` — an Int32Array of the table — is its row of `world.forms`, −1
else); `aux` (Int32Array): an INSERT's row of `world.inserts`, −1 else (the one meaning; SCENE writes it);
`rect`: (l, t, r, b) in the sheet's units — metres in the node's plane, y down; stage heights for sky and insert;
`tint`: (r, g, b linear, glow) — a copy's `tint` and `glow`, (1, 1, 1, 1) else; `seed`: the phase of its wind and
flicker; `recv`, `cast`: the shadow receivers it is and the casters' set it is in (bits; 0: none — `cast` is 0 too for a layer whose `blend` is `add` or `multiply`: light and a stain are not matter and cast nothing, as on engine 2). `recv` bit 0 (`RECV.GROUND`: 4.7) is THE
GROUND — what a caster's default `onto` and people's shadows fall on: a draped plane, a plane people walk on
(`walk`) or are carried by (someone stands `on` it), a plane lying level on the ground (no `on`, no tilt, under 0.2 m up); the further bits are the
elements some caster's `onto` names. Never by an id: `'ground'` is a word of `onto`, not an element;
`clip`: bits 0–1 — the cutter set a `CLIPPED` quad is clipped by; bit 2 — it is seen OUTSIDE its cutters (else
inside); bits 4–7 — the cutter sets this quad is a cutter of. A cutter set is a distinct list of a `clip`'s ids;
a scene has at most `CLIP.SETS` (4) — a fifth is said once and its elements are not clipped; a plane draped on the
land is not a cutter in engine 3 (said once; `dropped.md`); a person is neither clipped nor a cutter;
`own`: its own shader's slot + 1, 0 none — a draped plane has none: its `shader` is said once at compile and not taken
(4.5 has no own pipeline over the land; `dropped.md`); `flags` (4.7): `SHOWN, GLOWS, WIND, DRIFT, SHIMMER, FLICKER, WRAP_X,
WRAP_Y, FLIP, INSIDE, REFLECTED_ONLY, REFLECTS, GLASS, CLIPPED, PART, WHOLE, ADD, MULTIPLY, READ, OFFERED,
SELECTED` (the last two: IN3), `CUT_ONLY`.
A quad is drawn when `flags & SHOWN`, its node is shown, `sheet ≥ 0`, and it is not `READ`. SCENE clears `SHOWN`
for a layer whose alpha is 0 (it is then neither drawn nor asked). An `unseen` element is never drawn; one that cuts a
clip (`clip`: another's `inside`/`outside` names it) is still listed — `SHOWN | CUT_ONLY`: its pages are asked and it
goes into the clip masks alone, into no solid, blended or cast list, onto no land, under no ray; an unseen one that
cuts nothing has no `SHOWN`. `READ`: a sheet that is not drawn by itself but
read by its element's own shader (`layer(k)`); it has the base quad's node and rect and is asked with it. Whether a
quad's paint is opaque is not here: RENDER reads it from the sheet (SH13). **A `GLASS` quad is never drawn
itself, in any view**: its painting says only where the glass is — it is the mask of the pane's overlay (5.7) —,
so it is in no solid, blended, cast or mask list; it stays in the frame's view's `list`, where its overlay is
drawn (its pages are asked: the overlay reads its alpha), and is in no mirror's.
`WHOLE` — the quad's sheet is read elsewhere than where it stands (SH10): a layer that drifts or wraps; and a
sheet of an own shader that the shader's text reads at another point than its own. **An own shader's sheet that
its text reads only at its own point is not `WHOLE`**: SCENE's compile reads the text — sheet `k` is read where
the quad stands when every `layer(k, …)` in it has exactly `at` as its second argument and the text declares no
other `at` (no `let` / `var` / parameter of that name but `shade`'s own); the painting itself (sheet 0) unless
the text calls `layer(0, …)` otherwise. Such a sheet is asked by the ordinary descent and is as sharp as any
card (the lit windows of a village on a sheet a hundred kilometres long); `world.own[i].stands` says it to
RENDER (WT5).

**WT3 layers** — `world.layers = { n, pose: Float32Array(8 · cap), opts: Float32Array(12 · cap), stamp:
Uint32Array }`. `pose`: (x, y, rotate radians, scaleX, scaleY, alpha, brightness, length — the reach of the layer's bend in the
wind: from its pivot to the farthest corner of its box, in the sheet's units; SCENE writes it with the block); `opts`: (pivot x, pivot
y, wind strength, wind gust, wind scale, flicker, shimmer, depth, drift x, drift y, spare, spare). An animate's
`e.layer(name).rotate = v` writes `pose`; reading a property of a layer the element does not have gives 0 (the
scenes test a layer's presence so).

**WT4 lights** — every light of the world, any number (the train scene has 946): `world.lights = { n, version,
kind: Uint8Array, node: Int32Array, at: Float64Array(3 · cap), way: Float32Array(3 · cap), colour: Float32Array(3
· cap), strength, reach, sprite, glow, flicker, seed: Float32Array, flags: Uint32Array, named: Uint8Array, stamp:
Uint32Array, cone: Float32Array(2 · cap) }` — `kind`: `LIGHT.FAR = 0, THROUGH = 1, POINT = 2, WINDOW = 3`; `strength`:
as it shines now (its `on`, the looks' share) — never the flicker (the GPU's); `reach`: metres; `sprite`: the radius
of its painted glow; `way`: toward a far light, a window's face, where a beam points; `cone`: a beam's — a point
light with a cone (5.5) — the cosine of half its width and the cosine where its soft edge begins (above 0), (0, 0)
for every other light;
`flags`: `INSIDE, GLOW`; `named`: a caster's `shadow.light` names it; `version`: one more when the set of lights
changed. The panes of through-lights: `world.panes` (rects in their nodes' planes), `stamp`. Which of them light
and which cast this frame is RENDER's (5.5). A spec light's `at` is any point of the world (IN1's refs: a person's —
their hands unless named —, an element's, a copy's `id:k#name`; dark while it is nowhere); its `of` takes over an
element's `e.light` by `id` / `id#name` — every copy's — or by `id:k` / `id:k#name` — that copy's alone, taken
before the one that names every copy. RENDER also reads `lights.ids` (each light's id), `lights.soft` (a
through-light's `soft`) and `world.panes.light` (a pane's light row). **`world.castsIn(quad, lightRow) →
boolean`** — SCENE's one predicate for a caster and a light: false when the light is the caster's own (its node is
the caster's — of an element with copies, the quad's copy's: its e.light, one taken over with `of`, a person's
lantern, a window's daylight); else true when the caster names no light, or names that one — by the light's id or
by the element whose light it is (the very rule `named` is marked by). RENDER's cull
of a light's view and its shadows' strengths both use it; RENDER matches no names itself. **`world.personCastsIn(index,
lightRow) → boolean`** — the same rule for a person, who has no quad row, by their element's index. Of `world/light.js`
RENDER imports `hazeReach` and nothing else.

**WT5 the look, the land, the rest** — plain objects SCENE owns, read by R each frame:
`world.look = { ambient, ambientColor, inside, haze, hazeColor, hazeGlow, brightness, tint, tintStrength,
saturation, vignette, grain, grainBlend, bounce, shafts, wind: [x, z, strength], stamp }` (`ambient` is 1
where a spec gives none; SCENE's own beside them: `hazeReach`, `lights` — each spec light's share now);
`world.relief = { height(across, distance) → metres (the land function — distance is −z; synchronous, the
thread's), field: { data: Float32Array, nx, nz, step, x0, z0 } (x0, z0: the across and distance of sample 0), low, high,
stamp } | null` — `field` is the height field the artist made: the
rays' pyramid and `low` / `high` (the least and greatest height of the field's region — SCENE's rays') are worked out of
it, and nothing is drawn or placed from it — the land drawn, the land stood on and a draped point are all the FUNCTION (RENDER's levels are
its samples and reach past the field: RENDER bounds what it draws and bakes — a draped quad's sphere, the shadow march's
ceiling — by the heights it sampled itself; WT7);
`world.emitters = { n, list: [{ p, node, inside, ring: Float32Array(256 · 12), head, bursts: Float32Array(6 · 12), sprite:
Recording | null, seed, stamp }], wind: Float32Array }` — `inside`: its element is `inside` (RENDER reads it here, never through the element); `p`: the emitter's compiled numbers — one flat object with exactly the fields the language's
`particles` has (`rate, life, size, speed, spread, gravity, drag, …`), the kind's defaults filled in, colours
linear; SCENE's specification lists them once and RENDER reads that list; SCENE's compile scales them so that the scene's sum of
`mostOf` is at most `PARTICLES.MAX` (said once: LG12) — RENDER lays out what it is given; `ring`: its last 256 moments, 12 numbers each (time, place x y z in
world metres, velocity x y z, amount, turn as a quaternion) — written every step, unseen ones too, and saved with
the scene; `bursts` likewise; `wind`: the wind's log. The moments are spaced as main spaces them
(`core/particles.js`): by time, written when the emitter's place, way or amount changed — not one a step, so
held ticks do not fill the ring with copies. **An emitter that stands on a painting's point (`at: "id#name"`)
writes no moment while that element has no painting yet** — its ring stays empty and nothing of it is drawn —,
so its first moment, written in the first step with the painting there (the scene's clock still stands: 2.2 step
8), has its true place and amount at the scene's first second: the plume is there, with its whole past, from the
first picture ("the scene goes on as if it had always been as it is now"). A point its painting does not mark is
what it was: not here, amount 0. SCENE keeps these arrays and stamps an emitter when it
writes its ring; the buffers on the GPU are RENDER's alone — it writes the stamped rings into them, less the
render origin. Particles are closed forms of these and of time (5.18); what else of an emitter RENDER reads — `n`,
`gave`, `life`, `offset`, `position`, and the wind log's `windN`, `windStamp`, and `world.emitters.air` (`{ x, z,
gust }`: the air's motion now, m/s) — is listed with its meaning in the
head of `world/emitters.js`, which is that contract;
`world.own: [{ text, names: string[], values: Float32Array, quads: Int32Array(OWN.SHEETS), stamp }]` — the own
shaders: `text` the author's WGSL, `values` its uniforms as the animate set them, `quads` the quad rows whose
sheets `layer(k)` reads (`quads[0]` the base), `stands: Uint8Array(OWN.SHEETS)` — 1 for a sheet the text reads
only where the quad stands (WT2: not `WHOLE`; RENDER reads such a sheet from the quad's origin page, exact on a
sheet of any width: SH14);
`world.inserts: [{ el, key, open: number 0…1 (the opening shown — SCENE's, from its key once it is finished:
RN4), iris: [x, y, rx, ry] | null (stage heights; null: from the middle
of the frame to all of it), making: boolean (a make of it is asked or in flight, or its painting waits as a swap: RN4), stamp }]` — every insert of the scene, open or closed, at most `INSERTS.MOST` (16; more is an error of the scene's
build — today's most is 4); RENDER writes every row's
`iris` and `open` into its `Frame` uniform (an array of 16, indexed by the row) for the insert pipeline and SCENE's `place`;
`world.panes: { n, node: Int32Array, rect: Float32Array(4 · n) (l, t, r, b in the node's plane), poly:
Float32Array (the pane's outline, x, y pairs), polyOf: Int32Array(2 · n), stamp }` — RENDER rasters them into
the `panes` texture (4.2) itself;
`world.people` (PP1) | null; `world.bounds: { min: Float64Array(3), max: Float64Array(3) }` (the world's box, for
the shadow views', the grid's and the land tree's extents — worked out again whenever a node moved, was shown or a block
was taken, in unseen steps too); `world.origin: Float64Array(3)`, `world.originStamp` — the render
origin: a point SCENE keeps within 96 m of the frame's eye, moved in whole steps of 64 m. On a step of the origin,
in that same tick, SCENE writes every node row; RENDER re-bases its lights, land, shadow views and the emitters'
buffers.

**WT6 the world on the GPU** — SCENE owns three GPU tables (GP2), the texture `forms` (WT10) and their WGSL
(`world/world.wgsl.js`, chunk `world`): `nodes` (48 bytes a row), `quads` (96), `layers` (80); layouts in 4.1. The chunk gives every vertex
stage, by these exact names:
```
fn quadOf(i: u32) -> Quad                       // the row
fn quadPoint(q: Quad, uv: vec2f) -> vec3f       // uv 0…1 across its rect → the point in the node's plane, after
                                                //   the layer's pose (no wind: wind is RENDER's)
fn quadWorld(q: Quad, p: vec3f, yaw: f32) -> vec3f     // → world less the origin; FACING turned by the view's yaw
fn quadNormal(q: Quad, uv: vec2f, yaw: f32) -> vec3f   // the surface's turn there: constant for flat kinds, the grid's for FORM
fn quadGlow(q: Quad) -> f32                             // 1; SELECTED: 1 + PULSE.DEPTH; OFFERED: Frame.pulse (IN3); 1 in a mirror's view
```
**One author for every kind's mapping**: SCENE writes the JS (`place`) AND the WGSL of all seven kinds. For the
three that need another area's data the chunk calls functions that area provides by these names: `fn
reliefAt(xz: vec2f) -> f32` (RENDER's — the land's field of the view, group 1: 4.2 — DRAPE), `fn insertOf(i: u32) -> vec4f` and `fn insertOpen(i:
u32) -> f32` (RENDER's `Frame` — INSERT's iris); the sky's mapping (`skyWay`) is SCENE's own arithmetic in both.
So the pages the ask names and the pages the shader reads cannot have two authors.
and the same mapping exists once in JS: **WT7 `place(world, quad, p: Float64Array(3)[, over]) → boolean`**
(`world/place.js`) — `p` is given as the sheet's point (x, y) of that quad and the yaw of the view, and taken back
as the world point (the numbers go in and come out in the one array: a number handed to a function is made on
the heap at every call, and this is called for every corner of every page a view is asked — 5.16): CARD, PLANE:
`m · (x, −y, depth)` (`depth`: the layer's, 0 without one); FACING: the node's origin + the node's scale · `Ry(yaw)` · (x, −y,
depth); a layer's pose first — for every kind, the sky too; DRAPE:
lifted by `relief.height` at the point (the land function itself); SKY: the direction `skyWay(x, y, …)` at infinity; INSERT: the frame's rect (a point
outside its iris as far as it is open is not there); FORM: bilinear in its grid (WT10). `over`: one
object `{ nodes, nodeOf, nodesN, over, overN }` — a shot's node overrides (RN4) and a view's swaps (for a swapped
FORM's grid). A sheet an own shader reads where its quad stands (a `READ` row that is not `WHOLE`: WT2) is placed
without its layer's pose — the shader reads it at the painting's own point, whatever pose that layer has, so its
pages are asked there. SHEETS' ask and RENDER's culling call `place`; the WGSL chunk is the same arithmetic by
the same author.

**WT8 `world.pointOf(ref, out[, get]) → boolean`** (with `get`, key → value: as those values would have things — a
point in an element's frame by that frame then, an element's point carried with its node there; a person's and a
copy's as now), `world.carriedWith(el, p, get, M) → M` (a point of el now moved as `get` places el's node; its world
matrix then into M), `world.movedBy(id) → string[]` (the keys that move an element and what carries it),
`world.placedNow(id) → boolean` (put where it is at once this step: `jumpedAt`), `world.view` (`{ safe, seen }`:
what the screen shows in stage heights — the camera writes it as the canvas is sized; `e.view`, `scene.view`: LG18),
`world.byId`, `world.quadsOf(el) → [first, count]`.

**WT10 forms** (5.23) — `world.forms = { n, list: [{ el, points: Float32Array(33 · 33 · 3), normals:
Float32Array(33 · 33 · 3), closed: 0 | 1 | 2 | 3 (u, v bits), sphere: Float32Array(4), stamp }] }` — points in
the node's metres (the author's function answers in the element's own — x across, y up, z toward its front: 5.23 —, and
SCENE carries a plane's points through its carry frame into its node's: one frame for authors on a card and on a plane), row by row in v; normals worked out by SCENE from neighbours (across the join where
`closed`). On the GPU: SCENE's texture `forms` (`rgba32float`, made through GP4, written with
`queue.writeTexture` when a form's stamp changed): form `i` takes the rectangle 66 × 33 texels at `(66 · (i mod
31), 33 · floor(i / 31))` — a point's texel and, 33 to its right, its normal's. The chunk `world` reads it with
`textureLoad` (`frame` binding 11). A `FORM` quad's `rect` is its painting's rectangle; (u, v) of the painting
is the grid's own. **A form made again takes a NEW row** (its points arrive in the same `made` as its recording); the
row in use stays until the swap that carries the new one is written (SH2), and is freed with the old sheet. A
shot ahead carries its forms in its swaps: `place` (WT7) takes a view's swaps and reads a swapped quad's grid
from the swap's row, as it takes `nodes`. The texture grows by rows of 33 texels (a new texture, every form
written again, a new `frame` bind group) — at a make, never in a tick that only moves things.

**WT9 what the artist shares with the thread** (SCENE's modules; the artist imports them — 8.3):
`compile(spec, warn) → C` (`world/spec.js`: the compiled spec — `C.elements[index]` with its paint code, `C.has`
(RN2), `C.state`; the same in both threads, by index — an element's `index` IS its place in `C.elements` and in
`world.elements`; an entry of `spec.objects` that is not an object is said once and makes no element, and the
place in `spec.objects` (the `objects[i]` of a path) is the element's own field `path`); `kit` (`world/kit.js`: `kit.shared(spec, modules) → { anim,
lib, kits }`); `landOf(C, shared[, warn]) → height(across, distance) | null` and `fieldOf(height, region) → field` (`world/relief.js`).

**WT11 what RENDER reads of an element** (`world.elements[i]`; read, never written, and nothing else of it):
`index`, `id`, `kind`, `node` (its row of WT1), `first`, `count` (its quad rows: WT8), `visible`, `radius`, `cast` (the
receivers its shadow falls on, WT2's bits — for a person, who has no quad row to carry them; 0: the ground, bit 0); of its compiled spec (`spec`): `behind`,
`inFront` (the ids named), `shadow` (`{ light, onto, strength }`, null or false), `reflect`, `glass` (their
numbers — a mirror's `strength`, `rough` and `ripple` may be state keys there), and `mirror` (a mirroring plane's
`{ strength, rough, ripple, stamp }` now: its keys' values, 0…1, worked out by SCENE as they change, the tick they
did), and the `flags` `translucent`, `reflect`, `glass`, `inside`. What a quad row carries — the clip's set
and side, a cutter's sets (WT2) — is read from the row, not from here. (The stand's detail run alone —
`render/survey.js` — also reads `nodes` and `partSlots`, to tell whose node a stamp is.)

### 3.5 SCENE ⇄ SHEETS ⇄ RENDER (the sheets)

SH0–SH8 are called by SCENE; SH9–SH14 by RENDER, inside `R.frame` or `R.build` — and SH10–SH12 also by
SCENE during a first build (2.2 step 5).

**SH0 `createSheets(gpu, host) → sheets`** (`sheets/cache.js`) — once per mount. Allocates the cache texture once
(`host.cache` layers; never grown), the page table (a GP2 table), starts `host.painters` painters. One `sheets`
serves every world the thread shows. There is no `sheets.dispose`: at the stage's end the worker is terminated (2.9
step 5).

**SH1 `sheets.add(recording, { wrap: [x, y] }) → handle`** (integer ≥ 0). Sheets whose lists, rects and wraps are
the same share their pages. **`sheets.release(handle)`**. A recording never changes: a sheet painted anew is another handle.
Handles are kept only by SCENE: in `quads.sheet` and in swaps. A recording given to `sheets.add` is the sheets' to end:
the images it carries are closed when the sheet's last holder releases it, and each painter closes its copies when it
is told to drop the sheet.

**SH2 swaps** — a sheet that is to replace a quad's sheet when its picture is there: triples `(quad, handle,
form)` in an `Int32Array` — `form`: the new row of `world.forms` when the element has a form, −1 else. **A swap
writes `quads.sheet` and `quads.form` together**, so a shape and its painting never change apart (the quad row
is stamped by it: shadow cells, mirrors and the idle rule follow as for any quad). A shot's swaps ride in `f.ahead[i].over` and are applied at the cut. **A swap may END a row**: the triple `(quad, −1, −1)` —
a shot whose painting of an element has other parts or layers than the element has now names the new block's rows and,
so, every row of the block its cut will free; a shot's views leave such a row out of their lists and their asks, the
frame's views ignore the triple. A repaint inside a shot rides
in `f.over` — the frame's swaps, given to the frame's own view, its mirrors' and its shadow views' (so `sheets.missing`
counts the pages every one of them named, and the swap lands when a mirror has them too); SCENE writes `quads.sheet[quad] = handle` in step 6b (before the flush) of the first
tick where `sheets.missing(handle) === 0` — until then the quad shows its old sheet. A swap whose sheet is replaced by a
newer one before its pages came is simply replaced. **While `f.whole` there are no swaps in the frame's own
view**: a painting taken then is written straight into `quads.sheet`, and so are the swaps that were waiting when
`f.whole` became true (the picture is held: there is no old sheet to keep showing) — `f.over` is empty in every
whole frame, so "whole" (RN4) never waits on a swap. Outside a whole frame every painting taken waits as a swap — the first
painting of an element that has none too (its make had failed).

**SH3 `sheets.missing(handle) → integer`** — of the pages the cycle that ended last named of that sheet, how many
are not in the cache now (a page the last `weigh` denied a view at its bias's end is not counted: it will not come);
for a sheet no ask of that cycle named: 1 while its top is not there, else 0.

**SH4 `sheets.coverage(handle, u, v) → 0 | 1`** — from the top page's mask (1 where alpha > 160 of 255), sent by
the painter with the top; 0 until the top is there. Used only by the author's selection (IN6). **A camera's question reads nothing of the cache** (the operator's way
round, the target hidden — said once a shot —, the wheel's walk, the ground's end): for it a quad stops a ray over its recording's `extent` (SH7) — the same on
every run —, but a veil stops nothing: a layer that adds or multiplies (light, a stain: it casts nothing either, WT2), or
a painting whose `dense` (SH7: how much its densest draw covers) times its layer's alpha now is below `CAST.ALPHA` —
the line under which a cast program drops a fragment: what casts no shadow hides nothing (mist, smoke, a haze; veils laid
over one another are each taken by itself) —, and the way chosen as a shot begins is chosen again, while that shot's first frame is not yet drawn, whenever
a painting is taken.

**SH5 `sheets.onArrive = fn`** — assigned once by SCENE; called for every page arrived from a painter (the
`arrival()` of 2.5 is built on it, on makes' answers and on PP4's `built`). **`sheets.flying → integer`** — pages
asked of painters and not yet arrived. A painter's thread that dies (its `error`) is the engine's own failure:
SHEETS tells `host.failed(err)` and SCENE ends with `{ t: 'failed' }` (PG7) — pages are never left in flight for
ever.

**SH6 the artist's messages** (SCENE's world ⇄ `sheets/artist.js`; a new artist for every scene shown):
- `{ t: 'show', spec, modules }` — once; the artist compiles it (WT9) and makes its own kit, lib and land function.
- `{ t: 'keys', keys, values }` — the state's keys changed since the last message; sent only in front of a make.
- `{ t: 'make', job, index, as, spot }` — paint element `index`; `as`: a shot's values over the state, or null;
  `spot`: `{ across, distance, elevation, ground }`. One make in flight an element (plus one per live shot).
- `{ t: 'made', job, rec, form: { points: Float32Array(33 · 33 · 3), closed (WT10's bits, 0…3) } | null (5.23), parts: [{ dx, dz, box, rec }], layers: [{ name, opts, rec }], lights, points, notes,
  reads: [key], seen: [[key, json]], errors, warnings }` — `rec`: a recording as sent (`Recording.wire()`, its
  buffers and images transferred), or `null` when the painting's code threw or its form was refused (5.23; `errors` say it): SCENE then takes
  no sheet, part, layer or form from that answer — what the element had stays (2.4). SCENE makes it live (`Recording.fromWire`) and gives it to `sheets.add`.
  The rest of `made` has the shapes a painting's result has in engine 2 on this branch (engine 2 (gone),
  `contexts`, `:57–135`): a part's `box` — `[l, t, r, b]`; a layer's `opts` — the layer's options as the language
  has them — but `box`, which for a layer that wraps is the box as laid (SH7: widened to whole level-0 pixels; the rect of its recording and of its quad) —, unknown ones said and left out (`blend: "screen"` among them, LG7 — said by the easel, not by SCENE); `lights` — `[{ x, y, r, color, strength, name | null, part, layer }]`;
  `points` — `[[name | null, { x, y, part, layer }]]`; `notes` — `[{ value, at: { x, y, part, layer } | null }]`;
  x, y in the painting's units, `part` / `layer`: the index in `parts` / `layers` the thing was painted in, −1 the
  base.
- `{ t: 'land', region }` → `{ t: 'landed', field }`.

**SH7 `Recording`** (SHEETS' class, exported by `sheets/recorder.js`, used by SCENE as a value): `{ rect: [l, t, r, b] (the painting's box: what its pages are laid over and a picture —
SH9 — is of), extent: [l, t, r, b] | null (where ink was drawn), empty: boolean, dense: 0…1 (how much one draw of it
covers a pixel at most — its style's alpha, a gradient's most opaque stop, or its shadow's, times globalAlpha; a pattern,
an image, a way of compositing other than source-over, a filter by url, a ground: 1; worked out as it is recorded), h1, h2 }`,
`same(other)`, `touches(l, t, r, b)`. It carries the images a painting drew (a painting may build pictures in
canvases of its own and draw them — the close-ups of five scenes do; what it may not read back is the canvas it
paints into). A draw of full transparency still counts as ink (six paintings rely on it so that their shader
covers their box). SCENE never replays one. Level 0 of every sheet is `SHEET.MAX_PPM` px a unit of its `rect`,
and a quad's `rect` (WT2) is its recording's. The box of a layer that wraps is laid to a whole number of level-0 px
along the wrapped axis (the easel widens it by the remainder), so the painters' period, the shader's and RENDER's drift
are one number.

**SH8 the easel** (`sheets/easel.js`, in the artist): the `e` paint code is given — as the language has it
(`e.state`, `e.spot`, `e.light`, `e.at`, `e.part`, `e.layer`, `e.rnd`, `e.ground`, `e.area`, `e.id`, `e.aspect`,
`e.kit`, `e.lib`, `e.anim`, `e.debug`, `e.warn`, and `e.form(fn, opts)`: 5.23 — the easel samples `fn` on the
33 × 33 grid; the painting is opaque by construction — the `ground` colour, taken opaque, lies under everything
the code paints, also under what it erases), and the canvas `g`: the Canvas 2D calls the scenes use, among them
`Path2D` with `addPath`, `DOMMatrix`, `getTransform` / `setTransform`, `globalCompositeOperation`
(`destination-out`, `lighter`), `filter: blur()` (lengths in the painting's units), `fillText` / `measureText` /
`font`, `drawImage` of the code's own canvases. SCENE's `world/element.js` holds only the animate's `e`.

**SH9 `sheets.picture(recording, w, h) → Promise<Uint8Array>`** — the whole list, over the recording's `rect`, rastered
by a painter into w × h (rgba8, premultiplied, sRGB-encoded, rows top first): RENDER, for each painted particle
sprite — at `R.build`, and when one is painted again (RN2). A sprite's shape and its frames are of the `rect`:
**`frames` are painted side by side** (the language's word) — the rect cut into that many columns, a frame a
column; RENDER asks the picture `frames` sprites wide and keeps each frame as a layer of its own, and a
particle's quad has ONE frame's shape (the rect's width over `frames`, by its height).

**SH10 `sheets.ask(view) → integer`** — the pages that view reads, at the level it needs, that are not in the
cache (0: the view is whole) — its own pages only: not the quiet ones (closed inserts), nor one the last `weigh`
denied a view at its bias's end. No GPU, nothing allocated.
```
View = { world,             // whose quads
         camera,            // Camera (RN5)
         width, height,     // px of the viewport this view is drawn into (the frame's and a shot's: the whole
                            //   buffer — RN5; a mirror: its image; a shadow view: its static cell's side)
         stage,             // Float64Array(4): the safe rect in its clip space — its middle across, its top, a stage
                            //   height across and down: where an insert lies (a view that asks inserts: f.stage)
         weight,            // 1 the frame's view and the own view of a shot that is the film's next beat
                            //   (`a.next`, 2.3 step 4) outside a whole call, 0.5 any other
         coarser,           // quarter levels added to every level of this view (R's): 8 for a shadow view (a
                            //   shadow needs a sheet's shape, not its detail); and, for every view of a shot whose
                            //   camera moves, what its motion asks (2.3 step 4: raised by R a quarter level at a
                            //   time while pages enter it faster than they are painted, lowered one where it
                            //   lacks nothing and none entered, 0 again when the camera stood); 0 else. With the pressure it never passes
                            //   BIAS.MOST over a shadow view's 8
         inserts,           // boolean: inserts are asked too (the frame's and shots' views) — open ones as the
                            //   view's own; closed ones quietly, at 0.5: served after every view's own pages and
                            //   counted in no pressure (RN4, 5.19). Open in THIS view: those whose quads R listed
                            //   for it (their node shown — the world's, or the shot's `shown`; one whose key is
                            //   above 0 and whose opening SCENE still keeps at 0 is listed: RN4), not its opening
         list, n,           // Int32Array of quad rows this view may show (R's cull of this tick), and how many
         over, overN,       // swaps for this view (SH2), or null, 0 — the frame's in the frame's own view, its
                            //   mirrors' and its shadow views'; a shot's in the shot's views
         ahead,             // boolean: a shot's view — a swapped quad is asked for the swap's sheet alone; in the
                            //   frame's views (false) it is asked for BOTH: the sheet it shows until the swap
                            //   lands (SH2) and the swap's. A row a swap ENDS (handle −1) is not asked in a
                            //   shot's view
         nodes, nodeOf, nodesN,   // a shot's node overrides (RN4), or null
         changed,           // bits (R's; `CHANGED` of sheets/ask.js): what of the VIEW ITSELF is another than at its
                            //   last ask — `EYE`: where its eye stands; `TURN`: how it is turned or what its lens
                            //   is (the camera's `rot`, `proj`, `yaw`, `ortho`); `ALL`: its size, its swaps or
                            //   its overrides (the frame's views: in every call while swaps
                            //   wait in them, and in the call after the last is gone — a swap is no row's stamp).
                            //   0: nothing. R works it out the same way for every view — the frame's, `toward`'s,
                            //   a mirror's, a shadow cell's, a shot's. What of the WORLD changed R does not say:
                            //   SHEETS reads the rows' stamps itself (below)
         bias,              // SHEETS writes, in `ask` only: the quarter levels this view is asked coarser by —
                            //   the cache's pressure (5.19) plus `coarser`
         drawn,             // SHEETS writes, in `ask` only: the bias the view is DRAWN at — `bias`, from the ask
                            //   in which every page it names is placed (a rise or a fall: 5.19; at the bias's end,
                            //   the pages denied there left out); never more than
                            //   four under `bias` outside a whole call, the same in one. R copies it into the
                            //   view's uniform (4.1) and never writes either
         entered,           // SHEETS writes, in `ask` only: of the pages this ask returned (not in the cache,
                            //   waited for), how many ENTERED what is asked with this cycle — no view named
                            //   them in the cycle before. A view that stands, or moves by a hair: 0 after its
                            //   first ask; a riding camera's: its new strip. What a shot's view that moves is
                            //   coarsened by (2.3 step 4)
         fresh,             // boolean, R's: true where a view begins — the frame's at a new `f.shot`, a view
                            //   ahead's when its shot is another; the next `ask` starts that view's pressure at 0
                            //   and sets it false
         _ }                // SHEETS' own; R never reads it
```
**What an ask works out again — by quad, not by view.** An ask goes by ITEMS: a quad row asked one way (one the
view lists; an insert it does not list, asked quietly; a swap whose quad it does not list), with the further sheets
its own shader reads. What an item names depends on nothing another item names, so SHEETS keeps, a view, what each
item named, and at the next ask of that view an item is **named again as it was, uncomputed, unless something its
pages are worked out from changed** since:
- of the view, all its items at once: `changed & ALL`; its `bias` or its `weight` is another; the sheets are others
  (one was added or released: a handle may be another sheet's); the view's last ask is older than the last round of
  the cycle before the one that ended last (the records of its pages may have been let go: `request` lets go what
  neither its cycle nor the last round of the cycle before named); a whole call begun or ended (a whole call names no
  parents: below);
- of the view, by the item's kind — what a quad of that kind reads of the camera: a `SKY` quad is a way, not a place
  (WT7: a point at infinity), so it reads `TURN` and never `EYE` — **a camera that rides without turning does not
  ask its sky again**; an `INSERT` lies on the frame and reads neither; every other kind reads both;
- of the world, 3.4's test against the tick of the view's last ask (SHEETS keeps it): the quad's own row, its
  node's, its layer's; the look's stamp where the wind bends the quad (its bound is the look's); and the same of
  every further sheet's row its own shader reads;
- the view did not ask that item so at its last ask (a quad that entered its list; an insert that opened or closed
  in it).
Nothing else: not a person's node row (a person has no quad), not a light's row (no ask reads a light), not a row
of another quad — one clock's hand turning works out the clock's quads, in each view that lists them, and nothing
more. The pages a view names are then gathered from its items in their order, each page once — the very list, in
the very order, that working out every item gives (so where things lie in the cache is the same: the header of
`sheets/cache.js`). `R.counters.asked` counts the items worked out in a call.
R keeps one View object per view while the view exists. Which views R asks, each tick, between SH11 and SH12:
the frame's and its mirrors' (always; at weight 0.5 while a solid insert hides the world — RN4); a shadow view on
a tick in which a cell of it is to be redrawn or its last ask was not 0; `f.toward`'s view when there is one
(weight 0.5); for every `f.ahead[i]`: the shot's camera's view, its mirrors' and its shadow views' (while the shot
lives). A view not asked in a cycle lets its pages go, oldest first, when room is needed.
**Coarse to fine.** For every page a view names as its own it names first, as its own too, the page one level
coarser under it — its parent (none for a sheet's top, which is always there). So the coarser level is in the cache
before and while the finer comes, and a missing page is read from its parent: never more than a level soft while
the painters keep up with a quarter of the work — the standard of virtual texturing. The parents are about a quarter
more pages (counted: 15–30 %, 5.19) and about a quarter more of the cache's bookkeeping of names; they are in `N`,
in the room and in the stand's counts (5.19, ST3). **Not in a whole call** (`place(Infinity)`: a held frame, a
build): there nothing is shown until all of it is there, so a parent would serve nothing — and go to the painters
first; a held frame names no parent and waits only for the pages it shows. A view whose pressure is above 0 is also asked a quarter level
finer by a PROBE of SHEETS' own, whose names (`NAMED.PROBE`) are counted and nothing else — no round, no cell, no
request, in none of the counts below: what lets the pressure fall back (5.19, which says when a probe works out items).
**Motion LOD — dropped by the owner 2026-10-15: softness in motion is not visible; coarse-to-fine already shows a
missing page one level soft.** (It was planned here: a place moving fast across the screen asked coarser by its own
on-screen speed. Built, it cost about 1.3 ms a frame, brought garbage back and was the most fragile code of the ask.)
A place is asked at the level 4.8 gives, whatever its speed.
How a quad is asked: its rect placed by WT7, clipped to the view, the level by 4.8, the pages of that level under
the clipped rect (a descent where the level varies across it). ONE descent serves every kind; what differs is
where a node's points come from.
- **A flat piece** (a card, a plane, an insert, a block of a form, a turn of a backdrop): its four corners are
  placed once and its points are bilinear between them — exact —, so a node costs no call of `place`.
- **A backdrop** — a sky that does not go round — **is flat**: it is a plane a unit before the gaze's yaw (WT7:
  the way toward its point is (the gaze) + o · (its right) + up · (up), made a unit only for drawing), so each
  turn of the circle the view may see of it is one flat piece, cut out of the sheet by the turn's two sides where
  the sheet reaches into more turns than one. A sky costs what a plane costs.
- **A curved kind** — a plane draped on the land, a sky that goes round: a node reads nine points of it (its
  corners, its sides' middles, its middle — its quarters' corners). Where a point of such a sheet is, and how it
  moves along the sheet's x and y, does not depend on the view: three calls of `place` give it once, and SHEETS
  **keeps the points** (by the quad's row, the stamp of its rows, and the point; two tables that change places, so
  a point in use is never worked out twice and nothing is scanned or freed) — however the camera moves and
  whichever view asks, the land's own function is called for a point once while the quad's rows stand. A view
  takes a kept point into its clip space by arithmetic, the level there by the chain rule. Only the points where a
  side of the VIEW cuts a node's piece are worked out for that ask alone (no lattice has them: they move with the
  camera): a camera riding over land works out those and the land that comes into view — measured, about 6 calls
  of `place` a node of a draped plane while it rides (it was 15–40), none for a sky.
A `FORM` is asked
by blocks of 4 × 4 cells of its grid, each as a flat piece between its corner points (5.23). A quad with `WHOLE` (read elsewhere
than where it stands — WT2: a layer that drifts or wraps; a sheet of an own shader that its text reads at another point than its own, a `READ` row too) is asked whole — every page of every level the view reads of it, from the finest it needs up
(each level above is a quarter of the pages) —, never finer than the level at which the sheet has at
most `host.wholePages` pages. The further sheets of an own shader (the layers it reads, `world.own[k].quads`) are asked with its base quad alone — a further sheet's row, which the cull lists, is no item of its own — and one read whole at the levels the screen needs of its base quad, not of where its own rect stands: a layer laid beside the card (an atlas) is in no view. One that lies as its base does — `READ` and not `WHOLE` (so its layer's pose is nothing to it: WT7), the base's kind and node, neither flipped nor bent by the wind, the base on no layer, no swap waiting on either, its sheet laid out as the base's (`l, t, r, b, W0, H0`) — names the very pages the base's descent named, with no descent of its own: exact. A sky that goes round is not `WHOLE`: its quad is a mesh placed by `skyWay` and is read where it
stands, so the one descent names its pages.
A quad with `WIND` is clipped to the view widened by its layer's greatest bend — the layer's wind strength ×
(the look's wind strength + `WIND.FAST`), metres of the POSED layer (4.7: the bound of RENDER's bend, which is added
after the pose): in the sheet's units, that bound over the smaller of the pose's |scaleX| and |scaleY| — so the strip
the wind brings into view was asked.

**SH11 `sheets.place(count) → integer`** — the first of the cycle: up to `count` arrived pages go into the cache
(the painter's pixels as its canvas gave them, `queue.writeTexture` into a staging layer, and two short passes write
the cell — premultiplied linear, and its half level — on the GPU: `sheets/upload.js`, 2026-10-15; the write copies
the bytes, and their buffers go back to the painter that made them, to be let go there: no page's bytes are collected
on the scene's thread, whose major collections the pages' external memory otherwise starts — measured 2026-10-14,
`proposal-perf-2.md`; `Infinity` in a call with `f.whole` — and a cycle begun so
has every painter at work: SH12), the table's changed rows
are written and flushed. Returns the pages placed.

**SH12 `sheets.request()`** — the last of the cycle: what the asks named and is not there goes to the painters
(tops first — many tops to a job —, then the views' own pages by weight × levels missing, a page's parent always
before it, then the quiet pages of closed inserts — the order of service, 5.19; at most 2 jobs in
flight a painter;
`host.busy` painters at work while a film plays, all `host.painters` in a call with `f.whole` — 4.9); the
cycle ends. **The list `request` ordered is kept until the next cycle orders another, and a painter that answers
is given the next page of it at once** — in the task that hears the answer, with no tick between: a painter never
stands idle while a page is wanted, whatever the tick rate, in a held frame, and during a build (the cells were
taken by `weigh`, so where each page lies is the cycle's decision; a page of the list that is there, in flight,
let go or of a sheet released meanwhile is passed over). Pages are still only PLACED in a tick, by count (SH11),
so a render's frame is the same on every run. **While a film plays the painters are not fed past what is placed**:
with four ticks' worth of pages (`4 · host.pages`) arrived and not placed, a painter that answers is given nothing
— the next `request` feeds it — so what waits to be placed stays a few megabytes (measured without the bound:
up to 399 pages, 130 MB, in the train's film); in a call with `f.whole`, and during a build, everything that
arrived is placed and the painters are never held. No clock, no timer. It changes no bias. **`sheets.weigh() → boolean`** — after a round of asks: works out every asked
view's pressure from what the asks named against the room (5.19), in the order of service; true if any changed (or a view whose pressure is at `BIAS.MOST` was newly denied a page its ask had
counted). It counts before it takes: cells are taken for a view only at a bias the count fits, so working a pressure out
lets go of no page the cycle names. Quiet pages are in no view's count; their cells are taken after every
view's, from what is left (in a call with `f.whole`, once every pressure stands).
`weigh` keeps the new pressure to itself: `view.bias` changes only when that view is next asked (SH10), so no
frame is drawn at a bias nothing was asked at. In a
call with `f.whole` R repeats { asks; `weigh` } until `weigh` returns false and only then calls `request` —
nothing is sent to a painter at a bias that will change; with several views a round of `weigh` in such a cycle ends at the first view whose pressure moves (the views after it are weighed once it stands), and no cell is taken at a bias its view is leaving, nor any quiet page's in such a round — nothing is let go for a bias that is not the one asked next. In other calls: asks, `weigh` once, `request` (the new
bias serves the next tick; `request` sends what this cycle's asks named, whatever `weigh` then decided). During a first build SCENE makes the same calls for the opening's view (2.2 step
5), with all `host.painters` at work.

**SH13 what a sheet's paint is** — **`sheets.whole(world) → boolean`**: every sheet in `quads.sheet` of a shown
quad of that world has its top or is empty. **`sheets.solid(handle) → 0 | 1 | 2`**: 0 — no opaque paint (every
page so far has no pixel of alpha ≥ `SHEET.OPAQUE`: mist, glows); 2 — wholly opaque (its top and every page so far
placed are opaque in every pixel inside the sheet's rect); 1 — mixed, and the answer while the top is not there.
A painter reports each page as opaque, empty or mixed with its bytes; a page arriving can move a sheet from 2 to 1
in the very `sheets.place` that puts it in the cache — so a hole never shows as black. **`sheets.stamp(handle) →
integer`**: one more whenever what a shader reads of that sheet changed (a page placed, a page that was read found empty by its
painter, a page let go, its `solid` changed — whoever found it; a page found blank at its first naming changes nothing else; a
page of one colour told is as a page placed). A page of one opaque colour all over its cell (its recording says so: a
rect filled over it in one colour and nothing drawn after, or a ground with nothing over it — `Recording.uniform`) is
never painted and takes no cell: its entry holds the colour (6.8 in `contracts.md`), and it is opaque for `solid`. A
page found blank or of one colour when an ask first names it is told to the table, and to `solid`, in the NEXT `sheets.place` — the
cycle's first step, before the cull —, so no list made this frame is wrong about it (a top blank by its recording is told at once, in `add`: nothing has read the new sheet yet). R redraws a static shadow cell or a mirror when the stamp of a sheet in it differs from the one
it drew with. `sheets.stats()` — the totals, among them, for the stand: the jobs done and each painter's busy
milliseconds (a painter reads its clock round a job only when the thread was mounted with `flags.stand`).
**`sheets.cycle`** — ONE object, its numbers rewritten in place by `request`, of the cycle that just ended:
`{ sent, evicted, denied, bias (the greatest pressure among the views asked), own (the greatest pressure the
frame's own views were DRAWN at: their `drawn` less `coarser`), again (the views' own pages the cycle's `place` put
back that were let go for room while a view still named them — their record lived: SHEETS forgets a record two
cycles after it was last named, so that is where "it was here" is known; uploaded twice — the cache's thrash;
`sheets.stats()` keeps their sum), wanted (the pages the frame's own views and `toward`'s named this cycle that no
view named in the cycle before and that the painters must still paint — not in the cache, not known empty, not in
flight: what the camera asks of the painters — going back
over pages still in the cache, a drag there and back or the lean, adds nothing), named
(the units the frame's own views — the frame's, its mirrors', its shadow views'; not `toward`'s, a view ahead —
named as their own: each page once, parents in, tops apart; a whole page is 16 units, a slot), has (those of them
that are there), insert (the units the largest closed insert named quietly), room (the units the frame's own views
had: the cache less the tops — what `weigh` serves them from first; 5.19's one definition) }` — what a row tells (ST2), and what the stand
judges a view's weight by (ST3). A page a painter
could not raster is said once a sheet (`host.error`) and read as
empty.
**No scan of the cache for a page** (5.19: counted, not scanned): a free cell of a shape is taken from a list
kept by shape (as empty slots are); the cell to let go is the head of an order SHEETS keeps — by the round a
cell's page was last named, moved when a round names it —, and the whole slots left for a view are a count kept
as cells are taken, let go and named. What a page costs the thread does not grow with the cache's size.

**SH14 the sheets on the GPU** — SHEETS owns the table, the cache texture, their bindings (4.2: `sheetTable`,
`sheetCache`, `sheetSampler`) and the WGSL chunk `sheets` (`sheets/sheets.wgsl.js`), which gives, by these names:
```
fn sheetOf(handle: u32) -> Sheet                         // either stage: from the table's first rows
fn sheetCarry(s: Sheet) -> SheetCarry                    // vertex → fragment: struct SheetCarry { a: vec4u, b: vec4f }
fn sheetFrom(c: SheetCarry) -> Sheet                     //   (SHEETS declares it; RENDER gives it two locations, `a` flat)
fn sheetLevel(dx: vec2f, dy: vec2f, taps: f32) -> f32    // 4.8; dx, dy: level-0 px of the sheet a screen px
fn sheetRead(s: Sheet, page: vec2i, at: vec2f, dx: vec2f, dy: vec2f, taps: f32) -> vec4f
        // page: whole pages at level 0 from the sheet's corner to an origin near what is drawn; at: px at level 0
        //   from that page's corner (a sheet may be 3·10^8 px wide); taps: 1, or 2 for PLANE and DRAPE quads;
        //   the result premultiplied linear
```
One table read and `taps` reads of the cache with `textureSampleLevel` at the level `sheetLevel` gives (the
cache's two mip levels blend one level into the next). **`fn sheetFind(s: Sheet, page: vec2i, at: vec2f, level:
f32) -> SheetHit`** reads the table ONCE — the page's entry and the point within it; **`fn sheetNone(h: SheetHit)
-> bool`** tells from it that the page there is empty or not there; **`fn sheetTake(h: SheetHit, dx: vec2f, dy:
vec2f, taps: f32) -> vec4f`** reads the cache by it. `sheetRead` is `sheetTake(sheetFind(…))`. The blended mains
call `sheetFind`, drop the fragment where `sheetNone` — before any read of the cache —, then `sheetTake`, and drop
it where alpha is 0 (5.17): one reading of the table a pixel, never two. `SheetHit` is SHEETS' to declare. No `textureSampleGrad`, no anisotropic sampler. With two
taps they lie a quarter of the footprint's long axis either side of the point, so a floor or a sea seen at a low
angle is twice as sharp along the gaze as one tap gives. No tap reaches further than one texel past its page (the
border is 8 px at the page's level, 4 at its half), also when the level is clamped at a sheet's top. A fragment
main takes `dx`, `dy` as `dpdx`, `dpdy` of its interpolated `at`, first thing (uniform control flow); `sheetRead`
itself may then be called anywhere — inside an own shader's loops too. `Sheet` and `SheetCarry` are SHEETS' to
declare; RENDER never names their fields. A quad's own sheet crosses the stages as a `SheetCarry`; the further
sheets an own shader reads (`layer(1…9)`) are found in the fragment stage by `sheetOf` from their handles in the
own shader's uniform. A sheet the text reads only where the quad stands (`world.own[i].stands`, WT5) is read
from the quad's own origin page — the fragment's `at`, moved by that sheet's corner against the painting's (whole
pages and the rest in px, worked out on the thread in doubles, in the own shader's uniform) —, so it is as exact
on a sheet 3·10^8 px wide as the painting is; a sheet read elsewhere is read from its corner, as the author's
point says. The origin page of a quad in a view is
RENDER's (the order row, 4.1): (0, 0) for a quad under 2^20 px a side, else the page under the eye's foot on it.
RENDER binds the three through `sheets.bindings()` (the entries 4, 5, 6 of `frame`) and makes its group again
when `sheets.table.version` moved. Every read of a sheet passes the taps of its quad's kind (4.8) — the cast and
mask programs and an own shader's `layer()` too: the ask named the pages of that level.

### 3.6 SCENE ⇄ PEOPLE

**PP1 `createPeople(persons, { cast, anchor, ground, inside, point, frame, moves, placed, gpu, lib, built, warn }) → Promise<People>`**
(`people/people.js`) — SCENE, before the opening's step (2.2 step 4: the first beat's actions need the people's
real lengths). `persons`: `[{ id, index, node, o, inside }]` — the scene's persons that have an id: one without is said at compile (their state's keys are named by it) and is not shown — (`node`: their
row of WT1; `o`: their spec object; `inside`: marked so — in a room wherever they stand); `cast`: the scene's modules by name; **`anchor(id, out: Float64Array(3)[, values]) → boolean`** (with `values`: where the placing would put them under
those values, nothing touched — PP5's `pointFor`; where
SCENE's placing puts the person now — their place keys, through what carries them; PEOPLE reads it every step and
never the node row, which holds the root: WT1; false: no such person — PEOPLE then keeps the place they last had), `ground(id, p) → metres`, `inside(by, p) → boolean` (whether one standing at p, carried by element `by` — null: none —, is in a room: `by` is `inside`, or the `walk` plane under p is; PEOPLE asks it each step for one not marked `inside`, after the player's update — one on another's arms is as that one is), `point(ref,
out[, get]) → boolean`, `frame(id, out[, get]) → boolean` (what carries them) — now, or with `get` (key → value) as
those values would have things (PP5: a seat in a carriage, the carriage's frame, under a shot's values) —,
`moves(id) → string[]` (the state keys that move an element: its place's and those of what carries it — one array
an element), `placed(id) → boolean` (that person was put where they are at once this step: a key of their place, or
of what carries them, set, not moved — WT8 `placedNow`) — SCENE's functions, every one always given; `lib`: `R.lib`; `built()`:
PEOPLE calls it whenever a build in the background ends. Resolves when every figure is built and every motion of
the casts — and the engine's two library motions, `stand` and `walk`, which a state key may name later — is ready (slices
separated by `turn()`; never a timer). A cast's own fault while a person's first look is made rejects it — the show
fails: there is no older figure to keep —, named with the person and the look. Casts' code keeps `globalThis.MooodShapes`.

**PP2 `people.reads(values) → Set<string>`** — ids of elements whose points people read this tick; the people's
own Set, rebuilt only when someone's `_on` / `_look` / `_reach` value is another object. SCENE never changes it.

**PP3 `people.frame(t, values, shot)`** — SCENE, once every step, seen or unseen, after the animates of PP2's
elements: for who is here — their player's state, the pose, root, points, box, sphere, capsules; one who is not here
is not stepped at all (their player stands: nothing of them costs a step) and comes back as a cut sets them — where
the state has them then, doing what it says, their clock gone on meanwhile. `shot`: **the state's
count of cuts** (`state.shots` — one more at every `cut`, and nothing else; saved and restored with the state) —
when it differs from the last call's, everyone is set as a cut sets them. It is NOT `f.shot`: the frame's number
also moves at an unseen jump, a `still`, a restore and a camera key set at once (RN4) — moments at which the
picture must be whole and the people must stay as they were stepped (a walker set "as a cut sets them" there
would face where his walk ends and begin his stride anew: 2.5 step 3). As on engine 2. Cloth, springs and faces
still come up at rest after a jump, by PP7's own rule. No bones written, nothing of the GPU.
**`people.root(id, out: Float64Array(12)) → boolean`** — their root's world matrix; SCENE copies it into their
node row. **`people.settle(id)`** — sets one person as a cut sets them — the pose, what swings and the cloth at rest — (the director,
when it finishes an action at once). A person's step is timed by `t` through their own clock.

**PP4 `people.prepare(values) → boolean`** — SCENE, every tick for every live shot: starts building the looks and
parts the values' `<id>_wear` / `<id>_with` name; true once all are built; held until
**`people.unprepare(values)`** (the shot cancelled; or cut to — called at the end of the cut's step) — `values` is
the very object given to `prepare` (held by it); with it **`people.ended()`**: the acts `pointFor` made are let go.
**`people.building() → boolean`** — a build is in flight.

**PP5 reads of a person** (SCENE; `out` arrays are the caller's): `people.point(id, name, out) → boolean`;
**`people.pointFor(values, id, name, out[, root]) → boolean`** — the same point for the person posed as a cut to
`values` will set them: their place by SCENE's placing under those values (PP1's `anchor`, asked with the
values), what carries them where it is under them (PP1's `frame` and `point` with `get`: the element they stand
or sit on, a seat in its frame, a thing's point; the one whose arms they are on — posed so first, on the same
player), their turn, their `_do` at its beginning, held or seated as the values say — worked out on a player of
PEOPLE's own that never touches the person's state; `root` (3 numbers): where their root stands then (the
camera's base of its target); nothing allocated a call; false for a person the values move nothing of — none of
their keys, their place's, those of what they stand `on`, and nothing that their `_on` (as the values have it)
puts them on: an element those values move, a person moved so (SCENE then takes their point as it is now). SCENE calls it for the target of a live
shot's camera, once a tick a shot that frames a person (2.3 step 6);
`people.box(id, out: Float32Array(4)) → boolean`; `people.height(id) → metres`; `people.pick(origin, way) → { id,
at } | null` (one kept object; the author's selection only: IN6); **`people.mark(id, bits)`** — `OFFERED` /
`SELECTED` for that person: a field of the person's uniform, read by the person's `main` (IN3); `people.startOf(id, motion, turn)`, `people.durationOf(id, motion | { turn })`,
`people.speedOf(id, gait?)`; `people.list`.

**PP6 `people.save() → data`, `people.restore(data)`** (no cloth, springs or faces: figures come up at rest in
the pose), **`people.dispose()`**.

### 3.7 PEOPLE ⇄ RENDER

**PP7 `people.show(seen) → boolean`** — RENDER, once in every `R.frame`, after its views are placed and before any
draw; never SCENE. `seen(sphere: Float64Array(4)) → boolean` (x, y, z, radius; world) is RENDER's: true if the
sphere meets the frame's view, a view ahead, a mirror in view, or a shadow view whose light reaches it. `show`, for
each person here: shown or not; for the shown — bones, cloth's step (`dt` of the person's own clock since they
were last shown; a figure not shown for more than `LATE` (0.25 s) of it, or first shown, or across a new shot, or
after more than one `frame` since its last `show`, or carried by another thing than at its last `show`, is brought
up at rest in its pose), the one write of its bones if any changed. Returns true if anyone became shown or hidden, or any
shown person's version is another than the one their last `show` saw (a part put away between two calls counts), or a
shown person is OFFERED (they breathe: IN3). A look or a part put on between two steps is posed before it is shown: a
frame drawn with no step never shows it unposed.

**PP8 `people.version(id) → integer`** — one more whenever what is drawn of that person changed, their becoming
shown or hidden included. RENDER keeps the
version it last drew with for the movers' shadow map, each mirror and the blob map. **`people.sphere(id, out) →
boolean`**, **`people.capsules(id) → { n, data: Float64Array(7 · n) }`** (ax, ay, az, bx, by, bz, r; world).

**PP9 the person's pipelines** — PEOPLE gives a closed list, a constant: `PERSON_KINDS: [{ name, vertex: wgsl,
surface: wgsl, buffers: GPUVertexBufferLayout[], twoSided }]` — the kinds of a figure of shapes: `skin`, `tubes`,
`cloth`, `face` (bodies are not built in this piece: no cast has one — `dropped.md`). What differs between looks is
buffers and uniforms, never text. For a world with people `lib.all` asks every kind × pass (`main`, `depth` — people are never
drawn into `masks`: WT2), and — when a plane reflects or a pane mirrors — `main` once more with the winding turned, for the
mirror's own target (a mirror's view flips the winding; its image has an alpha, 4.3 — RENDER's main writes there how much
of the person there is: 5.7's `fade`).
**`lib.person(name, pass[, mirrored]) → GPURenderPipeline`**. The chunks (PEOPLE writes them, RENDER's library
writes the mains around them):
```
fn personVertex(v: PersonIn) -> PersonPoint      // struct PersonPoint { position: vec3f, normal: vec3f, carry: PersonCarry } — the root's space, skinned
fn personInside() -> f32
fn personFacing(p: PersonPoint, r0: vec4f, r1: vec4f, r2: vec4f) -> PersonCarry   // the carry with its facing set: RENDER's
                                                 //   main gives the rows of nodes[personNode()] and hands on the carry returned
fn personSurface(c: PersonCarry) -> Surface      // struct Surface { albedo: vec3f, emissive: vec3f, ink: vec3f, rim: f32, facet: f32, part: u32 }
fn personNode() -> u32                           // the person's row of `nodes` (from the person's uniform)
fn personGlow() -> f32                           // 1, or the pulse of a marked person (IN3)
fn personLines() -> vec2u                        // the lines' width (eighths of a CSS px) and kind, for `ids`
```
RENDER's mains declare `PersonPoint` and `Surface`, with the members written above. PEOPLE declares `PersonIn` (its `@location`s 0…7 match the kind's `buffers`), `PersonCarry` (whatever its vertex
stage must hand to its surface — colour, part, the face's coordinates; its members carry their own `@location`s
8…13, flat where integer) and the person's uniform; WGSL allows no structure inside a stage's output, so PEOPLE also exports
`PERSON_CARRY` — the carry's members as data (name, type, location, flat) — and RENDER's mains declare the vertex
output as `{ @builtin position, RENDER's own at locations 0…7, the carry's members }` and fill a `PersonCarry`
from them; they never name a field of PEOPLE's structs otherwise. The person's uniform holds no copy of the root:
where PEOPLE's WGSL needs it (`personFacing`), RENDER's main passes the rows of `nodes[personNode()]`. The
id written to `ids` takes its part from `Surface.part` and its slot from the person's uniform through a function
PEOPLE gives (`personSlot() -> u32`).
The mains: world point = `nodes[person.node] · position`; `main`: lit as everything is, `a = mix(ink, albedo,
smoothstep(0.12, 0.42, pow(luma(L), 1 / 2.2)))` (a silhouette's ink gives way to its colours as the light on it
grows — main's formula, kept), `c = a · L + rim · max(L − around, 0) + emissive`, `L` the flat pair when `facet >
0.5` (the light of the triangle's first vertex — so for a faceted style PEOPLE gives every face vertices of its
own that carry the FACE's normal, the tubes' too), hazed. A person is lit at the vertices — the casting lights'
shadows and the land's among it — with the normal as it is: no turn toward the eye for the one-sided kinds (their
back faces are culled); `cloth`, two-sided, is lit for both sides at the vertex and the fragment takes the side
`front_facing` names. The open solids of a figure (a cap that is no whole egg, a shell, rings left open at an end:
seen from inside too) are drawn by `cloth` — their triangles a mesh of their own over the skinned vertices —, so a
closed solid keeps its back faces culled; a face's open solids are drawn with the face (its morphs have no
two-sided kind). It writes the colour and, in the second target (`ids`, 4.3 — there in every world), the person's id (slot, part,
line width, kind); `depth`: the shadow views', depth only.

**PP10 `people.draw(pass, kind, inView, id, mirrored, counters) → boolean`** — RENDER, inside its pass after setting groups 0
and 1; `kind`: `'main' | 'depth'`; `inView(sphere) → boolean`: this view's test; `id`: only that person, or null
for all (a light's map takes only the persons who cast in it: 5.5); `mirrored`: the pipelines with the winding
turned (a mirror's view; they exist only when a plane reflects); `counters`: RENDER's object — PEOPLE adds its draws to
`counters.draws` and its triangles to `counters.triangles` (RN8).
People set their pipelines, groups 2 and 3, buffers, and draw; no target, no viewport, no group 0 or 1.
**`exercisePeople(gpu, lib, pass, kind, mirrored)`** — exported by `people/person.wgsl.js`'s module (which the check
imports: BD4), for the whole-set check only (RN2's `lib.exercise`): with small buffers of its own making it binds
and draws every person pipeline of that kind once into the pass given; it needs no built person and no `People`.

**PP11 `people.inks: GPUBuffer`** — a uniform buffer, 256 × `vec4f` (a slot's line colour, linear; the fourth is
spare — a line's width travels in `ids`): the canvas pass reads it.

### 3.8 The stand's rows (SERVICE's `engines/3/stand.js`, called by SCENE)

**ST1 `createStand(origin: number, detail: boolean, stats: () → sheets.stats()) → { mark(what), input(type), start(), tick(row), segment(name, stamped), take(extra) }`**
— made by SCENE only when `flags.stand` is set (`import('./stand.js')`):
`createStand(performance.timeOrigin, flags.stand === 'detail', () => sheets.stats())` (the stand imports nothing:
the totals it keeps at the first frame and at each cut's are asked through `stats`); `R.detailed(true)` only for
`'detail'`. `mark`:
`'mounted' | 'shown' | 'people' (the people built) | 'painted' (the artist's last answer of the build taken) |
'pipelines' (the world's pipelines made: `R.build` resolved) | 'whole' (beside a living scene: the new one's
opening view lacked nothing — 2.9) | 'built' (the switch) | 'drawn'` — `mounted` once, the others once a show
(`shown` begins a show's marks): the legs of 5.21, apart, of every scene shown in the thread, so a switch's legs
are measured as an opening's; with the first show's `'drawn'` and with each cut's frame the stand keeps `sheets.stats()`'s `placed` and `sent` (the pages that
view cost).

**ST2 `stand.tick(row)`** — at the end of every display callback that was not paused; one object SCENE reuses:
```
row = { at,        // the callback's timestamp + performance.timeOrigin, ms
        ran,       // false: the pacer skipped this callback
        state,     // R.frame's outcome (0 held, 1 idle, 2 drawn); 1 when not ran
        every,     // the pacer's step now, in display refreshes (n · k)
        late,      // true: the pacer counted this callback as a miss
        js,        // ms the thread spent in this callback (two clock reads, made only while the stand is on)
        cost,      // ms from the callback that drew the frame whose gpu.done() resolved last to that moment;
                   //   −1 if none resolved since the row before
        shot, moving,
        makes, keys, placed,   // makes taken, keys changed, pages placed this tick
        counters,  // R.counters
        lacks,     // R.lacks — what a held frame (state 0) still lacked
        cycle,     // sheets.cycle — the cycle's pages: sent, evicted, denied, the greatest bias, the frame's own
                   //   views' pressure drawn (`own`), pages placed again (`again`), wanted, named, has, the
                   //   largest closed insert (`insert`), the room (SH13)
        opened,    // on the tick an insert's opening begins: seconds since its key left 0; else −1
        story,     // a cut waits — the story stands (2.4): true / false
        ready,     // on the tick whose step cuts to a live shot — by it, or plainly to the values of one, ready
                   //   or not (the row its shot number changes on; a callback the pacer skipped tells none):
                   //   whether that shot was ready (1, 0), and `readyBias`, its `a.bias`; else −1
        step,      // detail only, else null: ONE object, ms of this callback's step by part — { director, world,
                   //   animates, people, camera, lights } (2.1 step 6: clock reads made only for the detail)
        tick,      // detail only, else null: ONE object, ms of the callback by its own parts — { pace, step, show,
                   //   render (R.frame), after (pace.frame, the messages to the page) }; −1 where it did not run.
                   //   The stand adds `tick stand` to the row: what its own tick() cost (not in `js`)
        wide,      // detail only, else null: ONE array (R.wide, named by R.wideNames), rewritten in place: the asks by
                   //   kind of quad (sky, draped, flat, form, whole — ms, quads, nodes, calls of place, names: a
                   //   page named twice counts twice, so the column is `names`, not pages; the distinct pages
                   //   are `cycle.named`)
                   //   in four slots (the frame's views, mirrors', shadow cells', the shots ahead's) and the cache's
                   //   bookkeeping of the names, and the items (SH10) asked and worked out again by cause (all of
                   //   the view's, the camera in what the kind reads, a row stamped, new to the view); the views
                   //   asked, those worked out whole and the first cause (swaps, size, bias, the cache's), those
                   //   whose eye moved and whose turn did; the culls (views culled, quads tested and listed,
                   //   skipped, and why — what `listed()` would find)
        times }    // R.timing (its stages before the passes, then the passes), or null when not detail
```
"A frame was due" is `state !== 1`; "drawn" is `state === 2`. The stand keeps the rows of held callbacks as it
keeps the others: their `js`, `times`, `lacks` and `cycle` say where a held picture's time goes and what it
waits for. At `take` a cut whose frame has not been drawn and an input still waiting are told as such (`drawn:
false`, with the callbacks they have waited) — never left out.

**ST3 `call('stand', 'start')` → `pace.measure(true)`, `stand.start()`; `call('stand', 'segment', name)` →
`stand.segment(name, R.stamped())` (a segment of the scenario begins: its moment and the renderer's stamped counts so
far); `call('stand', 'take')` → `stand.take({ memory: gpu.memory(), gpu: gpu.info, stats: sheets.stats(), stamped:
R.stamped() })`** → the rows, the opening's marks (the first show's: `opening`) and every show's (`shows`), and the segments. The graphics card's name comes from
here (engine 2's stand reads it by a WebGL probe; engine 3's has none).
An engine-3 measuring has ONE size and the three profiles (a frame's buffer is the tier's budget whatever the
window — PG13 —, so `1080p` and `4k` would measure the same frames); `repainted … ms` is not
among its figures (painting is the artist's and the painters': `sheets.stats()`); its
report has none of engine 2's own fields (`stages`, `pixels`, `steadyPixels`, `bytes`, `after`).
**What an engine-3 measuring judges, and how** (the first measured stand showed seven of engine 2's thirteen
thresholds wrong for it, or saying something other than their name):
- engine 2's thresholds less `steady repaints` and `steady uploads` (a steady frame makes its next shot ready, by
  design), each read as follows;
- **a picture that never comes fails**: a judged segment in which no frame was drawn fails `frames p95` and
  `frames worst` with the words "no frame drawn in <segment>"; a cut whose frame was never drawn fails `prepared
  cut late`; an input never answered by a frame fails `input to frame` — nothing "not measured" passes;
- **a scene whose views ask more than the tier holds or paints fails** — rows a profile, over the judged segments,
  each said in `measure_scene`'s report with its limit and the segment it is worst in:
  - `view pages` — told, not judged: the pages the frame's own views name as their own (`cycle.named` / 16 — the
    frame's, its mirrors', its shadow views'; each page once, parents in, tops apart) with the largest closed
    insert's (`cycle.insert`), median and most over the callbacks that ran, against the room they had
    (`cycle.room`: the cache less the tops) and in screens (over `host.wholePages`). A count is not the verdict —
    mirrors and shadow views share the allowance's layer, cells have shapes —; the next row is. The ask's cost — the
    parents' names and the probes' among it — is told by view in the detail run (`wide`: ask ms);
  - `soft run` — **the verdict on a view's weight and on its motion**: the longest run of drawn frames (whole
    frames' callbacks left out: a break's pages are waited for under the sign) in which the picture is softer than
    its budget allows on the profile's tier, for either of two causes, at most `host.ahead` (0.5 s on computers,
    1 s on phones). **By the cache**: the frame's own views drawn coarser by its pressure (`cycle.own` above 0) — a
    bias that rises and falls back — a repaint's two sheets, a close-up opening — is not a state of the picture: 5.19
    brings it back, on a moving camera up to `host.ahead` / 2 late, then its switch is placed; a view over the room
    is soft for its whole segment. **By motion**: the tier's painters modelled as a queue — each callback adds the
    pages newly named by the frame's own views and `toward`'s that were not in the cache (`cycle.wanted`) and takes
    away what the tier's painters give in that callback's scene time while a scene plays — 120 a second on
    computers (`host.busy` 4), 30 on phones (2, slower): 5.21's slow end —; the motion is soft while that queue holds
    more than the painters give in `host.ahead`: a page then waits longer than a moment, shown a level soft or more.
    The tier's rate, not this machine's: a stand with fewer painters than the tier would fail what the tier keeps up
    with. Judged in every judged segment — the film's and the viewer's moves alike: a camera never holds, so a
    scene whose motion outruns the tier's painters, the viewer's or its own, fails here. The report says which cause,
    and tells beside it — told, not judged, the authors' hint of how far over — the most pages first wanted in any
    second against the tier's rate;
  - `pages again` — the views' own pages placed again (`cycle.again`), a second, the most
    in any second of a segment: at most `host.pages` (8, 8, 4) — one tick's placing, what a bias switch may let go
    and bring back; a view that fits lets go nothing it names;
  - `insert late` — for each insert opened in a judged segment, the seconds from its key leaving 0 to its opening
    beginning (`opened`): at most `WAIT.SHOWN` (0.25 s) — a delay a hold would show no sign for;
- **the film does not play under the viewer's moves**: the stand pauses the film after its segment, so the
  zoom, the drag, the lean and the two cuts are measured on a scene that goes on (its animates, its people) with
  no beat's cut of the film's own among them; a cut is the stand's own in its two segments and the film's in the
  film's;
- `input to frame` and `prepared cut late` count the callbacks that RAN (the pacer's steps) — an input answered
  by the next run callback is 1 at any pacer step; callbacks the pacer skipped are `frames p95`'s matter;
- `GC pause worst` is the scene's thread's alone (the frame is drawn there; a pause of the page holds the HTML
  layers, not the frame, and is in `main thread …`);
- `allocated a frame` is the engine's own: the scene thread's allocation by a sampling heap profile of that
  worker over the film, the steady state — the profiled run's film begins after a warm-up of 10 s of it, profiled
  apart and told as `allocated a frame, warm-up`, not judged (until Chromium has compiled a once-a-frame function
  for speed, some seconds in, every fraction it works out is put on the heap: on people 37 KB a frame in the first
  2 s, 0.2 KB from about 10 s; a stall that makes is `GC pause worst`'s, judged over the traced film from the
  opening) — in a run of its own, not the traced one: ending the sampler makes V8 collect the whole
  heap at once (a full, non-incremental collection — the profiler's pause, not the scene's), so it never falls in a run
  whose GC is judged —, summed by script — the engine's modules (`engines/3/**`) judged against the limit, per
  display frame at 60 a second; the scene's own code (animates, films, casts) and the messages reported beside
  it, not judged (5.16: the scene's to mend);
- `worker JS` is reported for drawn and for held callbacks apart, with its parts in the detailed run (`step`,
  `tick`, `times`): per segment each part's median / p95 / p99, what they come to (`sum`) against the callback's JS and
  the remainder (`unaccounted`), the step's and the renderer's own remainders, and the work done (`work`);
- the traced run's GC is told by segment: per thread the minor and the major collections (how many, median and worst
  pause, sum) and the heap's growth to them a tick (`gc`); the profiled run's call tree under `tick` tells what each
  part of the callback allocated (`allocated.tick`: sampled every 16 KB, so a small part is rough);
- **page-bound numbers say their painters**: `open`, the cuts' waits and the pages placed are a machine's with
  `host.painters` painters — the report says the number beside each, and does not judge them against a limit
  when the machine gives fewer painters than the profile's device has (4: 4.9);
- `open` is reported by its legs (the marks), beside 5.21's orientation; no opening time is promised (section 7
  item 2), so it is not judged against engine 2's 2 s;
- `GPU p95` is reported by pass, beside 5.2's reading (about 1 ms in the `laptop` profile on a card of the Arc's
  class for half a tick on a UHD 630); it is not judged against engine 2's 8 ms, and is not a verdict on the
  reference devices until the same run has been made on one (11.2).

### 3.9 Files, addresses, the render service

**BD1 the engine is served as written** — no bundler, no new build: `engines/3` goes wherever `engines/1` and
engine 2 (gone) go today, beside them. The site image copies it under its fingerprinted folder (one fingerprint
over the three folders).

**BD2 addresses** — relative to each module, as today: the thread starts the artist with `new Worker(new
URL('./sheets/artist.js', import.meta.url), { type: 'module' })`; `sheets/cache.js` the painters with
`new URL('./painters.js', import.meta.url)`; people's data from `new URL('../../scene/', import.meta.url)` in
`people/rig.js` (1.7). Engine 3's kit is a module (WT9) — nothing is fetched and run through `new Function` except a
scene's own code, which is the language.

**BD3 imports** — engine modules import each other by relative paths. There is no library and no
dependency: the mathematics is `world/m34.js` and the 4 × 4 forms of `render/views.js` and the camera's lens. Every static import of
`thread.js` is on the way to the first frame; only `./stand.js` is `import()`ed.

**BD4 the whole-set check** — `test/gpu/check.mjs` (5.11) imports `gpu/wgsl.js`, `gpu/layouts.js`,
`gpu/check.js`, `render/library.js`, `people/person.wgsl.js` and the chunks straight from the sources, in node.
Those modules therefore touch no `self`, `navigator` or `document` when imported. To read the scenes it is given the
check also imports `world/spec.js` (`compile(spec, warn)` — its `elements` with `who`, `o`, `shader { text, names }`):
it stays importable in node with this signature.

**RS3 the picture** — `page.screenshot`, as today: it holds the title, the captions and the debug overlay as the
page lays them; on the render machine it shows a worker's WebGPU canvas correctly. It is taken after
`stage.seen()` (or `still`, `to`, `seek`) replied — that is after the frame was drawn whole and `gpu.done()`.
(Nothing orders that reply against the frame reaching the page's surface; main relies on the same. If the run
shows a stale picture the cure is two animation frames of the page before the
screenshot: 11.10.)

**RS4 a render's uses of the page**, the closed list: `document.fonts.ready`, `stage.ready()`, `stage.seen()`,
`stage.state.call('to', t)`, `stage.state.call('waits')`, `stage.still(view)`, `stage.showcase.pause()`, `.seek(t)`, `.info` (the film is started
by `show`'s `start.showcase` — `render.html` asks it in the moment it shows the scene, 1.6 row 5 — never by a later call),
`stage.inspect()`, `MooodState.set / cut / check / unknown / all`, `__mooodTime.run(ms)`, `window.__mooodErrors /
__mooodWarnings / __mooodTells`, `window.__mooodDevice` (PG13). Not in an engine-3 render, though the render of
engines 1 and 2 has them: `waitForTimeout(1000)`, `stage.draw`, the frame before the moment,
`showcase.play()`, a `showcase.start()` after the scene is shown.

**RS5 a scene's shader files** — the file's name follows the scene's engine. The places that name the file
refuse a folder with a file they do not name. In each, an element's `shader` is the file `elements/<id>.wgsl` when
the scene's `scene.json` says `"engine": 3`, and `elements/<id>.glsl` otherwise — as today for engines 1 and 2, in
both directions. The field is `shader` in every engine's spec; what language its text is
in is the engine's to know. A `.glsl` file in an engine-3 scene's folder, or a `.wgsl` file in another's, is a
file nothing names, refused as any such file is. Every version of a scene says its own engine, so the versions
of «Вокруг света v3» made as engine 2's (5.20) stay readable and run on engine 2.

### 3.10 The language ⇄ the engine

Engine 3's language is engine 2's with the differences of this table — a language of its own text (`scene-format-3.md`,
LANGUAGE's), served beside the other two and the one every new scene is written in (1.6); engine 2's language and its text are not touched. Built
from `study-scenes.md` (what the 20 engine-2 scenes use), not from round 1. The rule (rulings 2-C1, 2-C2; W4):
everything those scenes use is in it and works; a thing is left out only where WebGPU or the one light and one
air force it, and then the edit a scene needs when it is carried over is named in 5.20; a word no scene uses is
in it when it costs the engine no machinery of its own, and is not built when it needs pipelines, passes or
threads of its own; no word is added but `copies` and forms (the owner's decisions). The text also has the words
the scenes use and engine 2's text lacks (`srgbToLinear`, the Canvas calls of SH8, `scene.startOf`,
`MooodShapes.V`).

| # | Word | What the engine carries | Built by |
|---|---|---|---|
| LG1 | **added** (the owner's "many alike things from about twenty kinds"; its first user is the forest of «Алые паруса» when that world is carried over — 5.20): `"copies": [{ across, distance, elevation?, facing? \| rotation?, tilt?, scale?, flip?, tint?, glow?, seed? }]` on a card or a plane (seen or unseen) | The element is painted once; each copy is a node (WT1) and a quad per sheet (WT2) with its own place, turn (a card's copy: `facing`, `tilt`; a plane's: `rotation`, `tilt` — the other kind's word warned, not taken; what it leaves out, the element's), `scale` (0.25…4), `flip`, `tint` (multiplies its colours), `glow` (multiplies its glows and `e.light`s), `seed` (the phase of its wind and flicker; default its index). A copy is named `"id:k"` where a point is named (bare id: copy 0); nothing stands `on` a copy. `animate` runs once for the element. Each copy is culled, asked, lit, shadowed and picked on its own. Not for people, particles, sky, inserts, a mirror (`reflect`, `glass` — a pane too) or a draped plane. | SCENE (spec, nodes, quads, `pointOf`, picking). RENDER and SHEETS: nothing new — a copy is a quad row |
| LG2 | **changed**: an element's own shader is WGSL, `elements/<id>.wgsl` | Below. | RENDER (`render/own.js`); LANGUAGE converts the texts of «Вокруг света v3» (5.20); SERVICE the file's name (RS5) |
| LG3 | **rule**: paint code sees only its easel | The state it is given, the easel's `e` (SH8), the kit and lib; nothing kept between paintings and nothing shared with animate or scripts except through state keys and what a painting declares (points, lights, layers). Modules run once in the artist and once in the scene's thread. Pictures a painting builds in canvases of its own are its own business. | SHEETS (easel), SCENE |
| LG4 | **changed**: shots have no seconds | `scene.shot(values)` / `s.shot(values)` → `{ ready, cut(), cancel() }`: lives until cut to or cancelled; one made inside a sequence is cancelled with it; at most 2 live for each maker (2.3 step 1: a third lets that maker's oldest go — its `ready` stays false and its `cut()` is a plain cut). `ready`: a boolean the scripts poll (21 uses), 2.3 step 5 — asked in an `s.until` and answered "no", it is the story waiting on that shot: the page's wait sign after `WAIT.SHOWN`. `cut(values)` sets the values at once, as now; the picture follows when it is whole (2.3; 2.4 when nobody made the shot ready). `scene.prepare(values, seconds)` is not in engine 3's language (the 20 scenes use it once — the train's lap: 5.20). The film (`modules/beats.js`: `from`, `after`, the key `beat`, the tells) is the worlds' own; its words stay, and in a world carried over its game path is edited to make the next beat ready (5.20). | SCENE (`engines/3/play/shots.js`) |
| LG5 | **accepted, with no effect** (engine 3 has no machinery for them, for cost): a caster's `soft` (712 uses: `shadow.soft` — a through-light's `soft`, the edge of its patch, and particles' `soft` are other words and keep their meaning: LG9), a light's `size` (12), a mirror's and a pane's `blur` (24 + 5), a plane's `lit` (44, all in lit scenes, where it does nothing on main already) | Nothing. No scene is edited for them when it is carried over. The language's text names each once — "accepted; does nothing in engine 3" — so that nobody copies it from an engine-2 scene into a new one | SCENE (`spec.js` knows them); LANGUAGE (the lines in the text) |
| LG6 | **not in engine 3's language; a scene that has one is edited when it is carried over** (5.20): weather's `veil` (one air: 1 use in the 20 scenes); `light.people`, a look's `people` and the scene without `ambient` (one light: 2 scenes); `scene.prepare` (1 use); GLSL in a shader. Each is said once, by its element: the words as unknown words (LG13 — particles' by `world/emitters.js`); `scene.prepare` in the spec's `script` and `showcase`, and a shader that reads as GLSL, by `world/spec.js` with words of their own | — | no area builds them |
| LG14 | **rule, the owner's — the engine's limits are kept, not got around** | The principle (his words: «не обходить ограничения движка. Следовать им, дружить с ними, и не пытаться достичь желаемого любой ценой. Честно вписываться в ограничения»): the engine's limits are part of the medium. A wish the engine does not support is not attempted and not imitated by tricks; the author finds what the medium does well instead; if a limit truly blocks something important, the author says so — that is a request to the engine, not a thing to fake in a scene. LANGUAGE writes it as a principle, in the spirit of the game, generic — no cases from our scenes, no micromanaging — in the language's text (`scene-format-3.md`); the guides the authors of older scenes read are not re-worded for it. Its instance for shapes: **flat sheets, placed anywhere and turned any way, and forms given by a function (LG15) are the supported ways.** A thing assembled from flat faces — a house from its walls — stays a right way; a round thing far off or seen from one side is painted on a flat sheet; a thing that turns in view or is walked round may be a form. **What the engine still lacks is not attempted and not imitated**: forms with holes, glass or translucent forms, raw meshes, imported models — no roundness built from many thin facets or stacked slices, no volume faked by tricks, no shells standing for glass. (His words: «авторы сцен не должны его обходить. Никаких workarounds, никаких подпорок. Если такое не поддерживается — то даже не пытаемся… и чтобы не пытались даже имитировать».) The engine does not police it (no gate: W7); it is the language's rule and a reviewer's. | LANGUAGE (the text, `dropped.md`); nothing in the engine |
| LG15 | **added, the owner's decision**: a form — `e.form(fn[, { closed, ground }])` in an element's paint code; the kit's `bend`, `revolve`, `extrude`, `loft`, `lump` | 5.23, WT10: a function (u, v) → point, opaque, painted like a sheet, 33 × 33 points chosen by the engine; an element with a form has one painting and none of: layers, parts, an own shader, `blend`, `translucent`, `reflect`, `glass`, `wind`, `drift`, `clip`. The language's text gives, for each constructor, how the painting's rectangle lies on the form. `kit.bend`: the middle of the bent sheet's foot is the element's anchor, whichever way it is bent. | SHEETS (the easel samples it), SCENE (the kit's functions, the grid, `place`, the chunk), RENDER (detail, normals in light); LANGUAGE (the text) |
| LG16 | **rule, interaction** (3.11): a thing to be pressed needs a point | As engine 2's language has it now: an offered thing shows a ring at its point — the point its painting names (`e.at(x, y, name)` → `'id#name'`), else the point it marks as itself, else the middle of its box (`'id@'`: IN1); a thing of the sky must mark one. What must sort with the scene is a sheet in the scene, not a layer of the page. A mini-game glued to moving points while the camera moves is fragile: hold the camera still for it. LANGUAGE writes these as principles, generic. | PAGE (circles), SCENE (points, the pulse's bits); LANGUAGE |
| LG17 | **rule, the owner's request to authors: lines said belong to the showcase** | `scene.say` / `act(id, 'say', …)` stay in the language and work everywhere (a line is shown and voiced where the page has the speech layer; timed by reading where it has none). The text asks authors to say them only in the showcase, never in a scene's own always-running scripts or sequences: in a game the scene's own lines would speak over the game's words and voices, and the game cannot tell them from its own. A request in the text (`scene-format-3.md`, the showcase paragraph), not a check | LANGUAGE |
| LG18 | **added, the owner's decisions (2026-10-22)**: scenes are laid out for the safe frame (4:3…21:9) and the world is drawn round it on any screen (RN5); `scene.view` / `e.view` — `{ safe, seen }`, each `[left, top, right, bottom]` in stage heights: the safe frame and all the screen; a sky element's `box` — what it paints (stage heights, default the stage and its margins), the rest of the sky carried softly; a mark of what is offered stands wherever its point is seen on the canvas (`bespoke.where`'s `seen`, the mini-games' marks), the widgets' HTML keeps the safe rect | Read-only, `world.view` (WT8); changes with the canvas, repaints nothing, is no state key — nothing saved, no shot made ready, depends on the device. Paint code has no `e.view`: a painting is the same on every screen. | SCENE; LANGUAGE |
| LG7 | **not built in this piece, though engine 2 has it** (no scene uses it and it needs machinery of its own; listed in `dropped.md`): `travel` planes; `seen: "direct"` and `seen` as a list; particles' `onto` and `lit`; a person as a body (`bodies`, `outfits`, a body's garments and face); a layer's `blend: "screen"` | — | — |
| LG8 | **in the language though unused** (no machinery of their own, or the owner's word): widgets (W3); every camera mode with what it needs (`overhead`, `platform`, the hero, `solid`, `width`, `jump`, `height`, `follow`, `bearing`, `camera_on`); the director's tools (`s.event`, `s.any`, signals, `action.pause` / `resume`, `{ queue }`, `scene.light().fade`, `scene.say`, an element's `script`); `.mood()` / `.talk()`; `clip.outside`; the kit whole (`anim.joint`, `blend`, `easeOf`, the easings); particle kinds and fields that are rows of the one model (`petals`, `bubbles`, `streak`, `bounce`, `flat`, shapes); `e.debug`, `e.warn`, `e.was`, `e.burst`, `scene.ground`, `scene.warn` | As the language says. | as today |
| LG9 | **in the language, used** — named here because round 1 dropped or narrowed them: `e.where`, `scene.was`, `e.area` (the element's box), `captions`, `directions`, particles' `blink` / `tumble` / `frames` / `settle` and a sprite painted by code, `action.finish()`, a layer's `blend: "add"` (111 layers) and `"multiply"` (3), a layer's `box`, `wind: { strength, gust, scale }` (1878 layers), `glass` (with `strength`), an insert's `iris: [x, y, rx, ry]` and its key as how far it is open (5 uses in 2 scenes; WT5), `seen: "reflection"`, `clip.inside`, `shadow.light` / `strength` / `onto`, `translucent`, a through-light's `soft`, particles' `soft` (4.4), the paints `silhouette`, `rim` and the colour paints (`flat`, `toned`, `clay`, `lit` — one result under light, all four accepted), `ambientColor`, `hazeGlow`, `grain`, `inside`, a light's `flicker` | As the language says. | as today |
| LG10 | **rule, lights**: every `lights` entry and every `e.light` is a light, any number | 5.5: all are in WT4; the 256 that light most now are in the lighting; every one's glow is drawn. | SCENE, RENDER |
| LG11 | **rule, shadows**: which lights cast is the engine's choice (5.5): the lights a caster's `shadow.light` names, the far lights, then the strongest by a caster — four at once. `strength × (1 − translucent)`: per shadow map kind of a light the strongest of its casters; `onto`: per kind the union of its casters' receivers. A translucent caster's shadow is lighter, not coloured (as on main). | RENDER |
| LG12 | **rule, particles**: closed forms of time; 65 536 alive in a scene at the most — more and every emitter gives that much less, said (the language's present promise; the blizzards of two scenes reach 42 000 and 61 000) | 5.18 | SCENE, RENDER |
| LG13 | **rule**: an unknown word is said once | `world/spec.js` holds ONE closed list of the words of each kind of object (`WORDS`: the spec, camera, light, look, lights, a light's cone, element, place, copy, shadow, reflect, glass, clip — the words of LG5 among them); particles' words are `world/emitters.js`'s list, a layer's options `sheets/easel.js`'s; a person's object is the people's to read. A word not in a list is said once by its element (`warn`) and not taken. `layer(k)` beyond `OWN.SHEETS − 1`, more than `OWN.VALUES` uniforms, a shader that does not compile: an error of the scene's build, said with the element and the line (RENDER maps the module's chunk back to the elements that have the text; said once — `gpu.module` hands an own text's faults, a refused `enable` or `requires` among them, to RENDER alone: GP5). What is known only at a make is said with its element then: an own shader's layers beyond `OWN.SHEETS − 1` are not read; a painting of an element with a form that has what a form may not is not taken. | SCENE, RENDER |

**The own shader (LG2)** — the author's text is one function and above it whatever it needs (functions, consts):
```
fn shade(painted: vec4f, at: vec2f, uv: vec2f) -> vec4f      // painted: the element's own painting there, premultiplied linear;
                                                             // at: the point, in the painting's units; uv: 0…1 across it
// given by the engine, by these names:
fn layer(k: i32, at: vec2f) -> vec4f     // k: 0 … 9 — 0 the element's own painting at any point, 1… its layers
var<private> emission: vec3f;            // what it adds unlit (starts at 0)
var<private> at_dx: vec2f;               // the painting's units one screen px across
var<private> at_dy: vec2f;               //   … and down
var<private> u_time: f32;                // the scene's seconds
var<private> u_<name>: f32;              // one for each name of the element's `uniforms` (at most 32): the name in
                                         //   the spec and in `e.uniform(name, v)` is unchanged; in the text it is u_<name>
// helpers: PI, cycle(k), hash2(vec2f), hash3(vec3f), hashU(u32) (all → f32), noise1, noise2, noise3, wobble, wobble2,
//          luma, srgbToLinear, wrap(x, y)  — x − y·floor(x / y)
```
Every other name of the engine in that module begins `e_`; an author's name may not begin `e_` or `u_`, and WGSL's
own reserved words bind authors (`set`, `mod`, … — so the sailcloth's uniform `set` is `u_set` in the text and
nothing else changes). A uniform's name is letters, digits and `_`, beginning with a letter. `layer(k, at)`
outside the painting's rect gives 0 — but a layer that wraps is read round. No textures of its own, no `discard`, no derivatives (`dpdx`, `dpdy`, `fwidth`); loops with
constant bounds. A distinct text is one module and one set of pipelines, made at the scene's build. `shade`'s
result is lit as the element's painting is; `emission` is added after the light. An own-shader quad is drawn in the
blended list over its whole box.
What each thing the 82 shader files of the 20 engine-2 scenes use becomes (the table every conversion follows —
`engine3-porting.md` carries it; in this piece LANGUAGE converts the 14 files of «Вокруг света v3», by reading
types, and the whole-set check compiles them): `vec2/3/4` → `vec2f/3f/4f`; `uint` → `u32`; `c ? a : b` → `select(b, a, c)`; `mod(x, y)` →
`wrap(x, y)`; `fwidth(at)` → `abs(at_dx) + abs(at_dy)` (and `fwidth(at.x)` likewise by component); `hash1(vec2)`,
`hash1(vec3)`, `hash1(uint)` → `hash2`, `hash3`, `hashU`; `layer(0, at)` stays (34 files); a uniform `name` →
`u_name`; arrays `float[5](…)` → `array<f32, 5>(…)`; a parameter that is assigned → a `var` copy; `v.rgb += x` →
whole-vector assignment; one declaration a statement; braces round every body. `cycle`, `noise1`–`noise3`,
`wobble`, `wobble2`, `luma`, `srgbToLinear`, `emission`, `u_time`, `PI`, `uv` keep their names.

**Not in this piece** — considered and left out (rulings 2-C2, 2-C3); the engine keeps no hook for them; `dropped.md`
names them as "can come": `here` on an element; `mist`; a layer's `glows`; a beat's `about`; `casts` on a light;
`scene.run` and `{ key, map }` (the scripts they would replace fire every 0.05–4.6 s, not every frame — checked at
all 14 sites; they cost no frame); marks inside motions, `hold`, `pace`, an element `held` at a person's point,
`scene.film`. Consequence, named: seconds stay inside motions (883 `s.wait` in the scenes), so B1 ("events, not
seconds") is met for cuts, shots and voices and not for moments inside a motion.

### 3.11 Interaction — pressing, the highlight, anchored layers, mini-games (everything by a point)

The owner's principle (rule 17): **everything a player can interact with is tied to a POINT that the scene
names; a press is a hit on a circle around that point.** No ray, no coverage test, no ids, no GPU work. Engine 2
has it since the press-points work (on this branch: `actions.js`, engine 2 (gone), `artist2.md`
"Points"); **engine 3 keeps that language to the letter** — the same refs, the same rings, the same point where
a thing is pressed — so a scene and a game carried over need no edit for it. What is engine 3's own is
underneath (who projects, the highlight). Why and what was weighed: 5.22.

**IN1 a point** — what PG9 tracks: an element's named point (`'id#name'`: `e.at(x, y, name)` in its paint code or
its animate); its own point (`'id'`: the point it marks with an unnamed `e.at`, else its anchor — where its lines
and widgets stand; with `over`, its top); **where it is pressed** (`'id@'`: the point it marks as itself, else
the middle of its box; a person's: the head; a sky element's and an insert's: as its own point — a sky element
that marks none has none, for it has no box in the world); a copy's (`'id:k'`, `'id:k@'`, `'id:k#name'`); a
person's (`'id#hand_r'` and the other points of a figure). It is a point of the thing as it is drawn this tick:
SCENE works it out through `place` (WT7) — the same mapping the vertex stage uses — after the animates and the
people's poses, so it follows a moving thing, a moved layer, a person, a form. **Sky and insert points are slots
like any other** in PG5's `points` (a sky's: depth Infinity; an insert's: depth 0, there only inside its iris as
far as it is open): engine 2 tells the page which space each point is in and the page projects it; here the
thread projects them all.

**IN2 offering and pressing** (PAGE: `actions.js`) — engine 2's rings, by the same lines of `actions.js`
(`:46–93`; 1.6 row 2). `actions.offer({ <ref>: [action, …], … })` (a game's `bespoke.offer`, the scene's own
offers; a ref is an element's id or `'id#name'`): for each ref the page shows **a ring at its point** —
`stage.screenOf('id#name')`, or `stage.screenOf('id@')` for a bare id, which for an engine-3 scene `page.js`
answers from the slot it tracks (PG9, PG5). The ring is a real `<button>` of the page, round, `PRESS.SIZE`
(48 CSS px — `actions.js`'s `SPOT`) across, one look everywhere, placed in `stage.onFrame`. The browser does the
cursor, hover, the finger, the keyboard and every window size. A press is the browser's click on that button —
the distance from the pointer to the point, nothing else; it is taken at once, in the page: the thing is picked
(`select.js` `choose` → `select(path)`: it is `SELECTED`, IN3) and the menu of its actions opens beside the ring;
the same ring pressed again, or an empty place of the scene, closes it — as on engine 2. What the thing is does
not matter. A point that is out of the frame, behind the eye or not there now (x NaN) has no ring. **A point
behind something nearer still has its ring and can be pressed** (a game offers what is in sight; dimming such
rings can come later: `dropped.md`). Two rings that overlap: the nearer point's is on top (`depth`). While the
picture is held (2.4) the rings stand where they were (IN4).
The thread's part is only the pulse: `select.js` tells it what is offered — `stage.offer(paths)`, as today (PG4).

**IN3 the highlight — the thing itself pulses** (SCENE writes, RENDER draws as always) — not an outline. Two
bits on quad rows (4.7): `OFFERED` and `SELECTED`, set by SCENE on the quads of the offered or selected thing
when `offer` / `select` is called (for a person: `people.mark(id, bits)`, a field of the person's uniform). The
shared vertex stage multiplies such a quad's brightness by `Frame.pulse` for `OFFERED` (4.1: `1 + PULSE.DEPTH ·
(0.5 + 0.5 · sin(PULSE.RATE · t))`, 0.35 and 2.4 — main's breath; no `sin` of the wrapped time in a shader) and by a steady `1 + PULSE.DEPTH` for `SELECTED`; a
person's main does the same. It is the thing's own ordinary draw, so its shape, its own shader, its motion, the
haze and what hides it are right by construction; no pass, no target, no pipeline, no row written per frame.
It is decoration: pressing does not depend on it. A frame with an `OFFERED` quad in view is not idle (RN4). In
a mirror's view `quadGlow` and `personGlow` return 1 (`View.flags`): a reflection does not pulse, so a still
mirror is not redrawn for it. Setting the bits stamps the rows, so an offer's start and its end each redraw the
static shadow cells that hold the thing — one cell a frame, accepted.

**IN4 layers of the page anchored to a point** (widgets, speech pop-ups, the action menu, the circles, a game's
own) — `call('track', ref, lift, over) → slot` (PG9); PG5's `points`: `[x, y, depth]` a slot, projected by SCENE
with `f.camera` and `f.seen` — the very objects RENDER draws that tick's frame with (an insert's points: on `f.rect`).
- **The same-frame rule**: `points` go in the `frame` message of the tick whose camera they were projected with
  (drawn or idle — never a held one); the page
  places its layers from a message in its next animation frame, all layers at once (`stage.onFrame`; PG5). The canvas's frame comes
  from a worker, so it and the page's layers reach the screen within one display frame of each other — it
  cannot be made exact (11). At rest a layer is exactly on its point; behind a moving camera it trails by up to
  a frame.
- **Nothing jumps while a cut holds the picture**: a tick whose frame was held sends no `points`, `camera`,
  `hero`, `selected`, `frame` (2.1 step 9); they come with the frame that shows the new shot.
- **What must sort with the scene is a sheet in the scene, not a layer of the page** (LG16): a page layer is
  always over the whole picture.

**IN5 a game's mini-games over the scene** (PAGE: `bespoke/play.js`; the game's own HTML) — what a game may read,
and when:
- `bespoke.where(ref, lift) → { x, y, depth, seen } | null` — the point, from the last `frame` message; `seen`:
  on what the scene shows (an engine-3 scene: all its canvas — the world round the safe frame too: a thing seen can be
  pressed, the owner's decision 2026-10-22; another engine's: its frame); `bespoke.frame()` — the safe rect (the
  widgets' and the plate's layout keep it); the mini-games' marks stand anywhere on that canvas (`screen()`);
- **`bespoke.onFrame(fn)`** — called right after each `frame` message is applied, in the animation frame in which
  the engine's own layers are placed: a game moves its overlay there and nowhere else;
- presses: `bespoke.offer(offers)` — rings (IN2);
- **dragging or rubbing over an area**: `bespoke.pointer(ref, radius, fn) → stop()` — while it stands, pointer
  events within `radius` CSS px of the point go to `fn({ type, dx, dy, id })` with `dx, dy` in CSS px from the
  point (an invisible round element of the page at the point; the browser routes the events; it captures
  the pointer at `pointerdown`, so a drag that leaves the circle goes on to its `pointerup`), and not to the
  scene's camera.
**Covered** — the scene pauses when `paused = play || hidden || away || covered` (2.6). `covered` is set only by
the SITE's own layers that take the whole view (the picture viewer, a dialog of the site), through
`stage.cover(on)` / `Moood.cover(on)`: today the picture viewer (`viewer.js`) and no other — the author page's veil lies
round its preview. **A game's overlay never covers**: the scene and its voices
go on under a mini-game unless the game itself calls `bespoke.pause(true)`.
For authors, as a principle (LANGUAGE writes it in the spirit of the game, generic): a thing to be pressed needs
a point — name it in the painting (without one the ring stands on the middle of its box, rarely the best place;
a thing of the sky must mark one); and a mini-game glued to moving points while the camera moves is fragile —
hold the camera still for it.

**IN6 the author's selection on a scene's page** (`select.js`: a click selects a part of the scene; used by the
world's page — it tells the chat what is selected —, the free and the asked play pages, and the Android app) —
**not redesigned in this piece** (the coordinator's instruction). The least for it to keep working on the new
engine is main's own, kept for this use only: PG4 `pick(x, y)` and `pickSpec`
(SCENE: a ray through the pointer against the quads by `place`, a sheet's dense paint by SH4
`sheets.coverage`, people by PP5 `people.pick`), `select(path)`, PG5 `selected { path, x, y, w, h }` (the box
from `inspect`). Two changes only: sky sheets and inserts are in the search (the frame's rect and the iris — the
skipped kinds were main's fault); and the selected thing is shown by `SELECTED`'s steady brightness (IN3), so the
selection's silhouette overlays and their part of the `masks` pass go. Its known limits stay and are named: it
is a model apart from the picture (an own shader's shape, a moved layer and a form are judged by their sheet at
rest and their box). It is listed for the coordinator (9a) — an ids pick was not plainly less work.

**Not in engine 3**: `pick` as the player's way to press and the page's cursor request every
120 ms; offered and selected silhouette overlays, `f.highlight`, a selection part of `masks`; a separate
computation of where an offered thing is. There: `call('ground', …)` (where the ground is — the hero's way).

---

## 4. Shared names — defined once, here

### 4.1 Buffer layouts read by more than one area

Little-endian, WGSL alignment as written.

**`nodes`** (SCENE writes; chunk `world` reads) — 48 bytes a row: `struct Node { r0: vec4f, r1: vec4f, r2: vec4f }`
— the three rows of the node's 3 × 4 world matrix as float32, the translation in `.w`, the render origin
subtracted.

**`quads`** (SCENE writes) — 96 bytes a row (`sheer` at 80, three words spare after it):

| Offset | Field | Type | |
|---|---|---|---|
| 0 | `node` | u32 | row of `nodes` |
| 4 | `sheet` | u32 | the sheet's handle; `0xffffffff` none |
| 8 | `layer` | u32 | row of `layers`; `0xffffffff` none |
| 12 | `flags` | u32 | 4.7; bits 0–2 the kind (0…6) |
| 16 | `recv` | u32 | shadow receivers it is |
| 20 | `casts` | u32 | casters' set it is in — WT2's `cast`; `cast` is a reserved word of WGSL, so the member is `casts` |
| 24 | `own` | u32 | own shader's slot + 1; 0 none |
| 28 | `seed` | f32 | |
| 32 | `rect` | vec4f | l, t, r, b |
| 48 | `tint` | vec4f | r, g, b linear; glow |
| 64 | `el` | u32 | the element's index |
| 68 | `form` | u32 | its row of `forms` + 1; 0 none |
| 72 | `aux` | u32 | an INSERT's row of `world.inserts` |
| 76 | `clip` | u32 | WT2's `clip`: the cutter set it is clipped by, the side, the sets it cuts |
| 80 | `sheer` | f32 | WT2's `sheer`: the element's `translucent` |

**`layers`** (SCENE writes) — 80 bytes a row: `pose0: vec4f` (x, y, rotate, scaleX) at 0; `pose1: vec4f` (scaleY,
alpha, brightness, length) at 16; `opts0: vec4f` (pivot x, pivot y, wind strength, wind gust) at 32; `opts1: vec4f`
(wind scale, flicker, shimmer, depth) at 48; `opts2: vec4f` (drift x, drift y, 0, 0) at 64.

**The order** (RENDER writes; a vertex buffer stepped per instance, slot 1 of every quad pipeline; a run is drawn
`drawIndexed(indices, count, firstIndex, 0, first)` — `firstInstance` is the run's first row) — 68 bytes a row:
`quad: u32` (location 1), `shape: u32` (2; for a FORM also its stride), `page: vec2i` (3: the origin page, SH14),
`edge: f32` (4: the edge-on fade), `piece: 4 × vec3f` (5, 6, 7, 8) — for a quad drawn by the SCREEN shape
(5.12; bit 7 of `shape`'s low byte beside its stride): the four corners, round it, of one part of the piece of
the quad the view sees — each `(x, y, 1) / w`: where the corner is on the quad's sheet, metres from its origin
page's corner, and 1, over the view's `w` there; the vertex stage mixes the four by the unit square's corner
(along the first side and the third, then between the two) and divides: a point of the quad's own plane, evenly
on the screen. Worked out on the thread in doubles from `place` at the quad's corners, each corner's three
numbers once (two parts give a corner they share the same bits, so they have the same points along the side
they share); a quad's parts are rows that follow one another, one grid for all; unread for other shapes. Slot 0
is ONE vertex buffer holding the
corners of every shape (`corner: vec2f`, location 0), with one index buffer; a shape is an index range. So every
quad pipeline has one vertex layout, and a run — one `drawIndexed` — breaks where the pipeline or the shape
changes; between two runs of one pipeline nothing is set. (Counted over the 20 scenes: 1–27 runs a view; the
forest up to 188, fewer with `copies`.)

**`Frame`** (uniform, group 0 binding 0; RENDER writes each drawn frame): `time: f32` at 0 (SCENE's `f.t`, wrapped
by RENDER so floats stay exact), `tick: u32` at 4, `pulse: f32` at 8 (the offered things' factor now, worked out by RENDER from the exact `f.t`
once a drawn frame: `1 + PULSE.DEPTH · (0.5 + 0.5 · sin(PULSE.RATE · t))` — so the wrap of `time` never shows), 4
bytes spare; RENDER's own fields from offset 16.

**`View`** (uniform, group 1 binding 0; RENDER writes one per view): `proj: mat4x4f` at 0; `rot: mat3x3f` at 64
(48 bytes); `eye: vec3f` at 112 (less the origin); `yaw: f32` at 124; `size: vec2f` at 128 (the viewport, px);
`sheetBias: f32` at 136 (SHEETS' `view.bias`); `flags: u32` at 140 — bit 0 `VIEW.MIRROR`: a mirror's view (read by
`quadGlow` and `personGlow`: IN3); the other bits are RENDER's; RENDER's own fields from offset 144.

**Who declares what in WGSL.** The bindings of `frame` and `view` (4.2) are declared once each, by the names of
4.2's tables, in the chunk of the area whose data it is: SCENE's chunk `world` declares `nodes`, `quads`,
`layers`, `forms` and the structs `Node`, `Quad`, `Layer`; SHEETS' chunk `sheets` declares `sheetTable`,
`sheetCache`, `sheetSampler`; RENDER's chunk `frame` (`render/wgsl/`) declares the rest — the uniforms `frame:
Frame` and `view: View` with their structs (the shared fields by the names and at the offsets written here:
`frame.time`, `frame.tick`, `frame.pulse`; `view.proj`, `view.rot`, `view.eye`, `view.yaw`, `view.size`,
`view.sheetBias`, `view.flags`), `lights`, `lightGrid`, `panes`, `linear` and all of group 1. A chunk uses another
area's binding only through the functions that area gives (WT6, SH14, PP9), except these uniform fields and the
members of the rows laid out above (`Node`, `Quad`, `Layer`), which every chunk reads by name. PEOPLE declares its own groups (`people`, `person`). Module-scope declarations may
stand in any order, so `assemble` needs none.

**Names in WGSL.** An author's shader is assembled into one module with the engine's chunks, and LG2 promises the
author every name that does not begin `e_` or `u_` (but the given ones). So every module-scope name of SCENE's,
SHEETS' and RENDER's chunks — structs, functions, constants, the bindings' variables — is WRITTEN in WGSL with
`e_` before the name this document gives it: `e_Quad`, `e_quadOf`, `e_nodes`, `e_QUAD_CARD`, `e_Sheet`,
`e_sheetRead`, `e_frame.time`, `e_view.proj`, `e_lights`, `e_masks`, `e_reliefAt`. Struct members, and the names
LG2 gives the author (`shade`, `layer`, `emission`, `at_dx`, `at_dy`, `u_time`, `u_<name>`, the helpers), are
written as given. PEOPLE's chunks are never assembled with an author's text and keep their own names (they call
the others' by the prefixed ones).

**`inks`** (PEOPLE writes, the canvas pass reads) — 256 × `vec4f` (r, g, b linear; spare).

Not shared, so each is its owner's to lay out: the lit lights' table and grid, the shadows' uniform, the land's
tables, the emitters' buffers (RENDER); the sheets' table (SHEETS); bones, morphs, the person's uniform (PEOPLE).

### 4.2 Bind groups

Every pipeline that draws the world (quads, land, sky, particles, people, own shaders — in `main`, a mirror's pass,
the shadow passes, `masks`) has the layout: group 0 `frame`, group 1 `view` or `viewCast`, group 2 its family's,
group 3 `none` or `person`. **A pass never uses a pipeline whose layout holds a texture that pass writes**: that is
why the shadow and `masks` passes use `viewCast`, why no texture a pass renders into is in `frame`, and why the
passes that make the engine's own pictures (`bake`, `blob`, `air`, a mirror's smear, `bloom`, `gather`, `canvas`)
have layouts of their own, registered by RENDER.

`frame` (final; GPU's `layouts.js`; visible to vertex and fragment unless said):

| Binding | Name | What |
|---|---|---|
| 0 | `frame` | uniform `Frame` |
| 1 | `nodes` | storage, read (vertex) |
| 2 | `quads` | storage, read (vertex) |
| 3 | `layers` | storage, read (vertex) |
| 4 | `sheetTable` | storage, read |
| 5 | `sheetCache` | `texture_2d_array<f32>` (written only by SHEETS' upload passes, `sheets/upload.js`) |
| 6 | `sheetSampler` | `sampler` |
| 7 | `lights` | storage, read — the lit set (5.5) |
| 8 | `lightGrid` | storage, read |
| 9 | `panes` | `texture_2d<f32>` — the panes' masks; RENDER rasters `world.panes` into it and writes it (`writeTexture`) |
| 10 | `linear` | `sampler` |
| 11 | `forms` | `texture_2d<f32>`, `sampleType: 'unfilterable-float'` (`rgba32float`, read with `textureLoad` only; vertex) — WT10 |

`view` (final): 0 `view` uniform `View` · 1 `shadowStatic: texture_depth_2d` · 2 `shadowMovers: texture_depth_2d`
· 3 `shadowSampler: sampler_comparison` · 4 `shadows` uniform (RENDER's) · 5 `blob: texture_2d<f32>` · 6 `air:
texture_2d<f32>` · 7 `masks: texture_2d<f32>` (the clip masks of THIS view, a cutter set a channel; read in the fragment stage by
the main passes and a mirror's pass — a mirror in which a clipped thing is seen has a mask of its own, drawn for
its view before its pass) · 8 `land` uniform (RENDER's: the levels of this view's land field) · 9 `landHeights:
texture_2d<f32>` · 10 `landShadow: texture_2d<f32>` (both `unfilterable-float`, read with `textureLoad`; 1 × 1 in
a world without land) — the land's field of THIS view: `reliefAt` (WT6) reads the heights, and everything lit
reads the land's own shadow of the far lights through the function RENDER gives (5.5). `viewCast` (final): 0 `view` uniform `View` — the shadow and `masks` passes
use it. `none`: empty.

Families' group 2 and 3, registered by their owners through GP7: `land` (the leaves storage), `particles` (emitters storage, rings storage, sprites texture, and the scene's depth as `texture_depth_2d` —
so the particles' draw pipeline is used only in `main-blend`, where that depth is read-only), `own` (the own shader's
uniform: its values and its sheets), `mirror` (the mirror's uniform and the image) — RENDER, which also registers the layouts of the engine's own pictures:
`bake`, `air`, `sum` (the air's steps, read by its sum), `blob`, `ready` (a rough mirror's smear), `small` (the bloom's and the gathers' inputs), `canvas`;
`people` (bones storage, morphs storage) and `person` (the person's uniform, dynamic offset) — PEOPLE.

The vertex stage sees six storage buffers in `frame`; a family's group adds at most two; the core limit is eight
(4.6) — which is why a form's points are a texture. Nobody adds a storage buffer to `frame` or `view` without changing this section.

### 4.3 Formats and samplers

| Name | Format | Use |
|---|---|---|
| the canvas | `gpu.format`, `alphaMode: 'opaque'` | the canvas pass writes display-encoded values itself |
| `main` | colour `rg11b10ufloat` (the feature of 4.6) + depth `depth32float` | depth reversed: cleared to 0; `greater` where depth is written; `greater-equal` with `DEPTH.BIAS` for what blends |
| `ids` | `rgba8uint` — the second colour target of the main passes and of a mirror's pass, in every world (1 byte a pixel more where no one stands; one set of pipelines for it) | people write (slot, part, line width, kind); solid pipelines write 0; blended pipelines have write mask 0 for it |
| `bloom` | `rg11b10ufloat`: ¼, 1⁄16 and 1⁄64 of the frame | the ¼ holds the sum the canvas reads (4.4); it holds only the part brighter than white, so the bounce cannot read it |
| `mirror` | `rgba16float`, `MIRROR.IMAGE` (512) px a side, + `rgba8uint` and `depth32float` (the pass's own, discarded) | one image a mirroring plane, drawn into the part of the texture its view needs; ITS ALPHA IS HOW MUCH OF A MIRROR IMAGE THERE IS (5.7) — cleared to (0, 0, 0, 0); another colour format than `main`'s, so a mirror's pass has pipelines of its own (4.5) |
| `mirror ready`, `mirror step` | `rgba16float`, `MIRROR.IMAGE` a side: one `ready` a rough mirror's image, one `step` for all | a rough mirror's image smeared (4.4 pass 6) — what its overlays read |
| `shadowStatic`, `shadowMovers` | `depth32float`, reversed | the two shadow atlases (5.5) |
| `blob` | `r8unorm`, 512² | people's contact shadow |
| `air` | `rgba16float`, 2D 384 × 144 — a 64 × 36 × 24 volume laid out as 6 × 4 tiles, filled by two small passes (4.4), read with two filtered taps (each kept half a texel inside its tile) and a mix | shafts and lamp glow |
| `air steps` | `rgba16float`, 384 × 144 | each cell's own stretch of light, before the sum along the depth |
| `masks` | `rgba8unorm` | clip masks, a cutter set a channel (`CLIP.SETS`; blended `max`) — one for the frame's view; one a mirror that shows a clipped thing |
| `gather` | `rgba16float`, 1⁄16 of the frame | the light gathered for `bounce` (colour brought down to white by its brightest channel — its hue kept — × weight, weight: by depth; what is brighter than white — a flame, a lamp — is the bloom's, never bounced: else one bright texel of `gather wide` lights a square about it) |
| `gather wide` | `rgba16float`, 1⁄128 of the frame (15 × 8 at 1080p) | `gather`'s mean over 8 × 8 of its texels: what the canvas reads for `bounce`: a cubic B-spline of it, four bilinear taps — wide and smooth, a thing counts by its area, a bright texel lights a soft round, never a square |
| `landHeights`, `landShadow` | `r32float`, `rgba32float` | a land field's levels (4.2, group 1); RENDER's |
| the particles' sprites | `rgba8unorm-srgb`, 2D array | the painted sprites (SH9) |
| `panes` | `r8unorm` | the panes' masks (4.2) |
| `forms` | `rgba32float`, 2046 × (33 · rows) | forms' points and normals (WT10); SCENE's |
| `sheetCache` | `rgba8unorm-srgb`, 2D array, `SHEET.LAYER`² × `host.cache` layers, 2 mip levels | premultiplied linear colour stored sRGB-encoded |
| `shadowSampler` | compare `greater-equal`, linear, clamp | the hardware's 2 × 2 compare |
| `sheetSampler` | linear, linear, mip linear, clamp — no anisotropy | read with `textureSampleLevel` |
| `linear` | linear, clamp | |

No multisampled target. The reason is this content's, not the tile GPUs' (a resolve is nearly free there): nearly
every edge is painted and already soft, and on the reference laptop four samples would multiply the memory traffic
of every blended screen. The rims of opaque things and of people are smoothed in the canvas pass. Nothing is read
unfiltered-float through a filtering sampler. No storage textures.

### 4.4 The passes of a drawn frame, in order

All render passes. `load` / `store` name what each attachment does (on a tile GPU that is the cost of a pass).

| # | Name | Target; load → store | When |
|---|---|---|---|
| 1 | `bake` | the land's atlases, kept between frames; load → store (a few tiles a frame) | land nodes or shadow-field points asked — by count (4.9) |
| 2 | `shadow-static` | `shadowStatic` depth; load → store, scissored to the cells drawn | a static cell is due — `host.cells` a frame (all, in a whole frame) |
| 3 | `shadow-movers` | `shadowMovers` depth; clear → store | a mover in a casting light's view changed since it was drawn |
| 4 | `blob` | `blob`; clear → store | a person near the view moved |
| 5 | `air` (2 small passes) | `air steps`; clear → store — each cell's own stretch: the shafts, every lamp's halo (the shafts read the shadow atlases) —, then `air`; clear → store — the sum along the depth (a pass cannot read the target it writes: 4.2) | the look has shafts or a lamp glows in the haze |
| 6 | `mirror` × m | that mirror's image: colour clear (0, 0, 0, 0) → store, `ids` clear → discard, depth clear → discard; then, for a mirror with `rough`, `mirror-ready` — two small passes over that image, `mirror step` then its `mirror ready` (clear → store), timed with `mirror` | that mirror's view or content changed (5.7). Opaque paint, then the sky, then what blends, then the lights' glows, in one pass, by the mirror's own pipelines (no particles in a mirror; a pane's image: the room alone — 5.7) |
| 7 | `masks` | `masks`; clear → store (pipelines with `viewCast`) | the world clips (for the frame's view, here; for a mirror's view that shows a clipped thing, into that mirror's own `masks` right before its pass 6) |
| 8 | `main-solid` | `main` colour clear → store; `ids` clear → store; depth clear → store | always: opaque paint — wholly opaque quads, and the opaque pixels of mixed sheets (`cut`: the others dropped) —, the land, people — near to far, depth written; then the sky, tested against that depth: its base past its painting (`sky-base`: one triangle at the far plane — render/sky.js), then its sheets; then, when there is light in the air, `air-sky`: one triangle at the far plane, tested against that depth, added — the air's whole light where nothing stands before the sky (5.18) |
| 9 | `main-blend` | `main` colour load → store; `ids` load → store (written by the marks — 0 where what blends is opaque — and the inserts — the insert's mark, `(0, 0, 0, 8)`, where they paint); depth load, **read-only**, and bound as a texture for the particles and the beams | always: every quad that is not wholly opaque (of a mixed sheet that laid depth, its other pixels: `edge`), own-shader quads, particles, glows — far to near, tested against the depth, none written; fully transparent pixels dropped; then the beams in the haze (`beam`, per pixel: 5.18); then, in a world with people, the frame view's **marks**: each quad drawn wholly among what blends (not a mixed sheet's `edge`, not draped, not adding or multiplying, its layer wholly there, its painting with opaque paint or an own shader, and able to hide one of them: its sphere over what they cover of the frame and nearer than the farthest of them — the cull's test) again by `mark` — its paint read once, a pixel under `SHEET.OPAQUE` after its amount dropped, `ids` cleared to 0 as a solid's are, the colour not written — scissored to what the people here cover of the frame (their spheres' `covers`): no person's line is drawn through a painting that hides them, at no cost where there are none; then the inserts |
| 10 | `bloom` (5 small passes) | the bright part to ¼, down to 1⁄16, down to 1⁄64; then up: the 1⁄64 added into the 1⁄16, that into the ¼ (clear → store going down, load → store going up) | always |
| 11 | `gather` (2 small passes) | 1⁄16 from `main`'s colour and depth (16 taps), then `gather wide` from it (16 bilinear taps, each a 2 × 2); clear → store | the look has `bounce`; every second drawn frame. The canvas reads it bilaterally: each of its four taps counts as much as its mean of 1 / distance is the pixel's (all within ×1.4, none past ×2.8), the bounce as strong as the share that is — a ceiling is not lit by the window or the far wall beside it on the screen |
| 12 | `canvas` | the canvas; clear → store | always — one full-screen pass: bounce (four reads of `gather wide`: a cubic B-spline), people's lines (from `ids`), bloom (one read of the ¼), tone map, grade, edge smoothing (five taps of `main`, tone-mapped), grain, the stage's veil (`f.veil`, 2.10: black laid over all, display-encoded), dither |

The frame's end is engine 2's arithmetic, number for number (8.4): the look's `vignette` at 0.75 of what it
says, its `grain` at 0.1 (overlay; with `grainBlend: "normal"` the noise itself at that opacity), its `tintStrength`
at most 0.5 (each bounded to 0 … 1 first); the bloom's three levels
a third of its light each — as wide as engine 2's five (its halo round a lamp is the night look of the train and
of Сэвил-Роу), in five small passes instead of nine.
Why two main passes: a particle's `soft` (smoke and fog fading into what stands behind it — every smoke by
default, set in six scenes) reads the scene's depth; a pass may bind a depth texture it does not write, so the
blended part is a pass of its own over the same targets. On the reference laptop a pass boundary without a clear
costs nothing; on a tile GPU it is one more store and load of the frame (counted in 5.17). One way, always.
A frame with no mirror, static shadows standing: `shadow-movers` (only if a person moved), `main-solid`,
`main-blend`, 5 × `bloom` (three of them on targets of a 16th and a 64th of the frame's side), `canvas`.

### 4.5 The closed set of pipelines (asked by `lib.all(gpu, has)`)

Every pipeline that draws the world into the frame declares the same targets — `rg11b10ufloat`, `rgba8uint`
(written by people and solids, write mask 0 elsewhere), `depth32float` — in every world, with people or without:
one set serves `main-solid` and `main-blend`. **A mirror's pass has a set of its own** (`has.reflects` or
`has.glass`): its image has an alpha (4.3), so its pipelines declare `rgba16float` — the same modules, the names
with `:mirror` —: `solid`, `cut`, `edge`, `blend`, `multiply`, `sky`, the land's two, one `blend` an own text,
`glow`, and the people's four mains with the winding turned. No receiver variant among them — the land's two are
its plain ones there: in a mirror everything is lit at its vertices (a mirror's image is small and, where the
mirror is rough, smeared) — which is also the mirror's pass made cheaper. Their fragments write how much of the thing there is as alpha (5.7).
Quads: `solid`, `blend` — each plain and receiver —, `cut` and `edge` — each plain and receiver: a mixed sheet's
opaque pixels with depth (the others dropped), and its other pixels blended under the strict test `greater`
with no bias (5.17; their position is `@invariant`, so the two draws of one quad agree to the bit) —,
`multiply` (it reads no light: one, in every world — a
`multiply` layer is known only when paint code runs; it draws a `multiply` layer of whatever kind — a card's, a plane's, the sky's, an insert's with its iris: `sky` and `insert` draw the layers that do not multiply), `cast`, `mask`: one vertex layout (4.1); the receiver
variants and `cast` are asked when `has.casters`, and a quad is drawn by its receiver variant when its `recv` is
not 0 and the world has casters;
a FORM is drawn by `solid` and `cast` (a branch of the shared vertex stage, no pipeline of its own).
The blended ones have a depth bias toward the eye (`DEPTH.BIAS`, 4.7), write no depth and never write
`frag_depth`; they drop a fragment only where the painting's alpha is 0 (5.17). Own shaders: one `blend` (always with the receiver's arithmetic, so a text's pipeline does not depend on the
world it was first made for), its `own-cut` and `own-edge` (a quad that may lay depth — its plane's first, not
adding, multiplying, clipped or ruled, its layer wholly there — whose painting has opaque paint is
drawn as a mixed sheet: where its painting is opaque and stays so as its shader shades it, with depth (only there is
it shaded in the cut: what the shader paints over see-through paint is the edge's alone, shaded once), lit at its vertices as the
blend is; the rest blended under the strict test — its shader may paint where its painting has none, so it is never
wholly solid) and — with casters — one `cast` per distinct text (`has.own`). Land (`has.relief`):
solid, blended drapes (a draped plane casts nothing and cuts nothing: no land cast, no land mask). Sky and
inserts: 2, and the sky's base past its painting (`sky-base`, every world; `sky-base:mirror` of the mirror's set). Particles (`has.emitters`): draw, cast. Lights' glows: `glow`, in every world (a painted light is
known only when paint code runs). A beam's cone in the haze (`has.beams`: a light of the spec has a `cone` that is taken): `beam`, 1 (in `main-blend`, per pixel: 5.18). Mirror overlay (`has.reflects`, `has.glass`): 2, and the smear's two steps (`mirror-step`, `mirror-ready`: 2). People (`has.people`): 4 kinds
× 2 passes (`main`, `depth`), + 4 mains with the winding turned for mirrors (of the mirror's set), + `mark` and one
`own-mark` an own text (what blends laid again where it is opaque, into `ids` alone: 4.4 pass 9). The engine's own pictures: bake,
air, air-halo, air-sum, air-sky, blob, shadow-clear (a cell cleared before it is drawn again), bloom × 3 (the
bright part, down, up), gather, gather-wide, canvas (made at
`createRenderer`). A world with everything and a dozen own shaders is about a hundred and fifty
pipelines; one with land, people, casters and particles about forty, with a mirror about fifty-five. A pipeline a world needs and did not ask is an engine fault (thrown),
never a late compile.

### 4.6 What the device must give; rules of WGSL

- Core WebGPU (the default feature level; never `featureLevel: 'compatibility'`). Core gives, on every device with
  a core adapter: 8 storage buffers a stage in the vertex stage too, `firstInstance`, 4 bind groups, 16 sampled
  textures and samplers a stage, 2D textures of 8192, 256 array layers, 16 inter-stage variables, 8 colour targets.
- ONE feature beyond core, required: **`rg11b10ufloat-renderable`** — the main target at 4 bytes a pixel instead
  of 8, on the device whose limit is memory traffic (5.17). Seen in 100 % of Windows and 99.8 % of Android reports
  (study-webgpu-devices §2.2) and on the render machine (the probe). A device without it: `renderer: …`.
- `timestamp-query`: required for the stand's detail run; otherwise taken when the adapter has it — the pacer's
  measure of a frame's GPU time (5.1), never required. Nothing else optional; no compute; no storage textures.
- Limits: the core defaults; `requestDevice` asks for nothing higher.
- Rules every area's WGSL keeps: `dpdx` / `dpdy` only at the top of a fragment main; the sheets are read with
  `textureSampleLevel` (legal anywhere); no `select` where a side must not be evaluated; no `requires` / `enable`;
  no fragment shader writes `frag_depth`; `discard` only for a pixel that adds nothing its target can hold in the blended programs (a
  quad's alpha 0; a particle's and the mirror overlay's alpha and colour under the target's least step), in
  `cut` — a mixed sheet's pixel whose alpha (times its fade as the eye passes it close by) is under `SHEET.OPAQUE` is not opaque paint and lays no depth (5.17) —, and
  in the depth-only cast programs, where a painted outline can only be
  cut by a drop — `cast` and an own shader's below `CAST.ALPHA`; the particles' by a dither of their coverage (a
  half-thick puff stops half the light). The `mask` program drops nothing (it writes its alpha, blended `max`).

### 4.7 Constants

| Name | Value | Owner |
|---|---|---|
| `QUAD.CARD, FACING, PLANE, DRAPE, SKY, INSERT, FORM`; `QUAD.KIND` | 0 … 6 (bits 0–2 of `flags`); 7 (their mask) | SCENE |
| `FORM.SIDE`, `FORM.BLOCK`, `FORM.CELL` | 33 points a side; asked by blocks of 4 cells; detail: the coarsest stride at which a cell is under 12 px (5.23) | SCENE / SHEETS / RENDER |
| `PRESS.SIZE` | 48 CSS px: a ring's width (IN2) — `actions.js`'s `SPOT`, as it is | PAGE |
| `INSERTS.MOST` | 16 inserts a scene (WT5) | SCENE / RENDER |
| `PULSE.DEPTH`, `PULSE.RATE` | 0.35, 2.4 rad/s (IN3) | SCENE's chunk |
| `SHADOW.COARSER` | 8 quarter levels: a shadow view reads sheets two levels coarser (SH10) | RENDER |
| quad flags | `SHOWN 8, GLOWS 16, WIND 32, DRIFT 64, SHIMMER 128, FLICKER 256, WRAP_X 512, WRAP_Y 1024, FLIP 2048, INSIDE 4096, REFLECTED_ONLY 8192, REFLECTS 16384, GLASS 32768, CLIPPED 65536, PART 131072, WHOLE 262144, ADD 524288, MULTIPLY 1048576, READ 2097152, OFFERED 4194304, SELECTED 8388608, CUT_ONLY 16777216` | SCENE |
| `LIGHT.FAR, THROUGH, POINT, WINDOW`; flags `INSIDE 1, GLOW 2` | 0 … 3 | SCENE |
| `LIGHT.LIT`, `LIGHT.CELL`, `LIGHT.SMALL` | 256 lights in the lighting at once; 16 in one cell of the grid; a light whose reach is under 4 px of the frame lights nothing (5.5) | RENDER |
| `SHADOW.LIGHTS`, `SHADOW.KEYS`, `SHADOW.HOLD` | 4 casting at once; 2 read per pixel on opaque receivers; 1.5 | RENDER |
| `LIGHT.FAR_MOST`, `LIGHT.THROUGH_MOST`, `LIGHT.SPOT_MOST` | 8, 4, 2: the far lights, the through lights and the beams lit at once — the strongest far and through lights, the beams most worth to the view; a scene with more is told once (5.5) | RENDER |
| `CAST.ALPHA` | 0.5: below it a cast program drops the fragment (4.6; 5.5) | RENDER |
| `RECV.GROUND` | 1: bit 0 of a quad's `recv` — THE GROUND (WT2) | SCENE / RENDER |
| `PASS.FROM`, `PASS.TO` | 0.12 and 0.35 of the eye's height (0.204 m, 0.595 m): where a standing thing passed close by has faded out, and where it begins to (5.17); the camera's nearest and its rays' start go by the same two | SCENE / RENDER |
| `CLIP.SETS` | 4 cutter sets a scene, a channel of `masks` each (WT2) | SCENE / RENDER |
| `WIND.FAST` | 0.45: the fast part of a layer's bend — with the look's wind strength, the bound of the bend, in the posed layer's metres (SH10) | RENDER / SHEETS |
| `SHEET.PAGE, BORDER, UNIT, TOP, SLOT, SLOTS_SIDE, LAYER, MAX_PPM, WINDOW` | 256, 8, 68, 52, 272, 7, 1904, 2048, 7 (main's values) | SHEETS |
| `SHEET.OPAQUE` | 242 of 255 (a page is opaque when every pixel's alpha is at or above it) | SHEETS / RENDER |
| `DEPTH.BIAS`, `DEPTH.SLOPE` | `depthBias` 4, `depthBiasSlopeScale` 1, toward the eye (reversed depth: positive), on every blended pipeline — what main's polygon offset does | RENDER |
| `BIAS.MOST` | 16 quarter levels (four levels): the end of a view's bias (5.19); `FALL` 0.8: a view's pressure falls when its finer probe takes at most that share of the room — the hysteresis against a rise at more than all of it (5.19); `View.bias` and `View.sheetBias` are in quarter levels | SHEETS |
| `OWN.SHEETS`, `OWN.VALUES` | 10 (the painting and `layer(1…9)`), 32 | RENDER / LANGUAGE |
| `PARTICLES.MAX` | 65 536 | RENDER / LANGUAGE |
| `SHOTS_LIVE`, `MAKES_AHEAD` | 2 a maker (2.3), 2 | SCENE |
| `STEP`, `DT_MOST` | 1/60 s (an unseen step); 0.1 s (the most one seen step takes) | SCENE |
| `ORIGIN.STEP`, `ORIGIN.REACH` | 64 m, 96 m | SCENE |
| `PACE.PERIOD_LEAST, WINDOW, MISSES, LATE, JS, GPU, BEHIND` | 10 ms, 120, 6, 1.5, 0.8, 0.8, 3 (5.1; `MISSES`, `JS`, `GPU` are the run's to set) | SCENE |
| `LATE` (people) | 0.25 s (PP7) | PEOPLE |
| `WAITS_EVERY` | 15 | SCENE |
| `SETTLED` | 150 ms (PG2) | PAGE |
| `WAIT.SHOWN` | 0.25 s: a hold — or a story's wait on a shot (2.3 step 5) — shorter than this shows no wait sign (2.4) | PAGE |
| `WAIT.LEAST` | 0.5 s: a wait sign once shown stays at least this long (2.4) — the usual pattern of a progress sign that must not flash: a delay before it shows (`WAIT.SHOWN`) and a least time shown (Android's `ContentLoadingProgressBar` has the same two) | PAGE |
| `PASSES` (pass names) | 4.4 | RENDER |
| `VIEW.MIRROR` | 1 (bit 0 of `View.flags`, 4.1) | RENDER |
| `MIRROR.IMAGE`, `MIRROR.DENSITY`, `MIRROR.GLASS`, `MIRROR.OVER` | 512 px: a mirror's image's side at the most; 0.75: the most of the frame's own px it is drawn at — a rough one's 0.75 / (1 + 3 · rough), at least 0.25; 0.5: a pane's; 0.01 m: its near plane lies that far over the mirror (5.7) | RENDER |
| `LIT.CELL` | 96 px: a lit quad's cell is no larger in the view (5.12; the run's to set) | RENDER |
| `GLOW.PAINTED`, `GLOW.STEADY` | 0.6: a painted light's glow is that much of its strength; 0.9: a glow that does not flicker (5.5) | RENDER |
| message types | → `mount, size, in, call`; ← `mounted, reply, frame, state, action, event, say, unsay, waits, perf, lost, failed` | SCENE / PAGE |

**Where they live.** Every constant of this table that more than one engine area reads is exported, under the
name written here, by `engines/3/base.js` — SCENE writes that file from this table (the values here are final; "Owner"
says whose reason a value is, and who asks here to change it). `base.js` imports nothing. PAGE's three
are the page's own and are in no module of the thread: `PRESS.SIZE` is `actions.js`'s `SPOT` (and the ring's 48 px in
`scene.css`); `SETTLED`, `WAIT.SHOWN`, `WAIT.LEAST` are `engines/3/page.js`'s.

### 4.8 The level of a sheet (one formula: `sheets/ask.js` and chunk `sheets`)

`a = |dx|`, `b = |dy|` — level-0 px of the sheet per screen px along the screen's x and y; `T` — the taps of the
quad's kind (2 for PLANE and DRAPE, else 1):
`level = max(log2(min(a, b)), log2(max(a, b) / T)) + bias`, clamped to the sheet's levels (`bias`: the view's, 5.19).
The page read for it is that of level ⌊level + `SHEET.SOFT`⌋ (⅛: a pixel just under a whole level reads the level above
it, at most 2^⅛ ≈ 9 % magnified — not the finer one with four times the texels; 2026-10-15), and its half level
carries it on by what of the level is past that page's; the ask names those very levels (SH10). The shader draws the
finest page there is at or above that one.
With one tap that is the long axis's level (never under-sampled, soft at a low angle); with two, half a level
finer along the gaze. The ask takes `dx`, `dy` of a flat piece by differences of its points a small step apart, of
a curved quad's point by how the point moves along the sheet (kept with it: SH10) and the chain rule; the shader
by `dpdx`, `dpdy`.

### 4.9 The tier table (every number that depends on the device; `host` carries the row by these names)

| | computer, normal | computer, weak | phone, normal | phone, weak |
|---|---|---|---|---|
| who lands here (PG13) | a graphics card; Intel from `gen-12hp` / `xe-lpg` on (an Arc 140T laptop) | **the reference laptop**: Intel integrated graphics up to `gen-12lp`, AMD `gcn` | Adreno 7xx and later, Mali `gen-5`, Apple | **the ordinary four-year-old phone**: every Mali `valhall` (the Galaxy A53; the Pixel 7 too), older graphics, an unknown one |
| `host.budget` (px; E1) | 1920 × 1080 | 1600 × 900 | 1280 × 720 | 960 × 540 |
| `host.cache` (cache layers of 49 slots, ≈ 18 MB each) — by the counted pages, with their parents, and one layer for shadow views and mirrors (5.19) | 29 (≈ 524 MB) | 22 (≈ 398 MB) | 13 (≈ 235 MB) | 9 (≈ 163 MB) |
| `host.wholePages` = ⌈budget / 256²⌉ | 32 | 22 | 15 | 8 |
| `host.shadow` (the static atlas's side; the movers' is half) | 2048 | 2048 | 1024 | 1024 |
| `host.busy` (painters at work while a film plays) | 4 | 4 | 2 | 2 |
| `host.pages` (pages placed a tick — by every frame that is not whole; the run's to set) | 8 | 8 | 4 | 4 |
| `host.ahead` (s: how far on `f.toward` is asked along a known path — about what the tier's painters at work need for what a moving view brings in; half the painters on phones, twice the time) | 0.5 | 0.5 | 1 | 1 |
| one value on every tier: `host.painters` = clamp(cores − 3, 1, 4) threads, all of them at work in a held frame; `host.cells` (static shadow cells a frame) = 1; `host.land` (land nodes baked a frame by the land function, for each field — the frame's, and each shot's ahead; what a field takes of another field's tiles is not of this ration: RN4) = 1; `host.field` (land shadow-field points a frame) = 2048; a mirror's image: at most `MIRROR.IMAGE` px a side on every tier, drawn and asked only over the rect the mirror covers and its margin (5.7) | | | | |

All four columns are inside the promise; the two in bold are the devices the frame is accounted for (5.17, 5.21).
`host.busy` on phones (ruling 3-2.7): with four painters, the artist, the scene's thread, the page, the GPU
process and the compositor a phone has more runnable threads than fast cores, and heat with them — so while a
film plays two painters work (a moving camera's pages come at half the rate: 5.21); in a held frame nothing is
being played and all four work. Phones under the Galaxy A53's class (Mali-G57 MC2, Adreno 610) are the weak row
too and are outside the promise: an even 30 for anything above a light scene. Nothing else depends on the device.
`tier` and `phone` are read only to pick the row.

---

## 5. Decisions — each closed once

### 5.1 The pacer — ONE, in the loop (SCENE, `engines/3/play/pace.js`)

The standard governor of a frame rate (as Android's frame pacing library chooses its swap interval): step down on
what the display shows, come back on evidence — the CPU's and the GPU's cost of a frame, each apart —, with a
back-off. (Changed 2026-10-14, `proposal-perf-2.md`: the earlier rule came back on the callback-to-done time, the sum
of the two stages, which a pipelined frame never needs to fit, and counted two submits in flight as a lost frame —
on the T4 it held scenes that fit 60 at 30.)
```
P      the display's period: the LOWER QUARTILE of the intervals between consecutive display callbacks among the
       last 120 (not the median: a GPU slower than the rate makes the browser hold callbacks back, and when more than
       half are held the median takes the held rate for the display's)
n      the least whole number with n · P ≥ PACE.PERIOD_LEAST (10 ms)   60, 75, 90, 100 Hz → 1; 120, 144, 165 Hz → 2; 240 Hz → 3
k      1 or 2; 1 when a scene is shown
run    a callback runs when its number is divisible by n · k; the others return at once (2.1 step 4)
miss   (counted at k = 1) a run callback that came PACE.LATE (1.5) · n · P or more after the run before it (a frame
       lost), or that found gpu.flying ≥ PACE.BEHIND (3: the GPU three frames behind — a backstop)
down   k 1 → 2 when more than PACE.MISSES (6) of the last PACE.WINDOW (120) run callbacks were misses
js     (measured at k = 2) a drawn frame's thread time: from its callback's start to its hand-over after the submit
gpu    (measured at k = 2) a drawn frame's GPU time: with timestamps (the device has `timestamp-query`: 4.6), its
       passes' times summed; without, from its hand-over to its done — the GPU's work plus the done notice's delay
       (4–5 ms in Chromium on the T4, measured)
up     k 2 → 1 — a trial — when WINDOW · 2^fails run callbacks have passed at k = 2, at most MISSES of the last
       WINDOW drawn frames had js > PACE.JS (0.8) · n · P, and at most MISSES of the last WINDOW timed frames had
       gpu > PACE.GPU (0.8) · n · P by timestamps, or > n · P by the done
fails  0 when a scene is shown; + 1, with no cap, when a trial steps down again within WINDOW run
       callbacks; back to 0 when a trial has held for WINDOW
not counted: a `fresh` callback (after a mount, a pause, a job apart), the callback after a whole frame
       (a scene's first, a cut's — long by design), callbacks while the picture is held (their ticks are the
       painters', not the frame's)
```
`pace.run(ts, fresh) → boolean`; `pace.every → n · k`; the real clock is read only at k = 2 (and while the stand
measures): at a run callback's start, at its hand-over, at a frame's done. The GPU layer tells the pacer each
submit's done and each timed frame's GPU time through one listener set once (GP8); at k = 2 the frames' passes are
timed (`gpu.timeFrames`), at k = 1 they are not.
Why it can be read as correct:
1. **The two stages overlap.** The next callback's JS runs while the GPU draws the frame before (nothing waits on
   the GPU: 2.1), so a rate holds when each stage fits its step alone; their sum may be up to two steps. The up rule
   tests each against the step with a margin (0.8 by timestamps; the whole step by the done, whose delay is not the
   GPU's work).
2. **A healthy device is never held at the half rate.** Stepping down needs frames the viewer actually lost. Two
   submits in flight is the normal depth of a pipelined frame when the done notice comes late (measured: 9 of 15
   "misses" of the train's film were that); three is a GPU really behind.
3. **A device that cannot hold the rate goes down and stays.** A GPU slower than a step: the browser holds the
   callbacks back (the run callbacks come late: misses) or, if it does not, the submits pile up (three in flight:
   misses); the lower-quartile `P` keeps the held rate from passing for the display's. At k = 2 its GPU time is over
   the step, so no trial is made. A thread slower than a step: its callbacks are late; at k = 2 its js is over.
4. **One loaded second costs seconds, not the scene**: down within a window, a trial after 120 run callbacks at
   k = 2 (4 s); if the load is still there the trial fails and the next comes after 8, 16, 32 … s of the half rate.
5. **It settles** (ruling 3-2.6): a device on the border tries ever more rarely — the wait doubles without end while
   the scene is shown; never at a fixed period for ever. Never a rate between (T2).
6. `n` keeps a 120 or 144 Hz display from doubling the work; a 90 Hz display runs at 90 or 45 (section 7).
One mechanism with one rule (C2). No pacer in a render.

### 5.2 The tier: where the devices land, and what this piece does not verify

PG13 and 4.9. The reference laptop (Intel 9th generation, its own graphics) is the **weak computer**: 1600 × 900 —
the owner's number for weak computers; at 1920 × 1080 the same frame has no margin there (5.17). The ordinary
four-year-old phone is the **weak phone**, 960 × 540, and is inside the promise; so is every phone whose graphics
carries the same architecture name, the owner's Pixel 7 among them. The stand has three profiles — `desktop`
(normal computer), `laptop` (weak computer), `phone` (weak phone) — given to the page by the asker (PG13); a
render's pictures use the normal computer's row. Neither is ever guessed from the render machine.
**This piece never verifies the reference laptop or a phone.** Its pictures and its measuring are on the render
machine's T4 (8.3); a look on a newer laptop (an Arc 140T, about 8–10 times a UHD 630 by published
benchmarks) is in a browser, after the render machine's pictures are good; no probe on any other device is asked of anyone. What 5.17 and 5.21 say of the reference devices is arithmetic from published hardware
figures and a count over the scenes; an independent count agreed with it within 5–25 %; it stays arithmetic after
the run. For the reading of the run: in the `laptop` profile the heaviest scenes must show a GPU frame of about
1 ms on the Arc for half a tick on a UHD 630 to be believed. A 9th-generation laptop with one memory module has
half the traffic: ordinary scenes without a margin, the heavier ones at an even 30 (5.17). The owner is told (9b).

### 5.3 The first frame: what is awaited, and time

Awaited (2.2): the device; the world built; the pipelines (asked at once after the spec is compiled, so they
compile while paintings are made); then a whole first frame. At a scene's first opening in its thread the viewer
sees the page's wait sign meanwhile — not a blurred picture sharpening, not a film running under it, and never
black: the stage's veil is the page's to draw (2.10), not the opening's. Scene time does not run before the first
frame is drawn. A scene shown where another lives (2.9) is made beside that one, which plays on till the new one is
whole. "Whole" is the level the view needs, not more (ruling 2-C5). This is the plan's choice for his "хорошо и
некриво" (A9) and against the first flaw he named on dev (parts of a scene shown blurred), paid for with the
opening (A8): 5.21 accounts for that wait and holds the levers that shorten it; section 7 names it.

### 5.4 Cuts

The owner watched the present engine and named two flaws: parts of a scene shown blurred, and stalls at cuts. So
neither "shown at once and sharpening" nor "a freeze at every cut" is the ordinary case (ruling 3-1.2):
- **Every first frame of a new shot is whole** (rule 9) — nothing is ever shown blurred or half-made.
- **Whatever cut can be known ahead is made ready ahead; a cut to a ready shot is not held, unless the shot did
  not fit in the cache beside the view before it — then it is held briefly for its finer pages** (2.3, 5.19). Known
  ahead, and made ready in this piece (edits of 5.20): the film's next beat in a showcase (the worlds' module does
  it already); the next beat in a game — the game path of the same module makes ready the opening of the beat that
  follows in the film's order, or the one the game names; the train's lap. **Close-ups** need no edit and are not
  shots: a closed insert is asked ahead by the engine (RN4), with the room the views on screen leave, so it opens
  finished the moment its key leaves 0 — or, where that room was full, a few ticks later, when its pages are there —,
  nothing held, nothing blurred; while it covers the whole stage the world's pages are kept, so it closes onto a
  whole picture.
- **A cut nobody could know** (a game's jump to a beat it did not name, values computed at the last moment), or one
  made before its shot was ready, **makes the story wait, not the picture** (the owner's decision, 2026-10-22; 2.4):
  the cut is kept, a shot made for its values, and the director, the film and the voices stand while the picture
  before it lives on — wind, particles, people breathing —; the step its shot is ready the cut is made, then what
  the story asked meanwhile, and the new shot is drawn whole. No script is edited for it: what a script does after
  a cut waits behind the cut. How long: 5.21 — a tick or two when the framing's pages are already there; 0.4–2 s on
  the reference laptop and 0.4–3 s on the ordinary phone for a new framing — under the wait sign once it lasts.
  Against the old hold: the picture never freezes, the scene's people never stop breathing; the price — what the
  story reads while its cut waits is the state before the cut, and the world's time runs on past the story's
  (`director.time` is the world's less the waits).
- Time: the story's clock stands while a cut waits, and the scene's while a picture is held, so a beat's actions,
  checkpoints and the bar are the same played and sought. Not everything is: a script that polls `shot.ready` (21
  uses) sees it false for some ticks while playing and true at once on unseen steps — as on main; named in section 7.
- A cut where nothing is being played (a thread with no loop, the frames before a scene's first, an unseen step,
  `instant`): made at once; the frame that follows is whole.
- **Through black** — only where the game asks it (the stage's veil, 2.10): the veil drawn to black, the cut, the
  veil lifted once the cut's frame is there. A cut never needs black to hide work.
Changed against decisions R4 ("shown as soon as its coarse picture is there and refined").

### 5.5 Lights and shadows

**Lights — any number, no scene edit.** Every `lights` entry and every `e.light` is a row of WT4 (the train scene:
946; gavan 83–134; Берег 62). Each frame RENDER chooses the **lit set** — at most `LIGHT.LIT` (256): the far and
through lights that shine, then the others by worth to the view (strength × the share of the frame its reach
fills); a light whose reach covers less than `LIGHT.SMALL` (4 px) of the frame lights nothing that can be seen and
is never in the set. Only the lit set is in the `lights` buffer and the grid; the grid's 32 × 32 cells are laid
over the lit set's own bounds, a cell keeps the `LIGHT.CELL` (16) most worth at its middle. A window's light
reaches from its rectangle, not from its middle: where it is culled, bounded and put into the grid its reach is
its `reach` plus half its rectangle's diagonal. Its colour and strength (and a point light's with `daylight`)
are the outside's ambient now — the brightest channel of `ambient · ambientColor` and that colour over it: the sky
seen through it; the sun and the moon come into the room by the look's `inside` share or `through` their panes,
not again in the window's light (2026-10-28). Every light's glow
(its sprite, its halo in the haze) is drawn whether it lights or not — in the frame and in every mirror's image
(the glows' rows hold every glow seen by the frame's view or by a mirror's of this frame). **A glow is engine
2's**: a painted light's (`e.light`) sprite is `GLOW.PAINTED` (0.6) of its strength; a lamp's own `glow` is two
sprites — a halo `glow` metres in radius at 0.6 · min(1, strength) and a bright dot a quarter of that radius at
0.8 · min(1, strength) in the warm white `#fff5dc`; a glow flickers as its light does, and one that does not
flicker is steady at `GLOW.STEADY` (0.9 — the mean of engine 2's shimmer: a still scene stays still, 5.9).
**`translucent`** (a sail, leaves, paper): every light, far or near, adds to how such a quad is faced
`sheer · max(0, −(the way to the eye) · (the way to the light))` — lit from behind it glows its own colour that
much, as the language says (WT2 `sheer`; an emitter's `sheer` likewise for its particles) —, and its shadow is
that much lighter. So a town of lit windows a kilometre off is
hundreds of sprites and no lighting work, and comes into the lighting, window by window, as the eye nears — each
entering where its light covers 4 px. (Main keeps "the 256 most worth" too; what is new is that nothing is refused
and the small ones cost nothing.)

**A beam** (2026-10-27) is a point light with a `cone` — `bearing`, `height`, `width` (its full angle), `soft`;
placed as any point light (`across`/`distance`/`elevation`, `at`, `of`), its row `LIGHT.POINT` with WT4's `way`
(where it points) and `cone` (its cosines). It is turned only by keys, as a far light is moved: `place.bearing`,
`place.height` (degrees, any number of turns) — an endless turn is a script moving the key. On what it reaches its
term is a point light's × smoothstep(cos of its edge, cos where its edge begins, the way from the light · its way) ×
min(1, (0.1 · its reach / distance)²) — a beam thins with the square of the distance, its strength what it is at a
tenth of its reach — × e^(−distance / the haze's reach); what faces a way takes it by the plain cosine (no wrap: a
beam skimming the sea lights it thinly). An element casts no shadow in a light it carries — its own e.light, one
taken over with `of`, a person's lantern, a window's daylight: the light's node is its (a copy's: that copy's — the
next lamp post of a row shades this one's lamp) (`world.castsIn`).
In the lit set the beams that light the view — the `LIGHT.SPOT_MOST` (2) most worth to it, weighed as a lamp is
(strength × the share of the frame its light fills: the least sphere about its cone under 60° each side of its way,
else its reach); more lighting the view at once is told once — are rows after the far and through lights
(`e_frame.e_spotN`), read at every lit point, in no cell of the grid; a beam lighting nothing seen is not in it. For
the casting slots a beam is a lamp (class 1), worth what of its cone reaches the casters in view — a key light when
it is worth most; its maps are a point light's faces, of them only those its cone meets, so a turning beam draws a
face only as it first comes into the cone. Its glows — its own (`glow`) and a painted one it took over (`of`) — shine
toward the frame's eye as much as its cone does, at least 0.15 of it (on the CPU), and it has no halo: in the haze
(`hazeGlow`) its cone is drawn per pixel, `beam` (5.18). A turning beam stamps its row every step it turns: a mirror is drawn
again only when it shows that light — 5.7 —, a shadow cell is looked at again only when it is that light's.

**Which lights cast — the engine's choice, so scenes keep their shadows unedited.** At most `SHADOW.LIGHTS` (4)
at once, chosen each frame among the lights that shine: first those a caster's `shadow.light` names (22 uses),
then the far and through lights (in the spec's order), then the others — lamps, windows, beams — by worth to the casters in the frame's
view (a lamp's strength × the sum of its falloff at each caster seen, people among them; a beam's only at those its cone meets). A slot changes hands only when its light stops shining or leaves the view's casters, or another is worth
`SHADOW.HOLD` (1.5) times more — a ratio, no clock. **A slot that passed to another light casts nothing until
its cells have been drawn for that light** (by the ration; all at once in a whole frame) — never the old light's
map read under the new light. (On main a caster takes "the strongest three that light it";
this is that rule per scene instead of per caster. Rooms without a far light — sklep, Реформ-клуб — keep their
lamp and candle shadows.) `casts` is not added to the language.

**The maps.** Two atlases, `depth32float`, reversed, read through one comparison sampler (the hardware's 2 × 2):
`shadowStatic` (side `host.shadow`) and `shadowMovers` (half). Views: a far light — 2 cascades; a point light —
the faces its casters are in, up to 6; a window — 1. Cell sides as fractions of the atlas side by the light's
rank among the four: rank 0 — a cascade or window 1/2, a face 1/4; rank 1 — 1/4, 1/8; ranks 2–3 — 1/8, 1/16.
- **Static cells**: redrawn whole when the light moved, the placement changed, or a static caster in it changed
  (its node's or quad's stamp; its sheet's `sheets.stamp`). `host.cells` (1) a frame, nearest cascade first; a
  waiting cell keeps its content and the placement it was drawn with (late, never wrong). A cascade's placement is
  snapped (a quarter of its radius). In a whole frame every cell due is drawn.
- **Movers**: people; and a quad whose node or layer row was stamped, in a tick that was not a cut's, since the
  shot began — from then to the end of that shot (at a new shot everything is static again and every cell is
  redrawn anyway). No constant, no guess from frames. The movers' atlas is cleared and redrawn on a frame in which
  a mover changed. **A quad that only sways — wind, drift, shimmer, an own shader — is not a mover**: its shadow
  is drawn from its rest pose (the forest's 1117 swaying casters are drawn into a static cell once; nobody sees
  whether a crown's shadow sways). A standing scene redraws neither atlas. Every "changed since" here and in 5.7 is 3.4's test: `stamp ≥` the
  tick of the call that drew or looked.
- **Reading**: one function for vertices and fragments, two compare reads a casting light (static, movers). Opaque
  receivers read the first `SHADOW.KEYS` (2) casting lights per pixel — and work those two lights out per pixel
  (a lamp's pool on a floor is sharp); everything else, and everything that blends, at vertices.
- A card that faces the eye casts turned to its light, whatever the camera's turn.
- People ground by the `blob` map. The land's own shadow of the far lights is a baked field (by count), a field a
  view (4.2, group 1): the land, what is draped on it and everything lit that stands in the scene — quads and
  people, at their lit points — read it.
- **A caster that names a light (`shadow.light`) casts in that light's maps only**; one that names none casts in
  every casting light's. Which caster casts in which light is SCENE's `world.castsIn`, a person's `world.personCastsIn` (WT4).
- **People cast as their spec says**: a person with `"shadow": false` casts nothing; else their `shadow`'s
  `strength` (0.5 unless said), `light` and `onto` (the ground unless said) count as a quad caster's do. They are
  movers, drawn into a light's movers' map one by one (PP10's `id`). **One placement a view for both atlases**:
  the movers' cell is drawn with the placement its static cell was last drawn with, and drawn again when that
  placement, the slot's light or its rank changes.
- **Particles cast** when their emitter's `shadow` is above 0 (`smoke` and `puff` by default): into the movers' maps of
  the far lights that cast, their strength in their coverage (4.6), onto the ground. Such an emitter is a caster — for
  `has.casters` (RN2) and for the choice of the lights that cast.
- The land's baked shadow of a far light whose way changes stays readable until each tile is baked again (late, never
  wrong).
- At most `LIGHT.FAR_MOST` (8) far, `LIGHT.THROUGH_MOST` (4) through lights (the strongest) and `LIGHT.SPOT_MOST` (2)
  beams (those most worth to the view) are lit at once; a scene with more is told once.
- A cut's first frame draws every cell and mirror it needs at once (2.3 step 7): a long frame, by design.
- **A shadow view reads sheets two levels coarser** (`SHADOW.COARSER`): a shadow needs a sheet's shape, not its
  detail, and so its views ask a sixteenth of the pages (5.19). Paint thinner than a few texels (ropes, twigs)
  thins out at coarser levels and may cast a thinner shadow; if the run shows it, the cure is the cast
  pipeline's own lower alpha threshold — one constant (11.23).
Not in engine 3: `soft`, a light's `size` (the words are accepted without effect, LG5), coloured shadows, a third
cascade — on the list of what can come. (S1, E3, C8, C9, A3; ruling 2-A5, 2-A6.)

### 5.6 The artist; what a page costs

One worker per scene shown. It holds its own copy of the scene's code (kit, lib, modules, the land function — WT9),
a mirror of the state's keys, and runs an element's paint code on a `make` into display lists (SH6). A new scene
shown starts a new artist and ends the old one, so paint code that never returns cannot hold the next draft.
One artist, not a pool: the scenes' libs keep tables between paintings of a scene.
**A page's raster costs what lies in that page** (ruling 2-A10) — by construction, in the recorder:
- draws are found through a tree of their boxes (a page replays the draws that touch it, in order);
- a long path is kept in runs of 64 commands with a box each; in a page's replay a run whose box (grown by the
  stroke's width) does not meet the page is replaced by one line to its last point. For a fill this is exact: the
  run and its chord close a loop inside the run's box, so the winding of every point outside that box — the whole
  page — is unchanged. (The train's snow bank is one path of 16 000 points 128 km long; its `near` painting is
  280 000 path commands in small draws.)
- tops are rastered many to a job; painters draw in a CPU canvas (`willReadFrequently`), read it (`getImageData`),
  say from its alpha what the page is (a scan that stops once it is mixed) and send the bytes as read; the colour's
  conversion and the half level are the GPU's (`sheets/upload.js`: two short passes into the cell, after
  `queue.writeTexture` into a staging layer). Not `copyExternalImageToTexture`: its path from a 2D canvas is slow in
  Chrome on Windows and Android (an open issue since 2023; on 2026-10-15 an ImageBitmap of a painter's canvas stalled
  the GPU here for seconds), and bytes are the same on every device.
The land's height field is the artist's work too; the land function also runs on the scene's thread in counted
amounts (a land node's heights; people's floor).

### 5.7 Mirrors

A plane with `reflect: { strength, ripple?, rough?, fade? }` — `strength`, `rough`, `ripple` each a number or a state
key (0…1: the world's `el.mirror`, worked out as the key moves; RENDER takes the three each frame as it gathers the
mirrors — a `rough` moved draws its image again (its density, smear and margin), a `strength` or a `ripple` only
its overlay's uniform: a keyed ripple's margin is its most's, 1); a pane with `glass`:
- one image a mirroring plane (planes of one level, one `fade` and one `rough` share one): a texture of
  `MIRROR.IMAGE` px a side with an alpha, made when the mirror first comes into view; drawn and asked only over
  the rect the mirror covers, widened each way by what its overlay reads aside — 0.3 · `rough` + 0.05 · `ripple`
  (a keyed one: 1) of a frame's height, within the frame —, at a density of the frame's own px of `MIRROR.DENSITY` / (1 + 3 ·
  rough) (a pane `MIRROR.GLASS`), so that it fits the texture: a rough mirror needs a coarse image, and gets one.
  Drawn in ONE pass by the mirror's own pipelines (opaque paint, the sky, what blends, the lights' glows — 4.4,
  4.5; its `ids` and depth are discarded), everything lit at its vertices; particles are not drawn in it (their
  pipeline reads the scene's depth). Its near plane lies `MIRROR.OVER` over the mirror: what lies level with a
  mirror is not in it;
- **the image's alpha is how much of a mirror image there is**; the overlay lays `image.rgba · strength · paint`
  over the mirror's own painting — where nothing is mirrored the plane's own paint shows as painted, never
  darkened (the image is cleared to nothing);
- `fade` — a mirrored thing is THERE less with its height above the mirror: in the mirror pass's vertex stage the
  factor multiplies how much of the quad there is (its alpha: colour, coverage and an own shader's emission
  together), people's and the land's likewise. It is a fog toward the mirror's own paint: what is solid is drawn
  opaque as anywhere, writing its colour times that factor and the factor as the image's alpha, so the overlay
  shows the plane's paint through it by the rest — what stands behind it in the mirror, the sky too, stays hidden
  (a ceiling fades to the floor's paint, not to the sky). The fade is the elements' — the sky is all there, drawn
  after what is solid, where nothing stands, as in the frame. What blends is laid premultiplied by how much of it
  there is, over what the image has behind it (one alpha cannot be both its cover and its fog: a faded veil lets
  what is behind it in the mirror show). A faded thing never turns black;
- `rough` — made once on the image, not at every pixel of the frame: after a rough mirror's pass,
  `mirror-ready` smears the image along the way the plane's face goes across it — the arithmetic of engine 2's
  smear (nine taps over 0.6 · rough of a frame's height, weighted `exp(−60 u²)`, colour and alpha together; what
  shines brighter than white drawn out along the whole stretch: the path of light under a lamp, the sun, the
  moon) in two steps: the first averages the image over one tap's spacing of the second, so the second's taps
  read no gaps (the image has no levels) — and the overlay is ONE read of the ready image. A mirror without
  `rough`, and a pane, are read as drawn;
- `ripple` — the overlay's arithmetic; `blur` — accepted, no effect (LG5): softness by a mirrored thing's
  height would read the mirror's depth, which translucent paint does not write;
- **a pane of glass**: its painting is the overlay's mask and is never drawn (WT2); the overlay is added (it
  hides nothing behind the glass). **It shows where it is dark beyond the glass and light before it**: its
  strength is multiplied by `1 − min(1, ambient · mean(ambientColor) + Σ far lights' strength · mean(colour))` —
  the far lights through panes among them (beyond the glass they light as any far light), a far light from
  beyond the gaze counted at 0.3, as the lighting counts it — worked out each frame from the look and the far
  lights (by day hardly, at night as written). Its image holds the room alone: no sky, no
  land or draped plane, no other pane. A pane that faces the eye (a card with no `facing`) is mirrored about the
  plane it is drawn in — across the view's gaze, by the view's yaw —, not about its node's face;
- redrawn when its own view changed (always, that frame), else only when something in it changed (stamps — the rows', the look's, the
  panes', those of the lights it shows: of the lit set, a far or through light, or one whose light's sphere its view sees; a glow seen in it —, a person's version, a sheet's stamp) or moves by itself — RN4's test of the frame, made of the mirror's own list: wind, drift, shimmer, flicker, an own shader that reads the time, a quad offered; a light it shows that flickers —, one a frame, longest waiting first; an overlay's uniform is written again when its image was drawn again, the origin stepped, or — a pane's — the look or a far light changed;
- `seen: "reflection"` stays.
Changed after the first pictures (the choice of four taps at every pixel of a half-frame image, and of a `fade`
that dims): every mirror of the five scenes is rough or a pane, and it showed four stacked copies, floors
darkened where nothing was mirrored, black panes and people mirrored at noon.
Checked in the scenes: 24 mirrors in 14 scenes (`strength` 24, `rough` 20, `ripple` 12, `fade` above 0 in 7); 7
panes; `seen` once. Not taken (v2-fresh-design B10): rough mirrors reflecting only the sky and the glows — the
seas with `rough` 0.5 carry the ship's reflection.

### 5.8 People

- **A silhouette's colours coming through with the light stay** (PP9's formula is main's): the Asher world's five
  characters wear the engine's `shadow` style (`paint: 'rim'`; Madeline overrides it with `lit`). The paints
  `silhouette`, `rim` and the colour paints keep their names and their three results under light.
- **Bodies are not built** (no cast has one — 76 characters, all figures of shapes): the four kinds of PP9. A
  figure's face (its solids, morphs between expressions) and the rounded face of a faceted head stay.
- Cloth (S5, E22): bone chains from pinned anchors, a few controls, one or two steps a shown frame, at rest after
  any unseen stretch. **A garment hangs as the pose has it, not as it was made on the pelvis**: the goal of a
  chain is where it hangs in this pose — where a thigh lies under its way down (sitting, a knee drawn up) the
  chain goes over it: from where it hangs along the thigh's top to the knee, then down, each link as long as it
  was made (engine 2's lap); a section is as wide as the legs in it need (a stride does not notch a hem); a
  control is kept out of a leg on its chain's own outer side — up, for a thigh that lies —, never to the nearest
  surface. "At rest" is that shape: a still shows a seated figure's skirt over the thighs and falling from the
  knees. PEOPLE samples a garment's controls so that a person's total fits its 64 (the spacing
  widens): there is no over-the-cap case. `F.cloth` (a sheet of cloth held along its top rows) is built on the same strips: the engine's own garment
  `apron` draws with it, and a character of «Алые паруса» wears that.
- PEOPLE's spec may not remove anything a viewer sees of a figure's readability without naming it in section 7's
  list with the boundary applied (A14); the coordinator decides each such line before writing.

### 5.9 What may block an idle frame

May (the frame is drawn): RN4's list — anything that changes the picture, a light's flicker among them. May not:
asks, a `people.show` that changed nothing, pages placed for a view ahead or a standing shadow view, the stand, a
`frame` message, the pacer. Writes of an unchanged value do not stamp (WT), so animates that set the same numbers
every frame do not keep a still scene drawing.

### 5.10 The showcase's bar (A16)

No rehearsal (R3). The length is exact (`known`) once the showcase has ended once in this page. Until then ONE
formula: with `m` = the mean length of the beats that have ended — or, while none has, the time the first beat has
run so far —, `length = time reached + max(m − the current beat's time so far, 0) + (beats not begun) · m`. The
page shows `≈` before an estimated length and never moves the knob backwards while the film plays on. So during
the first beat the total grows as the beat runs; from the second beat on it is the beats' mean. At the film's
first instant the length is 0: the page shows no total and no knob until it is above 0. A checkpoint is
kept as each beat begins; a seek back restores one; a seek ahead of what was played plays unseen to the place
(2.5). No `about` on a beat (237 edits for a number an agent would guess; if the run shows the bar poor, it
can come then).

### 5.11 Offline checks (D5; W8)

By W8: one check of the whole set after everything is written; its findings fixed in one batch; then once more.
Never shader by shader. No step between areas depends on it.
- Every module parsed as an ES module — each file's text given to `node --input-type=module --check` (`node --check
  <file>` passes a broken `.js` that has no `package.json` above it) — GPU's runner too (`test/gpu`: its `package.json`
  names it and the node it needs).
- **The GPU programs, all at once**: `test/gpu/check.mjs` imports the engine's modules in node (BD4), makes a
  device through Dawn's node package on its GPU-less backend (GP1 with `device`), and, listening to the device's uncaptured errors (an error scope keeps only its first):
  assembles every WGSL module; registers every layout; calls `lib.all(gpu, has)` for a `has` that has everything,
  with every own shader of «Вокруг света v3» after conversion — given as the scenes' folders: each text from
  `elements/<id>.wgsl` with the uniform names its element has in `scene.json` (RS5), never names guessed from the
  text —; calls **`lib.exercise(gpu)`** (RN2;
  PP10's `exercisePeople` inside it), which encodes one frame of every pass of 4.4 with small targets and
  buffers, every pipeline bound and drawn once, and submits it (the GPU-less backend executes nothing; Dawn
  validates everything: bind groups against layouts, a texture bound and written in one pass, a pass's targets
  against its pipelines', vertex buffers, sizes). The check's device asks for exactly the features GP1 asks for
  (the GPU-less adapter offers every feature; asked for all, it would hide a layout that needs one). Every error is printed in one list: the check ends only
  when no pipeline is pending and every module's report is in (`gpu.reported()`), and its last line says how many own texts it
  compiled (given none, it says so — not "everything compiled"); it prints the own texts numbered as `has.own` has them, so `lib.all`'s `own shader <k>` (RN2) names one. `lib.exercise` runs after `lib.all` with every
  `has`, so every pipeline it draws exists. It is Chrome's own
  WGSL compiler and Dawn's own validation; no picture, no scene, no browser.
- Settled by reading (v3-webgpu §3): the npm package `webgpu` (0.6.2) ships Dawn's GPU-less (Null) backend in
  every prebuilt binary; it validates WGSL, layouts, pipelines, encoding and submit by the code Chrome's GPU
  process runs; it makes no HLSL or SPIR-V and calls no platform compiler.
- So what it cannot show: a driver's faults; the platform's shader compiler (first met at the run); that the
  picture is right. Where it runs is the coordinator's (9a-9); nothing is asked of the owner's machines.

### 5.12 The content guidance: not a gate

W7: no merge hook, no refusal, no `count` tool. Two things: the numbers below in the authors' docs, each with its
reason; and the stand (`measure_scene`), whose `take` reports the same things measured (`R.counters`: draws,
triangles, lit points, blended quads, pixels; `sheets.stats()`) — an agent runs it when it sees fit. The stand
judges what follows from one row of the guidance — the pages a view names and brings into view (ST3: the soft run,
by the cache and by motion, the pages placed again, the late close-ups) — because a view over the room or faster
than the painters cannot be shown at its sharpness; a failed stand still refuses nothing.

How many points a quad is drawn with (RENDER; "the fewest that its light needs", S6) — **by what it covers of
the view, not by its metres** (the first stand: 57–218 thousand lit points a frame where 5–20 thousand were
counted on, and 2–4 ms of the GPU's frame that did not depend on its pixels): `FLAT` 4 — nothing varies across
it; `COLUMN` 34 — wind; with something varying across it (a lamp, a window light, a through-light's panes, the
land's shadow, the haze — only across a quad larger than its reach / 64, the main target's dither step —, the
air, people's blob near) the coarsest of 1, 4, 8, 16 and 32 cells a side at which a cell is under `LIT.CELL` px
of the view (a flat quad: of what its placed corners span there; a form: its sphere's width, 5.23). A flat quad
— a card, one that faces the eye, a plane — wholly in view has that grid over its own rect. **A flat quad that
the view's sides cut — a floor the eye stands on, a sea, a plain, a long wall — is drawn by the SCREEN shape**:
the same even grids, laid over the PIECE of the quad the view sees — its placed corners cut by the view's sides
on the thread, a polygon of three to nine corners. The piece is drawn as a fan of four-cornered parts from its
first corner (one to four; an odd corner left over is a part whose last two corners are one), a row of the
order each (4.1), all with one grid: a part's points lie between its four corners as the view sees them, so its
cells are even on the screen whatever the plane's size, every point is a point of the quad itself — nothing is
moved onto an edge, nothing lies over a horizon —, the parts cover the piece and nothing else, and two parts
have the very same points along the side they share. (The first SCREEN shape laid one grid over the piece's
bounds in the view and held a point past the quad's edge at the edge: a wedge of the quad along the view's
side was covered by no triangle — up to 4 % of what was seen of it.) The piece is cut an eighth of the view
wider than the view each side, and from half the near plane's distance — the GPU cuts the rest: a point's
place is only as exact as a float carries the quad's rect (millimetres on a sea 130 km wide), and no gap may
open at the frame's edge. Its points are metres from its origin page (the page under the eye's foot, for a
sheet too wide for a float), small numbers near the eye. A quad the wind bends is a `COLUMN` wherever it is.
Lists that read no light (a light's view, the masks), and a cut quad nothing varies across, draw the SCREEN
shape with 4 cells a side. All are index ranges of one buffer (4.1); a form's four strides are the 4, 8, 16
and 32. There is no grid that follows the eye.

| Guidance | About | Why |
|---|---|---|
| screens of painting that blend over one another in a view (mist cards, smoke, sky layers, soft edges) | 2.5, of which a part is empty and dropped; the frame is accounted for up to 6 with half of it empty (5.17) | the largest cost of a frame; opaque paint hides what is behind it, translucent paint does not |
| quads in the world | 3000 | the cull is per quad on the thread |
| lit points drawn | 120 000 | each works out its lights |
| paintings | 150 | each is painted by the one artist before the scene opens; what repeats is `copies` of about twenty kinds |
| pages one view names as its own (the coarser level kept under each counted in) | about half the camera view's room — 680 at 1920 × 1080, 510 at 1600 × 900, 190 at 960 × 540 — where a shot is made ready beside the view (every view of a film); a view nothing is made ready beside, up to 0.8 of it — about 1090, 815, 305, about one and a half times as much (5.19: within it the view is sharp). A close-up counts in the view it opens over. The stand tells the count and fails the softness and the late close-ups it brings (ST3). A painting that fills the screen costs about a screen's area of pages (32, 22, 8 at those sizes), up to four times that by the fineness it is read at; paintings stacked over one another each cost it again, also where a nearer one hides them | beyond half, a shot made ready beside the view is held at its cut for its finer pages; beyond the room, the view itself is honestly softer — never held, a hold would never end — and the stand fails the scene |
| canvas calls in one painting | a few thousand | its pages are rastered at the opening and at a cut |
| shadow casters | 300 quads | drawn again per casting light's view that changed |
| lights reaching one place | 16 | the grid's cell |
| through-lights | 2 | each rasters its panes and is read at every lit point it reaches |
| mirrors in view at once | 2 planes and the panes of one wall | each redraws the scene, small, whenever the camera moves |
| people | 24 declared; 12 here at once | a pose each; bones and cloth for the shown |
| particles | 65 536 alive (the engine's cap); sprites larger than 2 m: a few tens | large soft sprites are screens of blended paint |
| own shader texts | 12 | each is pipelines at the build |
| forms in view | 40 | each is 1089 points in every view it is in — the frame, a mirror, a shadow cell (the grid is the engine's: no form costs more than another) |
| sheets read whole in view at once | 6 | each holds up to `host.wholePages` pages |
| repaint while playing | none | a painting that reads a smoothly moving key repaints as it moves: move a layer in `animate` |
The scenes as they are: several are over a row (5.20 says which of «Вокруг света v3») — they are not edited for
it; the stand will say where a row matters. Changed against decisions L2 and S13's merge gate.

### 5.13 Engines 1 and 2 — untouched

No file of engine 1 or engine 2 changes: engine 2 (gone) whole; engine 1's files in `engines/1/`
(`thread.js`, `engine.js`, `world.js`, `kit.js`, `figure.js`, `shapes.js`, `people.js`, `motion.js`, `three.js`, …);
both builds in an rpg dev tool; engine 1's `2d` flag and its glow canvases; the two languages' texts
(the old artist's prompt, `artist2.md`). `stage.js` stays one classic script loaded by the twelve pages as today; its
handling of engines 1 and 2 is not touched (one event a message; `change` / `move` / `save` messages; engine 2's
points projected by the page; their own `prepare(values, seconds)`; the wait sign after a second); engine 3 is a
third branch there that hands over to `engines/3/page.js` (1.6 row 1). A page that shows only old scenes never asks
for WebGPU or for the tier and loads nothing of engine 3: an old world opens on any browser it opens on today,
as it does today. The wider pause (scrolled away, covered) and what it stops — voices, music — is an engine-3
scene's only (2.6). The pictures of engines 1 and 2 and the motions' sheets are drawn as today. **The
page's styles over a scene** (S10: nothing blurred or animated for ever over it) hold while the scene shown is
engine 3's: `page.js` marks the stage's place while an engine-3 scene is shown there and takes the mark off when
the stage goes to another engine, and the rules of S10 are keyed on that mark — over an old scene the page
looks as it does today; the mark is `data-moood-engine="3"` on the stage's place and the rules are keyed on its parent, so a page with
two stages (the comparing page) styles each side by its own engine; that page's own layers over both sides (`#crumbs`,
`#volume`, `#compare`) are keyed on `body:has([data-moood-engine="3"])`. Nothing reaches old worlds, their games or their plays.

### 5.14 The Android app — out of this piece

The owner's answer: the app is not worked on now. No file of the Android app and none of the app's pages
(the old site's pages), routes or doors is owned or
edited by any area. The app shows a scene in a WebView, where WebGPU is not on: an engine-3 scene there shows
"this device cannot show the scene"; old worlds open in it as before. Section 7 says so in one line. (Decision W5
— scenes in real Chrome inside the app — waits with it.)

### 5.15 Kept or changed against `decisions.md` — the list

| decisions.md | Now | Why |
|---|---|---|
| K1 three.js r186 as the GL layer, patches | engine 3 has no three.js; our GPU layer; a 3 × 4 module of ours and a few 4 × 4 forms. Engine 2 keeps its patched three.js | W1; study-webgpu §3 |
| K4 `instant` as it is | kept, and named: it moves no time | C42 |
| K5 base branch `engine2-cheap-light` | the design is the base; code is taken where it fits (8.4) | W6 |
| K6 engine 1 untouched; the Android WebView path working | engines 1 and 2 untouched (no hunk but the third choice at the seams of 1.6); the app is out of this piece and shows no engine-3 scene for now (5.14) | the owner's decision: beside |
| R1 draft `vt.ask(camera, weight, width, height[, yaw])` | `sheets.ask(view)` with RENDER's cull | C6, C14 |
| R3 "used by … a game's jump" | play, a seek, a render's moment, a draft resumed; a game's jump is `instant` | C42 |
| R4 shown when coarse, refined after | every first frame of a shot is whole; every cut that can be known is made ready; one not ready makes the story wait while the picture lives (2.4, the owner, 2026-10-22) | A9; ruling 3-1.2; 5.4 |
| R5 showcase prepares each beat's cut itself | the worlds' film module does (it exists; its game path is edited to do the same: 5.20); the engine gives shots by events | checked in the scenes |
| R6 the pacer's measure is the interval between ticks | late callbacks to step down; measured cost to try coming back | 5.1 |
| S1 three `DepthTexture`; one atlas | two depth atlases; the engine chooses which lights cast | 5.5 |
| S4 low mist "if LANGUAGE asks" | not built | ruling 2-C2 |
| S5 cloth "deterministic by the scene's clock" | by the frames it was shown in; at rest after any unseen stretch | C20 |
| S6 "two or three shapes"; "≤ 10 target binds" | four shapes and the far grid, one buffer; 3 full-size passes (`main-solid`, `main-blend`, `canvas`) | 5.12, 4.4; ruling 3-2.4 |
| S8 cap "RENDER proposes" | 10 sheets (the scenes' most is 10) | ruling 2-C4 |
| S9 mirrors "plain" | `ripple`, `rough`, `fade` stay; `blur` without effect | 5.7 |
| S10 bounded indicators may animate | kept as decisions say (PAGE's spec decides each indicator by it) | — |
| S11 one built, minified bundle | loose modules as today; no library | ruling 2-D1 |
| S12 one path of the engine | kept: engine 3 has one path; its pictures only on the machine with a graphics card; those of engines 1 and 2 as they are | W2; the owner's answer |
| S13 the stand; a merge gate | the stand a tool; no gate | W7 |
| S14 motions made ready at the cast's build | kept | — |
| S15 engine 3's kit a module | kept (`world/kit.js`) | — |
| §4 "renders are on a GPU" | kept for engine 3 | W2 |
| §5 tier from cores and memory | from the adapter's names alone | rulings 2-A4, 3-2.5 |
| L1 additions | `copies` and forms | rulings 2-C2, 2-C3; the owner's decisions |
| W5 scenes in real Chrome inside the app | waits: the app is out of this piece | the owner's answer |
| L2 budgets checked at merge | guidance; the stand measures | W7 |
| L4 one source of the docs | kept | B14 |
| §7 what may be run | 5.11 | W8 |
| §8 five areas | eight (section 8) | — |
| W1 "particles worked out by the GPU" | by the GPU's vertex stage, as closed forms — no compute pass | ruling 2-A7 |
| W1, W2 "the engine moves to WebGPU"; the software render path "thrown away" | engine 3 is WebGPU only and has no software path; engine 2 keeps WebGL 2 and its CPU pictures, as it is | the owner's decision: beside |
| W4 scenes edited where the new engine forces it or frames are saved | one world, as a copy: «Вокруг света v3» (5.20); the 20 scenes of the «-v2» worlds stay on engine 2 | the owner's decision: beside |
| W6 no backward compatibility with engine 2 | engine 3 owes engine 2 none — and engine 2 stays whole beside it, so nothing made for it stops working | the owner's decision: beside |
| C18 two engines live side by side | three: each scene on the engine its spec says; no engine stands in for another | the owner's decision: beside |

### 5.16 Animates, and smaller points

- **Animates are cheap in the engine, not edited in scenes** (ruling 2-C3; 276 in the 20 scenes, 0–250 µs a frame a
  scene measured in node). A write of the value already there does nothing after the comparison (WT) — an animate
  that sets the same numbers every frame costs nothing downstream and does not keep a still scene drawing. An
  animate does not run while its element's node is not shown (a closed insert, a person not here). Nothing else is
  skipped: animates keep memory and add up time (`e.mem` in 11 scenes, `e.dt` in 8), so skipping one while its
  element is out of view would change what it shows when it comes back, and make a played moment differ from a
  sought one — to save a quarter of a millisecond at the most.
- **Scripts' garbage**: the engine allocates nothing in a tick — no array, object, closure, string or iterator
  made per tick, per pass, per row or per page in its own code: lists, records, descriptors and handlers are made
  once and reused; a pipeline, a group, a painter's job are found by a number, never by a string built for the
  lookup; a message is posted from the list it was gathered in. A number is made too: one worked out and handed to
  a function, handed back by one, or read from a record's field where records of several shapes pass is put on the
  heap each time — so in what a tick runs numbers stay in arrays made once (typed ones) and its functions take
  arrays and whole numbers (the ask: SH10; `place`: WT7; PEOPLE's players, cloth and figures: `where`, `TJ`,
  `NUM`); and a function called each tick has no function of its own inside that shares its arguments (those are
  put on the heap at every call: the making is a function beside it); and what many objects of one kind are asked
  is ONE function that takes the object, not a function made with each (a view's `sees`, `ahead`, `clip`: made anew
  with each of thirty views they are thirty functions at one place of call, none is worked into its caller, and
  each fraction handed back is made on the heap). This holds for code the browser has compiled
  for speed: what first runs — a branch a new state brings (someone first sits: `cloth.js` `lap`) — is worked out
  slowly for some hundred calls, and makes numbers meanwhile. A scene mostly plays once, so that first play is what a
  viewer gets, and most of its garbage is made before the code is optimised or after it was thrown back: Chromium's
  first optimising compiler (Maglev, which runs a once-a-frame function for the scene's first minute or so) makes on
  the heap a number a loop carries and changes now and then (a bound widened by `Math.min`/`max` or an `if`) and one
  that two ways of a branch leave (`c ? a : b` of fractions) — those go in arrays too (people's bounds, cloth's lap,
  `frameOf`, a quad's sphere and its piece's bounds, the lit set's grid); a way first taken late is worked out beside
  the common one and one of them taken, where that is cheap (a straight leg, a motion done once), or one way serves
both (a motion's frame mixed into what is held at every weight, a whole frame among them: `frameOf` — the first
crossfade comes at a loop's seam, seconds in); a long loop is a
  function apart from the code after it (it is compiled while it runs — the code after it, never yet run, would throw
  the function back at its first run: a page's edges, a motion's making); and the records one place reads are of one
  shape (every Camera by `render/views.js` `newCamera`, a cull's options, a mirror's group and image) — records of two
  shapes passing one place have their fractions made on the heap where they are read, in every compiler. What is still
  thrown back the first time a state comes (a hand first held, a thigh first lying, a shot's first hidden node) is
  left: the code it would take to pre-empt each is not worth its once. What WebGPU itself hands out a frame (the
  encoder, its passes, the canvas's view, a submit's promise) is the platform's. What a scene's own code
  allocates (one close-up module makes about 0.8 MB a frame on main) the engine cannot close. The stand reports
  the two apart (ST3: a heap profile of the scene's thread by script) — the engine's part judged, the scene's
  the scene's to mend when the owner asks.
- **Cloth and a render**: a render's moment is always cloth at rest in the pose; the settle waits for
  `people.building()`.
- **Reversed depth**: always; one projection (RN5); the near plane fixed at 0.1 m.
- **Inserts**: an insert is a painted picture laid flat over the frame, not in the world; the world's light does
  not reach it and it carries its own painted light (15 inserts in 10 scenes do). A second kind by decision (C2).
- **A camera key set near a cut** belongs to the cut only in the same tick. **Set at once anywhere else it is a new
  shot of its own** — the camera is there at once: a `camera_*` number or `camera_on`, or a framing key
  (`camera_target`, `camera_shot`, `camera_frame`) while `camera_glide` is 0 —, and its first frame is whole as any new
  shot's (rule 9: a framing jumped to is never shown half-made). It is the language's rule as engine 2 has it; there a
  new view cost nothing, here it is a whole frame — every static shadow cell and mirror again, a hold while a page lacks.
  So what the camera follows frame after frame MOVES its key over time (an action, a path) and never sets it each
  tick: a set a tick is a shot a tick (the language's text says so; section 7 item 32a; 5.20 edits the one script of
  the converted world that did). **The wheel's aim**: kept while the
  pointer stays within 6 px and 0.4 s by the callbacks' timestamps (main's numbers). **The wheel's walk** (and a
  pinch's), every mode that walks — a panorama too: each notch a share of the way to the point under the pointer,
  along the line from it through the eye, the gaze re-aimed so the point stays under the pointer; it stops where the
  element about fills the frame (1.15 × its height away) — unless the element already fills it from where the walk
  starts (as tall as it is far, or taller: a wall, a board), when it is walked up to —, never nearer than 1.1 × the
  eye's height, nor than where the gaze, as far up as it goes, still holds the point. Back, a notch walks as far as one
  may stand (a panorama and a walk: the start). A notch that walks nowhere — at the stop, or at the back stepping back
  — changes nothing: no step aside, no re-aim (`engines/3/play/camera.js` `pick`, `walkToward`).
- **The eye's height**: the viewer's eye stays the camera's height over what is under it — the land, a plane that
  says `water` lying over it (a sea, a lake: the eye never goes under the water), a `walk` plane over those (a deck, a
  bridge, as people stand on it) — `world.standAt`; the start's land or water (`world.surfaceAt(0, 0)`) is its level
  0. The operator stands as high over the land or the water under it as its target is over the land or the water
  under the target (a deck, a boat, an elephant's back: level with it), and over what is under it at least
  (`eyeFor`). Its pose holds that height over the level 0, not over what is under it: its glide goes straight in
  height as in place — from the quay onto a bridge's road it passes level over the river, never down to the water
  and up the road's edge — and is never under the land or the water where it is (`filmed`: what is under it there is
  taken off, the step adds back what is under the eye where it ends up — camera_x, camera_z aside still go over the
  ground). The engine does not guess water from `reflect` (a polished floor, a table top reflect too); the author
  marks it (`engines/3/play/camera.js` `floor`, `surface`, `raised`, `eyeFor`).
- **The operator's bearing** (looking round): a person is filmed from before their face — the ways round
  (`clearView`) are tried from the bearing their face looks along (their root's +z now; posed by a shot's values, the
  facing PEOPLE gives with their root: PP5 `pointFor`), a thing's from the viewer's bearing; the first clear one,
  nearest that, within the area; none in the area — the viewer's bearing. The lines of sight start where the eye will
  be at each spot (`eyeFor` there: over water, over a deck). A spot whose eye is in a person's body — any one here,
  the target too: within their capsules (PEOPLE's, as they stand now) or as near as the near plane (`inBody`) — is
  no way round: its lines of sight, cast from 0.2 m out, would not see that. Ahead (walk, panorama, picture) it has no bearings: it
  films from the viewer's side, as the language says — a face turned from the start is its back.
- **Safari, iPhones**: nothing of ours shuts them out; whether Safari's WebGPU in a worker carries the engine is
  unchecked and not promised.
- **Games**: none plays on «Вокруг света v3», and none is moved to engine 3 in this piece; the games on the
  «-v2» worlds keep playing on engine 2. What a game reads of its scenes is the measure of what an edit of a
  world carried over must keep (5.20) — checked on the Asher game's `env/dev`: the key `beat`, the tells
  `beat:<name>` and `shot:face`, the points `narrator#hand_r`, `roderick#hand_l`, `roderick#hand_r`,
  `closeup#screw<i>`, `closeup#rod_hand`, `closeup#mad_hand`, `clock#dial`, `portrait#face`, `window#glass`, the
  elements `crack` (41 heights up it), `ripple`, `candles`; it waits for the keys `closeup`, `closeup_speak`,
  `touch`, `mirror`, `madeline_still`, `horse_toss`, `fall`, `door` and the tells `stay:talk`, `portrait:before`;
  and it sets some forty keys.
- **Versions of one scene on different engines**: every version of a scene says its engine, and each is run by
  the engine it names. The first versions of «Вокруг света v3» are engine 2's (5.20) and stay so: they open on
  engine 2, a play keeps the commits of the world it began on (the studio) and runs
  them as they were, and the comparing page shows two versions on two engines side by side (two stages on one
  page, each with its own thread and canvas — as it does today for engines 1 and 2).
- **Imitated curves in today's scenes** (LG14; read in the sources). One: «Мэдлин проходит» — each of its 17
  arches has 4 + 4 flat tilted strips standing for the curved underside (136 of the scene's 187 elements). It
  stays as made (the coordinator's decision); with forms it could be 17 bends, and no edit is planned. The horse
  of Ашеры «Подъезд к дому» is one flat card of 133 layers with a projection of its own. The assemblies once
  listed as undecided — «Диканька»'s church and well, dzhungli's temple tower, «Полёт»'s windmill — are square
  assemblies of flat faces (a square drum, a four-sided cupola), not imitations: struck.
- **Two graphics cards in one laptop**: `requestAdapter()` without options — the browser's choice; the tier is
  that adapter's.

### 5.17 Opaque paint, transparent pixels, and what a frame costs

**The rule (rulings 2-A1, 3-2.1, 3-2.2).** A painter reports each page as *opaque* (every pixel's alpha ≥
`SHEET.OPAQUE`), *empty* or *mixed* — it has the bytes in hand; SHEETS keeps `sheets.solid(handle)` (SH13).
- **Solid** (`main-solid`; first in a mirror's pass) — a quad whose sheet is wholly opaque, that has no layer
  alpha below 1, no blend mode, no own shader, no order rule (`behind` / `inFront` — its own, or another's that names it), and under which nothing at
  its own depth is drawn blended: once, near to far (at one depth the topmost first), depth test `greater`, depth
  written, no blend. Walls, floors, ground, seas, a sky's base, house faces without holes, a close-up's base; the
  land, people and forms (5.23) likewise. **Of an element's wholly opaque layers lying in one plane only the
  lowest is solid**; those above it are drawn blended (with their depth bias) — nothing promises two triangles of
  one plane equal depths to the bit, and opaque paint blended over is the same picture. RENDER knows "one
  plane" only inside an element: wholly opaque quads of DIFFERENT elements in one plane are the author's to
  order (`inFront` / `behind`, which make a quad blended — and the element it names too: a blended quad's bias toward the eye would put it in front of a solid one of its plane) or to set apart, as on main. Then the sky, tested against that depth: only where nothing covers it.
- **Mixed sheets lay the depth of their opaque paint** (changed after the first pictures: with nothing but
  wholly opaque sheets laying depth, a flight of steps was painted over by the house front behind it, an open
  door by its own wall, and plants behind a locomotive stood before it — one key a quad cannot order sheets that
  cross or stand in one another's depth, and nearly every sheet has a hole or a soft edge). A quad that would be
  solid but for its sheet — the sheet is *mixed* (`sheets.solid` 1: opaque paint and holes or soft edges) — is
  drawn twice: in `main-solid` by `cut` — its pixels of alpha ≥ `SHEET.OPAQUE` as opaque paint, depth written,
  the others dropped, lit as a solid receiver is (a floor with a gap has its lamp pools and the blob under
  people's feet per pixel) —, and in `main-blend` by `edge` — the same triangles under the strict test `greater`
  with no bias, so the pixels that laid depth are rejected before any read and only its soft edges and
  translucent paint blend, in the painter's order. Every other condition of "solid" stands for it: the first
  quad of its plane that paints (a quad whose recording paints nothing at all — `sheets.blank` — and that has no
  own shader is no plane's first: an empty base leaves the plane to its first painted layer), no layer alpha below
  1, no blend mode, no own shader, no order rule, not clipped (a card passed close by is a mixed sheet at most:
  its fading pixels are no opaque paint — the cut drops them, the edge blends them). A sheet with no opaque paint (`sheets.solid` 0: mist, glows) is blended only; a plane draped
  on the land is drawn whole by the land's two pipelines, solid or blended, as it was. In a mirror's
  pass the same, by the mirror's set.
- **Blended** (`main-blend`) — every other quad, far to near, depth test `greater-equal` with a depth bias toward
  the eye (`DEPTH.BIAS`: layers of one element lie in one plane with different corners, and nothing promises two
  triangles of one plane equal depths to the bit — main's polygon offset, kept), no depth written. What is behind
  solid paint is rejected before any read. **A fully transparent pixel is dropped**: the fragment is discarded
  where its page is empty (known from the table, before any sample) or the painting's alpha there is 0 — it
  writes no depth, so a discard costs these draws nothing, on tile GPUs too; a clip's mask multiplies alpha and so
  falls under the same rule. By the count a third of all blended pixels are such (the empty part of a painting's
  rectangle): on the laptop each saved 8 of its 17 bytes.
  **The painter's order** is for what truly blends: a quad's key is the depth along the gaze of its plane (its
  node and its layer's `depth`: plants of one element standing 6 to 40 m off are not one key) — a quad that
  faces the eye by its node's origin, a card turned its own way and a plane by the farthest of its four placed
  corners (never its sphere: half the width of a plane a hundred metres wide is not its depth), a layer as much
  nearer as its `depth` says; at one key by rows. As on engine 2.
- **Passed close by, a standing thing fades** — as on engine 2 (a curtain of leaves walked through): in the frame's
  view a CARD or FACING quad fades out from `PASS.TO` to `PASS.FROM` metres before the eye, along the gaze — a factor of
  its alpha, the distance carried from its vertices and bounded AT THE PIXEL (bounded at the vertices, a card with
  one corner behind the eye's plane would fade along its whole length) —, and such a quad nearer than `PASS.TO` is a mixed sheet at most: its
  `cut` drops a pixel whose alpha times that factor is under `SHEET.OPAQUE`, its `edge` blends it — so a ceiling or a wall
  running past the eye lays its depth where it does not fade, and what reads the depth (the bounce, the air) never
  takes what stands behind it for it. Not a plane,
  the land, the sky, an insert or a form; not in a mirror's or a shadow's view. The camera keeps its eye no nearer to
  what it looks at, and its rays begin `PASS.FROM` ahead, by the same two numbers (4.7).
- **No depth-only "cores" pre-pass** (main lays the depth of the opaque middles of mixed sheets in a pass before
  colour): `cut` writes those middles as opaque colour WITH their depth, once, in the solid pass — the way
  the count found 3 % cheaper than main's, and no pass more. What made it look risky — layers of one element in
  one plane — is the rule there already: of a plane only the first quad lays depth, the layers over it blend
  with their bias. Its price is known: a `cut` pixel that is dropped has read its sheet for nothing, on a tile
  GPU too; a mixed quad's pixels are read once in each pass where they are not opaque. The stand measures it
  (5.17's table was counted without it).
No scene is edited. What it does not help: stacked translucent paint — mist cards, smoke, sky layers, and skies
whose shader reads many layers a pixel (5.12's first row).

**What a blended pixel may read**: one table entry (read once: SH14's `sheetFind`) and one cache sample (two taps on a plane), its clip's mask if
clipped — nothing else; light, haze and air come from its vertices. An own shader's pixel: one entry and one
sample for each `layer` it reads (the skies of two scenes read nine). A particle's: its sprite and, if `soft`,
the scene's depth. **An opaque receiver's pixel**: + two key lights worked out, 4 shadow compares, the blob, a
pane's mask for each pane of a through-light key, the land's shadow of each far key light (4 loads), the air (2 taps).

**The account (rulings 2-A3, 3-2).** The screens below were COUNTED over all 20 scenes (v3-whole-picture §2:
every painting replayed into a small mask, every quad of a view sorted per cell of a 192 × 108 frame, the start
view of each scene, turns and eleven shots; data in `scratchpad\wp-tmp`): S solid, B blended (with its transparent
part E), H hidden behind solid paint, R sheet reads. The bytes and cycles a pixel are estimates from published
hardware figures (good to a factor of about 1.5: 11.2). Not in the count: particles (two blizzards, fog and smoke
sprites), people, halos in the haze.

Bytes moved in memory per pixel on a GPU without tile memory: solid receiver ≈ 30 (colour 4 w, ids 4 w, depth 4 r
+ 4 w, sheet ≈ 5, shadow and air reads ≈ 9); blended ≈ 17 (colour 4 r + 4 w, depth 4 r, sheet 5), 9 where the
pixel is dropped as transparent, + 5 for each further sheet an own shader reads; hidden ≈ 3; the canvas pass ≈
15 (its five taps of `main` read texels its neighbours read too: the traffic is the frame read once); the browser laying the canvas into the page ≈ 10 a display pixel.
The frame's pixels are the tier's budget (4.9) whatever the screen's shape: the buffer is the whole canvas scaled to
the budget, and since 2026-10-22 all of it is drawn (RN5: the world round the safe rect). On a screen of 4:3…21:9
nothing changed; a wider or a taller one used to draw only the safe rect's share of the buffer and now draws all of
it — at most the budget, the figures below, never more (a phone held upright at the budget's 960 × 540 pixels draws
540 × 960 of them).

| A frame on the **weak computer** (UHD 630), 1600 × 900, display 1920 × 1080 | The ordinary fifteen scenes (start views) | The heavy five (gavan, sklep, Ашеры «Подъезд», Насыпь, dzhungli) |
|---|---|---|
| counted: solid S / blended B without the cores step (of it transparent E) / hidden H, screens | 0–1.0 / 0.4–4.1, median 2.6 (0.05–1.2) / 0–2.5 | 0.55–0.9 / 3.0–6.1 (1.2–3.0; dzhungli 6.1 with 3.0 dropped, Насыпь 5.1) / 1.0–3.6 |
| GB/s at 60, as counted with a cores step | 6.5–11.0, median 9.0 | 11.1–16.2, median 11.7 |
| this design: no cores step (≈ −2 %), transparent pixels dropped (−7 % over all scenes; −10 to −15 % in the heavy ones) | ≈ 6–10, median ≈ 8.3 | ≈ 10–14 |
| of what that laptop's memory gives the GPU: 21–28 GB/s with two memory modules | a fifth to a half; median 30–40 % — the margin asked | 36–67 % — fits; dzhungli alone near the edge |
| … 11–14 GB/s with one module | median 60–75 % — no margin | over: an even 30 |
| the same at 1920 × 1080 on that laptop | median ≈ 11: 40–55 % | 14–20: no margin — why it is the 1600 × 900 row |
The sampler: ≈ 2–9 screens of sheet reads × 2 bilinear probes ≈ 0.3–1.6 GTexel/s of the ≈ 10 measured for this
GPU. The canvas pass ≈ 2 ms.

Phones have tile memory (a blended pixel's target does not go to RAM); their measure is shader cycles (Arm's
formula: cores × clock × 0.8). Cycles a pixel, estimated: solid receiver 14, blended 7 (+ 3 a further read),
canvas pass 12; the second main pass adds a store and a load of the frame, small beside these. **Not in the
phone table: vertex work** — a lit point works out up to 16 lights and 8 shadow compares; at the 5–20 thousand
lit points a counted view likely has that is 10–30 % of a Mali-G68's pixel budget, and at the guidance's 120 000
all of it (an inference: lit points were not counted — 11.2). The margins are before it. Counted: 32–60
cycles a screen-pixel in the ordinary fifteen (median 42), 49–75 in the heavy five.

| | Ordinary scenes | Heavy scenes |
|---|---|---|
| **weak phone** — the Galaxy A53's Mali-G68 MP4 (≈ 2.9 G cycles/s), 960 × 540, its 120 Hz display run at 60 | margin 1.55–2.9, median 2.2 | margin 1.25–1.9 |
| the same row on a `valhall` flagship (the Pixel 7's Mali-G710 MP7, ≈ 3.6 G/s sustained), its display at 90 | margin ≈ 1.8 at 90 | 2.7–3.5 G/s: at the edge at 90 — an even 45 with a margin over 2 |
| what the A53 would have at 1280 × 720 (why `valhall` is this row) | margin ≈ 1.25 | does not fit |
| normal phone (Adreno 7xx class, about the G710's figure or more), 1280 × 720, at 60 | margin ≈ 1.5 | 3.2–4.1 G/s: at the edge or an even 30 |
Reading: on the reference laptop ordinary scenes have the margin and the heavy five fit; on the ordinary phone
every scene has a margin. Views that are heavy inside ordinary scenes — close-ups of four to five full-frame
layers (burya, sklep, Ашеры «Подъезд») — counted 12.6–13.3 GB/s with the world behind them; by RN4's rule the
world is no longer there, and their own layers are what remains. The weakest point left is content the plan does
not edit, on the device with the least memory traffic: dzhungli's 6.1 blended screens (half of them empty), Насыпь's sky layers,
skies whose shader reads nine layers a pixel.

**Heat and battery (ruling 2-A11).** The phone figures above are the sustained ones (a flagship loses a quarter
to a half of its GPU within minutes). The levers that exist are the frame rate and the frame's size: the size is
the tier's and fixed; the rate is the pacer's — a phone that warms until frames no longer fit steps to the even
half rate and tries again by 5.1. On phones only two painters work while a film plays (4.9).
**The browser's compositing.** The canvas's buffer is the tier's size, stretched by CSS to the place (bilinear,
the browser's); the page lays it under its HTML layers once a frame — the "browser" bytes above. Nothing blurred
or animated for ever lies over a scene (S10); the canvas is opaque (`alphaMode: 'opaque'`).
**A moving or zooming camera** (the owner's first flaw: parts shown blurred). Where the camera is going to a known
pose — a wheel zoom's end, a framing it eases to — that pose is asked ahead
as a shot's view is (`f.toward`), so the pages of where it will stand are rastered while it travels. A pan's
leading strip is read a level soft for a moment, from its parent (the margin that named the pages just outside the
view was dropped on 2026-10-15: it cost about a millisecond of asks and fed a queue already over the painters'
rate, and bought no sharpness). What is left: a move faster than the painters (5.21 gives their rate) shows its
newest part a level soft until they catch up (the parents come first: SH10) — never held, the viewer's move or the
scene's; the stand fails a scene whose motion outruns the tier's painters (ST3 `soft run`) — named in section 7.

### 5.18 Particles and the air — no compute

Particles (ruling 2-A7): each particle is a closed form of the time, its number and its emitter's history
(`world.emitters`: the ring of the emitter's last 256 moments, its bursts, the wind's log — WT5), worked out in the
vertex stage of the draws that show it (the colour draw, the cast draw). No simulation, no state on the GPU. The
histories are kept on every step, unseen ones too (a moment is written when the emitter changed: WT5), and are in the director's save — so a still picture at any
moment, however reached, shows smoke, flame, sparks and dust as the film does there. This is main's model (the
ring and the closed forms exist there, evaluated into integer textures); what goes is that evaluation pass.
The cap is the language's 65 536 (LG12). A particle that settles lands by its fall alone — gravity and drag; the swirl
moves it sideways. The air's volume (shafts, a lamp's glow in the haze) is a 64 × 36 × 24
grid laid out as a 2D atlas and filled by two small render passes after the shadow passes, so it reads this frame's
shadow maps: each cell's own stretch first (the shafts by one triangle, every lamp's halo by an instanced quad a depth),
then the sum along the depth — a cell cannot add to the one before it in the pass that writes it (4.2). With these two there is no compute pass, no storage texture and no read-write buffer in the engine.
**A beam in the haze is not in the volume** (its cells, some 25 px at 1600 × 900, drew a narrow cone as blocks and
broke it into blobs — the round of 2026-10-27): `beam` (made only for a spec with a cone that is taken) draws, in
`main-blend` after what blends, the box about each lit beam's cone within its reach — its faces turned away from the
eye take the pixels (a face toward the eye is dropped whole in the vertex stage), so the cost is the beam's own share
of the screen. A pixel meets its ray with the cone (within
its edge, before the light, within its reach, short of the solid depth, read as a texture — `main-blend` holds the
depth read-only) and gathers its lit haze as a glowing medium, four samples at fixed even places (no noise: no
grain on a still frame — there is no temporal filter): each a source — the light there as it lights what it falls on,
its strength carried whole (its colour × e_lin(strength × falloff) × (0.1 · its reach / distance)², taken no nearer
than 6 m or a tenth of its reach, whichever is nearer — never less than what it lights there —, × e^(−distance / the
haze's reach), dimmed on its way out as on what it lights: by the lantern a hot core, then a shaft thinning as
1 / distance — its light 1 / distance², its chord × distance —, never as an omni lamp's) × the haze's scattering toward the eye (Henyey–Greenstein, g 0.35, normalised:
at most 3.2, toward the lamp) × its shadow maps (one read a pair of samples) × the haze before it — times
1 − e^(−depth), what is beyond dimmed by e^(−depth); the depth a metre is the cone's edge × hazeGlow × 12 / the haze's
reach (the haze lit by a beam glows twelve times what it scatters by its reach: the medium's gain, as the halos have
theirs). A pixel never shows more than the brightest source on its stretch; no clamp but `BEAM_MOST` (16 384 a
channel, far past any white: two beams over the scene stay a number in `main`, rg11b10ufloat). Cost a covered pixel: four
samples and two reads of the shadow maps (four compares — a receiver's two key lights' worth), whatever the beam's
share of the screen (a count by share would change the picture as the framing changes).
The volume reaches as far as the air is seen: six of the haze's reaches, or the farthest point of the world's
bounds from the eye where that is nearer (in clear air a far hill gathers most of the shafts' light beyond three
reaches). **The air's light lies over the sky too**: after the sky's sheets, `air-sky` adds the volume's whole
depth where nothing stands before the sky (4.4 pass 8; the frame's view only) — else a far hill is lifted by the
shafts and the sky behind it is not, and the hill's outline goes. One draw, not a term of a sky sheet's
fragment: sky sheets overlap.
**Puffs** (`smoke`, `puff`, flame — a particle with no painted sprite and no dot, flake or streak shape) look
and are lit as engine 2's: each takes one of four lump sprites the engine makes once (layers of the sprites'
array: a few tens of soft lumps each — not one smooth ball, and not the same outline for every puff); a thick
emitter (`shadow` above 0) shades itself — the side of its plume away from the strongest far light is darker by
its `shadow`; `sheer` lets the light behind a puff through (the emitter's row carries it; 5.5); and an emitter's
particles are drawn oldest first or youngest first, whichever end of its plume lies farther along the view's
gaze (a flag of the draw, no sort).

### 5.19 The cache: its size, and what happens when a view does not fit

**Size, by the count (ruling 3-1.3).** Pages one view needs (tops at a 16th of a slot each), counted for the start
view of every scene at each tier's frame, hidden sheets included (v3-whole-picture §2.4):

| | 1920 × 1080 | 1600 × 900 | 1280 × 720 | 960 × 540 |
|---|---|---|---|---|
| least / median / upper quarter / most (dzhungli) | 223 / 482 / 608 / 1061 | 194 / 353 / 442 / 799 | 151 / 265 / 306 / 491 | 82 / 175 / 209 / 381 |
| the larger of: the heaviest view; an upper-quarter view with a median view ahead | 1090 | 799 | 571 | 384 |
| + an allowance, not counted (11.23): shadow views at two levels coarser (≈ 10–15 pages a cascade), a mirror's view (at most 512 px a side, coarser the rougher the mirror: under a quarter of the frame's pages) | ≈ 49 | ≈ 49 | ≈ 49 | ≈ 49 |
| layers of 49 slots that hold both | 24 | 18 | 13 | 9 |
| **`host.cache`**, with the parents (below): a fifth more on computers and laptops, phones as counted | **29** | **22** | 13 | 9 |
| **with the parents (SH10), counted** on the start views of «Вокруг света v3»'s five scenes by the engine's own ask (2026-10-14; the parents not named already, the top and pages blank by their recording apart): main / gavan / the train / Сэвил-Роу / dzhungli, own pages → with parents, slots | 672 → 780 · 634 → 755 · 542 → 651 · 401 → 474 · 871 → 1104 (at bias 2) | 359 → 438 · 372 → 471 · 375 → 470 · 238 → 311 · 846 → 1066 (bias 1) | 270 → 343 · 272 → 341 · 330 → 393 · 286 → 327 · 394 → 502 (bias 3) | 234 → 270 · 209 → 245 · 219 → 264 · 155 → 184 · 351 → 449 (bias 2) |
A view needs about 4 pages a screen-page of painting, not 2.25: many sheets are small on the screen
and still take one to four pages, and a sheet read whole takes `host.wholePages`. The table, not a formula, sizes
the cache (the ratio is not the same at every size). It is ordinary memory on integrated graphics; on phones
163–235 MB is the tab's largest allocation (11.7). Never grown on the run. The count is of the camera's view; the pages of
shadow views and mirrors are the allowance's row — one layer on every tier. Without the rule that
shadow views read two levels coarser (5.5) a cascade alone would ask a hundred to two hundred pages. The room a
frame's own views have — `cycle.room`, one definition (SH13, ST3) — is the cache less the tops the world's sheets
hold (a top is a 16th of a slot — 150 paintings, about 10 slots): about 1411, 1068, 627 and 431 slots by the tiers'
columns; the camera's own view has that less the allowance's layer, about 1362, 1019, 578 and 382. The authors'
budget follows from that (5.12): 0.8 of it where nothing is made ready beside the view (≈ 1090, 815, 460, 305), half
of it where a shot is (≈ 680, 510, 290, 190).
**The parents grow a view by 15–30 % (median ≈ 22 %); for them the cache is a fifth larger on computers and
laptops** (the owner's decision): 29 and 22 layers (+90 and +72 MB of ordinary memory) give back the sizing rule's
quarter there — an upper-quarter view with a median view ahead, ≈ 970 slots at 1600 × 900, fits the 1019 the camera's
own view then has (it did not fit 833). **On phones it stays 13 and 9 layers**: there the cache is already the tab's
largest allocation (163–235 MB), and the plan has no measure of what a tab may hold on a 4–8 GB phone before its
device is lost (11.7: no browser documents one) — so 16 and 11 layers (199–289 MB) cannot be shown to fit with a
margin, and an unmeasured risk of a lost device is not taken for a shorter wait at some cuts. What it costs there:
an upper-quarter view with a median view ahead is ≈ 470 slots at 960 × 540 against 392, so a cut is held briefly for
its finer pages where a view of the heavier HALF (not quarter) has a median shot ahead, and the authors' budget there
stays what the room gives, parents in (460 and 305; 290 and 190 beside a shot) — about a fifth less painting than
the rule's count asked. The heaviest
views (dzhungli's) are over the room at every tier. Grown on phones only once a phone is measured and shows the room
(9a item 10).
**Order of service.** The frame's own views first (the frame's, its mirrors', its shadow views'); then the views
ahead — the camera's own `toward`, then the shots in the order they were made; then the opening view of a scene being
made beside this one (`next`, 2.9) — with a share kept for it: what it needs at its bias, at most half the room, which
the views served before it do not take (`left` begins as the room less that share, and the share is added as `next` is
served): the living picture keeps at least half, the next scene's view at least what fits in its share, each rising in
bias as any that does not fit; then the closed inserts' pages
(named quietly by any view: RN4) — preparation: they never count against the cache — they take cells only from what every view's own pages leave, and a cell holding one
is the first let go for a view's own page. A closed close-up as large as the stage (hundreds of pages at full
sharpness) so never crowds out what is on screen; it waits for room instead, and opens when its pages are there.
**Pressure — a function of what is asked and of the band it is in.** Each view has a `bias` (quarter levels, 0 … 16 —
`BIAS.MOST`, four levels), worked out by `sheets.weigh()` (SH12). With
`N` the pages a view's asks named inside the view as its own (not quiet) and `C` the slots left for it: `N > C` → the bias rises by
`⌈4 · log4(N / C)⌉` quarter levels, at most four (a level) a weigh. **It falls back as soon as the finer bias fits —
counted, not guessed**: while a view's pressure is above 0 it has a PROBE — the same view asked a quarter level finer
(a View of SHEETS' own, kept beside it). Its names are a kind of their own (`NAMED.PROBE`): they keep the records they
name alive, never set a page's round or its view (`rWant`, `rBy`), take no cell, are never requested, and are in none
of SH3's counts nor `entered`, `wanted` or `named`. The probe counts its OWN names exactly as `N` would be a
quarter level finer: pages a view served earlier already named this round are left out, parents in, tops apart — the
very measure of the rise. The pressure falls a quarter level when that count takes at most `FALL` (0.8) of `C` in
units, and its number of pages is at most 0.8 of the whole slots left for the view (empty, or holding no top and no page
of a view served before: a count that fits can still fail on the cells' shapes) — and only from a bias that is drawn
(`drawn` = `bias`). It rises at any time, never more than four above `drawn`. So a brief rise — a repaint asking the
old sheet and the new, a close-up opening, an engine camera passing a heavy spot — is undone once its cause has gone,
not at the next shot. **The band**: what a view names does not grow as its bias coarsens (each quad's level is
`⌊λ + bias / 4⌋`, and a coarser level of the same rect has no more pages, nor more parents), so while the world stands
a fall to a bias whose own names take at most 0.8 `C` is not risen from, and a rise from a bias whose own names were
over `C` is not fallen back past (the finer count is over `C`, above 0.8 `C`); the band between 0.8 `C` and `C` is the
hysteresis. A rise by `⌈4 · log4(N / C)⌉` can overshoot; the probe then lets it fall back a quarter level or more —
harmless, and it converges: every fall ends at a bias whose names fit, every rise at most at the bias's end, so a whole
call's rounds end at a bias where `N ≤ C` and the probe a quarter finer is over 0.8 `C`, or at 0, or at the bias's end
(SHEETS proves it again in node, as for the rule it replaces). **A switch is drawn only once its pages are placed**
(`drawn`, SH10): a rise of up to a level names the parents the view kept (SH10), already there; a fall names pages whose
parents — the pages it showed — stay named; either way the view is drawn at the new bias from the ask in which every
page it names is placed (at the bias's end, the pages denied there left out), and the pages it leaves are let go only
after. Nothing turns soft at a switch, nothing sharpens in patches, and no rise leaves a page missing two levels deep:
a view that can never fit is never held. **What a probe costs**: on a tick when its view's own ask worked out no item
(SH10), the probe works out none either — it names again what it named; otherwise at most one probe a tick works out
items, once every `host.ahead` / 2 for each, never on the tick `toward` is placed again; in a whole call it is asked
every round. So on a moving camera a fall may come up to `host.ahead` / 2 later than the finer bias fits;
a scene within its budget at rest has no probe at all. The stand shows what the asks cost, the parents' and the
probes' among them (ST2 `wide`: ask ms by view). `C` is counted, not scanned:
the cache's units less the tops' and less what the views served before hold; a page its painter found empty counts as the
cell it was painted in, so the count is the same before and after it arrives. In a call with
`f.whole` the asks are repeated until the bias stands BEFORE anything is sent to the painters (SH12). A view that begins — the frame's at a new
shot, a view ahead's with its shot — starts at 0: R says so (`View.fresh`, SH10). Nothing in it depends on when a page arrived, so a render's frame is the same
on every run. At the bias's end (16) with `N` still over `C` — sheets too many and too small to shrink — the view
is whole when everything that fits is there; the rest is read from the coarser levels there are (tops are always
there). A page it is denied is not waited for by a view served after it that names it too: a page is the view's
that named it first in the round, and has no cell while that view is denied it (else the later view would wait
for a page that cannot come: a held frame with nothing in flight). Beyond today's scenes; said so that it ends.
**A view ahead that moves** has a third part of its bias, RENDER's: its `coarser` (SH10), raised a quarter level
at a time while pages keep entering it and what it lacks does not fall (2.3 step 4) — coarser pages pass a riding
camera more slowly, so at some sharpness the painters keep up, and at the bias's end the view is whole with what
is there. A view that moves and names the same pages (its camera follows something that sways) is not coarsened,
and what it once was coarsened by falls again while it lacks nothing and nothing enters it. The frame's own view has no such part and is never held for motion (rule 8): it is drawn
with what there is, its newest strip a level soft for a moment, softer until the painters catch up where they cannot
keep up — which the stand fails (ST3 `soft run`; section 7 item 9).
**What the viewer sees when a view does not fit.**
- **A view within 0.8 of the room** (its own pages, parents in): sharp, at bias 0.
- **A view loading** — after a fast move, a page let go, a region opened anew: its missing pages are read from
  their parents, a level soft for a moment, and it plays on — never held, whoever moves the camera. Where even the
  parents are missing it is softer still until the painters catch up, and the stand fails a scene whose motion asks
  that of the tier (ST3 `soft run`, by motion).
- **A view that can never fit** (its own pages over the room): never held — loading cannot shrink a count, so the
  hold would never end. It is shown honestly coarser by quarter levels (a quarter level is 19 % coarser),
  uniformly, steady while the view is steady, never changing at the moment pages arrive — and the stand fails the
  scene (ST3: `soft run`), so it is mended where it is made. Of today's start views, counted
  with parents, dzhungli's is over it on every tier (it settles one to three quarter levels coarser); the forest
  turned round is over it without `copies` (5.20: not carried over here).
- A view ahead that does not fit beside the frame's view becomes ready at its own, coarser bias (`a.bias`). At its
  cut the old view's pages are let go and the frame's bias starts at 0, so the frame is held for the finer pages
  — a short hold of the kind of 2.4 (the paintings are made and the coarse pages are there) — and then shown
  sharp. Never shown soft and sharpened. By the counts with parents this is where a view of the heavier quarter has
  a shot ahead on computers and laptops (the cache grown), of the heavier half on phones, and dzhungli everywhere.
  A shot of a riding camera made ready coarser by its `coarser` is held so too.
Not built, named as the lever if the run shows these holds: leaving out of the ask what wholly opaque quads hide.

### 5.20 «Вокруг света v3» — the one world carried over: how it is made, and its edits (W4; rulings 2-C4, 3-4)

One world, a copy. «Вокруг света v2» (its own repository, not public; five
scenes: `main` «Реформ-клуб», `dzhungli`, `gavan`, `iz-okna-poezda`, `sevil-rou`) is not touched — it is only
read. No other world is carried over in this piece, and no game.

**How the world is made** (LANGUAGE; through the tools every world is made with — nothing by hand in a database,
nothing pushed to a deployment's branch). **Where: the work's local stack** (the coordinator's ruling) — it
runs this branch's code, so it has engine 3 once the code is in; its deployment branch is the stack's deployment branch.
Dev is not touched.
1. **A new world**, «Вокруг света v3», of the same owner: a world of its own,
   its own repository. (Its empty main scene is stamped `"engine": 3` and has nothing in it.)
2. **The copy, as it is.** In a branch of the new repository, begun from the stack's deployment branch: the whole tree
   of «Вокруг света v2» as its repository has it (the branch the coordinator names: 9a-11) — `world.json` (the
   title «Вокруг света v3»; the same main scene), `modules/**`, the five folders under `scenes/` — nothing changed,
   every scene `"engine": 2`; `merge_branch` on the stack. A new folder is a new scene; the empty `main` that
   `create_world` made takes v2's. From here the world has the same five scenes as v2, drawn by engine 2: the
   reference each engine-3 picture is held against, and the version the comparing page shows beside it (1.6 row 4).
3. **The conversion.** A second branch with the edits below — every scene in it `"engine": 3`. It is prepared and
   pushed like any work branch, with the rest of the code (8.3); its pictures are drawn from a clone of it by the
   studio on a machine with a graphics card; when the engine works it is merged on the stack — `merge_branch`, each scene a new version —
   and the owner looks at it there, in his browser. It is merged nowhere else: only a deployment whose code has
   engine 3 can run it (1.6).

**The edits of the five scenes — the complete list.** Each keeps every id, point, key and tell of its scene.

| Scene(s) | Edit | Size |
|---|---|---|
| all five (`scene.json`) | `"engine": 2` → `"engine": 3` | a line each |
| `main`, `dzhungli`, `iz-okna-poezda`, `sevil-rou` (`gavan` has no shader) | `elements/<id>.glsl` → `elements/<id>.wgsl`, converted (LG2): 14 files, 11 distinct texts, 154 lines — `main`: `sky`, `street`, `mist`, `hearth`; `dzhungli`: `sky`, `pyre`; `iz-okna-poezda`: `sky`, `herd` (the one shader that hashes with `uint`), and one text in four files — `distant`, `mid`, `window`, `lamp`; `sevil-rou`: `sky`, `club_rooms`. The world has no generator that writes a shader | mechanical; no look changes |
| the world's `modules/beats.js` | its game path (`play`) makes a beat's opening ready as its showcase path does: when a beat begins, `scene.shot(from())` of the beat that comes next in the film's table and does not simply follow — or of the beat named by the key `beat_next`, if a game sets it (the module's own key; the engine knows nothing of it) — and cuts by that shot when the beat is set and `from()` still gives the values the shot was made with (several `from()` read the state; else a plain cut); `beat_next` is heard when a beat begins and again whenever the game sets it | about ten lines; without it every cut of a game on this world would be 2.4's hold (ruling 3-1.2). No game plays on the world: the edit is checked by reading |
| «Из окна поезда» | the lap (`script.js:13-34`): `scene.prepare(values, READY)` → `ready = scene.shot(values)` made for the place the lap will cut at, and the lap's cut becomes `ready.cut()` at that place (the land repeats each period, so the script can cut exactly there: a finished `scene.move` leaves its key exactly at its target) — today it prepares one place and cuts plainly to another, which would be 2.4's hold once a lap on the scene with the heaviest paintings | a few lines |
| «Гавань» (`script.js`, `lib.js`) | `daze` tips the horizon by a MOVE of `camera_roll`, not by a set of it at every frame of `daze`'s move (5.16: a camera key set at once is a new shot): the beat that moves `daze` moves `camera_roll` beside it — the same seconds, the same ease, to 4 × the value —, and the script sets `camera_roll` only when `daze` itself is set at once (a beat's cut carries both already) | a few lines |

Nothing else of the five scenes is edited — but what names a thing that changed follows it: notes, module docs, code
comments and `world.json`'s description (the engine's number, a shader file's name, the lap); no id, point, key or tell
is among them. `AGENTS.md` and `CLAUDE.md` are the service's files (it writes them into every world's repository)
and are not in the conversion's branch. In particular, with the reason each needs none: the train's 946 lights
and gavan's 83–134, and lamps' shadows (5.5); the scripts' plain cuts (5.4) and close-ups (RN4); `soft`, `size`,
`blur`, `lit` (LG5); `e.area` in sevil-rou (LG9); the `scene.every` sites and the animates (5.16); mist cards and
large smoke and fog sprites (they are the scenes' look; they cost blended screens — 5.12 — and the stand will say
where it matters). No scene of the world uses `veil` or `light.people`. No scene is given `copies` or a form.
Where the five stand against the guidance (5.12), unedited: blended screens — dzhungli above four (5.17); casters
over 300 quads — dzhungli; paintings of tens of thousands of canvas calls — the train's `near`, sevil-rou's
`road`, dzhungli's foliage (their price is in 5.21); a cut that repaints tens of paintings — gavan's `port`. The
world holds three of the heaviest scenes of the twenty: what is debugged on it is the hard case.

**The other «-v2» worlds — not carried over; what they would need is known** (from `study-scenes.md`; it is what
`engine3-porting.md` is written from, and no part of this piece): the same three kinds — the engine's number, the
shaders' conversion (82 files and 43 distinct texts over the 20 scenes, with their sources in two worlds' tools),
the film module's game path —, and three more that «Вокруг света» does not meet: the two Asher scenes that paint
their own light («Подъезд к дому», «Падение дома») become lit by the engine (E9: `light.people` and a look's
`people` are not in the language — large edits, and the look changes); «Полёт»'s `veil` becomes its blizzard's
haze; «Лес у моря» becomes `copies` of about twenty painted kinds (1831 distinct sheets → some tens: its tops
alone were a fifth of the cache). A game reads names of its scenes — ids, points, keys, tells —, and every such
edit keeps them.
### 5.21 Time to a finished picture — the opening and a cut (ruling 3-1.1)

The frame has 5.17; this is the same for the two waits the viewer meets. Pages are counted (5.19's table). What a
page costs is known from main, whose painters are the same path (a CPU canvas, bytes, four threads):
the studio's history measured on the stand at 1080p a first frame after 2.1 / 2.5 /
5.0 s and the view whole after 3.7 / 7.5 / 10–19 s («Мэдлин», «Реформ-клуб», «Палуба») — 4–10 ms of wall time a
page with four painters. Main is throttled where this design is not (12 pages in flight, placing by time,
feedback rounds, frames drawn meanwhile) and the stand's processor is weaker than the reference laptop's; so:
**about 2–8 ms of wall time a page with four painters on the reference laptop**, and on a phone two to four
times that — the Galaxy A53 has two fast cores and six slow ones, shared at the opening with the artist and the
scene's thread (which cores the painters get is unknown: 11.7).

**The opening**, leg by leg. Pipelines and people run beside the painting; a painting's pages can start only
when its paint code has ended and the one artist paints in turn — so the wait lies between the longest leg and
the sum of two:

| Leg | What it is | The reference laptop (4 painters) | The ordinary phone (4 painters in a held frame) |
|---|---|---|---|
| files and data | about 60 engine modules (once a deploy), the world's modules, a cast's motions (5–10 MB a world) | the network's; kept by the browser after | the same |
| pipelines | under thirty for an ordinary world, asked the moment the spec is compiled | the first time on a device ≈ 2–10 s (the platform's compiler; 11.6); after that the browser's own cache of compiled programs (study-webgpu §2) | the first time: seconds; unknown |
| paint code | every painting once, in the one artist | ≈ 0.2–1 s; + ≈ 0.3–1 s in the three scenes with paintings of tens of thousands of calls | two to three times that |
| pages of the first view | 194 / 353 / 799 jobs (least / median / most) at 1600 × 900; 82 / 175 / 381 at 960 × 540 — plus the allowance of 5.19 — **rastered while the scene is still being built, for the first cut's view**: the opening's state and first cut are applied before anything is painted (2.2 step 4); as each painting arrives SCENE asks that view and SHEETS sends its pages (2.2 step 5) | 0.7–2.8 s for a median view; up to ≈ 6 s for the heaviest | 0.7–5 s for a median view; up to ≈ 12 s for the heaviest |
| the huge paintings' coarse pages | a top or a coarse page of a painting replays all of it: 280 000 calls (the train's `near`), 62 000 (sevil-rou's `road`), 24–31 thousand (dzhungli's foliage, several) | + ≈ 0.3–1 s in those three scenes | + ≈ 1–3 s |
| people | figures built, the scene's motions made ready — on the scene's thread in slices, beside the legs above | about 10 ms a motion made ready (measured on main, the same note); a cast of 30–40 motions: 0.3–0.4 s — and this leg now stands IN FRONT of the painting (2.2 step 4: the people are built before the opening's first step), so it adds to the wait instead of running beside it | two to three times that: about 1 s in front |
| the first whole frame | shadow cells, land, mirrors, once | tens of ms | the same order |
**Orientation: about 2–4 s on the reference laptop (1 s only for the lightest scenes) and 4–10 s on the ordinary
phone, after the first visit; the three scenes with huge paintings and the heaviest views up to about twice
that; the very first open on a device as long as its pipelines take to compile** (on main, with another
compiler path, that first compile took minutes on an Arc 140T laptop:
the studio's history; RENDER's specification keeps its shaders free of long unrolled
loops and of variants for that reason). No opening time is promised; this is what the design gives.
Levers that are IN this piece (each is in the text above): pipelines asked at compile (2.2 step 4); **the
opening's state and first cut applied before anything is painted** — paintings made once, not twice (main paints
33 of «Палуба»'s again: 5.0 s against 2.1–2.5); pages rastered during the build for that view (2.2 step 5);
shadow views two levels coarser (5.5); all painters in a held frame, tops many to a job (SH12, 4.9); a page
costs what lies in it — long paths cut by runs (5.6); "whole" is the level the view needs (5.3); the world
behind a solid close-up not drawn, its pages kept (RN4). Considered and NOT built, with the
reason: rastered pages kept in the browser between visits (new storage and its upkeep for the second visit only;
the first is what is judged); a second artist (paint code is not the long leg, and the scenes' libs keep tables
between paintings); splitting the three huge paintings (a heavy edit of three scenes for their opening seconds —
named in section 7 item 2; the owner's to ask for).

**A cut.** Where a cut is not ready the STORY waits that long, the picture before it living (2.4); nothing freezes.

| The cut | What is waited for | The reference laptop | The ordinary phone |
|---|---|---|---|
| to a shot made ready that fitted in the cache (2.3) — every beat of a showcase, the next beat of a game, the train's lap | nothing | none | none |
| to a ready shot whose view did not fit beside the frame's (5.19) | its finer pages | a part of the row below | a part of the row below |
| nobody could know, same framing, nothing painted anew | a tick or two | ≈ 0.03 s | ≈ 0.03 s |
| nobody could know, a new framing of the same place | 190–460 new pages at the computers' sizes, 100–200 on phones | 0.4–2 s | 0.4–3 s |
| … that also repaints tens of paintings (gavan's `port`, paluba's `ship`) | + their paint code and their pages | up to ≈ 3 s | up to ≈ 6 s |
| a scene replaced in a game (2.9) | the new scene's legs of the opening table, beside the old one, which plays on; then its first frame — briefly held only where the cache could not hold its view beside the old picture | the opening's, the old scene living meanwhile | the same |
| a close-up opening (not a cut) | nothing: a closed insert is asked ahead (RN4), with the room the views on screen leave; if its painting is made again in the same tick, or its pages found no room, it opens when they are there | none; else ≈ 0.1–0.3 s late, the scene going on | none; else ≈ 0.3–1 s late |
**A moving camera.** Painters deliver, while a film plays, 4 at work on the laptop and 2 on a phone — about
125–500 and 30–250 pages a second by the figures above; `host.pages` places 8 or 4 a tick (480 or 240 a
second). The painters' rate is their own, not the tick's: a painter that answers is given its next page at once
(SH12) — the first stand, where pages were handed out only once a tick, delivered two a painter a tick whatever
the tick's length, and with it openings of 6–19 s and cuts held for seconds. A zoom or an eased move is fed by `f.toward` (a pan's leading strip is read a level soft for a moment); a move faster than the painters — the
viewer's or the scene's — shows its newest strip a level
soft for a moment and is never held; one that outruns the tier's painters fails the stand (ST3 `soft run`).

### 5.22 Interaction — why it is built so (the owner's decision; 3.11)

Until 2026-10-11 engine 2 decided what can be pressed by a model apart from the picture — engine 1 still does:
the page asks the thread, the thread casts a ray, finds a sheet on its plane at rest, tests a coverage mask of
its top at 0.1, tests people by capsules, skips sky sheets, inserts and unseen things, and the cursor is asked
every 120 ms for a mouse only. So the knot of «Трещина» (a sky element) could not be pressed though the game
offered it. The press-points work (the studio's history) gave engine 2 the owner's
principle: **a thing to press is a point the scene names, and a press is a hit on a circle round that point.**
Engine 3 takes that principle and its language whole — the same rings, the same refs, the same point where a
thing is pressed (IN1, IN2) — so nothing of a scene or of a game changes. What is engine 3's own is underneath:
the thread projects every point with the very camera the frame is drawn with (engine 2's page projects them
itself from a table the thread sends); sky and insert points are slots like any other; and the offered thing
pulses by its own draw, where engine 2 glows its silhouette on an overlay canvas — so where a thing is is worked
out once, not again for the glow. Weighed and not taken: pressing by the picture (a layer of things' ids drawn by the
frame's programs, read back at the pointer, with an outline built from it) — exact to the silhouette, but a
dozen more pipelines, two passes, a read-back a press, and rules for what hides what; and invisible buttons
shaped by a thing's box. A circle at a point is predictable for the player (one look, one size, never smaller
than a finger), costs the GPU nothing, and is right for every kind of thing because it does not ask what the
thing is.

| Part | Mechanism | Owner | Costs a frame |
|---|---|---|---|
| pressing | engine 2's ring: a round page button, 48 px, at the thing's tracked point (IN2) | PAGE | nothing on the GPU; a point projected (it is anyway) and an element moved |
| the highlight | the thing's own draw, brighter in a pulse, by two bits of its rows (IN3) | SCENE (bits), RENDER (the factor in the shared vertex stage), PEOPLE (its uniform) | nothing added; the scene is not idle while something offered is in view (as on main) |
| anchored layers | PG5's `points`, sent with the frame that drew (IN4) | SCENE, PAGE | as now |
| mini-games | `where`, `onFrame`, circles, `pointer` (IN5) | PAGE | nothing in the thread |
| the author's selection | main's ray, kept for the editor only (IN6) | SCENE, PAGE | only at a click |

What the viewer gets: every offered thing has a circle where the scene put its point — pressable by finger and
mouse, on any device and window, with the hand cursor at once, whatever the thing is and however it moves; the
thing itself breathes brighter. What the author gets: one rule — a thing to be pressed needs a point; name it in
the painting (`e.at(x, y, name)`); without one the ring stands on the point the thing marks as itself, else on the
middle of its box; a thing of the sky must mark one — the rule engine 2's language has today.
Named, not built (`dropped.md`): dimming the circle of a point that is behind something nearer; pressing by a
thing's silhouette.

### 5.23 Forms — opaque surfaces given by a function (the owner's decision)

**What a form is.** A function (u, v) → a point in space, u and v running 0…1 across the element's painting. It
is opaque, painted like a sheet — the painting's rectangle is the form unrolled —, and the engine chooses its
tessellation. `study-forms.md` has the reasoning and what was weighed (bent sheets alone; raw triangles; imported
models).

- **In the language** (LG15): in an element's paint code, beside the painting: `e.form(fn[, { closed, ground }])`
  — `fn(u, v) → [x, y, z]` in the element's own metres (x across, y up, z toward its front — the same frame on a card and
  on a plane: WT10); `closed`: `"u"`,
  `"v"` or `"both"` when the form meets itself there; `ground`: the colour under the paint. The function is
  pure: it reads the state and the element's own numbers. Ready constructors are plain functions of the kit
  that return such a function: `kit.bend`, `kit.revolve(profile)`, `kit.extrude(profile, path)`,
  `kit.loft(ribs)`, `kit.lump(outline, height, seed)` — spaced by length along the surface, so paint is not
  stretched one way. No machinery of the engine is theirs.
- **Who evaluates it**: the artist, at the element's make (rule 5 holds: no scene code on the scene's thread for
  it). The easel samples the function on a grid of **33 × 33 points — the engine's number, always** — refuses a
  result that is not a number or a grid of no area (an error of the make, said with the element: the make fails as a
  throw does — `rec` null, the element keeps what it had: SH6), and sends the
  points with the painting (SH6 `made.form`). A form that reads a key is made again when the key changes, as a
  painting is; an animate moves a form as it moves a card — by its node — and cannot change its shape.
- **Opaque by construction**: the recorder begins a form's display list with a fill of `ground` (default: a mid
  grey) over the whole rectangle. So the sheet is wholly opaque whatever the author paints; a hole left in the
  paint shows the ground colour, not the world behind. RENDER draws a form in the solid list always, depth
  written, both sides (no culling) — it does not wait for `sheets.solid`. A form therefore hides itself and what
  is behind it correctly from every side, and blended sheets before and behind it sort against its depth as
  against a wall.
- **Not on an element with a form** — an error of the scene's build (LG13): layers and parts, an own shader,
  `blend`, `translucent`, `reflect`, `glass`, `wind`, `drift`, `clip`. `copies` are fine (a copy is a node and a
  quad row; the grid is one). A form is a card's or a plane's — not the sky's, an insert's, a draped plane's, a person's
  or an emitter's.
- **Tables** (WT10, 4.1): the kind `QUAD.FORM`; the quad row's `form`; SCENE's texture `forms` (`rgba32float`:
  point and normal, 66 × 33 texels a form) bound in `frame` — a texture, because the vertex stage is at its
  limit of storage buffers (4.2). Normals are worked out by SCENE from neighbouring points, once.
- **Drawing**: the shared vertex stage reads the point and the normal at the corner's place in the grid
  (`quadPoint`, `quadNormal`: WT6). RENDER chooses the detail each frame for each view as a stride over the same
  grid — 32, 16, 8 or 4 cells a side (four shapes of the one buffer), the coarsest at which a cell is under
  about 12 px. No new pipeline, pass or buffer.
- **The ask of pages** (SH10): by blocks of 4 × 4 cells — a block is a rectangle of the painting; its corners are
  placed by `place` (bilinear in the grid) and it is asked as a flat piece at the level 4.8 gives there. On the
  scene's thread, 64 blocks a form in view. Rule 3 holds.
- **Cull**: the grid's sphere. **Order**: solid, near to far, by the sphere's nearest point.
- **Light**: the grid's normals — light at the vertices as for every quad, and the two key lights per pixel with
  the interpolated normal (normalised again in the fragment), as for every solid receiver. **The normal used for
  light is turned to face the eye**: its sign is that of `dot(normal, eye − point)`, at the vertex and at the
  pixel — a form is drawn both sides, and its inside must not be lit as the back of its outside. Not
  `front_facing` (fragment stage only; it flips in a mirror and on a flipped copy). A form's painting carries colour and pattern, not light.
- **Shadows**: cast through the same vertex stage (the `cast` pipeline). Received as any solid receiver, from
  the casters named `onto` it; never its own (an element is not its own receiver — true of every quad).
- **Mirrors, pressing**: the same stage, so a form is reflected as it is drawn; it is pressed by its point like
  any thing (3.11) and pulses by its row's bits.
- **Points**: `e.at(x, y[, name])` in the painting's units is the point ON the form (through `place`), so people
  look at it and reach for it, lights and emitters stand on it, a page layer is anchored to it.
- **People do not stand on a form.** They stand on planes and the land; in a boat they stand `on` a deck plane
  inside the hull, and the hull's depth cuts their legs at the rail correctly.
- **Accounts**: 5.17 — a form's pixel is a solid receiver's (≈ 30 bytes), and it hides what is behind it.
  Vertices: 1089 a form at the finest stride, in each view it is in (the frame, a mirror, a shadow cell). 5.19 —
  its sheet is asked like any; `forms` is 35 KB a form. 5.21 — no new leg (1089 calls of a function at a make).
- **What keeps authors from misuse by construction**: the grid is the engine's (a form is 1089 points whatever
  its function); solid only; no shape change in animate; no layers or shaders on it. **What is left to the
  principle** (LG14): how many forms a scene has (5.12's row) and whether a thing should be a form at all — a
  round thing far off or seen from one side is still painted on a flat sheet.
- **Not guaranteed**: paint stretched where a surface curves two ways (a pole of a `revolve`, the steep sides of
  a `lump`); an outline of straight pieces when a form fills the frame (33 points a side; smoothed like people's
  rims in the canvas pass); that lit forms and painted flat sheets look of one hand — the authors' care and the
  owner's eye at the run (section 7).
- **Not built, and not to be imitated** (LG14, `dropped.md`): forms with holes; glass or translucent forms; raw
  meshes; imported models; walking on a form.
- **Raw triangles later**: the owner's wish that they be easy to add is a weak one and bends to simplicity. Of
  the study's four choices that would have made room for them: kept — none was needed (pressing no longer uses
  geometry: 3.11); dropped — a (u, v) stored with every point, the ask written over triangles, a "soup" shape.
- **No scene is edited for forms.** The arcade of «Мэдлин проходит» (136 flat strips for its vaults) stays as
  made — the coordinator's decision.

---

## 6. Fallbacks and props — each ruled

The 29 of round 1's group E (validate-contradictions C45–C73). "Out" = the thing
does not exist in this design. "Need" = a real need, with the reason it is not a prop.

| # | What round 1 had | Ruling |
|---|---|---|
| C45 | the pacer tries 60 again after 10, 20, 40… s | Changed: a trial with a back-off stays, as the standard governor has it — but it steps down only on frames the viewer lost, tries back only when measured costs allow, counts frames, not seconds, and its wait doubles without a cap, so a device on the border settles (5.1). Need: without a trial a healthy device could be held down by a late measure |
| C46 | a message posted to itself while programs link | Out: pipelines are promises |
| C47 | `R.missing()` "for whoever fails the render from outside" | Need, owner named: the render entry's patience; and the settle's own fault when nothing is in flight (2.5) |
| C48 | reversed depth "where the device has it" | Out: always |
| C49 | `SETTLE` 45 frames, `HOLD` | The mover rule has no constant (a quad stamped outside a cut is a mover to the end of its shot: 5.5). `SHADOW.HOLD` is a ratio between two lights' worth — need: without it two lamps of like strength would swap the last slot every frame |
| C50 | a waiting static cell keeps its old content and placement | Need: rationing by count; late, never wrong |
| C51 | own-shader layers over the cap refused with a warning | An error of the scene's build (LG13); the cap fits every scene (10) |
| C52 | the cache's pressure rises 0.25 / eases 0.125 by cycles | Changed: a function of what is asked against the room (5.19); the same on every run |
| C53 | `pend`: a newer content three times running → said once | Out with `pend` (SH2) |
| C54 | coverage "1 where a draw's box holds the point" until the top is there | Out: coverage of a sheet not yet shown is 0 |
| C55 | a camera key set the tick after a cut belongs to it | Out: the same tick only |
| C56 | "`cores` unknown → 4"; unknown memory | One place, the page: `cores || 4` for the painters' count; an architecture not in the table is weak (the safe row) |
| C57 | 24 ticks, "every 15th tick" standing for time | The wheel's aim: 0.4 s by timestamps. `waits` every 15th step of a job apart: a count of work |
| C58 | `DT_MOST = 0.1` | Need: a stall is not caught up (A4); named in section 7 |
| C59 | the settle loops "until a pass takes nothing" | Need; it now ends by construction (2.5): drawn, or a fault when nothing is in flight |
| C60 | `LATE` 0.25 s → cloth put on at rest | Need: the one rule that replaced the cloth's modes |
| C61 | people in a ring posed twice at a new shot | Need: a ring has no order; two rounds, only its members, only at a cut |
| C62 | over 64 cloth controls: the last garment keeps the first | Out: controls are sampled so that a person's total fits (5.8) |
| C63 | paints' old names "stay accepted" | They are not old: the scenes use them; all stay (LG9) |
| C64 | a `_wear` change: the old figure drawn till the new is whole | Need (a build never runs in a tick); a whole frame waits for it (`f.wait`) |
| C65 | engine 1's `pause` by two clocks | Engines 1 and 2 are not touched |
| C66 | `SETTLED` 150 ms before a size is told | Need: the browser gives no "resize ended" |
| C67 | a render's page never pauses | Need |
| C68 | engine 1 keeps `prepare(values, seconds)` | Engines 1 and 2 keep theirs, in `stage.js`, untouched |
| C69 | `from()` evaluated twice | Out: the engine has no `from` |
| C70 | 6 casting lights declared, the 4 "that matter most" drawn | The engine chooses four (5.5) — by ruling 2-A6, so that scenes keep their shadows unedited; the price (a lamp's shadow can pass to another lamp as the view changes) is in section 7 |
| C71 | layers "counted by the loop's bound, else 8" inside a gate | Out: no gate, no counting by reading |
| C72 | an unknown mark "resolves at the motion's end" | Out: marks are not in this piece |
| C73 | `failIfMajorPerformanceCaveat` → throw | Out: engine 3 has no WebGL |

Of this design itself:
- `gpu.done()` awaited once a drawn frame — need: `seen`'s moment, the queue's depth and, at the half rate, the
  cost (5.1).
- A device lost: the page starts the thread anew once, when the scene is next watched (2.8) — one path, the page
  load's; a second loss before a frame is final.
- `timestamp-query` required for the stand's detail run only — an instrument on the stand's machine; taken where
  the adapter has it for the pacer (5.1), a device without it paced by the done.
- Words accepted without effect (LG5) — not a second path of the engine: the engine does nothing for them; the
  alternative was 800 mechanical scene edits for no change in any picture.
- The two places that name a scene's shader file name it by the scene's engine (RS5) — not a second path of an
  engine: each engine has one file name, and a version of a scene has one engine.
- Three engines beside one another — the owner's decision, with its reason (C2, C18): what is made keeps
  working while the new engine is debugged on one world. It is not a fallback: a scene has one engine, the one
  its spec says; where a device has no WebGPU an engine-3 scene says it cannot be shown and is not shown by
  engine 2.
- A blended fragment dropped at alpha 0 (5.17) — not a mode: every blended pixel goes that one way, and it
  changes no picture.
- The engine's limits kept and not got around (LG14): this section's rule turned to the authors.
- A form's `ground` fill (5.23) — not a prop: it is what makes "opaque" true by construction instead of a check
  that could fail at a build.
- Main's ray kept for the author's selection (IN6) — a known second model, kept by the coordinator's instruction
  for the editor only; the player's pressing does not use it.
- No test suites or test stages anywhere in the plan (the owner tests by hand); 5.11's check compiles the GPU
  programs and is not a test of behaviour.

---

## 7. What the viewer and the author will see differently — one list

An engine-3 scene compared with the same scene on engine 2 as it is now (`origin/main` at 30a8178, on dev too:
light at the vertices, one output, edges smoothed in the last pass, no coloured shadows, the resolution never
lowered; what a game offers pressed at a ring on the scene's point). In this piece that is «Вокруг света v3» beside «Вокруг света
v2»; for every other world, every game and every play nothing changes — they stay on their engines, as they
are. Every scene made from now on is engine 3's (1.6), so this list is also what every new scene is. The owner has watched engine 2 and named two flaws: parts shown blurred, and stalls at cuts — items 2, 3
and 9 are engine 3's answer to them. Boundary: "noticeably worse is allowed, much worse is not; people and action
always clearly read" (A13, A14). "In" = inside the boundary as far as reading can tell. "May cross" = could be
much worse or touches A14; who decides is named. LANGUAGE keeps this list as `docs/engine3/dropped.md` in the
owner's words (D14).

**The viewer**

| # | Change | Boundary | Who decides |
|---|---|---|---|
| 1 | An engine-3 scene — every new scene among them — opens only where the browser has WebGPU (Chrome and Edge on Windows with Direct3D 12 graphics, Chrome on Android 12+ with Mali or Adreno, Safari 26+ unproven; not Firefox on Android or Linux, not Samsung phones with Xclipse graphics, not Android's Advanced Protection mode). About one visitor in six gets "this device cannot show the scene". Scenes of engines 1 and 2 open wherever they open today | decided | the owner (W1) |
| 2 | Before a scene's first frame: a wait sign, then a finished picture — never a blurred one sharpening. By 5.21 about 2–4 s on the reference laptop (1 s for the lightest scenes) and 4–10 s on an ordinary phone, up to twice that in the heaviest scenes and in the three with huge paintings (the train, Сэвил-Роу, the jungle); the very first open on a device also compiles the engine's programs (estimated 2–10 s on the reference laptop, once) | in; no opening time is promised | — |
| 3 | Cuts: a cut the film or the game's film module could know ahead comes at once, finished (or after a short hold where its view did not fit beside the one before: item 8). A close-up opens finished, with no hold (where the views on screen fill the cache, a moment late, its opening then played from its start — never soft, never half open). A cut nobody could know (a game jumping to a beat it did not name), or one made before its shot was ready, makes the story wait — the director, the film, the voices — while the picture before it lives on (wind, particles, people breathing), under the page's wait sign once it lasts (2.4, the owner's decision of 2026-10-22) — about 0.4–2 s on the reference laptop, 0.4–3 s on an ordinary phone for a new framing; up to 3–6 s in two scenes whose cut repaints tens of paintings — then shows the new shot finished. A scene replaced inside a game keeps the one before it living, its film playing, till the new one is whole (2.9); a fade to or from black only where the game asks it (2.10). Never blurred, never the old paintings in the new framing. A script that waits for its shot before cutting (`s.until(() => shot.ready)`) holds nothing — the shot before plays on —, and once it has waited `WAIT.SHOWN` the same wait sign stands over that living picture until the shot is ready (2.3 step 5; no share done: nothing of a shot ahead is counted) | in; "may cross" where a game jumps often | the owner at the run |
| 4 | Frame rate: every refresh up to 100 a second (120 / 144 Hz displays: every second one); an even half rate while the device does not hold it, tried again after 4 s, then after 8, 16, … — ever more rarely. A phone whose display runs at 90 (the owner's Pixel 7) shows 90 or an even 45, never 60 | in | — |
| 5 | Below ten frames a second the film runs slower than its voices (a stall is not caught up) | in | — |
| 6 | Picture size: 1920 × 1080 at most on computers with a graphics card or recent integrated graphics; **1600 × 900 on laptops with older integrated graphics (the reference laptop)**; phones 960 × 540 for Mali graphics of 2022's generation and older (the Galaxy A53, the Pixel 7), 1280 × 720 for Adreno 7xx and newer; stretched; never lowered on the run. A 9th-generation laptop with one memory module: the heavier scenes at an even 30 | in — his numbers (E1); the rows are the plan's | — |
| 7 | A view within its budget is sharp. The picture stands under the wait sign only where nothing can live meanwhile — a scene's first opening, a seek, a jump of the camera, briefly a cut to a shot made ready coarser —, never while the camera moves on, whoever moves it (the viewer, the film, a script): what a move brings into view is a level soft for a moment, softer until the painters catch up where a device cannot keep up — and the stand fails a scene whose motion asks that of the device. A view that holds more paintings than the cache is never held: it is honestly, evenly softer, steady — not coming and going — and the stand fails its scene | in | — |
| 8 | A shot made ready beside a heavy view, or made ready coarser while its camera was riding something fast beyond what the painters keep up with, is held briefly at its cut for its finer pages (the heavier quarter of views on computers and laptops — the cache grown a fifth, the owner's decision —, the heavier half on phones; the jungle everywhere) | in | — |
| 9 | A moving camera: a pan's leading edge and a zoom's end are painted ahead; a move faster than the painters shows its newest strip one level soft for a moment, never held. Floors and water seen at a low angle are a little softer along the gaze than now; things drawn very small far off may shimmer a little | in; the first is the owner's flaw "blurred parts", much reduced, not zero | the owner at the run |
| 10 | Shadows: one softness; at most four lights cast at once, chosen by the engine (a lamp's shadow may pass to a stronger lamp as the view changes, and the new one appears a few frames late); a crown's shadow does not sway; a shadow's edge follows a painting's shape two levels coarser than the painting is seen; two things of unlike shadow strength near each other cast alike; far shadows a frame or two late while the camera travels | in | — |
| 11 | Lamp pools: sharp on floors and walls from the two key lights; soft from the others. A far small light begins to light things only where its pool is a few pixels wide; its glow is always there | in | — |
| 12 | No weather curtain (a blizzard is thicker air); nothing lit from the land below when flying (riders over snow darker). Not met in «Вокруг света v3»: one scene of the twenty, «Полёт», has them | in; may cross for «Полёт» | the owner, when that world is carried over |
| 13 | Mirrors: a small image (the rougher the mirror, the coarser), smeared along the mirror's way as `rough` says, with the path of light under what shines; a mirrored thing fades out with its height as `fade` says. No particles in them (a fire has no flame in the floor); no blur by a mirrored thing's height (`blur`): a pane shows the far side of a street as sharp as the near | in | — |
| 14 | Many alike things are `copies` of about twenty painted kinds, each with its own size, turn, flip and tint. Not met in «Вокруг света v3»: it is how the forest by the sea would be carried over | may cross (variety) | the owner said yes (L1a) |
| 15 | Cloth and hair: a few hinged strips, no shading of folds; at rest after a cut, a jump, a quarter second out of view; a still picture always shows cloth at rest — as the pose has it: over the thighs of someone seated, as wide as a stride needs (5.8) | in | — |
| 16 | After a jump along the timeline faces and springs are at rest. Particles are as the film has them there (smoke, flame, snow) | in | — |
| 16a | A falling particle that settles lands where its fall alone takes it: the wind's swirl moves it sideways, not into the ground | in | — |
| 17 | Clothes or things taken up that no shot made ready appear a few ticks late | in | — |
| 18 | Pictures that their own shader reads at another point than its own (a sun moved across a sky, a herd laid out by the shader), and drifting layers, are never sharper than about one screenful of pixels. A shader that reads its paintings where it stands is as sharp as any painting | in | — |
| 19 | A scene that paints its own light is lit by the engine instead: the hour's and the moon's colours come from light, not paint. Not met in «Вокруг света v3»: the two Asher scenes would be the most changed, and a game plays them | may cross | the owner, when that world is carried over |
| 20 | The timeline shows `≈` and an estimated length until the film has been played through once; during the first beat the total grows | in | — |
| 21 | An engine-3 scene stops (voices and music too) when the tab is hidden, the scene is scrolled out of view, or a viewer is open over it | in; wider than his "yes" (the hidden tab) | told to him (9b) |
| 22 | The page: plain dark panels instead of frosted ones over an engine-3 scene (over an old scene the page looks as it does) | in | — |
| 22a | **Pressing** — as on engine 2 today: every thing a game offers shows a round mark, a finger wide, at the thing's point — the same look everywhere; it is pressed by finger or mouse on any device, whatever the thing is (in the world, on the sky, in a close-up, a person, moving), and its actions open beside the mark. New: the thing itself breathes brighter, where engine 2 glows along its outline. A mark whose point is behind something nearer is still shown and pressable. | decided (the owner's principle) | the owner |
| 22b | Page layers (speech, menus, widgets, a game's own things) stand still while a picture is held and are at their new places with the new shot; behind a moving camera they trail by up to a frame | in | — |
| 22c | On a scene's page a click still selects a part of the scene (now also the sky and close-ups); the selected part is shown brighter, not outlined; an own shader's shape and a form are judged roughly | in | the coordinator (IN6) |
| 22d | **Forms**: a scene may hold rounded opaque things made by a function (a hull, a rock, a vault, a column) — lit as volumes beside painted flat sheets; their outline is of straight pieces when they fill the frame. None of today's scenes is changed to use them | may cross (two looks side by side) | the owner at the run |
| 23 | **The Android app does not show engine-3 scenes for now — so no scene made from now on** (its WebView has no WebGPU; the app is not part of this piece). Old worlds open in it as before | decided | the owner |
| 24 | Pictures of engine-3 scenes — of every new scene — are drawn by the studio on a machine with a graphics card. Pictures of scenes of engines 1 and 2 and motions' sheets: as today | decided (W2; his answer) | the owner |
| 25 | A wait sign after a seek ahead of what was played, and when the graphics device was lost (the scene comes back where it was, when it is watched again) | in | — |
| 26 | Old worlds, their games and plays: nothing changes. «Вокруг света v3» keeps its first versions as they were copied — engine 2's; they open on engine 2, and the comparing page shows a scene's two engines side by side | decided (beside) | the owner |
| 27 | Not built, said so that nobody waits for it: depth of field on close-ups; a person as a body; marks inside motions | — | — |
| 28 | Kept, against round 1: a silhouette's colours coming through in light; the rounded face of a faceted head; mirrors' `rough`, `ripple`, `fade`; coloured paints' names; lamps' shadows without marking lights; smoke fading softly into what stands behind it | — | — |
| 29 | A script that waits for `shot.ready` waits a few ticks when played — longer than `WAIT.SHOWN`, under the wait sign (item 3) — and none when the same moment is sought or rendered (as now). `ready` always comes, also for a shot of a camera that rides something fast | in | — |

**The author (agents and people who write scenes)**

| # | Change |
|---|---|
| 30 | In an engine-3 scene an element's shader is WGSL (`elements/<id>.wgsl`); `layer(0…9)`; own uniforms are `u_<name>` in the text; no derivatives (`at_dx`, `at_dy` instead); its error is said with the line. The 14 shader files of «Вокруг света v3» are converted in this piece |
| 31 | Against engine 2's language. New words: `copies`; `e.form`. Words accepted that do nothing, and the language's text says so: a caster's `soft`, a light's `size`, a mirror's and a pane's `blur`, a plane's `lit`. Not in it: `veil`, `light.people`, `scene.prepare`. An unknown word is said once |
| 32 | A shot has no seconds. A cut whose shot is not ready waits — the story with it (what the story does after the cut waits behind it; what it reads meanwhile is the state before it) — till the picture is whole: make the shot ready (`scene.shot`) wherever the cut can be known, as the film module now does for a game's next beat. A scene does not fade itself: transitions, dims and black are the page's and the game's (a scene has no `fade` key) |
| 32a | A camera key set at once is a new shot, shown whole. A camera that follows something moves its key over time; a script that set it every frame (free on engine 2) would make a shot a frame — a picture that stutters and a film that slows |
| 33 | Paint code runs apart from animate and scripts: it shares nothing with them but the state and what its painting declares |
| 34 | Setting a value it already has costs an animate nothing; an animate does not run for a closed insert or a person who is not here |
| 35 | Any number of lights; the engine chooses which light and which cast now |
| 36 | No content gate at a merge: the numbers are guidance, the stand measures. |
| 37 | **The engine's limits are kept, not got around**: a wish the engine does not support is not attempted and not imitated by tricks; an author who is truly blocked says so. For shapes: flat sheets placed anywhere at any angle, and **forms given by a function** (`e.form`; the kit's `bend`, `revolve`, `extrude`, `loft`, `lump`) — opaque, painted like a sheet, one painting, no layers or shader of their own. Not supported and not to be imitated: forms with holes, glass or translucent forms, raw meshes, imported models (on the list of what can come later, with: dimming a pressed mark that is behind something; pressing by a thing's outline) |
| 38 | **A thing to be pressed needs a point**: name it in the painting (`e.at(x, y, name)`); without one the mark stands on the point the thing marks as itself, else on the middle of its box (a thing of the sky must mark one) — as in engine 2's language. What must sort with the scene is a sheet in the scene, not a layer of the page. A mini-game glued to moving points while the camera moves is fragile — hold the camera still for it |
| 39 | A scene opens in the state it is opened with: its first beat's cut is made before anything is painted — nothing is painted for a state nobody sees |
| 40 | A scene is engine 3's when its spec says `"engine": 3`; its language is its own text (`scene_format()`, `scene-format-3.md`). **Every new scene is engine 3's**: a new world's main scene, `add_scene` and the site's artist stamp `"engine": 3`. A scene that exists keeps its engine and its language (`scene_format(engine=2)`, `scene_format(engine=1)`). Carrying a scene over from engine 2: `engine3-porting.md` |

---

## 8. The split into area specifications

### 8.1 The areas (files: 1.5)

Eight: GPU, SCENE, SHEETS, PEOPLE, RENDER, PAGE, SERVICE, LANGUAGE (the Android app is in none: 5.14). The GPU layer is used by every
engine area and has no natural owner among them; the world's tables are the seam everything reads, so their owner
(SCENE) is apart from who paints (SHEETS) and who draws (RENDER); the render service, its callers and the stand are
one chain the page does not share; the language's words live in the engine areas (3.10 says which), LANGUAGE owns
the text, the docs and the world carried over. Each area also owns its seams in the existing files (1.6): there
it adds the third choice and changes nothing else.

### 8.2 What every area's specification contains

Sections as `spec-howto.md` has them. And:
1. **Interfaces are quoted from this file by number** (PG…, GP…, RN…, WT…, SH…, PP…, ST…, BD…, RS…, LG…), not
   re-worded. An area that needs something this file lacks, or finds an entry wrong, puts it FIRST in its
   questions and does not assume. No "ASSUMED" may remain.
2. Its part of each sequence of section 2, step by step.
3. Its rows of 4.9 and its constants of 4.7 with their reasons; nothing device-dependent outside them.
4. For every decision the requirement ids it serves; for every loss the boundary applied (5.8's rule).
5. No test suites and no test stages: the owner tests by hand. The process rules its writers must be given (D4, D5, D9, D21, D23, D25): return with a contradiction instead of
   writing around it; nothing is run; commit and push each finished step to its own branch; nothing to `main`; never a deployment's branch (`env/…`), the database; a status line at least every half hour.
6. Its paragraphs for the one design document and the one history note (it writes no document of its own: 8.5).
7. Its lines for section 11.
8. For each of its seams (1.6): the lines as they are, the third choice as it will be, and why no path of
   engine 1 or 2 through the file changes.

| Area | Its specification must also contain |
|---|---|
| GPU | the text of `gpu/layouts.js` from 4.2 / 4.3; `assemble`'s rules; `gpu/check.js` and `test/gpu/check.mjs` (5.11: what is created; the frame is encoded by RENDER's `lib.exercise`); the dummy canvas view of GP1; how a compilation message is mapped to a chunk and line; what `gpu.memory()` counts |
| SCENE | the tables' growth, row reuse and the stamp rule; the opening's order (2.2 step 4: state, film, the first step, then the artist); forms — the kit's five constructors, the grid, its normals, the texture `forms`, `place` and the chunk for FORM (5.23, WT10); the mapping of every kind in JS and WGSL (WT6); `f.toward` `host.ahead` on, prefetch only (`director.ahead`, placed again every `host.ahead` / 2 of scene time, as it begins and at a new shot); the insert's opening shown the smaller of its delayed move and its key; inserts' iris and opening — the opening shown only once the insert is finished, its move run from then (WT5, RN4); points for everything, the frame's things too (IN1); the bits `OFFERED` / `SELECTED` and `quadGlow` (IN3); main's ray for the author's selection, with the sky and inserts in it (IN6); the step function line by line; the pacer (5.1) as code-ready text; jobs apart; shots and cuts (2.3 step 6's rule of what is not painted again; no swaps while `f.whole`), the opening's view asked during the build (2.2 step 5), `f.toward` for each camera mode, the showcase and its estimate (5.10); the director — what of main's design is kept (actions on tracks, coroutine sequences, save / restore, `instant`: designed the same anew) and what changes (shots, emitters' histories in the save); every camera mode on RN5's Camera; `place` and its WGSL twin; `spec.js`'s closed lists of words (LG5, LG13) and `C.has`; which animates run (5.16); the emitters' rings as data (WT5); the messages, `lost` among them (PG14); `kit.js` as engine 3's own module; the land's field and floors |
| SHEETS | `e.form` in the easel (the sampling, the refusals, the `ground` fill) and the ask of a FORM by blocks; `sheets.weigh` (SH12); `Sheet` and `SheetCarry` (SH14); the `coarser` of a view; the display list (a flat list with a box tree, replayed per page — designed the same anew; f9c3887 on `engine2-r2-thread` is a draft that by its own message does not run and whose check does not pass: knowledge, not a proven base; main's recorder is the one that works), its runs for long paths and the proof of 5.6's exactness; images in a recording; the Canvas calls of SH8 with the filter's unit; the artist and the easel; the table's scheme on a storage buffer; the ask per kind of quad, the "whole" rule; `solid` per page and sheet, `sheetEmpty`; the pressure (5.19: settled before anything is sent in a whole call; the bias's end) with the proof that a render's frame converges; `host.busy`; whether tops get a mip chain (11.17); the painters' CPU canvas and byte path; coarse to fine (a page's parent named first), the fall by a probe with its no-turning proof in node, the bias drawn only once placed, and `sheets.cycle`'s fields (SH10–SH13) |
| PEOPLE | `PERSON_KINDS` whole (text and buffers) with `PersonIn`, `PersonCarry`, `personNode`, `personSlot`, `personGlow` (PP9); `exercisePeople` (PP10); `layouts(gpu)`; `people.mark`; bones, morphs, the person's uniform; cloth and the sampling rule of 5.8; the model per look; `root`; motions made ready at the build (what the cloth thread did on main); what of main's people code is kept (the player, the rig, the figures' drawing API, the wardrobe, garments' fitting) |
| RENDER | forms: the detail by stride, normals in the light, the solid list always, the sphere cull (5.23); the insert that covers the whole stage and the closed insert asked ahead (RN4); a call without `f.whole` never held (RN4); shadow views two levels coarser; a mirror's own clip mask; the `panes` texture; the fault of a held frame (RN12); shaders free of long unrolled loops and of variants (5.21); every pass of 4.4: its pipelines, what a vertex and a pixel read, its load and store; 5.17's solid and blended lists with the coplanar rule, the depth bias and the dropped pixels; a run's break on pipeline or shape (4.1); the solid insert (RN4); `ahead.shown`; `lib.exercise`; the emitters' buffers and their re-basing (WT5); the lit set, the grid and the two-key-lights rule; 5.5 (a slot that changed light) and 5.7 in full; the shapes in one buffer; own shaders (LG2): the wrapper, the `e_` prefix, `u_` uniforms; land, sky, particles (5.18), air; the canvas pass; its own check of 5.17's bytes a pixel against what its passes really read |
| PAGE | the wait sign over a held picture (2.4: the opening's own sign, after `WAIT.SHOWN`, standing at least `WAIT.LEAST`, the voices and music paused under a shown hold, with the share done from the largest `waits.pages` / `pipelines` seen since the hold began; for a cut, a scene replaced, a seek) and over a living one while the story waits on a shot (2.3 step 5: `waits.shot`, the sign alone); the circles of offered things (IN2: a round button at a tracked point, `PRESS.SIZE`, stacking by depth), `bespoke.where` / `onFrame` / `pointer` (IN5), `stage.cover` and the list of the site's layers that cover; `show` with `start` (2.2); the author's selection as it is (IN6); `page.js` (the tier and its table `TIERS`, messages, `lost` and the restart when watched — with the tracked points told again —, pause, points kept for `screenOf`) and `stage.js`'s third branch (1.6 row 1: each place, what it hands over, how `page.js` is given the stage's closure, how what is asked while the thread starts is kept); the third branches of the layers and of `bespoke/play.js`, `core.js` (rows 2–4); the bar while the length is 0 (5.10); the layers on `onFrame`; styles (S10: nothing blurred or animated for ever over a scene; bounded indicators may animate) and the mark they are keyed on (5.13); widgets, speech pop-ups and menus named as kept (W3); `bespoke/play.js`; what "covered" is — `Moood.cover` is not on main: which of the site's overlays cover a scene, so that a game's own overlay does not stop its voices by surprise. Nothing of the app (5.14) |
| SERVICE | a render's uses of the page (RS3, RS4); the stand (profiles `desktop`, `laptop`, `phone` through `__mooodDevice`; runs; judged from ST2's rows — the view's weight among them: soft run by the cache and by motion (the tier's painters as a queue), pages again, insert late; a noisy run marked); naming the shader file by the scene's engine (RS5); `render.html` and `stand.html` (row 5) |
| LANGUAGE | forms for authors: `e.form`, each constructor with how its painting lies on it, what an element with a form may not have (LG15); pressing: a thing to be pressed needs a point (LG16); the one text of engine 3's language to 3.10, complete in itself (8.5) — with the principle of keeping the engine's limits and its instance, flat sheets and forms by function (LG14), in `scene-format-3.md`: a principle in the spirit of the game, generic, without cases from our scenes and without micromanaging —, and one line for each word of LG5; the docs of 8.5 (the guides of older scenes gain the third engine and lose nothing); «Вокруг света v3» as 5.20 has it — the copy, the 14 shader files converted by LG2's table, the edits per scene, the film module's game path —, each keeping every id, point, key and tell; `engine3-porting.md`; the guidance (5.12); `dropped.md` (section 7's list; among what can come: forms with holes, translucent forms, raw meshes, imported models, walking on a form, dimming a mark behind something, pressing by a thing's outline) |

### 8.3 The order of work — all of it written, then reviews, then pictures

Nothing is staged. There is no stage in which a part of engine 3 works and the rest waits, and — engines 1 and 2
being untouched — nothing has to keep working meanwhile.

**1. All eight areas are written, in full, at once.** Eight writing jobs side by side, each in a branch of its
own begun from the work's branch (8.2 item 5). Each writes its files of 1.5 and its seams of 1.6 completely: no stub,
no part left for a second pass, no "later". No job waits for another's file and none needs to ask another — what
crosses between them is fixed in this file:

| Between | Fixed by |
|---|---|
| PAGE ⇄ SCENE | PG1–PG14, IN1–IN6; the message types of 4.7 |
| every engine area ⇄ GPU | GP1–GP11; the layouts of 4.2; the formats and samplers of 4.3; 4.6 |
| SCENE ⇄ RENDER | RN1–RN12; the world's tables WT1–WT10 and their GPU layouts (4.1); the chunk `world`'s names (WT6) |
| SCENE ⇄ SHEETS ⇄ RENDER | SH0–SH14; the chunk `sheets`'s names (SH14); the level's formula (4.8) |
| SCENE ⇄ PEOPLE ⇄ RENDER | PP1–PP11 |
| SCENE ⇄ SERVICE (the stand in the thread) | ST1–ST3 |
| SERVICE ⇄ PAGE (what a render and the stand use of the page) | RS4; `__mooodDevice` (PG13); 1.6 row 5 |
| files, addresses, imports | 1.5's paths; BD1–BD4 |
| LANGUAGE ⇄ the engine areas | LG1–LG16 and the own shader (3.10); section 7 |
| LANGUAGE ⇄ SERVICE (a scene as files) | RS5 |
| numbers | the constants (4.7), passes (4.4), pipelines (4.5), tiers (4.9) |

A module is imported by the path 1.5 gives it and used by the names of sections 3 and 4, whether or not its file
is yet in the importer's tree. That holds for the modules several areas import — GPU's `wgsl.js`, `layouts.js`,
`gpu.js`; SCENE's `base.js`, `world/tables.js`, `m34.js`, `place.js`, `world.wgsl.js`, and the three the artist
shares, `world/spec.js`, `kit.js`, `relief.js` (WT9) — and for RENDER, which includes the chunks of SCENE, SHEETS
and PEOPLE by the signatures of WT6, SH14 and PP9. LANGUAGE writes the language's text and the docs from 3.10
and section 7, and prepares «Вокруг света v3» (5.20) — the conversion's branch with the rest, not after it. A
writer that finds an entry here lacking or wrong stops and returns with it (8.2 item 1); it is mended here, for
everyone.

**2. Reviews.** The eight branches are integrated into the work's branch; `design.md` and `contracts.md` are written
from this file (8.5). Then, once, the whole-set checks of 5.11 — `node --check` over every module, the GPU
programs through Dawn. Then a review of everything by reading: each area against its interfaces here; every seam
of 1.6 against "engines 1 and 2 to the letter"; the language's text against the engine; the converted scenes
against the language. Everything the checks and the review found is mended in one batch; the checks once more.
(W8, D8, D9.)

**3. Pictures.** The five scenes of «Вокруг света v3» are drawn by the studio on a machine with a graphics card
from the clone of the conversion's branch, each held against its engine-2 picture; the stand measures them there. What the pictures show wrong is collected over
all five scenes and all areas, mended in one batch, and drawn again — whole rounds, never a loop over one scene
or one shader (D9, W8). Nothing is rendered locally and no stack is needed for a picture (D24).

**4. The owner's look.** When the pictures are good the conversion is merged on the work's stack (5.20)
and the owner looks at the world there, in his browser. The branch goes to `main` and to dev on his word (D21).

### 8.4 What of the existing code happens to fit (looked at after the design; nothing here is a reason)

Taken as text into `engines/3/` and engine 3's own from then on — never imported, never moved, the original left as it
is (1.7).

| Area | Fits — and where it is | Does not |
|---|---|---|
| SCENE | the director's logic (actions, tracks, sequences, save / restore, `instant`), the camera modes' arithmetic, the spec's compile, state, the emitters' rings — main's engine 2 (gone) | the world as three's objects; the loop and the clock's bookkeeping; rehearsal; the kit fetched from engine 1 |
| SHEETS | main's `paint/table.js` (the block and window arithmetic), `paint/page.js` and its recorder; the flat display list's ideas from f9c3887 (`engine2-r2-thread`; unproven) | feedback; the cache's growth; conversion on the GPU; coverage tiles; `travel` |
| PEOPLE | main's motion player, rig arithmetic, figures' drawing API and wardrobe, garments' fitting, the drawn face | three's meshes and skeleton; the cloth and its thread; the people's own light; `body.js` |
| RENDER | the arithmetic of main's light model, haze, sky mapping, land tree, particles' closed forms, frame's end — as formulas to be written in WGSL | every GLSL file; every use of three; data textures; integer targets; the shadow atlas with ids |
| PAGE | the stage and layers of commit 2a96d3c (`engine2-r2-page`; 17f0e72 above it is the music and the viewer) — without its hunks to engine 1 | the page projecting points for engine 3; per-key messages |

### 8.5 The documents of this work (D20, B14)

| Document | Where | What it covers | Who writes |
|---|---|---|---|
| the design and the contracts of engine 3 — for whoever works on the engine | `docs/engine3/design.md` (from this file's sections 1, 2, 5–7), `docs/engine3/contracts.md` (sections 3–4); the folder's `README.md` says what each file in it is. This plan, its requirements, rulings and studies stay in the folder beside them | the threads and the tables; every sequence; every interface by its number; the shared names; the seams with the older engines (1.6) and what is shared (1.7); the decisions with their reasons. **Written** (2026-10-14): `design.md` — the engine as it is, short, pointing into this file; `contracts.md` — every interface as the code has it, by this file's ids, checked against the code (where this file differed, it was corrected). A change of an interface or a number changes this file and `contracts.md` in the same commit | the integrator, at step 2 of 8.3 |
| what is not built and can come | `docs/engine3/dropped.md` | section 7's list in the owner's words; forms with holes, translucent forms, raw meshes, imported models, walking on a form, dimming a mark behind something, pressing by a thing's outline, and the rest of 3.10's "not in this piece" | LANGUAGE |
| the history note | the studio's history — one note, as short as the notes there are; a later round of mends gets a note of its own only if it changes how the work is repeated | what was done and how, so that another agent can repeat it: the decision (beside); the folders and the seams touched; how «Вокруг света v3» was copied and converted (the tools called, the branches); that a new scene is engine 3's and what a deployment needs for it; how the whole-set check is run; what the pictures showed and what was mended | LANGUAGE, from each area's paragraphs (8.2 item 6) |
| the language of engine 3 — for the agents that draw scenes | `docs/worlds/scene-format-3.md`; served as the MCP's `scene_format()`; published as `scene-format-3.md`; what the site's artist draws every new scene from | complete in itself — an agent reads it and nothing of engine 2's text: the spec with `"engine": 3`; every word of 3.10; the own shader in WGSL; forms; a thing to be pressed needs a point; shots and cuts; the guidance numbers of 5.12, each with its reason; one line for each word of LG5; the principles of LG14 and LG16; the owner's later words on the craft (B14) | LANGUAGE |
| carrying a scene from engine 2 to engine 3 | rpg's docs (now the studio's) | that it is done on the owner's word, in a copy of the world, as 5.20 did it; the kinds of edit (5.20); LG2's table for shaders; what will look different (section 7); how it is checked — pictures on the GPU machine beside the engine-2 version, the stand | LANGUAGE |
| the guides every agent reads | rpg's docs (now the studio's), `principles.md`, `people.md` | three engines and how a scene says which; the repository's layout with `elements/<id>.wgsl`; that an engine-3 scene's pictures come from the GPU machine; that every new scene is engine 3's and where its text is (`scene-format-3.md`, `engine3-porting.md`). Nothing these guides tell the authors of engine-1 and engine-2 scenes changes in meaning (the coordinator's ruling): what the owner's later words changed (B14: "nothing is simplified" → A12–A14; the 30-second beats rule out; "no fades" a wish; the merge gate out — W7), LG14 and LG16 as principles and what engine 3's people lack are written in engine 3's text only | LANGUAGE |
| the words of the tools | the MCP server's instructions and tool descriptions | when a scene is engine 3's; where its pictures are drawn | LANGUAGE, SERVICE |
| the repository's docs that name the engines | rpg's docs (now the studio's) | engine 3 named beside the two, with a pointer to `docs/engine3/` | LANGUAGE |

---

## 9. Open questions

### 9a. For the coordinator — each with my answer and what it hinges on

1. **The author's selection on a scene's page** (IN6) is kept as main's ray, for the editor only, with two
   mends (sky and inserts in the search; shown by brightness). It is a second model and judges own shaders,
   moved layers and forms roughly. Used by the world's page (the chat is told what is selected), the free and
   the asked play pages. If it should be exact, the cure is a layer of ids drawn on demand at the pointer (a
   dozen pipeline variants and a read-back) — not planned.
2. **The owner's own phone lands in the 960 × 540 row** (PG13) — the owner said OK (2026-10-11). Had he objected, the row becomes 1280 × 720 for all
   `valhall` and the Galaxy A53 class plays heavy scenes at an even 30.
3. **`rg11b10ufloat-renderable` is required** (4.6). Confirm.
4. **The huge paintings** (the train's `near`, sevil-rou's `road`, dzhungli's foliage) add seconds to their
   scenes' openings (5.21). Not edited.
5. **The film module's edit** (5.20) makes ready the beat that is next in the film's table. A game that jumps
   elsewhere meets 2.4's hold unless it sets `beat_next` — an edit of the game. By the Asher game's chapters (the
   fresh read) the guess is right for most cuts and wrong at the player's branches, a handful a chapter. The
   game always knows its next beat: setting `beat_next` there is the cure, and it is outside this piece (the
   owner: not now). Such a hold is shown as loading (2.4).
6. **Pages kept in the browser between visits** stay unbuilt (5.21): they help the second visit only. With the
   opening now at 2–4 s / 4–10 s by main's measurements, this is the one structural lever left if the run shows
   the wait too long.
7. **The cache's allowance** for shadow views and mirrors (5.19: one layer a tier) is stated, not
   counted — the count's script has no shadow views; nothing was run.
8. **Events inside a motion are not built** (rulings 2-C2, 2-C3): 883 `s.wait` stay.
9. **The whole-set check** (5.11) runs in node on Dawn's GPU-less backend; where it runs is yours. It is the only
   thing run before the owner's hands; no test is planned.
10. **The cache on phones** is 163–235 MB and is not grown with the computers' (5.19): what a tab may hold on a
    4–8 GB phone is unknown (11.7). Measured on a phone, it is grown to 16 and 11 layers if the room is there.
11. **Which branch of «Вокруг света v2» is copied** (5.20 step 2). Ruled: the world is made on the stack
    the work's branch. Open: the tree to copy — the stack's own branch of v2 if the stack has that world, else
    `env/dev` of v2's repository. Yours to name; the edits of 5.20 are counted on `env/dev`
    at 2e970059 (11.22).
12. **An open fault on dev** ("ашеры не запускаются, игра", after the merge of 478f6ea) is not this plan's.
13. **The arcade of «Мэдлин проходит»** stays as made (your decision); with forms its generator could make 17
    bends instead of 136 strips. Not planned.
14. **Engine 3's side of the stage is a module of its own** (`engines/3/page.js`, loaded by `stage.js` with
    `import()`; 1.6 row 1) — confirmed by you; every third branch of `stage.js` is listed under 1.6's table.
15. **Pressing follows engine 2's language as it is on this branch** (your ruling): the rings of `actions.js`,
    `id@`, the same point where a thing is pressed (3.11). One thing the design had otherwise and now has as
    engine 2 does: a press opens the thing's menu of actions even when it has one action (the design had "one
    action: it is done"). If the owner wants the single action done at once, it is a change of `actions.js` for
    both engines — his to ask.
16. **`copies` and forms have no user in «Вокруг света v3»** (5.20): they are written in full with the rest and
    come out of the whole-set check and the review, but no picture of this work shows them. The same for the
    film module's game path (no game plays on the world).
17. **B14's corrections** go into engine 3's text only (your ruling): the guides the authors of older scenes read
    gain the third engine and change in nothing else.

### 9b. For the owner — nothing to answer; things to know

Both questions are answered (old worlds' and motions' pictures stay as they are; the app is left out for now).
What remains is to be told, one line each, in plain words:

- Новый движок — третий, рядом с первым и вторым. Все старые сцены, миры и игры работают как работали: в них
  ничего не меняется. На новый движок переносится один мир — «Вокруг света v3», копия «Вокруг света v2»; на нём
  всё отлаживается. Картинки для проверки рисуются только на облачной машине.
- Сцена открывается так: знак ожидания, потом сразу готовая картинка, без размытой. По замерам нынешнего движка
  это около 2–4 секунд на слабом ноутбуке и 4–10 секунд на обычном телефоне; самый первый раз на устройстве
  дольше — собираются программы для видеокарты.
- Если игра прыгает к месту фильма, которое заранее не назвала, старая картинка замирает на 0,4–2 секунды
  (на телефоне до 3) под индикатором подгрузки, как при входе в сцену, потом сразу новая. Игр на третьем движке пока
  нет; когда появятся, это будут развилки по выбору игрока (в «Ашерах» — несколько на главу). Лечится в самой
  игре: она называет следующее место заранее.
- Нажатия — как сейчас во втором движке: у каждой вещи, которую игра предлагает нажать, на её точке стоит кружок
  размером с палец; новое только то, что сама вещь «дышит» яркостью вместо свечения по контуру. Кружок виден и нажимается, даже если точка за
  чем-то спрятана — приглушать такие кружки можно добавить позже.
- Выделение части сцены щелчком на странице сцены оставлено как сейчас (по лучу), только небо и крупные планы
  теперь тоже выбираются; выделенное подсвечивается яркостью. Точным его не делали.
- Объёмные формы: рядом с рисованными плоскими листами появятся освещённые объёмные вещи — это два разных
  вида в одной картинке, оценить можно только глазами при запуске. Край крупной формы вблизи — из коротких
  прямых кусочков.
- Тени читают рисунок чуть грубее, чем он виден (на два уровня) — иначе им нужна была бы своя большая память.
- Что видит зритель. **Разрыв** — открытие сцены, склейка, перемотка, скачок камеры, смена сцены в игре: старая
  картинка стоит под «сцена готовится» (с прогрессом, не меньше полсекунды, голоса и музыка ждут вместе с ней), потом
  сразу готовая новая. **Непрерывное движение камеры** — твоё (тащишь, колесо, наклон, клавиши, платформер) или
  самой сцены (фильм, сценарий, оператор, камера за кем-то): никогда не останавливается. Только что открывшееся место
  на миг на уровень мягче (грубый уровень грузится первым); если устройство не успевает и так — мягче, пока
  рисовальщики не догонят, и такую сцену проваливает стенд при написании. **Быстро летящее по экрану** движок
  отдельно не огрубляет (ты так решил 15 октября): оно показывается так же, как всё остальное, — чего ещё нет,
  то на миг на уровень мягче, из более грубого, пока рисовальщики не догонят.
  **Сцена тяжелее бюджета** не ждёт (такое ожидание не кончилось бы): она честно и ровно мягче, и стенд её проваливает
  — её исправляют при написании.
- Память под страницы увеличена на пятую часть на компьютерах и ноутбуках (+90 и +72 МБ, как ты решил): там склейка к
  заранее готовому кадру коротко ждёт только у тяжёлой четверти видов, и бюджет автора вырос на пятую часть. На
  телефонах оставлена как есть: она и так самое большое, что держит вкладка, а сколько можно взять, не теряя
  видеокарту, на телефоне никто не мерил — рисковать вылетом ради более короткого ожидания на части склеек не стоит.
  Там склейки коротко ждут у тяжёлой половины видов. Если замер на телефоне покажет запас — увеличим.

- В новом движке не будет библиотеки three.js: её рендерер под WebGPU не принимает наши шейдеры и медленнее.
  Первый и второй движки остаются на three.js.
- На ноутбуках со старой встроенной графикой Intel картинка будет 1600 × 900. Если в таком ноутбуке одна планка
  памяти, тяжёлые сцены пойдут на ровных 30 кадрах.
- На телефонах с графикой Mali поколения 2022 года — это и обычные телефоны вроде Galaxy A53, и твой Pixel 7 —
  картинка 960 × 540. Экран на 90 Гц покажет 90 кадров или ровные 45, но не 60.
- Сцены нового движка не откроются примерно у каждого шестого посетителя (нет WebGPU); работа на айфонах не
  обещана.
- Сцена нового движка останавливается не только при скрытой вкладке, но и когда её прокрутили за край экрана или
  поверх открыт просмотр.
- Наборов тестов в плане нет: проверяешь руками ты.
- Люди «телом» (способ рисовать людей, которым не пользуется ни одна сцена) сейчас не делаются.
- Приложение на Android сцены нового движка пока не показывает.
- Каждая новая сцена теперь сразу третьего движка. Поэтому её картинки рисует только облачная машина. Новая сцена не откроется там, где нет WebGPU, и в приложении
  на Android. Старые сцены остаются на своих движках.
- Эта работа нигде не проверяет ни ноутбук с Intel 9-го поколения, ни телефоны: их плавность — расчёт, а не
  замер. Проверка в конце идёт на облачной машине, она намного быстрее; на ноутбуке её смотрят в браузере, когда
  картинки с облачной машины будут хорошими.

### 9c. Built (2026-10-15, branch `e3-next`): the scene's thread toward its budget, cuts as short as main's

**Built:** 1a–c, 2, 3a and 4 as option B (the owner's choice); the contracts carry them (`contracts.md` 4.2, 6.4–6.6)
and SH10, 2.3 and 5.17–5.21 above say so. Measured in the offline harness (history note
`2026-10-15-engine3-next-build.md`): the train's frame asks 3.0 → 1.2 ms, `main` 1.6 → 1.0 ms; JS median train
8.9 → 7.3 ms, `main` 6.6 → 5.9 ms; `ask` thrown out of optimised code 1224 times in 40 s → 0 (by the comparison);
the train's opening sends 820–880 → 680–710 pages. Found while measuring, not in the plan: in a held frame (a whole
call) the film's next beat at weight 1 shared the painters with the frame — `main`'s opening sent ≈ 300 more pages
and drew ≈ 0.2 s later in the harness; so in a whole call it asks at 0.5. The plan as it was written follows, as the
record.

These come from the stands of 2026-10-15 (T4, 1080p, three profiles, 1 painter of 4:
`engine3-renders/<scene>/e3-b3*` against `main-now*`). The causes were found in the code and measured in the offline
harness (Dawn without a GPU, `run.mjs` with the stand's detail rows; median of drawn ticks on the train, desktop
profile). Holds only at breaks, and nothing about motion LOD changes. The work goes in this order, and the whole
of it is written before the one short stand that proves it (8.3).

1. **Asks: do less, three causes.**
   a. *An own shader's further sheet is asked twice.* A READ row is in a view's list (`render/quads.js:543`
      lists every admitted row, and the READ test at :544 only keeps it out of the draws). The ask then works it
      out as a listed item (`sheets/ask.js:721` → `withOwn` → `one`), and again as its base quad's further sheet
      (`withOwn`, :660). Fix: in the ask, a listed row whose own slot has another base is skipped; its base asks
      it, and when its base is not seen, nothing asks it (as SH10 already says). On the train this was 2 of 5 sky
      descents and 3 flat ones. Frame ask 3.8 → 2.75 ms; shot ahead 0.64 → 0.46 ms.
   b. *A further sheet that lies as its base does is worked out again.* Pages are the same (L, i, j) when the
      further row has the base's kind and node, is READ and not WHOLE (`world/place.js:96`: such a row ignores
      its layer's pose), neither is flipped or bent by the wind, the base has no layer, no swap waits on either,
      and the two sheets have the same layout (l, t, r, b, W0, H0). Fix: the base's descent records its names, and
      each such further sheet names the same pages. This is exact, not an estimate. Sky descents 3 → 1 (the
      train's sky is one shader over three sheets, at level 0 on 1080p, where it needs level ≈ 0.9). Sky nodes
      744 → 248; frame ask 1.8 → 1.5 ms.
   c. *The margin costs more than it gives.* While the camera moves (`render/renderer.js:582`), every cut piece
      is looked at twice (`sheets/ask.js:373` `looked`) and the descent goes 1/8 further on each side. Frame ask
      2.75 → 1.8 ms. It also feeds the painters' queue, which on the train is already over the painters' rate
      (366 pages first wanted in a second against 120). Measured without it: pages lacking on drawn ticks were
      49.6 against 53.9 with it, so it bought no sharpness. Fix: drop the margin (`View.margin`, `NAMED.MARGIN`,
      `FOR_MARGIN`, the double look). A pan's leading strip is then read one level soft for a moment, from its
      parent. A known path stays fed by `f.toward`.
   Together: the train's frame asks 3.8 → 1.5 ms (nodes: sky 1640 → 248, flat 1146 → 520); `main` 2.2 → 1.3 ms.
   Harness JS median: train 10.4 → 7.7 ms (and it now runs at 60), `main` 8.2 → 6.3 ms. Expected on the stand:
   train desktop 11.6 → about 8 ms. **That is not 3 ms.** What remains (harness profile after a–c, per tick):
   recording the passes ≈ 1.8 ms (people's draws ≈ 0.65 and their movers' shadows ≈ 0.5: buffers and an index
   set again for every draw), pages placed ≈ 0.7, asks ≈ 2.9 with the shots ahead and `toward`, land ≈ 0.35, the
   step ≈ 0.8 (people ≈ 0.4). The next pass profiles again after a–c and states the next cause the same way.
   Proof: the harness counts (ask nodes and names by kind, `STAND=detail`), then one stand.
2. **Allocation on desktop: a deopt loop.** `sheets/cache.js:851`, `V.drawn = begins || all || missing === 0 ? …`:
   the comparison sits behind a short-circuit, so it often has no type feedback when the function is optimised.
   V8 then throws `ask` out of optimised code again and again (`--trace-deopt`: 18 times in 15 s, "insufficient
   type feedback for compare operation", bytecode of that line). Each time, the asks inlined into it run
   unoptimised and box their doubles. That is the stand's top on desktop: `at — sheets/ask.js:178` 10.5 MB in
   10 s, `seen`, `shown`. Fix: work out `missing === 0` before the branch, the same mend as 7cc461e. Measured in
   the harness: 0 deopts of `ask`. Expected: the train's 97 KB a frame back to main's ≈ 52 or below, and the 7 ms
   GC pauses with it. What stays after this is `record — sheets/cache.js:444` (3.7 MB): records forgotten after
   one cycle unnamed and made again (`:1052–1060`). It shrinks with 1c (margin names flicker at the edges);
   measure it again before changing anything there.
   Proof: `--trace-deopt` in the harness, then the stand's `allocated a frame` and `GC pause`.
3. **Breaks hold longer than in main: two causes, one to mend.**
   a. *A held frame waits for parents.* Every own page is named with its parent (`sheets/cache.js:744` `name`),
      and both are counted as missing (`:843`). In a held frame nothing is shown until all of it is there, so
      the parents serve nothing, and they go to the painters first. Fix: in a whole call (`all`), no parent is
      named. `all` joins the view's "everything changed" test (`items`, :780), so items are worked out again
      when it changes. Harness, the train's opening: pages sent 804–812 → 683–697 (−14 %); its three cuts
      5–25 % shorter (4 painters).
   b. *The frame is sharper than in main, so a cut that was not made ready paints more before it releases.*
      Desktop has 29 layers at bias 0, against 24 at bias 1; the train's phone sits at bias 0, against 12 (the
      probe's fall works now). This is the bigger cache and the fall doing their work, so it stays. Told here so
      the remainder is not taken for a fault.
   Expected: unprepared cuts ≈ 15–25 % shorter; the rest of the gap to main is 3b, plus 4 for prepared cuts.
   Proof: the stand's `cut` segment and the film's cuts' ms against `main-now`.
4. **A known cut's shot is starved (the owner's decision).** A shot ahead asks at weight 0.5
   (`render/renderer.js:274`). The painters' list ranks by weight × levels lacking (`sheets/cache.js:1025`). On a
   riding camera the frame's own backlog never ends, so the shot gets no painter. Its `coarser` rises to
   `BIAS.MOST` (`render/renderer.js:342`, the harness: ready at bias 16), and the cut then holds for ≈ 240 pages
   (prepared cut late 23 / 19 / 3 frames against main's 3 / 6 / 10). Options:
   - **A.** Keep it. The visible frame first; a prepared cut holds while the camera rides.
   - **B.** A shot that is the film's next beat (the one `f.ahead` is made for by the film) asks at weight 1, like
     the frame. Then a frame page that lacks one level (its parent is there, so it shows one level soft) ranks
     no higher than a shot page that lacks two or more, and the shot gets painters. Cost: in motion the frame
     stays one level soft a little longer, which the owner judged invisible on 2026-10-15. A held cut is visible
     (the picture and the voices stop).
   - **C.** Raise the shot's weight as its beat nears. This needs a time to the cut that a game does not
     always know: more code, and not exact.
   **Recommended: B.** One number, and no new mechanism. Proof: prepared cut late ≤ main's on the three profiles,
   with `soft run` not worse.

---

(There is no section 10: it held the validations' findings and where each was closed — history, not kept.)

## 11. Unchecked — what this document rests on and could not be checked by reading

Settled and struck: that the render machine gives WebGPU its real adapter and a right screenshot, and has
`rg11b10ufloat-renderable` and `timestamp-query` (the probe); where a shader file gets its name; at most 30
uniforms a shader; what the Asher game reads (`env/dev`); no timers or real time in scene code; one network between
the services; the strings of `adapter.info` and that Chrome gives a
page only `vendor` and `architecture` (read in Chromium's and Dawn's source); that the npm package of Dawn ships
the GPU-less backend in every prebuilt binary and that it validates WGSL, layouts, pipelines, encoding and submit;
that Chromium skips a worker canvas's display callback when two of its frames are pending; how much of a view is
blended and how many pages it needs (counted over the 20 scenes); that the libs' top-level tables are not shared
between paint and animate; what draws a motion's sheet. The numbers once listed as "taken from round 1" (cloth,
land, the shadow atlas's fit) are this design's constants.

**Not verified inside this piece, by the owner's decision: the reference laptop and every phone.** Items 2, 4–7
stay arithmetic or unknown through the whole work.

1. A page's raster time on the new path: 5.21 takes main's measurements (4–10 ms of wall time a page with four
   painters, on the stand) and allows for main's throttles; the allowance is a judgement. Paint code's time is
   an estimate.
2. **What a frame costs on the reference devices.** No per-draw or per-frame number for WebGPU on Intel 9th-
   generation graphics or on 2022 phones is published; 5.17's bytes and cycles a pixel are estimates; the cost of
   storage-buffer reads in the vertex stage on Mali and Adreno is unmeasured; particles' fill is not counted.
3. That the page's and the worker's `requestAdapter()` name the same adapter.
4. How late `queue.onSubmittedWorkDone()` resolves (Chromium polls for it; 1–4 ms by its source) — it decides only
   when the half rate is left (5.1's slack) and the moment `seen` replies.
5. That the pile-up of a worker canvas's frames follows the GPU's lateness for a WebGPU canvas (the callbacks'
   back-pressure is in Chromium's source; the link is an inference). 5.1's second witness covers it either way.
6. The first open's pipeline compile on the reference laptop (which compiler its driver gets; seconds or tens of
   seconds); that Chrome keeps compiled WebGPU pipelines between visits is study-webgpu §2's statement, not
   re-read.
7. Android: device loss when Chrome goes to the background; how much GPU memory a page may hold on a 4–8 GB phone
   (the cache is 163–235 MB); which core a worker runs on.
8. The whole-set check was not run (nothing is, in planning); its Dawn is not the viewers' Chrome (GP5 refuses
   `requires` / `enable` for that).
9. That Chromium 153 chooses adapters as the source of `main` read by the study.
10. That a page's screenshot shows the frame the worker just drew once `gpu.done()` resolved (RS3 names the
    one-line cure).
11. A frame drawn outside a display callback is presented (the specification says at the next update; main does
    it with WebGL); worker display callbacks' timestamps are the display's refresh times (5.1's `P`).
12. That a fragment shader which drops fragments but writes no depth keeps the early depth test on the reference
    devices' drivers (it is permitted and usual; 5.17's transparent pixels rest on it). That a read-only depth
    attachment may be sampled in the same pass (the ruling's statement of WebGPU; the check will say).
13. `DEPTH.BIAS`'s value against speckle of coplanar layers at every distance (main's polygon offset is the model).
14. Safari: WebGPU on an OffscreenCanvas in a worker; nothing is promised for it.
16. The cost of `load` on the static shadow atlas, and of the second main pass's store and load, on tile GPUs.
17. Looks seen only at the run: floors and water at a low angle with two plain taps; things drawn smaller than
    their top (26 px) shimmering — if they do, SHEETS gives tops a mip chain.
18. That `beats.js`'s game path, edited as 5.20 says, guesses a game's next beat right (the film's table order;
    read against the Asher game, which is not carried over): no game plays on «Вокруг света v3», so no picture
    of this work shows it.
19. 5.6's exactness of replacing a path's far runs by a chord is argued here for fills; SHEETS proves it again
    for strokes, dashes and curves' control points.
20. Android's Advanced Protection mode blocks WebGPU (a feature on by default in Chromium's source).
22. That «Вокруг света v2» is still as the study read it (`env/dev` at 2e970059, 2026-10-10): 5.20's counts of
    its shader files are the study's; the copy takes the branch as it is on the day.
23. The pages of shadow views (at two levels coarser) and mirrors: an allowance of one cache
    layer, not counted (the count's script has no shadow views; nothing was run). That a shadow
    drawn from sheets two levels coarser looks right.
24. Forms: the cost of a `textureLoad` of `forms` in every quad pipeline's vertex stage on Mali and Adreno;
    whether 33 points a side are enough for a form that fills the frame; how well agents write a hull's ribs
    (nothing in the 20 scenes is a loft); how lit forms look beside painted sheets.
25. Interaction: that a page layer and a worker canvas's frame reach the screen within one display frame of
    each other; how round buttons over a canvas behave with the stage's own pointer handling on touch devices
    (which element gets a drag that starts on a circle).
26. Lit points a view (vertex work on phones): not counted.
27. the studio's history and `…-gpu-cost.md` were not re-read by me; their numbers are
    taken from `v4-fresh-read.md`.
28. Three engines on one page: that `import()` of `engines/3/page.js` from the classic `stage.js`
    works on a page opened from a file (engine 2's module worker is loaded so today); that a WebGL scene and a
    WebGPU scene draw side by side on the comparing page.
29. The seams of 1.6 were read on the work's branch at 6f1f579 (the code is 560f640's); their line numbers are that
    commit's.
31. That the work's stack has, or can be given, «Вокруг света v2» to copy from (9a-11).
32. Our own reversed-depth perspective and the mirror's oblique projection (`render/views.js`, the camera's lens):
    read, never run — the first pictures drew them right.
33. After the first measured stand (a T4, four cores, one painter): where the scene thread's 7–30 ms of a drawn
    tick go, and what allocates its 50–115 MB a second — reading found the asks repeated for every view every
    tick, the cache scanned for every page and a few kilobytes of the engine's own garbage, and no more; the
    stand's parts (ST2 `step`, `times`) and its heap profile by script (ST3) are there to say the rest. Whether a
    draped plane's ask (point by point through the scene's land function), the people posed every step in view
    or not (PP3), or the scenes' own code is the larger remainder is not known, and nothing of them is changed
    before it is.
34. What a T4's millisecond is on the reference devices: not measured by anyone (ST3 — the stand does not judge
    the GPU's time until the same detailed run has been made on one of them).
35. `cut` and `edge` (5.17), the SCREEN shape (5.12), the mirror's own set and its ready pass (5.7), the bloom's
    five passes: decided from the first pictures and stand by reading; what each costs is the next stand's.
36. A camera that rides fast (the train, 20 m/s): the frame's own land field is baked `host.land` (1) node a
    frame, far fewer than enter — whether its finest levels' lack shows was hidden by the black pane of the
    first pictures; the next ones say.
