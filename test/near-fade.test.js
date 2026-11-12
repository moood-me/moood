// What stands upright fades as the eye passes it close by (5.17) by how far it is FROM THE EYE, not by its depth along
// the gaze (moood-me/moood#8): the renderer's test of whether a card may fade at all (render/views.js nearestOf — the
// eye's distance to the card's nearest point) and the pass's two numbers. In node: no GPU.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PASS } from '../engines/3/base.js';

import { nearestOf } from '../engines/3/render/views.js';

// a card's four placed corners — (l, t), (r, t), (l, b), (r, b) — from its top-left corner and its two sides
const card = (o, right, down) => [o, [o[0] + right[0], o[1] + right[1], o[2] + right[2]], [o[0] + down[0], o[1] + down[1], o[2] + down[2]], [o[0] + right[0] + down[0], o[1] + right[1] + down[1], o[2] + right[2] + down[2]]];
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);

test('a curtain straight ahead: its distance is the eye\'s to its plane', () => {
  // (a sheet 2 m wide across the gaze, 0.2 m before an eye at 1.6 m)
  const C = card([-1, 2.5, -0.2], [2, 0, 0], [0, -2.5, 0]);
  close(nearestOf([0, 1.6, 0], C), 0.2);
  assert.ok(nearestOf([0, 1.6, 0], C) < PASS.TO);
});

test('a desk\'s front below the lens in a close-up is not near: it does not fade', () => {
  // (the lens 35 cm over a desk top at 0.76 m and 25 cm behind its front edge, looking down; the front face hangs
  // from the top's edge, 1 m wide. Along the gaze — straight down — its top edge is 35 cm before the eye: the old
  // fade took it as passed. From the eye it is 43 cm off — and its middle, where most of it is, farther)
  const C = card([-0.5, 0.76, -0.25], [1, 0, 0], [0, -0.17, 0]);
  const d = nearestOf([0, 1.11, 0], C);
  close(d, Math.hypot(0.35, 0.25));
  assert.ok(d > 0.35);
});

test('a card beside the eye: its nearest side', () => {
  // (a wall running along the gaze 0.8 m to the right, from 1 m behind the eye to 3 m before it)
  const C = card([0.8, 3, 1], [0, 0, -4], [0, -3, 0]);
  close(nearestOf([0, 1.6, 0], C), 0.8);
  // (the eye past its near end: to that end)
  close(nearestOf([0, 1.6, 2], C), Math.hypot(0.8, 1));
  // (over its top)
  close(nearestOf([0.8, 3.5, 0], C), 0.5);
});

test('a sheared card (a parallelogram) still measured to its own points', () => {
  const C = card([0, 1, -1], [1, 0, 0], [0.5, -1, 0]);
  // (under the eye's foot on its plane, inside it)
  close(nearestOf([0.6, 0.5, 0], C), 1);
  // (left of its slanted side: to that side, not to the rectangle's)
  const d = nearestOf([-0.5, 0.5, -1], C), s = [0.5, -1, 0], l = Math.hypot(...s), p = [-0.5, -0.5, 0], f = (p[0] * s[0] + p[1] * s[1]) / l ** 2;
  close(d, Math.hypot(p[0] - f * s[0], p[1] - f * s[1]));
});

test('the pass: gone at 10 cm from the eye, whole from 30 — the desk\'s front under a lens 35 cm over the top is whole', () => {
  assert.equal(PASS.FROM, 0.1);
  assert.equal(PASS.TO, 0.3);
  // (the desk of the test above: its front is past the band)
  assert.ok(nearestOf([0, 1.11, 0], card([-0.5, 0.76, -0.25], [1, 0, 0], [0, -0.17, 0])) >= PASS.TO);
});
