// A person drawn as a figure of designed shapes (wardrobe.js: what it may be) — a model built once a look, of one
// topology, shared by everyone who looks so, and moved on the GPU: its trunk a loft of sections each turning with its
// joint, its head an egg on the head, each limb one tube along its joints laid in the vertex stage (a full thigh, a
// slim knee, as the style's profile has it; the corners rounded), a garment's top round the trunk, what hangs of it a
// mesh skinned to a few hinged strips (cloth.js) — as a sheet a garment or a part hangs is (F.cloth: an apron).
// A faceted style's faces are flat: each triangle has three vertices of its own with the triangle's normal — PP9's
// flat pair is the light of a triangle's first vertex — but what is marked smooth (a faceted head's rounded face).
// What is put on the figure — hair, a face, hats, a hood, a scarf, a garment's own pieces, the parts a world's cast
// draws — is drawn on F as it always was (the F of people.md: F.P, F.ball, F.tube, F.swing…). Drawn once, then again on
// a few other poses (the joints turned a little each way, what swings moved), each solid it draws is seen to go with
// one joint (a hat, a beard, a tuft: built once, skinned to it) — or with no one joint: then its draw runs each frame,
// cheap, giving only where each solid is now (a lamp held upright in a hand, a guitar between the hands, a bag on its
// spring, a lock of hair), each solid a row of the person's bones (rig.js), a tube's points rows too; only what is
// drawn by rings of points of its own (F.rings) is moved here point by point. A face's expressions are morphs.
// Nothing here is the GPU's: a model is numbers (figure.js makes its buffers), a person's own of it is numbers too.
//   createModel(look, {rig, warn}) → a model {look, fit, rest, height, tall, facets, paint, ink, lines, palette, rows,
//     body, hand, hung, face, part(name), partPoints(names), mark(mark, I, P, out), state(), movedOf(I, set), pose(…),
//     bones(…)}:
//     body — {skin, tubes, dyn}: what is skinned, the tubes, what is moved point by point; hand — its fingers' turns
//     at ease ({joints, q}: hand.js — the player puts them in place of the motion's), or null; hung — what hangs of the
//     garment (skinned to its controls), or null; face — {S, morphs, names} or null; part(name) — a part they come to
//     have with them ({name, part, skin, tubes, dyn}; made the first time: not in a tick — null: there is none);
//     palette — its colours ([r, g, b, tone]: 0 as drawn, 1 taking the light's shadow tone, 2 glowing, 3 in colours on
//     a silhouette), more as parts are made; rows — the rows of the bones a person of it takes;
//     state() → a person's own (I): their rows, what swings, the points their parts mark, what is moved, the face;
//     pose(I, P, where, cut, carried) — once a step: what follows more than one joint placed (its rows, its points,
//       the marks), P the pose, where[4] their own seconds since the last, cut: all as it is at once (what swings at
//       rest);
//     bones(I, P, where, fresh) — once a shown frame: the joints' rows, the tubes' chains, the cloth (cloth.js), the
//       face's expression going over. where — [x, y, z, turn, dt, floor, now]: where they stand and how they are
//       turned in what carries them, their own seconds since the frame (the step) before, the floor's height in their
//       own space, their clock; fresh — put on at rest
// What a step and a shown frame run makes nothing (5.16): a number handed to a function or back by one is made on the
// heap each time, so there the numbers stay in the arrays — the pose's, the rows', `where` — and the functions take
// arrays and whole numbers. What a draw (ours, a cast's) hands F's solids and the vectors is the draw's own.
import { J, AT, fitOf, restOf, poseOf, pose as fk, dir, skin, slot, bindLocals } from './rig.js';
import { tablesOf, bodyOf, R, FACE_ROUND, EXPRESSIONS, ARENA, listOf, spot, add, sub, mul, dot, cross, mix, unit, level, smooth, round } from './wardrobe.js';
import { Hang, strips } from './cloth.js';
import { handOf } from './hand.js';
import { TUBE_POINTS, COLOURS, MOODS } from './person.wgsl.js';
import { LATE } from '../base.js';

const PROBES = 3;       // the poses besides the first a figure's solids are drawn on, to see what each goes with
const TOL = 0.002;      // how far (of their height) a solid may stray from going with a joint and still go with it
const SPARE = 96;       // rows kept for the parts they may come to have with them (their solids' slots, their tubes' chains)
const SHIFT = 0.35;     // seconds a face takes from one expression to another
const STEPS = 8;        // a garment's sections from the hips down to its hem
const LOOSE = 0.55, LOOSE_STRAIGHT = 0.35;  // how loose a garment's hem hangs (cloth.js: 1 — the loosest, 0 — held as made)

const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16) / 255);
const rgba = v => (v.length > 3 ? v : [v[0], v[1], v[2], 1]);
// numbers as if at random, the same from the same seed (mulberry32)
const random = seed => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
};
const seedOf = s => [...s].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261);

// ── the solids, as recorded on a pose ──────────────────────────────────
// each vertex: where it is (p), what the GPU needs of it (x: six numbers — a solid's own coordinates, a bar's share
// of its far end, a tube's place along it and round it), its colour, whether lit smoothly in a faceted style; the
// triangles; each solid drawn (calls: its kind, its vertices, what places it)
class Rec {
  constructor(colour) { this.p = []; this.x = []; this.c = []; this.s = []; this.i = []; this.calls = []; this.smooth = 0; this.colour = colour; }
  get n() { return this.p.length / 3; }
  v(p, x0 = 0, x1 = 0, x2 = 0, x3 = 0, x4 = 0, x5 = 0, c = 0) { this.p.push(p[0], p[1], p[2]); this.x.push(x0, x1, x2, x3, x4, x5); this.c.push(c); this.s.push(this.smooth); }
  // rows of n vertices from base joined each to the next (round), and to an end point before the first (first: its
  // index) and after the last — each triangle turned outwards: going round the rows as a tube's sections go (from its
  // e1 to e2 = t × e1) and on along t; inward (an egg's rings from its tip, the trunk's from its bottom up) turned over.
  // The two triangles between four points begin with the same one of them, which begins no other two: the vertex a
  // tube's face takes its normal from when it is lit flat (person.wgsl.js)
  join(base, rows, n, first, last, inward = false) {
    const i = this.i, i0 = i.length;
    for (let a = 0; a + 1 < rows; a++) for (let b = 0; b < n; b++) {
      const v0 = base + a * n + b, v1 = base + a * n + (b + 1) % n;
      i.push(v0, v1, v1 + n, v0, v1 + n, v0 + n);
    }
    if (first >= 0) for (let b = 0; b < n; b++) i.push(base + (b + 1) % n, base + b, first);
    if (last >= 0) { const o = base + (rows - 1) * n; for (let b = 0; b < n; b++) i.push(o + b, o + (b + 1) % n, last); }
    if (inward) this.over(i0);
  }
  // the triangles from i0 on turned over
  over(i0) { const i = this.i; for (let f = i0; f < i.length; f += 3) { const t = i[f + 1]; i[f + 1] = i[f + 2]; i[f + 2] = t; } }
  // the triangles from i0 on (of vertices from v0) turned outwards, if most face in: away from their middle
  outwards(v0, i0) {
    const p = this.p, i = this.i;
    let cx = 0, cy = 0, cz = 0, s = 0;
    for (let v = v0; v < this.n; v++) { cx += p[v * 3]; cy += p[v * 3 + 1]; cz += p[v * 3 + 2]; }
    const n = this.n - v0; cx /= n; cy /= n; cz /= n;
    for (let f = i0; f < i.length; f += 3) {
      const a = i[f] * 3, b = i[f + 1] * 3, c = i[f + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      s += (uy * vz - uz * vy) * (p[a] - cx) + (uz * vx - ux * vz) * (p[a + 1] - cy) + (ux * vy - uy * vx) * (p[a + 2] - cz);
    }
    if (s < 0) this.over(i0);
  }
  // the colour of each vertex: one, or one a point (rings of them, then the ends')
  tint(color, r, q) { return this.colour(rgba(typeof color[0] === 'number' ? color : color[r][q])); }
}

// a section's frame across a line: e1 from the hint, e2 the line's turn of it
const across = (u, hint) => {
  let h = sub(hint, mul(u, dot(hint, u)));
  if (Math.hypot(h[0], h[1], h[2]) < 1e-3) h = Math.abs(u[1]) < 0.9 ? cross(u, [0, 1, 0]) : cross(u, [1, 0, 0]);
  const e1 = unit(h);
  return [e1, cross(u, e1)];
};
// a profile's half-width at where (eased between its points)
const thick = (profile, w) => {
  let i = 0;
  while (i + 2 < profile.length && profile[i + 1][0] < w) i++;
  const [[w0, r0], [w1, r1]] = [profile[i], profile[i + 1]], u = Math.max(0, Math.min(1, (w - w0) / (w1 - w0 || 1)));
  return r0 + (r1 - r0) * u * u * (3 - 2 * u);
};

// ── a garment's section on its level: the hull of all it hangs round ──
const hull2 = pts => {
  pts = [...pts].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cr = (o, a, c) => (a[0] - o[0]) * (c[1] - o[1]) - (a[1] - o[1]) * (c[0] - o[0]), lo = [], hi = [];
  for (const p of pts) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of pts.reverse()) { while (hi.length > 1 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
};
// where a ray from (0, 0) at angle a leaves a convex polygon round it
const reachOut = (poly, a) => {
  const dx = Math.cos(a), dy = Math.sin(a);
  let best = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length], ex = x2 - x1, ey = y2 - y1, den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = (x1 * ey - y1 * ex) / den, s = (x1 * dy - y1 * dx) / den;
    if (t > 0 && s >= -1e-9 && s <= 1 + 1e-9) best = Math.max(best, t);
  }
  return best;
};
// n points along a convex polygon round (0, 0), as far apart along it as each other, from where it crosses +x (the
// sections of a loft go round alike)
const along = (poly, n) => {
  const start = [reachOut(poly, 0), 0], pts = [start];
  let i0 = 0;
  for (let i = 0; i < poly.length; i++) {
    const [, y1] = poly[i], [, y2] = poly[(i + 1) % poly.length];
    if (y1 <= 0 && y2 > 0 || y1 < 0 && y2 >= 0) { i0 = (i + 1) % poly.length; break; }
  }
  for (let i = 0; i < poly.length; i++) pts.push(poly[(i0 + i) % poly.length]);
  pts.push(start);
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const out = [];
  for (let q = 0, i = 1; q < n; q++) {
    const at = len[len.length - 1] * q / n;
    while (len[i] < at) i++;
    const u = (at - len[i - 1]) / (len[i] - len[i - 1] || 1);
    out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u]);
  }
  return out;
};

// ── the meshes being made: what is skinned (to joints or slots), the tubes, what is moved point by point ──
class Skinned {
  // (o: the triangles of open solids — a cap that is no whole egg, a shell, rings left open at an end —: they are
  // seen from inside too, and drawn from both sides: figure.js)
  constructor() { this.p = []; this.n = []; this.i = []; this.o = []; this.j = []; this.w = []; this.c = []; this.s = []; }
  get count() { return this.p.length / 3; }
}
class Tubes {
  // (t, t2: a vertex's place along its tube and round it; r: how many faces go round the tube there)
  constructor() { this.t = []; this.t2 = []; this.i = []; this.c = []; this.s = []; this.r = []; }
  get count() { return this.c.length; }
}
// what is moved point by point: its points at rest, its triangles, its colours
const moving = () => ({ p: [], i: [], c: [], s: [] });

// The vertices a run of triangles is drawn by — the run: `count` vertices from v0, the triangles idx[i0 … i1).
// Smooth: the run's own, each lit by the triangles round it. Flat (a faceted style): each triangle three of its own,
// which take the triangle's normal — but the triangles of what is marked smooth (s: by vertex), which share theirs.
// → { from: the run's vertex each drawn one is (counted from v0), i: the triangles, of the drawn ones }
export function verticesOf(idx, i0, i1, v0, count, flat, s) {
  if (!flat) return { from: Uint32Array.from({ length: count }, (_, v) => v), i: Uint32Array.from(idx.slice(i0, i1), v => v - v0) };
  const from = [], i = [], shared = new Map();
  for (let f = i0; f < i1; f += 3) {
    const smooth = !!s[idx[f]];
    for (let e = 0; e < 3; e++) {
      const v = idx[f + e] - v0;
      let o = smooth ? shared.get(v) : undefined;
      if (o === undefined) { o = from.length; from.push(v); if (smooth) shared.set(v, o); }
      i.push(o);
    }
  }
  return { from: Uint32Array.from(from), i: Uint32Array.from(i) };
}
// the drawn vertices' normals, into n (three numbers each): the sum of the triangles' each is in, of length 1 — a
// triangle's own: the triangle's. p: where the run's vertices are (vertex v0 + v at p[(v0 + v) · 3])
export function normalsInto(p, v0, faces, n) {
  const { from, i } = faces;
  n.fill(0);
  for (let f = 0; f < i.length; f += 3) {
    const a = (v0 + from[i[f]]) * 3, b = (v0 + from[i[f + 1]]) * 3, c = (v0 + from[i[f + 2]]) * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (let e = 0; e < 3; e++) { const o = i[f + e] * 3; n[o] += nx; n[o + 1] += ny; n[o + 2] += nz; }
  }
  for (let o = 0; o < n.length; o += 3) { const l = Math.sqrt(n[o] * n[o] + n[o + 1] * n[o + 1] + n[o + 2] * n[o + 2]) || 1; n[o] /= l; n[o + 1] /= l; n[o + 2] /= l; }
  return n;
}

// the look's figure: its model
export function createModel(L, { rig, warn }) {
  const T = tablesOf(L.cast), st = T.styles[L.style], b = L.body, G = T.garments[L.garment] ?? T.garments.none, g = T.grounds[L.ground];
  const fit = fitOf(rig, bodyOf(L)), rest = restOf(rig, fit), h = fit.h, k = h * b.thick, sides = st.sides;
  // its colours (each a colour and a tone: 0 as drawn — skin —, 1 taking the light's shadow tone, 2 glowing, 3 in
  // colours on a silhouette), as the palette has them
  const palette = [], colourAt = new Map();
  const colour = c => {
    const key = c.join(',');
    let i = colourAt.get(key);
    if (i === undefined) {
      if (palette.length >= COLOURS) { warn(`more than ${COLOURS} colours: the last ones drawn as the first`); return 0; }
      colourAt.set(key, i = palette.length); palette.push(c);
    }
    return i;
  };
  const col = Object.fromEntries(Object.entries(L.colors).map(([c, v]) => [c, [...hex(v), c === 'skin' ? 0 : 1]]));

  // the poses it is drawn on: at rest (the bind), and PROBES others — each joint turned a little a random way, the
  // pelvis moved; what swings moved off where it hangs
  const bind = poseOf(), Lb = bindLocals(rig), root = Float32Array.from(rig.rest.subarray(0, 3));
  fk(rig, fit, Lb, root, bind);
  const rnd = random(seedOf(`${L.style} ${L.who}`)), probes = [bind];
  for (let p = 0; p < PROBES; p++) {
    const Lp = Lb.slice(), P = poseOf(), r2 = Float32Array.from(root, v => v + (rnd() - 0.5) * 0.2);
    for (let j = 0; j < J; j++) {
      // (a turn of 0.15…0.4 radians about a random axis, under the joint's own)
      let ax = rnd() - 0.5, ay = rnd() - 0.5, az = rnd() - 0.5;
      const l = Math.hypot(ax, ay, az) || 1, a = (0.15 + rnd() * 0.25) / 2, s = Math.sin(a) / l;
      ax *= s; ay *= s; az *= s;
      const aw = Math.cos(a), o = j * 4, x = Lp[o], y = Lp[o + 1], z = Lp[o + 2], w = Lp[o + 3];
      Lp[o] = w * ax + x * aw + y * az - z * ay; Lp[o + 1] = w * ay - x * az + y * aw + z * ax;
      Lp[o + 2] = w * az + x * ay - y * ax + z * aw; Lp[o + 3] = w * aw - x * ax - y * ay - z * az;
    }
    fk(rig, fit, Lp, r2, P);
    probes.push(P);
  }
  const off = (name, p) => { const q = random(seedOf(name) + p * 7919); return [(q() - 0.5) * 0.1 * h, (q() - 0.5) * 0.1 * h, (q() - 0.5) * 0.1 * h]; };

  // ── what the figure is drawn by: the pose (P), how (mode), into what (rec) — and, each frame, whose (I: a
  // person's own of it) ──
  const cx = { P: bind, probe: 0, mode: 'build', rec: null, part: null, call: 0, where: null, cut: true, outer: null, worn: null, sheets: null, name: '', I: null }, ringsAt = new Map();
  const jP = j => { const i = AT[j] * 3, T2 = cx.P.T, v = spot(); v[0] = T2[i]; v[1] = T2[i + 1]; v[2] = T2[i + 2]; return v; };
  const jAt = j => { const i = j * 3, T2 = cx.P.T, v = spot(); v[0] = T2[i]; v[1] = T2[i + 1]; v[2] = T2[i + 2]; return v; };
  const t3 = new Float64Array(3);
  const axis = (j, x, y, z) => {
    dir(rig, cx.P, AT[j], x, y, z, t3);
    const k = 1 / (Math.sqrt(t3[0] * t3[0] + t3[1] * t3[1] + t3[2] * t3[2]) || 1), v = spot();
    v[0] = t3[0] * k; v[1] = t3[1] * k; v[2] = t3[2] * k;
    return v;
  };
  const fwd = j => axis(j, 0, 0, 1), side = j => axis(j, 1, 0, 0), up = j => axis(j, 0, 1, 0);

  // the trunk's sections, bottom to top: each a centre, its side and front, its half-widths (the shoulders' also how
  // far down its sides fall from the neck: shoulders slope, a coat hung from them too)
  // (the pelvis holds the tops of the thighs: at the hip joints it is as wide as they are apart and as thick as a
  // thigh is, and its seat below them goes round both — the legs come out from under it, never from its sides)
  const thighR = T.legs[st.feet][0][1] * k * st.limb;
  const trunk = s => {
    const tk = k * s, hp = b.hips, sh = b.shoulders, hips = mix(jP('LeftLeg'), jP('RightLeg'), 0.5), uh = up('Hips'), { w, d } = st.trunk;
    const apart = Math.hypot(...sub(jP('LeftLeg'), jP('RightLeg'))) / 2, seat = (apart + thighR * 0.97) * s, pelvis = (apart + thighR * 1.03) * s, thick2 = thighR * 1.05 * s;
    return [
      [add(hips, mul(uh, -thighR * 0.55)), side('Hips'), fwd('Hips'), Math.max(R.hip * tk * hp * 0.9 * w[0], seat), Math.max(R.hipD * tk * 0.9 * d[0], thick2)],
      [add(hips, mul(uh, 0.02 * h)), side('Hips'), fwd('Hips'), Math.max(R.hip * tk * hp * w[1], pelvis), Math.max(R.hipD * tk * d[1], thick2)],
      [jP('Spine1'), side('Spine1'), fwd('Spine1'), R.waist * tk * (hp + sh) / 2 * w[2], R.waistD * tk * d[2]],
      [jP('Chest'), side('Chest'), fwd('Chest'), R.chest * tk * sh * w[3], R.chestD * tk * d[3]],
      [add(mix(jP('LeftArm'), jP('RightArm'), 0.5), mul(up('Chest'), 0.01 * h)), side('Chest'), fwd('Chest'), R.shoulder * tk * sh * w[4], R.shoulderD * tk * d[4],
        mul(up('Chest'), -0.2 * R.shoulder * tk * sh * w[4])],
    ];
  };
  // (a point q of n round the shoulders' section: its sides go with the shoulders, its middle with the chest)
  const shoulders = (q, n) => { const c = Math.cos(q / n * Math.PI * 2), s2 = 0.6 * smooth(0.5, 1, Math.abs(c)); return [[AT.Chest, 1 - s2], [AT[c > 0 ? 'LeftShoulder' : 'RightShoulder'], s2]]; };
  const ringOf = (sec, n, square) => {
    // (round's points — wardrobe.js — worked out here: no number handed on)
    const c = sec[0], sd = sec[1], fw = sec[2], w = sec[3], d = sec[4], fall = sec[5], out = listOf(n), e = 2 / square;
    for (let q = 0; q < n; q++) {
      const a = q / n * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a), x = w * Math.sign(cs) * Math.abs(cs) ** e, y = d * Math.sign(sn) * Math.abs(sn) ** e;
      const f = fall ? Math.abs(cs) ** (4 / square) : 0;
      const p = out[q] = spot();
      p[0] = c[0] + sd[0] * x + fw[0] * y + (fall ? fall[0] * f : 0); p[1] = c[1] + sd[1] * x + fw[1] * y + (fall ? fall[1] * f : 0); p[2] = c[2] + sd[2] * x + fw[2] * y + (fall ? fall[2] * f : 0);
    }
    return out;
  };

  // the head: its centre, its axes, its egg and size; a point of its surface where it faces d (a little out of it — on a
  // faceted head, over its rounded face)
  const hd = h * b.head * st.head, rh = R.head * hd, egg = st.egg, hsides = st.facets ? 7 : Math.max(10, sides);
  const headOut = 1.04 / Math.cos(Math.PI / hsides) ** 2, faceOut = hsides < 10 ? FACE_ROUND : 1;
  const head = { at: null, axes: [null, null, null], egg, r: rh, out: headOut, sides: hsides, square: st.headSquare,
    on: (d, o2 = 1) => {
      d = unit(d); o2 *= faceOut;
      const a = head.axes, c = head.at, x = egg[0] * rh * d[0] * o2, y = egg[1] * rh * d[1] * o2, z = egg[2] * rh * d[2] * o2, v = spot();
      for (let e = 0; e < 3; e++) v[e] = c[e] + ((a[0][e] * x + a[1][e] * y) + a[2][e] * z);
      return v;
    } };
  const headUp = 0.07 * hd, headFwd = 0.012 * hd;
  const headNow = () => {
    const hu = up('Head'), hf = fwd('Head'), a = head.axes, i = AT.Head * 3, T2 = cx.P.T, c = spot();
    for (let e = 0; e < 3; e++) c[e] = T2[i + e] + (hu[e] * headUp + hf[e] * headFwd);
    head.at = c; a[0] = side('Head'); a[1] = hu; a[2] = hf;
  };

  // ── the solids (F's): drawn — recorded — on a pose, or, each frame, placing what follows more than one joint ──
  // (a solid each frame: its call — skipped if it goes with one joint; else its slots written)
  const next = () => cx.part.calls[cx.call++];
  // (an egg, a cap, a shell each frame: its row — its axes and its middle — unless it goes with one joint)
  const placed = (c, axes) => { const K = next(); if (!K.rigid) slot(cx.I.rows, K.slots[0], axes[0], axes[1], axes[2], c); };
  const frameKind = (kind, c, axes, build, open = false) => {
    const rec = cx.rec, v0 = rec.n, i0 = rec.i.length;
    build(rec);
    rec.calls.push({ kind, v0, v1: rec.n, i0, i1: rec.i.length, frame: [axes[0], axes[1], axes[2], c], open });
  };
  // the part of a ball (an egg) round a direction (x across, y up, z forwards), as far as a cone of that cosine: rings
  // from its middle out to its edge (all of it: -1)
  // (each of F's solids: each frame it is only placed, by a function that has no function of its own inside it —
  // one that has, makes on the heap what those inside it share, each time it is called; drawn, by the one after it)
  const cap = (c, axes, radii, d0, edge, color, sides2, square = 2) => { if (cx.mode === 'frame') placed(c, axes); else capOf(c, axes, radii, d0, edge, color, sides2, square); };
  const capOf = (c, axes, radii, d0, edge, color, sides2, square) => frameKind('frame', c, axes, rec => {
    const n = unit(d0), [e1, e2] = across(n, Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1]);
    // (a squarer one: each direction's share bent towards its largest, as a superellipse's)
    const bend = d => (square === 2 ? d : unit(d.map(v => Math.sign(v) * Math.abs(v) ** (2 / square))));
    const put = (d, r, q) => {
      const e = bend(d), l = [radii[0] * e[0], radii[1] * e[1], radii[2] * e[2]];
      rec.v(add(c, add(add(mul(axes[0], l[0]), mul(axes[1], l[1])), mul(axes[2], l[2]))), l[0], l[1], l[2], 0, 0, 0, rec.tint(color, r, q));
    };
    const reach = Math.acos(Math.max(-1, Math.min(1, edge))), rows = Math.max(3, Math.round(sides2 / 2 * reach / Math.PI)), base = rec.n;
    let made = 0;
    for (let r = 1; r <= rows; r++) {
      const th = reach * r / rows;
      if (th >= Math.PI - 1e-6) break;
      for (let q = 0; q < sides2; q++) { const a = q / sides2 * Math.PI * 2; put(add(mul(n, Math.cos(th)), mul(add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a))), Math.sin(th))), made, q); }
      made++;
    }
    const first = rec.n; put(n, made, 0);
    let last = -1;
    if (edge <= -1) { last = rec.n; put(mul(n, -1), made + 1, 0); }
    rec.join(base, made, sides2, first, last, true);
  }, edge > -1);
  const ball = (c, axes, radii, color, sides2, square = 2) => { if (cx.mode === 'frame') placed(c, axes); else capOf(c, axes, radii, DOWN, -1, color, sides2, square); };
  // hair on the head: the head's egg a little out, from the crown down to an edge round it — at each way round (a: 0
  // before, ±π behind) as low as edge(a) says (the height on the head: 1 its top, -1 its bottom); below the head's
  // middle spreading out by flare
  const shell = (c, axes, radii, edge, flare, color, sides2, square = 2) => { if (cx.mode === 'frame') placed(c, axes); else shellOf(c, axes, radii, edge, flare, color, sides2, square); };
  const shellOf = (c, axes, radii, edge, flare, color, sides2, square) => frameKind('frame', c, axes, rec => {
    const bend = d => (square === 2 ? d : unit(d.map(v => Math.sign(v) * Math.abs(v) ** (2 / square))));
    const put = (d, r, q) => {
      const s = 1 + flare * Math.max(0, -d[1]), e = bend(d), l = [radii[0] * e[0] * s, radii[1] * e[1], radii[2] * e[2] * s];
      rec.v(add(c, add(add(mul(axes[0], l[0]), mul(axes[1], l[1])), mul(axes[2], l[2]))), l[0], l[1], l[2], 0, 0, 0, rec.tint(color, r, q));
    };
    const around = sides2 * 2, rows = Math.max(6, sides2 >> 1), base = rec.n;
    for (let r = 1; r <= rows; r++) for (let q = 0; q < around; q++) {
      const a = q / around * Math.PI * 2 - Math.PI, th = Math.acos(Math.max(-1, Math.min(1, edge(a)))) * r / rows;
      put([Math.sin(th) * Math.sin(a), Math.cos(th), Math.sin(th) * Math.cos(a)], r - 1, q);
    }
    const first = rec.n; put([0, 1, 0], rows, 0);
    rec.join(base, rows, around, first, -1, true);
  }, true);
  // a bar: straight from a to b, ra to rb thick, each end half an egg — two bars at a joint make its corner, as drawn;
  // its depth a share of its width (flat, across the hint), square > 2 squarer; coloured from where on along it (0 at a,
  // 1 at b)
  // (a bar each frame: its two rows — its line, its frame across the line from the hint, and the line's turn of
  // that — unless it goes with one joint)
  const bT = new Float64Array(3), bE1 = new Float64Array(3), bE2 = new Float64Array(3);
  const barNow = (a, b, hint) => {
    const K = next();
    if (K.rigid) return;
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], k = 1 / (Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6);
    bT[0] = dx * k; bT[1] = dy * k; bT[2] = dz * k;
    const d = hint[0] * bT[0] + hint[1] * bT[1] + hint[2] * bT[2];
    let x = hint[0] - bT[0] * d, y = hint[1] - bT[1] * d, z = hint[2] - bT[2] * d;
    if (Math.sqrt(x * x + y * y + z * z) < 1e-3) { const o = Math.abs(bT[1]) < 0.9 ? Y : X; x = bT[1] * o[2] - bT[2] * o[1]; y = bT[2] * o[0] - bT[0] * o[2]; z = bT[0] * o[1] - bT[1] * o[0]; }
    const l = 1 / (Math.sqrt(x * x + y * y + z * z) || 1);
    bE1[0] = x * l; bE1[1] = y * l; bE1[2] = z * l;
    bE2[0] = bT[1] * bE1[2] - bT[2] * bE1[1]; bE2[1] = bT[2] * bE1[0] - bT[0] * bE1[2]; bE2[2] = bT[0] * bE1[1] - bT[1] * bE1[0];
    slot(cx.I.rows, K.slots[0], bE1, bE2, bT, a); slot(cx.I.rows, K.slots[1], bE1, bE2, bT, b);
  };
  const bar = (a, b2, ra, rb, colors, sides2, hint, flat = 1, square = 2) => {
    if (cx.mode === 'frame') barNow(a, b2, hint); else barOf(a, b2, ra, rb, colors, sides2, hint, flat, square);
  };
  const barOf = (a, b2, ra, rb, colors, sides2, hint, flat, square) => {
    const lx = b2[0] - a[0], ly = b2[1] - a[1], lz = b2[2] - a[2], len = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1e-6, t = mul(sub(b2, a), 1 / len);
    const [e1, e2] = across(t, hint);
    const rec = cx.rec, v0 = rec.n, i0 = rec.i.length, colour2 = w => colors.reduce((c, [from, cc]) => (w >= from ? cc : c), colors[0][1]);
    let rows = 0;
    // (a ring of the bar: round c at r, its points' own coordinates from the end they go with — f, the share of b)
    const ring = (z, r, f, w) => {
      const c = add(add(a, mul(t, len * f)), mul(t, z)), ci = rec.colour(rgba(colour2(w)));
      for (let q = 0; q < sides2; q++) {
        const an = q / sides2 * Math.PI * 2, cs = Math.cos(an), sn = Math.sin(an), k2 = 2 / square;
        const x = r * Math.sign(cs) * Math.abs(cs) ** k2, y = r * flat * Math.sign(sn) * Math.abs(sn) ** k2;
        rec.v(add(c, add(mul(e1, x), mul(e2, y))), x, y, z, f, 0, 0, ci);
      }
      rows++;
    };
    const R0 = 4;
    for (let i = 1; i <= R0; i++) { const a2 = Math.PI / 2 * i / R0; ring(-ra * Math.cos(a2), ra * Math.sin(a2), 0, 0); }
    // (twice at a colour's edge)
    for (const [from] of colors) if (from > 0 && from < 1) { const r = ra + (rb - ra) * from; ring(0, r, from, from - 1e-6); ring(0, r, from, from); }
    for (let i = R0; i >= 1; i--) { const a2 = Math.PI / 2 * i / R0; ring(rb * Math.cos(a2), rb * Math.sin(a2), 1, 1); }
    const first = rec.n; rec.v(add(a, mul(t, -ra)), 0, 0, -ra, 0, 0, 0, rec.colour(rgba(colour2(0))));
    const last = rec.n; rec.v(add(b2, mul(t, rb)), 0, 0, rb, 1, 0, 0, rec.colour(rgba(colour2(1))));
    rec.join(v0, rows, sides2, first, last);
    rec.calls.push({ kind: 'bar', v0, v1: rec.n, i0, i1: rec.i.length, frames: [[e1, e2, t, a], [e1, e2, t, b2]] });
  };
  // a tube along points — straight, each corner rounded (a curve from a third of the shorter segment before it to as
  // far after) — as thick along it as its profile says ([where, half-width]…: where — a point's number, between two a
  // share of the segment; eased between), coloured from where on (an edge between two, not a blend); flat: its
  // section's depth, a share of its width (across the hint); square > 2: a squarer section; cut: its ends flat
  // (a tube each frame — one that goes with no joint: its chain's rows — where each point is now, and the hint)
  const tubeNow = (joints, hint) => {
    const K = next();
    if (K.rigid || K.jointed) return;
    const rows = cx.I.rows;
    for (let i = 0; i < K.count; i++) {
      const o = (K.chain + 1 + i) * 12, p = joints[i];
      rows[o] = p[0]; rows[o + 1] = p[1]; rows[o + 2] = p[2]; rows[o + 4] = hint[0]; rows[o + 5] = hint[1]; rows[o + 6] = hint[2];
    }
  };
  const tube = (joints, profile, colors, sides2, hint, flat = 1, square = 2, cut = false) => {
    // (a tube is along two points at least: one of fewer is not drawn — said once, as it is made)
    if (joints.length < 2) { if (cx.mode === 'build' && !cx.probe) warn(`${cx.name}: a tube along ${joints.length} point${joints.length === 1 ? '' : 's'} — two at least: not drawn`); return; }
    if (cx.mode === 'frame') tubeNow(joints, hint); else tubeOf(joints, profile, colors, sides2, hint, flat, square, cut);
  };
  const tubeOf = (joints, profile, colors, sides2, hint, flat, square, cut) => {
    const rec = cx.rec, v0 = rec.n, i0 = rec.i.length, end = joints.length - 1;
    const len = joints.slice(1).map((p, i) => Math.hypot(...sub(p, joints[i])) || 1e-6);
    const dirs = joints.slice(1).map((p, i) => mul(sub(p, joints[i]), 1 / len[i]));
    const rnd2 = joints.map((_, j) => (j === 0 || j === end ? 0 : Math.min(len[j - 1], len[j]) / 3));
    const corner = (j, u) => {
      const a = sub(joints[j], mul(dirs[j - 1], rnd2[j])), b2 = add(joints[j], mul(dirs[j], rnd2[j]));
      return add(add(mul(a, (1 - u) ** 2), mul(joints[j], 2 * (1 - u) * u)), mul(b2, u * u));
    };
    const at = w => {
      const s = Math.min(end - 1, Math.floor(w)), d = (w - s) * len[s];
      if (d < rnd2[s]) return corner(s, 0.5 + 0.5 * d / rnd2[s]);
      if (len[s] - d < rnd2[s + 1]) return corner(s + 1, 0.5 - 0.5 * (len[s] - d) / rnd2[s + 1]);
      return add(joints[s], mul(dirs[s], d));
    };
    const r = w => thick(profile, w), dr = w => (r(Math.min(end, w + 0.01)) - r(Math.max(0, w - 0.01))) / (Math.min(end, w + 0.01) - Math.max(0, w - 0.01));
    const colour2 = w => colors.reduce((c, [from, cc]) => (w >= from ? cc : c), colors[0][1]);
    // where the rings are: evenly along each segment, at the profile's points; twice at a colour's edge
    const wheres = new Set();
    for (let q = 0; q <= end * 6; q++) wheres.add(+(q / 6).toFixed(4));
    for (const [w] of profile) if (w <= end) wheres.add(w);
    let frame = null, prev = null, rows = 0;
    const ring = (w, cw) => {
      const p = at(w), t = unit(sub(at(Math.min(end, w + 0.01)), at(Math.max(0, w - 0.01))));
      // the section turns with the line (parallel transport): the tube doesn't twist
      frame = across(t, frame ? frame[0] : hint);
      const rad = r(w), ci = rec.colour(rgba(colour2(cw)));
      for (let q = 0; q < sides2; q++) {
        const a = q / sides2 * Math.PI * 2;
        rec.v(round(p, frame[0], frame[1], rad, rad * flat, a, square), w, a, rad, dr(w), 0, 0, ci);
      }
      rows++;
    };
    for (const w of [...wheres].sort((x, y) => x - y)) {
      for (const [from] of colors) if (prev !== null && prev < from && w >= from) ring(w, prev);
      ring(w, w);
      prev = w;
    }
    const t0 = unit(sub(at(0.01), at(0))), t1 = unit(sub(at(end), at(end - 0.01)));
    rec.join(v0, rows, sides2, -1, -1);
    // (its ends: each closed to a point — a vertex of it a side, at that side's angle: an end's face begins with its
    // own, which gives the face's normal when it is lit flat)
    const p0 = cut ? joints[0] : sub(joints[0], mul(t0, r(0) * 0.6)), p1 = cut ? joints[end] : add(joints[end], mul(t1, r(end)));
    const c0 = rec.colour(rgba(colour2(0))), c1 = rec.colour(rgba(colour2(end))), first = rec.n, last = first + sides2, edge = v0 + (rows - 1) * sides2;
    for (let q = 0; q < sides2; q++) rec.v(p0, 0, q / sides2 * Math.PI * 2, r(0), 0, -1, cut ? 0 : 0.6, c0);
    for (let q = 0; q < sides2; q++) rec.v(p1, end, q / sides2 * Math.PI * 2, r(end), 0, 1, cut ? 0 : 1, c1);
    for (let q = 0; q < sides2; q++) rec.i.push(first + q, v0 + (q + 1) % sides2, v0 + q, last + q, edge + q, edge + (q + 1) % sides2);
    rec.calls.push({ kind: 'tube', v0, v1: rec.n, i0, i1: rec.i.length, points: joints.map(p => [p[0], p[1], p[2]]), hint: [hint[0], hint[1], hint[2]], flat, square, sides: sides2 });
  };
  // rings of points (each the same count, round), joined in order; closed at either end by a point, if given; colour:
  // one, or one a point (rings of them, then the ends')
  const rings = (rs, color, first, last) => {
    if (cx.mode === 'frame') {
      const K = next();
      if (K.rigid) return;
      const D = movedOf(cx.I, K.dyn.set);
      let o = K.dyn.v0 * 3;
      for (let a = 0; a < rs.length; a++) { const r = rs[a]; for (let b2 = 0; b2 < r.length; b2++) o = putAt(D, o, r[b2]); }
      if (first) o = putAt(D, o, first);
      if (last) putAt(D, o, last);
      return;
    }
    ringsOf(rs, color, first, last);
  };
  const ringsOf = (rs, color, first, last) => {
    const rec = cx.rec, v0 = rec.n, i0 = rec.i.length, n = rs[0].length;
    rs.forEach((r, a) => r.forEach((q, b2) => rec.v(q, 0, 0, 0, 0, 0, 0, rec.tint(color, a, b2))));
    const f = first ? rec.n : -1;
    if (first) rec.v(first, 0, 0, 0, 0, 0, 0, rec.colour(rgba(typeof color[0] === 'number' ? color : color[rs.length][0])));
    const l = last ? rec.n : -1;
    if (last) rec.v(last, 0, 0, 0, 0, 0, 0, rec.colour(rgba(typeof color[0] === 'number' ? color : color[rs.length + 1][0])));
    // (rings of the cast's own go round either way: closed round something, their faces turned away from its middle)
    rec.join(v0, rs.length, n, f, l);
    rec.outwards(v0, i0);
    rec.calls.push({ kind: 'rings', v0, v1: rec.n, i0, i1: rec.i.length, open: !first || !last });
  };

  // a sheet hanging as cloth (an apron): rows of points across it, top down (each the same count; open, not round) —
  // the first `held` held on the trunk (going with it as a garment's top does), the rest hanging from the last of them;
  // colour: one. Taken once, as it is at rest: what is worn from the start has it (a garment, the look's parts) —
  // made with what hangs of the garment (sheetOf)
  const cloth = (rs, color, held = 1) => {
    if (cx.mode === 'frame' || cx.probe) return;
    if (!cx.sheets) { warn(`${cx.name}: F.cloth — a sheet of cloth only in what is worn from the start: not drawn`); return; }
    if (rs.length < 2 || rs[0].length < 2) { warn(`${cx.name}: F.cloth — a sheet is two rows of two points at least: not drawn`); return; }
    cx.sheets.push({ rows: rs.map(r => r.map(q => [q[0], q[1], q[2]])), color, held: Math.max(1, Math.min(rs.length - 1, held)) });
  };

  // things that swing: each a point following where it should be, a little late (as it is, when time jumps — or what
  // it hangs from does: a new pose all at once). On the poses a figure is drawn on, moved off it (what goes with it is
  // seen to)
  const swing = (name, target, stiff = 120) => {
    let q;
    if (cx.mode !== 'frame') { const o = off(name, cx.probe); q = cx.probe ? [target[0] + o[0], target[1] + o[1], target[2] + o[2]] : [target[0], target[1], target[2]]; }
    else {
      const springs = cx.I.springs;
      let s = springs.get(name);
      if (!s) springs.set(name, s = { x: new Float64Array(3), v: new Float64Array(3), out: [0, 0, 0], on: false });
      const dt = cx.where[4], x = s.x, v = s.v, ox = target[0] - x[0], oy = target[1] - x[1], oz = target[2] - x[2];
      if (!s.on || cx.cut || dt < 0 || dt > LATE || Math.sqrt(ox * ox + oy * oy + oz * oz) > 0.5 * h) {
        x[0] = target[0]; x[1] = target[1]; x[2] = target[2]; v[0] = v[1] = v[2] = 0; s.on = true;
      } else for (let i = 0, n = Math.ceil(dt * 240); i < n; i++) {
        const hh = dt / n, damp = 2 * Math.sqrt(stiff) * 0.7;
        for (let c = 0; c < 3; c++) { v[c] += ((target[c] - x[c]) * stiff - v[c] * damp) * hh; x[c] += v[c] * hh; }
      }
      q = s.out; q[0] = x[0]; q[1] = x[1]; q[2] = x[2];
    }
    // (lying, what hangs lies on the floor where it would hang through it)
    if (q[1] < 0.01 * h) q[1] = 0.01 * h;
    return q;
  };

  // (the sections of what is worn round them — the outer garment's, or the trunk's, closed at the neck — worked out once
  // a pose: each at its height up the chest, as far before it and behind it as it reaches)
  let trunkRings = null, stamp = 0;
  const facesOf = { pose: null, stamp: -1, list: [], uc: [0, 0, 0], fc: [0, 0, 0], o: [0, 0, 0] };
  const facesNow = () => {
    const Fc = facesOf;
    if (Fc.pose === cx.P && Fc.stamp === stamp) return Fc;
    Fc.pose = cx.P; Fc.stamp = stamp;
    const uc = up('Chest'), fc = fwd('Chest'), o3 = jP('Chest'), nk = sub(jP('Neck1'), o3);
    for (let c = 0; c < 3; c++) { Fc.uc[c] = uc[c]; Fc.fc[c] = fc[c]; Fc.o[c] = o3[c]; }
    const rs = cx.outer() ?? skinnedRings(trunkRings, TRUNK);
    let n = 0;
    for (let r = 0; r < rs.length; r++) {
      const ring = rs[r];
      // (how far before and behind, kept in an array as the loop goes: 5.16)
      const B = SPAN;
      B[0] = -Infinity; B[1] = Infinity;
      let mu = 0;
      for (let i = 0; i < ring.length; i++) {
        const q = ring[i];
        const dx = q[0] - o3[0], dy = q[1] - o3[1], dz = q[2] - o3[2], d = dx * fc[0] + dy * fc[1] + dz * fc[2];
        B[0] = Math.max(B[0], d); B[1] = Math.min(B[1], d); mu += dx * uc[0] + dy * uc[1] + dz * uc[2];
      }
      const e = Fc.list[n++] ??= [0, 0, 0];
      e[0] = mu / ring.length; e[1] = B[0]; e[2] = B[1];
    }
    const e = Fc.list[n++] ??= [0, 0, 0], ku = nk[0] * uc[0] + nk[1] * uc[1] + nk[2] * uc[2], kf = nk[0] * fc[0] + nk[1] * fc[1] + nk[2] * fc[2];
    e[0] = ku; e[1] = kf; e[2] = kf;
    Fc.list.length = n;
    // (up the chest: sorted where they are — few, nearly in order)
    const L2 = Fc.list;
    for (let i = 1; i < n; i++) { const e2 = L2[i]; let j = i - 1; while (j >= 0 && L2[j][0] - e2[0] > 0) { L2[j + 1] = L2[j]; j--; } L2[j + 1] = e2; }
    return Fc;
  };
  // what hangs over what is worn — long straight hair, a ponytail, a scarf's end — kept out of it: a point behind its
  // back (s = -1) or before it (s = 1), r further, while it is beside it (bent over, they hang free)
  const clear = (p, s, r) => {
    const { list: faces, uc, fc, o } = facesNow(), vx = p[0] - o[0], vy = p[1] - o[1], vz = p[2] - o[2], u = vx * uc[0] + vy * uc[1] + vz * uc[2];
    let i = 1;
    while (i < faces.length && faces[i][0] < u) i++;
    if (u < faces[0][0] || i >= faces.length) return p;
    const w = (u - faces[i - 1][0]) / (faces[i][0] - faces[i - 1][0] || 1), e = s > 0 ? 1 : 2, a = faces[i - 1][e];
    const gap = s * ((vx * fc[0] + vy * fc[1] + vz * fc[2]) - (a + (faces[i][e] - a) * w));
    if (!(gap < r)) return p;
    const k = s * (r - gap), q = spot();
    q[0] = p[0] + fc[0] * k; q[1] = p[1] + fc[1] * k; q[2] = p[2] + fc[2] * k;
    return q;
  };

  // what a draw keeps from one frame to the next (its sizes, its lists — what it would make anew each frame): made once a
  // figure, by its maker (make(F)), the same after
  const kept = new Map();
  const keep = make => { let K = kept.get(make); if (K === undefined) kept.set(make, K = make(F)); return K; };

  // the points the parts mark where they draw them (F.point — a person's '#name' points like the others): each its part's,
  // going with a joint (b: where it is on the bind) or, going with none, drawn each frame (a person's own: where it is
  // now), in their own space — by part, then by name (two parts may mark the same name — a watch open, a watch shut:
  // the point is the one's they have now)
  const marks = new Map();
  const nowOf = (I, m) => { let now = I.marks.get(m); if (!now) I.marks.set(m, now = Float64Array.from(m.b)); return now; };
  const point = (name, at) => {
    if (cx.mode === 'build') { (cx.rec.marks ??= {})[name] = [at[0], at[1], at[2]]; return; }
    const m = marks.get(cx.part.name)?.get(name);
    if (m && m.j < 0) { const now = nowOf(cx.I, m); now[0] = at[0]; now[1] = at[1]; now[2] = at[2]; }
  };
  // (a mark — partPoints' — where it is now on pose P, into out: their own space)
  const mark = (m, I, P, out) => {
    if (m.j < 0) { const now = nowOf(I, m); out[0] = now[0]; out[1] = now[1]; out[2] = now[2]; return true; }
    // (one that goes with a joint: its place in the joint's own frame — m.l — as the joint has it on P)
    const R1 = P.R, T1 = P.T, r = m.j * 9, t = m.j * 3, l = m.l;
    out[0] = T1[t] + R1[r] * l[0] + R1[r + 1] * l[1] + R1[r + 2] * l[2]; out[1] = T1[t + 1] + R1[r + 3] * l[0] + R1[r + 4] * l[1] + R1[r + 5] * l[2]; out[2] = T1[t + 2] + R1[r + 6] * l[0] + R1[r + 7] * l[1] + R1[r + 8] * l[2];
    return true;
  };
  // (what is moved point by point, a person's own: where its points are now — at rest till it is drawn —, whether
  // it was moved since it was last taken)
  const movedOf = (I, set) => {
    let D = I.moved.get(set);
    if (!D) I.moved.set(set, D = { p: Float32Array.from(set.p), moved: true });
    return D;
  };

  // F: what draws on the figure — ours and a world's cast's alike
  const F = {
    look: L, style: st, colors: col, fit, k, sides, head, P: jP, fwd, side, up, trunk, ringOf, clear, swing, keep,
    get worn() { return cx.worn?.() ?? null; },
    ball, cap, tube, bar, shell, rings, cloth, point,
  };

  // ── drawn on the poses: what each solid goes with ──────────────────
  // a part drawn (draw(F)) on every pose; which joint each solid goes with (rigid), a tube's each point (jointed), or
  // none (its slots, its points moved here); null if it drew differently on another pose (a solid more, a side less)
  // (x on the bind as joint j takes it to pose P1, into out)
  const relTo = (j, x, y, z, P1, out) => {
    const R0 = bind.R, T0 = bind.T, R1 = P1.R, T1 = P1.T, r = j * 9, t = j * 3;
    const dx = x - T0[t], dy = y - T0[t + 1], dz = z - T0[t + 2];
    const lx = R0[r] * dx + R0[r + 3] * dy + R0[r + 6] * dz, ly = R0[r + 1] * dx + R0[r + 4] * dy + R0[r + 7] * dz, lz = R0[r + 2] * dx + R0[r + 5] * dy + R0[r + 8] * dz;
    out[0] = T1[t] + R1[r] * lx + R1[r + 1] * ly + R1[r + 2] * lz; out[1] = T1[t + 1] + R1[r + 3] * lx + R1[r + 4] * ly + R1[r + 5] * lz; out[2] = T1[t + 2] + R1[r + 6] * lx + R1[r + 7] * ly + R1[r + 8] * lz;
    return out;
  };
  // (a point on the bind — p's at o — in joint j's own frame at rest: what a frame takes it from, the joint's turn and
  // place now over it — relTo's first half, worked out once)
  const restIn = (j, p, o = 0) => {
    const R0 = bind.R, T0 = bind.T, r = j * 9, t = j * 3, dx = p[o] - T0[t], dy = p[o + 1] - T0[t + 1], dz = p[o + 2] - T0[t + 2];
    return [R0[r] * dx + R0[r + 3] * dy + R0[r + 6] * dz, R0[r + 1] * dx + R0[r + 4] * dy + R0[r + 7] * dz, R0[r + 2] * dx + R0[r + 5] * dy + R0[r + 8] * dz];
  };
  const q3 = [0, 0, 0];
  // the joint a set of points goes with on every pose (points(p): their places on pose p, as flat [x, y, z, …]), or -1
  const goesWith = points => {
    const p0 = points(0), n = p0.length / 3, step = Math.max(1, Math.floor(n / 12));
    let best = -1, err = Infinity;
    for (let j = 0; j < J; j++) {
      let e = 0;
      for (let p = 1; p <= PROBES && e < err; p++) {
        const pp = points(p);
        for (let v = 0; v < n && e < err; v += step) {
          const q = relTo(j, p0[v * 3], p0[v * 3 + 1], p0[v * 3 + 2], probes[p], q3);
          e = Math.max(e, Math.hypot(q[0] - pp[v * 3], q[1] - pp[v * 3 + 1], q[2] - pp[v * 3 + 2]));
        }
      }
      if (e < err) { err = e; best = j; }
    }
    return err < TOL * h ? best : -1;
  };
  const drawn = (draw, name, expression = null) => {
    const recs = [], was = L.expression;
    for (let p = 0; p <= PROBES; p++) {
      cx.P = probes[p]; cx.probe = p; cx.mode = 'build'; cx.rec = new Rec(colour); cx.name = name;
      if (expression) L.expression = expression;
      headNow();
      draw(F);
      recs.push(cx.rec);
    }
    L.expression = was;
    cx.P = bind; cx.probe = 0;
    const [r0] = recs, same = recs.every(r => r.n === r0.n && r.calls.length === r0.calls.length && r.calls.every((c, i) => c.kind === r0.calls[i].kind && c.v1 - c.v0 === r0.calls[i].v1 - r0.calls[i].v0));
    if (!same) { warn(`${name}: it draws differently as the figure moves (a solid more or less) — drawn as it is at rest, each solid with its nearest joint`); }
    const calls = r0.calls.map((c, i) => {
      const pts = p => (same ? recs[p] : r0).p.slice(c.v0 * 3, c.v1 * 3);
      const j = same ? goesWith(pts) : nearest(r0.p.slice(c.v0 * 3, c.v1 * 3));
      const K = { ...c, rigid: j >= 0, joint: j };
      if (j < 0 && c.kind === 'tube') {
        // (a tube whose every point goes with a joint is laid along those joints' frames each frame, on the GPU)
        const each = c.points.map((_, q) => goesWith(p => Float32Array.from(recs[p].calls[i].points[q])));
        if (each.every(e => e >= 0)) { K.jointed = true; K.joints = each; }
      }
      return K;
    });
    // (its marks: each with the joint it goes with on every pose, else drawn each frame — and the part with it)
    let loose = false;
    for (const n of Object.keys(r0.marks ?? {})) {
      const j = recs.every(r => r.marks?.[n]) ? goesWith(p => Float32Array.from(recs[p].marks[n])) : -1;
      (marks.get(name) ?? marks.set(name, new Map()).get(name)).set(n, { j, b: Float64Array.from(r0.marks[n]), l: j < 0 ? null : Float64Array.from(restIn(j, r0.marks[n])) });
      loose ||= j < 0;
    }
    return { rec: r0, calls, frame: loose || calls.some(c => !c.rigid && !c.jointed) };
  };
  // (drawn differently on other poses: each solid with the joint nearest its middle)
  const nearest = p => {
    let x = 0, y = 0, z = 0;
    const n = p.length / 3;
    for (let v = 0; v < n; v++) { x += p[v * 3]; y += p[v * 3 + 1]; z += p[v * 3 + 2]; }
    x /= n; y /= n; z /= n;
    let best = 0, d = Infinity;
    for (let j = 0; j < J; j++) { const e = Math.hypot(bind.T[j * 3] - x, bind.T[j * 3 + 1] - y, bind.T[j * 3 + 2] - z); if (e < d) { d = e; best = j; } }
    return best;
  };

  // ── the figure's own: the trunk, the head, the limbs ──────────────────
  // (sleeves to the wrist — a dress's short —, the hand bare — a robe's sleeves widening down the forearm —; trousers
  // to the ankle — under a dress, the legs bare —, shoes below; knee socks from a little below the knee; a foot without
  // its shoe: the stocking's, else bare)
  const sleeve = (G.sleeves === 'garment' ? col.garment : col.top).map((v, i) => (i < 3 ? v * (st.sleeves ?? 1) : v));
  const legsCol = G.bare ? col.skin : col.bottom;
  const lk = k * st.limb, arm = T.arms[st.arms].map(([w, r]) => [w, r * lk * (G.wide && w > 1 && w <= 2 ? 1 + (w - 1) * G.wide : 1)]);
  const leg = T.legs[st.feet].map(([w, r]) => [w, r * lk]);
  const socks = L.socks ? [[1.15, col.socks]] : [];
  const shod = s => (L.barefoot === 'both' || L.barefoot === s.toLowerCase() ? (L.socks ? col.socks : col.skin) : col.shoes);
  // (what the figure's own solids are drawn with, made once: each is drawn again each frame where it follows more than
  // one joint — a rigid style's bars — and nothing new is made for it then)
  const eggR = egg.map(e => e * rh), faceR = egg.map(e => e * rh * FACE_ROUND), FRONT = [0, 0.05, 1];
  const neckPts = [null, null], neckProfile = [[0, R.neck * k * 1.3], [0.5, R.neck * k], [1, R.neck * k * 0.95]], skinCols = [[0, col.skin]];
  const ra = w => arm.find(([x]) => x === w)[1], rl = w => leg.find(([x]) => x === w)[1];
  const footWay = (foot, p, ankle) => {
    const I = rig.inverse, k = AT[foot] * 12, vx = p[0] - ankle[0], vy = p[1] - ankle[1], vz = p[2] - ankle[2];
    return [I[k] * vx + I[k + 1] * vy + I[k + 2] * vz, I[k + 4] * vx + I[k + 5] * vy + I[k + 6] * vz, I[k + 8] * vx + I[k + 9] * vy + I[k + 10] * vz];
  };
  const members = ['Left', 'Right'].map(s => {
    const n = j => `${s}${j}`, rt = j => rig.rest.subarray(AT[n(j)] * 3, AT[n(j)] * 3 + 3), sw = st.rigid ? rl(3) : 0;
    return { Arm: n('Arm'), ForeArm: n('ForeArm'), Hand: n('Hand'), Middle1: n('HandMiddle1'), Leg: n('Leg'), Shin: n('Shin'), Foot: n('Foot'), ToeBase: n('ToeBase'), ToeEnd: n('ToeEnd'),
      upper: [[0, sleeve]], fore: [[0, sleeve], ...(G.short ? [[0.15, col.skin]] : [])], thigh: [[0, legsCol]], shin: [[0, legsCol], ...socks.map(([w, c]) => [w - 1, c])],
      shoe: [[0, shod(s)]], arm: [[0, sleeve], [G.short ? 1.15 : 2, col.skin]], leg: [[0, legsCol], ...socks, [2, shod(s)]], axes: [null, null, null],
      // (the points its tubes go through, each frame the same lists; a finger's thickness)
      armPts: [null, null, null, null], legPts: [null, null, null, null],
      // (a shoe's heel and toe at rest, as far up and in as its thickness — each its way from the ankle, as the foot's
      // joint has a way of the T-pose: rig.js's dir, its first half)
      heel: footWay(n('Foot'), [rt('Foot')[0], sw * 0.78 / h, rt('Foot')[2] - 0.05 + sw / h], rt('Foot')), toe: footWay(n('Foot'), [rt('ToeEnd')[0], sw * 0.78 / h, rt('ToeEnd')[2] + 0.01 - sw / h], rt('Foot')) };
  });
  // the hands (hand.js): with fingers — a palm of its own and the fingers on it, at ease; a mitten — the same palm, the
  // four fingers one piece and the thumb another; as big as the skeleton has them, as broad as the figure is slight or
  // stout. Either goes with the hand's joint (the fingers' tubes with theirs); the arm goes into the palm past the
  // wrist (the bare arm's width there, whatever a sleeve does), tapering. Each one's points, the same lists each frame;
  // the fingers' turns at ease, both hands' (a mitten's are all on the hand's joint: none)
  const handed = st.fingers ? 'fingers' : st.mitten ? 'mitten' : null, wristR = thick(T.arms[st.arms], 2) * lk;
  const armIn = handed ? [...arm.filter(([w]) => w <= 2), [2.5, wristR * 0.85], [3, wristR * 0.7]] : arm;
  if (handed) for (let m = 0; m < members.length; m++) {
    const Lm = members[m], H = Lm.hand = handOf(rig, bind, m ? 'Right' : 'Left', { sigma: Math.min(1.2, Math.max(0.8, Math.sqrt(b.thick * st.limb))), wrist: wristR });
    Lm.handPts = H.fingers.map(f => f.joints.map(() => null));
    Lm.solids = (handed === 'mitten' ? [H.mitten.body, H.mitten.thumb] : [H.palm]).map(S => ({ S, pts: S.rings.map(r => r.map(() => null)) }));
  }
  const handPose = handed === 'fingers' ? { joints: Int32Array.from(members.flatMap(Lm => [...Lm.hand.pose.joints])), q: Float32Array.from(members.flatMap(Lm => [...Lm.hand.pose.q])) } : null;
  // (a point in a joint's own frame, l — the hand's palm —, where the joint has it now)
  const onJoint = (j, l) => {
    const R1 = cx.P.R, T1 = cx.P.T, r = j * 9, t = j * 3, v = spot();
    for (let e = 0; e < 3; e++) v[e] = T1[t + e] + (R1[r + e * 3] * l[0] + R1[r + e * 3 + 1] * l[1] + R1[r + e * 3 + 2] * l[2]);
    return v;
  };
  // a hand's solids: its palm (a mitten's two pieces) with the hand's joint — worked out only to be drawn: each
  // frame they are where the joint has them, skinned —; its fingers along their joints, each tip most of the way along
  // its last bone
  const handSolids = (Lm, now) => {
    const H = Lm.hand, j = AT[Lm.Hand];
    for (let s2 = 0; s2 < Lm.solids.length; s2++) {
      if (now && cx.part.calls[cx.call].rigid) { cx.call++; continue; }
      const { S, pts } = Lm.solids[s2];
      for (let r = 0; r < pts.length; r++) for (let i = 0; i < pts[r].length; i++) pts[r][i] = onJoint(j, S.rings[r][i]);
      rings(pts, col.skin, onJoint(j, S.first), onJoint(j, S.last));
    }
    if (handed === 'fingers') for (let q = 0; q < H.fingers.length; q++) {
      const f = H.fingers[q], js = f.joints, pts = Lm.handPts[q], n = js.length - 1;
      for (let i = 0; i < n; i++) pts[i] = jAt(js[i]);
      pts[n] = mix(pts[n - 1], jAt(js[n]), f.tip);
      if (now) tubeNow(pts, side(Lm.Hand)); else tube(pts, f.profile, skinCols, 8, side(Lm.Hand));
    }
  };
  const r0 = st.rigid ? [ra(0), ra(1), ra(2), ra(3), rl(0), rl(1), rl(2), rl(3)] : null, hand3 = st.rigid ? [r0[3], r0[3], r0[3] * 0.85] : null;
  // (a point of the foot at rest — the shoe's: its way from the ankle, w — where the foot has it now)
  const shoe = (Lm, w) => {
    const j = AT[Lm.Foot], R1 = cx.P.R, T1 = cx.P.T, r = j * 9, v = spot();
    for (let e = 0; e < 3; e++) v[e] = T1[j * 3 + e] + (R1[r + e * 3] * w[0] + R1[r + e * 3 + 1] * w[1] + R1[r + e * 3 + 2] * w[2]) * h;
    return v;
  };
  // (each solid of it drawn — or, each frame (now), only placed where it follows more than one joint: no number
  // of its sizes handed on then)
  const figure = () => {
    const now = cx.mode === 'frame';
    // the head (a faceted head's face rounded: its front a finer cap over the facets — the face reads, the head stays
    // cut), the neck
    if (now) placed(head.at, head.axes); else ball(head.at, head.axes, eggR, col.skin, hsides, st.headSquare);
    if (hsides < 10) {
      if (now) placed(head.at, head.axes);
      else { cx.rec.smooth = 1; cap(head.at, head.axes, faceR, FRONT, 0.35, col.skin, 18, st.headSquare); cx.rec.smooth = 0; }
    }
    neckPts[0] = jP('Neck1'); neckPts[1] = jP('Head');
    if (now) tubeNow(neckPts, head.axes[2]); else tube(neckPts, neckProfile, skinCols, Math.max(6, sides - 4), head.axes[2]);
    if (st.rigid) for (let m = 0; m < members.length; m++) {
      const Lm = members[m];
      // each bone a bar: the upper arm, the forearm (a dress's sleeve short; narrower at the wrist into a hand of its
      // own), a round hand (or one of its own: handSolids); the thigh, the shin, a shoe —
      // rigid on the foot, a rounded block from the heel to the toes
      // (the upper arm from within the shoulder: its round end level with the shoulder's line, not a ball on it)
      const la = jP('LeftArm'), rA = jP('RightArm'), arm0 = jP(Lm.Arm), hint = fwd('Chest'), uc = up('Chest'), shoulder = spot();
      const wx = la[0] - rA[0], wy = la[1] - rA[1], wz = la[2] - rA[2], inward = r0[0] * 0.6 / (Math.sqrt(wx * wx + wy * wy + wz * wz) / 2), down = -r0[0] * 0.9;
      for (let e = 0; e < 3; e++) shoulder[e] = arm0[e] + (((la[e] + (rA[e] - la[e]) * 0.5) - arm0[e]) * inward + uc[e] * down);
      const elbow = jP(Lm.ForeArm), wrist = jP(Lm.Hand), ax = Lm.axes;
      if (now) { barNow(shoulder, elbow, hint); barNow(elbow, wrist, hint); }
      else { bar(shoulder, elbow, r0[0], r0[1], Lm.upper, sides, hint, 0.9); bar(elbow, wrist, r0[1], handed ? r0[2] * 0.72 : r0[2], Lm.fore, sides, hint, 0.9); }
      ax[0] = side(Lm.Hand); ax[1] = up(Lm.Hand); ax[2] = fwd(Lm.Hand);
      const palm = mix(jP(Lm.Hand), jP(Lm.Middle1), 0.45), hip = jP(Lm.Leg), knee = jP(Lm.Shin), ankle = jP(Lm.Foot), front = fwd('Hips');
      if (handed) handSolids(Lm, now); else if (now) placed(palm, ax); else ball(palm, ax, hand3, col.skin, sides);
      if (now) { barNow(hip, knee, front); barNow(knee, ankle, fwd('Hips')); barNow(shoe(Lm, Lm.heel), shoe(Lm, Lm.toe), side(Lm.Foot)); }
      else {
        bar(hip, knee, r0[4], r0[5], Lm.thigh, sides, front);
        bar(knee, ankle, r0[5], r0[6], Lm.shin, sides, fwd('Hips'));
        bar(shoe(Lm, Lm.heel), shoe(Lm, Lm.toe), r0[7], r0[7], Lm.shoe, sides, side(Lm.Foot), 0.78);
      }
    }
    else for (let m = 0; m < members.length; m++) {
      const Lm = members[m];
      // (the hand's end along the palm: into a hand of its own, half way to the knuckles — the palm takes it in; with
      // none, its profile's hand to as far again as the knuckles)
      const hand = jP(Lm.Hand), tip = add(hand, mul(sub(jP(Lm.Middle1), hand), handed ? 0.5 : 1.9)), ap = Lm.armPts, lp = Lm.legPts;
      ap[0] = jP(Lm.Arm); ap[1] = jP(Lm.ForeArm); ap[2] = hand; ap[3] = tip;
      if (now) tubeNow(ap, fwd('Chest')); else tube(ap, armIn, Lm.arm, sides, fwd('Chest'), st.arms === 'mitten' || st.arms === 'leaf' ? 0.8 : 1);
      if (handed) handSolids(Lm, now);
      lp[0] = jP(Lm.Leg); lp[1] = jP(Lm.Shin); lp[2] = jP(Lm.Foot); lp[3] = mix(jP(Lm.ToeBase), jP(Lm.ToeEnd), 0.5);
      if (now) tubeNow(lp, fwd('Hips')); else tube(lp, leg, Lm.leg, sides, fwd('Hips'));
    }
  };

  // ── what is made ──────────────────────────────────────────────────────
  // the rows of the bones a person of it takes: the joints' (0 … J − 1), one that turns nothing (J: what is moved
  // point by point is skinned to it), then, as they are made, a row a slot of what follows no one joint, a row a
  // control of the cloth, a tube's chain — a row of how it is made and a row a point
  const base = new Skinned(), tubes = new Tubes(), dyn = moving(), chains = [];
  let rows = J + 1;
  // a recorded run (its vertices v0 … v1, its triangles i0 … i1) as it is drawn — a faceted style's faces flat — and
  // its normals at rest
  const flat = !!st.facets;
  const drawnOf = (rec, v0, v1, i0, i1) => { const faces = verticesOf(rec.i, i0, i1, v0, v1 - v0, flat, rec.s); return { faces, n: normalsInto(rec.p, v0, faces, new Float32Array(faces.from.length * 3)) }; };
  // a recorded mesh, all of it, into a skinned one, at rest: each vertex with the rows it goes with (rowsOf(v) →
  // [[row, weight]…], four at most)
  const skinInto = (S, rec, rowsOf) => {
    const { faces, n } = drawnOf(rec, 0, rec.n, 0, rec.i.length), v0 = S.count;
    for (let o = 0; o < faces.from.length; o++) {
      const v = faces.from[o], ws = rowsOf(v);
      S.p.push(rec.p[v * 3], rec.p[v * 3 + 1], rec.p[v * 3 + 2]); S.n.push(n[o * 3], n[o * 3 + 1], n[o * 3 + 2]);
      for (let q = 0; q < 4; q++) { S.j.push(ws[q]?.[0] ?? 0); S.w.push(ws[q]?.[1] ?? 0); }
      S.c.push(rec.c[v]); S.s.push(rec.s[v]);
    }
    for (let f = 0; f < faces.i.length; f++) S.i.push(faces.i[f] + v0);
  };
  // a part drawn into the meshes: each solid as it goes (a joint's — at rest, skinned to it; its own slots — in its own
  // coordinates; a tube along joints or free points; its points moved here)
  const put = (part, into) => {
    const { rec, calls } = part, S = into.skin, Tb = into.tubes, D = into.dyn;
    for (const K of calls) {
      // (drawn elsewhere: a face's solids in its morphs, or what of it follows more than its head)
      if (K.skip) continue;
      if (K.kind === 'tube' && !K.rigid) {
        // (its chain: a point that goes with a joint is laid by the bones each frame — from its place and hint in that
        // joint's frame; one that goes with none is written as its part is drawn again)
        const count = Math.min(K.points.length, TUBE_POINTS);
        if (K.points.length > TUBE_POINTS) warn(`a tube of ${K.points.length} points — ${TUBE_POINTS} at most: drawn along its first ${TUBE_POINTS}`);
        K.count = count; K.chain = rows; rows += 1 + count;
        const pts = !K.jointed ? null : K.points.slice(0, count).map((p, q) => {
          const j = K.joints[q], r = j * 9, t = j * 3, R0 = bind.R, T0 = bind.T, dx = p[0] - T0[t], dy = p[1] - T0[t + 1], dz = p[2] - T0[t + 2];
          const hx = K.hint[0], hy = K.hint[1], hz = K.hint[2];
          return { j, p: [R0[r] * dx + R0[r + 3] * dy + R0[r + 6] * dz, R0[r + 1] * dx + R0[r + 4] * dy + R0[r + 7] * dz, R0[r + 2] * dx + R0[r + 5] * dy + R0[r + 8] * dz],
            h: [R0[r] * hx + R0[r + 3] * hy + R0[r + 6] * hz, R0[r + 1] * hx + R0[r + 4] * hy + R0[r + 7] * hz, R0[r + 2] * hx + R0[r + 5] * hy + R0[r + 8] * hz] };
        });
        chains.push({ row: K.chain, count, flat: K.flat, square: K.square, pts });
        const base2 = Tb.count;
        for (let v = K.v0; v < K.v1; v++) {
          Tb.t.push(K.chain, Math.min(rec.x[v * 6], count - 1), rec.x[v * 6 + 1], rec.x[v * 6 + 2]); Tb.t2.push(rec.x[v * 6 + 3], rec.x[v * 6 + 4], rec.x[v * 6 + 5]);
          Tb.c.push(rec.c[v]); Tb.s.push(rec.s[v]); Tb.r.push(K.sides);
        }
        for (let f = K.i0; f < K.i1; f++) Tb.i.push(rec.i[f] - K.v0 + base2);
        continue;
      }
      if (K.kind === 'rings' && !K.rigid) {
        const v0 = D.p.length / 3;
        for (let v = K.v0; v < K.v1; v++) { D.p.push(rec.p[v * 3], rec.p[v * 3 + 1], rec.p[v * 3 + 2]); D.c.push(rec.c[v]); D.s.push(rec.s[v]); }
        for (let f = K.i0; f < K.i1; f++) D.i.push(rec.i[f] - K.v0 + v0);
        K.dyn = { set: D, v0 };
        continue;
      }
      // (skinned: to its joint, at rest; or to its slots, in its own coordinates — its normals from where it is at rest,
      // turned into them)
      const { faces, n } = drawnOf(rec, K.v0, K.v1, K.i0, K.i1), v0 = S.count;
      if (!K.rigid) K.slots = K.kind === 'bar' ? [rows++, rows++] : [rows++];
      for (let d = 0; d < faces.from.length; d++) {
        const v = K.v0 + faces.from[d], o = d * 3;
        if (K.rigid) {
          S.p.push(rec.p[v * 3], rec.p[v * 3 + 1], rec.p[v * 3 + 2]); S.n.push(n[o], n[o + 1], n[o + 2]);
          S.j.push(K.joint, 0, 0, 0); S.w.push(1, 0, 0, 0);
        } else {
          // (its own coordinates; its normal in them — an egg's frame its axes: the transpose turns a normal into them)
          const fr = K.kind === 'bar' ? K.frames[0] : K.frame;
          S.p.push(rec.x[v * 6], rec.x[v * 6 + 1], rec.x[v * 6 + 2]);
          S.n.push(dot(fr[0], [n[o], n[o + 1], n[o + 2]]), dot(fr[1], [n[o], n[o + 1], n[o + 2]]), dot(fr[2], [n[o], n[o + 1], n[o + 2]]));
          if (K.kind === 'bar') { const f = rec.x[v * 6 + 3]; S.j.push(K.slots[0], K.slots[1], 0, 0); S.w.push(1 - f, f, 0, 0); }
          else { S.j.push(K.slots[0], 0, 0, 0); S.w.push(1, 0, 0, 0); }
        }
        S.c.push(rec.c[v]); S.s.push(rec.s[v]);
      }
      const into2 = K.open ? S.o : S.i;
      for (let f = 0; f < faces.i.length; f++) into2.push(faces.i[f] + v0);
    }
  };

  // the trunk: its sections from the hips to the shoulders, each turning with its joint (the belt between the pelvis
  // and the waist, half each; the shoulders' sides with the shoulders), closed below and at the neck
  // (trousers up to the waist — the seat and the hips theirs — a belt between, the top above it: the colours meet at
  // the belt's section, twice, in an edge)
  {
    headNow();
    const tr = trunk(1), n = Math.max(12, sides * 2), belt = [mix(tr[1][0], tr[2][0], 0.5), tr[2][1], tr[2][2], (tr[1][3] + tr[2][3]) / 2, (tr[1][4] + tr[2][4]) / 2];
    const lower = G.bodice ? col.garment : legsCol, upper = G.bodice ? col.garment : col.top;
    const sections = [tr[0], tr[1], belt, belt, ...tr.slice(2)], shades = [lower, lower, lower, upper, upper, upper, upper];
    const J1 = [[AT.Hips, 1]], J2 = [[AT.Hips, 0.5], [AT.Spine1, 0.5]], bones = [J1, J1, J2, J2, [[AT.Spine1, 1]], [[AT.Chest, 1]], null];
    const rec = new Rec(colour), v0 = 0;
    const w8 = [];
    sections.forEach((sec, r) => ringOf(sec, n, st.square).forEach((p, q) => {
      rec.v(p, 0, 0, 0, 0, 0, 0, colour(rgba(shades[r])));
      // (the shoulders: their sides go with the shoulders, the middle with the chest)
      if (bones[r]) w8.push(bones[r]);
      else w8.push(shoulders(q, n));
    }));
    const first = rec.n; rec.v(add(tr[0][0], mul(up('Hips'), -thighR * 0.4)), 0, 0, 0, 0, 0, 0, colour(rgba(lower))); w8.push(J1);
    const last = rec.n; rec.v(jP('Neck1'), 0, 0, 0, 0, 0, 0, colour(rgba(upper))); w8.push([[AT.Chest, 1]]);
    rec.join(v0, sections.length, n, first, last, true);
    skinInto(base, rec, v => w8[v]);
    trunkRings = tr.map(sec => ringOf(sec, 16, st.square));
  }

  // ── the garment: round the trunk, then hanging (cloth) ───────────────
  // (the legs' half-width at their widest between two joints — 0 the hip, 1 the knee… — with what is over them)
  const widest = (a, c) => Math.max(...leg.filter(([w]) => w >= a && w <= c).map(([, r]) => r)) + 0.02 * h;
  const garment = garmentOf();
  function garmentOf() {
    const layers = G.hang ?? [];
    if (!layers.length) return null;
    headNow();
    const hips = mix(jP('LeftLeg'), jP('RightLeg'), 0.5), lift = 0.02 * h;
    const thigh = Math.hypot(...sub(jP('LeftShin'), jP('LeftLeg'))), shin = Math.hypot(...sub(jP('LeftFoot'), jP('LeftShin')));
    const legs = ['Left', 'Right'].flatMap(s => [[jP(`${s}Leg`), jP(`${s}Shin`), widest(0, 1)], [jP(`${s}Shin`), jP(`${s}Foot`), widest(1, 2)],
      [jP(`${s}Foot`), jP(`${s}ToeEnd`), widest(2, 3)]].map(([a, c, r]) => [a, c, r, r]));
    const inner = [], made = [];
    let outer = null, worn = null;
    for (const [li, hang] of layers.entries()) {
      const color = col[hang.color ?? 'garment'], around = trunk(hang.off ?? 1.12), n2 = hang.pleats ? hang.pleats * 4 : st.facets ? 16 : 40;
      const length = hang.to <= 1 ? hang.to * thigh : thigh + (hang.to - 1) * shin;
      const [, sd0, fw0, w0, d0] = around[1], sd = level(sd0), fw = level(fw0);
      // (from the top of the thighs down; below the waist by as much as the cloth needs to go out over the hips in a
      // curve, not a step — straight lines need none)
      const top = Math.min(hips[1] + widest(0, 1), around[2][0][1] - (st.straight ? 0.02 : 0.1) * h), cloth = top - hips[1] + length;
      // what of the legs a section round c at height y holds — and down to the next: the cloth between two goes
      // straight, it must pass outside what is there — each piece of a leg cut at that height, its ends' circles
      const legsAt = (c, floor) => {
        const pts = [];
        for (const [a, c2, ra, rb] of legs) {
          if (a[1] + ra < floor && c2[1] + rb < floor) continue;
          const cut = (p, q, rp, rq) => { const u = Math.max(0, Math.min(1, (floor - rp - p[1]) / (q[1] - p[1] || 1e-6))); return [mix(p, q, u), rp + (rq - rp) * u]; };
          const ends = a[1] + ra >= floor && c2[1] + rb >= floor ? [[a, ra], [c2, rb]] : a[1] + ra >= floor ? [[a, ra], cut(a, c2, ra, rb)] : [cut(c2, a, rb, ra), [c2, rb]];
          for (const [p, r2] of ends) {
            const v = sub(p, c), x = dot(v, sd), z = dot(v, fw);
            for (let q = 0; q < 8; q++) { const a2 = q / 8 * Math.PI * 2; pts.push([x + r2 * Math.cos(a2), z + r2 * Math.sin(a2)]); }
          }
        }
        return pts;
      };
      // a section's outline: n points round (0, 0) as far each way as its half-widths say (across +, −, forwards +, −)
      const oval = ([xp, xn, zp, zn], n3, square) => Array.from({ length: n3 }, (_, q) => {
        const a = q / n3 * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a), e = 2 / square;
        return [(cs < 0 ? xn : xp) * Math.sign(cs) * Math.abs(cs) ** e, (sn < 0 ? zn : zp) * Math.sign(sn) * Math.abs(sn) ** e];
      });
      // its sections' half-widths: the hips' (wider towards the hem); or, straight, on lines from its top section's to the
      // hem's — the hem as far each way as it must be round the legs hanging through it: a coat a trapezoid
      const first = hang.from === 'shoulders' ? around[4] : around[2], hemY = Math.max(lift, top - cloth), g1 = 1 + hang.flare;
      const hem = st.straight ? [...oval([w0 * g1, w0 * g1, d0 * g1, d0 * g1], 24, 2), ...legsAt([hips[0], hemY, hips[2]], hemY - cloth / STEPS - 0.01)] : [];
      const reachTo = [Math.max(...hem.map(p => p[0])), -Math.min(...hem.map(p => p[0])), Math.max(...hem.map(p => p[1])), -Math.min(...hem.map(p => p[1]))];
      const widths = (y, f) => {
        if (!st.straight) { const s = 1 + hang.flare * f; return [w0 * s, w0 * s, d0 * s, d0 * s]; }
        const u = Math.max(0, Math.min(1, (first[0][1] - y) / (first[0][1] - hemY || 1)));
        return reachTo.map((e, j) => first[j < 2 ? 3 : 4] + (e - first[j < 2 ? 3 : 4]) * u);
      };
      // top down: from the shoulders, their section and the chest's — cloth hung from the shoulders falls from the chest,
      // it doesn't go in at the waist; from the waist, none: it begins with its level section there
      const tops = (hang.from === 'shoulders' ? around.slice(3) : []).reverse();
      const ringsTop = tops.map(s => (st.straight
        ? oval(widths(s[0][1]), n2, st.square).map(([x, z]) => add(s[0], add(add(mul(s[1], x), mul(s[2], z)), s[5] ? mul(s[5], (x / s[3]) ** 2) : [0, 0, 0])))
        : ringOf(s, n2, st.square)));
      const girth = [mix(around[1][0], around[2][0], 0.5), around[2][1], around[2][2], (around[1][3] + around[2][3]) / 2, (around[1][4] + around[2][4]) / 2];
      const held = [...around.slice(0, 2), girth, around[2]].flatMap(s2 => ringOf(s2, 16, st.square)), fall = ringsTop.flat();
      const waistY = Math.max(top + 0.02 * h, around[2][0][1]), over = st.straight ? 1 : 3, hipY = q => top + (waistY - top) * q / over;
      const below = [], outlines = [];
      for (let r = -over; r <= STEPS; r++) {
        const f = Math.max(0, r) / STEPS, y = r < 0 ? hipY(-r) : Math.max(lift, top - cloth * f), c = [hips[0], y, hips[2]];
        const floor = r < 0 ? (st.straight ? top + 0.005 : hipY(-r - 1) - 0.01) : y - cloth / STEPS - 0.01;
        // (the waist's sections, unless straight, round the body there only — a dress keeps its waist)
        const pts = [...(r < 0 && !st.straight ? [] : [...oval(widths(y, f), 24, st.straight ? st.square : 2), ...legsAt(c, floor)]), ...[...held, ...fall].filter(p => p[1] >= floor).map(p => { const v = sub(p, c); return [dot(v, sd) * 1.03, dot(v, fw) * 1.03]; })];
        // (round the inner layers there, a little off them)
        for (const o of inner) {
          const j = o.findIndex(([y2], q) => q > 0 && y2 <= y);
          if (j < 0 || o[0][0] < y) continue;
          const u = (o[j - 1][0] - y) / (o[j - 1][0] - o[j][0] || 1);
          o[j][1].forEach(([x, z], q) => pts.push([(o[j - 1][1][q][0] + (x - o[j - 1][1][q][0]) * u) * 1.03, (o[j - 1][1][q][1] + (z - o[j - 1][1][q][1]) * u) * 1.03]));
        }
        // folds: the section waved round, the more the lower; a ragged hem: its tatters hanging lower, here and there;
        // pleats: knife pleats, the more the lower
        const fold = st.folds && hang.folds !== false && !hang.pleats ? st.folds : null, tatter = st.ragged && hang.ragged && r === STEPS;
        const hull = hull2(pts), o = hull.every((p, q) => { const p2 = hull[(q + 1) % hull.length]; return p[0] * p2[1] - p[1] * p2[0] >= 0; })
          ? [0, 0] : [0, 1].map(e => hull.reduce((sum, p) => sum + p[e], 0) / hull.length);
        const outline = along(hull.map(([x, z]) => [x - o[0], z - o[1]]), n2).map(([x, z]) => [x + o[0], z + o[1]]).map(([x, z], q) => {
          const g2 = (fold ? 1 + fold.depth * f ** 1.5 * Math.sin(q / n2 * Math.PI * 2 * fold.n + 0.7) : 1) * (hang.pleats ? 1 + 0.06 * f * (q % 4 * 2 / 3 - 1) : 1);
          return [x * g2, z * g2];
        });
        outlines.push([y, outline]);
        below.push(outline.map(([x, z], q) => {
          const drop = tatter ? st.ragged * length * (0.5 + 0.5 * Math.sin(q * 2.399) * Math.sin(q * 0.73 + 1.3)) : 0;
          return add(c, add(add(mul(sd, x), mul(fw, z)), [0, -Math.min(drop, Math.max(0, y - lift)), 0]));
        }));
      }
      inner.push(outlines);
      outer = [...ringsTop, ...below];
      if (hang.from === 'shoulders') worn = [...ringsTop, below[0]];
      made.push({ li, hang, color, n2, ringsTop, below, over, neck: hang.from === 'shoulders' ? jP('Neck1') : null,
        hips, sd, fw, cloth, firstY: first[0][1], hemY });
    }
    return { made, outer, worn };
  }

  // the garment's top (round the trunk) goes with the trunk's joints as the trunk's sections do — the shoulders' sides
  // with the shoulders, the chest with the chest, below it by its height between the spine's joints — and its hanging
  // part is cloth: each section's points particles, the first as the top leaves it (pinned), the lower the looser
  const spine = ['Hips', 'Spine1', 'Spine2', 'Chest'].map(n => AT[n]);
  const byHeight = y => {
    const ys = spine.map(j => bind.T[j * 3 + 1]);
    if (y <= ys[0]) return [[spine[0], 1]];
    if (y >= ys[3]) return [[spine[3], 1]];
    let i = 0;
    while (y > ys[i + 1]) i++;
    const u = (y - ys[i]) / (ys[i + 1] - ys[i]);
    return [[spine[i], 1 - u], [spine[i + 1], u]];
  };

  // ── the parts drawn on F ─────────────────────────────────────────────
  // what the look puts on it: the figure's own (the head, the limbs), its garment's own (a collar, a panel), its hair
  // (none under a hood), its face (its expressions: morph targets), a hat (none over a hood), a hood, a scarf, the
  // parts it has; the parts they come to have with them (with), each made when they first do
  // (the trunk's sections go with the hips, the hips, the waist, the chest, the shoulders; a garment's top as it is
  // skinned, what hangs below it with the hips)
  const TRUNK = (ri, q, n) => (ri === 4 ? shoulders(q, n) : [[[AT.Hips, AT.Hips, AT.Spine1, AT.Chest][ri], 1]]);
  const TOP = (ri, q, n, p) => { const t = garment.made[garment.made.length - 1].ringsTop.length; return ri < t ? (ri === t - 1 ? [[AT.Chest, 1]] : shoulders(q, n)) : byHeight(p[1]); };
  cx.worn = () => garment?.worn ? skinnedRings(garment.worn, TOP) : null;
  cx.outer = () => (garment ? skinnedRings(garment.outer, TOP) : null);
  const looks = [['figure', figure], ...(G.draw ? [['garment', G.draw]] : []), ...(!L.hood && T.hair[L.hair]?.draw ? [['hair', T.hair[L.hair].draw]] : []),
    ...(!L.hood && T.hats[L.hat]?.draw ? [['hat', T.hats[L.hat].draw]] : []),
    ...[...(L.hood ? ['hood'] : []), ...(L.scarf ? ['scarf'] : []), ...L.parts].filter(n => T.parts[n]?.draw).map(n => [n, T.parts[n].draw])];
  const faceDraw = T.faces[L.face]?.draw;
  const into = { skin: base, tubes, dyn };
  // (drawn on the poses: what each solid goes with — and the sheets they hang, F.cloth, taken as they are at rest)
  cx.sheets = [];
  const parts = looks.map(([name, draw]) => ({ name, draw, ...drawn(draw, name) })), sheets = cx.sheets;
  cx.sheets = null;
  // (a point of a sheet at rest, out before the garment's cloth there: its sections' points as high and as far aside as
  // it is, their front)
  const before = q => {
    const { sd, fw, hips } = garment.made[0], at = (x, z) => (x - hips[0]) * fw[0] + (z - hips[2]) * fw[2];
    let front = -Infinity;
    for (const M of garment.made) for (const ring of M.below) for (const o of ring) {
      if (Math.abs(o[1] - q[1]) > 0.04 * h || Math.abs((o[0] - q[0]) * sd[0] + (o[2] - q[2]) * sd[2]) > 0.03 * h) continue;
      front = Math.max(front, at(o[0], o[2]));
    }
    const need = front + 0.012 * h - at(q[0], q[2]);
    if (need > 0) { q[0] += fw[0] * need; q[2] += fw[2] * need; }
  };
  if (garment) for (const S of sheets) for (const r of S.rows.slice(S.held)) for (const q of r) before(q);
  // (how far a sheet hangs: down its middle, from the last row held)
  const hanging = ({ rows: rs, held }) => { const q = rs[0].length >> 1; let d = 0; for (let r = held; r < rs.length; r++) d += Math.hypot(...sub(rs[r][q], rs[r - 1][q])); return d; };

  // (how each hanging layer's controls are sampled — the garment's layers, then the sheets: a person's total fits —
  // cloth.js)
  const hangs = [], layers = garment ? garment.made : [], loose = st.straight ? LOOSE_STRAIGHT : LOOSE, legRadii = [widest(0, 1), widest(1, 2), widest(2, 3)];
  // (the middle between the hip joints at rest: what a sheet hangs round — a garment's layer has its own, its side and
  // forward with it)
  const hipsRest = mix(jP('LeftLeg'), jP('RightLeg'), 0.5);
  const sampled = strips([...layers.map(M => ({ length: M.cloth, size: h, sections: M.below.length - M.over, open: false })),
    ...sheets.map(S => ({ length: hanging(S), size: h, sections: S.rows.length - S.held + 1, open: true }))]);
  // (the four rows a point of what hangs is skinned to and how much to each — cloth.js's — as rowsOf gives them)
  const to = new Float64Array(8), controls = (strip, r, q) => { strip.weights(r, q, to); return [[to[0], to[1]], [to[2], to[3]], [to[4], to[5]], [to[6], to[7]]]; };
  const HIPS = [[AT.Hips, 1]];
  let hung = null;
  for (const [mi, M] of layers.entries()) {
    const { hang, color, n2, ringsTop, below, over } = M, pleats = !!hang.pleats;
    // (pleats' edges sharp: each point twice, a face of its own on either side — the faces folding back in, in the
    // fold's shade)
    const shade = color.map((v, i) => (i < 3 ? v * 0.78 : v)), tintOf = j => (pleats ? ((j >> 1) % 4 === (j % 2 ? 3 : 0) ? shade : color) : color);
    const double = ring => (pleats ? ring.flatMap(p => [p, p]) : ring), m = pleats ? n2 * 2 : n2;
    // the top: the rings round the trunk, down to where it hangs from (r = 0, shared with the cloth)
    const topRings = [...ringsTop, ...below.slice(0, over + 1)].map(double);
    const rec = new Rec(colour);
    topRings.forEach(ring => ring.forEach((p, j) => rec.v(p, 0, 0, 0, 0, 0, 0, colour(rgba(tintOf(j))))));
    let first = -1;
    if (M.neck) { first = rec.n; rec.v(M.neck, 0, 0, 0, 0, 0, 0, colour(rgba(color))); }
    rec.join(0, topRings.length, m, first, -1);
    // (from the shoulders: the shoulders' ring, the chest's; then the waist down to where it hangs from, the hips')
    skinInto(base, rec, v => {
      const ring = Math.floor(v / m), tops = ringsTop.length;
      return v === first ? [[AT.Chest, 1]] : ring >= topRings.length - 1 ? HIPS : ring < tops ? (ring === tops - 1 ? [[AT.Chest, 1]] : shoulders((v % m) >> (pleats ? 1 : 0), n2)) : byHeight(rec.p[v * 3 + 1]);
    });
    // what hangs: its sections' points one mesh, drawn from both sides — each point skinned to the four controls of
    // the layer round it (cloth.js), at its top section to the hips, as the top above it is. A layer too short to swing
    // has no controls: all of it goes with the hips
    const hangRings = below.slice(over), sections = hangRings.length, { around, down } = sampled[mi];
    const strip = down ? new Hang({ rings: hangRings, around, down, open: false, loose, row: rows, legs: legRadii, hips: M.hips, sd: M.sd, fw: M.fw, cut: { straight: !!st.straight, firstY: M.firstY, hemY: M.hemY } }) : null;
    if (strip) { rows += strip.count; hangs.push(strip); }
    const sheet = new Rec(colour);
    hangRings.forEach(ring => double(ring).forEach((p, j) => sheet.v(p, 0, 0, 0, 0, 0, 0, colour(rgba(tintOf(j))))));
    sheet.join(0, sections, m, -1, -1);
    sheet.outwards(0, 0);
    skinInto(hung ??= new Skinned(), sheet, v => (strip ? controls(strip, Math.floor(v / m), (v % m) >> (pleats ? 1 : 0)) : HIPS));
  }
  // a sheet (F.cloth): one mesh, drawn from both sides. Its held rows go with the trunk by their height — the last of
  // them with the hips, as what hangs from it does; the rows from that one down are a layer of cloth.js's strips, open
  // (chains across it, not round): each point skinned to the four controls round it. One too short to swing has no
  // controls: what hangs of it goes with the hips
  for (const [si, { rows: rs, color, held }] of sheets.entries()) {
    const n = rs[0].length, top = held - 1, c = colour(rgba(color)), { around, down } = sampled[layers.length + si];
    const strip = down ? new Hang({ rings: rs.slice(top), around, down, open: true, loose, row: rows, legs: legRadii, hips: hipsRest, sd: X, fw: Z }) : null;
    if (strip) { rows += strip.count; hangs.push(strip); }
    const sheet = new Rec(colour);
    for (const r of rs) for (const q of r) sheet.v(q, 0, 0, 0, 0, 0, 0, c);
    for (let r = 0; r + 1 < rs.length; r++) for (let q = 0; q + 1 < n; q++) { const a = r * n + q; sheet.i.push(a, a + 1, a + n + 1, a, a + n + 1, a + n); }
    skinInto(hung ??= new Skinned(), sheet, v => { const r = Math.floor(v / n); return r < top ? byHeight(sheet.p[v * 3 + 1]) : strip ? controls(strip, r - top, v % n) : HIPS; });
  }

  // (the look's parts into the meshes)
  for (const p of parts) put(p, into);
  // the face: drawn on each expression — the same solids each time: what of it goes with one joint, each expression's
  // morph (going over from one to another on the GPU); what follows more (a lock, a swinging earring), drawn
  // each frame as the expression now has it. Drawn differently from one expression to another (a solid more): as it is
  let face = null;
  if (faceDraw) {
    const names = Object.keys(EXPRESSIONS).slice(0, MOODS + 1), at = names.map(e => drawn(faceDraw, 'face', e)), [n0] = at;
    const alike = at.every(d => d.rec.n === n0.rec.n && d.calls.length === n0.calls.length && d.calls.every((c, i) => c.kind === n0.calls[i].kind && c.v1 - c.v0 === n0.calls[i].v1 - n0.calls[i].v0));
    if (alike) {
      // (the solids that go with one joint on the face at rest: on each expression the same, with that joint)
      const fixed = (d, keepRigid) => ({ ...d, name: 'face', calls: d.calls.map((c, i) => (n0.calls[i].rigid ? { ...c, rigid: true, joint: n0.calls[i].joint, skip: !keepRigid } : { ...c, skip: keepRigid })) });
      const S = new Skinned();
      put(fixed(n0, true), { skin: S, tubes: null, dyn: null });
      const morphs = at.map(d => {
        const S2 = new Skinned();
        put(fixed(d, true), { skin: S2, tubes: null, dyn: null });
        return { p: Float32Array.from(S2.p, (v, i) => v - S.p[i]), n: Float32Array.from(S2.n, (v, i) => v - S.n[i]) };
      });
      face = { S, morphs, names };
      if (n0.calls.some(c => !c.rigid)) { const p = { draw: faceDraw, ...fixed(n0, false), frame: true }; put(p, into); parts.push(p); }
    } else {
      warn(`face "${L.face}": its expressions draw differently (a solid more or less) — it shows none`);
      const p = { name: 'face', draw: faceDraw, ...drawn(faceDraw, 'face') };
      put(p, into); parts.push(p);
    }
  }

  // (how a list of rings is skinned, made once: each point's joints — how many (n), then for each (ws) the joint, its
  // weight, and the point in that joint's own frame at rest)
  function skinOf(list, weights) {
    const n = [], ws = [];
    list.forEach((r, ri) => r.forEach((p, q) => { const w = weights(ri, q, r.length, p); n.push(w.length); for (const [j, k] of w) ws.push(j, k, ...restIn(j, p)); }));
    const R2 = { out: list.map(r => r.map(() => [0, 0, 0])), n: Int32Array.from(n), ws: Float64Array.from(ws) };
    ringsAt.set(list, R2);
    return R2;
  }
  // (the rings of a garment where the body takes them now — what is worn round the chest, what hair keeps clear of)
  function skinnedRings(list, weights) {
    const R2 = ringsAt.get(list) ?? skinOf(list, weights);
    const out = R2.out, n = R2.n, ws = R2.ws, R1 = cx.P.R, T1 = cx.P.T;
    for (let ri = 0, at = 0, i = 0; ri < out.length; ri++) {
      const ring = out[ri];
      for (let q = 0; q < ring.length; q++, at++) {
        let x = 0, y = 0, z = 0;
        for (const end = i + n[at] * 5; i < end; i += 5) {
          const r = ws[i] * 9, t = ws[i] * 3, k = ws[i + 1], lx = ws[i + 2], ly = ws[i + 3], lz = ws[i + 4];
          x += (T1[t] + R1[r] * lx + R1[r + 1] * ly + R1[r + 2] * lz) * k; y += (T1[t + 1] + R1[r + 3] * lx + R1[r + 4] * ly + R1[r + 5] * lz) * k; z += (T1[t + 2] + R1[r + 6] * lx + R1[r + 7] * ly + R1[r + 8] * lz) * k;
        }
        const o = ring[q];
        o[0] = x; o[1] = y; o[2] = z;
      }
    }
    return out;
  }

  // ── the parts they come to have with them (with): each made the first time it is asked for — its own meshes, its
  // rows among those kept for parts; null: there is none (said) ──
  const most = rows + SPARE, withs = new Map();
  const part = name => {
    if (looks.some(([n]) => n === name)) return null;
    if (withs.has(name)) return withs.get(name);
    const draw = T.parts[name]?.draw;
    let W = null;
    if (!draw) warn(`"with": "${name}" — no such part in its cast`);
    else {
      const was = rows, chained = chains.length, made = { name, draw, ...drawn(draw, name) }, into = { skin: new Skinned(), tubes: new Tubes(), dyn: moving() };
      put(made, into);
      if (rows > most) { warn(`"with": "${name}" — more than the rows kept for parts: not drawn`); rows = was; chains.length = chained; marks.delete(name); }
      else W = { name, part: made, ...into };
    }
    withs.set(name, W);
    return W;
  };

  // the points of the parts they have with them: a part's `points` ({name: {joint, off, rise}}) and what it marks where
  // it draws it (F.point: {mark} — mark(mark, I, P, out))
  const partPoints = names => {
    const out = {};
    for (const n of names) {
      Object.assign(out, T.parts[n]?.points);
      for (const [m, M] of marks.get(n) ?? []) out[m] = { mark: M };
    }
    return out;
  };

  // ── a person's own of it ─────────────────────────────────────────────
  const state = () => {
    const own = new Float32Array(most * 12), n = face ? face.names.length : 0;
    slot(own, J, X, Y, Z, ZERO);
    const I = { rows: own, hips: own.subarray(AT.Hips * 12, AT.Hips * 12 + 12), springs: new Map(), marks: new Map(), moved: new Map(), sways: hangs.map(H => H.sway()), expression: null,
      face: face && { now: new Float32Array(n), from: new Float32Array(n), to: new Float32Array(n), since: 0, aim: 0 } };
    if (face) I.face.now[0] = I.face.from[0] = I.face.to[0] = 1;
    return I;
  };

  // ── each step: what follows more than one joint, placed — the parts drawn again (only where each solid is): the
  // figure's own and those they have with them now (carried: part(name)'s) ──
  const pose = (I, P, where, cut, carried) => {
    cx.P = P; cx.I = I; cx.mode = 'frame'; cx.where = where; cx.cut = cut; stamp++;
    const was = L.expression;
    L.expression = I.expression;
    ARENA.on = true; ARENA.i = 0; ARENA.l = 0;
    try {
      for (let i = 0; i < parts.length; i++) { const p = parts[i]; if (p.frame) { cx.part = p; cx.call = 0; headNow(); p.draw(F); } }
      for (let i = 0; i < carried.length; i++) { const p = carried[i].part; if (p.frame) { cx.part = p; cx.call = 0; headNow(); p.draw(F); } }
    } finally { ARENA.on = false; cx.I = null; cx.where = null; cx.P = bind; cx.mode = 'build'; L.expression = was; }
  };

  // ── each shown frame: the joints' rows; the tubes' chains — how each is made, and the points that go with joints
  // where those have them now; the cloth's controls; the face going over to its expression in SHIFT seconds ──
  const bones = (I, P, where, fresh) => {
    const own = I.rows, R2 = P.R, T2 = P.T, now = where[6];
    skin(rig, P, rest, own);
    for (let c = 0; c < chains.length; c++) {
      const C = chains[c], o = C.row * 12;
      own[o] = C.count; own[o + 1] = C.flat; own[o + 2] = C.square;
      if (!C.pts) continue;
      for (let i = 0; i < C.count; i++) {
        const q = C.pts[i], r = q.j * 9, t = q.j * 3, a = o + (1 + i) * 12, p = q.p, hn = q.h;
        own[a] = T2[t] + R2[r] * p[0] + R2[r + 1] * p[1] + R2[r + 2] * p[2];
        own[a + 1] = T2[t + 1] + R2[r + 3] * p[0] + R2[r + 4] * p[1] + R2[r + 5] * p[2];
        own[a + 2] = T2[t + 2] + R2[r + 6] * p[0] + R2[r + 7] * p[1] + R2[r + 8] * p[2];
        own[a + 4] = R2[r] * hn[0] + R2[r + 1] * hn[1] + R2[r + 2] * hn[2];
        own[a + 5] = R2[r + 3] * hn[0] + R2[r + 4] * hn[1] + R2[r + 5] * hn[2];
        own[a + 6] = R2[r + 6] * hn[0] + R2[r + 7] * hn[1] + R2[r + 8] * hn[2];
      }
    }
    for (let i = 0; i < hangs.length; i++) hangs[i].step(I.sways[i], I.hips, T2, where, fresh, own);
    if (face) {
      const Fc = I.face, want = I.expression && EXPRESSIONS[I.expression] ? Math.max(0, face.names.indexOf(I.expression)) : 0;
      if (want !== Fc.aim) { Fc.from.set(Fc.now); Fc.to.fill(0); Fc.to[want] = 1; Fc.since = now; Fc.aim = want; }
      // (fresh: its expression as it is, at once)
      const gone = Math.max(0, Math.min(1, (now - Fc.since) / SHIFT)), u = fresh ? 1 : gone * gone * (3 - 2 * gone);
      for (let i = 0; i < Fc.now.length; i++) Fc.now[i] = Fc.from[i] + (Fc.to[i] - Fc.from[i]) * u;
      if (fresh) Fc.from.set(Fc.to);
    }
  };

  // (lines: round the figure, where its colours meet, where one part is well before another — tinted: a darker shade
  // of what they edge; none for a silhouette)
  const lineWidth = L.line && L.paint !== 'silhouette' && L.paint !== 'rim' ? st.line : 0;
  return { look: L, fit, rest, height: 1.76 * (b.height ?? 1), tall: h, facets: !!st.facets, paint: L.paint, ink: hex(g.ink), lines: { width: lineWidth, tint: !!st.tinted },
    palette, get rows() { return most; }, body: { skin: base, tubes, dyn }, hand: handPose, hung, face, part, partPoints, mark, state, movedOf, pose, bones };
}

const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1], ZERO = [0, 0, 0], DOWN = [0, -1, 0];
// (facesNow's: how far a section reaches before and behind)
const SPAN = new Float64Array(2);
// (what is moved point by point — D: a person's own of it — has q for its point at o, and is moved only where a
// number written is another than the one there: a figure standing still is not drawn anew → the next point's place)
function putAt(D, o, q) {
  const p = D.p;
  for (let c = 0; c < 3; c++, o++) { const was = p[o]; p[o] = q[c]; if (p[o] !== was) D.moved = true; }
  return o;
}
