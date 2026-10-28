// Engine 3's side of the stage: the page's part of an engine-3 scene, behind the
// third branch of ../1/stage.js — which fetches this module, with the device's tier, as the first engine-3 scene
// wants it, and hands over (stageSide(hand)): the place, what the stage keeps for pages and layers (the last frame's
// info, the state's values, the listeners), what the thread before was told, how the stage hears a thread (replies,
// actions, events, lines said, the P panel — the same messages as for engine 1), how those who wait with the
// scene are told it stands (stands), how the actions the stage holds are ended (cancel), and how the stage is told
// of a canvas made anew (remade); and, each time the stage goes to engine 3, the canvas it made for that use (begin).
//   Here: the tier (found once a page, from the graphics adapter — or given: a render, the stand); the thread
// (./thread.js) started and given the canvas with PG1's `mount`; the viewer's moves gathered into one `in` a display
// frame; the place's size told once it has stood; every message of the thread heard — `frame` (what changed: kept at
// once, so what the stage answers is the latest; the layers placed — stage.onFrame — in the page's next display
// frame, all at once), `state`, `waits`, `lost`; where the tracked points are (screenOf: the thread projects them,
// with the camera it draws with); the scene stopped while the play is paused, the page hidden, the place out of sight
// or covered; the sign of waiting over a picture that stands — the voices and the music waiting with it —, and over
// one that goes on while the scene's story waits on a shot being made ready; the device lost — the thread started anew, the scene
// restored, once it is watched again; "cannot show the scene" where the device cannot, the thread does not start or
// the engine fails (for good: the thread ended, every call refused), and over a scene whose own fault stopped it
// (till the next scene is shown: the thread lives).
//   A render's page (a virtual clock that stands till it is moved) has no display frames, never pauses and shows no
// sign of waiting: there the layers are placed as each `frame` message comes.
//   The page's own waits — the size's standing, the one `in` a display frame, the layers' placing, the sign's delay and
// its least time — go by the browser's clock: where a clock of ours is installed (../1/clock.js: a play's stands
// while the play is paused) by the browser's own timers it gives, __mooodTimers.
const SETTLED = 150;            // ms the place's size has stood before it is told (PG2)
// s a picture is held — or the story has waited on a shot — before the sign of waiting shows; s the sign, once shown,
// stands at least (2.4)
const WAIT = { SHOWN: 0.25, LEAST: 0.5 };

// ── the tier (PG13) ──
// The class of each graphics architecture, by the adapter's `vendor` and `architecture` as Chrome gives them (Dawn's
// names, lower case) — an orientation: a wrong class is not a wrong picture (the thread's pacer settles the rate). A
// name ending in `*` stands for every architecture beginning so, read after the exact names; a pair not here is weak.
const TIERS = {
  intel: { 'gen-7': 'weak', 'gen-8': 'weak', 'gen-9': 'weak', 'gen-11': 'weak', 'gen-12lp': 'weak', 'gen-12hp': 'normal', 'xe-*': 'normal' },
  amd: { 'gcn-1': 'weak', 'gcn-2': 'weak', 'gcn-3': 'weak', 'gcn-4': 'weak', 'gcn-5': 'weak', 'rdna-*': 'normal' },
  nvidia: { '*': 'normal' },
  apple: { '*': 'normal' },
  qualcomm: { 'adreno-4xx': 'weak', 'adreno-5xx': 'weak', 'adreno-6xx': 'weak', 'adreno-*': 'normal' },
  // (one row for the whole of `valhall`: its weakest common member decides)
  arm: { midgard: 'weak', bifrost: 'weak', valhall: 'weak', 'gen-5': 'normal' },
  samsung: { '*': 'weak' },
  'img-tec': { '*': 'weak' },
};
function classOf(vendor, architecture) {
  const row = TIERS[vendor], name = String(architecture ?? '');
  if (!row) return 'weak';
  if (Object.hasOwn(row, name)) return row[name];
  for (const k in row) if (k.endsWith('*') && name.startsWith(k.slice(0, -1))) return row[k];
  return 'weak';
}
// → { tier, phone, budget } — or null: this device cannot show an engine-3 scene (no WebGPU, no adapter); rejected
// with the browser's own words when asking for the adapter fails
let found = null;
const tier = () => (found ||= (async () => {
  let phone, weak;
  const given = window.__mooodDevice;
  if (given) ({ phone, weak } = given);
  else {
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter) return null;
    phone = matchMedia('(pointer: coarse)').matches;
    weak = classOf(adapter.info?.vendor, adapter.info?.architecture) === 'weak';
    // (the graphics card, for the account of the device: MooodSeen, docs/host.md)
    globalThis.MooodSeen?.described({ gpu: { api: 'webgpu', vendor: adapter.info?.vendor ?? null, renderer: adapter.info?.description || [adapter.info?.architecture, adapter.info?.device].filter(Boolean).join(' ') || null } });
  }
  return { tier: weak ? 'weak' : 'normal', phone: !!phone, budget: phone ? (weak ? 960 * 540 : 1280 * 720) : (weak ? 1600 * 900 : 1920 * 1080) };
})());

// what the page says in the scene's place (in the page's language: words.js speak)
const tr = MooodI18n.part('engine3');
const SAID = { get waiting() { return tr('the scene is getting ready'); }, get device() { return tr('this device cannot show the scene'); }, get failed() { return tr('the scene could not be shown'); },
  get lost() { return tr('the graphics device was lost'); } };

// Engine 3's side of one stage — once its tier is known (no device: why, as it is reported)
export async function stageSide(hand) {
  let device = null, why = 'this browser gives no WebGPU adapter';
  try { device = await tier(); } catch (err) { why = String(err?.message || err); }
  return side(hand, device, why);
}

function side(hand, device, why) {
  const { place } = hand, query = new URLSearchParams(location.search);
  // (a render's page: a clock that stands till it is moved — no display frames, no pause, no sign)
  const virtual = hand.clock != null && !hand.real;
  const stand = !query.has('stand') ? null : query.get('stand') === 'detail' ? 'detail' : 'rows';
  const report = text => (window.__mooodErrors ||= []).push(text);
  // the browser's own timers and display frames (PG2)
  const own = window.__mooodTimers ?? window;

  // the stage is engine 3's now (begin … end), with the canvas (and, over it, ?debug's) the stage made for this use —
  // made anew here after the device was lost; its thread — none while the device is lost and nobody watches, and once
  // no scene can be shown (failed: what is said in the place, for good — PG7 a, b; 2.8 step 4)
  let live = false, canvas = null, overlay = null, worker = null, failed = null;
  // the scene shown stopped by its own fault (PG7 c): what is said in its place, till the next is shown
  let fault = null;
  // this thread: whether it has said `mounted`, whether it has told a frame yet, whether it was started in place of
  // one whose device was lost
  let mounted = false, framed = false, anew = false;
  // the thread whose device was lost, till the scene is watched again and a thread anew is told it: what it saved of
  // its scene (saved), the film that scene had loaded (film: { at, playing } — null: none), the `show` it had not
  // answered (show: its arguments — null: none)
  let lost = null;
  // the scene shown last (the arguments of the `show` of the stage's the thread answered "shown"), and the `show`
  // asked last of this thread and not answered yet ({ id, args }): the scene the viewer is at — shown again after the
  // device was lost
  let shown = null, opening = null;
  // what was asked while there was no thread, in the order asked ([id, fn, args]); what the thread has not answered
  // yet (id → [fn, args]); this side's own calls (their ids negative — the stage's count up from 1); the `show`s not
  // answered yet (their ids: a scene is opening — PG8)
  const kept = [], flying = new Map(), asking = new Map(), shows = new Set();
  let asked = 0;

  // (a call of the stage's is answered)
  const settle = id => {
    flying.delete(id);
    if (opening?.id === id) opening = null;
    if (shows.delete(id)) held();
  };
  const refuse = (id, error) => { settle(id); hand.heard({ data: { t: 'reply', id, error } }); };

  // ── what is asked of the thread (PG4) ──
  function call(id, fn, args) {
    // (a scene asked for after: refused — and the page around told again, as it asks of each scene)
    if (failed) { refuse(id, failed); if (fn === 'show') { text = null; held(); } return; }
    // (a scene shown: it is opening — and the words over the one before it, stopped by its fault, go)
    if (fn === 'show') { shows.add(id); fault = null; held(); }
    if (!worker) { kept.push([id, fn, args]); return; }
    flying.set(id, [fn, args]);
    if (fn === 'show') opening = { id, args };
    try { worker.postMessage({ t: 'call', id, fn, args }); } catch (err) { refuse(id, String(err?.message || err)); }
  }
  // this side's own: → a promise of the reply
  const ask = (fn, ...args) => new Promise((ok, fail) => {
    const id = -(++asked);
    asking.set(id, [ok, fail]);
    if (fn === 'show') { shows.add(id); opening = { id, args }; fault = null; held(); }
    worker.postMessage({ t: 'call', id, fn, args });
  });
  const tell = (fn, ...args) => { ask(fn, ...args).catch(err => report(`${fn}: ${err.message}`)); };

  // ── the points (PG9, IN1, IN4): each asked once of a thread — its slot in the `points` its frames tell ──
  const tracked = new Map();  // 'ref|lift|over' → { ref, lift, over, slot }
  let points = null;
  function track(t) {
    ask('track', t.ref, t.lift, t.over).then(slot => { if (Number.isInteger(slot)) t.slot = slot; }, err => report(`track: ${err.message}`));
  }
  // where a point is in the place: [x, y, depth] (CSS px, metres) — null: not told yet, not there now, out of sight
  function screenOf(ref, lift, over) {
    if (!live) return null;
    const k = `${ref}|${lift}|${over}`;
    let t = tracked.get(k);
    if (!t) { tracked.set(k, t = { ref, lift, over, slot: -1 }); if (worker) track(t); }
    const o = t.slot * 3;
    if (t.slot < 0 || !points || o + 2 >= points.length || Number.isNaN(points[o])) return null;
    return [points[o], points[o + 1], points[o + 2]];
  }

  // ── the viewer's moves (PG3): one message a display frame, in order — a pointer's move in place of its move before,
  // a lean in place of the lean before ──
  let evs = [], posting = false;
  function input(ev) {
    if (!worker) return;
    const before = evs[evs.length - 1];
    if (before && before.type === ev.type && (ev.type === 'lean' || (ev.type === 'pointermove' && before.pointerId === ev.pointerId))) evs[evs.length - 1] = ev;
    else evs.push(ev);
    if (!posting) { posting = true; own.requestAnimationFrame(posted); }
  }
  function posted() {
    posting = false;
    const list = evs;
    evs = [];
    if (worker && list.length) worker.postMessage({ t: 'in', evs: list });
  }

  // ── the place's size (PG1, PG2): told once it has stood ──
  const size = () => {
    const w = Math.max(1, place.clientWidth), h = Math.max(1, place.clientHeight), dpr = window.devicePixelRatio || 1;
    return { w, h, dpr, pw: Math.round(w * dpr), ph: Math.round(h * dpr) };
  };
  let sized = null, settling = 0, ratio = null;
  function resized() {
    if (text != null) put();
    if (!worker) return;
    own.clearTimeout(settling);
    settling = own.setTimeout(() => {
      const s = size();
      if (!worker || (s.w === sized.w && s.h === sized.h && s.dpr === sized.dpr)) return;
      sized = s;
      worker.postMessage({ t: 'size', ...s });
    }, SETTLED);
  }
  // (the screen's px a CSS px: another screen, a zoom that leaves the place its size)
  function ratioChanged() {
    ratio?.removeEventListener('change', ratioChanged);
    ratio = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    ratio.addEventListener('change', ratioChanged);
    resized();
  }

  // ── paused (2.6, PG10): the play's own pause, the page hidden, the place out of sight, a layer of the site over it —
  // the thread stopped, and those who wait with the scene (the voices, the music) told; hushed (2.4): the sign shown
  // over a picture held while a scene plays — those told alone, the thread works on ──
  const stands = { hidden: document.hidden, away: false };
  // (waiting: the sign stands over a story that waits on a cut — the voices alone wait with it, 2.4)
  let paused = false, hushed = false, stood = false, waiting = false;
  function standsNow() {
    if (paused || hushed) { if (!stood) { stood = true; hand.stands(true); } } else if (stood) { stood = false; hand.stands(false); }
  }
  function storyWaits(on) {
    if (on === waiting) return;
    waiting = on;
    hand.story(on);
  }
  function watch() {
    if (!live || virtual) return;
    const now = !!(hand.told.paused || stands.hidden || stands.away || hand.covered);
    if (now !== paused) {
      paused = now;
      if (worker) tell('pause', paused);
      standsNow();
    }
    // (the device was lost while nobody watched: the scene comes back as it is watched again)
    if (lost && !paused) again();
  }
  // no longer this side's to stop (the stage went to another engine): what stood by more than the play's own pause
  // goes on — the play's pause is the play's, and over a scene of another engine it tells its voices and music itself
  function release() {
    storyWaits(false);
    paused = hushed = false;
    if (!stood) return;
    stood = false;
    if (!hand.told.paused) hand.stands(false);
  }
  const seen = () => { stands.hidden = document.hidden; watch(); };
  const sizes = new ResizeObserver(resized);
  const sights = new IntersectionObserver(entries => { stands.away = !entries[entries.length - 1].isIntersecting; watch(); });

  // ── the sign over the scene's place: waiting while a picture stands (2.2, 2.4, 2.9 — the opening, a seek, a cut held
  // for its finer pages, the device lost), with the share done where it can be counted; over a
  // living picture while a scene is made beside it (2.9: its share counted) and while the scene's story waits on a shot
  // being made ready (2.3 step 5, 2.4: `waits.shot` — the picture goes on under the sign alone: what a shot ahead lacks
  // is not counted); or that the scene cannot be shown. One sign, one look; it stands still. Shown once a wait has
  // lasted WAIT.SHOWN, it never flickers: it stands at least WAIT.LEAST — a wait that ends before plays on under the
  // sign alone, and one that comes again meanwhile keeps it. Shown over a picture that stands while a scene plays, the
  // voices and the music wait with it (hushed) till a frame is drawn; with a story that stands (`waits.story`: a cut
  // waits) the voices alone, at once. A page in a frame (the viewer's) tells the page around it ──
  const sign = document.createElement('div');
  sign.style.cssText = 'position:fixed;z-index:8;transform:translate(-50%,-50%);font:13px/1.4 system-ui,sans-serif;color:#e8e2d6;background:rgba(10,12,18,.72);padding:6px 12px;border-radius:999px;pointer-events:none;display:none;white-space:nowrap';
  // what the thread waits for now (PG8); the wait: whether it is on, whether the sign is shown, whether its least time
  // is still running, the timers of its delay and of its least time; and since this wait began what the share done is
  // counted against — the most pages waited for at once; the pipelines settled when it began (as they were first told
  // in it: the thread counts them since it began — null: none told) and those asked by now
  let waits = null, text = null;
  const counts = () => ({ pages: 0, settled: null, asked: 0 });
  const hold = { on: false, shown: false, least: false, delay: 0, leastTimer: 0, ...counts() };
  const unheld = () => {
    own.clearTimeout(hold.delay); own.clearTimeout(hold.leastTimer);
    Object.assign(hold, { on: false, shown: false, least: false }, counts());
  };
  // (the delay passed: the sign shown, and its least time begun)
  function showSign() {
    hold.shown = hold.least = true;
    hold.leastTimer = own.setTimeout(() => { hold.least = false; held(); }, WAIT.LEAST * 1000);
    held();
  }
  function put() {
    const r = place.getBoundingClientRect();
    sign.style.left = `${r.left + r.width / 2}px`;
    sign.style.top = `${r.top + r.height / 2}px`;
  }
  // (cannot — the scene will not come: 'device', no scene here for good; 'scene', this one, till another is shown)
  function say(next, cannot = null) {
    if (next === text) return;
    text = next;
    if (window.parent !== window) window.parent.postMessage({ moood: 'waits', text, cannot }, location.origin);
    if (text == null) { sign.remove(); sign.style.display = 'none'; return; }
    sign.textContent = text;
    if (!sign.isConnected) document.body.append(sign);
    put();
    sign.style.display = 'block';
  }
  function held() {
    if (failed || fault) { unheld(); hush(false); storyWaits(false); say(failed || fault, failed ? 'device' : 'scene'); return; }
    // (a wait: a scene is opening — its `show` not answered yet —, the thread waits — for the picture, or its story
    // for a shot —, the device is lost)
    const on = live && !virtual && (shows.size > 0 || waits != null || lost != null);
    // (the picture standing while a scene plays — a frame not drawn, the device lost —,
    // not a scene's first opening, not one living beside a scene being made, not the story's wait on a shot)
    const picture = on && shown != null && !!(waits?.held || lost != null);
    if (!on) {
      // (over: the sign stands on till its least time has passed, alone; a wait that comes meanwhile keeps it)
      hold.on = false;
      Object.assign(hold, counts());
      hush(false);
      storyWaits(false);
      if (live && hold.shown && hold.least) say(SAID.waiting);
      else { unheld(); say(null); }
      return;
    }
    if (!hold.on) {
      hold.on = true;
      if (!hold.shown) { own.clearTimeout(hold.delay); hold.delay = own.setTimeout(showSign, WAIT.SHOWN * 1000); }
    }
    const pages = waits?.pages || 0, pipelines = waits?.pipelines;
    hold.pages = Math.max(hold.pages, pages);
    if (pipelines) { hold.settled ??= pipelines[0]; hold.asked = pipelines[1]; }
    hush(hold.shown && picture);
    // (a story that stands: its voices wait with it at once — not after the sign's delay: 2.4)
    storyWaits(!picture && !!waits?.story);
    if (!hold.shown) return;
    // (the story's wait on a shot alone — the picture goes on —, or nothing countable waited for in this moment —
    // paint code running: the sign alone)
    const frames = shows.size > 0 || lost != null || !!(waits && (waits.held || waits.building || waits.apart));
    if (!frames || (!pages && !pipelines)) { say(SAID.waiting); return; }
    // the share done, of what was asked since the hold began (pipelines not named now: all of them made)
    const asked = hold.settled == null ? 0 : hold.asked - hold.settled, made = pipelines ? pipelines[0] - hold.settled : asked;
    say(`${SAID.waiting} · ${Math.round((hold.pages - pages + made) / (hold.pages + asked) * 100)} %`);
  }
  // the voices and the music wait with a picture held under the sign — and go on with the first frame drawn after
  function hush(on) {
    if (on === hushed) return;
    hushed = on;
    standsNow();
  }

  // ── the thread ──
  function stop() {
    own.clearTimeout(settling);
    if (!worker) return;
    worker.onmessage = worker.onerror = null;
    worker.terminate();
    worker = null;
  }
  // no scene can be shown here — for good: said in the place; the thread ended; what was asked, and whatever is
  // asked after, refused with the words
  function fail(said) {
    failed = said;
    stop();
    lost = fault = waits = opening = null;
    for (const id of [...flying.keys()]) refuse(id, said);
    for (const [id] of kept.splice(0)) refuse(id, said);
    asking.clear();
    shows.clear();
    held();
  }
  // the `show` of the scene the viewer was at as the device was lost (2.8 step 3) — null: none. The `show` that was in
  // flight, as it was asked; else the scene shown: with its film loaded, as it was opened, the film begun and sought
  // to where it was (a film is code: nothing saved holds it); else from what the thread saved — with nothing saved,
  // as it was opened
  function back() {
    if (lost.show) return lost.show;
    if (!shown) return null;
    const [spec, modules, how] = shown, opened = how || {};
    if (lost.film) return [spec, modules, { ...opened, showcase: lost.film }];
    return [spec, modules, lost.saved == null ? opened : { restore: lost.saved, ...(opened.save && { save: true }) }];
  }
  // a thread started and given the place's canvas (PG1); then what the thread before was told (`was`), the scene the
  // viewer was at when the device was lost, every point followed, and what was asked meanwhile
  function start(was) {
    const given = canvas.transferControlToOffscreen(), over = overlay?.transferControlToOffscreen() ?? null;
    worker = new Worker(hand.thread, { type: 'module' });
    // (an error of the thread before it has said `mounted`: it did not start — a module of it failed to load —, and no
    // scene can be shown: PG7 a)
    worker.onerror = err => {
      report(`the scene's thread: ${err.message || err}`);
      if (!mounted) fail(SAID.failed);
    };
    worker.onmessage = heard;
    mounted = framed = false;
    sized = size();
    worker.postMessage({
      t: 'mount', canvas: given, overlay: over, ...sized, budget: device.budget, tier: device.tier, phone: device.phone,
      cores: navigator.hardwareConcurrency || 4, flags: { debug: hand.debug, stand },
      clock: hand.clock, real: hand.real, speech: typeof MooodSpeech !== 'undefined',
    }, over ? [given, over] : [given]);
    waits = null;
    Object.assign(hold, counts());
    held();
    if (paused) tell('pause', true);
    if (was.view) tell('setView', ...was.view);
    // (the stage's veil, as it stands: 2.10)
    if (was.veil) tell('fade', was.veil, 0);
    for (const k of was.listen) tell('listen', k);
    // the device was lost: the scene the viewer was at — unless the page asked for another meanwhile: then that one,
    // as it asked. That it cannot be shown is said in the place (PG7 c)
    const scene = lost && !kept.some(k => k[1] === 'show') ? back() : null;
    if (scene) ask('show', ...scene).catch(err => { report(`show: ${err.message}`); fault = SAID.failed; held(); });
    if (was.pickSpec !== undefined) tell('pickSpec', was.pickSpec);
    if (was.select !== undefined) tell('select', was.select);
    if (was.offer !== undefined) tell('offer', was.offer);
    for (const t of tracked.values()) track(t);
    for (const [id, fn, args] of kept.splice(0)) call(id, fn, args);
  }
  // the device was lost (2.8, PG14): the thread ended; what it was asked is refused, the loss its reason (the callers
  // did not get what they asked: in the page's words — what the browser said of it, to the console); the actions the
  // stage holds ended; a thread anew — a new canvas in the place: a canvas is given to a thread once — when the scene
  // is watched
  function gone(m) {
    const detail = `the graphics device was lost${m.reason ? `: ${m.reason}` : ''}`, twice = anew && !framed;
    console.warn(`engine 3: ${detail}`);
    const film = hand.last.showcase;
    stop();
    // (lost, before the calls are refused: the wait sign stands on)
    lost = { saved: m.saved, film: film && { at: film.at, playing: film.playing }, show: opening?.args ?? null };
    for (const id of [...flying.keys()]) refuse(id, SAID.lost);
    asking.clear();
    shows.clear();
    opening = null;
    hand.cancel();
    for (const t of tracked.values()) t.slot = -1;
    points = null;
    evs = [];
    // (a render's page: its picture would be of a scene begun anew — an error; a second loss before the thread anew
    // told a frame: final)
    if (virtual || twice) report(twice ? `${detail} — again, before a frame of the thread begun anew` : detail);
    if (twice) { fail(SAID.failed); return; }
    waits = null;
    Object.assign(hold, counts());
    held();
    // (watched now: at once; else as it is watched again — watch())
    if (!paused) again();
  }
  function again() {
    const fresh = c => { const d = c.cloneNode(false); c.replaceWith(d); return d; };
    canvas = fresh(canvas);
    if (overlay) { overlay = fresh(overlay); hand.placeOver(overlay); }
    hand.remade(canvas, overlay);
    anew = true;
    start(hand.told);
    lost = null;
    held();
  }

  // ── what the thread says ──
  // the state (PG5, PG6): 'change' events in order, then what moved (each key once), then what the game keeps
  function stated(pairs, type) {
    const values = hand.values;
    for (let i = 0; i < pairs.length; i += 2) {
      const key = pairs[i], value = pairs[i + 1], old = values[key];
      if (value === null) delete values[key]; else values[key] = value;
      for (const l of hand.listeners[type]) if (l.key == null || l.key === key) {
        try { l.fn(value, old, key); } catch (err) { report(`widget: ${err?.message || err}`); }
      }
    }
  }
  function state(m) {
    if (m.changes) stated(m.changes, 'change');
    if (m.moves) stated(m.moves, 'move');
    if (m.save) hand.tells.save?.(m.save);
  }
  // the layers placed (stage.onFrame), and the sign with them: in the page's next display frame, once for all that
  // came before it — the frames told, the page scrolled
  let placing = false;
  function layers() {
    placing = false;
    if (overlay) hand.placeOver(overlay);
    if (text != null) put();
    for (const fn of hand.framed) fn();
  }
  const soon = () => { if (!placing) { placing = true; own.requestAnimationFrame(layers); } };
  // a frame's info (PG5): each field as it changed — kept at once (what the stage answers: frame(), camera(), hero(),
  // selected(), showcase.info, screenOf)
  let beats = null;
  function frame(m) {
    framed = true;
    state(m);
    const last = hand.last;
    for (const k of ['frame', 'camera', 'hero', 'fixed', 'selected']) if (m[k] !== undefined) last[k] = m[k];
    if (m.beats !== undefined) beats = m.beats;
    if (m.showcase !== undefined) last.showcase = m.showcase && { ...m.showcase, beats };
    else if (m.beats !== undefined && last.showcase) last.showcase = { ...last.showcase, beats };
    if (m.points) points = m.points;
    if (virtual) layers(); else soon();
  }
  // a `show` answered shown: not an error, not replaced by a newer one (PG4)
  const showed = m => !('error' in m) && !m.value?.replaced;
  function heard(e) {
    const m = e.data;
    if (m.t === 'frame') { hand.said(m); frame(m); }
    else if (m.t === 'state') { hand.said(m); state(m); }
    else if (m.t === 'waits') { hand.said(m); waits = m.waits; held(); }
    else if (m.t === 'lost') { hand.said(m); gone(m); return; }
    // (the engine itself failed after the mount — PG7 b: the thread says nothing more)
    else if (m.t === 'failed') { hand.said(m); fail(SAID.failed); return; }
    else if (m.t === 'reply' && m.id < 0) {
      hand.said(m);
      const w = asking.get(m.id);
      asking.delete(m.id);
      if (opening?.id === m.id) opening = null;
      // (a scene shown: the words over the one before it, stopped by its fault, go — PG7 c)
      if (shows.delete(m.id)) { if (showed(m)) fault = null; held(); }
      if (w) { if ('error' in m) w[1](new Error(m.error)); else w[0](m.value); }
    } else {
      // (replies to the stage's calls, `mounted`, the director's actions and events, lines said, the P panel: heard
      // as the stage hears them of engine 1's thread; a `show` answered "shown" is the scene shown now — the words over
      // the one before it, stopped by its fault, go: PG7 c —, and its answer — an error too — ends the opening's hold:
      // PG8)
      if (m.t === 'mounted') mounted = true;
      else if (m.t === 'reply') {
        const f = flying.get(m.id);
        if (f?.[0] === 'show' && showed(m)) { shown = f[1]; fault = null; }
        settle(m.id);
      }
      hand.heard(e);
    }
    // an error the page shows in the scene's place (PG7): with `mounted` — the device cannot, for good; on any other
    // message — the fault of the scene shown: the words stand till a `show` is asked or answered shown, the thread lives
    if (m.errors?.some(text => String(text).startsWith('renderer: '))) {
      if (m.t === 'mounted') fail(SAID.device); else { fault = SAID.failed; held(); }
    }
  }

  // ── the stage goes to engine 3 (begin), and away from it or unmounted (end) ──
  // (was: what the thread before was told; made, over: the canvas the stage made for this use, and ?debug's over it)
  function begin(was, made, over) {
    live = true;
    canvas = made; overlay = over;
    // (the mark the page's styles over an engine-3 scene are keyed on — scene.css: on the place)
    place.dataset.mooodEngine = '3';
    if (!virtual) {
      sizes.observe(place);
      sights.observe(place);
      document.addEventListener('visibilitychange', seen);
      // (the page scrolled: the layers' places are the viewport's, and a scene at rest says no frame)
      document.addEventListener('scroll', soon, { capture: true, passive: true });
      ratioChanged();
    }
    stands.hidden = document.hidden;
    watch();
    if (!device) { report(`renderer: ${why}`); fail(SAID.device); return; }
    start(was);
  }
  function end() {
    live = false;
    stop();
    sizes.disconnect();
    sights.disconnect();
    document.removeEventListener('visibilitychange', seen);
    document.removeEventListener('scroll', soon, { capture: true });
    ratio?.removeEventListener('change', ratioChanged);
    ratio = null;
    kept.length = 0; flying.clear(); asking.clear(); shows.clear(); tracked.clear();
    points = null; evs = []; shown = null; opening = null; lost = null; failed = null; fault = null; waits = null; beats = null;
    canvas = overlay = null;
    mounted = anew = framed = false;
    stands.away = false;
    delete place.dataset.mooodEngine;
    held();
    release();
    // (the layers look once more: nothing of this scene is there for them now)
    layers();
  }

  return { begin, end, call, input, watch, screenOf };
}
