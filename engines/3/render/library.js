// The pipelines' library (RN2, RN10, 4.5): the closed set of render pipelines of a world, asked all at once as soon
// as its spec is compiled — a repaint, a change of clothes, a cut never makes one — and RENDER's bind group layouts
// (GP7). A pipeline is a key: its module is assembled from named chunks by plain functions (GP5), its targets and
// depth are 4.3's — one module for each distinct assembled text, whatever number of keys it serves. A pipeline a
// world needs and did not ask is an engine fault (thrown), never a late compile.
//   Every pipeline that draws the world has the layout: group 0 `frame`, group 1 `view` or `viewCast`, group 2 its
// family's, group 3 `none` or `person` — and declares the main passes' targets (colour, `ids`, depth) in every world:
// one set serves `main-solid` and `main-blend`. A mirror's pass has a set of its own (a world that reflects or has a
// pane): its image has an alpha (4.3), so its pipelines declare that format — the same modules, the keys with
// `:mirror` —, with no receiver variant among them: in a mirror everything is lit at its vertices.
//   Keys. In every world, made at createRenderer: sky, sky-base (the sky past its painting), glow, multiply (what only
// paint code tells has its pipeline in every world), and the engine's own pictures — bake, air, air-halo, air-sum,
// air-sky, blob, shadow-clear (a static
// cell emptied before it is drawn again), bloom-bright, bloom-down, bloom-up, gather, canvas. By what a world has:
// solid, blend, and for a mixed sheet cut (its opaque paint, with depth) and edge (its other pixels, under the
// strict depth test) — with casters each one's receiver too (…-recv) and cast; mask; insert; own:<n> — one blend a
// distinct own-shader text, always with the receiver's arithmetic, and its painting's opaque paint and the rest when
// it has some, own-cut:<n> and own-edge:<n> (as a mixed sheet's cut and edge) — and, with casters, own-cast:<n>; with people,
// mark and own-mark:<n> (what blends laid again where it is opaque: the ids behind it cleared); sky-base:own:<n>
// (and :mirror) — the sky's base with its first element's own shader (has.skyOwn); land-solid,
// land-blend; beam (a light's cone in the haze, per pixel: has.beams); particles, particles-cast; mirror-plane, mirror-glass,
// mirror-step, mirror-ready (a rough mirror's image smeared) and the mirror's set — solid, cut, edge, blend, multiply, sky, sky-base, land-solid, land-blend, own:<n>, own-cut:<n>, own-edge:<n>,
// glow, each `:mirror`; person:<kind>:<main | depth>, and person:<kind>:main:mirrored — of the mirror's set, the
// winding turned.
//   An own shader's text is one chunk, own.<n>, and its pipelines; when a world is replaced, those of texts neither
// the new world nor the one being made ready has are let go (lib.keep: gpu.forget, forget — RN2). A text that does
// not compile, or has an `enable` or a `requires`, is an error of the scene's build: its faults come from gpu.module
// to this library alone (GP5), are kept on the text's record and said once, with the elements that have the text and
// the author's line (lib.fault: LG13). A refused text has no module, and no pipeline is asked of it.
//   This module touches nothing of a browser as it is imported: the whole-set check reads it in node (BD4) and calls
// layouts(gpu), all(gpu, has) and exercise(gpu).
import { assemble, chunk, forget } from '../gpu/wgsl.js';
import { DEPTH, SHEET, LIGHT } from '../base.js';
import { NODE_BYTES, QUAD_BYTES, LAYER_BYTES } from '../world/tables.js';
import '../world/world.wgsl.js';
import '../sheets/sheets.wgsl.js';
import { PERSON_KINDS, PERSON_CARRY, exercisePeople } from '../people/person.wgsl.js';
import { GUST_WAVES, RING, BURSTS } from '../world/emitters.js';
import { FRAME, VIEWU, LIT, GRID, SHADOWS, AIR } from './wgsl/frame.js';
import './wgsl/light.js';
import { SHAPE, OWN_BYTES } from './wgsl/quad.js';
import { LAND } from './wgsl/land.js';
import { PT } from './wgsl/particles.js';
import './wgsl/person.js';
import './wgsl/sky.js';
import { CANVAS, MIRROR, READY, HALO } from './wgsl/post.js';
import { shapes } from './quads.js';

export const FORMATS = Object.freeze({ MAIN: 'rg11b10ufloat', IDS: 'rgba8uint', DEPTH: 'depth32float', MIRROR: 'rgba16float', AIR: 'rgba16float', GATHER: 'rgba16float', MASK: 'rgba8unorm', BLOB: 'r8unorm', LAND_SHADOW: 'rgba32float', HEIGHTS: 'r32float' });

PERSON_KINDS.forEach(K => { chunk(`person.${K.name}.vertex`, K.vertex); chunk(`person.${K.name}.surface`, K.surface); });

// ── RENDER's layouts (GP7) ──
export function layouts(gpu) {
  const V = GPUShaderStage.VERTEX, F = GPUShaderStage.FRAGMENT, VF = V | F;
  const uniform = (binding, visibility) => ({ binding, visibility, buffer: { type: 'uniform' } });
  const storage = (binding, visibility) => ({ binding, visibility, buffer: { type: 'read-only-storage' } });
  const texture = (binding, visibility, sampleType, viewDimension = '2d') => ({ binding, visibility, texture: { sampleType, viewDimension } });
  const sampler = (binding, visibility, type) => ({ binding, visibility, sampler: { type } });
  // (the land's field is the view's: group 1. The family's group has the leaves)
  gpu.layout('land', [storage(0, V)]);
  gpu.layout('particles', [storage(0, V), storage(1, V), texture(2, F, 'float', '2d-array'), texture(3, F, 'depth')]);
  gpu.layout('own', [uniform(0, F)]);
  gpu.layout('mirror', [uniform(0, F), texture(1, F, 'float')]);
  // (a rough mirror's image smeared: its uniform, what it reads)
  gpu.layout('ready', [uniform(0, F), texture(1, F, 'float'), sampler(2, F, 'filtering')]);
  gpu.layout('bake', [uniform(0, F), texture(1, F, 'unfilterable-float'), uniform(2, F)]);
  // (the air's passes write the air: their group 1 is `view` without what they may not read, and without a field)
  gpu.layout('air', [uniform(0, VF), texture(1, F, 'depth'), texture(2, F, 'depth'), sampler(3, F, 'comparison'), uniform(4, F)]);
  gpu.layout('sum', [texture(0, F, 'float')]);
  // (a beam in the haze: the scene's depth, read where `main-blend` holds it read-only)
  gpu.layout('beam', [texture(0, F, 'depth')]);
  gpu.layout('blob', [uniform(0, V)]);
  gpu.layout('small', [uniform(0, F), texture(1, F, 'float'), texture(2, F, 'depth'), sampler(3, F, 'filtering')]);
  gpu.layout('canvas', [uniform(0, F), texture(1, F, 'float'), texture(2, F, 'depth'), texture(3, F, 'uint'), texture(4, F, 'float'), texture(5, F, 'float'),
    uniform(6, F), sampler(7, F, 'filtering')]);
}

// (premultiplied, on colour and on alpha: a mirror's image keeps the alpha as how much of an image there is — 5.7)
const PREMULT = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } };
const MULTIPLY = { color: { srcFactor: 'dst', dstFactor: 'zero' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } };
const ADDED = { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } };
// (light added: the colour, the alpha left as it is)
const LIGHT_ADDED = { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } };
const MOST = { color: { operation: 'max', srcFactor: 'one', dstFactor: 'one' }, alpha: { operation: 'max', srcFactor: 'one', dstFactor: 'one' } };
// the targets of the passes that draw the world — the main passes' (colour `main`), a mirror's (its image): what is
// solid writes the colour and the ids; what blends writes no id
const solid = (format = FORMATS.MAIN) => [{ format }, { format: FORMATS.IDS }];
const blended = (blend, format = FORMATS.MAIN) => [{ format, blend }, { format: FORMATS.IDS, writeMask: 0 }];
// (the mark — what blends, laid again where its paint is opaque: the ids alone)
const MARKED = [{ format: FORMATS.MAIN, writeMask: 0 }, { format: FORMATS.IDS }];
const DEPTHS = {
  solid: { format: FORMATS.DEPTH, depthWriteEnabled: true, depthCompare: 'greater' },
  // (what blends: tested against the solid depth, toward the eye by a hair — layers of one element lie in one plane)
  blend: { format: FORMATS.DEPTH, depthWriteEnabled: false, depthCompare: 'greater-equal', depthBias: DEPTH.BIAS, depthBiasSlopeScale: DEPTH.SLOPE },
  // (a mixed sheet's other pixels: strictly before what lies there, no bias — where its own `cut` laid depth they
  // are rejected before any read: 5.17)
  edge: { format: FORMATS.DEPTH, depthWriteEnabled: false, depthCompare: 'greater' },
  tested: { format: FORMATS.DEPTH, depthWriteEnabled: false, depthCompare: 'greater-equal' },
  over: { format: FORMATS.DEPTH, depthWriteEnabled: false, depthCompare: 'always' },
  // (a light's view: away from the light by a hair, so what casts does not shade itself)
  cast: { format: FORMATS.DEPTH, depthWriteEnabled: true, depthCompare: 'greater', depthBias: -DEPTH.BIAS, depthBiasSlopeScale: -2 * DEPTH.SLOPE },
};
// the quads' two vertex buffers (4.1): the corners of every shape; the order, a row an instance — the quad, the
// shape, the origin page, the edge-on fade, the corners of a part of the SCREEN shape's piece (four vec3f)
const QUAD_BUFFERS = [
  { arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }] },
  { arrayStride: 68, stepMode: 'instance', attributes: [{ shaderLocation: 1, offset: 0, format: 'uint32' }, { shaderLocation: 2, offset: 4, format: 'uint32' },
    { shaderLocation: 3, offset: 8, format: 'sint32x2' }, { shaderLocation: 4, offset: 16, format: 'float32' }, { shaderLocation: 5, offset: 20, format: 'float32x3' },
    { shaderLocation: 6, offset: 32, format: 'float32x3' }, { shaderLocation: 7, offset: 44, format: 'float32x3' }, { shaderLocation: 8, offset: 56, format: 'float32x3' }] },
];
// a glow's row, a halo's: three vec4f an instance
const ROWS3 = [{ arrayStride: 48, stepMode: 'instance', attributes: [0, 1, 2].map(k => ({ shaderLocation: k, offset: 16 * k, format: 'float32x4' })) }];
// the air's programs and the beam's: the frame's group, the lights, no field of the land (the air's group 1 is `air`,
// the beam's `view`)
const AIR_CHUNKS = ['render.common', 'frame', 'render.light', 'render.relief.none'];
const BLOB_BUFFERS = [{ arrayStride: 32, stepMode: 'instance', attributes: [0, 1].map(k => ({ shaderLocation: k, offset: 16 * k, format: 'float32x4' })) }];

// the chunks of a quad's program: what is drawn through a light's view or into a mask (`viewCast`) has no field of
// the land and no light
function quadChunks({ mode, own = null, land = false, mirror = false }) {
  const flat = mode === 'cast' || mode === 'mask', lit = !flat && mode !== 'multiply' && mode !== 'mark';
  return ['render.common', 'frame', 'world', 'sheets', 'render.motion', ...(lit ? ['render.light'] : []), flat ? 'render.relief.none' : 'render.relief', 'render.quad.io', 'render.quad.lit',
    land ? 'render.land' : 'render.quad.vertex', ...(own ? ['render.own', `own.${own.n}`] : []), 'render.quad.fragment', ...(mirror ? ['render.mirror'] : [])];
}

// an own shader's text has one number for the page's life (its chunk's name): never given twice
let ownNumbers = 0;

const libraries = new WeakMap();
// the library of a gpu (one a mount; the check's own)
export function libraryOf(gpu) {
  let lib = libraries.get(gpu);
  if (lib) return lib;
  const made = new Map(), asked = new Map(), layoutsBy = new Map();
  // the people's pipelines, made: four a kind — (main | depth) × (as it is | the winding turned) — by a number (5.16)
  const kindAt = new Map(PERSON_KINDS.map((K, k) => [K.name, k])), persons = new Array(4 * PERSON_KINDS.length).fill(null);
  const personAt = (name, pass, mirrored) => 4 * kindAt.get(name) + (pass === 'depth' ? 2 : 0) + (mirrored ? 1 : 0);
  // the modules there are, by their assembled text (null: a text refused)
  const modules = new Map();
  // the own-shader texts there are: text and names → { n, names, keys (asked for it), piped (those of them a pipeline
  // was asked for), programs (its assembled texts), faults (what gpu.module said against them: { chunk, line, message }) }
  const owns = new Map();
  const idOf = (text, names) => `${names.join(',')}\n${text}`;
  const layoutOf = (...names) => {
    const key = names.join(' ');
    let l = layoutsBy.get(key);
    if (!l) { l = gpu.device.createPipelineLayout({ label: key, bindGroupLayouts: names.map(n => gpu.layout(n)) }); layoutsBy.set(key, l); }
    return l;
  };
  // a pipeline asked (once): its module assembled — made only for a text there is no module of —, both stages in it.
  // own: the record of the author's text in it — its faults are heard here; refused, no pipeline is asked
  function ask(key, { chunks, options = {}, groups, buffers = [], targets, depth, topology = 'triangle-list', cull = 'none', front = 'ccw', fragment = true, own = null }) {
    if (asked.has(key)) return asked.get(key);
    const wgsl = assemble(chunks, options);
    let module = modules.get(wgsl);
    if (module === undefined) {
      module = own ? gpu.module(key, wgsl, faults => { for (const f of faults) own.faults.push(f); }) : gpu.module(key, wgsl);
      modules.set(wgsl, module);
      if (own) own.programs.push(wgsl);
    }
    if (own) own.keys.push(key);
    if (!module) { const none = Promise.resolve(); asked.set(key, none); return none; }
    const descriptor = {
      layout: layoutOf(...groups),
      vertex: { module, entryPoint: 'e_vertex', buffers },
      primitive: { topology, cullMode: cull, frontFace: front },
    };
    if (fragment) descriptor.fragment = { module, entryPoint: 'e_fragment', targets };
    if (depth) descriptor.depthStencil = depth;
    if (own) own.piped.push(key);
    // (made: unless the key was let go meanwhile — lib.keep)
    const p = gpu.pipeline(key, descriptor).then(pipeline => { if (asked.get(key) === p) made.set(key, pipeline); });
    asked.set(key, p);
    return p;
  }
  const quad = (key, o, groups, targets, depth) => ask(key, { chunks: quadChunks(o), options: { ...o, shadows: !!o.receiver || !!o.land }, groups, buffers: QUAD_BUFFERS, targets, depth, own: o.own });
  const W = ['frame', 'view', 'none', 'none'], C = ['frame', 'viewCast', 'none', 'none'];

  // the sky's base past its painting (render/wgsl/sky.js): one triangle at the far plane, under the sky's test — with
  // the first sky element's own shader over it (text: its record), a variant of that text
  const skyBase = (key, format, text = null) => ask(key, {
    chunks: ['render.common', 'frame', 'world', 'sheets', 'render.relief.none', ...(text ? ['render.quad.io', 'render.own', `own.${text.n}`] : []), 'render.sky.base'],
    options: { own: text }, groups: text ? ['frame', 'view', 'own', 'none'] : W, targets: blended(PREMULT, format), depth: DEPTHS.tested, own: text });
  // the lights' glows: light added over what is there, tested against the depth
  const glow = (key, format) => ask(key, { chunks: ['render.common', 'frame', 'render.glow'], groups: W, buffers: ROWS3, targets: blended(LIGHT_ADDED, format), depth: DEPTHS.tested, topology: 'triangle-strip' });
  // what every world has (RN1, 4.5): the engine's own pictures, the sky, the glows, the layer that multiplies
  function own() {
    const small = (key, what, format, blend) => ask(key, { chunks: ['render.full', 'render.small'], options: { what }, groups: ['small'], targets: [blend ? { format, blend } : { format }] });
    return Promise.all([
      ask('bake', { chunks: ['render.land.bake'], groups: ['bake'], targets: [{ format: FORMATS.LAND_SHADOW }] }),
      ask('air', { chunks: [...AIR_CHUNKS, 'render.full', 'render.air.ray', 'render.air'], options: { shadows: true }, groups: ['frame', 'air'], targets: [{ format: FORMATS.AIR }] }),
      ask('air-halo', { chunks: [...AIR_CHUNKS, 'render.air.ray', 'render.air.halo'], options: { shadows: false }, groups: ['frame', 'air'], buffers: ROWS3, targets: [{ format: FORMATS.AIR, blend: ADDED }] }),
      ask('air-sum', { chunks: ['render.full', 'render.air.sum'], groups: ['sum'], targets: [{ format: FORMATS.AIR }] }),
      // (the air's light over the sky: one triangle at the far plane, where nothing was drawn before it — added)
      ask('air-sky', { chunks: ['render.common', 'frame', 'render.full', 'render.air.sky'], groups: W, targets: blended(LIGHT_ADDED), depth: DEPTHS.tested }),
      ask('shadow-clear', { chunks: ['render.clear'], groups: [], depth: { format: FORMATS.DEPTH, depthWriteEnabled: true, depthCompare: 'always' }, fragment: false }),
      ask('blob', { chunks: ['render.blob'], groups: ['blob'], buffers: BLOB_BUFFERS, targets: [{ format: FORMATS.BLOB, blend: MOST }], topology: 'triangle-strip' }),
      small('bloom-bright', 'bright', FORMATS.MAIN),
      small('bloom-down', 'down', FORMATS.MAIN),
      small('bloom-up', 'up', FORMATS.MAIN, ADDED),
      small('gather', 'gather', FORMATS.GATHER),
      small('gather-wide', 'wide', FORMATS.GATHER),
      ask('canvas', { chunks: ['render.full', 'render.canvas'], groups: ['canvas'], targets: [{ format: gpu.format }] }),
      quad('sky', { mode: 'sky' }, W, blended(PREMULT), DEPTHS.tested),
      skyBase('sky-base', FORMATS.MAIN),
      quad('multiply', { mode: 'multiply' }, W, blended(MULTIPLY), DEPTHS.blend),
      glow('glow', FORMATS.MAIN),
    ]).then(() => {});
  }

  // an own-shader text's record, made at its first asking
  function ownOf(text, names) {
    const id = idOf(text, names);
    let o = owns.get(id);
    if (!o) { o = { n: ownNumbers++, names, keys: [], piped: [], programs: [], faults: [] }; owns.set(id, o); chunk(`own.${o.n}`, text); }
    return o;
  }

  // The closed set of a world that has `has` (4.5), all at once. It settles when every pipeline asked has — made or
  // failed — and every module's report is in (GP5). Then, where a text of `has.own` has faults, it fails with THEM,
  // whatever else failed: a line a fault — `own shader <k>` (the text's place in has.own, from 1), the line in the
  // author's text when the fault is in it, the message (the whole-set check prints them; R.build says lib.fault's
  // words, with the elements). Else it fails with the first failed pipeline's own reason, or resolves
  function all(has) {
    const jobs = [own()], mirrors = !!(has.reflects || has.glass);
    // the quads' set, for the main passes and — the same modules, another colour format — for a mirror's pass: what
    // is solid, a mixed sheet's `cut` and `edge`, what blends; the own shaders; the land — in the main passes a
    // receiver (its pixels work the key lights out), in a mirror's lit at its vertices as everything there is
    const set = (tag, format) => {
      jobs.push(quad(`solid${tag}`, { mode: 'solid' }, W, solid(format), DEPTHS.solid));
      jobs.push(quad(`cut${tag}`, { mode: 'solid', cut: true }, W, solid(format), DEPTHS.solid));
      jobs.push(quad(`blend${tag}`, { mode: 'blend' }, W, blended(PREMULT, format), DEPTHS.blend));
      jobs.push(quad(`edge${tag}`, { mode: 'blend' }, W, blended(PREMULT, format), DEPTHS.edge));
      for (const o of has.own) {
        const text = ownOf(o.text, o.names), G = ['frame', 'view', 'own', 'none'];
        jobs.push(quad(`own:${text.n}${tag}`, { mode: 'blend', own: text, receiver: true }, G, blended(PREMULT, format), DEPTHS.blend));
        // (its painting with opaque paint, as a mixed sheet: where the shaded paint is opaque, with depth — lit at its
        // vertices as the blend is —, and the rest blended under the strict test)
        jobs.push(quad(`own-cut:${text.n}${tag}`, { mode: 'solid', cut: true, own: text }, G, solid(format), DEPTHS.solid));
        jobs.push(quad(`own-edge:${text.n}${tag}`, { mode: 'blend', own: text, receiver: true }, G, blended(PREMULT, format), DEPTHS.edge));
      }
      if (has.relief) {
        jobs.push(quad(`land-solid${tag}`, { mode: 'solid', receiver: !tag, land: true }, ['frame', 'view', 'land', 'none'], solid(format), DEPTHS.solid));
        jobs.push(quad(`land-blend${tag}`, { mode: 'blend', receiver: !tag, land: true }, ['frame', 'view', 'land', 'none'], blended(PREMULT, format), DEPTHS.blend));
      }
    };
    set('', FORMATS.MAIN);
    if (has.casters) {
      jobs.push(quad('solid-recv', { mode: 'solid', receiver: true }, W, solid(), DEPTHS.solid));
      jobs.push(quad('cut-recv', { mode: 'solid', cut: true, receiver: true }, W, solid(), DEPTHS.solid));
      jobs.push(quad('blend-recv', { mode: 'blend', receiver: true }, W, blended(PREMULT), DEPTHS.blend));
      jobs.push(quad('edge-recv', { mode: 'blend', receiver: true }, W, blended(PREMULT), DEPTHS.edge));
      jobs.push(quad('cast', { mode: 'cast' }, C, [], DEPTHS.cast));
      for (const o of has.own) {
        const text = ownOf(o.text, o.names);
        jobs.push(quad(`own-cast:${text.n}`, { mode: 'cast', own: text }, ['frame', 'viewCast', 'own', 'none'], [], DEPTHS.cast));
      }
    }
    if (mirrors) {
      // a mirror's pass: its own set, and what every world has of the main passes' — the sky, the layer that
      // multiplies (its image's alpha kept), the glows; then its image smeared, where the mirror is rough
      set(':mirror', FORMATS.MIRROR);
      jobs.push(quad('sky:mirror', { mode: 'sky' }, W, blended(PREMULT, FORMATS.MIRROR), DEPTHS.tested));
      jobs.push(skyBase('sky-base:mirror', FORMATS.MIRROR));
      jobs.push(quad('multiply:mirror', { mode: 'multiply' }, W, blended(MULTIPLY, FORMATS.MIRROR), DEPTHS.blend));
      jobs.push(glow('glow:mirror', FORMATS.MIRROR));
      for (const what of ['step', 'ready']) jobs.push(ask(`mirror-${what}`, { chunks: ['render.full', 'render.mirror.ready'], options: { what }, groups: ['ready'], targets: [{ format: FORMATS.MIRROR }] }));
    }
    // (the sky's base with its first element's own shader: sky-base:own:<n>, and in a mirror's set)
    for (const o of has.skyOwn) {
      const text = ownOf(o.text, o.names);
      jobs.push(skyBase(`sky-base:own:${text.n}`, FORMATS.MAIN, text));
      if (mirrors) jobs.push(skyBase(`sky-base:own:${text.n}:mirror`, FORMATS.MIRROR, text));
    }
    // (a beam in the haze, per pixel where it is seen: an instance a beam, its box's faces, light added over the main
    // passes' colour after what blends — tested against nothing: it meets the scene's depth itself)
    if (has.beams) jobs.push(ask('beam', { chunks: [...AIR_CHUNKS, 'render.beam'], options: { shadows: true }, groups: ['frame', 'view', 'beam', 'none'], targets: blended(LIGHT_ADDED), depth: DEPTHS.over }));
    if (has.clips) jobs.push(quad('mask', { mode: 'mask' }, C, [{ format: FORMATS.MASK, blend: MOST }], null));
    // (an insert lies over the world's people: where it paints, the ids get the insert's mark — their lines not drawn
    // through it, nor along its edge: canvas reads the mark as the frame's edge)
    if (has.inserts) jobs.push(quad('insert', { mode: 'insert' }, W, [{ format: FORMATS.MAIN, blend: PREMULT }, { format: FORMATS.IDS }], DEPTHS.over));
    if (has.emitters) {
      const options = { shadows: false, waves: GUST_WAVES, ring: RING, bursts: BURSTS };
      jobs.push(ask('particles', { chunks: ['render.common', 'frame', 'render.light', 'render.relief', 'render.particles'], options, groups: ['frame', 'view', 'particles', 'none'],
        targets: blended(PREMULT), depth: DEPTHS.tested, topology: 'triangle-strip' }));
      jobs.push(ask('particles-cast', { chunks: ['render.common', 'frame', 'render.light', 'render.relief.none', 'render.particles'], options: { ...options, cast: true },
        groups: ['frame', 'viewCast', 'particles', 'none'], targets: [], depth: DEPTHS.cast, topology: 'triangle-strip' }));
    }
    if (has.reflects) jobs.push(quad('mirror-plane', { mode: 'mirror', mirror: true }, ['frame', 'view', 'mirror', 'none'], blended(PREMULT), DEPTHS.blend));
    if (has.glass) jobs.push(quad('mirror-glass', { mode: 'glass', mirror: true }, ['frame', 'view', 'mirror', 'none'], blended(PREMULT), DEPTHS.blend));
    if (has.people) {
      // (what blends, laid again in the frame's view where its paint is opaque: the people's ids behind it cleared)
      jobs.push(quad('mark', { mode: 'mark' }, W, MARKED, DEPTHS.blend));
      for (const o of has.own) {
        const text = ownOf(o.text, o.names);
        jobs.push(quad(`own-mark:${text.n}`, { mode: 'mark', own: text }, ['frame', 'view', 'own', 'none'], MARKED, DEPTHS.blend));
      }
      for (const K of PERSON_KINDS) {
        const main = ['render.common', 'frame', 'world', 'render.light', 'render.relief', `person.${K.name}.vertex`, `person.${K.name}.surface`, 'render.person'];
        // (made: into the people's table, by its number)
        const person = (pass, mirrored, o) => {
          const key = `person:${K.name}:${pass}${mirrored ? ':mirrored' : ''}`;
          return ask(key, {
            options: { carry: PERSON_CARRY, pass, twoSided: K.twoSided, shadows: true }, buffers: K.buffers,
            cull: K.twoSided || pass !== 'main' ? 'none' : 'back', front: mirrored ? 'cw' : 'ccw', ...o,
          }).then(() => { persons[personAt(K.name, pass, mirrored)] = made.get(key) || null; });
        };
        jobs.push(person('main', false, { chunks: main, groups: ['frame', 'view', 'people', 'person'], targets: solid(), depth: DEPTHS.solid }));
        // (in a mirror's pass: the same text into the mirror's image, the winding turned)
        if (mirrors) jobs.push(person('main', true, { chunks: main, groups: ['frame', 'view', 'people', 'person'], targets: solid(FORMATS.MIRROR), depth: DEPTHS.solid }));
        jobs.push(person('depth', false, { chunks: ['render.common', 'frame', 'world', 'render.relief.none', `person.${K.name}.vertex`, 'render.person'],
          groups: ['frame', 'viewCast', 'people', 'person'], targets: [], depth: DEPTHS.cast, fragment: false }));
      }
    }
    return Promise.allSettled(jobs).then(async settled => {
      await gpu.reported();
      const lines = [];
      has.own.forEach((o, k) => {
        const text = ownOf(o.text, o.names);
        for (const f of text.faults) {
          const line = `own shader ${k + 1}: ${f.chunk === `own.${text.n}` ? `line ${f.line}: ` : ''}${f.message}`;
          // (a text is in several programs — own:<n>, own-cut:<n>, own-cast:<n>…: a fault of it is told by each)
          if (!lines.includes(line)) lines.push(line);
        }
      });
      if (lines.length) throw new Error(lines.join('\n'));
      const failed = settled.find(job => job.status === 'rejected');
      if (failed) throw failed.reason;
    });
  }

  lib = {
    own, all,
    // a pipeline of the set, made
    get(key) {
      const p = made.get(key);
      if (!p) throw new Error(`renderer: the pipeline '${key}' ${asked.has(key) ? 'is not made yet' : 'was not asked for this world'} — an engine fault`);
      return p;
    },
    // a person's pipeline of a kind, for a pass ('main' | 'depth'), the winding turned or not (a mirror's pass: of
    // the mirror's set) — from the table, by its number
    person(name, pass, mirrored = false) {
      const p = persons[personAt(name, pass, mirrored)];
      if (!p) throw new Error(`renderer: the pipeline of a person's '${name}' (${pass}${mirrored ? ', mirrored' : ''}) is not made or was not asked for this world — an engine fault`);
      return p;
    },
    // the number of an own-shader text that was asked (its pipelines are own:<n>, own-cut:<n>, own-edge:<n>, each
    // also :mirror, own-cast:<n>, own-mark:<n>)
    ownKey(text, names) {
      const o = owns.get(idOf(text, names));
      if (!o) throw new Error('renderer: an own shader whose text was not asked for this world — an engine fault');
      return o.n;
    },
    // the own texts' pipelines of a kind ('own', 'own-cast', 'own-mark'; set: ':mirror' — a mirror's) that are made
    ownKeys: (prefix, set = '') => [...owns.values()].map(o => `${prefix}:${o.n}${set}`).filter(key => made.has(key)),
    // A world's own shaders that do not compile or are refused (LG13): the first of them, said with the elements that
    // have its text and the author's line (a fault in the author's own text: the line in it) — or null. Asked when
    // every module's report is in (GP5). `world.own` are its slots, a quad's `own` its slot + 1
    async fault(world) {
      const Q = world.quads;
      await gpu.reported();
      for (let slot = 0; slot < world.own.length; slot++) {
        const o = owns.get(idOf(world.own[slot].text, world.own[slot].names));
        if (!o || !o.faults.length) continue;
        const f = o.faults[0], words = f.chunk === `own.${o.n}` ? `line ${f.line}: ${f.message}` : f.message;
        const who = [];
        for (let q = 0; q < Q.n; q++) {
          if (Q.own[q] === 0 || owns.get(idOf(world.own[Q.own[q] - 1].text, world.own[Q.own[q] - 1].names)) !== o) continue;
          const el = world.elements[Q.el[q]], name = el.id != null ? `"${el.id}"` : `element ${el.index}`;
          if (!who.includes(name)) who.push(name);
        }
        return `${who.join(', ') || 'an element'}: its shader does not compile — ${words}`;
      }
      return null;
    },
    // The own-shader texts kept: those of the lists given (each a `has.own`); every other text's pipelines, modules
    // and chunk are let go (RN2)
    keep(...lists) {
      const wanted = new Set();
      for (const list of lists) if (list) for (const o of list) wanted.add(idOf(o.text, o.names));
      for (const [id, o] of owns) {
        if (wanted.has(id)) continue;
        for (const key of o.piped) gpu.forget(key);
        for (const key of o.keys) { made.delete(key); asked.delete(key); }
        for (const wgsl of o.programs) modules.delete(wgsl);
        forget(`own.${o.n}`);
        owns.delete(id);
      }
    },
  };
  libraries.set(gpu, lib);
  return lib;
}

// the one function behind R.prepare (RN2)
export function all(gpu, has) { return libraryOf(gpu).all(has); }

// For the whole-set check only (RN2, 5.11), after all(gpu, has) with a `has` that has everything: with small targets,
// tables and bind groups of its own making, one frame of every pass of 4.4 is encoded, every pipeline bound and drawn
// once, and submitted. Nothing else calls it.
export function exercise(gpu) {
  const lib = libraryOf(gpu), S = 64;
  const T = GPUTextureUsage, B = GPUBufferUsage;
  const tex = (name, format, size, usage = T.TEXTURE_BINDING | T.RENDER_ATTACHMENT, more = {}) => gpu.texture(`check ${name}`, { size, format, usage, ...more });
  const uniform = (name, bytes) => gpu.buffer(`check ${name}`, bytes, B.UNIFORM | B.COPY_DST);
  const store = (name, bytes) => gpu.buffer(`check ${name}`, bytes, B.STORAGE | B.COPY_DST);
  const buf = b => ({ buffer: b });
  // the world's and the sheets' part of `frame`, as small as their layouts take
  const nodes = gpu.table('check nodes', { stride: NODE_BYTES, capacity: 4 }), quads = gpu.table('check quads', { stride: QUAD_BYTES, capacity: 4 }), layers = gpu.table('check layers', { stride: LAYER_BYTES, capacity: 4 });
  const cache = tex('sheet cache', 'rgba8unorm-srgb', [SHEET.SLOT, SHEET.SLOT, 1], T.TEXTURE_BINDING | T.COPY_DST, { mipLevelCount: 2 });
  const forms = tex('forms', 'rgba32float', [66, 33], T.TEXTURE_BINDING | T.COPY_DST);
  const panes = tex('panes', 'r8unorm', [4, 4], T.TEXTURE_BINDING | T.COPY_DST);
  const frame = gpu.bind('frame', [
    { binding: 0, resource: buf(uniform('frame', FRAME.BYTES)) }, { binding: 1, resource: buf(nodes.buffer) }, { binding: 2, resource: buf(quads.buffer) },
    { binding: 3, resource: buf(layers.buffer) }, { binding: 4, resource: buf(store('sheet table', 65536)) }, { binding: 5, resource: cache.createView({ dimension: '2d-array' }) },
    { binding: 6, resource: gpu.sampler('sheetSampler') }, { binding: 7, resource: buf(store('lights', LIT.BYTES * (LIGHT.LIT + LIT.PLANES))) },
    { binding: 8, resource: buf(store('light grid', 4 * GRID.SIDE * GRID.SIDE * GRID.WORDS)) }, { binding: 9, resource: panes.createView() },
    { binding: 10, resource: gpu.sampler('linear') }, { binding: 11, resource: forms.createView() },
  ]);
  const main = tex('main', FORMATS.MAIN, [S, S]), ids = tex('ids', FORMATS.IDS, [S, S]), depth = tex('depth', FORMATS.DEPTH, [S, S]);
  const mirror = tex('mirror', FORMATS.MIRROR, [S, S]), mirrorIds = tex('mirror ids', FORMATS.IDS, [S, S]), mirrorDepth = tex('mirror depth', FORMATS.DEPTH, [S, S]);
  const mirrorStep = tex('mirror step', FORMATS.MIRROR, [S, S]), mirrorReady = tex('mirror ready', FORMATS.MIRROR, [S, S]);
  const shadowStatic = tex('shadow static', FORMATS.DEPTH, [S, S]), shadowMovers = tex('shadow movers', FORMATS.DEPTH, [S, S]);
  const blob = tex('blob', FORMATS.BLOB, [S, S]), masks = tex('masks', FORMATS.MASK, [S, S]);
  const air = tex('air', FORMATS.AIR, [AIR.W * AIR.TX, AIR.H * AIR.TY]), steps = tex('air steps', FORMATS.AIR, [AIR.W * AIR.TX, AIR.H * AIR.TY]);
  // a view's land field
  const heights = tex('heights', FORMATS.HEIGHTS, [LAND.N, LAND.N], T.TEXTURE_BINDING | T.COPY_DST), landShadow = tex('land shadow', FORMATS.LAND_SHADOW, [LAND.N, LAND.N]);
  const landU = uniform('land', LAND.BYTES);
  const viewU = uniform('view', VIEWU.BYTES), shadowsU = uniform('shadows', SHADOWS.BYTES);
  const view = gpu.bind('view', [
    { binding: 0, resource: buf(viewU) }, { binding: 1, resource: shadowStatic.createView() }, { binding: 2, resource: shadowMovers.createView() },
    { binding: 3, resource: gpu.sampler('shadowSampler') }, { binding: 4, resource: buf(shadowsU) }, { binding: 5, resource: blob.createView() },
    { binding: 6, resource: air.createView() }, { binding: 7, resource: masks.createView() },
    { binding: 8, resource: buf(landU) }, { binding: 9, resource: heights.createView() }, { binding: 10, resource: landShadow.createView() },
  ]);
  const viewCast = gpu.bind('viewCast', [{ binding: 0, resource: buf(viewU) }]);
  const none = gpu.bind('none', []);
  const airView = gpu.bind('air', [{ binding: 0, resource: buf(viewU) }, { binding: 1, resource: shadowStatic.createView() }, { binding: 2, resource: shadowMovers.createView() },
    { binding: 3, resource: gpu.sampler('shadowSampler') }, { binding: 4, resource: buf(shadowsU) }]);
  const sum = gpu.bind('sum', [{ binding: 0, resource: steps.createView() }]);
  // the families' groups
  const land = gpu.bind('land', [{ binding: 0, resource: buf(store('leaves', LAND.LEAF_BYTES * 4)) }]);
  const bake = gpu.bind('bake', [{ binding: 0, resource: buf(landU) }, { binding: 1, resource: heights.createView() }, { binding: 2, resource: buf(uniform('bake', 64)) }]);
  const sprites = tex('sprites', 'rgba8unorm-srgb', [4, 4, 1], T.TEXTURE_BINDING | T.COPY_DST);
  const particles = gpu.bind('particles', [{ binding: 0, resource: buf(store('emitters', PT.BYTES * 2)) }, { binding: 1, resource: buf(store('rings', 16 * 64)) },
    { binding: 2, resource: sprites.createView({ dimension: '2d-array' }) }, { binding: 3, resource: depth.createView() }]);
  const own = gpu.bind('own', [{ binding: 0, resource: buf(uniform('own', OWN_BYTES)) }]);
  const sampler = gpu.sampler('linear');
  // (the overlay reads the smeared image; the smear's two steps: the image, then the step)
  const mirrorGroup = gpu.bind('mirror', [{ binding: 0, resource: buf(uniform('mirror', MIRROR.BYTES)) }, { binding: 1, resource: mirrorReady.createView() }]);
  const readyU = uniform('ready', READY.BYTES);
  const ready = src => gpu.bind('ready', [{ binding: 0, resource: buf(readyU) }, { binding: 1, resource: src.createView() }, { binding: 2, resource: sampler }]);
  const blobGroup = gpu.bind('blob', [{ binding: 0, resource: buf(uniform('blob', 16)) }]);
  const bloom4 = tex('bloom 4', FORMATS.MAIN, [S / 4, S / 4]), bloom16 = tex('bloom 16', FORMATS.MAIN, [S / 16, S / 16]), bloom64 = tex('bloom 64', FORMATS.MAIN, [S / 64, S / 64]);
  const gather = tex('gather', FORMATS.GATHER, [S / 16, S / 16]), gatherWide = tex('gather wide', FORMATS.GATHER, [S / 64, S / 64]);
  const small = src => gpu.bind('small', [{ binding: 0, resource: buf(uniform('small', 32)) }, { binding: 1, resource: src.createView() }, { binding: 2, resource: depth.createView() }, { binding: 3, resource: sampler }]);
  const canvas = gpu.bind('canvas', [{ binding: 0, resource: buf(uniform('canvas', CANVAS.BYTES)) }, { binding: 1, resource: main.createView() }, { binding: 2, resource: depth.createView() },
    { binding: 3, resource: ids.createView() }, { binding: 4, resource: bloom4.createView() }, { binding: 5, resource: gatherWide.createView() },
    { binding: 6, resource: buf(uniform('inks', 4096)) }, { binding: 7, resource: sampler }]);
  // the quads' buffers: the shapes, one row of the order; a row of a glow, a halo, a capsule
  const shape = shapes();
  const corners = gpu.buffer('check corners', shape.corners.byteLength, B.VERTEX | B.COPY_DST), index = gpu.buffer('check index', shape.indices.byteLength, B.INDEX | B.COPY_DST);
  gpu.write(corners, 0, shape.corners); gpu.write(index, 0, shape.indices);
  const order = gpu.buffer('check order', 68, B.VERTEX | B.COPY_DST), rows = gpu.buffer('check rows', HALO.BYTES, B.VERTEX | B.COPY_DST);

  const at = (t, clear) => ({ view: t.createView(), loadOp: 'clear', storeOp: 'store', clearValue: clear ?? [0, 0, 0, 0] });
  const onto = t => ({ view: t.createView(), loadOp: 'load', storeOp: 'store' });
  const deep = (t, readOnly = false) => (readOnly ? { view: t.createView(), depthReadOnly: true } : { view: t.createView(), depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: 0 });
  const begin = (name, descriptor, group1) => {
    const pass = gpu.pass(name, descriptor);
    if (group1) { pass.setBindGroup(0, frame); pass.setBindGroup(1, group1); pass.setBindGroup(2, none); pass.setBindGroup(3, none); }
    return pass;
  };
  // every quad pipeline named, drawn once
  const groupOf = key => (key.startsWith('own') ? own : key.startsWith('land') ? land : key.startsWith('mirror') ? mirrorGroup : none);
  const quadsIn = (pass, keys) => {
    pass.setVertexBuffer(0, corners); pass.setVertexBuffer(1, order); pass.setIndexBuffer(index, 'uint32');
    for (const key of keys) {
      pass.setPipeline(lib.get(key));
      pass.setBindGroup(2, groupOf(key));
      pass.drawIndexed(shape.ranges[SHAPE.FLAT].count, 1, shape.ranges[SHAPE.FLAT].first, 0, 0);
    }
    pass.setBindGroup(2, none);
  };
  const full = (pass, key, group) => { pass.setPipeline(lib.get(key)); pass.setBindGroup(0, group); pass.draw(3); };

  gpu.begin();
  let pass = gpu.pass('bake', { colorAttachments: [at(landShadow)] });
  full(pass, 'bake', bake);
  pass.end();
  for (const [name, target] of [['shadow-static', shadowStatic], ['shadow-movers', shadowMovers]]) {
    pass = begin(name, { colorAttachments: [], depthStencilAttachment: deep(target) }, viewCast);
    pass.setPipeline(lib.get('shadow-clear')); pass.draw(3);
    quadsIn(pass, ['cast', ...lib.ownKeys('own-cast')]);
    pass.setPipeline(lib.get('particles-cast')); pass.setBindGroup(2, particles); pass.draw(4, 1, 0, 0);
    exercisePeople(gpu, lib, pass, 'depth', false);
    pass.end();
  }
  pass = gpu.pass('blob', { colorAttachments: [at(blob)] });
  pass.setPipeline(lib.get('blob')); pass.setBindGroup(0, blobGroup); pass.setVertexBuffer(0, rows); pass.draw(4, 1);
  pass.end();
  pass = gpu.pass('air', { colorAttachments: [at(steps)] });
  pass.setBindGroup(0, frame); pass.setBindGroup(1, airView);
  pass.setPipeline(lib.get('air')); pass.draw(3);
  pass.setPipeline(lib.get('air-halo')); pass.setVertexBuffer(0, rows); pass.draw(6 * AIR.S, 1);
  pass.end();
  pass = gpu.pass('air', { colorAttachments: [at(air)] });
  full(pass, 'air-sum', sum);
  pass.end();
  // a mirror's pass, by the mirror's own set — the people's mains with the winding turned among it —, then its image
  // smeared: the step, the ready image
  pass = begin('mirror', { colorAttachments: [at(mirror), at(mirrorIds)], depthStencilAttachment: deep(mirrorDepth) }, view);
  pass.setPipeline(lib.get('sky-base:mirror')); pass.draw(3);
  for (const key of lib.ownKeys('sky-base:own', ':mirror')) { pass.setPipeline(lib.get(key)); pass.setBindGroup(2, own); pass.draw(3); }
  pass.setBindGroup(2, none);
  quadsIn(pass, ['solid:mirror', 'cut:mirror', 'land-solid:mirror', 'sky:mirror', 'blend:mirror', 'edge:mirror', 'multiply:mirror', 'land-blend:mirror', ...lib.ownKeys('own', ':mirror'), ...lib.ownKeys('own-cut', ':mirror'), ...lib.ownKeys('own-edge', ':mirror')]);
  exercisePeople(gpu, lib, pass, 'main', true);
  pass.setPipeline(lib.get('glow:mirror')); pass.setBindGroup(2, none); pass.setBindGroup(3, none); pass.setVertexBuffer(0, rows); pass.draw(4, 1);
  pass.end();
  pass = gpu.pass('mirror', { colorAttachments: [at(mirrorStep)] });
  full(pass, 'mirror-step', ready(mirror));
  pass.end();
  pass = gpu.pass('mirror', { colorAttachments: [at(mirrorReady)] });
  full(pass, 'mirror-ready', ready(mirrorStep));
  pass.end();
  pass = begin('masks', { colorAttachments: [at(masks)] }, viewCast);
  quadsIn(pass, ['mask']);
  pass.end();
  pass = begin('main-solid', { colorAttachments: [at(main), at(ids)], depthStencilAttachment: deep(depth) }, view);
  pass.setPipeline(lib.get('sky-base')); pass.draw(3);
  for (const key of lib.ownKeys('sky-base:own')) { pass.setPipeline(lib.get(key)); pass.setBindGroup(2, own); pass.draw(3); }
  pass.setBindGroup(2, none);
  quadsIn(pass, ['solid', 'solid-recv', 'cut', 'cut-recv', 'land-solid', ...lib.ownKeys('own-cut'), 'sky']);
  exercisePeople(gpu, lib, pass, 'main', false);
  pass.setBindGroup(2, none); pass.setBindGroup(3, none);
  pass.setPipeline(lib.get('air-sky')); pass.draw(3);
  pass.end();
  pass = begin('main-blend', { colorAttachments: [onto(main), onto(ids)], depthStencilAttachment: deep(depth, true) }, view);
  quadsIn(pass, ['blend', 'blend-recv', 'edge', 'edge-recv', 'multiply', 'land-blend', ...lib.ownKeys('own'), ...lib.ownKeys('own-edge'), 'mark', ...lib.ownKeys('own-mark'), 'insert', 'mirror-plane', 'mirror-glass']);
  pass.setPipeline(lib.get('glow')); pass.setVertexBuffer(0, rows); pass.draw(4, 1);
  pass.setPipeline(lib.get('particles')); pass.setBindGroup(2, particles); pass.draw(4, 1, 0, 0);
  pass.setPipeline(lib.get('beam')); pass.setBindGroup(2, gpu.bind('beam', [{ binding: 0, resource: depth.createView() }])); pass.draw(36, 1);
  pass.end();
  // the bloom: the bright part, down twice, up twice
  pass = gpu.pass('bloom', { colorAttachments: [at(bloom4)] });
  full(pass, 'bloom-bright', small(main));
  pass.end();
  pass = gpu.pass('bloom', { colorAttachments: [at(bloom16)] });
  full(pass, 'bloom-down', small(bloom4));
  pass.end();
  pass = gpu.pass('bloom', { colorAttachments: [at(bloom64)] });
  full(pass, 'bloom-down', small(bloom16));
  pass.end();
  pass = gpu.pass('bloom', { colorAttachments: [onto(bloom16)] });
  full(pass, 'bloom-up', small(bloom64));
  pass.end();
  pass = gpu.pass('bloom', { colorAttachments: [onto(bloom4)] });
  full(pass, 'bloom-up', small(bloom16));
  pass.end();
  pass = gpu.pass('gather', { colorAttachments: [at(gather)] });
  full(pass, 'gather', small(main));
  pass.end();
  pass = gpu.pass('gather', { colorAttachments: [at(gatherWide)] });
  full(pass, 'gather-wide', small(gather));
  pass.end();
  pass = gpu.pass('canvas', { colorAttachments: [{ view: gpu.canvasView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] }] });
  full(pass, 'canvas', canvas);
  pass.end();
  gpu.submit();
}
