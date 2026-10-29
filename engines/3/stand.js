// What the frames cost, kept for the measuring stand (../1/stand.html: a host's measuring stand drives it) — made by the
// scene's thread only when the page mounts the stage with ?stand (flags.stand: ST1); otherwise nothing of it is even
// loaded. It imports nothing.
//   createStand(origin, detail, stats) → { mark(what), input(type), start(), tick(row), take(extra) }
//     origin — the thread's performance.timeOrigin (ms of the epoch: the page's clock and this thread's agree);
//     detail — the detail run (?stand=detail): each row's stages and passes (R.timing) and its step's parts are kept;
//     stats — () → sheets.stats(): asked at the first frame drawn and at each cut's frame, for the pages placed and
//     sent by then (what that view cost) — the one thing made while it runs, and only then.
//   mark('mounted' | 'shown' | 'people' | 'painted' | 'pipelines' | 'whole' | 'built' | 'drawn') — the opening's
//     moments: mounted, once; then once each a show (`shown` begins its marks): the show asked; the people built; the
//     artist's last answer of the build taken; the world's pipelines made (R.build resolved); beside a scene living,
//     its opening view lacking nothing (2.9); the switch; its first frame drawn. A switch's legs are kept as an
//     opening's.
//   input(type) — an input of the page arrived: how long till a frame drawn with it (its type is not kept: nothing
//     reads it).
//   start() — measured from here (this thread named in a trace — 'stand:scene': whose GC is the scene's).
//   tick(row) — a display callback ended (ST2: one object the thread reuses — copied here into a buffer made once, at
//     the first row: its width is known then; the inputs and the cuts are kept in buffers made once too): at, ran,
//     state (0 held, 1 idle, 2 drawn), every, late, js, cost (and, last of its own: late by — the pacer's lateBy —,
//     submitted — pace.takeSubmitted(); opened — on the tick an insert's opening begins, s since its key left 0, else −1;
//     story — a cut waits: the story stands, 2.4), shot, moving, makes, keys,
//     placed; ready, readyBias (on
//     the tick whose step cuts to a live shot — by it, or plainly to its values: 1 that shot was ready, 0 it was not,
//     and its bias: the most its views were asked coarser by; else −1); lacks (R.lacks:
//     pages, mirrors, cells, land — what a held frame still lacked); cycle (sheets.cycle: sent, evicted, denied, bias,
//     own — the pressure the frame's own views were drawn at —, again — their pages placed again —, wanted — the pages
//     they and `toward`'s first named —, named, has, insert — the largest closed insert's units —, room — the units
//     the frame's own views had); step (the detail run: ms of this callback's step by part — director, world, animates, people,
//     camera, lights; null, or −1 where no step was made: kept as −1); tick (the detail run: ms of this callback by its
//     own parts — pace, step, show, render, after (what follows the frame: the pacer's, the messages to the page) —,
//     else null; −1 where the part did not run); wide (the detail run: R.wide — the asks by kind of quad, the views asked
//     and why, the culls: its names are R.wideNames, kept as fields after `R shape …`); counters (R.counters, with `shapes`: the lit points by shape); times (R.timing: its stages, then its passes — per name { js, gpu } ms; null when not detail).
//     Every callback is kept, the held ones as the others: their js, times, lacks and cycle say where a held
//     picture's time goes and what it waits for.
//   segment(name, stamped) — a segment of the run begins (the stand's scenario): what the renderer has counted of the elements
//     stamped so far (R.stamped(): cumulative, or null), kept with the moment.
//   take(extra) — what was kept since start(): { fields, rows, passes, times, inputs, cuts, opening (the first show's
//     marks, and mounted), shows (every show's marks, in order), first } and what
//     the thread adds (ST3): memory (gpu.memory()), gpu (the adapter's info, as plain words), stats (sheets.stats()).
//     fields — the rows' names: the row's own, `ready`, `ready bias`, `opened`, `lacks <what>`, `cycle <what>`, `step <part>`,
//     `tick <part>` (and `tick stand`: what this very tick() cost, written last — the stand's own bookkeeping, which
//     the row's `js` does not hold), `R <counter>`, `R shape <number>` (by RENDER's SHAPE numbers); rows — fields.length numbers a row, the oldest
//     first (MAX at most, as the inputs and the cuts); inputs — [{ at, ms, ticks, drawn }]; cuts — [{ shot, at, ms,
//     ticks, drawn, placed, sent }] — ms to the frame drawn and the callbacks that RAN till then (those the pacer
//     skipped are not counted: an input answered by the next run callback is 1 at any step of the pacer); one whose
//     frame was never drawn — a cut another cut overtook, or one still waited for at take(); an input still waiting —
//     is told as such: drawn false, ms −1, the callbacks it waited (placed, sent −1). first — { placed, sent } at the
//     first frame drawn; passes — the names of R.timing (null when not detail), times — 2 × passes.length numbers a
//     row: each one's js, then each one's gpu (−1: not run, not told).
const OWN = ['at', 'ran', 'state', 'every', 'late', 'js', 'cost', 'shot', 'moving', 'makes', 'keys', 'placed', 'ready', 'ready bias', 'late by', 'submitted', 'opened', 'story'];
// (R.lacks' numbers, sheets.cycle's, the step's parts, the tick's, R.counters' by RN8's names)
const LACKS = ['pages', 'mirrors', 'cells', 'land'], CYCLE = ['sent', 'evicted', 'denied', 'bias', 'own', 'again', 'wanted', 'named', 'has', 'insert', 'room'], STEP = ['director', 'world', 'animates', 'people', 'camera', 'lights'], TICK = ['pace', 'step', 'show', 'render', 'after'];
const COUNTERS = ['frames', 'drawn', 'held', 'idle', 'pixels', 'draws', 'triangles', 'placed', 'lit', 'mirrored', 'blended', 'particles', 'people', 'quads', 'listed', 'asked', 'persons', 'shown'];
// (WAITING: inputs waiting for their frame at once, at most; an input kept: at, ms, ticks, drawn; a cut: shot, at, ms,
// ticks, drawn, placed, sent)
const MAX = 1 << 15, WAITING = 256, INPUT = 4, CUT = 7;

export function createStand(origin, detail, stats) {
  // (opening: mounted's moment and the first show's marks; shows: each show's marks, the last the one marked now)
  const inputs = new Float64Array(MAX * INPUT), cuts = new Float64Array(MAX * CUT), opening = {}, shows = [], first = { placed: -1, sent: -1 };
  // (the inputs waiting for their frame: when each arrived, the run callbacks it has waited)
  const waitingAt = new Float64Array(WAITING), waitingTicks = new Float64Array(WAITING);
  // (the rows: their names and their buffer made by the first row — the shapes RENDER counts are known then; the
  // stages and passes: named by the first row that has them, their buffer made then, once)
  const segments = [];
  let fields = null, rows = null, N = 0, standAt = 0, shapes = 0, passes = null, times = null, P = 0;
  // n, inputsN, cutsN: rows, inputs, cuts kept since start() (each buffer a ring: the last MAX stay); waitingN: the
  // inputs waiting; cutting: a cut's frame is waited for — cutShot, cutAt, cutTicks (the run callbacks since)
  let n = 0, inputsN = 0, cutsN = 0, waitingN = 0, on = false, shot = -1, cutting = false, cutShot = 0, cutAt = 0, cutTicks = 0;
  const now = () => origin + performance.now();
  // the last MAX of a ring of `count` entries, `width` numbers each, the oldest first — each made by of(buffer, offset)
  const kept = (ring, count, width, of) => {
    const out = [];
    for (let i = Math.max(0, count - MAX); i < count; i++) out.push(of(ring, (i % MAX) * width));
    return out;
  };
  // (a cut kept: its frame drawn — with the pages placed and sent by then —, or never)
  function cut(ms, drawn) {
    const q = (cutsN++ % MAX) * CUT, s = drawn ? stats() : null;
    cuts[q] = cutShot; cuts[q + 1] = cutAt; cuts[q + 2] = ms; cuts[q + 3] = cutTicks; cuts[q + 4] = drawn ? 1 : 0; cuts[q + 5] = s ? s.placed : -1; cuts[q + 6] = s ? s.sent : -1;
  }
  // (a display callback ended: its row kept)
  function record(row) {
    const c = row.counters, t = detail ? row.times : null, L = row.lacks, Y = row.cycle, S = detail ? row.step : null, T = detail ? row.tick : null;
    if (!rows) {
      shapes = c.shapes.length;
      fields = [...OWN, ...LACKS.map(k => `lacks ${k}`), ...CYCLE.map(k => `cycle ${k}`), ...STEP.map(k => `step ${k}`), ...TICK.map(k => `tick ${k}`), 'tick stand', ...COUNTERS.map(k => `R ${k}`), ...Array.from({ length: shapes }, (_, k) => `R shape ${k}`)];
      if (detail) fields.push(...row.wideNames);
      N = fields.length; standAt = fields.indexOf('tick stand'); rows = new Float64Array(MAX * N);
    }
    const i = n % MAX;
    let o = i * N;
    rows[o++] = row.at; rows[o++] = row.ran ? 1 : 0; rows[o++] = row.state; rows[o++] = row.every;
    rows[o++] = row.late ? 1 : 0; rows[o++] = row.js; rows[o++] = row.cost; rows[o++] = row.shot;
    rows[o++] = row.moving ? 1 : 0; rows[o++] = row.makes; rows[o++] = row.keys; rows[o++] = row.placed;
    rows[o++] = row.ready; rows[o++] = row.readyBias; rows[o++] = row.lateBy; rows[o++] = row.submitted;
    rows[o++] = row.opened; rows[o++] = row.story ? 1 : 0;
    for (let k = 0; k < LACKS.length; k++) rows[o++] = Number(L[LACKS[k]]);
    for (let k = 0; k < CYCLE.length; k++) rows[o++] = Y[CYCLE[k]];
    for (let k = 0; k < STEP.length; k++) rows[o++] = S ? S[STEP[k]] : -1;
    for (let k = 0; k < TICK.length; k++) rows[o++] = T ? T[TICK[k]] : -1;
    rows[o++] = -1;
    for (let k = 0; k < COUNTERS.length; k++) rows[o++] = c[COUNTERS[k]];
    for (let k = 0; k < shapes; k++) rows[o++] = c.shapes[k];
    if (detail) { rows.set(row.wide, o); o += row.wide.length; }
    if (t && !passes) { passes = Object.keys(t); P = passes.length; times = new Float64Array(MAX * 2 * P).fill(-1); }
    if (times) {
      const q = i * 2 * P;
      for (let k = 0; k < P; k++) {
        const p = t ? t[passes[k]] : null;
        times[q + k] = p && p.js >= 0 ? p.js : -1;
        times[q + P + k] = p && p.gpu >= 0 ? p.gpu : -1;
      }
    }
    n++;
    // the moment this callback's work ended: its frame, if it drew one, was drawn by then
    const done = row.at + row.js, drew = row.state === 2;
    // a new shot: from the tick that cut to it till a frame of it is drawn — a cut another overtakes was never drawn
    if (row.shot !== shot) {
      if (cutting) cut(-1, false);
      if (shot >= 0) { cutting = true; cutShot = row.shot; cutAt = row.at; cutTicks = 0; }
      shot = row.shot;
    }
    // (what waits counts the callbacks that RAN: one the pacer skipped is the frames' matter, not a wait's — ST3)
    if (!row.ran) return;
    if (cutting) {
      cutTicks++;
      if (drew) { cut(done - cutAt, true); cutting = false; }
    }
    // the inputs waiting: drawn with (2); needing no frame — nothing was due after them (1): let go; held (0): on
    if (row.state === 0) { for (let w = 0; w < waitingN; w++) waitingTicks[w]++; return; }
    if (drew) {
      for (let w = 0; w < waitingN; w++) {
        const q = (inputsN++ % MAX) * INPUT;
        inputs[q] = waitingAt[w]; inputs[q + 1] = done - waitingAt[w]; inputs[q + 2] = waitingTicks[w] + 1; inputs[q + 3] = 1;
      }
    }
    waitingN = 0;
  }
  return {
    mark(what) {
      if (what === 'mounted') { if (!('mounted' in opening)) opening.mounted = now(); return; }
      if (what === 'shown') shows.push({});
      const marks = shows[shows.length - 1];
      if (!marks || what in marks) return;
      marks[what] = now();
      if (shows.length > 1) return;
      opening[what] = marks[what];
      if (what === 'drawn') { const s = stats(); first.placed = s.placed; first.sent = s.sent; }
    },
    input() { if (on && waitingN < WAITING) { waitingAt[waitingN] = now(); waitingTicks[waitingN] = 0; waitingN++; } },
    start() {
      performance.mark('stand:scene');
      segments.length = 0;
      on = true; n = 0; shot = -1; cutting = false;
      inputsN = 0; cutsN = 0; waitingN = 0;
    },
    tick(row) {
      if (!on) return;
      if (!detail) { record(row); return; }
      const began = performance.now();
      record(row);
      rows[((n - 1) % MAX) * N + standAt] = performance.now() - began;
    },
    segment(name, stamped) { if (on) segments.push({ name, at: now(), stamped }); },
    take(extra) {
      const k = Math.min(n, MAX), out = new Float64Array(k * N), outTimes = times ? new Float64Array(k * 2 * P) : null;
      for (let i = 0; i < k; i++) {
        const from = (n - k + i) % MAX;
        out.set(rows.subarray(from * N, from * N + N), i * N);
        if (outTimes) outTimes.set(times.subarray(from * 2 * P, (from + 1) * 2 * P), i * 2 * P);
      }
      on = false;
      // (what still waits is told as such — a cut whose frame has not been drawn, the inputs no frame has answered:
      // never left out)
      const cutsNow = kept(cuts, cutsN, CUT, (b, q) => ({ shot: b[q], at: b[q + 1], ms: b[q + 2], ticks: b[q + 3], drawn: b[q + 4] === 1, placed: b[q + 5], sent: b[q + 6] }));
      if (cutting) cutsNow.push({ shot: cutShot, at: cutAt, ms: -1, ticks: cutTicks, drawn: false, placed: -1, sent: -1 });
      const inputsNow = kept(inputs, inputsN, INPUT, (b, q) => ({ at: b[q], ms: b[q + 1], ticks: b[q + 2], drawn: b[q + 3] === 1 }));
      for (let w = 0; w < waitingN; w++) inputsNow.push({ at: waitingAt[w], ms: -1, ticks: waitingTicks[w], drawn: false });
      return {
        fields, rows: out, passes, times: outTimes, opening: { ...opening }, shows: shows.map(m => ({ ...m })), first: { ...first },
        inputs: inputsNow, cuts: cutsNow,
        segments, stamped: extra?.stamped ?? null,
        memory: extra?.memory ?? null, stats: extra?.stats ?? null, gpu: extra?.gpu ?? null,
      };
    },
  };
}
