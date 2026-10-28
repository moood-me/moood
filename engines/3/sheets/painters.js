// A painter: a thread of its own that rasters pages of the sheets (sheets/cache.js starts host.painters of them) — so
// paintings are painted beside the scene's thread, several at once. It runs no scene code: it is sent every sheet's
// recording once (its numbers, its gradients and images as they are sent: sheets/recorder.js) and replays the part of
// it that lies in each page asked — on the CPU, in a canvas that is read (sheets/page.js) —, reads the alpha to say
// what the page is (empty, opaque in every pixel, or with some opaque paint; a top comes with its mask: SH4), and
// hands the pixels over as the canvas gave them: the scene's thread writes them into the cache, converted and halved
// on the GPU (sheets/upload.js). A picture (SH9) is the bytes of a whole recording, over its rect, with no half level.
//   Messages (from cache.js): { t: 'start', stand } — first: whether the thread was mounted with the stand (then it
// reads its clock round each job and tells the job's `ms` with its answer; else it reads no clock);
// { t: 'set', id, rec, lay } — sheet `id` (its recording, its layout); { t: 'drop', id }
// — the sheet is no more: its recording's images, this thread's copies, are closed (SH1);
// { t: 'pages', job, list: [{ id, L, i, j, w, h, top }] } → { job, pages: [{ pixels, kind, mask?, mw?, mh? } |
// { kind } (empty: no bytes) | { error }] } — many tops to a job, one page else, the bytes moved; { t: 'back',
// buffers } — the bytes of pages the scene's thread has written to the GPU, given back to be let go here (the scene's
// thread collects none of them: SH11);
// { t: 'picture', job, rec, w, h } → { job, pixels } | { job, error } — a whole recording into w × h (a particle's
// sprite: SH9); the recording made for it is closed once it is rastered, or has thrown (its images are this thread's
// copies).
import { Recording } from './recorder.js';
import { paintPage, pageContext, cellInside, kindOf, convert, topMask, KIND } from './page.js';

const sheets = new Map(), contexts = new Map(), inside = [0, 0, 0, 0];
let timed = false;
// (a canvas for each size: a canvas resized is a canvas made anew)
function contextOf(w, h) {
  const key = w * 65536 + h;
  let g = contexts.get(key);
  if (!g) contexts.set(key, g = pageContext(new OffscreenCanvas(w, h)));
  return g;
}

self.onmessage = ({ data: m }) => {
  if (m.t === 'start') { timed = !!m.stand; return; }
  if (m.t === 'back') return;
  const began = timed && (m.t === 'pages' || m.t === 'picture') ? performance.now() : 0;
  if (m.t === 'set') { sheets.set(m.id, { rec: Recording.fromWire(m.rec), lay: m.lay }); return; }
  if (m.t === 'drop') { sheets.get(m.id).rec.close(); sheets.delete(m.id); return; }
  if (m.t === 'picture') {
    let rec = null;
    try {
      rec = Recording.fromWire(m.rec);
      const R = rec.rect, g = contextOf(m.w, m.h), k = m.w / (R[2] - R[0]);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, m.w, m.h);
      // (the rect's height onto the picture's: its own stretch, kept by the replay)
      g.setTransform(1, 0, 0, m.h / ((R[3] - R[1]) * k), 0, 0);
      rec.replay(g, R, k);
      const pixels = convert(g.getImageData(0, 0, m.w, m.h).data, m.w, m.h), out = { job: m.job, pixels };
      if (timed) out.ms = performance.now() - began;
      self.postMessage(out, [pixels.buffer]);
    } catch (err) {
      const out = { job: m.job, error: String(err?.message || err) };
      if (timed) out.ms = performance.now() - began;
      self.postMessage(out);
    } finally {
      if (rec) rec.close();
    }
    return;
  }
  const pages = [], moved = [];
  for (const p of m.list) {
    try {
      const s = sheets.get(p.id);
      if (!s) throw new Error('its painting is not with the painter');
      const g = contextOf(p.w, p.h);
      paintPage(g, s.rec, s.lay, p.L, p.i, p.j, p.w, p.h);
      const px = g.getImageData(0, 0, p.w, p.h).data, kind = kindOf(px, p.w, cellInside(s.lay, p.L, p.i, p.j, p.w, p.h, inside));
      if (kind & KIND.EMPTY) { pages.push({ kind }); continue; }
      const page = { pixels: px, kind };
      moved.push(px.buffer);
      if (p.top) { Object.assign(page, topMask(px, s.lay, p.w, inside)); moved.push(page.mask.buffer); }
      pages.push(page);
    } catch (err) {
      pages.push({ error: String(err?.message || err) });
    }
  }
  const out = { job: m.job, pages };
  if (timed) out.ms = performance.now() - began;
  self.postMessage(out, moved);
};
