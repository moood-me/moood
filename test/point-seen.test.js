// e.point on a card (issue #13): where the eye now sees the point on the card as drawn — the line from the eye through
// the point meets the card's plane; a point on that plane answers itself; none behind the eye or edge-on. And the eye
// it is seen from is the frame's: a step that begins a shot (the scene's first, a cut) has the camera placed for it
// before the animates run. A world of numbers in node (no GPU); the stepper's parts stood in for.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compile } from '../engines/3/world/spec.js';
import { createWorld } from '../engines/3/world/world.js';
import { createStepper } from '../engines/3/play/step.js';

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

// a stepper over stand-ins: the camera's yaw is its shot's; the one animate notes the yaw it reads
function stepped() {
  const read = [];
  const world = {
    yaw: 0, eye: Float64Array.of(0, 1.7, 0), people: null, persons: [],
    tables: { nodes: { shown: [1] } },
    elements: [{ spec: { animated: true }, kind: 'card', node: 0, id: 'luca', ctx: { animate: () => read.push(world.yaw) } }],
    frame() {}, emitters: { frame() {} }, rebase() {}, lit: { frame() {} }, flush() {}, stepped() {},
  };
  let shot = 1;
  const camera = { counted: () => shot, step() { world.yaw = 10 * shot; } };
  const S = { world, state: { changed: () => [] }, camera, director: { step() {} }, lookOf: { keys: new Set(), update() {} }, shots: { stepped() {} } };
  const stepper = createStepper(S, { shot: 0, whole: true }, { sync() {}, parts: null });
  return { stepper, read, cut: () => { shot++; } };
}

test('the first step reads the camera\'s eye, not the one before any step', () => {
  const s = stepped();
  s.stepper.step(0, true);
  assert.deepEqual(s.read, [10]);
});

test('a cut: its step reads the new shot\'s eye; the steps after it as before', () => {
  const s = stepped();
  s.stepper.step(0.016, true);
  s.cut();
  s.stepper.step(0.016, true);
  s.stepper.step(0.016, true);
  assert.deepEqual(s.read, [10, 20, 20]);
});
