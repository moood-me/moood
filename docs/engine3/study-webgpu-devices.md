# study-webgpu-devices — WebGPU on the orientation devices, as of 2026-10-11

Read-only web study. Nothing was run on a device, no browser, no build. It continues `study-webgpu.md` and does not
repeat it; where that study is corrected, the line starts with **Correction**.

Marks on every claim:
**[S]** checked in source — I read the primary text myself today (Chromium / Dawn source files fetched raw from
GitHub mirrors of `main`, the WebGPU spec Editor's Draft of 2026-10-08, vendor pages, the survey's own pages).
**[R]** reported by others — a third party says so; not cross-checked.
**[I]** my inference from [S]/[R] facts.
"Not found" means I looked and found nothing usable.

Source snapshots are of 2026-10-11 unless a date is given. Chromium `main` is ahead of stable Chrome 155, so an [S]
from `main` describes what is in the tree, not necessarily what version 155 ships.

---

## Для владельца

На ноутбуке с Intel 8–10-го поколения в Chrome под Windows 10 и 11 WebGPU включён: в списке запретов Chrome для Intel нет условий ни по поколению, ни по версии драйвера, запрещено только 4-е поколение.
На телефонах 2022 года с графикой Mali и Adreno (Pixel 6 и 7, Snapdragon 8 Gen 1 и 778G, Galaxy A53) WebGPU в Chrome включён начиная с Android 12; телефоны Samsung с графикой Xclipse (Exynos 2200 и 2400) по-прежнему под запретом.
Страница, открытая из приложения через Custom Tab, показывается тем браузером, который у человека выбран основным, и получает его возможности: если это Chrome, WebGPU тот же, если Samsung Internet или Firefox — то их.
По данным опроса web3dsurvey рабочий WebGPU есть у 74 % посетителей на Android и у 88 % на Windows; сам Google пишет, что у 23 % пользователей Android нет нужной версии Vulkan.
Всё, что обещает основной стандарт, на этих устройствах есть наверняка, включая чтение больших таблиц данных при обработке вершин; а вот ряд необязательных возможностей на телефонах есть не у всех, и на Mali и Adreno наборы разные.
Safari даёт WebGPU с версии 26 (сентябрь 2025), сейчас вышла 27; Firefox даёт его на Windows и на Mac с процессорами Apple, а на Android и Linux — нет.
Измерений скорости WebGPU именно на таких ноутбуках и телефонах никто не публиковал; есть отдельные сообщения о сбоях драйверов на Adreno и Mali и о том, что на старом Pixel 5 WebGPU был медленнее.
Проверять шейдеры и сборку конвейеров можно без видеокарты готовыми инструментами, но они не покажут ошибок драйверов конкретных устройств.

---

## 1. Is WebGPU on by default in Chrome on these devices?

### 1.1 Windows laptop, Intel Gen9-class (UHD 620/630; 8th–10th gen), Windows 10/11

| Fact | Mark, source, date |
|---|---|
| Chrome's WebGPU adapter blocklist on Windows, D3D12 backend: Intel, AMD and Microsoft vendor IDs pass with **no generation and no driver-version condition**. NVIDIA passes on x64 (blocked on 32-bit x86). Qualcomm passes behind a feature that is on by default, with old Adreno device IDs and drivers < 31.0.117 pattern-blocked. Every other vendor gets "WindowsLimitedSupport" (blocked). | [S] `gpu/config/webgpu_blocklist_impl.cc`, `gpu_finch_features.cc` (main) — https://raw.githubusercontent.com/chromium/chromium/main/gpu/config/webgpu_blocklist_impl.cc |
| `software_rendering_list.json` has exactly one WebGPU-related entry (id 186, Linux Vulkan-via-GL interop). No entry disables WebGPU for any Intel generation or driver on Windows. | [S] https://raw.githubusercontent.com/chromium/chromium/main/gpu/config/software_rendering_list.json |
| Dawn's own D3D12 blocklist rejects only Intel Gen7 ("4th Generation Intel Processor Graphics", Haswell). Gen8 (Broadwell) and Gen9 are accepted. | [S] `CheckD3D12Blocklist` in https://raw.githubusercontent.com/google/dawn/main/src/dawn/native/d3d12/PhysicalDeviceD3D12.cpp |
| What Dawn calls "Gen 9" by PCI device-ID mask: 0x19xx (Skylake), 0x59xx (Kaby Lake), 0x3Exx (Coffee Lake — UHD 630), 0x87xx, 0x31xx, 0x5Axx and one more mask. So 6th–9th/10th-gen "UHD 6xx" all take the same code paths; Skylake is singled out in one workaround. | [S] https://raw.githubusercontent.com/google/dawn/main/src/dawn/gpu_info.json , `GPUInfo.cpp` |
| D3D12 requirement inside Dawn: the device must report feature level 11_1, or 11_0 with Resource Binding Tier ≥ 2; shader model ≥ 5.1. | [S] `InitializeSupportedLimitsImpl` in PhysicalDeviceD3D12.cpp; `D3D12Info.cpp` |
| **D3D11**: Chrome blocks any adapter whose backend is D3D11 ("crbug.com/41479539: D3D11 backend not fully implemented"). The tracker issue "D3D11 backend meta bug" was last modified 2026-09 and is not closed. Compatibility mode on Windows over D3D11: "the team is exploring support for … Windows with Direct3D 11" — not shipped. | [S] blocklist source; [S] tracker API https://issues.chromium.org/issues/41479539 ; [S] https://developer.chrome.com/blog/new-in-webgpu-146 (2026-02) |
| No software fallback: CPU adapters (WARP) are blocked ("CPU adapters not fully tested or conformant"). | [S] blocklist source |
| Google's own figure: "on Chrome on Windows, 31% of Chrome users do not have Direct3D FL 11.1 or higher". | [S] Intent to Ship, 2026-01-13 — https://www.mail-archive.com/blink-dev@chromium.org/msg15558.html |
| web3dsurvey: a working WebGPU adapter in 87.54 % of Windows reports. "intel gen-9" appears as its own architecture row with core limits and features (see §2) — i.e. Gen9 machines do obtain adapters in the field. The survey's visitors come from 3D developers' sites. | [S] https://web3dsurvey.com/webgpu (fetched 2026-10-11) |
| **Disagreement**: 31 % without FL 11.1 (Google, all Chrome Windows users) against 12.5 % without an adapter (web3dsurvey). Different populations; neither is "Gen9 laptops". | [I] |
| Drivers: Intel's driver for 7th–10th gen is on the legacy model; latest 31.0.101.2145, released 2026-09-22, for Windows 10 1809+ and Windows 11 21H2–25H2. 6th gen stopped at 31.0.101.2115 (2022-12-29). | [R] Intel download page via a summarising fetch — https://www.intel.com/content/www/us/en/download/776137/intel-7th-10th-gen-processor-graphics-windows.html |
| Nothing in the blocklist or in Dawn's D3D12 backend distinguishes Windows 10 from Windows 11, except one workaround keyed to Windows build ≥ 25957 together with Intel drivers ≤ 27.20.100.9664 (resource sub-allocation is turned off). | [S] PhysicalDeviceD3D12.cpp |

### 1.2 Android phone, 2022 class, Chrome

| Fact | Mark, source, date |
|---|---|
| Vendor rule in Chrome: ARM (0x13B5), Qualcomm (0x5143) and Intel pass on the Vulkan backend when the OS is **Android 12 (API 31) or later**. Imagination passes on Vulkan from Android 16. **Every other vendor ID is blocked** ("AndroidLimitedSupport"). Additionally any driver string matching `PowerVR*25.1*` is blocked. | [S] `webgpu_blocklist_impl.cc` |
| Samsung Xclipse reports Samsung's vendor ID 0x144D (Dawn's table names its architectures RDNA 2 / RDNA 3), so it falls in the blocked default branch. The gpuweb wiki says the same: "Samsung Xclipse, Android 12+: TBD". Work on it is visible: Dawn carries Xclipse-specific workarounds and a tracker issue of 2026-02-25 reports CTS failures on a Galaxy S25 FE. | [S] blocklist source; [S] `gpu_info.json`; [S] wiki, raw — https://raw.githubusercontent.com/wiki/gpuweb/gpuweb/Implementation-Status.md ; [S] https://issues.chromium.org/issues/487613497 |
| Vulkan requirement inside Dawn: API version ≥ 1.1, plus `robustBufferAccess`, `fragmentStoresAndAtomics`, `fullDrawIndexUint32`, the four `shader*ArrayDynamicIndexing` features, and either BC or (ETC2 and ASTC-LDR) compression. For the **core** level also `depthBiasClamp`, `imageCubeArray`, `independentBlend`, `sampleRateShading`, 4× MSAA for colour and depth, and every Vulkan limit at or above the core default; otherwise the device is offered at compatibility level only. | [S] https://raw.githubusercontent.com/google/dawn/main/src/dawn/native/vulkan/PhysicalDeviceVk.cpp |
| Android's own rule: 64-bit devices launching with Android 10 or later must support Vulkan 1.1. | [R] https://source.android.com/docs/core/graphics/implement-vulkan (via search summary) |
| Google's figure: "23% of Android users do not have Vulkan 1.1, including 15% who do not have Vulkan at all". | [S] Intent to Ship, 2026-01-13 (link above) |
| The orientation phones against the rule: Pixel 6 (Mali-G78), Pixel 7 (Mali-G710), Galaxy A53 / Exynos 1280 (Mali-G68) are ARM; Snapdragon 8 Gen 1 (Adreno 730) and 778G (Adreno 642L) are Qualcomm. All launched on Android 12 or later. So all pass the vendor and OS rule. | [I] from the blocklist source + the phones' public specifications |
| Per-model evidence that they really run it: a Chromium issue of 2026-04-01 carries a crash log from build fingerprint `google/oriole` (Pixel 6) on Android 16 — a GPU-process crash inside the Mali driver while compiling a WebGPU shader. Dawn has a Mali-G68-specific setting (dynamic rendering turned off because of "driver issues"), and Adreno-6xx / 7xx-specific ones. A per-model confirmation for Galaxy A53, 778G phones or 8 Gen 1 phones: **not found**. | [S] https://issues.chromium.org/issues/498659375 ; [S] PhysicalDeviceVk.cpp |
| **Compatibility mode** (OpenGL ES 3.1 backend): shipped in Chrome 146; opt-in through `requestAdapter({featureLevel:"compatibility"})`. In source both `kWebGPUCompatibilityMode` and `kWebGPUAndroidOpenGLES` are on by default; on the GLES backend ARM/Qualcomm/Intel pass on Android 10+ (Chrome's minimum), Imagination on Android 13+. | [S] Chrome 146 post; [S] `gpu_finch_features.cc`, blocklist source |
| A page that calls `requestAdapter()` with no `featureLevel` asks for core; on a device that can only do compatibility it gets no adapter. | [I] from the spec's default and the post's word "opt-in"; the exact Chrome behaviour was not read in source |
| Android Advanced Protection Mode: a feature "AAPMBlocksWebGPU" is on by default. | [S] `gpu_finch_features.cc` |
| Share with WebGPU: web3dsurvey — **Android 73.6 %** of reports have a working adapter; Chrome/Chromium on all platforms 84.83 %; Samsung Internet 78.4 %. Of all WebGPU adapters seen, 5.92 % are ARM and 4.31 % Qualcomm. | [S] https://web3dsurvey.com/webgpu |
| caniuse: 85.72 % full + 3.05 % partial of global usage; "Chrome for Android 154: yes". It counts browser versions, not adapters. | [S] https://raw.githubusercontent.com/Fyrd/caniuse/main/features-json/webgpu.json |
| Chrome's public usage counter for WebGPU on Android: **not found**. | — |

### 1.3 Custom Tab / Trusted Web Activity

| Fact | Mark, source |
|---|---|
| "By using a Custom Tab, your web content will load in whatever rendering engine powers your user's preferred browser." "Any API or web platform feature is available there, and will be available in your Custom Tab." | [R] quoted through a summarising fetch — https://developer.chrome.com/docs/android/custom-tabs/ |
| So a Custom Tab is Chrome — with Chrome's WebGPU, blocklist and GPU process — only when the provider is Chrome. With another default browser it is that browser: Samsung Internet (Chromium-based; 78.4 % in the survey) or Firefox for Android (no WebGPU). | [I] |
| TWA launcher library (`android-browser-helper`): "All browsers on the users device are considered, in order of Android's preference (so the user's default will come first). We look for browsers that support Trusted Web Activities first, then ones that support Custom Tabs falling back to any browser". | [S] `TwaProviderPicker.java` — https://raw.githubusercontent.com/GoogleChrome/android-browser-helper/main/androidbrowserhelper/src/main/java/com/google/androidbrowserhelper/trusted/TwaProviderPicker.java |
| Any Chrome-specific difference between a normal tab and a Custom Tab / TWA in WebGPU (flags, GPU process, blocklist): **not found** in documentation; not read in source. | — |
| Android System WebView (not asked, left open by the first study): still not settled. caniuse marks "Android Browser/WebView 154: no"; MDN data says WebView mirrors Chrome Android (121); the compat-mode Intent says "available on Android, Android WebView …". | [S] the three sources; they disagree |

### 1.4 Safari and Firefox, as they stand

| Browser | State | Mark, source |
|---|---|---|
| Safari 26.0 | WebGPU shipped 2025-09-15 for macOS, iOS, iPadOS, visionOS 26. | [R] https://webkit.org/blog/17333/webkit-features-in-safari-26-0/ |
| **Correction** — Safari 27 exists | Safari 27.0 released 2026-09-14 with iOS 27 / macOS 27; adds `clip_distances`; fixes include "Restored maxStorageBuffersInFragmentStage and related WebGPU limits" and `onuncapturederror`. A 27.2 beta is out. | [R] https://developer.apple.com/documentation/safari-release-notes/safari-27-release-notes ; https://webkit.org/blog/18325/webkit-features-for-safari-27-0/ (2026-09-17) |
| Devices | iOS 27 supports the same iPhones as iOS 26 (iPhone 11 and later); macOS 27 drops Intel Macs. | [R] https://www.macrumors.com/2026/09/14/ios-27-compatible-iphones/ ; https://www.techrepublic.com/article/news-macos-27-cheat-sheet/ |
| Safari, older macOS | caniuse: Safari 26–27 "partial — only enabled by default on macOS 26 Tahoe or later". | [S] caniuse json |
| Safari regressions | Safari 26.4 (macOS and iPadOS) rendered a 3D view black under WebGPU where 26.3 worked; WebKit bug 315186, fix merged 2026-05-21; the app's authors switched Safari back to WebGL. | [R] https://github.com/rerun-io/rerun/issues/12788 |
| Safari in the survey | Safari 80.41 % with a working adapter; iOS 85.43 %. On iOS: float32-filterable 53.85 %, dual-source-blending 0.08 %, clip-distances 34.58 %, texture-formats-tier2 34.33 %, shader-f16 100 %. | [S] web3dsurvey feature pages |
| Firefox Windows | Since 141 (2025-07). | [S] wiki (raw) |
| Firefox macOS | Apple Silicon since 145 (macOS 26) / 147 (all macOS); Intel Macs: Nightly only. | [S] wiki; MDN compat data |
| Firefox Linux, Android | Not shipped. Linux: Nightly ("Mozilla expects to ship on Linux in 2026"). Android: "Behind a flag … Mozilla expects to do work on Android in 2026". MDN data: `firefox_android: false`. Current stable is 157 (2026-09-29). | [S] wiki; [S] https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/GPU.json ; [R] https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/157 |
| Firefox in the survey | 60.09 % with a working adapter. float32-blendable 4.62 %, clip-distances 1.96 %, texture-formats-tier1 1.14 %, tier2 0.35 %, primitive-index 0.35 %, subgroups 0.02 %. | [S] web3dsurvey |

---

## 2. Limits and features

### 2.1 Core default limits

Every value in the "core" column is what any core adapter must give (spec), and what Dawn's Vulkan backend demands of
the driver before it offers the core level at all. The survey columns show the share of reports at or above a value.

| Limit | Core default [S spec 2026-10-08] | Compat default | Field, Android | Field, Windows | Notes |
|---|---|---|---|---|---|
| maxTextureDimension2D | 8192 | 4096 | ≥ 8192: 100 %; ≥ 16384: 98 % | 16384: 100 % | Mali Bifrost ≥ 16384: 94 % |
| maxTextureArrayLayers | 256 | 256 | ≥ 2048: 98 % | ≥ 2048: 100 % | |
| maxColorAttachments | 8 | 4 | 8: 100 % | 8: 100 % | |
| maxColorAttachmentBytesPerSample | 32 | 32 | ≥ 128: 91 % | ≥ 128: 100 % | Intel Gen9: ≥ 64 in 97 % |
| maxBindGroups | 4 | 4 | 4: 100 % (none higher) | ≥ 8: 8 % | |
| maxSampledTexturesPerShaderStage | 16 | 16 | ≥ 48: 91 % | ≥ 44: 98 % | Gen9 ≥ 48: 74 % |
| maxSamplersPerShaderStage | 16 | 16 | 16 only | ≥ 22: 8 % | |
| maxStorageBuffersPerShaderStage | 8 | 8 | ≥ 10: 100 %; ≥ 16: 91 % | ≥ 10: 100 %; ≥ 16: 98 % | |
| maxStorageBuffersInVertexStage | 8 | **0** | ≥ 16: 100 % | ≥ 16: 100 % | of adapters that report the limit |
| maxStorageBufferBindingSize | 128 MiB | 128 MiB | ≥ 256 MiB: 75 %; ≥ 1 GiB: 35 % | ≥ 1 GiB: 100 % | **Adreno 7xx: above 128 MiB in only 6 %**; Adreno 6xx ≥ 512 MiB: 70 %; Mali ≥ 256 MiB: 99 % |
| maxUniformBufferBindingSize | 65536 | 16384 | 65536 only | 65536 only | |
| maxUniformBuffersPerShaderStage | 12 | 12 | 12 only | ≥ 14: 8 % | |
| maxVertexBuffers | 8 | 8 | 8 only | ≥ 12: 8 % | |
| maxVertexAttributes | 16 | 16 | ≥ 30: 92 % | ≥ 30: 100 % | Adreno 6xx ≥ 30: 70 %; Gen9: 77 % |
| maxInterStageShaderVariables | 16 | 15 | ≥ 28: 50 % | ≥ 28: 100 % | Adreno 6xx/7xx ≥ 28: 1 % / 6 %; Mali: 100 %; Gen9: 76 % |
| maxBufferSize | 256 MiB | 256 MiB | ≥ 1 GiB: 100 %; ≥ 2 GiB: 77 % | ≥ 2 GiB: 100 % | |

Sources: [S] https://gpuweb.github.io/gpuweb/ (limits table, draft dated 2026-10-08); [S] web3dsurvey limit pages
`https://web3dsurvey.com/webgpu/limits/<name>` (fetched 2026-10-11); [S] Dawn `Limits.cpp` and `PhysicalDeviceVk.cpp`.

- Chrome does not expose raw driver limits; Dawn rounds them down to fixed tiers (for example 8 / 10 / 16 storage
  buffers; 8192 / 16384 texture size; 128 MiB / 256 MiB / 512 MiB / 1 GiB / 2 GiB−4 / 4 GiB−4 binding size). [S]
  https://raw.githubusercontent.com/google/dawn/main/src/dawn/native/Limits.cpp
- A limit above the core default is given only when the page asks for it in `requiredLimits`; without that the
  device has exactly the core defaults. [S] spec.
- On D3D12 Dawn reports 16 vertex buffers, 14 uniform buffers per stage (binding tier 1–2) and 8 colour attachments
  before tiering. [S] PhysicalDeviceD3D12.cpp. The survey's "≥ 12: 8 %" on Windows is therefore not Chrome [I].

### 2.2 Features

| Feature | Status | Detail (web3dsurvey shares are "of reports tested", 2026-10-11) |
|---|---|---|
| Storage buffers read in the **vertex** stage | **Guaranteed by core spec** (8 per stage). Compat mode: default 0. | [S] spec. "~45 % of these old devices do not support storage buffers in vertex shaders" refers to compat-only devices [R] https://webgpufundamentals.org/webgpu/lessons/webgpu-compatibility-mode.html |
| Compute shaders | Guaranteed by core spec (and present in compat). | [S] spec |
| `firstInstance` in direct draws | Guaranteed by core spec. | [S] spec |
| `indirect-first-instance` | Optional; present on Intel (D3D12: always enabled), Mali, Adreno. | Android 99.82 %, Windows 100 %, iOS 100 %; Qualcomm 99.72 %. [S] Dawn D3D12 source; survey |
| Multi-draw indirect | **Absent** from the standard and from default Chrome. Dawn marks `MultiDrawIndirect` "Experimental"; the Chrome name is `chromium-experimental-multi-draw-indirect`, behind `chrome://flags/#enable-unsafe-webgpu`. | Survey 0.12 %. [S] Dawn `Features.cpp`; [R] https://developer.chrome.com/blog/new-in-webgpu-131 |
| `timestamp-query` | Optional; present nearly everywhere. Values quantised to 100 µs in Chrome unless the developer-features flag is set. | Android 97.74 %, Windows 99.89 %; Gen9 99.67 %; Mali Valhall 97.97 %, Bifrost 93.99 %; Adreno 100 %. [S] survey; [S] Chrome 121 post |
| `texture-compression-bc` | Optional; **Windows yes, Android mostly no**. | Windows 99.99 %, Android 34.98 %; ARM 0 %; Qualcomm 72.21 %. D3D12: always enabled [S] |
| `texture-compression-etc2` / `-astc` | Optional; **Android yes, Windows no**. | Android 99.94 % each; Windows 0.06 %. Dawn's Vulkan backend refuses a device that has neither BC nor ETC2+ASTC [S] |
| `float32-filterable` | Optional. Intel and Mali yes; **Adreno mostly no**. | Android 70.08 %, Windows 99.92 %, iOS 53.85 %. Gen9 99.76 %; Mali 100 %; Adreno 6xx 9.78 %, 7xx 46.35 %, 8xx 100 % |
| `float32-blendable` | Optional. Intel and Adreno yes; **Mali mostly no**. | Android 55.96 %. Mali Bifrost 0 %, Valhall 11.53 %; Adreno 6xx/7xx ≈ 98.7 %; Gen9 98.99 % |
| `rg11b10ufloat-renderable` | Optional; present on all three. | Android 99.82 %, Windows 100 % |
| `depth32float-stencil8` | Optional; present on all three. | Android 99.8 %, Windows 100 % |
| Render bundles | Guaranteed by core spec. | [S] spec |
| 4× MSAA | Guaranteed by core spec (`sampleCount` must be 1 or 4) for the formats the spec's table marks multisampled; in core that includes `rgba8unorm`, `bgra8unorm`, `rgba16float`, `r32float`. `rg11b10ufloat` needs its feature. Dawn's Vulkan backend refuses a driver without 4× colour and depth. | [S] spec; [S] PhysicalDeviceVk.cpp |
| Storage texture formats in core | write-only and read-only: `rgba8unorm/snorm/uint/sint`, `rgba16uint/sint/float`, `r32uint/sint/float`, `rg32uint/sint/float`, `rgba32uint/sint/float`. read-write: only `r32uint`, `r32sint`, `r32float`. More with `texture-formats-tier1` (r8, rg8, r16*, rg16*, rgb10a2 …) and tier2 (read-write on the rgba8/16/32 formats). | [S] spec §26.1.1 |
| `texture-formats-tier1` / `tier2` | Optional. | tier1: Android 97.4 %, Windows 91.04 %. tier2: Android 97.4 %, Windows 89.81 %, Gen9 94.54 %, **iOS 34.33 %**, Firefox 0.35 % |
| `bgra8unorm-storage` | Optional. Mali yes; **Adreno 6xx no, 7xx half**; Gen9 mostly. | Android 68.69 %, Windows 97.25 %. Mali ≈ 100 %; Adreno 6xx 0.96 %, 7xx 45.74 %; Gen9 88.82 % |
| `shader-f16` | Optional. | Android 85.73 %, Windows 91.14 %. Mali 100 %; Adreno 6xx 31.8 %, 7xx 96.36 %; Gen9 87.33 %. On D3D12 it needs DXC, shader model ≥ 6.2 and native 16-bit ops [S] |
| `dual-source-blending` | Optional. | Android 68.84 %, Windows 99.19 %, iOS 0.08 %. Mali Bifrost 72.97 %, Valhall 38.35 %; Adreno ≈ 99 %; Gen9 99.19 % |
| `clip-distances` | Optional. **Mali: none.** | Android 50.73 %, Windows 91.77 %. ARM 0 %; Adreno 6xx 99.05 % in the survey, but Dawn `main` now withholds it on Adreno 6xx for wrong clipping (crbug 570632001) [S]; Safari only from 27 [R] |
| `subgroups` | Optional. | **Gen9: 0.01 %**, Gen8: 0.55 %; Mali Valhall 99.16 %; Adreno 7xx 98.2 %, 6xx 17.03 % |
| `primitive-index` | Optional. | Android 97.4 %, Windows 90.41 %, iOS 34.48 % |

Reading the survey's shares: a feature page counts only reports from browsers that know the feature, on all
platforms together for a vendor row; "intel gen-9" mixes Windows with a few Macs and Linux machines [I].

---

## 3. Traps on these device classes

### 3.1 Shader compile and pipeline creation (Windows)

- Chrome hard-wires DXC on: `kWebGPUUseDXC` returns `true`; Dawn forces FXC only when the device's highest shader
  model is below 6.0. [S] https://raw.githubusercontent.com/chromium/chromium/main/gpu/command_buffer/service/dawn_platform.cc ,
  PhysicalDeviceD3D12.cpp. When FXC is used its optimisations are off by default. [S] same file.
- Which shader model a UHD 630 reports with its last driver: **not found** in a primary source. Indirect: 87.33 % of
  "intel gen-9" reports expose `shader-f16`, which on D3D12 requires DXC and SM ≥ 6.2. [S] survey + Dawn source; the
  step to "most Gen9 Windows machines use DXC" is [I].
- Gen9-specific settings Dawn applies on D3D12: SM 6.6 off for drivers between 27.20.100.8935 and 27.20.100.9684;
  a temp-buffer path for small-format texture copies and a blend-factor workaround for drivers older than
  31.0.101.2114 / 2121 (one blend case has "no workaround"); depth-texture copies done by blit for drivers
  ≥ 31.0.101.2121; no texture sub-allocation for render-attachment textures on non-Skylake Gen9; depth-stencil
  textures force-cleared on creation; buffer↔texture copies with a large row pitch split (all Intel). [S]
  PhysicalDeviceD3D12.cpp
- Measured, on other hardware: 20 synchronous compute-pipeline creations ≈ 0.4 s of GPU-process main-thread time
  with DXC (RTX 3060 laptop, Chrome 154, Windows 11), "several times that under FXC or on slower CPUs"; shader
  sources of 2.7–20 k characters. [R] https://github.com/pmndrs/upscaler/issues/82 (2026-10-06)
- DXC against FXC on heavily inlined shaders (RTX 4090, Chrome 155): 1.6 s against 17.5 s; 8.2 s against > 150 s;
  the driver's own compile was 55–80 % of pipeline creation. [R] https://github.com/chesapeake-tech/luma.gl/issues/1
  (2026-10-09)
- Google's figure for DXC against FXC: "20% average increase in compute shader compilation speed". [S] Chrome 121 post
- Synchronous `createRenderPipeline` blocks the GPU process; the async call compiles off it — see `study-webgpu.md`
  §2 (not re-read today).
- A compile time for this kind of engine on Gen9 hardware under either compiler: **not found**.

### 3.2 Drivers on the phone classes

- Qualcomm (proprietary driver), set by default in Dawn: the command buffer is split whenever a compute pass follows
  a render pass ("frequently causes a crash"); resolve always into level 0 / layer 0 and then copy; an empty pass
  with a resolve target gets dummy work; `max/min/clamp` scalarised; a workaround for 2D depth-compare sampling;
  SPIR-V 1.4 off on Adreno 7xx. [S] PhysicalDeviceVk.cpp
- ARM (proprietary driver): a pass that resolves several colour targets is rewritten into separate resolve passes
  after it ("Resolving multiple color targets in a single pass fails on ARM GPUs"); `pack/unpack4x8*norm`
  polyfilled; texture handles not passed to functions; SPIR-V 1.4 off on Android ARM after a memory-safety crash in
  `libGLES_mali` seen on a Pixel 6 (issue of 2026-04-01); dynamic rendering off on Mali-G68; a sleep after device
  loss for Mali driver versions 42–55. [S] same file; [S] https://issues.chromium.org/issues/498659375
- A live example on Adreno 7xx: valid WGSL fails `createComputePipeline` with `VK_ERROR_UNKNOWN` on a Nothing
  Phone 2, Chrome 153. [R] https://github.com/linebender/vello/issues/1957 (2026-09-28); the Chromium issue exists
  [S] https://issues.chromium.org/issues/566593641 — the tracker's API returns a status code I read as "fixed",
  last change 2026-10-08; in which Chrome version: **not found**.
- Pixel 10 (PowerVR) and Xclipse: `vkGetPipelineCacheData` returns incomplete data; Dawn works around it. [S]

### 3.3 Tile-based GPUs: load/store, passes, MSAA

- Dawn treats ARM, Imagination, Qualcomm and Apple GPUs as tile-based renderers (`IsTileBasedRenderer`). [S]
  `GPUInfo.cpp`
- `GPUTextureUsage.TRANSIENT_ATTACHMENT` (Chrome 146; Firefox 157): attachments used only inside one pass can stay
  in tile memory and may get no memory at all. Rules tightened in Chrome 149–150: no `viewFormats`, cannot be a
  `resolveTarget`. [S] Chrome 146 and 149–150 posts; [R] Firefox 157 notes
- Dawn zero-initialises every resource on first use ("lazy_clear_resource_on_first_use"). [S] Dawn `Toggles.cpp`.
  That a `loadOp: "load"` on a never-written texture therefore costs a clear pass: [I].
- The two resolve workarounds in §3.2 mean a multi-target MSAA resolve on Mali, and a resolve into a mip or layer
  on Adreno, each cost extra passes or copies. [I] from [S]
- Numbers for load/store or resolve cost under Chrome WebGPU on Mali or Adreno: **not found**.

### 3.4 Buffer and texture uploads

- "writeBuffer() and writeTexture() have been optimized in Chrome, resulting in performance gains up to 2X better
  than the previous version, depending on the size of the data". [R] Chrome 144 post (2026-01-07)
- Chrome 145 lists "Experimental synchronous buffer mapping in workers"; Chrome 153–154 notes an experimental Dawn
  feature (`BufferMapWriteExtendedUsages`) that lets a mapped-for-write buffer also be GPU-usable, "eliminating the
  staging buffer and the extra copy on Vulkan and D3D12". Neither is default web API. [S] Chrome news index and
  153–154 post
- General guidance (2023): `writeBuffer` is "the recommended, high performance route"; `mappedAtCreation` saves one
  CPU copy for write-once data. [R] https://toji.dev/webgpu-best-practices/buffer-uploads.html
- One measurement, M1 Mac: mapped buffers and one large uniform buffer with offsets took a scene from ~8 000 to
  ~15 000 cubes at 75 fps. [R] https://webgpufundamentals.org/webgpu/lessons/webgpu-optimization.html
- `copyExternalImageToTexture` from a 2D canvas: Chromium issue "Ensure that canvas2D->WebGPU performance is on par
  with canvas2D->WebGL on all platforms", opened 2023-06-20 from Windows (≈ 10 fps against ≈ 60 fps on a GTX 1050
  Ti), **still open**, last change 2026-10-01. [S] https://issues.chromium.org/issues/40273077 . On an M1 Mac: 240
  canvases of 2048² per frame at 120 fps under WebGL against ~40–220 under WebGPU depending on Chrome version;
  Firefox and Safari one. Windows and Android: "huge perf regressions", no numbers. [R]
  https://github.com/gpuweb/gpuweb/issues/5330 (2025-10)
- Image decode (desktop): Chrome `createImageBitmap` 177 ms against `ImageDecoder` 163 ms for one glTF scene;
  Firefox 460 ms against 116–196 ms. [R] https://www.ludicon.com/castano/blog/2026/05/image-loading-on-the-web/
- Upload cost on Gen9 or on Android by any path: **not found**.

### 3.5 Per-draw cost against WebGL

- No per-draw number for Chrome on Gen9 or on Android exists publicly: **not found**.
- M1 Pro, Chrome 151 (engine-level, not API-level): without instancing "PlayCanvas and Babylon.js ran faster on
  WebGL2, and three.js's classic WebGLRenderer (7 ms) beat its WebGPURenderer (29 ms)"; "WebGPU wins on instanced
  paths". [R] https://github.com/mvaligursky/webgpu-webgl-benchmarks
- Babylon forum, 2026-06-24: on a Pixel 5 (Adreno 620) WebGL 2 was faster than WebGPU in Chrome; update 2026-09-19:
  "WebGPU with Babylon Lite now matches or beats WebGL 2", cause unknown to the author; iOS "works well". [R]
  https://forum.babylonjs.com/t/webgpu-on-mobile-is-it-ready/63694
- Figma (2025-09-18): batching all uniform data into one upload per frame; "performance improvement … on some
  classes of devices, and more neutral results on others". [R]
  https://www.figma.com/blog/figma-rendering-powered-by-webgpu/
- Chrome 149–150 added `setImmediates()` (small per-draw data without a buffer or bind group); the survey shows the
  WGSL extension `immediate_address_space` in 74.4 % of reports. [S] post; survey

### 3.6 Storage-buffer reads in vertex shaders on Mali / Adreno

- A measurement of vertex-stage storage-buffer reads against vertex attributes on Mali or Adreno under WebGPU:
  **not found**.
- A general remark only: passing vertices through storage buffers "for some older devices … is slower than the
  classic way". [R] webgpufundamentals (via search summary)
- Related correctness item: a struct written whole into a storage array fails pipeline creation on Adreno 7xx (§3.2).

### 3.7 Workers and OffscreenCanvas

- `OffscreenCanvas.getContext("webgpu")` and `WorkerNavigator.gpu`: Chrome 113 desktop, Chrome Android 121; Firefox
  141 "Windows only, in all contexts except for service workers" (Firefox 148 added service workers [R]); Safari 26
  by compat data; Firefox Android no. [S] https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/OffscreenCanvas.json ,
  `WorkerNavigator.json`
- Apple's own posts for Safari 26 and 27 do not mention workers or OffscreenCanvas for WebGPU. [R]
- A report (unresolved, no device named): "`OffscreenCanvas` hangs" and "Device Lost" on mobile under background
  load. [R] https://forum.babylonjs.com/t/webgpu-performance-regression-and-worker-thread-lag-on-mobile-since-v9-5-0/63456
  (2026-05)

### 3.8 Presentation and frame pacing

- Construct, "Subpar WebGPU performance on mobile devices": Galaxy S20+ and Pixel 7 Pro, Chrome 121, "constant,
  extreme stutters" under WebGPU where WebGL was smooth; no fps numbers; closed 2025-07-28 without a confirmed
  cause. [R] https://github.com/Scirra/Construct-bugs/issues/7874
- **Correction** to how that issue reads: of the two Chromium issues it points to, 40273077 is the canvas-2D-upload
  issue above, and 40839122 is titled "Jank in Android WebView with WebGL canvas rendering" — WebView and WebGL, not
  WebGPU in Chrome. [S] tracker API
- How Chrome presents a WebGPU canvas on Android or on Windows (copies, overlays), and any pacing measurement:
  **not found**.

### 3.9 Device loss

- Chrome kills the GPU process when a driver call takes "10 seconds or so"; after a second GPU-process crash within
  two minutes the page gets no new adapter; three within two minutes block all pages; after 3–6 in five minutes the
  GPU process is not restarted. [R] https://toji.dev/webgpu-best-practices/device-loss.html (2024-10-23)
- Windows: devices lost mid-session with no new device obtainable (Figma, no device list). [R]
- A Windows `E_INVALIDARG` on pipeline creation leading to device loss, RTX 3080, Chrome 132; gone in later Chrome.
  [R] https://github.com/mrdoob/three.js/issues/30405 (2025-01)
- Mobile: "Device Lost on mobile WebGPU can happen when the browser/GPU process is under memory or scheduling
  pressure" (a Babylon team member, 2026-05-18). [R] forum link above
- Whether Chrome on Android loses the device when the tab or the Custom Tab goes to the background: **not found**.

### 3.10 Memory on Android

- A documented WebGPU memory budget for Chrome on Android: **not found**.
- What adapters report: `maxBufferSize` ≥ 1 GiB in 100 % of Android reports and ≥ 2 GiB in 77 %; storage-buffer
  binding size stays at 128 MiB on 94 % of Adreno 7xx. [S] survey
- Chromium issue "Receive GPU connection lost instead of GPUOutOfMemoryError" exists (40941407); content not read.

---

## 4. Offline validation without a GPU

| Tool | What it is | What it can check | What it cannot | Mark, source |
|---|---|---|---|---|
| **tint** (command-line tool in the Dawn repository) | Chrome's own WGSL compiler front end and writers. | Parses and validates WGSL exactly as Chrome's `createShaderModule` does (same code): types, attributes, bindings' declarations, the derivative-uniformity rule. Writes SPIR-V, HLSL (DXC or FXC flavour), MSL, GLSL, WGSL. With `--dxc <dll>` or `--fxc <dll>` it also compiles the generated HLSL with that compiler ("automatically enables HLSL validation"), at a chosen shader model (6.0 … 6.10). `--parse-only`. | Nothing about pipelines, vertex layouts, bind group layouts or limits; nothing about drivers. | [S] option list in https://raw.githubusercontent.com/google/dawn/main/src/tint/cmd/tint/main.cc ; "same code as Chrome" is [I] from Tint being part of Dawn |
| **naga** (`naga-cli`, part of wgpu; Firefox's compiler) | A separate implementation. | `naga shader.wgsl` validates a module with naga's validator; translates to SPIR-V, MSL, HLSL, GLSL, WGSL. | It is not Chrome's validator. Its uniformity analysis is described by its maintainers as "incorrect" and can be switched off by a diagnostic directive; so a shader naga accepts Chrome may reject, and the other way round. Nothing about pipelines. | [R] https://raw.githubusercontent.com/gfx-rs/wgpu/trunk/naga/README.md ; [R] https://github.com/gfx-rs/wgpu/pull/6148 (merged 2024-11-12) |
| **dawn.node** — npm package `webgpu` 0.6.2 (2026-10-02), ≈ 137 MB unpacked | Dawn itself as a Node module: `navigator.gpu` in Node. | Everything the WebGPU API validates, by the same Dawn code as Chrome's GPU process: shader modules, bind group layouts against shaders, pipeline descriptors against vertex layouts and target formats, bind groups, command encoding, limits; errors come through error scopes. Options: `backend=null|d3d11|d3d12|metal|vulkan|opengl|opengles`, `adapter=…`, Dawn toggles. Dawn's **Null backend** needs no GPU; it enables every feature and gives the default limits. A software Vulkan can be used instead (SwiftShader or Lavapipe through `VK_ICD_FILENAMES`; building Lavapipe with Dawn is Linux-only). | No driver behaviour (none of §3.2 shows up), no Chrome blocklist or limit tiering, no canvas presentation, no timings that mean anything for a device. Whether the prebuilt npm binary includes the Null backend: listed as an option in its README, **not verified** by running. | [S] https://raw.githubusercontent.com/dawn-gpu/node-webgpu/main/README.md ; [S] https://raw.githubusercontent.com/google/dawn/main/src/dawn/node/README.md ; [S] `src/dawn/native/null/DeviceNull.cpp`; [S] npm registry |

The WebGPU conformance suite (CTS) runs on dawn.node (`./tools/run run-cts`). [S] Dawn node README.

---

## 5. What remains unknown without trying on a device

1. Whether a given Gen9 laptop reports shader model ≥ 6.0 (DXC) with the driver it actually has — Windows Update
   often leaves an older driver than Intel's latest; and how long this engine's pipelines take to compile there.
2. Frame time and pacing of WebGPU against WebGL on UHD 630 and on Mali-G78 / G710 / G68 and Adreno 642L / 730 —
   no published measurement of any kind.
3. Whether Galaxy A53, Snapdragon 778G phones and 8 Gen 1 phones get a **core** adapter in practice (the rules say
   yes; per-model confirmation not found), and which optional features each reports.
4. Cost of vertex-stage storage-buffer reads on Mali and Adreno.
5. Cost of `writeTexture` / `copyExternalImageToTexture` for large pages on these devices.
6. Device loss when a Chrome tab or Custom Tab is backgrounded on Android, and recovery afterwards.
7. How much GPU memory a page can hold on a 6–8 GB Android phone before the device is lost.
8. Stability of D3D12 under Dawn on Gen9 over hours (only Figma's general Windows statement exists).
9. Whether Chrome's Custom Tab / TWA differs in any WebGPU respect from a normal Chrome tab.
10. Behaviour of the Chromium tracker's issues cited here beyond title, dates and first description — comments
    could not be read (the site needs a browser).

---

## 6. Sources

Primary source files (raw, `main`, fetched 2026-10-11):
- https://raw.githubusercontent.com/chromium/chromium/main/gpu/config/webgpu_blocklist_impl.cc
- https://raw.githubusercontent.com/chromium/chromium/main/gpu/config/gpu_finch_features.cc
- https://raw.githubusercontent.com/chromium/chromium/main/gpu/config/software_rendering_list.json
- https://raw.githubusercontent.com/chromium/chromium/main/gpu/command_buffer/service/dawn_platform.cc
- https://raw.githubusercontent.com/google/dawn/main/src/dawn/native/d3d12/PhysicalDeviceD3D12.cpp
- https://raw.githubusercontent.com/google/dawn/main/src/dawn/native/d3d12/D3D12Info.cpp
- https://raw.githubusercontent.com/google/dawn/main/src/dawn/native/vulkan/PhysicalDeviceVk.cpp
- https://raw.githubusercontent.com/google/dawn/main/src/dawn/native/Limits.cpp
- https://raw.githubusercontent.com/google/dawn/main/src/dawn/native/Features.cpp
- https://raw.githubusercontent.com/google/dawn/main/src/dawn/native/Toggles.cpp
- https://raw.githubusercontent.com/google/dawn/main/src/dawn/native/null/DeviceNull.cpp
- https://raw.githubusercontent.com/google/dawn/main/src/dawn/common/GPUInfo.cpp , https://raw.githubusercontent.com/google/dawn/main/src/dawn/gpu_info.json
- https://raw.githubusercontent.com/google/dawn/main/src/tint/cmd/tint/main.cc
- https://raw.githubusercontent.com/google/dawn/main/src/dawn/node/README.md
- https://raw.githubusercontent.com/dawn-gpu/node-webgpu/main/README.md ; https://registry.npmjs.org/webgpu
- https://raw.githubusercontent.com/GoogleChrome/android-browser-helper/main/androidbrowserhelper/src/main/java/com/google/androidbrowserhelper/trusted/TwaProviderPicker.java
- https://raw.githubusercontent.com/wiki/gpuweb/gpuweb/Implementation-Status.md
- https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/GPU.json , `OffscreenCanvas.json`, `WorkerNavigator.json`, `HTMLCanvasElement.json`
- https://raw.githubusercontent.com/Fyrd/caniuse/main/features-json/webgpu.json
- https://gpuweb.github.io/gpuweb/ (Editor's Draft, 2026-10-08)

Survey (fetched 2026-10-11): https://web3dsurvey.com/webgpu ; `https://web3dsurvey.com/webgpu/features/<name>` ;
`https://web3dsurvey.com/webgpu/limits/<name>`

Chrome: https://developer.chrome.com/blog/new-in-webgpu-121 (2024-01) ; -131 ; -144 (2026-01-07) ; -146 (2026-02) ;
-147-148 (2026-04-22) ; -149-150 (2026-06-17) ; -151-152 (2026-08-12) ; -153-154 (2026-09-15) ;
https://developer.chrome.com/docs/web-platform/webgpu/news ; https://developer.chrome.com/docs/android/custom-tabs/ ;
https://www.mail-archive.com/blink-dev@chromium.org/msg15558.html (2026-01-13)

Chromium tracker (title, dates, first description through `https://issues.chromium.org/action/issues/<id>`):
40273077, 40839122, 40287183, 41479539, 487613497, 498659375, 566593641

Apple / Mozilla / Intel: https://webkit.org/blog/17333/webkit-features-in-safari-26-0/ (2025-09-15) ;
https://webkit.org/blog/18325/webkit-features-for-safari-27-0/ (2026-09-17) ;
https://developer.apple.com/documentation/safari-release-notes/safari-27-release-notes ;
https://www.macrumors.com/2026/09/14/ios-27-compatible-iphones/ ;
https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/157 (2026-09-29) ;
https://www.intel.com/content/www/us/en/download/776137/intel-7th-10th-gen-processor-graphics-windows.html (2026-09-22)

Engine authors and field reports: https://github.com/pmndrs/upscaler/issues/82 (2026-10-06) ;
https://github.com/chesapeake-tech/luma.gl/issues/1 (2026-10-09) ; https://github.com/linebender/vello/issues/1957
(2026-09-28) ; https://github.com/rerun-io/rerun/issues/12788 (2026-05) ;
https://github.com/Scirra/Construct-bugs/issues/7874 (2024-03 … 2025-07) ; https://github.com/gpuweb/gpuweb/issues/5330
(2025-10) ; https://github.com/mvaligursky/webgpu-webgl-benchmarks ; https://github.com/mrdoob/three.js/issues/30405
(2025-01) ; https://forum.babylonjs.com/t/webgpu-on-mobile-is-it-ready/63694 (2026-06 … 09) ;
https://forum.babylonjs.com/t/webgpu-performance-regression-and-worker-thread-lag-on-mobile-since-v9-5-0/63456
(2026-05) ; https://www.figma.com/blog/figma-rendering-powered-by-webgpu/ (2025-09-18) ;
https://toji.dev/webgpu-best-practices/device-loss.html (2024-10) ;
https://toji.dev/webgpu-best-practices/buffer-uploads.html (2023-02) ;
https://webgpufundamentals.org/webgpu/lessons/webgpu-compatibility-mode.html ;
https://webgpufundamentals.org/webgpu/lessons/webgpu-optimization.html ;
https://www.ludicon.com/castano/blog/2026/05/image-loading-on-the-web/ ;
https://docs.unity3d.com/6000.3/Documentation/Manual/WebGPU-limitations.html (Unity 6.3: "WebGPU is currently
experimental"; no mobile statement) ; https://raw.githubusercontent.com/gfx-rs/wgpu/trunk/naga/README.md ;
https://github.com/gfx-rs/wgpu/pull/6148 (2024-11-12)

Looked for and not found: PlayCanvas and Bevy / wgpu statements specific to WebGPU on 2022 Android phones or Gen9
laptops; Arm or Qualcomm guidance specific to browser WebGPU.
