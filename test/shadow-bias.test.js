// The one safeguard against a shadow of itself (render/wgsl/light.js e_shadowAt, issue #7): a receiver's point is
// read in the light's map as nearer the light by what its own plane rises across the texels the 2 × 2 compare reads
// (|g.x| + |g.y| texels, g its plane's depth across the map, worked out from two steps along the plane). Here that
// rule, worked with the engine's own matrices (render/views.js) for a lamp's face 512 px wide: a plane never shades
// itself at any slant, and a cloth 2.5 cm off a wall keeps its shadow far down the wall. In node: no GPU.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newCamera, lookRot, perspective, viewProj } from '../engines/3/render/views.js';

const PX = 512, TEXEL = 2 / PX;
// the lamp at the origin, its face looking down (as render/shadows.js places it)
const cam = newCamera();
lookRot([0, -1, 0], [0, 0, 1], cam.rot); perspective(1, 1, 0.05, cam.proj);
const M = viewProj(cam, [0, 0, 0], new Float64Array(16));
const clip = P => { const o = [0, 1, 2, 3].map(r => M[r] * P[0] + M[4 + r] * P[1] + M[8 + r] * P[2] + M[12 + r]); return [o[0] / o[3], o[1] / o[3], o[2] / o[3]]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const l = Math.hypot(...a); return a.map(x => x / l); };
// the reference P is read with (the shader's rule)
function reference(P, N) {
  const at = clip(P), step = 0.01 * Math.hypot(...P), a = Math.abs(N[0]) > 0.7 ? [0, 1, 0] : [1, 0, 0];
  const t1 = unit(cross(N, a)).map(x => x * step), t2 = unit(cross(N, t1)).map(x => x * step);
  const d1 = clip(P.map((x, i) => x + t1[i])).map((x, i) => x - at[i]), d2 = clip(P.map((x, i) => x + t2[i])).map((x, i) => x - at[i]);
  const det = d1[0] * d2[1] - d2[0] * d1[1], gx = (d1[2] * d2[1] - d2[2] * d1[1]) / det, gy = (d2[2] * d1[0] - d1[2] * d2[0]) / det;
  return { at, ref: at[2] + (Math.abs(gx) + Math.abs(gy)) * TEXEL };
}
// the depth of a plane (n · X = c) on the ray through the map's point (x, y)
function depthOn(n, c, x, y) {
  const R = cam.rot, dir = [0, 1, 2].map(i => x * R[3 * i] + y * R[3 * i + 1] - R[3 * i + 2]);
  const t = c / (n[0] * dir[0] + n[1] * dir[1] + n[2] * dir[2]);
  return clip(dir.map(v => v * t))[2];
}
// the four texels a 2 × 2 compare may read about a point: a texel off it at the most, each way
const taps = at => [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([i, j]) => [at[0] + i * TEXEL, at[1] + j * TEXEL]);

test('a plane under a lamp never shades itself, however slanted', () => {
  for (const tiltDeg of [0, 30, 60, 80, 87]) {
    const t = tiltDeg * Math.PI / 180, n = [0, Math.cos(t), Math.sin(t)];
    for (const P0 of [[0.1, -1, 0.05], [-0.4, -1.2, 0.3], [0.7, -0.9, -0.6]]) {
      const c = n[0] * P0[0] + n[1] * P0[1] + n[2] * P0[2];
      if (!(c < 0)) continue;
      const { at, ref } = reference(P0, n);
      for (const [x, y] of taps(at)) assert.ok(depthOn(n, c, x, y) <= ref + 1e-9, `tilt ${tiltDeg}: its own plane read as shading it`);
    }
  }
});

test('a cloth 2.5 cm off a wall, the lamp 24 cm off the wall: its shadow holds down to 3 m', () => {
  const wall = [0, 0, 1], cloth = 0.215;
  for (const below of [0.5, 1, 1.4, 2, 3]) {
    const { at, ref } = reference([0.1, -below, 0.24], wall);
    for (const [x, y] of taps(at)) assert.ok(depthOn(wall, cloth, x, y) > ref, `${below} m below the lamp: the cloth's shadow lost`);
  }
});
