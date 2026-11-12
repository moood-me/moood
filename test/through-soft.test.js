// A through-light's edge (scene-format-3: "through" … its edge "soft" (metres, 0.3; 0: sharp)): the number it says is
// WT4 `soft` — 0 too —; left out (or not a number of metres) 0.3. In node: no GPU.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTables } from '../engines/3/world/tables.js';
import { createLights } from '../engines/3/world/light.js';

const PANE = [[-3, 2, 2.5], [-3, 4, 2.5], [-3, 4, 0.5], [-3, 2, 0.5]];
// the world's lights of these through-lights' "soft" (undefined: left out) → each one's WT4 soft
function softs(...said) {
  const T = createTables();
  const lights = said.map((soft, k) => ({ id: `sun${k}`, from: [270, 30], through: [PANE], ...(soft === undefined ? {} : { soft }) }));
  const world = { tables: T, C: { lights }, elements: [], byId: new Map(), refOf: id => ({ id, copy: 0, name: null }), look: { lights: lights.map(() => 1) }, groundAt: () => 0 };
  createLights(world, () => undefined, () => {});
  return lights.map(l => T.lights.soft[T.lights.ids.indexOf(l.id)]);
}

test('soft 0 is a sharp edge; left out, 0.3; what it says, that', () => {
  const [zero, out, some] = softs(0, undefined, 0.12);
  assert.equal(zero, 0);
  assert.ok(Math.abs(out - 0.3) < 1e-6);
  assert.ok(Math.abs(some - 0.12) < 1e-6);
});

test('a soft that is no number of metres is the default', () => {
  const [negative, text] = softs(-1, 'wide');
  assert.ok(Math.abs(negative - 0.3) < 1e-6);
  assert.ok(Math.abs(text - 0.3) < 1e-6);
});
