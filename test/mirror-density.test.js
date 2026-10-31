// Engine 3's mirror image density (render/mirrors.js imageDensity, 5.7): px of the image a px of the frame — its own
// density by its roughness, and the image within a share of the frame's px; no fixed side. Numbers in node (no GPU).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MIRROR } from '../engines/3/base.js';
import { imageDensity } from '../engines/3/render/mirrors.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test('a small mirror is drawn at its own density, whatever its shape', () => {
  near(imageDensity(0, false, 300, 200, 1920, 1080), MIRROR.DENSITY);
  near(imageDensity(0.08, false, 300, 200, 1920, 1080), MIRROR.DENSITY / 1.24);
  near(imageDensity(0, true, 300, 200, 1920, 1080), MIRROR.GLASS);
  // (a very rough one: a quarter at the least)
  near(imageDensity(1, false, 300, 200, 1920, 1080), 0.25);
});

test('a wide, low mirror is not squeezed into a fixed side', () => {
  // (the lake: the frame's width, under half its height — before, 511 px across: 0.266)
  const d = imageDensity(0.08, false, 1920, 507, 1920, 1080);
  near(d, MIRROR.DENSITY / 1.24);
  assert.ok(d * 1920 > 1100);
});

test('a large image is held to its share of the frame, on every frame size', () => {
  for (const [sw, sh] of [[1920, 1080], [1600, 900], [960, 540]]) {
    const d = imageDensity(0, false, sw, sh, sw, sh);
    near(d * d * sw * sh, MIRROR.SHARE * sw * sh);
    const half = imageDensity(0, false, sw, sh / 2, sw, sh);
    assert.ok(half * half * sw * sh / 2 <= MIRROR.SHARE * sw * sh + 1e-6);
  }
});
