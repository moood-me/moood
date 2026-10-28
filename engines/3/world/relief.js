// The land: spec.relief, the body of function (across, distance, anim, lib) returning the ground's height there
// (metres) — and what is worked out of it, as games do with a terrain. Shared by the scene's thread and the artist
// (WT9): landOf makes the function (each thread its own, from the same text); fieldOf bakes the height field over
// where the scene is — the artist's work (SH6 'land' → 'landed'); reliefOf (the thread) puts the function and the
// field together as world.relief (WT5), with a pyramid of each cell block's lowest and highest for rays here (what the
// viewer points at on the ground, the operator's lines of sight) that skip whole blocks they pass over. A ray ends on
// the function itself (its last cell bisected on it). Nothing is drawn or placed from the field: the land drawn, the
// land stood on and a draped point are all the function. What stands on the land — people, their anchors and their
// feet — stands on the land at its finest (surfaceOf: the function at the points of one lattice of FINE metres, two
// triangles a cell), a tile of it baked once where they come.
//   Coordinates: the relief's own (across, distance) for the function and the field — field.data[j · nx + i] is the
// height at across x0 + i · step, distance z0 + j · step; rays and points in the world's (x = across, y up,
// z = −distance).
import '../../../i18n/i18n.js';

// the height field's cells: at most FIELD on a side, none finer than FINEST metres — over all of the region round
// where the scene is, however wide (its cells as wide as it takes: a 100 km scene's 200 m)
const FIELD = 512, FINEST = 0.25, MARGIN = 20;
// the land's finest lattice (metres a cell), its points from the world's origin; a tile of it TILE cells on a side; at
// most TILES of them kept
export const FINE = 0.05;
const TILE = 32, TILES = 512;

// The land function of a compiled spec — height(across, distance) → metres — or null (no relief). shared:
// kit.shared's (its anim and lib are the function's). What it throws, or a height that is no number, is said once
// (warn) and is flat there. height.lift(p) — p: a point of the world (x, y, z) — raises the point by the land there,
// in the array: what places every point of a draped sheet (WT7) is handed no number back (5.16).
export function landOf(C, shared, warn = () => {}) {
  if (!C.relief) return null;
  let fn = null, said = false;
  try { fn = globalThis.MooodI18n.bind(shared.tr, 'across, distance, anim, lib', C.relief); } catch (err) { warn(`relief: ${err?.message || err}`); return null; }
  const say = msg => { if (!said) { said = true; warn(`relief: ${msg}`); } };
  const { anim, lib } = shared;
  const height = (across, distance) => {
    try {
      const h = fn(across, distance, anim, lib);
      if (Number.isFinite(h)) return h;
      say(`at across ${across}, distance ${distance} it returned ${h}, not a number of metres`);
    } catch (err) { say(err?.message || err); }
    return 0;
  };
  height.lift = p => {
    try {
      const h = fn(p[0], -p[2], anim, lib);
      if (Number.isFinite(h)) p[1] += h; else say(`at across ${p[0]}, distance ${-p[2]} it returned ${h}, not a number of metres`);
    } catch (err) { say(err?.message || err); }
  };
  return height;
}

// The land as what stands on it stands on it: under(p) — p a point of the world (x, _, z), the land's height there
// into p[1] — on the lattice's triangles (each cell split from its +x corner to its +z one), the function at their
// corners baked a tile at a time the first time one is stood on, the oldest let go past TILES. One for a height
// function; asked every step by what walks, it makes nothing once its tiles are there
const surfaces = new WeakMap();
export function surfaceOf(height) {
  let under = surfaces.get(height);
  if (under) return under;
  // (the tiles by their numbers across, then along: small integers each, a Map in a Map — any distance from the
  // origin, nothing made to look one up)
  const tiles = new Map(), W = TILE + 1;
  let stamp = 0, count = 0, lastI = NaN, lastJ = NaN, last = null;
  const tileOf = (ti, tj) => {
    if (ti === lastI && tj === lastJ) return last;
    let row = tiles.get(ti), t = row?.get(tj);
    if (!t) {
      if (count >= TILES) {
        let oi = 0, oj = 0, oldest = Infinity;
        for (const [i, r] of tiles) for (const [j, v] of r) if (v.used < oldest) { oldest = v.used; oi = i; oj = j; }
        const r = tiles.get(oi);
        r.delete(oj); if (!r.size) tiles.delete(oi);
        count--;
        if (oi === ti) row = tiles.get(ti);
      }
      const h = new Float32Array(W * W);
      for (let b = 0; b < W; b++) for (let a = 0; a < W; a++) h[b * W + a] = height((ti * TILE + a) * FINE, -(tj * TILE + b) * FINE);
      if (!row) tiles.set(ti, row = new Map());
      row.set(tj, t = { h, used: 0 });
      count++;
    }
    t.used = ++stamp; lastI = ti; lastJ = tj; last = t;
    return t;
  };
  under = p => {
    const fx = p[0] / FINE, fz = p[2] / FINE, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const ti = Math.floor(i / TILE), tj = Math.floor(j / TILE), h = tileOf(ti, tj).h, o = (j - tj * TILE) * W + (i - ti * TILE);
    const h00 = h[o], h10 = h[o + 1], h01 = h[o + W], h11 = h[o + W + 1];
    p[1] = u + v <= 1 ? h00 + u * (h10 - h00) + v * (h01 - h00) : h11 + (1 - u) * (h01 - h11) + (1 - v) * (h10 - h11);
  };
  surfaces.set(height, under);
  return under;
}

// The height field of `height` over region [across0, across1, distance0, distance1] — where the scene is (its
// elements, its draped planes) — with a margin: { data: Float32Array (row j of nx: distance z0 + j · step), nx, nz,
// step, x0, z0 }
export function fieldOf(height, region) {
  const a0 = region[0] - MARGIN, a1 = region[1] + MARGIN, d0 = region[2] - MARGIN, d1 = region[3] + MARGIN;
  const step = Math.max(FINEST, (a1 - a0) / (FIELD - 1), (d1 - d0) / (FIELD - 1));
  const nx = Math.max(2, Math.ceil((a1 - a0) / step) + 1), nz = Math.max(2, Math.ceil((d1 - d0) / step) + 1);
  const data = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) data[j * nx + i] = height(a0 + i * step, d0 + j * step);
  return { data, nx, nz, step, x0: a0, z0: d0 };
}
// world.relief (WT5): { height(across, distance), field, low, high, stamp } — and the thread's own beside them:
// rayHit(o, v, far)
export function reliefOf(height, field, stamp) {
  const { data, nx, nz, step } = field, a0 = field.x0, d0 = field.z0;
  let low = Infinity, high = -Infinity;
  for (let i = 0; i < data.length; i++) { if (data[i] < low) low = data[i]; if (data[i] > high) high = data[i]; }
  // the pyramid: level 0 — each cell (between four samples) its lowest and its highest — the highest the land may rise
  // there: its samples are the function's at the grid's points, between them it may rise a little higher, by a quarter
  // of the steepest step of the cell's sides (each cell its own: one cliff does not make the whole field taller) —;
  // each next level 2×2 of the one below
  const levels = [];
  let w = nx - 1, hgt = nz - 1;
  {
    const mm = new Float32Array(w * hgt * 2);
    for (let j = 0; j < hgt; j++) for (let i = 0; i < w; i++) {
      const h00 = data[j * nx + i], h10 = data[j * nx + i + 1], h01 = data[(j + 1) * nx + i], h11 = data[(j + 1) * nx + i + 1];
      const rise = Math.max(Math.abs(h10 - h00), Math.abs(h11 - h01), Math.abs(h01 - h00), Math.abs(h11 - h10));
      mm[(j * w + i) * 2] = Math.min(h00, h10, h01, h11); mm[(j * w + i) * 2 + 1] = Math.max(h00, h10, h01, h11) + 0.25 * rise;
    }
    levels.push({ w, h: hgt, mm });
  }
  while (w > 1 || hgt > 1) {
    const pw = w, ph = hgt, prev = levels[levels.length - 1].mm;
    w = Math.ceil(w / 2); hgt = Math.ceil(hgt / 2);
    const mm = new Float32Array(w * hgt * 2);
    for (let j = 0; j < hgt; j++) for (let i = 0; i < w; i++) {
      let lo = Infinity, hi = -Infinity;
      for (let dj = 0; dj < 2; dj++) for (let di = 0; di < 2; di++) {
        const x = 2 * i + di, z = 2 * j + dj;
        if (x >= pw || z >= ph) continue;
        lo = Math.min(lo, prev[(z * pw + x) * 2]); hi = Math.max(hi, prev[(z * pw + x) * 2 + 1]);
      }
      mm[(j * w + i) * 2] = lo; mm[(j * w + i) * 2 + 1] = hi;
    }
    levels.push({ w, h: hgt, mm });
  }

  // A ray's hit: where a ray (the world's: origin o, unit direction v — three numbers each) meets the land first, within `far` metres —
  // its length along it, or −1. Over the field, through the pyramid (a block the ray passes over higher than its
  // highest is skipped whole; else its quarters, nearest first, down to a cell, where the function itself is searched),
  // depth first by a stack kept from ray to ray; off the field, the function itself, marched.
  //   (the ray now, in the field's grid: x across, z distance — −world z)
  let ox = 0, oy = 0, oz = 0, vx = 0, vy = 0, vz = 0;
  const over = s => oy + vy * s - height(ox + vx * s, oz + vz * s);
  const bisect = (a, b) => { for (let k = 0; k < 30; k++) { const m = (a + b) / 2; if (over(m) > 0) a = m; else b = m; } return b; };
  // (the first hit over [from, to] by steps of the field's cell)
  const march = (from, to) => {
    const n = Math.min(4096, Math.ceil((to - from) / step) + 1);
    let a = from;
    for (let k = 1; k <= n; k++) {
      const b = from + (to - from) * k / n;
      if (over(b) <= 0) return bisect(a, b);
      a = b;
    }
    return -1;
  };
  // the stack of blocks to look at: level, i, j, the ray's stretch over it
  const STACK = 4 * levels.length + 4, sL = new Int32Array(STACK), sI = new Int32Array(STACK), sJ = new Int32Array(STACK);
  const sA = new Float64Array(STACK), sB = new Float64Array(STACK), cut = new Float64Array(4);
  const fx1 = a0 + (nx - 1) * step, fz1 = d0 + (nz - 1) * step;
  function rayHit(o, v, far) {
    ox = o[0]; oz = -o[2]; oy = o[1]; vx = v[0]; vz = -v[2]; vy = v[1];
    const here = over(0);
    if (here <= 0) return here > -1e-3 ? 0 : -1;
    // the stretch [s0, s1] of the ray over the field's box
    let s0 = 0, s1 = far, inField = true;
    if (Math.abs(vx) < 1e-12) inField = ox >= a0 && ox <= fx1;
    else { let a = (a0 - ox) / vx, b = (fx1 - ox) / vx; if (a > b) { const t = a; a = b; b = t; } s0 = Math.max(s0, a); s1 = Math.min(s1, b); }
    if (Math.abs(vz) < 1e-12) inField = inField && oz >= d0 && oz <= fz1;
    else { let a = (d0 - oz) / vz, b = (fz1 - oz) / vz; if (a > b) { const t = a; a = b; b = t; } s0 = Math.max(s0, a); s1 = Math.min(s1, b); }
    if (!inField || s0 > s1) return march(0, far);
    if (s0 > 0) { const hit = march(0, s0); if (hit >= 0) return hit; }
    let n = 0;
    sL[0] = levels.length - 1; sI[0] = 0; sJ[0] = 0; sA[0] = s0; sB[0] = s1; n = 1;
    while (n > 0) {
      n--;
      const L = sL[n], i = sI[n], j = sJ[n], ta = sA[n], tb = sB[n], lv = levels[L];
      // (the ray's lowest over [ta, tb]: at one end, as it is straight)
      if (Math.min(oy + vy * ta, oy + vy * tb) > lv.mm[(j * lv.w + i) * 2 + 1]) continue;
      if (L === 0) {
        let a = ta;
        if (over(a) <= 0) return a;
        for (let q = 1; q <= 8; q++) { const b = ta + (tb - ta) * q / 8; if (over(b) <= 0) return bisect(a, b); a = b; }
        continue;
      }
      // its quarters' stretches of the ray, by where it crosses the block's middle lines — pushed farthest first
      const size = step * 2 ** L, xm = a0 + i * size + size / 2, zm = d0 + j * size + size / 2, child = levels[L - 1];
      let nc = 0;
      cut[nc++] = ta;
      const sx = Math.abs(vx) > 1e-12 ? (xm - ox) / vx : -1, sz = Math.abs(vz) > 1e-12 ? (zm - oz) / vz : -1;
      const fx = sx > ta && sx < tb, fz = sz > ta && sz < tb;
      if (fx && fz) { cut[nc++] = Math.min(sx, sz); cut[nc++] = Math.max(sx, sz); } else if (fx) cut[nc++] = sx; else if (fz) cut[nc++] = sz;
      cut[nc++] = tb;
      for (let c = nc - 2; c >= 0; c--) {
        const sa = cut[c], sb = cut[c + 1];
        if (sb - sa < 1e-9) continue;
        const sm = (sa + sb) / 2, ci = 2 * i + (ox + vx * sm >= xm ? 1 : 0), cj = 2 * j + (oz + vz * sm >= zm ? 1 : 0);
        if (ci >= child.w || cj >= child.h) continue;
        sL[n] = L - 1; sI[n] = ci; sJ[n] = cj; sA[n] = sa; sB[n] = sb; n++;
      }
    }
    return s1 < far ? march(s1, far) : -1;
  }
  return { height, field, stamp, rayHit, low, high };
}
