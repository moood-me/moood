// Engine 3's operator looking round (around/roam): the way round it finds for a shot never puts the eye in a person's
// body — another's or the target's own; open ground, a face turned away and the pier over water as before. A world of
// numbers in node (no GPU): people as capsules, the land and the water as heights.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCamera } from '../engines/3/play/camera.js';

const EYE = 1.7;
// a person's capsules standing at (x, d) — or a seated figure three times a person, its knees toward the viewer
function body(x, d, giant) {
  const z = -d, caps = giant
    ? [[0, 1.5, z, 0, 3.2, z, 0.5], [0, 3.2, z, 0, 4.6, z, 0.6], [0, 4.6, z, 0, 5.2, z, 0.35],
      [-0.35, 1.6, z, -0.35, 1.6, z + 2.4, 0.5], [0.35, 1.6, z, 0.35, 1.6, z + 2.4, 0.5],
      [-0.35, 1.6, z + 2.4, -0.35, 0.1, z + 2.4, 0.3], [0.35, 1.6, z + 2.4, 0.35, 0.1, z + 2.4, 0.3]]
    : [[-0.1, 0.05, z, -0.1, 0.9, z, 0.08], [0.1, 0.05, z, 0.1, 0.9, z, 0.08], [0, 0.9, z, 0, 1.4, z, 0.17],
      [0, 1.4, z, 0, 1.55, z, 0.2], [0, 1.55, z, 0, 1.8, z, 0.11]];
  return { n: caps.length, data: Float64Array.from(caps.flat()) };
}
// the nearest t along a ray (o, unit d) within a capsule, else Infinity
function capsuleT(o, d, C, i) {
  const ax = C[i], ay = C[i + 1], az = C[i + 2], sx = C[i + 3] - ax, sy = C[i + 4] - ay, sz = C[i + 5] - az, r = C[i + 6];
  let best = Infinity;
  for (let k = 0; k <= 200; k++) {
    const t = k * 0.05, px = o[0] + d[0] * t, py = o[1] + d[1] * t, pz = o[2] + d[2] * t, ss = sx * sx + sy * sy + sz * sz;
    const u = Math.max(0, Math.min(1, ((px - ax) * sx + (py - ay) * sy + (pz - az) * sz) / ss));
    if (Math.hypot(px - ax - sx * u, py - ay - sy * u, pz - az - sz * u) <= r) { best = t; break; }
  }
  return best;
}
// how deep an eye (a world point) is in a person's capsules (> 0: inside)
function depthIn(o, K) {
  let most = -Infinity;
  for (let i = 0; i < K.n * 7; i += 7) {
    const C = K.data, sx = C[i + 3] - C[i], sy = C[i + 4] - C[i + 1], sz = C[i + 5] - C[i + 2], ss = sx * sx + sy * sy + sz * sz;
    const u = Math.max(0, Math.min(1, ((o[0] - C[i]) * sx + (o[1] - C[i + 1]) * sy + (o[2] - C[i + 2]) * sz) / ss));
    most = Math.max(most, C[i + 6] - Math.hypot(o[0] - C[i] - sx * u, o[1] - C[i + 1] - sy * u, o[2] - C[i + 2] - sz * u));
  }
  return most;
}

// people: [{ id, x, d, away (faces away from the viewer), giant, here }]; points: [{ id, x, d, h, marks, painted }]
// (unseen, h tall; marks: the names its painting marks, painted: whether it is painted yet — a thing that paints);
// land(x, d) / water(x, d): what the eye stands over, the land or the water without the walk planes
function scene({ mode, people = [], points = [], land = () => 0, water = land }, values) {
  const elements = [], byId = new Map(), m = new Float64Array(12 * (people.length + points.length) + 12);
  let node = 0;
  const at = (x, y, d, away) => { const o = 12 * node; m[o] = 1; m[o + 4] = 1; m[o + 6] = 0; m[o + 8] = away ? -1 : 1; m[o + 9] = x; m[o + 10] = y; m[o + 11] = -d; return node++; };
  const caps = new Map();
  for (const p of people) {
    const n = at(p.x, land(p.x, p.d), p.d, p.away);
    const el = { id: p.id, kind: 'person', node: n, nodes: [n], box: [-0.4, -1.8, 0.4, 0], below: [], spec: { name: null }, flags: {}, isPainted: false };
    elements.push(el); byId.set(p.id, el); caps.set(p.id, { ...p, K: body(p.x, p.d, p.giant) });
  }
  for (const q of points) {
    const n = at(q.x, 0, q.d, false);
    const el = { id: q.id, kind: 'unseen', node: n, nodes: [n], box: [-0.1, -q.h, 0.1, 0], below: [], spec: { name: null, height: q.h, paints: !!q.marks }, flags: {}, isPainted: !!q.painted, marks: q.marks || [], marked: new Map(), at: [q.x, q.h, -q.d] };
    elements.push(el); byId.set(q.id, el);
  }
  const here = id => values[`${id}_here`] !== false && caps.get(id).here !== false;
  const people_ = {
    sphere(id, out) { const p = caps.get(id); if (!here(id)) return false; out[0] = p.x; out[1] = 1; out[2] = -p.d; out[3] = p.giant ? 5 : 1.3; return true; },
    capsules: id => caps.get(id).K,
    height: id => (caps.get(id).giant ? 3 * EYE : EYE),
    box: (id, out) => { out.set(caps.get(id).giant ? [-1, -5.2, 1, 0] : [-0.4, -1.8, 0.4, 0]); return true; },
    // (the head; 'lap': over the knees)
    point: (id, name, out) => { const p = caps.get(id), lap = name === 'lap'; out[0] = p.x; out[1] = lap ? 1.9 : p.giant ? 4.9 : 1.68; out[2] = -p.d + (lap ? 1 : 0); return true; },
    pointFor: () => false,
    building: () => false,
  };
  const world = {
    C: { camera: { mode, h: EYE, look: 0, follow: [], sway: mode === 'picture' ? 0.033 * EYE : 0, span: null, round: mode === 'around' || mode === 'roam', turn: null, area: null, hero: null, jump: 2.2, on: null }, yh: 0.6 },
    tables: { nodes: { m } }, elements, byId, persons: elements.filter(e => e.kind === 'person'), people: people_,
    standAt: (x, d) => land(x, d), surfaceAt: (x, d) => water(x, d),
    refOf: ref => { const h = ref.indexOf('#'), id = h < 0 ? ref : ref.slice(0, h), name = h < 0 ? null : ref.slice(h + 1); return { id, name, copy: 0, head: name ? ref : `${id}#head` }; },
    pointOf(ref, out) { const [id, name] = ref.split('#'), el = byId.get(id); if (el?.kind !== 'person') { out.set(el.at); return true; } return byId.get(id)?.kind === 'person' && here(id) ? people_.point(id, name, out) : false; },
    markOf: (el, name) => (el.isPainted && el.marks.includes(name) ? { x: 0, y: 0, part: -1, layer: -1 } : null),
    sheetPoint(el, copy, mid, yaw, out) { const o = 12 * el.node; out[0] = m[o + 9] + mid.x; out[1] = m[o + 10] - mid.y; out[2] = m[o + 11]; return out; },
    carriedWith: () => m.subarray(0, 12), chain: el => [el],
    raycast(o, d, max = Infinity, skip = null) {
      let near = null;
      for (const el of world.persons) {
        if ((skip && skip.has(el)) || !here(el.id)) continue;
        const K = caps.get(el.id).K;
        for (let i = 0; i < K.n * 7; i += 7) { const t = capsuleT(o, d, K.data, i); if (t <= max && (!near || t < near.t)) near = { t, el, point: [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t] }; }
      }
      return near;
    },
    view: { safe: new Float64Array(4), seen: new Float64Array(4) },
    moves: { moveOf: () => null, ahead: () => ({ n: 0, keys: [], values: [] }), cameraMoving: 0 },
    paintings: 0, waiting: () => false, relief: null, yaw: 0, eye: new Float64Array(3),
  };
  const state = { value: k => values[k], views: 0, cutAt: 0, shots: 0 };
  const said = [];
  const cam = createCamera(world, state, { w: 1600, h: 900, view: [0, 1], ts: 0, ahead: 0.5, warn: w => said.push(w) });
  cam.step(0, 1 / 60, true);
  const p = cam.pose();
  // the eye in the world, and how deep it is in each person
  const eye = [p.x, p.h, -p.z];
  return { p, said, depth: id => depthIn(eye, caps.get(id).K) };
}

test('open ground: a person facing the viewer is filmed straight before their face, as before', () => {
  const { p, depth } = scene({ mode: 'around', people: [{ id: 'a', x: 0, d: 6 }] }, { camera_target: 'a', camera_shot: 'medium' });
  assert.ok(Math.abs(p.x) < 1e-6 && Math.abs(p.z - (6 - EYE / 1.6)) < 1e-6, JSON.stringify(p));
  assert.ok(depth('a') < 0);
});

test('open ground: a face turned away is filmed from beyond them', () => {
  const { p } = scene({ mode: 'around', people: [{ id: 'a', x: 0, d: 6, away: true }] }, { camera_target: 'a' });
  assert.ok(Math.abs(p.x) < 1e-6 && Math.abs(p.z - (6 + EYE / 0.8)) < 1e-6, JSON.stringify(p));
});

test('the pier: before the face over the water, the eye at the deck\'s eye height (camera-water)', () => {
  const water = (x, d) => (d > 10 ? -2 : 0), land = (x, d) => (d > 10 && d < 12.5 && Math.abs(x) < 1.5 ? 0 : water(x, d));
  const { p } = scene({ mode: 'around', people: [{ id: 'a', x: 0, d: 12, away: true }], land, water }, { camera_target: 'a' });
  assert.ok(p.z > 12 && Math.abs(p.x) < 1e-6, JSON.stringify(p));
  assert.ok(Math.abs(p.h - EYE) < 1e-6, `the eye at ${p.h}`);
});

test('a two-shot\'s point with someone standing where the lens would be: the eye goes round, not into them', () => {
  const D = EYE / 0.8;
  const { p, depth } = scene({ mode: 'around', people: [{ id: 'a', x: -0.6, d: 8 }, { id: 'b', x: 0.6, d: 8 }, { id: 'c', x: 0, d: 8 - D }], points: [{ id: 'pair', x: 0, d: 8, h: EYE }] },
    { camera_target: 'pair' });
  for (const id of ['a', 'b', 'c']) assert.ok(depth(id) < -0.1, `${id}: ${depth(id)} — ${JSON.stringify(p)}`);
  assert.ok(Math.abs(p.x) > 0.3, JSON.stringify(p));
});

test('someone just behind where the lens would be (the lines of sight clear of them): the eye goes round, not into them', () => {
  const D = EYE / 1.6;
  const { p, depth } = scene({ mode: 'around', people: [{ id: 'a', x: 0, d: 8 }, { id: 'c', x: 0, d: 8 - D - 0.06 }] },
    { camera_target: 'a', camera_shot: 'medium' });
  for (const id of ['a', 'c']) assert.ok(depth(id) < -0.1, `${id}: ${depth(id)} — ${JSON.stringify(p)}`);
  assert.ok(Math.abs(p.x) > 0.2, JSON.stringify(p));
});

test('the one in the way not here: the lens straight before the point, as before', () => {
  const D = EYE / 0.8;
  const { p } = scene({ mode: 'around', people: [{ id: 'c', x: 0, d: 8 - D }], points: [{ id: 'pair', x: 0, d: 8, h: EYE }] },
    { camera_target: 'pair', c_here: false });
  assert.ok(Math.abs(p.x) < 1e-6 && Math.abs(p.z - (8 - D)) < 1e-6, JSON.stringify(p));
});

test('a close of a seated giant\'s lap: the eye not in its own knees (its own body hides nothing of it)', () => {
  const { p, depth } = scene({ mode: 'around', people: [{ id: 'g', x: 0, d: 10, giant: true }] }, { camera_target: 'g#lap', camera_shot: 'close' });
  assert.ok(depth('g') < -0.1, `${depth('g')} — ${JSON.stringify(p)}`);
});

test('ahead (picture) the operator still steps round nothing', () => {
  const D = EYE / 0.8;
  const { p, depth } = scene({ mode: 'picture', people: [{ id: 'c', x: 0, d: 8 - D }], points: [{ id: 'pair', x: 0, d: 8, h: EYE }] }, { camera_target: 'pair' });
  assert.ok(Math.abs(p.z - (8 - D)) < 1e-6 && depth('c') > 0, JSON.stringify(p));
});

// a thing's named point (camera_target "id#name"): framed when its painting marks it; a name it never marks is said —
// the camera keeps the scene's own —, one not painted yet waited for, unsaid
test('a thing\'s named point it marks is framed; one it does not mark is said, not silently dropped', () => {
  const bowl = { id: 'bowl', x: -1, d: 6, h: 0.15, marks: ['coins'], painted: true };
  const framed = scene({ mode: 'walk', points: [bowl] }, { camera_target: 'bowl#coins', camera_shot: 'medium' });
  assert.ok(Math.abs(framed.p.x + 1) < 1e-6 && framed.p.z > 5, JSON.stringify(framed.p));
  assert.equal(framed.said.length, 0, framed.said.join('|'));
  const typo = scene({ mode: 'walk', points: [bowl] }, { camera_target: 'bowl#coin', camera_shot: 'medium' });
  assert.ok(Math.abs(typo.p.x) < 1e-6 && Math.abs(typo.p.z) < 1e-6, JSON.stringify(typo.p));
  assert.equal(typo.said.length, 1);
  assert.match(typo.said[0], /"bowl#coin" — "bowl" marks no point "coin"/);
  const unpainted = scene({ mode: 'walk', points: [{ ...bowl, painted: false }] }, { camera_target: 'bowl#coins' });
  assert.equal(unpainted.said.length, 0, unpainted.said.join('|'));
});

// ahead the operator steps round nothing: a settled lens inside someone's body is said once (where it goes unchanged)
test('ahead: a thing framed with the lens inside a person standing before it is said', () => {
  const bowl = { id: 'bowl', x: 0, d: 6, h: 0.15, marks: ['coins'], painted: true };
  const { p, said, depth } = scene({ mode: 'walk', people: [{ id: 'f', x: 0, d: 5.4, away: true }], points: [bowl] }, { camera_target: 'bowl#coins', camera_shot: 'full' });
  assert.ok(depth('f') > 0 && Math.abs(p.z - (6 - 0.595)) < 1e-6, JSON.stringify(p));
  assert.equal(said.length, 1, said.join('|'));
  assert.match(said[0], /camera_target "bowl#coins" is framed from inside the body of "f"/);
});

test('ahead: nobody where the lens settles — nothing said', () => {
  const { said } = scene({ mode: 'walk', people: [{ id: 'f', x: 2, d: 5.4 }], points: [{ id: 'bowl', x: 0, d: 6, h: 0.15, marks: ['coins'], painted: true }] },
    { camera_target: 'bowl#coins', camera_shot: 'full' });
  assert.equal(said.length, 0, said.join('|'));
});

test('ahead (picture): a person framed past someone standing at the lens is said; looking round it goes round instead', () => {
  const D = EYE / 0.8, people = [{ id: 'a', x: 0, d: 8 }, { id: 'c', x: 0, d: 8 - D }];
  const ahead = scene({ mode: 'picture', people }, { camera_target: 'a' });
  assert.equal(ahead.said.length, 1, ahead.said.join('|'));
  assert.match(ahead.said[0], /camera_target "a" is framed from inside the body of "c"/);
  const round = scene({ mode: 'around', people }, { camera_target: 'a' });
  assert.ok(!round.said.some(w => /from inside/.test(w)), round.said.join('|'));
});
