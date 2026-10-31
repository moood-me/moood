// Engine 3's shared names and its smallest tools. This module imports nothing and
// touches nothing of a browser as it is imported: the thread, the artist, the painters and the whole-set check in node
// all read it.

// ── a task's end: the one way work is sliced (2.7 — no timer anywhere in the engine) ──
// turn() resolves in a later task: a message through a channel, not a setTimeout (which the browser holds 4 ms once
// nested, and which a render's virtual clock owns). The channel is made at the first call, so importing this module
// in node holds no event loop open.
let port = null;
const waiting = [];
export function turn() {
  if (!port) {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => { const resolve = waiting.shift(); if (resolve) resolve(); };
    port = channel.port2;
  }
  return new Promise(resolve => { waiting.push(resolve); port.postMessage(0); });
}

// An array emptied keeping its storage, to be filled again: emptied by its length, V8 lets its storage go and the next
// push makes it anew — for an array refilled each tick, an allocation each tick. Popped, it keeps it.
export function empty(a) { while (a.length) a.pop(); }

// ── two readers of the language, shared by the modules that compile a spec ──
// "#rrggbb" (sRGB) → [r, g, b] linear, or null
export function linearOf(hex) {
  if (typeof hex !== 'string' || !/^#?[0-9a-f]{6}$/i.test(hex)) return null;
  const v = parseInt(hex.replace('#', ''), 16), c = k => { const s = ((v >> k) & 255) / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return [c(16), c(8), c(0)];
}
// a point in an element's own frame: {"on": id, "at": [across, distance, elevation]} — metres from its anchor along its
// own axes, as "on" places things: it goes and turns with it. The other points the language names: an element's id,
// "id#name", [across, distance, elevation] (the elevation over the land there)
export const framedPoint = v => !!v && typeof v === 'object' && typeof v.on === 'string' && Array.isArray(v.at) && v.at.length >= 2 && v.at.length <= 3 && v.at.every(Number.isFinite);

// ── the kinds of a quad (bits 0–2 of its flags) ──
export const QUAD = Object.freeze({ CARD: 0, FACING: 1, PLANE: 2, DRAPE: 3, SKY: 4, INSERT: 5, FORM: 6, KIND: 7 });
// a quad's flags (WT2; the kind below them)
export const FLAG = Object.freeze({
  SHOWN: 8, GLOWS: 16, WIND: 32, DRIFT: 64, SHIMMER: 128, FLICKER: 256, WRAP_X: 512, WRAP_Y: 1024, FLIP: 2048,
  INSIDE: 4096, REFLECTED_ONLY: 8192, REFLECTS: 16384, GLASS: 32768, CLIPPED: 65536, PART: 131072, WHOLE: 262144,
  ADD: 524288, MULTIPLY: 1048576, READ: 2097152, OFFERED: 4194304, SELECTED: 8388608, CUT_ONLY: 16777216,
});
// a form's grid: points a side; the cells a side of a block the pages are asked by; a cell's most px before a finer
// stride is drawn (5.23)
export const FORM = Object.freeze({ SIDE: 33, BLOCK: 4, CELL: 12 });
export const INSERTS = Object.freeze({ MOST: 16 });
// the highlight's breath (IN3)
export const PULSE = Object.freeze({ DEPTH: 0.35, RATE: 2.4 });
// a light's kind, its flags, and the lit set's numbers (5.5): the far, the through lights and the beams lit at once
export const LIGHT = Object.freeze({ FAR: 0, THROUGH: 1, POINT: 2, WINDOW: 3, INSIDE: 1, GLOW: 2, LIT: 256, CELL: 16, SMALL: 4, FAR_MOST: 8, THROUGH_MOST: 4, SPOT_MOST: 2 });
export const SHADOW = Object.freeze({ COARSER: 8, LIGHTS: 4, KEYS: 2, HOLD: 1.5 });
// the shadow receivers a quad is (WT2 `recv`, bits): bit 0 is THE GROUND
export const RECV = Object.freeze({ GROUND: 1 });
// below this alpha a cast program drops the fragment (4.6)
export const CAST = Object.freeze({ ALPHA: 0.5 });
// what stands close before the eye fades out in the last steps to it (5.17): gone at FROM metres along the gaze, whole
// from TO on — 0.12 and 0.35 of the eye's height (1.7 m). The camera's nearest and its rays' start go by the same two
export const PASS = Object.freeze({ FROM: 0.204, TO: 0.595 });
// the cutter sets a scene has, a channel of `masks` each (WT2)
export const CLIP = Object.freeze({ SETS: 4 });
// the fast part of a layer's bend in the wind: with the look's wind strength, the bound of the bend (SH10)
export const WIND = Object.freeze({ FAST: 0.45 });
// (SOFT: how much coarser than the screen asks a pixel reads a sheet's page, levels — its page is that of level
// ⌊λ + SOFT⌋: at most 2^SOFT, some 9 %, magnified; one formula, the ask's and the shader's: 4.8)
export const SHEET = Object.freeze({ PAGE: 256, BORDER: 8, UNIT: 68, TOP: 52, SLOT: 272, SLOTS_SIDE: 7, LAYER: 1904, MAX_PPM: 2048, WINDOW: 7, OPAQUE: 242, SOFT: 0.125 });
export const DEPTH = Object.freeze({ BIAS: 4, SLOPE: 1 });
// (a view's pressure: its end, quarter levels; the share of the room its finer probe may take for it to fall — 5.19)
export const BIAS = Object.freeze({ MOST: 16, FALL: 0.8 });
export const OWN = Object.freeze({ SHEETS: 10, VALUES: 32 });
export const PARTICLES = Object.freeze({ MAX: 65536 });
export const SHOTS_LIVE = 2, MAKES_AHEAD = 2;
export const STEP = 1 / 60, DT_MOST = 0.1;
export const ORIGIN = Object.freeze({ STEP: 64, REACH: 96 });
// (the pacer, 5.1: the least step, ms; the window, run callbacks; the misses or overs it tolerates in it; a late
// callback, in steps; a frame's thread time and GPU time (by timestamps) that fit, in steps; the submits in flight that
// count as the GPU behind)
export const PACE = Object.freeze({ PERIOD_LEAST: 10, WINDOW: 120, MISSES: 6, LATE: 1.5, JS: 0.8, GPU: 0.8, BEHIND: 3 });
// (people: a figure not shown this long is brought up at rest — PP7)
export const LATE = 0.25;
export const WAITS_EVERY = 15;
export const VIEW = Object.freeze({ MIRROR: 1 });
// a mirror's image (5.7): the most of the frame's px it has, a share; the most of the frame's own px it is drawn at (a
// rough one's DENSITY / (1 + 3 · rough), at least 0.25) and a pane's; how far over the mirror its near plane lies,
// metres
export const MIRROR = Object.freeze({ SHARE: 0.25, DENSITY: 0.75, GLASS: 0.5, OVER: 0.01 });
// a lit quad's cell is no larger in the view, px (5.12)
export const LIT = Object.freeze({ CELL: 96 });
// a painted light's glow is that much of its strength; a glow that does not flicker (5.5)
export const GLOW = Object.freeze({ PAINTED: 0.6, STEADY: 0.9 });
// the passes of a drawn frame, in order (4.4)
export const PASSES = Object.freeze(['bake', 'shadow-static', 'shadow-movers', 'blob', 'air', 'mirror', 'masks', 'main-solid', 'main-blend', 'bloom', 'gather', 'canvas']);
