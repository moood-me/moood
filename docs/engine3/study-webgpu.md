# study-webgpu — should engine 2 move to WebGPU now?

Written 2026-10-11. Read-only study: the plan (`requirements.md`, `decisions.md`, the five specs, the three.js audit),
the worktree `rpg-cheap-light` (branch `engine2-cheap-light`), three 0.186.1's source, the scenes' shaders
(`git show origin/env/dev:` in the world clones), and the web. Nothing was run of the project.

How sure each claim is: **[P]** primary source read today (Chrome's blog, Chromium / Dawn / three source or tracker);
**[R]** one third-party report, not cross-checked; **[M]** general knowledge, not checked today. Web pages and
Chromium sources were read through a summarising fetcher — line-level details of Chromium/Dawn source deserve a direct
look before anything is built on them. "Could not establish" is said where it is so.

The owner's two later statements are taken as given: (1) devices without WebGPU not opening scenes is acceptable to him;
(2) rewriting the authors' shaders is not a heavy cost by itself (automatic conversion or cheaper agents).

---

## 0. The answer in ten lines

- WebGPU is there on both reference devices **in Chrome**: Intel Gen9 on Windows is not blocklisted (Direct3D 12),
  a 2022 Android phone with Adreno or Mali on Android 12+ gets it. **Whether the app's WebView has it could not be
  established** (sources conflict). Whether it runs *well* on either is not published anywhere.
- WebGPU cures ONE of the engine's seen costs for certain kinds: the minutes of shader compilation at first open
  (another compiler, compiled in parallel off the thread). It does **not** cure the 18–28 ms frame: that is vertex
  work, shadow maps, passes and pixels — the same work on the same GPU under any API. The planned rework cures that.
- three's `WebGPURenderer` cannot carry this engine (no raw shaders, per-object cost, measured slower than
  `WebGLRenderer`). WebGPU means **leaving three as the GPU layer** and writing our own thin one on raw WebGPU.
- Of the planned work about three quarters is the same under WebGPU, design and code. About 6–7 thousand lines (the
  render area's shaders and GPU calls) keep their design and are typed again. About 1–1.3 thousand lines exist only
  because of WebGL 2.
- The authors' shaders: 84 files, 43 distinct texts, 895 lines; a small subset of GLSL. Conversion to WGSL is
  mechanical. Not an obstacle.
- **Recommendation: D** — do the planned rework on WebGL 2 now, shaped so that the move is a re-typing of the render
  area; move to raw WebGPU as its own step after the first run. It hinges on three facts, two of them not
  established (§6); each can be established in an hour without building anything, and if they come out well, **B is a
  legitimate choice and the only other one** (C is not).

---

## 1. Where WebGPU is available today

### 1.1 By browser and OS

| Where | State | Source, date |
|---|---|---|
| Chrome / Edge, Windows x64 (Direct3D 12), macOS, ChromeOS | on by default since 113 (May 2023) | [P] gpuweb wiki Implementation-Status, last updated 2026-10-02 — https://github.com/gpuweb/gpuweb/wiki/Implementation-Status |
| Chrome, Windows on ARM | wiki: behind a flag; Chromium source has a Qualcomm-Windows feature on by default with old Adreno blocked. Version: could not establish | [P] `gpu/config/gpu_finch_features.cc`, `webgpu_blocklist_impl.cc` (main, 2026-10-11) |
| Chrome, Linux | on only for an allowlist: Intel Gen12+ (Chrome 144, 2026-01-07); NVIDIA driver ≥ 535.183.01 **on Wayland** (Chrome 147, 2026-04-22). AMD, NVIDIA on X11, older Intel: behind a flag | [P] https://developer.chrome.com/blog/new-in-webgpu-144 , https://developer.chrome.com/blog/new-in-webgpu-147-148 , `software_rendering_list.json` entry 186 |
| Chrome, Android | since 121 (2024-01-18): Android 12+, Qualcomm (Adreno) and ARM (Mali); Intel too. Imagination (PowerVR): Android 16+, Chrome 139. **Samsung Xclipse: blocked ("TBD")**. Android 11 never got core WebGPU | [P] https://developer.chrome.com/blog/new-in-webgpu-121 ; the wiki; `webgpu_blocklist_impl.cc` |
| Chrome, Android 10–11 and devices without Vulkan 1.1 | only "compatibility mode" (OpenGL ES 3.1), shipped Chrome 146 (2026-03-10) — a restricted WebGPU: on ~45 % of such devices **no storage buffers in vertex shaders** | [P] https://developer.chrome.com/blog/new-in-webgpu-146 (2026-02-25); https://webgpufundamentals.org/webgpu/lessons/webgpu-compatibility-mode.html |
| **Android System WebView** (the app) | **could not establish.** Against: caniuse marks WebView 154 "not supported" (data 2026-09-30); the Chrome 121 intent gave no WebView milestone; chromestatus `webview_first: null`; caniwebview.com "unknown" (2026-10-10). For: later intents say "available on Android, Android WebView … since those platforms already support WebGPU" (2025-05-28) and "Shipping on Android/WebView: 146"; MDN compat data mirrors Chrome Android (121); in Chromium source `kWebGPUService` is on by default for every Android build and the Android app disables Vulkan features but names no WebGPU | [P] https://caniuse.com/webgpu ; https://groups.google.com/a/chromium.org/g/blink-dev/c/8Fy8vnSyNic ; https://groups.google.com/a/chromium.org/g/blink-dev/c/N3RlLGCOTJ4 ; MDN `api/GPU.json` |
| Samsung Internet | follows Chromium (24+) | caniuse |
| Firefox, Windows | since 141 (2025-07) | [P] https://mozillagfx.wordpress.com/2025/07/15/shipping-webgpu-on-windows-in-firefox-141/ |
| Firefox, macOS | Apple Silicon: 145 (macOS 26), 147 (all). Intel Macs: Nightly | [P] the wiki |
| Firefox, Linux and **Android** | not shipped (Nightly / flag) | [P] the wiki; MDN compat data |
| Safari | 26.0 (2025-09-15) on macOS 26, iOS / iPadOS 26, visionOS 26. Safari 26 on an older macOS: off. iOS 26 runs on iPhone 11 and later | [P] https://webkit.org/blog/17333/webkit-features-in-safari-26-0/ ; https://support.apple.com/en-us/123705 |
| iOS WKWebView | "will work in WKWebView when enabled by default" (Apple staff, 2025-06) — not confirmed by a document | https://developer.apple.com/forums/thread/770862 |
| Workers + OffscreenCanvas | Chrome since 113; Firefox since 141 (not service workers); Safari 26 by compat data only, no first-party word | [P] MDN `api/WorkerNavigator.json` |
| Current stable Chrome | 155 (full since 2026-10-06) | [P] versionhistory.googleapis.com |

No software adapter: when the GPU is blocklisted Chrome's `requestAdapter()` returns null (CPU adapters blocked
unconditionally) [P] `webgpu_blocklist_impl.cc`; https://developer.chrome.com/blog/new-in-webgpu-136 (2025-04-23).
That fits "one way": a device either has it or the scene does not open.

Direct3D 11 is **not** used for WebGPU on any Windows machine (Dawn's D3D11 backend is blocked; compatibility mode on
Windows is "being explored") [P] Chrome 146 post. So Windows = Direct3D 12 or nothing.

### 1.2 The two reference devices

**Laptop, Intel ~9th generation, UHD 630 (Gen9.5), Chrome on Windows.**
- Allowed. Chrome's WebGPU blocklist lets Intel through on D3D12 with no generation or driver condition; Dawn rejects
  only Gen7 (Haswell) [P] `webgpu_blocklist_impl.cc`, Dawn `d3d12/PhysicalDeviceD3D12.cpp` (main, 2026-10-11).
- It runs on a list of workarounds in Dawn specific to Gen9 / Gen9.5 (blend, depth-stencil clears, texture
  sub-allocation, small-format copies, Shader Model 6.6 off for some drivers) — most keyed to drivers older than
  31.0.101.2114/2121 [P] same file. Intel moved 6th–10th generation graphics to legacy support on 2022-07-27 (security
  and critical fixes only) [P] https://www.intel.com/content/www/us/en/support/articles/000102734/graphics.html . So
  a driver fault on this GPU is fixed in Dawn or never.
- **How well it runs: could not establish.** No published measurement of WebGPU against WebGL on Gen9 exists that I
  could find. Figma (2025-09-18) reports Windows as its worst platform: devices lost the WebGPU device mid-session
  with no recovery, which no test at load could foresee; they built a mid-session fall back to WebGL and a blocklist
  by fall-back rate (no device list published) [P] https://www.figma.com/blog/figma-rendering-powered-by-webgpu/ .
- a recent laptop (Intel Arc 140T): current GPU, current drivers, Direct3D 12 — the well-trodden path.

**Android phone about four years old (2022), Chrome.**
- Adreno 619/642L/730, Mali-G52/G57/G68/G710 (Pixel 7) on Android 12+: pass the vendor and OS rules → core WebGPU
  if the driver has Vulkan 1.1 with Dawn's feature list. Per-model confirmation: could not establish.
- **Not** covered: Samsung phones with Exynos 2200 / 2400 (Xclipse GPU — Galaxy S22 / S24 in Europe and elsewhere):
  blocked today. Phones still on Android 11: compatibility mode only.
- Quality signals: Construct's "subpar WebGPU performance on mobile devices" (Galaxy S20+, Pixel 7 Pro; opened
  2024-03, closed 2025-07 with no confirmed fix) [P] https://github.com/Scirra/Construct-bugs/issues/7874 ; three.js
  #30560: 19 fps WebGPU against 57 fps WebGL on Android (three's own per-object cost, see §3) [P]; a live fault of
  2026-09-28: valid WGSL fails pipeline creation on Adreno 7xx in Chrome 153 [R]
  https://github.com/linebender/vello/issues/1957 .
- **In the app's WebView: not established** (table above). The app is `minSdk 28` and checks nothing about its
  WebView's version or GPU (the Android app, `SceneWeb.kt`).

### 1.3 Who would get no WebGPU

- web3dsurvey (fetched 2026-10-11; visitors of 3D developers' sites — skewed toward good hardware; counts a working
  adapter): overall **83 %** have WebGPU against 98 % WebGL 2. Windows 87.5 %, **Android 73.6 %**, iOS 85.4 %, macOS
  90 %, Linux 17.8 %, ChromeOS 92.6 %. By browser: Chrome 85 %, Edge 93 %, Safari 80 %, Firefox 60 %, Samsung Internet
  78 % [P] https://web3dsurvey.com/webgpu , https://web3dsurvey.com/webgl2 .
- caniuse: 85.7 % full + 3.1 % partial of global usage (data 2026-09-30) — counts browser versions, not adapters, so
  it overstates [P] https://caniuse.com/webgpu .
- Chrome's own: 31 % of its Windows users lack Direct3D feature level 11.1+, 23 % of its Android users lack Vulkan 1.1
  (intent to ship compatibility mode, 2026-01-14) [P].

Under "one way, no fallback" the scene does not open for roughly **one visitor in six, one in four on Android**.
They are not only old devices: every Firefox user on Android and Linux and on Intel Macs; Samsung phones with Exynos
(Xclipse), including recent flagships; iPhones and Macs not updated to OS 26 (anything before iPhone 11 for ever);
Linux with AMD or with NVIDIA on X11; Android 11 and below; Windows machines without Direct3D 12 class graphics;
and — unless §6's check says otherwise — the Android app.

---

## 2. What WebGPU would cure of this engine's costs, item by item

| The cost | Under WebGPU | Verdict |
|---|---|---|
| **Minutes of shader compilation at first open (Windows)** | Dawn translates WGSL → HLSL (Tint) → **DXC** on Shader-Model-6 hardware, FXC only below SM 6.0; hard-wired default [P] Chromium `dawn_platform.cc`, Dawn `PhysicalDeviceD3D12.cpp`; Chrome 121 post. UHD 630 reports SM 6.5 with a current legacy driver [R] Intel community — so DXC by inference, **not confirmed for this GPU** (an old driver falls to FXC). `createRenderPipelineAsync` really compiles on a thread pool, several pipelines in parallel; the synchronous call blocks the GPU process [P] Dawn `CreatePipelineAsyncEvent.cpp`. DXC against FXC on long inlined shaders: 8.2 s against > 150 s [R luma.gl fork, 2026-10-09]; 0.9–1.5 s against 11.5 s [R wgpu user]; Google's own figure is only "20 % faster on average" [P]. Dawn + DXC against ANGLE + FXC on the **same** shaders: no one has published it. Both paths cache on disk afterwards (Dawn blob cache; Chrome's GL program cache) — the difference is only the cold first open | **Likely a large gain; the one clear one. Unmeasured on Gen9.** The planned rework also shortens this (a closed, smaller program set; simpler lit shaders), by an unknown amount, and keeps FXC |
| CPU cost of a draw and of a pass | No Chrome measurement of per-draw cost exists publicly. Engines that gained wrote data-oriented backends (Figma: "improvement on some classes of devices, neutral on others"); three's WebGPURenderer is 2–10× **slower** than WebGLRenderer with many objects (§3). After the planned rework the engine makes few draws (runs break only on material or shape; ≤ ~10 target binds) | Small either way once draws are few. Raw WebGPU: a little better. Through three: worse |
| No base instance → order texture + `u_first` per draw (three patch 09) | `firstInstance` is core in `draw` / `drawIndexed`; `@builtin(instance_index)` includes it. The order becomes an instance-step vertex buffer (or a storage buffer) and the per-draw uniform disappears | Cured: simpler code, one texel fetch a vertex less. Not a frame-time item |
| Tables as float / integer data textures (instances 20 texels, lights, grid, land leaves, bones, page table) | Storage buffers readable in the vertex stage (core: ≥ 8 per stage). Typed structs instead of texel packing; partial `writeBuffer` | Cured as code and as exactness. The GPU work per vertex (so many dependent reads) is about the same |
| Uniform caveats (no shared block; three's group float-only, binding 0) | Bind groups: one per frame, one per view (each mirror, each shadow view its own), one per material | Cured — but see "worse": every binding must match a layout exactly |
| Hardware depth compare in vertex and fragment (spec-render §10 doubts it under ANGLE) | `texture_depth_2d` + `sampler_comparison`, `textureSampleCompareLevel` in any stage — core | Cured as a doubt. Same cost per read |
| Compute | Available. But in the PLAN: cloth becomes a few bone chains on the thread (S5); particles are already closed-form on the GPU; the light grid is rebuilt only when lights change; culling and order are per run on the thread | Little to gain for this engine as planned. A cleaner particle evaluation (no float bits drawn into integer targets) |
| Timestamp queries | `timestamp-query` per pass; quantised to 100 µs unless a developer flag [P] Chrome 121 post | Same use as today's timer query; coarser by default |
| Render bundles | Recorded draw lists replayed; helps static passes (a static shadow cell) | Marginal with few draws |
| Texture formats / compression | Irrelevant: sheets are painted on the device | — |
| Indirect / multi-draw | `drawIndexedIndirect` core; `multiDrawIndirect` still experimental behind a flag [P] Chrome 131 post | Not usable as "the way" |

**The same cost under any API** (and it is most of the 18–28 ms frame): what each vertex computes (light at
vertices, the reads per vertex), the shadow maps' draws, the number of passes and target binds on a tile GPU, fragment
work, overdraw of blended layers, the Canvas-2D painting of pages in workers, video memory. The planned rework is
what attacks these (S1, S6, S7, S9 of decisions.md) — on WebGL or on WebGPU alike.

**Page uploads.** The plan sends bytes (`texSubImage3D`); the equivalent is `queue.writeTexture` (also to mip level
1) — same shape, one more copy through Chrome's GPU channel; Chrome 144 made `writeTexture` "up to 2×" faster [P].
`copyExternalImageToTexture` from canvases is *slower* than WebGL's path on Windows [P]
https://github.com/gpuweb/gpuweb/issues/5330 (2025-10-01) — the plan does not use canvases for upload, so it does not
bite.

**Worse or riskier under WebGPU.**
- Direct3D 12 on Gen9 with drivers frozen since 2022; device loss with no recovery seen in the field on Windows
  (Figma) — and under "no fallback" a lost device is a dead scene.
- Android: the newest path of the drivers; reports of worse pacing than WebGL (Construct) and a current Adreno
  pipeline fault. WebView unestablished.
- WGSL is strict where GLSL was loose: no implicit conversions, no ternary (`select` evaluates both sides), texture
  and sampler separate, sampling with implicit derivatives forbidden in non-uniform control flow, no preprocessor
  (the engine's GLSL has 124 `#if` lines and 277 `${…}` splices — variants become generated text or `override`s).
- Every pipeline is a full description (vertex layout, targets' formats, depth state, bind group layouts) that must
  agree with its shader exactly; a mismatch is a validation error, not a wrong picture. Good for finding faults,
  more to get right unseen.
- Memory in Chrome against WebGL: could not establish.

---

## 3. three.js r186 and WebGPU

Read in an rpg dev tool (0.186.1).

**What `WebGPURenderer` has:** lights as nodes (the set of lights is part of the shader's key — baked, as in
WebGLRenderer); clustered lights as an *example* (`examples/jsm/tsl/lighting/ClusteredLightsNode.js`: a compute pass
fills a storage buffer of lists; only unshadowed point lights); shadows with hardware compare, a 5-tap PCF, VSM,
cascades as an example; instancing (uniform array, vertex buffer or storage); storage buffers and textures; compute;
post (`RenderPipeline`, MRT); reversed depth; timestamp queries; render bundles; `compileAsync` over
`createRenderPipelineAsync` (normal rendering compiles synchronously). `firstInstance` exists in its draw parameters
and is never set to anything but 0 (`RenderObject.js:603-678`); BatchedMesh is a JS loop of single draws
(`WebGPUBackend.js:2124-2141`). Works in a worker on an OffscreenCanvas.

**Its WebGL 2 backend:** compute emulated by transform feedback (own element only); storage buffers as attributes or
a copied texture; storage textures absent; indirect draws silently ignored; bundles become plain groups; every UBO
rebound per draw (`WebGLBackend.js:2743`, with a TODO). In r186 it leaks every GL program, shader and vertex array
(fixed for r187) [P] https://github.com/mrdoob/three.js/issues/34597 (2026-09-17). No benchmark of it against the
classic WebGLRenderer on r186 could be found; everything points to slower.

**Speed of WebGPURenderer itself (its WebGPU backend):** one uniform buffer and bind group per render object;
20 000 cubes at 15 fps against 60 on WebGL (M1 Pro), Android 19 against 57 [P]
https://github.com/mrdoob/three.js/issues/30560 (open, "high priority"); a maintainer: the fix "requires a deeper
refactoring", keep using WebGLRenderer [P] #31055 (2025-05); material set-up 2 100 ms against 131 ms [P] #33821
(2026-06, open). An independent bench on r186: 5 000 moving meshes cost 29 ms of CPU in three, 12 ms in PlayCanvas
[R] https://github.com/mvaligursky/webgpu-webgl-benchmarks .

**Can the engine's way of using three be carried over? No.**
- `ShaderMaterial` / `RawShaderMaterial` are not supported at all (replaced by an empty material with a warning;
  `NodeBuilder.js:3156-3166`) [P] also https://github.com/mrdoob/three.js/issues/28957 .
- Raw code enters only as *function bodies* (`wgslFn`) inside a module three generates; no way to give a whole WGSL
  module with our own bindings and entry points. A function sees no globals: every uniform, texture and sampler is an
  argument from a TSL node. `glslFn` under the WebGPU backend throws; there is no transpiling in the core.
- A frame graph of our own is possible (targets, clears, viewports), but each `render()` is its own pass and command
  submission, the scene graph is walked every time, and the per-object work (refresh checks, bindings walk) is the
  JS-heavy path the engine's patches 01–04 exist to avoid in WebGLRenderer — here it is larger and not patchable.
- The new stack is ~93 600 lines against the classic renderer's ~16 500.

So WebGPU for this engine means: **three stays for its mathematics (vectors, matrices, cameras), not as the GPU
layer; the engine gets its own thin layer on raw WebGPU** (device, targets, textures, buffers, pipelines by key, bind
groups, passes). This goes against decisions T4 (the owner's wish to use what three gives) — by T4's own escape: "where
it does more than is needed or dearer, our own is right". An estimate of that layer: 1 500–2 000 lines, replacing
`gpu.js`, the patches, and what the engine takes from WebGLRenderer.

**The authors' shaders ("an element's own shader").** Measured in the worlds' `origin/env/dev` branches (the four
`-v2` worlds under `scratchpad\tl` and `scratchpad\openpeople\ap2`): **84 files, 43 distinct texts, 895 lines of
distinct text** (the sky of one world's module and its sails repeat across scenes; a generator writes them). All are
`vec4 shade(vec4 painted, vec2 at, vec2 uv)`. What they use of the engine: `layer(k, at)` (105 uses), the global
`emission`, `u_time`, their own float uniforms as bare names, and the helpers `hash1` (three overloads), `noise1/2/3`,
`wobble`, `wobble2`, `cycle`, `luma`, `srgbToLinear`, `PI`. What they use of GLSL: floats and vectors, `mix` /
`smoothstep` / `clamp`, `if`, 17 `for` loops with constant bounds (some `continue`), ~100 ternaries, `fwidth(at)` in
15 places, 5 constant arrays, a little `int` / `uint`. Not used at all: textures directly, `discard`, the
preprocessor, `out` parameters, matrices, structs.

- (a) Is automatic conversion realistic? Yes, by any of three ways:
  - **naga** (the translator Figma ships in production: their GLSL → naga → WGSL [P]); its GLSL reader wants
    Vulkan-flavoured GLSL 450, so the engine would wrap each function in a 450 shell — these functions have nothing
    of ES 3.00 that 450 lacks. Runs as WebAssembly in node or the browser (a third-party build `naga-wasm`; its
    upkeep not established [R]).
  - glslang → SPIR-V → Tint (Babylon's old route, `twgsl`): works, but cost Babylon > 3 s at load, which is why they
    rewrote their shaders in WGSL in 2024 [P] https://forum.babylonjs.com/t/webgpu-loads-significantly-slower/48980 .
  - three's `examples/jsm/transpiler` (GLSL → WGSL encoder, 4 800 lines): an example for snippets; its WGSL encoder
    has no overloads. Not to be relied on.
  - Tint itself reads WGSL and SPIR-V only [M].
- (b) How mechanical a one-time rewrite of the 43 is: **very.** The whole list of changes: types and declarations
  (`vec3` → `vec3f`, `float x =` → `let` / `var`); `a ? b : c` → `select(c, b, a)` (all are pure expressions);
  `fwidth(at)` → the engine's `at_dx`, `at_dy` it already gives (this also removes WGSL's one real trap here —
  derivatives in non-uniform control flow; `layer()` already samples with explicit gradients); array constructors;
  `for` syntax; `mod` → `%` / the engine's helper; `hash1` overloads get distinct names. `emission` and the bare
  uniform names survive as module-scope `var<private>` the engine sets before calling `shade`. Each result can be
  validated offline by `naga` / `tint` inside the engine's wrapper — today nothing validates an author's shader
  before a browser compiles it. Work for cheaper agents; no look changes.
- What the language should promise from then on: **WGSL written directly, the same contract** (`fn shade(painted:
  vec4f, at: vec2f, uv: vec2f) -> vec4f`, `layer`, `emission`, the helpers), validated when a world's branch is
  merged. Reasons: it is the platform's own language (the standard), errors point at what the author wrote, and
  there is no translator of ours to maintain or to be a second place where a shader can be wrong. A translator at
  scene build (keep GLSL, convert by naga) is the alternative if agents turn out to write WGSL badly; it is one more
  moving part. An engine's own little shading language is neither standard nor simpler for AI authors.

---

## 4. Is the planned work wasted? — area by area

Sizes are today's files (`wc -l`, long lines) as the measure of each area's planned work; engine 2 is ~24 900 lines
of its own code. Note: the worktree has patches 01–08; patch 09 is on branch `engine2-r2-render` (spec-render §12).

**(a) The same under WebGPU — design AND code survive (~18 500 lines, ~three quarters, plus all of PAGE and
LANGUAGE)**
- PAINT+THREAD (thread.js 945, core 4 999, paint 2 302): the scene thread, the one step function, the clock, pause,
  the showcase, shots by events, the recorder and display list, painters in workers, the sheet cache's logic and
  page table, **pages computed from the camera** (`vt.ask`), coverage masks, the render entry, device tier, kit.
  All of R1–R6. Only the cache's creation and upload calls (~200 lines of `paint/vt.js`) are group (b).
- PEOPLE (5 412): two calls a tick, order, cloth as bone chains on the thread, a model per look, motions made ready
  at cast build, saves, faces. Only `shading.js` (302, ~270 of GLSL) and the bone table's upload are (b).
- RENDER, the part with no GPU in it (~3 200 lines): cull, order and runs (`cards.js`), land's tree and bake
  planning, shadow views, packing, static / movers bookkeeping, light choice, mirrors' scheduling, the frame's
  decisions (held / idle / draw), **the pacer**, the frame's size, per-device tables, budgets.
- PAGE: stage, layers, styles, sound, opening, the build, serving, the stand's judging. LANGUAGE: all ten additions,
  content budgets, the plan of scene edits, one source of docs.

**(b) The design survives, the code is typed again (~6 500–7 000 lines)**
- All GLSL: `render/glsl` 3 735 + ~570 lines in JS strings (people 270, post 165, outline 52, materials 42…) —
  what a vertex and a fragment compute, the light model, the shadow read, haze, sky, land, mirrors, the air volume,
  bloom, the frame's end. Same arithmetic in WGSL.
- The GPU-calling JS of `render/` (~2 100 lines): targets, passes, materials' state, uploads; plus ~200 in `paint/vt.js`
  and the people's material hookup.
- The 43 authors' shaders (895 lines) and the language doc's shader section.
- The stand's timers, `createRenderer`'s refusal rule.

**(c) Exists only because of WebGL 2 — not written at all under WebGPU (~1 000–1 300 lines)**
- The order texture and `u_first` per draw (spec-render §2.6), **three patch 09**; patches 01–04 (garbage inside
  WebGLRenderer) and 06–07 (its reversed-depth faults) — 428 lines of patches and the patched build.
- Tables packed into float / integer texels and their `texelFetch` unpacking: instances, lights and grid, land
  leaves and drapes, bones and chains, the page table as RG32UI; `gpu.js`'s raw partial uploads behind three's back.
- Exact values drawn as float bits into integer targets (particles' four RGBA32UI targets, land shadow, depth copy).
- The uniform-block caveats (spec-render §2.12) and `custom.js`'s raw UBO at binding 0; the 16-sampler check.
- Hardware compare by way of three's `DepthTexture`, its unused colour attachment.
- The self-post while programs link (no event in WebGL) — WebGPU's async pipeline creation is a promise.
- an rpg dev tool (dump, hlsl, fxc: 289 lines), the planned `glsl.mjs` glslang assembler, and the "what Direct3D's
  compiler takes" rules (one call site, loops to their end, no computed array index, `if … discard; else`) in
  engine 2 (gone).
- `failIfMajorPerformanceCaveat`, extension checks.

**(d) Would be designed differently and better with WebGPU (touches ~1 000–1 500 lines of design)**
- Instances, lights, land tables, bones as typed storage buffers; the order as an instance buffer with
  `firstInstance`.
- Bind groups per frame / per view / per material instead of per-program uniform caches.
- Program readiness as promises; pipelines made in parallel at `R.build`.
- Particles' evaluation as a compute pass. (Cloth and the light grid stay on the thread: the plan made them small.)
- Static shadow cells as bundles — optional.

**How much is thrown away.**
- WebGL first, WebGPU later (A then a port, or D): group (c) is written and later deleted (~1 000–1 300 lines; D
  keeps it at the low end), and group (b) is typed twice (~6 500–7 000 lines) — **about a quarter of engine 2,
  about 60 % of the RENDER area, done a second time.** Groups (a) are untouched by the later move. By the owner's own
  measure ("переделка движка — дёшево") this is a cost in agents' work, not in scenes or in what a viewer sees.
- WebGPU instead, now (B): nothing of the plan's design is lost. Lost from the specs: spec-render §2.5, the texture
  parts of §2.6, the `DepthTexture` detail of §2.8, §2.12's uniform paragraph, §2.14; spec-people §2.5's texture
  form; spec-paint-thread's upload lines; spec-page's render-service flags. Added work: our own GPU layer
  (1 500–2 000 lines), the WGSL of shaders the plan would otherwise have left alone (particles 694, land, vt), the
  render service and stand on WebGPU, the authors' 43 shaders and the language doc — and the first run of a renderer
  none of whose lines has ever executed.

---

## 5. The choices

| | (A) WebGL 2 as planned | (B) RENDER written for raw WebGPU now, WebGPU only | (C) three's WebGPURenderer + its WebGL 2 backend | (D) WebGL 2 now, WebGPU later, WebGL-only parts kept small |
|---|---|---|---|---|
| Viewer, Gen9 laptop: frame | the rework's gains | the same gains; a little less CPU per draw; D3D12 on frozen drivers — unproven | worse: per-object cost of three's renderer | as A |
| Viewer, Gen9 laptop: first open | shorter than today by an unknown amount; still FXC | likely much shorter (DXC, parallel) — unmeasured on this GPU | as B on WebGPU, as A or worse on the other backend | as A now, as B after the move |
| Viewer, 2022 Android | the rework's gains; the proven path | the same work on the newer driver path; reports of worse pacing; the app's WebView unestablished | worse | as A |
| Devices lost | none (WebGL 2 on a GPU: ~98 %) | ~1 in 6 visitors, 1 in 4 on Android (§1.3): Firefox on Android / Linux, Samsung Exynos, OS not updated, Android ≤ 11, maybe the app | none in name; two paths in fact | none now |
| Scenes | untouched beyond the plan | 43 shader texts converted (mechanical); nothing else | every shader of ours and the authors' becomes TSL (JavaScript node code) or two versions | none now; the 43 at the move |
| three | stays (T4) | leaves as GPU layer; stays for mathematics | stays, as a much larger dependency used against its grain | stays now |
| "One way"? | yes | yes | **no**: one code of ours over two different machines — compute and storage must be avoided or behave differently; it is a fallback coded by someone else, and r186's is leaky and slower | yes at each time |
| Work | the plan | the plan + our GPU layer + all GLSL → WGSL + render service + shader conversion; RENDER roughly 1.5–2× | the largest rewrite (everything to TSL) for the worst result | the plan; later a port of ~7 000 lines with a working engine to compare against |
| Risk with nothing tested until the end | changes to a renderer that works today | a whole renderer written unseen on an API the project has never run | highest | as A; the later port is done against a seen, working picture |

**What can be checked without running the engine (rule D5), WebGPU against WebGL.**
- WGSL modules: `tint` or `naga` validate fully offline — types, bindings, the derivative rule — and the result does
  not depend on a driver. That is *stronger* than glslang over GLSL, where ANGLE and FXC still have their say.
- Pipelines and bind groups (does this shader fit this vertex layout, these targets, this group layout): only by
  creating them — possible without a browser or a GPU through Dawn's node bindings (the `webgpu` npm package) on a
  software Vulkan (lavapipe) [R]. That executes API calls, not the engine or a scene; whether D5 allows it is the
  coordinator's / the owner's call. Without it, layout mismatches surface only at the first run — as explicit errors,
  all at once, identical on every device.
- What no offline check gives, on either API: that the picture is right, that Direct3D 12 on Gen9 holds, the timings.
- Net: code written unseen for raw WebGPU has more places to be wrong than edits to a working WebGL renderer, and its
  faults are louder and more uniform. The first run of B would be further from a picture than the first run of A / D.

**D, concretely — what "kept small on purpose" means in the specs:**
1. No new investment in WebGL-only machinery: keep the order texture and `u_first` as they are on the branch (no
   reshaping), no uniform block (already the spec's decision), no new float-bit tricks.
2. All GPU calls of RENDER, PAINT and PEOPLE go through one narrow module (today's `gpu.js` grown to be the seam):
   targets, textures, table uploads, passes. The API-free ~3 200 lines of `render/` stay free of three's renderer.
3. Tables are laid out as structs in typed arrays first, packed to texels in the seam — so they become storage
   buffers by changing the seam.
4. GLSL kept in the subset that moves to WGSL line for line: no reliance on implicit conversions, sampling inside
   branches only with explicit level or gradients (most of the engine already does), variants by a small fixed set
   of defines.
5. The authors' contract unchanged now; the language doc states that `shade` is the contract and its text will move
   to WGSL once.

---

## 6. Recommendation, and what it hinges on

**D.** Do the planned rework on WebGL 2 now, with the five points above; make the move to raw WebGPU (dropping three
as the GPU layer, authors' shaders to WGSL) a separate step decided after the first run of the reworked engine.

Why, by the plan's own criterion (the viewer's final quality decides; engine code has no weight):
1. The frame — the thing the viewer suffers from — is cured by the rework, not by the API. WebGPU would draw the same
   vertices, maps and passes on the same GPU.
2. WebGPU's one sure-looking gain, the first open, is real but unmeasured on the reference laptop, and the rework
   changes the size of that problem first.
3. On both reference devices WebGPU is the less proven path (frozen Gen9 drivers on Direct3D 12; Android pacing
   reports; the app's WebView unknown), and "no fallback" turns any such fault into a scene that does not open.
4. The double work D costs (~7 000 lines typed again) is engine work, which is cheap here; B's cost is risk — a
   whole renderer run for the first time at the very end, together with everything else.
5. C is out on the evidence: not one way, slower, and it would turn every shader into TSL.

**The facts it hinges on**

| Fact | Established? | How to establish it without building anything |
|---|---|---|
| 1. WebGPU works in the Android app's WebView, and on a 2022 phone in Chrome | **No** — sources conflict for WebView; per-model not known | Open https://webgpureport.org on the phone in Chrome, and the same address inside any app that shows a page in the system WebView (or the moood app pointed at it). It says whether an adapter is given, core or compatibility, and its limits. Ten minutes. If WebView gives no adapter, B loses the app |
| 2. On UHD 630, Chrome uses DXC and compiles this engine's size of shaders much faster than ANGLE's FXC | **No** — DXC by inference (SM 6.5); no like-for-like timing published | On any Gen9 laptop: `chrome://gpu` → the WebGPU section (adapter, `use_dxc`, driver version). And offline, compile-only: the HLSL that an rpg dev tool already dumps from ANGLE, compiled once by `fxc` (the existing `fxc.py`) and once by `dxc.exe`, timed — the ratio is the gain to expect. (Making a fresh dump needs a browser run; old dumps can be used) |
| 3. Direct3D 12 on Gen9 with its last driver is stable under Dawn for hours | **No** — only Figma's general statement about Windows | Cannot be read anywhere. The cheapest evidence: a Gen9 machine left on a public WebGPU demo; or accept the risk knowingly |
| 4. After the rework, first open on WebGL is still long | Unknown until the first run | The first allowed run of the reworked engine answers it; that is the natural moment to decide the move |

If 1 and 2 come out well and the owner weighs the first open and "be on the new API" above the risk of a blind first run,
**B is a sound choice** — raw WebGPU with our own layer, WGSL for authors, the render service moved to WebGPU — and
then it should replace the RENDER spec before work starts, not be added in the middle. If 1 comes out badly, B
contradicts decision K6 (the Android WebView path working) until Google ships it.

---

## Для владельца

**Что даст WebGPU.** Скорее всего, сильно сократит долгую сборку при первом открытии сцены на Windows: там другой,
более быстрый компилятор, и он работает параллельно. Код движка в нескольких местах станет проще и чище. Это всё,
что он даёт наверняка.

**Чего не даст.** Кадр от него быстрее не станет. Сейчас кадр дорогой потому, что видеокарта считает слишком много
точек, теней и проходов, — эта работа одинакова при любом способе обращения к видеокарте. Её убирает переделка,
которую мы уже запланировали, а не WebGPU.

**Кто не сможет открыть сцены.** Примерно каждый шестой посетитель, на Android — каждый четвёртый. Это не только
старые устройства: Firefox на Android и Linux, телефоны Samsung на процессорах Exynos (в том числе свежие), айфоны
и маки, не обновлённые до системы 26. Ноутбук с Intel 9-го поколения и телефон 2022 года в Chrome WebGPU получают.
Про наше приложение на Android я не смог выяснить наверняка: источники противоречат друг другу. Как хорошо WebGPU
работает на старом Intel и на телефонах, никто не публиковал; есть отдельные сообщения о проблемах.

**Что с запланированной работой.** Примерно три четверти остаётся как есть при любом выборе: поток сцены, рисование
картин, люди, страница, язык сцен, правки сцен. Около четверти (шейдеры и работа с видеокартой) сохраняет замысел,
но пишется заново. Небольшой кусок существует только из-за ограничений нынешнего способа и при WebGPU не нужен
вовсе. Шейдеры авторов (43 разных текста) переводятся механически, это не препятствие. От three.js как от слоя
работы с видеокартой при WebGPU придётся отказаться: его новый рендерер нам не подходит и по замерам медленнее
старого.

**Варианты.** Первый: остаться на нынешнем способе, как в плане. Второй: писать отрисовку сразу под WebGPU — это
новый рендерер целиком, написанный вслепую, который впервые запустится в самом конце. Третий: рендерер three.js с
двумя путями внутри — это не «один способ», и он хуже; его я отбрасываю. Четвёртый: сделать запланированное сейчас
на нынешнем способе, но так, чтобы переход потом был заменой одного слоя, и перейти на WebGPU отдельным шагом.

**Что выбрал бы я.** Четвёртый вариант. Тормоза лечит переделка, а не WebGPU; переход потом будет стоить повторного
написания примерно четверти движка, а это, по вашим же словам, дёшево. Переход сейчас добавляет главный риск —
первый запуск полностью нового рендерера на менее обкатанном пути именно на тех устройствах, на которые мы
ориентируемся. Решение можно пересмотреть до начала работы, если две быстрые проверки дадут хороший ответ: открыть
страницу-проверку WebGPU на телефоне в Chrome и внутри приложения, и сравнить скорость двух компиляторов на уже
сохранённых шейдерах. Если обе хороши и быстрое первое открытие для вас важнее риска, второй вариант тоже разумен.
