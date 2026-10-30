// The language's `lead` (play/minigame/gestures.js, docs/games/miniux/language.md §4.9): by default its track is laid
// level where the finger presses; with from/to it lies between two points (as marks follow them: each frame), the knob
// going along it with the finger's offset. A stand-in layer: points by ref, the paths' elements as attribute bags.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GESTURES } from '../play/minigame/gestures.js';

function stand(points = {}) {
  const placers = new Set(), els = [];
  const svg = () => {
    const e = { a: {}, style: {}, classList: new Set(), setAttribute(k, v) { this.a[k] = +v; }, remove() {}, animate() {} };
    e.classList.contains = e.classList.has; e.classList.remove = e.classList.delete;
    els.push(e);
    return e;
  };
  const layer = {
    k: () => 1, window: () => ({ x: 0, y: 0, w: 800, h: 600 }), allowed: () => ({ x0: 0, x1: 800, y0: 0, y1: 600 }),
    point: ref => points[ref] || null, svg, onPlace: fn => { placers.add(fn); return () => placers.delete(fn); },
  };
  const feel = { tone: () => ({ set() {}, stop() {} }) };
  const g = o => GESTURES.lead({ layer, feel, mark: null, emit() {}, tap() {} }, o);
  return { g, els, points, place: () => { for (const fn of placers) fn(); } };
}
const ends = t => [t.a.x1, t.a.y1, t.a.x2, t.a.y2].map(v => Math.round(v));
const knobAt = k => [Math.round(k.a.cx), Math.round(k.a.cy)];

test('default: a level track where the finger presses, the knob with its offset', () => {
  const s = stand(), l = s.g({});
  const [track, knob] = s.els;
  l.down({ x: 300, y: 400 });
  assert.deepEqual(ends(track), [100, 400, 500, 400]); // half: a quarter of the window's 800
  l.move({ x: 400, y: 450 });
  assert.equal(l.state.knob, 0.5);
  assert.deepEqual(knobAt(knob), [400, 400]);
});

test('from/to: the track lies between the points, resting there before any touch', () => {
  const s = stand({ 'gurov#hand': { x: 200, y: 200 }, 'spitz#head': { x: 400, y: 500 } }), l = s.g({ from: 'gurov#hand', to: 'spitz#head' });
  const [track, knob] = s.els;
  assert.deepEqual(ends(track), [200, 200, 400, 500]);
  assert.deepEqual(knobAt(knob), [300, 350]);
  assert.ok(track.classList.has('mg-idle'));
  l.down({ x: 700, y: 100 }); // pressed anywhere: the track stays where its points are
  assert.deepEqual(ends(track), [200, 200, 400, 500]);
});

test('from/to: the knob goes along the segment with the finger’s offset projected on it; to is +1', () => {
  const s = stand({ a: { x: 100, y: 100 }, b: { x: 100, y: 300 } }), l = s.g({ from: 'a', to: 'b' }); // down the screen, half 100
  const knob = s.els[1];
  l.down({ x: 600, y: 50 });
  l.move({ x: 650, y: 100 }); // sideways ignored, 50 down: half way to `to`
  assert.equal(l.state.knob, 0.5);
  assert.deepEqual(knobAt(knob), [100, 250]);
  l.move({ x: 600, y: -400 }); // far up: −1 at most
  assert.equal(l.state.knob, -1);
  assert.deepEqual(knobAt(knob), [100, 100]);
});

test('from/to: the track follows a moving point each frame, the finger down', () => {
  const s = stand({ a: { x: 100, y: 100 }, b: { x: 300, y: 100 } }), l = s.g({ from: 'a', to: 'b' });
  const [track, knob] = s.els;
  l.down({ x: 500, y: 500 });
  l.move({ x: 550, y: 500 }); // knob 0.5
  s.points.b = { x: 100, y: 300 }; // the dog ran: now straight down from a
  s.place();
  assert.deepEqual(ends(track), [100, 100, 100, 300]);
  assert.deepEqual(knobAt(knob), [100, 250]);
});

test('from/to: a point unseen hides the track; seen again, it is back', () => {
  const s = stand({ a: { x: 100, y: 100 }, b: { x: 300, y: 100 } }), l = s.g({ from: 'a', to: 'b' });
  const [track] = s.els;
  delete s.points.b; s.place();
  assert.equal(track.style.display, 'none');
  s.points.b = { x: 300, y: 300 }; s.place();
  assert.equal(track.style.display, '');
  assert.deepEqual(ends(track), [100, 100, 300, 300]);
  l.remove();
});

test('from without to is an error', () => {
  const s = stand({ a: { x: 0, y: 0 } });
  assert.throws(() => s.g({ from: 'a' }), /from and to together/);
});
