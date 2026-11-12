// The lights whose patch has an edge — through panes, beams — are worked out at the pixels of what is opaque (a solid
// quad, the land, receiver or not: render.light e_edges), and skipped at its vertices; what blends keeps every light
// at its vertices (moood-me/moood#10, #12). In node: the programs' texts, no GPU (the whole-set check compiles them).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assemble } from '../engines/3/gpu/wgsl.js';
import '../engines/3/render/library.js';

const QUAD = ['render.common', 'frame', 'world', 'sheets', 'render.motion', 'render.light', 'render.relief', 'render.quad.io', 'render.quad.lit', 'render.quad.vertex', 'render.quad.fragment'];
const text = o => assemble(QUAD, { shadows: !!o.receiver, ...o });
// its vertex stage's call of e_lightOn: whether it leaves the lights with an edge to the pixels
const vertexEdges = wgsl => /e_lightOn\(P, e_faced\(P, N, has\), has, inside, q\.recv, (true|false), (true|false),/.exec(wgsl).slice(1, 3);

test('what is solid: its vertices skip the lights with an edge, its pixels add them', () => {
  for (const o of [{ mode: 'solid' }, { mode: 'solid', cut: true }, { mode: 'solid', receiver: true }, { mode: 'solid', cut: true, receiver: true }]) {
    const wgsl = text(o), [, edges] = vertexEdges(wgsl);
    assert.equal(edges, 'true', JSON.stringify(o));
    const frag = wgsl.slice(wgsl.indexOf('@fragment'));
    assert.match(frag, /e_edges\(in\.world, [^;]*, (true|false), in\.lit\.x\)/, JSON.stringify(o));
  }
});

test('what blends: every light at its vertices, none at its pixels', () => {
  for (const o of [{ mode: 'blend' }, { mode: 'blend', receiver: true }]) {
    const wgsl = text(o), [, edges] = vertexEdges(wgsl);
    assert.equal(edges, 'false', JSON.stringify(o));
    assert.ok(!wgsl.slice(wgsl.indexOf('@fragment')).includes('e_edges('), JSON.stringify(o));
  }
});

test('e_edges reads only the rows after the far lights, as many as there are through-lights and beams', () => {
  const wgsl = text({ mode: 'solid' }), body = wgsl.slice(wgsl.indexOf('fn e_edges'), wgsl.indexOf('fn e_airLight'));
  assert.match(body, /let n = e_frame\.e_throughN \+ e_frame\.e_spotN;/);
  assert.match(body, /if \(k >= n\) \{ break; \}/);
  assert.match(body, /let i = e_frame\.e_farN \+ k;/);
  const lit = wgsl.slice(wgsl.indexOf('fn e_lightOn'), wgsl.indexOf('fn e_edges'));
  assert.match(lit, /if \(edges && n >= e_frame\.e_farN && n < sky\) \{ continue; \}/);
});
