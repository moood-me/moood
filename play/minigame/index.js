// The language of mini-games (docs/games/miniux/language.md — how it is for the player; this is how it is made): a
// vocabulary of interaction, the same in every bespoke game on engine 3 — where one can touch (marks), what the hand
// does there (gestures, which report it every frame and show their own physics), how it answers (responses the game
// calls, the glow of the thing, sounds), the ghost finger and the plate the game fills. No logic: what happens, in
// what order, what is done, an error, a success, how long anything lasts — the game's code. Marks and gestures — as
// many at once as the game wants. The scene is not touched nor stopped: the game moves it by its keys, from what the
// gestures report. A library of ready tricks on top of this (tricks.js) — the same public API, no more.
//   const minigames = createMinigames({ root, where, frame, screen, onFrame, highlight, steady, trouble })
//     root: the page element it lives in (index.html's #minigame, under the game's layer); where(ref) → {x, y, seen} on
//     the page (px) | null; frame() → the scene's frame on the page; onFrame(fn) — each frame the scene has said where
//     its points are; highlight(id, how) — the thing itself glows: 'waiting' (it pulses), 'working' (steady), null →
//     whether it can (an element of the scene); steady(on) — the view leans no more toward the pointer (nothing moves
//     under the finger); trouble(error) — a game's error said
// What the game is given (bespoke.minigame):
//   start({phrase, sample, plate: true, signal}) → mg, a mini-game begun (the start): the plate shows (phrase — what is
//     happening; sample — an element, what to compare with), the entering's sound; from now till its end the glow of
//     things is the language's and the view stands. plate: false — no plate, no entering (a plain choice between
//     mini-games: its presses have petals, one too; gestures on marks only): no veil either — the marks and their
//     petals take a touch, the rest of the screen stays the scene's (its camera dragged, turned, pinched as it lets;
//     a touch on none is no miss) — while a mark's petals are out the veil is back: a touch off them folds them. signal — an AbortSignal: it is left at once (as mg.leave()). One at a time: a start leaves the one
//     before.
//   relative(p, a, b) → {u, v}: a page point in the frame of two points of the scene (a at 0, b at u 1, v up, in their
//     distance) — where to draw in the scene a thing the finger carries
//   style(s) — the game's look and sound (§7): {key, colors: {mark, fill, good, danger, fork, ghost}, line, font, sounds:
//     {role: fn({ctx, out, at, opts})}, vibrate}; none — moood's own. key — the game's key, Lyria's name of a relative
//     pair (its music's `scale`: C_MAJOR_A_MINOR … B_MAJOR_A_FLAT_MINOR — minigame/sounds.js KEYS): the tonal sounds
//     are on its major's tonic (a fifth over it lies in its minor too); none — D_MAJOR_B_MINOR; another name — an error
//   author tools (play.js gives them only while the author plays): settings({sound, debug}) — the language with no
//     sound, its debug drawn (the touches' circles, paths, the gestures' numbers, the last error, the answer's delay);
//     sounds — the language's sounds heard as a mini-game hears them (on the game's key and style), for a board:
//     list() → {sounds: [[event, as]…], tones: [[process, as]…]}; play(event) — once ('end:clean' — the end as clean);
//     tone(process) → {set({u, level}), remove()} — as mg.layer
//   skip() → whether there was a mini-game to ask (play.js gives it, bespoke.minigame.skip, to every player): the
//     going mini-game is told 'skip' — the language draws no button of its own: the game has its ⏭ in its own row of
//     buttons, for every player (a safety net if something glitches, not a way through: mini-games are still made
//     passable), and calls this; the game ends the mini-game so it leaves in the story the same trace as one played
//   pause(on) — the play paused (play.js calls it with bespoke.pause)
// A mini-game, mg — every word is one call with one options object; what it makes is a handle: h.set(o) — its options
// changed (what is given), h.remove() — gone; what lives also h.on(event, fn) → off and h.state (what it reports now):
//   mg.mark({at, kind: 'ring' | 'groove' | 'dash' | 'spot' | 'light', quiet, color: 'theirs' | 'own' | null, danger: u,
//     time: u, hidden}) → a mark (§2.1) on a point of the scene (at: 'id#name' — e.at; 'id@' — where it is pressed) or
//     on one of the game's own on the page (at: a function → {x, y} page px | null — what the game draws over the
//     scene, where its fn says now: placed as a scene's point is, hidden out of the frame or while null), following it
//     each frame; quiet — smaller and paler (a second path; its size as made); danger or time — its one
//     arc (one meaning in a mini-game): danger 0…1 growing red, time 1…0 running down; light — a beat's sign, no
//     touch. It appears with a bounce and pulses till touched (unless a thing glows: one breath in one place). h.pos
//   mg.press / hold / pull / trace / turn / rub / seek / rhythm / lead / touch({on: mark | null, …}) → a gesture
//     (gestures.js says each one's options, state and events) on a mark (a touch within its touch circle — wider
//     than the mark is drawn, gestures.js touchRadius) or, on null,
//     anywhere on the screen; events of all: 'down' {x, y}, 'up' {x, y}, 'frame' (its state, each frame). One finger:
//     a touch goes to the gestures of the nearest mark it is on; on none — to the gestures anywhere; to none — a
//     ripple at the finger, and mg's 'miss'. A hold made while a finger already lies in its mark's circle takes it,
//     with no lifting (the mark moved on under a finger still down), and starts to fill. A gesture on a light takes no touch: it only shows (a rhythm's beats
//     on what leads). A gesture goes with its mark when the mark is removed
//   mg.show({gestures: [g…]} | {handsOff: true}) → the ghost showing them one after another on their marks (or
//     hands off — doing nothing is the way), once their points are in the window and no finger is down; events
//     'start', 'end' {done: false — the player's touch stopped it}; h.finished → a promise of done. A gesture of this
//     mini-game already removed: nothing is shown, quietly (h.finished → false, h.dead); a gesture of another — an error
//   responses: mg.snap({at}) — a thing done: a click-bounce, a spark, its sound, the thing's glow out; mg.error(reason,
//     {at, finger, chip: true}) — an error (§5), its look where at is (a mark, a gesture — it shows it its own way —,
//     or a page point), finger — where the finger was (a miss: the ripple there, the mark twitching toward it), chip —
//     a quiet chip on the bar where it stands; reasons: miss, early, danger, off, behind, wrong, timing, often,
//     against, jerk; mg.glow(id | null) — the thing (a scene element) waits, pulsing; mg.sceneTurn(on) — the scene answers now: the marks hidden, a touch taken by none, the
//     plate's glow breathing; mg.end({as: 'clean' | 'flawed' | 'neutral' | 'loss'}) → a promise once the plate has
//     faded: the end shown (§6), then it is left; mg.leave() — left at once, nothing shown (the player's skip, a game
//     going elsewhere)
//   sounds: mg.sound(role, {strong, how}) — once: enter, tap, snap, halfway (the game says when all goes well, half
//     way), miss, slip, fault, quarter, beat, tick, found, end;
//     mg.layer(role) → a process that lasts (fill, motion, seek, zone, tension, time): h.set({u, level}), h.remove().
//     A gesture leads its own (fill, motion, ratchet, seek, zone); the rest the game calls
//   mg.plate.set({phrase, fill, notches, glow, shade, ways, sample}) — the plate (plate.js says each)
//   mg.on(event, fn) → off: 'frame' {t, dt} (t: seconds since it began — the play's time, standing with its pause),
//     'down' {x, y} — any touch, 'up' {x, y} — it let go, 'miss' {x, y, mark: the nearest mark}, 'pause', 'resume' (⏸, the page hidden),
//     'skip' (the player's skip, told by skip() above: what to skip, the game decides), 'end' (left, any way); mg.t
import { createLayer, el, dist, SIZES } from './layer.js';
import { createPlate } from './plate.js';
import { createGhost } from './ghost.js';
import { createFeel } from './feel.js';
import { GESTURES, touchRadius } from './gestures.js';

// an error's look (§5): the sound of its kind, what moves (the mark: layer.js's effects), a ripple at the finger, a
// flash where it happened
const REASONS = {
  miss: { name: 'missed', sound: 'miss', move: 'twitch', ripple: true },
  early: { name: 'let go early', sound: 'slip', move: 'release' },
  danger: { name: 'into danger', sound: 'slip', move: 'jerk' },
  off: { name: 'off the way', sound: 'slip', flash: true },
  behind: { name: 'fell behind', sound: 'slip', flash: true },
  wrong: { name: 'wrong place, wrong thing', sound: 'fault', move: 'shake' },
  timing: { name: 'too early or too late', sound: 'fault' },
  often: { name: 'too often', sound: 'fault', ripple: true },
  against: { name: 'against', sound: 'fault' },
  jerk: { name: 'jerked', sound: 'slip' },
};
const ENDS = ['clean', 'flawed', 'neutral', 'loss'];
const TOUCH_LATE = 0.03; // s: a phone's touch comes this much after the finger (a rhythm's hit counted by the picture)

export function createMinigames({ root, where, frame, screen, onFrame, highlight, steady, trouble }) {
  const veil = el('div', 'mg-veil', root);
  const layer = createLayer({ root, where, frame, screen, onFrame });
  const ghost = createGhost(root);
  const feel = createFeel();
  const plate = createPlate(root);
  const debug = createDebug(root, layer);
  let session = null; // the mini-game going on
  let paused = false, away = false, awayFrom = 0, awayAll = 0, later = [];
  // the language's clock: the play's (it stands with its pause), less the time the page was not seen
  const now = () => (performance.now() - awayAll) / 1000;
  const fire = (listeners, ev, data) => { for (const fn of listeners.get(ev) || []) try { fn(data); } catch (e) { trouble(e); } };
  const listen = (listeners, ev, fn) => { if (!listeners.has(ev)) listeners.set(ev, new Set()); listeners.get(ev).add(fn); return () => listeners.get(ev).delete(fn); };
  const placePlate = () => plate.place(layer.window());
  addEventListener('resize', placePlate);

  // ── the input: one veil over the screen while a mini-game goes on (the game's buttons stand over it, in its corners);
  // a plain choice (no plate) has none: its marks take a touch themselves (.mg-free), the rest is the scene's. One
  // finger; on a pause nothing is taken — a finger let go meanwhile is let go when it goes on ──
  let finger = null, fingerAt = null; // the finger down: its id, where it is
  const at = e => ({ x: e.clientX, y: e.clientY, latency: e.pointerType === 'touch' ? TOUCH_LATE : 0 });
  // (what takes a touch: the veil, or a mark of a plain choice — the petals take theirs themselves)
  // (the wheel over the veil is not the scene's either: under a gesture the camera stands — runtime.js gives the
  // wheel over the page's places to the scene, but this; over a plain choice's marks it is the scene's)
  veil.addEventListener('wheel', e => e.stopPropagation());
  const taker = e => (e.target === veil || (root.classList.contains('mg-free') && e.target.closest?.('.mg-mark')) ? e.target : null);
  root.addEventListener('pointerdown', e => {
    const t = taker(e);
    if (!t) return;
    e.preventDefault();
    feel.wake();
    if (paused || away || finger !== null || !session) return;
    finger = e.pointerId;
    fingerAt = at(e);
    t.setPointerCapture(e.pointerId);
    debug.touch(at(e), e.timeStamp);
    session.input('down', at(e));
  });
  root.addEventListener('pointermove', e => {
    if (paused || e.pointerId !== finger || !session) return;
    fingerAt = at(e);
    debug.trail(at(e));
    session.input('move', at(e));
  });
  for (const type of ['pointerup', 'pointercancel']) root.addEventListener(type, e => {
    if (e.pointerId !== finger) return;
    finger = null; fingerAt = null;
    const go = () => session?.input('up', at(e));
    if (paused || away) later.push(go); else go();
  });
  root.addEventListener('contextmenu', e => { if (taker(e)) e.preventDefault(); });
  // stood: the play paused or the page not seen — the game told, the beats counted in again after it
  const stand = was => {
    const is = paused || away;
    if (is === was || !session) return;
    if (is) session.emit('pause'); else { const letGo = later; later = []; for (const fn of letGo) fn(); session.resumed(); session.emit('resume'); }
  };
  document.addEventListener('visibilitychange', () => {
    const was = paused || away;
    away = document.hidden;
    if (away) awayFrom = performance.now(); else awayAll += performance.now() - awayFrom;
    stand(was);
  });

  function start({ phrase = '', sample = null, plate: withPlate = true, signal = null } = {}) {
    session?.leave();
    const listeners = new Map(), marks = new Map(), gestures = new Set(), layers = new Set(), shows = new Set(), made = new WeakSet(); // made: every gesture handle of this mini-game
    const began = now();
    let gone = false, holders = [], glowing = null, turn = false, lastSnap = null, raf = 0, last = null;
    // what the player did in it, for the account of the play (MooodSeen, docs/host.md): an attempt — the touches till a thing done or an
    // error (each: where in the scene's frame, what took it — 2 a mark, 1 a gesture anywhere, 0 none: a miss —, when) —
    // one event; its end, with how it went
    const seen = globalThis.MooodSeen, tried = { points: [], attempts: 0, errors: 0, touches: 0, skipped: false };
    const attempt = result => {
      // (no touch of its own — a thing done or the end with nothing touched since: a petal pressed, the game's own drawing)
      if (!tried.points.length && (result === 'end' || result === 'done')) return;
      tried.attempts++;
      seen?.say('minigame.attempt', { result, points: tried.points });
      tried.points = [];
    };
    const emit = (ev, data) => fire(listeners, ev, data);
    const inner = h => { const m = marks.get(h); if (!m) throw new Error("a mark not of this mini-game, or taken away"); return m; };
    const glowNow = () => { if (glowing && !turn) highlight(glowing, holders.length ? 'working' : 'waiting'); };
    // where something is: a mark, a gesture (its mark), a page point
    const place = a => {
      if (!a) return {};
      if (marks.has(a)) { const m = marks.get(a); return { mark: m, point: m.pos }; }
      const rec = [...gestures].find(r => r.handle === a);
      if (rec) return { mark: rec.mark, point: rec.mark?.pos || null, rec };
      return { point: { x: a.x, y: a.y } };
    };

    const removeGesture = rec => {
      if (!gestures.delete(rec)) return;
      holders = holders.filter(r => r !== rec);
      try { rec.g.remove?.(); } catch (e) { console.error(e); }
    };
    const gesture = name => (o = {}) => {
      if (gone) throw new Error('the mini-game has ended');
      if (!withPlate && !o.on) throw new Error('a plain choice has gestures on marks only');
      const m = o.on ? inner(o.on) : null;
      const conv = n => ({ ...n, ...(n.show ? { show: Array.isArray(n.show) ? n.show.map(inner) : inner(n.show) } : {}) });
      const opts = conv(o);
      // (late: made while a finger lies down — a hold takes it once it is in the mark's circle, see takeLate)
      const rec = { name, listeners: new Map(), mark: m, late: name === 'hold' && !!m && finger !== null };
      // (a press's petals: one chosen — a choice of the play's; folded with none chosen)
      const told = (ev, data) => {
        if (ev === 'choose') seen?.say('play.choice', { id: data.id, label: o.petals?.find(q => q.id === data.id)?.label ?? null, phrase });
        else if (ev === 'fold') seen?.say('minigame.petals', { folded: true, phrase });
        fire(rec.listeners, ev, data);
      };
      const ctx = { layer, feel, mark: m, emit: told, tap: p => answer(p) };
      rec.g = GESTURES[name](ctx, opts);
      // (where a touch is its: the language's px, grown with the frame as the marks are)
      const reach0 = rec.g.reach ?? touchRadius(m?.base || 0);
      rec.reach = () => reach0 * layer.k();
      rec.handle = {
        on: (ev, fn) => listen(rec.listeners, ev, fn),
        set(n) { if (!gestures.has(rec)) return; const c = conv(n); rec.g.set?.(c); Object.assign(opts, c); },
        remove: () => removeGesture(rec),
        get state() { return rec.g.state; },
      };
      gestures.add(rec);
      made.add(rec.handle);
      return rec.handle;
    };
    // a touch taken: answered at once — a ring of light beside the finger, the knock, a short buzz
    const answer = p => { layer.touch(p); feel.play('tap'); feel.buzz(10); };

    const mg = {
      get t() { return now() - began; },
      on: (ev, fn) => listen(listeners, ev, fn),
      mark(o = {}) {
        if (gone) throw new Error('the mini-game has ended');
        const kind = o.kind || 'ring';
        if (!SIZES[kind]) throw new Error(`no such mark: ${kind}`);
        const at = typeof o.at === 'function' ? () => { const p = o.at(); return p && layer.fit(p); } : o.at;
        const m = layer.mark({ at, kind, size: o.quiet ? SIZES[kind] * 0.75 : SIZES[kind] });
        const apply = n => {
          if (n.quiet !== undefined) m.is('quiet', n.quiet);
          if (n.color !== undefined) { m.is('theirs', n.color === 'theirs'); m.is('own', n.color === 'own'); }
          if (n.danger != null) m.arc(n.danger, 'danger');
          if (n.time != null) m.arc(n.time, 'time');
          if (n.hidden !== undefined) m.is('hidden', n.hidden);
        };
        apply(o);
        if (kind !== 'light') { m.is('waiting'); m.do('pop'); }
        const h = {
          set: apply,
          remove() { if (!marks.has(h)) return; for (const r of [...gestures]) if (r.mark === m) removeGesture(r); marks.delete(h); m.remove(); },
          get pos() { return m.pos && { x: m.pos.x, y: m.pos.y }; },
        };
        marks.set(h, m);
        return h;
      },
      ...Object.fromEntries(Object.keys(GESTURES).map(name => [name, gesture(name)])),
      show(o = {}) {
        const sl = new Map();
        let ok;
        const list = o.gestures || [];
        if (list.some(g => !made.has(g))) throw new Error("only this mini-game's gesture can be shown");
        // (a gesture of this mini-game that is removed already — its mark done, taken: nothing to show, quietly)
        if (list.some(g => ![...gestures].some(r => r.handle === g))) return { on: () => () => {}, remove() {}, finished: Promise.resolve(false), dead: true };
        const s = { recs: list.map(g => [...gestures].find(r => r.handle === g)), handsOff: !!o.handsOff, going: false };
        const finished = new Promise(r => { ok = r; });
        s.end = done => { if (!shows.delete(s)) return; fire(sl, 'end', { done }); ok(done); };
        // (its parts, once each gesture's points are in the window — the scene says where a point is a frame after it is
        // first asked)
        s.try = () => {
          if (s.recs.some(r => !gestures.has(r))) { s.end(false); return; }
          if (finger !== null) return;
          const parts = s.handsOff ? [{ moves: handsOff() }] : s.recs.map(r => ({ moves: r.g.demo?.(), follow: r.g.follow }));
          if (parts.some(p => !p.moves)) return;
          s.going = true;
          fire(sl, 'start', {});
          ghost.show(parts).then(done => s.end(done));
        };
        shows.add(s);
        return { on: (ev, fn) => listen(sl, ev, fn), remove() { if (s.going) ghost.stop(); else s.end(false); }, finished, get dead() { return s.recs.some(r => !gestures.has(r)); } };
      },
      snap({ at: a } = {}) {
        attempt('done');
        const { mark, point } = place(a);
        feel.play('snap'); feel.buzz(20);
        if (point) { layer.spark(point); lastSnap = point; }
        mark?.do('press');
        mg.glow(null);
      },
      error(reason, { at: a, finger: f = null, chip = true } = {}) {
        const how = REASONS[reason];
        if (!how) throw new Error(`no such error: ${reason}`);
        tried.errors++; attempt(reason);
        const { mark, point, rec } = place(a);
        feel.play(how.sound); if (how.sound !== 'miss') feel.buzz(40);
        debug.error(how.name);
        if (how.ripple && (f || point)) layer.ripple(f || point, { double: reason === 'often' });
        if (how.move) mark?.do(how.move, { toward: f });
        if (rec?.g.fault) rec.g.fault(reason);
        else if (how.flash && point) layer.flash(point);
        if (chip && withPlate) plate.chip();
      },
      glow(id) {
        if (glowing && glowing !== id) highlight(null);
        glowing = id && highlight(id, 'waiting') ? id : null;
        root.classList.toggle('mg-glowing', !!glowing);
        glowNow();
      },
      sceneTurn(on) {
        turn = !!on;
        root.classList.toggle('mg-turn', turn);
        if (withPlate) plate.breathe(turn);
        if (turn) highlight(null); else glowNow();
      },
      async end({ as } = {}) {
        if (!ENDS.includes(as)) throw new Error(`the end: ${ENDS.join(' | ')}`);
        if (gone) return;
        tried.as = as;
        if (withPlate) {
          if (as !== 'loss' && lastSnap) layer.spark(lastSnap);
          feel.play('end', { how: as });
          feel.buzz(as === 'loss' ? 0 : [20, 60, 20, 60, 40]);
          for (const r of [...gestures]) removeGesture(r);
          for (const h of [...marks.keys()]) h.remove();
          await plate.end(as);
        }
        s.leave();
      },
      leave: () => s.leave(),
      sound(role, opts = {}) { feel.play(role, opts); },
      layer(role) {
        const t = feel.tone(role), h = { set({ u = 0, level = 1 } = {}) { t.set(u, level); }, remove() { layers.delete(h); t.stop(); } };
        layers.add(h);
        return h;
      },
      plate: { set(o) { if (!withPlate) throw new Error('this mini-game has no plate'); plate.set(o); } },
    };
    // the ghost's hands off: it comes near the middle, then rises and goes
    const handsOff = () => { const A = layer.allowed(), p = { x: (A.x0 + A.x1) / 2, y: (A.y0 + A.y1) / 2 }; return [{ x: p.x, y: p.y + 40, ms: 0 }, { ...p, ms: 500 }, { x: p.x + 20, y: p.y - 140, ms: 900 }]; };

    const s = {
      emit,
      skip: () => { tried.skipped = true; emit('skip'); },
      // a hold made under a finger already down takes it once the mark is in place and the finger is in its circle
      takeLate(p) {
        for (const r of gestures) {
          if (!r.late) continue;
          const m = r.mark;
          if (!m?.pos || m.el.hidden || m.el.classList.contains('mg-hidden') || m.el.classList.contains('mg-light') || dist(m.pos, p) > r.reach()) continue;
          if (holders.some(h => h.mark !== m)) continue;
          r.late = false;
          m.is('waiting', false);
          holders.push(r);
          r.g.down?.(p); fire(r.listeners, 'down', { x: p.x, y: p.y });
          glowNow();
        }
      },
      resumed() { for (const r of gestures) r.g.resumed?.(); },
      input(type, p) {
        if (gone) return;
        if (type === 'down') {
          if (ghost.showing) ghost.stop();
          emit('down', { x: p.x, y: p.y });
          if (turn) { layer.ripple(p); return; }
          // (a plain choice: a touch off its marks while petals are out only folds them — no miss)
          const folding = !withPlate && root.classList.contains('mg-petals');
          for (const r of [...gestures]) r.g.any?.(p);
          // the gestures of the nearest mark the finger is on; else those anywhere
          let best = null, d = Infinity;
          for (const r of gestures) {
            const m = r.mark;
            // (a light — a beat's sign — takes no touch: a gesture on it only shows)
            if (!m?.pos || m.el.hidden || m.el.classList.contains('mg-hidden') || m.el.classList.contains('mg-light')) continue;
            const k = dist(m.pos, p);
            if (k <= r.reach() && k < d) { d = k; best = m; }
          }
          holders = [...gestures].filter(r => (best ? r.mark === best : !r.mark));
          if (tried.points.length < 100) {
            const f = frame();
            tried.points.push([Math.round((p.x - f.x) / f.w * 1000) / 1000, Math.round((p.y - f.y) / f.h * 1000) / 1000, best ? 2 : holders.length ? 1 : 0, Math.round((now() - began) * 1000)]);
          }
          tried.touches++;
          if (!holders.length) {
            if (folding) return;
            layer.ripple(p);
            let near = null, nd = Infinity;
            for (const [h, m] of marks) if (m.pos && !m.el.classList.contains('mg-hidden') && dist(m.pos, p) < nd) { nd = dist(m.pos, p); near = h; }
            emit('miss', { x: p.x, y: p.y, mark: near });
            return;
          }
          best?.is('waiting', false);
          if (holders.some(r => !r.g.ownTap)) answer(p);
          for (const r of holders) { r.g.down?.(p); fire(r.listeners, 'down', { x: p.x, y: p.y }); }
          glowNow();
          return;
        }
        for (const r of [...holders]) {
          r.g[type]?.(p);
          if (type === 'up') fire(r.listeners, 'up', { x: p.x, y: p.y });
        }
        if (type === 'up') { for (const r of gestures) r.late = false; holders = []; glowNow(); emit('up', { x: p.x, y: p.y }); }
      },
      leave() {
        if (gone) return;
        gone = true;
        attempt('end');
        seen?.say('minigame.end', { phrase, as: tried.as ?? null, ms: Math.round((now() - began) * 1000), attempts: tried.attempts, errors: tried.errors, touches: tried.touches, skipped: tried.skipped });
        signal?.removeEventListener('abort', s.leave);
        cancelAnimationFrame(raf);
        for (const r of [...gestures]) removeGesture(r);
        for (const h of [...marks.keys()]) h.remove();
        for (const h of [...layers]) h.remove();
        for (const sh of [...shows]) sh.end(false);
        if (session === s) {
          ghost.stop(); layer.clear(); plate.close(); highlight(null);
          offPlate?.();
          root.classList.remove('mg-on', 'mg-free', 'mg-petals', 'mg-turn', 'mg-glowing');
          session = null; finger = null; later = []; steady(false);
          debug.gestures(null);
        }
        emit('end');
      },
    };
    let offPlate = null;
    session = s;
    seen?.say('minigame.begin', { phrase, plate: withPlate });
    // (taken away already: begun and left at once)
    if (signal?.aborted) { s.leave(); return mg; }
    signal?.addEventListener('abort', s.leave);
    steady(true);
    root.classList.add('mg-on');
    root.classList.toggle('mg-free', !withPlate);
    if (withPlate) {
      plate.open({ phrase, sample });
      offPlate = onFrame(placePlate); placePlate();
      // (the entering's sound: once the audio may be heard — the page touched before, though not on the veil)
      if (navigator.userActivation?.hasBeenActive) feel.wake().then(() => { if (!gone) feel.play('enter'); });
      else feel.play('enter');
    }
    debug.gestures(() => Object.fromEntries([...gestures].map((r, i) => [`${r.name}${i}`, r.g.state])));
    // each frame: the gestures' going, told; the ghost's showings that wait for their places; the game's frame
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = now(), dt = Math.min(0.1, last === null ? 0 : t - last);
      last = t;
      if (finger !== null && !paused && !away && fingerAt) s.takeLate(fingerAt);
      for (const sh of shows) if (!sh.going) sh.try();
      for (const r of [...gestures]) {
        r.g.tick?.(dt);
        if (gestures.has(r)) fire(r.listeners, 'frame', r.g.state);
      }
      if (!gone) emit('frame', { t: t - began, dt });
      debug.draw();
    };
    raf = requestAnimationFrame(tick);
    return mg;
  }

  return {
    start,
    relative(p, a, b) {
      const A = where(a), B = where(b);
      if (!A || !B) return null;
      const dx = B.x - A.x, dy = B.y - A.y, l2 = dx * dx + dy * dy || 1;
      return { u: ((p.x - A.x) * dx + (p.y - A.y) * dy) / l2, v: ((p.x - A.x) * dy - (p.y - A.y) * dx) / l2 };
    },
    style(s = {}) {
      feel.style(s); // (first: a key not known — an error, the look left as it was)
      const c = s.colors || {};
      for (const k of ['mark', 'fill', 'good', 'danger', 'fork', 'ghost']) root.style.setProperty(`--mg-${k}`, c[k] || '');
      root.style.setProperty('--mg-line', s.line ? `${s.line}px` : '');
      root.style.setProperty('--mg-font', s.font || '');
    },
    sounds: {
      list: () => feel.heard(),
      play(event) { const [name, how] = event.split(':'); feel.wake().then(() => feel.play(name, how ? { how } : {})); },
      // (set before the audio may be heard: set again once it may)
      tone(role) {
        const t = feel.tone(role);
        let last = null;
        feel.wake().then(() => { if (last) t.set(...last); });
        return { set({ u = 0, level = 1 } = {}) { last = [u, level]; t.set(u, level); }, remove() { last = null; t.stop(); } };
      },
    },
    settings({ sound, debug: on } = {}) {
      if (sound !== undefined) feel.mute(!sound);
      if (on !== undefined) debug.on(on);
    },
    pause(on) {
      const was = paused || away;
      paused = !!on;
      root.classList.toggle('mg-paused', paused);
      stand(was);
    },
    // the player's skip, asked by the game's own ⏭: the going mini-game is told (false: none going)
    skip() { if (!session) return false; session.skip(); return true; },
    // the game broke off (an exception it did not catch): the mini-game is left — the scene answers again
    abandon() { session?.leave(); },
  };
}

// The debug (the author's tool): the touches' circles (as large as a touch counts), the finger's path, the window and
// where marks may stand, the gestures' numbers, the last error's reason, how long from a touch to the page's answer.
function createDebug(root, layer) {
  const c = el('canvas', 'mg-debug', root), g = c.getContext('2d');
  const text = el('pre', 'mg-debug-text', root);
  c.hidden = text.hidden = true;
  let on = false, touches = [], trail = [], states = null, error = '', latency = null;
  const real = window.__mooodClock || (() => performance.now());
  const nativeFrame = window.__mooodTimers?.requestAnimationFrame || requestAnimationFrame;
  const show = v => (typeof v === 'number' ? +v.toFixed(3) : v && typeof v === 'object' && 'x' in v ? `${Math.round(v.x)},${Math.round(v.y)}` : JSON.stringify(v));
  return {
    on(v) { on = !!v; c.hidden = text.hidden = !on; },
    touch(p, stamp) {
      if (!on) return;
      touches.push({ ...p, t: real() });
      trail = [p];
      // (from the touch to the frame that shows its answer: the page's display frame after the handlers ran)
      nativeFrame(() => { latency = Math.max(0, real() - stamp); });
    },
    trail(p) { if (on) { trail.push(p); if (trail.length > 200) trail.shift(); } },
    error(name) { error = name; },
    gestures(fn) { states = fn; },
    draw() {
      if (!on) return;
      const dpr = devicePixelRatio || 1, w = innerWidth, h = innerHeight;
      if (c.width !== w * dpr || c.height !== h * dpr) { c.width = w * dpr; c.height = h * dpr; }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const A = layer.allowed(), W = A.W;
      g.strokeStyle = 'rgba(120,200,255,0.6)'; g.lineWidth = 1;
      g.strokeRect(W.x, W.y, W.w, W.h);
      g.setLineDash([4, 4]); g.strokeRect(A.x0, A.y0, A.x1 - A.x0, A.y1 - A.y0); g.setLineDash([]);
      const now = real();
      touches = touches.filter(t => now - t.t < 1500);
      for (const t of touches) { g.strokeStyle = `rgba(255,120,120,${1 - (now - t.t) / 1500})`; g.beginPath(); g.arc(t.x, t.y, 32 * layer.k(), 0, 2 * Math.PI); g.stroke(); }
      if (trail.length > 1) { g.strokeStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); trail.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke(); }
      const s = states?.() || {};
      text.textContent = [
        ...Object.entries(s).map(([k, v]) => `${k}: ${Object.entries(v || {}).map(([a, b]) => `${a} ${show(b)}`).join(' · ')}`),
        `error: ${error || '—'}`,
        `response: ${latency == null ? '—' : `${latency.toFixed(1)} ms`}`,
      ].join('\n');
    },
  };
}
