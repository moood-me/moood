// The gestures of the language (docs/games/miniux/language.md §4): recognisers of the hand, on a mark or anywhere. Each
// reports every frame what the hand does (its state; index.js sends it to the game as 'frame') and its own events, and
// shows its own physics (the fill grows, the way lightens, the trail follows the finger) — never what it means: done,
// wrong, what next is the game's. Nothing is done by itself: no snapping to a target, no jump to the end (П36, П37).
// What a gesture is (index.js runs it): GESTURES[name](ctx, o) → {mark, reach, state, down(p), move(p), up(p),
// tick(dt, t), any(p), set(o), demo(), follow(p, down), fault(reason), resumed(), remove(), ownTap}:
//   ctx — {layer, feel, mark (the mark it is on, layer.js's; null — anywhere), emit(event, data), tap(p) — a touch
//     answered (the ring round the finger, the knock, a short buzz)}
//   mark/reach — a touch within reach px (the language's: × layer.k()) of its mark is its — none given: the mark's
//   touch circle, wider than it is drawn (touchRadius) —, on no mark a gesture anywhere takes it; state — what it
//   reports, live; any(p) — every touch on the screen; demo() → the ghost's moves (null: no place yet); follow — the
//   ghost's finger, each frame of its showing; fault(reason) — an error the game names, shown its own way; ownTap —
//   it answers a touch by its own sound
// What a game passes and gets (o — its options, also changed later by set; events besides 'down', 'up', 'frame'):
//   press({on, petals: [{id, label}]}) — state {count, open}; no petals: 'press' {count} on each touch (the touch is
//     the action); petals (1–4 — a plain choice has them always, one too: what a touch means seen in words): the touch
//     opens them round the mark, 'choose' {id} — a petal touched and let go (the finger moved ≤ 10 px), or the finger
//     led from the mark onto one and let go there; a touch elsewhere closes them, and so does the mark gone from sight
//     — 'fold' (closed with none chosen). open: true — born open: its petals out at once, as if just touched (the
//     touch answered: the ring of light, the knock), once its mark stands in the frame — a game's own drawing pressed
//     there (games.md §2); folded, the game takes the mark away
//   hold({on | null, seconds: 1.2, drain: 0.5, show}) — state {held, fill, moved, at}: fill grows while held (to full
//     in seconds), let go it ebbs (empty in drain seconds from full; drain 0 — it stands); moved — px the finger has gone
//     from where it pressed; at — where it is. on null: anywhere — under the finger only a dot; show — the mark its fill is drawn on (the
//     thing's; default its own). set({fill}) — the game's fill (an error dropped it)
//   pull({on, to | targets | tear, release: 'stay' | 'spring', heavy}) — the thing in the hand from the first frame:
//     to: a ref — along the way to it: state {held, u, inTarget, shown (where the ghost has it while it shows it, else
//     null)}, 'release' {u, inTarget}; heavy — it comes only while
//     the finger pulls ahead of it (the tension seen), and home while the finger holds in the target; spring — let go, it goes back, seen. targets: [ref | {at, closed}]
//     — free, to any: state {held, at (page px, where the thing is while held), target (index of the one it is in, −1)},
//     'release' {target, at} — then its mark is back at its own place, where the game draws the thing again (the
//     ghost carrying it lets it go so too: target −1). tear: a
//     share of the window's height — no target: state {held, u (pulled / tear)}, 'tear' once a pull reaches it. The way
//     and the targets are seen only while it is pulled (§4.3, П39). set({u}) — where along the way it is (the game's)
//   (radii and tolerances below are the language's px — they grow with the frame as the marks do: layer.js REF)
//   trace({on, line: [refs], tolerance: 48, seconds}) — along the line, from its start; let go and go on from where it
//     was: state {u, tracing, seconds (how long the ghost's stroke along the whole line takes now)}, 'off' — the finger
//     left the line (its head flashes). seconds — the ghost draws the whole line in them, at an even pace (1 / seconds
//     of the line a second: a game's own "too quick" reads the same number); none — a px a ms (a line over 2000 px in
//     2 s), each piece 0.4 s at least, eased in and out of each
//   turn({on, dir: 1 | −1, radius: 66}) — round the mark: state {turns (signed, the arrow's way +), most (the farthest
//     the arrow's way)}, 'quarter' {n} — each new quarter (a click), 'against' — turned against the arrow (it flashes)
//   rub({on, radius: 60, full: 0.85}) — over the spot: state {u (covered / full), at}; the spot shrinks with it
//   seek({on, places: [refs], radius: 150, near: 36, hold: 0.8}) — pressed over the area, a lens under the finger:
//     state {at, place (index of the nearest place), warm (0…1 — how near it), fill (held within near px of a place:
//     full in hold seconds)}; the lens warms and fills
//   rhythm({on | null, show: [marks], bpm | times: [s…], from, strong: 4, window: 0.15, breath}) — the beats: every
//     60/bpm s from `from` (one beat after it starts) or at the moments `times` (seconds of its own clock: state.t); a
//     ring on each `show` mark (default its own) closes to its edge on the beat, a light mark grows toward it. state
//     {t, k (the beat last come), held, breath ('in' | 'out')}; 'beat' {k, strong}; 'tap' {k (the nearest beat), off
//     (s: − early, + late), hit (|off| ≤ window: a flash and the beat's sound; else a speck before or after the
//     edge)}. breath: the ring grows a beat (hold) and falls a beat (let go). After a pause: three ticks counted in,
//     then the beats go on where they were. set({bpm | times}) — changed on the way
//   lead({zone: {at, width}, away, steer: 'follow' | 'rate', release: 'return' | 'stay', push, from, to}) — pressed anywhere,
//     led sideways (a track with a knob under the finger; without it the track rests, quieter, where it was last laid
//     — at first in the middle —: seen while the gesture lasts): the arrow (−1…1) follows the finger's offset (rate: it is
//     steered — turned by it, and by push, a rate the game sets); without the finger it returns or stays. state {held,
//     knob (the finger's offset on the track, −1…1), arrow, in (in the zone, or away: out of it), jerk (how sharp the
//     finger's last move, 0…)}; the ghost leading shows the track under it and the knob going with it (the arrow
//     not moved). from, to (together; refs or fns as a mark's at): the track lies from `from` (−1) to `to` (1), going
//     with the points each frame, hidden while one is unseen; pressed anywhere, the knob starts in its middle and goes
//     with the finger's offset along it (half the segment — 1)
//   touch({on | null}) — the touch as it is, no recognition: state {down, x, y}; 'down', 'move', 'up' {x, y}; a ripple
//     and the knock on each touch
import { clamp, dist, el } from './layer.js';

export const HIT = 32; // the language's px: a touch counts within a circle of 64 at least (§2.1)
export const SLACK = 1.4; // a mark's touch circle — this much wider than it is drawn (a finger lands beside what it aims at)
// where a touch on a mark counts (the language's px): its drawn radius and some, never under HIT
export const touchRadius = base => Math.max(HIT, (base / 2) * SLACK);
const hit = layer => HIT * layer.k();
// the ghost's moves: coming to a point from below right, pressing it (a beat held: the press seen), letting go — slow
// enough to be read the first time (the language's demos are to be watched, not glimpsed)
const APPROACH = 650, DWELL = 350, LIFT = 150;
const near = (p, layer) => ({ x: p.x + 80 * layer.k(), y: p.y + 70 * layer.k(), ms: 0 });
const press = (p, holdMs = 350) => [{ ...p, ms: APPROACH }, { ...p, down: true, ms: 120 }, { ...p, down: true, ms: holdMs }, { ...p, ms: LIFT }];
const centre = layer => { const A = layer.allowed(); return { x: (A.x0 + A.x1) / 2, y: (A.y0 + A.y1) / 2 }; };
const refs = list => list.map(t => (typeof t === 'string' ? { at: t, closed: false } : { closed: false, ...t }));

export const GESTURES = {
  // ── 4.1 press ──
  press(ctx, o) {
    const { mark, layer } = ctx, state = { count: 0, open: false };
    let petals = null, from = null, downAt = null;
    const over = p => petals?.at.findIndex(q => q && dist(q, p) < 34) ?? -1;
    const choose = i => { const id = o.petals[i].id; close(); ctx.emit('choose', { id }); };
    // (folded: closed with none chosen — a touch off them, the mark gone from sight)
    const close = (folded = false) => {
      if (!petals) return;
      petals.off(); petals.els.forEach(e => e.remove()); petals = null; state.open = false; mark.is('open', false);
      if (folded) ctx.emit('fold');
    };
    const open = () => {
      state.open = true; mark.is('open');
      const els = (o.petals || []).map(a => { const b = el('button', 'mg-petal', layer.host); b.type = 'button'; b.textContent = a.label; b.tabIndex = -1; return b; });
      // (over the mark, side by side with a gap between them, the outer ones lower — an arc; none over the mark's ring;
      // the row kept within where marks may stand)
      const placeAll = () => {
        // (the mark gone from sight — its point out of the frame, the mark hidden: its words go with it)
        if (!mark.pos || mark.el.classList.contains('mg-hidden')) { close(true); return; }
        const GAP = 12, ws = els.map(b => b.offsetWidth), h = Math.max(...els.map(b => b.offsetHeight));
        const all = ws.reduce((a, w) => a + w, 0) + GAP * (els.length - 1), ring = mark.size / 2;
        const A = layer.allowed();
        let x = mark.pos.x - all / 2;
        x += Math.max(0, A.x0 - x) - Math.max(0, x + all - A.x1);
        const top = Math.max(A.y0, mark.pos.y - ring - 14 - h / 2);
        els.forEach((b, i) => {
          const cx = x + ws[i] / 2, clear = Math.abs(cx - mark.pos.x) - ws[i] / 2 - ring - 8;
          const q = { x: cx, y: top + Math.max(0, clear) * 0.35 };
          b.style.translate = `${Math.round(q.x)}px ${Math.round(q.y)}px`;
          petals.at[i] = q;
          x += ws[i] + GAP;
        });
      };
      els.forEach((b, i) => {
        b.addEventListener('pointerdown', e => { e.stopPropagation(); from = { x: e.clientX, y: e.clientY }; ctx.tap(from); });
        b.addEventListener('pointerup', e => {
          e.stopPropagation();
          if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) <= 10) choose(i);
          from = null;
        });
      });
      petals = { els, at: [], off: layer.onPlace(placeAll) };
      placeAll();
      els.forEach((b, i) => b.animate([{ opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1 }], { duration: 180, delay: i * 40, easing: 'ease-out', fill: 'backwards' }));
    };
    // (born open: the petals out as soon as the mark stands in the frame, the touch that opened them answered there)
    let unborn = null;
    if (o.open && o.petals?.length) {
      const born = () => {
        if (petals || !mark.pos || mark.el.classList.contains('mg-hidden')) return;
        unborn?.(); unborn = null;
        mark.is('waiting', false);
        ctx.feel.wake(); // (the page's own touch opened it: it may be heard from now)
        ctx.tap(mark.pos);
        open();
      };
      unborn = layer.onPlace(born);
      born();
    }
    return {
      mark, state,
      demo: () => mark.pos && [near(mark.pos, layer), ...press(mark.pos)],
      down(p) {
        downAt = p;
        mark.do('press');
        if (o.petals?.length) { if (!petals) open(); return; }
        state.count++;
        ctx.emit('press', { count: state.count });
      },
      up(p) { const i = over(p); if (i >= 0 && downAt && dist(downAt, p) > 10) choose(i); downAt = null; },
      any(p) { if (petals && !(mark.pos && dist(mark.pos, p) <= touchRadius(mark.base) * layer.k())) close(true); },
      set(n) { if (n.petals && petals) close(); },
      remove() { unborn?.(); close(); },
    };
  },

  // ── 4.2 hold ──
  hold(ctx, o) {
    const { layer, feel } = ctx, state = { held: false, fill: 0, moved: 0, at: null };
    let dot = null, from = null, tone = null;
    const shown = () => o.show || ctx.mark;
    return {
      mark: ctx.mark, state,
      demo() {
        const m = ctx.mark ? ctx.mark.pos : shown()?.pos || centre(layer);
        return m && [near(m, layer), { ...m, ms: APPROACH }, { ...m, down: true, ms: 120 }, { ...m, down: true, ms: (o.seconds ?? 1.2) * 1000 + DWELL }, { ...m, ms: LIFT }];
      },
      down(p) {
        if (state.held) return;
        if (!ctx.mark) { const at = layer.fit(p); dot = layer.mark({ at: () => at, kind: 'ring', size: 48 }); dot.is('dot'); }
        state.held = true; from = state.at = p; state.moved = 0;
        const m = ctx.mark || dot;
        m.do('press'); m.is('held');
        tone = feel.tone('fill');
      },
      move(p) { if (state.held) { state.at = p; state.moved = dist(p, from); } },
      up() {
        if (!state.held) return;
        state.held = false; state.at = null; tone?.stop(); tone = null;
        ctx.mark?.is('held', false); ctx.mark?.do('release');
        dot?.remove(); dot = null;
      },
      tick(dt) {
        const drain = o.drain ?? 0.5;
        if (state.held) state.fill = clamp(state.fill + dt / (o.seconds ?? 1.2));
        else if (drain) state.fill = clamp(state.fill - dt / drain);
        tone?.set(state.fill);
        shown()?.fill(state.fill);
      },
      set(n) { if (n.fill != null) state.fill = clamp(n.fill); },
      remove() { tone?.stop(); dot?.remove(); shown()?.fill(0); },
    };
  },

  // ── 4.3 pull ──
  pull(ctx, o) {
    if (o.targets) return carry(ctx, o);
    const { mark, layer, feel } = ctx, tear = o.tear != null, state = tear ? { held: false, u: 0 } : { held: false, u: 0, inTarget: false, shown: null };
    if (!tear && !o.to) throw new Error('pull: to, targets or tear');
    const T = () => (o.to ? layer.point(o.to) : null);
    let s0 = null; // where the thing starts: its own place as it is first taken (the finger's or the ghost's) — till then,
    // where the scene has it now (a scene says a point a frame after it changes: never one cached before it is taken)
    let from = null, finger = null, grabbed = null, back = 0, tone = null, torn = false;
    // the ghost's showing (§2.4): the thing goes with it while it is pressed, then back, seen, to where it is
    let shown = null, toward = false, grip = null, ghostTear = null; // ghostTear: [where the ghost pressed, where it is]
    const start = () => s0 ?? own();
    const take = () => { s0 ??= own(); };
    const way = () => { const a = start(), b = T(); return a && b ? { a, b, len: Math.max(1, dist(a, b)) } : null; };
    const along = p => { const w = way(); return w ? ((p.x - w.a.x) * (w.b.x - w.a.x) + (p.y - w.a.y) * (w.b.y - w.a.y)) / (w.len * w.len) : 0; };
    const own = mark.own;
    const thingAt = () => {
      if (tear) {
        const f = state.held && finger ? [from, finger] : ghostTear;
        return f && s0 ? { x: s0.x + (f[1].x - f[0].x) * 0.5, y: s0.y + (f[1].y - f[0].y) * 0.5 } : own();
      }
      const w = way(), v = shown ?? state.u;
      return w ? { x: w.a.x + (w.b.x - w.a.x) * v, y: w.a.y + (w.b.y - w.a.y) * v } : own();
    };
    mark.follow(thingAt);
    const line = tear ? null : layer.svg('line', { class: 'mg-way' });
    const tension = o.heavy ? layer.svg('line', { class: 'mg-tension' }) : null;
    const target = tear ? null : layer.mark({ at: o.to, kind: 'ring' });
    target?.is('target');
    // the way and the target: seen only while the thing is pulled
    const seen = on => { target?.is('hidden', !on); for (const e of [line, tension]) if (e) e.style.display = on ? '' : 'none'; };
    seen(false);
    const inTarget = () => { const t = T(), m = thingAt(); return !!t && !!m && dist(t, m) <= hit(layer); };
    const placed = () => {
      const w = way();
      if (line && w) { line.setAttribute('x1', w.a.x); line.setAttribute('y1', w.a.y); line.setAttribute('x2', w.b.x); line.setAttribute('y2', w.b.y); }
      if (tension) {
        const m = thingAt(), f = state.held && finger ? finger : m;
        if (m) { tension.setAttribute('x1', m.x); tension.setAttribute('y1', m.y); tension.setAttribute('x2', f.x); tension.setAttribute('y2', f.y); }
      }
      if (target) { state.inTarget = inTarget(); target.is('reached', state.inTarget); }
    };
    const off = layer.onPlace(placed);
    return {
      mark, state,
      demo() {
        const a = mark.pos;
        if (!a) return null;
        // (a tear: pulled well past where it tears — a long pull, seen; up and aside, kept where marks may stand)
        let b = T();
        if (tear) {
          const h = layer.window().h, d = Math.max(0.2, 1.2 * (o.tear || 0.05)) * h, A = layer.allowed();
          b = { x: clamp(a.x + d * 0.6, A.x0, A.x1), y: clamp(a.y - d * 0.8, A.y0, A.y1) };
        }
        return b && [near(a, layer), { ...a, ms: APPROACH }, { ...a, down: true, ms: 120 }, { ...a, down: true, ms: DWELL }, { ...b, down: true, ms: o.heavy ? 2400 : 1500 }, { ...b, down: true, ms: 500 }, { ...b, ms: LIFT }];
      },
      // (the ghost pulls: the thing goes with it — and when it lets go, the thing goes back to where it is, seen; a
      // tear: its mark goes with it as with a finger, and is back once it lets go)
      follow: tear ? (p, down) => {
        if (state.held) return;
        if (!p || !down) { if (ghostTear) { ghostTear = null; layer.place(); } return; }
        if (!ghostTear) { s0 = own(); ghostTear = [p, p]; }
        ghostTear[1] = p; layer.place();
      } : (p, down) => {
        if (!p || !down) { if (shown !== null) toward = true; grip = null; return; }
        take();
        grip ??= along(p) - state.u;
        shown = clamp(along(p) - grip); toward = false;
        seen(true); layer.place();
      },
      down(p) {
        if (shown !== null) { shown = null; toward = false; seen(false); }
        ghostTear = null;
        if (tear) s0 = own(); else take();
        state.held = true; from = finger = p; grabbed = { u: state.u, along: along(p) }; torn = false;
        mark.do('press'); mark.is('held');
        tone = feel.tone('motion');
        seen(true); layer.place();
      },
      move(p) {
        if (!state.held) return;
        tone?.set(state.u, clamp(dist(p, finger) / 20));
        finger = p;
        if (tear) {
          state.u = clamp(dist(p, from) / ((o.tear || 0.05) * layer.window().h));
          if (state.u >= 1 && !torn) { torn = true; ctx.emit('tear', {}); }
        } else if (!o.heavy) state.u = clamp(grabbed.u + along(p) - grabbed.along);
        layer.place();
      },
      up() {
        if (!state.held) return;
        state.held = false; finger = null; tone?.stop(); tone = null;
        mark.is('held', false); mark.do('release');
        if (tear) { state.u = 0; layer.place(); return; }
        placed();
        ctx.emit('release', { u: state.u, inTarget: state.inTarget });
        back = Math.max(0.5, state.u / 0.7);
        seen(false);
      },
      tick(dt) {
        if (tear) return;
        if (o.heavy) {
          // ahead of the thing along the way, the finger pulls; the thing comes while the pull is strong enough — and
          // all the way home while the finger holds in the target (no 60 px past it to drag)
          // (in the language's px: as heavy on a large screen as on a small one)
          const w = way(), ahead = state.held && finger && w ? (along(finger) - state.u) * w.len / layer.k() : 0;
          const home = state.held && finger && T() && dist(finger, T()) <= hit(layer) && state.u < 1;
          const pull = home ? Math.max(ahead - 60, 105) : ahead - 60;
          if (pull > 0) state.u = clamp(state.u + Math.min(0.35, pull / 300) * dt);
          tension?.style.setProperty('--k', clamp(pull / 160));
        }
        if (o.release === 'spring' && !state.held) state.u = clamp(state.u - back * dt);
        // (the ghost let go: what it showed goes back to where the thing is, seen)
        if (toward) { shown = Math.abs(shown - state.u) <= 0.8 * dt ? null : shown + Math.sign(state.u - shown) * 0.8 * dt; if (shown === null) { toward = false; seen(state.held); } }
        state.shown = shown;
        placed();
      },
      fault(reason) { if (reason === 'wrong') target?.do('shake'); },
      set(n) { if (n.u != null) state.u = clamp(n.u); },
      remove() { off(); line?.remove(); tension?.remove(); target?.remove(); tone?.stop(); mark.follow(null); },
    };
  },

  // ── 4.4 trace ──
  trace(ctx, o) {
    const { mark, layer, feel } = ctx, state = { u: 0, tracing: false, seconds: 0 };
    const tol = () => (o.tolerance ?? 48) * layer.k();
    let pts = [], lens = [], L = 1, s = 0, last = null, tone = null;
    // the ghost's ms over each piece of the line: the game's seconds shared by length; none — along the line at a pace
    // one follows with the eye: a px a ms, a long line in some 2 s; each piece 0.4 s at least
    const pieces = (sec = o.seconds) => pts.slice(1).map((_, i) => {
      const l = lens[i + 1] - lens[i];
      return sec ? (sec * 1000 * l) / L : Math.max(400, l / Math.max(1, L / 2000));
    });
    const timed = sec => { state.seconds = pieces(sec).reduce((a, b) => a + b, 0) / 1000; };
    const measure = () => {
      pts = o.line.map(r => layer.point(r)).filter(Boolean);
      lens = [0];
      for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + dist(pts[i - 1], pts[i]));
      L = Math.max(1, lens[lens.length - 1] || 1);
      timed();
    };
    const pointAt = d => {
      if (!pts.length) return null;
      let i = 1; while (i < pts.length - 1 && lens[i] < d) i++;
      const a = pts[i - 1], b = pts[i] || a, k = clamp((d - lens[i - 1]) / Math.max(1, lens[i] - lens[i - 1]));
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    };
    // the nearest place of the line to p, not far ahead of where the trace has got: {d: along, gap: px from it}
    const nearest = p => {
      let best = null;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], l = Math.max(1, lens[i] - lens[i - 1]);
        const k = clamp(((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (l * l));
        const d = lens[i - 1] + k * l, gap = dist(p, { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
        if (d < s - 30 * layer.k() || d > s + 140 * layer.k()) continue;
        if (!best || gap < best.gap) best = { d, gap };
      }
      return best;
    };
    measure();
    const base = layer.svg('polyline', { class: 'mg-line' }), done = layer.svg('polyline', { class: 'mg-line-done' });
    mark.follow(() => pointAt(s));
    const placed = () => {
      measure();
      const str = pts.map(p => `${p.x},${p.y}`).join(' ');
      base.setAttribute('points', str); done.setAttribute('points', str);
      done.style.strokeDasharray = `${s} ${L + 10}`;
    };
    const off = layer.onPlace(placed);
    placed();
    const stop = () => { state.tracing = false; tone?.stop(); tone = null; };
    return {
      mark, reach: o.tolerance ?? 48, state,
      demo() {
        if (pts.length < 2) return null;
        const a = pts[0], z = pts[pts.length - 1];
        const ms = pieces(), even = !!o.seconds;
        return [near(a, layer), { ...a, ms: APPROACH }, { ...a, down: true, ms: 120 }, { ...a, down: true, ms: DWELL }, ...pts.slice(1).map((p, i) => ({ ...p, down: true, ms: ms[i], even })), { ...z, down: true, ms: 300 }, { ...z, ms: LIFT }];
      },
      down(p) { state.tracing = true; last = p; mark.do('press'); tone = feel.tone('motion'); },
      move(p) {
        if (!state.tracing) return;
        const n = nearest(p);
        tone?.set(s / L, clamp(dist(p, last) / 30));
        last = p;
        if (n && n.gap <= tol()) { s = Math.max(s, Math.min(L, n.d)); state.u = s / L; placed(); return; }
        // off the line: the trail stops; where to come back flashes
        stop();
        const head = pointAt(s);
        if (head) layer.flash(head);
        ctx.emit('off', {});
      },
      up() { stop(); mark.do('release'); },
      fault(reason) { const head = pointAt(s); if (reason === 'off' && head) layer.flash(head); },
      set(n) { if ('seconds' in n) timed(n.seconds); },
      remove() { off(); base.remove(); done.remove(); tone?.stop(); mark.follow(null); },
    };
  },

  // ── 4.5 turn ──
  turn(ctx, o) {
    const { mark, layer, feel } = ctx, state = { turns: 0, most: 0 };
    const R0 = o.radius ?? 66, Rk = () => R0 * layer.k();
    const dir = () => (o.dir === -1 ? -1 : 1);
    const circle = layer.svg('circle', { class: 'mg-circle', r: R0 }), arrow = layer.svg('path', { class: 'mg-arrow' });
    let angle = 0, against = 0, a0 = null, turning = false, quarters = 0;
    const placed = () => {
      const c = mark.pos; if (!c) return;
      const R = Rk(), k = layer.k();
      circle.setAttribute('cx', c.x); circle.setAttribute('cy', c.y); circle.setAttribute('r', R);
      // the arrow's head at the top of the circle, the way to turn, going round with what is turned
      const x = c.x, y = c.y - R, d = dir();
      arrow.setAttribute('d', `M${x - d * 9 * k} ${y - 8 * k} L${x + d * 3 * k} ${y} L${x - d * 9 * k} ${y + 8 * k}`);
      arrow.setAttribute('transform', `rotate(${(angle * d * 180) / Math.PI} ${c.x} ${c.y})`);
    };
    const off = layer.onPlace(placed);
    placed();
    const flash = () => arrow.animate([{ strokeWidth: '3px', opacity: 1 }, { strokeWidth: '8px', opacity: 1 }, { strokeWidth: '3px' }], { duration: 300 });
    const step = delta => {
      const way = delta * dir();
      angle += way;
      state.turns = angle / (2 * Math.PI); state.most = Math.max(state.most, state.turns);
      if (way > 0) {
        against = 0;
        const q = Math.floor(state.most * 4);
        if (q > quarters) { quarters = q; feel.play('quarter'); ctx.emit('quarter', { n: q }); }
      } else if ((against -= way) > 0.6) { against = 0; flash(); ctx.emit('against', {}); }
      placed();
    };
    return {
      mark, reach: R0 * 1.8, state,
      demo() {
        const c = mark.pos; if (!c) return null;
        const R = Rk(), r = R * 0.8, moves = [near({ x: c.x + R, y: c.y }, layer), { x: c.x + r, y: c.y, ms: APPROACH }, { x: c.x + r, y: c.y, down: true, ms: 120 }, { x: c.x + r, y: c.y, down: true, ms: DWELL }];
        for (let k = 1; k <= 8; k++) { const a = dir() * k * Math.PI / 4; moves.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r, down: true, ms: 220 }); }
        moves.push({ x: c.x + r, y: c.y, down: true, ms: 250 }, { x: c.x + r, y: c.y, ms: LIFT });
        return moves;
      },
      down(p) { turning = true; a0 = mark.pos && dist(p, mark.pos) > 12 * layer.k() ? Math.atan2(p.y - mark.pos.y, p.x - mark.pos.x) : null; },
      move(p) {
        if (!turning || !mark.pos || dist(p, mark.pos) < 12 * layer.k()) return;
        const a = Math.atan2(p.y - mark.pos.y, p.x - mark.pos.x);
        if (a0 !== null) { let d = a - a0; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; step(d); }
        a0 = a;
      },
      up() { turning = false; a0 = null; },
      fault(reason) { if (reason === 'against') flash(); },
      remove() { off(); circle.remove(); arrow.remove(); },
    };
  },

  // ── 4.6 rub ──
  rub(ctx, o) {
    const { mark, layer, feel } = ctx, R = o.radius ?? 60, BRUSH = 26, state = { u: 0, at: null };
    // the spot's cells (relative to its middle, the language's px): each covered once the finger has passed over it
    const cells = [];
    for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) { const x = i * R / 5.5, y = j * R / 5.5; if (Math.hypot(x, y) <= R) cells.push({ x, y, done: false }); }
    let covered = 0, tone = null;
    const cover = (a, b) => {
      const c = mark.pos; if (!c) return;
      const K = layer.k(), n = Math.max(1, Math.ceil(dist(a, b) / (8 * K)));
      for (let k = 0; k <= n; k++) {
        const x = (a.x + (b.x - a.x) * k / n - c.x) / K, y = (a.y + (b.y - a.y) * k / n - c.y) / K;
        for (const cell of cells) if (!cell.done && Math.hypot(cell.x - x, cell.y - y) <= BRUSH) { cell.done = true; covered++; }
      }
      state.u = clamp(covered / (cells.length * (o.full ?? 0.85)));
      mark.el.style.setProperty('--shrink', 1 - 0.55 * state.u);
    };
    return {
      mark, reach: R, state,
      demo() {
        const c = mark.pos; if (!c) return null;
        const r = R * layer.k(), moves = [near(c, layer), { x: c.x - r * 0.6, y: c.y - r * 0.4, ms: APPROACH }, { x: c.x - r * 0.6, y: c.y - r * 0.4, down: true, ms: 120 }];
        for (let k = 0; k < 6; k++) moves.push({ x: c.x + (k % 2 ? -0.6 : 0.6) * r, y: c.y - r * 0.4 + k * r * 0.16, down: true, ms: 260 });
        moves.push({ x: c.x, y: c.y + r * 0.4, ms: LIFT });
        return moves;
      },
      down(p) { state.at = p; tone = feel.tone('motion'); cover(p, p); },
      move(p) { if (!state.at) return; tone?.set(state.u, clamp(dist(p, state.at) / (25 * layer.k()))); cover(state.at, p); state.at = p; },
      up() { state.at = null; tone?.stop(); tone = null; },
      remove() { tone?.stop(); mark.el.style.removeProperty('--shrink'); },
    };
  },

  // ── 4.7 seek ──
  seek(ctx, o) {
    const { mark, layer, feel } = ctx, R = o.radius ?? 150, state = { at: null, place: -1, warm: 0, fill: 0 };
    const Rk = () => R * layer.k();
    const lens = el('div', 'mg-lens', layer.host);
    lens.hidden = true;
    let tone = null;
    return {
      mark, reach: R, state,
      demo() {
        // (round the area — never to what is sought)
        const c = mark.pos; if (!c) return null;
        const r = Rk(), moves = [near(c, layer), { x: c.x - r * 0.5, y: c.y, ms: APPROACH }, { x: c.x - r * 0.5, y: c.y, down: true, ms: 120 }];
        for (let k = 1; k <= 6; k++) { const a = Math.PI + k * Math.PI / 3; moves.push({ x: c.x + Math.cos(a) * r * 0.5, y: c.y + Math.sin(a) * r * 0.35, down: true, ms: 380 }); }
        moves.push({ x: c.x - r * 0.5, y: c.y, ms: LIFT });
        return moves;
      },
      down(p) { state.at = p; lens.hidden = false; tone = feel.tone('seek'); },
      move(p) { if (state.at) state.at = p; },
      up() { state.at = null; lens.hidden = true; tone?.stop(); tone = null; },
      tick(dt) {
        const places = (o.places || []).map(r => layer.point(r));
        let best = -1, d = Infinity;
        if (state.at) places.forEach((q, i) => { if (q && dist(state.at, q) < d) { d = dist(state.at, q); best = i; } });
        state.place = best;
        state.warm = best < 0 ? 0 : clamp(1 - d / (Rk() * 1.2));
        state.fill = best >= 0 && d <= (o.near ?? 36) * layer.k() ? clamp(state.fill + dt / (o.hold ?? 0.8)) : clamp(state.fill - dt / 0.4);
        if (!state.at) return;
        lens.style.transform = `translate(${state.at.x}px, ${state.at.y}px)`;
        lens.style.setProperty('--warm', state.warm);
        lens.style.setProperty('--u', state.fill);
        tone?.set(state.warm);
      },
      remove() { lens.remove(); tone?.stop(); },
    };
  },

  // ── 4.8 rhythm ──
  rhythm(ctx, o) {
    const { layer, feel } = ctx, state = { t: 0, k: -1, held: false, breath: 'out' };
    const shows = (o.show || [ctx.mark]).filter(Boolean);
    const rings = shows.filter(m => !m.el.classList.contains('mg-light')).map(m => { m.is('beat'); return { m, ring: el('i', 'mg-closing', m.body) }; });
    const lights = shows.filter(m => m.el.classList.contains('mg-light'));
    const window_ = () => o.window ?? 0.15;
    const period = () => 60 / (o.bpm || 90);
    // the beats: a grid (bpm, from), or the moments given; shift — how much later all of them come (a count-in)
    let shift = 0, grid0 = o.from ?? period(), ticks = [], prev = 0; // prev: when the beat last came (or the beats were set)
    const beatAt = k => (o.times ? (o.times[k] ?? Infinity) : grid0 + k * period()) + shift;
    // the beat nearest a moment, and the next one after it
    const nearest = t => {
      if (!o.times) return Math.max(0, Math.round((t - shift - grid0) / period()));
      let best = 0;
      o.times.forEach((x, k) => { if (Math.abs(x + shift - t) < Math.abs(beatAt(best) - t)) best = k; });
      return best;
    };
    const next = t => { let k = Math.max(0, state.k); while (beatAt(k) <= t) k++; return k; };
    const flashAll = () => { for (const m of shows) m.body.animate([{ filter: 'brightness(2.2)' }, { filter: 'none' }], { duration: 220 }); };
    return {
      mark: ctx.mark, state, ownTap: true,
      demo() {
        const q = (ctx.mark || shows[0])?.pos;
        if (!q) return null;
        const ms = period() * 1000;
        if (o.breath) return [near(q, layer), { ...q, ms: APPROACH }, { ...q, down: true, ms }, { ...q, ms }, { ...q, down: true, ms }, { ...q, ms: LIFT }];
        const moves = [near(q, layer), { ...q, ms: APPROACH }];
        for (let i = 0; i < 3; i++) moves.push({ ...q, down: true, ms: 60 }, { ...q, ms: ms - 60 });
        return moves;
      },
      down(p) {
        state.held = true;
        const m = ctx.mark || shows[0];
        if (o.breath) { m?.do('press'); ctx.tap(p); return; }
        const t = state.t - (p.latency || 0), k = nearest(t), off = t - beatAt(k), hit = Math.abs(off) <= window_();
        m?.do('press');
        if (hit) { flashAll(); feel.play('beat', { strong: k % (o.strong ?? 4) === 0 }); feel.buzz(10); layer.touch(p); }
        else { ctx.tap(p); for (const s of shows) if (s.pos) layer.crumb(s.pos, Math.sign(off) || 1); }
        ctx.emit('tap', { k, off, hit });
      },
      up() { state.held = false; if (o.breath) (ctx.mark || shows[0])?.do('release'); },
      // back from a pause: three ticks counted in, then the beats go on where they were (§2.8)
      resumed() {
        const t = state.t, k = next(t);
        if (beatAt(k) === Infinity) return;
        shift += t + 3 * period() - beatAt(k);
        ticks = [t, t + period(), t + 2 * period()];
      },
      tick(dt) {
        state.t += dt;
        const t = state.t;
        while (ticks.length && t >= ticks[0]) { ticks.shift(); feel.play('tick'); }
        // the beats come: each told
        while (beatAt(state.k + 1) <= t) { state.k++; prev = beatAt(state.k); ctx.emit('beat', { k: state.k, strong: state.k % (o.strong ?? 4) === 0 }); }
        const nxt = beatAt(state.k + 1);
        const f = nxt === Infinity ? 1 : clamp((t - prev) / Math.max(0.05, nxt - prev));
        if (o.breath) {
          // a breath: the ring grows (hold) over one beat, falls (let go) over the next
          const inHold = (state.k + 1) % 2 === 0;
          state.breath = inHold ? 'in' : 'out';
          for (const { ring } of rings) ring.style.setProperty('--r', inHold ? 1 + f * 0.8 : 1.8 - f * 0.8);
        } else for (const { ring } of rings) ring.style.setProperty('--r', nxt === Infinity ? 2.4 : 1 + 1.4 * (1 - f));
        // (a light: faint between the beats, growing to full on the beat)
        for (const m of lights) m.el.style.opacity = nxt === Infinity ? 0 : 0.15 + 0.85 * f * f;
      },
      set(n) {
        // (a new pace: the beat being waited for comes as the new pace says, from the one come last)
        if (n.bpm != null && !o.times) { const k = Math.max(0, state.k); grid0 = beatAt(k) - shift - k * 60 / n.bpm; }
        if (n.times) { shift = 0; state.k = -1; prev = state.t; }
      },
      remove() { for (const { m, ring } of rings) { ring.remove(); m.is('beat', false); } for (const m of lights) m.el.style.opacity = ''; },
    };
  },

  // ── 4.9 lead ──
  lead(ctx, o) {
    const { layer, feel } = ctx, state = { held: false, knob: 0, arrow: 0, in: false, jerk: 0 };
    if ((o.from == null) !== (o.to == null)) throw new Error('lead: from and to together');
    const track = layer.svg('line', { class: 'mg-track' }), knob = layer.svg('circle', { class: 'mg-knob', r: 14 });
    let from = null, f = 0, tone = null, shown = null, gu = 0, rest = null; // rest: where the track was last laid
    // (from/to: the track lies along them, as marks stand — a scene's point each frame, or the game's own fn → page px)
    const at = r => (typeof r === 'function' ? r() : layer.point(r));
    let last = null; // the segment as last seen: a finger pressed while a point is unseen goes on along it
    const seg = () => {
      if (o.from == null) return null;
      const a = at(o.from), b = at(o.to);
      if (a && b) last = { a, b };
      return a && b ? last : null;
    };
    const sp = () => (o.from == null ? null : last || seg());
    // (the track's half: a quarter of the window — or half the segment; its middle and direction)
    const reach = () => { const s = sp(); return s ? Math.max(1, dist(s.a, s.b) / 2) : 0.25 * layer.window().w; };
    const dir = () => { const s = sp(); if (!s) return { x: 1, y: 0 }; const d = Math.max(1e-6, dist(s.a, s.b)); return { x: (s.b.x - s.a.x) / d, y: (s.b.y - s.a.y) / d }; };
    const mid = () => { const s = sp(); return s && { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 }; };
    // (the finger's offset along the track, −1…1)
    const along = (p, q) => { const d = dir(); return clamp(((p.x - q.x) * d.x + (p.y - q.y) * d.y) / reach(), -1, 1); };
    const knobAt = (c, u) => { const d = dir(), r = reach(); knob.setAttribute('cx', c.x + d.x * u * r); knob.setAttribute('cy', c.y + d.y * u * r); };
    // (the track laid where the finger presses — or along from/to —, the knob on it at the finger's offset)
    const lay = (p, u = 0) => {
      const c = mid() || p, d = dir(), r = reach();
      track.setAttribute('x1', c.x - d.x * r); track.setAttribute('x2', c.x + d.x * r); track.setAttribute('y1', c.y - d.y * r); track.setAttribute('y2', c.y + d.y * r);
      knobAt(c, u); knob.setAttribute('r', 14 * layer.k());
    };
    let hidden = false;
    const hide = on => { if (on === hidden) return; hidden = on; track.style.display = knob.style.display = on ? 'none' : ''; };
    // (no finger, no ghost: it rests, quieter, where it was last laid — at first in the middle — the knob in its middle)
    let laid = '';
    const idle = () => {
      const p = rest || centre(layer), c = mid() || p, key = `${c.x},${c.y},${reach()},${dir().x},${layer.k()}`;
      if (key !== laid || !track.classList.contains('mg-idle')) { laid = key; lay(p); }
      track.classList.add('mg-idle'); knob.classList.add('mg-idle');
    };
    const live = () => { laid = ''; track.classList.remove('mg-idle'); knob.classList.remove('mg-idle'); };
    // (along from/to it goes with its points each frame, the finger down or not; a point unseen — the track hidden)
    const off = layer.onPlace(() => {
      const placed = o.from != null, s = placed && seg();
      hide(placed && !s);
      if (placed && !s) return;
      if (from) { if (placed) lay(from, f); } else if (shown) { if (placed) lay(shown, gu); } else idle();
    });
    if (o.from != null) hide(!seg());
    idle();
    return {
      mark: null, state,
      demo() {
        const p = mid() || rest || centre(layer), r = reach(), d = dir(), to = u => ({ x: p.x + d.x * r * u, y: p.y + d.y * r * u });
        return [near(p, layer), { ...p, ms: APPROACH }, { ...p, down: true, ms: 120 }, { ...p, down: true, ms: DWELL }, { ...to(0.6), down: true, ms: 1100 }, { ...to(-0.5), down: true, ms: 1500 }, { ...p, down: true, ms: 900 }, { ...p, ms: LIFT }];
      },
      // (the ghost leads: the track under it where it presses, the knob going with it — only shown, the arrow not moved)
      follow(p, down) {
        if (from) return;
        if (!p || !down) { if (shown) { shown = null; idle(); } return; }
        if (!shown) { shown = p; rest = p; gu = 0; lay(p); live(); }
        gu = along(p, shown);
        knobAt(mid() || shown, gu);
      },
      down(p) {
        from = p; f = 0; state.held = true; state.jerk = 0; shown = null; rest = p;
        tone = feel.tone('zone');
        lay(p); live();
      },
      move(p) {
        if (!from) return;
        const was = f;
        f = along(p, from);
        state.jerk = Math.abs(f - was); state.knob = f;
        knobAt(mid() || from, f);
      },
      up() { from = null; f = 0; state.held = false; state.knob = 0; state.jerk = 0; tone?.stop(); tone = null; idle(); },
      tick(dt) {
        if (o.steer === 'rate') state.arrow = clamp(state.arrow + (0.8 * (from ? f : 0) + (o.push || 0)) * dt * 0.6, -1, 1);
        else if (from) state.arrow += (f - state.arrow) * Math.min(1, dt * 10);
        else if (o.release !== 'stay') state.arrow += (0 - state.arrow) * Math.min(1, dt * 4);
        const z = o.zone || { at: 0, width: 0.35 }, inside = Math.abs(state.arrow - z.at) <= z.width / 2;
        state.in = o.away ? !inside : inside;
        tone?.set(state.in ? 1 : 0);
      },
      // (torn off: the track tears)
      fault(reason) { if (reason === 'jerk') track.animate([{ strokeDasharray: '4 10', opacity: 0.3 }, { strokeDasharray: 'none', opacity: 1 }], { duration: 400 }); },
      remove() { off(); tone?.stop(); track.remove(); knob.remove(); },
    };
  },

  // ── the touch as it is ──
  touch(ctx) {
    const state = { down: false, x: null, y: null };
    const at = p => { state.x = p.x; state.y = p.y; return { x: p.x, y: p.y }; };
    return {
      mark: ctx.mark, state, ownTap: true,
      demo: () => { const q = ctx.mark?.pos || centre(ctx.layer); return [near(q, ctx.layer), ...press(q)]; },
      down(p) { state.down = true; ctx.layer.ripple(p); ctx.tap(p); ctx.emit('down', at(p)); },
      move(p) { if (state.down) ctx.emit('move', at(p)); },
      up(p) { state.down = false; ctx.emit('up', at(p)); },
    };
  },
};

// pull — free, to any of the targets (§4.3): the thing goes with the finger from the first frame (state.at: the game
// draws it there in the scene); let go — its mark is back at its own place, the game told where it was let go
function carry(ctx, o) {
  const { mark, layer, feel } = ctx, state = { held: false, at: null, target: -1 };
  let list = refs(o.targets), finger = null, grab = { x: 0, y: 0 }, tone = null, showing = false;
  const make = () => list.map(t => { const m = layer.mark({ at: t.at, kind: 'ring' }); m.is('target'); m.is('closed', t.closed); m.is('hidden', !state.held && !showing); return m; });
  let rings = make();
  const seen = on => rings.forEach(r => r.is('hidden', !on));
  const into = p => rings.findIndex(r => r.pos && p && dist(r.pos, p) <= hit(layer));
  const own = mark.own;
  mark.follow(() => (state.at ? { ...state.at } : own()));
  let last = -1;
  const reach = () => { state.target = into(state.at); rings.forEach((r, i) => r.is('reached', i === state.target)); };
  return {
    mark, state,
    demo() {
      const a = mark.pos, i = list.findIndex(t => !t.closed), b = i >= 0 && rings[i]?.pos;
      return a && b && [near(a, layer), { ...a, ms: APPROACH }, { ...a, down: true, ms: 120 }, { ...a, down: true, ms: DWELL }, { ...b, down: true, ms: 1500 }, { ...b, down: true, ms: 500 }, { ...b, ms: LIFT }];
    },
    // (the ghost carries the thing: the game draws it under the ghost as under a finger — then lets it go astray: told
    // as a release, target −1, and its mark is back at its own place)
    follow(p, down) {
      if (p && down) { showing = true; state.held = true; state.at = { x: p.x, y: p.y }; seen(true); return; }
      if (!showing) return;
      const at = state.at;
      showing = false; state.held = false; state.at = null; seen(false);
      ctx.emit('release', { target: -1, at });
    },
    down(p) {
      finger = p;
      const at = mark.pos || p;
      grab = { x: at.x - p.x, y: at.y - p.y };
      state.held = true; state.at = { x: at.x, y: at.y };
      mark.do('press'); mark.is('held');
      tone = feel.tone('motion');
      seen(true); reach();
    },
    move(p) {
      if (!state.held) return;
      tone?.set(0, clamp(dist(p, finger) / 20));
      finger = p;
      state.at = { x: p.x + grab.x, y: p.y + grab.y };
      reach(); layer.place();
    },
    up() {
      if (!state.held) return;
      reach();
      const target = state.target, at = state.at;
      last = target;
      state.held = false; state.at = null; state.target = -1; finger = null; tone?.stop(); tone = null;
      mark.is('held', false); mark.do('release');
      seen(false); rings.forEach(r => r.is('reached', false));
      layer.place();
      ctx.emit('release', { target, at });
    },
    fault(reason) { if (reason === 'wrong' && last >= 0) rings[last]?.do('shake'); },
    set(n) { if (n.targets) { rings.forEach(r => r.remove()); list = refs(n.targets); rings = make(); } },
    remove() { rings.forEach(r => r.remove()); tone?.stop(); mark.follow(null); },
  };
}
