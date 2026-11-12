// A point light's shadow near a seam between two of its six views (issue #7): a receiver's pixel moves its point off
// its face toward the light by two texels before it reads the map, and reads the face THAT point lies in
// (render/wgsl/light.js e_shadowAt) — so it needs the metres a texel spans before it knows the face: every face of a
// casting light carries it in the shadows' uniform, drawn or not; a face not drawn keeps its side 0 (it holds nothing).
// In node: no GPU.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SHADOWS } from '../engines/3/render/wgsl/frame.js';
import { createShadows } from '../engines/3/render/shadows.js';

globalThis.GPUBufferUsage ??= { STORAGE: 1, COPY_DST: 2, VERTEX: 4, UNIFORM: 8 };
globalThis.GPUTextureUsage ??= { TEXTURE_BINDING: 1, COPY_DST: 2, RENDER_ATTACHMENT: 4 };

function made() {
  let written = null;
  const gpu = { buffer: () => ({}), texture: () => ({ createView: () => ({}) }), bind: () => ({}), write(b, o, d) { if (d instanceof ArrayBuffer) written = new Float32Array(d.slice(0)); } };
  const X = createShadows(gpu, { shadow: 2048, cells: 1 }, {}, {}, { get: () => ({}) });
  X.build({ people: null, elements: [] }, null);
  return { X, uniform: () => written };
}

test('every face of a lamp carries its texel; only the drawn ones a side', () => {
  const { X, uniform } = made();
  const s = X.slots[0];
  s.light = 0; s.kind = 1; s.views = 6;
  for (let v = 0; v < 6; v++) {
    const c = s.cells[v];
    c.texel = 2 / 512; c.on = v < 2; c.has = v < 2;
    c.rect.set([0.25 * v, 0, 0.25, 0]);
  }
  X.write({ rowOf: [0] }, new Float64Array(3));
  const f = uniform();
  for (let v = 0; v < 6; v++) {
    const vo = (SHADOWS.VIEW0 + v * SHADOWS.VIEW) / 4;
    assert.ok(Math.abs(f[vo + 19] - 2 / 512) < 1e-9, `face ${v}: its texel`);
    assert.equal(f[vo + 18], v < 2 ? 0.25 : 0, `face ${v}: its side`);
  }
});
