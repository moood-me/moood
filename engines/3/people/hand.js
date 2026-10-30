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
// how far along its last bone its tube goes (a fingertip rounds it off there: a finger as long as the palm, or a
// little less, from the knuckle; the little finger's to about the ring finger's last joint)
const EASE = {
  Index: { aside: -1, curl: [16, 26, 12], r: 0.98, tip: 0.25 },
  Middle: { aside: 0, curl: [18, 28, 13], r: 1, tip: 0.25 },
  Ring: { aside: 1, curl: [20, 30, 14], r: 0.95, tip: 0.25 },
  Pinky: { aside: 2, curl: [15, 22, 10], r: 0.84, tip: 0.5 },
};
// the thumb at ease: each of its three bones' way (degrees from the palm's: toward the index finger's side, toward the
// palm), its thickness at its root (the ball of the thumb) and along it, of the middle finger's
const THUMB = { ways: [[30, 20], [2, 26], [-14, 34]], r: [1.5, 1.15, 1.02], tip: 0.35 };
// a finger's end: the tube round over its last bit (along the last stretch, a share of the thickness there) — a
// fingertip, not a point
const DOME = [[0, 1], [0.5, 0.84], [0.85, 0.54], [1, 0.28]];
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
  // (and where each joint's child is then, on the bind: its bone's length along its way from where the joint is)
  const G = new Map(), order = [], placed = new Map();
  const aim = (name, child, d) => {
    const j = AT[`${side}${name}`], b = sub(at(child), at(name)), from = placed.get(name) ?? at(name);
    G.set(j, qmul(fromTo(unit(b), d), bindQ(j))); order.push(j);
    placed.set(child, add(from, mul(d, len(b))));
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
  // (a profile: its half-width at each joint, then over the last stretch to the tip, rounded)
  const tipped = rs => [...rs.map((r, i) => [i, r]), ...DOME.slice(1).map(([u, k]) => [rs.length - 1 + u, rs[rs.length - 1] * k])];
  const fingers = [
    { joints: [J('Thumb1'), J('Thumb2'), J('Thumb3'), J('ThumbEnd')], tip: THUMB.tip, profile: tipped(THUMB.r.map(k => rM * k)) },
    ...FINGERS.map(f => ({ joints: [J(`${f}2`), J(`${f}3`), J(`${f}4`), J(`${f}End`)], tip: EASE[f].tip,
      profile: tipped([1.02, 0.92, 0.85].map(k => rf(f) * k)) })),
  ];
  // the mitten: one piece from the wrist through the palm (its sections) and on along the four fingers' middle line at
  // ease, as wide as they lie side by side, as thick as a finger, a little narrower toward the tip, rounded there; the
  // thumb a piece of its own along its bones at ease. In the hand joint's own frame, as the palm: all of it goes with
  // that joint
  const loft = (line, w, d, n, toward) => line.map((c, i) => {
    const end = line.length - 1, t = unit(sub(line[Math.min(end, i + 1)], line[Math.max(0, i - 1)])), x = unit(sub(toward, mul(t, dot(toward, t)))), y = cross(t, x);
    return Array.from({ length: n }, (_, k) => {
      const th = k / n * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th);
      return local(add(c, add(mul(x, w[i] * Math.sign(cs) * Math.abs(cs) ** 0.9), mul(y, d[i] * Math.sign(sn) * Math.abs(sn) ** 0.9))));
    });
  });
  // (a line through points, each corner eased: a point a third of the way to either side of each)
  const between = (u, v, k) => add(u, mul(sub(v, u), k));
  const eased = pts => pts.flatMap((v, i) => (i === 0 || i === pts.length - 1 ? [v] : [between(pts[i - 1], v, 0.7), v, between(v, pts[i + 1], 0.3)]));
  const level = n => FINGERS.map(f => placed.get(`Hand${f}${n}`)), mean = vs => mul(vs.reduce(add), 1 / vs.length);
  const block = [2, 3, 4, 'End'].map(n => mean(level(n))), wide = [2, 3, 4, 'End'].map(n => dot(sub(level(n)[0], level(n)[3]), e) / 2 + rM * 0.95);
  const tipWay = unit(sub(block[3], block[2])), toTip = rM * 0.9;
  const fline = eased([...block.slice(0, 3), sub(block[3], mul(tipWay, toTip))]), fn = fline.length;
  const heel = STATIONS.slice(0, -1).map(u => add(add(W, mul(a, u * length)), mul(e, mid * smooth(0, 0.8, u))));
  const line = [...heel, ...fline], w = [...STATIONS.slice(0, -1).map(widthAt), ...fline.map((_, i) => wide[0] + (wide[3] * 0.9 - wide[0]) * smooth(0, 1, i / (fn - 1)))];
  const d = [...STATIONS.slice(0, -1).map(thickAt), ...fline.map((_, i) => rM * (1.1 - 0.2 * i / (fn - 1)))];
  const body = loft(line, w, d, AROUND, e), lw = w[w.length - 1], ld = d[d.length - 1], tipAt = line[line.length - 1];
  for (const f of [0.5, 0.85]) {
    const c = Math.sqrt(1 - f * f), at2 = add(tipAt, mul(tipWay, toTip * f));
    body.push(loft([sub(at2, tipWay), at2, add(at2, tipWay)], [0, lw * (0.4 + 0.6 * c), 0], [0, ld * c, 0], AROUND, e)[1]);
  }
  const Th = ['HandThumb1', 'HandThumb2', 'HandThumb3', 'HandThumbEnd'].map(n => placed.get(n) ?? at(n)), thumbWay = unit(sub(Th[3], Th[2]));
  const tline = eased([Th[0], Th[1], Th[2], sub(Th[3], mul(thumbWay, rM * 0.85))]), tn = tline.length, tr = tline.map((_, i) => rM * (1.45 - 0.55 * i / (tn - 1)));
  const mitten = {
    body: { rings: body, first: local(sub(W, mul(a, 0.12 * length))), last: local(add(tipAt, mul(tipWay, toTip))) },
    thumb: { rings: loft(tline, tr, tr.map(r => r * 0.92), 10, p), first: local(sub(Th[0], mul(unit(sub(Th[1], Th[0])), tr[0] * 0.6))), last: local(add(tline[tn - 1], mul(thumbWay, tr[tn - 1]))) },
  };
  return { pose: { joints: Int32Array.from(order), q }, palm: { rings, first, last }, fingers, mitten };
}
