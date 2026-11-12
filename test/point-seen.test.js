// e.point on a card (issue #13): where the eye now sees the point on the card as drawn — the line from the eye through
// the point meets the card's plane; a point on that plane answers itself; none behind the eye or edge-on. A world of
// numbers in node (no GPU).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compile } from '../engines/3/world/spec.js';
import { createWorld } from '../engines/3/world/world.js';

globalThis.GPUTextureUsage ??= { TEXTURE_BINDING: 4, COPY_DST: 2 };

// a card facing the eye (luca: across 0, distance 5) and one turned (wall: across 0, distance 5, facing 135)
function made() {
  const C = compile({ engine: 3, objects: [
    { id: 'luca', across: 0, distance: 5, height: 1.5, box: [-0.5, -1.5, 0.5, 0] },
    { id: 'wall', across: 0, distance: 5, facing: 135, height: 2, box: [-1, -2, 1, 0] },
  ] }, () => {}, x => x);
  const values = new Map(), state = { value: k => values.get(k) };
  const gpu = { table: () => ({}), texture: () => ({}), drop() {} };
  const world = createWorld(C, { state, sheets: {}, gpu, artist: { post() {} }, shared: { kits: {}, lib: {}, anim: {} }, report() {}, warn() {}, height: null });
  world.frame([], false, true);
  return world;
}
const el = (w, id) => w.elements.find(e => e.id === id);
const close = (a, b) => assert.ok(Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9, `${a} ≠ ${b}`);
const eye = (w, x, y, z, yaw = 0) => { w.eye[0] = x; w.eye[1] = y; w.eye[2] = z; w.yaw = yaw; };

test('a point on the card\'s plane answers itself, wherever the eye is', () => {
  const w = made(), o = [0, 0];
  for (const [x, y, z] of [[0, 1.7, 0], [3, 4.2, 1], [-2, 0.5, -1]]) {
    eye(w, x, y, z);
    assert.equal(w.toPainting(el(w, 'luca'), [0.3, 1.2, -5], o), true);
    close(o, [0.3, -1.2]);
  }
});

test('a point before the card: where the eye sees it there — raised eye, the flame seen higher on the card', () => {
  const w = made(), o = [0, 0];
  // the flame 1 m before the card, 1.2 m up; the eye at 4.2 m, 5 m before the card: the line meets the card 5/4 on
  eye(w, 1, 4.2, 0);
  assert.equal(w.toPainting(el(w, 'luca'), [0.2, 1.2, -4], o), true);
  close(o, [1 + 1.25 * (0.2 - 1), -(4.2 + 1.25 * (1.2 - 4.2))]);
  // the eye level with it and straight before it: where it stands
  eye(w, 0.2, 1.2, 0);
  w.toPainting(el(w, 'luca'), [0.2, 1.2, -4], o);
  close(o, [0.2, -1.2]);
});

test('a card turned its own way: the line met in its plane, in its own units', () => {
  const w = made(), o = [0, 0], c = el(w, 'wall'), p = new Float64Array(3);
  eye(w, 0.5, 1.7, 0);
  // a point of its painting placed in the world, then pushed off its plane along the line from the eye: the same answer
  w.sheetPoint(c, 0, { x: 0.4, y: -0.8, part: -1, layer: -1 }, 0, p);
  const q = [0, 1, 2].map(k => w.eye[k] + 0.7 * (p[k] - w.eye[k]));
  assert.equal(w.toPainting(c, q, o), true);
  close(o, [0.4, -0.8]);
});

test('none behind the eye, none edge-on', () => {
  const w = made(), o = [0, 0];
  eye(w, 0, 1.7, 0);
  assert.equal(w.toPainting(el(w, 'luca'), [0, 1.7, 2], o), false);
  // the eye in the card's plane (it faces the view's yaw: the eye beside it, looking along it)
  eye(w, 3, 1.7, -5);
  assert.equal(w.toPainting(el(w, 'luca'), [0, 1, -4], o), false);
});

test('a form: the point\'s foot on its plane, along its face, wherever the eye is', () => {
  const w = made(), o = [0, 0], c = el(w, 'wall');
  // (its form's row stood in for: what its paint is on is the form, not the plane)
  c.form = 0;
  const p = new Float64Array(3);
  w.sheetPoint(c, 0, { x: 0.4, y: -0.8, part: -1, layer: -1 }, 0, p);
  // the wall faces 135°: its normal (its node's z) pushed along, the foot the same
  const M = w.tables.nodes.m, k = 12 * c.node, n = [M[k + 6], M[k + 7], M[k + 8]], l = Math.hypot(...n);
  const q = [0, 1, 2].map(i => p[i] + 0.5 * n[i] / l);
  for (const [x, y, z] of [[0.5, 1.7, 0], [-2, 3, 1]]) {
    eye(w, x, y, z);
    assert.equal(w.toPainting(c, q, o), true);
    close(o, [0.4, -0.8]);
  }
});
