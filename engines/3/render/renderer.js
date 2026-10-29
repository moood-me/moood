// Engine 3's renderer (RN1–RN12; contracts 2.1 step 8, 4.4): the frame. Forward drawing in few passes — opaque
// paint (wholly opaque sheets, the opaque pixels of mixed ones), the land and people once with depth; then what
// blends, tested against that depth; one full-screen pass after the main ones. Everything of a world is read from its
// tables (WT), its sheets through SHEETS (SH9–SH14), its people through PEOPLE (PP7–PP11); the GPU through the thin
// layer (GP). No scene graph, no materials.
//   R.frame(f) → 0 held · 1 idle · 2 drawn, in this order, always:
//     a. the targets sized, if R.resize() was called since (the canvas itself only where it is drawn: render/post.js);
//     b. sheets.place(count): the pages that arrived, before anything of the call reads a sheet;
//     c. views placed: the frame's, the pose the camera moves to, the mirrors in view, the casting lights', and for
//        each shot ahead its own, its mirrors' and its casting lights'; the cover judged; the lit set and the casting
//        lights chosen; the land's nodes baked (by count);
//     d. people.show(seen);
//     e. cull and order of quads for each view;  f. sheets.ask(view) for every view due, sheets.weigh();
//     g. sheets.request();  h. the outcome;  i. RENDER's buffers written, the passes of 4.4 on the frame's encoder,
//        one submit.
//   Held (f.whole and the frame is not whole): nothing goes to the canvas; only bakes and shadow cells are drawn, and
// only what they need is written. Only a break holds (rule 8): a call without f.whole is never held — whatever its
// views lack (a moving camera's new strip, a page let go) is read from the coarser pages there are, and it draws.
//   Idle (not f.whole, and nothing the picture depends on changed since the frame drawn last): nothing is drawn,
// nothing written. While a solid insert covers the stage none of the world's passes
// is drawn — only the inserts — and what is skipped so is no work waiting; the world's views are still culled and
// asked and the land's nodes baked (the thread's data for a view, as pages are), and the call in which the cover
// lifts does a whole call's work for the world before it draws: every land node, every static cell due (RN4).
//   A view's ask works out again only what changed (SH10): of the view R says what is another than at its last ask
// (`changed` — the same test for every view, made where it is asked: where its eye stands; its turn or its lens; its
// size, its swaps or its overrides), and SHEETS works out again the quads whose pages are
// worked out from that, and those whose own rows — the quad's, its node's, its layer's — were stamped since (3.4's
// test). Nothing else: not a person's node, not a light's row, not a row of another quad. The views that are drawn
// (the frame's, a mirror's, a static cell's looked at) are culled
// every call — their lists are the order's; the views that are only asked (`toward`'s, a shot's own, its mirrors',
// its cells') are culled only when what a cull reads changed since their last one: their camera, their size, how
// far the land goes up and down, the look's stamp, their swaps or overrides — or a row of the world stamped since
// that is the view's matter: a quad that comes into its list or leaves it (render/quads.js `changes`: the rows
// stamped against the view, not every quad against it). A static cell that stands as it was drawn is looked at the
// same way: culled only for a stamped quad of its list or one that comes into it. With a still camera and only
// people or lamps moving, no view is asked.
//   A shot's view that moves (2.3 step 4) is made whole at the sharpness its motion allows: while its camera is
// another than at its last ask, every tick in which something ENTERED what its views ask — a page no view named the
// cycle before (SH10 `entered`), a tile of its land's field — and what it lacks — the pages its asks returned, the
// land's tiles lacking at the levels it reads — is not less than the least it has lacked at its present `coarser`,
// the `coarser` of all its views rises a quarter level; it is whole when it lacks nothing, and at BIAS.MOST with the
// land's coarsest level there. A camera that moves and brings nothing new into its views (it follows a head that
// breathes) is not coarsened: what it lacks is on its way; and a tick it lacks nothing and nothing entered, its
// `coarser` falls a quarter level — a page or two that once crossed into such a view do not leave it soft for the
// rest of its life (a riding camera's views are entered every tick: theirs does not fall). A tick its camera stood,
// its views begin anew at 0. So `a.whole` always comes. `a.bias` is the most any of the shot's views — its own, its
// mirrors', its cells' — is asked coarser by than the frame will ask it: its `coarser` and the greatest pressure
// among them.
//   The frame's, `toward`'s and a shot's view are the whole canvas (RN5: the safe rect fitted in it, the world drawn
// round it): their size is the buffer's, and the frame is drawn with the viewport and the scissor at all of it. The
// inserts are laid over the safe rect (f.stage, in the view's uniform). The sky past what it paints — the first shown
// sky element's painting carried on — is drawn first among the sky's sheets as one triangle over the view, where the
// sheets do not reach, and in the frame's view only while it shows any of that (render/sky.js).
//   The passes: bake · shadow-static · shadow-movers · blob · air × 2 · mirror × m (its masks before it; a rough
// one's smear — two small passes — after it) · masks · main-solid · main-blend (what blends; the beams in the haze; its
// marks, scissored to what the people cover; the inserts) · bloom × 5 · gather · canvas.
//   Nothing is allocated in a call (5.16): lists, records and the passes' descriptors are made once; pipelines are
// found by number or kept by the area that draws with them.
//   R.build(world) makes what the new world needs before it is drawn (RN2) — its pipelines, its painted sprites — and
// switches nothing: R draws the world it drew (a scene replaced lives on beside the one being made: 2.9). R.use(made)
// is the switch, in one task: R draws the new world and has let go of what it held for the one before. R.drop(made):
// a made world that will not be drawn let go. When R.build rejects nothing changed.
//   f.next (2.9): the opening view of a scene being made beside the one drawn — a View of its own world — asked in
// every round after all of the frame's views and the shots', so the pages the living picture names keep their cells;
// what its last ask lacked is written on it (`lacking`). f.veil (2.10): the stage's black, laid last by the canvas
// pass.
import { BIAS, FLAG, PULSE, QUAD, SHADOW } from '../base.js';
import { hazeReach } from '../world/light.js';
import { libraryOf } from './library.js';
import { FRAME, TIME } from './wgsl/frame.js';
import { CHANGED } from '../sheets/ask.js';
import { createView, newCamera, copyCamera, sameCamera, sameEye, sameTurn, viewProj, sees, covers, ahead } from './views.js';
import { since } from '../world/tables.js';
import { createQuads, movesItself, SHAPES } from './quads.js';
import { createLights } from './lights.js';
import { createShadows } from './shadows.js';
import { createMirrors } from './mirrors.js';
import { createLand } from './land.js';
import { createParticles } from './particles.js';
import { createOwn } from './own.js';
import { createAir } from './air.js';
import { createPost } from './post.js';
import { createStage } from './sky.js';
import { createTiming } from './timing.js';
import { createSurvey } from './survey.js';

export async function createRenderer(gpu, sheets, host) {
  const B = GPUBufferUsage, lib = libraryOf(gpu);
  // (the pipelines every world has: made before the areas, which keep those they draw with)
  await lib.own();
  await gpu.ready();
  const quads = createQuads(gpu, lib, sheets), lights = createLights(gpu), shadows = createShadows(gpu, host, sheets, quads, lib), mirrors = createMirrors(gpu, sheets, lib);
  const land = createLand(gpu, host, lib), own = createOwn(gpu, quads), air = createAir(gpu, lib), post = createPost(gpu, lib), stage = createStage(sheets), timing = createTiming(gpu), survey = createSurvey(sheets.asking);
  let particles = createParticles(gpu, sheets, lib, host);
  const frameU = gpu.buffer('frame', FRAME.BYTES, B.UNIFORM | B.COPY_DST), frameData = new ArrayBuffer(FRAME.BYTES), F32 = new Float32Array(frameData), U32 = new Uint32Array(frameData);
  const none = gpu.bind('none', []), linear = gpu.sampler('linear'), shadowSampler = gpu.sampler('shadowSampler');
  const frameView = createView(gpu, 'frame'), towardView = createView(gpu, 'toward', false);
  const airGroup = gpu.bind('air', [{ binding: 0, resource: { buffer: frameView.e.buffer } }, { binding: 1, resource: shadows.staticView }, { binding: 2, resource: shadows.moversView },
    { binding: 3, resource: shadowSampler }, { binding: 4, resource: { buffer: shadows.uniform } }]);
  // the glows' pipelines (the main passes'; a mirror's pass's, in a world that mirrors), a static cell's clear, the
  // sky's base (the main passes'; a mirror's)
  const glowPipe = lib.get('glow'), clearPipe = lib.get('shadow-clear');
  let glowMirror = null;
  // the world's sky elements, in their order, each with the pipelines its base is drawn by (render/sky.js: that of its
  // own shader's text, with its slot's group, or the plain one; a mirror's); this call's base — the first shown of
  // them: its record and quad (−1: none) — and whether the frame's view shows anything past its painting
  let skies = [], sky = null, skyBase = -1, skyPast = false;
  // the world drawn; the own texts of the pipelines asked last (R.prepare)
  let world = null, people = null, wanted = null, clips = false, resized = true, bw = 0, bh = 0, frameGroup = null, towards = false, shotSeen = -1;
  // the shots ahead (their entries of f.ahead) and what R keeps of each while it lives: its view, its mirrors' and its
  // casting lights' (made by render/mirrors.js, render/shadows.js), and of its asks: whether its swaps or overrides
  // changed since the call before, the pages they lacked and those of them that entered with this cycle, the greatest
  // pressure among its views, whether its camera moved since its last ask, the quarter levels its views are asked
  // coarser by while it moves and the least it has lacked at that
  const aheadShots = [], aheadStates = [];
  const made = { world: null, nodes: -1, quads: -1, layers: -1, forms: -1, table: -1 };
  const last = { stamp: -1, look: -1, inserts: -1, panes: -1, sig: 0, rows: 0, drawn: false, shot: -1, hidden: false, swaps: false, veil: 0 };
  // the last tick the world's rows were stamped at: any of them; any but a person's node (what may stand in a static
  // shadow cell: people are movers); a light's; a node's that is no person's, a quad's or a layer's (what a view's
  // list and its ask are worked out from). persons: by a node's row, whether it is a person's
  const stamps = { all: 0, rows: 0 };
  let persons = new Uint8Array(0);
  // the stand's: the slot the asks now made are told in (survey.js)
  let askSlot = 0;
  // RN8. Of the last call, all its views together: draws, triangles, lit points — by shape too (by SHAPE's numbers,
  // and after them the SCREEN shape's) and those drawn in mirrors' passes —, quads among what blends, the particles
  // of the emitters drawn (each one's whole count while anything of it may be in the air), the people's triangles;
  // and what the call worked on: the world's quads and persons and the persons shown (here and in any of its views:
  // drawn), the quads listed by the cull of the frame's view, its
  // mirrors' and its shadow cells' views together, the quads the asks worked out (a quad worked out for three views:
  // three)
  const counters = { frames: 0, drawn: 0, held: 0, idle: 0, pixels: 0, draws: 0, triangles: 0, placed: 0, lit: 0, blended: 0, shapes: new Int32Array(SHAPES + 1), mirrored: 0, particles: 0, people: 0, quads: 0, listed: 0, asked: 0, persons: 0, shown: 0 };
  let mirrored = 0, peopleTriangles = 0;
  // what the call's frame still lacked (RN8; the numbers R.missing() words): pages of its own views, mirrors' and
  // shadow cells' views lacking pages, the land's tiles
  const lacks = { wait: false, sheets: false, pages: 0, mirrors: 0, cells: 0, land: 0 };
  // the canvas in the buffer, whole px (x, y, w, h: all of the buffer) — and the same as floats, for the uniforms
  const px = new Int32Array(4), canvasPx = new Float32Array(4);
  // (inked: a person's sphere, what it covers of the view, how far it is; what they all cover and the farthest of
  // them — the frame cull's `marks`; the frame's px of that)
  const S4 = new Float64Array(4), R4 = new Float64Array(4), A1 = new Float64Array(1), MARKS = { box: new Float64Array(4), far: 0 }, INKED = new Int32Array(4);
  // the options of a cull, by what is culled (the same objects every frame) — one shape for all, an option a cull
  // has not at its none (records of several shapes passing one place are read slowly, their fractions made on the heap: 5.16)
  const cullOf = o => ({ draw: false, light: -1, casts: null, mover: null, mirror: null, ahead: null, land: null, mirrors: null, own: null, glows: null, particles: null, passes: false, marks: null, ...o });
  const cullFrame = cullOf({ draw: true, land, mirrors, own, glows: lights, passes: true }), cullMirror = cullOf({ draw: true, land, own });
  const cullStatic = cullOf({ draw: true, casts: 'static', mover: shadows.mover, own }), cullMovers = cullOf({ draw: true, casts: 'movers', mover: shadows.mover, own });
  const cullAsk = cullOf({}), cullAhead = cullOf({});
  // the passes' descriptors (the same objects every frame: their views are set where they are another)
  const cleared = (view, value, store = 'store') => ({ view, loadOp: 'clear', storeOp: store, clearValue: value });
  const bakePass = { colorAttachments: [{ view: null, loadOp: 'load', storeOp: 'store' }] };
  const staticPass = { colorAttachments: [], depthStencilAttachment: { view: shadows.staticView, depthLoadOp: 'load', depthStoreOp: 'store' } };
  const moversPass = { colorAttachments: [], depthStencilAttachment: { view: shadows.moversView, depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: 0 } };
  const blobPass = { colorAttachments: [cleared(shadows.blobView, [0, 0, 0, 0])] }, masksPass = { colorAttachments: [cleared(null, [0, 0, 0, 0])] };
  // (a mirror's image is cleared to nothing: its alpha is how much of a mirror image there is — 5.7)
  const mirrorPass = { colorAttachments: [cleared(null, [0, 0, 0, 0]), cleared(null, [0, 0, 0, 0], 'discard')], depthStencilAttachment: { view: null, depthLoadOp: 'clear', depthStoreOp: 'discard', depthClearValue: 0 } };
  const solidPass = { colorAttachments: [cleared(null, [0, 0, 0, 1]), cleared(null, [0, 0, 0, 0])], depthStencilAttachment: { view: null, depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: 0 } };
  const blendPass = { colorAttachments: [{ view: null, loadOp: 'load', storeOp: 'store' }, { view: null, loadOp: 'load', storeOp: 'store' }], depthStencilAttachment: { view: null, depthReadOnly: true } };
  // who draws the sprites among what blends (render/quads.js): a run of the lights' glows, an emitter's particles
  const sprites = {
    glow(pass, first, count) {
      pass.setPipeline(glowPipe); pass.setBindGroup(2, none); pass.setVertexBuffer(0, lights.glows);
      pass.draw(4, count, 0, first);
      quads.counters.draws++; quads.counters.triangles += 2 * count;
    },
    emitter(pass, k) { particles.draw(pass, post.depth, k, quads.counters); },
  };

  // every full-frame target: floor(pw · k) × floor(ph · k), k = min(1, √(budget / (pw · ph))) — the canvas's buffer
  // takes that size where it is drawn
  function targets() {
    const k = Math.min(1, Math.sqrt(host.budget / (host.pw * host.ph)));
    bw = Math.max(1, Math.floor(host.pw * k)); bh = Math.max(1, Math.floor(host.ph * k));
    post.resize(bw, bh);
    solidPass.colorAttachments[0].view = post.main; solidPass.colorAttachments[1].view = post.ids; solidPass.depthStencilAttachment.view = post.depth;
    blendPass.colorAttachments[0].view = post.main; blendPass.colorAttachments[1].view = post.ids; blendPass.depthStencilAttachment.view = post.depth;
    counters.pixels = bw * bh;
    resized = false;
  }
  // group 0 (4.2): made again when the world, one of its tables, the forms' texture or the sheets' table is another
  function frame0() {
    const G = world.gpu;
    if (frameGroup && made.world === world && made.nodes === G.nodes.version && made.quads === G.quads.version && made.layers === G.layers.version && made.forms === G.formsVersion && made.table === sheets.table.version) return;
    made.world = world; made.nodes = G.nodes.version; made.quads = G.quads.version; made.layers = G.layers.version; made.forms = G.formsVersion; made.table = sheets.table.version;
    frameGroup = gpu.bind('frame', [
      { binding: 0, resource: { buffer: frameU } }, { binding: 1, resource: { buffer: G.nodes.buffer } }, { binding: 2, resource: { buffer: G.quads.buffer } }, { binding: 3, resource: { buffer: G.layers.buffer } },
      ...sheets.bindings(),
      { binding: 7, resource: { buffer: lights.buffer } }, { binding: 8, resource: { buffer: lights.grid } }, { binding: 9, resource: lights.panes }, { binding: 10, resource: linear }, { binding: 11, resource: G.forms.createView() },
    ]);
  }
  // a view's group 1 as `view` has it — its own clip masks, its land field — made again when either is another
  function group1(view, masks, field) {
    const e = view.e;
    if (e.group && e.groupWith === masks && e.groupOf === field) return e.group;
    e.groupWith = masks; e.groupOf = field;
    e.group = gpu.bind('view', [{ binding: 0, resource: { buffer: e.buffer } }, { binding: 1, resource: shadows.staticView }, { binding: 2, resource: shadows.moversView }, { binding: 3, resource: shadowSampler },
      { binding: 4, resource: { buffer: shadows.uniform } }, { binding: 5, resource: shadows.blobView }, { binding: 6, resource: air.view }, { binding: 7, resource: masks },
      { binding: 8, resource: { buffer: field.uniform } }, { binding: 9, resource: field.hv }, { binding: 10, resource: field.sv }]);
    return e.group;
  }
  // … and as `viewCast` has it
  const cast = view => view.e.cast || (view.e.cast = gpu.bind('viewCast', [{ binding: 0, resource: { buffer: view.e.buffer } }]));
  // → stamps
  function stampOf() {
    let s = 0, p = 0, l = 0;
    const N = world.nodes, Q = world.quads, L = world.layers, Lt = world.lights;
    for (let i = 0; i < N.n; i++) { const t = N.stamp[i]; if (persons[i]) { if (t > p) p = t; } else if (t > s) s = t; }
    for (let i = 0; i < Q.n; i++) if (Q.stamp[i] > s) s = Q.stamp[i];
    for (let i = 0; i < L.n; i++) if (L.stamp[i] > s) s = L.stamp[i];
    for (let i = 0; i < Lt.n; i++) if (Lt.stamp[i] > l) l = Lt.stamp[i];
    stamps.rows = s; stamps.all = Math.max(s, l, p);
  }
  // RN8: what the call drew, all its views together (people's draws among them: PP10) — 0 where it drew nothing
  function tally(drawn) {
    const C = quads.counters;
    counters.draws = C.draws; counters.triangles = C.triangles; counters.lit = C.lit; counters.shapes.set(C.shapes);
    counters.mirrored = mirrored; counters.particles = C.particles; counters.people = peopleTriangles;
    counters.blended = drawn ? C.blended : 0;
  }
  // whether a sphere meets a view something is drawn or asked through this tick (PP7)
  const seen = S => {
    if (sees(frameView.e, S) || (towards && sees(towardView.e, S)) || shadows.sees(S)) return true;
    for (let i = 0; i < aheadStates.length; i++) if (sees(aheadStates[i].view.e, S)) return true;
    for (let i = 0; i < mirrors.list.length; i++) if (sees(mirrors.list[i].view.e, S)) return true;
    return false;
  };

  // A view asked (SH10) — its `changed` worked out, the same way for every view: all of it where its swaps or its
  // overrides changed (extra) or its size is another than at its last ask; where its eye stands; how it
  // is turned and what its lens is. → the pages it lacks
  function ask(view, extra) {
    const e = view.e;
    // (the stand's: which of the two made all of it another — 1 its swaps, 2 its size —, 0 neither)
    const cause = extra ? 1 : view.width !== e.wasW || view.height !== e.wasH ? 2 : 0;
    view.changed = (cause ? CHANGED.ALL : 0) | (sameEye(view.camera, e.was) ? 0 : CHANGED.EYE) | (sameTurn(view.camera, e.was) ? 0 : CHANGED.TURN);
    sheets.asking.slot(askSlot);
    const pages = sheets.ask(view);
    if (survey.on) survey.asked(askSlot, cause, view.changed);
    copyCamera(view.camera, e.was); e.wasW = view.width; e.wasH = view.height; e.tick = world.tick;
    e.press = view.bias - view.coarser;
    return pages;
  }
  // A view that is only asked, culled — when its swaps or its overrides changed (extra), or what a cull reads is
  // another than at its last one: how far the land goes up and down (a draped quad's sphere holds it), its size, its
  // camera — or a row stamped since, or the look (the wind's bound of a windy quad's sphere), changes its list (a
  // quad comes into it or leaves it: quads.changes)
  function listed(view, options, extra) {
    const e = view.e;
    let why = cullWhy(extra, e.seenTall, e.seenW, e.seenH, e.seen, view);
    if (!why && (e.seenRows !== stamps.rows || e.seenLook !== world.look.stamp) && quads.changes(view, options, e.seenTick, false)) why = 2;
    e.seenRows = stamps.rows; e.seenLook = world.look.stamp; e.seenTick = world.tick;
    if (!why) { if (survey.on) survey.culled(3, -1, 0, 0); return; }
    quads.cull(view, options);
    if (survey.on) survey.culled(3, why, world.quads.n, view.n);
    copyCamera(view.camera, e.seen); e.seenW = view.width; e.seenH = view.height; e.seenTall = land.tall;
  }
  // why a view must be culled again whatever rows were stamped: 0 not, else the first of what a cull reads of the
  // view that is another than at its last one (the order the stand tells: 1 the extra, 3 the land's reach, 5 size,
  // 6 camera; 2 — a row, or the look, that is its matter — is the caller's)
  function cullWhy(extra, tall, w, h, camera, view) {
    return extra ? 1 : tall !== land.tall ? 3 : view.width !== w || view.height !== h ? 5 : !sameCamera(view.camera, camera) ? 6 : 0;
  }
  // the stand's: a view culled in every call, with no test of its own (the frame's, the mirrors', the shadow cells'), in
  // `slot` — and what the test above would have found: 0 (the cull was not needed) or its cause
  function cullAlways(slot, view, options) {
    if (!survey.on) { quads.cull(view, options); return; }
    const s = view._cull ||= { rows: -1, tall: -1, look: -1, w: 0, h: 0, camera: newCamera() }, why = cullWhy(false, s.tall, s.w, s.h, s.camera, view) || (s.rows !== stamps.rows || s.look !== world.look.stamp ? 2 : 0);
    quads.cull(view, options);
    survey.culled(slot, why, world.quads.n, view.n);
    copyCamera(view.camera, s.camera); s.w = view.width; s.h = view.height; s.rows = stamps.rows; s.tall = land.tall; s.look = world.look.stamp;
  }
  // a view of a shot that moves asked coarser by what its motion asks (SH10 `coarser`: quarter levels over `base`) —
  // so that with the cache's pressure it does not pass BIAS.MOST; anew: it begins again (its camera stood)
  function coarse(view, base, coarser, anew) {
    view.coarser = base + Math.min(coarser, Math.max(0, BIAS.MOST - view.e.press));
    if (anew) view.fresh = true;
  }

  // The shots ahead (2.3 step 4): for each its own view, its mirrors' and its casting lights' placed — with its
  // overrides, the stage's size. A shot is its entry of f.ahead: one that is another begins anew (its views are made
  // for it: `fresh` — SH10). Its own view is asked at weight 0.5 — at the frame's, 1, where it is the film's next beat
  // (`next`): the frame's backlog on a riding camera never ends, and a page the frame lacks by one level (read from its
  // parent, a level soft) then ranks no higher than one the shot lacks by two. Not in a whole call: the frame held
  // comes first, so its hold ends as soon as it can
  function aheads(f) {
    for (let k = aheadShots.length - 1; k >= 0; k--) {
      if (f.ahead.indexOf(aheadShots[k]) >= 0) continue;
      for (let j = k; j + 1 < aheadShots.length; j++) { aheadShots[j] = aheadShots[j + 1]; aheadStates[j] = aheadStates[j + 1]; }
      aheadShots.pop(); aheadStates.pop();
    }
    for (let a = 0; a < f.ahead.length; a++) {
      const A = f.ahead[a];
      let k = aheadShots.indexOf(A);
      if (k < 0) {
        k = aheadShots.length;
        const view = createView(gpu, 'ahead', false);
        view.ahead = true; view.inserts = true; view.stage = f.stage;
        // (tick: world.tick of the call that last placed it)
        aheadShots.push(A); aheadStates.push({ view, mirrors: null, shadow: null, groups: null, slots: null, tick: 0, over: false, pages: 1, entered: 0, press: 0, moved: true, coarser: 0, least: Infinity });
      }
      const st = aheadStates[k], view = st.view;
      view.e.place(world, A.camera, px[2], px[3]);
      view.weight = A.next && !f.whole ? 1 : 0.5;
      view.over = A.over; view.overN = A.overN; view.nodes = A.nodes; view.nodeOf = A.nodeOf; view.nodesN = A.nodesN;
      // (its swaps or its overrides became other than they were since the call before — SCENE stamps the entry: RN4)
      st.over = since(A.stamp, st.tick); st.tick = world.tick;
      // (a tick its camera stands — the same as at its last ask — its views begin anew at their full sharpness)
      st.moved = !sameCamera(A.camera, view.e.was);
      const anew = !st.moved && st.coarser > 0;
      if (!st.moved) { st.coarser = 0; st.least = Infinity; }
      st.groups = mirrors.ahead(st, view, A, px[2], px[3]);
      st.slots = shadows.ahead(st, view, A, lights);
      coarse(view, 0, st.coarser, anew);
      for (let g = 0; g < st.groups.length; g++) coarse(st.groups[g].view, 0, st.coarser, anew);
      for (let s = 0; s < st.slots.length; s++) for (let v = 0; v < st.slots[s].views; v++) coarse(st.slots[s].cells[v].view, SHADOW.COARSER, st.coarser, anew);
    }
  }
  // their quads culled (where what a cull is worked out from changed), with the shot's overrides; then the faces of
  // its point lights that are asked
  function aheadCulls() {
    for (let k = 0; k < aheadShots.length; k++) {
      const st = aheadStates[k];
      cullAhead.ahead = aheadShots[k]; cullAhead.mirror = null; cullAhead.light = -1;
      listed(st.view, cullAhead, st.over);
      for (let g = 0; g < st.groups.length; g++) { cullAhead.mirror = st.groups[g]; listed(st.groups[g].view, cullAhead, st.over); }
      cullAhead.mirror = null;
      for (let s = 0; s < st.slots.length; s++) for (let v = 0; v < st.slots[s].views; v++) {
        const slot = st.slots[s], c = slot.cells[v];
        cullAhead.light = slot.light;
        // (a cell that is another light's now: its list is that light's casters')
        listed(c.view, cullAhead, st.over || c.culledFor !== slot.light);
        c.culledFor = slot.light;
      }
      shadows.faces(st.slots);
    }
  }
  // … and asked: a shot's pages missing, of all its views (told on its entry too, `pages`: what a story that waits
  // on it is shown to wait for — RN4) — those of them that entered with this cycle, and the greatest pressure its
  // views were asked at
  function aheadAsks(first) {
    for (let k = 0; k < aheadStates.length; k++) {
      const st = aheadStates[k], over = first && st.over;
      let pages = ask(st.view, over), entered = st.view.entered, press = st.view.e.press;
      for (let g = 0; g < st.groups.length; g++) { const view = st.groups[g].view; pages += ask(view, over); entered += view.entered; press = Math.max(press, view.e.press); }
      for (let s = 0; s < st.slots.length; s++) for (let v = 0; v < st.slots[s].views; v++) {
        const c = st.slots[s].cells[v];
        if (c.on) { pages += ask(c.view, over); entered += c.view.entered; press = Math.max(press, c.view.e.press); }
      }
      st.pages = aheadShots[k].pages = pages; st.entered = entered; st.press = press;
    }
  }
  // … and judged (2.3 step 4): `a.whole`, `a.bias`, `a.land` (the tiles of its land it still lacks, at the levels it
  // reads — with `pages`, what a story that waits on it waits for: RN4). A view that stands: every ask returned 0 and the land has all it
  // draws. One that moves: it lacks nothing at the sharpness asked — or it is at BIAS.MOST with the land's coarsest
  // level there; else, where something entered what it asks and what it lacks is not less than the least it has
  // lacked at this `coarser`, a quarter level coarser from the next tick on; and where it lacks nothing and nothing
  // entered, a quarter level finer
  function aheadJudge() {
    for (let k = 0; k < aheadShots.length; k++) {
      const A = aheadShots[k], st = aheadStates[k];
      if (!st.moved) { A.land = land.aheadLack(A, 0); A.whole = st.pages === 0 && A.land === 0; }
      else {
        A.land = land.aheadLack(A, st.coarser >> 2);
        const lack = st.pages + A.land, entered = st.entered > 0 || land.aheadEntered(A);
        A.whole = lack === 0 || (st.coarser === BIAS.MOST && land.aheadCoarsest(A));
        if (!A.whole) {
          if (lack < st.least) st.least = lack;
          else if (entered) { if (st.coarser < BIAS.MOST) st.coarser++; st.least = Infinity; }
        } else if (lack === 0 && !entered && st.coarser > 0) { st.coarser--; st.least = Infinity; }
      }
      A.bias = Math.min(BIAS.MOST, st.coarser + st.press);
    }
  }

  // the Frame uniform (4.1): the shared fields and RENDER's own (its inserts' and the air's part are in the data
  // already: render/sky.js, render/air.js)
  function writeFrame(f, look, reach) {
    const O = world.origin, t = f.t, n = Math.floor(t / TIME.STEP), c = f.camera;
    F32[FRAME.TIME / 4] = t % TIME.WRAP; U32[FRAME.TICK / 4] = counters.frames; F32[FRAME.PULSE / 4] = 1 + PULSE.DEPTH * (0.5 + 0.5 * Math.sin(PULSE.RATE * t));
    F32[FRAME.EPOCH / 4] = n - (n & 4095); F32[FRAME.EPOCH / 4 + 1] = n & 4095; F32[FRAME.SINCE / 4] = t - n * TIME.STEP; F32[FRAME.INSIDE / 4] = look.inside;
    const amb = Math.pow(Math.max(0, look.ambient), 2.2), wl = Math.sqrt(look.wind[0] ** 2 + look.wind[1] ** 2) || 1;
    for (let k = 0; k < 3; k++) {
      F32[FRAME.AMBIENT / 4 + k] = look.ambientColor[k] * amb; F32[FRAME.HAZE / 4 + k] = look.hazeColor[k];
      F32[FRAME.ORIGIN / 4 + k] = O[k];
    }
    F32[FRAME.HAZE_REACH / 4] = reach; U32[FRAME.LIGHT_N / 4] = lights.lightN;
    F32[FRAME.WIND / 4] = look.wind[0] / wl; F32[FRAME.WIND / 4 + 1] = look.wind[1] / wl; F32[FRAME.WIND / 4 + 2] = look.wind[2];
    U32[FRAME.FAR_N / 4] = lights.farN; U32[FRAME.THROUGH_N / 4] = lights.throughN; U32[FRAME.SKY / 4] = skyBase < 0 ? 0xffffffff : skyBase;
    F32.set(lights.gridAt, FRAME.GRID / 4);
    F32[FRAME.HAZE_GLOW / 4] = look.hazeGlow; F32[FRAME.SHAFTS / 4] = look.shafts; U32[FRAME.SPOT_N / 4] = lights.spotN;
    F32[FRAME.GAZE / 4] = -c.rot[2]; F32[FRAME.GAZE / 4 + 1] = -c.rot[5]; F32[FRAME.GAZE / 4 + 2] = -c.rot[8];
    viewProj(c, O, F32, FRAME.AIR_VP / 4);
    gpu.write(frameU, 0, frameData);
  }

  const bound = (pass, group1_) => { pass.setBindGroup(0, frameGroup); pass.setBindGroup(1, group1_); pass.setBindGroup(2, none); pass.setBindGroup(3, none); };
  const at = (pass, x, y, w, h) => { pass.setViewport(x, y, w, h, 0, 1); pass.setScissorRect(x, y, w, h); };
  // a view's world drawn into a pass of its targets — the main passes', a mirror's (turned: by the mirror's set, the
  // people's winding turned): opaque paint, the people, the sky — its base where its sheets do not reach (past: the
  // view shows the sky past its painting — a pane's image shows no sky; the frame's view, only where it is: skyPast),
  // then its sheets
  function solids(pass, view, turned, past) {
    bound(pass, view.e.group);
    quads.draw(pass, view.e.lists.solid, none, null);
    if (people) {
      const before = quads.counters.triangles;
      if (people.draw(pass, 'main', view.e.sees, null, turned, quads.counters)) { pass.setBindGroup(2, none); pass.setBindGroup(3, none); }
      peopleTriangles += quads.counters.triangles - before;
    }
    if (past && skyBase >= 0) {
      pass.setPipeline(turned ? sky.mirror : sky.pipe); pass.setBindGroup(2, sky.own ? own.bind(world.quads.own[skyBase] - 1) : none); pass.setBindGroup(3, none); pass.draw(3);
      if (sky.own) pass.setBindGroup(2, none);
      quads.counters.draws++; quads.counters.triangles++;
    }
    quads.draw(pass, view.e.lists.sky, none, null);
  }

  // what the people here cover of the frame's view (e) and the farthest of them before the eye → MARKS (the frame
  // cull's `marks`: what may hide them); null: none of them in it
  function inked(e) {
    const list = people.list, B = MARKS.box;
    B[0] = 1; B[1] = 1; B[2] = -1; B[3] = -1; MARKS.far = -Infinity;
    for (let i = 0; i < list.length; i++) {
      if (!people.sphere(list[i].id, S4) || !covers(e, S4, R4)) continue;
      B[0] = Math.min(B[0], R4[0]); B[1] = Math.min(B[1], R4[1]); B[2] = Math.max(B[2], R4[2]); B[3] = Math.max(B[3], R4[3]);
      ahead(e, S4, A1, 0); MARKS.far = Math.max(MARKS.far, A1[0] + S4[3]);
    }
    return B[2] > B[0] && B[3] > B[1] ? MARKS : null;
  }
  // (that box as px of the frame → INKED (x, y, w, h): clip −1 … 1, y up → px, y down); false: no pixel of it
  function inkedPx() {
    const B = MARKS.box, x0 = Math.floor(px[0] + 0.5 * (B[0] + 1) * px[2]), y0 = Math.floor(px[1] + 0.5 * (1 - B[3]) * px[3]);
    INKED[0] = x0; INKED[1] = y0;
    INKED[2] = Math.min(px[0] + px[2], Math.ceil(px[0] + 0.5 * (B[2] + 1) * px[2])) - x0; INKED[3] = Math.min(px[1] + px[3], Math.ceil(px[1] + 0.5 * (1 - B[1]) * px[3])) - y0;
    return INKED[2] > 0 && INKED[3] > 0;
  }

  // The passes that are drawn whether the frame is shown or held: the land's shadow, the static shadow cells chosen
  // for this call (render/shadows.js ration)
  function bakes() {
    if (land.bakeDue) {
      timing.mark('bake');
      bakePass.colorAttachments[0].view = land.bakeTarget();
      const pass = gpu.pass('bake', bakePass);
      land.bake(pass);
      pass.end();
    }
    let pass = null;
    for (let k = 0; k < shadows.slots.length; k++) for (let v = 0; v < shadows.slots[k].views; v++) {
      const c = shadows.slots[k].cells[v];
      if (!c.now) continue;
      if (!pass) { timing.mark('shadow-static'); pass = gpu.pass('shadow-static', staticPass); }
      const cell = shadows.cellPx(c, false);
      at(pass, cell[0], cell[1], cell[2], cell[2]);
      pass.setPipeline(clearPipe); pass.draw(3);
      bound(pass, cast(c.view));
      quads.draw(pass, c.view.e.lists.cast, none, null);
      shadows.drew(c);
    }
    if (pass) pass.end();
  }

  function draw(f, look, reach, hidden) {
    const O = world.origin;
    gpu.begin();
    if (!hidden) bakes();
    if (!hidden && shadows.moversDue) {
      timing.mark('shadow-movers');
      const pass = gpu.pass('shadow-movers', moversPass);
      for (let k = 0; k < shadows.slots.length; k++) for (let v = 0; v < shadows.slots[k].views; v++) {
        const s = shadows.slots[k], c = s.cells[v];
        if (!c.placed) continue;
        const cell = shadows.cellPx(c, true);
        at(pass, cell[0], cell[1], cell[2], cell[2]);
        bound(pass, cast(c.moves));
        quads.draw(pass, c.moves.e.lists.movers, none, null);
        const before = quads.counters.triangles;
        if (shadows.drawPeople(pass, s, c, quads.counters)) { pass.setBindGroup(2, none); pass.setBindGroup(3, none); }
        peopleTriangles += quads.counters.triangles - before;
        if (s.kind === 0 && particles.casting) { particles.cast(pass, post.depth); pass.setBindGroup(2, none); }
      }
      pass.end();
      shadows.drewMovers();
    }
    shadows.write(lights, O);
    if (!hidden && shadows.blobDue) {
      timing.mark('blob');
      const pass = gpu.pass('blob', blobPass);
      shadows.drawBlob(pass, O);
      pass.end();
    }
    if (!hidden && air.on) { timing.mark('air'); air.draw(frameGroup, airGroup, lights); }
    // the mirrors chosen for this call: those whose own view changed, and of the others due the one that waited
    // longest (all, in a whole frame). Each in one pass, by the mirror's own set: opaque paint, the people, the sky,
    // what blends, then every glow of the frame's rows (the GPU clips those out of its view); a rough one's image
    // then smeared
    if (!hidden) for (let k = 0; k < mirrors.list.length; k++) {
      const I = mirrors.list[k];
      if (!I.now) continue;
      const w = I.size[0], h = I.size[1], masks = I.clipped ? mirrors.masksOf(I) : post.masks;
      if (I.clipped) {
        timing.mark('masks');
        masksPass.colorAttachments[0].view = masks;
        const pass = gpu.pass('masks', masksPass);
        at(pass, 0, 0, w, h);
        bound(pass, cast(I.view));
        quads.draw(pass, I.view.e.lists.mask, none, null);
        pass.end();
      }
      timing.mark('mirror');
      group1(I.view, masks, land.field);
      mirrorPass.colorAttachments[0].view = I.imageView; mirrorPass.colorAttachments[1].view = mirrors.ids; mirrorPass.depthStencilAttachment.view = mirrors.depth;
      const pass = gpu.pass('mirror', mirrorPass), before = quads.counters.lit;
      at(pass, 0, 0, w, h);
      // (a pane has no sky)
      solids(pass, I.view, true, !I.glass);
      quads.draw(pass, I.view.e.lists.blend, none, null);
      if (lights.glowN) {
        pass.setPipeline(glowMirror); pass.setVertexBuffer(0, lights.glows);
        pass.draw(4, lights.glowN);
        quads.counters.draws++; quads.counters.triangles += 2 * lights.glowN;
      }
      pass.end();
      mirrored += quads.counters.lit - before;
      mirrors.drew(I, O);
      if (I.rough > 0) mirrors.smear(I);
    }
    mirrors.write(O);
    group1(frameView, post.masks, land.field);
    if (clips && !hidden) {
      timing.mark('masks');
      masksPass.colorAttachments[0].view = post.masks;
      const pass = gpu.pass('masks', masksPass);
      at(pass, px[0], px[1], px[2], px[3]);
      bound(pass, cast(frameView));
      quads.draw(pass, frameView.e.lists.mask, none, null);
      pass.end();
    }
    timing.mark('main-solid');
    let pass = gpu.pass('main-solid', solidPass);
    at(pass, px[0], px[1], px[2], px[3]);
    if (!hidden) {
      solids(pass, frameView, false, skyPast);
      // (the air's light over the sky: where nothing stands before it — 5.18)
      if (air.on) air.sky(pass);
    }
    pass.end();
    timing.mark('main-blend');
    pass = gpu.pass('main-blend', blendPass);
    at(pass, px[0], px[1], px[2], px[3]);
    bound(pass, frameView.e.group);
    if (!hidden) {
      quads.draw(pass, frameView.e.lists.blend, none, sprites);
      // (the beams in the haze, per pixel: after what blends — their light lies over it, cut by the solid depth)
      if (air.beams) air.beam(pass, post.depth, lights, none);
      // (what blends wholly and may hide the people, laid again where its paint is opaque: the ids behind it cleared —
      // no one's lines through it —, only over what the people cover of the frame)
      if (cullFrame.marks && frameView.e.lists.marks.runsN && inkedPx()) {
        pass.setScissorRect(INKED[0], INKED[1], INKED[2], INKED[3]);
        quads.draw(pass, frameView.e.lists.marks, none, null);
        pass.setScissorRect(px[0], px[1], px[2], px[3]);
      }
    }
    quads.draw(pass, frameView.e.lists.inserts, none, null);
    pass.end();
    post.draw(look, f.veil, canvasPx, f.camera, people ? people.inks : null, reach, counters.frames, bw / Math.max(1, host.w), timing);
    timing.mark('submit');
    gpu.submit();
    timing.mark(null);
  }

  const R = {
    lib, counters, lacks,
    // RN2: the closed set of pipelines of a world that has `has`, asked now (they compile while the world is made)
    prepare(has) {
      wanted = has.own;
      // (a failure is told by R.build, which waits for the same pipelines)
      lib.all(has).catch(() => {});
    },
    // RN2: what is made for the new world before it is drawn — its emitters' buffers, its painted sprites, its
    // pipelines: it resolves when every pipeline of the world's own set is made (not on gpu.ready(): another show's
    // are not waited for) → made, for R.use or R.drop; nothing is switched. When it rejects nothing changed, and what
    // was made is dropped (R.drop)
    async build(next) {
      const made = { world: next, particles: createParticles(gpu, sheets, lib, host) }, has = next.C.has;
      // (side by side, each to its end)
      const [pictured, piped] = await Promise.allSettled([made.particles.build(next), lib.all(has)]);
      // (an own shader that does not compile or is refused: said with the elements that have it and the author's
      // line — LG13)
      const said = await lib.fault(next);
      if (said || pictured.status === 'rejected' || piped.status === 'rejected') {
        R.drop(made);
        throw said ? new Error(said) : pictured.status === 'rejected' ? pictured.reason : piped.reason;
      }
      return made;
    },
    // RN2: a made world that will not be drawn — its show replaced or failed before the switch — let go: the emitters'
    // buffers and sprites, and what was made of the own texts that neither the world drawn nor another being made
    // ready has
    drop(made) {
      made.particles.dispose();
      lib.keep(world ? world.C.has.own : null, wanted === made.world.C.has.own ? null : wanted);
    },
    // RN2: the switch — synchronous, in the task the scene shown changes in: R draws the new world and lets go of what
    // it held for the one before: its tables, its sprites, the land's fields and bake uniforms, the pipelines, modules
    // and chunks of own texts neither the new world nor the one being made ready has
    use(made) {
      const next = made.world, has = next.C.has;
      particles.dispose();
      particles = made.particles;
      world = next; people = next.people || null; clips = !!has.clips;
      persons = new Uint8Array(next.nodes.cap);
      for (const el of next.elements) if (el.kind === 'person') persons[el.node] = 1;
      survey.build(next); quads.build(next); lights.build(next); shadows.build(next, people); mirrors.build(next); land.build(next); own.build(next);
      glowMirror = has.reflects || has.glass ? lib.get('glow:mirror') : null;
      skies = next.elements.filter(el => el.kind === 'sky').map(el => {
        const sh = el.spec.shader, key = sh ? `sky-base:own:${lib.ownKey(sh.text, sh.names)}` : 'sky-base';
        return { el, own: !!sh, pipe: lib.get(key), mirror: has.reflects || has.glass ? lib.get(`${key}:mirror`) : null };
      });
      sky = null; skyBase = -1;
      lib.keep(has.own, wanted);
      aheadShots.length = 0; aheadStates.length = 0;
      // (nothing is kept of the views' asks of the world before)
      frameView.e.anew(); towardView.e.anew();
      last.drawn = false; last.shot = -1; shotSeen = -1; frameGroup = null;
    },
    // RN3: after SCENE copied a `size` into host — the targets at the start of the next R.frame; the canvas's own
    // size in the call that draws
    resize() { resized = true; },

    // RN4
    frame(f) {
      counters.frames++;
      mirrored = 0; peopleTriangles = 0; counters.asked = 0;
      const worked = sheets.asking.worked;
      timing.begin(); survey.begin();
      if (!world) { counters.placed = counters.quads = counters.listed = counters.persons = counters.shown = 0; tally(false); if (f.whole) { counters.held++; return 0; } counters.idle++; return 1; }
      const next = f.next;
      const sizedNow = resized;
      if (resized) targets();
      stampOf();
      const O = world.origin, look = world.look, reach = hazeReach(look.haze), stamped = stamps.all, Q = world.quads;
      counters.quads = Q.n; counters.persons = world.persons.length;
      // the canvas in the buffer: the size of the frame's view, of `toward`'s and of every shot's
      px[0] = 0; px[1] = 0; px[2] = bw; px[3] = bh;
      canvasPx.set(px);
      // b. the pages that arrived placed: the cover is judged by them (SH13 — a page with a hole lifts it in this call)
      timing.mark('place');
      counters.placed = sheets.place(f.whole ? Infinity : host.pages);
      // c. the views placed. (At a new shot the frame's view begins: SHEETS starts its pressure at 0 — SH10, 5.19)
      timing.mark('view');
      if (f.shot !== shotSeen) { shotSeen = f.shot; frameView.fresh = true; }
      stage.place(world, F32);
      const hidden = stage.covered;
      // (the sky's base: the first sky element shown, with a sheet; whether the frame's view shows anything past it)
      sky = null; skyBase = -1;
      for (let k = 0; k < skies.length; k++) {
        const el = skies[k].el;
        if (el.count > 0 && Q.sheet[el.first] >= 0 && (Q.flags[el.first] & FLAG.SHOWN)) { sky = skies[k]; skyBase = el.first; break; }
      }
      skyPast = skyBase >= 0 && stage.past(world, f.camera, skyBase);
      // (a whole call's work for the world — nothing of it rationed: in a call with f.whole, and in the call in which
      // a cover lifts)
      const all = f.whole || (last.drawn && last.hidden && !hidden);
      frameView.e.place(world, f.camera, px[2], px[3]);
      frameView.weight = hidden ? 0.5 : 1; frameView.inserts = true; frameView.stage = f.stage; frameView.over = f.over; frameView.overN = f.overN;
      // (the camera another than at the call before — the frame's view is asked in every call —, or a row of the
      // world stamped since: what the idle rule asks; whether the view is asked anew is `ask`'s own test)
      const moved = !sameCamera(f.camera, frameView.e.was) || stamped !== last.stamp;
      last.stamp = stamped;
      towards = !!f.toward;
      if (towards) {
        towardView.e.place(world, f.toward, px[2], px[3]);
        towardView.weight = 0.5; towardView.inserts = true; towardView.stage = f.stage;
      }
      timing.mark('lights');
      lights.choose(frameView, O, look.hazeGlow);
      air.place(look, reach, lights, F32, FRAME.AIR_IN / 4, world, f.camera.eye);
      timing.mark('land');
      land.frame(f, lights, hidden, all);
      timing.mark('mirrors');
      mirrors.place(frameView, px[2], px[3]);
      lights.glowsIn(frameView, mirrors.list);
      timing.mark('shadows');
      shadows.place(frameView, f, lights, stamps.rows);
      timing.mark('ahead');
      aheads(f);
      timing.mark('particles');
      particles.frame(f.t, frameView);
      // d. the people shown (their versions are this frame's from here)
      timing.mark('people');
      const peopleChanged = people ? people.show(seen) : false;
      counters.shown = people ? people.shown() : 0;
      shadows.blobs(frameView, O);
      // e. cull and order
      timing.mark('cull');
      quads.begin(lights.points || lights.throughN > 0 || land.shades(), air.on, reach, shadows.blobRect, land.tall);
      own.frameNo++;
      land.group = land.bind ? quads.group(land.bind) : 0;
      mirrors.groups(quads);
      cullFrame.particles = particles;
      cullFrame.marks = people ? inked(frameView.e) : null;
      cullAlways(0, frameView, cullFrame);
      counters.listed = frameView.n;
      timing.mark('cull mirrors');
      for (let k = 0; k < mirrors.list.length; k++) { const I = mirrors.list[k]; cullMirror.mirror = I; cullAlways(1, I.view, cullMirror); counters.listed += I.view.n; mirrors.stale(I, people, lights, own); }
      timing.mark('cull shadows');
      // (the casting lights' views: under a cover too — a cell due then is drawn when the cover lifts, its pages there)
      for (let k = 0; k < shadows.slots.length; k++) for (let v = 0; v < shadows.slots[k].views; v++) {
        const c = shadows.slots[k].cells[v];
        if (!c.look) continue;
        cullStatic.light = shadows.slots[k].light;
        // (it stands as it was drawn, and no row stamped since it was looked at is its matter: no cull)
        if (shadows.stands(c) && !quads.changes(c.view, cullStatic, c.lookedTick, true)) { shadows.stood(c); if (survey.on) survey.culled(2, -1, 0, 0); continue; }
        cullAlways(2, c.view, cullStatic);
        counters.listed += c.view.n;
        shadows.stale(c);
      }
      shadows.faces(shadows.slots);
      shadows.due();
      timing.mark('cull ahead');
      if (towards) listed(towardView, cullAsk, false);
      aheadCulls();
      if (survey.on) survey.stamps(world, frameView, !sameCamera(frameView.camera, frameView.e.was), persons);
      // f. the asks, in the order of service; in a whole frame repeated until the cache's pressure stands (a view asked
      // again in the same call is not changed: what it named is named again)
      for (let first = true; ; first = false) {
        // (all of the frame's views — its own, its mirrors', its shadow cells' — worked out while swaps wait in them,
        // and in the call after the last of them is gone: a swap is no row's stamp)
        const over = first && (f.overN > 0 || last.swaps);
        timing.mark('ask'); askSlot = 0;
        let pages = ask(frameView, over);
        timing.mark('ask mirrors'); askSlot = 1;
        for (let k = 0; k < mirrors.list.length; k++) { const I = mirrors.list[k]; I.asked = ask(I.view, over); pages += I.asked; }
        timing.mark('ask shadows'); askSlot = 2;
        for (let k = 0; k < shadows.viewsDue.length; k++) { const c = shadows.viewsDue[k]; c.asked = ask(c.view, over); pages += c.asked; }
        timing.mark('ask ahead'); askSlot = 3;
        if (towards) ask(towardView, false);
        aheadAsks(first);
        // (the scene being made beside this one: its opening view last — what is left of the cache is its)
        if (next) { next.lacking = sheets.ask(next); next.changed = 0; }
        lacks.pages = pages;
        timing.mark('weigh');
        const again = sheets.weigh();
        if (!f.whole || !again) break;
      }
      last.swaps = f.overN > 0;
      counters.asked = sheets.asking.worked - worked;
      timing.mark('judge');
      aheadJudge();
      // g. what is wanted goes to the painters
      timing.mark('request');
      sheets.request();
      timing.mark('outcome');
      // what this call draws of the rationed things — none under a cover: the static cells (their movers' views
      // placed as they are, or are about to be, drawn), the movers' lists, the mirrors
      const cells = !hidden && shadows.ration(all);
      shadows.judge(particles.casting);
      if (!hidden && shadows.moversDue) for (let k = 0; k < shadows.slots.length; k++) for (let v = 0; v < shadows.slots[k].views; v++) {
        const c = shadows.slots[k].cells[v];
        if (!c.placed) continue;
        cullMovers.light = shadows.slots[k].light;
        quads.cull(c.moves, cullMovers);
      }
      let longest = null, mirrorsDue = false;
      for (let k = 0; k < mirrors.list.length; k++) { const I = mirrors.list[k]; if (I.due) mirrorsDue = true; if (I.due && !I.moved && (!longest || I.waited > longest.waited)) longest = I; }
      for (let k = 0; k < mirrors.list.length; k++) { const I = mirrors.list[k]; I.now = I.due && (I.moved || all || I === longest); }
      // h. the outcome
      lacks.wait = !!f.wait; lacks.sheets = !sheets.whole(world); lacks.land = hidden ? 0 : land.lacks; lacks.cells = 0; lacks.mirrors = 0;
      for (let k = 0; k < shadows.viewsDue.length; k++) { const c = shadows.viewsDue[k]; if (c.due && c.asked !== 0) lacks.cells++; }
      for (let k = 0; k < mirrors.list.length; k++) if (mirrors.list[k].asked !== 0) lacks.mirrors++;
      const whole = !lacks.wait && !lacks.sheets && lacks.pages === 0 && !lacks.land;
      frame0();
      if (f.whole && !whole) {
        // held: the canvas keeps its picture; the bakes and the shadow cells that can be drawn are, and what they
        // read is written
        if (land.bakeDue || cells) {
          quads.flush();
          for (let k = 0; k < shadows.slots.length; k++) for (let v = 0; v < shadows.slots[k].views; v++) if (shadows.slots[k].cells[v].now) shadows.writeView(shadows.slots[k].cells[v], O);
          writeFrame(f, look, reach);
          gpu.begin();
          bakes();
          timing.mark('submit');
          gpu.submit();
        }
        timing.mark(null);
        tally(false);
        counters.held++;
        return 0;
      }
      // idle? What the picture is made of, as numbers: the sheets and the own shaders' values of the quads in view —
      // under a solid insert that covers the stage, of the inserts alone — and whether any of them moves by itself, or
      // shows its mirror through water that ripples (the overlay's own arithmetic reads the time)
      let sig = frameView.n, moves = false, rows = 0;
      for (let k = 0; k < frameView.n; k++) {
        const q = frameView.list[k], layer = Q.layer[q];
        if (hidden && Q.kind[q] !== QUAD.INSERT) continue;
        if (Q.sheet[q] >= 0) sig = (sig * 31 + sheets.stamp(Q.sheet[q])) | 0;
        if (Q.own[q]) sig = (sig * 31 + world.own[Q.own[q] - 1].stamp) | 0;
        if (movesItself(world, own, q)) moves = true;
        if (Q.flags[q] & (FLAG.REFLECTS | FLAG.GLASS)) { const m = mirrors.of(q); if (m && m.group && m.ripple > 0) moves = true; }
        rows = Math.max(rows, Q.stamp[q], world.nodes.stamp[Q.node[q]], layer >= 0 ? world.layers.stamp[layer] : 0);
      }
      const panes = world.panes ? world.panes.stamp : -1;
      // (work waiting: rationed things not yet drawn or baked — none while the world is hidden)
      const waits = land.bakeDue || land.waiting || shadows.cellsDue || shadows.moversDue || shadows.blobDue || mirrorsDue;
      const world_ = hidden ? rows === last.rows : !moved && !peopleChanged && !waits && panes === last.panes && !lights.flickers && !particles.alive;
      const still = !f.whole && last.drawn && !sizedNow && world_ && !moves && sig === last.sig && look.stamp === last.look && stage.stamp === last.inserts && last.shot === f.shot && last.hidden === hidden && last.veil === f.veil;
      if (still) { timing.mark(null); tally(false); counters.idle++; return 1; }
      // i. RENDER's buffers written, then the passes
      timing.mark('write');
      quads.flush(); lights.write(); particles.write(f.camera.eye); land.write();
      frameView.e.write(O, 0, null, 0, null, frameView.drawn, f.stage);
      if (!hidden) {
        for (let k = 0; k < mirrors.list.length; k++) if (mirrors.list[k].now) mirrors.writeView(mirrors.list[k], O);
        for (let k = 0; k < shadows.slots.length; k++) for (let v = 0; v < shadows.slots[k].views; v++) {
          const c = shadows.slots[k].cells[v];
          if (c.now) shadows.writeView(c, O);
          if (c.placed && shadows.moversDue) shadows.writeMoves(c, O);
        }
      }
      writeFrame(f, look, reach);
      draw(f, look, reach, hidden);
      last.drawn = true; last.sig = sig; last.rows = rows; last.look = look.stamp; last.inserts = stage.stamp; last.panes = panes; last.shot = f.shot; last.hidden = hidden; last.veil = f.veil;
      tally(true);
      counters.drawn++;
      return 2;
    },

    // RN7: what is waited for (PG8's shape, the renderer's part), or null; and in plain words
    waits() {
      const pipelines = R.pipelines(), pages = lacks.pages;
      if (!pipelines && !pages && !lacks.land && !lacks.cells && !lacks.sheets) return null;
      const W = {};
      if (pipelines) W.pipelines = pipelines;
      if (pages || lacks.sheets) W.pages = Math.max(1, pages);
      if (lacks.land) W.land = true;
      if (lacks.cells) W.shadows = true;
      return W;
    },
    // whether R's own work is still under way and gets there by itself, frame by frame: pipelines being made, the land
    // still baked by its ration — the frame's field or a shot's ahead (RN4: one of the things a wait is not stuck on)
    working() { return land.waiting || !!R.pipelines(); },
    // … the pipelines being made — [made, asked] —, undefined: all are made
    pipelines() { const w = gpu.waiting(); return w[0] < w[1] ? w : undefined; },
    missing() {
      const out = [];
      if (!world) out.push('no world is built');
      if (lacks.wait) out.push('a painting of something shown is being made, or people are being built');
      if (lacks.sheets) out.push('a sheet shown has no top page yet');
      if (lacks.pages) out.push(`${lacks.pages} pages of the frame's own views are not in the cache`);
      if (lacks.mirrors) out.push(`${lacks.mirrors} mirrors' views lack pages`);
      if (lacks.cells) out.push(`${lacks.cells} shadow cells' views lack pages`);
      if (lacks.land) out.push('the land has not what the frame draws');
      return out;
    },
    // RN8
    detailed(on) { timing.detailed(on); survey.detailed(on); },
    get timing() { return timing.timing; },
    // the detail's counts beside R.timing (survey.js): names, and ONE array rewritten in place; the elements' stamps so far
    get wide() { return survey.collect(); },
    wideNames: survey.names,
    stamped: () => survey.take(),
  };
  return R;
}
