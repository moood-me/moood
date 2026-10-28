// The scene's thread (a worker): what a scene is made of runs here — its elements' painting, its scripts, its modules,
// its people, the engine drawing it on the canvas the page gave over (an OffscreenCanvas) — so however much it does,
// the page it is on (its buttons, its panels, the viewer's sign of waiting) never waits for it. stage.js is its page
// side: it passes the page's input on, asks the stage and the state, and keeps what this thread says.
//   From the page: 'mount' { canvas, overlay, w, h, dpr, flags } — the stage made (or not: 'mounted' says why it cannot
// be — no WebGL2 —, and every call is refused with it); 'size' { w, h, dpr }; 'in' { ev }
// — the page's input (engine.js mount: host.on); 'call' { id, fn, args } — answered by 'reply' { id, value | error }.
//   To the page: after each frame 'frame' { frame, camera, hero, fixed, points, state? }: where the frame lies in the
// canvas, the camera, a platformer's hero, whether the viewer's moves are the scene's own, where the points the page
// follows are (track), where the selection is (pick.js), the state when it changed; 'selecting' { overlay, offer } — the canvases the selection glows on and what may be picked (pick.js); 'change' / 'move' { key, value, old } — a value of the state set /
// moving (move: only for the keys the page listens to); 'tell' { text, about }, 'save' { changes } — what the scene's
// scripts tell, what the game keeps; 'perf' { text }; with each of them, what went wrong since (errors, warnings).
importScripts('../../i18n/i18n.js', 'kit.js', 'engine.js', 'three.js', 'world.js', 'scenestate.js', 'pick.js', 'frames.js');

// what goes wrong here is the scene's: said to the page with the next message
addEventListener('error', e => (globalThis.__mooodErrors ||= []).push(String(e.message || e.error || e)));
addEventListener('unhandledrejection', e => (globalThis.__mooodErrors ||= []).push(String(e.reason?.message || e.reason)));
let saidErrors = 0, saidWarnings = 0;
const post = (m, transfer) => {
  const errors = (globalThis.__mooodErrors || []).slice(saidErrors), warnings = (globalThis.__mooodWarnings || []).slice(saidWarnings);
  saidErrors += errors.length; saidWarnings += warnings.length;
  postMessage({ ...m, ...(errors.length ? { errors } : {}), ...(warnings.length ? { warnings } : {}) }, transfer || []);
};

// the page as the engine sees it (engine.js mount: host)
const handlers = new Map();
const host = {
  w: 1, h: 1, dpr: 1, flags: {}, overlay: null,
  on: (type, fn) => (handlers.get(type) || handlers.set(type, []).get(type)).push(fn),
  perf: text => post({ t: 'perf', text }),
  drawn: () => { picker?.drawGlow(); frameSaid(); },
  // what its frames were, told to the page now and then (frames.js)
  frames: MooodFrames(post, 1),
};
const emit = (type, e) => { for (const fn of handlers.get(type) || []) fn(e); };

let stage = null, picker = null, cannot = null;
// the points the page follows (stage.screenOf), by what it asked: 'ref|lift|over'
const tracked = new Map();
let saidState = null;
function frameSaid() {
  const points = {};
  for (const [k, [ref, lift, over]] of tracked) points[k] = stage.screenOf(ref, lift, over);
  const values = MooodState.all(), state = values !== saidState ? (saidState = values) : undefined;
  post({ t: 'frame', frame: stage.frame(), camera: stage.camera(), hero: stage.hero(), fixed: stage.fixed(), points, selected: picker?.box() ?? null, ...(state ? { state } : {}) });
}
// the values of the state set, told to the page (a widget's listener: kept however often the scene starts)
MooodState.on('change', (value, old, key) => post({ t: 'change', key, value, old }));
const moving = new Set();

const calls = {
  // what its frames were so far, told now (frames.js: the page is being left, or hidden)
  frames: () => host.frames.flush(),
  // the stage
  show: (spec, modules) => stage.show(spec, modules),
  resetCamera: () => stage.resetCamera(),
  setView: (left, right) => stage.setView(left, right),
  draw: how => stage.draw(how),
  ready: () => stage.ready(),
  seen: () => stage.seen(),
  still: values => stage.still(values),
  inspect: () => stage.inspect(),
  ground: (across, distance) => stage.ground(across, distance),
  track: (ref, lift, over) => { tracked.set(`${ref}|${lift}|${over}`, [ref, lift, over]); return stage.screenOf(ref, lift, over); },
  // the state (scenestate.js): the scene's scripts run here — what they tell, what the game keeps, said to the page
  start: (spec, state, { modules, tell, save, jump }) => {
    MooodState.start(spec, state, { stage, modules, jump, tell: tell ? (text, about) => post({ t: 'tell', text, about }) : null, save: save ? changes => post({ t: 'save', changes }) : null });
    saidState = null;
  },
  stop: () => MooodState.stop(),
  catchUp: then => MooodState.catchUp(then),
  set: (key, value, over, ease, opts) => MooodState.set(key, value, over, ease, opts),
  cut: (changes, opts) => MooodState.cut(changes, opts),
  turn: (key, degrees, over, ease) => MooodState.turn(key, degrees, over, ease),
  path: (keys, points, opts) => MooodState.path(keys, points, opts),
  prepare: (values, seconds) => MooodState.prepare(values, seconds),
  check: (keys, who) => MooodState.check(keys, who),
  unknown: () => MooodState.unknown(),
  all: () => MooodState.all(),
  // the moves of a value (null: of any) the page listens to
  listen: key => {
    if (moving.has(key)) return;
    moving.add(key);
    const fn = (value, last, k) => post({ t: 'move', key: k, value, old: last });
    if (key == null) MooodState.on('move', fn); else MooodState.on('move', key, fn);
  },
  // selecting (pick.js): the scene it is in, what is at a point of the canvas, the selection
  pickSpec: spec => picker.spec(spec),
  pick: (x, y, allowed) => picker.pick(x, y, allowed),
  select: path => picker.select(path),
  offer: paths => picker.offer(paths),
  // a render's time (clock.js), moved on with the page's
  run: ms => globalThis.__mooodTime.run(ms),
  // a play's time paused, or going on
  pause: on => globalThis.__mooodTime.pause(on),
};

onmessage = async ({ data: m }) => {
  if (m.t === 'mount') {
    // (a render's: the virtual clock, as the page's — before anything here starts to go by it)
    if (m.clock != null) { importScripts('clock.js'); MooodClock(m.clock, { real: m.real }); }
    Object.assign(host, { w: m.w, h: m.h, dpr: m.dpr, flags: m.flags, overlay: m.overlay });
    try { stage = Moood.mount(m.canvas, { host }); } catch (err) { cannot = String(err?.message || err); post({ t: 'mounted', cannot }); return; }
    post({ t: 'mounted', keys: Moood.KEYS, gpu: MooodFrames.card(m.canvas) });
  } else if (cannot) { if (m.t === 'call') post({ t: 'reply', id: m.id, error: cannot }); }
  else if (m.t === 'selecting') picker = MooodPick.create({ stage, host, overlay: m.overlay, offer: m.offer });
  else if (m.t === 'size') {
    Object.assign(host, { w: m.w, h: m.h, dpr: m.dpr });
    emit('size');
  } else if (m.t === 'in') emit(m.ev.type, m.ev);
  else if (m.t === 'call') {
    try { post({ t: 'reply', id: m.id, value: await calls[m.fn](...m.args) }); }
    catch (err) { post({ t: 'reply', id: m.id, error: String(err?.message || err) }); }
  }
};
