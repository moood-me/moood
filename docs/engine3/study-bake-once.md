# study-bake-once — paint every sheet a shot needs once, whole, and paint nothing during play?

Done 2026-10-15. **Not built.** A measuring study of one idea; the verdict is in §5.

How sure each claim is: every number below comes from one run of an offline harness (§2) over 23 scenes of five worlds.
The harness does not paint pictures and does not time anything; it records which sheets a shot asks for and at which
level. The sizes are arithmetic on those records, not GPU measurements. One run per scene, no repeats.

---

## 0. The answer in ten lines

- The idea: at the opening and at every cut, paint each sheet the coming shot needs, once, whole, at the level the shot
  will need; keep it in GPU memory; paint nothing while the film or the player moves.
- Pure bake-once does **not fit**. At 1080p, with the picture as it is shown now (zoom ×1), only 3 of 23 scenes fit
  300 MB: dal, bazar, nomer — all three in picture mode.
- Three more (lavka-v-lisse, oreanda, pereezd) would fit if their ground plane stayed on pages.
- The rest do not fit because of: ground, sea and land planes (terabytes at near-eye density); very long cards and
  strips (sevil-rou, gavan, iz-okna-poezda, les-u-morya); the walk-up zoom of roam and panorama cameras; 360° skies of
  130–250 MB each.
- Asking for one level finer (×2) multiplies every size by 3–4.
- In 20 of 23 scenes at least one sheet would be wider than 8192 px, the WebGPU texture limit we rely on.
- Baking only the pages a shot reads (not whole sheets) is worse than today's cache: typically 400–900 MB, up to 4.35 GB.
- A cap per sheet of 2048 px (phone 1024) fits almost everything, but is honest only for cards and skies: a ground
  plane or a long strip capped like that is many levels soft near the eye.
- A hybrid (cards and skies baked whole under a cap; the one to three giant plane-like sheets of a scene stay on
  pages) is possible. It was not pursued.
- The owner kept streaming and chose to make it cheaper: the studio's history.

---

## 1. Why it was asked

An independent review of engine 3 said the engine "circles around page streaming": the painters cannot keep up with a
moving camera. The numbers it gave: the train scene wants 370–560 pages a second and 120 are painted; a phone, 30. The
frame's asks (which pages the view needs) are the biggest part of the tick. It proposed to bake whole sheets at the
breaks (opening, cut) so that nothing streams during play, and to check each scene against a budget by arithmetic
instead of by running it.

The study asks the arithmetic question: if every sheet a shot needs were painted whole once, how much GPU memory would
the worst shot of each scene need, and does that fit what a laptop and a weak phone can hold?

---

## 2. How it was measured

**Harness.** The real `thread.js` of engine 3 on Dawn's GPU-less device (node), a viewport of 1920×1080 (phone case:
960×540). The scene is opened and its film is played to its end (cap 420 s of film). Nothing is painted into pictures.
For every shot of the film the harness records every sheet the engine asked for and the level the engine's own
`leveled` asks for it, with the cache bias removed (the engine asks a finer level than needed when the cache has room;
here the bare need is wanted).

**Baked size of a sheet.** Level 0 is 2048 px per metre. A sheet baked at level L is its level-0 size divided by 2^L
on each side. Bytes: RGBA8 (4 per pixel), plus the mip chain (×4/3). A shot's size is the sum over its sheets; a
scene's number is its **worst shot**. A sheet asked several times in one shot (the same element and place) is counted
once, at its finest level.

**Variants.**

- **×1**: the level the engine asks for the view as the film shows it.
- **×2**: one level finer than ×1 (inserts excepted), for a sharper picture.
- **allowed zoom**: a baked sheet must also serve a camera that comes closer than the film's. The closest approach is
  taken from `engines/3/play/camera.js`: picture mode, none (= ×1); panorama and walk, up to max(1.1 · EYE, 1.15 · the sheet's
  height) from the sheet; roam, down to 0.6 m (`PASS.TO`). EYE = 1.7 m. The level follows from that distance.
- **phone**: a weak phone at 960×540, i.e. one level coarser than the laptop's.
- **without ground planes**: the same, with the ground and land planes left out (they would stay on pages).
- **cap**: no side of a baked sheet above 2048 px (phone 1024); a larger sheet is scaled down to fit. A second run of
  the caps (4096, 1024, phone 512) is in §4.

**Budgets compared with.** Today's cache: 29 layers of 1904² = 420 MB on a laptop (22 layers = 319 MB); phone 13 layers =
188 MB (9 = 130 MB). Target of this study: **300 MB on a laptop, 150 MB on a phone**.

**Scenes.** 23 scenes of the five worlds of the day, all engine 3, branch `env/dev`: Алые паруса v3 (7 scenes), Вокруг
света v3 (4 of 5 measured), Парадизо (4), Старший сын (4), Дама с собачкой (4). The scripts and raw records were kept
outside the repository.

**Not measured: Вокруг света / dzhungli.** The harness died at the opening: the null device reported out of memory
(`OutOfMemory`, Dawn `DeviceNull`) while about 600 pages were still waiting (3135 at the start); then it got no answer
in 120 s. That is a statement about the harness and the number of pages at the opening, not a size.

**Two logs without a "film ended" line.** alye/paluba and vokrug/iz-okna-poezda wrote their records (15 shots and
5 shots) but their logs do not say the film was played to its end; the other 21 do. Their numbers may miss a last shot.

---

## 3. The results

Sizes in MB; GB and TB where the number is that large (those are the arithmetic of sheets 100 000 pixels wide and
more, i.e. what a ground plane at 2048 px/m would be). "Pages the shot reads" is the same worst shot counted in pages
(0.328 MB each) as the engine streams them now, with the largest cache bias seen in brackets (1 = one level finer than
needed; only les-u-morya).

| Scene | Mode | Shots | Sheets (max in a shot) | ×1 / ×2 / allowed zoom, MB | Phone ×1 / allowed, MB | Without ground planes: ×1 / allowed, MB | Cap 2048: ×1 / allowed; phone cap 1024: ×1 / allowed, MB | Sheets over 8192 px | Pages the shot reads, MB (bias) |
|---|---|---|---|---|---|---|---|---|---|
| alye/dal | picture | 3 | 9 | 213 / 766 / 213 | 53 / 53 | 213 / 213 | 135 / 135 / 34 / 34 | 0 | 543 (0) |
| alye/dom-longrena | roam | 14 | 82 | 4.6 TB / 18.5 TB / 4.6 TB | 1.2 TB / 1.2 TB | 468 / 854 | 212 / 227 / 53 / 57 | 3 | 799 (0) |
| alye/lavka-v-lisse | picture | 5 | 28 | 765 / 3043 / 765 | 191 / 191 | 163 / 163 | 165 / 165 / 41 / 41 | 1 | 428 (0) |
| alye/les-u-morya | walk | 24 | 1168 | 32.2 TB / 127.4 TB / 32.2 TB | 8.4 TB / 8.4 TB | 79 GB / 80 GB | 603 / 613 / 159 / 159 | 12 | 4354 (1) |
| alye/main | panorama | 16 | 115 | 5.8 TB / 23.4 TB / 5.8 TB | 1.5 TB / 1.5 TB | 9518 / 10 GB | 136 / 305 / 34 / 76 | 9 | 503 (0) |
| alye/paluba | roam | 15 | 59 | 1815.7 TB / 7262.7 TB / 1815.7 TB | 453.9 TB / 453.9 TB | 1963 / 9760 | 242 / 442 / 61 / 110 | 10 | 735 (0) |
| alye/zamok-greev | roam | 17 | 69 | 39 GB / 0.2 TB / 40 GB | 9743 / 10 GB | 623 / 1475 | 247 / 249 / 62 / 62 | 4 | 868 (0) |
| dama/bazar-opus | picture | 2 | 35 | 208 / 569 / 208 | 52 / 52 | 181 / 181 | 161 / 161 / 40 / 40 | 0 | 669 (0) |
| dama/nomer-opus | picture | 4 | 35 | 217 / 458 / 217 | 54 / 54 | 192 / 192 | 159 / 159 / 40 / 40 | 0 | 627 (0) |
| dama/oreanda-opus | picture | 2 | 35 | 1046 / 4151 / 1046 | 262 / 262 | 174 / 174 | 151 / 151 / 38 / 38 | 1 | 611 (0) |
| dama/stanciya-opus | panorama | 8 | 20 | 59 GB / 0.2 TB / 61 GB | 15 GB / 15 GB | 388 / 1937 | 71 / 91 / 18 / 23 | 7 | 355 (0) |
| paradizo/budka-opus | roam | 5 | 35 | 404 / 1340 / 6311 | 208 / 1626 | 393 / 6306 | 132 / 288 / 33 / 72 | 1 | 257 (0) |
| paradizo/pristan-opus | roam | 10 | 37 | 2.6 TB / 10.3 TB / 2.6 TB | 0.6 TB / 0.6 TB | 1130 / 16 GB | 79 / 237 / 20 / 59 | 8 | 309 (0) |
| paradizo/vokzal-opus | roam | 7 | 19 | 20 GB / 78 GB / 24 GB | 5132 / 6094 | 1780 / 7182 | 38 / 140 / 9 / 35 | 7 | 2452 (0) |
| paradizo/zal-opus | roam | 7 | 41 | 1836 / 3642 / 28 GB | 459 / 6990 | 1743 / 28 GB | 138 / 278 / 35 / 69 | 4 | 458 (0) |
| syn/dom-opus | roam | 5 | 24 | 971 / 3476 / 2017 | 404 / 689 | 292 / 1432 | 75 / 257 / 19 / 64 | 2 | 172 (0) |
| syn/kosogor-opus | roam | 2 | 14 | 0.2 TB / 0.2 TB / 0.2 TB | 0.2 TB / 0.2 TB | 1450 / 7597 | 90 / 137 / 23 / 34 | 4 | 941 (0) |
| syn/pereezd-opus | picture | 2 | 31 | 1.8 TB / 7.2 TB / 1.8 TB | 0.5 TB / 0.5 TB | 179 / 179 | 168 / 168 / 42 / 42 | 1 | 831 (0) |
| syn/ulica-opus | roam | 5 | 56 | 0.3 TB / 0.3 TB / 0.3 TB | 0.3 TB / 0.3 TB | 535 / 3086 | 119 / 498 / 30 / 124 | 3 | 526 (0) |
| vokrug/gavan | panorama | 11 | 77 | 3.9 TB / 15.5 TB / 3.9 TB | 1.0 TB / 1.0 TB | 2108 / 5485 | 245 / 332 / 61 / 83 | 5 | 1327 (0) |
| vokrug/iz-okna-poezda | picture | 5 | 25 | 691.4 TB / 2765.5 TB / 691.4 TB | 172.8 TB / 172.8 TB | 59 GB / 59 GB | 95 / 95 / 24 / 24 | 9 | 1017 (0) |
| vokrug/main | picture | 15 | 53 | 3165 / 13 GB / 3165 | 791 / 791 | 542 / 542 | 144 / 144 / 36 / 36 | 4 | 640 (0) |
| vokrug/sevil-rou | panorama | 8 | 70 | 71 GB / 98 GB / 71 GB | 34 GB / 34 GB | 67 GB / 67 GB | 176 / 229 / 44 / 57 | 12 | 2274 (0) |

Column notes. "×1 / ×2 / allowed zoom" are for a laptop at 1080p, all sheets. "Phone" is ×1 and allowed at 960×540.
"Cap 2048" is ×1 and allowed on a laptop, then ×1 and allowed on a phone at cap 1024.

---

## 4. What the numbers say

**Which scenes fit (laptop, 1080p, ×1, 300 MB).** dal (213), bazar (208), nomer (217): picture mode, 9 to 35 sheets
each. On a phone (150 MB) the same three (53, 52, 54 MB) and no others, at ×1.

**Which would fit without their ground plane.** lavka-v-lisse (765 → 163), oreanda (1046 → 174), pereezd (1.8 TB → 179).
In each, one sheet (street, cliff, ground) is the whole problem.

**Why the others do not fit.**

1. *Ground, sea, land planes.* At the near-eye density a shot asks for, they are gigabytes to thousands of terabytes
   (paluba's sea: 15 065 157 × 22 597 736 px at level 0). A page cache holds only the pages in view; a whole sheet cannot.
2. *Very long cards and strips.* sevil-rou (terrace glass 206 848 × 28 672 px at level 0: 32 GB at ×1), gavan (parapet
   238 206 × 1257), iz-okna-poezda (the train's mid strips 1 163 896 × 244 and its ground), les-u-morya (1168 sheets in
   a shot).
3. *Walk-up zoom* in roam, walk and panorama: the camera may stand 0.6 m from a sheet. Allowed-zoom sizes are larger
   than ×1 in most such scenes (paradizo/zal 1836 MB → 28 GB; budka 404 MB → 6.3 GB).
4. *360° skies*: 130–250 MB each in the worst shots (14097 × 3277 px at the shown level); two or three of them in a
   shot are already the whole budget.

**×2** (one level finer) multiplies every size by 3–4: dal 213 → 766, bazar 208 → 569, lavka 765 → 3043.

**8192 px.** In 20 of 23 scenes (all but dal, bazar, nomer) at least one sheet baked whole at ×1 would be wider or
taller than 8192 px, the texture limit; such sheets would have to be split, which is paging again.

**Baking only the pages a shot reads** (instead of whole sheets) is worse than today's cache: 172–4354 MB across the
scenes, typically 400–900 MB (les-u-morya 4.35 GB, vokzal 2.45 GB, sevil-rou 2.27 GB, gavan 1.33 GB). Today's cache is
420 MB because it throws pages away; a bake that must hold all of a shot's pages cannot.

**A cap per sheet.** With no side above 2048 px (phone 1024) the worst shot is 38–250 MB at ×1 on a laptop (les-u-morya
alone: 603 MB, 1168 sheets) and 9–159 MB on a phone. It fits almost everything. But a cap hides the cost: a 2048 px
sheet that stands for a 15 km ground plane or a 238 km strip is many levels softer than the eye needs near the camera.
The cap is honest only for cards and skies, which are bounded by their own picture.

The second run of caps (laptop: ×1 / allowed zoom; phone: allowed zoom), in MB:

| Scene | cap 4096: ×1 / allowed | cap 1024: ×1 / allowed | phone, cap 512, allowed |
|---|---|---|---|
| alye/dal | 213 / 213 | 34 / 34 | 8 |
| alye/dom-longrena | 400 / 433 | 65 / 71 | 18 |
| alye/lavka-v-lisse | 277 / 277 | 67 / 67 | 17 |
| alye/les-u-morya | 737 / 918 | 498 / 498 | 124 |
| alye/main | 358 / 837 | 43 / 109 | 27 |
| alye/paluba | 582 / 1289 | 86 / 136 | 34 |
| alye/zamok-greev | 562 / 573 | 76 / 78 | 19 |
| dama/bazar-opus | 208 / 208 | 58 / 58 | 15 |
| dama/nomer-opus | 217 / 217 | 51 / 51 | 13 |
| dama/oreanda-opus | 235 / 235 | 62 / 62 | 16 |
| dama/stanciya-opus | 194 / 269 | 24 / 27 | 7 |
| paradizo/budka-opus | 214 / 882 | 55 / 92 | 23 |
| paradizo/pristan-opus | 245 / 801 | 26 / 65 | 16 |
| paradizo/vokzal-opus | 130 / 381 | 11 / 38 | 9 |
| paradizo/zal-opus | 378 / 1087 | 51 / 75 | 19 |
| syn/dom-opus | 191 / 747 | 39 / 72 | 18 |
| syn/kosogor-opus | 350 / 513 | 25 / 35 | 9 |
| syn/pereezd-opus | 247 / 247 | 60 / 60 | 15 |
| syn/ulica-opus | 217 / 1056 | 61 / 163 | 41 |
| vokrug/gavan | 616 / 845 | 96 / 127 | 32 |
| vokrug/iz-okna-poezda | 197 / 197 | 33 / 33 | 8 |
| vokrug/main | 310 / 310 | 61 / 61 | 15 |
| vokrug/sevil-rou | 513 / 572 | 63 / 95 | 24 |

---

## 5. Verdict

**Not built.** Pure bake-once — every sheet whole, nothing painted in play — does not fit the budgets on the scenes as
they are. Three of 23 scenes fit at 1080p ×1; a sharper picture, a closer camera or a phone leaves none or one.

A hybrid is possible and was not pursued: cards and skies, bounded by their picture, are baked whole under a size cap at
the break; the one to three giant plane-like sheets of a scene (ground, sea, land, long strips) stay on pages. It would
take most sheets out of the stream and keep the ones that cannot be baked. It needs a rule for what is plane-like and a
check that the capped cards are not visibly soft; neither was studied.

The owner chose to keep streaming and make it cheaper: the studio's history.
