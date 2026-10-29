// Engine 3's first-frame check that the ground ends short of the horizon (play/camera.js lookOver): a plane is the
// ground by where it lies in the world — through what carries it —, not by its own elevation. A world of numbers in
// node (no GPU): planes as node rows, nothing painted past them.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCamera } from '../engines/3/play/camera.js';

// one plane, level, 40 m deep before the eye, its node row at world height y (as its `on` chain puts it)
function said(y, own = y) {
  const m = new Float64Array(12);
  // (a plane lying level: x across, its v toward the viewer, its normal up — as world.js composes tilt 0)
  m[0] = 1; m[5] = 1; m[7] = 1; m[9] = 0; m[10] = y; m[11] = -20;
  const el = { id: 'deck', kind: 'plane', node: 0, nodes: [0], box: [-20, -20, 20, 20], flags: {}, spec: { name: null, plane: { tilt: 0 } }, spot: { elevation: own }, below: [] };
  const world = {
    C: { camera: { mode: 'picture', h: 1.7, look: 0, follow: [], sway: 0, span: null, round: false, turn: null, area: null, hero: null, jump: 2.2, on: null }, yh: 0.6 },
    tables: { nodes: { m } }, elements: [el], byId: new Map([['deck', el]]), persons: [],
    people: { sphere: () => false, capsules: () => ({ n: 0, data: new Float64Array(0) }), height: () => 1.7, box: () => false, point: () => false, pointFor: () => false, building: () => false },
    standAt: () => 0, surfaceAt: () => 0,
    refOf: ref => ({ id: ref, name: null, copy: 0, head: ref }), pointOf: () => false, markOf: () => null,
    sheetPoint: (e, c, mid, yaw, out) => out, carriedWith: () => m.subarray(0, 12), chain: e => [e],
    raycast: () => null,
    view: { safe: new Float64Array(4), seen: new Float64Array(4) },
    moves: { moveOf: () => null, ahead: () => ({ n: 0, keys: [], values: [] }), cameraMoving: 0 },
    paintings: 0, waiting: () => false, relief: null, yaw: 0, eye: new Float64Array(3),
  };
  const out = [];
  const cam = createCamera(world, { value: () => undefined, views: 0, cutAt: 0, shots: 0 }, { w: 1600, h: 900, view: [0, 1], ts: 0, ahead: 0.5, warn: w => out.push(w) });
  cam.step(0, 1 / 60, true);
  cam.looked();
  return out.filter(w => w.includes('the ground ends'));
}

test('a plane at the ground, not carried (as before): the ground — its end is said', () => {
  assert.equal(said(0).length, 1);
});
test('a plane a little under its anchor 1.6 m up (the fuselage\'s top): not the ground', () => {
  assert.equal(said(1.5, -0.1).length, 0);
});
test('a plane at its anchor\'s height, the anchor at the ground: the ground', () => {
  assert.equal(said(0, 0).length, 1);
});
test('a plane raised 1.6 m on an anchor 1.6 m under the ground\'s height: at the ground — the ground', () => {
  assert.equal(said(0, 1.6).length, 1);
});
