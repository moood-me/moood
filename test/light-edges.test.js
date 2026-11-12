// The lights whose patch has an edge — through panes, beams — are worked out at the pixels of what is opaque where
// they may change across it (render/lights.js L.edged → render/quads.js SHAPE.EDGES → render.light e_edges), and
// skipped at its vertices there; elsewhere, and in what blends, every light is at the vertices (moood-me/moood#10,
// #12). In node: the programs' texts and the CPU's test, no GPU (the whole-set check compiles the programs).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LIGHT } from '../engines/3/base.js';
import { assemble } from '../engines/3/gpu/wgsl.js';
import '../engines/3/render/library.js';
import { createTables } from '../engines/3/world/tables.js';
import { createLights } from '../engines/3/render/lights.js';
import { createView, newCamera, lookRot, perspective } from '../engines/3/render/views.js';

globalThis.GPUBufferUsage ??= { STORAGE: 1, COPY_DST: 2, VERTEX: 4, UNIFORM: 8 };
globalThis.GPUTextureUsage ??= { TEXTURE_BINDING: 1, COPY_DST: 2 };

const QUAD = ['render.common', 'frame', 'world', 'sheets', 'render.motion', 'render.light', 'render.relief', 'render.quad.io', 'render.quad.lit', 'render.quad.vertex', 'render.quad.fragment'];
const text = o => assemble(QUAD, { shadows: !!o.receiver, ...o });
const fragmentOf = wgsl => wgsl.slice(wgsl.indexOf('@fragment'));

test('what is solid: the row\'s EDGES bit leaves those lights to its pixels; what blends keeps them at its vertices', () => {
  for (const o of [{ mode: 'solid' }, { mode: 'solid', cut: true }, { mode: 'solid', receiver: true }, { mode: 'solid', cut: true, receiver: true }]) {
    const wgsl = text(o);
    assert.match(wgsl, /let edged = true && \(in\.shape & e_SHAPE_EDGES\) != 0u;/, JSON.stringify(o));
    assert.match(wgsl, /e_lightOn\([^;]*, edged, /, JSON.stringify(o));
    assert.match(fragmentOf(wgsl), /if \(in\.lit\.y \+ in\.lit\.z \+ in\.lit\.w > 0\.0\) \{[^}]*e_edges\(/, JSON.stringify(o));
  }
  for (const o of [{ mode: 'blend' }, { mode: 'blend', receiver: true }]) {
    const wgsl = text(o);
    assert.match(wgsl, /let edged = false && /, JSON.stringify(o));
    assert.ok(!fragmentOf(wgsl).includes('e_edges('), JSON.stringify(o));
  }
});

// a world with a skylight (a 2 × 2 m pane level at 3 m, its middle over the origin, the sun straight above) and a
// beam from 2 m up pointing down, 60° wide, reaching 4 m; their test after the frame's choice
function edged() {
  const T = createTables(), Lt = T.lights, node = T.addNode();
  const M = T.nodes.m, o = 12 * node;
  M.set([1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 3, 0], o);
  const sun = T.addLight();
  Lt.kind[sun] = LIGHT.THROUGH; Lt.strength[sun] = 1; Lt.soft[sun] = 0; Lt.way.set([0, 1, 0], 3 * sun); Lt.colour.set([1, 1, 1], 3 * sun);
  const beam = T.addLight();
  Lt.kind[beam] = LIGHT.POINT; Lt.strength[beam] = 1; Lt.reach[beam] = 4; Lt.at.set([0, 2, -6], 3 * beam); Lt.way.set([0, -1, 0], 3 * beam);
  Lt.cone[2 * beam] = Math.cos(Math.PI / 6); Lt.cone[2 * beam + 1] = Math.cos(Math.PI / 12); Lt.colour.set([1, 1, 1], 3 * beam);
  const panes = { n: 1, node: Int32Array.of(node), rect: Float32Array.of(-1, -1, 1, 1), poly: Float32Array.of(-1, -1, 1, -1, 1, 1, -1, 1), polyOf: Int32Array.of(0, 4), light: Int32Array.of(sun), stamp: 1 };
  const world = { lights: Lt, panes, nodes: T.nodes, warn() {} };
  const gpu = { buffer: () => ({}), texture: () => ({ createView: () => ({}) }), drop() {}, queue: { writeTexture() {} }, write() {} };
  const L = createLights(gpu);
  L.build(world);
  const c = newCamera();
  c.eye.set([0, 1.5, 4]); lookRot([0, -0.2, -1], [0, 1, 0], c.rot); perspective(0.8, 16 / 9, 0.1, c.proj);
  const v = createView(null, 'frame', false);
  v.e.place(world, c, 1920, 1080);
  L.choose(v, new Float64Array(3), 0);
  assert.equal(L.throughN, 1); assert.equal(L.spotN, 1);
  return L.edged;
}

test('through panes: reached where its patch or its pane\'s plane may cross the sphere, not elsewhere', () => {
  const at = edged();
  assert.equal(at(0.9, 0, 0, 0.3), true, 'across the patch\'s edge on the floor');
  assert.equal(at(5, 3, 0, 0.5), true, 'across the pane\'s plane');
  assert.equal(at(5, 0, 0, 0.5), false, 'past the pane, out of its patch: none of it');
  assert.equal(at(5, 6, 0, 0.5), false, 'before the pane: all of it');
});

test('a beam: reached within its reach and its cone (widened by the sphere), not past them', () => {
  const at = edged();
  assert.equal(at(0, 0, -6, 0.2), true, 'under it');
  assert.equal(at(1.3, 0, -6, 0.2), true, 'at its edge');
  assert.equal(at(4, 0, -6, 0.2), false, 'aside of its cone');
  assert.equal(at(0, -5, -6, 0.2), false, 'past its reach');
});
