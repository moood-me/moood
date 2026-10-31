// A glow's falloff (scene-format-3: e.light's `falloff`, a spec light's "falloff"): "linear" is WT4 `falloff` 1, and
// the glow's row (render/lights.js glowsIn) carries it as c.w — render.glow then falls straight from the middle to the
// rim. Left out: 0, the engine's own. In node: no GPU.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LIGHT } from '../engines/3/base.js';
import { createTables } from '../engines/3/world/tables.js';
import { createLights } from '../engines/3/render/lights.js';
import { createLights as createWorldLights } from '../engines/3/world/light.js';
import { createView, newCamera, lookRot, perspective } from '../engines/3/render/views.js';

globalThis.GPUBufferUsage ??= { STORAGE: 1, COPY_DST: 2, VERTEX: 4, UNIFORM: 8 };
globalThis.GPUTextureUsage ??= { TEXTURE_BINDING: 1, COPY_DST: 2 };

// two painted glows 10 m ahead, the first with falloff 1, and a lamp's halo with falloff 1; the glows' rows written
function rows() {
  const T = createTables(), Lt = T.lights, written = new Float32Array(12 * 8);
  const glow = (x, falloff, sprite, glowR) => {
    const i = T.addLight();
    Lt.kind[i] = LIGHT.POINT; Lt.flags[i] = LIGHT.GLOW; Lt.sprite[i] = sprite; Lt.glow[i] = glowR; Lt.strength[i] = 1; Lt.reach[i] = 1;
    Lt.falloff[i] = falloff; Lt.at.set([x, 1.5, -10], 3 * i);
    return i;
  };
  const linear = glow(-1, 1, 0.4, 0), plain = glow(1, 0, 0.4, 0), lamp = glow(0, 1, 0, 0.5);
  const world = { lights: Lt, panes: null, nodes: T.nodes, warn() {} };
  const gpu = { buffer: () => ({}), texture: () => ({ createView: () => ({}) }), drop() {}, queue: { writeTexture() {} }, write(b, o, d, from = 0, n = 0) { if (b && n && n <= written.length) written.set(d.subarray(from, from + n), 0); } };
  const L = createLights(gpu);
  L.build(world);
  const c = newCamera();
  c.eye.set([0, 2, 0]); lookRot([0, 0, -1], [0, 1, 0], c.rot); perspective(0.6, 16 / 9, 0.1, c.proj);
  const v = createView(null, 'frame', false);
  v.e.place(world, c, 1920, 1080);
  L.choose(v, new Float64Array(3), 0);
  L.glowsIn(v, []);
  L.write();
  // (each row: its light, its c.w)
  const out = [];
  for (let k = 0; k < L.glowN; k++) out.push({ x: written[12 * k], w: written[12 * k + 11], r: written[12 * k + 3] });
  return { out, linear, plain, lamp };
}

test('falloff 1 rides on its glow rows as c.w; the engine\'s own is 0', () => {
  const { out } = rows();
  assert.equal(out.length, 4);
  for (const row of out) assert.equal(row.w, row.x > 0.5 ? 0 : 1, `row at x ${row.x}`);
  // (the lamp's halo and its dot both)
  assert.equal(out.filter(row => row.x === 0 && row.w === 1).length, 2);
});

// the world's lights (world/light.js) of a spec's lights and two painted ones — the warnings said
function worldLights(lights, painted) {
  const T = createTables(), warned = [];
  const elements = painted.map((pl, k) => ({ id: `lamp${k}`, who: `lamp${k}`, kind: 'card', nodes: [T.addNode(-1)], copies: null, lights: [pl], flags: { inside: false, flicker: 0 }, spec: {}, glowIndex: new Map(), glowK: [], visible: true }));
  const byId = new Map(elements.map(el => [el.id, el]));
  const refOf = ref => { const [a, name] = String(ref).split('#'), [id, k] = a.split(':'); return { id, copy: k == null ? 0 : Number(k), name: name ?? null }; };
  const world = { tables: T, C: { lights }, elements, byId, refOf, look: { lights: lights.map(() => 1) } };
  createWorldLights(world, () => undefined, text => warned.push(text));
  const of = id => T.lights.ids.indexOf(id);
  return { Lt: T.lights, of, warned };
}
const painted = falloff => ({ x: 0, y: 0, r: 0.3, color: '#ffffff', strength: 1, name: null, falloff, part: -1, layer: -1 });

test('the language: a spec light\'s "falloff", an e.light\'s, one taken over — WT4 falloff', () => {
  const { Lt, of, warned } = worldLights([
    { id: 'lamp', distance: 5, glow: 1, falloff: 'linear' },
    { id: 'plain', distance: 5, glow: 1 },
    { id: 'over', of: 'lamp1', falloff: 'linear' },
    { id: 'odd', distance: 5, glow: 1, falloff: 'soft' },
  ], [painted('linear'), painted(null)]);
  assert.equal(Lt.falloff[of('lamp')], 1);
  assert.equal(Lt.falloff[of('plain')], 0);
  assert.equal(Lt.falloff[of('lamp0')], 1);
  assert.equal(Lt.falloff[of('over')], 1);
  assert.equal(Lt.falloff[of('odd')], 0);
  assert.equal(warned.length, 1);
  assert.match(warned[0], /lights odd: "falloff" is "linear"/);
});
