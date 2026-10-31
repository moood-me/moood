// A sky's e.light is a glow only, at infinity (scene-format-3: "Their e.light is a glow only (the sky's at
// infinity)"): its row of WT4 is LIGHT.SKY — `at` the way toward it, its sprite in stage heights a unit along it, no
// reach —, so it is in no lit set, and its glow row (render/lights.js glowsIn) carries the way as it is, c.z 1, the
// farthest of all; seen by the frame's view or a mirror's by the way from that view's eye. In node: no GPU.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LIGHT } from '../engines/3/base.js';
import { createTables } from '../engines/3/world/tables.js';
import { createLights } from '../engines/3/render/lights.js';
import { createView, newCamera, lookRot, perspective, mirrorCamera } from '../engines/3/render/views.js';

globalThis.GPUBufferUsage ??= { STORAGE: 1, COPY_DST: 2, VERTEX: 4, UNIFORM: 8 };
globalThis.GPUTextureUsage ??= { TEXTURE_BINDING: 1, COPY_DST: 2 };

const unit = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
const ORIGIN = new Float64Array([100, 0, -50]);
// a world with a sky's glow (way, radius 0.5) and a lamp's painted glow 10 m ahead; the glows' rows as last written
function made(way) {
  const T = createTables(), Lt = T.lights, written = new Float32Array(48);
  const sky = T.addLight();
  Lt.kind[sky] = LIGHT.POINT; Lt.flags[sky] = LIGHT.GLOW | LIGHT.SKY; Lt.sprite[sky] = 0.5; Lt.strength[sky] = 1.2;
  Lt.at.set(way, 3 * sky);
  const lamp = T.addLight();
  Lt.kind[lamp] = LIGHT.POINT; Lt.flags[lamp] = LIGHT.GLOW; Lt.sprite[lamp] = 0.2; Lt.strength[lamp] = 1; Lt.reach[lamp] = 0.4;
  Lt.at.set([0, 1.5, -10], 3 * lamp);
  const world = { lights: Lt, panes: null, nodes: T.nodes, warn() {} };
  const gpu = { buffer: () => ({}), texture: () => ({ createView: () => ({}) }), drop() {}, queue: { writeTexture() {} }, write(b, o, d, from = 0, n = 0) { if (b && n) written.set(d.subarray(from, from + Math.min(n, 48)), 0); } };
  const L = createLights(gpu);
  L.build(world);
  return { L, world, sky, written };
}
// a view from (0, 2, 0) looking along `way` — or through `camera`
function viewOf(world, way, camera = null) {
  const c = camera || newCamera();
  if (!camera) { c.eye.set([0, 2, 0]); lookRot(way, [0, 1, 0], c.rot); perspective(0.3, 16 / 9, 0.1, c.proj); }
  const v = createView(null, 'frame', false);
  v.e.place(world, c, 1920, 1080);
  return { v, c };
}

test('a sky\'s glow ahead: its way as it is (not less the origin), c.z 1, drawn first; in no lit set', () => {
  const way = unit(0, 0.2, -1), { L, world, sky, written } = made(way), { v } = viewOf(world, unit(0, 0, -1));
  L.choose(v, ORIGIN, 0);
  assert.equal(L.rowOf[sky], -1);
  L.glowsIn(v, []);
  assert.equal(L.glowN, 2);
  assert.equal(L.glowAhead[0], Infinity);
  L.write();
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(written[k] - way[k]) < 1e-6);
  assert.equal(written[3], 0.5);
  assert.equal(written[10], 1);
  // (the lamp's: less the origin, c.z 0 — as before)
  assert.ok(Math.abs(written[12] + ORIGIN[0]) < 1e-4 && Math.abs(written[14] - (-10 - ORIGIN[2])) < 1e-4);
  assert.equal(written[22], 0);
});

test('looking away from it: no row of it', () => {
  const { L, world } = made(unit(0, 0.2, -1)), { v } = viewOf(world, unit(0, 0, 1));
  L.choose(v, ORIGIN, 0); L.glowsIn(v, []);
  assert.equal(L.glowN, 0);
});

test('a mirror\'s view seeing it where the frame does not: its row is there', () => {
  const { L, world } = made(unit(0, 0.5, -1)), { v, c } = viewOf(world, unit(0, -0.8, -1));
  L.choose(v, ORIGIN, 0); L.glowsIn(v, []);
  assert.equal(L.glowN, 0, 'the frame looks down at the water, not up at it');
  const mirror = viewOf(world, null, mirrorCamera(c, [0, 1, 0, 0], newCamera())).v;
  L.glowsIn(v, [{ view: mirror }]);
  assert.equal(L.glowN, 1);
  assert.equal(L.glowAhead[0], Infinity);
});

test('the skies\' rows lead, counted: a mirror with no sky draws only the rows after them', () => {
  const way = unit(0, 0.2, -1), { L, world } = made(way), { v } = viewOf(world, unit(0, 0, -1));
  L.choose(v, ORIGIN, 0); L.glowsIn(v, []);
  assert.equal(L.glowN, 2);
  assert.equal(L.skyGlowN, 1);
  assert.equal(L.glowAhead[0], Infinity);
  assert.ok(L.glowAhead[1] < Infinity);
  // looking away: no rows, none of them a sky's
  const away = viewOf(world, unit(0, 0, 1)).v;
  L.choose(away, ORIGIN, 0); L.glowsIn(away, []);
  assert.equal(L.glowN, 0);
  assert.equal(L.skyGlowN, 0);
});
