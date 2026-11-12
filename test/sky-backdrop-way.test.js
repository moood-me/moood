// A backdrop's way as the vertex stage writes it (world.wgsl.js e_skyWayIn) is place.js backdropWay's, not made a
// unit: affine in the sheet's point, so what the rasterizer draws between a cell's corners is the point SHEETS asked
// there, at the level it asked (sheets/ask.js: a backdrop is a flat piece). Made a unit at each corner, a pixel near
// a corner of a cell read a level coarser than any asked, and fell to the sheet's top: the pale patch beside the moon
// in a mirror (moood#6). In node: the shader's own function is run as it is written (its body is JavaScript too).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assemble } from '../engines/3/gpu/wgsl.js';
import '../engines/3/world/world.wgsl.js';
import { backdropWay, turnOf } from '../engines/3/world/place.js';
import { STAGE } from '../engines/3/world/spec.js';

// e_skyWayIn as the chunk has it, made a function of (at, map, yaw, turn) — at, map: { x, y, z }
const wgsl = assemble(['world']), from = wgsl.indexOf('fn e_skyWayIn(');
const body = wgsl.slice(wgsl.indexOf('{', from) + 1, wgsl.indexOf('\n}', from));
const skyWayIn = new Function('at', 'map', 'yaw', 'turn', 'e_WORLD_STAGE', 'e_WORLD_TAU', 'vec3f', 'normalize', 'sin', 'cos', 'atan', body);
const vec3f = (x, y, z) => [x, y, z], normalize = v => { const l = Math.hypot(...v); return v.map(c => c / l); };
const shaderWay = (x, y, yh, yaw) => {
  const turn = turnOf(x - STAGE / 2 - yaw);
  return skyWayIn({ x, y }, { x: yh, y: STAGE, z: 0 }, yaw, turn, STAGE, 2 * Math.PI, vec3f, normalize, Math.sin, Math.cos, Math.atan);
};
const placeWay = (x, y, yh, yaw) => { const p = [x - STAGE / 2 - yaw, yh - y, yaw]; return backdropWay(p, turnOf(p[0])); };

test('the vertex stage writes a backdrop\'s way as place.js does — not made a unit', () => {
  for (const yaw of [0, -0.38, 0.9]) for (const [x, y] of [[0.2, -0.4], [1.317, 0.134], [2.4, 1.1], [-0.6, 0.49]]) {
    const a = shaderWay(x, y, 0.49, yaw), b = placeWay(x, y, 0.49, yaw);
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(a[k] - b[k]) < 1e-12, `yaw ${yaw}, (${x}, ${y}): ${a} against ${b}`);
  }
});

test('between a cell\'s corners the rasterizer lands on the sheet\'s own point: the level SHEETS asked', () => {
  // (a sky cell beside the moon, the eye turned −22°, looking level; a pixel's point by perspective-correct
  // interpolation of the corners' clip points, as the GPU has it)
  const yaw = -22 * Math.PI / 180, yh = 0.49, gaze = [Math.sin(yaw), 0, -Math.cos(yaw)], right = [Math.cos(yaw), 0, Math.sin(yaw)];
  const clip = v => [(v[0] * right[0] + v[2] * right[2]) / (0.45 * STAGE), v[1] / 0.45, v[0] * gaze[0] + v[2] * gaze[2]];
  const cell = [[1.2875, 0.1125], [1.48625, 0.1125], [1.2875, 0.23125]];
  const C = cell.map(([x, y]) => clip(shaderWay(x, y, yh, yaw))), S = C.map(c => [c[0] / c[2], c[1] / c[2]]);
  for (const l of [[0.9, 0.05, 0.05], [0.4, 0.3, 0.3], [0.1, 0.1, 0.8]]) {
    // (a point of the screen in the triangle; the sheet's point there, interpolated and exact)
    const s = [0, 1].map(k => l[0] * S[0][k] + l[1] * S[1][k] + l[2] * S[2][k]);
    const iw = C.map(c => 1 / c[2]), d = l[0] * iw[0] + l[1] * iw[1] + l[2] * iw[2];
    const drawn = [0, 1].map(k => (l[0] * iw[0] * cell[0][k] + l[1] * iw[1] * cell[1][k] + l[2] * iw[2] * cell[2][k]) / d);
    // (exact: the point of the sheet whose way the screen's point looks along — x from the screen's x, y from its y)
    const o = s[0] * 0.45 * STAGE, x = o + STAGE / 2 + yaw, y = yh - s[1] * 0.45;
    assert.ok(Math.abs(drawn[0] - x) < 1e-9 && Math.abs(drawn[1] - y) < 1e-9, `${drawn} against ${[x, y]}`);
  }
});
