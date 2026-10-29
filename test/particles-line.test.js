// Particles born along a line (scene-format-3: "source": [8, 0, 0] — drips off an eave): the box's other sizes 0,
// the example's fields all words of the language, said nothing.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileParticles } from '../engines/3/world/emitters.js';

test('drips off an eave: a line 8 m long, falling, no warning', () => {
  const warns = [];
  const p = compileParticles({ kind: 'drops', flat: false, source: [8, 0, 0], rate: 6, life: [1.2, 1.6], gravity: 9.8, drag: 0.1, streak: 0.03, ground: 'splash', settle: 0.1 }, 'eave_drips', w => warns.push(w), false);
  assert.deepEqual(warns, []);
  assert.deepEqual(p.source, [4, 0, 0]);
  assert.equal(p.flat, false);
  assert.deepEqual(p.direction.map(x => x + 0), [0, -1, 0]);
});
