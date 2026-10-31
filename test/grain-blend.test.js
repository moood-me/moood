// Engine 3's grain blend (world/light.js createLook, world/spec.js WORDS.light): "overlay" by default, "normal" when
// the light says so, any other word said and overlay kept; a word of the light alone — a look's is not taken.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLook } from '../engines/3/world/light.js';
import { compile } from '../engines/3/world/spec.js';

const lookOf = (light, warned = []) => createLook(light, [], { tick: 0 }, w => warned.push(w)).update(() => 0);

test('the grain is overlay unless the light says normal', () => {
  assert.equal(lookOf({ grain: 0.5 }).grainBlend, 'overlay');
  assert.equal(lookOf({ grain: 0.5, grainBlend: 'overlay' }).grainBlend, 'overlay');
  assert.equal(lookOf({ grain: 0.86, grainBlend: 'normal' }).grainBlend, 'normal');
});

test('another word is said, and overlay kept', () => {
  const warned = [];
  assert.equal(lookOf({ grainBlend: 'screen' }, warned).grainBlend, 'overlay');
  assert.equal(warned.length, 1);
  assert.match(warned[0], /light\.grainBlend/);
});

test('a look mixing its grain keeps the light\'s blend', () => {
  const made = createLook({ grain: 0, grainBlend: 'normal', looks: { night: { grain: 1 } } }, [], { tick: 0 }, () => {});
  const now = made.update(k => (k === 'night' ? 0.5 : 0));
  assert.equal(now.grain, 0.5);
  assert.equal(now.grainBlend, 'normal');
});

test('the spec takes grainBlend on the light, not on a look', () => {
  const warned = [];
  compile({ engine: 3, light: { grainBlend: 'normal', looks: { night: { grainBlend: 'normal' } } }, objects: [] }, w => warned.push(w));
  assert.deepEqual(warned.filter(w => w.includes('grainBlend')), ['light.looks.night: "grainBlend" is not a word of engine 3\'s language here — not taken']);
});
