// The sounds of the language of mini-games (П45–П49): the owner's picks from the board — general, by role, not the
// sound of a thing. Recorded clicks (no key), and low tonal sounds of a few families (organ, harmonium, electric
// piano, bell, bowl, choir «oo») on the game's key. The rule (language.md §6): low and middle register; intervals in just
// intonation over the key's tonic — what is right is pure and open: a fifth (3:2), a fourth (4:3), an octave, a ninth
// (9:4) — rising, ringing on; what is not is a tritone, an augmented or a diminished seventh chord (in tune too: no
// detuning, nothing sour), sinking; a few tones one after another (an arpeggio) at most — no tune; a third once (found).
//   KEYS — the keys: Lyria's names of a relative pair (C_MAJOR_A_MINOR…), a game says one (style({key})); KEY — the
//     one when none is said: D major / B minor — the key the owner picked these sounds in
//   LANGUAGE — the language's: {sounds: {event: {as, ids, k}}, tones: {process: {as, id, k}}} (feel.js plays them)
//   sound(id, key) → {play(ctx, out, at)} — a short one: a recorded one, or `<timbre>-<event>` of a family
//   layer(id, key) → {make(ctx, out)} — a process `<timbre>-<process>` (П47): what lasts while a gesture goes on and
//     follows it every frame, silent when nothing is done; intensity is loudness, the filter and the tones that come
//     in — not noise. make → {start(), set(u, speed), stop()}: u 0…1; speed 0…1 — how fast the finger goes (motion:
//     its u is the speed); for time, speed 0 — time stands (no pulse). stop() — fill: cut off if it came to the end,
//     else it sinks
//   load(ctx) — every recorded one fetched and decoded beforehand (a promise)

// ── recorded (sounds/, CC0 — sounds/LICENSE.md): fetched, decoded and mixed once per context ──
const LEVEL = 0.07;      // the loud part's RMS
const CEILING = 0.6;     // no peak above it
const QUIET = 0.004;     // (of the peak) below it — silence before, the tail's end after
const LEAD = 0.003, FADE_IN = 0.002, FADE_OUT = 0.04; // s: kept before the onset; the fades at the edges

const decoded = new WeakMap(); // ctx → Map(file → promise of {buffer, gain, from, to})

function prepare(ctx, file) {
  let all = decoded.get(ctx);
  if (!all) decoded.set(ctx, all = new Map());
  if (!all.has(file)) {
    all.set(file, fetch(new URL(`./sounds/${file}.ogg`, import.meta.url))
      .then(r => { if (!r.ok) throw new Error(`${file}: ${r.status}`); return r.arrayBuffer(); })
      .then(b => ctx.decodeAudioData(b))
      .then(b => mix(ctx, b))
      .catch(e => { all.delete(file); throw e; }));
  }
  return all.get(file);
}

// mono; where it starts and ends; how much louder or quieter it is played
function mix(ctx, b) {
  const n = b.length, rate = b.sampleRate, mono = ctx.createBuffer(1, n, rate), m = mono.getChannelData(0);
  for (let c = 0; c < b.numberOfChannels; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < n; i++) m[i] += d[i] / b.numberOfChannels;
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(m[i]));
  if (!peak) return { buffer: mono, gain: 0, from: 0, to: n / rate };
  const floor = peak * QUIET;
  let first = 0, last = n - 1;
  while (first < n && Math.abs(m[first]) < floor) first++;
  while (last > first && Math.abs(m[last]) < floor) last--;
  // the loud part: the first 0.25 s from the onset (a long tail must not make it seem quiet)
  const end = Math.min(last, first + Math.round(rate * 0.25));
  let sum = 0;
  for (let i = first; i <= end; i++) sum += m[i] * m[i];
  const rms = Math.sqrt(sum / Math.max(1, end - first + 1));
  const gain = Math.min(LEVEL / rms, CEILING / peak);
  return { buffer: mono, gain, from: Math.max(0, first / rate - LEAD), to: Math.min(n / rate, last / rate + 0.01) };
}

// one recorded sound from `at`: k — its loudness against the others; presence — dB added above 2.8 kHz (clearer)
function recorded(ctx, out, at, file, { k = 1, presence = 0 } = {}) {
  return prepare(ctx, file).then(({ buffer, gain, from, to }) => {
    const t = Math.max(at, ctx.currentTime), len = to - from, g = gain * k;
    const s = ctx.createBufferSource(), e = ctx.createGain();
    s.buffer = buffer;
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(g, t + FADE_IN);
    e.gain.setValueAtTime(g, t + Math.max(FADE_IN, len - FADE_OUT));
    e.gain.linearRampToValueAtTime(0, t + len);
    if (presence) { const f = ctx.createBiquadFilter(); f.type = 'highshelf'; f.frequency.value = 2800; f.gain.value = presence; s.connect(f).connect(e); }
    else s.connect(e);
    e.connect(out);
    s.start(t, from, len);
  });
}

// ── made here: the means ──
// pink noise (softer than white), two seconds of it per context — only air at an attack
const pinks = new WeakMap();
function pink(ctx) {
  let b = pinks.get(ctx);
  if (b) return b;
  const n = ctx.sampleRate * 2, c = (b = ctx.createBuffer(1, n, ctx.sampleRate)).getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) { // (P. Kellet's filter)
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    c[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
  }
  pinks.set(ctx, b);
  return b;
}
// an envelope: up in a, then away (exponentially) over d
function envelope(ctx, at, a, d, g) {
  const e = ctx.createGain();
  e.gain.setValueAtTime(0, at);
  e.gain.linearRampToValueAtTime(g, at + a);
  e.gain.setTargetAtTime(0, at + a, d / 4);
  return e;
}
// air: noise through a soft band, its centre may move (from → to) as it sounds
function air(ctx, out, at, { f = 1000, to = null, q = 0.7, type = 'bandpass', a = 0.01, d = 0.1, g = 0.1 } = {}) {
  const s = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), e = envelope(ctx, at, a, d, g);
  s.buffer = pink(ctx);
  flt.type = type; flt.Q.value = q; flt.frequency.setValueAtTime(f, at);
  if (to) flt.frequency.exponentialRampToValueAtTime(to, at + a + d);
  s.connect(flt).connect(e).connect(out);
  s.start(at, Math.random() * 1.5); s.stop(at + a + d * 1.5 + 0.05);
}

// ── the recorded ones the language took (sounds/) ──
const RECORDED = ['tap-click', 'tap-round', 'fault-thump'];

// ── tonal: the key ──
// Lyria's keys (its `scale`: a major and its relative minor), each at the place of its major's tonic (C = 0 … B = 11)
export const KEYS = ['C_MAJOR_A_MINOR', 'D_FLAT_MAJOR_B_FLAT_MINOR', 'D_MAJOR_B_MINOR', 'E_FLAT_MAJOR_C_MINOR', 'E_MAJOR_D_FLAT_MINOR',
  'F_MAJOR_D_MINOR', 'G_FLAT_MAJOR_E_FLAT_MINOR', 'G_MAJOR_E_MINOR', 'A_FLAT_MAJOR_F_MINOR', 'A_MAJOR_G_FLAT_MINOR', 'B_FLAT_MAJOR_G_MINOR',
  'B_MAJOR_A_FLAT_MINOR'];
export const KEY = 'D_MAJOR_B_MINOR';
// the tonic, low: the major's tonic between A1 (55 Hz) and A♭2 (104 Hz) — as near D2 (73 Hz) as it may be; tuned as the
// music is (A 440, equal temperament). Every tone of the language is a pure ratio over it. A fifth over the major's
// tonic lies in its minor too
function tonic(key = KEY) {
  const pc = KEYS.indexOf(key);
  if (pc < 0) throw new Error(`key: ${key} — not one of ${KEYS.join(', ')}`);
  return 73.416 * 2 ** ((((pc + 3) % 12) - 5) / 12);
}
// the intervals, just: the fifth, the fourth, the second (9:8), the third (5:4: found only); the tritone
// (7:5); the augmented chord's third and sixth over its root; the diminished seventh chord's three over its root
const FIFTH = 3 / 2, FOURTH = 4 / 3, SECOND = 9 / 8, THIRD = 5 / 4, TRITONE = 7 / 5, AUG = [5 / 4, 8 / 5], DIM7 = [6 / 5, 7 / 5, 5 / 3];

// ── tonal: the families ──
const harmonics = (n, f) => Array.from({ length: n }, (_, i) => f(i + 1));
// A family's timbre: harm — a periodic wave's harmonics, or partials — [ratio, amount, how long it rings (×)] (struck,
// not harmonic); unison — its voices' own spread (cents, a few: its warmth, the same in every sound — never a sign); a,
// r — attack, release (s); ring — a struck one's ring (×len); fm — an electric piano's bark at the attack; bright — the
// low-pass (Hz), q its resonance; formants — [Hz, Q, dB] peaks (a choir's «oo»); vibrato — [Hz, cents]; trem — a
// tremolo (Hz); air — breath at the attack {at: × the tone, g, d}; level — its loudness against the others
const TIMBRES = {
  organ: { harm: [1, 0.55, 0.14, 0.32, 0.04, 0.1, 0.02, 0.07], unison: [-0.75, 0.75], a: 0.03, r: 0.16, bright: 2400, q: 0.5, air: { at: 4, g: 0.05, d: 0.03 }, level: 1 },
  reed: { harm: harmonics(24, n => (n % 2 ? 1 : 0.7) / n ** 0.8), unison: [-0.9, 0, 1.05], a: 0.06, r: 0.2, bright: 1300, q: 1, air: { at: 8, g: 0.03, d: 0.08 }, level: 0.8 },
  ep: { partials: [[1, 1, 1], [2, 0.3, 0.45], [3, 0.08, 0.3], [6.9, 0.05, 0.08]], fm: 1.4, unison: [-0.6, 0.6], a: 0.004, r: 0.25, ring: 1.4, bright: 2200, q: 0.5, trem: 4.2, level: 1.1 },
  // a soft bell: nearly a sine, its octave faint, ringing long (as the sail's motif rings in «Scarlet Sails»)
  bell: { partials: [[1, 1, 1], [2, 0.12, 0.45], [3, 0.03, 0.25]], unison: [-0.8, 0.8], a: 0.012, r: 0.5, ring: 3, bright: 3000, q: 0.4, level: 1 },
  bowl: { partials: [[1, 1, 1], [2.71, 0.5, 0.6], [5.12, 0.2, 0.35], [8.4, 0.07, 0.2]], unison: [-1.5, 1.5], a: 0.008, r: 0.5, ring: 2.6, bright: 3200, q: 0.4, level: 1 },
  choir: { harm: harmonics(32, n => 1 / n), unison: [-3, -1.2, 0, 1.5, 3.3], a: 0.14, r: 0.35, bright: 1500, q: 0.4, formants: [[330, 5, 9], [720, 5, 5], [2500, 6, 2]], vibrato: [4.7, 9], air: { at: 6, g: 0.02, d: 0.15 }, level: 0.6 },
};

const waves = new WeakMap(); // ctx → Map(timbre → PeriodicWave)
function periodic(ctx, T) {
  let m = waves.get(ctx);
  if (!m) waves.set(ctx, m = new Map());
  if (!m.has(T)) { const imag = new Float32Array([0, ...T.harm]); m.set(T, ctx.createPeriodicWave(new Float32Array(imag.length), imag)); }
  return m.get(T);
}

// the way out of a tone: its formants → the low-pass → its envelope (amp) → a tremolo → its level → out
function chain(ctx, T, out) {
  const input = ctx.createGain(), lfos = [];
  let node = input;
  for (const [f, q, g] of T.formants || []) {
    const p = ctx.createBiquadFilter();
    p.type = 'peaking'; p.frequency.value = f; p.Q.value = q; p.gain.value = g;
    node.connect(p); node = p;
  }
  const filter = ctx.createBiquadFilter(), amp = ctx.createGain(), level = ctx.createGain();
  filter.type = 'lowpass'; filter.Q.value = T.q; filter.frequency.value = T.bright;
  amp.gain.value = 0; level.gain.value = T.level;
  node.connect(filter).connect(amp);
  if (T.trem) {
    const t = ctx.createGain(), l = ctx.createOscillator(), d = ctx.createGain();
    t.gain.value = 0.82; l.frequency.value = T.trem; d.gain.value = 0.18;
    l.connect(d).connect(t.gain); amp.connect(t).connect(level); lfos.push(l);
  } else amp.connect(level);
  level.connect(out);
  return { input, filter, amp, start: at => lfos.forEach(l => l.start(at)), stop: at => lfos.forEach(l => l.stop(at)) };
}

// the voices of one tone f into dest: each {osc, gain, ratio, amount, decay}
function voices(ctx, T, f, dest) {
  const list = [], n = T.unison.length, lfos = [];
  const add = (type, ratio, amount, decay, cents) => {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    if (type) osc.setPeriodicWave(type); else osc.type = 'sine';
    osc.frequency.value = f * ratio; osc.detune.value = cents; gain.gain.value = amount / n;
    osc.connect(gain).connect(dest);
    list.push({ osc, gain, ratio, amount: amount / n, decay });
  };
  if (T.harm) for (const c of T.unison) add(periodic(ctx, T), 1, 1, 1, c);
  else for (const [ratio, amount, decay] of T.partials) for (const c of T.unison) add(null, ratio, amount, decay, c);
  if (T.vibrato) {
    const l = ctx.createOscillator(), d = ctx.createGain();
    l.frequency.value = T.vibrato[0] * (0.9 + Math.random() * 0.2); d.gain.value = T.vibrato[1];
    l.connect(d); list.forEach(v => d.connect(v.osc.detune)); lfos.push(l);
  }
  return {
    list,
    start: at => { list.forEach(v => v.osc.start(at)); lfos.forEach(l => l.start(at)); },
    stop: at => { list.forEach(v => v.osc.stop(at)); lfos.forEach(l => l.stop(at)); },
  };
}

// one tone, once: len — how long it is held (a struck one: how long it rings, × its ring); g — how loud; bright — its
// filter (× the family's), darkening as it sounds (rise: opening instead, over len); swell — × its attack
function note(ctx, out, at, f, T, { len = 0.3, g = 0.3, bright = 1, swell = 1, rise = false } = {}) {
  const c = chain(ctx, T, out), v = voices(ctx, T, f, c.input), a = T.a * swell, cut = T.bright * bright;
  const struck = !!T.partials, end = struck ? at + a + len * T.ring * 1.6 : at + a + len + T.r * 2.5;
  if (rise) {
    c.filter.frequency.setValueAtTime(cut * 0.3, at);
    c.filter.frequency.exponentialRampToValueAtTime(cut, at + a + len);
  } else {
    c.filter.frequency.setValueAtTime(cut * 0.5, at);
    c.filter.frequency.linearRampToValueAtTime(cut, at + a + 0.01);
    c.filter.frequency.setTargetAtTime(cut * 0.45, at + a + 0.01, (struck ? len * T.ring : len) / 2);
  }
  c.amp.gain.setValueAtTime(0, at);
  c.amp.gain.linearRampToValueAtTime(g, at + a);
  if (struck) {
    v.list.forEach(x => { x.gain.gain.setValueAtTime(x.amount, at); x.gain.gain.setTargetAtTime(0, at + a, len * T.ring * x.decay / 3); });
    if (T.fm) { // (the bark: the fundamental shaken by a sine as high as it, for a moment)
      const m = ctx.createOscillator(), mg = ctx.createGain();
      m.frequency.value = f; mg.gain.setValueAtTime(f * T.fm, at); mg.gain.setTargetAtTime(0, at, 0.04);
      m.connect(mg); v.list.filter(x => x.ratio === 1).forEach(x => mg.connect(x.osc.frequency));
      m.start(at); m.stop(end);
    }
    c.amp.gain.setTargetAtTime(0, end - 0.12, 0.03); // (no click where it is cut)
  } else c.amp.gain.setTargetAtTime(0, at + a + len, T.r / 3);
  if (T.air) air(ctx, out, at, { f: Math.min(5000, f * T.air.at), q: 1.5, a: 0.004, d: T.air.d, g: T.air.g * g / 0.3 });
  c.start(at); v.start(at); v.stop(end); c.stop(end);
}

// the short sounds of a family (event: play — over the tonic t, low): the same grammar in every one. Each a small
// gesture with a mood — it moves inside (tones one after another, a breath swelling under them, a filter opening or
// closing), soft, on the key. What goes well is pure and open, rises and rings on; what goes wrong is in tune too, but
// unsettled — a tritone, an augmented chord, a diminished seventh — and sinks, muted, dark. A breath under a sound is
// always the choir's «oo», over any family
// tones (× the tonic) one after another, `gap` s apart, each ringing on under the next; the last held longer
const arpeggio = (c, o, at, T, t, tones, { gap = 0.2, g = 0.2, bright = 1, len = 0.4, last = 0.6 } = {}) => tones.forEach((m, i) =>
  note(c, o, at + i * gap, m * t, T, { len: i === tones.length - 1 ? last : len, g: g * (1 - 0.08 * i), bright }));
// a breath under them: the choir's «oo» on these tones (× the tonic), swelling in and opening, then away
const breath = (c, o, at, t, tones, { len = 1, g = 0.1, bright = 0.8 } = {}) => tones.forEach(m =>
  note(c, o, at, m * t, TIMBRES.choir, { len, g, bright, swell: 3, rise: true }));
const GRAMMAR = {
  // in: a fifth opens
  enter: (c, o, at, T, t) => { note(c, o, at, t, T, { len: 0.3, g: 0.2, swell: 3, bright: 0.8, rise: true }); note(c, o, at, t * FIFTH, T, { len: 0.3, g: 0.16, swell: 3, bright: 0.8, rise: true }); },
  // a touch: a tone (an octave over the tonic)
  tap: (c, o, at, T, t) => note(c, o, at, 2 * t, T, { len: 0.16, g: 0.32, swell: 0.5 }),
  // yes (a step done): an open fifth, and after it, over it, the octave
  yes: (c, o, at, T, t) => { note(c, o, at, 2 * t, T, { len: 0.3, g: 0.24 }); note(c, o, at, 2 * t * FIFTH, T, { len: 0.3, g: 0.18 }); note(c, o, at + 0.07, 4 * t, T, { len: 0.3, g: 0.16 }); },
  // a spark (halfway): the tonic, the fifth, the octave, the fifth over it — quickly up, ringing together
  spark: (c, o, at, T, t) => arpeggio(c, o, at, T, t, [2, 2 * FIFTH, 4, 4 * FIFTH], { gap: 0.055, g: 0.2, len: 0.25, last: 0.35 }),
  // oops, not so (a miss): a fifth over the tonic — sagging onto the tritone, duller
  no: (c, o, at, T, t) => { note(c, o, at, 2 * t, T, { len: 0.32, g: 0.22, bright: 0.5 }); note(c, o, at, 2 * t * FIFTH, T, { len: 0.08, g: 0.15, bright: 0.5 }); note(c, o, at + 0.14, 2 * t * TRITONE, T, { len: 0.2, g: 0.15, bright: 0.42 }); },
  // slipped (torn off): an augmented chord crumbles down — into a tritone over the low tonic, duller with each tone
  sink: (c, o, at, T, t) => { note(c, o, at, t, T, { len: 0.34, g: 0.2, bright: 0.45 }); [2 * AUG[1], 2 * AUG[0], TRITONE].forEach((r, i) => note(c, o, at + i * 0.08, t * r, T, { len: 0.14, g: 0.14 - 0.02 * i, bright: 0.5 - 0.04 * i })); },
  // a calm «well done» (the end): the tonic, the fifth — higher, up to the ninth — settling on the octave; under them the
  // choir breathing in on the tonic and the fifth. Breathing out: it all came together
  rise: (c, o, at, T, t) => { breath(c, o, at, t, [1, FIFTH], { len: 1 }); arpeggio(c, o, at, T, t, [2, 2 * FIFTH, 4 * SECOND, 4], { gap: 0.2, last: 0.9 }); },
  // a suspension resolving (a choice): the tonic with the fourth — waiting; the fourth goes, the fifth comes in, the octave
  // over them. «There»: quiet and clear
  sus: (c, o, at, T, t) => {
    breath(c, o, at, t, [1], { len: 1 });
    note(c, o, at, 2 * t, T, { len: 0.6, g: 0.18 }); note(c, o, at, 2 * t * FOURTH, T, { len: 0.12, g: 0.15 });
    note(c, o, at + 0.3, 2 * t * FIFTH, T, { len: 0.6, g: 0.17 }); note(c, o, at + 0.52, 4 * t, T, { len: 0.8, g: 0.14 });
  },
  // warm (found, with the third): the tonic, the third, the fifth, the octave — unhurried, as the sail's motif in «Scarlet
  // Sails»; the choir under them
  third: (c, o, at, T, t) => { breath(c, o, at, t, [1, FIFTH], { len: 1.2 }); arpeggio(c, o, at, T, t, [2, 2 * THIRD, 2 * FIFTH, 4], { gap: 0.26, g: 0.18, last: 1 }); },
  // almost (the end with mistakes): the tonic, the fifth, the ninth — reaching higher — and coming down onto the fourth,
  // not the octave; the choir duller. «Good, but not quite»
  almost: (c, o, at, T, t) => { breath(c, o, at, t, [1], { len: 0.8, bright: 0.6 }); arpeggio(c, o, at, T, t, [2, 2 * FIFTH, 4 * SECOND, 2 * FOURTH], { gap: 0.2, bright: 0.75, last: 0.7 }); },
  // lost, downwards: the low tonic fades; over it a diminished seventh goes down a tone at a time, darker with each
  fall: (c, o, at, T, t) => { note(c, o, at, t, T, { len: 1.1, g: 0.3, bright: 0.4, swell: 1.5 }); [DIM7[2], DIM7[1], DIM7[0], 1].forEach((r, i) => note(c, o, at + i * 0.16, 2 * t * r, T, { len: 0.5, g: 0.1, bright: 0.4 - 0.05 * i })); },
};

// ── the layers: the means ──
const clamp = x => Math.max(0, Math.min(1, x || 0));
const smooth = (p, v, ctx, tc = 0.06) => p.setTargetAtTime(v, ctx.currentTime, tc);
// a drone: tones (each its voices and its own gain) through one chain; silent until set
function drone(ctx, out, T, tones) {
  const c = chain(ctx, T, out);
  const parts = tones.map(f => { const g = ctx.createGain(); g.gain.value = 0; g.connect(c.input); return { g, v: voices(ctx, T, f, g) }; });
  let wob = null;
  return {
    start() { const t = ctx.currentTime; c.start(t); parts.forEach(p => p.v.start(t)); wob?.start(t); },
    stop(tc = 0.08) { const t = ctx.currentTime; smooth(c.amp.gain, 0, ctx, tc); const end = t + tc * 8; parts.forEach(p => p.v.stop(end)); c.stop(end); wob?.stop(end); },
    amp: (g, tc) => smooth(c.amp.gain, g, ctx, tc),
    cut: (f, tc) => smooth(c.filter.frequency, f, ctx, tc),
    level: (i, g, tc) => smooth(parts[i].g.gain, g, ctx, tc),
    // the loudness shaken by sines of these rates (Hz): a wobble, a pulse; → {gain: its depth, oscs}
    wobble(rates) {
      const gain = ctx.createGain(), oscs = rates.map(r => { const o = ctx.createOscillator(); o.frequency.value = r; o.connect(gain); return o; });
      gain.gain.value = 0; gain.connect(c.amp.gain);
      wob = { start: at => oscs.forEach(o => o.start(at)), stop: at => oscs.forEach(o => o.stop(at)) };
      return { gain, oscs };
    },
  };
}
// events in time: gap() — seconds to the next (Infinity: none for now); fire(at) — one. A short look ahead.
function stream(ctx, gap, fire) {
  let next = ctx.currentTime + 0.02, on = true;
  const tick = () => {
    if (!on) return;
    const now = ctx.currentTime, until = now + 0.1, g0 = gap();
    if (Number.isFinite(g0) && next > now + g0) next = now + g0; // (it quickened: not after the old, long gap)
    while (next < until) {
      const g = gap();
      if (!Number.isFinite(g)) { next = until; break; }
      if (next >= now) fire(next);
      next += g;
    }
  };
  const id = setInterval(tick, 25);
  tick();
  return () => { on = false; clearInterval(id); };
}

// the processes, the same in every family: make(ctx, out, T, t) — over the tonic t
const PROCESSES = {
  // a hum that fills: the tones come in (the fifth, the octave, the fifth above) and the filter opens; let go before
  // the end — it darkens and sinks away
  // fill (the going): a hum builds up
  fill: (ctx, out, T, t) => {
    const d = drone(ctx, out, T, [t, t * FIFTH, 2 * t, 2 * t * FIFTH]);
    let u = 0;
    return {
      start: () => d.start(),
      set(x) {
        u = clamp(x);
        d.amp(0.1 + 0.2 * u); d.cut(220 + T.bright * 1.1 * u);
        d.level(0, 1); d.level(1, 0.7 * u); d.level(2, 0.5 * u * u); d.level(3, 0.35 * u ** 3);
      },
      stop() {
        if (u >= 0.98) { d.stop(0.04); return; }
        d.cut(120, 0.1); d.stop(0.15);
      },
    };
  },
  // the tonic, low, pulsing — the pulse quickens with the danger (0.6 → 6.6 Hz), the filter opens, and above it a
  // diminished seventh chord comes in
  // tension (danger): a pulse and dim7
  tension: (ctx, out, T, t) => {
    const d = drone(ctx, out, T, [t, ...DIM7.map(r => 2 * t * r)]), pulse = d.wobble([0.6]);
    return {
      start: () => d.start(),
      set(x) {
        const u = clamp(x), amp = 0.08 + 0.25 * u;
        d.level(0, 0.7); [1, 2, 3].forEach(i => d.level(i, 0.2 * u * u));
        d.cut(250 + T.bright * u); d.amp(amp);
        smooth(pulse.oscs[0].frequency, 0.6 + 6 * u, ctx, 0.1); smooth(pulse.gain.gain, amp * 0.6 * u, ctx);
      },
      stop: () => d.stop(0.1),
    };
  },
  // an even fifth and octave; out of the zone the fifth gives way to the tritone, it dulls and wavers
  // zone (in it): a steady fifth
  zone: (ctx, out, T, t) => {
    const d = drone(ctx, out, T, [t, t * FIFTH, 2 * t, t * TRITONE]), wob = d.wobble([2.3, 3.7]);
    return {
      start: () => d.start(),
      set(x) {
        const u = clamp(x);
        d.level(0, 0.6); d.level(1, 0.5 * u, 0.1); d.level(2, 0.4 * u, 0.1); d.level(3, 0.35 * (1 - u), 0.1);
        d.cut(300 + T.bright * u, 0.1); d.amp(0.25, 0.1); smooth(wob.gain.gain, 0.12 * (1 - u), ctx, 0.1);
      },
      stop: () => d.stop(0.1),
    };
  },
  // a tone that goes with the hand: louder and brighter the faster, its octave coming in; still — silent
  // motion (speed): a tone following the hand
  motion: (ctx, out, T, t) => {
    const d = drone(ctx, out, T, [t * FIFTH, 2 * t]);
    return {
      start: () => d.start(),
      set(x, speed = x) {
        const s = clamp(speed);
        d.level(0, 1); d.level(1, 0.4 * s); d.amp(0.35 * s ** 0.8, 0.05); d.cut(220 + T.bright * 1.4 * s, 0.05);
      },
      stop: () => d.stop(0.08),
    };
  },
  // a low slow pulse on the tonic, quickening to the limit (from 1.1 s to 0.35 s), brighter; none while time stands
  // time: a low pulse
  time: (ctx, out, T, t) => {
    let u = 0, going = true, stop = null;
    return {
      start() { stop = stream(ctx, () => (going ? 1.1 - 0.75 * u : Infinity), at => note(ctx, out, at, t, T, { len: 0.22, g: 0.24 + 0.14 * u, bright: 0.6 + 0.5 * u, swell: 0.6 })); },
      set(x, speed = 1) { u = clamp(x); going = speed > 0; },
      stop() { stop?.(); },
    };
  },
};

// The language's sounds (feel.js): for each of its events its sound (several — taken in turn) and how loud against the
// others (k); for each of its processes a layer
export const LANGUAGE = {
  sounds: {
    enter: { as: 'enter', ids: ['organ-enter'], k: 0.6 },
    tap: { as: 'touch', ids: ['tap-click', 'tap-round'], k: 1 },
    snap: { as: 'a step made', ids: ['organ-yes'], k: 0.6 },
    halfway: { as: 'halfway, all goes well', ids: ['bell-spark'], k: 0.5 },
    miss: { as: 'missed', ids: ['organ-no'], k: 0.6 },
    slip: { as: 'a slip, let go early, danger', ids: ['reed-sink'], k: 0.6 },
    fault: { as: 'a fault', ids: ['fault-thump'], k: 1 },
    quarter: { as: 'a ratchet (a quarter turn)', ids: ['tap-round'], k: 0.5 },
    beat: { as: 'a beat', ids: ['ep-tap'], k: 0.6 },
    tick: { as: 'a count tick', ids: ['tap-click'], k: 0.6 },
    found: { as: 'found', ids: ['bell-third'], k: 0.45 },
    'end:clean': { as: 'the end', ids: ['bell-rise'], k: 0.6 },
    'end:flawed': { as: 'the end, with faults', ids: ['bell-almost'], k: 0.6 },
    'end:neutral': { as: 'a choice', ids: ['bell-sus'], k: 0.55 },
    'end:loss': { as: 'a loss', ids: ['organ-fall'], k: 0.6 },
  },
  tones: {
    fill: { as: 'filling', id: 'choir-fill', k: 0.6 },
    motion: { as: 'moving', id: 'reed-motion', k: 0.6 },
    seek: { as: 'seeking (closer)', id: 'bowl-zone', k: 0.6 },
    zone: { as: 'in the zone', id: 'organ-zone', k: 0.6 },
    tension: { as: 'tension', id: 'organ-tension', k: 0.6 },
    time: { as: 'time', id: 'ep-time', k: 0.6 },
  },
};
// one of the language's short sounds: a recorded one (no key), or `<timbre>-<event>` of a family on the key; a process
// `<timbre>-<process>`
export function sound(id, key = KEY) {
  if (RECORDED.includes(id)) return { play: (ctx, out, at) => recorded(ctx, out, at, id) };
  const [timbre, event] = id.split('-'), t = tonic(key);
  return { play: (ctx, out, at) => Promise.resolve(GRAMMAR[event](ctx, out, Math.max(at, ctx.currentTime), TIMBRES[timbre], t)) };
}
export function layer(id, key = KEY) {
  const [timbre, process] = id.split('-'), t = tonic(key);
  return { make: (ctx, out) => PROCESSES[process](ctx, out, TIMBRES[timbre], t) };
}

export const load = ctx => Promise.allSettled(RECORDED.map(f => prepare(ctx, f)));
