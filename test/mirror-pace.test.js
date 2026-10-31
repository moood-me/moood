// A mirror's ripple's pace (scene-format-3: "reflect": { "ripple", "pace" }): how the language takes it, and the
// waves going on from where they were when a keyed pace moves (engines/3/render/wgsl/post.js ripplePaced).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compile, PACE_MOST } from '../engines/3/world/spec.js';
import { RIPPLE_HZ, ripplePaced } from '../engines/3/render/wgsl/post.js';

const lake = reflect => {
  const warns = [];
  const spec = compile({ engine: 3, objects: [{ id: 'lake', plane: true, water: true, distance: 10, width: 20, depth: 20, reflect }] }, w => warns.push(w));
  return { reflect: spec.elements.find(E => E.id === 'lake').reflect, warns };
};

test('pace: 1 by default, a number kept within 0…PACE_MOST, a state key kept as it is', () => {
  assert.equal(lake({ ripple: 0.5 }).reflect.pace, 1);
  assert.equal(lake(true).reflect.pace, 1);
  assert.equal(lake({ ripple: 0.5, pace: 0.2 }).reflect.pace, 0.2);
  assert.equal(lake({ ripple: 0.5, pace: 9 }).reflect.pace, PACE_MOST);
  const keyed = lake({ ripple: 0.5, pace: 'calm' });
  assert.equal(keyed.reflect.pace, 'calm');
  assert.deepEqual(keyed.warns, []);
});

test('a pace that is no number and no key is said, and the mirror not taken', () => {
  const { reflect, warns } = lake({ ripple: 0.5, pace: -1 });
  assert.equal(reflect, null);
  assert.equal(warns.length, 1);
  assert.match(warns[0], /pace/);
});

test('a pace that moves: every wave is where it was at that second, then goes at the new pace', () => {
  const at = (k, t, shift) => (k * t + shift) % 1;
  const shift = new Float64Array(4), t = 5000.37;
  ripplePaced(shift, t, 1, 0.2);
  for (let i = 0; i < 4; i++) {
    const before = at(Math.fround(RIPPLE_HZ[i] * 1), t, 0), after = at(Math.fround(RIPPLE_HZ[i] * Math.fround(0.2)), t, shift[i]);
    const gap = Math.abs(before - after);
    assert.ok(Math.min(gap, 1 - gap) < 1e-6, `wave ${i}: ${before} → ${after}`);
    assert.ok(shift[i] >= 0 && shift[i] < 1);
  }
});
