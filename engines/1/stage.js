// The stage on a page: the scene drawn in a thread of its own (a worker; a canvas given over to it), so the page never
// waits for the scene. Here: what the page asks of it, and what it keeps of what the thread says.
//   Two engines: a spec with "engine": 3 runs on engine 3 (below), one with no "engine" (or 1) on this one (thread.js);
// a spec that names another engine is refused (show and start throw). A canvas can be given to a worker once, so the
// stage owns its canvas: the page gives it a place (an element, #scene) and the stage puts its canvas in it — a fresh
// one, and the other engine's thread, whenever a spec (shown, or the state started on it) wants the other engine — the
// first as the first scene wants it; nothing of one engine stays in the other. The old engine's thread begins as the
// stage is mounted (its code loaded and compiled while the page fetches its scene): given the canvas if the first scene
// wants it, else let go. The page's input is taken on the place, not on the canvas.
//   Moood.mount(place, { check, keys }) → the stage (keys: whether the page's keys are this stage's now — two scenes on
// one page: the one last pointed at): show(spec, modules), resetCamera(), setView(left, right), about(text) — what
// the page knows the scene to be (its world, its id, its version: what the P panel's copy says with its numbers) — told;
// ready(), seen(), draw(how), still(values), inspect(), ground(across, distance) — asked (promises); frame(), camera(),
// hero() — as the last frame had them; screenOf(ref, lift, over) — where a point is in the canvas (CSS px: [x, y,
// depth]; null out of sight): the old engine's followed from the first time it is asked (null till its thread has
// said); canvas — the canvas now; showcase — a scene's own scenario outside games (engine 3: start(), play(), pause(),
// seek(seconds), info — its time, its length); onInput(fn) — each of the viewer's
// moves on it as it goes to the scene ({type, …}: pointerdown, pointermove, wheel, lean, keydown …), input(ev) — one
// given to it as if made on it (two scenes moved as one: the comparing page); steady(on) — the view leans no more
// (a mini-game: nothing moves under the finger), it stays as it leaned. The page's input goes on to it:
// the pointer and the wheel on the place, the keys (not while one types), where the mouse is or how the phone is held
// (the view leans), the place's size.
//   MooodState: the scene's state (it runs in the thread) — start, set, cut, turn, path, check told; get, all, states
// as the thread last said; on('change' | 'move', [key,] fn) heard from it; unknown() asked. Engine 3's director: act(actor,
// verb, ...args) → an action (awaitable; ending(s), cancel(), pause(), resume(), finish() — at once, as it would end,
// on(ev, fn)); signal(name, data); save() → what restore(data) takes; on('arrived' | 'line' | 'cut' | 'signal' | 'tell',
// [who,] fn); instant(on) — a game jumping to a moment: on, every action finishes at once and nothing is drawn; off,
// the scene as it is then shown once, whole (a promise: done).
//   What goes wrong in the thread lands where it did: window.__mooodErrors, __mooodWarnings.
//   ?stand (the measuring stand, stand.html): the page keeps when each frame was said to it
// (window.__mooodStandFrames: ms, the epoch's — either engine).
// A render's virtual clock (window.__mooodTime, clock.js): the thread's goes by it too.
//   Engine 3 (a spec with "engine": 3 — ../3, WebGPU): a branch here that hands over to its own
// side of the stage, ../3/page.js — a module, fetched (and the device's tier found) as the first engine-3 scene
// wants it: a page of older scenes loads nothing of it. The stage makes the canvas and keeps what pages and layers read
// (the frame, the camera, the state, the listeners); page.js starts the thread, gathers the input and the place's size
// for it, hears everything it says, knows where its points are (screenOf), stops it while nobody watches and shows
// its own sign of waiting. What is asked of the stage meanwhile is handed over in the order asked — and does nothing
// once the stage has left that use of engine 3; a page.js that cannot be fetched: what is asked is refused, and said
// in the place. For such a scene also: cover(on) — a layer of the page lies over the whole scene: it
// stands meanwhile; onPause(fn) — fn(paused) as it stops and goes on (the play paused, the page hidden, the place out
// of sight, covered) — Moood.onPause(fn): the same of every stage of the page, mounted or yet to be (the music);
// MooodState.prepare(values) → the id of a shot made ready ahead, MooodState.unprepare(id).
//   onFrame(fn) → a function that takes fn off again.
//   fade(level, seconds) → a promise, done when it is there: the stage's veil (engine 3's plan 2.10) — a black over
// the scene, 0 clear … 1 black, never the scene's own (no state of it, in none of its pictures): over an engine-3 scene
// its thread lays it last in its frame (`fade`); over a scene of engine 1, a black layer of the stage's in the
// place, over its canvas and under the page's other layers (its opacity animated: it stands with the play's pause).
// Its level is kept, and carried at once to the canvas of another engine. show(spec, modules, { fade, then }) — an
// engine-3 scene's switch through black (seconds) and a jump (where a game has got to in it), given with the show;
// onStory(fn) — fn(waiting) as an engine-3 scene's story waits for a cut that is not ready and goes on (the voices
// wait with it; the music does not).
//   What people saw — told to globalThis.MooodSeen, if the page that hosts the stage has one (docs/host.md): each scene
// shown — its engine, how soon it was built and drawn, its frames as its thread counts them (frames.js: { t: 'frames' }),
// where the camera went, how long it was watched.
const Moood = (() => {
  const tr = MooodI18n.part('engine1');  // (the engine's words, as the page said its language: words.js speak)
  const THREADS = { 1: new URL('thread.js', document.currentScript.src), 3: new URL('../3/thread.js', document.currentScript.src) };
  // (engine 3's side of the stage: a module)
  const PAGE3 = new URL('../3/page.js', document.currentScript.src);
  const engineOf = spec => {
    const e = spec && typeof spec === 'object' ? spec.engine ?? 1 : 1;
    if (e !== 1 && e !== 3) throw new Error(`the scene's engine (${JSON.stringify(e)}) is not one of these: 1, 3`);
    return e;
  };
  const said = m => {
    if (m.errors) (window.__mooodErrors ||= []).push(...m.errors);
    if (m.warnings) (window.__mooodWarnings ||= []).push(...m.warnings);
  };
  // who is told as an engine-3 scene of any stage of the page stops and goes on (Moood.onPause), and the page's stages
  const everywhere = [], stages = [];

  function mount(place, { check = false, keys: ours = () => true } = {}) {
    const q = new URLSearchParams(location.search);
    let worker = null, engine = 0, canvas = null, overlay = null, n = 0, keys = [], last = { frame: null, camera: null, hero: null, fixed: true, points: {} };
    const waiting = new Map();
    // (what the scene is: its title as its spec has it, and what the page says of it — the P panel's copy says both)
    const shown = { title: '', about: '' };
    const perf = panel(() => [shown.title, shown.about].filter(Boolean).join(' · '));
    // what people saw of it (MooodSeen, docs/host.md): each scene shown, how soon, its frames, where the camera went
    const seen = globalThis.MooodSeen?.watch(() => last.camera);
    // (hidden: what the thread counted of its frames so far asked first — its answer comes after them —, then the scene
    // said left as far as anyone saw it)
    if (seen) addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'hidden') return;
      if (engine) call('frames').then(seen.hidden, seen.hidden); else seen.hidden();
    });
    const listeners = { change: [], move: [] }, tells = { tell: null, save: null }, framed = [];
    // what the thread was told that the next one must know too (an engine changed); veil: the stage's fade, its level
    const told = { paused: false, view: null, listen: new Set(), selecting: null, pickSpec: undefined, select: undefined, offer: undefined, veil: 0 };
    // the stage's veil over a scene of engine 1: a black layer in the place, over the canvas; its fade going on
    const veil = document.createElement('div');
    veil.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;pointer-events:none';
    place.append(veil);
    let veiling = null;
    // (its opacity to `level` over `seconds` — from where it stands now, a fade going on taken over)
    function veiled(level, seconds) {
      const from = Number(getComputedStyle(veil).opacity) || 0;
      veiling?.cancel();
      veiling = null;
      veil.style.opacity = String(level);
      if (!(seconds > 0) || from === level) return Promise.resolve(null);
      const a = veiling = veil.animate([{ opacity: from }, { opacity: level }], { duration: seconds * 1000, easing: 'ease-in-out' });
      // (the play paused: it waits with it)
      if (told.paused) a.pause();
      return a.finished.then(() => null, () => null);
    }
    // (what is asked in the moment a scene is shown and started goes after them, in the order asked: a camera reset, the
    // spec to pick in — of the scene being shown, not of the one before it)
    const post = (id, fn, args) => {
      // (engine 3: its side of the stage posts it — kept there while its thread is not up)
      if (engine === 3) { to3(p => p.call(id, fn, args)); return; }
      if (!worker) use(1); worker.postMessage({ t: 'call', id, fn, args });
    };
    const call = (fn, ...args) => new Promise((ok, fail) => {
      const id = ++n;
      waiting.set(id, [ok, fail]);
      if (together) together.after.push([id, fn, args]); else post(id, fn, args);
    });
    // (the thread given the canvas as it is first needed: the engine the first scene shown or started wants)
    // A scene shown and its state started in the same moment (pages do both, in either order): engine 3 takes them as
    // one call (below). Each is told at the end of the moment; to the old engine one after the other, as asked.
    let together = null;
    // (engine 3: what the page holds of each scene being shown — by its show's number, taken as the thread switches to
    // that very one: a show asked while an earlier one is switching never gives the earlier one its own; let go as
    // the show is answered — replaced, failed or shown)
    const switching = new Map();
    let showN = 0;
    function atOnce(kind, args) {
      if (!together) {
        const t = together = { order: [], show: null, start: null, done: null, after: [], each: null };
        t.promise = new Promise(ok => { t.done = ok; });
        queueMicrotask(() => {
          together = null;
          // (engine 3: a scene shown takes what it opens with in the one call — the state started with it, its film
          // asked with it, whether the game keeps what it saves)
          if (engine === 3 && t.show) {
            const o = t.start?.[2], s = t.showOpts;
            // (what the page holds of the scene — its state, who hears what it tells — is the new one's once the thread
            // has switched to it: `switched`; a show that fails or is replaced leaves it the one shown)
            const n = ++showN;
            if (t.taken) switching.set(n, t.taken);
            const shown = call('show', ...t.show, { show: n, ...(t.start && { values: t.start[1] }), ...(t.showcase && { showcase: true }), ...(o?.save && { save: true }),
              ...(s?.fade > 0 && { fade: s.fade }), ...(s?.then?.length && { then: s.then }), ...(s?.tag != null && { tag: s.tag }) });
            const gone = () => { switching.delete(n); };
            shown.then(gone, gone);
            t.done(shown);
          }
          // (engine 3, no scene shown in the moment: each thing asked answers as its own call does — a film started,
          // PG12; the state started, held by the page at once)
          else if (engine === 3) { t.taken?.(); t.each = {}; for (const k of new Set(t.order)) t.each[k] = call(k, ...t[k]); t.done(); }
          else t.done(Promise.all(t.order.map(k => call(k, ...t[k]))));
          for (const [id, fn, args] of t.after) post(id, fn, args);
        });
      }
      together[kind] = args;
      together.order.push(kind);
      const t = together;
      return engine === 3 ? t.promise.then(all => (t.each ? t.each[kind] : all)) : t.promise;
    }
    // the viewer's moves made on it: to the scene, and to whoever listens (onInput)
    const moves = [];
    // (engine 3: its side of the stage gathers them — one message a display frame; given straight to it once it has
    // begun this use, in their order behind what was handed before)
    const input3 = ev => { if (use3.begun) third.input(ev); else to3(p => p.input(ev)); };
    const send = ev => {
      if (engine === 3) input3(ev); else worker?.postMessage({ t: 'in', ev });
      for (const fn of moves) fn(ev);
    };
    const debug = q.has('debug') ? q.get('debug') : null;
    const size = () => ({ w: Math.max(1, place.clientWidth), h: Math.max(1, place.clientHeight), dpr: window.devicePixelRatio || 1 });
    // a render's virtual clock: the thread's goes by one of its own, moved on with the page's. A play's (real, going by
    // itself, pausable: clock.js): the thread's time paused with the page's — each thread, as it begins, told if it is
    const clock = window.__mooodTime ? Date.now() - performance.now() : null, real = !!window.__mooodTime?.real;
    if (real) {
      const pause = window.__mooodTime.pause;
      // (engine 3: one of the reasons its scene stands — its side of the stage works the pause out; the stage's veil over
      // another engine's scene stands with the play)
      window.__mooodTime.pause = on => { pause(on); told.paused = !!on; if (worker) call('pause', !!on); if (engine === 3) to3(p => p.watch()); if (veiling) { if (on) veiling.pause(); else veiling.play(); } };
    } else if (clock != null) {
      const run = window.__mooodTime.run;
      window.__mooodTime.run = async ms => { await run(ms); if (worker) await call('run', ms); };
    }

    // ── the engine: its thread, its canvas ──
    // (a thread begun: its code loading; what it says before it is used is not the scene's — a thread let go unused)
    const begin = () => {
      const w = new Worker(THREADS[1]);
      w.onerror = err => (window.__mooodErrors ||= []).push(`the scene's thread: ${err.message || err}`);
      return w;
    };
    let early = begin();
    // ── engine 3's side of the stage (../3/page.js) ──
    // whether a layer of the page lies over the whole scene (cover), and who is told as an engine-3 scene stops and goes on
    let covered = false;
    const pausings = [], storyings = [];
    // its side, once it is there (what is read of it at once: where its points are), and on its way: fetched, and the
    // device's tier found, as the first engine-3 scene wants it. What is handed to it goes in the order handed
    let third = null, coming = null;
    // this use of engine 3 (from use(3) till the stage leaves it): whether its side has begun it. What was handed for
    // a use that has ended does nothing — a use left before its side came never began there, and is not ended there
    let use3 = null;
    // (its side cannot be had — the module not fetched, not run: what is said in the place meanwhile)
    let lacking = null;
    const to3 = fn => {
      const u = use3;
      coming ||= import(PAGE3).then(m => m.stageSide(hand)).then(p => { third = p; },
        err => { (window.__mooodErrors ||= []).push(`the scene's engine: ${err?.message || err}`); });
      coming.then(() => {
        if (u !== use3) return;
        if (!third) { lacks(tr('the scene could not be shown')); return; }
        try { fn(third); } catch (err) { (window.__mooodErrors ||= []).push(`the scene's engine: ${err?.message || err}`); }
      });
    };
    // the engine cannot show the scene here (engine 3's side is not there; engine 1's thread found no WebGL2): what waits
    // for an answer — and whatever is asked after — is refused, and `text` is said over the scene's place — where the
    // sign of waiting stands (on the body, over the place's middle: seen while a play fades the place out), put there
    // again as the place's size changes
    function lacks(text) {
      for (const [, fail] of waiting.values()) fail(new Error(text));
      waiting.clear();
      if (window.parent !== window) window.parent.postMessage({ moood: 'waits', text, cannot: 'device' }, location.origin);
      if (lacking) return;
      lacking = document.createElement('div');
      lacking.textContent = text;
      lacking.style.cssText = 'position:fixed;z-index:8;transform:translate(-50%,-50%);font:13px/1.4 system-ui,sans-serif;color:#e8e2d6;background:rgba(10,12,18,.72);padding:6px 12px;border-radius:999px;pointer-events:none;white-space:nowrap';
      document.body.append(lacking);
      putLacking();
    }
    function putLacking() {
      const r = place.getBoundingClientRect();
      lacking.style.left = `${r.left + r.width / 2}px`; lacking.style.top = `${r.top + r.height / 2}px`;
    }
    // the stage leaves engine 3: its side ends the use it began (its thread, what it watched)
    function leave3() {
      const u = use3;
      use3 = null;
      if (u.begun) third.end();
    }
    // what it is given of this stage: the place, what the stage keeps (filled by it as its thread speaks), what the
    // thread before was told, how the stage hears a thread (replies, actions, events, lines, the P panel); stands:
    // those who wait with the scene told; cancel: the actions the page holds ended (its thread is gone: the device
    // lost); remade: the canvas — and ?debug's over it — its side made anew in their places
    const hand = {
      place, debug, clock, real, thread: THREADS[3], told, listeners, tells, framed,
      heard, said, placeOver,
      stands(on) { for (const fn of pausings) fn(on); for (const fn of everywhere) fn(on); },
      story(on) { for (const fn of storyings) fn(on); },
      cancel() { for (const a of acts.values()) a.end('cancelled'); },
      remade(c, o) { canvas = c; overlay = o; },
      get covered() { return covered; },
      get last() { return last; },
      get values() { return values; },
    };
    function use(next) {
      if (next === engine) return;
      if (worker || engine === 3) {
        // (what the thread gone says as it goes — a script it was loading — is not the scene's; engine 3's thread is
        // ended by its side of the stage: below)
        if (worker) { worker.onmessage = worker.onerror = null; worker.terminate(); }
        // (what the thread gone was asked: nothing more will come of it)
        for (const [ok] of waiting.values()) ok(undefined);
        waiting.clear();
        canvas.remove(); overlay?.remove();
        last = { frame: null, camera: null, hero: null, fixed: true, points: {} };
        for (const a of acts.values()) a.end('cancelled');
        if (engine === 3) leave3();
        lacking?.remove();
        lacking = null;
      }
      engine = next;
      // (the veil: the thread's over an engine-3 scene — told it as it starts —, else the stage's layer, as it stands)
      veiled(engine === 3 ? 0 : told.veil, 0);
      canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none';
      place.prepend(canvas);
      // (the thread begun at the mount, if it is still there — else one begun now; unused, let go)
      // (engine 3's thread is started by its side of the stage, once the device's tier is known)
      worker = engine === 3 ? null : early ?? begin();
      if (early && early !== worker) { early.onerror = null; early.terminate(); }
      early = null;
      if (worker) worker.onmessage = heard;
      // the canvas and, over it, what is where (?debug), given over
      overlay = debug != null ? document.createElement('canvas') : null;
      if (overlay) { overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:8'; document.body.append(overlay); placeOver(overlay); }
      // engine 3: the rest is its side's — its thread, the canvas made here for this use given over with its own
      // `mount`, and what the thread before was told (as it is now: what is told after goes after) told again; the
      // selection's canvases are not given
      if (engine === 3) {
        const u = use3 = { begun: false }, was = { ...told, listen: [...told.listen] }, made = canvas, over = overlay;
        to3(p => { u.begun = true; p.begin(was, made, over); });
        return;
      }
      const offscreen = canvas.transferControlToOffscreen(), over = overlay?.transferControlToOffscreen() ?? null;
      worker.postMessage({ t: 'mount', canvas: offscreen, overlay: over, ...size(), flags: { check, debug }, clock, real, speech: typeof MooodSpeech !== 'undefined' }, over ? [offscreen, over] : [offscreen]);
      if (told.paused) call('pause', true);
      if (told.view) call('setView', ...told.view);
      for (const k of told.listen) call('listen', k);
      if (told.selecting) giveSelecting();
      if (told.pickSpec !== undefined) call('pickSpec', told.pickSpec);
      if (told.select !== undefined) call('select', told.select);
      if (told.offer !== undefined) call('offer', told.offer);
    }
    const standing = q.has('stand') ? (window.__mooodStandFrames = []) : null;
    function heard({ data: m }) {
      said(m);
      if (m.t === 'frame') {
        if (standing && standing.length < 65536) standing.push(performance.timeOrigin + performance.now());
        last = m;
        if (m.state) values = m.state;
        if (overlay) placeOver(overlay);
        for (const fn of framed) fn();
      } else if (m.t === 'reply') {
        const w = waiting.get(m.id);
        if (!w) return;
        waiting.delete(m.id);
        if ('error' in m) w[1](new Error(m.error)); else w[0](m.value);
      } else if (m.t === 'change' || m.t === 'move') {
        values = { ...values, [m.key]: m.value };
        if (m.value === null) delete values[m.key];  // (a value set to null is gone)
        for (const l of listeners[m.t]) if (l.key == null || l.key === m.key) {
          try { l.fn(m.value, m.old, m.key); } catch (err) { (window.__mooodErrors ||= []).push(`widget: ${err?.message || err}`); }
        }
      } else if (m.t === 'switched') {
        // (engine 3: the scene shown is the new one from here — what the page holds of it, its state as the thread has it)
        const take = switching.get(m.show);
        switching.delete(m.show);
        take?.();
        values = m.values;
      } else if (m.t === 'veil') told.veil = m.level;
      else if (m.t === 'mounted') {
        // (no WebGL2: the scene cannot be shown here — said as engine 3 says it without WebGPU)
        if (m.cannot) { (window.__mooodErrors ||= []).push(`renderer: ${m.cannot}`); lacks(tr('this device cannot show the scene')); return; }
        keys = m.keys;
        if (m.gpu) globalThis.MooodSeen?.described({ gpu: { api: 'webgl', ...m.gpu } });
      }
      else if (m.t === 'tell') tells.tell?.(m.text, m.about);
      else if (m.t === 'save') tells.save?.(m.changes);
      else if (m.t === 'perf') perf.show(m.text);
      else if (m.t === 'frames') seen?.frames(m);
      // (engine 3's director)
      else if (m.t === 'action') acts.get(m.id)?.heard(m);
      else if (m.t === 'event') {
        // (engine 3 says when — `at`, the scene's seconds: a render's page reads it; the older engines say none)
        // (engine 3 says whose — `scene`: the tag its show was given, while two scenes live: 2.9)
        if (m.type === 'tell') tells.tell?.(m.data.text, m.data.about, m.at, m.scene);
        for (const l of events) if (l.type === m.type) { try { l.fn(m.data, m.scene); } catch (err) { (window.__mooodErrors ||= []).push(`${m.type}: ${err?.message || err}`); } }
      } else if (m.t === 'say') sayLine(m);
      else if (m.t === 'unsay') unsay(m.id);
    }
    function placeOver(c) {
      const r = place.getBoundingClientRect();
      Object.assign(c.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    }
    // a line engine 3's director has someone say: said by the page's speech (speech.js) — its length told as its voice
    // begins (heard), its end as it has been heard; a line not voiced (no speech on this page, no voice for it, dropped
    // as the player spoke up): unheard — the thread times it as long as it is read (a page without speech.js says so as
    // the stage is mounted, speech: the thread times its lines itself — the same in every render)
    function sayLine({ id, who, text, opts }) {
      if (typeof MooodSpeech === 'undefined' || !MooodSpeech.active()) { call('said', id, 'unheard'); return; }
      let heard = false;
      const begun = e => {
        if (e.detail?.id !== String(who).split('#')[0] || e.detail.text !== text || !e.detail.on) return;
        heard = true;
        removeEventListener('moood:speech', begun);
        call('said', id, 'heard', e.detail.duration);
      };
      addEventListener('moood:speech', begun);
      const line = MooodSpeech.say(who, text, opts || {});
      lines.set(id, line);
      line.finally(() => { lines.delete(id); removeEventListener('moood:speech', begun); call('said', id, heard ? 'end' : 'unheard'); });
    }
    // a line the director no longer has said (replaced, cancelled, finished at once): its voice stopped, its words gone
    const lines = new Map();
    function unsay(id) { const line = lines.get(id); if (line) MooodSpeech.unsay?.(line); }
    new ResizeObserver(() => { worker?.postMessage({ t: 'size', ...size() }); if (lacking) putLacking(); }).observe(place);

    // ── the page's input, on the place: a point of the page in the canvas's CSS px (the place may be scaled) ──
    const at = e => {
      const r = place.getBoundingClientRect(), k = r.width / Math.max(1, place.clientWidth) || 1;
      return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
    };
    const down = new Set();
    place.style.touchAction = 'none';
    place.addEventListener('pointerdown', e => {
      e.target.setPointerCapture?.(e.pointerId); down.add(e.pointerId);
      send({ type: 'pointerdown', pointerId: e.pointerId, ...at(e) });
      askTilt();
    });
    place.addEventListener('pointermove', e => { if (down.has(e.pointerId)) send({ type: 'pointermove', pointerId: e.pointerId, ...at(e) }); });
    for (const type of ['pointerup', 'pointercancel']) place.addEventListener(type, e => { down.delete(e.pointerId); send({ type, pointerId: e.pointerId }); });
    place.addEventListener('wheel', e => { e.preventDefault(); send({ type: 'wheel', deltaX: e.deltaX, deltaY: e.deltaY, ...at(e) }); }, { passive: false });
    // the view leans toward wherever the mouse is (not while it is held steady: steady(on) — a mini-game, nothing moves
    // under the finger; it stays as it leaned) ...
    let steady = false;
    addEventListener('pointermove', e => {
      if (e.pointerType === 'mouse' && !steady) send({ type: 'lean', x: 2 * e.clientX / Math.max(1, innerWidth) - 1, y: 2 * e.clientY / Math.max(1, innerHeight) - 1 });
    });
    // ... or with the phone's tilt, from how it is held (the rest position follows it slowly)
    let rest = null;
    addEventListener('deviceorientation', e => {
      if (e.beta == null || e.gamma == null) return;
      const a = screen.orientation?.angle ?? 0;
      const [h, v] = a === 90 ? [e.beta, -e.gamma] : a === 270 ? [-e.beta, e.gamma] : [e.gamma, e.beta];
      rest = rest ? { h: rest.h + (h - rest.h) * 0.01, v: rest.v + (v - rest.v) * 0.01 } : { h, v };
      if (!steady) send({ type: 'lean', x: (h - rest.h) / 15, y: (v - rest.v) / 15 });
    });
    // iOS lets a page read the tilt only once asked, on a touch
    let asked = false;
    function askTilt() {
      if (asked || typeof window.DeviceOrientationEvent?.requestPermission !== 'function') return;
      asked = true;
      DeviceOrientationEvent.requestPermission().catch(() => {});
    }
    // the keys: not while one types, nor with Ctrl, Alt, ⌘; the scene's own kept from the page while it moves by them
    const typing = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    addEventListener('keydown', e => {
      if (typing() || e.ctrlKey || e.metaKey || e.altKey || !ours()) return;
      send({ type: 'keydown', key: e.key, code: e.code });
      if (keys.includes(e.key.length === 1 ? e.key.toLowerCase() : e.key) && !last.fixed) e.preventDefault();
    });
    addEventListener('keyup', e => send({ type: 'keyup', key: e.key, code: e.code }));
    addEventListener('blur', () => send({ type: 'blur' }));

    // ── selecting (select.js, pick.js): the canvases the selection glows on and what may be picked, given over ──
    function giveSelecting() {
      const anew = c => { if (!c) return null; const d = c.cloneNode(false); c.replaceWith(d); return d; };
      // (given to a thread once: an engine changed, the same canvases made anew in their places)
      if (told.selecting.given) told.selecting = { overlay: anew(told.selecting.overlay), offer: anew(told.selecting.offer) };
      const { overlay: o, offer } = told.selecting, c = o.transferControlToOffscreen(), f = offer?.transferControlToOffscreen();
      told.selecting.given = true;
      worker.postMessage({ t: 'selecting', overlay: c, offer: f }, f ? [c, f] : [c]);
    }

    // ── engine 3's director: the actions the page started, as the page holds them ──
    let acted = 0;
    const acts = new Map(), events = [];
    function act(actor, verb, ...args) {
      const id = `p${++acted}`, hs = [], ends = [];
      let status = null, remaining = null;
      const a = {
        id, actor, verb,
        get status() { return status ?? 'running'; }, get remaining() { return remaining; },
        then: (ok, fail) => new Promise(r => (status ? r(status) : hs.push(r))).then(ok, fail),
        ending: () => new Promise(r => (status ? r(status) : ends.push(r))),
        on(ev, fn) { (a.ons ||= []).push([ev, fn]); return a; },
        cancel: () => call('control', id, 'cancel'), pause: () => call('control', id, 'pause'), resume: () => call('control', id, 'resume'),
        finish: () => call('control', id, 'finish'),
        heard(m) {
          remaining = m.remaining;
          for (const [ev, fn] of a.ons || []) if (ev === m.ev) { try { fn(m); } catch (err) { (window.__mooodErrors ||= []).push(`action ${verb}: ${err?.message || err}`); } }
          if (m.ev === 'ending') for (const r of ends.splice(0)) r('ending');
          if (['done', 'cancelled', 'replaced'].includes(m.ev)) a.end(m.ev);
        },
        end(s) { status = s; acts.delete(id); for (const r of hs.splice(0)) r(s); for (const r of ends.splice(0)) r(s); },
      };
      acts.set(id, a);
      if (engine !== 3) { a.end('done'); (window.__mooodWarnings ||= []).push(`act(${actor}, ${verb}): actions are engine 3's — this scene is not`); return a; }
      call('act', id, actor, verb, args);
      return a;
    }

    // the state as the thread says it (MooodState, below)
    let values = {}, states = null;
    const stage = {
      show(spec, modules, opts) {
        use(engineOf(spec)); shown.title = String(spec?.title || '');
        const showing = atOnce('show', [spec, modules]);
        // (engine 3's: the switch through black, a jump — with the show)
        if (engine === 3) together.showOpts = opts || null;
        if (seen) {
          const which = seen.shown(engine, shown.title);
          // (built: ready; drawn — the first frame the thread says after it; of this scene, not one shown since)
          call('ready').then(() => {
            seen.ready('built', which);
            const off = stage.onFrame(() => { off(); seen.ready('drawn', which); });
          }, () => {});
        }
        return showing;
      },
      about: text => { shown.about = String(text || ''); },
      resetCamera: () => call('resetCamera'),
      setView: (left, right) => { told.view = [left, right]; return call('setView', left, right); },
      ready: () => call('ready'),
      seen: () => call('seen'),
      // (engine 3 has no such call: its frames are asked whole — ready(), seen(), still())
      draw: how => (engine === 3 ? Promise.resolve(undefined) : call('draw', how)),
      still: values_ => call('still', values_),
      inspect: () => call('inspect'),
      ground: (across, distance) => call('ground', across, distance),
      selecting: (o, offer) => { told.selecting = { overlay: o, offer, given: false }; if (worker) giveSelecting(); },
      pickSpec: spec => { told.pickSpec = spec; return call('pickSpec', spec); },
      pick: (x, y, allowed) => call('pick', x, y, allowed),
      // where the selection is in the canvas (CSS px), as the last frame had it — or null
      selected: () => last.selected ?? null,
      select: path => { told.select = path; return call('select', path); },
      offer: paths => { told.offer = paths; return call('offer', paths); },
      // a point of the page (clientX, clientY) in the canvas's CSS px
      local: at,
      onInput: fn => { moves.push(fn); },
      steady: on => { steady = !!on; },
      input: ev => { if (engine === 3) input3(ev); else worker?.postMessage({ t: 'in', ev }); },
      get canvas() { return canvas; },
      frame: () => ({ ...(last.frame || { x: 0, y: 0, w: place.clientWidth, h: place.clientHeight }) }),
      camera: () => last.camera && { ...last.camera },
      hero: () => last.hero,
      screenOf(ref, lift = 0, over = false) {
        // (engine 3: its thread projects every point — where the last frame told had it; null till it has said)
        if (engine === 3) return use3?.begun ? third.screenOf(ref, lift, over) : null;
        const k = `${ref}|${lift}|${over}`;
        if (!(k in last.points)) { last.points[k] = null; call('track', ref, lift, over).then(p => { last.points[k] ??= p; }); }
        return last.points[k];
      },
      // a scene's own scenario (its showcase: engine 3), outside games — the scene's page; info: as the last frame had it
      // ({ at, length, known, playing, ended, beat, beats }), null without one
      showcase: {
        // (asked in the moment its scene is shown, it rides in that one call — atOnce)
        start: () => (engine === 3 ? atOnce('showcase', ['start']) : Promise.resolve(null)),
        play: () => (engine === 3 ? call('showcase', 'play') : Promise.resolve(null)),
        pause: () => (engine === 3 ? call('showcase', 'pause') : Promise.resolve(null)),
        seek: seconds => (engine === 3 ? call('showcase', 'seek', seconds) : Promise.resolve(null)),
        get info() { return last.showcase ?? null; },
      },
      // fn() after each frame the scene's thread drew (its info as that frame had it: what the page lays over it);
      // → a function that takes it off (once the listeners being called now, if they are, have all been called)
      onFrame: fn => { framed.push(fn); return () => queueMicrotask(() => { const i = framed.indexOf(fn); if (i >= 0) framed.splice(i, 1); }); },
      // An engine-3 scene stands while nobody watches it (the page hidden, the place out of sight), while the play is
      // paused, and while a layer of the page lies over the whole of it — cover(on), told by that layer;
      // onPause(fn): fn(paused) as it stops and goes on (the voices, the music wait with it). Scenes of the older
      // engine are not stopped by these
      cover: on => { covered = !!on; if (engine === 3) to3(p => p.watch()); },
      onPause: fn => { pausings.push(fn); },
      onStory: fn => { storyings.push(fn); },
      fade(level, seconds = 0) {
        level = Math.min(1, Math.max(0, Number(level) || 0)); seconds = Math.max(0, Number(seconds) || 0);
        told.veil = level;
        return engine === 3 ? call('fade', level, seconds) : veiled(level, seconds);
      },
      // the state's side of it (MooodState)
      state: {
        start(spec, state, { modules, tell, save, jump }) {
          use(engineOf(spec));
          const take = () => {
            tells.tell = tell || null; tells.save = save || null;
            values = { ...(spec?.state && typeof spec.state === 'object' ? spec.state : {}), ...state };
            // (the scene's description of its values, as the thread takes it: what it says of them is the thread's)
            states = spec?.states && typeof spec.states === 'object' && !Array.isArray(spec.states) ? spec.states : null;
          };
          // (engine 3: taken with the show it comes with as the thread switches, or alone in its moment — atOnce)
          if (engine !== 3) take();
          const starting = atOnce('start', [spec, state, { modules, tell: !!tell, save: !!save, jump: !!jump }]);
          if (engine === 3) together.taken = take;
          return starting;
        },
        call, listeners, act, events,
        listen: key => { told.listen.add(key); return call('listen', key); },
        get engine() { return engine; },
        get values() { return values; },
        get states() { return states; },
      },
    };
    current = stage;
    stages.push(stage);
    return stage;
  }
  // the frame times (P), over the scene: a column down its left side, under the page's crumbs and what stands below
  // them — nothing of the page under it (the pointer goes through it to the scene) but its one button: the panel's
  // text as it stands copied, under a heading — the page's address, what the scene is (scene()), the time
  function panel(scene) {
    const p = document.createElement('div'), text = document.createElement('div'), copy = document.createElement('button');
    p.style.cssText = 'position:fixed;left:8px;top:112px;max-height:calc(100vh - 128px);overflow:hidden;z-index:9;font:11px/1.35 ui-monospace,Consolas,monospace;color:#cfe;background:rgba(0,0,0,.6);padding:4px 8px;border-radius:6px;pointer-events:none;display:none;white-space:pre';
    copy.type = 'button'; copy.textContent = tr('copy');
    copy.style.cssText = 'position:absolute;top:4px;right:8px;font:inherit;color:inherit;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.3);border-radius:4px;padding:0 6px;cursor:pointer;pointer-events:auto';
    let said = 0;
    copy.onclick = () => {
      // (the keys stay the scene's: Enter, the space bar not this button's)
      copy.blur();
      const say = word => { copy.textContent = word; clearTimeout(said); said = setTimeout(() => { copy.textContent = tr('copy'); }, 1200); };
      const all = [location.href, scene(), new Date().toISOString(), text.textContent].filter(Boolean).join('\n');
      // (no clipboard: a page not served securely, a frame not let write to it)
      (navigator.clipboard ? navigator.clipboard.writeText(all) : Promise.reject()).then(() => say(tr('copied')), () => say(tr('not copied')));
    };
    p.append(copy, text);
    document.body.append(p);
    return { show(t) { text.textContent = t || ''; p.style.display = t ? 'block' : 'none'; } };
  }
  // the stage the state is the scene of: the page's last
  let current = null;
  // onPause(fn): fn(paused) as an engine-3 scene of any stage of the page — mounted already or later — stops and goes
  // on; cover(on): every stage of the page told that a layer of the page lies over the whole view
  return {
    mount, get current() { return current; },
    onPause: fn => { everywhere.push(fn); },
    cover: on => { for (const s of stages) s.cover(on); },
  };
})();

// The scene's state, as the page has it (it runs in the scene's thread): told there, heard from there
const MooodState = (() => {
  const S = () => Moood.current?.state;
  const DIRECTOR = new Set(['arrived', 'line', 'cut', 'signal', 'tell']);
  return {
    start: (spec, state = {}, opts = {}) => (opts.stage || Moood.current).state.start(spec, state, opts),
    stop: () => S()?.call('stop'),
    // the scene taken to where the game has got to in it (scenestate.js catchUp) — once done
    catchUp: then => S()?.call('catchUp', then) ?? Promise.resolve(),
    set: (key, value, over, ease, opts = {}) => S()?.call('set', key, value, over, ease, opts),
    cut: (changes, opts = {}) => S()?.call('cut', changes, opts),
    turn: (key, degrees, over, ease) => S()?.call('turn', key, degrees, over, ease),
    path: (keys, points, opts) => S()?.call('path', keys, points, opts),
    // (engine 3: a shot made ready ahead — values, no seconds — → its id, for unprepare; the others: nothing to let go)
    prepare: (values, seconds) => (S()?.engine === 3 ? S().call('prepare', values) : S()?.call('prepare', values, seconds)),
    unprepare: id => (S()?.engine === 3 ? S().call('unprepare', id) : Promise.resolve()),
    check: (keys, who) => S()?.call('check', keys, who),
    unknown: () => S()?.call('unknown') ?? Promise.resolve([]),
    get states() { return S()?.states ?? null; },
    get: key => S()?.values[key],
    all: () => ({ ...(S()?.values || {}) }),
    // engine 3's director: an action (actor: a person's id, 'state', 'camera', 'light:<id>'), a signal for the scene's
    // sequences, the scene saved as data and restored from it
    act: (actor, verb, ...args) => S()?.act(actor, verb, ...args),
    signal: (name, data) => S()?.call('signal', name, data),
    save: () => S()?.call('save') ?? Promise.resolve(null),
    restore: data => S()?.call('restore', data),
    // a game jumping to a moment of it: on — every action finishes at once, nothing drawn; off — the scene shown once
    instant: on => (S()?.engine === 3 ? S().call('instant', !!on) : Promise.resolve()),
    on(ev, a, b) {
      const fn = typeof a === 'function' ? a : b, key = typeof a === 'function' ? null : String(a), s = S();
      if (!s) return;
      // (an engine-3 scene's event comes with whose it is — the tag of its show: given on)
      if (DIRECTOR.has(ev)) { s.events.push({ type: ev, fn: key == null ? fn : (d, of) => { if ((d?.who ?? d?.name ?? d?.actor) === key) fn(d, of); } }); return; }
      if (!(ev in s.listeners)) return;
      s.listeners[ev].push({ key, fn });
      if (ev === 'move') s.listen(key);
    },
  };
})();
