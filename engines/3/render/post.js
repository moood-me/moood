// The frame's targets and its end (4.3, 4.4; render/wgsl/post.js): `main` (colour rg11b10ufloat, depth reversed),
// `ids`, the frame's clip masks — all the size of the canvas's buffer —, the bloom's three (¼, 1⁄16, 1⁄64), the light
// gathered (1⁄16, and from it, wide and smooth, 1⁄128), and the passes after the main ones: bloom × 5 — the bright
// part to ¼, down to 1⁄16, down to 1⁄64, then up: the 1⁄64 added into the 1⁄16, that into the ¼, which so holds the
// three —, gather × 2 (the 1⁄16, then from it the 1⁄128; while the look has `bounce`, every second drawn frame), canvas — the one full-screen pass: bounce, the people's lines, bloom (one read
// of the ¼, a third of it: a third of its light each level), tone map, grade, edge smoothing, grain,
// the stage's veil (2.10: black laid over all of it, last), dither;
// the canvas is written display-encoded. The canvas's own size is set here, right before its view is taken (RN3:
// setting it clears it — only a call that draws does).
//   The grade is the look's (WT5), its numbers these: exposure from its brightness; its tint laid as soft light
// — as strong as it says, 0.5 at the most —, its saturation, its vignette at 0.75 of what it says — in display space;
// then its grain at 0.1.
import { CANVAS } from './wgsl/post.js';
import { FORMATS } from './library.js';

const BLOOM = 1 / 3, TINT_MOST = 0.5, VIGNETTE = 0.75, GRAIN = 0.1;
// a colour of the look (linear) as the display has it
const shown = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const unit = v => Math.min(1, Math.max(0, v));

export function createPost(gpu, lib) {
  const B = GPUBufferUsage, T = GPUTextureUsage;
  const linear = gpu.sampler('linear');
  const uniform = (name, bytes) => gpu.buffer(name, bytes, B.UNIFORM | B.COPY_DST);
  const canvasU = uniform('canvas', CANVAS.BYTES), data = new Float32Array(CANVAS.BYTES / 4);
  // the small passes' uniforms, by what each reads: the picture's rect of `main` (the bright part; the light
  // gathered), all of a bloom level (¼, 1⁄16, 1⁄64)
  const stageU = uniform('small stage', 32), levelU = [uniform('bloom 4', 32), uniform('bloom 16', 32), uniform('bloom 64', 32)], small = new Float32Array(8);
  // (with no people: inks of nothing, the same binding)
  const noInks = uniform('no inks', 4096);
  const pipes = { bright: lib.get('bloom-bright'), down: lib.get('bloom-down'), up: lib.get('bloom-up'), gather: lib.get('gather'), wide: lib.get('gather-wide'), canvas: lib.get('canvas') };
  let w = 0, h = 0, textures = [], groups = null, inksWith = null, drawn = 0;
  const X = { main: null, ids: null, depth: null, masks: null, gathered: false };
  const target = (name, format, tw, th) => { const t = gpu.texture(name, { size: [tw, th], format, usage: T.RENDER_ATTACHMENT | T.TEXTURE_BINDING }); textures.push(t); return t.createView(); };
  // a small pass's target: cleared — or kept, what is drawn added to it (the bloom going up)
  const cleared = { view: null, loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] }, kept = { view: null, loadOp: 'load', storeOp: 'store' };
  const clearedPass = { colorAttachments: [cleared] }, keptPass = { colorAttachments: [kept] };

  // the targets made for a buffer of w × h px (RN3)
  X.resize = (bw, bh) => {
    if (bw === w && bh === h) return false;
    w = bw; h = bh;
    for (const t of textures) gpu.drop(t);
    textures = [];
    X.main = target('main', FORMATS.MAIN, w, h); X.ids = target('ids', FORMATS.IDS, w, h); X.depth = target('depth', FORMATS.DEPTH, w, h); X.masks = target('masks', FORMATS.MASK, w, h);
    X.w4 = Math.max(1, w >> 2); X.h4 = Math.max(1, h >> 2); X.w16 = Math.max(1, w >> 4); X.h16 = Math.max(1, h >> 4); X.w64 = Math.max(1, w >> 6); X.h64 = Math.max(1, h >> 6); X.w128 = Math.max(1, w >> 7); X.h128 = Math.max(1, h >> 7);
    X.bloom4 = target('bloom 4', FORMATS.MAIN, X.w4, X.h4); X.bloom16 = target('bloom 16', FORMATS.MAIN, X.w16, X.h16); X.bloom64 = target('bloom 64', FORMATS.MAIN, X.w64, X.h64);
    X.gather = target('gather', FORMATS.GATHER, X.w16, X.h16); X.gatherWide = target('gather wide', FORMATS.GATHER, X.w128, X.h128);
    groups = null; X.gathered = false;
    return true;
  };
  function bind(inks) {
    if (groups && inksWith === inks) return;
    inksWith = inks;
    const smallOf = (u, src) => gpu.bind('small', [{ binding: 0, resource: { buffer: u } }, { binding: 1, resource: src }, { binding: 2, resource: X.depth }, { binding: 3, resource: linear }]);
    groups = {
      stage: smallOf(stageU, X.main), level4: smallOf(levelU[0], X.bloom4), level16: smallOf(levelU[1], X.bloom16), level64: smallOf(levelU[2], X.bloom64), gathered: smallOf(levelU[1], X.gather),
      canvas: gpu.bind('canvas', [{ binding: 0, resource: { buffer: canvasU } }, { binding: 1, resource: X.main }, { binding: 2, resource: X.depth }, { binding: 3, resource: X.ids },
        { binding: 4, resource: X.bloom4 }, { binding: 5, resource: X.gatherWide }, { binding: 6, resource: { buffer: inks || noInks } }, { binding: 7, resource: linear }]),
    };
  }
  // one triangle over a target: the target cleared to (0, 0, 0, alpha) — or, `add`, kept and added to
  const full = (name, view, pipe, group, alpha, add) => {
    if (add) kept.view = view; else { cleared.view = view; cleared.clearValue[3] = alpha; }
    const pass = gpu.pass(name, add ? keptPass : clearedPass);
    pass.setPipeline(pipe); pass.setBindGroup(0, group); pass.draw(3);
    pass.end();
  };
  // a small pass's uniform: the rect of its source it reads (px), the source's size, the near plane
  const sized = (u, x, y, rw, rh, sw, sh, near) => { small[0] = x; small[1] = y; small[2] = rw; small[3] = rh; small[4] = sw; small[5] = sh; small[6] = near; small[7] = 0; gpu.write(u, 0, small); };

  // The frame's end. look: the world's; veil: the stage's, 0…1 (f.veil); s: the picture's rect in the buffer, px (x, y, w, h — all of it: the frame's
  // view is the whole canvas, RN5); camera: the frame's (its picture is that rect); inks: PP11's, or null with no
  // people; reach: the haze's; tick; scale: buffer px a CSS px; timing: the stand's marks
  X.draw = (look, veil, s, camera, inks, reach, tick, scale, timing) => {
    const p = camera.proj, near = p[14];
    bind(inks);
    sized(stageU, s[0], s[1], s[2], s[3], w, h, near); sized(levelU[0], 0, 0, X.w4, X.h4, X.w4, X.h4, near); sized(levelU[1], 0, 0, X.w16, X.h16, X.w16, X.h16, near); sized(levelU[2], 0, 0, X.w64, X.h64, X.w64, X.h64, near);
    timing.mark('bloom');
    // (the bright part of the stage over all of the ¼; down, down; then up, each level added into the finer one)
    full('bloom', X.bloom4, pipes.bright, groups.stage, 1, false);
    full('bloom', X.bloom16, pipes.down, groups.level4, 1, false);
    full('bloom', X.bloom64, pipes.down, groups.level16, 1, false);
    full('bloom', X.bloom16, pipes.up, groups.level64, 1, true);
    full('bloom', X.bloom4, pipes.up, groups.level16, 1, true);
    const bounce = look.bounce > 0;
    if (bounce && (!X.gathered || (drawn & 1) === 0)) { timing.mark('gather'); full('gather', X.gather, pipes.gather, groups.stage, 0, false); full('gather', X.gatherWide, pipes.wide, groups.gathered, 0, false); X.gathered = true; }
    drawn++;
    timing.mark('canvas');
    data.fill(0);
    data.set(s, CANVAS.STAGE / 4);
    data[CANVAS.SIZE / 4] = w; data[CANVAS.SIZE / 4 + 1] = h; data[CANVAS.NEAR / 4] = near; data[CANVAS.VEIL / 4] = unit(veil);
    data[CANVAS.EXPOSURE / 4] = Math.pow(Math.max(0, look.brightness), 2.2); data[CANVAS.BLOOM / 4] = BLOOM; data[CANVAS.BOUNCE / 4] = bounce && X.gathered ? look.bounce : 0;
    const tint = look.tint;
    data[CANVAS.TINT_A / 4] = tint ? Math.min(TINT_MOST, unit(look.tintStrength)) : 0;
    for (let k = 0; k < 3; k++) {
      data[CANVAS.TINT / 4 + k] = tint ? shown(tint[k]) : 0.5;
      data[CANVAS.AMBIENT / 4 + k] = look.ambientColor[k] * Math.pow(Math.max(0, look.ambient), 2.2);
      data[CANVAS.HAZE / 4 + k] = look.hazeColor[k];
    }
    data[CANVAS.SAT / 4] = Math.max(0, look.saturation); data[CANVAS.VIG / 4] = VIGNETTE * unit(look.vignette); data[CANVAS.GRAIN / 4] = GRAIN * unit(look.grain);
    data[CANVAS.LINES / 4] = inks ? 1 : 0; data[CANVAS.SCALE / 4] = scale; data[CANVAS.TICK / 4] = tick % 1024;
    // (a pixel of the buffer → its way from the eye a metre ahead: the rect is the lens's picture, whose own middle is
    // the projection's)
    const u = CANVAS.UNPROJECT / 4;
    data[u] = 2 / (s[2] * p[0]); data[u + 1] = 2 / (s[3] * p[5]); data[u + 2] = (1 - p[8]) / p[0] + s[0] * data[u]; data[u + 3] = (1 + p[9]) / p[5] + s[1] * data[u + 1];
    data[CANVAS.HAZE / 4 + 3] = 1 / reach;
    gpu.write(canvasU, 0, data);
    gpu.size(w, h);
    full('canvas', gpu.canvasView(), pipes.canvas, groups.canvas, 1, false);
  };
  return X;
}
