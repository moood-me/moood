// A mirror's `sky` (5.7): `"reflect": { "sky": false }` — the sky is not mirrored in it, only what stands before it;
// left out, the sky is in it as before. What the language takes, in node (no GPU); the image itself — no sky quads in
// the mirror's view, no sky past its painting in its pass — is RENDER's (render/quads.js admits, renderer.js solids).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compile } from '../engines/3/world/spec.js';

const lake = reflect => {
  const warned = [];
  const C = compile({ engine: 3, objects: [{ id: 'lake', plane: true, distance: 10, width: 20, depth: 20, water: true, reflect }] }, t => warned.push(t), x => x);
  return { r: C.elements.find(E => E.id === 'lake').reflect, warned };
};

test('a mirror shows the sky unless it says "sky": false', () => {
  assert.equal(lake(true).r.sky, true);
  assert.equal(lake({ strength: 0.3 }).r.sky, true);
  const { r, warned } = lake({ strength: 0.3, sky: false, fade: 0 });
  assert.equal(r.sky, false);
  assert.equal(r.strength, 0.3);
  assert.deepEqual(warned, []);
});

test('"sky" is true or false: anything else is said, and the mirror not taken', () => {
  const { r, warned } = lake({ sky: 'no' });
  assert.equal(r, null);
  assert.ok(warned.some(t => t.includes('"reflect"') && t.includes('sky true or false')));
});
