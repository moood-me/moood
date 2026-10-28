// Ready tricks on top of the language (docs/games/miniux/language.md §9): the common cases made of the same words a game has
// (index.js — mg.mark, the gestures, the responses, the plate), and nothing else — to use, to copy and change, or to do
// without. Each is short on purpose: a sample of how a mini-game is written on the vocabulary.
//   const tricks = createTricks({ play }) — play: the play's id (what was shown once is remembered for it, in this
//     browser); bespoke.minigame.tricks
// Each trick: trick(mg, o) → a promise of {state: 'done' | 'left' (the mini-game ended meanwhile), errors: {reason: n},
// …its own}; its marks and gestures gone when it is over. Common options: glow — the scene element that is the thing
// (it glows while it waits); progress(u, state) — each frame its going 0…1 (the game moves the scene by it); bar(u) —
// where its going goes on the plate (default: the plate's fill; steps gives each its part); soft — its errors shown,
// not counted, no chip (default: the first meeting of its gesture in the play); teach: false — no ghost showing it.
// A touch on nothing is «missed» while a trick goes on. Tricks are for a mini-game with a plate.
//   holdTillFull(mg, {at, seconds, danger}) — hold till the groove is full; let go early — «let go early»; danger(s) →
//     the level 0…1 on the mark's edge by the game's rule (s: {dt, t, level, held, fill, at}); at 1 under the finger —
//     «into danger», the fill falls
//   pullTo(mg, {thing, to, release, heavy}) — the thing pulled along its way and let go in the target
//   traceLine(mg, {line, tolerance}) — along the line to its end; off it — «off the way»
//   turnTimes(mg, {at, turns, dir}) — that many turns the arrow's way; against it — «against»
//   rubTill(mg, {at, radius, full}) — rubbed till covered
//   seekAndHold(mg, {area, place, radius, hold}) — sought over the area, held at the place till the lens fills
//   hitsInBeat(mg, {at, bpm, hits, window, onHit(k)}) — that many touches in the beat (a beat counts once); out of it —
//     «too early or too late», nothing taken away
//   keepInZone(mg, {seconds, zone(t), width, away, steer, push(t), release, smooth}) — the arrow kept in the zone (or
//     away from it) for seconds; smooth — a sharp move is «jerked»; → share: of the time in it
//   steps(mg, [bar => promise…]) — steps one by one, each its part of the bar, notches between; → results
//   teach(mg, gestures, {id, still: [4, 8]}) → {remove()} — the ghost shows the gestures at the first meeting of id in
//     the play, and again when the player stands still — no finger down that long (4 s, then every 8; still: null —
//     never: doing nothing is a way); once one of the gestures is removed it shows no more
//   first(id) — not met yet in this play; forget() — every gesture as if never shown (the author's tool)
export function createTricks({ play }) {
  const KEY = `moood:minigame:seen:${play}`;
  const seen = new Set((() => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } })());
  const saw = id => { seen.add(id); try { localStorage.setItem(KEY, JSON.stringify([...seen])); } catch {} };
  const first = id => !seen.has(id);

  function teach(mg, gestures, { id, still = [4, 8] } = {}) {
    let show = null, idle = 0, shown = false, gone = false, pressed = false;
    const go = () => {
      const s = mg.show({ gestures });
      // (a gesture of it removed meanwhile — its mark done: there is nothing more to show)
      if (s.dead) { gone = true; return; }
      show = s;
      show.finished.then(done => { if (done && id) saw(id); shown = true; idle = 0; show = null; });
    };
    if (!id || first(id)) go();
    const offs = [
      mg.on('down', () => { idle = 0; shown = true; pressed = true; }),
      mg.on('up', () => { idle = 0; pressed = false; }),
      mg.on('frame', ({ dt }) => { if (!still || show || gone || pressed) return; idle += dt; if (idle >= (shown ? still[1] : still[0])) go(); }),
    ];
    return { remove() { gone = true; show?.remove(); offs.forEach(f => f()); } };
  }

  // a trick's run: its errors (soft — not counted), its bar, its plate's glow, its end; over when it is done or the
  // mini-game is left
  function run(mg, o, id, body) {
    return new Promise(resolve => {
      const errors = {}, soft = o.soft ?? first(id), made = [], offs = [];
      let over = false, taught = null;
      const t = {
        made: h => (made.push(h), h),
        on: off => offs.push(off),
        bar: u => (o.bar || (v => mg.plate.set({ fill: v })))(u),
        mood: m => mg.plate.set({ glow: m }),
        progress: (u, s) => o.progress?.(u, s),
        error(reason, opts) { mg.error(reason, { ...opts, chip: !soft }); if (!soft) errors[reason] = (errors[reason] || 0) + 1; },
        teach: (gestures, still) => { if (o.teach !== false) taught = teach(mg, gestures, { id, still }); },
        done(extra = {}) { finish('done', extra); },
      };
      const finish = (state, extra = {}) => {
        if (over) return;
        over = true;
        taught?.remove(); offs.forEach(f => f());
        made.forEach(h => h.remove());
        resolve({ state, errors, ...extra });
      };
      offs.push(mg.on('end', () => finish('left')));
      // (a touch on nothing: «a miss», the nearest mark twitching toward it)
      offs.push(mg.on('miss', e => t.error('miss', { at: e.mark, finger: e })));
      if (o.glow) mg.glow(o.glow);
      body(t);
    });
  }

  return {
    first, teach,
    forget() { seen.clear(); try { localStorage.removeItem(KEY); } catch {} },

    holdTillFull: (mg, o) => run(mg, o, 'hold', t => {
      const mark = t.made(mg.mark({ at: o.at, kind: 'groove' })), g = t.made(mg.hold({ on: mark, seconds: o.seconds ?? 1.2 }));
      const tension = o.danger && t.made(mg.layer('tension'));
      let level = 0;
      t.teach([g]);
      t.on(g.on('up', () => { if (g.state.fill > 0.1 && g.state.fill < 1) t.error('early', { at: mark }); }));
      t.on(mg.on('frame', ({ t: now, dt }) => {
        const s = g.state;
        if (o.danger) {
          level = Math.min(1, Math.max(0, o.danger({ dt, t: now, level, held: s.held, fill: s.fill, at: s.at })));
          mark.set({ danger: level }); tension.set({ u: level });
          if (s.held && level >= 1) { t.error('danger', { at: mark }); g.set({ fill: 0 }); level = 0; }
        }
        t.mood(level > 0.6 ? 'bad' : s.held ? 'good' : 'idle');
        t.bar(s.fill); t.progress(s.fill, { ...s, level });
        if (s.fill >= 1) { mg.snap({ at: mark }); t.done(); }
      }));
    }),

    pullTo: (mg, o) => run(mg, o, 'pull', t => {
      const mark = t.made(mg.mark({ at: o.thing, kind: 'dash' }));
      const g = t.made(mg.pull({ on: mark, to: o.to, release: o.release, heavy: o.heavy }));
      t.teach([g]);
      t.on(g.on('release', ({ inTarget }) => { if (inTarget) { mg.snap({ at: mark }); t.done(); } }));
      t.on(g.on('frame', s => { t.mood(s.held ? 'good' : 'idle'); t.bar(s.u); t.progress(s.shown ?? s.u, s); }));
    }),

    traceLine: (mg, o) => run(mg, o, 'trace', t => {
      const mark = t.made(mg.mark({ at: o.line[0], kind: 'dash' })), g = t.made(mg.trace({ on: mark, line: o.line, tolerance: o.tolerance }));
      t.teach([g]);
      t.on(g.on('off', () => t.error('off', { at: g })));
      t.on(g.on('frame', s => {
        t.mood(s.tracing ? 'good' : 'idle'); t.bar(s.u); t.progress(s.u, s);
        if (s.u >= 0.99) { mg.snap({ at: mark }); t.done(); }
      }));
    }),

    turnTimes: (mg, o) => run(mg, o, 'turn', t => {
      const turns = o.turns ?? 1.5;
      const mark = t.made(mg.mark({ at: o.at, kind: 'dash' })), g = t.made(mg.turn({ on: mark, dir: o.dir }));
      t.teach([g]);
      t.on(g.on('against', () => t.error('against', { at: g })));
      t.on(g.on('frame', s => {
        const u = Math.min(1, Math.max(0, s.most / turns));
        t.bar(u); t.progress(u, s);
        if (u >= 1) { mg.snap({ at: mark }); t.done(); }
      }));
    }),

    rubTill: (mg, o) => run(mg, o, 'rub', t => {
      const mark = t.made(mg.mark({ at: o.at, kind: 'spot' })), g = t.made(mg.rub({ on: mark, radius: o.radius, full: o.full }));
      t.teach([g]);
      t.on(g.on('frame', s => {
        t.mood(s.at ? 'good' : 'idle'); t.bar(s.u); t.progress(s.u, s);
        if (s.u >= 1) { mg.snap({ at: mark }); t.done(); }
      }));
    }),

    seekAndHold: (mg, o) => run(mg, o, 'seek', t => {
      const area = t.made(mg.mark({ at: o.area, kind: 'spot' })), place = t.made(mg.mark({ at: o.place, hidden: true }));
      const g = t.made(mg.seek({ on: area, places: [o.place], radius: o.radius, hold: o.hold }));
      t.teach([g]);
      t.on(g.on('frame', s => {
        t.mood(s.warm > 0.6 ? 'good' : 'idle'); t.bar(s.fill); t.progress(s.fill, s);
        if (s.fill >= 1) { mg.sound('found'); mg.snap({ at: place }); t.done(); }
      }));
    }),

    hitsInBeat: (mg, o) => run(mg, o, 'rhythm', t => {
      const need = o.hits ?? 8, hit = new Set();
      const mark = t.made(mg.mark({ at: o.at })), g = t.made(mg.rhythm({ on: mark, bpm: o.bpm, window: o.window }));
      let good = -Infinity;
      t.teach([g]);
      // (alone, a notch a hit; in steps, the steps' own)
      if (!o.bar) mg.plate.set({ notches: Array.from({ length: need - 1 }, (_, i) => (i + 1) / need) });
      t.on(g.on('tap', ({ k, hit: ok }) => {
        if (!ok) { t.error('timing', { at: mark }); return; }
        if (hit.has(k)) return;
        hit.add(k); good = mg.t; o.onHit?.(k);
        t.bar(hit.size / need); t.progress(hit.size / need, g.state);
        if (hit.size >= need) { mg.snap({ at: mark }); t.done({ hits: hit.size }); }
      }));
      t.on(mg.on('frame', ({ t: now }) => t.mood(now - good < 60 / (o.bpm || 90) + 0.2 ? 'good' : 'idle')));
    }),

    keepInZone: (mg, o) => run(mg, o, 'lead', t => {
      const g = t.made(mg.lead({ steer: o.steer, release: o.release, away: o.away }));
      const t0 = mg.t;
      let inside = 0;
      t.teach([g]);
      t.on(mg.on('frame', ({ t: now, dt }) => {
        const s = g.state, since = now - t0;
        g.set({ zone: { at: o.zone(since), width: o.width ?? 0.35 }, ...(o.push ? { push: o.push(since) } : {}) });
        if (o.smooth && s.jerk > 0.35) t.error('jerk', { at: g });
        if (s.in) inside += dt;
        t.mood(s.in ? 'good' : s.held || o.push ? 'bad' : 'idle');
        const u = Math.min(1, since / o.seconds);
        t.bar(u); t.progress(u, { ...s, zone: o.zone(since) });
        if (since >= o.seconds) t.done({ share: inside / o.seconds });
      }));
    }),

    async steps(mg, list) {
      const N = list.length, results = [], errors = {};
      mg.plate.set({ notches: Array.from({ length: N - 1 }, (_, i) => (i + 1) / N) });
      for (let i = 0; i < N; i++) {
        const r = await list[i](u => mg.plate.set({ fill: (i + Math.min(1, Math.max(0, u))) / N }));
        results.push(r);
        for (const k in r.errors) errors[k] = (errors[k] || 0) + r.errors[k];
        if (r.state !== 'done') return { state: r.state, errors, results };
      }
      return { state: 'done', errors, results };
    },
  };
}
