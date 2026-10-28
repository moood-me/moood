# Study: what the engine-2 scenes really use

Read-only inventory of the 20 scenes of the five "-v2" worlds, from their sources (`env/dev` heads of 2026-10-10).

## Summary

1. All 20 scenes were found and read (Ашеры 7, Вокруг света 5, Алые паруса 5, Ночь 2, Хризалиды 1): 1888 files, 82 576 lines, 2164 objects, 102 people, 137 lights, 99 particle emitters, 15 inserts, 0 widgets.
2. Unused by every scene: widgets, the platformer, camera modes `overhead`/`platform`, `travel`, `bearing`, element scripts, `s.event`/`s.any`/signals/pause, `scene.light().fade`, `mood`/`talk`, bodies, `F.cloth`, particles `petals`/`bubbles`/`onto`/`lit`/`streak`/`bounce`, `seen: "direct"` (1.3).
3. Shaders: 82 files, 43 distinct texts (895 lines); 39 files are copies (sailcloth ×33, the world sky ×5, a lit-layer text ×4); 10 texts lean on `srgbToLinear` and 10 on `fwidth`, which the language's text does not name; 9 texts only add a layer as light.
4. Repetition: 1462 of 1935 painted elements come from a template — 433 house faces (85 pictures), 298 tree crowns (298 pictures from 2 kinds), 170 arch strips (38), 144 grass cards, 135 hut and church faces (50); 5034 painted sheets, 4137 distinct.
5. Per-frame scripts: 276 animates, nearly all functions of state keys alone or of time by a fixed law, with no guard for a thing absent, closed or far; scripts in 16 scenes write keys from keys on every frame of a move; 10 scenes keep keys going with timers (the train and a ship: half-second moves re-issued four times a second).
6. Lights: `e.light` glows are 1259 lights of the scenes — 943 in the train scene alone (789 in one painting), 81 in gavan, 60 in Берег; five candles are five lights; shadows are asked by 999 elements (Полёт 438, Лес 299).
7. Size: places to 124 km, a draped ground 100 × 100 km and one 150 × 4 km, seas to 40 × 60 km, cards 128–147 km wide; blizzards of 42 000 and 60 000 flakes.
8. Unlit: three Asher scenes have no `ambient` (main, padenie-doma-2, and treshchina — sky elements only); the first two bake the hour and the moon into paint (pairs of colours, layers painted twice), and one builds its water and reflection by hand; inserts paint their own light in 10 scenes.
9. Quirks a redesign meets: the film is a world module (`beats.js`, five copies) with cuts not made ready for a game; pixels made and read back in a painting (close-ups); twins only to glow; props swapped at waited seconds; mist as cards 75–884 m wide or as giant particles; houses assembled by hand without a generator.
10. Against the earlier documents: 18 differences listed — the largest: lights were counted by call sites (the train's 943 unseen), `captions`/`directions` and four particle fields are in use, more scenes exceed the drafted budgets (particles, large sprites, dzhungli's casters).
## 0. Where the scenes are, what was read, how it was counted

**Scenes.** Five world repositories on GitHub (not public), each deployment a branch; the
earlier documents name `env/dev` as the deployment's branch (plan/spec-language.md:4). I cloned `env/dev` of each afresh
(`git clone --depth 1 --branch env/dev`) into the scratchpad (`scratchpad/study-src/<slug>`), because the clones already
lying in the scratchpad are stale (v2/alye-parusa-v2 one commit behind, v2/khrizalidy-kino-igra-v2 eight commits behind,
others on work branches). Nothing was written to any repository.

| World | Repo slug | `env/dev` head read | Date of head | Scenes |
|---|---|---|---|---|
| Падение дома Ашеров v2 | padenie-doma-asherov-v2 | 06bbb186 | 2026-10-10 16:38 UTC | 7 |
| Вокруг света v2 | vokrug-sveta-v2 | 2e970059 | 2026-10-10 17:30 UTC | 5 |
| Алые паруса v2 | alye-parusa-v2 | f7f338cf | 2026-10-10 15:55 UTC | 5 |
| Ночь перед Рождеством v2 | noch-pered-rozhdestvom-v2 | 9998e1b2 | 2026-10-10 17:50 UTC | 2 |
| Хризалиды — кино-игра v2 | khrizalidy-kino-igra-v2 | 9db20e7d | 2026-10-10 12:34 UTC | 1 |

All 20 scenes say `"engine": 2`. All were found and read; none is missing. In every repo `env/malay/main` and
`env/malay/three` point at the same commit as `env/dev`; `env/malay/asked` and `env/malay/motion` point at older commits.
Branches not read: `paluba-paint-once`, `paluba-palette-shader` (Алые паруса), `horse-seat-animate` (Хризалиды),
`modules-engine2` (Ашеры) — work branches, not a deployment's.

**A scene on disk** (as a host puts it together: `player/folder.js`): `scene.json`;
`script.js`, `showcase.js`, `lib.js`, `relief.js`, `notes.md`; `elements/<id>.js` (the painting), `elements/<id>.animate.js`,
`elements/<id>.glsl`, `elements/<id>.script.js`, `widgets/<id>.html`. Code may also lie inline in `scene.json` — one scene
does so for 510 objects (Алые паруса / les-u-morya: `"code": "e.lib.crown(e, 17);"` and the like, written by
`tools/les-u-morya.js`). The world's `modules/<name>.js` (+ `.data.json`, `.md`) are shared by its scenes.

**The language's words** were taken from: the old artist's prompt (the one text; published as
scene-format.md), `docs/worlds/people.md`, and the engine at
the rpg checkout (branch main-merge = origin/main, 1d90bdd): engine 2 (gone)
(element fields, camera MODES :14, PLACE :125, what is said as gone :21-36), `core/particles.js` (SHAPES :19, GROUND :20,
BLENDS :21, PRESETS :32-48, BASE/FIELDS :51-58), `core/light.js` (LOOK_NUM :31, light entries :152-246, e.light → a point
light :277-300), `core/element.js` (the painting's `e` :88-137, layers' options :354-372, animate's `e` :262-330, LAYER
:29), `core/director.js` (a person's verbs :465-521, the script's API :616-667, actions :82-111), `engines/1/kit.js`
(`anim` :67, the engine's state keys :172-186), `render/glsl/custom.js` and `render/glsl/common.js` (what a shader is given).

**How it was counted.** Four ways, each named where used:

1. *scene.json* — parsed; every key and the enumerated values counted (appendix A2 `words.mjs`).
2. *Code, textual* — the code's text with comments removed, matched by name (`.layer(`, `.uniform(`, `s.shot(` …).
   This counts call sites written, not calls made: a call inside a loop is one; the receiver's name is not checked for
   most words (`.turn(` is a person's, a key's or `anim`'s). So a textual zero is firm ("nobody writes it"); a textual
   count is "written this many times".
3. *The paint probe* (appendix A3 `probe.mjs`) — each element's `code` run **once**, in Node, into the engine's own
   `Recorder` (web/scene2/paint/recorder.js — a display list; no canvas, no GPU, no frame rendered), with the scene's
   lib, its world's modules and the state as scene.json starts it. It gives what is truly painted: how many layers and
   parts each element makes, with which options; every `e.light`; the keys a painting reads; the recording's hash (the
   engine's own h1/h2 — two paintings with the same hash are one picture, recorder.js:14-15). Each `animate` was then
   called for 120 frames against a counting stand-in. All 1935 paintings and all 276 animates ran without an error.
   Limits: only the branch taken by the *starting* state is seen (a painting may read other keys in another state);
   people are not painted (they are meshes); nothing is known of pixels.
4. *Reading* — sections 3, 5 and 6 are from reading the scripts, libs, animates and modules (seven readers, one per
   world or half-world, each told to cite file:line; I checked their load-bearing claims against the files and the
   counts above, and say where a claim is theirs alone).

Sizes: "lines" counts every text line of the scene's folder (scene.json included); "files" every file of the folder.

## 1. The words of the scene language the scenes use

### 1.1 The scenes

| # | World (repo) | Scene folder | Title | Files | Lines | Objects | Modules listed |
|---|---|---|---|---|---|---|---|
| 1 | Ашеры (padenie-doma-asherov-v2) | burya-i-chtenie | Буря и чтение | 39 | 2870 | 32 | cast, closeups, ushers, beats |
| 2 | Ашеры (padenie-doma-asherov-v2) | komnata-roderika | Комната Родерика | 27 | 2503 | 20 | cast, ushers, closeups, beats |
| 3 | Ашеры (padenie-doma-asherov-v2) | main | Подъезд к дому | 34 | 1737 | 22 | cast, ushers, closeups, beats |
| 4 | Ашеры (padenie-doma-asherov-v2) | medlin-prokhodit | Мэдлин проходит | 215 | 5759 | 211 | cast, beats, closeups |
| 5 | Ашеры (padenie-doma-asherov-v2) | padenie-doma-2 | Падение дома | 25 | 1871 | 19 | cast, ushers, beats |
| 6 | Ашеры (padenie-doma-asherov-v2) | sklep | Склеп | 35 | 2636 | 31 | cast, beats, closeups |
| 7 | Ашеры (padenie-doma-asherov-v2) | treshchina | Трещина | 11 | 726 | 3 | — |
| 8 | Вокруг света (vokrug-sveta-v2) | dzhungli | Джунгли | 62 | 3616 | 86 | svet, cast, beats |
| 9 | Вокруг света (vokrug-sveta-v2) | gavan | Гавань | 88 | 3031 | 68 | svet, cast, beats |
| 10 | Вокруг света (vokrug-sveta-v2) | iz-okna-poezda | Из окна поезда | 40 | 2520 | 27 | svet, cast, beats |
| 11 | Вокруг света (vokrug-sveta-v2) | main | Реформ-клуб | 54 | 2320 | 50 | svet, cast, beats |
| 12 | Вокруг света (vokrug-sveta-v2) | sevil-rou | Сэвил-Роу | 68 | 3160 | 61 | svet, cast, beats |
| 13 | Алые паруса (alye-parusa-v2) | dom-longrena | Дом Лонгрена | 98 | 3835 | 67 | nebo, korabli, cast, beats |
| 14 | Алые паруса (alye-parusa-v2) | les-u-morya | Лес у моря | 25 | 11846 | 534 | nebo, cast, beats |
| 15 | Алые паруса (alye-parusa-v2) | main | Берег Каперны | 81 | 2791 | 50 | nebo, korabli, cast, beats |
| 16 | Алые паруса (alye-parusa-v2) | paluba | Палуба | 114 | 4110 | 70 | nebo, korabli, cast, beats |
| 17 | Алые паруса (alye-parusa-v2) | zamok-greev | Замок Греев | 85 | 3263 | 69 | nebo, cast, beats |
| 18 | Ночь (noch-pered-rozhdestvom-v2) | main | Диканька | 186 | 6489 | 186 | cast, beats |
| 19 | Ночь (noch-pered-rozhdestvom-v2) | polyot | Полёт | 560 | 14518 | 529 | cast, beats |
| 20 | Хризалиды (khrizalidy-kino-igra-v2) | nasyp-u-ruchya | Насыпь у ручья | 41 | 2975 | 29 | chrysalids, cast, beats |

### 1.2 One table over all scenes: word → in how many scenes, how many uses

T1–T8 are counted from scene.json (exact). T9–T12 are textual counts in the scenes' own code (see 0, way 2); the receiver is not checked — `.turn(` counts a person's turn, a key's and any other; `.do(`, `.go(`, `.look(`, `.with(` likewise. T13 is what the paintings made when run once (way 3). T14 is the modules' code.

**T1. Top-level fields of scene.json**

| Word | Scenes (of 20) | Uses |
|---|---|---|
| `spec.camera` | 20 | 20 |
| `spec.caption` | 19 | 19 |
| `spec.captions` | 3 | 3 |
| `spec.directions` | 4 | 4 |
| `spec.engine` | 20 | 20 |
| `spec.horizon` | 20 | 20 |
| `spec.lib` | 20 | 20 |
| `spec.light` | 20 | 20 |
| `spec.lights` | 19 | 19 |
| `spec.modules` | 19 | 19 |
| `spec.music` | 19 | 19 |
| `spec.notes` | 20 | 20 |
| `spec.objects` | 20 | 20 |
| `spec.relief` | 8 | 8 |
| `spec.script` | 19 | 19 |
| `spec.showcase` | 20 | 20 |
| `spec.state` | 20 | 20 |
| `spec.states` | 20 | 20 |
| `spec.title` | 20 | 20 |

**T2. Camera**

| Word | Scenes (of 20) | Uses |
|---|---|---|
| `camera.area` | 5 | 5 |
| `camera.look` | 2 | 2 |
| `camera.mode` | 20 | 20 |
| `camera.mode=around` | 1 | 1 |
| `camera.mode=panorama` | 4 | 4 |
| `camera.mode=picture` | 10 | 10 |
| `camera.mode=roam` | 3 | 3 |
| `camera.mode=walk` | 2 | 2 |
| `camera.on` | 1 | 1 |
| `camera.span` | 4 | 4 |
| `camera.turn` | 1 | 1 |

**T3. Light and its looks (`light.x` — in the base light; `look.x` — a field inside a look; uses = looks that set it)**

| Word | Scenes (of 20) | Uses |
|---|---|---|
| `light.ambient` | 17 | 17 |
| `light.ambientColor` | 19 | 19 |
| `light.bounce` | 12 | 12 |
| `light.grain` | 20 | 20 |
| `light.haze` | 19 | 19 |
| `light.hazeColor` | 19 | 19 |
| `light.hazeGlow` | 16 | 16 |
| `light.inside` | 5 | 5 |
| `light.looks(entry)` | 18 | 57 |
| `light.people` | 2 | 2 |
| `light.saturation` | 3 | 3 |
| `light.shafts` | 9 | 9 |
| `light.tint` | 6 | 6 |
| `light.tintStrength` | 6 | 6 |
| `light.vignette` | 20 | 20 |
| `light.wind` | 13 | 13 |
| `look.ambient` | 15 | 37 |
| `look.ambientColor` | 16 | 39 |
| `look.bounce` | 2 | 2 |
| `look.brightness` | 2 | 2 |
| `look.haze` | 13 | 37 |
| `look.hazeColor` | 13 | 39 |
| `look.hazeGlow` | 5 | 6 |
| `look.inside` | 2 | 2 |
| `look.lights` | 7 | 11 |
| `look.lights(entry)` | 7 | 11 |
| `look.people` | 1 | 1 |
| `look.saturation` | 12 | 16 |
| `look.shafts` | 10 | 21 |
| `look.tint` | 13 | 19 |
| `look.tintStrength` | 13 | 20 |
| `look.wind` | 6 | 9 |

**T4. `lights` entries**

| Word | Scenes (of 20) | Uses |
|---|---|---|
| `lights:kind=at(person point)` | 5 | 10 |
| `lights:kind=daylight+of` | 3 | 5 |
| `lights:kind=from"sky#point"` | 10 | 18 |
| `lights:kind=from[bearing,height]` | 8 | 13 |
| `lights:kind=of` | 14 | 66 |
| `lights:kind=point` | 6 | 25 |
| `lights.across` | 6 | 25 |
| `lights.at` | 5 | 10 |
| `lights.color` | 19 | 74 |
| `lights.daylight` | 3 | 5 |
| `lights.distance` | 6 | 25 |
| `lights.elevation` | 6 | 25 |
| `lights.flicker` | 11 | 27 |
| `lights.from` | 17 | 31 |
| `lights.glow` | 7 | 26 |
| `lights.id` | 19 | 137 |
| `lights.of` | 14 | 71 |
| `lights.on` | 19 | 97 |
| `lights.place` | 2 | 4 |
| `lights.place.across` | 1 | 2 |
| `lights.place.bearing` | 1 | 2 |
| `lights.place.height` | 1 | 2 |
| `lights.reach` | 17 | 104 |
| `lights.size` | 6 | 12 |
| `lights.soft` | 4 | 8 |
| `lights.strength` | 19 | 121 |
| `lights.through` | 5 | 10 |
| `lights.through:element+element` | 1 | 2 |
| `lights.through:polygon` | 1 | 2 |
| `lights.through:polygon+polygon` | 1 | 2 |
| `lights.through:polygon+polygon+polygon` | 1 | 2 |
| `lights.through:polygon+polygon+polygon+polygon+polygon+polygon+polygon+polygon+polygon+polygon+polygon+polygon+polygon+polygon+polygon+polygon` | 1 | 2 |

**T5. Elements: kinds and fields (uses = objects that have the field)**

| Word | Scenes (of 20) | Uses |
|---|---|---|
| `el.across` | 19 | 1903 |
| `el.animate` | 20 | 276 |
| `el.behind` | 5 | 8 |
| `el.box` | 19 | 1511 |
| `el.clip` | 1 | 2 |
| `el.clip.inside` | 1 | 2 |
| `el.code` | 20 | 1937 |
| `el.depth` | 19 | 389 |
| `el.distance` | 19 | 2005 |
| `el.drape` | 6 | 12 |
| `el.elevation` | 19 | 949 |
| `el.facing` | 16 | 760 |
| `el.flicker` | 6 | 64 |
| `el.glass` | 4 | 7 |
| `el.glass.blur` | 3 | 5 |
| `el.glass.strength` | 3 | 5 |
| `el.glass=object` | 3 | 5 |
| `el.glass=true` | 1 | 2 |
| `el.glows` | 13 | 86 |
| `el.height` | 18 | 1367 |
| `el.id` | 20 | 2164 |
| `el.inFront` | 6 | 72 |
| `el.insert` | 10 | 15 |
| `el.inside` | 5 | 125 |
| `el.iris` | 2 | 5 |
| `el.lit` | 9 | 44 |
| `el.lit=true` | 9 | 44 |
| `el.name` | 20 | 2164 |
| `el.on` | 14 | 915 |
| `el.onLand` | 4 | 32 |
| `el.onLand=false` | 4 | 32 |
| `el.particles` | 15 | 99 |
| `el.person` | 19 | 102 |
| `el.place` | 19 | 155 |
| `el.place.across` | 19 | 127 |
| `el.place.distance` | 19 | 117 |
| `el.place.elevation` | 6 | 21 |
| `el.place.facing` | 11 | 33 |
| `el.place.tilt` | 4 | 17 |
| `el.plane` | 19 | 389 |
| `el.redraw` | 4 | 6 |
| `el.redraw=steps` | 4 | 6 |
| `el.reflect` | 14 | 24 |
| `el.reflect.blur` | 14 | 24 |
| `el.reflect.fade` | 14 | 24 |
| `el.reflect.ripple` | 8 | 12 |
| `el.reflect.rough` | 14 | 20 |
| `el.reflect.strength` | 14 | 24 |
| `el.reflect=object` | 14 | 24 |
| `el.rotation` | 4 | 188 |
| `el.seen` | 1 | 1 |
| `el.seen=reflection` | 1 | 1 |
| `el.shader` | 18 | 82 |
| `el.shadow` | 19 | 1064 |
| `el.shadow.light` | 4 | 22 |
| `el.shadow.onto` | 13 | 1023 |
| `el.shadow.soft` | 12 | 712 |
| `el.shadow.strength` | 11 | 960 |
| `el.shadow=false` | 1 | 1 |
| `el.shadow=object` | 14 | 1028 |
| `el.shadow=true` | 9 | 35 |
| `el.sky` | 19 | 27 |
| `el.tilt` | 7 | 409 |
| `el.translucent` | 9 | 347 |
| `el.translucent(value)` | 9 | 347 |
| `el.uniforms` | 18 | 80 |
| `el.unseen` | 12 | 30 |
| `el.walk` | 4 | 8 |
| `el.width` | 19 | 389 |
| `el.x` | 3 | 15 |
| `kind=card` | 19 | 1506 |
| `kind=insert` | 10 | 15 |
| `kind=particles` | 15 | 99 |
| `kind=person` | 19 | 102 |
| `kind=plane` | 19 | 389 |
| `kind=sky` | 19 | 27 |
| `kind=unseen` | 11 | 26 |
| `uniform(declared)` | 18 | 582 |

**T6. Particles**

| Word | Scenes (of 20) | Uses |
|---|---|---|
| `particles: sprite painted by code` | 2 | 2 |
| `particles.amount` | 13 | 38 |
| `particles.amount=state key` | 13 | 38 |
| `particles.area` | 1 | 2 |
| `particles.around` | 1 | 1 |
| `particles.at` | 13 | 72 |
| `particles.at=[a,d,e]` | 7 | 14 |
| `particles.at=ref string` | 9 | 58 |
| `particles.blend` | 2 | 3 |
| `particles.blend=over` | 2 | 3 |
| `particles.blink` | 1 | 1 |
| `particles.burst` | 5 | 12 |
| `particles.burst.count` | 4 | 7 |
| `particles.burst.on` | 4 | 7 |
| `particles.burst.over` | 3 | 5 |
| `particles.color` | 10 | 33 |
| `particles.colors` | 2 | 2 |
| `particles.count` | 3 | 5 |
| `particles.direction` | 6 | 14 |
| `particles.drag` | 8 | 18 |
| `particles.fade` | 6 | 13 |
| `particles.flicker` | 3 | 3 |
| `particles.frames` | 1 | 1 |
| `particles.glow` | 5 | 8 |
| `particles.gravity` | 8 | 21 |
| `particles.ground` | 4 | 7 |
| `particles.ground=pass` | 3 | 5 |
| `particles.ground=splash` | 1 | 1 |
| `particles.ground=stop` | 1 | 1 |
| `particles.gust` | 5 | 6 |
| `particles.inherit` | 2 | 3 |
| `particles.kind` | 15 | 99 |
| `particles.kind=blizzard` | 2 | 2 |
| `particles.kind=drops` | 1 | 2 |
| `particles.kind=dust` | 8 | 8 |
| `particles.kind=embers` | 7 | 7 |
| `particles.kind=fire` | 5 | 11 |
| `particles.kind=fireflies` | 2 | 2 |
| `particles.kind=leaves` | 2 | 2 |
| `particles.kind=puff` | 6 | 12 |
| `particles.kind=rain` | 1 | 3 |
| `particles.kind=smoke` | 8 | 43 |
| `particles.kind=snow` | 1 | 1 |
| `particles.kind=sparks` | 2 | 3 |
| `particles.kind=splashes` | 2 | 3 |
| `particles.life` | 14 | 68 |
| `particles.opacity` | 11 | 29 |
| `particles.rate` | 15 | 79 |
| `particles.reach` | 2 | 3 |
| `particles.settle` | 1 | 1 |
| `particles.shadow` | 5 | 13 |
| `particles.shape` | 2 | 4 |
| `particles.shape=dot` | 2 | 3 |
| `particles.shape=puff` | 1 | 1 |
| `particles.sheer` | 5 | 5 |
| `particles.size` | 13 | 80 |
| `particles.soft` | 6 | 13 |
| `particles.source` | 13 | 39 |
| `particles.speed` | 9 | 28 |
| `particles.spin` | 3 | 3 |
| `particles.spread` | 8 | 22 |
| `particles.swirl` | 5 | 7 |
| `particles.tumble` | 1 | 1 |
| `particles.turbulence` | 8 | 18 |
| `particles.veil` | 1 | 1 |
| `particles.wind` | 8 | 21 |

**T7. People in scene.json (`state:<person>_x` — the key is in the starting state)**

| Word | Scenes (of 20) | Uses |
|---|---|---|
| `person.cast` | 19 | 102 |
| `person.does` | 11 | 39 |
| `person.gait` | 2 | 2 |
| `person.look` | 2 | 4 |
| `person.look.body` | 1 | 3 |
| `person.look.colors` | 1 | 3 |
| `person.look.garment` | 1 | 3 |
| `person.look.hair` | 1 | 3 |
| `person.look.hat` | 2 | 4 |
| `person.look.kind` | 1 | 3 |
| `person.look.kind=shapes` | 1 | 3 |
| `person.look.style` | 1 | 3 |
| `person.look.style=vokrug` | 1 | 3 |
| `person.look.who` | 1 | 3 |
| `person.turn` | 17 | 77 |
| `person.who` | 19 | 99 |
| `state:<person>_do` | 8 | 20 |
| `state:<person>_gait` | 3 | 8 |
| `state:<person>_here` | 18 | 70 |
| `state:<person>_look` | 7 | 16 |
| `state:<person>_on` | 5 | 7 |
| `state:<person>_reach` | 6 | 15 |
| `state:<person>_steps` | 2 | 4 |
| `state:<person>_turn` | 8 | 21 |
| `state:<person>_wear` | 2 | 4 |
| `state:<person>_with` | 5 | 12 |

**T8. State, states, captions, directions, widgets, music**

| Word | Scenes (of 20) | Uses |
|---|---|---|
| `captions.at` | 3 | 3 |
| `captions.for` | 3 | 3 |
| `captions.text` | 3 | 3 |
| `directions.key` | 4 | 7 |
| `directions.name` | 4 | 7 |
| `music.bpm` | 19 | 19 |
| `music.brightness` | 19 | 19 |
| `music.density` | 19 | 19 |
| `music.prompts` | 19 | 19 |
| `music.prompts(entry)` | 19 | 369 |
| `music.prompts(weight>0)` | 19 | 79 |
| `state:camera_h` | 3 | 3 |
| `state:camera_look` | 2 | 2 |
| `state:camera_x` | 5 | 5 |
| `state:camera_z` | 3 | 3 |
| `state:fade` | 8 | 8 |
| `state(keys)` | 20 | 797 |
| `states.means` | 20 | 517 |
| `states.range` | 20 | 331 |
| `states.smooth` | 20 | 305 |
| `states.type` | 20 | 167 |
| `states.values` | 12 | 17 |
| `states(entry)` | 20 | 517 |

**T9. Painting and animate (textual counts in the scene's own code: elements, animates, lib, script, showcase, relief — the world's modules are counted apart, below)**

| Word | Scenes (of 20) | Uses |
|---|---|---|
| `anim (any use)` | 20 | 306 |
| `anim.clamp` | 13 | 57 |
| `anim.clamp (destructured)` | 9 | 10 |
| `anim.drift` | 3 | 5 |
| `anim.ease` | 9 | 21 |
| `anim.ease (destructured)` | 2 | 2 |
| `anim.hash` | 13 | 134 |
| `anim.hash (destructured)` | 4 | 4 |
| `anim.mix` | 2 | 3 |
| `anim.mix (destructured)` | 6 | 10 |
| `anim.noise` | 11 | 27 |
| `anim.noise (destructured)` | 1 | 1 |
| `anim.span` | 5 | 20 |
| `anim.span (destructured)` | 6 | 9 |
| `e.area` | 5 | 7 |
| `e.aspect` | 15 | 47 |
| `e.at(` | 20 | 232 |
| `e.cut (seconds since the cut)` | 2 | 2 |
| `e.dt` | 8 | 15 |
| `e.glow(` | 14 | 53 |
| `e.ground(` | 4 | 12 |
| `e.id` | 4 | 23 |
| `e.layer(` | 20 | 379 |
| `e.light(` | 18 | 85 |
| `e.mem` | 11 | 18 |
| `e.part(` | 10 | 34 |
| `e.point(` | 3 | 4 |
| `e.rnd(` | 9 | 233 |
| `e.speed(` | 5 | 5 |
| `e.spot` | 1 | 3 |
| `e.state` | 20 | 257 |
| `e.t` | 14 | 41 |
| `e.uniform(` | 15 | 127 |
| `e.where(` | 1 | 8 |
| `ease back` | 1 | 1 |
| `ease in` | 15 | 38 |
| `ease inOut` | 17 | 190 |
| `ease linear` | 13 | 36 |
| `ease out` | 17 | 79 |
| `ease smooth` | 6 | 13 |
| `layer blend "add"` | 7 | 9 |
| `layer blend "multiply"` | 2 | 2 |
| `layer opt blend (written inline)` | 9 | 11 |
| `layer opt box (written inline)` | 12 | 66 |
| `layer opt depth (written inline)` | 6 | 19 |
| `layer opt drift (written inline)` | 8 | 16 |
| `layer opt flicker (written inline)` | 5 | 7 |
| `layer opt pivot (written inline)` | 18 | 75 |
| `layer opt shimmer (written inline)` | 3 | 4 |
| `layer opt wind (written inline)` | 10 | 19 |
| `layer.alpha` | 17 | 96 |
| `layer.brightness` | 4 | 7 |
| `layer.rotate` | 16 | 34 |
| `layer.scale` | 6 | 8 |
| `layer.scaleX` | 10 | 27 |
| `layer.scaleY` | 11 | 15 |
| `layer(…).x` | 1 | 1 |
| `layer(…).y` | 4 | 5 |

**T10. Canvas beyond plain paths and fills (textual)**

| Word | Scenes (of 20) | Uses |
|---|---|---|
| `createLinearGradient(` | 20 | 138 |
| `createRadialGradient(` | 15 | 70 |
| `evenodd` | 10 | 40 |
| `fillText(` | 4 | 5 |
| `g.clip(` | 13 | 54 |
| `g.filter` | 3 | 16 |
| `g.globalCompositeOperation` | 3 | 4 |
| `g.shadowBlur` | 1 | 3 |
| `measureText(` | 2 | 3 |
| `Path2D` | 2 | 30 |

**T11. Scripts, the director, the film's camera keys (textual)**

| Word | Scenes (of 20) | Uses |
|---|---|---|
| `.do(` | 18 | 164 |
| `.gait(` | 10 | 32 |
| `.go(` | 13 | 37 |
| `.here(` | 12 | 54 |
| `.look(` | 18 | 395 |
| `.reach(` | 17 | 148 |
| `.say(` | 1 | 2 |
| `.startOf(` | 4 | 4 |
| `.still(` | 1 | 2 |
| `.turn(` | 19 | 117 |
| `.walk(` | 19 | 129 |
| `.wear(` | 3 | 3 |
| `.with(` | 11 | 38 |
| `action.cancel(` | 4 | 5 |
| `action.duration` | 2 | 2 |
| `action.ending(` | 6 | 15 |
| `action.finish(` | 1 | 1 |
| `action.remaining` | 3 | 5 |
| `camera_frame` | 6 | 17 |
| `camera_glide` | 6 | 10 |
| `camera_h` | 13 | 47 |
| `camera_look` | 9 | 43 |
| `camera_pitch` | 7 | 19 |
| `camera_roll` | 2 | 5 |
| `camera_shot` | 6 | 26 |
| `camera_shot a number` | 3 | 12 |
| `camera_shot wide` | 1 | 1 |
| `camera_target` | 9 | 32 |
| `camera_x` | 19 | 111 |
| `camera_yaw` | 7 | 46 |
| `camera_z` | 17 | 105 |
| `fade (key)` | 12 | 95 |
| `fade_color` | 1 | 2 |
| `opt ease:` | 20 | 326 |
| `opt gait:` | 8 | 21 |
| `opt going:` | 2 | 2 |
| `opt loop:` | 19 | 125 |
| `opt name: (sequence)` | 3 | 9 |
| `opt over:` | 20 | 416 |
| `opt speed:` | 5 | 13 |
| `opt steps:` | 4 | 4 |
| `person.on(point)` | 5 | 18 |
| `s.all(` | 13 | 56 |
| `s.until(` | 13 | 45 |
| `s.wait(` | 20 | 883 |
| `scene.after(` | 2 | 6 |
| `scene.camera(` | 3 | 9 |
| `scene.cut(` | 16 | 62 |
| `scene.every(` | 9 | 16 |
| `scene.get(` | 16 | 116 |
| `scene.move(` | 20 | 417 |
| `scene.on('arrived')` | 1 | 1 |
| `scene.on('change')` | 16 | 56 |
| `scene.on('cut')` | 2 | 2 |
| `scene.on('load')` | 3 | 3 |
| `scene.on('move')` | 16 | 25 |
| `scene.path(` | 8 | 22 |
| `scene.person(` | 19 | 465 |
| `scene.prepare(` | 1 | 1 |
| `scene.random(` | 6 | 7 |
| `scene.sequence(` | 13 | 58 |
| `scene.set(` | 19 | 218 |
| `scene.shot(` | 16 | 46 |
| `scene.state` | 13 | 67 |
| `scene.tell(` | 15 | 129 |
| `scene.time` | 2 | 5 |
| `scene.was( (no e.was in any animate)` | 1 | 2 |
| `shot.ready` | 9 | 21 |

**T12. Shared code and globals (textual; `globalThis/self/window/document` matches the word `window` used as a variable name — no scene touches the globals)**

| Word | Scenes (of 20) | Uses |
|---|---|---|
| `e.kit / scene.kit / kit.` | 19 | 190 |
| `e.lib / scene.lib` | 20 | 2004 |
| `globalThis/self/window/document` | 9 | 24 |

**T13. As painted (the probe ran every painting once): layers, parts, glows, points, what the recordings hold**

| What | Scenes (of 20) | Count |
|---|---|---|
| e.at points painted | 20 | 300 |
| elements marking e.at | 18 | 198 |
| elements painting e.light | 18 | 121 |
| elements with layers | 20 | 733 |
| elements with parts | 10 | 46 |
| layer blend=add | 7 | 111 |
| layer blend=multiply | 2 | 3 |
| layer opt blend | 9 | 114 |
| layer opt box | 12 | 2321 |
| layer opt depth | 8 | 436 |
| layer opt drift | 8 | 40 |
| layer opt flicker | 5 | 62 |
| layer opt pivot | 18 | 2363 |
| layer opt shimmer | 4 | 17 |
| layer opt wind | 12 | 1880 |
| layer painting nothing | 3 | 20 |
| layer wind as {strength,gust,scale} | 11 | 1878 |
| layer with no option | 17 | 126 |
| layers | 20 | 2684 |
| paintings making an OffscreenCanvas | 2 | 2 |
| part at its own depth (dz≠0) | 10 | 1141 |
| parts | 10 | 1155 |
| recorded composite:destination-out | 2 | 2 |
| recorded composite:lighter | 1 | 1 |
| recorded filter | 4 | 13 |
| recorded image | 1 | 2 |
| recorded path2d | 5 | 193 |
| recorded style:linear | 20 | 330 |
| recorded style:radial | 20 | 433 |

**T14. The worlds' modules (textual counts, per file; a module is shared by the scenes of its world that list it)**

| World | Module | Words (uses) |
|---|---|---|
| Ашеры | beats.js | scene.sequence( 1; scene.get( 1; scene.cut( 3; scene.shot( 1; scene.tell( 2; opt name: (sequence) 1; scene.on('change') 1 |
| Ашеры | cast.js | e.point( 2; MooodShapes 7 |
| Ашеры | closeups.js | e.layer( 34; e.at( 11; e.t 1; e.aspect 1; anim (any use) 1; layer.rotate 1; layer.alpha 1; layer.brightness 1; layer.scaleX 2; layer.scaleY 1; g.filter 11; g.drawImage( 4; OffscreenCanvas 6; getImageData( 1; putImageData( 5; createLinearGradient( 9; createRadialGradient( 10; g.clip( 8; g.setTransform( 1; g.getTransform( 15; ImageData 5; globalThis/self/window/document 1; anim.clamp (destructured) 1; anim.mix (destructured) 1; anim.noise (destructured) 1; anim.drift (destructured) 1; anim.hash (destructured) 1; person.on(point) 35; layer opt pivot (written inline) 25; layer opt shimmer (written inline) 1; layer opt box (written inline) 8; layer opt drift (written inline) 1; layer opt blend (written inline) 1; layer blend "add" 1 |
| Ашеры | ushers.js | e.layer( 5; e.light( 4; e.at( 4; e.warn( 2; e.speed( 2; e.state 2; e.t 2; e.dt 1; e.mem 1; e.spot 1; e.id 3; e.kit / scene.kit / kit. 2; anim (any use) 1; layer.rotate 1; layer.alpha 2; layer.scaleX 1; layer.scaleY 1; scene.move( 1; opt over: 1; opt speed: 1; opt gait: 7; camera_z 1; g.globalCompositeOperation 1; createLinearGradient( 2; createRadialGradient( 3; Path2D 50; g.setTransform( 1; g.getTransform( 1; globalThis/self/window/document 2; anim.clamp (destructured) 1; anim.mix (destructured) 1; anim.span (destructured) 1; anim.hash (destructured) 1; anim.noise (destructured) 1; layer opt pivot (written inline) 2; layer opt box (written inline) 2; layer opt flicker (written inline) 1; layer opt shimmer (written inline) 1 |
| Вокруг света | beats.js | scene.sequence( 1; scene.get( 1; scene.cut( 3; scene.shot( 1; scene.tell( 2; opt name: (sequence) 1; scene.on('change') 1 |
| Вокруг света | cast.js | e.point( 6 |
| Вокруг света | svet.js | e.light( 1; anim (any use) 5; createRadialGradient( 1; anim.clamp 3; anim.span 1; anim.ease 1; ease smooth 1 |
| Алые паруса | beats.js | scene.sequence( 1; scene.get( 1; scene.cut( 3; scene.shot( 1; scene.tell( 2; opt name: (sequence) 1; scene.on('change') 1 |
| Алые паруса | cast.js | e.point( 7; MooodShapes 1 |
| Алые паруса | korabli.js | e.layer( 5; e.light( 6; e.at( 12; e.uniform( 3; e.glow( 5; e.where( 1; e.state 4; e.mem 1; e.id 2; e.kit / scene.kit / kit. 1; anim (any use) 5; layer.alpha 1; layer(…).y 1; scene.move( 1; scene.every( 1; scene.random( 1; opt ease: 1; opt over: 1; opt speed: 1; fade (key) 1; createLinearGradient( 2; createRadialGradient( 1; g.clip( 4; anim.hash 4; anim.clamp (destructured) 1; anim.mix (destructured) 1; anim.ease (destructured) 1; ease inOut 2; layer opt pivot (written inline) 1; layer opt wind (written inline) 1; layer opt box (written inline) 2; layer opt depth (written inline) 1 |
| Алые паруса | nebo.js | e.layer( 4; e.light( 2; e.at( 2; e.uniform( 13; e.glow( 2; e.state 3; e.aspect 1; anim (any use) 20; scene.set( 1; scene.get( 1; createRadialGradient( 1; anim.clamp 12; anim.span 4; anim.ease 2; anim.hash 2; ease inOut 2; scene.on('change') 1; scene.on('move') 1; layer opt box (written inline) 3 |
| Ночь | beats.js | scene.sequence( 1; scene.get( 1; scene.cut( 3; scene.shot( 1; scene.tell( 2; opt name: (sequence) 1; scene.on('change') 1 |
| Ночь | cast.js | e.point( 1; MooodShapes 31 |
| Хризалиды | beats.js | scene.sequence( 1; scene.get( 1; scene.cut( 3; scene.shot( 1; scene.tell( 2; opt name: (sequence) 1; scene.on('change') 1 |
| Хризалиды | cast.js | MooodShapes 16 |
| Хризалиды | chrysalids.js | e.layer( 15; e.at( 2; e.speed( 3; e.state 1; e.t 1; e.dt 1; e.cut (seconds since the cut) 1; e.mem 1; e.id 1; anim (any use) 1; layer.rotate 5; layer.alpha 10; layer.brightness 1; layer.scale 2; layer.scaleX 1; layer.scaleY 1; opt name: (sequence) 3; Path2D 3; g.clip( 1; anim.clamp (destructured) 1; anim.noise (destructured) 1; anim.hash (destructured) 1; layer opt pivot (written inline) 5; layer opt depth (written inline) 4; layer opt box (written inline) 5 |

### 1.3 Words that exist in the language and that NO scene uses

Zero in all 20 scenes and in their worlds' modules (scene.json parsed; code matched by name with comments removed —
a textual zero is firm). Where a word is used once or twice it is named in 1.4, not here.

| Area | Unused |
|---|---|
| Top level | `widgets` — no scene has a widget, so every widget field (`html`, `width`, `height`, `x`, `y`, `follow`, `lift`, `anchor`, `interactive`, `at`, `for`) and the widgets' global `MooodState` (`.get`, `.set`, `.on`, `.all()`, `.states`, `.act`, `.signal`) are unused; no `widgets/` folder exists in any repo |
| Camera | modes `overhead`, `platform`; fields `hero`, `jump`, `height`, `follow`; the key `camera_on` (the field `camera.on` is used once) |
| Light | `brightness` in the base light (2 looks set it); `vignette`, `grain` inside a look |
| `lights` | `x` (a light placed by a stage x) |
| Element | `bearing`, `y`, `color`, `script` (an element's own script — no `*.script.js` exists), `travel`, `solid` (and the hero's `width`), `clip.outside`, `seen: "direct"`, `seen: [ids]`, `redraw` as a list, `reflect: true` and `reflect` as a number (always an object), `glass` as a number, `lit` as a number |
| Particles | kinds `petals`, `bubbles`; fields `flat`, `streak`, `lit`, `bounce`, `onto`; `at` as `{on, at}`; shapes named in a spec: only `dot` and `puff` (the others come only as a kind's default; `petal`, `ring` not at all); `ground: "bounce"` and `blend: "add"` only as kinds' defaults |
| `directions` | `excludes` |
| Painting's `e` | `e.debug`; `e.warn` (twice, in the module ushers.js only) |
| Layer options | `blend: "screen"`, `blend: "normal"`; `wind` as a plain number is rare (1878 of 1880 wind layers give `{strength, gust, scale}`) |
| Animate's `e` | `e.was`, `e.hero`, `e.burst`, `e.debug` |
| Scripts | `s.event`, `s.any`, `scene.signal`, `action.pause()` / `.resume()`, `scene.light(id).fade`, `scene.say`, `scene.hero()`, `scene.warn`, `scene.ground`, `{queue: true}`, `s.self`; `scene.on` of `'action'`, `'line'`, `'signal'`, `'tell'` |
| People | `.mood()`, `.talk()`, the keys `<id>_mood`, `<id>_talk`; a body (`bodies`, `outfits`, a body's garments — all 76 characters of the five casts are figures of shapes); `F.cloth`, `F.keep`, `F.shell`, `F.worn` in a cast's `draw` |
| `anim` | `easeOf`, `turn`, `joint`, `blend`; easings `spring`, `anticipate` |
| Platformer | all of it (`solid`, `width`, `jump`, `e.hero`, `scene.hero()`) |

Every shader name the language's text gives (`layer`, `emission`, `u_time`, `cycle`, `noise1`, `noise2`, `noise3`,
`hash1`, `wobble`, `wobble2`, `luma`, `PI`) is used by at least one text; `noise3` by one (Полёт's sky), the parameter
`uv` by one (Полёт's glints).

### 1.4 Words used once or twice (each use named)

| Word | Uses |
|---|---|
| camera `on` | paluba (`"on": "ship"`) |
| camera mode `around` (+ `turn`) | Полёт |
| `seen: "reflection"` | Ашеры main `vision` |
| `clip.inside` | padenie-doma-2 (`house`, `house_mirror`) |
| `shadow: false` | sklep, a person |
| `glass: true` | dom-longrena ×2 (the other five panes give `{strength, blur}`) |
| particles `veil` | Полёт `blizzard_snow` (600) |
| particles `around: false`, `ground: "splash"` | burya `rain_in` (rain as an emitter) |
| particles `frames`, `blink` | gavan `gulls` |
| particles `tumble` | Полёт `hat_off` |
| particles `settle` | burya `grit` |
| particles kind `snow` | Полёт |
| a sprite painted by code | gavan `gulls`, Полёт `hat_off` |
| lights' `place` (`bearing`, `height`; `across`) | les-u-morya (sun, moon); burya (two lights on `hall_x`) |
| `e.where` | korabli.js `rigMotion` (main, dom-longrena) |
| `e.point` | 4 sites: burya book, dzhungli procession, Диканька stars and moon |
| `e.spot` | Полёт `firs`, `lamps`; ushers.js horse |
| `e.cut` | dom-longrena close-up, zamok-greev canvas, chrysalids.js |
| `e.ground` | les-u-morya stones, АП main (kaperna, lib) |
| `scene.was` | padenie-doma-2 script ×2 |
| `scene.prepare` | iz-okna-poezda script |
| `.say(` | sevil-rou showcase ×2 |
| `.still(` | medlin-prokhodit ×2 |
| `action.finish()` | medlin-prokhodit lib.js:723 |
| `scene.on('arrived')` | gavan; `'cut'` — iz-okna-poezda, paluba; `'load'` — 3 scenes |
| `scene.turn(key, …)` | Ашеры main ×2 (`rider_face`), Диканька (`broom_turn`) |
| ease `'back'` | burya lib.js:1020 |
| `fade_color` | Насыпь lib.js:288, 1007 |
| `person.look` on an element | Ашеры main (a hat), sevil-rou (3 passers-by with a whole look) |
| opt `going:` | 2 scenes, 2 uses |
| `captions` | Ашеры main, komnata-roderika, padenie-doma-2 (one line each) |
| `directions` | komnata-roderika 1, padenie-doma-2 1, Диканька 3, Полёт 2 |

### 1.5 Words the scenes use that the language's text (artist2.md) does not name

| Used | Where | Note |
|---|---|---|
| `light.people`, a look's `people` | Ашеры main, padenie-doma-2 | named in docs/worlds/people.md:231-237 and core/light.js:31, not in artist2.md's schema |
| GLSL `srgbToLinear` | 10 shader texts (14 files) | the engine's (render/glsl/common.js:37) |
| GLSL `fwidth` | 10 texts (14 files) | a derivative of the device's shader language |
| `hash1(vec3)`, `hash1(vec2)`, `hash1(uint)` | 16 texts | overloads of common.js:43-45; `uint` in one text (the herd) |
| GLSL arrays, `const` arrays, `for` loops with `break`/`continue` | 9 texts with loops; arrays in 3 | GLSL ES 3.0 |
| `layer(0, …)` re-reading the painting at another point | sailcloth (33 files), burya curtain | named in artist2.md:108 (k 0) |
| `OffscreenCanvas`, `ImageData`, `putImageData`, `getImageData`, `g.drawImage` | closeups.js | artist2.md:85 says "no reading pixels back" |
| `DOMMatrix`, `Path2D` (+ `addPath`), `g.getTransform()`, `g.setTransform()` | ushers.js, closeups.js, chrysalids.js | Canvas 2D beyond what the text lists |
| `g.filter = "blur(…px)"` | 3 scenes + closeups.js (recorded in 13 paintings of 4 scenes) | "filters (their lengths are your units)" is in the text; the scenes disagree on the unit (6.2) |
| `g.globalCompositeOperation` `destination-out`, `lighter` | Ашеры main, padenie-doma-2 (holes), ushers.js | "composite modes" are in the text |
| `g.fillText`, `g.measureText`, `g.font` | treshchina, dom-longrena (insert), 2 others | "text" is in the text; layout depends on the machine's fonts |
| the global `MooodShapes.V` in cast modules | 4 casts | named in people.md:133, 171 |
| `scene.startOf(id, motion, turn)` | burya, dom-longrena (and `person.startOf` in 2) | people.md:96 names it `stage.startOf` |
| reading `e.layer(name).scaleX` to learn whether a layer exists | closeups.js, ushers.js, 3 scenes | a property of the present handle (6.1) |

### 1.6 People, cloth, motions (from the casts and scene.json; appendix A6 `people.mjs`)

| World | Characters in the cast | Style (the engine's base) | Motions in cast.data.json (seconds) | Named by the scenes | Garments that hang | Parts (`draw(F)`) | cast.data.json |
|---|---|---|---|---|---|---|---|
| Ашеры | 5 | `usher` from `shadow` (silhouettes rimmed by the light) | 61 (294 s) | 61 ¹ | 2 (`gown`, `shroud` — ragged) | 5; one with a named point | 7.3 MB |
| Вокруг света | 17 | `vokrug` from `flat` | 32 (214 s) | 32 ¹ | 2 (`frockcoat`, `sari`) | 18 | 5.3 MB |
| Алые паруса | 23 | `parusa` from `flat`, line 0.8 | 43 (285 s) | 43 ¹ | 2 (`frock`, `frockcoat`) | 16 | 7.1 MB |
| Ночь | 19 | `dikanka` from `geometry`, paint `lit` | 54 (276 s) | 15 ¹ | 7 (two with two hangs) | 22 | 6.9 MB |
| Хризалиды | 12 | `chrysalids` from `graphic`, paint `toned`, line 1.1 | 99 (407 s) | 37 | 2 (`longcoat`, `apron_dress`) | 14 | 10.1 MB |

¹ a motion counts as named when its name stands as a quoted string in the scene's code or state — an upper bound
(names like `talk`, `stand` match other strings).

- 102 `person` objects in 19 scenes (treshchina has none); 41 are here when the scene starts. The most: dzhungli 21 (4
  here at the start), Диканька 11 (1), ВС main 9 (6), АП main and paluba 7 each.
- Every person names `cast` and (99 of 102) `who`; 77 give `turn`, 39 `does`, 2 `gait`. All but 2 have `place`.
  11 stand `on` an element by the object's `on` (train 4, paluba 7); 1 says `shadow: false`.
- Every look is a figure of shapes with the face `simple`; no body, no outfit, no `_talk`, no `_mood`.
- "Cloth" in the scenes is a garment's `hang` (15 garments in five casts) and hanging things by `F.swing` (18 uses);
  `F.cloth` is not used.
- Used of a person's state and verbs (T11, T7): `.look` (395 sites, 18 scenes), `.do` (164), `.reach` (148), `.walk`
  (129), `.turn` (117), `.here` (54), `.with` (38), `.go` (37), `.gait` (32), `.on(point)` (18 sites, 5 scenes),
  `.startOf` (4), `.wear` (3), `.still` (2), `.say` (2); keys `_steps` in 4 scenes.
- The "instant" jump of a game to a moment (engine 2's thread and director, gone) has no word in a
  scene: nothing in the 20 scenes names it. What the scenes offer a game is the key `beat`, the keys of their
  mini-games (`progress`, `bank`, `climb` … in Полёт; `run`, `fall`, `swim` in padenie-doma-2; `nail1…3` in
  zamok-greev; `ring_at`, `stir` in les-u-morya; `screw1…4`, `knock`, `answer` in sklep; `strum`, `tempo`, `wild` in
  komnata; `walk`, `resist` in Ашеры main), and what they tell (`beat:<name>`, `<beat>:<moment>`).
- Music: 19 scenes have `music` (not treshchina): 369 prompts in all, 79 with a weight above 0; each gives `bpm`,
  `density`, `brightness`. No scene has a sound of its own beyond that.

### 1.7 Every scene: its words with counts

`word×n` — n uses. "spec", "camera", "light", "lights", "elements", "particles", "people", "state" are from scene.json; "code" lines are textual counts in the scene's own code (not its world's modules — T14); "as painted" is the probe.

#### 1. Ашеры / burya-i-chtenie — «Буря и чтение» (39 files, 2870 lines)

- **spec**: camera×1, caption×1, engine×1, horizon×1, lib×1, light×1, lights×1, modules×1, music×1, notes×1, objects×1, script×1, showcase×1, state×1, states×1, title×1
- **camera**: camera.mode×1, camera.mode=picture×1
- **light**: light.ambient×1, light.ambientColor×1, light.bounce×1, light.grain×1, light.haze×1, light.hazeColor×1, light.hazeGlow×1, light.looks(entry)×4, light.shafts×1, light.tint×1, light.tintStrength×1, light.vignette×1, light.wind×1; looks: look.ambient×1, look.ambientColor×1, look.tint×1, look.tintStrength×1, look.wind×2
- **lights**: lights:kind=at(person point)×1, lights:kind=from[bearing,height]×2, lights:kind=of×2, lights:kind=point×3, lights.across×3, lights.at×1, lights.color×7, lights.distance×3, lights.elevation×3, lights.flicker×5, lights.from×2, lights.glow×3, lights.id×8, lights.of×2, lights.on×8, lights.place×2, lights.place.across×2, lights.reach×6, lights.size×2, lights.strength×8, lights.through×2, lights.through:polygon×2
- **elements**: kind=card×17, kind=insert×1, kind=particles×7, kind=person×3, kind=plane×3, kind=sky×1; fields: across×25, animate×9, box×17, code×22, depth×3, distance×25, elevation×7, facing×3, flicker×1, glows×3, height×17, id×32, insert×1, name×32, on×2, particles×7, person×3, place×6, place.across×3, place.distance×3, place.facing×3, plane×3, redraw×1, redraw=steps×1, shader×3, shadow×9, shadow.light×2, shadow.onto×6, shadow.soft×6, shadow.strength×6, shadow=object×6, shadow=true×3, sky×1, translucent×3, translucent(value)×3, uniforms×3, width×3, uniform(declared)×7
- **particles**: amount×4, amount=state key×4, area×2, around×1, at×3, at=[a,d,e]×3, burst×1, burst.count×1, burst.on×1, burst.over×1, color×1, count×2, direction×2, drag×2, fade×1, gravity×2, ground×2, ground=splash×1, ground=stop×1, gust×1, kind×7, kind=drops×2, kind=dust×1, kind=puff×1, kind=rain×3, life×2, opacity×1, rate×5, reach×2, settle×1, shadow×1, shape×1, shape=dot×1, size×1, soft×1, source×5, speed×2, spread×2, turbulence×1
- **people**: person.cast×3, person.does×2, person.turn×3, person.who×3, state:<person>_do×3, state:<person>_gait×3, state:<person>_here×3, state:<person>_look×3, state:<person>_reach×3, state:<person>_turn×3, state:<person>_wear×1, state:<person>_with×2
- **state and the rest**: music.bpm×1, music.brightness×1, music.density×1, music.prompts×1, music.prompts(entry)×20, music.prompts(weight>0)×6, state:camera_h×1, state:camera_x×1, state:fade×1, state(keys)×71, states.means×47, states.range×35, states.smooth×35, states.type×10, states.values×2, states(entry)×47
- **code, painting/animate (textual)**: anim (any use)×6, anim.clamp (destructured)×1, anim.hash (destructured)×1, anim.noise×3, anim.noise (destructured)×1, createLinearGradient(×8, createRadialGradient(×4, e.area×1, e.aspect×1, e.at(×5, e.dt×6, e.glow(×1, e.kit / scene.kit / kit.×5, e.layer(×18, e.lib / scene.lib×34, e.light(×1, e.mem×5, e.point(×1, e.rnd(×46, e.speed(×1, e.state×15, e.t×5, e.uniform(×6, ease back×1, ease in×7, ease inOut×11, ease linear×3, ease out×11, evenodd×1, g.clip(×6, g.filter×3, layer blend "add"×2, layer opt blend (written inline)×2, layer opt pivot (written inline)×2, layer opt shimmer (written inline)×1, layer opt wind (written inline)×1, layer.alpha×7, layer.rotate×1, layer.scaleX×1, layer.scaleY×1, Path2D×14
- **code, scripts/director (textual)**: .do(×11, .gait(×3, .go(×9, .here(×4, .look(×30, .reach(×20, .startOf(×1, .turn(×16, .walk(×15, .with(×3, action.ending(×1, action.remaining×2, camera_h×3, camera_x×3, fade (key)×8, opt ease:×33, opt loop:×10, opt name: (sequence)×5, opt over:×48, s.all(×3, s.until(×1, s.wait(×88, scene.after(×1, scene.cut(×5, scene.every(×2, scene.get(×15, scene.move(×49, scene.on('change')×8, scene.on('move')×1, scene.person(×33, scene.random(×1, scene.sequence(×8, scene.set(×8, scene.shot(×2, scene.state×8, scene.time×3
- **as painted (probe)**: e.at points painted×4, elements marking e.at×4, elements painting e.light×1, elements with layers×5, layer blend=add×2, layer opt blend×2, layer opt pivot×2, layer opt shimmer×1, layer opt wind×1, layer wind as {strength,gust,scale}×1, layer with no option×9, layers×12, recorded filter×2, recorded path2d×10, recorded style:linear×6, recorded style:radial×6

#### 2. Ашеры / komnata-roderika — «Комната Родерика» (27 files, 2503 lines)

- **spec**: camera×1, caption×1, captions×1, directions×1, engine×1, horizon×1, lib×1, light×1, lights×1, modules×1, music×1, notes×1, objects×1, script×1, showcase×1, state×1, states×1, title×1
- **camera**: camera.mode×1, camera.mode=picture×1
- **light**: light.ambient×1, light.ambientColor×1, light.bounce×1, light.grain×1, light.haze×1, light.hazeColor×1, light.hazeGlow×1, light.looks(entry)×5, light.shafts×1, light.tint×1, light.tintStrength×1, light.vignette×1, light.wind×1; looks: look.ambient×2, look.ambientColor×1, look.tint×1, look.tintStrength×2, look.wind×1
- **lights**: lights:kind=from[bearing,height]×2, lights:kind=of×5, lights:kind=point×2, lights.across×2, lights.color×9, lights.distance×2, lights.elevation×2, lights.from×2, lights.id×9, lights.of×5, lights.on×4, lights.reach×7, lights.size×2, lights.soft×2, lights.strength×9, lights.through×2, lights.through:polygon+polygon+polygon×2
- **elements**: kind=card×11, kind=insert×1, kind=particles×3, kind=person×3, kind=plane×1, kind=sky×1; fields: across×16, animate×6, box×11, code×14, depth×1, distance×16, elevation×2, facing×5, glows×1, height×11, id×20, insert×1, name×20, particles×3, person×3, place×3, place.across×3, place.distance×3, plane×1, redraw×1, redraw=steps×1, shader×2, shadow×7, shadow.onto×4, shadow.soft×4, shadow=object×4, shadow=true×3, sky×1, translucent×1, translucent(value)×1, uniforms×2, width×1, uniform(declared)×8
- **particles**: amount×2, amount=state key×2, at×2, at=ref string×2, kind×3, kind=dust×1, kind=smoke×2, life×2, opacity×2, rate×2, shadow×2, size×2, source×1, speed×2, swirl×2, turbulence×2, wind×2
- **people**: person.cast×3, person.does×1, person.turn×3, person.who×3, state:<person>_here×1
- **state and the rest**: captions.at×1, captions.for×1, captions.text×1, directions.key×1, directions.name×1, music.bpm×1, music.brightness×1, music.density×1, music.prompts×1, music.prompts(entry)×20, music.prompts(weight>0)×4, state:fade×1, state(keys)×29, states.means×27, states.range×18, states.smooth×23, states.type×8, states.values×1, states(entry)×27
- **code, painting/animate (textual)**: anim (any use)×6, anim.clamp (destructured)×2, anim.mix (destructured)×5, anim.span (destructured)×4, createLinearGradient(×20, createRadialGradient(×6, e.aspect×1, e.at(×6, e.glow(×2, e.kit / scene.kit / kit.×5, e.layer(×20, e.lib / scene.lib×19, e.light(×5, e.rnd(×20, e.speed(×1, e.state×13, e.t×2, e.uniform(×4, ease in×3, ease out×1, evenodd×2, g.clip(×11, g.filter×1, layer blend "multiply"×1, layer opt blend (written inline)×1, layer opt depth (written inline)×4, layer opt pivot (written inline)×4, layer opt wind (written inline)×2, layer.alpha×2, layer.brightness×2, layer.rotate×1, layer.scaleX×4, layer(…).y×1, Path2D×16
- **code, scripts/director (textual)**: .do(×11, .go(×3, .here(×1, .look(×10, .reach(×4, .turn(×3, .walk(×3, .with(×2, camera_h×2, camera_look×2, camera_x×2, camera_z×2, fade (key)×9, opt ease:×5, opt loop:×9, opt over:×19, s.all(×6, s.wait(×32, scene.cut(×4, scene.get(×4, scene.move(×24, scene.on('change')×1, scene.on('move')×1, scene.person(×23, scene.sequence(×3, scene.set(×4, scene.shot(×7, scene.state×1, scene.tell(×1
- **as painted (probe)**: e.at points painted×10, elements marking e.at×5, elements painting e.light×2, elements with layers×5, layer blend=multiply×2, layer opt blend×2, layer opt depth×4, layer opt pivot×7, layer opt wind×4, layer wind as {strength,gust,scale}×4, layer with no option×5, layers×15, recorded filter×1, recorded path2d×15, recorded style:linear×14, recorded style:radial×5

#### 3. Ашеры / main — «Подъезд к дому» (34 files, 1737 lines)

- **spec**: camera×1, caption×1, captions×1, engine×1, horizon×1, lib×1, light×1, lights×1, modules×1, music×1, notes×1, objects×1, script×1, showcase×1, state×1, states×1, title×1
- **camera**: camera.mode×1, camera.mode=picture×1
- **light**: light.ambientColor×1, light.grain×1, light.haze×1, light.hazeColor×1, light.hazeGlow×1, light.looks(entry)×2, light.people×1, light.tint×1, light.tintStrength×1, light.vignette×1; looks: look.brightness×1, look.haze×1, look.people×1, look.saturation×1, look.tintStrength×1
- **lights**: lights:kind=from[bearing,height]×1, lights:kind=point×1, lights.across×1, lights.color×2, lights.distance×1, lights.elevation×1, lights.from×1, lights.id×2, lights.on×2, lights.reach×1, lights.strength×2
- **elements**: kind=card×14, kind=insert×1, kind=person×2, kind=plane×3, kind=sky×2; fields: across×19, animate×9, box×14, code×20, depth×3, distance×19, elevation×9, height×14, id×22, inFront×2, insert×1, name×22, person×2, place×3, place.across×3, place.distance×3, plane×3, reflect×1, reflect.blur×1, reflect.fade×1, reflect.ripple×1, reflect.rough×1, reflect.strength×1, reflect=object×1, seen×1, seen=reflection×1, shadow×3, shadow=true×3, sky×2, walk×1, width×3
- **particles**: —
- **people**: person.cast×2, person.gait×1, person.look×1, person.look.hat×1, person.turn×2, person.who×2, state:<person>_do×1, state:<person>_here×1, state:<person>_look×1, state:<person>_on×1, state:<person>_turn×1
- **state and the rest**: captions.at×1, captions.for×1, captions.text×1, music.bpm×1, music.brightness×1, music.density×1, music.prompts×1, music.prompts(entry)×20, music.prompts(weight>0)×4, state(keys)×30, states.means×21, states.range×15, states.smooth×11, states.type×6, states(entry)×21
- **code, painting/animate (textual)**: anim (any use)×2, anim.drift×2, createLinearGradient(×13, createRadialGradient(×7, e.aspect×2, e.at(×3, e.glow(×3, e.kit / scene.kit / kit.×6, e.layer(×34, e.lib / scene.lib×32, e.light(×19, e.rnd(×8, e.state×31, e.t×2, ease in×6, ease inOut×15, ease linear×1, ease out×8, g.clip(×3, g.globalCompositeOperation×1, layer opt box (written inline)×4, layer opt drift (written inline)×4, layer opt pivot (written inline)×6, layer opt wind (written inline)×3, layer.alpha×8, layer.rotate×2, layer.scaleX×6
- **code, scripts/director (textual)**: .do(×1, .gait(×1, .go(×1, .look(×10, .reach(×2, .turn(×7, .walk(×14, action.cancel(×1, action.duration×1, action.ending(×1, action.remaining×1, camera_h×6, camera_look×10, camera_pitch×1, camera_target×4, camera_x×10, camera_z×15, fade (key)×10, opt ease:×30, opt loop:×3, opt over:×39, s.all(×11, s.wait(×36, scene.camera(×5, scene.cut(×4, scene.get(×6, scene.move(×37, scene.on('change')×4, scene.on('load')×1, scene.on('move')×2, scene.path(×4, scene.person(×16, scene.set(×11, scene.shot(×3
- **as painted (probe)**: e.at points painted×1, elements marking e.at×1, elements painting e.light×3, elements with layers×13, layer opt box×150, layer opt drift×8, layer opt pivot×172, layer opt shimmer×1, layer opt wind×22, layer painting nothing×5, layer wind as {strength,gust,scale}×22, layer with no option×24, layers×204, paintings making an OffscreenCanvas×1, recorded composite:destination-out×1, recorded filter×2, recorded image×2, recorded path2d×95, recorded style:linear×108, recorded style:radial×57

#### 4. Ашеры / medlin-prokhodit — «Мэдлин проходит» (215 files, 5759 lines)

- **spec**: camera×1, caption×1, engine×1, horizon×1, lib×1, light×1, lights×1, modules×1, music×1, notes×1, objects×1, script×1, showcase×1, state×1, states×1, title×1
- **camera**: camera.mode×1, camera.mode=picture×1
- **light**: light.ambient×1, light.ambientColor×1, light.bounce×1, light.grain×1, light.haze×1, light.hazeColor×1, light.hazeGlow×1, light.looks(entry)×1, light.saturation×1, light.shafts×1, light.tint×1, light.tintStrength×1, light.vignette×1; looks: look.ambientColor×1, look.hazeColor×1, look.lights×1, look.lights(entry)×1, look.shafts×1, look.tint×1
- **lights**: lights:kind=from[bearing,height]×2, lights:kind=of×1, lights.color×2, lights.flicker×1, lights.from×2, lights.glow×1, lights.id×3, lights.of×1, lights.on×3, lights.reach×1, lights.soft×2, lights.strength×3, lights.through×2, lights.through:polygon+polygon+polygon+polygon+polygon+polygon+polygon+polygon+polygon+polygon+polygon+polygon+polygon+polygon+polygon+polygon×2
- **elements**: kind=card×199, kind=insert×1, kind=particles×1, kind=person×4, kind=plane×6; fields: across×209, animate×3, box×199, code×206, depth×6, distance×209, elevation×143, facing×198, flicker×1, glows×2, height×199, id×211, insert×1, name×211, particles×1, person×4, place×4, place.across×4, place.distance×4, plane×6, redraw×2, redraw=steps×2, reflect×1, reflect.blur×1, reflect.fade×1, reflect.rough×1, reflect.strength×1, reflect=object×1, shader×1, shadow×4, shadow=true×4, tilt×139, uniforms×1, width×6, uniform(declared)×2
- **particles**: at×1, at=[a,d,e]×1, kind×1, kind=dust×1, life×1, rate×1, source×1
- **people**: person.cast×4, person.does×1, person.gait×1, person.turn×4, person.who×4, state:<person>_here×1, state:<person>_turn×3
- **state and the rest**: music.bpm×1, music.brightness×1, music.density×1, music.prompts×1, music.prompts(entry)×20, music.prompts(weight>0)×4, state:camera_x×1, state:camera_z×1, state:fade×1, state(keys)×27, states.means×14, states.range×12, states.smooth×8, states.type×1, states.values×1, states(entry)×14
- **code, painting/animate (textual)**: anim (any use)×1, createLinearGradient(×2, createRadialGradient(×3, e.at(×3, e.dt×1, e.id×3, e.kit / scene.kit / kit.×4, e.layer(×4, e.lib / scene.lib×213, e.light(×1, e.mem×1, e.rnd(×8, e.state×7, e.uniform(×2, ease in×1, ease inOut×10, ease out×3, evenodd×3, g.clip(×5, layer blend "add"×1, layer opt blend (written inline)×1, layer opt pivot (written inline)×1, layer.rotate×1, layer.scaleX×1, layer.scaleY×1
- **code, scripts/director (textual)**: .do(×6, .go(×1, .here(×3, .look(×17, .reach(×1, .still(×2, .turn(×6, .walk(×12, action.cancel(×1, action.ending(×1, action.finish(×1, camera_x×8, camera_z×12, fade (key)×6, opt ease:×14, opt loop:×3, opt over:×16, s.all(×4, s.until(×4, s.wait(×40, scene.cut(×5, scene.move(×15, scene.path(×1, scene.person(×39, scene.sequence(×9, scene.set(×4, scene.shot(×5, scene.state×4, scene.tell(×1
- **as painted (probe)**: e.at points painted×0, elements painting e.light×1, elements with layers×2, layer blend=add×1, layer opt blend×1, layer opt pivot×1, layer with no option×2, layers×3, recorded style:linear×18, recorded style:radial×56

#### 5. Ашеры / padenie-doma-2 — «Падение дома» (25 files, 1871 lines)

- **spec**: camera×1, caption×1, captions×1, directions×1, engine×1, horizon×1, lib×1, light×1, lights×1, modules×1, music×1, notes×1, objects×1, script×1, showcase×1, state×1, states×1, title×1
- **camera**: camera.mode×1, camera.mode=picture×1
- **light**: light.ambientColor×1, light.grain×1, light.haze×1, light.hazeColor×1, light.looks(entry)×1, light.people×1, light.vignette×1, light.wind×1; looks: look.wind×1
- **lights**: lights:kind=from[bearing,height]×2, lights:kind=of×1, lights.color×2, lights.from×2, lights.id×3, lights.of×1, lights.on×3, lights.reach×1, lights.strength×2
- **elements**: kind=card×7, kind=particles×5, kind=person×3, kind=plane×3, kind=sky×1; fields: across×10, animate×6, box×7, clip×2, clip.inside×2, code×11, depth×3, distance×15, elevation×4, height×7, id×19, name×19, particles×5, person×3, place×6, place.across×6, place.distance×6, plane×3, redraw×2, redraw=steps×2, rotation×1, shader×3, shadow×3, shadow=true×3, sky×1, uniforms×3, unseen×2, width×3, x×5, uniform(declared)×11
- **particles**: amount×5, amount=state key×5, at×3, at=[a,d,e]×3, blend×2, blend=over×2, burst×5, color×5, direction×2, drag×1, glow×2, gravity×3, ground×3, ground=pass×3, kind×5, kind=puff×1, kind=sparks×2, kind=splashes×2, life×4, opacity×3, rate×5, shape×3, shape=dot×2, shape=puff×1, size×5, soft×2, source×5, speed×5, spin×1, spread×4, wind×1
- **people**: person.cast×3, person.does×1, person.turn×3, person.who×3, state:<person>_do×3, state:<person>_here×3
- **state and the rest**: captions.at×1, captions.for×1, captions.text×1, directions.key×1, directions.name×1, music.bpm×1, music.brightness×1, music.density×1, music.prompts×1, music.prompts(entry)×21, music.prompts(weight>0)×5, state:camera_h×1, state:camera_look×1, state:camera_x×1, state:camera_z×1, state:fade×1, state(keys)×38, states.means×30, states.range×14, states.smooth×13, states.type×16, states(entry)×30
- **code, painting/animate (textual)**: anim (any use)×3, anim.clamp (destructured)×1, anim.noise×2, createLinearGradient(×7, createRadialGradient(×7, e.area×1, e.aspect×4, e.at(×8, e.dt×1, e.glow(×2, e.kit / scene.kit / kit.×3, e.layer(×25, e.lib / scene.lib×20, e.light(×4, e.mem×1, e.state×15, e.t×2, e.uniform(×10, ease in×2, ease inOut×21, ease linear×1, ease out×9, g.clip(×4, g.globalCompositeOperation×2, layer blend "add"×2, layer opt blend (written inline)×2, layer opt box (written inline)×4, layer opt drift (written inline)×1, layer opt pivot (written inline)×5, layer opt shimmer (written inline)×1, layer opt wind (written inline)×1, layer.alpha×4, layer.rotate×1
- **code, scripts/director (textual)**: .do(×2, .gait(×1, .go(×2, .look(×8, .reach(×2, .turn(×5, .walk(×9, camera_h×3, camera_look×3, camera_x×2, camera_z×5, fade (key)×14, opt ease:×33, opt gait:×2, opt going:×1, opt loop:×1, opt over:×34, s.all(×2, s.until(×1, s.wait(×23, scene.every(×3, scene.get(×16, scene.move(×34, scene.on('change')×6, scene.on('load')×1, scene.on('move')×1, scene.person(×12, scene.sequence(×3, scene.set(×13, scene.state×4, scene.tell(×1, scene.time×2, scene.was( (no e.was in any animate)×2
- **as painted (probe)**: e.at points painted×0, elements painting e.light×2, elements with layers×7, layer blend=add×5, layer opt blend×5, layer opt box×17, layer opt drift×1, layer opt pivot×29, layer opt shimmer×1, layer opt wind×16, layer wind as {strength,gust,scale}×16, layer with no option×8, layers×44, recorded composite:destination-out×1, recorded path2d×1, recorded style:linear×14, recorded style:radial×11

#### 6. Ашеры / sklep — «Склеп» (35 files, 2636 lines)

- **spec**: camera×1, caption×1, engine×1, horizon×1, lib×1, light×1, lights×1, modules×1, music×1, notes×1, objects×1, script×1, showcase×1, state×1, states×1, title×1
- **camera**: camera.mode×1, camera.mode=picture×1
- **light**: light.ambient×1, light.ambientColor×1, light.bounce×1, light.grain×1, light.haze×1, light.hazeColor×1, light.hazeGlow×1, light.tint×1, light.tintStrength×1, light.vignette×1; looks: —
- **lights**: lights:kind=at(person point)×1, lights:kind=of×1, lights.at×1, lights.color×2, lights.flicker×2, lights.glow×1, lights.id×2, lights.of×1, lights.on×2, lights.reach×2, lights.strength×2
- **elements**: kind=card×15, kind=insert×3, kind=particles×3, kind=person×3, kind=plane×5, kind=sky×1, kind=unseen×1; fields: across×13, animate×4, box×16, code×24, depth×5, distance×20, elevation×7, facing×13, flicker×1, height×16, id×31, insert×3, name×31, on×7, particles×3, person×3, place×5, place.across×4, place.distance×3, place.elevation×2, place.facing×2, plane×5, shader×2, shadow×10, shadow=false×1, shadow=true×9, sky×1, uniforms×2, unseen×1, width×5, x×6, uniform(declared)×15
- **particles**: amount×3, amount=state key×3, at×3, at=ref string×3, kind×3, kind=embers×1, kind=fire×2, life×2, rate×3, size×3, source×2
- **people**: person.cast×3, person.does×2, person.turn×3, person.who×3, state:<person>_do×3, state:<person>_gait×2, state:<person>_here×1, state:<person>_look×2, state:<person>_on×1, state:<person>_reach×3, state:<person>_turn×2, state:<person>_with×1
- **state and the rest**: music.bpm×1, music.brightness×1, music.density×1, music.prompts×1, music.prompts(entry)×20, music.prompts(weight>0)×4, state:camera_h×1, state:camera_look×1, state:camera_x×1, state:camera_z×1, state:fade×1, state(keys)×53, states.means×29, states.range×27, states.smooth×22, states.type×1, states.values×1, states(entry)×29
- **code, painting/animate (textual)**: anim (any use)×14, anim.clamp×3, anim.drift×1, anim.ease×1, anim.hash×2, anim.noise×1, anim.span×2, createLinearGradient(×24, createRadialGradient(×5, e.aspect×1, e.at(×19, e.glow(×2, e.kit / scene.kit / kit.×4, e.layer(×9, e.lib / scene.lib×14, e.light(×3, e.part(×1, e.rnd(×27, e.state×9, e.t×4, e.uniform(×12, ease in×5, ease inOut×14, ease linear×4, ease out×3, evenodd×12, g.clip(×11, g.filter×12, layer opt box (written inline)×7, layer opt drift (written inline)×1, layer.alpha×1
- **code, scripts/director (textual)**: .do(×19, .gait(×6, .here(×1, .look(×18, .reach(×19, .turn(×6, .walk(×5, .with(×1, action.ending(×6, camera_h×2, camera_look×2, camera_x×2, camera_z×4, fade (key)×9, opt ease:×24, opt loop:×9, opt name: (sequence)×1, opt over:×24, s.wait(×70, scene.cut(×8, scene.move(×21, scene.path(×3, scene.person(×18, scene.sequence(×3, scene.set(×3, scene.shot(×1, scene.state×1, scene.tell(×1
- **as painted (probe)**: e.at points painted×17, elements marking e.at×6, elements painting e.light×2, elements with layers×5, elements with parts×1, layer opt box×7, layer opt drift×4, layers×11, part at its own depth (dz≠0)×1, parts×1, recorded filter×8, recorded style:linear×14, recorded style:radial×3

#### 7. Ашеры / treshchina — «Трещина» (11 files, 726 lines)

- **spec**: camera×1, caption×1, engine×1, horizon×1, lib×1, light×1, notes×1, objects×1, showcase×1, state×1, states×1, title×1
- **camera**: camera.mode×1, camera.mode=picture×1
- **light**: light.grain×1, light.vignette×1; looks: —
- **lights**: —
- **elements**: kind=sky×3; fields: animate×2, code×3, id×3, name×3, shader×2, sky×3, uniforms×2, uniform(declared)×4
- **particles**: —
- **people**: —
- **state and the rest**: state(keys)×5, states.means×5, states.range×2, states.smooth×2, states.type×2, states(entry)×5
- **code, painting/animate (textual)**: anim (any use)×11, anim.clamp×4, anim.ease×1, anim.hash×3, anim.noise×3, createLinearGradient(×2, createRadialGradient(×6, e.aspect×3, e.at(×1, e.layer(×6, e.lib / scene.lib×2, e.rnd(×20, e.state×8, e.uniform(×4, ease linear×1, ease smooth×1, fillText(×2, g.clip(×1, g.shadowBlur×3, measureText(×2
- **code, scripts/director (textual)**: opt ease:×1, opt name: (sequence)×3, opt over:×1, s.wait(×1, scene.cut(×2, scene.move(×1, scene.shot(×1
- **as painted (probe)**: e.at points painted×1, elements marking e.at×1, elements with layers×2, layer painting nothing×1, layer with no option×6, layers×6, paintings making an OffscreenCanvas×1, recorded style:linear×1, recorded style:radial×5

#### 8. Вокруг света / dzhungli — «Джунгли» (62 files, 3616 lines)

- **spec**: camera×1, caption×1, engine×1, horizon×1, lib×1, light×1, lights×1, modules×1, music×1, notes×1, objects×1, relief×1, script×1, showcase×1, state×1, states×1, title×1
- **camera**: camera.mode×1, camera.mode=panorama×1, camera.span×1
- **light**: light.ambient×1, light.ambientColor×1, light.grain×1, light.haze×1, light.hazeColor×1, light.hazeGlow×1, light.looks(entry)×2, light.saturation×1, light.shafts×1, light.vignette×1, light.wind×1; looks: look.ambient×1, look.ambientColor×2, look.haze×2, look.hazeColor×2, look.lights×1, look.lights(entry)×1, look.saturation×1, look.shafts×2, look.tint×1, look.tintStrength×1
- **lights**: lights:kind=at(person point)×6, lights:kind=from"sky#point"×2, lights:kind=of×1, lights.at×6, lights.color×8, lights.flicker×7, lights.from×2, lights.id×9, lights.of×1, lights.on×8, lights.reach×7, lights.strength×9
- **elements**: kind=card×38, kind=particles×12, kind=person×21, kind=plane×11, kind=sky×1, kind=unseen×3; fields: across×59, animate×7, box×38, code×48, depth×11, distance×66, drape×1, elevation×27, facing×25, glows×2, height×12, id×86, lit×3, lit=true×3, name×86, on×29, particles×12, person×21, place×21, place.across×21, place.distance×21, plane×11, reflect×2, reflect.blur×2, reflect.fade×2, reflect.ripple×2, reflect.rough×1, reflect.strength×2, reflect=object×2, rotation×1, shader×2, shadow×37, shadow.onto×37, shadow.soft×37, shadow.strength×5, shadow=object×37, sky×1, tilt×10, translucent×3, translucent(value)×3, uniforms×2, unseen×5, walk×3, width×11, uniform(declared)×7
- **particles**: amount×9, amount=state key×9, at×12, at=[a,d,e]×3, at=ref string×9, color×2, colors×1, glow×1, kind×12, kind=dust×1, kind=embers×1, kind=fire×6, kind=fireflies×1, kind=leaves×1, kind=smoke×2, life×3, opacity×1, rate×4, shadow×2, sheer×1, size×10, source×5
- **people**: person.cast×21, person.who×21, state:<person>_here×17
- **state and the rest**: music.bpm×1, music.brightness×1, music.density×1, music.prompts×1, music.prompts(entry)×18, music.prompts(weight>0)×4, state(keys)×70, states.means×11, states.range×9, states.smooth×6, states.type×1, states.values×1, states(entry)×11
- **code, painting/animate (textual)**: anim (any use)×31, anim.clamp×10, anim.ease×3, anim.hash×11, anim.noise×3, anim.span×3, createLinearGradient(×3, createRadialGradient(×2, e.aspect×2, e.at(×15, e.glow(×4, e.ground(×3, e.kit / scene.kit / kit.×3, e.layer(×18, e.lib / scene.lib×64, e.light(×5, e.part(×5, e.point(×1, e.state×10, e.t×1, e.uniform(×7, ease in×1, ease inOut×9, ease linear×1, ease smooth×4, fillText(×1, layer blend "add"×1, layer opt blend (written inline)×1, layer opt box (written inline)×11, layer opt depth (written inline)×1, layer opt drift (written inline)×4, layer opt pivot (written inline)×2, layer opt wind (written inline)×1, layer.alpha×6, layer.brightness×2, layer.rotate×2, layer.scale×1, layer.scaleX×1, layer.scaleY×1
- **code, scripts/director (textual)**: .do(×2, .turn(×4, .walk(×6, camera_h×8, camera_x×10, camera_z×9, opt ease:×11, opt loop:×3, opt over:×17, s.all(×3, s.until(×7, s.wait(×22, scene.after(×5, scene.cut(×3, scene.every(×1, scene.get(×7, scene.move(×17, scene.on('change')×4, scene.on('load')×1, scene.on('move')×1, scene.person(×8, scene.sequence(×2, scene.set(×31, scene.shot(×2, scene.state×8, scene.tell(×9, shot.ready×1
- **as painted (probe)**: e.at points painted×12, elements marking e.at×8, elements painting e.light×4, elements with layers×9, elements with parts×3, layer blend=add×99, layer opt blend×99, layer opt box×387, layer opt depth×279, layer opt drift×4, layer opt pivot×378, layer opt wind×279, layer wind as {strength,gust,scale}×279, layer with no option×1, layers×388, part at its own depth (dz≠0)×83, parts×83, recorded style:linear×75, recorded style:radial×15

#### 9. Вокруг света / gavan — «Гавань» (88 files, 3031 lines)

- **spec**: camera×1, caption×1, engine×1, horizon×1, lib×1, light×1, lights×1, modules×1, music×1, notes×1, objects×1, script×1, showcase×1, state×1, states×1, title×1
- **camera**: camera.mode×1, camera.mode=panorama×1, camera.span×1
- **light**: light.ambient×1, light.ambientColor×1, light.grain×1, light.haze×1, light.hazeColor×1, light.hazeGlow×1, light.inside×1, light.looks(entry)×3, light.saturation×1, light.shafts×1, light.vignette×1, light.wind×1; looks: look.ambient×2, look.ambientColor×2, look.brightness×1, look.haze×3, look.hazeColor×2, look.hazeGlow×1, look.lights×1, look.lights(entry)×1, look.saturation×2, look.shafts×2, look.tint×1, look.tintStrength×1
- **lights**: lights:kind=from"sky#point"×2, lights:kind=of×6, lights.color×2, lights.from×2, lights.id×8, lights.of×6, lights.on×7, lights.reach×6, lights.size×2, lights.strength×5
- **elements**: kind=card×46, kind=particles×2, kind=person×4, kind=plane×12, kind=sky×1, kind=unseen×3; fields: across×54, animate×23, box×47, code×60, depth×12, distance×56, elevation×37, facing×22, glows×1, id×68, inside×1, lit×9, lit=true×9, name×68, on×18, particles×2, person×4, place×6, place.across×6, place.distance×6, place.facing×2, place.tilt×2, plane×12, reflect×2, reflect.blur×2, reflect.fade×2, reflect.ripple×1, reflect.rough×2, reflect.strength×2, reflect=object×2, shadow×4, shadow=true×4, sky×1, tilt×3, translucent×1, translucent(value)×1, unseen×3, width×12
- **particles**: particles: sprite painted by code×1, amount×1, amount=state key×1, at×2, at=[a,d,e]×1, at=ref string×1, blend×1, blend=over×1, blink×1, color×2, drag×2, fade×2, frames×1, glow×1, gravity×2, gust×1, kind×2, kind=fireflies×1, kind=smoke×1, life×2, opacity×2, rate×2, sheer×1, size×2, soft×1, source×2, speed×2, spread×2, swirl×2, turbulence×2, wind×2
- **people**: person.cast×4, person.who×4, state:<person>_here×4
- **state and the rest**: music.bpm×1, music.brightness×1, music.density×1, music.prompts×1, music.prompts(entry)×18, music.prompts(weight>0)×4, state(keys)×28, states.means×24, states.range×16, states.smooth×15, states.type×7, states.values×1, states(entry)×24
- **code, painting/animate (textual)**: anim (any use)×39, anim.clamp×5, anim.ease×8, anim.hash×14, anim.noise×3, anim.span×9, createLinearGradient(×2, e.aspect×2, e.at(×14, e.glow(×14, e.kit / scene.kit / kit.×4, e.layer(×39, e.lib / scene.lib×73, e.light(×11, e.part(×3, e.state×37, e.t×3, ease in×2, ease inOut×12, ease smooth×3, evenodd×1, fillText(×1, layer opt box (written inline)×1, layer opt drift (written inline)×1, layer opt pivot (written inline)×5, layer opt shimmer (written inline)×2, layer opt wind (written inline)×2, layer.alpha×13, layer.rotate×1, layer.scaleX×3, layer.scaleY×2
- **code, scripts/director (textual)**: .do(×2, .go(×1, .look(×18, .reach(×5, .turn(×4, .walk(×2, .with(×4, action.cancel(×2, action.ending(×2, camera_frame×6, camera_glide×1, camera_roll×3, camera_shot×6, camera_shot a number×4, camera_shot wide×1, camera_target×7, camera_x×11, opt ease:×8, opt gait:×1, opt loop:×1, opt over:×10, opt steps:×1, s.until(×3, s.wait(×41, scene.camera(×3, scene.cut(×1, scene.every(×1, scene.get(×17, scene.move(×10, scene.on('arrived')×1, scene.on('change')×6, scene.on('move')×3, scene.person(×11, scene.random(×1, scene.set(×10, scene.shot(×1, scene.tell(×8, shot.ready×1
- **as painted (probe)**: e.at points painted×12, elements marking e.at×10, elements painting e.light×21, elements with layers×23, elements with parts×3, layer opt box×8, layer opt drift×8, layer opt pivot×30, layer opt shimmer×14, layer opt wind×16, layer painting nothing×14, layer wind as {strength,gust,scale}×16, layer with no option×11, layers×63, part at its own depth (dz≠0)×77, parts×77, recorded style:linear×4, recorded style:radial×12

#### 10. Вокруг света / iz-okna-poezda — «Из окна поезда» (40 files, 2520 lines)

- **spec**: camera×1, caption×1, engine×1, horizon×1, lib×1, light×1, lights×1, modules×1, music×1, notes×1, objects×1, relief×1, script×1, showcase×1, state×1, states×1, title×1
- **camera**: camera.mode×1, camera.mode=picture×1
- **light**: light.ambient×1, light.ambientColor×1, light.grain×1, light.haze×1, light.hazeColor×1, light.hazeGlow×1, light.inside×1, light.looks(entry)×3, light.vignette×1; looks: look.ambient×1, look.ambientColor×2, look.haze×1, look.hazeColor×3, look.inside×1, look.saturation×2, look.tint×1, look.tintStrength×1
- **lights**: lights:kind=daylight+of×1, lights:kind=from"sky#point"×2, lights:kind=of×3, lights.color×2, lights.daylight×1, lights.from×2, lights.id×6, lights.of×4, lights.on×5, lights.reach×4, lights.strength×5
- **elements**: kind=card×14, kind=insert×1, kind=person×4, kind=plane×5, kind=sky×1, kind=unseen×2; fields: across×25, animate×8, behind×1, box×14, code×21, depth×5, distance×25, drape×1, elevation×5, facing×2, glass×1, glass.blur×1, glass.strength×1, glass=object×1, height×14, id×27, insert×1, inside×15, lit×3, lit=true×3, name×27, on×16, person×4, place×7, place.across×7, place.distance×4, plane×5, reflect×1, reflect.blur×1, reflect.fade×1, reflect.ripple×1, reflect.rough×1, reflect.strength×1, reflect=object×1, shader×6, shadow×6, shadow.onto×6, shadow.soft×6, shadow.strength×5, shadow=object×6, sky×1, uniforms×6, unseen×2, width×5, uniform(declared)×17
- **particles**: —
- **people**: person.cast×4, person.does×4, person.turn×4, person.who×4, state:<person>_do×4, state:<person>_here×4, state:<person>_look×4, state:<person>_reach×4, state:<person>_turn×4, state:<person>_with×4
- **state and the rest**: music.bpm×1, music.brightness×1, music.density×1, music.prompts×1, music.prompts(entry)×20, music.prompts(weight>0)×4, state:camera_x×1, state(keys)×47, states.means×14, states.range×10, states.smooth×6, states.type×3, states.values×1, states(entry)×14
- **code, painting/animate (textual)**: anim (any use)×26, anim.clamp×5, anim.ease×4, anim.hash×10, anim.mix×1, anim.noise×1, anim.span×5, createLinearGradient(×1, createRadialGradient(×1, e.aspect×3, e.at(×8, e.glow(×3, e.kit / scene.kit / kit.×3, e.layer(×14, e.lib / scene.lib×27, e.light(×7, e.mem×1, e.state×4, e.t×1, e.uniform(×9, e.where(×8, ease in×1, ease linear×2, ease out×2, ease smooth×3, evenodd×1, layer blend "multiply"×1, layer opt blend (written inline)×1, layer opt box (written inline)×4, layer opt flicker (written inline)×1, layer opt pivot (written inline)×2, layer.rotate×2, layer(…).y×1
- **code, scripts/director (textual)**: .do(×5, .go(×3, .here(×6, .look(×27, .reach(×3, .startOf(×1, .turn(×2, .walk(×1, .with(×4, action.cancel(×1, camera_h×1, camera_x×9, camera_z×1, opt ease:×4, opt loop:×7, opt over:×4, opt speed:×6, s.until(×5, s.wait(×43, scene.cut(×7, scene.every(×1, scene.get(×2, scene.move(×4, scene.on('change')×4, scene.on('cut')×1, scene.on('move')×1, scene.person(×21, scene.prepare(×1, scene.set(×3, scene.shot(×9, scene.tell(×8, shot.ready×5
- **as painted (probe)**: e.at points painted×8, elements marking e.at×5, elements painting e.light×6, elements with layers×7, layer blend=multiply×1, layer opt blend×1, layer opt box×4, layer opt flicker×1, layer opt pivot×2, layer with no option×7, layers×11, recorded style:linear×1, recorded style:radial×1

#### 11. Вокруг света / main — «Реформ-клуб» (54 files, 2320 lines)

- **spec**: camera×1, caption×1, engine×1, horizon×1, lib×1, light×1, lights×1, modules×1, music×1, notes×1, objects×1, script×1, showcase×1, state×1, states×1, title×1
- **camera**: camera.mode×1, camera.mode=picture×1
- **light**: light.ambient×1, light.ambientColor×1, light.grain×1, light.haze×1, light.hazeColor×1, light.hazeGlow×1, light.looks(entry)×1, light.vignette×1; looks: look.ambient×1, look.ambientColor×1, look.saturation×1
- **lights**: lights:kind=of×6, lights:kind=point×3, lights.across×3, lights.color×3, lights.distance×3, lights.elevation×3, lights.flicker×1, lights.glow×3, lights.id×9, lights.of×6, lights.on×2, lights.reach×9, lights.strength×8
- **elements**: kind=card×25, kind=particles×3, kind=person×9, kind=plane×12, kind=sky×1; fields: across×48, animate×7, behind×2, box×25, code×38, depth×12, distance×48, elevation×16, facing×7, glows×3, height×25, id×50, inFront×4, lit×4, lit=true×4, name×50, on×1, particles×3, person×9, place×12, place.across×9, place.distance×10, place.facing×2, plane×12, reflect×1, reflect.blur×1, reflect.fade×1, reflect.rough×1, reflect.strength×1, reflect=object×1, shader×4, shadow×5, shadow.onto×5, shadow.soft×5, shadow.strength×5, shadow=object×5, sky×1, uniforms×4, width×12, uniform(declared)×17
- **particles**: amount×1, amount=state key×1, at×1, at=[a,d,e]×1, kind×3, kind=dust×1, kind=embers×1, kind=fire×1, life×1, rate×3, size×1, source×3
- **people**: person.cast×9, person.does×9, person.turn×9, person.who×9, state:<person>_here×3
- **state and the rest**: music.bpm×1, music.brightness×1, music.density×1, music.prompts×1, music.prompts(entry)×20, music.prompts(weight>0)×4, state(keys)×20, states.means×17, states.range×16, states.smooth×8, states.type×1, states(entry)×17
- **code, painting/animate (textual)**: anim (any use)×8, anim.clamp×1, anim.hash×6, createLinearGradient(×4, createRadialGradient(×3, e.aspect×1, e.at(×11, e.glow(×5, e.kit / scene.kit / kit.×12, e.layer(×15, e.lib / scene.lib×42, e.light(×4, e.mem×3, e.part(×6, e.rnd(×1, e.state×11, e.t×2, e.uniform(×17, ease inOut×7, ease out×6, evenodd×4, g.globalCompositeOperation×1, layer blend "add"×1, layer opt blend (written inline)×1, layer opt depth (written inline)×3, layer opt pivot (written inline)×3, layer.alpha×1, layer.rotate×4
- **code, scripts/director (textual)**: .do(×1, .go(×3, .here(×7, .look(×12, .reach(×5, .startOf(×1, .turn(×4, .walk(×4, .wear(×1, .with(×4, camera_frame×3, camera_glide×2, camera_h×3, camera_look×2, camera_shot×4, camera_shot a number×1, camera_target×3, camera_x×3, camera_z×2, opt ease:×13, opt gait:×4, opt loop:×2, opt over:×13, s.all(×6, s.until(×4, s.wait(×37, scene.camera(×1, scene.cut(×9, scene.every(×3, scene.get(×7, scene.move(×13, scene.on('change')×4, scene.on('move')×1, scene.person(×31, scene.sequence(×6, scene.set(×12, scene.shot(×4, scene.tell(×11, shot.ready×4
- **as painted (probe)**: e.at points painted×12, elements marking e.at×9, elements painting e.light×5, elements with layers×6, elements with parts×3, layer blend=add×1, layer opt blend×1, layer opt depth×5, layer opt pivot×10, layer with no option×5, layers×17, part at its own depth (dz≠0)×13, parts×16, recorded composite:lighter×1, recorded style:linear×4, recorded style:radial×5

#### 12. Вокруг света / sevil-rou — «Сэвил-Роу» (68 files, 3160 lines)

- **spec**: camera×1, caption×1, engine×1, horizon×1, lib×1, light×1, lights×1, modules×1, music×1, notes×1, objects×1, relief×1, script×1, showcase×1, state×1, states×1, title×1
- **camera**: camera.mode×1, camera.mode=panorama×1, camera.span×1
- **light**: light.ambient×1, light.ambientColor×1, light.bounce×1, light.grain×1, light.haze×1, light.hazeColor×1, light.hazeGlow×1, light.inside×1, light.looks(entry)×3, light.vignette×1, light.wind×1; looks: look.ambient×2, look.ambientColor×2, look.haze×2, look.hazeColor×2, look.hazeGlow×1, look.inside×1, look.saturation×1, look.shafts×1, look.tint×1, look.tintStrength×1
- **lights**: lights:kind=from[bearing,height]×1, lights:kind=of×25, lights.color×1, lights.flicker×1, lights.from×1, lights.glow×16, lights.id×26, lights.of×25, lights.on×6, lights.reach×25, lights.strength×24
- **elements**: kind=card×34, kind=particles×6, kind=person×6, kind=plane×13, kind=sky×1, kind=unseen×1; fields: across×41, animate×12, box×34, code×48, depth×13, distance×52, elevation×18, facing×26, flicker×2, glass×2, glass.blur×2, glass.strength×2, glass=object×2, glows×1, height×1, id×61, inside×12, lit×10, lit=true×10, name×61, on×17, onLand×20, onLand=false×20, particles×6, person×6, place×9, place.across×8, place.distance×6, place.facing×1, plane×13, reflect×3, reflect.blur×3, reflect.fade×3, reflect.rough×3, reflect.strength×3, reflect=object×3, shader×2, shadow×16, shadow.onto×16, shadow.soft×16, shadow.strength×8, shadow=object×16, sky×1, tilt×3, uniforms×2, unseen×1, width×13, uniform(declared)×9
- **particles**: amount×2, amount=state key×2, at×6, at=[a,d,e]×2, at=ref string×4, color×6, direction×1, drag×1, fade×1, gravity×1, gust×1, kind×6, kind=dust×1, kind=smoke×5, life×6, opacity×6, rate×6, shadow×1, sheer×1, size×6, soft×1, source×2, speed×1, spin×1, spread×1, swirl×1, turbulence×1, wind×2
- **people**: person.cast×6, person.look×3, person.look.body×3, person.look.colors×3, person.look.garment×3, person.look.hair×3, person.look.hat×3, person.look.kind×3, person.look.kind=shapes×3, person.look.style×3, person.look.style=vokrug×3, person.look.who×3, person.turn×6, person.who×3, state:<person>_here×3
- **state and the rest**: music.bpm×1, music.brightness×1, music.density×1, music.prompts×1, music.prompts(entry)×18, music.prompts(weight>0)×4, state(keys)×28, states.means×19, states.range×15, states.smooth×13, states.type×3, states(entry)×19
- **code, painting/animate (textual)**: anim (any use)×11, anim.clamp×3, anim.hash×8, createLinearGradient(×1, e.area×3, e.aspect×6, e.at(×13, e.dt×1, e.glow(×5, e.id×1, e.kit / scene.kit / kit.×7, e.layer(×23, e.lib / scene.lib×54, e.light(×5, e.mem×2, e.part(×5, e.speed(×1, e.state×8, e.uniform(×9, ease in×1, ease inOut×4, ease linear×3, ease out×5, evenodd×7, g.clip(×1, layer blend "add"×1, layer opt blend (written inline)×1, layer opt depth (written inline)×7, layer opt pivot (written inline)×8, layer opt wind (written inline)×1, layer.alpha×3, layer.rotate×4, layer.scaleX×1, layer.scaleY×1, layer(…).y×2
- **code, scripts/director (textual)**: .do(×2, .gait(×1, .here(×7, .look(×13, .reach(×8, .say(×2, .turn(×7, .walk(×14, .wear(×1, .with(×3, camera_frame×2, camera_glide×4, camera_shot×10, camera_shot a number×7, camera_target×10, camera_x×2, camera_z×1, opt ease:×13, opt loop:×1, opt over:×14, opt speed:×1, opt steps:×1, s.all(×2, s.until(×4, s.wait(×16, scene.cut(×1, scene.every(×1, scene.get(×11, scene.move(×13, scene.on('change')×2, scene.on('move')×1, scene.path(×3, scene.person(×21, scene.random(×2, scene.sequence(×1, scene.set(×13, scene.shot(×1, scene.tell(×12, shot.ready×1
- **as painted (probe)**: e.at points painted×27, elements marking e.at×11, elements painting e.light×10, elements with layers×9, elements with parts×7, layer blend=add×1, layer opt blend×1, layer opt depth×21, layer opt pivot×23, layer opt wind×2, layer with no option×6, layers×33, part at its own depth (dz≠0)×54, parts×61, recorded style:linear×2, recorded style:radial×1

#### 13. Алые паруса / dom-longrena — «Дом Лонгрена» (98 files, 3835 lines)

- **spec**: camera×1, caption×1, engine×1, horizon×1, lib×1, light×1, lights×1, modules×1, music×1, notes×1, objects×1, script×1, showcase×1, state×1, states×1, title×1
- **camera**: camera.area×1, camera.look×1, camera.mode×1, camera.mode=roam×1
- **light**: light.ambient×1, light.ambientColor×1, light.bounce×1, light.grain×1, light.haze×1, light.hazeColor×1, light.inside×1, light.looks(entry)×4, light.vignette×1, light.wind×1; looks: look.ambient×4, look.ambientColor×4, look.haze×4, look.hazeColor×4, look.saturation×1, look.tint×2, look.tintStrength×2
- **lights**: lights:kind=daylight+of×2, lights:kind=from"sky#point"×2, lights:kind=of×1, lights.color×2, lights.daylight×2, lights.flicker×1, lights.from×2, lights.id×5, lights.of×3, lights.on×4, lights.reach×3, lights.soft×2, lights.strength×3, lights.through×2, lights.through:polygon+polygon×2
- **elements**: kind=card×47, kind=insert×1, kind=person×3, kind=plane×12, kind=sky×1, kind=unseen×3; fields: across×48, animate×22, behind×2, box×49, code×61, depth×12, distance×58, elevation×18, facing×44, glass×2, glass=true×2, glows×1, height×29, id×67, insert×1, inside×36, name×67, on×29, person×3, place×10, place.across×5, place.distance×4, place.facing×5, place.tilt×1, plane×12, reflect×1, reflect.blur×1, reflect.fade×1, reflect.ripple×1, reflect.rough×1, reflect.strength×1, reflect=object×1, shader×10, shadow×16, shadow.light×2, shadow.onto×13, shadow.soft×13, shadow=object×13, shadow=true×3, sky×1, translucent×9, translucent(value)×9, uniforms×10, unseen×3, walk×2, width×12, uniform(declared)×101
- **particles**: —
- **people**: person.cast×3, person.does×2, person.turn×3, person.who×3, state:<person>_here×1, state:<person>_look×2, state:<person>_on×1, state:<person>_reach×1, state:<person>_with×2
- **state and the rest**: music.bpm×1, music.brightness×1, music.density×1, music.prompts×1, music.prompts(entry)×19, music.prompts(weight>0)×4, state:fade×1, state(keys)×48, states.means×40, states.range×22, states.smooth×22, states.type×14, states.values×4, states(entry)×40
- **code, painting/animate (textual)**: anim (any use)×18, anim.clamp×8, anim.ease×1, anim.hash×1, anim.noise×6, createLinearGradient(×9, e.aspect×3, e.at(×22, e.cut (seconds since the cut)×1, e.dt×1, e.kit / scene.kit / kit.×48, e.layer(×37, e.lib / scene.lib×14, e.light(×2, e.mem×1, e.rnd(×2, e.speed(×1, e.state×12, e.t×7, ease inOut×9, ease linear×2, ease out×8, evenodd×4, fillText(×1, layer opt box (written inline)×5, layer opt depth (written inline)×3, layer opt flicker (written inline)×2, layer opt pivot (written inline)×8, layer.alpha×9, layer.rotate×6, layer.scaleX×5, layer.scaleY×4, measureText(×1
- **code, scripts/director (textual)**: .do(×14, .gait(×2, .go(×2, .here(×3, .look(×29, .reach(×17, .startOf(×1, .turn(×6, .walk(×6, .with(×10, camera_h×1, camera_pitch×1, camera_target×1, camera_x×1, camera_yaw×1, camera_z×1, fade (key)×13, opt ease:×18, opt gait:×2, opt loop:×8, opt over:×23, person.on(point)×3, s.all(×7, s.until(×2, s.wait(×49, scene.cut(×3, scene.get(×11, scene.move(×24, scene.on('change')×3, scene.on('move')×3, scene.person(×29, scene.sequence(×1, scene.set(×12, scene.shot(×2, scene.state×3, scene.tell(×16, shot.ready×2
- **as painted (probe)**: e.at points painted×27, elements marking e.at×17, elements painting e.light×6, elements with layers×12, layer opt box×21, layer opt depth×19, layer opt flicker×1, layer opt pivot×2, layer opt wind×1, layer wind as {strength,gust,scale}×1, layer with no option×6, layers×30, recorded style:linear×9, recorded style:radial×10

#### 14. Алые паруса / les-u-morya — «Лес у моря» (25 files, 11846 lines)

- **spec**: camera×1, caption×1, engine×1, horizon×1, lib×1, light×1, lights×1, modules×1, music×1, notes×1, objects×1, relief×1, script×1, showcase×1, state×1, states×1, title×1
- **camera**: camera.area×1, camera.mode×1, camera.mode=walk×1
- **light**: light.ambient×1, light.ambientColor×1, light.bounce×1, light.grain×1, light.haze×1, light.hazeColor×1, light.hazeGlow×1, light.looks(entry)×4, light.shafts×1, light.vignette×1, light.wind×1; looks: look.ambient×3, look.ambientColor×3, look.bounce×1, look.haze×4, look.hazeColor×3, look.hazeGlow×1, look.saturation×1, look.shafts×3, look.tint×2, look.tintStrength×2
- **lights**: lights:kind=from[bearing,height]×2, lights:kind=of×1, lights.color×3, lights.flicker×1, lights.from×2, lights.id×3, lights.of×1, lights.on×3, lights.place×2, lights.place.bearing×2, lights.place.height×2, lights.reach×1, lights.size×2, lights.strength×3
- **elements**: kind=card×513, kind=particles×9, kind=person×3, kind=plane×5, kind=sky×1, kind=unseen×3; fields: across×533, animate×9, box×513, code×519, depth×5, distance×533, drape×1, elevation×23, facing×2, glows×1, height×513, id×534, name×534, on×151, onLand×7, onLand=false×7, particles×9, person×3, place×3, place.across×3, place.distance×3, plane×5, reflect×4, reflect.blur×4, reflect.fade×4, reflect.ripple×4, reflect.rough×4, reflect.strength×4, reflect=object×4, shader×1, shadow×302, shadow.onto×299, shadow.strength×299, shadow=object×299, shadow=true×3, sky×1, translucent×298, translucent(value)×298, uniforms×1, unseen×3, width×5, uniform(declared)×29
- **particles**: amount×2, amount=state key×2, color×7, direction×7, drag×7, fade×7, gravity×7, kind×9, kind=embers×1, kind=fire×1, kind=puff×7, life×7, opacity×7, rate×9, shadow×7, size×8, soft×7, source×8, speed×8, spread×7, turbulence×7, wind×7
- **people**: person.cast×3, person.turn×3, person.who×3, state:<person>_here×3
- **state and the rest**: music.bpm×1, music.brightness×1, music.density×1, music.prompts×1, music.prompts(entry)×18, music.prompts(weight>0)×4, state:fade×1, state(keys)×28, states.means×24, states.range×12, states.smooth×12, states.type×11, states.values×1, states(entry)×24
- **code, painting/animate (textual)**: anim (any use)×70, anim.clamp×1, anim.clamp (destructured)×1, anim.ease×1, anim.hash×59, anim.mix (destructured)×1, anim.noise×2, anim.span (destructured)×1, createLinearGradient(×7, createRadialGradient(×1, e.at(×6, e.ground(×2, e.kit / scene.kit / kit.×5, e.layer(×9, e.lib / scene.lib×525, e.light(×1, e.part(×4, e.state×2, ease in×2, ease inOut×4, ease out×3, ease smooth×1, g.clip(×4, layer opt box (written inline)×6, layer opt drift (written inline)×1, layer opt pivot (written inline)×6, layer opt wind (written inline)×5, layer.alpha×2, layer.scaleY×1
- **code, scripts/director (textual)**: .do(×5, .gait(×1, .go(×2, .look(×15, .reach(×7, .turn(×4, .walk(×2, camera_frame×2, camera_glide×1, camera_h×2, camera_look×1, camera_pitch×2, camera_shot×2, camera_target×2, camera_x×3, camera_yaw×2, camera_z×3, fade (key)×9, opt ease:×9, opt loop:×3, opt over:×9, opt speed:×1, s.until(×4, s.wait(×21, scene.cut(×3, scene.get(×5, scene.move(×9, scene.on('change')×4, scene.on('move')×2, scene.path(×1, scene.person(×12, scene.set(×6, scene.shot(×2, scene.state×2, scene.tell(×14, shot.ready×2
- **as painted (probe)**: e.at points painted×8, elements marking e.at×7, elements painting e.light×2, elements with layers×507, elements with parts×3, layer opt box×1430, layer opt drift×7, layer opt pivot×1427, layer opt wind×1420, layer wind as {strength,gust,scale}×1420, layer with no option×1, layers×1431, part at its own depth (dz≠0)×391, parts×392, recorded style:linear×3, recorded style:radial×8

#### 15. Алые паруса / main — «Берег Каперны» (81 files, 2791 lines)

- **spec**: camera×1, caption×1, engine×1, horizon×1, lib×1, light×1, lights×1, modules×1, music×1, notes×1, objects×1, relief×1, script×1, showcase×1, state×1, states×1, title×1
- **camera**: camera.mode×1, camera.mode=panorama×1, camera.span×1
- **light**: light.ambient×1, light.ambientColor×1, light.bounce×1, light.grain×1, light.haze×1, light.hazeColor×1, light.hazeGlow×1, light.looks(entry)×5, light.vignette×1, light.wind×1; looks: look.ambient×4, look.ambientColor×4, look.haze×5, look.hazeColor×4, look.saturation×1, look.shafts×2, look.tint×2, look.tintStrength×2
- **lights**: lights:kind=from"sky#point"×2, lights.color×2, lights.from×2, lights.id×2, lights.on×2, lights.strength×2
- **elements**: kind=card×34, kind=person×7, kind=plane×7, kind=sky×1, kind=unseen×1; fields: across×37, animate×23, box×34, code×42, depth×7, distance×42, drape×4, elevation×5, facing×21, glows×3, height×14, id×50, name×50, on×22, person×7, place×8, place.across×8, place.distance×8, place.facing×1, place.tilt×1, plane×7, reflect×1, reflect.blur×1, reflect.fade×1, reflect.ripple×1, reflect.rough×1, reflect.strength×1, reflect=object×1, shader×10, shadow×1, shadow.onto×1, shadow.soft×1, shadow=object×1, sky×1, translucent×9, translucent(value)×9, uniforms×10, unseen×1, walk×2, width×7, uniform(declared)×101
- **particles**: —
- **people**: person.cast×7, person.turn×7, person.who×7
- **state and the rest**: music.bpm×1, music.brightness×1, music.density×1, music.prompts×1, music.prompts(entry)×21, music.prompts(weight>0)×4, state(keys)×35, states.means×35, states.range×16, states.smooth×20, states.type×19, states(entry)×35
- **code, painting/animate (textual)**: anim (any use)×22, anim.clamp×4, anim.clamp (destructured)×1, anim.ease×1, anim.ease (destructured)×1, anim.hash×9, anim.mix×2, anim.mix (destructured)×1, anim.noise×1, anim.span×1, anim.span (destructured)×1, createLinearGradient(×7, e.at(×24, e.glow(×6, e.ground(×6, e.kit / scene.kit / kit.×48, e.layer(×18, e.lib / scene.lib×20, e.light(×4, e.part(×3, e.state×7, e.t×2, ease in×1, ease inOut×7, ease out×2, ease smooth×1, layer blend "add"×1, layer opt blend (written inline)×1, layer opt box (written inline)×4, layer opt drift (written inline)×2, layer opt pivot (written inline)×3, layer.alpha×10, layer.rotate×1, layer.scaleX×2, layer.scaleY×1
- **code, scripts/director (textual)**: .do(×14, .gait(×7, .go(×2, .here(×4, .look(×30, .reach(×10, .turn(×13, .walk(×11, .with(×3, action.ending(×4, camera_target×1, camera_x×8, camera_yaw×8, camera_z×8, fade (key)×3, opt ease:×8, opt going:×1, opt loop:×4, opt over:×9, person.on(point)×1, s.all(×2, s.wait(×44, scene.get(×1, scene.move(×7, scene.on('change')×1, scene.on('move')×1, scene.path(×2, scene.person(×28, scene.set(×3, scene.tell(×17
- **as painted (probe)**: e.at points painted×24, elements marking e.at×14, elements painting e.light×8, elements with layers×13, elements with parts×2, layer blend=add×2, layer opt blend×2, layer opt box×18, layer opt depth×6, layer opt drift×5, layer opt pivot×5, layer opt wind×1, layer wind as {strength,gust,scale}×1, layer with no option×5, layers×24, part at its own depth (dz≠0)×32, parts×32, recorded style:linear×20, recorded style:radial×14

#### 16. Алые паруса / paluba — «Палуба» (114 files, 4110 lines)

- **spec**: camera×1, caption×1, engine×1, horizon×1, lib×1, light×1, lights×1, modules×1, music×1, notes×1, objects×1, script×1, showcase×1, state×1, states×1, title×1
- **camera**: camera.area×1, camera.mode×1, camera.mode=roam×1, camera.on×1
- **light**: light.ambient×1, light.ambientColor×1, light.bounce×1, light.grain×1, light.haze×1, light.hazeColor×1, light.hazeGlow×1, light.looks(entry)×4, light.shafts×1, light.vignette×1, light.wind×1; looks: look.ambient×4, look.ambientColor×4, look.haze×4, look.hazeColor×4, look.lights×1, look.lights(entry)×1, look.saturation×2, look.shafts×3, look.tint×2, look.tintStrength×2, look.wind×1
- **lights**: lights:kind=from"sky#point"×2, lights:kind=of×7, lights.color×2, lights.flicker×3, lights.from×2, lights.id×9, lights.of×7, lights.on×9, lights.reach×7, lights.size×2, lights.strength×5
- **elements**: kind=card×49, kind=particles×1, kind=person×7, kind=plane×6, kind=sky×1, kind=unseen×6; fields: across×66, animate×36, box×49, code×56, depth×6, distance×67, elevation×66, facing×42, glows×7, height×51, id×70, inFront×3, lit×4, lit=true×4, name×70, on×63, particles×1, person×7, place×22, place.across×9, place.distance×9, place.elevation×11, place.facing×13, place.tilt×13, plane×6, reflect×3, reflect.blur×3, reflect.fade×3, reflect.ripple×1, reflect.rough×1, reflect.strength×3, reflect=object×3, shader×17, shadow×30, shadow.light×12, shadow.onto×30, shadow.soft×30, shadow.strength×23, shadow=object×30, sky×1, translucent×15, translucent(value)×15, uniforms×17, unseen×6, width×6, uniform(declared)×150
- **particles**: amount×1, amount=state key×1, at×1, at=ref string×1, color×1, drag×1, fade×1, gravity×1, gust×1, kind×1, kind=smoke×1, life×1, opacity×1, rate×1, sheer×1, size×1, soft×1, source×1, speed×1, spread×1, swirl×1, turbulence×1, wind×1
- **people**: person.cast×7, person.turn×7, person.who×7, state:<person>_do×1, state:<person>_here×7, state:<person>_reach×1
- **state and the rest**: music.bpm×1, music.brightness×1, music.density×1, music.prompts×1, music.prompts(entry)×19, music.prompts(weight>0)×4, state(keys)×67, states.means×58, states.range×20, states.smooth×20, states.type×36, states.values×2, states(entry)×58
- **code, painting/animate (textual)**: anim (any use)×7, anim.clamp×3, anim.clamp (destructured)×1, anim.ease (destructured)×1, anim.hash×2, anim.hash (destructured)×1, anim.mix (destructured)×1, anim.span (destructured)×1, createLinearGradient(×1, e.at(×35, e.glow(×2, e.kit / scene.kit / kit.×10, e.layer(×22, e.lib / scene.lib×86, e.light(×1, e.state×38, e.uniform(×12, ease inOut×7, ease linear×3, ease out×1, g.clip(×3, layer opt box (written inline)×2, layer opt depth (written inline)×1, layer opt pivot (written inline)×3, layer.alpha×8, layer.rotate×2, layer.scale×1, layer.scaleY×1, layer(…).y×1
- **code, scripts/director (textual)**: .do(×2, .look(×25, .reach(×1, .turn(×2, .walk(×1, camera_frame×2, camera_glide×1, camera_h×1, camera_pitch×5, camera_shot×2, camera_target×2, camera_x×1, camera_yaw×1, camera_z×1, fade (key)×1, opt ease:×7, opt loop:×1, opt over:×7, person.on(point)×11, s.wait(×38, scene.cut(×1, scene.every(×2, scene.get(×2, scene.move(×7, scene.on('change')×4, scene.on('cut')×1, scene.on('move')×3, scene.person(×17, scene.random(×1, scene.set(×8, scene.shot(×1, scene.state×8, scene.tell(×11
- **as painted (probe)**: e.at points painted×20, elements marking e.at×14, elements painting e.light×5, elements with layers×18, layer opt box×9, layer opt depth×6, layer opt pivot×3, layer with no option×19, layers×31, recorded style:linear×14, recorded style:radial×14

#### 17. Алые паруса / zamok-greev — «Замок Греев» (85 files, 3263 lines)

- **spec**: camera×1, caption×1, engine×1, horizon×1, lib×1, light×1, lights×1, modules×1, music×1, notes×1, objects×1, script×1, showcase×1, state×1, states×1, title×1
- **camera**: camera.area×1, camera.look×1, camera.mode×1, camera.mode=roam×1
- **light**: light.ambient×1, light.ambientColor×1, light.bounce×1, light.grain×1, light.haze×1, light.hazeColor×1, light.hazeGlow×1, light.inside×1, light.looks(entry)×4, light.shafts×1, light.vignette×1; looks: look.ambient×4, look.ambientColor×4, look.haze×4, look.hazeColor×4, look.saturation×1, look.tint×2, look.tintStrength×2
- **lights**: lights:kind=at(person point)×1, lights:kind=daylight+of×2, lights:kind=from"sky#point"×2, lights:kind=of×6, lights:kind=point×1, lights.across×1, lights.at×1, lights.color×4, lights.daylight×2, lights.distance×1, lights.elevation×1, lights.flicker×4, lights.from×2, lights.glow×1, lights.id×12, lights.of×8, lights.on×10, lights.reach×8, lights.soft×2, lights.strength×10, lights.through×2, lights.through:element+element×2
- **elements**: kind=card×43, kind=insert×1, kind=particles×3, kind=person×2, kind=plane×18, kind=sky×1, kind=unseen×1; fields: across×64, animate×11, behind×2, box×43, code×63, depth×18, distance×64, elevation×35, facing×36, glass×2, glass.blur×2, glass.strength×2, glass=object×2, height×43, id×69, insert×1, inside×61, lit×4, lit=true×4, name×69, on×5, particles×3, person×2, place×4, place.across×3, place.distance×2, place.elevation×1, place.facing×1, plane×18, reflect×2, reflect.blur×2, reflect.fade×2, reflect.rough×1, reflect.strength×2, reflect=object×2, shader×6, shadow×16, shadow.light×6, shadow.onto×16, shadow.soft×13, shadow.strength×14, shadow=object×16, sky×1, tilt×6, uniforms×6, unseen×1, width×18, uniform(declared)×34
- **particles**: amount×2, amount=state key×2, kind×3, kind=dust×1, kind=embers×1, kind=fire×1, life×1, rate×1, source×3
- **people**: person.cast×2, person.turn×2, person.who×2, state:<person>_here×2
- **state and the rest**: music.bpm×1, music.brightness×1, music.density×1, music.prompts×1, music.prompts(entry)×19, music.prompts(weight>0)×4, state:fade×1, state(keys)×35, states.means×32, states.range×24, states.smooth×28, states.type×8, states(entry)×32
- **code, painting/animate (textual)**: anim (any use)×21, anim.clamp×9, anim.drift×2, anim.ease×1, anim.hash×5, createLinearGradient(×6, createRadialGradient(×7, e.aspect×7, e.at(×17, e.cut (seconds since the cut)×1, e.dt×3, e.kit / scene.kit / kit.×13, e.layer(×19, e.lib / scene.lib×16, e.light(×6, e.mem×1, e.part(×1, e.speed(×1, e.state×9, e.t×5, e.uniform(×5, ease inOut×5, ease out×7, evenodd×5, layer opt box (written inline)×1, layer opt pivot (written inline)×4, layer.alpha×5, layer.rotate×1, layer.scale×1, layer.scaleY×1
- **code, scripts/director (textual)**: .do(×5, .here(×2, .look(×28, .reach(×11, .turn(×5, .walk(×3, .wear(×1, .with(×3, camera_frame×2, camera_glide×1, camera_pitch×3, camera_shot×2, camera_target×2, camera_x×3, camera_yaw×3, camera_z×3, fade (key)×9, opt ease:×9, opt gait:×1, opt loop:×1, opt over:×10, s.all(×1, s.until(×7, s.wait(×45, scene.cut(×4, scene.get(×9, scene.move(×11, scene.on('change')×2, scene.on('move')×2, scene.person(×14, scene.sequence(×1, scene.set(×8, scene.shot(×3, scene.state×1, scene.tell(×16, shot.ready×3
- **as painted (probe)**: e.at points painted×25, elements marking e.at×15, elements painting e.light×6, elements with layers×11, elements with parts×1, layer opt box×4, layer opt pivot×14, layer with no option×9, layers×26, part at its own depth (dz≠0)×14, parts×14, recorded style:linear×7, recorded style:radial×8

#### 18. Ночь / main — «Диканька» (186 files, 6489 lines)

- **spec**: camera×1, caption×1, directions×1, engine×1, horizon×1, lib×1, light×1, lights×1, modules×1, music×1, notes×1, objects×1, relief×1, script×1, showcase×1, state×1, states×1, title×1
- **camera**: camera.area×1, camera.mode×1, camera.mode=walk×1
- **light**: light.ambient×1, light.ambientColor×1, light.grain×1, light.haze×1, light.hazeColor×1, light.hazeGlow×1, light.looks(entry)×4, light.vignette×1, light.wind×1; looks: look.ambient×3, look.ambientColor×3, look.haze×4, look.hazeColor×4, look.hazeGlow×2, look.lights×3, look.lights(entry)×3, look.shafts×3, look.wind×2
- **lights**: lights:kind=at(person point)×1, lights:kind=from"sky#point"×1, lights:kind=from[bearing,height]×1, lights.at×1, lights.color×3, lights.flicker×1, lights.from×2, lights.glow×1, lights.id×3, lights.on×2, lights.reach×1, lights.strength×3
- **elements**: kind=card×91, kind=insert×1, kind=particles×11, kind=person×11, kind=plane×69, kind=sky×3; fields: across×162, animate×14, behind×1, box×91, code×164, depth×69, distance×171, drape×3, elevation×131, facing×74, flicker×9, glows×10, height×91, id×186, inFront×10, insert×1, iris×1, lit×4, lit=true×4, name×186, on×137, particles×11, person×11, place×13, place.across×13, place.distance×13, place.elevation×1, place.facing×1, plane×69, reflect×1, reflect.blur×1, reflect.fade×1, reflect.rough×1, reflect.strength×1, reflect=object×1, rotation×45, shader×3, shadow×149, shadow.onto×149, shadow.soft×149, shadow.strength×149, shadow=object×149, sky×3, tilt×60, uniforms×3, width×69, uniform(declared)×46
- **particles**: amount×3, amount=state key×3, at×10, at=ref string×10, burst×2, burst.count×2, burst.on×2, burst.over×2, color×2, count×1, direction×1, drag×2, flicker×1, glow×3, gravity×3, ground×1, ground=pass×1, inherit×1, kind×11, kind=blizzard×1, kind=embers×1, kind=puff×1, kind=smoke×7, kind=sparks×1, life×10, opacity×1, rate×9, size×10, speed×3, spread×3, turbulence×1, wind×2
- **people**: person.cast×11, person.does×11, person.turn×11, person.who×11, state:<person>_here×11, state:<person>_turn×1
- **state and the rest**: directions.key×3, directions.name×3, music.bpm×1, music.brightness×1, music.density×1, music.prompts×1, music.prompts(entry)×20, music.prompts(weight>0)×4, state(keys)×39, states.means×25, states.range×15, states.smooth×13, states.type×10, states(entry)×25
- **code, painting/animate (textual)**: anim (any use)×3, anim.clamp (destructured)×1, anim.hash (destructured)×1, anim.mix (destructured)×1, anim.noise×2, anim.span (destructured)×1, createLinearGradient(×2, createRadialGradient(×7, e.area×1, e.aspect×1, e.at(×12, e.glow(×2, e.id×9, e.kit / scene.kit / kit.×2, e.layer(×11, e.lib / scene.lib×181, e.light(×3, e.mem×1, e.part(×2, e.point(×2, e.state×7, e.t×2, e.uniform(×15, ease in×3, ease inOut×24, ease linear×4, ease out×2, g.clip(×2, layer opt flicker (written inline)×1, layer opt pivot (written inline)×3, layer opt wind (written inline)×1, layer.alpha×5, layer.brightness×1, layer.scale×2
- **code, scripts/director (textual)**: .do(×9, .gait(×5, .go(×4, .here(×13, .look(×19, .reach(×3, .turn(×12, .walk(×17, .with(×1, action.duration×1, action.remaining×2, camera_look×4, camera_pitch×1, camera_x×11, camera_yaw×16, camera_z×18, opt ease:×33, opt gait:×9, opt loop:×13, opt over:×37, opt speed:×1, person.on(point)×2, s.all(×7, s.until(×1, s.wait(×46, scene.move(×36, scene.path(×2, scene.person(×31, scene.random(×1, scene.sequence(×13, scene.set(×13, scene.state×9
- **as painted (probe)**: e.at points painted×27, elements marking e.at×20, elements painting e.light×11, elements with layers×14, elements with parts×1, layer opt flicker×9, layer opt pivot×5, layer opt wind×3, layer wind as {strength,gust,scale}×3, layer with no option×2, layers×16, part at its own depth (dz≠0)×62, parts×64, recorded style:linear×2, recorded style:radial×13

#### 19. Ночь / polyot — «Полёт» (560 files, 14518 lines)

- **spec**: camera×1, caption×1, directions×1, engine×1, horizon×1, lib×1, light×1, lights×1, modules×1, music×1, notes×1, objects×1, relief×1, script×1, showcase×1, state×1, states×1, title×1
- **camera**: camera.mode×1, camera.mode=around×1, camera.turn×1
- **light**: light.ambient×1, light.ambientColor×1, light.bounce×1, light.grain×1, light.haze×1, light.hazeColor×1, light.hazeGlow×1, light.looks(entry)×5, light.vignette×1, light.wind×1; looks: look.ambient×3, look.ambientColor×3, look.haze×2, look.hazeColor×4, look.hazeGlow×1, look.lights×2, look.lights(entry)×2, look.shafts×3, look.wind×2
- **lights**: lights:kind=from"sky#point"×1, lights:kind=point×15, lights.across×15, lights.color×16, lights.distance×15, lights.elevation×15, lights.from×1, lights.id×16, lights.on×16, lights.reach×15, lights.strength×16
- **elements**: kind=card×297, kind=particles×29, kind=person×3, kind=plane×195, kind=sky×3, kind=unseen×2; fields: across×456, animate×55, box×298, code×496, depth×195, distance×497, drape×2, elevation×391, facing×240, flicker×50, glows×51, height×298, id×529, inFront×50, lit×3, lit=true×3, name×529, on×418, onLand×1, onLand=false×1, particles×29, person×3, place×6, place.across×5, place.distance×5, place.elevation×4, place.facing×2, plane×195, reflect×1, reflect.blur×1, reflect.fade×1, reflect.rough×1, reflect.strength×1, reflect=object×1, rotation×141, shader×4, shadow×441, shadow.onto×441, shadow.soft×432, shadow.strength×441, shadow=object×441, sky×3, tilt×188, translucent×8, translucent(value)×8, uniforms×3, unseen×2, width×195, uniform(declared)×20
- **particles**: particles: sprite painted by code×1, amount×3, amount=state key×3, at×27, at=ref string×27, burst×2, burst.count×2, burst.on×2, burst.over×2, color×3, colors×1, count×2, direction×1, drag×2, fade×1, flicker×1, glow×1, gravity×2, ground×1, ground=pass×1, gust×2, inherit×2, kind×29, kind=blizzard×1, kind=embers×1, kind=leaves×1, kind=puff×1, kind=smoke×24, kind=snow×1, life×26, opacity×2, rate×26, reach×1, sheer×1, size×28, speed×4, spin×1, spread×2, swirl×1, tumble×1, turbulence×3, veil×1, wind×4
- **people**: person.cast×3, person.does×3, person.turn×3, person.who×3, state:<person>_do×3, state:<person>_gait×3, state:<person>_here×3, state:<person>_look×3, state:<person>_on×3, state:<person>_reach×3, state:<person>_steps×3, state:<person>_turn×3, state:<person>_wear×3, state:<person>_with×3
- **state and the rest**: directions.key×2, directions.name×2, music.bpm×1, music.brightness×1, music.density×1, music.prompts×1, music.prompts(entry)×18, music.prompts(weight>0)×4, state(keys)×62, states.means×25, states.range×17, states.smooth×14, states.type×7, states.values×1, states(entry)×25
- **code, painting/animate (textual)**: anim (any use)×2, anim.clamp×1, anim.clamp (destructured)×1, anim.hash (destructured)×1, anim.mix (destructured)×1, anim.span (destructured)×1, createLinearGradient(×1, createRadialGradient(×6, e.area×1, e.at(×6, e.dt×1, e.glow(×2, e.ground(×1, e.id×10, e.kit / scene.kit / kit.×2, e.layer(×9, e.lib / scene.lib×554, e.light(×3, e.mem×1, e.part(×4, e.spot×3, e.state×7, e.uniform(×11, ease in×2, ease inOut×30, ease linear×3, ease out×4, g.clip(×1, layer opt flicker (written inline)×2, layer opt pivot (written inline)×3, layer.alpha×3, layer.brightness×2, layer.rotate×1, layer.scale×2
- **code, scripts/director (textual)**: .look(×1, .turn(×1, .walk(×1, camera_h×14, camera_look×10, camera_pitch×6, camera_roll×2, camera_x×9, camera_yaw×15, camera_z×7, opt ease:×39, opt gait:×1, opt loop:×5, opt over:×49, opt steps:×1, s.wait(×17, scene.cut(×2, scene.every(×2, scene.get(×2, scene.move(×49, scene.on('change')×2, scene.on('move')×1, scene.person(×8, scene.random(×1, scene.sequence(×7, scene.set(×24, scene.shot(×2, scene.state×3, shot.ready×2
- **as painted (probe)**: e.at points painted×62, elements marking e.at×49, elements painting e.light×26, elements with layers×52, elements with parts×22, layer opt flicker×50, layer opt pivot×3, layers×53, part at its own depth (dz≠0)×414, parts×415, recorded style:linear×1, recorded style:radial×185

#### 20. Хризалиды / nasyp-u-ruchya — «Насыпь у ручья» (41 files, 2975 lines)

- **spec**: camera×1, engine×1, horizon×1, lib×1, light×1, lights×1, modules×1, music×1, notes×1, objects×1, relief×1, script×1, showcase×1, state×1, states×1, title×1
- **camera**: camera.mode×1, camera.mode=picture×1
- **light**: light.ambient×1, light.ambientColor×1, light.bounce×1, light.grain×1, light.haze×1, light.hazeColor×1, light.looks(entry)×2, light.shafts×1, light.tint×1, light.tintStrength×1, light.vignette×1, light.wind×1; looks: look.ambient×2, look.ambientColor×2, look.bounce×1, look.haze×1, look.hazeColor×2, look.lights×2, look.lights(entry)×2, look.saturation×2, look.shafts×1, look.tint×2, look.tintStrength×2
- **lights**: lights:kind=from"sky#point"×2, lights.color×2, lights.from×2, lights.id×2, lights.on×1, lights.size×2, lights.strength×2
- **elements**: kind=card×12, kind=insert×4, kind=particles×4, kind=person×4, kind=plane×3, kind=sky×2; fields: across×18, animate×10, box×12, code×21, depth×3, distance×22, elevation×5, height×12, id×29, inFront×3, insert×4, iris×4, name×29, onLand×4, onLand=false×4, particles×4, person×4, place×7, place.across×7, place.distance×4, place.elevation×2, plane×3, shader×4, shadow×5, shadow.strength×5, shadow=object×5, sky×2, uniforms×3, width×3, x×4, uniform(declared)×4
- **particles**: at×1, at=ref string×1, burst×2, burst.count×2, burst.on×2, color×4, flicker×1, kind×4, kind=dust×1, kind=puff×1, kind=smoke×1, kind=splashes×1, opacity×3, rate×2, size×3, source×1
- **people**: person.cast×4, person.does×3, person.turn×4, person.who×4, state:<person>_do×2, state:<person>_here×2, state:<person>_look×1, state:<person>_on×1, state:<person>_steps×1, state:<person>_turn×4
- **state and the rest**: music.bpm×1, music.brightness×1, music.density×1, music.prompts×1, music.prompts(entry)×20, music.prompts(weight>0)×4, state(keys)×37, states.means×20, states.range×16, states.smooth×14, states.type×3, states.values×1, states(entry)×20
- **code, painting/animate (textual)**: anim (any use)×5, anim.clamp (destructured)×1, anim.hash×4, createLinearGradient(×18, createRadialGradient(×5, e.aspect×10, e.at(×4, e.dt×1, e.kit / scene.kit / kit.×6, e.layer(×29, e.lib / scene.lib×14, e.mem×1, e.rnd(×101, e.state×7, e.t×3, e.uniform(×4, ease in×1, ease inOut×1, ease linear×8, ease out×4, g.clip(×2, layer opt box (written inline)×17, layer opt drift (written inline)×2, layer opt flicker (written inline)×1, layer opt pivot (written inline)×7, layer opt wind (written inline)×2, layer.alpha×9, layer.rotate×4, layer.scale×1, layer.scaleX×3, layer.scaleY×1, layer(…).x×1
- **code, scripts/director (textual)**: .do(×53, .gait(×5, .go(×4, .here(×3, .look(×85, .reach(×30, .turn(×10, .walk(×3, camera_h×1, camera_look×9, camera_x×13, camera_z×13, fade (key)×4, fade_color×2, opt ease:×14, opt gait:×1, opt loop:×41, opt over:×33, opt speed:×4, opt steps:×1, person.on(point)×1, s.all(×2, s.until(×2, s.wait(×174, scene.get(×1, scene.move(×36, scene.on('change')×1, scene.on('move')×1, scene.path(×6, scene.person(×93, scene.sequence(×1, scene.set(×32, scene.state×15, scene.tell(×3
- **as painted (probe)**: e.at points painted×3, elements marking e.at×2, elements with layers×13, layer opt box×266, layer opt depth×96, layer opt drift×3, layer opt flicker×1, layer opt pivot×250, layer opt wind×115, layer wind as {strength,gust,scale}×115, layers×266, recorded path2d×72, recorded style:linear×13, recorded style:radial×4

## 2. The authors' own shaders

Counted from the specs (appendix A5 `sh.mjs`): **82 shader files in 18 scenes, 2153 lines; 43 distinct texts, 895 lines
(700 without comments and blank lines).** Two scenes have none (Ашеры main, gavan). Hashes are sha1 of the text as the
loader gives it. Duplicates: the sailcloth text is in 33 files of three scenes (9 + 9 + 15) and is byte-identical to
`alye-parusa-v2/tools/korabl-cloth.glsl`; the world's sky is in 5 files of five scenes, identical to
`tools/nebo-sky.glsl`; a four-line "lit layer" text is in 4 files of one scene. Every other text is in one file. So 39
files are copies (32 + 4 + 3) and 43 are distinct.

What a shader is given today (render/glsl/custom.js, common.js; artist2.md:108): the function `vec4 shade(vec4 painted,
vec2 at, vec2 uv)`; `layer(k, at)` reading its base painting (0) or its layers (1…) at any point; `emission`; `u_time`;
`cycle(k)`; `noise1/2/3`, `hash1`, `wobble`, `wobble2`, `luma`, `PI`; its own `uniform float` names, set by animate.
The engine prefixes an element's own names (functions, constants, uniforms) so they cannot meet the engine's
(render/custom.js:138-176).

**Use of the engine's names over the 43 texts** (distinct texts / files): `layer` 27 / 66; `emission` 17 / 20;
`u_time` 18 / 54; `cycle` 10 / 10; `hash1` 16 / 20; `noise1` 4 / 40; `noise2` 6 / 10; `noise3` 1 / 1; `wobble` 5 / 5;
`wobble2` 1 / 33; `luma` 1 / 33; `PI` 3 / 3; and not named by the language's text: `srgbToLinear` 10 / 14. GLSL of the
device's language: `fwidth` 10 / 14; `for` loops 9 / 13 (with `break` 2, `continue` 5); arrays 3 texts (`float[5]`
const arrays, `vec4[4]`, `vec2[12]`); `uint` 1; `mod` 7; own helper functions in 14 texts (`over` in 6, `glowFall` 2,
`drown` 2, `fall` 2 …). Time: 18 texts read `u_time` raw, 10 use `cycle()` (1 uses both), 16 have no time at all.
`painted` is read by 25 texts; 18 never read it (the painting is there only as a carrier or as layers). `uv` is read by
one. Uniforms: 0 (two texts) to 30; the 82 files declare 582 uniforms (T5), every one a float — colours travel as
triples (`tr, tg, tb` …: 15 of the world sky's 29 uniforms are five colours; 12 of Диканька's sky's 13).

**Layers read**: the most is 9 (padenie-doma-2's sky); then 5 (dzhungli's sky), 4 (burya's sky), 3 (eight texts). 16
texts read no layer.

**Families that are the same thing written again**: (a) "return the painting and add a layer as light × a uniform" —
9 texts (#4, #15, #17, #20, #22, #24, #28, #29, #31; #22 and #28 differ by a name and a number); (b) the two skies and
the two star fields of Ночь (#33/#36 share `glowFall`, #34/#37 share `drown` and the star loop); (c) candle flames
(#5, #32); (d) stars in cells with a twinkle (#25, #34, #37, #40, and by noise #14, #16); (e) glints in cells (#35,
#39, #41, #42).
**The 43 texts**

| # | Hash (sha1 of the text, 10) | Lines (code) | Used by (files) | Element kind | Uniforms | Layers read (`layer(k)`) | Reads `painted` | Time | Engine names used | GLSL beyond arithmetic | What it does |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | c9aa9cf104 | 21 (17) | Аш/burya-i-chtenie/sky | sky | 5 | 1, 2, 3, 4 | yes | cycle() | cycle×1 | — | Storm sky: four layers; clouds scrolled by the uniform `cloud`, lower bands faster, wrapped round the stage's width; lit from below by `glow` and by the lightning `flash` (6.5 Hz shimmer by cycle); a mist layer scrolled by `mistgo`. |
| 2 | 574c8b1839 | 13 (10) | Аш/burya-i-chtenie/curtain | card (translucent) | 1 | 0 | no | u_time + cycle() | u_time×1 cycle×5 wobble×2 | — | Curtain: re-reads its own painting (layer 0) at a displaced point — a sway of three sines (cycle), a billow and a lift of the hem by `gust` (wobble of u_time). |
| 3 | 503c87aecd | 18 (16) | Аш/burya-i-chtenie/ripple | plane | 1 | — | no | cycle() | cycle×3 hash1×1 | for×1 | Rings on a stone floor: reads no painting; four rings spreading from a point (cycle 0.35) and grit dots trembling in hashed cells, as strong as `ring`. |
| 4 | 038d483105 | 6 (4) | Аш/komnata-roderika/fissure | card | 1 | 1, 2 | no | — | emission×1 | — | Returns layer 1; adds layer 2 as light (emission) × `song`. |
| 5 | a87e6512f6 | 36 (30) | Аш/komnata-roderika/candles | card | 7 | 1 | yes | u_time | emission×1 u_time×1 | for×1 float[×3 const×3 | Five candle flames from one layer: each stretched and swayed by sums of sines of u_time (a flicker law written in the shader, the same as lib.js flicker), tall as l0…l4, livelier by `wild`, a jump by `pulse`; emission. |
| 6 | a5eb43969c | 5 (4) | Аш/medlin-prokhodit/crack | card | 2 | 1, 2 | no | — | — | — | Mixes two layers (thin crack / wide crack) by `wide`, cut at the height `reach`. |
| 7 | f9a4b4acea | 21 (18) | Аш/padenie-doma-2/sky | sky | 6 | 1, 2, 3, 4, 5, 6, 7, 8, 9 | yes | cycle() | cycle×3 hash1×1 | — | Sky over the tarn: nine layers; pairs pale/red cross-faded by `moon`; two cloud bands scrolled by `cloud` and wrapped; the moon's disc; below the horizon strokes swayed and the moon's path twinkling row by row (hash1, cycle). |
| 8 | 199e9fde43 | 12 (10) | Аш/padenie-doma-2/rings | plane | 2 | — | no | cycle() | cycle×1 | for×1 | Seven rings spreading on the water (cycle 0.028), their near arcs red by `moon`; reads no painting. |
| 9 | 331e4cf6fc | 17 (14) | Аш/padenie-doma-2/causeway | plane | 3 | 1, 2, 3 | no | — | emission×1 hash1×2 | — | Causeway breaking: boards kept up to a ragged edge at `brk`, sunk slabs past it (three layers), a red-hot crack ahead of the break (emission, hash1). |
| 10 | d09418c314 | 51 (41) | Аш/sklep/inside | insert | 10 | 1, 2, 3 | yes | — | emission×1 hash1×2 srgbToLinear×1 | fwidth×1 for×2 vec4[×1 const×2 continue×1 | Insert, a coffin's inside: the base dimmed by the torch (`fl`) and two soft shadows; a hairline layer cut by the shadows; four screws — split wood, a point sliding out, six grit dots each falling (loops 4 × 6); fwidth for the dots' edges. |
| 11 | 69445d2102 | 45 (37) | Аш/sklep/outside | insert | 5 | 1, 2, 3 | yes | — | emission×1 hash1×3 srgbToLinear×1 | fwidth×1 for×1 const×3 break×1 | Insert, a door at night: three layers scaled by the candle's light, the leaf shaken, the flame stretched and leaning, two showers of dust motes (loops of 12 and 26), the dark closing in. |
| 12 | f434e6c220 | 15 (13) | Аш/treshchina/crack | sky | 2 | 1, 2, 3 | yes | — | emission×1 | fwidth×1 | Title card: the crack layer shown down to `reveal` with a tip one pixel sharp (fwidth), the words as it reaches them, the inscription; emission from the base. |
| 13 | 3d01302dc3 | 15 (12) | Аш/treshchina/knot | sky | 2 | 1, 2, 3 | yes | u_time | emission×1 u_time×2 wobble×1 | — | Title card: the knot's three layers come as the crack reaches them and breathe (sin and wobble of u_time); emission. |
| 14 | 9a305cd751 | 18 (16) | ВС/dzhungli/sky | sky | 6 | 1, 2, 3, 4, 5 | yes | u_time | emission×2 u_time×2 noise2×1 | — | Sky: night painting mixed to a day layer, a dawn layer, stars twinkling (noise2 per 1/420 cell, u_time), the moon, the sun layer carried by sunX/sunY; emission for moon and sun. |
| 15 | a31a7c80c9 | 7 (6) | ВС/dzhungli/pyre | card (casts) | 1 | 1 | yes | u_time | emission×1 u_time×1 noise2×1 | — | Returns the painting; the seams layer added as light × `fire`, breathing (noise2 of u_time). |
| 16 | 6997687128 | 24 (17) | ВС/iz-okna-poezda/sky | sky | 11 | 1, 2, 3 | no | cycle() | cycle×1 hash1×1 srgbToLinear×1 | const×1 | Sky made in the shader from six colour uniforms (mixed in sRGB, made linear): gradient, moonlit haze, the low sun's warmth; then three layers — stars (twinkle by cycle and hash1), moon, sun. |
| 17 | e9bcde44d0 | 6 (4) | ВС/iz-okna-poezda/distant, ВС/iz-okna-poezda/mid, ВС/iz-okna-poezda/window, ВС/iz-okna-poezda/lamp | card | 1 | 1 | yes | — | emission×1 | — | Returns the painting; layer 1 (lit windows / lamps) added as light × `lit` × 2. |
| 18 | 1ad353d8c5 | 29 (25) | ВС/iz-okna-poezda/herd | card | 2 | 1 | no | — | hash1×4 | uint×3 for×2 const×2 continue×2 | A herd drawn from an atlas layer (one buffalo in 12 poses): 6 rows × 3 slots tried per pixel, each animal's size, stride and phase from a uint hash, its pose from the way gone (`gone`). |
| 19 | 3b09bff043 | 6 (4) | ВС/main/sky | sky | 6 | — | no | — | — | — | Sky: a vertical gradient between two colours given as six float uniforms; reads nothing. |
| 20 | 654a28e7e3 | 9 (6) | ВС/main/street | card | 7 | 1, 2 | yes | — | emission×1 | — | Facades darkened by a fog layer's alpha; emission = the fog in the hour's colours + a lit-windows layer × `gas`. |
| 21 | 98dde866dc | 9 (7) | ВС/main/mist | card (glows) | 3 | 1, 2 | yes | u_time | u_time×2 | — | Fog: its painting and two sheets scrolled at 0.22 and 0.34 units a second (u_time), wrapped over 74 m; the alphas combined, in a colour given by three uniforms. |
| 22 | e6c0ac2bf7 | 8 (6) | ВС/main/hearth | card | 1 | 1 | yes | u_time | emission×1 u_time×2 wobble×2 | — | Returns the painting; the glow layer added as light × `fire`, breathing (wobble of u_time). |
| 23 | b0293effc4 | 12 (9) | ВС/sevil-rou/sky | sky | 8 | — | no | u_time | u_time×3 noise2×2 | — | Sky: a two-colour gradient, a slow drift of thicker fog (noise2 of u_time), the low sun's warmth by `sun`; reads nothing. |
| 24 | 5bccbbfd28 | 8 (6) | ВС/sevil-rou/club_rooms | card (glows) | 1 | 1, 2 | yes | — | emission×1 | — | Mixes the painting (rooms dark) to layer 1 (rooms lit) by `gas`; emission = lit rooms and chandeliers × `gas`. |
| 25 | a6b932ffce | 78 (62) | 5 files in АП/dom-longrena, АП/les-u-morya, АП/main, АП/paluba, АП/zamok-greev | sky | 29 | 1, 2, 3 | no | u_time | u_time×3 noise1×1 noise2×1 hash1×5 srgbToLinear×2 | fwidth×1 for×1 continue×1 | The world's sky, all in the shader from 29 uniforms (15 of them five colours): gradient, the sea under the horizon, the sun's light, a cloud layer carried round (0.0012 a second), a storm cover (noise2), the moon's light, stars made in two fields of cells (hash1 of vec3, twinkle noise1 of u_time, a pixel's size by fwidth), the moon's and the sun's discs from two layers put where the uniforms say; the sun brighter than white. |
| 26 | 0363fe0268 | 29 (21) | 33 files in АП/dom-longrena, АП/main, АП/paluba | card (translucent), card (translucent) (casts) | 8 | 0 | no | u_time | u_time×4 noise1×1 wobble2×2 luma×1 | const×1 | Sailcloth: re-reads its own painting (layer 0) — furled as far as `set` (from the head, or by `rise` from the foot), folds going over it (wobble2 and noise1 of u_time, `wind`), shaking by `luff`, white turned scarlet by `scarlet` (by the painting's luma). |
| 27 | 12152cab74 | 24 (17) | АП/paluba/sea | plane (mirror) | 1 | — | yes | u_time | u_time×2 hash1×7 | fwidth×2 const×1 | Sea: its colour and crests — short strokes in cells of 6, 40 and 260 m moving with u_time, each size fading where it is finer than a pixel (fwidth); of the painting only its alpha is used. |
| 28 | 9ef958bd17 | 8 (6) | АП/zamok-greev/firebox | card | 1 | 1 | yes | u_time | emission×1 u_time×2 wobble×2 | — | Returns the painting; the glow layer added as light × `heat`, breathing (wobble of u_time). The same text as ВС hearth but for a name and a number. |
| 29 | fabcda5d0e | 8 (6) | АП/zamok-greev/fire | card | 1 | 1 | yes | u_time | emission×1 u_time×2 noise2×1 | — | Returns the painting; the embers layer added as light × `heat`, crawling (noise2 of u_time). |
| 30 | a5ffcde36c | 28 (21) | АП/zamok-greev/ship_painting | card | 1 | 1, 2, 3 | yes | cycle() | cycle×3 wobble×2 | const×2 | A picture on a wall come alive by `alive`: three layers (far sea, wave, ship) displaced by sines of cycle — swell, heave, the lip curling, the ship pitching (a rotation). |
| 31 | cf04d0bd18 | 5 (4) | АП/zamok-greev/floor_lamp | card (casts) | 1 | 1 | yes | — | emission×1 | — | Returns the painting; the shade layer added as light × `lit`. |
| 32 | f4984f3c2a | 20 (18) | АП/zamok-greev/candles | card | 1 | 1 | yes | u_time | emission×1 u_time×1 | const×2 | Two candle flames from one layer, stretched and swayed by sums of sines of u_time (the same law as the five-candle one, no `wild`); emission. |
| 33 | 456d9b710c | 27 (19) | Ночь/main/sky | sky | 13 | — | no | — | srgbToLinear×1 | const×2 | Sky made in the shader from 13 uniforms (nine of them three colours): gradient, the dawn's glow, the morning sun's disc brighter than white; reads nothing. |
| 34 | 95051f0911 | 58 (46) | Ночь/main/stars | sky | 30 | — | no | u_time | u_time×1 noise1×1 hash1×7 srgbToLinear×1 | fwidth×1 for×2 vec2[×1 const×1 continue×2 break×1 | Stars, none painted: two fields of cells, each star its place, brightness, colour, twinkle (noise1 of u_time), the moment it goes out as `shine` falls; drowned round the moon; erased near a polyline of 12 points given as 24 float uniforms (the witch's sweep); fwidth. |
| 35 | 74085d72d0 | 26 (19) | Ночь/main/glints | plane (glows) | 3 | — | no | u_time | u_time×1 hash1×6 srgbToLinear×1 | fwidth×1 | Glints on snow, none painted: cells laid in perspective from the start's eye, more toward the light (`lx`), each flashing by sin(u_time)^18; fwidth. |
| 36 | 57fc6c39c7 | 38 (27) | Ночь/polyot/sky | sky | 13 | — | no | — | noise3×2 srgbToLinear×1 | const×3 | The same sky as Диканька's laid round the full circle (x 0…2π), with thin clouds over the dawn from noise3 taken round the circle. |
| 37 | 7278d33150 | 47 (36) | Ночь/polyot/stars | sky | 5 | — | no | u_time | u_time×1 noise1×1 hash1×7 srgbToLinear×1 | fwidth×1 for×1 const×2 continue×2 | The same stars as Диканька's laid round the circle (whole numbers of cells), without the sweep. |
| 38 | 7eed314f81 | 14 (9) | Ночь/polyot/ground | plane (draped) | 0 | — | yes | — | noise2×3 | fwidth×1 | On a draped plane 100 km wide: the painted snow lightened and darkened by three scales of noise2 (160 m, 26 m, 2.4 m), each only where larger than a pixel (fwidth). No uniforms, no animate. |
| 39 | ad2731179a | 19 (14) | Ночь/polyot/glints | plane (glows) | 2 | — | no | u_time | u_time×1 hash1×5 srgbToLinear×1 | fwidth×1 | Glints in cells of 0.24 m, flashing by sin(u_time)^18, fading where a cell is under a few pixels (fwidth) and toward the plane's edges (the only shader that reads `uv`). |
| 40 | b53341bc68 | 7 (5) | Хр/nasyp-u-ruchya/stars | sky | 1 | — | yes | cycle() | cycle×1 hash1×2 PI×1 | — | The painted stars × `night` × a twinkle per cell of 0.012 (cycle, hash1). |
| 41 | 94edbefa6a | 34 (28) | Хр/nasyp-u-ruchya/stream | plane | 0 | — | yes | cycle() | cycle×3 hash1×9 PI×2 | — | Stream: within the water's band (two sine curves) bright dashes blinking in cells and threads of the current drifting along (cycle), over the painting. No uniforms, no animate. |
| 42 | e570433992 | 7 (5) | Хр/nasyp-u-ruchya/closeup_glints | insert | 1 | — | yes | cycle() | cycle×1 hash1×2 PI×2 | — | Insert: the painted glints, each blinking in its cell (cycle, hash1). |
| 43 | 28248bac4f | 7 (5) | Хр/nasyp-u-ruchya/closeup_iris | insert | 2 | — | yes | — | — | — | Insert: the painting × a dark ring with a soft edge, as wide as `open` (an iris). |

**Per scene: the files** (`elements/<id>.glsl`)

| Scene | Files | Lines | Distinct texts | Files that are copies of a text another scene also has | Each: id (lines, uniforms, text #) |
|---|---|---|---|---|---|
| Аш / burya-i-chtenie | 3 | 52 | 3 | 0 | sky (21, 5, #1), curtain (13, 1, #2), ripple (18, 1, #3) |
| Аш / komnata-roderika | 2 | 42 | 2 | 0 | fissure (6, 1, #4), candles (36, 7, #5) |
| Аш / medlin-prokhodit | 1 | 5 | 1 | 0 | crack (5, 2, #6) |
| Аш / padenie-doma-2 | 3 | 50 | 3 | 0 | sky (21, 6, #7), rings (12, 2, #8), causeway (17, 3, #9) |
| Аш / sklep | 2 | 96 | 2 | 0 | inside (51, 10, #10), outside (45, 5, #11) |
| Аш / treshchina | 2 | 30 | 2 | 0 | crack (15, 2, #12), knot (15, 2, #13) |
| ВС / dzhungli | 2 | 25 | 2 | 0 | sky (18, 6, #14), pyre (7, 1, #15) |
| ВС / iz-okna-poezda | 6 | 77 | 3 | 0 | sky (24, 11, #16), distant (6, 1, #17), mid (6, 1, #17), window (6, 1, #17), lamp (6, 1, #17), herd (29, 2, #18) |
| ВС / main | 4 | 32 | 4 | 0 | sky (6, 6, #19), street (9, 7, #20), mist (9, 3, #21), hearth (8, 1, #22) |
| ВС / sevil-rou | 2 | 20 | 2 | 0 | sky (12, 8, #23), club_rooms (8, 1, #24) |
| АП / dom-longrena | 10 | 339 | 2 | 10 | sky (78, 29, #25), ship_fore_course (29, 8, #26), ship_fore_top (29, 8, #26), ship_fore_tg (29, 8, #26), ship_main_course (29, 8, #26), ship_main_top (29, 8, #26), ship_main_tg (29, 8, #26), ship_jib (29, 8, #26), ship_jib_outer (29, 8, #26), ship_spanker (29, 8, #26) |
| АП / les-u-morya | 1 | 78 | 1 | 1 | sky (78, 29, #25) |
| АП / main | 10 | 339 | 2 | 10 | sky (78, 29, #25), ship_fore_course (29, 8, #26), ship_fore_top (29, 8, #26), ship_fore_tg (29, 8, #26), ship_main_course (29, 8, #26), ship_main_top (29, 8, #26), ship_main_tg (29, 8, #26), ship_jib (29, 8, #26), ship_jib_outer (29, 8, #26), ship_spanker (29, 8, #26) |
| АП / paluba | 17 | 537 | 3 | 16 | sky (78, 29, #25), spanker (29, 8, #26), mainsail (29, 8, #26), foresail (29, 8, #26), fore_course_l (29, 8, #26), fore_course_r (29, 8, #26), fore_top_l (29, 8, #26), fore_top_r (29, 8, #26), fore_tg_l (29, 8, #26), fore_tg_r (29, 8, #26), main_course_l (29, 8, #26), main_course_r (29, 8, #26), main_top_l (29, 8, #26), main_top_r (29, 8, #26), main_tg_l (29, 8, #26), main_tg_r (29, 8, #26), sea (24, 1, #27) |
| АП / zamok-greev | 6 | 147 | 6 | 1 | sky (78, 29, #25), firebox (8, 1, #28), fire (8, 1, #29), ship_painting (28, 1, #30), floor_lamp (5, 1, #31), candles (20, 1, #32) |
| Ночь / main | 3 | 111 | 3 | 0 | sky (27, 13, #33), stars (58, 30, #34), glints (26, 3, #35) |
| Ночь / polyot | 4 | 118 | 4 | 0 | sky (38, 13, #36), stars (47, 5, #37), ground (14, 0, #38), glints (19, 2, #39) |
| Хр / nasyp-u-ruchya | 4 | 55 | 4 | 0 | stars (7, 1, #40), stream (34, 0, #41), closeup_glints (7, 1, #42), closeup_iris (7, 2, #43) |

## 3. Scripts that run every frame or tick

What is listed: every `animate` (the engine calls each one every frame, whatever is seen — engine 2's thread, gone), every `scene.every`, every `'move'` handler (it fires each frame while its key moves), loops and polled conditions in sequences. Per-frame counts of writes are the probe's where given as numbers for a scene (4f) and the readers' where given per function; the two agree wherever both exist. "Kind" says what the result is a function of — that is a fact about the code as written.

### 3.1 Падение дома Ашеров v2 — modules, «Подъезд к дому» (main), «Падение дома» (padenie-doma-2), «Трещина» (treshchina)

Paths are from the world's root (`padenie-doma-asherov-v2/`).

**Module `closeups.js` (1909 lines) — the close-up faces and hands of inserts** (used by main, burya-i-chtenie,
komnata-roderika, medlin-prokhodit, sklep).

- `live(e, shot, now)` (modules/closeups.js:1808-1907) is the animate of a close-up insert. Its only guard is
  `if (!shot || !e.layer('glow').scaleX) return;` (:1810) — it does not know the insert's key; the engine calls every
  animate every frame whether the insert is open or not (web/scene2/thread.js:321, 330, 338).
- Inputs: `e.t` and the numbers the scene passes (`now`). No `e.mem`, no `e.dt`. A pure function of time and those numbers:
  breath `0.5 + 0.5·sin(1.4t + seed)` (:1839), head drift `drift(0.23t)`, `drift(0.21t)`, `drift(0.19t)`, roll
  `drift(0.15t)` (:1842-1844), a glance every 1.9 s (:141-146), a blink per 3.7 s window, 0.3 s long (:136-140), flame
  flicker `1 + k·(0.09·drift(2.1t) + 0.04·noise(8.5t))` (:1814), speech `noise(7.2t)`, `noise(12.5t)` (:1875).
- Output: 7 properties (`rotate, scaleX, scaleY, alpha, brightness, x, y`) on each layer it sets (:1825-1829). For
  main's one face: 14 layers = 98 writes a frame (the probe counted 98).
- Each call builds anew: objects `L`, `G0`, closures `toStage`, `group`, `set`, `faceLive` (:1813-1833), an options
  object per `set`, `statesOf` (:294-300), `poseOf` (:320-325, twice), `skullFrame` → `headFrame` with five closures
  (:178-201, :1858), arrays by `X.map` and `Math.max(...)` (:1860, :1864), template-string layer names. `skullFrame` and
  the brow lines depend only on the shot and are worked out again every frame (:1858, :1864-1870).
- Painting (once per shot): the head, hair, bust and hand are shaded pixel by pixel in JS into `ImageData`, put into an
  `OffscreenCanvas` (`putImageData`) and drawn with `g.drawImage` (:519-574, :1032-1048, :1189-1209, :1423-1443); the
  grid's size is taken from `g.getTransform()` × 2160 (:8, :518). `hairField` paints into an OffscreenCanvas with
  `g.filter = blur(…)` and reads it back with `getImageData` (:986-997). The light is the module's own (table `LIGHTS`
  :42-49, `shade()` :74-90) — nothing of the scene's light. Module-level caches: `outlines`, `fields` (Float32Array
  grids 155×187 per person), `nimbi`, `hairFields`, `busts`, `handForms` (:165, :444, :892, :977, :1126, :1291).
- `live` hard-codes the stage's width 16/9 (:1715, :1812, with the comment "an animate is not given the stage's width")
  — the engine does give animate `e.aspect` (core/element.js:265).

**Module `ushers.js` (1768 lines) — the horse and the old 2D puppets.**

- `horse(g, e, o)` (:1647-1672): 133 layers (17 body rounds + 43 joins, neck 8 + 6 + 3, mane 7, head 5 + 5, ears 2, tail
  5, and two sets — far, near — of 4 legs × 4 pieces = 32). Colours are baked (`mix(dark, coat, light·0.92)`, :1649-1651).
- `horseLive(e, o)` (:1678-1718), the animate. Carries memory in `e.mem`: a spring of the pace, the gait and its blend,
  a stride phase added up by dt (`m.ph += s·dt/stride`, :1690), angle springs, springs `graze`, `toss`, `rear`, `rest`,
  two hanging masses (mane, tail) — springs stepped at 1/90 s, up to 40 steps a call (:46-54). Time terms: breath
  `sin(1.3t + seed)` (:1530), toss `sin(7t)·max(0, sin(2.1t))` (:1536), mane and tail noise (:1599, :1602). Reads
  `e.speed` of two keys, `e.spot.distance` and the key `camera_z` (:1694 — the card's own projection is tilted by how far
  the camera has dollied). Output a frame: `alpha, x, y` on all 133 layers and `rotate, scaleY` on 95 of them — 589
  writes — and 4 `e.at` marks (`saddle`, `stirrups`, `head`, `rump`, :1712-1716). The probe counted 589 and 4.
- Each call builds anew: `horseFrame` (:1507-1552) and `horsePieces` — an array of 133 objects with closures, small
  arrays, template-string names — and runs a regex per piece (:1703).
- `figure(g, e, o)` (:1726-1731) paints the old engine's puppet in one pose (used for three ghosts in
  padenie-doma-2's hand-made reflection): it writes module-level Maps, decodes motion clips with `atob` (:257-275),
  uses `Path2D`, `new DOMMatrix()` (:1190, :1388), paints its own ground shadow (:1270-1280) and its own rim light
  (:1305-1331).

**Module `beats.js` (48 lines; the same file, sha1 5f13884a, in all five worlds).** `play(scene, film)` — one
`scene.on('change', 'beat', …)`; a beat named starts a sequence named `beat` that cuts to the beat's `from()` (a plain
`s.cut`, no shot made ready) unless it follows the last one, runs it and tells `beat:<name>` (:13-29). `showcase(scene,
film, order)` — as each beat begins it makes the next one's cut ready with `scene.shot(n.from())` (so `from()` is
evaluated a beat early) and cuts by it (:33-47). `last` and `next` live in closures, not in the state (:14, :34).

**«Подъезд к дому» (main).** 9 animates, no `scene.every`.

| What runs | Where | For | Reads | Writes a frame | Kind |
|---|---|---|---|---|---|
| close-up | elements/closeup.animate.js:1 → closeups.live | 1 insert | `e.t`, `cu_inhale` | 98 layer properties | time + state; nothing tests `closeup` |
| horse | elements/rider.animate.js:3 → ushers.horseLive | 1 card | above | 589 layer properties, 4 marks | memory + time + state; guard `rider_present !== false` |
| crack | elements/crack.animate.js:3-11 | 1 | `crack`, `crack_trace` | 20 properties, 1 `e.glow` | state alone; 16 template strings a frame |
| mists | elements/mist_far/mid/near.animate.js:2-3 | 3 | `gloom` | 3 + 2 + 2 alphas | state alone; an array literal a frame |
| trees | elements/trees.animate.js:2-3 | 1 | `e.t` | 2 rotations `0.004·drift(0.15t, seed)` | time alone |
| vision | elements/vision.animate.js:1-3 | 1 | `reflection_figure` | 1 alpha, 1 `e.glow` | state alone; runs at 0 too |
| windows | elements/windows.animate.js:3-10 | 1 | `door`, `gloom` | 2 `scaleX`, 1 alpha, 1 `e.glow` | state alone |

Script handlers (script.js): `scene.on('move', 'narrator_d')` sets the key `walk_at = L.walkOf(narrator_d)` every frame
the narrator moves (:32-38) — a function of one key written into another; `'move' resist` switches `roderick_do`
between `balk` and `stand` with hysteresis (:41-48); `'change' walk` starts or cancels two walks and moves
`camera_x`/`camera_z` over the walk's `duration` (:12-30). `lib.js:355-356`: `await s.wait(0.1)` and then
`nar.remaining || 18` — a tenth of a second waited to learn a walk's length.

**«Падение дома» (padenie-doma-2).** 6 animates, 3 `scene.every`, 20 handlers.

| What runs | Where | Reads | Writes | Kind |
|---|---|---|---|---|
| sky | lib.js:174-183 | `storm`, `moon`, `morning`, `e.dt`, `e.mem.c` | 5 uniforms (`hz` the same constant every frame) | memory: `m.c += dt·(0.004 + 0.01·storm)` — a cloud phase at a rate a key sets |
| house | lib.js:363-377 | `fall`, `moon`, `e.t` | 22 layer properties, 3 `e.glow` | state + time: `glow = moon·(0.78 + 0.22·sin 1.7t·sin 0.63t)·…` |
| house_mirror | same function, mirrored | same + `ghosts` | 26 layer properties | the same, worked out a second time |
| causeway, rings, breach | lib.js:450-455, 557-560, 549-553 | `fall`, `moon`, `rings`, `breaking` | 3 + 2 uniforms; 1 alpha + 1 `e.glow` | state alone |
| `every(0.25)` chase | script.js:28-38 | `running`, `run`, `nar_d` | starts a walk toward `L.runAt(run)` | a timer steering a walker |
| `every(0.3)` | script.js:74 | `fall`, `scene.was('fall', 0.3)` | `move('breaking', 0)` | a timer finding "fall has stopped" |
| `every(0.9)` | script.js:79-85 | `swim`, `scene.time` | `move('camera_look', …)`, `move('camera_h', …)` over 0.9 s | noise of time × `swim`, sampled every 0.9 s |
| `'move' nar_d` → `runAt` | script.js:39-40 | `nar_d` | `run_at` | a key written from a key, each frame |
| `'move' nar_d, trip` → `around` | script.js:41-46 | `nar_d`, `trip`, `with_*` | 6 keys: `mad_a, mad_d, rod_a, rod_d, camera_z, camera_x` | the companions and the camera placed by values set frame after frame |
| `'move' trip` → `hands` | script.js:48-56 | `trip` | up to 3 `*_reach` keys | `JSON.stringify` each frame to find a change |
| `'move' fall, morning` → `falling` | script.js:62-72 | `fall`, `scene.was('fall', 0.2)` | 7 keys: `house_dust, stones, spray, rings, brk_d, brk_a, breaking` | windows of `fall`; `breaking` is its rate of change |

**«Трещина» (treshchina).** Two animates, each two uniforms from keys (`reveal`, `knot`); no script. One shader
breathes by raw `u_time` (`0.75 + 0.25·sin(1.1·u_time) + 0.05·wobble(0.9·u_time)`, elements/knot.glsl:7).

### 3.2 Ашеры — «Буря и чтение», «Комната Родерика», «Мэдлин проходит», «Склеп»

All four have a close-up insert whose animate is `e.kit.closeups.live(e, e.lib.closeup(e.state), e.lib.closeupNow(e.state))`
(3.1). Both arguments are evaluated every frame, the insert open or closed; `closeupNow` builds new objects each time
(burya lib.js:796-806 reads 13 keys; komnata lib.js:77-85; medlin lib.js:408-416; sklep lib.js:134-139). Whether `live`
then works is decided only by `shot` being null or the `glow` layer being unpainted: burya and komnata leave their shot
key set after closing (burya lib.js:895 cuts `{closeup: 0}` alone; komnata lib.js:211); medlin's `lib.closeup` returns
null while `closeup` is 0 (lib.js:397) and sklep cuts `shot: ""` with `closeup: 0` (lib.js:370, 382, 395). Layers set a
frame when open: 14–18 faces' layers × 7 properties (98–126 writes).

**«Буря и чтение»** (scenes/burya-i-chtenie; 9 animates, all in lib.js).

| Animate | Where | Reads | Writes a frame | Kind |
|---|---|---|---|---|
| flame (the candle) | lib.js:565-580 | `e.t`, `wind`, `shudder`, `candle`, `e.mem.w` | 5 layer properties, `e.glow('flame', C·k)` | time + state + a lag of `wind` (3 a second). Law: `breath = 1 + 0.05 sin(8.3t) + 0.035 sin(12.9t + 1) + 0.03 sin(2.7t)`; `k = breath·(1 − 0.35w(0.5 + 0.5 noise(6t)))·(1 − 0.45·shudder·(0.5 + 0.5 noise(30t)))`; `rotate = 0.06 sin(1.3t) + 0.04 sin(2.9t + 1) − w(0.55 + 0.25 noise(5t)) + 0.25·shudder·noise(25t)`. No guard at `candle` 0. Two more flickers lie on the same flame: the element's `flicker: 0.3` and the light `candle`'s `flicker: 0.3` (scene.json:602, :53). |
| door_gap | lib.js:299-305 | `hall_x`, `e.speed('hall_x')`, `hall_lamp`, `door_turn`, `e.t` | 3 layer properties | `k = hall_lamp·(1 + 0.04 sin(7.1t) + 0.06·still·noise(9t))`; builds an object and an array each call (`hall()`, :294-298) |
| feet | lib.js:317-325 | the same (`hall()` called a second time) | 6 layer properties | the step's phase is the place: `ph = hall_x·7.5` |
| fissure | lib.js:220-226 | `crack`, `glow`, `shudder`, `rift`, `e.t`, `e.mem.sh` | 2 alphas | a lag of `shudder` (8 a second) + state + noise of time |
| curtain | lib.js:444-449 | `wind`, `e.dt`, `e.mem.w` | 1 uniform | a lag of `wind` (2.5 a second); the cloth's motion is the shader's |
| ripple | lib.js:762-767 | `ripple`, `e.mem` | 1 uniform | a lag (6 a second); no guard at 0 |
| sky | lib.js:740-751 | `storm`, `e.dt`, `e.mem.c`, `e.mem.m` | 4 uniforms | two phases added up by dt: `m.c += dt·(0.012 + 0.03·storm)`, `m.m += dt·0.006` (the second is plain time) |
| book | lib.js:650-655 | `narrator_with`, `e.point('narrator#book')` | 1 `e.at` | follows a person's point; `[].concat` each frame |
| closeup | above | 13 keys | up to 105 layer properties | time + state |

Script (script.js): `scene.every(0.12)` moves the two casements' keys `case_l`, `case_r` over 0.12 s to `shut + (open −
shut)·window + rattle·noise(3.1·time)` (:19-28) — it re-issues the two moves even when nothing changes;
`scene.every(0.07)` shakes the camera: `scene.move('camera_x', 0.035·q·noise(13·time))`, `scene.move('camera_h',
0.025·q·noise(15·time))`, each over 0.07 s (:86-95), for the scene's whole life; a re-arming `scene.after(14 +
random·20)` fires lightning (:97-110). `'move'` handlers write derived keys each frame: `door_turn = 180 + (88 −
180)·door` (:18), `case_l`, `case_r` (:27). One polled condition: `s.until(() => comes.remaining < 0.8)` (lib.js:1049).

**«Комната Родерика»** (scenes/komnata-roderika; 6 animates).

| Animate | Where | Reads | Writes a frame | Kind |
|---|---|---|---|---|
| candles | elements/candles.animate.js:3-12 | 6 keys through `lib.light`, `wild`, `strum`, `e.speed('strum')`, `e.t` | 7 uniforms, 5 `e.glow` | time + state. Flicker law (lib.js:59-67): `1 + (0.05 + 0.12w)·sin(t(7.3 + 5w) + k) + (0.03 + 0.08w)·sin(t(11.9 + 7w) + 1 + 2k) + 0.025·sin(2.3t + k) + 0.35p`. The same law is written a second time in candles.glsl:8-11 on `u_time` — the animate on `e.t` gives the glows, the shader the flames. A new object, a 5-array and 10 strings a frame; no guard with the candles out. |
| window | elements/window.animate.js:3-13 | `lib.light(state)` | 7 layer properties, 3 `e.glow` | state alone, worked out every frame |
| curtain | elements/curtain.animate.js:3-12 | `curtain` | 6 layer properties | state alone |
| clock | elements/clock.animate.js:3-7 | `clock`, `e.t` | 2 | pendulum `amp·sin(π·t)` (period 2 s) × state |
| fissure | elements/fissure.animate.js:1 | `song` | 1 uniform | state alone |
| closeup | above | 4 keys | up to 126 layer properties | time + state |

Script (script.js:8-21): one function `keep` on `'change'` and `'move'` of six keys (12 handlers) builds `lib.light`
and sets three keys — `window_day`, `window_dusk`, `wick_smoke`. The first two are the `on` of two pairs of lights and
the names of two looks that carry `ambient`: the day→evening change of the window's light is a cross-fade of light
pairs by keys a script writes each frame.

**«Мэдлин проходит»** (scenes/medlin-prokhodit; 3 animates, no script of its own).

- `crack` (elements/crack.animate.js:1-3): 2 uniforms from the key `crack`, every frame; a new object a frame.
- `sconce` (lib.js:380-388): `m.p += dt` — a clock added up by dt — then `rotate = 0.08·noise(0.9p)`, `scaleY = 1 +
  0.12·noise(2.3p)`, `scaleX = 1 − 0.05·noise(2.3p)`: a function of time alone.
- `closeup`: when open, `lib.closeup` builds its whole table of three shots on every call (lib.js:398-405).
- Four polled conditions on people's places (`q.until(() => q.state.madeline_a > −3.4)`, lib.js:484, 560, 672, 674).

**«Склеп»** (scenes/sklep; 4 animates, no script of its own).

- `inside` (insert; elements/inside.animate.js:5-23): 10 uniforms and 7 `e.glow` a frame; `fl = seam·(0.82 +
  0.12·(0.5 + 0.5·noise(7t)) + 0.06·sin(17t))`, the two shadows `m1 = −1.15 + 1.5·sh + 0.05·sin(1.3t)`, `m2 = 1.2 −
  1.05·sh + 0.06·sin(0.9t + 2)`. Time + state. Nothing tests the insert's key.
- `outside` (insert; elements/outside.animate.js:3-11): 5 uniforms, 1 `e.glow`; `fl = 0.85 + 0.08·sin(6.1t) +
  0.05·noise(2.3t) − 0.35·an² − 0.15·kn²`, `shake = (0.004·kn² + 0.007·an²)·sin(70t)`. Nothing tests the insert's key.
- `doorway` (elements/doorway.animate.js:2-4): 2 properties, `door_turn` × noise of time; no guard with the door shut.
- `closeup`: 4–17 layers.
- Timed loops in sequences: screws driven turn by turn with waits of 0.5/0.45 s (lib.js:254-262); knocks as pulses
  `s.set(key, 1); s.move(key, 0, {over: 1.5})` (lib.js:603-615).

### 3.3 Вокруг света v2 — five scenes and the module `svet`

Paths from `vokrug-sveta-v2/`. Module `svet.js` (86 lines): colour helpers and a gas lamp. `svet.london(night)` builds a
new object and about ten arrays on each call (modules/svet.js:45-53, :8-14); it is called three times a frame with the
same `day` in Реформ-клуб (sky, street, mist animates) and `svet.mixc` four times a frame in the train's sky
(scenes/iz-okna-poezda/lib.js:104-107). Only sevil-rou's sky caches the colours until its keys change (lib.js:288-303).

**«Из окна поезда» — how the train moves** (scenes/iz-okna-poezda).

- Nothing rides anything. The key `camera_x` is the train: the unseen element `train` has `place: {across:
  "camera_x"}` (scene.json:409), the unseen `carriage` stands on it (`place: {across: "carriage_x"}`, :419) and 16 objects
  stand on the carriage. The camera and the carriage are moved by the same key; the land lies still over 0…124 km of
  `across` — five lands 30 km apart (lib.js:24-25).
- `scene.every(0.25, run)` (script.js:14-33). Each tick: `v = speed·20`; if the train is under way,
  `scene.move('camera_x', x + v·0.5, {over: 0.5, ease: 'linear'})` — a half-second move issued again every quarter of a
  second, each replacing the one before (:30). `run` is also a `'move'` handler of `speed` (:35), so while `speed`
  changes a move is issued every frame. The tick runs for as long as the scene is open.
- The ride is endless by a cut: every land's content repeats every 8000 m by construction (lib.js:28, :47-58); at the
  end of a stretch the script cuts the camera back one period — `scene.cut({camera_x: x − 8000})` (script.js:16-21) —
  after `scene.prepare({camera_x: x + 3v − 8000}, 3)` three seconds ahead (:31; the one use of `scene.prepare` in the 20
  scenes). The prepared value and the cut's value are worked out at different ticks and are not made equal.
- A change of the key `land` is another cut of `camera_x` (script.js:41-44). Shots that look sideways move the room,
  not the camera (`carriage_x: −x`, lib.js:245), because `camera_x` is taken.
- Animates (8): the sky's 11 uniforms, one layer property and 2 glows, from keys alone, with one object and four
  `mixc` a frame (lib.js:102-133); `distant`, `mid`, `far_bank`, `lamp`, `window` — one uniform and/or one
  `e.glow(null, k)` from `night` (lib.js:137-141); `herd` — 2 uniforms from the key `herd`; `watch_close` (an insert) —
  6 layer properties: a second hand ticking by `e.t` (`floor(t) + easeOut((t − floor t)/0.12)`) and a sway of noise,
  with no test of the insert's key (elements/watch_close.animate.js:3-18). No animate keeps memory.

**«Гавань»** (scenes/gavan; 23 animates, 2 timers).

- The steamer and the pilot boat are things built of cards on unseen anchors (`steamer` with 6 cards, `boat` with 7)
  whose `place` reads state keys (`steamer_x`, `steamer_d`, `steamer_facing`, `tilt: steamer_roll`; scene.json:559,
  :717). One game key each (`carnatic_present`, `tankadere_out`) is turned by a `'move'` handler into three place keys
  through piecewise easings (script.js:8-16; lib.js:43-59) — three state writes a frame while the source key moves, a
  new array and closure each time. `daze` → `camera_roll` the same way.
- The roll: two `scene.every` timers (4.6 s and 2.7 s) each flip a sign kept in a closure and start
  `scene.move(key, ±most·(0.6 + 0.4·random), {over: period, ease: 'inOut'})` (script.js:30-38) — two keys moving all the
  time, driven by a timer and chance, with no guard when the ship has left.
- The 11 small craft are 11 elements, each with an animate (`lib.boatLive`, lib.js:270-280): 5 layer properties and 2
  glows — `x = wrap(x0 + pace·t)` over ±400 m for the four that sail (paces −0.32, 0.18, 0.26, −0.14 m/s), a bob
  `0.15·sin(t·(0.5 + 0.3ph) + i)` and a roll `0.03·sin(…) + 0.01·noise(0.3t)` for all. A function of time alone but for
  the glows. The four that sail have a box 824 m wide for a boat a few metres long.
- Four lantern rows (`lib.dazed`, lib.js:146-154): the lamps' glows by `lanterns`, and a "ghost" layer offset by
  `daze·noise(t)` — the noise is evaluated at `daze` 0 too.
- `where` runs on `'change'` and `'move'` of both of a walker's place keys (twice a frame while he walks) and writes
  `pp_walk_at` (script.js:65-69).
- Sky, city lights, steamer, sails: functions of keys alone, worked out every frame.

**«Реформ-клуб»** (scenes/main; 7 animates, 1 timer).

- The clock: `scene.every(1)` adds a second — `scene.set('second', s + 1, 1, 'linear')` — and a minute at 60
  (script.js:4-12): `second` is a key in motion for as long as the scene is open; the clock's animate turns three hands
  and a pendulum from `minute` and `second` each frame (elements/clock.animate.js:4-11; pendulum `−0.042·cos(π·second)`).
  A beat times its cut by `await s.wait(18.2)` against that clock (lib.js:211-212).
- Door leaves: a `'move'` handler of `door` writes `leaf_l = 180 + 100v`, `leaf_r = 180 − 100v` (script.js:16-21); the
  two cards' `place.facing` read them.
- The crowd outside (elements/crowd.animate.js:3-11): 18 layer properties and 26 `e.glow` a frame, by noise of time ×
  `crowd_outside`; 32 template strings a frame; all the work is done at `crowd_outside` 0.
- Sky, street, mist: 6 + 7 + 3 uniforms from the key `day` alone, set every frame.

**«Джунгли»** (scenes/dzhungli; 7 animates, no timer).

- The pyre's flames: two elements, 44 and 55 layers (9 flames × 11: a body, 8 tongues, 2 licks), each layer painted
  once with `blend: 'add'`. `lib.flameMotion` (lib.js:533-559) writes 6 properties on each — 264 + 330 = 594 a frame
  (the probe counted 264 and 330). A lick is a sawtooth of time (`u = (t·(0.55 + 0.25·hash) + s) % 1`, period 1.25–1.82
  s) driving alpha, scale, x, y; a body or tongue is noise of time on scale, rotation and x. No memory. No guard: it
  runs at `pyre_fire` 0 with alpha 0.
- `procession` is an element that paints nothing; its animate marks one point from a person's head
  (elements/procession.animate.js:2-5).
- A `'move'` handler of `day` writes `fireflies = 1 − smooth(span(day, .08, .4))` (script.js:16-19); the emitter's
  `amount` reads it.

**«Сэвил-Роу»** (scenes/sevil-rou; 12 animates, 1 timer).

- Two cabs (`lib.cabMotion`, lib.js:542-574): 25 layer properties each a frame; the legs' phase is the place (`phi =
  2π·across/2.7`), the wheel's turn is `across/0.74`; the trot's size is a lag of the speed kept in `e.mem`
  (`m.amp += (min(1, |speed|/3) − m.amp)·min(1, 3·dt)`). No guard while a cab stands.
- `scene.every(1)` (script.js:21-41): by chance (`0.07·traffic`, `0.05·traffic`) sends a cab along its 200 m lane with
  `scene.path` or a walker along 150 m.
- 16 street lamps' glows (13 + 3 `e.glow`) and the rooms' lit layers follow `night` and the rooms' keys — keys alone.
- A `'move'` handler of `door` writes `door_leaf`.

### 3.4 Алые паруса v2 — modules `nebo`, `korabli`; five scenes

Paths from `alye-parusa-v2/`.

**Module `nebo.js` — the hour.**

- `follow(scene)` (modules/nebo.js:126-134): `'change'` and `'move'` of `hour` → six `scene.set` — `day, dawn, dusk,
  night, sun_light, moon_light` — pure functions of `hour` (`looks()` :103-109, `shine()` :111-115) written into six keys
  that the looks and two lights' `on` read. Four objects a call. Used by main, paluba, dom-longrena, zamok-greev;
  les-u-morya has its own handler writing ten keys (the six and `sun_bearing, sun_height, moon_bearing, moon_height` —
  the far lights' `place`; scenes/les-u-morya/script.js:8-14). Every cut also carries the same derived keys
  (`nebo.keys(hour)` folded into each beat's `from`).
- `skyMotion(e, o)` (:240-271), the sky's animate in all five scenes: 29 uniforms, 4 layer properties and 2 `e.glow` a
  frame, from `hour` (and `storm` in paluba) alone — no time, no memory. Four of the 29 are the scene's constants
  (`horizon`, `x0`, `span`, `all_round`). A frame makes three 2-arrays and four template strings (:178, :228, :237-238).
  It runs where the sky is not seen (two scenes are rooms). The sun's and the moon's places go out twice a frame: as
  their layers' x, y (so the points `sky#sun`, `sky#moon` — the far lights' `from` — and the glows travel) and as
  uniforms (the shader draws the discs itself by reading those layers with an offset, tools/nebo-sky.glsl:68, 72).
  Time is in the shader alone: clouds `0.0012·u_time`, storm banks `0.01·u_time`, stars `noise1(u_time·(1.5…4.5) + …)`.

**Module `korabli.js` — the ship** (main, dom-longrena: 22 elements on the scene's unseen anchor — 7 hull plates, 2 deck
planes, a break, a rig, 2 mast cards, 9 sails; written into scene.json by tools/korabl.js).

- 15 animates a ship: 9 × `sailMotion` (:166-171) — 3 uniforms each from `sails_set`, `sails`, `luff`; 3 × `hullMotion`
  (:272-277) — a layer's alpha and 1–2 glows from `lanterns`; 2 × `mastMotion` (:434-439) — the yards' y from
  `sails_set`, with `SQUARE.filter(…)` a new array each frame; 1 × `rigMotion` (:402-415) — 3 glows from `lanterns`,
  the anchor's place (`e.where`) and `sails`. All functions of keys alone. None has a guard: all 15 run with the ship
  9 km off (main) or out of every line of sight (dom-longrena, where her keys never change and her glows are always 0).
- `swell(scene, key, every, most)` (:443-451): `scene.every(4.2)` starts `scene.move(key, ±most·(0.6 +
  0.4·random), {over: 4.2, ease: 'inOut'})`, the sign kept in a closure — the anchor's `tilt` key is always moving, so
  the 22 elements on it change every frame. main `ship_roll` 1.4°, dom-longrena 1.6°.
- The cloth's motion is the shader's (tools/korabl-cloth.glsl): gust `noise1(0.23·u_time + 7·seed)`, folds by
  `wobble2` scrolling with `u_time`.

**«Берег Каперны» (main)** — 23 animates: the sky, the ship's 15, and

| Animate | Where | Reads | Writes a frame | Kind |
|---|---|---|---|---|
| lighthouse_light | elements/lighthouse_light.animate.js:3-15 | `e.t`; `night, dusk, dawn, mist` | 1 glow, 5 layer properties | the lamp turns with a period of 8 s: `turn = e.t/8·2π`, flash `max(0, cos turn)^8`, the beam's side by `sin turn`; worked out by day too |
| lit_windows | elements/lit_windows.animate.js:1-4 | `windows`, `longren_window` | 43 `e.glow` | keys alone |
| tavern_light, sea, mist, veil | — | one key each | 1–4 properties, 0–2 glows | keys alone |
| toy | elements/toy.animate.js:1-3 | `toy_water`, `e.t` | alpha; `rotate = 0.04·noise(0.5·e.t)` | rocks at alpha 0 too |

Script: `'move' ship` → `put` writes `ship_across, ship_distance, ship_facing, ship_spark` from `L.shipAt(ship)`
(script.js:8-11; lib.js:29-33: `distance = exp(mix(ln 9000, ln 260, come))`) — four keys a frame while `ship` moves.
Midnight is crossed by hand: `await s.move("hour", 1); s.set("hour", 0); await s.move("hour", 0.215)` (lib.js:673-675).

**«Палуба» (paluba)** — 36 animates, all functions of keys alone (none reads `e.t`, `e.dt`, `e.mem`): the sky; 12
square-sail halves × 6 uniforms (`head, foot, set, scarlet, luff, wind`; lib.js:80-89); masts' yards; gaff sails;
lanterns; Lisse's windows; quay lamps; silk bolts; wheel; cask. On the ship `secret`: 104 uniforms, 45 layer properties
and 9 glows a frame (the probe: 104, 45, 9).

- The voyage. The camera rides (`camera.on: "ship"`); three unseen anchors stand one on another — `course` (`place:
  {across: ship_x, distance: ship_d, facing: ship_f}`), `hull` on it (`facing: 90`, `place: {tilt: heel}`), `ship` on
  that (`facing: 270`) — the 90/270 pair turns the tilt's axis along the keel. 52 elements stand at depth 3; the world
  (Kaperna 6 km off, Lisse's harbour at −30 km, the sea plane) lies still.
- `scene.every(0.25, run)` (script.js:43-54) is the ship's way: it reads `ship_x`, `ship_d` back from the state and
  issues `scene.move('ship_x', x + v·sin(turn)·0.5, {over: 0.5, ease: 'linear'})` and the same for `ship_d` — half a
  second ahead, replaced every quarter of a second; `v = 4·sails_set·(1 − 0.7·luff)` (lib.js:362-367). The steamer's
  `steamer_d` the same at 2.6 m/s.
- `scene.every(3.2, swing)` (script.js:25-33): `scene.move('heel', −12·roll + side·mix(1.2, 7, storm)·…·random, {over:
  3.2})`; the sign in a closure. So `heel`, and under sail `ship_x`, `ship_d`, are always moving: the anchors, 53
  elements and the camera move every frame.
- 23 handlers write derived keys: `harbour_lit` from `night`, `dusk` (themselves derived); five rig keys (`belly_l,
  belly_r, belly_tilt, fore_tg_e, main_tg_e`) from `sails_set`, `luff` (lib.js:94-99); `ship_f` from `heading`; the
  ship's and the steamer's places from `shore`, `port`, `steamer`.

**«Дом Лонгрена» (dom-longrena)** — 22 animates: the sky, the ship's 15 (all constant here), and `flame` (`scaleY = 1 +
0.1·noise(1.9·e.t)`, `rotate = 0.06·noise(1.3·e.t)`; wavers at alpha 0), `lamp`, `shelves` (11 alphas), `toy`, `work` (2
alphas from people's `_with` keys), and the insert `closeup`:

- `liveRig` (lib.js:385-417): 33 layer properties; a pose from four keys (`rigged`, :189-202), rocking by noise of
  time, and her hand following its target — `m.x += (to − m.x)·(1 − exp(−9·e.dt))` — the one animate of the world with
  memory besides zamok-greev's. Objects and arrays anew each frame.
- `livePage` (lib.js:576-591): a beetle along a curve by the key `beetle`, its legs by the way gone, swaying only while
  the key has speed; one `e.at` a frame.
- It finds whether it is open by a layer's `scaleX`, not by the key `closeup`.

Script: `'move'` of `chest`, `sails_window`, `door`, `window_open` → `place` sets six place keys, whichever moved
(script.js:11-18; lib.js:123-133: `door_facing = 180 − 82·door`, `window_left_facing = 180 + 80·w` …). `'move'` of
Longren's two place keys → `chest = L.pulled(lo_a, lo_d)` while his gait is `drag` (script.js:24-28) — the chest's
place read back from the walker's, each frame, which fires the handler above in the same frame.

**«Лес у моря» (les-u-morya)** — 9 animates: the sky; 7 × `mistNow` (lib.js:572-577: a bank's alpha and scaleY from the
key `mist`); `fire_pit` (an alpha from `fire`). No time, no memory, no timer. The 520 crown layers, up to 864 grass
layers and 54 tufts sway by the engine's `wind`. `'move' ring_at` is a threshold detector for a mini-game
(script.js:32-45). Four polled conditions, two of them on a walker's place (`s.until(() => s.state.gr_a > 23.2)`,
lib.js:742, 797).

**«Замок Греев» (zamok-greev)** — 11 animates: the sky; five that set one uniform from one key (candles, fire,
firebox, floor_lamp, ship_painting); note, table, coat (a layer's alpha/y from a key); `crucifix` (12 properties from
three keys); and the insert `canvas` (elements/canvas.animate.js:4-24) — a brush hand that follows the last nail whose
key is moving (`e.speed`), with an exponential follower (5 a second) and a "busy" follower (8 a second) in `e.mem`,
plus sines of time; no test of the insert's key. The candles' flicker is in the shader (`1 + 0.06·sin(7.3t + 2k) +
0.04·sin(11.9t + 1 + 3k) + 0.03·sin(2.3t + k)`, candles.glsl:9). Script: a chain through the state each frame of a walk
— the walk moves `gr_a` → `pulled` sets `ladder` → `put` sets `ladder_across` and `door_facing` → the ladder's `place`
(script.js:10-29). Seven polled conditions (lib.js:292, 327, 423-429, 447).

### 3.5 Ночь перед Рождеством v2

Paths from `noch-pered-rozhdestvom-v2/`. Every element file is one line calling the lib.

**«Полёт» (polyot)** — 55 animates in 6 bodies.

| Animates | Function | Reads | Writes a frame | Kind |
|---|---|---|---|---|
| 50 window cards (24 huts, 24 city, 2 palace) | `windowsMotion` lib.js:392-399 | `windows`, `dawn` | 50 alphas, 37 `e.glow`, 26 writes of the constant brightness 1.7 | keys alone: `k = windows·(1 − 0.3·dawn)`; no guard — runs for cards 6 km away |
| sky, stars, moon, glints | lib.js:856-939, each calling `hour()` (lib.js:814-839) | `moon, dawn, moon_near, blizzard, stars` | 13 + 5 + 2 uniforms; 9 layer properties, 1 glow, 1 `e.at` | keys alone; `hour()` is worked out four times a frame |
| windmill_sails | lib.js:370-375 | `e.dt`, `blizzard`, `e.mem.a` | 1 rotation | `m.a += dt·(0.12 + 0.25·blizzard)` — a turn every 52 s in calm, 17 s in a blizzard |

Script (script.js): `scene.every(0.05)` — the steering: if `bank`, `camera_x += bank·1.4`; if `climb`, `camera_h +=
climb·0.7`, by ticks, not by dt (:22-28) — 28 and 14 metres a second set at once twenty times a second;
`scene.every(0.35)` — the seat's jolt by chance (:39-43). `'move'` handlers write derived keys each frame: `camera_z =
progress·6280` (:13 — for nearly the whole flight), `camera_roll = 25·bank`, `camera_pitch = 12·climb − 14·look`
(:14-15), `vakula_look` (:16-20), and the witch's broom — four place keys from one key along a curve of 9 points
(:52-70). A beat turns the camera by eight `q.move('camera_yaw', …)` in a row, kept in step with the witch's key only
by equal lengths (lib.js:1122-1129).

**«Диканька» (main)** — 14 animates in 6 bodies: 9 window cards (`windowsMotion`, lib.js:193-198: 9 alphas, 14 glows;
keys alone); sky 13 uniforms, glints 3, moon 9 layer properties + 1 glow + 1 mark (keys alone, and the camera while the
moon rises — `e.point('chimney_solokha#mouth')`); the insert `wall` (2 alphas, no test of its key); and `stars`
(lib.js:644-663) — 6 uniforms and up to 24 more: a sampler built inside an animate, every 0.33 s while `scooping`, of
where the broom's tail is seen on the sky (`e.point('broom#tail')`), up to 12 points kept in `e.mem`. No `scene.every`,
no handler but the module's. The witch's flight (lib.js:995-1007): one `s.path` of 97 points at 7.5 m/s, and beside it
a loop of 96 turns of `s.set('scooping', …)`, `s.turn('broom_turn', …, T)`, `await s.wait(T)` — the turn and the flag
depend only on the place along the way but are kept in step with it by the sum of waits.

### 3.6 Хризалиды — кино-игра v2 — «Насыпь у ручья»

Paths from `khrizalidy-kino-igra-v2/`. 10 animates, no `scene.every`.

- **The horse** (modules/chrysalids.js:117-222, :281-393): 120 layers — the body, neck, head and tail each painted in 24
  views (every 15°), and 12 leg bones in two sets (far, near). A frame writes 195 layer properties: 92 alphas of 0 on
  the 23 views not shown, 84 on the legs (two-bone reach in 3D, the shown set's `x, y, rotate, scaleY, alpha,
  brightness` and the other set's alpha 0), 19 on the shown view; 2 `e.at` marks (the head, the seat). Memory in
  `e.mem`: the pace eased (`m.v += (v − m.v)·min(1, 4·dt)`), the gait and its blend, the stride's phase added up by dt
  (`m.ph += m.v·dt/stride`). The pace is `e.speed` of three keys. Time terms: breath `sin(1.3t)`, idle head noise, a
  toss `sin(7t)·max(0, sin(2.1t))`, tail noise. It builds nothing a frame (scratch at module level). No guard: with
  the rider away — the scene's starting state — all 195 writes and both marks are made, the alphas 0.
- The rider is a person `on` the point `horse#seat` (`rider_on: {at: 'horse#seat', up: −0.5}`); his feet and hands
  reach for `{on: 'horse', at: […]}` points kept in the key `rider_reach`, which a `'move'` handler of `r_face` writes
  each frame the horse turns (scenes/nasyp-u-ruchya/script.js:6-9; chrysalids.js:397-402 — new objects each call).
  Those points do not bob with the body; only the seat does.
- `ridge` (elements/ridge.animate.js:4-25): a second, painted rider on the far crest, 5 layers, 23 properties a frame;
  `m.x += PACE·dt` while the key `someone_coming` is above 0 — an integrator the key only switches; it copies the
  module's walk constants by hand. Written at alpha 0 when nobody comes. A closure a frame.
- `closeup_foot` (insert; 30 properties: toes `curl = cu_wig·max(0, sin(6t + 1.1i))`), `closeup_iris` (2 uniforms from
  `closeup`), `closeup_glints` (the same constant uniform every frame) — none tests the insert's key.
- `dragonfly` (8 properties, sums of sines of time: periods 33, 12, 39, 15, 21 s), `stones` (12: `0.25 + 0.25·sin(1.7t +
  2i)`, `0.015·sin(t + i)`) — time alone. `rings`, `sky`, `stars` — keys alone, written every frame. The sky marks the
  point `sun` each frame; the far light is `from: "sky#sun"`.
- A nod and a wave are keys on a timer: `nod` sets a person's `_look` to a lower point, waits 0.28 s, sets it back,
  waits 0.27 s, n times (lib.js:221-228, five call sites); `wave` sets `_reach` seven times with waits of 0.32 s
  (lib.js:230-238).
- 115 wind layers (bank 64, fringe 22, willows 29) and 2 drifting clouds are the engine's.

### 3.7 What repeats across the scenes (counted from 3.1–3.6 and the probe)

| Pattern | Where |
|---|---|
| An animate that is a function of state keys alone and sets the same numbers every frame | most of the 276: e.g. all 36 of paluba, 50 of Полёт's 55, the 5 skies of Алые паруса (29 uniforms each), every "lit windows" animate |
| A function of time alone with a period or a fixed law | candles (burya flame, komnata candles + its shader, zamok shader), lighthouse (8 s), clock pendulum (2 s), dragonfly, stones, sawtooth flames (dzhungli), boats' bob and way (gavan), watch's second hand, close-up faces (blink 3.7 s, glance 1.9 s) |
| Memory that is only a clock or a phase added up by dt at a rate a key sets | medlin sconce (`m.p += dt`), skies' cloud phases (burya, padenie-doma-2), windmill, ridge's far rider |
| Memory that is a lag or a spring | burya (wind, shudder, ripple lags), cabs' trot (sevil-rou), two horses, two hands in inserts (dom-longrena, zamok-greev), Диканька's sweep sampler |
| A script writing a key from another key on every `'move'` | 16 of 20 scenes register `'move'` handlers (T11): door leaves (burya, ВС main, sevil-rou, dom-longrena, zamok-greev), the hour → six light keys (5 scenes), ship places (gavan, АП main, paluba), camera keys (Полёт, gavan, padenie-doma-2), `walk_at`/`run_at`/`pp_walk_at`, `fireflies`, `rider_reach` |
| A timer re-issuing short moves to keep a key going | train (0.25 s), paluba's ship (0.25 s), Полёт's steering (0.05 s), casements (0.12 s), camera shake (0.07 s), rolls and heel (2.7–4.6 s), clock (1 s), camera swim (0.9 s) |
| No guard: the work is done while the thing is absent, out, closed or far | every case above; the engine calls every animate every frame (thread.js:321-338) |
| Objects, arrays, strings or closures made on every call | closeups.live, ushers.horseLive, nebo.skyMotion, svet.london, crowd, cabs, komnata candles, tack, rigged/crawl (dom-longrena) |

## 4. Counts that drive cost

From scene.json and the paint probe (appendix A3, A4). "Sheet" — one recording: an element's base painting, one of its
layers, or one of its parts; "with ink" — its recording draws something. "Distinct pictures" — sheets whose recordings
have different hashes (the engine's own test of "the same picture", paint/recorder.js:14-15, :516-522). People are not
sheets. The probe sees the scene as it starts (gavan in Hong Kong, paluba on the `secret`).

Facts to read the tables by:

- **Widgets: 0 in every scene.**
- **Elements**: 2164 objects in all; four scenes hold 1460 of them (Лес 534, Полёт 529, Мэдлин 211, Диканька 186).
- **Sheets**: 5034 with ink, 4137 distinct. In Лес every one of 1831 is its own picture; in Полёт 888 sheets are 481
  pictures, in Мэдлин 207 are 68, in Диканька 229 are 135.
- **Written from one template**: 1462 of 1935 painted elements (4b) — `e.lib.house` ×433 (85 pictures),
  `e.lib.crown` ×298 (298), `e.lib.soffit` ×170 (38), `e.lib.grass` ×144 (144), `e.lib.khata` ×81 (38), `e.lib.church`
  ×54 (12), `e.lib.undergrowth` ×54 (54), `e.lib.chimney` ×24 + 7 (1 + 2), `e.lib.arch` ×17 (17), `e.lib.boat` ×11 (11).
  Kinds behind them, by reading (6.2, 6.4, 6.5): 2 trees, 1 grass, 2 undergrowth; huts in 2 builds (Полёт) and 5
  (Диканька), 12 city blocks of one kind, 2 church sizes; one arch bay.
- **Layers and parts**: 2684 layers (1880 of them bend in the engine's wind; 1431 are in Лес), 1155 parts. The most
  layers in one element: 133 and 120 (two horses), 114, 92, 73 (dzhungli's leaves), 64 (a bank's grass). The most
  parts: 298 (Лес's trunks), 87, 74, 66, 64.
- **Lights**: 137 entries in `lights` (31 far, 25 points, 10 carried at a person's point, 66 `of` an element's glow, 5
  daylight); 10 far lights come `through` panes (5 scenes). `e.light` glows standing in the world: 1259 — 943 of them
  in one scene (the train), then gavan 81, АП main 60, Полёт 58, ВС main 32, sevil-rou 25. Each is a point light of
  the scene (core/light.js:277-300; the engine's table holds 256, render/lights.js:37).
- **Shadows**: 1064 objects say `shadow` (1028 in the object form, 22 naming a light); by scene: Полёт 438 elements
  (854 quads), Лес 299 (1117 quads), Диканька 138 (205), dzhungli 37 (399 quads). People cast unless told otherwise
  (one is). Which lights cast cannot be read from a spec today: a caster takes "the strongest three" that light it
  (render/shadows.js:21-23, :49).
- **Mirrors**: 24 planes with `reflect` in 14 scenes — four in Лес, three in sevil-rou and paluba, two in dzhungli,
  gavan, zamok-greev. 7 panes of `glass` in 4 scenes. 15 inserts in 10 scenes (four in Насыпь, three in sklep).
- **Particles**: 99 emitters in 15 scenes. Weather round the eye: burya 2500 + 7000 rain, Диканька 42 000 blizzard,
  Полёт 40 000 blizzard + 20 000 snow (the engine holds 65 536, artist2.md:136). The rest are small; large sprites:
  smoke of 20 m (gavan), 18 m (paluba), 10–11 m (dzhungli, sevil-rou's fog), 9 m puffs (padenie-doma-2), 24 chimney
  smokes of 6 m (Полёт).
- **Largest painted surfaces**: draped ground 150 000 × 3997 m (train) and 100 000 × 100 000 m (Полёт); seas 40 000 ×
  60 000, 40 000 × 20 000, 12 020 × 9340 (a river), 6000 × 3000, 5000 × 9000, 3200 × 2500, 3000 × 1995 m; cards 147 km,
  130.6 km, 128.6 km wide (train), 5200 m, 3000 m, 2800 m, 1140 m wide.
- **Per-frame code**: 276 animates; at the starting state they write 2117 layer properties, 420 uniforms and 248
  `e.glow` a frame over the 20 scenes — the most: Ашеры main 720 layer properties (589 the horse, 98 a close-up that
  is closed), dzhungli 600 (594 the pyre's flames, the fire out), Насыпь 277 (195 the horse, absent), paluba 104
  uniforms, АП main 56 uniforms and 55 glows. In Node the 276 animates took between 0 and 250 microseconds a frame
  per scene — the arithmetic is small; what each write sets going in the engine (a glow changed → the light set, a
  uniform → the material, a key set by a script → handlers, places, lights) was not measured.
**4a. Elements and painted sheets**

| Scene | Objects | card | plane | sky | insert | unseen | emitters | people (here at start) | stand `on` another | have `place` | painted elements | of them base empty | layers | parts | sheets with ink | distinct pictures | quads (elements+layers+parts) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Аш / burya-i-chtenie | 32 | 17 | 3 | 1 | 1 | 0 | 7 | 3 (1) | 2 | 6 | 22 | 6 | 12 | 0 | 28 | 27 | 34 |
| Аш / komnata-roderika | 20 | 11 | 1 | 1 | 1 | 0 | 3 | 3 (2) | 0 | 3 | 14 | 4 | 15 | 0 | 25 | 25 | 29 |
| Аш / main | 22 | 14 | 3 | 2 | 1 | 0 | 0 | 2 (1) | 0 | 3 | 20 | 9 | 204 | 0 | 210 | 170 | 224 |
| Аш / medlin-prokhodit | 211 | 199 | 6 | 0 | 1 | 0 | 1 | 4 (3) | 0 | 4 | 206 | 2 | 3 | 0 | 207 | 68 | 209 |
| Аш / padenie-doma-2 | 19 | 7 | 3 | 1 | 0 | 0 | 5 | 3 (0) | 0 | 6 | 11 | 0 | 44 | 0 | 55 | 55 | 55 |
| Аш / sklep | 31 | 15 | 5 | 1 | 3 | 1 | 3 | 3 (3) | 7 | 5 | 24 | 4 | 11 | 1 | 32 | 31 | 36 |
| Аш / treshchina | 3 | 0 | 0 | 3 | 0 | 0 | 0 | 0 (0) | 0 | 0 | 3 | 0 | 6 | 0 | 8 | 8 | 9 |
| ВС / dzhungli | 86 | 38 | 11 | 1 | 0 | 3 | 12 | 21 (4) | 29 | 21 | 48 | 10 | 388 | 83 | 508 | 498 | 519 |
| ВС / gavan | 68 | 46 | 12 | 1 | 0 | 3 | 2 | 4 (0) | 18 | 6 | 59 | 25 | 63 | 77 | 160 | 80 | 199 |
| ВС / iz-okna-poezda | 27 | 14 | 5 | 1 | 1 | 2 | 0 | 4 (4) | 16 | 7 | 21 | 1 | 11 | 0 | 31 | 30 | 32 |
| ВС / main | 50 | 25 | 12 | 1 | 0 | 0 | 3 | 9 (6) | 1 | 12 | 38 | 4 | 17 | 16 | 67 | 49 | 71 |
| ВС / sevil-rou | 61 | 34 | 13 | 1 | 0 | 1 | 6 | 6 (3) | 17 | 9 | 48 | 3 | 33 | 61 | 139 | 80 | 142 |
| АП / dom-longrena | 67 | 47 | 12 | 1 | 1 | 3 | 0 | 3 (2) | 29 | 10 | 61 | 5 | 30 | 0 | 86 | 85 | 91 |
| АП / les-u-morya | 534 | 513 | 5 | 1 | 0 | 3 | 9 | 3 (0) | 151 | 3 | 519 | 510 | 1431 | 392 | 1831 | 1831 | 2342 |
| АП / main | 50 | 34 | 7 | 1 | 0 | 1 | 0 | 7 (7) | 22 | 8 | 42 | 7 | 24 | 32 | 76 | 76 | 98 |
| АП / paluba | 70 | 49 | 6 | 1 | 0 | 6 | 1 | 7 (1) | 63 | 22 | 56 | 14 | 31 | 0 | 73 | 61 | 87 |
| АП / zamok-greev | 69 | 43 | 18 | 1 | 1 | 1 | 3 | 2 (0) | 5 | 4 | 63 | 5 | 26 | 14 | 98 | 85 | 103 |
| Ночь / main | 186 | 91 | 69 | 3 | 1 | 0 | 11 | 11 (1) | 137 | 13 | 164 | 15 | 16 | 64 | 229 | 135 | 244 |
| Ночь / polyot | 529 | 297 | 195 | 3 | 0 | 2 | 29 | 3 (1) | 418 | 6 | 495 | 75 | 53 | 415 | 888 | 481 | 963 |
| Хр / nasyp-u-ruchya | 29 | 12 | 3 | 2 | 4 | 0 | 4 | 4 (2) | 0 | 7 | 21 | 4 | 266 | 0 | 283 | 262 | 287 |
| **all 20** | 2164 | 1506 | 389 | 27 | 15 | 26 | 99 | 102 (41) | 915 | 155 | 1935 | 703 | 2684 | 1155 | 5034 | 4137 | 5774 |

**4b. Things written from one template (the element's `code` is the same text but for its numbers and strings), three elements or more**

| Scene | Template (the code's text, numbers → N, strings → S) | Elements | Sheets with ink | Distinct pictures (by the recordings' hashes) | Layers each | Parts each |
|---|---|---|---|---|---|---|
| Аш / medlin-prokhodit | `e.lib.soffit(g, e);` | 170 | 170 | 38 | 0–0 | 0–0 |
| Аш / medlin-prokhodit | `e.lib.arch(g, e);` | 17 | 17 | 17 | 0–0 | 0–0 |
| Аш / medlin-prokhodit | `e.lib.room(g, e, N, N);` | 6 | 6 | 2 | 0–0 | 0–0 |
| Аш / medlin-prokhodit | `e.lib.room(g, e, N, N, true);` | 4 | 4 | 1 | 0–0 | 0–0 |
| Аш / sklep | `g.fillStyle = S; g.fillRect(N, N, N, N); g.fillStyle = S; g.fillRect(N…` | 4 | 4 | 4 | 0–0 | 0–0 |
| ВС / dzhungli | `const T = e.lib.plan.temple.tower; const [a, yN] = T[N]; const [b, yN]…` | 6 | 6 | 2 | 0–0 | 0–0 |
| ВС / gavan | `e.lib.boat(e, N);` | 11 | 22 | 11 | 2–2 | 0–0 |
| ВС / gavan | `e.lib.mist(e, N, N);` | 4 | 8 | 4 | 2–2 | 0–0 |
| ВС / gavan | `g.fillStyle = S; g.fillRect(N, N, N, N); g.fillStyle = S; for (let y =…` | 3 | 3 | 3 | 0–0 | 0–0 |
| ВС / main | `e.lib.reveal(g, S);` | 12 | 12 | 3 | 0–0 | 0–0 |
| АП / dom-longrena | `e.kit.korabli.sail(g, e, S, S);` | 9 | 9 | 9 | 0–0 | 0–0 |
| АП / dom-longrena | `e.kit.korabli.hull(g, e, S, S);` | 7 | 10 | 7 | 0–1 | 0–0 |
| АП / dom-longrena | `g.fillStyle = S; g.fillRect(N, N, N, N); g.fillStyle = S; g.fillRect(N…` | 4 | 4 | 3 | 0–0 | 0–0 |
| АП / dom-longrena | `g.fillStyle = S; g.fillRect(N, N, N, N);` | 3 | 3 | 3 | 0–0 | 0–0 |
| АП / les-u-morya | `e.lib.crown(e, N);` | 298 | 520 | 298 | 1–2 | 0–0 |
| АП / les-u-morya | `e.lib.grass(e, N);` | 144 | 833 | 144 | 4–6 | 0–0 |
| АП / les-u-morya | `e.lib.undergrowth(e, N);` | 54 | 54 | 54 | 1–1 | 0–0 |
| АП / les-u-morya | `e.lib.mist(e, N);` | 7 | 7 | 7 | 1–1 | 0–0 |
| АП / les-u-morya | `e.lib.streamPainting(g, N, N, N, N, N, S);` | 3 | 3 | 3 | 0–0 | 0–0 |
| АП / main | `e.kit.korabli.sail(g, e, S, S);` | 9 | 9 | 9 | 0–0 | 0–0 |
| АП / main | `e.kit.korabli.hull(g, e, S, S);` | 7 | 10 | 7 | 0–1 | 0–0 |
| АП / paluba | `e.lib.squareHalf(g, e, S, N);` | 12 | 12 | 12 | 0–0 | 0–0 |
| АП / paluba | `e.lib.silkStack(g, e, N);` | 4 | 8 | 3 | 1–3 | 0–0 |
| АП / paluba | `e.layer(S, {}, g => e.lib.town(g, N, true));` | 3 | 3 | 3 | 1–1 | 0–0 |
| АП / paluba | `e.lib.lantern(g, e);` | 3 | 6 | 1 | 1–1 | 0–0 |
| АП / zamok-greev | `g.fillStyle = S; g.fillRect(N, N, N, N);` | 24 | 24 | 17 | 0–0 | 0–0 |
| Ночь / main | `e.lib.khata(g, e);` | 81 | 81 | 38 | 0–1 | 0–0 |
| Ночь / main | `e.lib.church(g, e);` | 54 | 54 | 12 | 0–0 | 0–0 |
| Ночь / main | `e.lib.chimney(g, e);` | 7 | 7 | 2 | 0–0 | 0–0 |
| Ночь / main | `e.lib.well(g, e);` | 5 | 5 | 2 | 0–0 | 0–0 |
| Ночь / main | `e.lib.poplar(g, e);` | 3 | 3 | 3 | 1–1 | 0–0 |
| Ночь / polyot | `e.lib.house(g, e);` | 433 | 433 | 85 | 0–1 | 0–0 |
| Ночь / polyot | `e.lib.chimney(g, e);` | 24 | 24 | 1 | 0–0 | 0–0 |
| Ночь / polyot | `e.lib.firs(g, e);` | 12 | 238 | 10 | 0–0 | 6–26 |
| Ночь / polyot | `e.lib.cloud(g, e);` | 8 | 133 | 8 | 0–0 | 13–24 |
| Ночь / polyot | `e.lib.stog(g, e);` | 7 | 7 | 3 | 0–0 | 0–0 |

In all: 1462 elements and 2752 sheets are in such groups, of 1935 painted elements and 5034 sheets.

**4c. Lights, shadows, mirrors**

| Scene | `ambient` (base) | looks with `ambient` | `lights` entries: far / point / carried `at` / `of` / daylight | of them `through` | e.light glows standing in the world (the most in one element) | sky/insert glows | light sources in all | elements with `shadow` (their quads) | people casting | `shadow.light` named | `translucent` | `glows` | `inside` | planes `lit` | mirrors (`reflect`) | `glass` | inserts |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Аш / burya-i-chtenie | 0.5 | lightning | 2 / 3 / 1 / 2 / 0 | 2 | 1 (flame 1) | 0 | 7 | 6 (8) | 3 | gap×1, candle×1 | 3 | 3 | 0 | 0 | — | — | 1: closeup |
| Аш / komnata-roderika | 0.5 | window_day, window_dusk | 2 / 2 / 0 / 5 / 0 | 2 | 8 (candles 5) | 0 | 12 | 4 (8) | 3 | — | 1 | 1 | 0 | 0 | — | — | 1: closeup |
| Аш / main | — (unlit) | — | 1 / 1 / 0 / 0 / 0 | 0 | 3 (windows 1) | 0 | 5 | 1 (134) | 2 | — | 0 | 0 | 0 | 0 | 1: tarn | — | 1: closeup |
| Аш / medlin-prokhodit | 0.6 | — | 2 / 0 / 0 / 1 / 0 | 2 | 1 (sconce 1) | 0 | 3 | 0 (0) | 4 | — | 0 | 2 | 0 | 0 | 1: floor | — | 1: closeup |
| Аш / padenie-doma-2 | — (unlit) | — | 2 / 0 / 0 / 1 / 0 | 0 | 4 (house 3) | 0 | 6 | 0 (0) | 3 | — | 0 | 0 | 0 | 0 | — | — | — |
| Аш / sklep | 0.65 | — | 0 / 0 / 1 / 1 / 0 | 0 | 0 | 8 | 1 | 7 (8) | 2 | — | 0 | 0 | 0 | 0 | — | — | 3: closeup, inside, outside |
| Аш / treshchina | — (unlit) | — | 0 / 0 / 0 / 0 / 0 | 0 | 0 | 0 | 0 | 0 (0) | 0 | — | 0 | 0 | 0 | 0 | — | — | — |
| ВС / dzhungli | 0.6 | day | 2 / 0 / 6 / 1 / 0 | 0 | 3 (pagoda 1) | 2 | 11 | 37 (399) | 21 | — | 3 | 2 | 0 | 3 | 2: river, stream | — | — |
| ВС / gavan | 1 | evening, night | 2 / 0 / 0 / 6 / 0 | 0 | 81 (city_lights 14) | 3 | 83 | 0 (0) | 4 | — | 1 | 1 | 1 | 9 | 2: water, quay | — | — |
| ВС / iz-okna-poezda | 1 | night | 2 / 0 / 0 / 3 / 1 | 0 | 943 (distant 789) | 2 | 946 | 2 (2) | 4 | — | 0 | 0 | 15 | 3 | 1: river | 1: glass | 1: watch_close |
| ВС / main | 0.8 | day | 0 / 3 / 0 / 6 / 0 | 0 | 32 (crowd 26) | 0 | 35 | 5 (23) | 9 | — | 0 | 3 | 0 | 4 | 1: floor | — | — |
| ВС / sevil-rou | 0.85 | night, sunday | 1 / 0 / 0 / 25 / 0 | 0 | 25 (lamps 13) | 0 | 26 | 10 (69) | 6 | — | 0 | 1 | 12 | 10 | 3: side_street, pavement, road | 2: terrace_glass, glass | — |
| АП / dom-longrena | 1 | day, dawn, dusk, night | 2 / 0 / 0 / 1 / 2 | 2 | 12 (ship_transom 4) | 2 | 16 | 13 (13) | 3 | sun×2 | 9 | 1 | 36 | 0 | 1: sea | 2: glass_left, glass_right | 1: closeup |
| АП / les-u-morya | 0.85 | dawn, dusk, night | 2 / 0 / 0 / 1 / 0 | 0 | 1 (fire 1) | 2 | 3 | 299 (1117) | 3 | — | 298 | 1 | 0 | 0 | 4: sea, pool_1, pool_2, pool_3 | — | — |
| АП / main | 1 | day, night, dawn, dusk | 2 / 0 / 0 / 0 / 0 | 0 | 60 (lit_windows 43) | 2 | 62 | 1 (1) | 7 | — | 9 | 3 | 0 | 0 | 1: sea | — | — |
| АП / paluba | 0.9 | dawn, dusk, night, storm | 2 / 0 / 0 / 7 / 0 | 0 | 7 (quay_lamps 4) | 2 | 9 | 23 (31) | 7 | sun×12 | 15 | 7 | 0 | 4 | 3: sea, poop_deck, main_deck | — | — |
| АП / zamok-greev | 0.8 | day, dawn, dusk, night | 2 / 1 / 1 / 6 / 2 | 2 | 6 (candles 2) | 2 | 12 | 14 (29) | 2 | sun×1, mother_light×2, fire_light×2, cross_light×1 | 0 | 0 | 61 | 4 | 2: sea, floor | 2: glass1, glass2 | 1: canvas |
| Ночь / main | 0.4 | moon, dawn, morning | 2 / 0 / 1 / 0 / 0 | 0 | 14 (hut4 2) | 2 | 17 | 138 (205) | 11 | — | 0 | 10 | 0 | 4 | 1: ice | — | 1: wall |
| Ночь / polyot | 0.22 | moon, moon_near, dawn | 1 / 15 / 0 / 0 / 0 | 0 | 58 (lamps 21) | 1 | 74 | 438 (854) | 3 | — | 8 | 51 | 0 | 3 | 1: river | — | — |
| Хр / nasyp-u-ruchya | 0.95 | evening, night | 2 / 0 / 0 / 0 / 0 | 0 | 0 | 0 | 2 | 1 (121) | 4 | — | 0 | 0 | 0 | 0 | — | — | 4: closeup, closeup_glints, closeup_foot, closeup_iris |

**4d. Particles** (alive ≈ rate × longest life + `count`, with the kind's defaults from core/particles.js; ×key — the emitter's `amount` is that state key)

| Scene | Emitters | Each: id kind ≈alive | Sum alive at full | Sprites over 2 m |
|---|---|---|---|---|
| Аш / burya-i-chtenie | 7 | rain_quiet rain≈2500; rain_storm rain≈7000 ×storm; drops_l, drops_r drops≈20; rain_in rain≈312 ×window; dust dust≈70 ×candle; grit puff≈112+burst 120 ×quake | 10034 | — |
| Аш / komnata-roderika | 3 | smoke_l, smoke_r smoke≈25 ×wick_smoke; dust dust≈168 | 218 | — |
| Аш / main | 0 | — | 0 | — |
| Аш / medlin-prokhodit | 1 | motes dust≈3200 | 3200 | — |
| Аш / padenie-doma-2 | 5 | house_dust puff≈60 ×house_dust; stones sparks≈49 ×stones; house_spray splashes≈56 ×spray; breach_spray splashes≈30 ×breaking; breach_boards sparks≈7 ×breaking | 202 | house_dust 9 m, house_spray 9 m |
| Аш / sklep | 3 | holder_fire, flame fire≈25 ×torch; embers embers≈11 ×torch | 61 | — |
| Аш / treshchina | 0 | — | 0 | — |
| ВС / dzhungli | 12 | steam smoke≈18; pyre_embers embers≈23 ×pyre_fire; smoke smoke≈660 ×smoke; fire_pb1…(6) fire≈36 ×torches; fireflies fireflies≈320 ×fireflies; motes dust≈168; leaf_fall leaves≈12 | 1417 | steam 2.4 m, smoke 10 m |
| ВС / gavan | 2 | smoke smoke≈120 ×steamer_smoke; gulls fireflies≈35 (own sprite) | 155 | smoke 20 m |
| ВС / iz-okna-poezda | 0 | — | 0 | — |
| ВС / main | 3 | flames fire≈63 ×fire; embers embers≈14; dust dust≈112 | 189 | — |
| ВС / sevil-rou | 6 | mist smoke≈203 ×fog; droplets dust≈5320 ×fog; smoke1…(4) smoke≈36 | 5667 | mist 11 m, smoke1 2.6 m |
| АП / dom-longrena | 0 | — | 0 | — |
| АП / les-u-morya | 9 | flame fire≈50 ×fire; embers embers≈18 ×fire; spray_0…(7) puff≈27+burst 24 | 257 | — |
| АП / main | 0 | — | 0 | — |
| АП / paluba | 1 | smoke smoke≈108 ×steamer_smoke | 108 | smoke 18 m |
| АП / zamok-greev | 3 | flames fire≈36 ×fire; fire_embers embers≈23 ×fire; dust dust≈4160 | 4219 | — |
| Ночь / main | 11 | smoke_chub…(7) smoke≈50; sparks_solokha sparks≈220+burst 220 ×chimney_sparks; soot_solokha puff≈0+burst 40; witch_trail embers≈156 ×witch_trail; blizzard_snow blizzard≈42000 ×blizzard | 42726 | smoke_chub 2.8 m, smoke_solokha 2.8 m, smoke_smithy 2.8 m, smoke_hut1 2.8 m |
| Ночь / polyot | 29 | dikanka1_smoke…(24) smoke≈48; witch_trail embers≈182 ×witch_trail; hat_off leaves≈0+burst 1 (own sprite); landing puff≈0+burst 60; snowfall snow≈20000 ×snow; blizzard_snow blizzard≈40000 ×blizzard | 61334 | dikanka1_smoke 6 m, khutir1_smoke 6 m, village1_1_smoke 6 m |
| Хр / nasyp-u-ruchya | 4 | chimney_smoke smoke≈18; drops splashes≈0+burst 10; motes dust≈56; dust puff≈0+burst 16 | 74 | chimney_smoke 3.2 m |

**4e. Largest painted surfaces (the element's box, metres), most layers, most parts**

| Scene | Five largest boxes | Most layers | Most parts |
|---|---|---|---|
| Аш / burya-i-chtenie | wall 16×6.7 m; floor 16×6.4 m; fissure 6.7×3.7 m +2 layers; corridor 3.2×3.3 m; curtain 2×5.1 m | sky 4, door_gap 2, feet 2, fissure 2 | — |
| Аш / komnata-roderika | wall 28×12.3 m; floor 28×9.5 m; window 5.6×4.1 m +4 layers; curtain 5.2×3.9 m +4 layers; fissure 1.8×10.8 m +2 layers | window 4, curtain 4, clock 4, fissure 2 | — |
| Аш / main | tarn 240×97 m; far_shore 340×13 m; mist_far 280×8 m +3 layers; house 60×34 m; windows 50×24.5 m +3 layers | rider 133, crack 19, closeup 15, reeds_mid 10 | — |
| Аш / medlin-prokhodit | wall_l 85×11.2 m; wall_r 85×11.2 m; floor 6.6×85 m; ceiling 6.6×85 m; windows 72×6.3 m | crack 2, sconce 1 | — |
| Аш / padenie-doma-2 | above_tarn 180×100 m; rings 130×130 m; below_tarn 180×60 m; mist 360×20 m +1 layers; house_mirror 92×57 m +8 layers | reeds 16, sky 9, house_mirror 8, house 6 | — |
| Аш / sklep | arch2 28×9.1 m; arch1 28×9.1 m; floor 20×10 m; wall 20.1×5.5 m; mist_back 18×1.7 m +2 layers | inside 3, outside 3, mist_back 2, mist_front 2 | plinth 1 |
| Аш / treshchina | — (sky elements only) | crack 3, knot 3 | — |
| ВС / dzhungli | far 640×54 m +1 parts; ground 280×85 m; river 120×128 m; procession 190×4.2 m; mist_stream 220×3.3 m +2 layers | near_leaves 114, undergrowth 92, canopy 73, pyre_flames_near 55 | forest 74, near 8, far 1 |
| ВС / gavan | water 3000×1995 m; far 3000×342 m; city_lights 3000×342 m +1 layers; boat_1 824×17 m +2 layers; boat_3 824×17 m +2 layers | lanterns_eaves 7, lanterns 6, lanterns_back 6, sky 5 | piles 66, bollards 7, tables 4 |
| ВС / iz-okna-poezda | ground 150000×3997 m; far 147000×975 m; distant 130600×82 m +1 layers; mid 128600×27 m +1 layers; river 9288×298 m | sky 3, watch_close 3, distant 1, mid 1 | — |
| ВС / main | mist 74×19.5 m +2 layers; pavement 60×24 m; street 48×25 m +2 layers; wall 52.4×16.3 m; floor 52×16 m | crowd 6, clock 5, street 2, mist 2 | table 11, lamps 3, fogg_chair 2 |
| ВС / sevil-rou | pavement 210×13.6 m; road 210×12.8 m; side_l 129×15.1 m; side_r 129×15.1 m; side_far 60×30.1 m | cab 12, cab2 12, club_rooms 2, bag 2 | lamps 13, dormer_l 11, dormer_r 11, cheeks_l 11 |
| АП / dom-longrena | sea 40000×20000 m; ship_rig 49×32 m +1 layers; ship_main 17.2×27.2 m +3 layers; ship_fore 17.2×24.2 m +3 layers; ship_jib_outer 18.2×20.4 m | shelves 11, sky 3, ship_fore 3, ship_main 3 | — |
| АП / les-u-morya | sea 6000×3000 m; land 140×145 m; mist_6 884×7.5 m +1 layers; mist_5 408×7.6 m +1 layers; mist_4 204×6.3 m +1 layers | bushes 7, grass_0 6, grass_1 6, grass_2 6 | trees 298, stones 87, fall 7 |
| АП / main | sea 3200×2500 m +1 layers; mist 3000×62 m +3 layers; lighthouse 560×54 m; lighthouse_light 560×54 m +3 layers; cape 630×37 m | sky 3, mist 3, ship_fore 3, ship_main 3 | kaperna 17, lit_windows 15 |
| АП / paluba | sea 40000×60000 m; kaperna 1140×72 m; lisse_upper 200×31 m; lisse_upper_windows 200×31 m +1 layers; quay_top 32×140 m | sky 3, mainmast 3, foremast 3, silk 3 | — |
| АП / zamok-greev | sea 5000×9000 m; park 80×120 m; floor 8.5×10.5 m; ceiling 8.5×10.5 m; shelves 10.6×6.1 m | canvas 7, crucifix 6, sky 3, ship_painting 3 | trees 14 |
| Ночь / main | snow 4000×2510 m; road 270×92 m; street 18×122 m; ice 10×27 m; glints 26×5.5 m | moon 2, wall 2, poplar1 1, poplar2 1 | fence 64 |
| Ночь / polyot | ground 100000×100000 m; river 12020×9340 m; road 130×5500 m; cloud4 140×140 m +18 parts; cloud5 140×140 m +24 parts | moon 2, dikanka1 1, dikanka2 1, dikanka3 1 | forest1 26, forest2 26, forest3 26, forest6 26 |
| Хр / nasyp-u-ruchya | far_hills 5200×80 m; ridge 2800×42 m +5 layers; meadow 600×170 m; stream 70×4.8 m; bank 32×3.5 m +64 layers | horse 120, bank 64, fringe 22, willow_r 11 | — |

**4f. Shaders and per-frame code** (per frame: what the animates do in one frame with the state as scene.json starts it — the probe, 120 frames averaged)

| Scene | Elements with a shader (distinct texts) | Uniforms declared | Elements with `animate` | Layer properties written a frame | Uniforms set a frame | e.glow calls a frame | e.at marks a frame | State reads a frame | Animates that failed in the probe |
|---|---|---|---|---|---|---|---|---|---|
| Аш / burya-i-chtenie | 3 (3) | 7 | 9 | 16 | 6 | 1 | 1 | 32 | — |
| Аш / komnata-roderika | 2 (2) | 8 | 6 | 15 | 8 | 8 | 0 | 21 | — |
| Аш / main | 0 (0) | 0 | 9 | 720 | 0 | 3 | 4 | 14 | — |
| Аш / medlin-prokhodit | 1 (1) | 2 | 3 | 3 | 2 | 0 | 0 | 7 | — |
| Аш / padenie-doma-2 | 3 (3) | 11 | 6 | 49 | 10 | 4 | 0 | 20 | — |
| Аш / sklep | 2 (2) | 15 | 4 | 2 | 15 | 8 | 0 | 13 | — |
| Аш / treshchina | 2 (2) | 4 | 2 | 0 | 4 | 0 | 0 | 6 | — |
| ВС / dzhungli | 2 (2) | 7 | 7 | 600 | 7 | 2 | 0 | 10 | — |
| ВС / gavan | 0 (0) | 0 | 23 | 85 | 0 | 38 | 0 | 41 | — |
| ВС / iz-okna-poezda | 6 (3) | 17 | 8 | 7 | 17 | 5 | 0 | 11 | — |
| ВС / main | 4 (4) | 17 | 7 | 22 | 17 | 29 | 1 | 9 | — |
| ВС / sevil-rou | 2 (2) | 9 | 12 | 60 | 9 | 20 | 1 | 15 | — |
| АП / dom-longrena | 10 (2) | 101 | 22 | 30 | 56 | 9 | 0 | 49 | — |
| АП / les-u-morya | 1 (1) | 29 | 9 | 19 | 29 | 2 | 0 | 9 | — |
| АП / main | 10 (2) | 101 | 23 | 26 | 56 | 55 | 0 | 50 | — |
| АП / paluba | 17 (3) | 150 | 36 | 45 | 104 | 9 | 0 | 127 | — |
| АП / zamok-greev | 6 (6) | 34 | 11 | 35 | 34 | 2 | 0 | 15 | — |
| Ночь / main | 3 (3) | 46 | 14 | 20 | 22 | 15 | 1 | 59 | — |
| Ночь / polyot | 4 (4) | 20 | 55 | 86 | 20 | 38 | 1 | 121 | — |
| Хр / nasyp-u-ruchya | 4 (4) | 4 | 10 | 277 | 4 | 0 | 3 | 12 | — |

**4g. Paintings that read the state** (the keys a painting read in the probe; it is painted again when one changes)

| Scene | Paintings that read a key | Keys read by more than one painting, or described `smooth` |
|---|---|---|
| Аш / burya-i-chtenie | 4 | crack → 1 (smooth; redraw step on wall) |
| Аш / komnata-roderika | 4 | crack → 1 (smooth; redraw step on fissure); evening → 1 (smooth) |
| Аш / main | 16 | day → 16; dusk → 16; mist → 16; window_light → 16 |
| Аш / medlin-prokhodit | 3 | light_shafts → 1 (smooth; redraw step on windows); low_sun → 1 (smooth; redraw step on windows); sconce → 1 (smooth; redraw step on sconce) |
| Аш / padenie-doma-2 | 5 | morning → 5 (smooth; redraw step on shore, reeds); moon → 2 (smooth; redraw step on shore, reeds) |
| Аш / sklep | 4 | crack → 2 (smooth) |
| Аш / treshchina | 2 | chapter_number → 2; chapter_title → 2; map → 2 |
| ВС / dzhungli | 1 | — |
| ВС / gavan | 34 | port → 34 |
| ВС / iz-okna-poezda | 0 | — |
| ВС / main | 2 | — |
| ВС / sevil-rou | 0 | — |
| АП / dom-longrena | 3 | — |
| АП / les-u-morya | 0 | — |
| АП / main | 0 | — |
| АП / paluba | 33 | ship → 33 |
| АП / zamok-greev | 0 | — |
| Ночь / main | 1 | — |
| Ночь / polyot | 1 | — |
| Хр / nasyp-u-ruchya | 0 | — |

## 5. The scenes that are unlit today

**What "unlit" is in the engine.** A scene is lit when `light.ambient` is a number, or a look that is in has one
(web/scene2/core/light.js:79 `base.lit = num(L.ambient) ? 1 : 0`, :93 and :130 for looks). Without it the paintings keep
their painted colours; the scene's `lights` and `light.people` light the people only (docs/worlds/people.md:231-237,
"A painted room"); a shadow darkens by a share ("paintedShadow", render/shadows.js:38-39); a plane's `lit` and a
particle's `lit` exist for such scenes only (core/spec.js:308-314, artist2.md:133, :144).

**Which scenes.** Three of the 20 have no `ambient` anywhere (appendix A4, `cost.mjs`): Ашеры / main, Ашеры /
padenie-doma-2, Ашеры / treshchina. The other 17 are lit (`ambient` 0.22 … 1 in the base light). `light.people` is set
in exactly the first two (0.3; main's look `day` raises it to 0.65). No scene sets a particle's `lit`. 44 planes in 9
scenes say `lit: true` — all nine are lit scenes (dzhungli 3, gavan 9, iz-okna-poezda 3, ВС main 4, sevil-rou 10, paluba
4, zamok-greev 4, Диканька 4, Полёт 3).

### 5.1 «Подъезд к дому» (Ашеры / main)

- `light` (scenes/main/scene.json:16-37): `grain`, `haze 0.12`, `hazeColor`, `tint`, `tintStrength`, `vignette`,
  `hazeGlow 0.5`, `people 0.3`, `ambientColor "#8d99a2"`; looks `day: {people: 0.65}` and `gloom: {brightness 0.78,
  saturation 0.8, haze 0.2, tintStrength 0.2}`. `lights` (:38-59): `sky` — far, `from [10, 35]`, `on: "day"`; `hall` —
  a point at across 0, distance 82, elevation 2, reach 5, `on: "door"`. Three things say `shadow: true` (the horse card
  and two people).
- The hour is paint. `lib.light(S)` (scenes/main/lib.js:21-24) reads four keys — `day`, `dusk`, `mist`, `window_light` —
  and `tone(lt, duskHex, dayHex, alpha, darkHex)` (lib.js:9-16) mixes every colour, written as a pair (dusk, day) or a
  triple, toward the hour, with a veil toward `#060a0f` by `0.42·dark`. A table of 8 pairs (lib.js:36-39) and pairs
  written in each element (sky.js:7-17, tarn.js:7-9, clouds.js:6, 16 …).
- 16 of the 20 paintings call `L.light(e.state)` and so read all four keys (the probe: `day, dusk, mist, window_light`
  read by 16 paintings; `rider` also `rider_present`). A change of any of the four paints all 16 again. In the scene's
  code the four are set only inside cuts, in three sets — `DUSK`, `DAY`, `MORNING` (lib.js:243-260). The key `gloom`
  paints nothing again: it is a look and four animates.
- Light sources in paint: the lamp window is a painted layer plus `e.light` (windows.js:11, strength `0.7·lamp` baked);
  the hall's warmth is a painted gradient seen through a hole cut in the house's painting with `destination-out`
  (lib.js:129, 132-136; hall.js:5-7) — the light `hall` in `lights` is a separate entry at a place copied by hand; the
  horse's shading is two numbers passed to the module (`light: 0.12 + 0.2·day`, `dark`, rider.js:3); the sky's glow on
  the horizon and the clouds' pale undersides are paint (sky.js:33-36).
- The tarn is a plane with `reflect` (strength 0.7, rough 0.22, ripple 0.12 — the only mirror in an unlit scene) and one
  element is `seen: "reflection"` (`vision`, scene.json:354) with a glow of its own.
- The close-up insert's light is the module's own (5.4).

### 5.2 «Падение дома» (Ашеры / padenie-doma-2)

- `light` (scenes/padenie-doma-2/scene.json:22-43): `ambientColor "#5a4a58"`, `people 0.3`, `grain`, `haze 0.08`,
  `hazeColor`, `vignette`, `wind`; the look `storm` changes `wind` alone. `lights` (:44-71): `moon` and `glow` — two far
  lights `from [0, 7]` and `from [-25, 32]`, both `on: "moon"`; `breach` — `of: "breach#glow"`, `on: "breaking"`. The
  scene's notes: the engine's light is on the people only.
- Everything that depends on the moon is painted twice — pale and red — and mixed by a uniform or a layer's alpha: the
  sky's base and `red`, clouds `high`/`highR` and `low`/`lowR`, the disc `disc`/`discR` (lib.js:146-153; the sky's shader
  reads nine layers), the house's stone and its rims (`L`/`Lr`, `R`/`Rr`, lib.js:314-315), the boards
  (`boards`/`boardsR`, lib.js:432-433). Light that depends on where its source is, is paint: clouds reddened by their
  distance from the moon (lib.js:119-121), rims on the roofs (:243-278), red in the windows (:228-236), the fissure's
  glow as three additive strokes (:296-306), the shore's sheen (:478-485), the reeds' tips (:528).
- There is no water plane. The tarn, the far shore and the moon's reflection are painted inside the **sky** element
  (`skyPaint`, lib.js:52-95; the reflected moon at `2·WL − cy`). The house's reflection is a second element,
  `house_mirror` — the same painting upside down in a palette × 0.42, anchored 56 m under the water (scene.json:121-137;
  lib.js:309-361) — moved by a second animate with the sign turned. Two unseen rectangles, `above_tarn` and
  `below_tarn` (180 × 100 m, 180 × 60 m, at distance 149.9 against the house's 150), are there only as `clip` shapes
  (scene.json:92-155). Three figures (the old 2D puppets of `ushers.figure`) are painted into a layer of the mirror —
  they exist only in the hand-made reflection (lib.js:331-351). People and the causeway have no reflection.
- Keys and what they paint again: `moon` — two paintings (`shore`, `reeds`), stepped by `redraw: {moon: 0.1, morning:
  0.5}` (scene.json:429-449; `moon` is moved over time once in the code); `morning` — five paintings (sky, mist,
  causeway, shore, reeds), set by one cut; `storm`, `fall` — none.

### 5.3 «Трещина» (Ашеры / treshchina)

Three sky elements (`wall`, `crack`, `knot`), no people, no lights, `light = {grain: 0.22, vignette: 0.7}`
(scenes/treshchina/scene.json:7). A title and choice-map card: text is painted with `g.font` and placed by
`g.measureText` (crack.js:10-13, knot.js:6-9), so the layout and the point `knot#end` depend on the fonts of the machine.
Its "light" is the wall's painted pool and embers shown through a shader's `emission`. A sky element is not darkened by
a lit scene (artist2.md:206), so for this scene "unlit" changes nothing that is drawn.

### 5.4 Inserts are unlit in every scene

An insert has "no haze, no camera, no depth" and its `e.light` is "a glow only" (artist2.md:110, :198). The 15 inserts of
10 scenes paint their own light: five scenes' close-ups by the module `closeups` (its `LIGHTS` table and `shade()`), the
others by their own gradients and shaders (sklep `inside`, `outside`; Насыпь's four; zamok-greev `canvas`; Диканька
`wall`; iz-okna-poezda `watch_close`; dom-longrena `closeup`).

## 6. What looks unusual, leans on a quirk of the present engine, or would be awkward for any redesign

By world; 6.7 gathers what is common. Each item is a fact about the sources, with its place.

### 6.1 Ашеры — modules, main, padenie-doma-2, treshchina

- **Pixels made and read back in a painting.** `closeups.js` shades faces, hair, busts and hands per pixel in JS into
  `ImageData` → `OffscreenCanvas` → `g.drawImage`, sizes its grids from `g.getTransform()`, and reads a blurred canvas
  back with `getImageData` (modules/closeups.js:518-574, 986-997, 1032-1048, 1189-1209, 1423-1443). The language says a
  painting does "no reading pixels back" (artist2.md:85); the read-back is on the module's own canvas, which the
  Recorder does not see. Blur radii are converted through `g.getTransform()` (:751, :806, :1228, :1437 …). The probe saw
  2 canvases made by main's close-up painting and 2 images recorded.
- **"Is this layer painted" asked through `e.layer(name).scaleX`** — a layer that does not exist reads 0
  (core/element.js:300 `get = i => L()?.uniforms[i] ?? 0`; only a write to it warns): closeups.js:1810, ushers.js:1680,
  main's mist_*.animate.js:3, windows.animate.js:6. One animate assumes the opposite — medlin-prokhodit's `sconceLive`
  tests `if (!f) return` on the handle itself (lib.js:384), which is never false (the handle is always an object,
  element.js:287-311).
- **The horse** (main): 133 layers in one card; the legs exist twice (far, near) and one of each pair is shown by
  alpha; the card carries its own 3D projection whose tilt reads the key `camera_z` (ushers.js:1694); the rider is a
  person standing `on` a point (`rider#stirrups`) that the horse's animate marks each frame; `narrator_turn = 180 −
  rider_face` is kept in step by hand (lib.js:227, 275-276, 475). Mounting is done by a cut (lib.js:470-472).
- **One facade in three elements at one distance, ordered by `inFront`**: `house`, `windows`, `crack`, all at distance 80
  (main/scene.json:284-341); `vision` at 79.9, `hall` at 83. The door "opens" by squeezing two layers (`scaleX = 1 −
  0.86·door`, windows.animate.js:3-5).
- **Painted at the most, thinned by animate**: the mists are painted 1.8 times thicker than needed and their alpha is
  multiplied by `(1 + 0.8·gloom)/1.8` (main mist_*.js:4).
- **Wrapped layers painted three times** (`for dx of [-W, 0, W]`) so a `drift` wraps: clouds.js:8, mist_far.js:19,
  mist_mid.js:13, mist_near.js:13.
- **Everything on the water at elevation −0.03** (main/scene.json:257-438); padenie-doma-2: rings at elevation 0.02,
  causeway 0.05, masks at 149.9 against 150.
- **A shader and its painting coupled by the order of layers**: padenie-doma-2's sky paints nine layers in a fixed
  order (lib.js:147-165 ↔ sky.glsl:7-16); because "a layer painting nothing is no layer", the disc and the path are
  always painted and the shader removes them (lib.js:154-155).
- **`clear(g, e)`** (padenie-doma-2/lib.js:457-461): a transparent `fillRect` over `e.area`, called by six paintings so
  that the shader runs over the whole box — the same prop in burya (lib.js:757-761: "a painting with nothing in it is
  not drawn at all") and in both scenes of Ночь (`stars`, `glints`). It leans on how the present engine treats an empty
  recording (core/element.js:53 `empty`); I did not trace the renderer's side.
- **Numbers kept in two or three places by hand**: `horizon 0.58` (scene.json:12) = `HZ` (lib.js:36); the uniform `hz
  0.592` in scene.json:87 = `WL`, also set every frame; the uniform `width 3.378` = `e.aspect + 1.6` at 16:9; treshchina's
  reveal range `−0.04 … 0.98` written in lib.js:268, crack.glsl:4 and knot.glsl:5 (a painting cannot hand a number to its
  shader).
- **Particle kinds used for other things** (padenie-doma-2/scene.json:216-419): `sparks` with `glow [0, 0]`, a dark
  colour, `shape: "dot"`, `blend: "over"` as falling stones 0.6 m and as boards with `spin`; `splashes` with `shape:
  "puff"`, 4–9 m across; all with `"burst": null`.
- **The camera and two people placed by values set each frame** (padenie-doma-2/script.js:41-46) — the language's text
  says a following camera "moves over time … not by values set at once frame after frame" (artist2.md:197).
- **Memory outside the state**: `going` (main/script.js:11), `aim`, `going`, `held` (padenie-doma-2/script.js:27, 48),
  `last`/`next` in beats.js — not saved with the scene.
- **`fade`**: main — `fade: 1` in the `from` of three beats, fades to 1 at the end of two (lib.js:268, 327, 333, 443,
  480); padenie-doma-2 — the starting state is `fade: 1` and 10 of 11 beats begin at `fade: 1`; two of them (`dash`,
  `ashore`) never move it (lib.js:664-668, 687-691).
- **Keys nothing in the scene reads or moves**: `hand_in_hand` (padenie-doma-2, set at lib.js:598, 763), `crack` in main
  (read by one animate, set by nobody), `lib.REVEAL` in treshchina (exported, unused).
- **Text in a painting** (treshchina): fonts set at `size·1000 px` under `scale(0.001)`, layout by `measureText`
  (lib.js:9-13, 67-263); the layout is worked out twice per state, once in each of two elements.
- **Own hashes instead of `e.rnd`**: 11 of main's element files define a `sin·43758.5453` hash.

### 6.2 Ашеры — Буря, Комната, Мэдлин, Склеп

- **The light under a door built from five pieces** (burya-i-chtenie): two lights carried by the key `hall_x` — `hall`
  and `gap` (scene.json:61, :76); a glowing card `door_gap` behind the door; an element `feet` — two dark rectangles
  with `shadow: {light: "gap", onto: ["floor"], soft: 0.03, strength: 0.85}` (scene.json:269; lib.js:308-316); the wall
  and the door casting onto the floor. The walker is not a person: `hall_x` is moved by seconds (lib.js:953-962) and
  the steps are made from the place (lib.js:295-297).
- **One lamp in four forms** (burya): the corridor's lights `hall` + `gap`; a light `at` the hand `roderick#flame`
  with the cast's part `lamp`; an element `floor_lamp` painted only while `lamp_down` with a light `of` it. The
  hand-overs are key sets at waited moments (lib.js:979-985, 1078-1081).
- **Things that exist twice — a cast part and an element — swapped at a waited second**: the book (burya,
  lib.js:636, 1155-1159), the guitar (komnata, elements/guitar.js:3-4; lib.js:288-293, 339-342), the torch (sklep,
  elements/torch.js:5 — with two lights and two fire emitters for one fire: `holder`/`fire`, scene.json:23, :33, :463,
  :687, :710). Each such element's painting reads `<id>_with`, so it is painted again at the swap.
- **Five lights for five candles** (komnata): `candle0…4`, each `of: "candles#c0…c4"` (scene.json:59-87). **Four lights
  for the windows**: two points at one place on the keys `window_day` / `window_dusk`, two far lights `sky_day` /
  `sky_dusk` with the same three polygons typed by hand (scene.json:94-114, :209) — a colour change done as a
  cross-fade of lights.
- **A flicker law written twice** — in lib.js:59-67 (for the glows, on `e.t`) and in candles.glsl:8-11 (for the flames,
  on `u_time`).
- **`strum`, `tempo`** (komnata): `strum` is a counter moved by tables of seconds (lib.js:297, 306, 318); the candles'
  pulse assumes the hand crosses the strings at n + 0.25 "as play_guitar has it" (lib.js:51) — nothing found that ties
  the motion's phase to the key. `tempo` is written and declared and read by nothing in the scene.
- **Cards that fake a turn by `scaleX`**: komnata's window leaves (`max(0.04, cos(open·1.3))`,
  elements/window.animate.js:9-11) and curtain; burya's casements are real cards turned by `place.facing`.
- **187 elements for 17 arches** (medlin-prokhodit; written by tools/medlin-prokhodit-gen.js): per arch a face, two
  pier faces and 4 + 4 flat tilted strips standing for the curved soffit (lib.js:60-64). Between arches only `distance`
  differs (4.1 + 4.6k). Each is its own painting of `stone()` seeded by its id (lib.js:74-105) — the probe found 38
  distinct pictures among the 170 strips and 17 among the 17 faces. The painting reads the element's **id** to know
  which it is (`e.id.slice(4)`, `/_p[lr]$/`, lib.js:110, 149, 167). The generator rewrites the whole scene.json and
  the elements folder; numbers reach scene.json unrounded (3.3299999999999996).
- **Lights through 16 panes of 7 points each, twice** (medlin: `evening`, `sun`; scene.json:36, :641) — about 1200 of
  the file's 4718 lines; the pane given to the light (7 points) is not the painted window (19 points); lib.js:28: "the
  engine takes 8 points a pane".
- **Dark rooms as props** (medlin): 10 flat-colour elements so that someone passing a doorway cut in a wall is behind
  the wall (lib.js:346-350).
- **A table of paces** (sklep, lib.js:197): `PACE = {carry_walk: 1.0, carry_back: 0.87, torch_back: 0.99, …}` m/s "as
  the engine measures them on their legs"; three motions take their length from it. People are moved as keys, not
  walked: one `s.path` drives 7 keys (the coffin's place and turn, two bearers' places) along 65 rows worked out ahead
  (lib.js:212-224, 290), the door's pull 41 rows (lib.js:230-236, 586); waits are computed from the table
  (`s.wait(CARRY_T − 1.6)`, :291).
- **`torch` standing for occlusion** (sklep): the key is moved to 0 as the door shuts, dimming the lights and the
  fire (lib.js:587-588).
- **A coffin of cards on an unseen anchor**, a person lying `on` a point of its floor and reaching for four points
  painted "past where they end" (sklep scene.json:521-597; lib.js:160-163).
- **Two inserts that are whole flat scenes with their own light** (sklep `inside`, `outside`): light baked in the
  stones' colours, shadows as two soft discs in a shader, constants typed twice in JS and GLSL (`SCREWS` lib.js:81 ↔
  inside.glsl:31; `MID = vec2(0.888889, 0.5)` in both shaders).
- **Canvas `filter: blur(…px)` in two meanings**: burya writes `blur(4px)`, `blur(10px)` (lib.js:188, 204); komnata and
  sklep write metres with the suffix px — `blur(0.03px)`, `blur(0.12px)`, `blur(0.009px)` (komnata
  elements/fissure.js:54; sklep lib.js:54, 106). The Recorder takes a filter's lengths as the painting's units
  (paint/recorder.js:19-21).
- **Paintings on smooth keys**: burya `wall` (16 × 6.7 m) reads `crack` with `redraw: {crack: 0.02}` and one beat moves
  `crack` to 1 over 3 s (lib.js:918); komnata `window` reads `evening` without a `redraw`; sklep `wall` (20 × 5.5 m)
  and the insert `outside` read `crack`, and the close-up `blush`, with no `redraw` anywhere; medlin `windows` (72 × 6.3
  m) reads `low_sun`, `light_shafts` with steps 0.1. medlin instead shows its crack by a shader from two layers painted
  whole.
- **Order by centimetres, no `behind`/`inFront`** (burya): wall 6.5, door and window 6.49, fissure 6.48, casements
  6.47, feet 6.56, door_gap 6.6; flame 3.595 against candle 3.6.
- **Motions entered in the middle to hold a pose**: `{motion: "take_hand", from: 3.9}` (komnata lib.js:192), `do("weep",
  {from: 6.6})`, `{motion: "lean_in", from: 3.9}` (medlin lib.js:637, 459).
- **Close-ups closed by a cut that nothing made ready**: burya `outOf` (lib.js:895), komnata (lib.js:194, 211, 371),
  sklep (lib.js:378, 391, 507, 517); medlin closes by `s.set("closeup", 0)` (lib.js:515, 594, 688).
- **`fade`**: every one of the four begins beats at `fade: 1` and fades in (burya 3 beats, komnata 3, medlin 2, sklep
  3); komnata covers a change of the hour with it (`fade` → 1, `s.set("evening", 1)`, `fade` → 0, lib.js:276-278).

### 6.3 Вокруг света

- **945 lights in one scene** (iz-okna-poezda): every lit window and lamp painted along 124 km gets an `e.light` —
  `distant` 789 (elements/distant.js:117, fed from :33, :42, :83, :87), `far_bank` 102 (far_bank.js:39), `mid` 49
  (mid.js:113); each `e.light` is a point light of the scene (core/light.js:277-300); the engine's table holds 256 and
  picks each frame (render/lights.js:14-18, :37). Those in a layer of an element with an animate (`distant` 789, `mid`
  49) are worked out again every frame (light.js:290 `posed`, :320 `always`).
- **Boxes of 128–150 km** (iz-okna-poezda/scene.json:284-389): `ground` a draped plane 150 000 × 3997 m, `far` 147 km,
  `distant` 130.6 km, `mid` 128.6 km, `near` 128.2 km (with `shadow`). Most of each is empty — each land is painted ±4–9.5
  km round its middle (lib.js:39). Places run to 124 000 m. Single paintings loop over thousands of things (near.js:
  6443 grass clumps × 5 blades × 4 lands, 165 poles × 5).
- **A herd from a shader**: one card; a layer `atlas` (one buffalo in 12 poses) lies outside the element's own box
  (`[60, −2.4, 108, 0.2]` against `[−55, −3.5, 55, 0.5]`, elements/herd.js:7-15); herd.glsl reads it up to 18 times a
  pixel and hashes with `uint` (the one shader that does); its constants are typed in lib.js:194 and herd.glsl:5-6.
- **Elements that are only panes or masks**: `glass` (train; painted black, `behind: ["window"]`, the `of` of a
  daylight light), `glass` and `terrace_glass` (sevil-rou; 4 cm behind the fronts).
- **Paintings on the key `port`** (gavan): 34 paintings read it; a change paints all again, among them `far` (3000 ×
  342 m, 273 or 351 houses from a loop of 900) and `city_lights` (the same loop again). 7 elements paint nothing in one
  port, 5 nothing in the other; their animates find that out by a layer's `scaleX`. The probe saw the starting port
  only (Hong Kong: 84 `e.light`; the reader counted 134 for Yokohama).
- **Twins only to glow**: `city_lights` (gavan; the same box as `far`, 10 m nearer, `glows`); every lantern's second
  `e.light` in a "ghost" layer; sevil-rou's rooms painted dim and again lit in a layer; `club_rooms` painted three times
  and mixed by a shader; `street`'s layers used only as a share and as emission for its shader (ВС main).
- **Mist of cards and of giant particles**: gavan — 4 elements, 280–840 m wide, two `drift` layers each, every bank
  painted 3 times; dzhungli — `mist_river` (120 m), `mist_stream` (220 m); ВС main — `mist`, a `glows` card whose shader
  scrolls two sheets by `mod` on `u_time`; sevil-rou — fog as a `smoke` emitter with sprites 6–11 m over 170 × 24 × 3 m
  and a `dust` emitter at 380 a second (scene.json:1331, :1384), beside a look `fog`.
- **Gulls are particles of kind `fireflies`** with `glow [0, 0]`, `blink 0`, `blend "over"`, `frames: 3` and a painted
  sprite (gavan/scene.json:1200).
- **The land told twice** (sevil-rou): relief.js returns steps — 0 on the road, 0.14 on the pavements, a slope up the
  steps, 0.84 inside the house — only as people's floors, while the street is planes at their own elevations and 20
  elements say `onLand: false`. dzhungli: unseen `walk` planes (`pyre_top`, `pyre_steps`) as floors on a painted pyre.
- **Layers as things at their own depths** (dzhungli): `canopy` 73, `undergrowth` 92, `near_leaves` 114 wind layers,
  each with `depth: anchor − d` and its painting shifted by hand by the land's height (lib.js:124-128); the elements'
  own boxes are dummies `[−1, −1, 1, 0.2]`; trunks are a twin element of 74 parts at the same anchor. The fire is two
  cards, behind and before whoever stands on the pyre.
- **Parts of a turned card standing for metres along a street** (sevil-rou: `cheeks_l/r`, `dormer_l/r`, 11 parts each,
  lib.js:244-284); 13 lamps as parts that all take the element's whole box.
- **Order**: ВС main — six objects by `behind`/`inFront` at equal distances (door leaves at 18 as the wall);
  `hearth_floor` at elevation 0.005.
- **`e.area` without `travel`** (sevil-rou road.js:6, pavement_near.js:3, side_street.js:3): the painting is limited to
  `e.area`, which without `travel` is the whole box (core/element.js:96).
- **Keys declared and read by nothing**: `with_fix` (gavan), `fix_bruise` (train), `with_aouda`, `with_pp` (sevil-rou).
- **Clocks disagree**: the train's insert shows 8:17, the cast's watch ten past ten, sevil-rou's clocks 7.83 h; only
  Реформ-клуб's clock runs.

### 6.4 Ночь перед Рождеством

- **Houses as assemblies whose anchor is the window-light card** (no unseen anchor): the anchor is a `glows` card with
  `inFront: [<id>_front]`, the front wall stands 1.5 cm (Диканька) or 5 cm (Полёт) behind it, the other walls, the roof
  planes and the chimney stand `on` it. Диканька: 11 assemblies, 148 of 186 objects (huts of 9–11, a church of 54 — three
  log frames of 18). Полёт: 41 assemblies, 481 of 529 objects (24 huts of 10 + a smoke emitter, 3 churches of 18, 12
  city blocks of 10, a palace of 34, a windmill of 9).
- **Where a house's numbers live**: its kind and size in a table of the lib keyed by the id's prefix (Полёт
  lib.js:108-127, Диканька lib.js:45-68 — each face finds its house by matching its own id); its faces' places, tilts and
  boxes as literal numbers in scene.json, repeating what the lib paints. There is no generator in the repo (Диканька's
  notes: "Генератора нет: всё правится руками").
- **How alike**: Полёт — 24 huts are 2 builds in scene.json and 8 distinct pictures for 216 faces; 24 chimneys one
  picture; 3 churches 2 sizes; 12 city blocks differ in width (11 values), seed and one of 6 stucco colours; by the
  probe 433 `house` faces are 85 distinct pictures. Диканька — 9 huts in 5 builds, all 9 painted differently (windows,
  frost, a door); 81 faces are 38 pictures, the church's 54 faces 12.
- **Windows**: a `warm` layer on the light card with one `e.light` per hut window (Полёт 37, Диканька 14); city and
  palace windows have no `e.light`, only the layer at brightness 1.7 rewritten every frame; 15 point lights stand 7 m
  before the city's houses at their own literal places, not tied to them.
- **The ground**: Полёт — a draped plane 100 000 × 100 000 m with a shader over it, `lit: true`, its id `ground` the
  same word as `"ground"` in `shadow.onto`; `river` one plane 12 020 × 9340 m with `reflect`; `road` draped 130 × 5500 m.
  Диканька — `snow` draped 4000 × 2510 m painted by `fillRect(−1e5, −1e5, 2e5, 2e5)`.
- **A camera's place kept twice** (Полёт): `progress` and `camera_z`, joined by a script each frame; every cut sets
  both. The riders follow the camera by an unseen element `mount` whose `place` reads the camera's own keys
  (`camera_x`, `camera_z`, `camera_h`), a `seat` on it, a person on the seat by a state key, another person on that
  person's hips, particles at his head and feet — `on` depth 1 in scene.json, 4–5 through keys.
- **The witch's sweep** (Диканька): 24 float uniforms for 12 points; the points are gathered every 0.33 s inside an
  animate from `e.point('broom#tail')` — where the broom is seen on the sky from the eye then — and kept in `e.mem`
  (lib.js:644-663). They cannot be made again from the state.
- **The moon's light hangs on an animate**: the far light is `from: "moon#moon"`, a point the moon's animate marks each
  frame; rising, the moon is carried from a chimney's mouth by `e.point` of a world point in sky coordinates
  (Диканька lib.js:704-725).
- **Sky paintings that carry nothing**: both skies' shaders never read `painted`; `stars` and `glints` paint a
  transparent rectangle so that they are drawn at all ("a painting with nothing in it is not drawn").
- **Blizzard in six places** (Полёт): particles (`count 40000`, `veil 600`), a look (haze, the moon's light, wind),
  the sky's fog in `hour()`, the moon's, stars' and glints' factors, the windmill's speed. Диканька's blizzard: 42 000
  flakes with `glow [0.25, 0.25]`, the look's haze 0.5.
- **The same broom hidden two ways**: Полёт's painting returns nothing unless `witch_out` (lib.js:946); Диканька keeps
  it painted and parks it under a roof (`broom_e 5.2`).
- **A hat as a particle**: emitter of kind `leaves`, a burst of 1, `life [3, 3]`, its sprite painted by code (Полёт).
- **Paintings that read where they stand**: `firs` and `lamps` read `e.spot` and skip what would stand on the road or
  the ice (Полёт lib.js:436, 581).
- **Easing used as arithmetic**: `T = 3·distance/CRUISE` so that a cubic `in`/`out` meets the cruise's speed (Полёт
  lib.js:1082-1085).
- **The sack**: a prop swapped at a wait of 1.9 s into a motion and moved by `s.path` over the walk's `duration ?? 6`
  while two girls reach for a point on it (Диканька lib.js:1225-1228, 1273).
- **Names shared across kinds**: `moon` is an element, a light, a key and a look; `sack`, `landing`, `witch_trail` an
  element and a key.

### 6.5 Алые паруса

- **A forest of 534 objects, one per plant** (les-u-morya; written by tools/les-u-morya.js): 298 crowns (222 birch, 76
  pine), 144 grass cards, 54 tufts, 7 mist cards, 7 spray emitters — and `trees`, one element of 298 parts (the
  trunks), `stones` (87 parts painted of 122 in the list), `fall` (7 parts). Why the crowns are elements of their own,
  in the tool's words: "layers are an element's (the wind's, a drift), and each turns to the eye about its own foot when
  a film's camera looks round" (tools/les-u-morya.js:4-5). A crown is a function of three numbers — species (2),
  height (`11 + hash·7`: 294 distinct values in 298), a seed — and no colour varies but a cycle of three; every branch
  and needle comes from the seed, so the probe found 298 distinct pictures for 298 crowns, 144 for 144 grass cards
  (all with one box), 54 for 54 tufts. Kinds in the code: 2 trees, 1 grass, 2 undergrowth, 1 mist, 1 stone.
- **Places written twice**: by the tool into scene.json and worked out again by the lib at run time for `crown(e, i)`
  from the same lists; the lists are made by hash loops with rejections (up to 1400 tries, O(n²) spacing checks,
  lib.js:129-158) each time the lib loads. The tool carries its own copy of the engine's `anim`. Other numbers typed
  in two places: the headland's place and facing, the planes' sizes, the horizon.
- **Mist of upright cards 75–884 m wide** (les-u-morya `mist_0…6`: 74.8, 88.4, 115.6, 136, 204, 408, 884 m; the nearest
  12 m from the start), beside a look `mist`.
- **Four mirrors** in one scene (les-u-morya: `sea` and three pools); the notes say the engine holds four
  (render/reflections.js:32 `MAX_PLANES = 4`). paluba: sea + two decks; zamok-greev: sea + floor; sevil-rou: three.
- **Seas as planes of tens of kilometres**: 40 000 × 60 000 m (paluba), 40 000 × 20 000 (dom-longrena, 40 m below a
  room's window), 5000 × 9000 (zamok-greev), 6000 × 3000 (les-u-morya), 3200 × 2500 (main) — one `fillRect` each, with
  `reflect`.
- **A whole ship of 22 elements for a window** (dom-longrena): 9 shader copies, 15 animates, 11 `e.light`; she is never
  hidden — at `sails_window: 0` she stands 520 m to the right, "past every line of sight out of the room"
  (lib.js:120-122). main: at `ship: 0` she is 9 km off; nothing hides her. paluba: the absent steamer is parked at
  across 15 000.
- **A glow of 70 m standing for a far ship**: `e.light(0, −15, 70, …, 5, "spark_white")` and a scarlet twin on the rig
  (modules/korabli.js:389-390), put out nearer than 1800 m by the animate.
- **Twins only to glow**: `lit_windows` over `kaperna` (same place and box; both sample the land and lay the same 15
  parts), `tavern_light` over `tavern`, `lighthouse_light` over `lighthouse` (main); `lisse_*_windows` 0.1 m off their
  walls, `quay_lamps` (paluba); `flame` beside `lamp` (dom-longrena). The lighthouse's beam is two additive layers 260
  m long scaled in x; its lamp's `e.light` has a radius of 30 m.
- **One shader text copied into 33 elements by tools** (the sailcloth: 9 + 9 + 15), each with 8 uniforms, and the sky's
  into 5 elements with 29 uniforms each (colours as triples of floats).
- **One set of elements serving two ships** (paluba): 33 paintings read the key `ship`; what a ship lacks paints
  nothing (10 of 12 sail halves on `anselm`) but stays an element with a shader, an animate, a shadow and a `place`.
- **Square sails as two half cards hinged at the mast**, overlapping by 0.6 m "so the wind's waves open no gap"
  (paluba lib.js:61-70), each with `shadow: {light: "sun", onto: [main_deck, poop_deck]}` and `translucent: 0.55`.
- **Elements that are only points for the camera**: `by_rail`, `by_mast` (paluba; unseen, `height: 1.76`).
- **Marks in the state to tell a start from a restore**: `ship_at`, `steamer_at` (strings; paluba lib.js:359-360,
  script.js:74-75).
- **Props that exist twice, swapped at a waited second**: the toy yacht, knife, book, basket (dom-longrena) — constants
  `LAID = 1.2, SET_DOWN = 0.8, SHELVED = 1.6, KICKED = 1.0` are seconds into a motion at which a hand lets go or a foot
  meets (lib.js:631, used at :766-770, :864-869, :888-891, :982-984); the bundle, the note, the coat (zamok-greev,
  lib.js:409-419, 467-471); the ring (les-u-morya, kept in step by a handler).
- **A pose held by a number**: `{motion, loop: false, from: 99}` (dom-longrena lib.js:655).
- **A strip of light under a door made of a light and masking shadows** (zamok-greev): a point light `mother_light` in
  the next room; the wall with a doorway cut by `evenodd` and the door (painted to end 3 cm above the floor) cast
  `shadow: {light: "mother_light", onto: ["floor", "wall_back"], strength: 1, soft: 0.05}` (scene.json:123-132,
  745-753, 1463-1471). The hearth casts a shadow of the fire's light only, "so that it comes out of the opening only".
- **The same rectangles in three forms** (dom-longrena): the wall's holes, two unseen elements used only as the `of`
  of daylight lights, and the numbers of the sun's and the moon's `through` polygons.
- **Solids built of cards**: 13 elements for a chest, a box, a stool and a bench (dom-longrena); a room of 24 flat
  one-colour rectangles (zamok-greev: jambs, panes, firebox, table) — 17 distinct pictures.
- **The operator set aside**: zamok-greev sets `camera_x/z/yaw/pitch` directly in 7 of 9 shots, les-u-morya in 8 of 11
  (lib.js:198-208; les lib.js:650-671) — the notes' reason: the roam operator stands on the line from the start to
  the target; the walk operator looks ahead only. les-u-morya's shots put the camera outside the camera's `area`.
- **`fade` where a beat starts with a cut**: dom-longrena six beats, zamok-greev four, les-u-morya three; main once.
- **The wheel's hand points do not turn** with the wheel's layer (paluba wheel.js:37-38).
- **Text in an insert** by fonts at `size·1000` under `scale(0.001)` and `measureText` (dom-longrena lib.js:480-500).

### 6.6 Хризалиды — Насыпь у ручья

- **Light painted into the paintings of a lit scene** (`ambient 0.95`, a sun and a moon): a rim "of the low sun" on the
  horse (modules/chrysalids.js:119-131), lit crests and slopes (big_bank.js:41-52, 120-128; ridge.js:15-20), a pool of
  light on the meadow (meadow.js:11-15), the sun's shimmer on the stream at across −1.4 (stream.js:64-69, and again in
  stream.glsl:20), ellipse shadows under the willow, the house and the foot (lib.js:78-82; farpath.js:4-8;
  closeup_foot.js:33-36). No painting reads `evening` or `night`.
- **Two riders**: a painted one on the far crest, drawn 3.6 times life size "to be read 260 m off" (ridge.js:29-76),
  and the real person on the horse.
- **Hiding by alpha**: the horse has no absence of its own — every layer's alpha 0 while `rider_here` is false; 23 of
  its 24 views are always at alpha 0; stars are multiplied by `night` in their shader by day.
- **Four inserts on one key** (`closeup`), stacked by their order in `objects`; the fourth has an iris of radius 10
  stage heights, paints a dark rectangle over the whole frame and cuts the round window in a shader whose radius
  `0.46·open` assumes the other three open linearly with the key.
- **A fake look-down inside the horse's projection**: `VIEW = 0.2`, `y −= z·VIEW·(1 − y/1.7)` (chrysalids.js:51, 74,
  230) — it also goes into the points the rider's feet reach for. The horse's seed is `hash(e.id.length, 7)`.
- **A GLSL reserved word as a function name**: `half` in stream.glsl:5 — it compiles because the engine prefixes an
  element's own names (render/custom.js:18-21, 138-176). The shader's curves `centre()`, `half()` are copies by hand of
  the painting's (stream.js:4-5); the plane's 70 m is typed in the shader.
- **Order by half-centimetres**: stones 4.99, fringe 4.995, the bank and the children 5.0; rings 0.5 cm over the
  stream. `onLand: false` on four elements, one of them a dragonfly.
- **The land is a relief only in a band** 1.6 m either side of distance 5 (relief.js:3-4), painted by one card; no
  draped plane.
- **Waits standing for a moment inside a motion**: `land_cheer`, wait 1.45; `get_up_ground` not awaited, wait 1.4;
  `kneel_work`, wait 2.8 — the shoe is off; `lift_child`, waits 1.6 + 1.3 (lib.js:245-249, 314-319, 330-337, 951-961);
  174 `.wait(` in the lib.
- **`ease: 'out'` used as arithmetic**: a halt over "three times the way" (lib.js:648-650).
- **A beat begins on a cut to a faded frame** (`fade: 1, fade_color: '#08101d'`, lib.js:1007, 858) — the one use of
  `fade_color` in the 20 scenes.

### 6.7 Across all the scenes

- **The film is a module, not the engine's**: 19 scenes run `beats.play(scene, FILM)` and `beats.showcase(…)` (one
  file, five copies); treshchina writes the same pattern by hand in its showcase. A game's cut to a beat's `from` is a
  plain `s.cut` — nothing made ready (beats.js:21). The beat before is remembered in a closure. Scenes build their
  film twice (script and showcase). Told to the game: `beat:<name>` and 129 `s.tell` call sites with names of the form
  `<beat>:<moment>` in 15 scenes; no `s.event`, no signal, no `MooodState` anywhere.
- **Whole-state tables in every cut**: a beat's `from()` returns the people's keys, the camera's, the props', and the
  derived keys a script would set after it ("a cut carries what the script would set after it", paluba lib.js:407).
  State holds arrays and objects (`_do`, `_reach`, `_on`, `_look`, `_wear` with a whole character object).
- **Engine keys in the scenes' own states**: people's keys are mostly absent from `state`/`states` and come with cuts.
- **Painting past what the language's text says**: `srgbToLinear` (10 shader texts), `fwidth` (10), `hash1` of `vec3`
  and of `uint`, GLSL arrays and loops; `OffscreenCanvas`, `ImageData`, `putImageData`, `getImageData`, `drawImage`,
  `DOMMatrix`, `Path2D.addPath`, `g.getTransform()`, `globalCompositeOperation` (`destination-out`, `lighter`),
  `filter: blur()`; `light.people`; the global `MooodShapes.V` in four casts.
- **Kilometres**: places to 124 km (train), a plane 100 × 100 km (Полёт), seas of 40 × 60 km, boxes 128–150 km wide,
  a camera at `camera_z` 6280 m (Полёт) and `ship_d` −30 000 (paluba).
- **`lit: true` on 44 planes of nine lit scenes**, where by the language's text it is for scenes that are not lit.
- **Shadows in the object form on 1028 elements** — `onto` naming planes by id (Диканька: `["snow", "street", "ice",
  "road"]`; Полёт: `["ground", "road", "river"]`, where `ground` is an element's id and the reserved word at once),
  `strength`, `soft`.

## Differences from earlier documents

Compared: plan/spec-language.md (the earlier inventory and plan of edits), plan/decisions.md, plan/requirements.md,
HANDOFF.md. The earlier audit read `origin/env/dev` too; the heads I read are of 2026-10-10 12:34–17:50 UTC (the last
commits: light after the tone curve's change; Дом Лонгрена and Насыпь on engine 2), so some of what follows may be the
scenes having moved since, not an error then.

**Where the earlier counts agree with mine** (so they can be leaned on): 20 scenes in five worlds; 43 distinct shader
texts, 895 lines; one sky reads 9 layers, every other shader at most 5; `lit: true` on 44 planes in 9 scenes; a
caster's `soft` 712 in 12 scenes; a light's `size` 12 in 6; `shadow.light` 22 in 4; `shadow.onto` 1023 in 13;
`shadow.strength` 960 in 11; `light.people` in 2 scenes; `veil` set once, two blizzards; `scene.prepare` once; no
`seen: "direct"`, no list form, no particles' `onto` or `lit`, no `anim.joint`/`blend`, no `travel`; Лес 534 objects
and 298 crowns; Полёт 433 `house` faces; Диканька 135 faces (81 + 54); Мэдлин's arcade 187 elements; dzhungli 21
people, 4 here at the start; horses of 120 and 133 layers; mirrors over two planes in three scenes; five candle
lights; four identical "lit" shaders in the train; the same `beats.js` in all five worlds.

**Where they differ.**

| # | Earlier document says | Found | Where |
|---|---|---|---|
| 1 | spec-language.md 2.3 lists `captions` and `directions` among "features no scene uses" | `captions` in 3 scenes (one line each), `directions` in 4 scenes (7 entries); only `widgets` is unused | T1, T8; 1.4 |
| 2 | 2.3: particles' fields `blink`, `tumble`, `frames`, `settle` unused | each is set once: `frames: 3`, `blink: 0` (gavan `gulls`), `tumble: true` (Полёт `hat_off`), `settle: 1.5` (burya `grit`). `streak`, `bounce` are unused, as said; so are `flat`, `lit`, `onto` | T6 |
| 3 | 2.3: `e.where`, `e.warn`, `noise3`, `a.finish()` unused | `e.where` — modules/korabli.js:409 (the ship's rig, 2 scenes); `e.warn` — modules/ushers.js:961-962; `noise3` — Полёт's sky.glsl (2 calls); `a.finish()` — medlin-prokhodit/lib.js:723. `e.was` is unused in animates, but `scene.was` is used twice (padenie-doma-2/script.js:63, 74) | 1.4 |
| 4 | 2.3: `glass: true` is a spelling nobody uses | used on 2 elements (dom-longrena `glass_left`, `glass_right`) | 1.4 |
| 5 | 2.2: "`e.area` read in three libs" | read in 4 libs (burya :758, padenie-doma-2 :458, Диканька :548, Полёт :778) and 3 element files of sevil-rou — 5 scenes; none has `travel` | 6.1, 6.3 |
| 6 | 2.5 budget "lights 32 … counted as entries of `lights` + `e.light(` calls"; section 10 names Сэвил-Роу (25) and Полёт (15 + 37) as over | counted as painted (a call in a loop makes many): the train has 943 lights from `e.light` (789 in one painting), gavan 81 (134 in the other port), АП main 60, Полёт 58 + 15, ВС main 32 + 3. The train is not named as over anywhere in the earlier plan | 4c, 6.3 |
| 7 | section 10: Полёт "15 point lights + 37 window glows that light" | 37 window glows + 21 `e.light` of the embankment's lamps (parts of one element `lamps`) + 15 point lights + 1 far | 4c, 6.4 |
| 8 | 2.4: Сэвил-Роу "Lights 25" | 26 entries: 25 `of` an element's glow (16 of them street lamps) + 1 far | T4 |
| 9 | 2.5: "Scenes today over: Лес (elements, casters), Полёт, Диканька (elements, casters), Мэдлин (elements), mirrors in three, casting lights in seven" | by the same rows, counted as painted: shadow casters' quads also over 300 in dzhungli (37 elements, 399 quads); particles over 8000 alive in burya (2500 + 7000 rain + an indoor emitter), Диканька (42 000), Полёт (60 000); large particles (over 2 m) far over 30 in Полёт (24 smokes of 6 m ≈ 1150 alive), dzhungli (≈ 660 of 10 m), Диканька (≈ 350), sevil-rou (≈ 200 of 11 m), gavan, paluba. None of these is in the list | 4c, 4d |
| 10 | 2.4, Ашеры main: "`tone()` leaves the 15 paintings" | 16 paintings read the four keys of the hour (15 and the horse's card) | 5.1 |
| 11 | 2.4 names `lit` removed in six scenes (4, 9, 10, 4, 4, 4) | the 44 are in nine: also dzhungli 3, iz-okna-poezda 3, Полёт 3 | 5 |
| 12 | L1.10: "Four worlds stack cards or giant particles for mist" (decisions.md:94 says three) | three worlds, nine scenes: Ашеры (main, padenie-doma-2, sklep), Вокруг света (dzhungli, gavan, main, sevil-rou), Алые паруса (main, les-u-morya); Ночь and Хризалиды have none | 6 |
| 13 | 11a-2: both horses' "per-frame garbage is a scene edit" | the Asher horse (ushers.js) builds 133 objects and more a frame; the Chrysalids horse (chrysalids.js) builds nothing a frame — its scratch is at module level | 3.1, 3.6 |
| 14 | L1.1's and 2.4's picture of a house: cards "on an unseen anchor" | in both scenes of Ночь the anchor is a seen element — the window-light card (or the front wall); there is no unseen anchor (Диканька has 0 unseen elements) and no generator | 6.4 |
| 15 | 2.4, the train: "the unseen `train` at `camera_x` removed" — and nothing on precision or lights | confirmed as the mechanism; added facts: a timer re-issues half-second moves 4 times a second; places reach 124 km; 943 lights | 3.3, 6.3 |
| 16 | 2.5 "repaint while playing: none" names burya's wall as the example | paintings reading a key described `smooth` with no `redraw`: komnata `window` (`evening`), sklep `wall` and insert `outside` (`crack`), padenie-doma-2 `sky`, `mist`, `causeway` (`morning`); with a `redraw` step: burya `wall`, komnata `fissure`, medlin `windows`, `sconce`, padenie-doma-2 `shore`, `reeds`. Repaints at cuts by keys not described smooth: Ашеры main 16 paintings (4 keys), gavan 34 (`port`), paluba 33 (`ship`) | 4g |
| 17 | HANDOFF / decisions S3: "the two Asher scenes that paint their light" | three scenes have no `ambient` (the third, treshchina, is three sky elements, as spec-language.md 2.2 says); and inserts paint their own light in 10 scenes | 5 |
| 18 | requirements.md:384 "около двадцати сцен" | exactly 20 | 0 |

Not checked against the scenes because it cannot be read from a spec: "casting lights in seven scenes" (today a caster
picks its lights at run time).

## Appendix: the scripts the counts were made with

All lie in `scratchpad/study-src/_t/` beside the clones (`scratchpad/study-src/<world>`); run with `node <name>` (Node 22). They read files only; `probe.mjs` also imports the engine's `paint/recorder.js` and `engines/1/kit.js` and runs the scenes' painting and animate code in Node — nothing is drawn. `gen.mjs`, `gen2.mjs`, `gen4.mjs` only lay the results out as the tables above. The seven readers of sections 3, 5, 6 used grep and reading; three of them ran `node -e` one-liners to parse scene.json or to count a painting's calls.

### A1. `load.mjs` — the scenes put together as moood does it

```js
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
export const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
export const WORLDS = ['padenie-doma-asherov-v2', 'vokrug-sveta-v2', 'alye-parusa-v2', 'noch-pered-rozhdestvom-v2', 'khrizalidy-kino-igra-v2'];
const TOP = { script: 'script.js', showcase: 'showcase.js', lib: 'lib.js', relief: 'relief.js', notes: 'notes.md' };
const IN = { objects: { code: 'elements/{id}.js', script: 'elements/{id}.script.js', animate: 'elements/{id}.animate.js', shader: 'elements/{id}.glsl' }, widgets: { html: 'widgets/{id}.html' } };
const walk = dir => readdirSync(dir).flatMap(f => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
export const sha = t => createHash('sha1').update(t).digest('hex').slice(0, 10);
export const lines = t => (t ? t.split('\n').length : 0);
export function scenes() {
  const out = [];
  for (const w of WORLDS) {
    const wj = JSON.parse(readFileSync(join(ROOT, w, 'world.json'), 'utf8'));
    for (const f of readdirSync(join(ROOT, w, 'scenes'))) {
      const folder = join(ROOT, w, 'scenes', f);
      const files = Object.fromEntries(walk(folder).map(p => [relative(folder, p).split(sep).join('/'), readFileSync(p, 'utf8')]));
      const spec = JSON.parse(files['scene.json']);
      const used = new Set(['scene.json']);
      for (const [key, name] of Object.entries(TOP)) if (name in files) { spec[key] = files[name].replace(/\n+$/, ''); used.add(name); }
      for (const [key, fields] of Object.entries(IN)) for (const item of spec[key] || []) {
        if (!item || typeof item !== 'object' || !item.id) continue;
        for (const [field, path] of Object.entries(fields)) { const name = path.replace('{id}', item.id); if (name in files) { item[field] = files[name].replace(/\n+$/, ''); used.add(name); } }
      }
      const extra = Object.keys(files).filter(x => !used.has(x));
      const mods = {};
      for (const m of spec.modules || []) { const p = join(ROOT, w, 'modules', m + '.js'); mods[m] = existsSync(p) ? readFileSync(p, 'utf8') : null; }
      out.push({ world: w, worldTitle: wj.title, folder: f, key: `${w.replace(/-v2$/, '').split('-').map(x => x.slice(0, 3)).join('')}/${f}`, spec, files, extra, mods, nfiles: Object.keys(files).length, nlines: Object.values(files).reduce((a, t) => a + (t.endsWith('\n') ? t.split('\n').length - 1 : t.split('\n').length), 0) });
    }
  }
  return out;
}
export const kindOf = o => o.sky ? 'sky' : o.insert != null ? 'insert' : o.person ? 'person' : o.particles ? 'particles' : o.plane ? 'plane' : o.unseen && !o.code ? 'unseen' : 'card';
```

### A2. `words.mjs` — words of scene.json and of the code

```js
// Words of the scene language as the 20 scenes use them: (1) keys and values of scene.json, (2) API names in the code.
// Counts of (2) are textual: occurrences in the source with comments and string contents kept apart (strings are kept,
// comments removed).
import { scenes, kindOf, WORLDS, ROOT } from './load.mjs';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ---- comment stripper (keeps strings and template literals as they are)
export function strip(src) {
  let out = '', i = 0; const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; out += ' '; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; out += c; i++;
      while (i < n && src[i] !== q) { if (src[i] === '\\') { out += src[i++]; } out += src[i++]; }
      out += q; i++; continue;
    }
    out += c; i++;
  }
  return out;
}

const add = (m, k, n = 1) => { m[k] = (m[k] || 0) + n; };

// ---- (1) scene.json
export function jsonWords(spec) {
  const w = {};
  const TOPCODE = ['script', 'showcase', 'lib', 'relief', 'notes'];
  for (const k of Object.keys(spec)) add(w, `spec.${k}`);
  const cam = spec.camera || {};
  for (const k of Object.keys(cam)) add(w, `camera.${k}`);
  add(w, `camera.mode=${cam.mode ?? '(default walk)'}`);
  const L = spec.light || {};
  for (const k of Object.keys(L)) if (k !== 'looks') add(w, `light.${k}`);
  for (const [name, look] of Object.entries(L.looks || {})) {
    add(w, 'light.looks(entry)');
    for (const k of Object.keys(look)) { add(w, `look.${k}`); if (k === 'lights') add(w, 'look.lights(entry)', Object.keys(look.lights).length - 0); }
  }
  for (const l of spec.lights || []) {
    const kind = l.daylight != null ? (l.of != null ? 'daylight+of' : 'daylight(point)') : l.of != null ? 'of' : l.from != null ? (Array.isArray(l.from) ? 'from[bearing,height]' : 'from"sky#point"') : l.at != null ? 'at(person point)' : 'point';
    add(w, `lights:kind=${kind}`);
    for (const k of Object.keys(l)) { add(w, `lights.${k}`); }
    for (const k of Object.keys(l.place || {})) add(w, `lights.place.${k}`);
    if (l.through) add(w, `lights.through:${l.through.map(p => (typeof p === 'string' ? 'element' : 'polygon')).join('+')}`);
  }
  for (const o of spec.objects || []) {
    const kind = kindOf(o);
    add(w, `kind=${kind}`);
    for (const k of Object.keys(o)) {
      if (k === 'particles' || k === 'person') { add(w, `el.${k}`); continue; }
      add(w, `el.${k}`);
    }
    for (const k of Object.keys(o.place || {})) add(w, `el.place.${k}`);
    if (o.shadow != null) { add(w, `el.shadow=${o.shadow === true ? 'true' : o.shadow === false ? 'false' : 'object'}`); if (typeof o.shadow === 'object') for (const k of Object.keys(o.shadow)) add(w, `el.shadow.${k}`); }
    if (o.reflect != null) { add(w, `el.reflect=${typeof o.reflect === 'object' ? 'object' : String(o.reflect)}`); if (typeof o.reflect === 'object') for (const k of Object.keys(o.reflect)) add(w, `el.reflect.${k}`); }
    if (o.glass != null) { add(w, `el.glass=${typeof o.glass === 'object' ? 'object' : String(o.glass)}`); if (typeof o.glass === 'object') for (const k of Object.keys(o.glass)) add(w, `el.glass.${k}`); }
    if (o.clip != null) for (const k of Object.keys(o.clip)) add(w, `el.clip.${k}`);
    if (o.seen != null) add(w, `el.seen=${Array.isArray(o.seen) ? '[ids]' : o.seen}`);
    if (o.redraw != null) add(w, `el.redraw=${Array.isArray(o.redraw) ? (o.redraw.length ? 'list' : 'empty list') : 'steps'}`);
    if (o.travel != null) for (const k of Object.keys(o.travel)) add(w, `el.travel.${k}`);
    if (o.lit != null) add(w, `el.lit=${o.lit}`);
    if (o.onLand != null) add(w, `el.onLand=${o.onLand}`);
    if (o.translucent != null) add(w, 'el.translucent(value)');
    if (o.uniforms) add(w, 'uniform(declared)', Object.keys(o.uniforms).length);
    if (o.particles) {
      const p = o.particles;
      add(w, `particles.kind=${p.kind}`);
      for (const k of Object.keys(p)) add(w, `particles.${k}`);
      for (const k of ['shape', 'blend', 'ground']) if (p[k] != null) add(w, `particles.${k}=${p[k]}`);
      if (p.burst) for (const k of Object.keys(p.burst)) add(w, `particles.burst.${k}`);
      if (p.amount != null) add(w, `particles.amount=${typeof p.amount === 'string' ? 'state key' : 'number'}`);
      if (p.at != null) add(w, `particles.at=${typeof p.at === 'string' ? 'ref string' : Array.isArray(p.at) ? '[a,d,e]' : '{on,at}'}`);
      if (o.code) add(w, 'particles: sprite painted by code');
    }
    if (o.person) {
      const p = typeof o.person === 'object' ? o.person : {};
      for (const k of Object.keys(p)) add(w, `person.${k}`);
      if (p.look) { for (const k of Object.keys(p.look)) add(w, `person.look.${k}`); if (p.look.kind) add(w, `person.look.kind=${p.look.kind}`); if (p.look.style) add(w, `person.look.style=${p.look.style}`); }
    }
  }
  for (const c of spec.captions || []) for (const k of Object.keys(c)) add(w, `captions.${k}`);
  for (const c of spec.widgets || []) for (const k of Object.keys(c)) add(w, `widgets.${k}`);
  for (const c of spec.directions || []) for (const k of Object.keys(c)) add(w, `directions.${k}`);
  for (const [k, d] of Object.entries(spec.states || {})) { add(w, 'states(entry)'); for (const f of Object.keys(d)) add(w, `states.${f}`); }
  add(w, 'state(keys)', Object.keys(spec.state || {}).length);
  const pids = (spec.objects || []).filter(o => o.person && o.id).map(o => o.id);
  for (const k of Object.keys(spec.state || {})) {
    if (/^camera_|^fade(_color)?$/.test(k)) add(w, `state:${k}`);
    for (const id of pids) for (const suf of ['do', 'look', 'reach', 'with', 'wear', 'gait', 'steps', 'on', 'here', 'still', 'turn', 'mood', 'talk']) if (k === `${id}_${suf}`) add(w, `state:<person>_${suf}`);
  }
  if (spec.music) { for (const k of Object.keys(spec.music)) add(w, `music.${k}`); add(w, 'music.prompts(entry)', (spec.music.prompts || []).length); add(w, 'music.prompts(weight>0)', (spec.music.prompts || []).filter(p => p.weight > 0).length); }
  return w;
}

// ---- (2) code
const W = '[A-Za-z0-9_$]';
const meth = n => new RegExp(`\\.${n}\\s*\\(`, 'g');
const prop = n => new RegExp(`\\.${n}(?!${W})(?!\\s*\\()`, 'g');
const CODE = {
  // painting's and animate's e
  'e.layer(': meth('layer'), 'e.part(': meth('part'), 'e.light(': /(?<!scene|\bs|\bq)\.light\s*\(/g, 'e.at(': meth('at'), 'e.rnd(': meth('rnd'), 'e.ground(': meth('ground'),
  'e.debug(': meth('debug'), 'e.warn(': meth('warn'), 'e.uniform(': meth('uniform'), 'e.glow(': meth('glow'), 'e.point(': meth('point'), 'e.where(': meth('where'),
  'scene.was( (no e.was in any animate)': meth('was'), 'e.speed(': meth('speed'), 'e.burst(': meth('burst'),
  'e.state': /\be\.state\b/g, 'e.t': /\b(e|c|a|ev|el)\.t(?![A-Za-z0-9_$])/g, 'e.dt': prop('dt'), 'e.cut (seconds since the cut)': /\.cut(?![A-Za-z0-9_$(])(?!\s*\()/g, 'e.mem': prop('mem'), 'e.hero': prop('hero'), 'e.spot': prop('spot'), 'e.area': prop('area'), 'e.aspect': prop('aspect'), 'e.id': /\be\.id\b/g,
  'e.kit / scene.kit / kit.': /\bkit\./g, 'e.lib / scene.lib': /\.lib(?![A-Za-z0-9_$])/g, 'anim (any use)': /\banim\b/g,
  // a layer's motion (animate)
  'layer.rotate': prop('rotate'), 'layer.alpha': prop('alpha'), 'layer.brightness': prop('brightness'), 'layer.scale': prop('scale'), 'layer.scaleX': prop('scaleX'), 'layer.scaleY': prop('scaleY'),
  'layer(…).x': /layer\([^()]*\)\.x(?![A-Za-z0-9_$])/g, 'layer(…).y': /layer\([^()]*\)\.y(?![A-Za-z0-9_$])/g,
  // the director
  'scene.sequence(': meth('sequence'), 'scene.person(': meth('person'), '.walk(': meth('walk'), '.go(': meth('go'), '.do(': meth('do'), '.turn(': meth('turn'), '.say(': meth('say'),
  '.look(': meth('look'), '.reach(': meth('reach'), '.with(': meth('with'), '.wear(': meth('wear'), '.gait(': meth('gait'), '.on(': meth('on'), '.here(': meth('here'), '.still(': meth('still'),
  '.mood(': meth('mood'), '.talk(': meth('talk'), '.startOf(': meth('startOf'),
  'scene.set(': /\b(scene|s|q)\.set\s*\(/g, 'scene.get(': /\b(scene|s|q)\.get\s*\(/g, 'scene.move(': meth('move'), 'scene.path(': meth('path'), 'scene.camera(': meth('camera'), 'scene.light(id)': /\b(scene|s|q)\.light\s*\(/g, '.fade(': meth('fade'),
  'scene.cut(': meth('cut'), 'scene.shot(': meth('shot'), 'scene.prepare(': meth('prepare'), 'shot.ready': prop('ready'), 's.wait(': meth('wait'), 's.until(': meth('until'), 's.event(': meth('event'),
  's.all(': /\b(s|q|scene)\.all\s*\(/g, 's.any(': /\b(s|q|scene)\.any\s*\(/g, 'scene.after(': meth('after'), 'scene.every(': meth('every'), 'scene.signal(': meth('signal'), 'scene.tell(': meth('tell'),
  'scene.hero(': meth('hero'), 'scene.random(': meth('random'), 'scene.time': /\bscene\.time\b|\bs\.time\b/g, 'scene.state': /\b(scene|s|q)\.state\b/g,
  'action.ending(': meth('ending'), 'action.cancel(': meth('cancel'), 'action.pause(': meth('pause'), 'action.resume(': meth('resume'), 'action.finish(': meth('finish'), 'action.remaining': prop('remaining'), 'action.duration': prop('duration'),
  'opt queue:': /\bqueue\s*:/g, 'opt steps:': /\bsteps\s*:/g, 'opt going:': /\bgoing\s*:/g, 'opt loop:': /\bloop\s*:/g, 'opt ease:': /\bease\s*:/g, 'opt over:': /\bover\s*:/g, 'opt speed:': /\bspeed\s*:/g, 'opt gait:': /\bgait\s*:/g, 'opt name: (sequence)': /\}\s*,\s*\{\s*name\s*:/g,
  'camera_target': /\bcamera_target\b/g, 'camera_shot': /\bcamera_shot\b/g, 'camera_frame': /\bcamera_frame\b/g, 'camera_glide': /\bcamera_glide\b/g, 'camera_on': /\bcamera_on\b/g, 'camera_x': /\bcamera_x\b/g, 'camera_h': /\bcamera_h\b/g, 'camera_z': /\bcamera_z\b/g,
  'camera_look': /\bcamera_look\b/g, 'camera_pitch': /\bcamera_pitch\b/g, 'camera_yaw': /\bcamera_yaw\b/g, 'camera_roll': /\bcamera_roll\b/g, 'fade (key)': /['"]fade['"]|\bfade\s*:/g, 'fade_color': /\bfade_color\b/g,
  'MooodState': /\bMooodState\b/g, 'MooodShapes': /\bMooodShapes\b/g,
  // canvas beyond paths and fills
  'g.filter': prop('filter'), 'g.shadowBlur': prop('shadowBlur'), 'g.globalCompositeOperation': prop('globalCompositeOperation'), 'g.drawImage(': meth('drawImage'), 'OffscreenCanvas': /\bOffscreenCanvas\b/g, 'getImageData(': meth('getImageData'), 'putImageData(': meth('putImageData'),
  'createPattern(': meth('createPattern'), 'createConicGradient(': meth('createConicGradient'), 'createLinearGradient(': meth('createLinearGradient'), 'createRadialGradient(': meth('createRadialGradient'), 'fillText(': meth('fillText'), 'strokeText(': meth('strokeText'), 'measureText(': meth('measureText'),
  'Path2D': /\bPath2D\b/g, 'g.clip(': meth('clip'), 'setLineDash(': meth('setLineDash'), 'evenodd': /evenodd/g, 'g.setTransform(': meth('setTransform'), 'g.getTransform(': meth('getTransform'), 'ImageData': /\bnew ImageData\b/g, 'createImageBitmap': /\bcreateImageBitmap\b/g,
  // what a scene should not touch
  'Math.random': /Math\.random/g, 'Date/performance': /\bDate\.now|\bnew Date|\bperformance\./g, 'setTimeout/setInterval': /\bset(Timeout|Interval)\b/g, 'globalThis/self/window/document': /\b(globalThis|window|document)\b|\bself\./g, 'fetch(': /\bfetch\s*\(/g,
};
const ANIM = ['clamp', 'mix', 'span', 'ease', 'easeOf', 'turn', 'hash', 'noise', 'drift', 'joint', 'blend'];
const EASES = ['smooth', 'linear', 'in', 'out', 'inOut', 'back', 'spring', 'anticipate'];
export function codeWords(text) {
  const w = {}; if (!text) return w;
  const t = strip(text);
  for (const [k, re] of Object.entries(CODE)) { const n = (t.match(re) || []).length; if (n) w[k] = n; }
  for (const a of ANIM) { const n = (t.match(new RegExp(`\\banim\\.${a}(?!${W})`, 'g')) || []).length; if (n) w[`anim.${a}`] = n; }
  // (anim destructured: const { clamp, mix } = anim)
  for (const m of t.matchAll(/\{([^{}]*)\}\s*=\s*(?:e\.|scene\.|s\.)?anim\b/g)) for (const a of m[1].split(',').map(x => x.trim().split(':')[0].trim())) if (ANIM.includes(a)) add(w, `anim.${a} (destructured)`);
  for (const e of EASES) { const n = (t.match(new RegExp(`ease\\s*:\\s*['"]${e}['"]|ease\\.${e}(?!${W})|easeOf\\(['"]${e}['"]\\)`, 'g')) || []).length; if (n) w[`ease ${e}`] = n; }
  const EVENTS = ['change', 'move', 'load', 'action', 'arrived', 'line', 'cut', 'signal', 'tell'];
  let events = 0;
  for (const m of t.matchAll(/\.on\s*\(\s*(['"])(\w+)\1/g)) if (EVENTS.includes(m[2])) { add(w, `scene.on('${m[2]}')`); events++; }
  // (a person's .on(point): every other .on( call)
  { const all = w['.on('] || 0; delete w['.on(']; if (all - events > 0) w['person.on(point)'] = all - events; }
  // a layer's options, as written at e.layer(name, { … }
  for (const m of t.matchAll(/\.layer\s*\(\s*[^,()]+(?:\([^()]*\))?[^,()]*,\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g)) for (const k of ['pivot', 'wind', 'drift', 'flicker', 'shimmer', 'blend', 'depth', 'box']) if (new RegExp(`(^|[,{\\s])${k}\\s*[:,}]|(^|[,{\\s])${k}\\s*$`).test(m[1])) add(w, `layer opt ${k} (written inline)`);
  for (const m of t.matchAll(/blend\s*:\s*['"](\w+)['"]/g)) add(w, `layer blend "${m[1]}"`);
  for (const m of t.matchAll(/camera_shot\s*:\s*(['"]\w+['"]|[\d.]+)/g)) add(w, `camera_shot ${/['"]/.test(m[1]) ? m[1].replace(/['"]/g, '') : 'a number'}`);
  return w;
}

if (process.argv[1].endsWith('words.mjs')) {
  const all = scenes(), out = { scenes: [], modules: {} };
  for (const s of all) {
    const o = s.spec.objects || [];
    const src = {
      'element code': o.map(x => x.code || '').join('\n'), animate: o.map(x => x.animate || '').join('\n'), 'element script': o.map(x => x.script || '').join('\n'),
      script: s.spec.script || '', showcase: s.spec.showcase || '', lib: s.spec.lib || '', relief: s.spec.relief || '',
    };
    const code = {}, byPart = {};
    for (const [part, text] of Object.entries(src)) { const w = codeWords(text); byPart[part] = w; for (const [k, n] of Object.entries(w)) add(code, k, n); }
    out.scenes.push({ world: s.world, folder: s.folder, title: s.spec.title, json: jsonWords(s.spec), code, byPart, modules: s.spec.modules || [] });
  }
  for (const w of WORLDS) {
    out.modules[w] = {};
    for (const f of readdirSync(join(ROOT, w, 'modules')).filter(f => f.endsWith('.js'))) out.modules[w][f] = codeWords(readFileSync(join(ROOT, w, 'modules', f), 'utf8'));
  }
  writeFileSync(new URL('./words.json', import.meta.url), JSON.stringify(out, null, 1));
  // the table over all scenes
  for (const which of ['json', 'code']) {
    const tot = {};
    for (const s of out.scenes) for (const [k, n] of Object.entries(s[which])) { tot[k] ||= { scenes: 0, uses: 0 }; tot[k].scenes++; tot[k].uses += n; }
    console.log(`\n== ${which}: word | scenes | uses`);
    for (const k of Object.keys(tot).sort()) console.log(`${k} | ${tot[k].scenes} | ${tot[k].uses}`);
  }
  console.log('\n== modules (textual, per world/file)');
  for (const [w, fs] of Object.entries(out.modules)) for (const [f, ws] of Object.entries(fs)) console.log(w, f, JSON.stringify(ws));
}
```

### A3. `probe.mjs` — the paint probe and the animate probe

```js
// The paintings as the scenes' code makes them, counted without drawing anything: each element's `code` is run once, in
// Node, into the engine's own Recorder (engine 2's, gone — a display list, no canvas, no GPU), with
// the scene's lib, its world's modules and the state as scene.json starts it. Then each `animate` is run for 120 frames
// against a counting stand-in. No frame is rendered. e as core/element.js gives it (trimmed to what counts).
import { scenes, kindOf, ROOT } from './load.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ENGINE = '<the folder the old engines were in (not here)>';
// ---- what a worker has and Node has not (never drawn on here)
const anything = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'width' ? 10 : k === 'data' ? new Uint8ClampedArray(4 * 4096 * 16) : k === 'actualBoundingBoxAscent' ? 8 : k === 'actualBoundingBoxDescent' ? 2 : k === 'actualBoundingBoxLeft' ? 0 : k === 'actualBoundingBoxRight' ? 10 : anything()), apply: () => anything(), set: () => true, construct: () => anything() });
let offscreen = 0, readback = 0;
globalThis.OffscreenCanvas = class { constructor(w, h) { this.width = w; this.height = h; offscreen++; }
  getContext() {
    const c = this;
    return new Proxy({}, { get: (t, k) => (k === 'canvas' ? c : k === 'measureText' ? s => ({ width: String(s).length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, actualBoundingBoxLeft: 0, actualBoundingBoxRight: String(s).length * 6 }) : k === 'getImageData' ? (x, y, w, h) => { readback++; return { width: w, height: h, data: new Uint8ClampedArray(4 * w * h) }; } : k === 'createImageData' ? (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(4 * w * h) }) : k in t ? t[k] : (...a) => anything()), set: (t, k, v) => { t[k] = v; return true; } });
  } };
globalThis.ImageData = class { constructor(a, b, c) { if (typeof a === 'number') { this.width = a; this.height = b; this.data = new Uint8ClampedArray(4 * a * b); } else { this.data = a; this.width = b; this.height = c ?? a.length / 4 / b; } } };
globalThis.DOMMatrix = class DM { constructor(m = [1, 0, 0, 1, 0, 0]) { [this.a, this.b, this.c, this.d, this.e, this.f] = m; }
  mulSelf(a, b, c, d, e, f) { const m = this; [m.a, m.b, m.c, m.d, m.e, m.f] = [m.a * a + m.c * b, m.b * a + m.d * b, m.a * c + m.c * d, m.b * c + m.d * d, m.a * e + m.c * f + m.e, m.b * e + m.d * f + m.f]; return this; }
  translateSelf(x = 0, y = 0) { return this.mulSelf(1, 0, 0, 1, x, y); } scaleSelf(x = 1, y = x) { return this.mulSelf(x, 0, 0, y, 0, 0); }
  rotateSelf(deg = 0) { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return this.mulSelf(c, s, -s, c, 0, 0); } multiplySelf(o) { return this.mulSelf(o.a, o.b, o.c, o.d, o.e, o.f); }
  translate(x, y) { return new DM([this.a, this.b, this.c, this.d, this.e, this.f]).translateSelf(x, y); } scale(x, y) { return new DM([this.a, this.b, this.c, this.d, this.e, this.f]).scaleSelf(x, y); } rotate(d) { return new DM([this.a, this.b, this.c, this.d, this.e, this.f]).rotateSelf(d); }
  multiply(o) { return new DM([this.a, this.b, this.c, this.d, this.e, this.f]).multiplySelf(o); }
  inverse() { const k = this.a * this.d - this.b * this.c; return new DM([this.d / k, -this.b / k, -this.c / k, this.a / k, (this.c * this.f - this.d * this.e) / k, (this.b * this.e - this.a * this.f) / k]); }
  transformPoint(p) { return { x: this.a * p.x + this.c * p.y + this.e, y: this.b * p.x + this.d * p.y + this.f }; } };
globalThis.Path2D = class { moveTo() {} lineTo() {} bezierCurveTo() {} quadraticCurveTo() {} arc() {} arcTo() {} ellipse() {} rect() {} roundRect() {} closePath() {} addPath() {} };
globalThis.MooodShapes = anything();
const { Recorder } = await import(pathToFileURL(`${ENGINE}/paint/recorder.js`).href);  // (engine 2's, gone)
const MooodKit = new Function(`${readFileSync(`${ENGINE}/scene/kit.js`, 'utf8')}\nreturn MooodKit;`)();

const STAGE = 16 / 9, WIDEST = 21 / 9;
const seeded = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hash = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const num = v => typeof v === 'number' && Number.isFinite(v);
const boxOf = (o, kind, round) => {
  const h = num(o.height) && o.height > 0 ? o.height : 2, box = Array.isArray(o.box) && o.box.length === 4 ? o.box.slice() : null;
  if (kind === 'plane') { const w = Math.max(0.05, num(o.width) ? o.width : 4), d = Math.max(0.05, num(o.depth) ? o.depth : 4); return [-w / 2, -d / 2, w / 2, d / 2]; }
  if (kind === 'sky') return [-0.3, -0.35, (round ? 2 * Math.PI : STAGE) + 0.3, 1.25];
  if (kind === 'insert') return [(STAGE - WIDEST) / 2, 0, (STAGE + WIDEST) / 2, 1];
  if (kind === 'particles') return box || [-0.5, -0.5, 0.5, 0.5];
  return box || [-0.8 * h, -1.1 * h, 0.8 * h, 0.15 * h];
};
const recInfo = rec => ({ h: `${rec.h1.toString(16)}.${rec.h2.toString(16)}.${rec.ops.length}`, ops: rec.ops.length, extent: rec.extent ? rec.extent.map(v => +v.toFixed(3)) : null, props: propsOf(rec) });
// which properties a recording sets beyond colours and widths (op 32 PROP: id, ref), and images drawn (op 23)
const PROPS = ['fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'lineJoin', 'miterLimit', 'lineDashOffset', 'globalAlpha', 'globalCompositeOperation', 'filter', 'shadowBlur', 'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'font', 'textAlign', 'textBaseline', 'direction', 'letterSpacing', 'wordSpacing', 'fontKerning', 'imageSmoothingEnabled', 'imageSmoothingQuality'];
function propsOf(rec) {
  const out = {};
  for (const r of rec.refs) {
    if (typeof r === 'string' && /blur\(|drop-shadow|brightness\(|contrast\(|saturate\(|grayscale\(|sepia\(|hue-rotate|opacity\(/.test(r)) out.filter = (out.filter || 0) + 1;
    else if (typeof r === 'string' && /^(lighter|multiply|screen|overlay|darken|lighten|destination-|source-(in|out|atop)|xor|copy|soft-light|hard-light|color-dodge|color-burn|difference|exclusion|hue|saturation|color|luminosity)/.test(r)) out[`composite:${r}`] = (out[`composite:${r}`] || 0) + 1;
    else if (r && typeof r === 'object' && r.kind) out[`style:${r.kind}`] = (out[`style:${r.kind}`] || 0) + 1;
    else if (r && typeof r === 'object' && !r.kind && !Array.isArray(r) && !(r.c instanceof Float64Array) && !(r.cmds)) out.image = (out.image || 0) + 1;
    else if (r && r.cmds) out.path2d = (out.path2d || 0) + 1;
  }
  return out;
}

const result = [];
for (const s of scenes()) {
  globalThis.__mooodErrors = [];
  const spec = s.spec, round = ['around', 'roam'].includes(spec.camera?.mode);
  const texts = {};
  for (const m of spec.modules || []) { const d = join(ROOT, s.world, 'modules', `${m}.data.json`); const dt = existsSync(d) ? readFileSync(d, 'utf8') : ''; texts[m] = { code: s.mods[m], data: dt.trim() ? JSON.parse(dt) : null }; }
  const shared = MooodKit.shared(spec, { texts });
  const state = structuredClone(spec.state || {});
  const ground = (a, d) => (shared.ground ? shared.ground(a, d) : 0);
  const errors = [...globalThis.__mooodErrors.map(e => `shared: ${e}`)], warns = [];
  const els = [];
  for (const o of spec.objects || []) {
    const kind = kindOf(o);
    const rec0 = { id: o.id, kind, on: o.on ?? null, box: null, hasAnimate: !!o.animate, hasShader: !!o.shader, nUniforms: o.uniforms ? Object.keys(o.uniforms).length : 0 };
    els.push(rec0);
    if (kind === 'person' || kind === 'unseen') continue;
    const box = boxOf(o, kind, round); rec0.box = box;
    if (typeof o.code !== 'string' || !o.code.trim()) continue;
    let fn; try { fn = new Function('g', 'e', o.code); } catch (err) { errors.push(`${o.id}: ${err.message}`); continue; }
    const warnOnce = t => warns.push(`${o.id}: ${t}`);
    const newRecorder = () => { const r = new Recorder(warnOnce); r.fillStyle = r.strokeStyle = typeof o.color === 'string' ? o.color : '#000000'; r.lineCap = r.lineJoin = 'round'; return r; };
    const reads = new Set(); let timeRead = 0;
    const stateRead = new Proxy(state, { get: (v, k) => { if (typeof k === 'string') reads.add(k); return v[k]; }, has: (v, k) => { if (typeof k === 'string') reads.add(k); return k in v; }, ownKeys: v => { reads.add('*all keys*'); return Reflect.ownKeys(v); } });
    let cur = null; const parts = [], layers = [], lights = [], points = [];
    let rnd = seeded(hash(o.id ?? '#'));
    const mapped = (x, y) => { const m = cur.rec.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; };
    const sub = (what, run, into) => { const was = cur; cur = { rec: newRecorder(), ...what }; try { run(cur.rec); } catch (err) { errors.push(`${o.id} (${what.layer >= 0 ? 'layer' : 'part'}): ${err.message}`); } into.rec = cur.rec.end(); cur = was; };
    const spot = () => { const g = k => (o.place?.[k] ? (reads.add(o.place[k]), state[o.place[k]]) : undefined); const across = g('across') ?? o.across ?? 0, distance = g('distance') ?? o.distance ?? 0, gr = o.on ? 0 : ground(across, distance); return { across, distance, elevation: (g('elevation') ?? o.elevation ?? 0), ground: gr }; };
    const e = {
      id: o.id, get rnd() { return rnd; }, aspect: kind === 'sky' && round ? 2 * Math.PI : STAGE, get area() { return box.slice(); }, get state() { return stateRead; },
      anim: MooodKit.anim, kit: shared.kit, lib: shared.lib, ground, get spot() { return spot(); },
      light(x, y, r, color = '#ffd08a', strength = 0.6, name) { cur.lights.push({ r, color: String(color), strength: Number(strength), name: name == null ? null : String(name), in: cur.layer >= 0 ? 'layer' : cur.part >= 0 ? 'part' : 'base' }); lights.push(cur.lights[cur.lights.length - 1]); },
      at(x, y, name) { points.push(name == null ? null : String(name)); },
      part(dx, dz, paint, pbox) { if (cur.part >= 0 || cur.layer >= 0) { errors.push(`${o.id}: e.part in a part or a layer`); return; } const i = parts.length; parts.push({ dx, dz, box: pbox ? pbox.slice() : box.slice(), lights: [], rec: null }); sub({ part: i, layer: -1, lights: parts[i].lights }, g => paint(g, e), parts[i]); },
      layer(name, opts, paint) { if (typeof opts === 'function') { paint = opts; opts = {}; } if (cur.part >= 0 || cur.layer >= 0) { errors.push(`${o.id}: e.layer in a part or a layer`); return; } if (layers.some(l => l.name === name)) { warnOnce(`two layers named ${name}`); return; } const i = layers.length; layers.push({ name, opts: opts || {}, lights: [], rec: null }); sub({ part: -1, layer: i, lights: layers[i].lights }, g => paint(g, e), layers[i]); },
      debug() {}, warn: warnOnce, get t() { timeRead++; return 0; }, get phase() { timeRead++; return 0; },
      point: () => null, where: () => null, was: () => null, speed: () => null, lights: () => null,
    };
    cur = { rec: newRecorder(), part: -1, layer: -1, lights: [] };
    const r0 = offscreen, b0 = readback;
    try { fn(cur.rec, e); } catch (err) { errors.push(`${o.id}: ${err.message}`); }
    const base = cur.rec.end();
    Object.assign(rec0, {
      base: recInfo(base), reads: [...reads].sort(), timeRead, offscreen: offscreen - r0, readback: readback - b0,
      layers: layers.map(l => ({ name: l.name, opts: l.opts, box: l.opts.box || null, ...recInfo(l.rec), lights: l.lights.length })),
      parts: parts.map(p => ({ dx: p.dx, dz: p.dz, box: p.box, ...recInfo(p.rec), lights: p.lights.length })),
      glows: lights.map(l => ({ name: l.name, r: l.r, in: l.in, strength: l.strength })), points: points,
    });
  }
  // ---- animate, 120 frames, counted
  const anims = [];
  for (const o of spec.objects || []) {
    if (typeof o.animate !== 'string' || !o.animate.trim()) continue;
    let fn; try { fn = new Function('e', o.animate); } catch (err) { errors.push(`${o.id} animate: ${err.message}`); continue; }
    const c = { layerSet: 0, uniform: 0, glow: 0, at: 0, point: 0, where: 0, was: 0, speed: 0, burst: 0, stateRead: 0, mem: 0, spot: 0 };
    const handles = new Map(), layersTouched = new Set(), uniformsTouched = new Set(), stateKeys = new Set();
    const handle = name => { let h = handles.get(name); if (!h) { const v = { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1, alpha: 1, brightness: 1 }; h = new Proxy(v, { set: (t, k, val) => { c.layerSet++; layersTouched.add(`${name}.${String(k)}`); if (k === 'scale') t.scaleX = t.scaleY = val; else t[k] = val; return true; }, get: (t, k) => (k === 'scale' ? t.scaleX : t[k]) }); handles.set(name, h); } return h; };
    const mem = {}; let t = 0;
    const st = new Proxy(state, { get: (v, k) => { if (typeof k === 'string') { c.stateRead++; stateKeys.add(k); } return v[k]; } });
    const a = {
      id: o.id, aspect: kindOf(o) === 'sky' && round ? 2 * Math.PI : STAGE, get t() { return t; }, dt: 1 / 60, get cut() { return t; }, state: st,
      was: k => { c.was++; return state[k]; }, speed: () => { c.speed++; return 0; }, get mem() { c.mem++; return mem; }, layer: handle,
      uniform(n) { c.uniform++; uniformsTouched.add(n); }, burst() { c.burst++; }, glow() { c.glow++; }, at() { c.at++; },
      point() { c.point++; return [0, 0]; }, where() { c.where++; return { across: 0, distance: 0, elevation: 0 }; },
      get spot() { c.spot++; return { across: o.across ?? 0, distance: o.distance ?? 0, elevation: o.elevation ?? 0, ground: 0 }; }, hero: null,
      anim: MooodKit.anim, kit: shared.kit, lib: shared.lib, debug() {}, warn() {},
    };
    const N = 120; let err = null;
    for (let i = 0; i < 20; i++) { t = i / 60; try { fn(a); } catch (e2) { err = e2.message; break; } }
    for (const k in c) c[k] = 0;
    const t0 = process.hrtime.bigint();
    if (!err) for (let i = 0; i < N; i++) { t = 1 + i / 60; try { fn(a); } catch (e2) { err = e2.message; break; } }
    const us = Number(process.hrtime.bigint() - t0) / 1000 / N;
    const per = Object.fromEntries(Object.entries(c).filter(([, v]) => v).map(([k, v]) => [k, +(v / N).toFixed(2)]));
    anims.push({ id: o.id, lines: o.animate.split('\n').length, perFrame: per, layers: layersTouched.size, uniforms: uniformsTouched.size, stateKeys: stateKeys.size, usNode: +us.toFixed(1), err });
  }
  result.push({ world: s.world, folder: s.folder, title: spec.title, els, anims, errors, warns: [...new Set(warns)], moduleErrors: globalThis.__mooodErrors.slice() });
}
writeFileSync(new URL('./probe.json', import.meta.url), JSON.stringify(result));
for (const r of result) {
  const painted = r.els.filter(e => e.base);
  const nl = painted.reduce((n, e) => n + e.layers.length, 0), np = painted.reduce((n, e) => n + e.parts.length, 0), ng = painted.reduce((n, e) => n + e.glows.length, 0);
  console.log(`${r.world}/${r.folder}: painted elements ${painted.length}, layers ${nl}, parts ${np}, glows(e.light) ${ng}, animates ${r.anims.length}, errors ${r.errors.length}, warns ${r.warns.length}`);
  for (const e of r.errors.slice(0, 12)) console.log('   ERR', e.slice(0, 200));
  for (const e of r.warns.slice(0, 6)) console.log('   warn', e.slice(0, 200));
}
```

### A4. `cost.mjs` — counts that drive cost

```js
// Counts that drive cost, per scene: from scene.json (load.mjs) and the paint probe (probe.json).
import { scenes, kindOf } from './load.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const probe = JSON.parse(readFileSync(new URL('./probe.json', import.meta.url), 'utf8'));
// rate, longest life, count of each kind as core/particles.js PRESETS has them (BASE: rate 10, life [1, 2], count 0)
const PRE = { snow: { count: 14000 }, blizzard: { count: 30000 }, rain: { count: 9000 }, drops: { rate: 1.5, life: 8 }, sparks: { rate: 0, life: 1.1, burst: 40 }, embers: { rate: 5, life: 4.5 }, fire: { rate: 40, life: 0.9 },
  smoke: { rate: 8, life: 9, size: 3 }, puff: { rate: 0, life: 2.4, burst: 24, size: 0.7 }, dust: { rate: 12, life: 14 }, splashes: { rate: 0, life: 0.7, burst: 30 }, fireflies: { rate: 5, life: 12 }, petals: { rate: 4, life: 7 }, leaves: { rate: 3, life: 8 }, bubbles: { rate: 4, life: 4 } };
const tmpl = t => t.replace(/\/\/.*$/gm, '').replace(/(['"`])(?:\\.|(?!\1).)*\1/g, 'S').replace(/-?\d+(\.\d+)?(e-?\d+)?/g, 'N').replace(/\s+/g, ' ').trim();
const r1 = v => Math.round(v * 10) / 10;
const out = [];
for (const s of scenes()) {
  const spec = s.spec, P = probe.find(p => p.world === s.world && p.folder === s.folder), byId = new Map(P.els.map(e => [e.id, e]));
  const o = spec.objects, kinds = {};
  for (const x of o) kinds[kindOf(x)] = (kinds[kindOf(x)] || 0) + 1;
  const painted = P.els.filter(e => e.base && e.kind !== 'particles');
  const sheets = [];
  for (const e of painted) { if (e.base.extent) sheets.push({ el: e.id, what: 'base', h: e.base.h }); for (const l of e.layers) if (l.extent) sheets.push({ el: e.id, what: 'layer', h: l.h }); for (const p of e.parts) if (p.extent) sheets.push({ el: e.id, what: 'part', h: p.h }); }
  const emptyBase = painted.filter(e => !e.base.extent).length;
  const nLayers = painted.reduce((n, e) => n + e.layers.length, 0), nParts = painted.reduce((n, e) => n + e.parts.length, 0);
  const distinct = new Set(sheets.map(x => x.h)).size;
  // groups of elements written from one template (the code's text with its numbers and strings taken out)
  const groups = new Map();
  for (const x of o) { if (!x.code || x.particles) continue; const k = tmpl(x.code); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x.id); }
  const rep = [...groups.entries()].filter(([, ids]) => ids.length >= 3).sort((a, b) => b[1].length - a[1].length).map(([k, ids]) => {
    const es = ids.map(id => byId.get(id)).filter(e => e && e.base);
    const sig = e => [e.base.h, ...e.layers.map(l => l.h), ...e.parts.map(p => p.h)].join('|');
    const sh = es.reduce((n, e) => n + (e.base.extent ? 1 : 0) + e.layers.length + e.parts.length, 0);
    const ly = es.map(e => e.layers.length), pt = es.map(e => e.parts.length);
    return { template: k.length > 70 ? `${k.slice(0, 70)}…` : k, elements: ids.length, sheets: sh, distinctPictures: new Set(es.map(sig)).size, layersEach: `${Math.min(...ly)}–${Math.max(...ly)}`, partsEach: `${Math.min(...pt)}–${Math.max(...pt)}`, sample: ids.slice(0, 3).join(', ') };
  });
  const inGroups = rep.reduce((n, g) => n + g.elements, 0), sheetsInGroups = rep.reduce((n, g) => n + g.sheets, 0);
  // people
  const people = o.filter(x => x.person), st = spec.state || {};
  const away = people.filter(p => st[`${p.id}_here`] === false).length;
  // lights
  const L = spec.lights || [], lk = {};
  for (const l of L) { const k = l.daylight != null ? 'daylight' : l.of != null ? 'of' : l.from != null ? 'far' : l.at != null ? 'carried(at)' : 'point'; lk[k] = (lk[k] || 0) + 1; }
  const inWorld = painted.filter(e => e.kind === 'card' || e.kind === 'plane'); const glows = inWorld.reduce((n, e) => n + e.glows.length, 0), skyGlows = painted.filter(e => e.kind === 'sky' || e.kind === 'insert').reduce((n, e) => n + e.glows.length, 0); const glowMax = inWorld.map(e => ({ id: e.id, n: e.glows.length, r: Math.max(0, ...e.glows.map(g => g.r)) })).filter(x => x.n).sort((a, b) => b.n - a.n).slice(0, 4);
  const glowNames = new Set(); for (const e of inWorld) for (const g of e.glows) glowNames.add(`${e.id}#${g.name}`);
  const taken = new Set(L.filter(l => l.of != null && l.daylight == null).map(l => String(l.of)));
  const sources = L.filter(l => !(l.of != null && l.daylight == null)).length + glows;
  // shadows
  const casters = o.filter(x => x.shadow && !x.person), castPeople = people.filter(p => p.shadow !== false).length;
  const casterQuads = casters.reduce((n, x) => { const e = byId.get(x.id); return n + (e && e.base ? 1 + e.layers.length + e.parts.length : 1); }, 0);
  const named = {}; for (const x of casters) if (x.shadow && x.shadow.light) named[x.shadow.light] = (named[x.shadow.light] || 0) + 1;
  // particles
  const em = o.filter(x => x.particles).map(x => {
    const p = x.particles, pre = PRE[p.kind] || {}, rate = p.rate ?? pre.rate ?? 10, life = Array.isArray(p.life) ? Math.max(...p.life) : p.life ?? pre.life ?? 2, count = p.count ?? pre.count ?? 0;
    const size = Array.isArray(p.size) ? Math.max(...p.size) : p.size ?? pre.size ?? 0.05, burst = p.burst ? (p.burst.count ?? pre.burst ?? 0) : pre.burst && p.burst !== null && ['sparks', 'puff', 'splashes'].includes(p.kind) ? pre.burst : 0;
    return { id: x.id, kind: p.kind, alive: ['snow', 'blizzard', 'rain'].includes(p.kind) && p.around !== false ? count : Math.round(rate * life), burst, size, amount: p.amount ?? 1, sprite: !!x.code, shadow: p.shadow ?? (p.kind === 'smoke' ? 0.6 : p.kind === 'puff' ? 0.4 : 0) };
  });
  // surfaces
  const surf = painted.filter(e => e.kind === 'card' || e.kind === 'plane').map(e => ({ id: e.id, kind: e.kind, w: e.box[2] - e.box[0], h: e.box[3] - e.box[1], layers: e.layers.length, parts: e.parts.length })).sort((a, b) => b.w * b.h - a.w * a.h);
  const layerMax = painted.map(e => ({ id: e.id, n: e.layers.length })).sort((a, b) => b.n - a.n).slice(0, 4).filter(x => x.n > 0);
  const partMax = painted.map(e => ({ id: e.id, n: e.parts.length })).sort((a, b) => b.n - a.n).slice(0, 4).filter(x => x.n > 0);
  // paintings that read keys described as smooth (painted again as the key moves), with and without `redraw`
  const smooth = new Set(Object.entries(spec.states || {}).filter(([, d]) => d.smooth).map(([k]) => k));
  const rereads = painted.map(e => { const x = o.find(q => q.id === e.id); const ks = e.reads.filter(k => smooth.has(k)); return { id: e.id, keys: ks, redraw: x.redraw || null, reads: e.reads.length, w: e.box[2] - e.box[0], h: e.box[3] - e.box[1], kind: e.kind }; }).filter(x => x.keys.length);
  const anyReads = painted.filter(e => e.reads.length).length;
  const row = {
    world: s.world, folder: s.folder, title: spec.title, files: s.nfiles, lines: s.nlines, objects: o.length, kinds, on: o.filter(x => x.on != null).length, place: o.filter(x => x.place).length,
    painted: painted.length, emptyBase, layers: nLayers, parts: nParts, sheets: sheets.length, distinctSheets: distinct, quads: painted.length + nLayers + nParts,
    groups: rep, inGroups, sheetsInGroups,
    people: people.length, peopleAway: away, lights: L.length, lightKinds: lk, glows, skyGlows, glowMax, glowNames: glowNames.size, takenOver: taken.size, sources, through: L.filter(l => l.through).length,
    casters: casters.length, casterQuads, castPeople, shadowLightNamed: named, translucent: o.filter(x => x.translucent != null).length, glowsFlag: o.filter(x => x.glows).length, inside: o.filter(x => x.inside).length,
    emitters: em, aliveSum: em.reduce((n, e) => n + e.alive, 0), mirrors: o.filter(x => x.plane && x.reflect).map(x => x.id), glass: o.filter(x => x.glass).map(x => x.id), inserts: o.filter(x => x.insert != null).map(x => x.id),
    shaders: o.filter(x => x.shader).length, shaderTexts: new Set(o.filter(x => x.shader).map(x => x.shader)).size, uniforms: o.reduce((n, x) => n + (x.uniforms ? Object.keys(x.uniforms).length : 0), 0),
    animates: o.filter(x => x.animate).length, widgets: (spec.widgets || []).length, largest: surf.slice(0, 5).map(x => `${x.id} ${r1(x.w)}×${r1(x.h)} m${x.layers ? ` +${x.layers} layers` : ''}${x.parts ? ` +${x.parts} parts` : ''}`), layerMax, partMax,
    anyReads, rereads, unlit: !(typeof (spec.light || {}).ambient === 'number') && !Object.values((spec.light || {}).looks || {}).some(l => typeof l.ambient === 'number'), ambient: (spec.light || {}).ambient ?? null, looksWithAmbient: Object.entries((spec.light || {}).looks || {}).filter(([, l]) => typeof l.ambient === 'number').map(([k]) => k),
    litPlanes: o.filter(x => x.lit != null).length, offscreen: painted.reduce((n, e) => n + (e.offscreen || 0), 0), readback: painted.reduce((n, e) => n + (e.readback || 0), 0), timeRead: painted.reduce((n, e) => n + (e.timeRead || 0), 0),
    probeErrors: P.errors, probeWarns: P.warns,
  };
  out.push(row);
}
writeFileSync(new URL('./cost.json', import.meta.url), JSON.stringify(out, null, 1));
for (const r of out) {
  console.log(`\n### ${r.world} / ${r.folder} — «${r.title}»  (${r.files} files, ${r.lines} lines)`);
  console.log(`objects ${r.objects} ${JSON.stringify(r.kinds)}; on-anchored ${r.on}; with place ${r.place}; painted ${r.painted} (base empty in ${r.emptyBase}); layers ${r.layers}; parts ${r.parts}; sheets with ink ${r.sheets} (distinct pictures ${r.distinctSheets}); quads ${r.quads}`);
  console.log(`repeated templates: ${r.inGroups} elements / ${r.sheetsInGroups} sheets :: ${r.groups.map(g => `[${g.template}] ×${g.elements} → ${g.sheets} sheets, ${g.distinctPictures} distinct, layers ${g.layersEach}, parts ${g.partsEach}`).join(' ;; ')}`);
  console.log(`people ${r.people} (away at start ${r.peopleAway}); lights in spec ${r.lights} ${JSON.stringify(r.lightKinds)}, through ${r.through}; e.light glows standing in the world ${r.glows} (names ${r.glowNames}; most: ${r.glowMax.map(x => x.id + ' ' + x.n).join(', ')}); sky/insert glows ${r.skyGlows}; light sources in all ${r.sources}; unlit=${r.unlit} ambient=${r.ambient} looksWithAmbient=${r.looksWithAmbient}; lit planes ${r.litPlanes}`);
  console.log(`shadow casters ${r.casters} elements (${r.casterQuads} quads) + ${r.castPeople} people; named light ${JSON.stringify(r.shadowLightNamed)}; translucent ${r.translucent}; glows ${r.glowsFlag}; inside ${r.inside}`);
  console.log(`emitters ${r.emitters.length}: ${r.emitters.map(e => `${e.id}:${e.kind}~${e.alive}${e.burst ? `+burst${e.burst}` : ''}${e.size > 2 ? ` BIG${e.size}m` : ''}${typeof e.amount === 'string' ? `*${e.amount}` : ''}`).join(', ')} | alive sum ${r.aliveSum}`);
  console.log(`mirrors ${r.mirrors.join(',') || '-'}; glass ${r.glass.join(',') || '-'}; inserts ${r.inserts.join(',') || '-'}; shaders ${r.shaders} (${r.shaderTexts} texts, ${r.uniforms} uniforms); animates ${r.animates}; widgets ${r.widgets}`);
  console.log(`largest: ${r.largest.join('; ')} | most layers: ${r.layerMax.map(x => `${x.id} ${x.n}`).join(', ')} | most parts: ${r.partMax.map(x => `${x.id} ${x.n}`).join(', ')}`);
  console.log(`paintings reading state: ${r.anyReads}; reading smooth keys: ${r.rereads.map(x => `${x.id}(${x.keys.join('/')}${x.redraw ? ' redraw=' + JSON.stringify(x.redraw) : ''} ${r1(x.w)}×${r1(x.h)})`).join(', ') || '-'}`);
  if (r.offscreen || r.readback || r.timeRead) console.log(`canvases of its own ${r.offscreen}, pixel read-backs ${r.readback}, e.t read in painting ${r.timeRead}`);
}
```

### A5. `sh.mjs` — the shaders

```js
// The authors' shaders: every element's `shader`, hashed (sha1 of the text), with what each names of the engine's GLSL.
import { scenes, sha, lines } from './load.mjs';
import { writeFileSync } from 'node:fs';
const GIVEN = ['layer', 'emission', 'u_time', 'cycle', 'noise1', 'noise2', 'noise3', 'hash1', 'wobble', 'wobble2', 'luma', 'PI'];           // artist2.md names these
const UNDOC = ['srgbToLinear', 'linearToSrgb', 'u_tick', 'u_epoch', 'u_origin', 'u_viewFwd', 'u_viewRight', 'u_viewport', 'cycleAt', 'hashU', 'loopNoise', 'loopNoise2', 'timeAt', 'timeWobble', 'flickerOf', 'finite', 'at_dx', 'at_dy', 'at_here', 'at_from', 'u_layerN', 'vtRead', 'gl_FragCoord'];
const GLSL = ['fwidth', 'dFdx', 'dFdy', 'discard', 'uint', 'ivec2', 'uvec2', 'for', 'float\\[', 'vec2\\[', 'vec4\\[', 'const', 'mod', 'smoothstep', 'exp', 'pow', 'floor', 'fract', 'step', 'texture', 'if', 'continue', 'break', 'bool', 'int'];
const count = (code, w) => (code.match(new RegExp(`(?<![.A-Za-z0-9_])${w}(?![A-Za-z0-9_])`, 'g')) || []).length;
const by = new Map();
for (const s of scenes()) for (const o of s.spec.objects) if (o.shader) {
  const h = sha(o.shader);
  if (!by.has(h)) by.set(h, { text: o.shader, who: [], uniforms: [] });
  by.get(h).who.push({ scene: `${s.world}/${s.folder}`, id: o.id, kind: o.sky ? 'sky' : o.insert != null ? 'insert' : o.plane ? 'plane' : 'card', drape: !!o.drape, n: Object.keys(o.uniforms || {}).length, animate: !!o.animate, translucent: o.translucent ?? null, glows: !!o.glows, shadow: !!o.shadow, reflect: !!o.reflect });
}
const rows = [], tot = {};
for (const [h, v] of by) {
  const code = v.text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const use = {}; for (const w of [...GIVEN, ...UNDOC]) { const n = count(code, w); if (n) use[w] = n; }
  const glsl = {}; for (const w of GLSL) { const n = (code.match(new RegExp(`(?<![.A-Za-z0-9_])${w}(?![A-Za-z0-9_])`.replace('\\[(?![A-Za-z0-9_])', '\\['), 'g')) || []).length; if (n) glsl[w.replace('\\', '')] = n; }
  const layerIdx = [...new Set([...code.matchAll(/(?<![.A-Za-z0-9_])layer\s*\(\s*([^,]+),/g)].map(m => m[1].trim()))].sort();
  const fns = [...code.matchAll(/^\s*(?:float|vec[234]|void|int|bool|mat[234])\s+([A-Za-z_0-9]+)\s*\(/gm)].map(m => m[1]).filter(f => f !== 'shade');
  const usesPainted = count(code, 'painted'), usesUv = count(code, 'uv') - 1, usesAt = count(code, 'at') - 1;
  const hashArg = [...new Set([...code.matchAll(/hash1\s*\(\s*(vec[23]|uint|[a-z]+)/g)].map(m => m[1]))];
  const row = { h, L: lines(v.text), nonComment: code.split('\n').filter(l => l.trim()).length, users: v.who.length, scenes: [...new Set(v.who.map(w => w.scene))], who: v.who, use, glsl, layerIdx, fns, usesPainted, usesUv, usesAt, hashArg, timeBy: [use.u_time ? 'u_time' : null, use.cycle ? 'cycle()' : null].filter(Boolean) };
  rows.push(row);
  for (const k of Object.keys({ ...use, ...Object.fromEntries(Object.entries(glsl).map(([k, n]) => [`glsl:${k}`, n])) })) { tot[k] ||= { texts: 0, files: 0 }; tot[k].texts++; tot[k].files += v.who.length; }
}
writeFileSync(new URL('./shaders.json', import.meta.url), JSON.stringify(rows, null, 1));
console.log('distinct texts', rows.length, 'files', rows.reduce((n, r) => n + r.users, 0), 'lines distinct', rows.reduce((n, r) => n + r.L, 0), 'non-comment', rows.reduce((n, r) => n + r.nonComment, 0), 'lines all files', rows.reduce((n, r) => n + r.L * r.users, 0));
console.log('\nname | distinct texts | files');
for (const k of Object.keys(tot).sort()) console.log(`${k} | ${tot[k].texts} | ${tot[k].files}`);
console.log('\nper text:');
for (const r of rows) console.log(`${r.h} | ${r.L}L (${r.nonComment} code) | users ${r.users}: ${r.who.slice(0, 3).map(w => `${w.scene.split('/')[1]}/${w.id}(${w.kind}${w.drape ? ',drape' : ''}${w.reflect ? ',reflect' : ''}${w.shadow ? ',shadow' : ''}${w.translucent != null ? ',translucent' : ''}${w.glows ? ',glows' : ''})`).join(' ')}${r.users > 3 ? ' …' : ''} | uniforms ${[...new Set(r.who.map(w => w.n))].join('/')} | animate ${r.who.every(w => w.animate)} | layers read ${r.layerIdx.join(',') || '-'} | painted ${r.usesPainted > 1 ? 'read' : 'not read'} | uv ${r.usesUv > 0 ? 'read' : '-'} | time ${r.timeBy.join('+') || '-'} | own fns ${r.fns.join(',') || '-'} | ${JSON.stringify(r.use)} | ${JSON.stringify(r.glsl)} | hash1(${r.hashArg.join('/')})`);
```

### A6. `people.mjs` — people and casts

```js
// People in the scenes: who (cast characters), motions named in the code, the cast's tables.
import { scenes, WORLDS, ROOT } from './load.mjs';
import { strip } from './words.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
globalThis.MooodShapes = new Proxy({}, { get: () => new Proxy(function () {}, { get: () => () => 0, apply: () => 0 }) });
const anim = {};
for (const w of WORLDS) {
  const data = JSON.parse(readFileSync(join(ROOT, w, 'modules', 'cast.data.json'), 'utf8'));
  let cast = null; try { cast = new Function('anim', 'data', readFileSync(join(ROOT, w, 'modules', 'cast.js'), 'utf8'))(anim, data); } catch (e) { console.log(w, 'cast failed', e.message); }
  const sh = cast?.shapes || {}, motions = Object.keys(cast?.motions || data.motions || {});
  let seconds = 0; for (const m of Object.values(data.motions || {})) seconds += (m.n || 0) / (m.fps || 30);
  const chars = cast?.characters || {};
  const kinds = {}; for (const c of Object.values(chars)) { const k = `${c.kind || 'body'}/${c.style || '-'}`; kinds[k] = (kinds[k] || 0) + 1; }
  const garments = sh.garments || {}, hang = Object.entries(garments).filter(([, g]) => g.hang).map(([k, g]) => `${k}(${g.hang.map(h => `${h.from}→${h.to}${h.ragged ? ' ragged' : ''}${h.pleats ? ' pleats' : ''}`).join('+')})`);
  console.log(`\n## ${w}: cast keys ${Object.keys(cast || {}).join(',')}; motions ${motions.length} (${Math.round(seconds)} s in all); characters ${Object.keys(chars).length} ${JSON.stringify(kinds)}`);
  console.log(`   shapes tables: ${Object.entries(sh).map(([k, v]) => `${k}:${Object.keys(v).length}`).join(' ')}; styles ${JSON.stringify(sh.styles)}`);
  console.log(`   garments that hang (${hang.length}): ${hang.join(', ')}; garments with draw: ${Object.entries(garments).filter(([, g]) => g.draw).map(([k]) => k).join(',') || '-'}`);
  console.log(`   parts: ${Object.keys(sh.parts || {}).join(', ')}; parts with points: ${Object.entries(sh.parts || {}).filter(([, p]) => p.points).map(([k, p]) => `${k}#${Object.keys(p.points).join('/')}`).join(', ') || '-'}`);
  console.log(`   bodies ${Object.keys(cast?.bodies || {}).length}, outfits ${Object.keys(cast?.outfits || {}).length}, cast garments (bodies') ${Object.keys(cast?.garments || {}).length}`);
  const used = new Set();
  for (const s of scenes().filter(x => x.world === w)) {
    const people = s.spec.objects.filter(o => o.person);
    const code = strip([s.spec.script, s.spec.showcase, s.spec.lib].join('\n')), st = JSON.stringify(s.spec.state);
    const names = new Set();
    for (const m of motions) if (new RegExp(`['"\`]${m}['"\`]`).test(code) || new RegExp(`"${m}"`).test(st) || people.some(p => p.person.does === m || p.person.gait === m)) names.add(m);
    for (const n of names) used.add(n);
    const who = {}; for (const p of people) who[p.person.who || '(look)'] = (who[p.person.who || '(look)'] || 0) + 1;
    console.log(`   - ${s.folder}: people ${people.length}; characters ${Object.keys(who).length}: ${Object.entries(who).map(([k, n]) => (n > 1 ? `${k}×${n}` : k)).join(', ')}; motions named ${names.size}; shadow:false ${people.filter(p => p.shadow === false).length}; inside ${people.filter(p => p.inside).length}; on(element) ${people.filter(p => p.on).length}; place ${people.filter(p => p.place).length}; does ${people.filter(p => p.person.does).length}; own look ${people.filter(p => p.person.look).length}`);
  }
  console.log(`   motions of the cast named by this world's scenes: ${used.size} of ${motions.length}`);
}
```

### A7. `lay.mjs` — layer options and canvas features as painted

```js
import { readFileSync, writeFileSync } from 'node:fs';
const probe = JSON.parse(readFileSync(new URL('./probe.json', import.meta.url), 'utf8'));
const tot = {}, per = [];
for (const s of probe) {
  const c = {}; const add = (k, n = 1) => { c[k] = (c[k] || 0) + n; };
  for (const e of s.els) {
    if (!e.base) continue;
    const all = [e.base, ...e.layers, ...e.parts];
    for (const r of all) for (const [k, n] of Object.entries(r.props || {})) add(`recorded ${k}`);
    if (e.layers.length) add('elements with layers'); if (e.parts.length) add('elements with parts');
    if (e.glows.length) add('elements painting e.light'); if (e.points.length) add('elements marking e.at'); add('e.at points painted', e.points.length);
    for (const l of e.layers) { add('layers'); for (const k of Object.keys(l.opts)) add(`layer opt ${k}`); if (l.opts.blend) add(`layer blend=${l.opts.blend}`); if (!Object.keys(l.opts).length) add('layer with no option'); if (typeof l.opts.wind === 'object') add('layer wind as {strength,gust,scale}'); if (!l.extent) add('layer painting nothing'); }
    for (const p of e.parts) { add('parts'); if (p.dz !== 0) add('part at its own depth (dz≠0)'); }
    if (e.offscreen) add('paintings making an OffscreenCanvas'); if (e.readback) add('paintings reading pixels back');
  }
  per.push({ scene: `${s.world}/${s.folder}`, c });
  for (const [k, n] of Object.entries(c)) { tot[k] ||= { scenes: 0, n: 0 }; tot[k].scenes++; tot[k].n += n; }
}
writeFileSync(new URL('./lay.json', import.meta.url), JSON.stringify({ tot, per }, null, 1));
for (const k of Object.keys(tot).sort()) console.log(`${k} | ${tot[k].scenes} | ${tot[k].n}`);
```

### A8. `reads.mjs` — keys the paintings read

```js
// The state keys the paintings read (found by the probe as they read them), and how the scene's code changes them.
import { scenes } from './load.mjs';
import { readFileSync } from 'node:fs';
const probe = JSON.parse(readFileSync(new URL('./probe.json', import.meta.url), 'utf8'));
for (const s of scenes()) {
  const P = probe.find(p => p.world === s.world && p.folder === s.folder), keys = new Map();
  for (const e of P.els) for (const k of e.reads || []) { if (!keys.has(k)) keys.set(k, []); keys.get(k).push(e.id); }
  if (!keys.size) continue;
  const code = [s.spec.script, s.spec.showcase, s.spec.lib, ...Object.values(s.mods)].join('\n');
  console.log('##', s.world, s.folder);
  for (const [k, ids] of keys) {
    const d = (s.spec.states || {})[k] || {};
    const moved = (code.match(new RegExp(`\\b(move|set|turn)\\(\\s*['"]${k}['"]`, 'g')) || []).length, inObj = (code.match(new RegExp(`[{,]\\s*${k}\\s*:`, 'g')) || []).length;
    const over = (code.match(new RegExp(`move\\(\\s*['"]${k}['"][^)]*over`, 'g')) || []).length;
    const redraw = ids.map(id => s.spec.objects.find(o => o.id === id)).filter(o => o.redraw).map(o => `${o.id}:${JSON.stringify(o.redraw)}`);
    console.log(`  ${k}: paints ${ids.length} (${ids.slice(0, 4).join(',')}) smooth=${!!d.smooth} ${d.range ? 'range' : d.values ? 'values' : d.type || '?'} start=${JSON.stringify(s.spec.state[k])} | set/move calls ${moved} (move with over: ${over}), in {…} of cuts/shots ${inObj}${redraw.length ? ` | redraw ${redraw.join(' ')}` : ''}`);
  }
}
```
