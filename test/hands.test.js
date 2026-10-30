// A hand of its own (engines/3/people/hand.js: a style's `fingers` — a palm with the fingers on it — or `mitten`):
// drawn once, whole, skinned to the hand's joint — nothing of it worked out a frame; as big as the figure's skeleton,
// as broad as the figure; either hand made in every style, on every body; a style with neither as it was. In node:
// SOMA's skeleton read from engine 1's folder (no GPU).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

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

const { loadPlayer } = await import('../engines/3/people/player.js');
const { fitOf, poseOf, pose, bindLocals } = await import('../engines/3/people/rig.js');
const { look, ARENA } = await import('../engines/3/people/wardrobe.js');
const { createModel } = await import('../engines/3/people/shapes.js');
const { handOf } = await import('../engines/3/people/hand.js');
const rig = await loadPlayer();
const STYLES = ['soft', 'toy', 'shadow', 'graphic', 'geometry', 'flat'];
const cast = { shapes: { styles: Object.fromEntries(STYLES.flatMap(st => [
  [`${st}_m`, { from: st, name: st, mitten: true, fingers: false }], [`${st}_f`, { from: st, name: st, fingers: true }], [`${st}_0`, { from: st, name: st, mitten: false, fingers: false }]])) } };
const model = (style, who, warn = t => assert.fail(`${style} ${who}: ${t}`)) => createModel(look({ style, who, hair: 'none', garment: 'none' }, cast), { rig, warn });

// a hand as handOf makes it for a body: its palm's breadth (its widest section), the middle finger's thickness at its root
const sizes = body => {
  const fit = fitOf(rig, { height: body.height ?? 1 }), P = poseOf();
  pose(rig, fit, bindLocals(rig), Float32Array.from(rig.rest.subarray(0, 3)), P);
  const H = handOf(rig, P, 'Right', { sigma: Math.sqrt(body.thick ?? 1), wrist: 0.017 * (body.height ?? 1) });
  const widest = rings => Math.max(...rings.map(r => Math.max(...r.map(p => Math.max(...r.map(q => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])))))));
  return { breadth: widest(H.fingers[0].rings), finger: widest(H.fingers[2].rings.slice(1, 2)) };
};

test('either hand, in every style, on every body: made without a word said, skinned whole, nothing of it a frame', () => {
  for (const st of STYLES) for (const k of ['m', 'f']) for (const who of ['man', 'woman', 'child', 'toddler', 'smith']) {
    const M = model(`${st}_${k}`, who);
    assert.equal(M.body.dyn.p.length, 0);
  }
  for (const style of ['soft_m', 'soft_f', 'shadow_f', 'geometry_m']) {
    const M = model(style, 'woman'), I = M.state(), P = poseOf();
    pose(rig, M.fit, bindLocals(rig), Float32Array.from(rig.rest.subarray(0, 3)), P);
    M.pose(I, P, [0, 0, 0, 0, 1 / 60, 0, 0], false, []);
    assert.equal(ARENA.i, 0, `${style}: the figure was not drawn again — its hands skinned to their joints`);
  }
});

test('a hand is cheaper than the wires it took the place of; a style with neither hand as it was', () => {
  const vertices = M => M.body.skin.count + M.body.tubes.count;
  assert.ok(vertices(model('soft_f', 'man')) < vertices(model('soft_0', 'man')) + 1400, 'fingers: a palm, five pieces, both hands');
  assert.ok(vertices(model('soft_m', 'man')) < vertices(model('soft_f', 'man')), 'a mitten, less');
  assert.equal(model('toy', 'man').body.skin.count, model('toy_0', 'man').body.skin.count);
});

test('the hand is as big as the skeleton, as broad as the figure', () => {
  const man = sizes({}), child = sizes({ height: 0.72 }), slight = sizes({ thick: 0.8 });
  assert.ok(Math.abs(child.breadth / man.breadth - 0.72) < 0.03, `a child's palm: ${child.breadth / man.breadth} of a man's`);
  assert.ok(Math.abs(child.finger / man.finger - 0.72) < 0.03, `a child's fingers: ${child.finger / man.finger} of a man's`);
  assert.ok(slight.finger < man.finger * 0.92 && slight.breadth < man.breadth * 0.95, 'a slight figure: its hand narrower, its fingers thinner');
});
