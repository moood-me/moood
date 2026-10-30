// A hand of its own (a style's `palm`, with its fingers: shapes.js): a palm with a body — rounded, flat, from the wrist
// to the knuckles —, the fingers on it close together, thick at their roots and tapering, the thumb on the palm's side
// below the index finger; at ease, gently curled — the hand of one who holds nothing. Its size is the skeleton's (their
// height, its hands' length: a child's hand as a child's body has it), its breadth the figure's (a slight one's hand
// narrower, its fingers thinner and closer).
// The fingers at ease are the joints' own turns: what the motions have of the fingers (Kimodo's stay as they were made,
// a little curled and fanned out as SOMA's rest has them) is put aside by the player (player.js: hand), which writes
// these in their place before it poses; the palm goes with the hand's joint (skinned to it), each finger's tube with
// its joints (laid along them on the GPU): nothing of the hand is worked out a frame.
//   handOf(rig, P, side, {sigma, wrist}) → {pose: {joints, q}, palm: {rings, first, last}, fingers: [{joints, tip, profile}…]}
//     P — the bind's pose (rig.js: its joints' places and turns, on these bones); side — 'Left' | 'Right'; sigma — how
//     broad the hand is against a man's (1); wrist — the arm's half-width at the wrist (metres): the palm takes the arm
//     in there.
//     pose — the fingers' joints (their numbers) and their turns at ease, each under its parent (quaternions x, y, z, w);
//     palm — rings of points round it, the wrist's first, and the points that close it at either end, in the hand
//     joint's own frame (rig.js: where a joint's turn and place take it); fingers — each one's joints its tube goes
//     along (numbers; the last two: the tip is between them, `tip` of the way), its profile ([where, half-width]…)
import { AT } from './rig.js';

const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];
// each finger at ease: its way aside from the palm's (degrees, toward the thumb), its curl at each of its three knuckles
// (degrees, toward the palm: a hand at rest curls more toward its outer fingers), its thickness (of the middle finger's),
// how far along its last bone its tube goes (its round end drawing the rest; the little finger's, nearly all: it reaches
// the ring finger's last joint)
const EASE = {
  Index: { aside: -1, curl: [16, 26, 12], r: 0.98, tip: 0.6 },
  Middle: { aside: 0, curl: [18, 28, 13], r: 1, tip: 0.6 },
  Ring: { aside: 1, curl: [20, 30, 14], r: 0.95, tip: 0.6 },
  Pinky: { aside: 2, curl: [15, 22, 10], r: 0.84, tip: 0.9 },
};
// the thumb at ease: each of its three bones' way (degrees from the palm's: toward the index finger's side, toward the
// palm), its thickness at its root (the ball of the thumb) and along it, of the middle finger's
const THUMB = { ways: [[30, 20], [2, 26], [-14, 34]], r: [1.5, 1.15, 1.05, 0.9] };
const FINGER_R = 0.009;   // a man's middle finger's half-width at its knuckle (metres)
const TOUCH = 1.02;       // how far apart the knuckles are: of the two fingers' half-widths together (side by side)
const PALM = 0.089;       // a man's palm: from the wrist to the knuckles (SOMA's, metres)
const AROUND = 16;        // points round the palm
// the palm's sections: where along it (a share of its length from the wrist to the knuckles)
const STATIONS = [-0.05, 0.14, 0.34, 0.56, 0.78, 0.94];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const unit = a => mul(a, 1 / (len(a) || 1));
const smooth = (e0, e1, v) => { const u = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return u * u * (3 - 2 * u); };
const RAD = Math.PI / 180;
// quaternions [x, y, z, w]: a then b (as rig.js's pose turns a joint under its parent), the inverse, the turn that
// takes the way u to the way v
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qinv = a => [-a[0], -a[1], -a[2], a[3]];
const qnorm = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
const fromTo = (u, v) => {
  const c = cross(u, v), d = dot(u, v);
  if (d < -0.9999) { const o = unit(cross(u, Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])); return [o[0], o[1], o[2], 0]; }
  return qnorm([c[0], c[1], c[2], 1 + d]);
};

export function handOf(rig, P, side, { sigma, wrist }) {
  const T = P.T, at = n => { const j = AT[`${side}${n}`] * 3; return [T[j], T[j + 1], T[j + 2]]; };
  const bindQ = j => Array.from(rig.bind.subarray(j * 4, j * 4 + 4));
  // the palm's frame on the bind: along it (the wrist to the knuckles), across it (the little finger's side to the
  // index finger's), out of it (the palm's side: where the thumb's tip is)
  const W = at('Hand'), K = FINGERS.map(f => at(`Hand${f}2`)), m = mul(K.reduce(add), 1 / K.length), a = unit(sub(m, W));
  const across = sub(K[0], K[3]), e = unit(sub(across, mul(a, dot(a, across)))), n = cross(a, e);
  const p = dot(sub(at('HandThumbEnd'), W), n) < 0 ? mul(n, -1) : n;
  const scale = dot(sub(m, W), a) / PALM;
  // (a way from the palm's: aside toward the index finger, then toward the palm — degrees)
  const way = (aside, curl) => unit(add(add(mul(a, Math.cos(aside * RAD) * Math.cos(curl * RAD)), mul(e, Math.sin(aside * RAD) * Math.cos(curl * RAD))), mul(p, Math.sin(curl * RAD))));
  // each joint's turn at ease (in the person's space, the hand turned as on the bind): its bone — to its child — turned
  // from where the bind has it to its way
  const G = new Map(), order = [];
  const aim = (name, child, d) => {
    const j = AT[`${side}${name}`], b = unit(sub(at(child), at(name)));
    G.set(j, qmul(fromTo(b, d), bindQ(j))); order.push(j);
  };
  // the knuckles side by side across the palm (SOMA's are unevenly apart), as far apart as the fingers are thick — as
  // the hand is broad (sigma) —, as far along and as high as SOMA's: where each finger's bone in the palm points
  const rM = FINGER_R * scale * sigma, rf = f => rM * EASE[f].r;
  const apart = [0];
  for (let i = 1; i < FINGERS.length; i++) apart.push(apart[i - 1] + (rf(FINGERS[i - 1]) + rf(FINGERS[i])) * TOUCH);
  const middle = K.reduce((s, k) => s + dot(sub(k, W), e), 0) / K.length, across0 = middle + apart[apart.length - 1] / 2;
  const knuckles = FINGERS.map((f, i) => {
    const J1 = at(`Hand${f}1`), k = sub(K[i], W), to = add(W, add(add(mul(a, dot(k, a)), mul(e, across0 - apart[i])), mul(p, dot(k, p))));
    const d = unit(sub(to, J1));
    aim(`Hand${f}1`, `Hand${f}2`, d);
    return add(J1, mul(d, len(sub(K[i], J1))));
  });
  for (const f of FINGERS) {
    let c = 0;
    EASE[f].curl.forEach((curl, i) => { c += curl; aim(`Hand${f}${i + 2}`, i < 2 ? `Hand${f}${i + 3}` : `Hand${f}End`, way(EASE[f].aside, c)); });
  }
  THUMB.ways.forEach(([aside, curl], i) => aim(`HandThumb${i + 1}`, i < 2 ? `HandThumb${i + 2}` : 'HandThumbEnd', way(aside, curl)));
  // (each under its parent: the hand's own as on the bind)
  const q = new Float32Array(order.length * 4);
  order.forEach((j, i) => { const par = rig.parent[j], l = qnorm(qmul(qinv(G.get(par) ?? bindQ(par)), G.get(j))); q.set(l, i * 4); });

  // the palm: from inside the wrist to round the knuckles, as wide as they are apart and a finger's half-width beyond the
  // outer two, a third as thick; narrower and thinner at the wrist (as the arm is there, at least), as thick as a
  // finger at the knuckles
  const ke = knuckles.map(k => dot(sub(k, W), e)), length = dot(sub(mul(knuckles.reduce(add), 1 / 4), W), a);
  const half = (ke[0] - ke[3]) / 2 + (rf('Index') + rf('Pinky')) / 2, mid = (ke[0] + ke[3]) / 2;
  const thick = Math.max(0.34 * half, rM * 1.2), atWrist = Math.max(wrist * 1.06, 0.62 * half), deepWrist = Math.max(wrist * 1.04, 0.8 * thick);
  const hj = AT[`${side}Hand`] * 9, R = P.R, local = v => {
    const d = sub(v, W);
    return [R[hj] * d[0] + R[hj + 3] * d[1] + R[hj + 6] * d[2], R[hj + 1] * d[0] + R[hj + 4] * d[1] + R[hj + 7] * d[2], R[hj + 2] * d[0] + R[hj + 5] * d[1] + R[hj + 8] * d[2]];
  };
  // (a section: its middle along the palm, its half-width and half-thickness, a little more toward the palm than the
  // back — round, squarish)
  const section = (t, w, d) => {
    const c = add(add(W, mul(a, t)), add(mul(e, mid * smooth(0, 0.8, t / length)), mul(p, d * 0.12 * smooth(0.25, 0.6, t / length))));
    return Array.from({ length: AROUND }, (_, i) => {
      const th = i / AROUND * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th);
      return local(add(c, add(mul(e, w * Math.sign(cs) * Math.abs(cs) ** 0.8), mul(p, d * Math.sign(sn) * Math.abs(sn) ** 0.8))));
    });
  };
  const widthAt = u => atWrist + (half - atWrist) * smooth(-0.05, 0.5, u);
  const thickAt = u => deepWrist + (thick - deepWrist) * smooth(0, 0.42, u) + (rM * 1.12 - thick) * smooth(0.6, 1, u);
  const rings = STATIONS.map(u => section(u * length, widthAt(u), thickAt(u)));
  // (round the knuckles: the last section closed over a finger's thickness)
  const over = rM * 1.3, wEnd = widthAt(1), dEnd = thickAt(1);
  for (const f of [0.45, 0.8]) { const c = Math.sqrt(1 - f * f); rings.push(section(length + over * f, wEnd * (0.55 + 0.45 * c), dEnd * c)); }
  const first = local(add(W, mul(a, -0.12 * length))), last = local(add(add(W, mul(a, length + over)), mul(e, mid)));

  // the fingers: from the knuckle to the tip (the finger's last bone, most of it: its end rounds the rest), thick at the
  // root, tapering; the thumb from its root in the palm's heel
  const J = n => AT[`${side}Hand${n}`];
  const fingers = [
    { joints: [J('Thumb1'), J('Thumb2'), J('Thumb3'), J('ThumbEnd')], tip: 0.62, profile: THUMB.r.map((k, i) => [i, rM * k]) },
    ...FINGERS.map(f => ({ joints: [J(`${f}2`), J(`${f}3`), J(`${f}4`), J(`${f}End`)], tip: EASE[f].tip,
      profile: [[0, rf(f) * 1.02], [1, rf(f) * 0.92], [2, rf(f) * 0.85], [3, rf(f) * 0.78]] })),
  ];
  return { pose: { joints: Int32Array.from(order), q }, palm: { rings, first, last }, fingers };
}
