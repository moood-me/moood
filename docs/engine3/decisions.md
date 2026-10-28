# Engine 2 rework — the decisions every area's specification is written to

Status: PLANNING. Nobody writes code. This file is the one source of decisions; it replaces every earlier instruction
any agent received in this session (rounds, corrections, "GO" messages — all void). Where this file and an earlier
message differ, this file is right. Where this file is silent or unclear, you do not guess: you put a question in your
specification's "Questions" section.

Sources of truth above this file: `plan/requirements.md` (the owner's requirements, ids A1…H) and, in the repo on
origin/main, `CLAUDE.md` and rpg's docs (now the studio's). Every design decision in a specification names the
requirement ids it serves. The principles for agents are `docs/worlds/principles.md` (there is no
engine 2 (gone)).

The criterion for every choice (requirements C21, C16, C8, C9, A12–A14): existing engine code has no weight; existing
scenes have weight (rewriting them, especially heavily, is costly — avoid where the result is as good); the final
quality for the viewer decides and overrides both. Cheap means for the same impression. One way, always; no fallbacks;
no props — remove causes. Standard practice of games for weak devices (T1 below), known from theory, not from one machine's numbers.

## 0. Targets (the owner answered, 2026-10-11 — no formal numbers; these are orientations, not thresholds to argue about)

- T1. Devices to design for: a wide class, not only new ones — orient on a laptop with an Intel processor of about
  the 9th generation and its integrated graphics, and an Android phone about four years old. Devices so old that
  nothing runs on them are simply not supported; no promise, no special path for them.
- T2. Frame rate: aim at 60 a second WITH A MARGIN on the devices of T1 — his own machine is often loaded by other
  work, and "60 on a free processor is 20 on a loaded one". So a frame's cost on the T1 devices must be well under a
  tick (plan for about half of it), on the thread and on the GPU. He declined to choose between "60 everywhere" and
  "30 on phones": it is an engineering matter. Engineering decision (the original task §3, whose author "was most
  likely right" — requirement C20): one pacer — every tick where the device holds it, else an even every-second-tick;
  never a jumping pace. It is one mechanism with one stated rule, not two modes of the engine.
- T3. Phones will not be tested in this work; design by what is known of them.
- T4. The library: the owner's WISH (a preference, not a rule) is to use what three.js gives rather than write our own —
  not to leave it. Where three does a thing as well and as cheaply for the T1 devices, take three's; where it does
  more than is needed or dearer, our own is right. The quality and cost for the viewer decide, as everywhere.

## 1. What stays

- K1. three.js r186 as the GL layer (state cache, programs, textures, targets, math, skinning chunks). The audit found no
  large part re-done without a reason. Patches 01–07 and 09 stay; 08 goes (no multisampled target any more).
- K2. Paintings ("sheets": what an element's code painted) are painted on the viewer's device (C10, C11) and streamed
  by pages and levels — the walk / roam cameras bring the eye from centimetres to hundreds of metres from one sheet
  (B8). What is simplified is how the engine learns which pages a view needs (section 2).
- K3. All camera modes, with what they need to make sense (the platform hero, flip…) (B8, E7).
- K4. `instant` replay for a game's jump to a moment — as it is (A17, E10). No resume mid-sequence now.
- K5. The first simplification already on branch `engine2-cheap-light` (head b01f680): light at the vertices for what
  blends, one indirection fetch + one cache read for a sheet's pixel, the small air volume, single colour output, no
  MSAA, the frame always at its budgeted size. That branch is the base everything is specified against.
- K6. Two engines side by side (C18): engine 1 and old worlds untouched and working; the Android WebView path working.

## 2. Roots removed (requirements C1, C3, C6; the three audits)

- R1. Which pages a view needs is COMPUTED from the camera and the quads on the scene thread — GPU feedback is removed
  entirely: no pass, no readback, no "rare net". Contract owner: area PAINT. Draft (to be confirmed in its spec):
  `vt.ask(camera, weight, width, height[, yaw]) → pages not there`, asked every tick for EVERY view drawn or held ready
  (the frame's, each view ahead for as long as its shot lives, each mirror's, each shadow view's that will be drawn),
  before `vt.update(count)`; what no ask named since the last update may be let go, oldest first;
  `vt.whole()` = every shown sheet has its coarsest level (or is empty); `vt.onArrive = fn` on every arrival.
  "A view is whole" = its ask returns 0 and `vt.whole()`. A frame is never called whole with pages missing.
- R2. Work inside a frame is rationed by COUNT (pages placed, land nodes baked, sheets painted ahead), never by
  wall-clock milliseconds. The counts are constants per device tier (section 5), stated in the specs. A render's frame
  takes as many as it needs.
- R3. ONE way to move a scene through time unseen: one step function, one dt, data only (nothing painted on an unseen
  step), used by play, a seek, a render's moment and a game's jump. The showcase is as the original task §7b says: it
  plays at once; its length is an estimate until it has been played or sought to its end; checkpoints are kept as it
  plays; a jump forward plays unseen to the place at that moment. No rehearsal anywhere (not at open, not in a worker,
  not on a server). The render entry uses the same step function; no fixed real second.
- R4. A new shot is shown as soon as its coarse picture is there (every sheet in view has its coarsest level; the land
  is there) and refined as pages arrive; a render's frame waits for every view to be whole. No half-second hold, no
  laps, no timeouts that turn "never whole" into an error path other than a plain failure.
- R5. Shots are made ready by events, not seconds (B1, §7a): a shot object lives until it is cut to or cancelled; no
  expiry, no magic 600, no "keys at rest for 0.5 s". Page side: `call('prepare', values) → id`, `call('unprepare',
  id)`; `cut(values)` with the same values shows the ready shot. The showcase prepares each beat's opening cut itself;
  a game can name the next beat ahead.
- R6. No pace gate. The pacer of T2 in its place; nothing in a tick waits synchronously for the GPU. The pacer's
  measure is the interval between ticks, kept always (it is free); the detailed per-pass timers run only when the
  panel or the stand asks.

## 3. Simplified

- S1. Shadows: plain depth maps with hardware compare, made as three.js `DepthTexture` with `compareFunction` and
  linear filtering (the library's own, K1) — not three's whole shadow system (it bakes the number of shadowed lights
  into programs). At most 4 shadowed lights; fixed softness. No integer atlas with caster ids, no pyramid, no copies
  when the camera moves. A walking person must not make static casters redraw every frame: area RENDER specifies the
  standard split (a static map redrawn only when a static caster, the light or the cascade's place changes; movers in
  a map of their own; a receiver reads both) or another standard way that meets the same. Cascades few, with a margin,
  far ones updated seldom. Per-pixel shadows on opaque receivers from the lights that matter most there; everything
  else at vertices. A caster's `soft`, a light's `size`, coloured shadows of translucent casters — dropped (list).
  `strength` / `onto`: kept only if free per read; RENDER states the outcome.
- S2. Window patches (through-lights): the sharp per-pixel patch is of the through-light that shines NOW (strongest
  present), not the first in the list.
- S3. ONE light model: every scene is lit (E9). Removed: the "scene not lit" mode (`look.lit`, planes' `lit`, pools,
  painted-scene shadows and occlusion, `light.people`, DUSKY / DAYLIGHT). The two Asher scenes that paint their light
  are rewritten lit in the scenes phase.
- S4. ONE air: the haze, with the small volume for shafts and lamp glow. Weather's separate `veil` is removed (weather
  sets the haze). The land's light "from below however high" is removed (one bounce: the screen's). The haze may get
  one cheap extra — low mist that thins with height — if area LANGUAGE asks for it (three worlds stack cards for mist).
- S5. Cloth: only what hangs, few real particles, on the scene thread, one or two steps a frame, deterministic by the
  scene's clock; skinned on the GPU. No cloth worker, no modes, no lag pass, no teleport guess, no budget/blend, no
  cloth in saves (E22; no word of the owner's — listed under "dropped, can come back").
- S6. Vertices and draws: grids only where something varies across a quad and only as fine as needed; the fewest
  points in passes that light nothing; per-instance values worked out once; two or three shapes; far fewer draws; a
  pass count a tile GPU likes (aim ≤ 10 target binds a frame without mirrors).
- S7. Sky: its base is one background draw; its layers and the inserts are quads over their own rect moved in the
  vertex shader. No per-painting full-frame passes, no edges table.
- S8. Programs: a closed set known when the world is built; a repaint never changes a program; nothing compiled that
  the world lacks. An own shader's room for layers is a fixed cap named in the language (RENDER proposes the number
  with LANGUAGE's count of what scenes use).
- S9. Mirrors: one small plain image a plane, redrawn only when what it shows changed.
- S10. The page: nothing blurred or forever-animated over the scene (bounded state indicators may animate, with
  opacity / transform only); the scene pauses when hidden, out of view or covered — music with it (A18); only the
  engine a scene names is started; one message a frame at the most each way, only what changed.
- S11. Loading: engine 2 as one built, minified bundle (esbuild), workers as entries; bundler-hashed chunks immutable,
  everything else revalidated by a content-true ETag; gzip precompressed; three imported by name.
- S12. ONE path of the engine for a viewer, a render and the stand: the same build script (one pinned
  version, in the repo) makes the engine wherever it runs. No second path of loose sources. Area PAGE specifies it.
- S13. The stand (requirement D28; task §0) judges what a viewer gets: intervals between frames DRAWN while something
  changes, ticks skipped counted; worst = the maximum; the cold opening judged; the real page's layers (bar, captions,
  widgets) assembled from the same modules; the showcase's own cuts; detailed timers only in a separate explicit run;
  a phone profile beside the desktop's. It is written now and run only at the very end, on the owner's word.
- S14. Motions are made ready on the device when the cast is built (counted work before the scene's first frame),
  never in a frame of play. (Storing a ready form on the server would mean a second implementation in Python and a
  migration — not now.)
- S15. Engine 2's kit is a module of its own; nothing fetched by XHR and run through `new Function`.

## 4. Removed outright (no user, or a prop whose cause is gone)

`travel` planes and `e.area`; the veil; the unlit path; every leftover of dynamic resolution (`vt.bias` by scale,
`counters.scale` as a varying thing); the old engine's worker started for engine-2 scenes; the SwiftShader vertex
nudge and any non-GPU render path (renders are on a GPU: one way); the old language's GONE warning tables; the
authoring lint in the camera (`lookOver`); `R.on` hooks and the clipping-planes path; the busy loop while a frame
waits; real-time budgets and the real clock they needed; fitted constants (each derived from a rule or removed).
Not added: animals (B9), server baking (C10), resume mid-sequence (K4).

## 5. One device tier, decided once

The page decides the device's tier ONCE at mount by ONE stated rule (area PAGE owns the rule) and sends, in the mount
and size messages: `budget` (max px of the frame: touch 1280×720, weak touch 960×540, computers 1920×1080, weak
computers 1600×900 — E1), `pw`, `ph` (the canvas's device px), `dpr`, `tier` ('weak' | 'normal'), `phone` (boolean),
`memory`, `cores`. The scene thread copies them into `host`. Everything that depends on the device — the sheet cache's
size, painters' count, shadow maps' sizes, counts of R2 — is a function of `host.tier` / `host.phone` /
`host.budget`, stated in a table in the owning spec. No three unrelated guesses from `navigator.deviceMemory`.

## 6. The language of scenes and the scenes (area LANGUAGE)

- L1. Added, because several worlds build costly props for lack of them: one element drawn many times (instances);
  named moments inside a motion that a sequence can await, and a motion's end; a value derived from a key (range /
  curve) for place, looks, a light's `on`, particles' amount; a key driven at a rate; a layer that glows; an element
  held at a person's point and let go; an element present by a key; a closed insert's animate does not run. Each is
  specified with the engine area that implements it.
- L1a. The owner (2026-10-11) on many alike things — a forest, a village, a town from the air: yes, repeat them; some
  variety may stay — about twenty different trees or houses, not five hundred. So a scene keeps up to a couple of
  dozen painted kinds and draws each many times with its own place, size and tint.
- L2. Content budgets of a scene (elements, shadow casters, shadowed lights, mirrors, particles, own-shader pages…),
  checked by reading the spec when a world's branch is merged — no rendering.
- L3. Scenes (the owner, 2026-10-11): in this piece of work a scene is edited ONLY where the new engine forces it (it would
  not work or would look wrong) or where the edit saves frames. Nothing else in scenes is part of this piece, and
  nothing about it is planned. No large or automatic edits of scenes unless he asks for them plainly. Worlds' branches are prepared and NOT
  merged into a deployment.
- L4. The two copies of the language docs become one source.

## 7. What may be run while writing (requirement D5)

Compiling only: `node --check`; glslang over assembled shader sources; the bundler; the three.js build; the Direct3D
shader compiler on the assembled programs if an rpg dev tool can do it as a compile step (area RENDER assesses).
Nothing that runs the engine, a scene, a browser, the stand or a render — by anyone — until the owner says so.

## 8. Areas and owners (files)

- RENDER — engine 2 (gone), `render/glsl/**`, an rpg dev tool.
- PAINT+THREAD — engine 2 (gone), `core/**`, `paint/**`.
- PEOPLE — engine 2 (gone). (The `person` material lives in `render/materials.js`: RENDER owns the file,
  PEOPLE states what it needs; both specs carry the same interface text.)
- PAGE — `engines/1/**`, the old site's pages, the site's build and serving, engine 2 (gone), the merge hook for L2.
- LANGUAGE — the language docs, the plan of L1 (which engine area implements each addition), L2's budgets, and the
  plan of scene edits per world.
There is ONE next piece of work under discussion and nothing is planned after it. Nothing starts — no writing, no
large edits, no next step by itself — until the owner says so plainly; when the piece is done, the work stops and he is
told.

## 9. The owner's decisions of 2026-10-11 (late) — they OVERRIDE the sections above where they differ; the plan is to be rewritten to them

- W1. WebGPU: the engine moves to WebGPU now. Devices and browsers without it are not supported (no WebGL path kept).
  With the move goes everything that existed only because of WebGL 2's limits — this is the deciding reason: engine
  data in ordinary buffers instead of tables packed into textures (cards, lights, land, people's bones, the page
  table); no "first card's number" trick per draw and no library patch for it; the library patches that only served
  the WebGL renderer; no exact numbers written as bits into integer pictures (particles, land shadows); no rules of
  shader writing for the Direct3D compiler (one call site, loops to their end, no way out of a loop's middle); no
  waiting for programs by polling (their readiness is an event); no tool of our own to check shaders for Direct3D;
  particles worked out by the GPU; programs built in parallel with a plain "ready".
- W2. Every picture of a scene is rendered on the machine with a graphics card. Whatever code exists only so that
  previews can be drawn without one is thrown away (the software render path, the nudges in shaders for it, the
  site server's own CPU drawing of engine-2 scenes).
- W3. Widgets stay and are needed: a panel of HTML and CSS hung at a place of the scene, or placed by a place of the
  scene, or by a click; speech pop-ups (the phrase shown while it is voiced) and pop-up menus are widgets too.
- W4. Scenes (the owner, decided): in this piece a scene is edited where the new engine forces it (it would not work or
  would look wrong: authors' shaders to the new shader language, words that leave the language, the two Asher scenes
  under the one light) AND where the edit saves frames (many alike things repeated from about twenty kinds; candles,
  trains and the like no longer recomputed by a script every frame). Nothing else in scenes is part of this piece.
- W5. The Android app shows scenes in real Chrome inside itself, not in a WebView (the owner: no problem then).
- Known consequence to be told plainly and handled in the plan: the Android app shows scenes in a WebView, where
  WebGPU is not on by default (as of 2026-10-11, mainstream sources); Chrome on his Pixel 7 has it.
- W6. (the owner, latest) Plan a cardinal redesign, not a soft refactoring; do not cling to the existing code. Think anew
  and plan the ideal picture — the best practices and his requirements — at once, so that no further round of rework
  is needed after this one. No backward compatibility with engine 2 as it is now (the intermediate second version):
  none is required. Engine 1 stays, and the scenes that run on it stay on it. (How this meets "scenes are costly to
  rewrite": the engine and the language are free to change; what a change costs in scene edits is weighed against the
  final quality, which decides — W4 names what of the scenes is edited in this piece.)
- W7. (the owner) Checking a scene's cost is a step of its own, NOT tied to merging a world's branch — a merge must stay
  cheap. Agents know that scenes are to be benchmarked and decide when (after large edits; when the owner says it
  stutters). No hard gate: neither the stand nor the content budgets refuse or delay a merge. Budgets are guidance in
  the authors' docs and a check an agent can run when it sees fit.
- W8. (the owner) The offline check that every GPU program assembles (text output only, no picture) is allowed — but as
  the whole, in groups, never shader by shader and never as a write-check-fix loop: everything is written first; then
  the whole set is checked in one go; everything it finds is fixed in one batch; then once more. He leans to forbid it
  if it turns into micro-fixing (it burns tokens). Same for compiling in general.
- W9. (2026-10-15, after `study-bake-once.md`) Pure bake-once — every sheet a shot needs painted whole at the break and
  nothing painted in play — is NOT built: at 1080p ×1 only 3 of 23 scenes fit 300 MB (ground/sea planes, long strips,
  walk-up zoom and 360° skies do not). Page streaming stays and is made cheaper
  (the studio's history). A hybrid (cards and skies baked under a size cap, giant planes on
  pages) was not pursued.
