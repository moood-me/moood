# Engine 3 — why 30 frames, and what to do: a second look

A proposal, not code. **Section 7 has the two measurements made after the first version (M1, M2) — read it with
sections 1–4: it confirms W1, W2 and, in part, W3, and refines P1.** Written 2026-10-14 from reading the engine at `main` 4b5f6ef (`engines/3/play/pace.js`, `thread.js`,
`gpu/gpu.js`, `sheets/painters.js`, `sheets/page.js`, `sheets/cache.js`, `render/quads.js`) and from the stand's
reports already taken
(`engine3-renders/<scene>/e3-merged.json` and its log: main, iz-okna-poezda, dzhungli; T4, 1080p). **No new stand run
was made for this first version** (the owner asked for the reading first); section 6 lists the few runs that would
settle what reading cannot. "Measured" below means: read in those existing reports. "Estimate" means arithmetic.

## 1. Why 30 — the short answer

**The 30 is mostly the pacer's decision, and its rule for coming back to 60 is wrong.** The engine is not, on the T4,
too slow for 60 in `main` and the train; it is slow for 60 in `dzhungli` while the camera moves.

The evidence, from the reports' per-segment table (`every` = the pacer's step: 2 means it runs every second display
callback, i.e. 30 fps):

| scene, desktop | segment | frames med | every | JS med / p99 | GPU med | callback → GPU done med / p95 |
|---|---|---|---|---|---|---|
| main | film | 33.3 | 2 | 7.5 / 14.3 | 6.2 | 18.8 / 24.3 |
| main | drag, lean, cut | **16.7** | **1** | 6.7–7.1 / ≤ 11 | 6.2 | 16 / **25–27** (late 0) |
| train | film | 16.7 → 33.3 | 2 | 9.1 / 19.3 | 6.6 | 25.2 / 30.6 |
| train | zoom, drag, lean | 33.3 | 2 | 9 / 12–14 | 7.1 | **22** / 25 |
| dzhungli | film | 33.3 | 2 | 9.2 / 19.7 | 9.5 | 24.9 / 32.2 |
| dzhungli | zoom, drag | 33.3 | 2 | **18.2** / 31–46 | 11 | 48–52 / 61 |

What the pacer does (`engines/3/play/pace.js`):

- **Down** (line 95–100): a run callback is a *miss* if it came ≥ 1.5 periods after the one before, or found two
  submits not yet reported done (`gpu.flying ≥ 2`); more than 6 misses in the last 120 runs (5 %, two seconds) → half
  rate. The films are where the bursts are (pages placed: main 438, train 1054, dzhungli 699 in the film segment; the
  major GC pauses of 9–13 ms happen there; the tick's p99 is 14–20 ms there). 5–11 misses in the film → down. This
  part is a reasonable rule; what trips it are real spikes (section 2).
- **Up** (line 51 and 102): at half rate, a frame's *cost* is the time from its display callback to its
  `onSubmittedWorkDone` — i.e. **the scene thread's JS + the GPU's work + the delay of the done notification, added
  in series** — and a trial at 60 is made only when at most 6 of the last 120 frames had cost > 1.25 · 16.7 = 20.8 ms.

**That up rule measures latency, but 60 fps needs throughput.** The frame is pipelined, as in every browser engine:
`queue.submit` returns at once (`gpu/gpu.js:320`), nothing waits on the GPU, and the next callback's JS runs while
the GPU draws the previous frame. So 60 holds when the JS ≤ a period and the GPU ≤ a period *each*, not when their sum
does. The reports prove it on the stand itself: main's drag, lean and cut ran at 60 with **0 late frames** while the
same "cost" had a p95 of 25–27 ms — far above the 20.8 the up rule demands. The train shows the consequence: JS 9 ms,
GPU 7 ms, cost median 22 ms > 20.8, so after the film's 11 misses **no trial is even attempted** for the rest of the
run; zoom, drag, lean and the cuts are held at 30 although the same scene's work fits 60 (main, with almost the same
numbers, got back up only because its cost median was just under the line).

**Is the 33.3 the stand or the machine?** No — reading shows it is the engine's choice: the display period is
measured as 16.7 ms in every run, the frame times are the display callbacks' timestamps in the scene's worker
(`thread.js:242`), the 33.3 segments are exactly those where `every` = 2 and half the callbacks are "skipped". The
service's browser runs with no vsync-disabling flag; its 60 Hz begin-frame cadence is what a display gives. What the
machine *does* change: it has **4 vCPUs** (`machine.cores 4`, so `painters 1` of the 4 wanted), shared by the browser, the GPU process, the page,
the scene thread, the artist and the painter. Contention there inflates the spikes that trip the down rule; a desktop
or the reference laptop (8 threads, 4 painters) would see fewer. That cannot be read; it is measurement M3.

**dzhungli is the honest case**: while the camera moves the scene thread itself takes 18–19 ms median (p99 31–48) —
over a frame on this CPU. In its zoom segment: frame asks 6.9 ms (flat quads 4.2, sky 1.3, draped 1.0), mirror asks
1.5, shadow culls 2.0, placing pages 1.8, the main cull 0.7, outcome 1. Its film segment (camera mostly still) is
9–10 ms and would run 60 with a right up rule, unless its spikes keep it down.

## 2. What I think is wrong or wasteful

**W1 — the pacer's up rule** (`engines/3/play/pace.js:48–53, 102, 117`): as above. It compares a serial sum to one period.
Standard governors (Android's frame-pacing library Swappy, console engines' frame-rate switching) take the CPU's time
and the GPU's time *separately* and keep the lower rate only while either of them alone does not fit with a margin.

**W2 — the down rule counts `gpu.flying ≥ 2` as a lost frame** (`pace.js:95`). Two frames in flight is the normal
depth of a pipelined browser frame when the done notification is late (it comes over IPC from the GPU process); it is
not a lost frame. Whether it fired in these runs is not in the reports (the row has `late` but not why) — M1.

**W3 — every page is a fresh 320 KB of external memory on the scene thread, never reused.** A painter reads the page
with `getImageData` (a new 256 KB), `convert` makes a new 256 KB `pixels` (`sheets/page.js:154`), `halfOf` a new
64 KB `half` (`page.js:170`), both are transferred to the scene thread (`painters.js:47, 78`), written to the cache
texture (`cache.js:933–934`) and dropped. In a film that is 140 MB (main) to 340 MB (train) of ArrayBuffers born and
dead on the scene thread in ten seconds. V8 accounts external memory and starts **major** (mark-compact) collections
when it grows by its limit, whatever the JS heap does — which fits what is measured: the scene thread's GC pauses are
*major*, 9–13 ms, sit in the film segments where the pages arrive, and are worse than engine 2's (3–4 ms) although
engine 2 allocates more JS a frame. A hypothesis that reading supports and one measurement settles (M2). The standard
cure is a pool: the scene thread sends each buffer back after `writeTexture` (transfer again), the painter converts
into a buffer it holds; no new external memory in steady play.

**W4 — the 3 ms scene-thread limit is judged on a server CPU, while the binding number is the slowest device's.** Not
an error, but the order of work should follow it: on a phone the same JS is ~2–3× slower (estimate), so main's 7 ms
becomes 15–20 ms there and dzhungli's moving 18 ms becomes 40–50. The asks are the bulk; they are done every tick for
every view due, and on a moving camera every quad of a view is asked again (`sheets/ask.js`, via the view's change).

**W5 — secondary views are asked at the frame's own rate.** Mirrors, shadow cells, shots ahead get the same
"every tick the camera moved" treatment as the frame's view (dzhungli zoom: mirrors 1.5 + ahead 0.5 + shadows 0.3 ms
asks, 2.0 ms shadow culls, 1.4 cull mirrors). A mirror's or a shadow cell's pages being one or two frames late costs a
frame of a coarser level that is already in the cache (the top always is) — never a hole.

**W6 — the opening is serial.** main's marks: mounted 0.57 s → people built 3.06 s → painted 3.37 → first frame
6.08 s. The people's build (2.5 s) and the painting of the opening view (2.7 s, one painter) follow each other; the
sheets that do not depend on people (land, sky, set) could be recorded and rastered while people are built.

**W7 — small things seen on the hot path** (each to check, none measured alone): `render/quads.js:517` makes a new
list `Int32Array(Q.cap)` whenever a view's list is shorter than the quads — it is the top allocator in dzhungli
(4.4 MB in the film) so some views must be born small again and again; `writeTexture` is called with fresh descriptor
objects and arrays per page (`cache.js:933–934`); `onSubmittedWorkDone` makes a promise each frame (`gpu.js:324`) —
small, but it is what W1's fix should use differently anyway; `bakeNode` (`render/land.js`) and `noise`
(`world/kit.js:44`) allocate in dzhungli 1.2–1.3 MB a film.

## 3. The options

Each: what it changes, the expected gain, risks, size.

**P1 — a right pacer (W1, W2).** Down stays "frames really lost" (interval ≥ 1.5 periods only; `flying` out of it).
Up is judged on two numbers taken at half rate, each against the period with a margin (say 0.8 · P): the tick's own
JS (already measured for the stand; `performance.now()` twice a tick), and the GPU's own time = from the *submit* to
done (at half rate the GPU is idle when a frame is submitted, so this is the GPU's work plus the notification delay —
with `timestamp-query` where the device has it, the exact pass times). Hysteresis stays (the doubling back-off).
Changes plan 5.1's rule and `pace.js` only. Gain (measured, by analogy within the same reports): the train's zoom,
drag, lean and cuts and main's film/zoom would run at 60 on the T4 (JS 7–9 ms, GPU 6–7 ms, both well under 13 ms);
dzhungli stays at 30 while moving (JS 18 ms) — rightly. Risk: a device whose JS and GPU both sit at 0.8 · P with
interference between them; the down rule catches it within two seconds. Size: small (a day), the plan's text with it.

**P2 — page buffers pooled (W3).** The scene thread gives back each page's `pixels` and `half` after the upload; a
painter keeps a few and converts into them. Also the descriptors of `writeTexture` made once. Changes SH-contract
messages (painters ⇄ cache), not the design. Gain (estimate, to be measured): the scene thread's major GC pauses
from 9–13 ms to engine-2-like ≤ 3 ms, the film's misses down — which is what keeps the pacer at 60 once P1 lets it
up. Risk: low. Size: small.

**P3 — the general "D": a quad keeps the camera region in which its asked pages stay right.** When a quad is asked,
the ask can also say how far the eye may move and turn before any of its pages or its level could change (its level
changes by a factor of 2 in screen size; its page set changes when the visible piece crosses a page edge). While the
camera stays in that region the quad is not asked again. This is the candidate D ("a camera that barely moves") made
exact rather than a threshold. Changes `sheets/ask.js` (plan 4.8, SH10). Gain (estimate): on a slowly moving camera
most quads keep their answer; dzhungli's 6.9 ms frame ask could fall by half or more; on a fast camera nothing.
Risk: the bound must be conservative or a page is missed — testable offline against the full ask, as the last round
did (67–70 million page names compared). Size: medium.

**P4 — secondary views rationed by count (W5).** Each tick asks the frame's view in full; mirrors, shadow cells and
shots ahead are asked round-robin, a fixed number of them a tick (never by clock — the plan's own rule). Gain
(measured parts, dzhungli zoom): up to ~3–5 ms of the 18. Risk: a shot ahead becomes ready a few frames later
(its `ready` already waits on whole views; nothing shown is wrong). Changes plan 2.1's per-tick list. Size: small–medium.

**P5 — the opening overlapped (W6).** Start recording and painting the sheets that need no people while the people
are built. Gain (estimate): main's 6.1 s → ~3.5–4 s on the T4. Changes plan 2.2's order. Size: medium.

**P6 — dynamic resolution (an option for the owner, a change of the plan's principle).** Real engines on weak GPUs
keep 60 by scaling the drawn resolution by the measured GPU time (with the canvas pass upscaling), rather than by a
tier fixed once. The plan decides the tier once (4.9) and never a rate between. If real weak devices turn out
GPU-bound (section 5), this is the standard answer; it does not touch the scene thread. Size: medium. Not proposed
before M3 shows the need.

### The seven candidates, judged

1. **Scene thread over 3 ms** — right target for phones; but on the T4 it is not what holds main and the train at
   30 (W1 is). D: yes, as P3 (exact, not a threshold). The flat piece's level by the chain rule: part of P3's bound.
   dzhungli's flames stamped every tick (cull and ask again): yes — a quad that moves inside a known bound should be
   culled by the bound, not re-culled on each stamp.
2. **Major GC pauses** — likely W3 (external memory), a cheap fix (P2); measure first (M2).
3. **Allocation per frame** (24–77 KB) — mostly young-generation garbage that dies young (minor pauses are ≤ 1 ms
   in the reports); a part is the scene's own code (main: 6 KB a frame of its `draw` scripts — the engine cannot
   forbid that). Worth sweeping after P2, not before: it is the major pauses that drop frames.
4. **Looks built during a film** — real, a burst on the thread at a moment nobody prepared; it belongs with the
   shot made ahead (built when the shot that needs it is made). Small–medium.
5. **Land baked one tile a frame on the scene thread** — 0.2–0.5 ms in dzhungli, 1.2 MB allocated a film; moving it to
   the artist (which already makes the heights) is right but not first.
6. **Asks in the background while the camera moves** — agree it stays parked: copying tables costs, and sharing them
   (SharedArrayBuffer) needs the site cross-origin isolated — a large change. P3 + P4 give the same effect on the
   same thread.
7. **No measurement on weak hardware** — in my view the most important unknown, see section 5.

## 4. Recommendation and order

Each step measured by one stand run of the scene it is about (desktop profile is enough unless said).

1. **M1/M2 first** (section 6): two measurements, half an hour, that confirm W1/W2 and W3 before any code.
2. **P1, the pacer.** Expect: main and train at 60 in every segment where the reports show JS ≤ 9 ms; frames p95
   16.7 there. If the film still steps down, its misses are the spikes of step 3.
3. **P2, page buffers pooled.** Expect: major GC pauses ≤ 3 ms; film misses ≤ 6 in 120 → the film stays at 60.
4. **P4, then P3** on dzhungli. Expect: moving JS from 18 ms to under ~10 ms → dzhungli at 60 on the T4.
5. **The weak-device run** (section 5) before any further GPU-side work; P6 only if it shows GPU-bound frames.
6. Then 4, 5 of the candidates, the allocation sweep, P5.

## 5. What the T4 stand cannot tell

- **The GPU of weak devices.** A T4 has ~8 TFLOPS and 320 GB/s; a UHD 630 ~0.4 TFLOPS and shared DDR4 (~40 GB/s); a
  2022 Mali in between. Estimate: 10–20× slower on the iGPU. main's laptop profile at 4.7 ms GPU on the T4 could be
  40–90 ms on a UHD 630 — then the GPU, not the scene thread, is the binding limit, and blending (main-blend is the
  biggest pass in main) and fill rate matter most. This contradicts the plan's estimate (5.2: "about 1 ms in the
  laptop profile on an Arc-class card"), so it must be measured, not argued.
- **The CPU of weak devices** — single-thread speed of a phone's big core is ~½–⅓ of a server's; and big.LITTLE
  scheduling of workers.
- **Thermal throttling, the energy saver** (it already skewed a measurement on an Arc 140T laptop), a real display's
  vsync and compositor, a lost device.
- **How to learn it**: the stand's thread side (`engines/3/stand.js`) already runs in any browser with `?stand`; what is
  missing is a way to run the scenario in a viewer's own browser and send the report back. A "stand in this browser"
  page on a local stack or dev, opened on an Arc 140T laptop (energy saver off) and on an
  Android phone's Chrome, gives the same report as the render machine. A 9th-gen Intel laptop and a ~2022 mid phone, if at
  hand, are the reference.

## 6. Measurements that settle what reading cannot

- **M1 — why each late frame was late, and the pacer's two numbers.** Add to the stand row: the late's cause
  (interval / flying), and the cost from submit to done (beside the cost from the callback). One run of the train,
  desktop, film + zoom. Settles W1/W2: if submit→done is ~7–9 ms where callback→done is 22, the up rule is the 30.
- **M2 — what starts the major collections.** The trace the stand already takes, with V8's GC category so each
  mark-compact says its reason (external memory or heap limit), and the bytes of pages received a segment. One run of
  main, film. Alternatively, cheaper and local: the offline harness under node with `--trace-gc` (same V8) — it prints
  each collection's reason.
- **M3 — the same scene with 4 painters** on a machine with more cores, or on an Arc 140T laptop (section 5): how much
  of the film's spikes is the 4-vCPU machine.

## 7. Measured (2026-10-14): M1 and M2

**M1 — the train, stand on the work's GPU service, branch `e3-perf2` 4456030 (the two new rows: `late by`,
`submitted`), one repeat a profile** (`engine3-renders/iz-okna-poezda/e3-perf2-m1.json`, its log). The train behaved
as in the earlier runs (desktop: film steps down, everything after it at 30; JS median 9.2, GPU 6.3–6.7).

| desktop | late: by interval / by two in flight | callback → done med / p95 | submit → done med / p95 | GPU (timestamps) med |
|---|---|---|---|---|
| film | **6 / 9** (of 15) | 25.5 / 31.5 | 16.7 / 20.6 | 5.9 |
| zoom, drag, lean | 0 / 0 | 21.2 / 24–27 | **11.7–11.9 / 13.2–13.5** | 6.3 |

- **W2 confirmed.** 9 of the film's 15 misses were not lost frames but "two submits not yet reported done". The
  interval alone gives 6 misses — at the limit (more than 6 steps down), so without the in-flight rule the film would
  have stayed at 60 or stepped down on the last spike. (Laptop profile: 4 by interval, 3 in flight; phone: 1 / 1, it
  never stepped down.)
- **W1 confirmed.** At half rate the callback → done is JS (9.3) + submit → done (11.7) = 21 ms > 20.8: the up rule can
  never be met, while each part alone fits a frame.
- **New: the done notice lags the GPU by ~4–5 ms.** Submit → done is 11.7 ms where the GPU's own time (timestamp
  queries) is 6.3 ms; in the phone profile at full rate 6.9 against 2.6. So "submit → done" is not the GPU's time: P1
  must take the GPU's time from `timestamp-query` where the device has it (Chrome gives it, quantised to 0.1 ms) and,
  where it has not, judge submit → done against the full period, not 0.8 of it. With that, the train's zoom/drag/lean
  (JS p95 ≈ 12–14, GPU 6.3) passes the up rule on the T4.

**M2 — what starts the major collections of the scene's thread.** The offline harness (the real `thread.js` in node, the
same V8; real painters' workers transferring full-size page buffers; `main`, film scenario) under
`node --trace-gc --trace-incremental-marking`: of the scene thread's 26 major collections, **9 were started by
"external memory pressure"** (the page buffers), 7 by the heap's allocation limit (JS garbage), 10 by V8's own task;
the worst pause (10.5 ms of the run's 1–10 ms) was one of the external-memory ones. On the stand (train, traced run):
the scene thread made 14–15 major collections in a 30-second run — about one every two seconds —, the worst in the
film (7.5 ms desktop, 10.8 laptop), the rest 2–3.5 ms. So:
- **W3 partly confirmed**: the page buffers start a third of the major collections and the worst one; P2 removes them.
  The other two thirds come from JS garbage reaching the old space (candidate 3) — the allocation sweep matters more
  than section 3 said, after P2.
- **Pause length** follows the live heap the collection must mark (68–110 MB on the scene's thread in the harness), not
  the cause. Fewer collections is what P2 and the sweep give; shorter ones would need a smaller live heap of objects
  (typed arrays are cheap to mark, Maps and small objects are not) — not measured further.

**What changes in section 4:** the order holds. Step 2 (P1) is now: down on the interval only; up on the tick's JS p95
and the GPU's time by timestamps (or submit → done against the full period). Expected on the T4: main and the train
at 60 in every segment after the film; the film itself held at 60 too unless its interval misses exceed 6 in 120 —
which is what P2 and the sweep address.


## 8. Built (2026-10-14): P1 and P2 — and what the stand shows now

**P1, the pacer** (commit 9d61aa1; plan 5.1, GP8, 4.6, `contracts.md` 3.7): down only on frames lost — the interval
(1.5 steps), with three submits in flight as a backstop (`PACE.BEHIND`); up when the tick's JS (callback start to the
hand-over after the submit) is over 0.8 of the step in at most 6 of the last 120 drawn frames, and the GPU's time is
over 0.8 of the step in at most 6 of the last 120 timed frames — by timestamps (`timestamp-query` is now taken where the
adapter has it; the frames' passes are timed only at half rate), else submit → done against the whole step. The
display's period is the lower quartile of the intervals, not the median. **A weak GPU still drops the rate**: if the
browser holds the callbacks back, they come late (misses), and the lower quartile keeps the held rate from passing for
the display's; if it does not, three submits pile up (misses); at half rate its GPU time is over the step, so no trial
is made. Checked on a simulated display (scratch, not in the repository): JS 9 / GPU 7 → 60; a GPU of 25 ms → 30,
with or without the browser holding callbacks; a burst of spikes for 5 s → back to 60 after the trial.

**P2, page buffers pooled** (commit 87a0844; SH11, `contracts.md` 6.6): the cache gives each page's pixels and half
level back to its painter at the end of `place` (`{ t: 'spare' }`, transferred), the painter converts its next pages
into them (at most 32 kept a length); the writes' descriptors are made once. Harness (main, film): the scene thread's
major collections 26 → 2, the painters reuse ~95 % of the buffers.

Both proved in the harness: play, film (sought and played) and watch of the five scenes, 0 errors; `syntax.mjs`; the
Dawn check (main, train). Not done: **step 3, the allocation sweep** (see below).

**The stand** (the work's GPU service, the engine of 87a0844, three repeats; before = `e3-merged.json`):

| scene · profile | frames med/p95, by segment (film, zoom, drag, lean, cut, prepared) | before |
|---|---|---|
| main · desktop | film 16.7/33.4 (stepped down), all others **16.7/16.7** | film and zoom at 30 |
| main · laptop | **all 16.7/16.7** | film p95 33.4 |
| main · phone | all 16.7/16.7–16.8 | the same |
| train · desktop | film 16.7/33.4; zoom, drag 33.3; lean 16.7/33.4 (trial); **cut, prepared 16.7** | everything after the film at 30 |
| train · laptop | **all 16.7/16.7–16.8** | everything at 30 but the film |
| train · phone | all 16.7 | the same |

| | main desktop / laptop / phone | train desktop / laptop / phone |
|---|---|---|
| JS median ms | 7.0 / 6.2 / 5.0 (7.2 / 6.2 / 4.8) | 9.4 / 8.2 / 5.4 (9.2 / 8.5 / 5.5) |
| GPU p95 by timestamps ms | 5.5 / 4.3 / 2.3 (6.9 / 4.7 / 2.5) | 6.3 / 5.0 / 2.7 (7.5 / 5.2 / 3.0) |
| scene thread's major GCs in the traced run | 1 / 1 / 1 (3 / 2 / 1) | 2 / 1 / 1 (15 / 15 / 10) |
| worst GC pause ms | 15.3 / 17.2 / 15.1 (8.8 / 9.2 / 11.9) | 13.7 / 14.4 / 13.6 (10.1 / 8.1 / 11.8) |
| allocated a tick (engine), KB | 77 / 33 / 33 (47 / 35 / 33) | — |

What it says:
- **The rate**: the half rate is gone wherever the scene's work fits — main everywhere after its film, the train in the
  laptop and phone profiles and in the desktop's cuts. The film segments in the desktop profile still step down, and
  now by the GPU behind, not by lost intervals: main's film 6 misses, all "three in flight"; the train's 7 by interval,
  7 in flight. The film is where pages are uploaded in bursts (877–1074 pages placed in it): submit → done reaches
  16–23 ms while the GPU's own work is 5 ms — the GPU process is busy copying pages, which timestamps do not see.
  Whether three in flight should count there (the frames are queued, not lost — the intervals stayed on time in main)
  or the uploads should be spread by bytes a frame is the next question for the owner; I did not tune the constant.
- **GC**: the major collections fell from 10–15 a run to 1–2 (P2 confirmed), but the one left, in the film, is longer
  (13.6–17.2 ms against 8–12): fewer collections mark a larger heap at once. It still costs a frame. Shortening it
  means less live heap or less old-space garbage — the sweep.
  *Later (e3-sweep): that one was the stand's own — the heap sampler stopped in the traced run forces a full
  collection (the studio's history); the stand now samples the heap in a run of its own.*
- **Allocation did not fall** (P1 and P2 do not touch JS garbage); main's desktop run allocates more a tick than before
  (its top now `keep people/cloth.js`, `seen`/`at sheets/ask.js`, `skinnedRings people/shapes.js` — functions with no
  visible allocation, which allocate numbers while they run unoptimized; how much varies from run to run). This is
  step 3, not begun: the harness's heap profile of main and the train (watch, 25 s) puts the people's code first
  (cloth `lap`, `keep`, `hang`; `player.frameOf`, `update`; `people.step`), then `views.mirrorCamera`, `quads.edgeOf`,
  `light.update`, `shadows.blobs`, `ask` — each to be read against the four V8 causes of plan 5.16.
