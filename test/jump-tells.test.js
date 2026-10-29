// A game's jump (bespoke.show's `then`: engine 3's director simulating in its instant mode) tells the game nothing:
// what the scene tells or signals there is said in the scene's warnings — a game waiting for it would wait in vain.
// Outside a jump nothing is said: posted as ever; a seek's or a restore's unseen steps (simulating alone) stay quiet.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDirector } from '../engines/3/play/director.js';

function director() {
  const warns = [], posts = [];
  const state = { now: {}, get: () => undefined, value: () => undefined, use() {}, set() {}, cut() {} };
  const d = createDirector({ state, world: { elements: [], people: null, C: { lights: [] } }, camera: {}, shots: {}, anim: {}, kit: {}, lib: {}, speech: false, warn: w => warns.push(w), report: (who, err) => { throw err; }, post: m => posts.push(m) });
  return { d, warns, posts, scene: d.api('scene', null) };
}

test('a tell and a signal in a jump: said, not posted', () => {
  const { d, warns, posts, scene } = director();
  d.simulating = true; d.instant = true;
  scene.tell('beat:porch_end');
  d.signal('door_shut');
  assert.equal(posts.length, 0);
  assert.equal(warns.length, 2);
  assert.match(warns[0], /told "beat:porch_end".*not in "then"/);
  assert.match(warns[1], /signalled "door_shut"/);
});

test('outside a jump: posted, nothing said', () => {
  const { d, warns, posts, scene } = director();
  scene.tell('beat:school');
  d.signal('bell');
  assert.deepEqual(posts.map(p => p.type), ['tell', 'signal']);
  assert.equal(warns.length, 0);
});

test('a seek or a restore (simulating alone) and the page\'s instant mode alone: nothing said', () => {
  const a = director();
  a.d.simulating = true;
  a.scene.tell('beat:x');
  assert.equal(a.warns.length + a.posts.length, 0);
  const b = director();
  b.d.instant = true;
  b.scene.tell('beat:x');
  assert.equal(b.warns.length, 0);
  assert.deepEqual(b.posts.map(p => p.type), ['tell']);
});
