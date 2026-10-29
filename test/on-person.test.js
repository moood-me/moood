// A point in a person's own frame — {"on": "anna", "at": [across, distance, elevation]} — as world.pointFor and
// world.pointOf take it (what a look, a reach, particles' "at", e.point and e.where resolve through): their frame is
// where they stand, turned as they face — their root —, the same frame an element at that place and facing has; none
// while they are not here. An element's frame as before. A world of numbers in node (no GPU); PEOPLE's root stood in
// for, built as people.js builds it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compile } from '../engines/3/world/spec.js';
import { createWorld } from '../engines/3/world/world.js';

globalThis.GPUTextureUsage ??= { TEXTURE_BINDING: 4, COPY_DST: 2 };

// a world with a cart (across 2, distance 5, facing 90), a twin (an unseen element where anna stands, turned as she
// faces) and two people; who: { id: { at: [x, y, z], facing (degrees) } | null — not here }
function made(who) {
  const C = compile({ engine: 3, objects: [
    { id: 'cart', across: 2, distance: 5, facing: 90 },
    { id: 'twin', unseen: true, across: 1, distance: 4, facing: 120 },
    { id: 'anna', person: {}, across: 1, distance: 4 },
    { id: 'boris', person: {}, across: -1, distance: 2 },
  ] }, () => {}, x => x);
  const values = new Map(), state = { value: k => values.get(k) };
  const gpu = { table: () => ({}), texture: () => ({}), drop() {} };
  const world = createWorld(C, { state, sheets: {}, gpu, artist: { post() {} }, shared: { kits: {}, lib: {}, anim: {} }, report() {}, warn() {}, height: null });
  world.frame([], false, true);
  // (people.js: upright where they stand, turned π − facing about the vertical)
  world.people = {
    root(id, e) {
      const p = who[id];
      if (!p) return false;
      const f = p.facing * Math.PI / 180, c = Math.cos(Math.PI - f), si = Math.sin(Math.PI - f);
      e[0] = c; e[1] = 0; e[2] = -si; e[3] = 0; e[4] = 1; e[5] = 0; e[6] = si; e[7] = 0; e[8] = c; e[9] = p.at[0]; e[10] = p.at[1]; e[11] = p.at[2];
      return true;
    },
    point: () => false,
  };
  return world;
}
const near = (a, b) => { for (let i = 0; i < 3; i++) assert.ok(Math.abs(a[i] - b[i]) < 1e-9, `${[...a]} ≠ ${[...b]}`); };
const HERE = { anna: { at: [1, 0, -4], facing: 120 }, boris: { at: [-1, 0, -2], facing: 180 } };

test('an element\'s frame as before: a point 1 m along the cart\'s distance, turned 90°', () => {
  const w = made(HERE), o = new Float64Array(3);
  assert.equal(w.pointFor({ on: 'cart', at: [0, 1, 0.5] }, o), 1);
  near(o, [1, 0.5, -5]);
});

test('another person\'s frame is the frame an element at their place, turned as they face, has', () => {
  const w = made(HERE), o = new Float64Array(3), t = new Float64Array(3);
  for (const at of [[0, -0.3, 1.1], [0.5, 2, 0], [-1, 0, 1.6]]) {
    assert.equal(w.pointFor({ on: 'anna', at }, o), 1);
    w.pointFor({ on: 'twin', at }, t);
    near(o, t);
  }
});

test('facing the start (180): across to the right, distance away behind them — 0.3 m before her at -0.3', () => {
  const w = made(HERE), o = new Float64Array(3);
  assert.equal(w.pointFor({ on: 'boris', at: [0.2, -0.3, 1.1] }, o), 1);
  near(o, [-0.8, 1.1, -1.7]);
});

test('their own frame: the one who looks named is a person as any — the same point', () => {
  const w = made(HERE), a = new Float64Array(3), b = new Float64Array(3);
  w.pointFor({ on: 'boris', at: [0, -0.3, 1.1] }, a);
  assert.equal(w.pointOf({ on: 'boris', at: [0, -0.3, 1.1] }, b), true);
  near(a, b);
});

test('a person not here (or not posed yet): no point', () => {
  const w = made({ anna: null, boris: HERE.boris }), o = new Float64Array(3);
  assert.equal(w.pointFor({ on: 'anna', at: [0, 1, 0] }, o), 0);
  assert.equal(w.pointOf({ on: 'anna', at: [0, 1, 0] }, o), false);
});

test('posed ahead (pointOf with values): a person\'s frame as they are now, as their points are', () => {
  const w = made(HERE), a = new Float64Array(3), b = new Float64Array(3);
  w.pointFor({ on: 'anna', at: [0, 1, 1] }, a);
  assert.equal(w.pointOf({ on: 'anna', at: [0, 1, 1] }, b, () => undefined), true);
  near(a, b);
});

test('no such id: no point', () => {
  const w = made(HERE), o = new Float64Array(3);
  assert.equal(w.pointFor({ on: 'nobody', at: [0, 1, 0] }, o), 0);
  assert.equal(w.pointOf({ on: 'nobody', at: [0, 1, 0] }, o, () => undefined), false);
});
