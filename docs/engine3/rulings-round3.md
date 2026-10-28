# Coordinator's rulings after the re-validation of revision 2 (2026-10-11)

Inputs in this folder: v3-consistency.md, v3-webgpu.md, v3-facts.md, v3-whole-picture.md (with counted data in
scratchpad\wp-tmp: net.json, net.txt), v3-fresh-review.md. Verdicts: the shape stands; the GPU design is sound; the
frame's account (5.17) holds by an independent count; the plan is ready to split after a short list of corrections.
Revise architecture.md in place to revision 3. Close every finding of the five files (text, or the table
"finding → where closed / why not"). Rulings where a decision is needed:

## 1. Time to a finished picture — the weakest point; it gets its own account, like the frame's

1.1 Add an account "time to a finished picture" beside 5.17: for the opening and for a cut to a new framing — how
    many page jobs, what a page's raster costs for the scenes as they are (the huge paintings included), how many
    painters, per tier; the result in seconds as an orientation. Its levers are part of THIS piece, not "after the
    run" (the owner ruled out a further round).
1.2 Cuts. The owner watched the present engine today and named exactly two flaws: parts of the scene shown blurred,
    and stalls at cuts. So neither "shown at once and sharpening" nor "freeze at every cut" is acceptable as the
    ordinary case. The design: whatever cut can be known ahead IS made ready ahead — the film's next beat, and in a
    game the beats that can follow (the worlds' `beats.js` game path cuts plainly today: its edit is forced by
    quality and goes into 5.20; the train's lap cut likewise, v3-facts S2). A cut to a READY shot is never held
    (v3-consistency 2). Only a cut nobody could know ahead holds the last picture, briefly; say how long by 1.1's
    account. "A tick or two" must not be claimed where the account says otherwise.
1.3 The cache and what is asked: a view needs about 4 pages per screen-page of painting (counted), not 2.25 — size
    by the count. Do not ask or draw the world behind a solid full-frame insert (close-ups are the heavy views in
    ordinary scenes: this is an engine rule, no scene edit). Say what the viewer sees where a view ahead does not
    fit (dzhungli).

## 2. The frame

2.1 The "cores" depth-only step costs about what it saves and is a `discard` pre-pass on tile GPUs (counted): it
    does not stay as it is. Either drop it, or let opaque middles write colour as opaque draws with the soft edges
    blended after — choose by the counted data and say why. Wholly opaque sheets stay opaque with depth.
2.2 A third of "blended" pixels are fully transparent pixels inside a painting's rectangle (counted): do not pay
    for them — by the cheapest standard means (the painter knows empty pages; tighter quads from the top page's
    coverage; or a discard where it is cheap). Decide and account.
2.3 Blended draws against opaque ones of coplanar layers: a depth bias on the blended pipelines (v3-webgpu N1). The
    mirror pass and the main pass's pipelines must have equal targets (N2; v3-consistency 5).
2.4 Particles' `soft` (smoke and fog fading into what stands behind, six scenes and every smoke by default) is not
    lost silently: provide it the cheap standard way (the depth attachment read-only and sampled in the blended
    part is allowed by WebGPU), or name the loss in section 7 with the reason.
2.5 The tier for `valhall`: no split by memory (`deviceMemory` is clamped and does not split them). One row for the
    whole architecture, chosen by the account for its WEAKEST common member (Mali-G68 class): if that holds
    1280 × 720 with a margin, the row is 720p; otherwise 960 × 540. Rows for `samsung` and `img-tec`, or say they
    are refused by Chrome today.
2.6 The pacer on a borderline device must not hitch at a fixed period for ever (v3-webgpu N5, v3-consistency):
    bounded means it settles.
2.7 Painters on phones: 4 where there were 2 — account for heat and for the thread count against cores, or return
    to the smaller number with 1.1's account showing the price.

## 3. Sequences and seams (v3-consistency 1–7, v3-webgpu minors) — fix all

`settle()` and a painting changed across a jump; `world.wanted` — drop it (animates keep memory: `e.mem` in 11
scenes, `e.dt` in 8); the opaque lists against `sheets.place`; a device lost in a hidden tab (handled at resume);
`lost` gets its entry; the check's "one frame encoded" gets the function it needs; `masks` binding; a run breaking
on shape (4.1 says both); a shadow slot that changes light; a shot made ready at a coarser bias.

## 4. Scenes (v3-facts) — the list 5.20 must be true per scene

`copies` only where a gain is shown by the count (Лес у моря; not Диканька — its 135 faces are ten different
buildings; Полёт and Мэдлин only if a real gain is shown, and never by hand over hundreds of elements). The row of
«Падение дома» corrected (the sky's own layers stay; `house_mirror`). The five more points a game reads (`crack`,
`ripple`, `candles`, `closeup#rod_hand`, `closeup#mad_hand`) are kept. A through-light's `soft`: say what it does.
Words kept without effect are named in the language text as "no longer does anything", not left undocumented.
Plays begun before this piece: old commits hold `.glsl`; say exactly what a player sees and the smallest right
handling (the question of moving plays to new commits goes to the owner as a notice, not decided here).

## 5. Baseline and services

5.1 The baseline changed today: `engine2-cheap-light` was merged into `main` and `moood-dev` (478f6ea), and
    1852e61 (scenes service: unread folders) followed. Every "main vs cheap-light" and section 7's "now" get a pass.
5.2 Engine 1's pictures and motion sheets: the default in the text is "stay as they are" (engine 1 is untouched)
    until the owner answers; write it so that either answer is one sentence of change, and say plainly what each
    answer costs in code.
5.3 The three service leftovers of v3-facts 9: decide each, the smaller way.

## 6. No more probes on the owner's devices

The owner forbade further checks ("больше ты меня не уговоришь что-то проверять"). Strike 9a-2b and anything else
that asks him for a probe on a device of his; settle by reading or list as unchecked. 9a-3 is settled by
reading: the npm `webgpu` package ships Dawn's Null backend in all its prebuilt binaries; it validates WGSL,
layouts, pipelines, encoding and submit; it produces no HLSL or SPIR-V. The text should say plainly, once, as a
notice for the owner: this piece never verifies the reference laptop or phones — the account is arithmetic.

## 7. For the owner (9b) — final list, plain, in Russian

Questions (only these): (1) engine 1's and motions' pictures — stay on the server as now, or also only from the GPU
machine; (2) the app shows a scene as the site's page in a Chrome tab inside the app.
Notices, one line each, no answer needed: three.js leaves the new engine; 1600 × 900 on older Intel laptops; a
90 Hz phone shows 90 or an even 45; about one visitor in six (no WebGPU) and iPhones are not promised; the pause is
wider than the hidden tab; bodies (a way of drawing people no scene uses) are not built now; plays of these scenes
begun earlier; the reference devices are not verified inside this piece.

## Form

Planning only: no code, nothing run. Assume little, check a lot. Return with a contradiction instead of writing
around it. After this revision the document is split into area specifications — so sections 3, 4 and 8 must be
final enough for a writer who sees only his area's rows.
