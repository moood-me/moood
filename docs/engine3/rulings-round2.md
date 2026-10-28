# Coordinator's rulings after the seven validations of architecture.md (2026-10-11)

Inputs (all in this folder): v2-consistency.md, v2-requirements.md, v2-excess.md, v2-whole-picture.md (with its
addendum of counted overdraw), v2-facts.md, v2-webgpu.md, v2-fresh-design.md; study-scenes.md; the probe on the GPU machine
(RESULT: WebGPU works there — real T4 adapter, page and worker, read-back and screenshot both correct,
`rg11b10ufloat-renderable` present; the canvas is zero after presentation unless redrawn).

The validators agree that the shape of the engine is right and no cardinally cheaper shape exists. The document is to
be REVISED, not rewritten. Every finding of the seven files is to be closed in the text or answered in a table
"finding → where closed / why not". Below are my rulings where a finding needs a decision. They are the
coordinator's, by the owner's intent ("follow the intent and the high-level vision; common sense above all"); if a
ruling contradicts a fact you know, return with it instead of writing around it.

## A. The elephant — the frame must fit the reference laptop with a margin, by construction

A1. Blended pixels are the largest cost and the plan does not reduce their number. The design must say what makes a
    sheet's pixels opaque and draw opaque parts as opaque, with depth, before what blends, so that what they hide is
    not shaded (the present engine already lays a depth pre-pass at alpha ≥ 0.5 — the new design may not be worse).
    Take the standard way; a per-page / per-sheet "all opaque" fact from the painter is free. No scene edit for it.
A2. A sheet pixel's read: no `textureSampleGrad` + anisotropy on every pixel. Sample at the level already computed;
    anisotropy only where it earns its cost (ground-like planes), or not at all — decide and account.
A3. The document must contain the account itself: one table "what a pixel and a frame cost" for the heaviest scenes
    (use the counted screens of painting from v2-whole-picture's addendum and study-scenes), per tier, against the
    memory traffic of UHD 630 (dual channel) and of the phone class, with the margin stated. Passes at the frame's
    end are in it (two full-screen passes were estimated at about 5 ms of 16.6 on the laptop — fewer if the picture
    allows).
A4. The tier is decided from the adapter (`requestAdapter().info`) on the page, not from cores and memory. Intel
    integrated graphics of the reference class is the "weak computer" row: 1600 × 900 (the owner's number for weak
    computers). The ordinary four-year-old Android (Galaxy A53 class, not only a Pixel flagship) is INSIDE the
    promise, on the phone rows (1280 × 720, weak 960 × 540). These are orientations, one table, no second path.
    A render's and the stand's tier is given by the asker explicitly — never guessed from the render machine's cores.
A5. Shadows: quads that only sway (wind, drift, shimmer) are not shadow movers; their shadow is their rest pose.
A6. Lights: more than the table's size is NOT a build error (the train scene has 943 from `e.light` in loops; gavan
    81–134; Берег 60; the present engine keeps the 256 most worth). Design one rule that handles many small lights
    by construction without editing scenes (rework of the engine is cheap, of scenes costly). Likewise a lamp's
    shadows (L8): choose the default so that scenes keep their shadows without edits (sklep and Реформ-клуб have no
    far light).
A7. Particles: closed forms of time, as the present engine has them — no stateful compute simulation. A still
    picture at any moment must show smoke, flame, sparks, dust as the film does. This also removes a compute pass.
    Scenes exceed the drafted particle count (42–60 thousand flakes): size by the scenes or state the one rule.
A8. The cache: size it by construction for a heavy view plus what the design keeps ahead (a shot, a mirror), per
    tier, and say what the viewer sees when it does not fit. Pressure "by history" must not make a render differ
    from run to run.
A9. The pacer may not be trappable: a device whose frames fit must not be held at the half rate by one loaded second
    or by a late `onSubmittedWorkDone` (v2-webgpu F3, F4; v2-fresh-design 5). Take the standard design; state it so
    that its correctness can be read. High-refresh displays: 90 Hz phones run at 90 or 45 — say so in section 7.
A10. The opening and a cut's wait: a few paintings are huge (the train's `near` 280 000 path operations, `road`
    62 000 draws). The design must make a page's raster cost proportional to what is in the page, and say what the
    viewer waits for at the opening. First-open pipeline compilation on Gen9 (estimated 2–10 s): name it in section
    7 and keep the pipeline set small.
A11. Not addressed and to be addressed in a paragraph each, by construction, not by measuring: heat and battery on
    phones (the rate and the size are the levers that exist); the browser's compositing of the canvas and its
    scaling; no look-ahead of pages for a moving or zooming camera; scripts' garbage.

## B. Correctness of the plan itself

B1. v2-consistency's two blockers (the `settle()` loop that never ends; a cut where no tick runs; `shot.ready` on
    unseen steps) and its serious findings (what "shot ready" covers; SHEETS and two worlds; the order of writing
    for `layouts.js` and the artist; re-entrance; a cancelled shot's promise): fix all. Entry numbers must not
    collide with decision and requirement ids — rename the interface prefixes.
B2. v2-webgpu F1 (a pass binding a texture it writes), F5 (`set` is reserved in WGSL; `mod`; `hash1(uint)`), and
    its minors: fix. The conversion of authors' shaders is a rewrite anyway; the wrapper's reserved names by a
    prefix. Every word the 82 files really use must have its counterpart named (`layer(0, at)` in 34 files,
    `srgbToLinear`, `fwidth`, `noise3`, `uint`).
B3. The offline whole-set check (W8): also encodes one frame's passes (draws nothing), so that encode-time
    validation is covered. Where it runs is not for this document to assume.
B4. v2-facts: name every caller of rendering and every dependent the plan missed; give each an owner. Do not
    call cheap-light's code "same as now" — say which branch.
B5. The render picture: both ways work on the GPU machine (read-back and screenshot). Choose the simpler one that keeps
    captions and titles in the picture, one way always.

## C. The language and the scenes — keep the scenes, rework the engine

C1. Rebuild the language section from study-scenes.md, not from round 1. Everything the 20 scenes use stays and
    works (`e.where`, `scene.was`, `captions` / `directions`, `blink` / `tumble` / `frames` / `settle`, `a.finish`,
    layers' `blend`, wind's `gust` / `scale`, …) unless removing it is forced by WebGPU or saves frames — and then
    the scene edit is listed, per scene.
C2. Words no scene uses: widgets and every camera mode with what it needs STAY (the owner's word). A word that costs
    the engine no machinery of its own stays. A thing that needs its own pipelines, passes or threads and has no
    user (the bodies' person kinds and their 8 pipelines, unused particle kinds, …) is not built in this piece and
    is listed in `dropped.md` as "can come back". No new word is added unless a listed scene edit uses it:
    `here`, `mist`, a layer's `glows`, a beat's `about` — out unless shown used and needed.
C3. `scene.run`, `{ key, map }` and the 14 `scene.every` edits: the premise "recomputed every frame" was found
    false for those sites (they fire every 0.05–4.6 s). Out, unless you show from the code that they cost frames.
    The 276 per-frame animates: make them cheap in the engine (not run for what is absent or unseen) rather than
    edit scenes.
C4. Scene edits of this piece are a complete list per scene of exactly two kinds (forced; saves frames). The limit
    of own-shader layers fits the scenes (the 9-layer sky is not edited to fit a constant). The three Asher scenes
    without ambient: say what each needs.
C5. "Whole before shown": keep (people and pictures are never shown blurred or half-made), but its cost at the
    opening is accounted in A10, and "whole" means the level the view needs, not more.

## D. Excess — out of this piece

D1. The build: only what the engine needs to arrive as one built file set; the site's own pages, the ETag table and
    nginx rules stay as they are. Must fit the images as they are (v2-facts 7) with the smallest change.
D2. APP: the smallest thing that shows an engine-2 scene in the app — the scene's existing site page opened in the
    browser tab inside the app. No new endpoint, pages or asset links unless reading the app's code shows that a
    viewer could not otherwise be signed in; if so, say exactly what and why. Fold into PAGE if nothing is left.
D3. Out: `count.js`; the an rpg dev tool checks that are never run; the `tint` second path; nine design notes and nine
    history notes (one design document — this one becomes it — and one history note); hunks in engine 1 if they can
    be avoided (engine 1 is untouched).
D4. Device loss: the simplest single path (the page starts the scene's thread anew and restores the saved state) if
    that serves the viewer the same.
D5. Fewer areas if seams allow; do not keep nine for symmetry.

## E. For the owner — only what is truly his, plain, few

Bring at most a handful of short questions in section 9b. Already answered by him, do not ask again: every picture
on the GPU machine (W2); the whole-set offline check (W8). Candidates that remain: old worlds' and motions' pictures
also only from the GPU machine; the app showing a scene as the site's page in the browser tab; three.js leaving
engine 2 (one sentence for him: his wish was to use the library, and W1's reasons).

## F. Form

- Edit architecture.md in place; put a short "what changed in revision 2" list at its top; keep section 11
  (unchecked) current — strike what the studies, the probe and v2-facts settled.
- Assume little, check a lot: read the code and the scenes where a ruling above touches them.
- Do only what is needed: this is planning; write no code, run nothing.
- If two rulings, or a ruling and the owner's decisions, cannot both hold — stop and return with it.
