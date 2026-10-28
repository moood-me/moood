// The artist: one thread per scene shown (the scene's thread starts a new one for every scene and ends the old one —
// paint code that never returns cannot hold the next scene). It runs every element's paint code into display lists
// (sheets/easel.js, sheets/recorder.js) and bakes the land's height field; it touches no GPU and keeps no time (1.2,
// 5.6). One artist, not a pool: the scenes' libs keep tables between the paintings of a scene.
//   It holds its own copy of the scene's code — the spec compiled (world/spec.js: the same as the thread's, by
// index), the kit, the lib and the modules (world/kit.js: run here once, and once in the scene's thread — LG3), the land
// function (world/relief.js) — and a mirror of the state's keys.
//   Messages (SH6), taken in the order they come, one at a time:
//   { t: 'show', spec, modules } — once, first.
//   { t: 'keys', keys, values } — the keys changed since the last one (values[k]: keys[k]'s; null: gone), in front of
//     a make.
//   { t: 'make', job, index, as, spot } → { t: 'made', job, rec, form, parts, layers, lights, points, notes, reads,
//     seen, errors, warnings } — easel.js says what each is; the recordings as sent (Recording.wire(), their numbers'
//     memory and their images moved). A make always answers: what went wrong is in `errors`, and `rec` is null —
//     with no form, part or layer — where the painting's code threw, its form was refused, or it could not be sent.
//   { t: 'land', region } → { t: 'landed', field } — the height field over the region (null: the scene has no land).
// What the compiled spec and the shared code say as they are made here is not sent on: the scene's thread makes the
// same of the same texts and says it once. What only this thread can know — a paint code that is no function, what a
// painting throws or warns of — goes with its make.
//   A message this thread cannot take at all (not one of SH6's as it should be, an answer that cannot be posted) is an
// uncaught error of the worker (reportError): the scene's thread hears it (artist.onerror → world.fail). The messages
// after it are taken as ever.
import { compile } from '../world/spec.js';
import { kit } from '../world/kit.js';
import { landOf, fieldOf } from '../world/relief.js';
import { Recording, PaintPath } from './recorder.js';
import { createEasel } from './easel.js';

// a painting's `new Path2D()` is one that knows its commands
globalThis.Path2D = PaintPath;

const state = {}, late = [];
let make = null, land = null, failed = 'the scene was not shown to the artist';

async function show(m) {
  const C = compile(m.spec, text => { late.push(String(text)); }, kit.words(m.modules));
  const shared = await kit.shared(m.spec, m.modules);
  land = landOf(C, shared);
  make = createEasel(C, shared, land, state, late);
}
// (a make that could not be made: no painting, and why)
const nothing = why => ({ rec: null, form: null, parts: [], layers: [], lights: [], points: [], notes: [], reads: [], seen: [], errors: [why], warnings: [] });
async function made(m) {
  const moved = [];
  const sent = async rec => { const w = await rec.wire(); for (const t of Recording.transfers(w)) moved.push(t); return w; };
  // (what the painting's code throws the easel takes itself; a fault of the easel is this thread's uncaught error)
  const out = make ? make(m.index, m.as, m.spot) : nothing(failed);
  if (out.rec) {
    try {
      out.rec = await sent(out.rec);
      for (const p of out.parts) p.rec = await sent(p.rec);
      for (const l of out.layers) l.rec = await sent(l.rec);
      if (out.form) moved.push(out.form.points.buffer);
    } catch (err) {
      // (what it painted cannot be sent — an image of its own that is no picture: said, and no painting; what it
      // read and warned of goes with it all the same. The images already made of this make's recordings to be sent
      // are closed: nothing takes them now)
      for (const t of moved) if (t instanceof ImageBitmap) t.close();
      moved.length = 0;
      out.rec = null; out.form = null; out.parts = []; out.layers = [];
      out.errors.push(`its painting could not be sent: ${err?.message || err}`);
    }
  }
  self.postMessage({ t: 'made', job: m.job, ...out }, moved);
}

async function taken(m) {
  if (m.t === 'show') {
    try { await show(m); } catch (err) { failed = String(err?.message || err); make = null; }
  } else if (m.t === 'keys') {
    for (let k = 0; k < m.keys.length; k++) { if (m.values[k] == null) delete state[m.keys[k]]; else state[m.keys[k]] = m.values[k]; }
  } else if (m.t === 'make') {
    await made(m);
  } else if (m.t === 'land') {
    const field = land ? fieldOf(land, m.region) : null;
    self.postMessage({ t: 'landed', field }, field ? [field.data.buffer] : []);
  }
}
// one at a time, in the order they come; one that fails is reported as the worker's uncaught error, and the next is
// taken all the same
let last = Promise.resolve();
self.onmessage = ({ data: m }) => { last = last.then(() => taken(m)).catch(reportError); };
