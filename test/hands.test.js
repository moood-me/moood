// A hand of its own (engines/3/people/hand.js: a style's `palm`, with its fingers): drawn once — the palm skinned to
// the hand's joint, the fingers along their joints —, nothing of it worked out a frame; the fingers at ease written in
// place of the motion's without making anything; as big as the figure's skeleton, as broad as the figure; the styles
// without it as they were. In node: SOMA's skeleton read from engine 1's folder (no GPU).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import v8 from 'node:v8';
import vm from 'node:vm';

// (rig.js reads soma.bin by a request: here, from the file)
globalThis.XMLHttpRequest ??= class {
  open(method, url) { this.url = url; }
  send() {
    try {
      const b = readFileSync(fileURLToPath(this.url));
      this.status = 200;
      this.response = this.responseType === 'text' ? b.toString('utf8') : b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
      this.onload();
    } catch (err) { this.onerror(err); }
  }
};

const { loadPlayer, Player } = await import('../engines/3/people/player.js');
const { J, fitOf, poseOf, pose, bindLocals } = await import('../engines/3/people/rig.js');
const { look, ARENA } = await import('../engines/3/people/wardrobe.js');
const { createModel } = await import('../engines/3/people/shapes.js');
const { handOf } = await import('../engines/3/people/hand.js');
const rig = await loadPlayer();
const cast = { shapes: { styles: { storybook: { from: 'soft', name: 'storybook', arms: 'palm', fingers: true } } } };
const model = (style, who, body = {}) => createModel(look({ style, who, hair: 'none', garment: 'none', body }, cast), { rig, warn: t => assert.fail(t) });

// the palm's breadth (its widest section, across) and the middle finger's thickness, as handOf makes them for a body
const sizes = body => {
  const fit = fitOf(rig, { height: body.height ?? 1 }), P = poseOf();
  pose(rig, fit, bindLocals(rig), Float32Array.from(rig.rest.subarray(0, 3)), P);
  const H = handOf(rig, P, 'Right', { sigma: Math.sqrt(body.thick ?? 1), wrist: 0.017 * (body.height ?? 1) });
  const breadth = Math.max(...H.palm.rings.map(r => Math.max(...r.map(p => Math.max(...r.map(q => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])))))));
  return { breadth, finger: H.fingers[2].profile[0][1] };
};

test('a palmed style has its fingers at ease; one without a palm, or rigid, has none', () => {
  const M = model('storybook', 'man');
  assert.ok(M.hand && M.hand.joints.length === 38 && M.hand.q.length === 38 * 4, 'both hands: 4 × 4 fingers and 3 of the thumb, each');
  for (const style of ['soft', 'shadow', 'flat', 'toy', 'graphic', 'geometry']) assert.equal(model(style, 'man').hand, null, style);
});

test('the hand is drawn once: nothing of it a frame', () => {
  const M = model('storybook', 'woman'), I = M.state(), P = poseOf();
  pose(rig, M.fit, bindLocals(rig), Float32Array.from(rig.rest.subarray(0, 3)), P);
  M.pose(I, P, [0, 0, 0, 0, 1 / 60, 0, 0], false, []);
  assert.equal(ARENA.i, 0, 'the figure was not drawn again: its palm skinned, its fingers jointed');
  assert.equal(M.body.dyn.p.length, 0);
});

test('the player puts the fingers at ease in place of the motion\'s, making nothing', () => {
  const M = model('storybook', 'child'), p = new Player({ rig, fit: M.fit, warn: () => {} });
  p.hand = M.hand;
  const Q = p.Q;
  Q.fill(0);
  p.eased();
  for (let i = 0; i < M.hand.joints.length; i++) for (let c = 0; c < 4; c++) assert.equal(Q[M.hand.joints[i] * 4 + c], M.hand.q[i * 4 + c]);
  assert.equal(p.Q, Q);
  assert.ok(Q.subarray(0, 4).every(v => v === 0) && J > 38, 'the other joints as they were');
  v8.setFlagsFromString('--expose-gc');
  const gc = vm.runInNewContext('gc');
  for (let i = 0; i < 1000; i++) p.eased();
  gc();
  const before = process.memoryUsage().heapUsed;
  // (anything made a frame — one number on the heap is 16 bytes — would be megabytes here)
  const N = 1000000;
  for (let i = 0; i < N; i++) p.eased();
  const grown = process.memoryUsage().heapUsed - before;
  assert.ok(grown / N < 1, `${grown} bytes made by ${N} frames`);
});

test('the hand is as big as the skeleton, as broad as the figure', () => {
  const man = sizes({}), child = sizes({ height: 0.72 }), slight = sizes({ thick: 0.8 });
  assert.ok(Math.abs(child.breadth / man.breadth - 0.72) < 0.02, `a child's palm: ${child.breadth / man.breadth} of a man's`);
  assert.ok(Math.abs(child.finger / man.finger - 0.72) < 0.01, 'a child\'s fingers as thin as their size');
  assert.ok(slight.finger < man.finger * 0.92 && slight.breadth < man.breadth * 0.92, 'a slight figure\'s hand narrower, its fingers thinner');
});
