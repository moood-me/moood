// A hand of its own (a style's `fingers` or `mitten`: shapes.js), shaped as a hand is, at ease — the hand of one who
// holds nothing: a palm from a wrist narrower than it, widening to the knuckles; the knuckles in an arc (the middle
// finger's furthest out, the index and the ring a little back, the little finger's lower); the fingers on them side by
// side, touching, as wide at their roots together as the palm, thick at the root and tapering to round tips, gently
// curled, the middle finger the longest, the index and the ring a little shorter, the little finger shortest (its tip
// at the ring finger's last joint); the thumb big, from the heel of the palm on the index finger's side, set apart from
// it. A mitten is the same hand drawn more simply: the four fingers held together as one piece of the shape they make.
// Its proportions are a hand's (a man's: 0.19 m long, its palm as long as its middle finger, half as wide as long), its
// size the skeleton's (SOMA's palm on these bones: a child's hand as small as their body has it), its breadth the
// figure's (a slight one's narrower). It is drawn whole, at ease, on the hand's joint: the fingers do not move (the
// motions never move them) — all of it skinned to that joint, nothing of it worked out a frame, whatever the fingers'
// joints do.
//   handOf(rig, P, side, {sigma, wrist}) → {fingers: [solid…], mitten: [solid…]}: each solid {rings, first, last} —
//     rings of points round it, the wrist's end first, and the points that close it at either end, in the hand joint's
//     own frame (rig.js: where a joint's turn and place take it). P — the bind's pose (its joints' places and turns, on
//     these bones); side — 'Left' | 'Right'; sigma — how broad the hand is against a man's (1); wrist — the arm's
//     half-width at the wrist (metres): the palm takes the arm in there, as wide, and widens from it — a hand's heel.
import { AT } from './rig.js';

const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];
// a man's hand, in shares of its length (0.19 m) — the knuckles: how far from the wrist (along the palm), each finger's
// share of the palm's width there, how long it is from its knuckle (its three bones: 0.45, 0.30, 0.25 of it), its curl
// at its three joints (degrees, toward the palm), its way aside (degrees, toward the thumb: the fingers' tips come a
// little together)
const HAND = 0.19, PALM_SOMA = 0.089;
const KNUCKLE = { Index: 0.455, Middle: 0.47, Ring: 0.455, Pinky: 0.42 };
const SHARE = { Index: 0.26, Middle: 0.27, Ring: 0.25, Pinky: 0.22 };
const LONG = { Index: 0.42, Middle: 0.46, Ring: 0.43, Pinky: 0.34 };
const CURL = { Index: [12, 20, 10], Middle: [14, 22, 11], Ring: [16, 24, 12], Pinky: [18, 26, 12] };
const ASIDE = { Index: -2, Middle: 0, Ring: 2, Pinky: 5 };
const BONES = [0.45, 0.3, 0.25];
const PALM_W = 0.45;      // the palm's width at the knuckles
const DEEP = [0.1, 0.075, 0.058];  // its half-thickness: at the wrist, its middle, the knuckles
// the thumb: its root (along the palm, out to the side of it: a share of the palm's half-width there, toward the palm),
// its bones' ways (aside toward the index finger's side, toward the palm: degrees) and lengths, its half-width along it
const THUMB = { root: [0.14, 0.62, 0.05], ways: [[44, 30], [30, 38], [20, 46]], long: [0.2, 0.15, 0.13], r: [0.08, 0.058, 0.05, 0.044] };
const ROUND = 10;         // points round a finger, the thumb
const RAD = Math.PI / 180;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const unit = a => mul(a, 1 / (len(a) || 1));
const between = (u, v, k) => add(u, mul(sub(v, u), k));
const smooth = (e0, e1, v) => { const u = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return u * u * (3 - 2 * u); };
// (a point a share of a line's length along it — before its start and past its end, on along its first and last way —
// and its way there)
const along = (pts, k) => {
  const ls = pts.slice(1).map((q, i) => len(sub(q, pts[i]))), total = ls.reduce((x, y) => x + y, 0);
  if (k <= 0) { const w = unit(sub(pts[1], pts[0])); return { at: add(pts[0], mul(w, k * total)), way: w }; }
  let left = k * total, i = 0;
  while (i < ls.length - 1 && left > ls[i]) left -= ls[i++];
  const w = unit(sub(pts[i + 1], pts[i]));
  return { at: add(pts[i], mul(w, left)), way: w };
};

export function handOf(rig, P, side, { sigma, wrist }) {
  const T = P.T, at = n => { const j = AT[`${side}${n}`] * 3; return [T[j], T[j + 1], T[j + 2]]; };
  // the hand's frame on the bind: along it (the wrist to SOMA's knuckles), across it (toward the index finger's side),
  // out of it on the palm's side (where SOMA's thumb is)
  const W = at('Hand'), K = FINGERS.map(f => at(`Hand${f}2`)), m = mul(K.reduce(add), 1 / K.length), a = unit(sub(m, W));
  const x0 = sub(K[0], K[3]), e = unit(sub(x0, mul(a, dot(a, x0)))), n = cross(a, e);
  const p = dot(sub(at('HandThumbEnd'), W), n) < 0 ? mul(n, -1) : n;
  const L = HAND * dot(sub(m, W), a) / PALM_SOMA, B = L * sigma;   // its length; its breadth's measure
  const hj = AT[`${side}Hand`] * 9, R = P.R, local = v => {
    const d = sub(v, W);
    return [R[hj] * d[0] + R[hj + 3] * d[1] + R[hj + 6] * d[2], R[hj + 1] * d[0] + R[hj + 4] * d[1] + R[hj + 7] * d[2], R[hj + 2] * d[0] + R[hj + 5] * d[1] + R[hj + 8] * d[2]];
  };
  const pt = (u, v, w) => add(W, add(add(mul(a, u), mul(e, v)), mul(p, w)));
  const way = (aside, curl) => unit(add(add(mul(a, Math.cos(aside * RAD) * Math.cos(curl * RAD)), mul(e, Math.sin(aside * RAD) * Math.cos(curl * RAD))), mul(p, Math.sin(curl * RAD))));

  // the knuckles side by side across the palm's width, each finger as wide as its share of it; each finger's line from
  // its knuckle along its bones, curled at each joint
  const palmW = PALM_W * B, half = FINGERS.map(f => SHARE[f] * palmW / 2);
  let edge = palmW / 2;
  const lines = FINGERS.map((f, i) => {
    const c = edge - half[i];
    edge -= 2 * half[i];
    const pts = [pt(KNUCKLE[f] * L, c, 0)];
    let curl = 0;
    BONES.forEach((b, j) => { curl += CURL[f][j]; pts.push(add(pts[j], mul(way(ASIDE[f], curl), b * LONG[f] * L))); });
    return pts;
  });
  const deep = r => r * 0.85;

  // (a section round one finger, or the thumb: round c across its way, r wide, d thick)
  const round = (c, w, r, d) => {
    const x = unit(sub(e, mul(w, dot(e, w)))), y = cross(w, x);
    return Array.from({ length: ROUND }, (_, i) => { const th = i / ROUND * Math.PI * 2; return local(add(c, add(mul(x, r * Math.cos(th)), mul(y, d * Math.sin(th))))); });
  };
  // (a section across the four side by side: round each, joined — over their backs and fronts, a little lower in the
  // grooves between —, round the index finger's outer side and the little finger's)
  const across = (cs, rs, ds, w, groove) => {
    const x1 = sub(cs[0], cs[3]), x = unit(sub(x1, mul(w, dot(x1, w)))), y = cross(w, x);
    const side = sgn => {
      const row = [];
      for (let i = 0; i < 4; i++) {
        row.push(add(cs[i], mul(y, sgn * ds[i])));
        if (i < 3) row.push(add(between(cs[i], cs[i + 1], 0.5), mul(y, sgn * (ds[i] + ds[i + 1]) / 2 * (1 - groove))));
      }
      return row;
    };
    const end = (i, dir) => [1, 0, -1].map(k => add(cs[i], add(mul(x, dir * rs[i] * Math.cos(k * Math.PI / 4)), mul(y, dir * ds[i] * Math.sin(k * Math.PI / 4)))));
    return [...side(1), ...end(3, -1), ...side(-1).reverse(), ...end(0, 1)].map(local);
  };

  // the palm: from inside the arm's end at the wrist (as wide and thick as the arm there), widening as a hand's heel does,
  // on to the knuckles — its sections across the four fingers' lines drawn back to the wrist, narrower there
  const palmAt = u => {
    const w0 = Math.min(1, wrist * 1.02 / (palmW / 2)), wide = w0 + (1 - w0) * smooth(-0.08, 0.5, u), d0 = Math.min(DEEP[0] * B, wrist * 1.02);
    const cs = lines.map(l => { const r = sub(l[0], W); return pt(dot(r, a) * u, dot(r, e) * wide, 0); });
    const d = u < 0.45 ? d0 + (DEEP[1] * B - d0) * smooth(-0.08, 0.45, u) : DEEP[1] * B + (DEEP[2] * B - DEEP[1] * B) * smooth(0.45, 1, u);
    return across(cs, half.map(h => h * wide), half.map(() => d), a, 0);
  };
  const palm = [-0.08, 0.12, 0.3, 0.5, 0.7, 0.86, 1].map(palmAt);
  const wristEnd = local(pt(-0.14 * L * 0.47, 0, 0));

  // a finger: from inside the palm to its round tip, tapering
  const finger = (l, r0) => {
    const tipR = r0 * 0.72, line = [...l.slice(0, 3), sub(l[3], mul(unit(sub(l[3], l[2])), tipR))], rings = [];
    for (const k of [-0.12, 0, 0.18, 0.36, 0.52, 0.68, 0.84, 1]) {
      const q = along(line, k), r = r0 * (1 - 0.28 * Math.max(0, k));
      rings.push(round(q.at, q.way, r, deep(r)));
    }
    const end = along(line, 1);
    for (const f of [0.5, 0.82, 0.96]) { const c = Math.sqrt(1 - f * f); rings.push(round(add(end.at, mul(end.way, tipR * f)), end.way, tipR * c, deep(tipR) * c)); }
    return { rings, first: local(along(line, -0.2).at), last: local(add(end.at, mul(end.way, tipR))) };
  };
  // the fingers held together: one piece along their four lines, a share of each one's length at a time (its end the arc
  // their tips make), as wide and thick as they are there, a faint groove between each two
  const together = () => {
    const tipR = half.map(h => h * 0.72), ls = lines.map((l, i) => [...l.slice(0, 3), sub(l[3], mul(unit(sub(l[3], l[2])), tipR[i]))]), rings = [];
    for (const k of [0, 0.18, 0.36, 0.52, 0.68, 0.84, 1]) {
      const qs = ls.map(l => along(l, k)), t = 1 - 0.28 * k, rs = half.map(h => h * t);
      rings.push(across(qs.map(q => q.at), rs, rs.map(deep), unit(qs.map(q => q.way).reduce(add)), 0.1 * smooth(0, 0.18, k)));
    }
    const ends = ls.map(l => along(l, 1)), w = unit(ends.map(q => q.way).reduce(add));
    for (const f of [0.5, 0.82, 0.96]) {
      const c = Math.sqrt(1 - f * f), rs = tipR.map(r => r * c);
      rings.push(across(ends.map((q, i) => add(q.at, mul(q.way, tipR[i] * f))), rs, rs.map(deep), w, 0.1));
    }
    return { rings, first: local(pt(-0.14 * L * 0.47, 0, 0)), last: local(add(between(ends[1].at, ends[2].at, 0.5), mul(w, tipR[1]))) };
  };
  // the thumb: from inside the heel of the palm on the index finger's side, out and along beside the hand, tapering
  const thumb = () => {
    const [ru, rv, rw] = THUMB.root, base = pt(ru * L, rv * palmW / 2, rw * L), pts = [base];
    THUMB.ways.forEach(([s, c], i) => pts.push(add(pts[i], mul(way(s, c), THUMB.long[i] * L))));
    const rs = THUMB.r.map(r => r * B), tipR = rs[3], line = [...pts.slice(0, 3), sub(pts[3], mul(unit(sub(pts[3], pts[2])), tipR))], rings = [];
    for (const k of [0, 0.15, 0.32, 0.5, 0.66, 0.82, 1]) {
      const q = along(line, k), seg = k * 3, i = Math.min(2, Math.floor(seg)), r = rs[i] + (rs[i + 1] - rs[i]) * smooth(0, 1, seg - i);
      rings.push(round(q.at, q.way, r, deep(r)));
    }
    const end = along(line, 1);
    for (const f of [0.5, 0.82, 0.96]) { const c = Math.sqrt(1 - f * f); rings.push(round(add(end.at, mul(end.way, tipR * f)), end.way, tipR * c, deep(tipR) * c)); }
    return { rings, first: local(along(line, -0.15).at), last: local(add(end.at, mul(end.way, tipR))) };
  };

  // the palm closed over the knuckles (under the fingers' roots) — with its fingers apart; on into them held together
  const knuckles = local(add(mul(lines.map(l => l[0]).reduce(add), 1 / 4), mul(a, half[1] * 0.6)));
  const fused = together();
  return {
    fingers: [{ rings: palm, first: wristEnd, last: knuckles }, ...lines.map((l, i) => finger(l, half[i])), thumb()],
    mitten: [{ rings: [...palm.slice(0, -1), ...fused.rings], first: wristEnd, last: fused.last }, thumb()],
  };
}
