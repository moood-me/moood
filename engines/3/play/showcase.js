// The showcase (spec.showcase): the scene's own small scenario, run only outside games (the preview, the scene's page,
// a render's film) — beats one after another, a sequence of the director's. Its bar (5.10):
//   No rehearsal. A checkpoint — the director's save — is kept as each beat begins: the only moments it can go on from
// (a sequence is code: it can be begun again, not taken up in its middle). A seek back restores the checkpoint at or
// before the moment and plays on to it unseen; a seek ahead of what was played plays unseen from where the film is
// known to (the thread: 2.5).
//   The length is exact (`known`) once the showcase has ended once. Until then it is ONE estimate: with m — the mean
// length of the beats that have ended, or, while none has, the time the first beat has run so far —
//   length = the time reached + max(m − the current beat's time so far, 0) + (the beats not begun) · m
// (the time reached: the farthest the film has been played to; the current beat: the farthest begun). At the film's
// first instant it is 0.
import '../../../i18n/i18n.js';

// d: the director's own — sequence(fn, opts), save(), now() (its time), warn(text), report(who, err), tr (the scene's
// translator: the showcase's code has it)
export function createShowcase(d) {
  const none = () => ({ beats: null, names: null, playing: false, seq: null, beat: -1, t0: 0, stood: null, began: false, ended: false, known: false, length: 0, checkpoints: [], beganAt: [], lengths: [], far: -1, sofar: 0 });
  const show = none();
  const info = { at: 0, length: 0, known: false, playing: false, ended: false, beat: -1 };
  const at = () => (show.began ? (show.stood ?? d.now()) - show.t0 : 0);
  function beatsOf(code, api) {
    let beats;
    try { beats = globalThis.MooodI18n.bind(d.tr, 'scene', code)(api); } catch (err) { d.report('showcase', err); return null; }
    if (typeof beats === 'function') beats = [beats];
    if (!Array.isArray(beats) || !beats.length || !beats.every(b => typeof b === 'function' || (b && typeof b.run === 'function'))) {
      d.warn('showcase: its code returns its beats — [async s => …, …] or [{ name, run: async s => … }, …]');
      return null;
    }
    return beats.map((b, i) => (typeof b === 'function' ? { name: `${i + 1}`, run: b } : { name: String(b.name ?? i + 1), run: b.run }));
  }
  // played from beat k (the film's time `from` then): each beat's checkpoint kept as it begins, its length as it ends
  function playFrom(k, from) {
    show.seq?.cancel();
    show.t0 = d.now() - from; show.ended = false; show.began = true; show.stood = show.playing ? null : d.now();
    const seq = show.seq = d.sequence(async s => {
      for (let i = k; i < show.beats.length; i++) {
        show.beat = i;
        const began = d.now() - show.t0;
        show.beganAt[i] = began;
        const c = { at: began, beat: i, data: d.save() }, was = show.checkpoints.findIndex(x => x.beat === i);
        if (was >= 0) show.checkpoints[was] = c; else show.checkpoints.push(c);
        if (i > show.far) { show.far = i; show.sofar = 0; }
        await s.sequence(show.beats[i].run);
        show.lengths[i] = d.now() - show.t0 - began;
      }
      if (show.seq !== seq) return;
      show.ended = true;
      // (played through from its start to its end: every beat's length is known — the film's is exact from now on)
      if (show.lengths.length === show.beats.length && !show.lengths.includes(undefined)) { show.known = true; show.length = d.now() - show.t0; }
    }, { name: 'showcase' });
    if (!show.playing) show.seq.pause();
  }
  function lengthNow() {
    if (show.known) return show.length;
    if (show.far < 0) return 0;
    const t = at();
    if (show.beat === show.far && !show.ended) show.sofar = Math.max(show.sofar, t - show.beganAt[show.far]);
    let sum = 0, n = 0;
    for (let i = 0; i < show.lengths.length; i++) if (show.lengths[i] !== undefined) { sum += show.lengths[i]; n++; }
    const done = show.lengths[show.far] !== undefined, sofar = done ? show.lengths[show.far] : show.sofar, m = n ? sum / n : sofar;
    return show.beganAt[show.far] + sofar + (done ? 0 : Math.max(m - sofar, 0)) + (show.beats.length - 1 - show.far) * m;
  }
  // the film let go: its sequence ended, nothing of it kept — no beats, no info (the state and the scripts started
  // anew; a moment sought that is before it began)
  function stop() { show.seq?.cancel(); Object.assign(show, none()); }
  return {
    // its beats made (code: spec.showcase; api: the director's for it) → whether it has any
    load(code, api) {
      stop();
      show.beats = code ? beatsOf(code, api) : null;
      show.names = show.beats ? show.beats.map(b => b.name) : null;
      return !!show.beats;
    },
    // its beats' names (null: no showcase loaded)
    get beats() { return show.names; },
    // what the page shows of it: { at, length (seconds), known (the length is exact), playing, ended, beat } — one
    // object, filled anew as it is asked: read it, don't keep it; null: none
    get info() {
      if (!show.beats) return null;
      const length = lengthNow();
      info.at = Math.max(0, show.known ? Math.min(at(), length) : at()); info.length = length; info.known = show.known; info.playing = show.playing; info.ended = show.ended; info.beat = show.beat;
      return info;
    },
    begin() { playFrom(0, 0); },
    get at() { return at(); },
    get ended() { return show.ended; },
    get playing() { return show.playing; },
    // (paused, its time stands: it goes on from there as it plays again)
    set playing(v) {
      v = !!v;
      if (v === show.playing) return;
      show.playing = v;
      if (!v) show.stood = d.now(); else if (show.stood != null) { show.t0 += d.now() - show.stood; show.stood = null; }
      if (show.seq && !show.seq.done) { if (v) show.seq.resume(); else show.seq.pause(); }
    },
    // the checkpoint at or before `at` (its seconds); null: none kept
    checkpoint(when) { let best = null; for (const c of show.checkpoints) if (c.at <= when + 1e-6 && (!best || c.at > best.at)) best = c; return best; },
    // … at or before a moment of the scene's own time (the director's seconds); null: the film had not begun by then
    checkpointBy(time) { let best = null; for (const c of show.checkpoints) if (c.data.t <= time + 1e-6 && (!best || c.data.t > best.data.t)) best = c; return best; },
    // played on from a checkpoint (the scene restored to it: the thread — then its scripts started anew)
    from(c) { playFrom(c.beat, c.at); },
    stop,
  };
}
