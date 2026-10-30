// The language's `trace` (play/minigame/gestures.js, docs/games/miniux/language.md §4.4): the ghost's stroke along the
// line — by default a px a ms, each piece 0.4 s at least, eased; with seconds the whole line in them at an even pace,
// the same number a game's own "too quick" reads (state.seconds). A stand-in layer and page; the ghost on a hand clock.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GESTURES } from '../play/minigame/gestures.js';
import { createGhost } from '../play/minigame/ghost.js';

function trace(points, o = {}) {
  const svg = () => ({ style: {}, setAttribute() {}, remove() {} });
  const layer = { k: () => 1, point: ref => points[ref] || null, svg, onPlace: () => () => {}, flash() {} };
  const mark = { follow() {}, do() {} };
  const feel = { tone: () => ({ set() {}, stop() {} }) };
  const opts = { on: mark, line: Object.keys(points), ...o };
  const g = GESTURES.trace({ layer, feel, mark, emit() {}, tap() {} }, opts);
  // (as index.js's handle.set: the gesture told, then the options changed)
  return { g, set: n => { g.set?.(n); Object.assign(opts, n); } };
}
const stroke = moves => moves.filter(m => m.down).slice(2, -1); // after the press and its dwell, before the end's rest

test('default: unchanged — a px a ms, each piece 0.4 s at least, eased', () => {
  const { g } = trace({ a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, c: { x: 700, y: 0 } });
  const s = stroke(g.demo());
  assert.deepEqual(s.map(m => m.ms), [400, 600]);
  assert.ok(s.every(m => !m.even));
  assert.equal(g.state.seconds, 1);
});

test('default: a line over 2000 px goes in 2 s', () => {
  const { g } = trace({ a: { x: 0, y: 0 }, b: { x: 1000, y: 0 }, c: { x: 4000, y: 0 } });
  assert.deepEqual(stroke(g.demo()).map(m => m.ms), [500, 1500]);
  assert.equal(g.state.seconds, 2);
});

test('seconds: the whole line in them, shared by length, at an even pace; state.seconds the same', () => {
  const { g } = trace({ a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, c: { x: 400, y: 0 } }, { seconds: 4 });
  const s = stroke(g.demo());
  assert.deepEqual(s.map(m => m.ms), [1000, 3000]);
  assert.ok(s.every(m => m.even));
  assert.equal(g.state.seconds, 4);
});

test('set({seconds}) changes the ghost and state.seconds; null — back to the default', () => {
  const t = trace({ a: { x: 0, y: 0 }, b: { x: 300, y: 0 } });
  t.set({ seconds: 3 });
  assert.equal(t.g.state.seconds, 3);
  assert.deepEqual(stroke(t.g.demo()).map(m => m.ms), [3000]);
  t.set({ seconds: null });
  assert.equal(t.g.state.seconds, 0.4);
  assert.deepEqual(stroke(t.g.demo()).map(m => m.ms), [400]);
});

test('the ghost: an even key is passed at a steady pace, an eased one slow at first', () => {
  const node = () => ({ style: {}, classList: { toggle() {} }, append() {}, hidden: false });
  globalThis.document = { createElement: node };
  let next = null;
  globalThis.requestAnimationFrame = fn => { next = fn; return 1; };
  globalThis.cancelAnimationFrame = () => {};
  const at = (even, t) => {
    const ghost = createGhost(node()), seen = [];
    ghost.show([{ moves: [{ x: 0, y: 0, down: true }, { x: 1000, y: 0, down: true, ms: 1000, even }], follow: p => p && seen.push(p.x) }]);
    next(0); next(t);
    ghost.stop();
    return seen[seen.length - 1];
  };
  assert.equal(Math.round(at(true, 250)), 250);
  assert.equal(Math.round(at(false, 250)), 125); // ease in-out: a quarter of the time, an eighth of the way
});
