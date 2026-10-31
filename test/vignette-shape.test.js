// Engine 3's vignette shape (world/light.js createLook, world/spec.js WORDS.light): where it begins (a share of the
// short side, 0.35), where it is full (a share of the long side; none — 0.6 of the diagonal, as before), how far down
// its middle is (0.5); words of the light alone — a look's are not taken.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLook } from '../engines/3/world/light.js';
import { compile } from '../engines/3/world/spec.js';

const lookOf = (light, warned = []) => createLook(light, [], { tick: 0 }, w => warned.push(w)).update(() => 0);

test('not said: the vignette as it always was', () => {
  const l = lookOf({ vignette: 0.5 });
  assert.equal(l.vignetteInner, 0.35);
  assert.equal(l.vignetteOuter, null);
  assert.equal(l.vignetteCentre, 0.5);
});

test('said: taken as said', () => {
  const l = lookOf({ vignette: 0.96, vignetteInner: 0.25, vignetteOuter: 0.78, vignetteCentre: 0.49 });
  assert.deepEqual([l.vignetteInner, l.vignetteOuter, l.vignetteCentre], [0.25, 0.78, 0.49]);
});

test('out of its range: said, the default kept', () => {
  const warned = [];
  const l = lookOf({ vignetteInner: -1, vignetteOuter: 'far', vignetteCentre: 2 }, warned);
  assert.deepEqual([l.vignetteInner, l.vignetteOuter, l.vignetteCentre], [0.35, null, 0.5]);
  assert.equal(warned.length, 3);
});

test('the spec takes the shape on the light, not on a look', () => {
  const warned = [];
  compile({ engine: 3, light: { vignetteInner: 0.25, looks: { night: { vignetteOuter: 0.7 } } }, objects: [] }, w => warned.push(w));
  assert.deepEqual(warned.filter(w => w.includes('vignette')), ['light.looks.night: "vignetteOuter" is not a word of engine 3\'s language here — not taken']);
});
