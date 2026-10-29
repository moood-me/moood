# Engine 3 — the contracts, as the code has them

A reference for whoever changes engine 3: every interface between its areas — messages, calls, table layouts with
byte offsets, constants, who owns what — as it is in the code on 2026-10-14. Each entry keeps the plan's id (PG4,
SH10, WT2…): the reasoning is in `architecture.md` under that id; how the whole fits together is in `design.md`.
Every entry was checked against the code; where the plan said otherwise, the plan was corrected. What looked wrong in
the code is listed in section 11, not written here as the contract, and so is what the plan has that the code does not
yet. Paths are of this repository. The engine was made in rpg: what draws
and measures it from outside is now the studio's.

A change of anything here changes the code, this file and the plan's entry in the same commit.

| § | Boundary | Plan |
|---|---|---|
| 1 | PAGE ⇄ SCENE: the stage, `page.js`, the thread's messages and calls | 3.1 (PG1–PG14) |
| 2 | Interaction: points, rings, the highlight, anchored layers | 3.11 (IN1–IN6) |
| 3 | GPU ⇄ every area: device, tables, modules, pipelines, layouts, formats, the frame | 3.2 (GP1–GP11), 4.2, 4.3, 4.5, 4.6 |
| 4 | SCENE ⇄ RENDER: calls, the frame record, `R.frame`, passes, uniforms | 3.3 (RN1–RN12), 4.4 |
| 5 | The world's tables and their GPU rows | 3.4 (WT1–WT11), 4.1 |
| 6 | SCENE ⇄ SHEETS ⇄ RENDER: the artist, recordings, asks, painters, cache, page table | 3.5 (SH0–SH14), 4.8 |
| 7 | SCENE ⇄ PEOPLE ⇄ RENDER | 3.6, 3.7 (PP1–PP11) |
| 8 | SERVICE ⇄ engine: the stand's rows, a measuring, a render | 3.8 (ST1–ST3), 3.9 (RS3–RS5) |
| 9 | LANGUAGE ⇄ engine: what a spec and its code may use | 3.10 (LG…) |
| 10 | Constants and the tier | 4.7, 4.9 |
| 11 | Findings: where the code looks wrong or unclear; planned and not built | — |

## 1. PAGE ⇄ SCENE

Plan 3.1 (PG1–PG14). Three parties: `engines/1/stage.js` (the stage; its third branch, `engine === 3`),
`engines/3/page.js` (engine 3's side of the stage, a module the stage imports as the first engine-3 scene wants it),
`engines/3/thread.js` (the scene's thread, a module worker; its outgoing messages are built in
`engines/3/play/messages.js`). Every message is `postMessage` of a plain object with a type field `t`.

### 1.1 Stage ⇄ page.js (in the page)

`stageSide(hand)` (page.js) — finds the tier (PG13) once a page, then → the side
`{ begin, end, call, input, watch, screenOf }`. Stage calls it through `to3(fn)`: everything handed to the side runs
in the order handed, and is dropped if the stage left that use of engine 3 meanwhile. A page.js that cannot be
imported: every waiting call is refused and «сцену не удалось показать» stands over the place.

| `hand` member (given by stage.js) | What it is |
|---|---|
| `place` | the stage's element; page.js sets `place.dataset.mooodEngine = '3'` while in use (scene.css keys on it) |
| `debug`, `clock`, `real` | `?debug` value or null; a render's/play's clock start (ms) or null; whether it is a play's (real) clock |
| `thread` | URL of `engines/3/thread.js` |
| `told` | what the thread before was told: `{ paused, view, listen:Set, pickSpec, select, offer, veil }` — re-told to a new thread (`veil`: the level the stage's fade is at — over engine 3 as the thread tells it, PG15 `veil` —, told as `fade(veil, 0)`) |
| `listeners` `{ change:[], move:[] }`, `tells` `{ tell, save }`, `framed` (the `onFrame` fns) | filled by page.js as the thread speaks |
| `heard(e)`, `said(m)` | the stage's own handler (replies, `mounted`, `action`, `event`, `say`, `unsay`, `perf`); errors/warnings → `window.__mooodErrors / __mooodWarnings` |
| `placeOver(c)` | lays the `?debug` overlay canvas over the place |
| `stands(on)` | tells `stage.onPause` and `Moood.onPause` listeners — called by page.js as `paused \|\| hushed` changes: the pause (2.6) or the wait sign shown over a picture that stands (`waits.held`, the device lost: 2.4, 2.9; the thread is not paused for it) |
| `story(on)` | tells `stage.onStory` listeners (the voices: `speech.js`) — called by page.js as a story that stands (`waits.story`: a cut waits, 2.4) comes and goes — at once, not after the sign's delay; the music is not told |
| `cancel()` | ends every action the page holds (`'cancelled'`) — device lost |
| `remade(canvas, overlay)` | the canvas made anew after a loss |
| `covered`, `last`, `values` (getters) | `stage.cover` flag; the last frame's info (`frame, camera, hero, fixed, selected, showcase`); the state's values |

| Side member (page.js) | What it does |
|---|---|
| `begin(was, canvas, overlay)` | starts a use: observers on, thread started (`mount`), `was` re-told; no device → `renderer: <why>` and «это устройство не может показать сцену» for good |
| `end()` | thread terminated, everything cleared, layers placed once more |
| `call(id, fn, args)` | posts PG4 `call` (kept while no thread); refused at once after a final failure |
| `input(ev)` | gathers PG3 |
| `watch()` | re-works the pause (stage calls it on `cover` and on the play's pause) |
| `screenOf(ref, lift, over)` | `[x, y, depth]` from the last `points`, or null (not tracked yet, NaN, not live); first ask sends `track` |

Stage members an engine-3 page uses: `screenOf(ref, lift = 0, over = false)` (→ side), `frame()` (CSS px rect; whole
place before the first frame), `camera()`, `hero()`, `selected()`, `showcase.{start, play, pause, seek, info}`
(`start()` in the moment of a `show` rides in it, PG12), `onFrame(fn) → off()`, `cover(on)`, `onPause(fn)`,
`onStory(fn)` (fn(waiting): the story waits on a cut — engine 3's alone), `fade(level, seconds) → promise` (the veil,
plan 2.10: engine 3 → `call('fade', …)`; engines 1, 2 → the stage's own black `div` over the canvas in the place,
its opacity animated — `Animation.finished`; the level kept in `told.veil`, carried at once to the canvas of
another engine), `show(spec, modules, opts)` (`opts { fade, then, tag }`: engine 3's alone, into the `show` call's
`start`; engines 1 and 2 ignore it);
`Moood.cover(on)` (every stage; `viewer.js` only), `Moood.onPause(fn)` (every stage, also later ones; `music.js`);
`draw()` → resolves `undefined` with no call. `MooodState.prepare(values)` → `call('prepare', values)`,
`MooodState.unprepare(id)` → `call('unprepare', id)` (engines 1, 2: `prepare(values, seconds)`, unprepare a no-op);
`MooodState.catchUp` is engine 1's only (`bespoke/play.js` uses `instant` for engines 2 and 3).
Show and start in one moment (`atOnce`): one `call('show', spec, modules, start)` with
`start = { values?, showcase?: true, keep?: true, save?: true, fade?: seconds, then?: [...], tag? }`; a `start` alone → `call('start', spec, values, opts)`.
What `MooodState.start` gives with an engine-3 show (who hears what the scene tells, its values, its states) is taken by the
stage when the thread says `switched` (PG16) — its values then the thread's; a show that fails or is replaced leaves the
stage with the scene shown before. A `start` alone is taken at once.

**The clock seam** (`engines/1/clock.js`). `MooodClock(start, { real })` replaces the timers, `performance.now`,
`Date` (and, not real, `Math.random`). It sets `__mooodTimers = { setTimeout, clearTimeout, requestAnimationFrame,
cancelAnimationFrame }` — the browser's own, bound. page.js takes `own = window.__mooodTimers ?? window` for every
wait of its own: `SETTLED`, the one `in` a display frame, the layers' placing, `WAIT.SHOWN`, `WAIT.LEAST`. `__mooodTime.run(ms)`
moves a virtual clock; `.pause(on)` stands a play's (the stage wraps it: `told.paused`, `side.watch()`).
The thread installs `MooodClock(m.clock)` only for a render's clock (`clock != null && !real`).

### 1.2 page.js → thread

| Msg | Fields | When | Thread does |
|---|---|---|---|
| **PG1 `mount`** | `canvas` (OffscreenCanvas, transferred), `overlay` (OffscreenCanvas \| null, `?debug`), `w, h` (CSS px, ≥1), `dpr`, `pw, ph` (`round(w·dpr)`, `round(h·dpr)`), `budget`, `tier` `'weak'\|'normal'`, `phone`, `cores` (`hardwareConcurrency \|\| 4`), `flags { debug, stand }` (`stand`: null \| `'rows'` (`?stand`) \| `'detail'` (`?stand=detail`)), `clock`, `real`, `speech` (`typeof MooodSpeech !== 'undefined'`) | once, first, per thread (again after a loss) | copies into `host`, adds the tier row (§10); makes gpu, sheets, renderer, pacer (no pacer with a virtual clock); replies `mounted`. Messages before it wait. |
| **PG2 `size`** | `w, h, dpr, pw, ph` | place size or dpr changed and stood `SETTLED` (ResizeObserver + `matchMedia(resolution)`) | `host` ← fields; `R.resize()`; camera of scene shown and of one being built `.size()`; paused → draws one frame at the new size at once |
| **PG3 `in`** | `evs: [ev…]` — `pointerdown/pointermove {pointerId, x, y}`, `pointerup/pointercancel {pointerId}`, `wheel {deltaX, deltaY, x, y}`, `lean {x, y}` (−1…1), `keydown/keyup {key, code}`, `blur` | at most one a display frame (`own.requestAnimationFrame`); a `pointermove` of the same pointer, or a `lean`, replaces the last entry if it is the same | each ev → `S.camera.input[type]`; `keydown KeyP` toggles the P panel (`perf`) |
| **PG4 `call`** | `id` (stage's count up from 1; page.js's own down from −1), `fn`, `args` | any time | `→ reply` (below) |

### 1.3 PG4 — calls (`calls` in thread.js)

Waits for the newest `show` ("scene"): ready, seen, still, inspect, start, stop, set, cut, turn, path, check, unknown,
act, control, signal, save, restore, instant, showcase, to, prepare, unprepare. `select`, `offer`: of the scene shown, at once (the page names its things by the spec it has: plan 2.9), of the one being shown where none is. Of these, the ones that
change the scene or need its frame ("changing": still, start, set, cut, turn, path, act, control, signal, restore,
instant, showcase, to, prepare) reject with the failed build's error when the scene left on the canvas is stopped.
At once: show, ground, resetCamera, setView, listen, said, pickSpec, pick, track, pause, waits, stand, fade. Jobs apart (one
at a time; a newer replaces the running one, which replies `{ replaced: true }`): show, still, restore, instant(off),
showcase play-ended/seek, to, seen with a virtual clock. A thread whose mount failed or that is dead replies every call
`error: 'renderer: the scene cannot be shown'`; an unknown `fn` → error `the scene's thread has no call '<fn>'`.

| fn (args) | Reply |
|---|---|
| `show(spec, modules, start)` — `start { values, showcase: true \| {at, playing}, restore, keep, save, then, fade, tag, show }` (`tag`: what its director's messages carry, PG16; `show`: the stage's number of the show, told back with its `switched`; `then`: a jump made before anything is painted, plan 2.2 step 4; `fade`: seconds — the switch through black, 2.9) | `true` shown (after the switch: beside a living scene, once the new one was whole); `{ replaced: true }` showed nothing; error: build failed or the switch could not come (the scene before stays — living; stopped only under a draft, `keep`) |
| `ready()` | resolves when the newest show ended; rejects with its build error |
| `seen()` | resolves after a frame drawn whole + `gpu.done()`; rejects with the scene's fault / build error; passes to the scene that replaces it |
| `still(view)` | one whole frame from `S.camera.cameraFor(view)`, no step; → undefined |
| `inspect()` | `{ t, camera, frame, elements }` (of the last `still`'s camera if any) |
| `ground(across, distance)` | number (0 without a scene) |
| `resetCamera()`, `setView(left, right)` | — (`setView` kept in `host.view`, every camera takes it) |
| `start(spec, values, opts)` | null; state and scripts anew; only `opts.save` read |
| `stop()` | — |
| `set(key, value, over, ease, opts)`, `cut(values, opts)`, `turn(key, degrees, over, ease)` | — (`opts.who` marks the key set from outside; a cut that is not ready waits with the story standing, plan 2.4) |
| `fade(level, seconds)` | `null` once the veil is at `level` (or a newer fade took it over); at once where no frames are drawn (no scene, the loop stopped); one that lifts waits for a cut that waits (plan 2.10, PG15) |
| `path(keys, points, opts)` | duration (s) |
| `check(keys, who)`, `unknown()` | —; array of keys |
| `listen(key)` | no-op: every move is told in PG5 `moves` |
| `act(pageId, actor, verb, args)` | true/false; then `action` messages under `pageId` |
| `control(pageId, how)`, `signal(name, data)` | the director's return |
| `said(id, ev, duration)` | — (`ev`: `heard` \| `end` \| `unheard`) |
| `save()` / `restore(data)` | data \| null / undefined (a silent jump, then a whole frame) |
| `instant(on)` | null; off → a jump to the scene as it is, drawn whole |
| `showcase(how, at)` — `'start' \| 'play' \| 'pause' \| 'seek'` | `{ at, length, known, playing, ended, beat, beats }` \| null (no film; only `'start'` loads one). `play` of an ended film seeks to 0 playing; `seek` moves the place, keeps play/pause |
| `to(seconds)` | undefined, after the moment is drawn whole (plan 2.5) |
| `prepare(values)` / `unprepare(id)` | id (integer, thread-wide count) / — |
| `pickSpec(spec)` | — (clears the background cache) |
| `pick(x, y, allowed)` | `{ path: 'objects[i]', background }` \| null — insert, then world ray (`space.pick`, no land), then sky; `background`: its box covers > ¼ of the frame |
| `select(path)`, `offer(paths)` | — (sets `SELECTED` / `OFFERED`: §2) |
| `track(ref, lift = 0, over = false)` | slot (PG9) |
| `pause(on)` | — (idempotent; stops/resumes the loop) |
| `waits()` | `{ waits, missing: R.missing() }` (also posts PG8) |
| `stand(how, name)` | `'start'` → true; `'segment'` → true; else the stand's take (plan ST3) |

### 1.4 thread → page.js

Built in `engines/3/play/messages.js`. `errors: [string]`, `warnings: [string]` ride on any message (each text said once a
show, digits ignored; at most 256 distinct a show). Before an `action`, `event`, `say`, `unsay` or `reply` the
pending state goes as its own `state` message (PG6).

| Msg | Fields | When / page.js does |
|---|---|---|
| `mounted` | `keys` (the camera's `KEYS`) | after `mount`; with a `renderer: ` error → final failure (PG7 a) |
| `reply` | `id`, `value` \| `error` | ids < 0 → page.js's own; else stage `heard`. A `show` answered shown clears a fault's words |
| **PG5 `frame`** | `frame {x,y,w,h}`, `camera {x,z,h,look,yaw,roll}`, `hero {across,elevation,ground}\|null`, `fixed`, `selected {path,x,y,w,h}\|null`, `showcase {at,length,known,playing,ended,beat}\|null`, `beats` (string[] \| null when let go), `points` (Float32Array 3·slots), `changes`, `moves`, `save` — each only when changed; all after a mount and after a show | after a tick, only if something changed. A held tick sends no `frame, camera, hero, fixed, selected, points`. page.js: state at once (changes → moves → `tells.save`), fields into `hand.last`, layers placed in the next `own.requestAnimationFrame` (a render: at once) |
| **PG6 `state`** | `changes?`, `moves?`, `save?` | when no tick carries them. `changes`/`moves`: `[key, value, …]`, null = gone; listeners `(value, old, key)` |
| **PG8 `waits`** | `waits: null \| { building?, pipelines?: [made, asked], pages?, land?, shadows?, apart?, shot?, story?, held? }` — `held: true` while the picture stands: the tick's `R.frame` returned 0 (a whole frame not yet whole), or a draft's stopped scene stands under a show; `story: true` (with `shot`) while a cut waits — the whole story stands (plan 2.4); `pages` beside a living scene: what the new one's opening view lacks | when it changes (`held` among the fields compared); non-null only while held / building / a job apart / the story waits on a shot (`shot` alone: that shot's `pages`). page.js: the wait sign after `WAIT.SHOWN`, standing at least `WAIT.LEAST` once shown (a wait that comes again meanwhile keeps it, its count anew); «сцена готовится · N %» — N of the largest `pages` and the pipelines since the wait began — only while a `show` is unanswered, the device is lost or `held` / `building` / `apart`; the sign alone for `shot` alone, for nothing countable, and for the rest of its least time after the wait ended. Shown while `held` or the device is lost, after a scene was shown in this side: `hand.stands(true)` (voices and music wait), `false` as that ends — the first frame drawn; with `story` (at once): `hand.story(true)` (the voices alone wait) till it goes. A `show` unanswered beside a living scene shows the sign over it, its share counted, and pauses nothing |
| `action` | `id` (page's), `ev`, `remaining`, `duration` | director |
| `event` | `type` (`arrived\|line\|cut\|signal\|tell`), `data`, `at` (scene s), `scene` (its show's tag) | director, not while silent; `action`, `say`, `unsay` carry `scene` too; the stage hands it on: `fn(data, scene)`, `tells.tell(text, about, at, scene)` |
| `veil` | `level` | the veil came to a level (PG15): the stage's `told.veil` |
| **PG16 `switched`** | `scene` (the tag), `show` (`start.show`), `values` (the new scene's whole state) | the switch (plan 2.9): the stage takes what it was given with that very show (by `show`), and `values`; then the new scene's kept messages |
| `say` / `unsay` | `id, who, text, opts` / `id` | only when `speech` |
| `perf` | `text` (null: panel off) | P panel, once a second |
| **PG14 `lost`** | `saved` (`director.save()` \| null), `reason` | once; then nothing. page.js: refuses calls in flight, `hand.cancel()`, new canvas + thread when watched; shows again (`show` in flight, else film `{at, playing}`, else `restore: saved`); a second loss before the new thread's first frame → final |
| `failed` | — (+ `renderer: ` error) | engine failed after mount (PG7 b); then nothing; final |

**PG7 errors.** `renderer: …` = shown in the scene's place: with `mounted` → device cannot (final); with `failed` →
final; on any other message → the scene's fault (loop stopped, `seen` rejected; cleared by the next show; carried by an
empty `state` message). Everything else (`host.error`) is `engine: …`. **Points** (PG5): `[x, y, depth]` CSS px and
metres; x NaN = not there now or behind the eye (a point outside `frame` keeps its numbers — readers check `frame`);
depth Infinity = sky; 0 = insert. `waits` (PG8) is recomputed in unseen steps every `WAITS_EVERY` steps.

**PG13 the tier** (page.js `tier()`, once a page): `window.__mooodDevice { phone, weak }` if set (a render
`{false,false}`; the stand `desktop {false,false}`, `laptop {false,true}`, `phone {true,true}`), else
`navigator.gpu?.requestAdapter()` (none → cannot show; a throw → its words), `phone = matchMedia('(pointer: coarse)')`,
`weak = classOf(info.vendor, info.architecture) === 'weak'`. `TIERS` (page.js): exact names first, then a name ending
in `*` as a prefix; vendor or pair not listed → weak.

| vendor | weak | normal |
|---|---|---|
| intel | gen-7, gen-8, gen-9, gen-11, gen-12lp | gen-12hp, xe-* |
| amd | gcn-1 … gcn-5 | rdna-* |
| nvidia, apple | — | * |
| qualcomm | adreno-4xx, -5xx, -6xx | adreno-* |
| arm | midgard, bifrost, valhall | gen-5 |
| samsung, img-tec | * | — |

`budget = phone ? (weak ? 960·540 : 1280·720) : (weak ? 1600·900 : 1920·1080)`.

## 2. Interaction

Plan 3.11 (IN1–IN6); why: plan 5.22.

| Id | As coded |
|---|---|
| **IN1 a point** | `world.pointFor(ref, out, yaw, over)` (`world/world.js`) → 0 none, −1 none yet (paints, not painted), 1 world, 2 sky direction, 3 frame (insert). Refs: `'id'` — its unnamed mark, else anchor (+ `height·scale` with `over`); `'id@'` — unnamed mark, else its box's middle; `'id#name'` — the named mark (as its animate marked it this step, else as painted), through `place`; copies `'id:k'`, `'id:k@'`, `'id:k#name'`; person — `people.point(id, name ?? 'head')`; sky — its mark only (none: no point); insert — its mark, else iris centre, only inside the open iris; `[across, distance, elevation]` (over the land); `{ on, at }` (in that element's frame). `messages.track` gives slots (same args → same slot; for the thread's life); `pointsNow` projects after the tick with `f.camera` / `f.seen` (an insert's points on `f.rect`); `lift` added to world points only. |
| **IN2 offering and pressing** | `engines/1/actions.js` (`MooodActions.create`), for engine 2 (and the old engine) only: on engine 3 a choice is the language of mini-games (the old site's pages, `start({plate: false})` + marks + `press`), `bespoke.offer` throws there. `actions.offer({ref: [action…]})` → a `<button class="spot">` per ref, 48 CSS px (`SPOT`; size in `scene.css`), at `stage.screenOf(ref)` for `'id#name'`, `stage.screenOf('id@')` for a bare id; hidden when null or outside `stage.frame()`. Placed in `stage.onFrame` (and on resize). Click → `selection.choose(path)` → `stage.select(path)`, menu beside the ring; same ring again closes. Clicks on the canvas do not pick (`picks: () => !two()`). The thread is told `stage.offer(paths)` by `select.js` (`offered()` → paths `objects[i]` …). |
| **IN3 the highlight** | `select` / `offer` → `world.mark(el, FLAG.SELECTED \| FLAG.OFFERED, on)`: bits on every quad of the element (`T.setQuad`, stamps rows); a person → `people.mark(id, marks)` (`person.marks` uniform). Shader: `e_quadGlow` (`world/world.wgsl.js`) — mirror view 1; `SELECTED` → `1 + PULSE.DEPTH`; else `OFFERED` → `Frame.pulse`. `personGlow` (`people/person.wgsl.js`) multiplies both. `Frame.pulse = 1 + PULSE.DEPTH·(0.5 + 0.5·sin(PULSE.RATE·t))`, written by `render/renderer.js` at `FRAME.PULSE` (byte 8). |
| **IN4 anchored layers** | page-side users: `actions.js`, `speech.js` (`screenOf(at, 0.25, true)`), `widgets.js`, the old site's pages, `showcase.js`, `captions.js`, `bespoke/play.js` — all place in `stage.onFrame`. page.js calls `hand.framed` fns once per display frame after any `frame` message or page scroll (a render: at each message). Held ticks send no points, so layers stand. |
| **IN5 a game's** (the old site's pages) | `bespoke.where(ref, lift = 0)` → `{ x, y, depth, seen }` \| null (`seen`: inside `stage.frame()`); `bespoke.frame()`; `bespoke.onFrame(fn)` → off; `bespoke.offer(offers)` → `actions.offer` (not on engine 3: an error); `bespoke.pointer(ref, radius, fn)` → stop: an invisible round `div` in the game's layer, `fn({ type, dx, dy, id })` for pointerdown/move/up/cancel, captured at down, events not passed to the scene; `bespoke.pause(on)` → `__mooodTime.pause`. Covered: `paused = told.paused \|\| hidden \|\| away \|\| covered` (page.js `watch`); `covered` only from `stage.cover` / `Moood.cover` (`viewer.js`). |
| **IN6 author's selection** | `select.js`: click (≤5 px, ≤500 ms) → `stage.pick(x, y, allowed)` → `select(path)`; background parts on a second click. Thread `pick`: `world.insertHit` → `world.pickRay` (= `space.pick`: quads by `sheets.coverage`, people by `people.pick`) → `world.skyHit`. Box: PG5 `selected` from `inspect.boxOf(el, …, f.camera)`. Only `objects[i]` paths resolve in engine 3 (`byPath`). |


## 3. GPU ⇄ every area

`engines/3/gpu/gpu.js` (the `gpu` object), `gpu/wgsl.js` (chunks, no GPU, node-safe), `gpu/layouts.js` (the shared
layouts and the samplers), `gpu/check.js` (the whole-set check's engine side). Why: plan 3.2, 4.2–4.6.

### 3.1 Making the device (GP1, 4.6)

| Call | Does | Throws when |
|---|---|---|
| `createGpu(canvas, host[, { device }]) → Promise<gpu>` | `navigator.gpu.requestAdapter()` (no options), `requestDevice({ requiredFeatures: features(host) })` — no limits, no `featureLevel`; configures the canvas `{ device, format, alphaMode: 'opaque' }`; makes the three samplers; calls `layouts(gpu)` | no `navigator.gpu`; adapter null; adapter lacks a feature; device lost before return; canvas gives no `webgpu` context; a given `device` lacks a feature |
| with `device` (and `canvas` null) | wraps it, configures nothing; `format = 'bgra8unorm'`; `canvasView()` gives a 64 × 64 stand-in texture of that format (not counted) | |
| `features(host)` | `['rg11b10ufloat-renderable']`, plus `'timestamp-query'` when `host.flags.stand === 'detail'` (required); `createGpu` adds `'timestamp-query'` when the adapter has it (the pacer's) | |

Fields: `gpu.device`, `gpu.queue`, `gpu.format` (`getPreferredCanvasFormat()`), `gpu.info = { vendor, architecture,
device, description }` (stand report only), `gpu.size(w, h)` (sets the canvas buffer; only RENDER, RN3).

`host` read by GPU: `flags.stand`, `lost(reason)`, `error(err)`.

### 3.2 Memory: tables, buffers, textures (GP2–GP4, GP10)

| Call | Contract |
|---|---|
| `gpu.table(name, { stride, capacity }) → Table` | `stride` a multiple of 4. Buffer `STORAGE \| COPY_DST` + CPU mirror. `Table = { buffer, bytes, f32, u32, capacity, version, mark(firstRow, rows), flush(), grow(capacity) }` |
| `mark(first, rows)` | widens the dirty range `[lo, hi)`; rows outside capacity → `RangeError`; `rows ≤ 0` does nothing |
| `flush()` | one `queue.writeBuffer` of the dirty range, then clears it; nothing dirty → no call |
| `grow(larger)` | `larger > capacity` else `RangeError`; new buffer, mirror copied, all rows dirty, `version++` (holders of a bind group with it re-make it) |
| `gpu.buffer(name, size, usage) → GPUBuffer` | counted under `buffers` |
| `gpu.write(buffer, offset, data, dataOffset?, size?)` | `queue.writeBuffer` |
| `gpu.texture(name, descriptor) → GPUTexture` | counted with all mip levels: `RENDER_ATTACHMENT` usage → `targets`, else `textures`; a format not in the byte table (4.3's: `r8unorm, rgba8unorm, rgba8unorm-srgb, rgba8uint, rg11b10ufloat, r32float, depth32float, rgba16float, rgba32float`) throws |
| `gpu.drop(bufferOrTexture)` | uncounts and `destroy()`; something not made here (or dropped twice) throws |
| `gpu.memory() → { textures, targets, buffers, total }` | bytes now. Not counted: canvas buffer, samplers, pipelines, bind groups, what an area makes straight from `gpu.device` |

### 3.3 WGSL and modules (GP5)

| Call | Contract |
|---|---|
| `chunk(name, text \| options => text)` | one-line name, registered once (twice throws); each area registers its chunks at import |
| `forget(name)` | drops a chunk; unknown name throws |
| `assemble(names, options) → string` | chunks in the order named, each preceded by a line `//## <name>`; unknown or repeated name throws; no sorting, no preprocessor |
| `locate(wgsl, line) → { chunk, line }` | module line → chunk and line in the chunk (chunk `null`: above every mark) |
| `directive(wgsl) → { word, line } \| null` | first `enable` / `requires` outside comments |
| `gpu.module(name, wgsl[, heard]) → GPUShaderModule \| null` | a directive: engine text → throws; with `heard` → `heard([fault])` at once, returns `null`. Else the module; its compile errors (and a validation error caught by an error scope round it) become faults `{ chunk, line, message }` (`line` 0: none named), told once: engine text → `host.error(Error('shader <name>, chunk <c>, line <n>: <msg>'))`; with `heard` → `heard(faults)` only. Nothing is told after a loss |
| `gpu.reported() → Promise<void>` | every module report pending at the call is in |

GPU holds no module; the library's `modules` map and the pipelines made of a module hold it (RN2 `lib.keep` lets it go).

### 3.4 Pipelines, layouts, bind groups, samplers (GP6, GP7)

| Call | Contract |
|---|---|
| `gpu.pipeline(key, descriptor) → Promise<GPURenderPipeline>` | one per key (the same promise again); always `createRenderPipelineAsync`, label = key. No compute pipelines |
| `gpu.ready() → Promise<void>` | all pending at the call made; rejects with the first of them that failed |
| `gpu.waiting() → [settled, asked]` | of keys asked and not forgotten |
| `gpu.forget(key)` | drops the key (and from pending); unknown key throws |
| `gpu.layout(name, entries) / gpu.layout(name)` | register once (twice throws) / look up (unknown throws) |
| `gpu.bind(name, entries) → GPUBindGroup` | against layout `name`, label `name` |
| `gpu.sampler(name)` | `shadowSampler`, `sheetSampler`, `linear`; another throws |

Who registers which layout (all before `createRenderer`; SCENE at mount calls `peopleLayouts(gpu)` then
`renderLayouts(gpu)`; the check does the same):

| Owner | Layouts |
|---|---|
| GPU `gpu/layouts.js` (inside `createGpu`) | `frame`, `view`, `viewCast`, `none` |
| PEOPLE `people/person.wgsl.js` `layouts(gpu)` | `people` (0, 1: read-only storage, V — bones, morphs), `person` (0: uniform VF, dynamic offset) |
| RENDER `render/library.js` `layouts(gpu)` | families `land`, `particles`, `own`, `mirror`; own pictures `ready`, `bake`, `air`, `sum`, `beam`, `blob`, `small`, `canvas` |

### 3.5 Bind group layouts (4.2)

A pipeline that draws the world: group 0 `frame`, 1 `view` or `viewCast`, 2 its family's or `none`, 3 `none` or
`person`. Visibility: V vertex, F fragment.

| `frame` | Binding — name — kind (vis.) |
|---|---|
| 0 | `frame` uniform `Frame` (VF) · 1 `nodes` storage (V) · 2 `quads` storage (V) · 3 `layers` storage (V) |
| 4 | `sheetTable` storage (VF) · 5 `sheetCache` `texture_2d_array` float (VF) · 6 `sheetSampler` filtering (VF) |
| 7 | `lights` storage (VF) · 8 `lightGrid` storage (VF) · 9 `panes` texture float (VF) · 10 `linear` filtering (VF) · 11 `forms` texture unfilterable-float (V) |

| `view` | 0 `view` uniform `View` · 1 `shadowStatic` depth · 2 `shadowMovers` depth · 3 `shadowSampler` comparison · 4 `shadows` uniform · 5 `blob` float · 6 `air` float · 7 `masks` float (F only) · 8 `land` uniform · 9 `landHeights` unfilterable-float · 10 `landShadow` unfilterable-float — all VF but 7 |
|---|---|
| `viewCast` | 0 `view` uniform (VF) — shadow passes and `masks` |
| `none` | empty |

Storage buffers in the vertex stage: 6 in `frame` (1–4, 7, 8) + at most 2 of a family = the core limit 8.

| RENDER layout | Entries | Used as |
|---|---|---|
| `land` | 0 leaves storage (V) | group 2 of `land-*` |
| `particles` | 0 emitters storage (V), 1 rings storage (V), 2 sprites `2d-array` float (F), 3 scene depth (F) | group 2 of `particles*` |
| `own` | 0 uniform (F) | group 2 of `own:*`, `own-cast:*` |
| `mirror` | 0 uniform (F), 1 image float (F) | group 2 of `mirror-plane`, `mirror-glass` |
| `ready` | 0 uniform, 1 float, 2 filtering sampler (F) | group 0 of `mirror-step`, `mirror-ready` |
| `bake` | 0 uniform, 1 heights unfilterable-float, 2 uniform (F) | group 0 of `bake` |
| `air` | 0 uniform (VF), 1, 2 depth, 3 comparison, 4 uniform (F) | group 1 of `air`, `air-halo` (group 0 `frame`; the halo's text reads none of 1–4, the shafts' read them) |
| `sum` | 0 float (F) | group 0 of `air-sum` |
| `beam` | 0 depth (F) — the scene's depth, read-only in `main-blend` | group 2 of `beam` |
| `blob` | 0 uniform (V) | group 0 of `blob` |
| `small` | 0 uniform, 1 float, 2 depth, 3 filtering (F) | group 0 of `bloom-*`, `gather*` |
| `canvas` | 0 uniform, 1 `main` float, 2 depth, 3 `ids` uint, 4 bloom ¼ float, 5 gather wide float, 6 uniform (`inks`, 4096 B), 7 filtering (F) | group 0 of `canvas` |

### 3.6 Formats and samplers (4.3)

`render/library.js` `FORMATS`: `MAIN rg11b10ufloat`, `IDS rgba8uint`, `DEPTH depth32float`, `MIRROR rgba16float`,
`AIR rgba16float`, `GATHER rgba16float`, `MASK rgba8unorm`, `BLOB r8unorm`, `LAND_SHADOW rgba32float`, `HEIGHTS r32float`.

| Texture | Format, size | Owner (file) |
|---|---|---|
| `main`, `ids`, `depth`, `masks` | MAIN, IDS, DEPTH, MASK; the buffer `bw × bh` (RN3) | `render/post.js` |
| `bloom 4/16/64`, `gather`, `gather wide` | MAIN at `w>>2, w>>4, w>>6`; GATHER at `>>4`, `>>7` (each ≥ 1) | `render/post.js` |
| `shadowStatic`, `shadowMovers` | DEPTH, `host.shadow`², half that | `render/shadows.js` |
| `blob` | BLOB, 512² | `render/shadows.js` |
| `air`, `air steps` | AIR, 384 × 144 (`AIR.W·TX × AIR.H·TY`) | `render/air.js` |
| a mirror's image, `mirror masks`; `mirror ids`, `mirror depth` (one each, shared) | MIRROR, MASK; IDS, DEPTH — `MIRROR.IMAGE` (512)² | `render/mirrors.js` |
| `land heights`, `land shadow` | HEIGHTS, LAND_SHADOW, `LAND.N`² a field | `render/land.js` |
| `sprites` | `rgba8unorm-srgb` 2D array, `PT.SPRITE`² | `render/particles.js` |
| `panes` | `r8unorm` | `render/lights.js` |
| `forms` | `rgba32float` | `world/world.js` |
| `sheetCache` | `rgba8unorm-srgb` 2D array, `SHEET.LAYER`², 2 mips | `sheets/cache.js` |
| canvas | `gpu.format`, opaque | GPU |

| Sampler | Descriptor |
|---|---|
| `shadowSampler` | compare `greater-equal`, mag/min linear, clamp |
| `sheetSampler` | mag/min/mip linear, clamp, no anisotropy |
| `linear` | mag/min linear, clamp |

No multisampling, no storage textures.

### 3.7 The frame, loss, timing (GP8, GP9, GP11)

| Call | Contract |
|---|---|
| `gpu.begin()` | new encoder (one a frame; an unsubmitted one is let go); takes the timing switch for this frame |
| `gpu.pass(name, descriptor) → GPURenderPassEncoder` | `name` ∈ `PASSES` (`base.js`: `bake, shadow-static, shadow-movers, blob, air, mirror, masks, main-solid, main-blend, bloom, gather, canvas`) else throws; outside `begin` throws; sets `descriptor.label = name`; when timed sets `descriptor.timestampWrites` (≤ 256 passes a timed frame), else clears it. Caller ends the pass |
| `gpu.canvasView()` | this frame's canvas texture view (call in the drawing task) |
| `gpu.submit()` | finish + one `queue.submit`; `flying++`; resolves stamps when timed |
| `gpu.done() → Promise<void>` | `onSubmittedWorkDone` of the last submit; always resolves |
| `gpu.flying` | submits not yet done (the pacer's witness: `PACE.BEHIND`) |
| `gpu.submits`, `gpu.stamps` | submits made; the device has `timestamp-query` |
| `gpu.hear({ done(n), timed(ms) })` | the pacer's one listener, set once: the n-th submit done (in order); a timed frame's GPU ms, its passes summed (read back 1–2 frames late) |
| `gpu.timeFrames(on)` | the pacer's (at k = 2): every frame's passes timed while on; nothing without stamps |
| `host.lost(reason)` | once, when `device.lost` resolves; after it no `host.error` |
| `host.error(Error('gpu: …'))` | each uncaptured device error |
| `gpu.timing(on)` | the stand's detail: throws when on and the device lacks `timestamp-query`; `gpu.times` filled only for its frames |
| `gpu.times: Float64Array(PASSES.length)` | ms a pass, of the last frame whose stamps were read back (1–2 frames late); −1 not run / nothing read yet; repeated names summed; negative differences count 0 |

### 3.8 The closed set of pipelines (4.5)

All through `lib.all(gpu, has)` (`render/library.js`), keyed. Entry points `e_vertex`, `e_fragment`. Targets: main
set `[MAIN, IDS]` + DEPTH; mirror set `[MIRROR, IDS]` + DEPTH. Solid targets write ids; blended have `ids`
`writeMask: 0`. The mirror set's opaque pipelines (and the people's mirrored mains) do not blend: in a mirror that
fades with height they write their colour × how much of them there is and that as alpha (a fog toward the mirror's
paint, 5.7).
`mark` / `own-mark:<n>` write `ids` alone (`main` `writeMask: 0`).

| Depth state | Write | Compare | Bias |
|---|---|---|---|
| `solid` | yes | `greater` | — |
| `blend` | no | `greater-equal` | `DEPTH.BIAS` (4), slope `DEPTH.SLOPE` (1) |
| `edge` | no | `greater` | — |
| `tested` | no | `greater-equal` | — |
| `over` (insert) | no | `always` | — |
| `cast` | yes | `greater` | −4, slope −2 |

| When | Keys |
|---|---|
| every world (`lib.own()`, at `createRenderer`) | `bake, air, air-halo, air-sum, air-sky, shadow-clear, blob, bloom-bright, bloom-down, bloom-up, gather, gather-wide, canvas, sky, sky-base, multiply, glow` |
| every world, by `all` | `solid, cut, blend, edge`; `own:<n>` per distinct own text (receiver arithmetic), and its `own-cut:<n>` (`solid` mode, `cut`: a pixel whose painting, or then its shaded paint, is under `SHEET.OPAQUE` dropped — the shader runs only where the painting is opaque —, depth written, lit at its vertices as the blend) and `own-edge:<n>` (the blend under `edge` depth) — a quad whose painting has opaque paint is drawn by the two, as a mixed sheet |
| `has.relief` | `land-solid, land-blend` (receivers in the main set) |
| `has.casters` | `solid-recv, cut-recv, blend-recv, edge-recv, cast`, `own-cast:<n>` |
| `has.reflects \|\| has.glass` | the mirror set: `solid, cut, blend, edge, own:<n>, own-cut:<n>, own-edge:<n>, land-solid, land-blend` (plain), `sky, sky-base, multiply, glow` — each `…:mirror`; `mirror-step, mirror-ready` |
| `has.skyOwn` (the own texts of the sky's elements) | `sky-base:own:<n>` — the sky past its painting with that text over it (its faults the text's: said with the element and the author's line); with mirrors `sky-base:own:<n>:mirror` |
| `has.beams` (a light of the spec has a `cone` that is taken) | `beam` (main set, light added, depth `over`; groups `frame`, `view`, `beam`, `none`; no vertex buffer: an instance a beam — its row of the lit set —, 36 points, the box about its cone) |
| `has.clips` | `mask` (MASK target, blend `max`, no depth) |
| `has.inserts` | `insert` (premultiplied over `main`; writes the insert's mark into `ids` where it paints — `(0, 0, 0, 8)`: no person's line through it, nor along its edge) |
| `has.emitters` | `particles` (blended, `tested`), `particles-cast` |
| `has.reflects` / `has.glass` | `mirror-plane` / `mirror-glass` |
| `has.people` | `person:<kind>:main`, `person:<kind>:depth` for `skin, tubes, cloth, face`; with mirrors `person:<kind>:main:mirrored` (front `cw`); `mark`, `own-mark:<n>` (`blend` depth; what blends wholly laid again where its paint is opaque — `SHEET.OPAQUE`, after its amount —: `ids` cleared to 0, as a solid's, so no person's line is drawn through it) |

Quad pipelines share two vertex buffers: 0 the shapes' corners (`float32x2`, 8 B); 1 the order, a 68-byte instance
row: quad `u32` @0, shape `u32` @4 (the low byte the shape, bit 7 SCREEN; from bit 8 a land leaf's row, or a backdrop
sky quad's turn — signed), origin page `sint32x2` @8, edge-on fade `f32` @16, four `float32x3` @20/32/44/56
(a SCREEN piece's corners). Glows and halos: 48-byte rows of three `vec4f`; blob: 32-byte rows of two `vec4f`.

Library calls (`libraryOf(gpu)` → one library a `gpu`):

| Call | Contract |
|---|---|
| `lib.get(key)` | the made pipeline; not made / not asked → throws (`renderer: … an engine fault`) |
| `lib.person(kind, pass, mirrored)` | by number; not made → throws |
| `lib.ownKey(text, names) → n` | an asked own text's number; unknown → throws |
| `lib.ownKeys(prefix[, set])` | the keys `<prefix>:<n><set>` that are made |
| `lib.fault(world) → Promise<string \| null>` | after `gpu.reported()`: the first faulty own text, said with its elements and line (LG13) |
| `lib.keep(...hasOwnLists)` | every other own text: `gpu.forget` its pipelines, drops its modules, `forget('own.<n>')` |
| `exercise(gpu)` | check only: one frame of every pass, every pipeline drawn once, submitted |

### 3.9 Device and WGSL rules (4.6)

Core WebGPU, default limits, one required feature `rg11b10ufloat-renderable`; `timestamp-query` required only for
`?stand=detail`, taken where the adapter has it (the pacer). `gpu.module` refuses `enable` / `requires`. Shader texts keep: `dpdx`/`dpdy` at the top of a
fragment main; sheets read with `textureSampleLevel`; no `frag_depth`; `discard` only in `cut`
(alpha < `SHEET.OPAQUE`), the blended programs for a pixel that adds nothing, and the cast programs (< `CAST.ALPHA`;
particles by dithered coverage). Every module-scope engine name in RENDER/SCENE/SHEETS chunks begins `e_` (4.1).

### 3.10 The whole-set check (`gpu/check.js`, run by `test/gpu/check.mjs`)

`check(entry, own) → string[]`: device with `features(host)`, `createGpu(null, host, { device })`, PEOPLE's and
RENDER's layouts, `lib.all` with a `has` that has everything (`own` as given), `lib.exercise`; waits until no pipeline
is pending and every report is in; returns every error line (`pipeline <key>: …`, `own shader <k>: line <n>: …`,
device errors, step throws).

## 4. SCENE ⇄ RENDER

`render/renderer.js` (R), `render/library.js` (lib). Called by `thread.js`. Why: plan 3.3, 4.4.

### 4.1 Calls

| Call (caller) | Contract |
|---|---|
| `createRenderer(gpu, sheets, host) → Promise<R>` (mount, after both `layouts(gpu)`) | asks `lib.own()`, awaits `gpu.ready()`; makes fixed targets (shadow atlases, blob, air). Full-frame targets at the first `R.frame`. Reads `host.budget, shadow, pages, cells, land, field, pw, ph, w, h, error` (RN1) |
| `R.prepare(has)` (`show`, right after `compile`) | `lib.all(has)`, failure swallowed (told by `R.build`); remembers `has.own` (RN2) |
| `R.build(world) → Promise<made>` (`show`, after `world.build`) | uses `world.C.has`; runs side by side: new particles' `build` (sprites pictured via `sheets.picture`) and `lib.all(has)`; then `lib.fault(world)`. Any failure: as `R.drop`, throws (LG13 words for a faulty own text). Success: `made = { world, particles }`, nothing switched — R draws the world it drew (RN2) |
| `R.use(made)` (`show`, the switch's task) | synchronous: old particles disposed, every area's `build(world)`, `lib.keep(has.own, prepared own)`, shots ahead and views' asks forgotten; R draws `made.world` from here (RN2) |
| `R.drop(made)` (`show` replaced or failed before the switch) | its particles disposed; `lib.keep(drawn world's own, prepared own unless it is this one's)` (RN2) |
| `R.resize()` (`size` message, after `host.{w,h,dpr,pw,ph}` set) | marks; targets re-made at the next `R.frame`: `k = min(1, √(budget/(pw·ph)))`, `bw = max(1, ⌊pw·k⌋)`, `bh` likewise; canvas buffer set by `post.draw` right before `canvasView()` (RN3) |
| `R.frame(f) → 0 \| 1 \| 2` (tick; `settle`; paused resize) | held / idle / drawn (RN4) |
| `R.waits() → { pipelines?, pages?, land?, shadows? } \| null` | of the call just made; `pages = max(1, lacks.pages)` when pages or a top page lack (RN7) |
| `R.missing() → string[]` | plain words of `R.lacks` (and `no world is built`) |
| `R.pipelines() → [settled, asked] \| undefined` | `gpu.waiting()` while any is pending |
| `R.working() → boolean` | pipelines being made, or the land still baked by its ration (the frame's field, a shot's ahead) — SCENE's one test of work on its way (a held frame, a cut waiting, a scene made beside) asks it |
| `R.lib` | given to `createPeople` as `lib` (RN10) |
| `R.detailed(on)` | `gpu.timing(on)` + JS stage timers + survey (stand `detail` only) |

There is no `R.dispose` (RN9). The pacer (`engines/3/play/pace.js`) reads `R.frame`'s outcome, `gpu.flying`, `gpu.submits`, and hears submits done and frames' GPU times (`gpu.hear`) (RN11).

### 4.2 The frame record `f` (made once a scene in `thread.js` `show`)

| Field | Writer | Meaning |
|---|---|---|
| `t`, `dt` | SCENE | scene seconds; the step's (R reads `t`) |
| `shot` | SCENE | integer; another value → the frame view begins fresh |
| `whole` | SCENE (set false after a drawn frame) | nothing rationed; held unless whole |
| `wait` | SCENE | a make in flight or people building |
| `camera`, `toward` | SCENE | `Camera` (RN5); `toward` — where the camera will be `host.ahead` s on along a known path (`engines/3/play/camera.js`: the viewer's ease to his target and back, his glide, his way aside carried by a `scene.move` of `camera_x` along a panorama, the operator's glide — its spring run h on, the target where it is now, the way round as it stands —, the camera keys by `director.ahead(h)`), or null; placed again only every `host.ahead` / 2 of scene time, at once as it begins and at a new shot (not as a camera move begins or ends); asked at weight 0.5 |
| `rect` | SCENE | `{ x, y, w, h }` the safe rect in CSS px (4:3…21:9 fitted whole in the canvas) |
| `seen` | SCENE | `{ x, y, w, h }` the whole canvas in CSS px — what the projections map onto |
| `stage` | SCENE | `Float64Array(4)`: the safe rect in clip space (middle x, top y, a stage height across, down) — where inserts lie; a View that asks inserts has it as `stage` |
| `over`, `overN` | SCENE | the frame's swaps (SH2) |
| `ahead[]` | SCENE (`engines/3/play/shots.js`) | `{ camera, over, overN, nodes, nodeOf, nodesN, hidden, hiddenN, shown, shownN, stamp, next }` read by R (`next`: the film's next beat — a shot the showcase's own code made, `director.api('showcase', null, true)`, not a beat's sequence; its own view is asked at weight 1 outside a whole call); **R writes `whole`, `pages`, `land`, `bias`** (`land`: its land's tiles still lacking — with `pages`, what a cut waiting on it waits for) |
| `moving` | SCENE | the camera moves (`engines/3/play/camera.js`): the stand's row `moving` |
| `veil` | SCENE (each tick, from the veil: plan 2.10) | 0…1, the stage's black laid last in the canvas pass; 0 in a `still` |
| `next` | SCENE (`thread.js`, while a scene is made beside this one: plan 2.9) | a View of another world — the new scene's opening view — or null: asked in every round after the frame's own views and the shots', at weight 0.5, `ahead` (a shot's class: not the frame's own in SH13's counts), `next` (its share of the room kept by `weigh`: what it needs, at most half); **R writes `next.lacking`** (its last ask's return) |

`Camera = { eye: Float64Array(3), rot: Float32Array(9) col-major world→eye (−z gaze, +y up), proj: Float32Array(16)
col-major, reversed depth (near 0.1 → 1, far ∞ → 0), yaw, ortho, pose }` — every one made by `render/views.js` `newCamera` (one shape; `pose`: the camera module's, null in R's). The frame's,
`toward`'s and a shot's `proj` map onto the whole canvas (`f.seen`; the safe rect `f.rect` fitted in its middle gives
the focal length — its height — and the principal point); R draws with viewport and scissor at the whole buffer. An
insert lies on `f.stage` (the safe rect in clip space: middle x, top y, a stage height across and down).

### 4.3 What `R.frame` does, in order

a. targets if resized · b. `sheets.place(f.whole ? ∞ : host.pages)` · c. stage/cover (`sky.js`), frame view placed
(weight 0.5 under a cover), `toward`, lights chosen, air placed, land (`host.land` nodes, all in a whole call or the
call a cover lifts), mirrors, shadows, shots ahead, particles · d. `people.show(seen)`, blobs · e. culls · f. asks
(frame, mirrors, shadow cells due, toward, ahead, `f.next`) and `sheets.weigh()` — repeated while `f.whole` and weigh asks
again; shots ahead judged · g. `sheets.request()` · h. outcome · i. buffers written (views' uniforms with their
`drawn`), passes, one submit. Only a break holds (rule 8): a call without `f.whole` is never held — what its views
lack is read from the coarser pages there are.

| Outcome | When | Then |
|---|---|---|
| 0 held | `f.whole` and not whole: whole = `!f.wait && sheets.whole(world) && lacks.pages === 0 && !land lacks` (`lacks.pages` sums the frame's, its mirrors' and due shadow cells' asks) | only `bake` / `shadow-static` drawn and submitted, if due |
| 1 idle | not `f.whole`, a frame drawn before, no resize since, same shot, same `f.veil`, same cover state, same sheet/own stamps of quads in view, same look and inserts stamp, and — uncovered — camera and rows unstamped, `people.show` false, no rationed work waiting, panes unchanged, no flicker, no particle alive, nothing in view moves by itself (or a rippling mirror) | nothing written, nothing drawn |
| 2 drawn | otherwise | full frame (4.5 below) |

Before any world: held if `f.whole`, else idle. RN12 (`thread.js`): a 0 with nothing in flight
(`sheets.flying`, `world.flying`, `world.waiting()`, `people.building()`, `world.building` all nothing; in the loop
also no job apart) throws `the frame cannot be finished and nothing more is on its way — still waiting for <R.missing()>`.

Under a cover (a solid, iris-less insert open at 1 whose painting's rect covers `world.view.seen` and whose base sheet is wholly opaque, `sheets.solid === 2`): no
bake, shadows, blob, air, mirrors, masks; `main-solid` only clears; `main-blend` draws the inserts.

The sky past its painting (`render/sky.js`): its base is the first sky element shown with a sheet, chosen each call
(`FRAME.SKY`); `stage.past(world, camera, quad)` — whether the frame's view shows any sky past that painting — draws
`sky-base` in the frame's view only then (a mirror's pass that shows the sky always draws it). A sky element's `rect`
is its spec's `box` (stage heights; default `[−0.3, −0.35, STAGE or 2π + 0.3, 1.25]`; at most a whole turn + 0.6
across, −3…4 down).

### 4.4 Counters and the stand (RN8)

`R.counters = { frames, drawn, held, idle, pixels, draws, triangles, placed, lit, blended, shapes: Int32Array(SHAPES+1),
mirrored, particles, people, quads, listed, asked, persons, shown }` — objects rewritten in place (`persons`: the world's; `shown`: those shown in the call, `people.shown()`). `R.lacks = { wait,
sheets, pages, mirrors, cells, land }`. `thread.js` puts `world.opened` in its row as `opened`. `R.timing` — `{ [name]: { js, gpu } }` for the stages `place, view, lights,
land, mirrors, shadows, ahead, particles, people, cull, cull mirrors, cull shadows, cull ahead, ask, ask mirrors,
ask shadows, ask ahead, weigh, judge, request, outcome, write, submit` then `PASSES`; −1 not run; `null` unless
detailed. `R.wide`, `R.wideNames` (survey), `R.stamped()`.

### 4.5 The passes of a drawn frame (4.4)

| # | `gpu.pass` name | Target: load → store | When |
|---|---|---|---|
| 1 | `bake` | land shadow field: load → store | `land.bakeDue` |
| 2 | `shadow-static` | `shadowStatic`: load → store, per cell viewport+scissor, `shadow-clear` first | a static cell `now` |
| 3 | `shadow-movers` | `shadowMovers`: clear 0 → store | `shadows.moversDue` |
| 4 | `blob` | `blob`: clear → store | `shadows.blobDue` |
| 5 | `air` × 2 | `air steps` then `air`: clear → store | `air.on` (shafts > 0, or hazeGlow > 0 with halos; the beams are not in it — pass 9) |
| 6 | per mirror `now`: [`masks` into its own masks if clipped] `mirror` | image clear (0,0,0,0) → store; `mirror ids` clear → discard; `mirror depth` clear 0 → discard. Rough: 2 × `mirror` (step, ready) clear → store | the mirror's view moved, or it is due and longest waiting (all in a whole call). Solids, people, the sky (a pane's: none), what blends, glows |
| 7 | `masks` | frame `masks`: clear → store, `viewCast` | `has.clips` |
| 8 | `main-solid` | `main` clear (0,0,0,1), `ids` clear, depth clear 0 → store | always: solids, people, sky — its base past its painting (`sky-base`, one triangle at the far plane: `render/sky.js`), then its sheets —, `air-sky` |
| 9 | `main-blend` | `main`, `ids` load → store; depth read-only | always: blended list (glows, particles among it; no ids written), then the beams in the haze (`air.beams`: `beam`, its group the scene's depth), then — with people in the frame — the frame view's `marks` (`mark`, `own-mark:<n>`: what may hide one of them — its sphere over what they cover and nearer than the farthest of them —, scissored to what the people here cover of the frame, `covers` of their spheres), then inserts (the insert's mark in `ids` where an insert paints: `canvas` draws no person's line there, and reads the mark beside a person as the frame's edge — no line along it) |
| 10 | `bloom` × 5 | ¼, 1⁄16, 1⁄64 clear (0,0,0,1); up into 1⁄16, ¼ load | always |
| 11 | `gather` × 2 | 1⁄16 then 1⁄128: clear → store | `look.bounce > 0`, on the first and every second drawn frame |
| 12 | `canvas` | canvas: clear → store | always |

Buffers written before the passes (step i): `quads.flush()`, lights, particles, land, the frame view's uniform, the
drawn mirrors' and shadow cells' uniforms, the `Frame` uniform.

### 4.6 Uniforms RENDER writes (`render/wgsl/frame.js`, bytes)

| Uniform | Size | Offsets |
|---|---|---|
| `Frame` (`FRAME`) | 544 | TIME 0, TICK 4, PULSE 8, SKY 12 (the sky's base quad, u32; `0xffffffff` none), EPOCH 16, SINCE 24, INSIDE 28, AMBIENT 32, HAZE_REACH 44, HAZE 48, LIGHT_N 60, WIND 64, FAR_N 76, ORIGIN 80, THROUGH_N 92, GRID 96, GAZE 112, HAZE_GLOW 124, SHAFTS 128, SPOT_N 132 (the beams: the rows after the through lights), AIR_VP 144, AIR_IN 208, IRIS 224 (16 × vec4f), OPEN 480 (4 × vec4f) |
| `View` (`VIEWU`) | 208 | PROJ 0, ROT 64 (mat3x3, padded), EYE 112, YAW 124, SIZE 128, BIAS 136, FLAGS 140 (bit 0 `VIEW.MIRROR`, bit 1 `CAST`), MIRROR 144, FADE 160, LIGHT 176, STAGE 192 (the frame's: `f.stage` — the safe rect in its clip space; 0 in another view) |
| `Shadows` (`SHADOWS`) | 48·4 + 80·24 + 32 | slot 48 B × 4, view 80 B × 24 from `VIEW0`, `BLOB` after |
| lit lights (`LIT`) | 80 B a row (a, b, c, d, e: vec4f) | rows `0…LIGHT.LIT−1` — the far lights, the through lights, the beams, then the grid's —, pane planes from row 256 (16). a: place (less the origin) or the way toward a far light, kind; b: colour, strength; c: reach, flicker, seed, inside; d, e: a window's half sides (d.w its face's sign), a through-light's first plane and count (d.x, d.y), a beam's way (d.xyz), cos of its edge (d.w), cos where its edge begins (e.x) |
| light grid (`GRID`) | 32² cells × (1 + 16) u32 | |

`TIME = { STEP: 256, LOOP: 256, WRAP: 16384 }`; `AIR = { W: 64, H: 36, S: 24, TX: 6, TY: 4, Z0: 1 }`.

## 5. The world's tables

Owner: SCENE (`world/tables.js` the arrays, `world/world.js` what writes them, `world/light.js`, `world/emitters.js`,
`world/relief.js`). Readers: RENDER, SHEETS, PEOPLE — they read and never write. Why: plan 3.4, 4.1.

**Rules of every table** (`world/tables.js`)

| Rule | What the code does |
|---|---|
| Rows | `add…()` takes a row, `free…()` gives it back; a freed row is reused. `n` = one past the highest row ever taken; `cap` = rows allocated. A reader walks `0 … n − 1`; a freed row is inert by its values (node not shown, quad flags 0, light strength 0). |
| Quad blocks | `addQuads(count)` takes `count` rows side by side (first free block that fits, else at the end): an element's quads are one block (WT8). |
| Growth | Arrays double when full, only at an add (a build, a painting taken). Growing replaces the arrays: a reader takes them from the table each tick. |
| Tick | `world.tick` (= `tables.tick`) moves on at the end of every step (`world.stepped`), before a frame drawn with no step (`stepper.unstepped`) and after each round of answers in `world.build`. `world.step` = the step being made or made last. |
| Stamp | A row's `stamp` = the tick at which a DIFFERENT value was last written (every setter compares first; floats compared after `Math.fround`). Changed since `T` ⇔ `since(stamp, T)` = `stamp ≥ T`. `placedAt(world, q)` = max of the quad's node and layer stamps; `stampedAt(world, q)` = that and the quad's own. |
| To the GPU | A stamped node/quad/layer row is also listed in `table.changed` (once); `world.flush()` (a seen step, and `unstepped`) packs them (`packNode`, `packQuad`, `packLayer`) into `world.gpu` and writes stamped forms into the texture. |

**WT1 nodes** — `world.nodes`

| Field | Type | Meaning |
|---|---|---|
| `m` | Float64Array(12·cap) | world matrix 3 × 4, column-major: x axis, y axis, z axis, origin (metres, world). New row = identity. |
| `parent` | Int32Array | the node it is placed under (−1 none); a part's node takes its element's parent |
| `shown` | Uint8Array | 0: closed insert, person not here, freed row — not drawn, lit or animated |
| `stamp` | Uint32Array | |
| `n`, `cap`, `free`, `changed` | | |

One node per element copy (copy 0 = `el.node`), per copy of each part of a painting, per person, per pane given as a polygon
(`light.js`). A person's row holds their root, copied each step from `people.root` (`world.rooted`); their anchor is not here (PP1).
A sky element's row is the sky's map, not a matrix: `m[0]` horizon (`C.yh`), `m[3]` stage width (2π round, else `STAGE`),
`m[6]` 1 round / 0 — on the GPU `r0.xyz` (`e_skyMap`).

**WT2 quads** — `world.quads` (one row per sheet per copy: row = `first + copy · S + slot`, slot 0 the base, then parts, then layers)

| Field | Type | Meaning |
|---|---|---|
| `node` | Int32Array | its node row |
| `sheet` | Int32Array | sheet handle (SH1); −1 none yet = not drawn |
| `layer` | Int32Array | its WT3 row, −1 none |
| `el` | Int32Array | element index (= row of `world.elements`, `C.elements`) |
| `form` | Int32Array | its row of `world.forms` (base slot of a FORM), −1 none |
| `aux` | Int32Array | an INSERT's row of `world.inserts`, −1 else |
| `kind` | Uint8Array | `QUAD`: CARD 0, FACING 1, PLANE 2, DRAPE 3 (a `drape` plane only in a world with a land function), SKY 4, INSERT 5, FORM 6 |
| `flags` | Uint32Array | `FLAG` bits below |
| `recv` | Uint32Array | receivers it is: bit 0 `RECV.GROUND` (draped plane, `walk` plane, a plane someone stands `on`, a plane lying level < 0.2 m with no `on`/tilt); bits 1… the ids some caster's `onto` names (≤ 31, more is a build error) |
| `cast` | Uint32Array | receivers its shadow falls on (`el.cast`); 0 for a layer with blend `add`/`multiply` |
| `own` | Uint32Array | row of `world.own` + 1 (base and layer slots of an element with a shader), 0 none |
| `clip` | Uint32Array | bits 0–1 cutter set it is clipped by; bit 2 seen outside its cutters; bits 4–7 sets it cuts (`CLIP.SETS` = 4) |
| `rect` | Float32Array(4·cap) | l, t, r, b in the sheet's units (metres in the node's plane, y down; stage heights for sky/insert) |
| `tint` | Float32Array(4·cap) | r, g, b linear, glow — a copy's; (1,1,1,1) else |
| `seed` | Float32Array | phase of wind/flicker (hash of id mod 1000, or the copy's) |
| `sheer` | Float32Array | the element's `translucent` 0…1 |
| `stamp` | Uint32Array | |

`FLAG` (`base.js`; kind in bits 0–2, `QUAD.KIND` = 7): SHOWN 8, GLOWS 16, WIND 32, DRIFT 64, SHIMMER 128, FLICKER 256, WRAP_X 512,
WRAP_Y 1024, FLIP 2048, INSIDE 4096, REFLECTED_ONLY 8192, REFLECTS 16384, GLASS 32768, CLIPPED 65536, PART 131072, WHOLE 262144,
ADD 524288, MULTIPLY 1048576, READ 2097152, OFFERED 4194304, SELECTED 8388608, CUT_ONLY 16777216.
Drawn ⇔ `SHOWN` ∧ node shown ∧ `sheet ≥ 0` ∧ not `READ` ∧ not `CUT_ONLY` (an `unseen` element that cuts a `clip`: `SHOWN`
for the lists and its pages, drawn into the clip masks alone — it casts nothing, is not drawn on the land and no ray
hits it; an unseen element that cuts nothing is not `SHOWN`). SCENE clears `SHOWN` while a layer's alpha is 0 and sets it back
when it is not (`world.layerShown` — an unseen cutter's layer as `flagsOf` has it).
`WHOLE`: drifting layer, or an own shader's sheet its text reads elsewhere than where the quad stands (`spec.js standsOf`).
`OFFERED`/`SELECTED` written by `world.mark` (IN3). GLASS rules: plan 3.4 WT2.

**WT3 layers** — `world.layers`: `pose` Float32Array(8·cap), `opts` Float32Array(12·cap), `stamp`.

| | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10–11 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `pose` | x | y | rotate (rad) | scaleX | scaleY | alpha | brightness | length (SCENE's: pivot → farthest box corner) | | | |
| `opts` | pivot x | pivot y | wind strength | wind gust | wind scale (default 1) | flicker | shimmer | depth | drift x | drift y | spare |

New row: pose (0,0,0,1,1,1,1,0), opts 0. An animate writes `pose[0…6]` by name (`element.js`: `e.layer(name).x … brightness`,
`scale` sets both); reading a layer the element lacks gives 0. A layer of the same name and options keeps its row across a new painting.

**WT4 lights** — `world.lights` (`tables.js`, written by `light.js createLights`)

| Field | Type | Meaning |
|---|---|---|
| `kind` | Uint8Array | `LIGHT.FAR` 0, `THROUGH` 1, `POINT` 2, `WINDOW` 3 |
| `node` | Int32Array | node it hangs on (painted light, window, person), −1 |
| `at` | Float64Array(3·cap) | place (point, window middle) |
| `way` | Float32Array(3·cap) | toward a far light; a window's face; where a beam points (default (0,1,0)) |
| `cone` | Float32Array(2·cap) | a beam's (a POINT with a cone): cos of half its width, cos where its soft edge begins (> 0); (0, 0) for every other light |
| `colour` | Float32Array(3·cap) | linear |
| `strength` | Float32Array | as it shines now (`on` × the looks' share × glow) — never the flicker; a window's (and a point light's with `daylight`) × the brightest channel of the look's `ambient · ambientColor`, its colour that over it — no far light in it |
| `reach`, `sprite`, `glow`, `flicker`, `seed`, `soft` | Float32Array | metres; painted glow radius; …; through-light edge (default 0.3 m) |
| `flags` | Uint32Array | `LIGHT.INSIDE` 1, `LIGHT.GLOW` 2 |
| `named` | Uint8Array | 1: some caster's `shadow.light` names it |
| `ids` | Array | its id (`namesLight` matches `shadow.light` against it) |
| `version` | number | +1 at every add / free |
| `stamp` | Uint32Array | |

`world.castsIn(quad, row)`, `world.personCastsIn(index, row)` → boolean: false when the light is the caster's own (its node is the caster's — of an element with copies, the quad's copy's: its e.light, one taken over with `of`, a person's lantern, a window's daylight); else the caster names no light, or names this one
(`namesLight(name, id)`: equal, or equal to the id before `#` / `:`). RENDER imports only `hazeReach` of `light.js`.

**WT5 the rest** (plain objects SCENE owns)

| Object | Fields |
|---|---|
| `world.look` (`light.js createLook`) | `ambient, ambientColor, inside, haze, hazeColor, hazeGlow, brightness, tint (rgb or null), tintStrength, saturation, vignette, grain, bounce, shafts, wind: [x, z, strength], stamp`; SCENE's own beside: `hazeReach`, `lights` (share per spec light) |
| `world.relief` (`relief.js reliefOf`), null without land | `height(across, distance)` (the land function; `height.lift(p)`), `field: { data, nx, nz, step, x0, z0 }` (sample at across `x0 + i·step`, distance `z0 + j·step`), `low`, `high`, `stamp`; SCENE's own: `rayHit(o, v, far)` |
| `world.emitters` (`emitters.js createEmitters`) | `n, list, wind: Float32Array(256·7), windN, windStamp, air: { x, z, gust }`; `list[i]`: `p` (compiled numbers, every field — list in the file's head), `node, inside, ring: Float32Array(256·12), head, bursts: Float32Array(6·12), sprite: Recording | null, seed (0…1), stamp`; RENDER also reads `n, gave, life, offset, position` |
| `world.own[i]` | `text, names, values: Float32Array (the element's uniforms, shared by copies), quads: Int32Array(OWN.SHEETS = 10) (−1 none; [0] the base), stands: Uint8Array(10), stamp` — one entry per copy of an element with a shader |
| `world.inserts[i]` | `el, key, open 0…1, iris [x, y, rx, ry] | null, making, stamp`; ≤ `INSERTS.MOST` (16, a build error past it). `open` is the opening SCENE shows (`world.js` `openings`, each step): the key's at once on an unseen step and in a whole frame; else 0 while `making` or a shown quad of it has no sheet or `sheets.missing(sheet) > 0`, then its key's move (`director.moveOf`, as it was when the key left 0) run from that tick, the smaller of it and the key — a key with no such move as it is; closing never waits. The element's node is shown (its quads listed) from the key's leaving 0 (≥ 0.002). Points (IN1), `insertHit` and `inspect`'s `seen` follow `open` |
| `world.moves`, `world.opened` | the director (set by `thread.js`: `moveOf(key)`, `moveAt(a, s)`, `ahead(h)`, `cameraMoving`); on a seen step an opening began in, the seconds since its key left 0 (the most of them), else −1 |
| `world.panes` | `n, node: Int32Array, rect: Float32Array(4n), poly: Float32Array, polyOf: Int32Array(2n) (first point, count), light: Int32Array (its light row), stamp` |
| `world.people` | PP1's object, or null |
| `world.bounds` | `{ min, max: Float64Array(3) }`, worked out when anything moved (also in unseen steps) |
| `world.origin`, `world.originStamp` | render origin, whole steps of `ORIGIN.STEP` (64 m) once the eye is past `ORIGIN.REACH` (96 m) on any axis; on a step every node row is sent again |

Emitter ring moment (12 floats): time, x, y, z (world), vx, vy, vz, amount, quaternion x y z w; unwritten time −∞. Wind entry
(7): time, gone-by x z, gusts' share x z, wind x z; unwritten time +∞. Particles cap (`PARTICLES.MAX` 65536) applied in `spec.js compile`.

**WT6 the world on the GPU** — `world.gpu = { nodes, quads, layers (GP2 tables), forms (texture), formsRows, formsVersion }`.
Chunk `world` (`world/world.wgsl.js`) declares group 0: binding 1 `e_nodes`, 2 `e_quads`, 3 `e_layers` (storage, read), 11
`e_forms` (texture_2d<f32>); structs `e_Node`, `e_Quad`, `e_Layer`; constants `e_QUAD_<KIND>`, `e_QUAD_KIND`, `e_QUAD_<FLAG>`,
`e_QUAD_NONE` (0xffffffff), `e_WORLD_STAGE`, `e_FORM_SIDE`.

| Function | Does |
|---|---|
| `e_quadOf(i) -> e_Quad`, `e_quadKind(q)` | the row; its kind |
| `e_quadPoint(q, uv) -> vec3f` | point in the node's plane `(x, −y, depth)` after the layer's pose (no wind); FORM: the grid's texel nearest uv |
| `e_quadWorld(q, p, yaw) -> vec3f` | world less origin; FACING turned by yaw, scaled by the node's x-axis length; DRAPE + `e_reliefAt(w.xz)`; SKY a direction; INSERT `(x − STAGE/2, y, 0)` |
| `e_quadNormal(q, uv, yaw) -> vec3f` | node z; FACING `(−sin yaw, 0, cos yaw)`; FORM the grid's; SKY/INSERT (0,0,1) |
| `e_quadGlow(q) -> f32` | 1 in a mirror's view; SELECTED `1 + PULSE.DEPTH`; OFFERED `e_frame.pulse`; else 1 |
| `e_skyMap`, `e_skyWay`, `e_skyAt`, `e_formTexel`, `e_quadSheet`, `e_insertThere` | helpers |

Called, provided by RENDER: `e_reliefAt(xz) -> f32` (`render/wgsl/land.js`; `render.relief.none` returns 0),
`e_insertOf(i) -> vec4f`, `e_insertOpen(i) -> f32` (`render/wgsl/frame.js`, Frame iris/open arrays).

**WT7 `place(world, quad, p, view?) → boolean`** (`world/place.js`). `p`: Float64Array(3) in = (sheet x, sheet y, view yaw), out =
the point. Layer pose first (`posed`), except a `READ` row not `WHOLE`. CARD/PLANE `m·(x, −y, depth)`; FACING origin +
s·Ry(yaw)·(x, −y, depth); DRAPE as PLANE then `world.lift` (the land function at across x, distance −z); FORM bilinear in the 33 × 33
grid; SKY `skyWay` direction; INSERT `(x − STAGE/2, y, 0)`, false outside the iris as far as open. FLIP mirrors x (not SKY/INSERT).
`view`: `{ nodes, nodeOf, nodesN, over, overN }` — node overrides and swaps (a swapped FORM's grid from the swap's third number).

**WT8** `world.pointOf(ref, out, get?) → boolean` (= `pointFor(ref, out) === 1`: in the world; with `get` — key →
value — as those values would have things: a `{ on, at }` point by that element's frame then, an element's point
carried with its node there, a person's and a copy's as now), `world.pointFor(ref, out, yaw?, over?)
→ 0 none | −1 none yet | 1 world | 2 sky direction | 3 frame`, `world.carriedWith(el, p, get, M) → M`,
`world.movedBy(id) → string[]`, `world.placedNow(id) → boolean` (`el.jumpedAt === tick`), `world.view = { safe, seen }`
(stage heights, `[l, t, r, b]`; the camera writes it; `e.view`, `scene.view`), `world.byId: Map<id, element>`,
`world.quadsOf(el) → [first, count]`.

**WT9** shared with the artist: `compile(spec, warn) → C` (`world/spec.js`: `{ spec, yh, camera, elements, byId, light, lights,
has: { relief, people, emitters, casters, reflects, glass, clips, inserts, beams, own, skyOwn }, relief, lib, script, showcase, state }`);
`kit.shared(spec, modules) → { anim, lib, kits, errors }` (`world/kit.js`); `landOf(C, shared, warn?) → height | null`,
`fieldOf(height, region) → field` (`world/relief.js`).

**WT10 forms** — `world.forms = { n, list, free, version }`; `list[i] = { el, points: Float32Array(33·33·3), normals (same),
closed (bit 0 u, bit 1 v), sphere: Float32Array(4), stamp } | null` — node metres, rows in v. A form made again takes a new row.
GPU: texture `rgba32float`, `31·66` wide, `33·rows` tall; form i at `(66·(i mod 31), 33·⌊i/31⌋)`: point texels (w = 1), normals 33
to the right (w = 0). More rows → a new texture, all forms written again, `formsVersion + 1`.

**WT11 what RENDER reads of `world.elements[i]`**: `index, id, kind, node, first, count, visible, radius, cast, mirror`
(a mirroring plane's `{ strength, rough, ripple, stamp }` as its keys have them now); of `spec`:
`behind, inFront, shadow ({ light, onto, strength } | null | false), reflect, glass`, `flags.translucent/reflect/glass/inside`.
(Exception: the stand's detail survey, `render/survey.js`, also reads `nodes`, `partSlots` and `world.tables.measure/delta`.)

**4.1 GPU rows** (little-endian; packed by `tables.js`, read by chunk `world` and RENDER's chunks)

`nodes` — 48 bytes: `e_Node { r0, r1, r2: vec4f }`, the matrix's rows as f32, `.w` = translation − origin.

`quads` — 96 bytes, `e_Quad`:

| Offset | Member | Type | From |
|---|---|---|---|
| 0 | `node` | u32 | `node` |
| 4 | `sheet` | u32 | `sheet >>> 0` (0xffffffff none) |
| 8 | `layer` | u32 | `layer >>> 0` (0xffffffff none) |
| 12 | `flags` | u32 | `(flags & ~7) | kind` |
| 16 | `recv` | u32 | |
| 20 | `casts` | u32 | `cast` (`cast` is reserved in WGSL) |
| 24 | `own` | u32 | |
| 28 | `seed` | f32 | |
| 32 | `rect` | vec4f | l, t, r, b |
| 48 | `tint` | vec4f | r, g, b, glow |
| 64 | `el` | u32 | |
| 68 | `form` | u32 | `form + 1` (0 none) |
| 72 | `aux` | u32 | `aux >>> 0` |
| 76 | `clip` | u32 | |
| 80 | `sheer` | f32 | |
| 84–95 | `spare0…2` | u32 | 0 |

`layers` — 80 bytes, `e_Layer`: `pose0` (x, y, rotate, scaleX) 0; `pose1` (scaleY, alpha, brightness, length) 16; `opts0` (pivot x,
pivot y, wind strength, gust) 32; `opts1` (wind scale, flicker, shimmer, depth) 48; `opts2` (drift x, drift y, 0, 0) 64.

`Frame` (group 0 binding 0, RENDER writes): `time` f32 @0, `tick` u32 @4, `pulse` f32 @8, spare @12, RENDER's own from 16 (`FRAME` in
`render/wgsl/frame.js`; iris array @224, open @480). `View` (group 1 binding 0): `proj` @0, `rot` mat3x3f @64, `eye` @112, `yaw` @124,
`size` @128, `sheetBias` @136, `flags` u32 @140 (bit 0 `VIEW.MIRROR`), RENDER's own from 144.

Order (RENDER's instance buffer, slot 1, 68 bytes): `quad` u32 @0 (loc 1), `shape` u32 @4 (2), `page` vec2i @8 (3), `edge` f32 @16 (4),
`piece0…3` vec3f @20/32/44/56 (5–8). Slot 0: `corner` vec2f (loc 0), stride 8.

`inks` — PP11.


## 6. SCENE ⇄ SHEETS ⇄ RENDER

The sheets: every painting as a display list (`Recording`), laid as a pyramid of pages, painted by painter threads
only where the views need them, kept in one cache texture, found on the GPU through one page table. Design and
reasons: plan 3.5 (SH0–SH14), 4.8, 5.6, 5.19. Files: `engines/3/sheets/` — `artist.js`, `easel.js`, `recorder.js`
(artist side); `cache.js` (the `sheets` object), `ask.js`, `table.js`, `page.js` (scene thread); `painters.js`
(painter threads); `sheets.wgsl.js` (GPU). WGSL names carry the `e_` prefix (plan 4.1); below they are given without it.

### 6.1 Threads and who owns what

| Thread | Module | Owns |
|---|---|---|
| artist (one per scene shown, made by `thread.js`) | `artist.js` + `easel.js` + `recorder.js` | runs paint code into `Recording`s; the land's height field |
| scene thread | `cache.js` (`createSheets`) + `ask.js` + `table.js` + `page.js` | sheets and handles, page records, cache cells, the page table, asks, weighing, the painters' queue |
| painters (`host.painters`, made by `createSheets`) | `painters.js` + `page.js` | a copy of every sheet's recording; rasters pages and pictures |
| GPU | chunk `sheets` (`sheets.wgsl.js`) | reads the table, then the cache |

SCENE keeps handles (in `quads.sheet` and in swaps, SH2); RENDER reads handles from quad rows and own-shader uniforms.
Only `cache.js` writes the table and the cache texture.

### 6.2 The artist's messages (SH6) — `world/world.js`, `thread.js` ⇄ `sheets/artist.js`

Taken one at a time in arrival order. A message that cannot be handled is the worker's uncaught error
(`artist.onerror` → `world.fail`); the next ones are still taken.

| Message (scene → artist) | Fields | Answer |
|---|---|---|
| `show` | `spec`, `modules` — once, first (`thread.js`) | none; compiles spec, kit, lib, land fn. A failure makes every later `make` answer `rec: null` with that error |
| `keys` | `keys: [key]`, `values: [v \| null]` (null: key gone) — sent only right before a `make` | none |
| `make` | `job` (int), `index` (element), `as` (a shot's values over the state, or `null`), `spot: { across, distance, elevation, ground }` | `made` (always) |
| `land` | `region` | `{ t: 'landed', field }` — `field` (its `data` buffer transferred) or `null` (no land) |

`made` = `{ t: 'made', job, rec, form, parts, layers, lights, points, notes, reads, seen, errors, warnings }`:

| Field | Shape |
|---|---|
| `rec` | `Recording.wire()` of the element's painting (buffers + ImageBitmaps transferred), or `null`: code threw, form refused, no code, or not sendable — then `form`/`parts`/`layers` are empty too |
| `form` | `{ points: Float32Array(33·33·3) (row by row in v), closed: 0 none \| 1 u \| 2 v \| 3 both }` or `null` |
| `parts` | `[{ dx, dz, box: [l,t,r,b], rec }]` |
| `layers` | `[{ name, opts, rec }]` — `opts` checked by the easel (`pivot, wind{strength,gust,scale}, drift, flicker, shimmer, blend (normal/add/multiply), depth, box`); a drifting layer's `box` widened to whole level-0 px along the drift (SH7) |
| `lights` | `[{ x, y, r, color, strength, name\|null, part, layer }]` |
| `points` | `[[name\|null, { x, y, part, layer }]]` |
| `notes` | `[{ value, at: { x, y, part, layer } \| null }]` |
| `reads` / `seen` | `[key]` / `[[key, JSON of the value painted from]]` |
| `errors` / `warnings` | `[string]` |

x, y in the painting's units; `part`/`layer` = index in `parts`/`layers`, −1 the base. SCENE makes each `rec` live with
`Recording.fromWire` and passes it to `sheets.add` (`world.js` `takeOf`; `wrap` = the layer's `opts.drift` axes). One
make in flight per element (`el.job`), plus per live shot, at most `MAKES_AHEAD` (2) shot makes in flight.

**The easel's `e`** (SH8, `easel.js createEasel → make(index, as, spot)`): `id, rnd (seeded by id), aspect, area,
state (reads noted; writes warned), anim, kit, lib, ground(across, distance), spot (its place keys noted), light, at,
part(dx, dz, paint, box?), layer(name, opts?, paint), form(fn, { closed, ground }?), debug, warn`; `e.t`, `e.point`,
`e.where`, `e.was`, `e.speed` warn and return 0/null. `g` is a `Recorder`; `globalThis.Path2D` is `PaintPath` in the
artist. A form gives the recording a ground (default `#808080`, alpha dropped).

### 6.3 The recording (SH7) — `sheets/recorder.js`

| Member | Meaning |
|---|---|
| `new Recorder(rect, warn)` | the Canvas 2D API in the painting's units; `end() → Recording` |
| `rect` `[l,t,r,b]` | what the sheet is laid over (element box, part box, layer box) |
| `extent` `[l,t,r,b] \| null`, `empty` | where ink was drawn (a fully transparent draw counts; a ground covers `rect`) |
| `dense` 0…1 | how much one draw covers a pixel at most: max over draws of `globalAlpha × max(style alpha, shadowColor alpha)` — a gradient its most opaque stop, a pattern / an image 1; composite ≠ `source-over`, a filter with `url(`, a ground → 1; `clearRect` 0. Carried in the wire. The camera's rays (`world/space.js` `ray`) see through a slot whose `dense × layer alpha < CAST.ALPHA`, or a layer `blend` add / multiply; `pick` does not |
| `h1`, `h2` | two 32-bit content hashes |
| `under` | the ground colour or `null` |
| `same(o)` | same numbers, same refs, same ground |
| `touches(l,t,r,b)` | a draw's box (reach + clip) meets the box; never false where ink is |
| `replay(g, region, scale)` | draws the items whose boxes meet `region` into `g` at `scale` px/unit, region corner at `g`'s origin |
| `wire() → Promise<w>` | sendable form (refs: strings/numbers/gradients as `{ style, args, stops, image }`, images as ImageBitmaps) |
| `Recording.transfers(w)` | the buffers and ImageBitmaps to transfer |
| `Recording.fromWire(w)` | live recording; keeps `wired = w` (what `sheets.add` and `sheets.picture` require) |
| `close()` | closes its ImageBitmaps |

The wire form `w` = `{ path: F64, runs: F64, items: F64, mats: F64, rows: I32, clips: F64, refs, order: U32, levels:
[F64], extent, rect, under, dense, h1, h2 }`. Layouts (all in numbers of the arrays):
- `items`: 18 a draw — `[kind, row, mat, clip, l, t, r, b, reach, args×9]`; kinds `FILL 1, STROKE 2, FILL_RECT 3,
  STROKE_RECT 4, CLEAR_RECT 5, FILL_TEXT 6, STROKE_TEXT 7, IMAGE 8`; args: fill/stroke `(from, to, ruleRef, own)`,
  rects `(x, y, w, h)`, text `(textRef, x, y, maxWidth|NaN)`, image `(imageRef, sx, sy, sw, sh, dx, dy, dw, dh)`.
- `path`: commands each followed by its numbers — `MOVE 1, LINE 2, BEZIER 3, QUAD 4, ARC 5, ARC_TO 6, ELLIPSE 7,
  RECT 8, ROUND_RECT 9, CLOSE 10, SUB 11 (6 matrix numbers, count), MAT 12 (mat row)`. Context paths first, then
  copied `Path2D` objects.
- `runs`: 8 a run (≤ 64 line/curve commands) — `[from, to, l, t, r, b, lastX, lastY]`.
- `mats`: 6 a transform; row 0 identity. `rows`: 24 refs a row (23 properties + dash). `clips`: 6 a clip —
  `[parent, from, to, ruleRef, own, mat]`, clip 0 none.
- `order` + `levels`: a box tree — leaves sorted by Z-curve, `levels[0]` their boxes (4 a box), each level above one
  box per 8 below.

### 6.4 The `sheets` object (SH0–SH13) — `sheets/cache.js`

`createSheets(gpu, host) → sheets`, once per mount. Reads `host.cache` (layers, 1…128), `host.painters`, `host.busy`,
`host.wholePages`, `host.pages`, `host.ahead` and `host.ts` (a probe's period), `host.flags.stand`, `host.error(err)`,
`host.failed(err)`. Starts the painters.

| Call | Who | Does / returns |
|---|---|---|
| `add(recording, { wrap: [x, y] }) → handle` | SCENE | 0…65535. Same `h1:h2:items.length\|rect\|wrap` and `same()` → the existing handle, refs + 1. Else a new sheet: table block, handle rows, `set` to every painter, top recorded (pinned cell, or told blank or of one colour at once). Throws: recording not `fromWire`, > 65536 sheets, table full, no room for a top |
| `release(handle)` | SCENE | refs − 1; at 0: records and cells freed, handle rows zeroed, block freed, `drop` to painters, `recording.close()` |
| `missing(handle) → int` | SCENE (swaps land at 0) | SH3: of the pages the last ended cycle named of it, how many are not painted/blank (denied ones not counted); not named then: 1 until its top is there, else 0 |
| `coverage(handle, u, v) → 0\|1` | SCENE `world/space.js` | SH4: the top's mask (alpha > 160); 0 until the top is placed or outside 0…1 |
| `onArrive` | SCENE sets (`thread.js`) | called once per page answer (not pictures) |
| `flying` (getter) | SCENE | pages sent and not answered |
| `picture(recording, w, h) → Promise<Uint8Array>` | RENDER `particles.js` | SH9: the whole recording over `rect` into w × h, premultiplied linear stored sRGB-encoded, rows top first; least busy painter |
| `place(count) → int` | RENDER step b; build (`Infinity`) | SH11: tells the table of pages found blank or of one colour since; places up to `count` arrived pages (`sheets/upload.js`: `writeTexture` of the bytes into a staging layer — 8 layers of 272², a batch —, then a pass a cache layer and level, a draw a page, in one submit); gives each page's bytes back to its painter (`back`) to be let go there; flushes the table. `count === Infinity` = a whole call: all painters work, painters never held |
| `ask(view) → int` | RENDER step f; build | SH10, 6.5 |
| `weigh() → bool` | RENDER / build after each round of asks | the views' pressures and cells (5.19, below; a view with `next` set — a scene made beside: plan 2.9 — has a share kept: `min(its need, room / 2)`, out of what the views served before it get); then cells for the closed inserts' pages; true if a pressure moved or a view at its end was newly denied |
| `request()` | RENDER step g; build | SH12: tops, then the ordered list to painters — the views' own pages by `weight × levels lacking`, a page's parent always before it, then the closed inserts' pages; ends the cycle (records let go — a probe's names keep theirs —, table flushed, `cycle` rewritten) |
| `whole(world) → bool` | RENDER (`lacks.sheets`) | every shown quad's sheet has its top (painted or blank) |
| `solid(handle) → 0\|1\|2` | RENDER `quads.js`, `sky.js` | 0 no opaque pixel so far, 2 no hole (all pages opaque, none blank; a page of one colour is opaque), 1 mixed or top not there |
| `stamp(handle) → int` | RENDER shadows, mirrors | + 1 when a page is placed, found empty, let go, or `solid` changes |
| `cycle` | stand (`thread.js`) | one object of the cycle that ended: `{ sent, evicted, denied` (pages), `bias` (the greatest pressure among the views asked), `own` (the greatest `drawn − coarser` of the frame's own views), `again` (own pages placed again that were let go for room while a view named them that round), `wanted` (pages the frame's own views and `toward`'s named as their own that no view named in the cycle before and that the painters must still paint — not painted, not blank, not in flight), `named`, `has` (units: the frame's own views' own pages, each once, parents in, tops apart; those there), `insert` (units the largest closed insert named quietly in the frame's own views, by its row `quads.aux`), `room` (units: the cache less the tops) `}` |
| `stats()` | stand, perf | `{ sheets, layers, slots, used, pages, records, flying, arrived, rows, bias, painters, busy[], placed, sent, evicted, blank, solid, stale, denied, failed, jobs, again }` (`solid`: pages of one colour, never painted) |
| `asking` | RENDER | the ask function: `worked` (items worked out so far, RN8 `asked` = difference over a call), `slot(k)`, `measure(on)`, `stats` (stand), `why` |
| `table` | RENDER | the GP2 table; its `version` moves when it grows |
| `bindings()` | RENDER | `[{binding:4, buffer}, {binding:5, cache view}, {binding:6, sampler 'sheetSampler'}]` of group `frame` |

**A cycle**, in order: `place(count)` → rounds of { `ask` every view in the order of service; `weigh` } →
`request()`. In a whole call (and the build: `thread.js openingView`) rounds repeat until `weigh()` is false; else one
round. `view.bias`, `drawn`, `entered` are written only by `ask`.

**Whose a view is** (for `cycle`, and the probe's rule below): SHEETS tells them by the order of service and the
View's fields — a shot's: `ahead`; `toward`'s: not `ahead`, asks `inserts`, and is not the first view asked in the
round; the frame's own (the frame's — asked first —, its mirrors', its shadow views'): the rest.

**Weigh** (5.19), views in the order they were asked; `C` = the cache's units less the tops' and those the views served
before took; `N` = the units of the pages a view was the first to name as its own this round (parents in, tops apart, a
page blank or of one colour by its recording nothing, one a painter found empty as its cell):
- `N > C`: the pressure rises by `⌈2 · log2(N / C)⌉` quarter levels, at most 4 a weigh and at most 4 above `drawn −
  coarser`; nothing taken. At `BIAS.MOST`, or where it may rise no further, it takes what fits and the rest is denied
  (not waited for, by it nor by a view served after it).
- else, a pressure above 0 whose bias is drawn (`drawn === bias`) falls a quarter level where its PROBE — the view
  asked at `bias − 1` with no closed insert, its names `NAMED.PROBE` (no round, no cell, no request; they
  keep their records) — counts, as `N` would be counted there, at most `BIAS.FALL · C` units and at most `BIAS.FALL` of
  the whole slots left for the view. A probe is asked only there; it works out its items every round where every
  painter is at work (`place(Infinity)`), else at most one probe a round, each once every `host.ahead / 2` s
  (`host.ts`), not in the round `toward`'s view had `changed`, and not where its view's ask worked out no item — then
  it names again what it named; a probe with nothing to name again (new, of another bias, records perhaps let go)
  counts nothing.
- then the view's own pages without cells are given cells (free, then pages nobody names this round, then the closed
  inserts' of this round, then views served after it); where the shapes fail, the cells just taken are given back and
  the pressure rises by what it got.
- after every view: the closed inserts' pages (`QUIET`) get cells only from free ones or those of pages nobody names
  this round; in a whole call only once every pressure stands.

### 6.5 The View and the ask (SH10) — `sheets/ask.js`, called via `sheets.ask`

| Field | Writer | Meaning |
|---|---|---|
| `world`, `camera` | R | the world; Camera `{ eye: F64[3], rot: F32[9] col-major, proj: F32[16] col-major (reversed depth), yaw, ortho }` |
| `width`, `height` | R | viewport px of this view |
| `weight` | R | 1 the frame's (0.5 under a solid insert) and a shot's own view where the shot is the film's next beat (`f.ahead[i].next`) and the call is not whole, 0.5 others |
| `coarser` | R | quarter levels added: `SHADOW.COARSER` (8) for shadow views; a moving shot's pressure |
| `inserts`, `ahead` | R | ask inserts; a shot's view |
| `list`, `n` | R | Int32Array of quad rows from R's cull |
| `over`, `overN` | R | swaps `Int32Array` of triples `(quad, handle, form)`; handle −1 ends the row (shot views only) |
| `nodes`, `nodeOf`, `nodesN` | R | a shot's node overrides, or null/0 |
| `changed` | R | bits `CHANGED`: `EYE 1`, `TURN 2`, `ALL 4` |
| `fresh` | R sets, SHEETS clears | the view begins: pressure starts at 0 |
| `bias` | SHEETS (in `ask`) | `coarser + pressure`, quarter levels: what the view is asked at |
| `drawn` | SHEETS (in `ask`) | the bias the view is drawn at: `bias` from the ask in which every page it names is there (denied ones left out), at once where the view begins (`fresh`, its first ask) and in a whole call; never under `bias − 4`. R copies it into the view uniform (`sheetBias`) |
| `entered` | SHEETS (in `ask`) | missing pages that entered what is asked this cycle |
| `_` | SHEETS | its own state |

Returns the view's OWN pages not painted and not blank — parents in (quiet pages never count; pages denied to a view
at its bias's end not counted).

- **Coarse to fine**: every page named `OWN` (or `PROBE`) is named after its parent — `(L + 1, i >> 1, j >> 1)` of
  the same sheet, as the same, not of the sheet shown — unless that parent is the sheet's top, or the call is whole
  (`place(Infinity)`: a held frame and the build name no parent, and wait only for the pages they show). One level: a
  parent's own parent is not named for it.

- **Items**: a quad row asked one way — `LISTED` (in `list`), `QUIET` (an insert not listed, `FLAG.SHOWN`), `ALONE` (a
  swap whose quad is not listed) — plus the further sheets of its own shader (`world.own[k].quads`). A further sheet's
  row is no item of its own (listed or quiet): its base asks it, and nothing does while the base is not seen. A further
  sheet that lies as its base does — `READ` and not `WHOLE`, the base's kind and node, neither it nor the base `FLIP`
  or `WIND`, the base on no layer, no swap on either, its sheet's layout `l, t, r, b, W0, H0` the base's — names the
  pages the base's descent named, with no descent of its own. An item is named again unchanged unless: the view's
  `changed & ALL`, its bias, weight or world changed, a sheet was added/released, a whole call began or ended, or its
  last ask is older than the last round of the cycle two before (all items); the kind reads what moved
  (`SKY` reads `TURN` only, `INSERT` nothing, others `EYE|TURN`); its quad/node/layer rows were stamped since (3.4), or
  the look where `FLAG.WIND`; or it is new to the view.
- **Named as** `NAMED`: `OWN 0` (weight = view's), `QUIET 1` (0.5), `PROBE 2` (a probe's; 0). The
  ask (`ask.js`) is given what its own pages are named as (`OWN`, or `PROBE` — then no closed insert is asked). In a
  frame view a quad waiting for its swap is
  asked for both sheets; in a shot view for the swap's alone. `ASKED` (exported): `LISTED 0, QUIET 1, ALONE 2`.
- **Level** (plan 4.8; same formula as `sheetLevel`): `a, b` = level-0 px of the sheet per screen px along screen x,
  y; `level = max(log2 min(a,b), log2(max(a,b)/T)) + bias/4`, `T` = 2 for `PLANE`/`DRAPE`, else 1. A pixel at level λ
  reads the page of level ⌊λ + SHEET.SOFT⌋ (1/8: at most 2^⅛ ≈ 9 % magnified). The ask names from ⌊λ + SOFT⌋ of the
  finest corner to ⌊λ + SOFT + SLACK⌋ of the coarsest (`SLACK` 1/8, coarser only) and widens the view by `GUARD` 2 px; a
  pixel finer than its corners past a whole level reads the page named a level above its own.
- **Kinds**: flat pieces (card, plane, insert, form blocks of `FORM.BLOCK` cells, backdrop turns) by their four
  placed corners; curved (`DRAPE`, round sky) by nine kept points a node (two tables of `2^15` entries for each
  world asked — a scene being made beside the one drawn has its own: 2.9 —, three `place` calls a point); `FLAG.WHOLE` asked whole from the finest level needed up, never finer than
  `sheet.wholeL` (≤ `host.wholePages` pages); `FLAG.WIND` widened by the layer's bend bound.

### 6.6 The painters' messages — `sheets/cache.js` ⇄ `sheets/painters.js`

| Message (cache → painter) | Answer |
|---|---|
| `{ t: 'start', stand }` — first; `stand`: time each job | none |
| `{ t: 'set', id, rec: w, lay }` — every sheet, to every painter (structured clone of the wire form) | none |
| `{ t: 'drop', id }` | none; the painter closes its copy |
| `{ t: 'pages', job, list: [{ id, L, i, j, w, h, top }] }` — one page, or up to `TOPS` (16) tops | `{ job, pages: [p], ms? }`, `p` = `{ pixels, kind, mask?, mw?, mh? }` \| `{ kind }` (empty, no bytes) \| `{ error }` |
| `{ t: 'picture', job, rec: w, w, h }` | `{ job, pixels, ms? }` \| `{ job, error, ms? }` |
| `{ t: 'back', buffers }` — at the end of a `place`, to each painter whose pages came: their `pixels` buffers, transferred back (`writeTexture` has copied them) | none; they are let go on the painter's thread, so the scene's thread collects none |

`pixels`: w × h rgba8 as the canvas gave them (`getImageData`: sRGB, not premultiplied; the cell, border included;
past a rect's edge that does not wrap, what lies there is not read — `cellInside(lay, L, i, j, w, h)` → `[x0, x1, y0,
y1]`: the upload repeats the last whole pixel inside, as a clamped read); the GPU writes the cache's premultiplied
linear stored sRGB-encoded and the half level (`sheets/upload.js`, its layout `sheetUpload`: the staging texture and
the pages' cells, `Page { at: vec2u, layer, pad, inside: vec4u }`; pipelines `sheet page`, `sheet half`); `kind` bits
`KIND`: `EMPTY 1, OPAQUE 2 (every pixel ≥ SHEET.OPAQUE), SOME 4 (some pixel ≥ OPAQUE)` — `kindOf`, the alpha within
`cellInside`, stopping at the first pixel that makes it mixed; `mask` (top only): `mw × mh` bytes, 1 where alpha >
160. A page that errs is said once a sheet (`host.error`) and read as
empty. A painter's `onerror` → `host.failed`. Queue: `IN_FLIGHT` 2 jobs a painter; working painters = all in a whole
call, else `min(host.painters, host.busy)`; a painter that answers is fed the next listed page at once, unless
not whole and `PILE · host.pages` (4·) answers wait to be placed. Order: tops, then the views' own pages by
`weight × levels lacking` (greater first; a page whose parent is in the list ranked just under its parent), then the
closed inserts' pages.

### 6.7 Sheets, pages, cells — `sheets/page.js`, constants `SHEET` (`base.js`)

| Constant | Value | Meaning |
|---|---|---|
| `PAGE` | 256 | page side, px |
| `BORDER` | 8 | neighbour px round a page in its cell (4 at the half level) |
| `UNIT` | 68 | a cell unit = (PAGE + 2·BORDER)/4 |
| `TOP` | 52 | a top is ≤ 52 px either way (one unit with border) |
| `SLOT` | 272 | 4 × 4 units |
| `SLOTS_SIDE` | 7 | slots a layer side |
| `LAYER` | 1904 | cache layer side px |
| `MAX_PPM` | 2048 | level-0 px per unit of the rect |
| `WINDOW` | 7 | a level wider than 2^7 pages a side is windowed |
| `OPAQUE` | 242 | alpha counted as opaque |
| `SOFT` | 0.125 | a pixel at level λ reads the page of level ⌊λ + SOFT⌋ (4.8; the ask and `sheetFind` alike) |
| `BIAS.MOST` | 16 | the most pressure, quarter levels |
| `BIAS.FALL` | 0.8 | a pressure falls where its probe takes at most this share of the room (5.19) |

- **Layout** `layOf(rect, wrap) → { l, t, r, b, W0, H0, levels, wrap }`: `W0 = ceil(width · MAX_PPM)` (≥ 1); `levels`
  = first level ≤ `TOP` px both ways, + 1 (≤ 31). Level L is `MAX_PPM / 2^L` px a unit, cut into pages from the rect's
  corner. Past a non-wrapping edge the cell repeats the last whole pixel; past a wrapping one it holds the other side.
- **Cell shapes**: units across/down ∈ {1, 2, 4}; `shape = 3·log2(across) + log2(down)` (0…8, `FULL` 8 = a whole slot).
  A side of ≤ 52 px takes 1 unit, ≤ 120 px 2, else 4. A slot holds cells of one shape.
- **Cell id** = `slot · 16 + unit` (unit = `uy·4 + ux`); slot = `layer · 49 + sy · 7 + sx`. Its texel origin:
  `(sx·272 + ux·68, sy·272 + uy·68)` in layer `layer`; the page's pixel (0, 0) is `BORDER` px in.
- **Cache texture** `'sheetCache'`: `LAYER × LAYER × host.cache`, `rgba8unorm-srgb`, 2 mip levels (mip 1 = the
  pages' halves), usage `TEXTURE_BINDING | RENDER_ATTACHMENT` (written by the upload's passes), never grown; viewed
  `2d-array`.
- A top is recorded and pinned when the sheet is added and never let go; a page no draw reaches (`pageBlank`, via
  `Recording.touches`) is never painted and takes no cell; nor is a page of one opaque colour all over its cell, border
  in (`pageSolid`, via `Recording.uniform(l, t, r, b, pad)` → bytes `r | g << 8 | b << 16` or −1: the last draw meeting
  each part of the cell — within the rect, and past a wrapping edge the other side, whose seam lies between two
  pixels — is an unclipped, unturned `fillRect` over the part in `#rrggbb` at `globalAlpha` 1, `source-over`, no
  shadow, no filter; or no draw meets it and the ground is there): the table holds its colour.

### 6.8 The page table — `sheets/table.js` (GP2 table `'sheetTable'`, stride 8 bytes)

`TABLE = { HANDLES: 65536, SOLID: 2^24, EMPTY: 2^23, THERE: 2^22, TAIL: 4, STRIDE: 8, MOST: 2^24 rows }`. A row is two u32
(WGSL `array<vec2u>`). Starts at 2 · 131072 rows; grows by doubling up to `MOST` (version moves).

**Handle rows** (rows `2h`, `2h+1`):

| Row | `.x` | `.y` |
|---|---|---|
| `2h` | `at` — first row of the sheet's block (0: no sheet) | `W0` — width px at level 0 |
| `2h+1` | `H0` — height px at level 0 | `meta` |

`meta` bits: `0–4 levels`, `5–9 bx`, `10–14 by` (bits of level-0 page counts: `log2ceil(ceil(W0/PAGE))`), `15` wraps
across, `16` wraps down.

**A block** (`Block`): `whole = max(max(bx, by) − WINDOW, 0)` — levels below it are windowed. Rows from `at`:
one-page levels (`e = 0`) at `L − max(bx, by)` (rows 0…TAIL−1); a level with `e = bitsX(L) + bitsY(L) > 0` at
`TAIL − 2 + 2^e` (2^e entries); windowed levels after `windows = TAIL − 2 + (2 << (max(bx−whole,0) + max(by−whole,0)))`,
each `2^window` entries, `window = WINDOW + min(bx, by, WINDOW)`. `bitsX(L) = min(max(bx − L, 0), WINDOW)`.
Entry of page `(L, i, j)` = `level(L) + ((i & (2^bitsX − 1)) | (j & (2^bitsY − 1)) << bitsX)`.

**Entry** words:

| Word | Bits |
|---|---|
| `.x` (where to read) | `0–3` unit in slot (`ux` 0–1, `uy` 2–3), `4–6` slot x in layer, `7–9` slot y, `10–16` layer, `17–21` level of the page read, `22` THERE, `23` EMPTY (nothing painted there), `24` SOLID (the page is one colour: bits `0–16` its colour's low 17 bits, `25–31` the other 7 — `r \| g << 8 \| b << 16`, sRGB-encoded as the cache keeps an opaque texel; no cell). 0: nothing there. `cellOf` and `put` say a page of one colour as `oneColour(rgb) = −3 − rgb` |
| `.y` (tag, windows only) | `((i >> bitsX) & 0xffff) \| ((j >> bitsY) & 0xffff) << 16`; 0 in levels held whole |

`.x` is resolved on the thread: the page's own cell, or the finest page of its own above it that is there
(`resolved` on put/take). A window entry belongs to the first page asked for it in a cycle (views in order of
service); a page whose window entry is another's reads the level `whole` instead. Changed rows go out as stretches
(merged within 256 rows) in `place` and `request`.

### 6.9 What RENDER reads in WGSL — chunk `sheets` (SH14)

Bindings of group `frame` (GPU's, plan 4.2): `@binding(4) sheetTable: array<vec2u>` (storage, read),
`@binding(5) sheetCache: texture_2d_array<f32>`, `@binding(6) sheetSampler`. Reads `view.sheetBias` (quarter levels).

| Function | Meaning |
|---|---|
| `sheetOf(h: u32) -> Sheet` | from handle rows; `h ≥ 65536` or no sheet: `at = 0` (reads nothing) |
| `sheetCarry(s) -> SheetCarry`, `sheetFrom(c) -> Sheet` | `SheetCarry { a: vec4u (at, W0, H0, meta) — flat, b: vec4f — unused }` |
| `sheetLevel(dx, dy, taps) -> f32` | 4.8 + `0.25 · sheetBias`; dx, dy: level-0 px a screen px |
| `sheetFind(s, page: vec2i, at: vec2f, level) -> SheetHit` | one table read: wraps or bounds the point, clamps level to `0…levels−1`, reads the entry of level ⌊level + `SOFT`⌋ (clamped likewise; falls back to level `whole` for a foreign window entry) |
| `sheetNone(hit) -> bool` | word 0 or EMPTY: nothing there |
| `sheetTake(hit, dx, dy, taps) -> vec4f` | `taps` `textureSampleLevel` reads at mip `level − used` (clamped 0…1); 2 taps ±¼ of the long axis, ≤ 1 texel; premultiplied linear. A SOLID entry: its colour, decoded as `rgba8unorm-srgb` decodes, alpha 1 — no read |
| `sheetRead(s, page, at, dx, dy, taps)` | `sheetTake(sheetFind(…, sheetLevel(…)))` |

`page`: whole level-0 pages from the sheet's corner to an origin (RENDER's order row, plan 4.1: (0,0) under 2^20 px,
else the page under the eye); `at`: level-0 px from that page. `Sheet`, `SheetCarry`, `SheetHit`, `SheetSpot`,
`SheetAxis` are SHEETS' structs; RENDER does not read their fields. Own shaders read further sheets with
`sheetOf(handle)` from their uniform (`stands` sheets from the quad's origin page, others from their corner).

## 7. SCENE ⇄ PEOPLE ⇄ RENDER

Owner: PEOPLE (`people/people.js`, `people/person.wgsl.js`). Callers: SCENE (`thread.js`, `engines/3/play/step.js`, `engines/3/play/shots.js`,
`engines/3/play/director.js`, `engines/3/play/camera.js`, `engines/3/play/inspect.js`, `world/world.js`, `world/space.js`), RENDER (`render/renderer.js`,
`render/shadows.js`, `render/mirrors.js`, `render/library.js`). Why: plan 3.6, 3.7.

**When** — a step (`engines/3/play/step.js`, seen or unseen): (c) `ids = people.reads(state.now)`, the animates of those elements;
(d) `people.frame(t, state.now, state.shots)`, then for each of `world.persons` `people.root(id, m)` → `world.rooted(el, m)`.
A drawn frame (`R.frame`): views, lights, shadows, mirrors, particles placed → `people.show(seen)` → blobs, cull → draws
(`people.draw`).

**PP1 `createPeople(persons, opts) → Promise<People>`** — `thread.js`, before the opening step, only when `world.persons` is not empty.

| Argument | What |
|---|---|
| `persons` | `[{ id, index, node, o, inside }]` — elements with `person` and an id (without an id: said at compile, not shown); at most 255 drawn (`SLOTS`); `inside`: marked so — in a room wherever they stand |
| `cast` | `shared.kits` (modules by name); a person's `person.cast` names one |
| `anchor(id, out, values?) → bool` | `world.anchor`: where SCENE's placing puts them (with `values`: under those values, nothing touched) |
| `ground(id, p) → metres` | `world.groundFor` (what carries them, else the land as stood on, or a `walk` plane) |
| `inside(by, p) → bool` | `world.insideAt`: one standing at p (x, _, z), carried by element `by` (null: none), is in a room — `by` is `inside`, or the `walk` plane under p (the one `footing` stands them on) is. PEOPLE asks it each step after the player's update for one not marked `inside`; one carried by another person is as that one is (carriers are stepped first). The person's `PERSON.INSIDE` flag follows it (the uniform is written where it changed) |

**The eye's ground** (`world/world.js` → `engines/3/play/camera.js`): `world.surfaceAt(across, distance)` → metres — the land (`groundAt`) or a plane that says `water` lying higher over it there (level: one too steep to stand on is skipped, as with `walk`); `world.standAt(across, distance)` → that, or a `walk` plane lying higher still. Not riding, the camera's eye is its height over `standAt` under it, taken over `surfaceAt` at the start (the start's land or water is the eye's level 0); the operator's eye is as high over `surfaceAt` under the camera as the target's base is over `surfaceAt` under the target, and over `standAt` under the camera at least. Riding (`camera_on`), the face of what is ridden, as before. A few calls a frame; a pass over the `water` and `walk` planes, nothing allocated.
| `point(ref, out, get?) → bool` | `world.pointOf` (with `get`: as those values would have things — pointFor) |
| `frame(id, out, get?) → bool` | `world.frameOf`: carry frame (12 numbers), now or as `get` has it |
| `moves(id) → string[]` | `world.movedBy`: the keys that move an element (its place's, what carries it) |
| `placed(id) → bool` | `world.placedNow`: put where they are at once this step (their place or a carrier's key set, not moved — a move of the key after it in the same step, a walk begun there, leaves it so) — the player walks no way for it |
| `gpu`, `lib` | the GPU layer; `R.lib` (`lib.person`) |
| `built()` | the thread's `arrival`: a background build ended |
| `warn` | |

Resolves when every first look is built and every cast motion plus the library's `stand`, `walk` is prepared (a `turn()` between
slices). A cast's fault in a first look rejects (named with the person). Sets `globalThis.MooodShapes` once.

**SCENE's calls**

| Id | Call | Returns / does | Caller |
|---|---|---|---|
| PP2 | `reads(values) → Set<id>` | elements whose points people read (`_on`, `_look`, `_reach`; not persons); same Set unless one of those values is another object | `step.js` (c) |
| PP3 | `frame(t, values, shot)` | wear/with asked or taken, everyone here posed (pose, root, points, box, sphere, capsules) — one not here is not stepped at all and comes back as a cut sets them; `shot` ≠ last → set as a cut sets them; no bones, no GPU | `step.js` (d) |
| PP3 | `root(id, out12) → bool` | root world matrix (3 × 4, as a node row); false if not here / not posed | `step.js` |
| PP3 | `settle(id)` | set as a cut at their next step | `director.js` |
| PP4 | `prepare(values) → bool` | builds and holds the looks/parts `<id>_wear` / `_with` name; true when all built. Keyed by the `values` object | `shots.js` each tick a shot is live |
| PP4 | `unprepare(values)`, `ended()` | lets go what `prepare` held; `ended` drops the acts `pointFor` made | `shots.js` when a shot ends |
| PP4 | `building() → bool` | a background build in flight (`f.wait`) | `step.js`, `thread.js` |
| PP5 | `point(id, name, out) → bool` | point now (`name` null → `head`); false not here / not posed | `world.pointFor`, `inspect.js` |
| PP5 | `pointFor(values, id, name, out, root?) → bool` | the point as a cut to `values` sets them, on PEOPLE's own player — what carries them read under the values (`frame`/`point` with `get`; one whose arms they are on posed so first); `root` ← where their root stands then; false when the values move nothing of them: none of their keys, their place's, those of what they stand `on`, nor what their `_on` puts them on (an element's `moves`, a person moved so) | `camera.js` |
| PP5 | `box(id, out4) → bool`, `height(id) → metres | null` | | `camera.js`, `inspect.js` |
| PP5 | `pick(origin, way) → { id, at } | null` | nearest capsule hit; one kept object | `space.js` (IN6) |
| PP5 | `mark(id, bits)` | `FLAG.OFFERED` / `FLAG.SELECTED` into the person's uniform | `world.mark` (IN3) |
| PP5 | `startOf(id, motion, turn)`, `durationOf(id, motion | { turn })`, `speedOf(id, gait?)` | | `director.js` |
| PP5 | `list` | `[{ id, index, node, slot }]` | RENDER |
| PP6 | `save() → { [id]: { made, player, shot } }`, `restore(data)` | no cloth, springs, faces; a person whose `person` changed starts afresh | `director.js` |
| PP6 | `dispose()` | looks, blocks, `inks` let go | `thread.js` |

Person state keys: `<id>_do, _turn, _look, _reach, _with, _wear, _gait, _steps, _on, _here, _still, _mood`.

**RENDER's calls (PP7–PP11)**

| Id | Call | Returns / does |
|---|---|---|
| PP7 | `shown() → int` | how many the last `show` showed (here and in a view) — `R.counters.shown` | `renderer.js` |
| PP7 | `show(seen) → bool` | once per `R.frame`, after views are placed. `seen(sphere4) → bool` is RENDER's. For each person here and posed: shown or not; for the shown: posed first if a look/part came since the last step, bones (at rest when first shown, after more than one step since the last show, after a cut/settle, when what carries them changed, or after `LATE` 0.25 s of their clock), uniform, ink; one bones write. True if anyone became shown/hidden, a shown person's version changed, or a shown person is OFFERED |
| PP8 | `version(id) → int` | +1 whenever what is drawn of them changed (shown/hidden included) |
| PP8 | `sphere(id, out4) → bool` | x, y, z, radius (world); false not here / not posed |
| PP8 | `capsules(id) → { n, data: Float64Array(7n) } | null` | ax, ay, az, bx, by, bz, r (world) |
| PP10 | `draw(pass, kind, inView, id, mirrored, counters) → bool` | `kind` `'main' | 'depth'`; `inView(sphere)`; `id` one person or null; sets groups 2 and 3, pipelines, buffers, `drawIndexed`; adds to `counters.draws`, `counters.triangles`. True if anyone drawn |
| PP11 | `inks: GPUBuffer` | uniform, 256 × vec4f: slot's ink (linear rgb, spare); slot = place in `list` + 1 (0 unused) |

**PP9 pipelines** (`people/person.wgsl.js`)

| Export | What |
|---|---|
| `PERSON_KINDS` | `[{ name, vertex, surface, buffers, twoSided }]`: `skin`, `tubes`, `cloth` (twoSided), `face` |
| `PERSON_CARRY` | `paint` vec2u @location 8 flat, `facing` f32 @location 9 |
| `layouts(gpu)` | layouts `people` (group 2: 0 `personBones` storage 48 B a row, 1 `personMorphs` storage 32 B a row), `person` (group 3: 0 uniform, dynamic offset, `PERSON.BLOCK` 1280 B a person) |
| `exercisePeople(gpu, lib, pass, kind, mirrored)` | the whole-set check: every kind drawn once with its own small buffers |
| `PERSON` | uniform offsets: `ink` 0, `node` 16, `slot` 20, `bones` 24, `morphs` 28, `marks` 32, `lines` 36, `flags` 40 (1 facets, 2 inside), `moods` 44, `mood` 48, `palette` 96 (64 × vec4f) |

`lib.person(name, pass, mirrored)` (`render/library.js`): per kind `main`, `depth` (layout `viewCast`, no fragment), and `main`
mirrored when the world reflects. WGSL functions PEOPLE gives: `personVertex(v: PersonIn) -> PersonPoint` (root space),
`personFacing(p, r0, r1, r2) -> PersonCarry`, `personSurface(c) -> Surface`, `personNode()`, `personSlot()`, `personInside()`,
`personGlow()` (1 in a mirror; × `e_frame.pulse` if OFFERED; × `1 + PULSE.DEPTH` if SELECTED), `personLines() -> vec2u`.
RENDER's chunk `render.person` (`render/wgsl/person.js`) declares `PersonPoint { position, normal, carry }`, `Surface { albedo,
emissive, ink, rim, facet, part }`, its outputs at locations 0–7 plus the carry's; world point = `e_nodes[personNode()]` rows ·
position; writes colour and `ids = (personSlot(), part, lines.x, lines.y)`.

## 8. SERVICE ⇄ engine

Plan: 3.8 (ST1–ST3), 3.9 (BD1–BD4, RS3–RS5).

### 8.1 The stand's rows — `engines/3/stand.js` (ST1–ST3)

Loaded by `thread.js` only when `host.flags.stand` is set (`?stand`, `?stand=detail`); it imports nothing.

| Call (thread → stand) | When | What it keeps |
|---|---|---|
| `createStand(performance.timeOrigin, flags.stand === 'detail', () => sheets.stats())` | mount; `'detail'` also sets `R.detailed(true)`, `row.step`, `row.tick`, `row.wideNames` | — |
| `mark(what)` | `mounted` once; then once each a show: `shown` (begins the show's marks), `people`, `painted`, `pipelines` (`R.build` resolved), `whole` (beside a living scene: its opening view lacked nothing), `built` (the switch), `drawn` (its first frame) | ms of the epoch; at the first show's `drawn` also `first = { placed, sent }` from `stats()` |
| `input(type)` | each page input (`type` not kept) | arrival; waits for a drawn frame (≤ 256 at once) |
| `start()` | `call('stand','start')` (the thread also sets `pace.measure(true)`) | `performance.mark('stand:scene')`; clears rows, inputs, cuts, segments |
| `tick(row)` | end of every display callback while not paused | one row (below); cuts and inputs answered |
| `segment(name, stamped)` | `call('stand','segment', name)` → `stand.segment(name, R.stamped())` | `{ name, at, stamped }` |
| `take(extra)` | `call('stand','take')` → `take({ memory: gpu.memory(), gpu: gpu.info, stats: sheets.stats(), stamped: R.stamped() })` | returns the report below; stops keeping |

**The row** (ST2) — one object `thread.js` reuses, copied into a `Float64Array` ring of `MAX = 1 << 15` rows.

| Field(s) in `fields` | From | Meaning |
|---|---|---|
| `at` | `ts + performance.timeOrigin` | ms of the epoch |
| `ran` | `pace.run()` | 0: the pacer skipped this callback |
| `state` | `R.frame()` outcome | 0 held, 1 idle, 2 drawn; 1 when not ran |
| `every`, `late` | `pace.every`, `pace.late` | pacer's step (refreshes); counted as a miss |
| `js` | two `performance.now()` reads | ms of the callback (not the stand's own tick) |
| `cost` | `pace.takeCost()` | ms from the drawing callback to its `gpu.done()`; −1 none since last row |
| `shot`, `moving` | `S.f.shot`, `S.f.moving` | |
| `makes`, `keys`, `placed` | `S.world.took`, `S.stepper.keys`, `R.counters.placed` | this tick's |
| `ready`, `ready bias` | `S.shots.cut` when a cut is first told by a ran callback | 1/0 and its bias; else −1 |
| `late by` | `pace.lateBy` | why the callback was a miss: bit 1 its interval, bit 2 `gpu.flying ≥ PACE.BEHIND`; 0 none |
| `submitted` | `pace.takeSubmitted()` | ms from the frame's hand-over (`pace.frame`, after the submit) to its `gpu.done()`; −1 none |
| `opened` | `row.opened` | on the tick an insert's opening begins, s since its key left 0; else −1 |
| `story` | `S.director.held` | 1 while a cut waits (the story stands, plan 2.4); else 0 |
| `lacks pages\|mirrors\|cells\|land` | `R.lacks` | what a held frame lacked |
| `cycle sent\|evicted\|denied\|bias\|own\|again\|wanted\|named\|has\|insert\|room` | `sheets.cycle` | the cycle's pages (SH13; `named`, `has`, `insert`, `room` in units, 16 a slot) |
| `step director\|world\|animates\|people\|camera\|lights` | `row.step` (detail) | ms; −1 not detail / no step |
| `tick pace\|step\|show\|render\|after`, `tick stand` | `row.tick` (detail); `tick stand` written by the stand | ms; −1 |
| `R frames … shown` (18: frames, drawn, held, idle, pixels, draws, triangles, placed, lit, mirrored, blended, particles, people, quads, listed, asked, persons, shown) | `R.counters` | |
| `R shape <k>` | `R.counters.shapes[k]` | lit points by RENDER's SHAPE number |
| `R.wideNames…` (detail only) | `R.wide` | asks by kind/slot (`ms, quads, nodes, places, names` — `names`: `name()` calls, a page named twice counts twice; the distinct pages are `cycle named`), views, culls (render/survey.js) |

Passes/stages: `row.times` (`R.timing`, `{ name: { js, gpu } }`) kept as `times` (2 × P a row; −1 not run).

**`take()` returns** `{ fields, rows, passes, times, opening (the first show's marks and `mounted`), shows (every show's marks, in order: `[{ shown, people, … }]`), first, inputs: [{ at, ms, ticks, drawn }], cuts: [{ shot, at, ms, ticks, drawn, placed, sent }], segments, stamped, memory, stats, gpu }`. `ticks` counts only callbacks that RAN. A cut never drawn (overtaken, or still waited at take) and an input still waiting are kept with `drawn: false`, `ms: −1`.

### 8.2 The measuring

An engine-3 measuring has one size, `1080p`.

| Item | Value |
|---|---|
| Page | `<engine>/scene/stand.html?stand` (detail run: `?stand=detail`); init script sets `__mooodSpec`, `__mooodModules`, `__mooodDevice` |
| Profiles (`__mooodDevice`) | `desktop {phone:false, weak:false}`, `laptop {false, true}`, `phone {true, true}`; report sizes `"1080p · <profile>"` |
| Runs per profile | a browser: warming, three measured, one traced (Chromium trace: the GC); one profiled (CDP heap sampling of the `engines/3/thread.js` worker over the film, 16 KB — apart: `stopSampling` forces a full collection); a browser of its own: one detailed |
| Scenario segments (`mark` → `segment`) | `film` (`seconds`), `showcase.pause()` if any, `zoom` (30 wheel in/out), `drag`, `lean`, `walk` (modes walk/roam/platform/around), `cut` (`MooodState.cut({camera_x:1.5})`), `prepared cut` (`MooodState.prepare` then `cut`), `end` |
| Judged segments | `film`, `zoom`, `drag` |
| Painters | 4 — fewer on the machine: `prepared cut late` told, not judged |

Thresholds (engine 3 checks all but `steady repaints`, `steady uploads (px)`, and the four of a view's weight, its own — their limits by profile, the tier's painters' rate 120, 120, 30 pages a second):

| Threshold | Limit | Engine-3 reading |
|---|---|---|
| frames p95 / worst (ms) | 16.7 / 33 | max over judged segments; FAIL "no frame drawn in <segment>" if one was due and none drawn |
| worker JS median / p99 (ms) | 3 / 6 | callbacks that drew |
| GPU p95 (ms) | 8 | told, not judged (`limit: null`, `why`) |
| GC pause worst (ms) | 2 | the scene thread's (`gc.worker`) |
| allocated a frame (bytes) | 1024 | heap profile, `engines/3/` scripts only, over film s × 60 — the profiled run's film after a 10 s warm-up (`WARM_UP`) |
| allocated a frame, warm-up (bytes) | — | told, not judged: the same over the warm-up (`allocated.warmUp`) |
| main thread long tasks / a frame (ms) | 0 / 1 | the page's |
| open (ms) | 2000 | told, not judged; by marks |
| open long tasks | 0 | |
| prepared cut late (frames) | 1 | ran callbacks − 1; FAIL if never drawn or not seen by the thread |
| input to frame (frames) | 1 | p95 of ran callbacks; FAIL if any unanswered |
| view pages | — | told (`limit: null`): `(cycle named + cycle insert) / 16`, the most over the judged segments' ran callbacks, with the median and the room (`cycle room / 16`), and in screens (32, 22, 8 by profile) |
| soft run (s) | by profile: 0.5, 0.5, 1 | over every segment, the callbacks of whole frames left out (held — state 0 —, drawing a new shot's first frame, or the first after a hold): the longest run of drawn frames that are soft — by the cache (`cycle own > 0`) or by motion (the painters' queue: + `cycle wanted` a callback, − the rate × its scene time — 0 held, at most `DT_MOST` —, over the rate × the limit) — to the next drawn sharp or the segment's end; the queue runs on across segments; `why` the longest run by each cause and the most `cycle wanted` in any 1 s against the rate |
| pages again (a second) | 8, 8, 4 | `cycle again` summed over any 1 s of ran callbacks; max over judged segments |
| insert late (s) | 0.25 | the most `opened` over judged segments; told, not judged, with fewer painters than 4; `why` "no insert opened" when none |

The four view's-weight checks carry `segment` (the segment worst in); their limits are by profile. Each
segment of the report has `views: { pages: { median, most, room }, soft, cache, motion, again, wanted, opened: { n,
late } }` (a soft run over a segment's end is cut there and goes on from the next segment's start).

Report: `{ sizes: { "<size> · <profile>": { machine, segments, open, worker, workerHeld, gpu, passes, inputs, cuts: { atOnce, prepared, film }, gc, allocated, main, longTasks, counted, shapes, period, memory, sheets, traced, errors, noisy, checks, ok } }, scene, engine: 3, gpu: { renderer, timer }, ok }`.

### 8.3 A render

| Step | Page call (RS4: the closed list) |
|---|---|
| init | `clock.js`, `MooodClock(date)`, `__mooodSpec`, `__mooodModules`, `__mooodDevice = {phone:false, weak:false}` |
| open | `engines/1/render.html?[bare][&debug[=ids]][&showcase]` |
| built, first frame | `document.fonts.ready`, `stage.ready()`, `stage.seen()` |
| unknown start keys | `MooodState.check(keys, '--state')` |
| showcase | started by the page; `showcase.pause()`, `.info`, `.seek(t)` |
| a moment | `state.call('to', t)` (reply after the frame is drawn and `gpu.done()`), `__mooodTime.run(ms)` |
| `set` | `MooodState.cut(v, {who})` / `MooodState.set(k, v, over, ease, {who})` |
| views | `stage.still(view)` |
| what it says | `__mooodErrors`, `__mooodWarnings`, `__mooodTells`, `MooodState.unknown()` (last moment), `stage.inspect()` + `MooodState.all()` (look/crop) |
| picture | `page.screenshot` (png, or jpeg q90) |
| patience ran out | `state.call('waits')` (5 s) → error naming what it waits for |

**RS5** — a shader's file: `elements/<id>.wgsl` when `scene.json` says `"engine": 3`, else none (`player/folder.js`:
`.wgsl` is engine 3's only, `.glsl` no one's).

## 9. LANGUAGE ⇄ engine

Plan: 3.10 (LG1–LG17).

### 9.1 Which text is served

`docs/worlds/scene-format-3.md`, whole — the one text of engine 3's language (the studio's MCP `guide` and its artist
give it); every new scene is engine 3's.

### 9.2 The closed word lists (LG13) — a word outside is warned once by its element and dropped

| Object | List (code) |
|---|---|
| spec | `engine title caption captions directions music notes widgets horizon camera light lights modules lib relief script showcase state states objects` (`spec.js WORDS.spec`) |
| camera | `mode height look follow span turn area hero jump on`; modes `picture walk panorama overhead around roam platform` (default walk); a panorama's `span` [left, right] m bounds the viewer's way aside plus `camera_x` (his way aside: within `[min(0, left − camera_x), max(0, right − camera_x)]` — `camera_x` itself never held, one outside an explicit span warned once; the span should cover every `camera_x` the scene sets); a `scene.move` of `camera_x` (not a `scene.path`) carries his way aside back along it, not under a finger — so `camera_x` is not what is seen; set at once, it leaves his way aside as it is, as far as the span lets it; the wheel and a pinch walk toward what is under the pointer in every mode that walks (a panorama too, between its start and as far as its things), stopping where the element about fills the frame, or — one that already fills it (a wall, a board) — a step from it; a notch that walks nowhere leaves the view as it is |
| light / a look | `ambient ambientColor tint tintStrength vignette grain haze hazeColor hazeGlow brightness saturation inside bounce shafts wind` + `looks` (light) / `lights` (look) |
| lights[] | `id on place color strength reach flicker glow from through soft size daylight of at across distance elevation x cone` |
| a light's cone | `bearing height width soft` (`spec.js WORDS.cone`); read by `light.js`: bearing (0), height (0, −90…90), width 1…170 (30), soft 0…1 (0.25); a cone on a far light, a through light or a window's daylight is warned and not taken |
| element | `id name x y across distance elevation bearing facing tilt rotation plane width depth height box code animate redraw place on onLand copies sky insert iris person particles unseen glows inside translucent reflect glass lit walk water drape flicker solid seen shadow clip behind inFront shader uniforms script color` |
| place / copy | place: `across distance elevation x facing tilt rotation bearing`; copy: `across distance elevation facing tilt rotation scale flip tint glow seed` (`facing` a card's copy's, `rotation` a plane's: the other warned, not taken) |
| shadow / reflect / glass / clip | `light onto strength soft` / `strength fade blur rough ripple` / `strength blur` / `inside outside` |
| particles | `world/emitters.js` `PARTICLE_FIELDS` (BASE's keys + `kind`); kinds snow, blizzard, rain, drops, sparks, embers, fire, smoke, puff, dust, splashes, fireflies, petals, leaves, bubbles |
| a layer's options | `sheets/easel.js LAYER_OPTS`: `pivot wind drift flicker shimmer blend depth box`; blend `normal add multiply` (`screen` warned, drawn normal) |
| person | not word-checked in `spec.js` (people's own) |

Accepted, no effect (LG5): `shadow.soft`, a light's `size`, `reflect.blur`, `glass.blur`, a plane's `lit`. Said by their own words (LG6): `scene.prepare` in `spec.script`/`spec.showcase`, a shader that reads as GLSL. `seen` other than `"reflection"` warned (LG7).

### 9.3 What code is given

| Code | Signature / context | Given (code) |
|---|---|---|
| paint | `code`: `function (g, e)`, `g` a recorder | `e`: `id rnd aspect area state spot ground light at part layer form debug warn anim kit lib` (`sheets/easel.js`) |
| animate | `function (e)`, every step while shown | `e`: `id aspect t dt cut state was speed mem layer(name).{x y rotate scale scaleX scaleY alpha brightness} uniform glow burst at point where spot hero debug warn anim kit lib` (`world/element.js`) |
| scripts | spec / element `script`, `scene` | `id element anim kit lib state time get set move turn path cut was person say camera shot light(id).fade sequence every after on signal tell warn ground hero random startOf` (`play/director.js context`) |
| sequence `s` | `scene.sequence(async s => …, {name})` | all of `scene` + `wait until event all any self` |
| person verbs | `scene.person(id)` | `walk go do turn say` (actions); `look reach with wear gait on here still mood talk startOf` (at once) |
| action | returned by the above | `then ending(s) cancel finish pause resume remaining duration` |
| shot (LG4) | `scene.shot(values)` | `{ values, ready, cut(), cancel() }`; `SHOTS_LIVE = 2` per maker |
| events | `scene.on(type, [key], fn)` | `change move load action arrived line cut signal tell` |
| lib / module | `function (anim, kit)` / `function (anim, data)` | `anim`: `clamp mix span ease easeOf turn hash noise drift joint blend`; `kit`: the modules + `bend revolve extrude loft lump` (a module of one of those names is not seen) |
| relief | `function (across, distance, anim, lib)` | — |
| own shader (LG2) | `fn shade(painted: vec4f, at: vec2f, uv: vec2f) -> vec4f` | `layer(k, at)`, `emission`, `at_dx`, `at_dy`, `u_time`, `u_<name>`, `PI cycle hash2 hash3 hashU noise1–3 wobble wobble2 luma srgbToLinear wrap` (render/own.js, render/wgsl/frame.js) |

### 9.4 Limits the code enforces

| Limit | Value | When over |
|---|---|---|
| own-shader layers / uniforms | `OWN.SHEETS` 10 (0…9) / `OWN.VALUES` 32; uniform name `^[A-Za-z][A-Za-z0-9_]*$` | uniforms: `compile` throws (scene fails) |
| inserts | `INSERTS.MOST` 16 | `compile` throws |
| cutter lists (`clip`) | `CLIP.SETS` 4 | warned, a 5th clips nothing |
| particles alive | `PARTICLES.MAX` 65536 | every emitter scaled down, warned |
| copies' scale | 0.25…4 | clamped, warned |
| far / through lights / beams lit; lights per cell; lit set | `LIGHT.FAR_MOST` 8 / `THROUGH_MOST` 4 / `SPOT_MOST` 2; `CELL` 16; `LIT` 256 | the engine chooses (the strongest far and through lights, the beams most worth to the view; told once) |
| shadow lights at once | `SHADOW.LIGHTS` 4 | the engine chooses |
| a form | card or plane; none of layers, parts, shader, translucent, reflect, glass, clip, drape (`world.js formRules`) | reported with the element; painting not taken |
| `copies` | card, plane, unseen; not reflect/drape/glass; `place` dropped; nothing `on` a copy | warned, not taken |
| `water` | a plane's word (a water surface): on any other kind | warned, not taken |

### 9.5 Author text vs code — differences found

| # | What | Where |
|---|---|---|
| 1 | `shadow` is refused (warned) on an element without an `id`; scene-format-3.md does not say an id is needed | `spec.js shadowOf`; scene-format-3.md element schema |
| 2 | `scene.prepare` is warned only in `spec.script` and `spec.showcase`; in an element's `script`, the lib or a module it is not said and fails at run as a missing function | `spec.js scriptSays` |

## 10. Constants and the tier

Plan 4.7, 4.9. All in `engines/3/base.js` (imports nothing) unless said.

| Name | Value | Readers |
|---|---|---|
| `QUAD` `CARD, FACING, PLANE, DRAPE, SKY, INSERT, FORM`; `KIND` | 0…6; 7 (mask, bits 0–2) | SCENE, RENDER |
| `FLAG` | `SHOWN 8, GLOWS 16, WIND 32, DRIFT 64, SHIMMER 128, FLICKER 256, WRAP_X 512, WRAP_Y 1024, FLIP 2048, INSIDE 4096, REFLECTED_ONLY 8192, REFLECTS 16384, GLASS 32768, CLIPPED 65536, PART 131072, WHOLE 262144, ADD 524288, MULTIPLY 1048576, READ 2097152, OFFERED 4194304, SELECTED 8388608, CUT_ONLY 16777216` | SCENE, RENDER, PEOPLE |
| `FORM` `SIDE, BLOCK, CELL` | 33, 4, 12 | SCENE, SHEETS, RENDER |
| `INSERTS.MOST` | 16 | |
| `PULSE` `DEPTH, RATE` | 0.35, 2.4 | renderer, world.wgsl, person.wgsl |
| `LIGHT` `FAR, THROUGH, POINT, WINDOW`; `INSIDE, GLOW`; `LIT, CELL, SMALL`; `FAR_MOST, THROUGH_MOST, SPOT_MOST` | 0…3; 1, 2; 256, 16, 4; 8, 4, 2 | |
| `SHADOW` `COARSER, LIGHTS, KEYS, HOLD` | 8, 4, 2, 1.5 | |
| `RECV.GROUND`, `CAST.ALPHA` | 1, 0.5 | |
| `PASS` `FROM, TO` | 0.204, 0.595 (m) | |
| `CLIP.SETS`, `WIND.FAST` | 4, 0.45 | |
| `SHEET` `PAGE, BORDER, UNIT, TOP, SLOT, SLOTS_SIDE, LAYER, MAX_PPM, WINDOW, OPAQUE` | 256, 8, 68, 52, 272, 7, 1904, 2048, 7, 242 | |
| `DEPTH` `BIAS, SLOPE` | 4, 1 | |
| `BIAS` `MOST, FALL` | 16, 0.8 | |
| `OWN` `SHEETS, VALUES`; `PARTICLES.MAX` | 10, 32; 65536 | |
| `SHOTS_LIVE`, `MAKES_AHEAD` | 2, 2 | |
| `STEP`, `DT_MOST` | 1/60 s, 0.1 s | thread |
| `ORIGIN` `STEP, REACH` | 64, 96 (m) | |
| `PACE` `PERIOD_LEAST, WINDOW, MISSES, LATE, JS, GPU, BEHIND` | 10 ms, 120, 6, 1.5, 0.8, 0.8, 3 | |
| `LATE` (people) | 0.25 s | |
| `WAITS_EVERY` | 15 | thread |
| `VIEW.MIRROR` | 1 | |
| `MIRROR` `IMAGE, DENSITY, GLASS, OVER` | 512, 0.75, 0.5, 0.01 | |
| `LIT.CELL`; `GLOW` `PAINTED, STEADY` | 96; 0.6, 0.9 | |
| `PASSES` | `bake, shadow-static, shadow-movers, blob, air, mirror, masks, main-solid, main-blend, bloom, gather, canvas` | |
| `SETTLED` (page.js) | 150 ms | |
| `WAIT.SHOWN`, `WAIT.LEAST` (page.js) | 0.25 s, 0.5 s | |
| `SPOT` (`engines/1/actions.js`; 48px in `scene.css`) — plan's `PRESS.SIZE` | 48 CSS px | |
| `SAYINGS`, `RECENT` (`engines/3/play/messages.js`) | 256 distinct errors+warnings a show; 32 kept for `?debug` | |
| message types | → `mount, size, in, call`; ← `mounted, reply, frame, state, waits, action, event, say, unsay, perf, lost, failed` | |

**The tier row** — `TIER` in `thread.js`, picked in `mount` by `phone` and `tier`; copied into `host` with the one-value
fields. `tier` and `phone` are read nowhere else.

| `host.` | computer normal | computer weak | phone normal | phone weak | Read by |
|---|---|---|---|---|---|
| `budget` (px, from page.js) | 1920·1080 | 1600·900 | 1280·720 | 960·540 | `renderer.js` (buffer scale `k = min(1, √(budget/(pw·ph)))`), `thread.js` opening view |
| `cache` (layers) | 29 | 22 | 13 | 9 | `sheets/cache.js` (`sheetCache` texture, 1904², 2 mips) |
| `wholePages` | 32 | 22 | 15 | 8 | `sheets/cache.js`, `sheets/ask.js` |
| `shadow` (static atlas side; movers' = half) | 2048 | 2048 | 1024 | 1024 | `render/shadows.js` |
| `busy` (painters working when the last place was not whole) | 4 | 4 | 2 | 2 | `sheets/cache.js` |
| `pages` (pages placed a call that is not whole) | 8 | 8 | 4 | 4 | `render/renderer.js` (`sheets.place`), `sheets/cache.js` (feed limit) |
| `ahead` (s) | 0.5 | 0.5 | 1 | 1 | `engines/3/play/camera.js` (how far on `f.toward` is), `sheets/cache.js` (a probe works out its items once every `ahead / 2`) |
| `painters` = clamp(cores − 3, 1, 4); `cells` = 1; `land` = 1; `field` = 2048 | same on all | | | | `sheets/cache.js`; `render/shadows.js`; `render/land.js` (both) |

## 11. Findings — the code looks wrong or unclear (left as it is; not written above as the contract), and what is planned and not built

| # | Where | What |
|---|---|---|
| 1 | `engines/3/world/world.wgsl.js` `e_quadGlow` vs `engines/3/people/person.wgsl.js` `personGlow` (IN3) | a thing both offered and selected: a quad shows only the steady `1 + PULSE.DEPTH` (the pulse dropped); a person multiplies both (pulses, brighter). One of the two is wrong; the plan reads like the person's |
| 2 | `engines/3/render/library.js` `all()` → `set(':mirror', …)` (4.5) | `own:<n>:mirror` is asked with `receiver: true`, while the plan and the library's header say the mirror's set has no receiver variant (a mirror lights at the vertices). Undecided which is meant |
| 3 | `engines/3/sheets/cache.js` `add` (SH1); `engines/3/world/world.js` `takeOf` | a recording given to `add` is the sheets' to end, but when its key matches a sheet there (`had.refs++`), or `add` throws (65 536 sheets, the table full), its images are never closed; in `takeOf`, an `add` that throws leaves the remaining wires' transferred images unclosed. Costs memory only for paintings that `drawImage` or use a pattern |
| 4 | `engines/3/sheets/cache.js` `ask` | its comment says "the view was not asked in the cycle before"; the code tests `V.round < keep` (the plan says what the code does) |
| 5 | `engines/3/sheets/page.js` header | says a sheet wraps for "a sky round the circle"; `world.js` sets `wrap` only from a layer's `drift`, so a round sky's sheet is added unwrapped. Either the comment is stale or a round sky's seam is clamped — not traced |
| 6 | `engines/3/world/emitters.js` header | its list of what RENDER reads of an emitter lacks `world.emitters.air`, which `render/particles.js` reads |
| 7 | `engines/3/render/survey.js` | the stand's detail run reads element fields outside WT11 (`el.nodes`, `el.partSlots`) and `world.tables.measure` / `delta` — diagnostic only; noted in WT11 as an exception |
| 8 | `engines/3/world/spec.js` `shadowOf`; `scene-format-3.md` | a `shadow` on an element without an `id` is refused with a warning; the author text does not say an id is needed (9.5) |
| 9 | `engines/3/world/spec.js` `scriptSays` | `scene.prepare` is warned only in `spec.script` and `spec.showcase`; in an element's `script`, the lib or a module it fails at run time as a missing function (9.5) |
| 12 | dropped by the owner 2026-10-15 — plan SH10 | **Motion LOD** (a place asked coarser by its on-screen speed) — not in the code: softness in motion is not visible; coarse-to-fine already shows a missing page one level soft |
