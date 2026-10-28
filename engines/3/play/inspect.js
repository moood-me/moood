// What is where, for whoever looks closely: a render's --json and --debug, ?debug over the frame, the selection's box,
// the P panel.
//   layout(view): by element (its id, else its name, else its kind and place in the spec) — { kind, seen, box: [x, y, w,
// h] (where its painting may reach, the place's CSS px), anchor: [x, y], at — the point it marks as itself, points —
// those it names ({name: [x, y]}), distance (metres along the gaze), fade (1; less in the last steps before the eye),
// parts — [{dx, dz, box, seen, distance}], notes — what its code wrote (e.debug: {value, at?}), paint — { repaint:
// 'state' (it reads keys: painted again as they change) | 'once', keys, repaints } }. view: another Camera than the
// film's (a moment drawn as another camera sees it).
//   overlay(): drawn over the frame (?debug; =keeper,boy — only those): each element seen, its box and id, its anchor (a
// ring), its point (a cross), its named points, its parts, its notes; the scene's errors and warnings; the time.
//   perf(): the P panel's text — the ticks' intervals by the display's timestamps, what the frames were (drawn, idle,
// held), the pacer's step, the renderer's counters, the GPU's memory, the sheets' numbers. No clock is read for it.
import { PASS } from '../base.js';
import { project } from './camera.js';

const r1 = v => Math.round(v * 10) / 10;
const fadeOf = D => Math.max(0, Math.min(1, (D - PASS.FROM) / (PASS.TO - PASS.FROM)));
const hue = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) % 360; };

// world, camera (play/camera.js: its `seen` — the whole canvas — is what a Camera's projection maps onto; its `rect`
// the safe frame inside it), state, host: { w, h, dpr, overlay }
export function createInspect(world, camera, state, host) {
  const V = new Float64Array(3), out = [0, 0, 0], M = world.tables.nodes;
  // (the camera it is seen from: the film's, or another — layout(view))
  let view = null;
  const cam = () => view ?? camera.camera;
  const projectXY = v => { const p = project(cam(), v, camera.seen, out); return p ? [r1(p[0]), r1(p[1]), p[2]] : null; };
  // a rectangle of el's painting (box, on its base sheet or — part ≥ 0 — a part's) as seen — what of it is before the
  // eye: [x, y, w, h] into b, and into s its anchor, its depth, its fade, whether it is in the frame — false: behind
  // the eye. Nothing made (the selection's box is asked every tick)
  const ring = [0, 1, 2, 3].map(() => new Float64Array(3)), kept = [0, 1, 2, 3, 4, 5, 6, 7].map(() => new Float64Array(3)), CORNER = [0, 1, 2, 1, 2, 3, 0, 3];
  const sight = { anchor: [0, 0], hasAnchor: false, distance: 0, fade: 0, inFrame: false }, corner = { x: 0, y: 0, part: -1, layer: -1 };
  function seenInto(el, copy, part, node, box, b, s) {
    const C = cam(), R = C.rot, P = C.proj, r = camera.seen;
    // its corners where the eye sees them (its space: −z ahead), the part before the near plane cut off
    for (let i = 0; i < 4; i++) {
      corner.x = box[CORNER[2 * i]]; corner.y = box[CORNER[2 * i + 1]]; corner.part = part;
      world.sheetPoint(el, copy, corner, C.yaw, V);
      const dx = V[0] - C.eye[0], dy = V[1] - C.eye[1], dz = V[2] - C.eye[2];
      ring[i][0] = R[0] * dx + R[3] * dy + R[6] * dz; ring[i][1] = R[1] * dx + R[4] * dy + R[7] * dz; ring[i][2] = R[2] * dx + R[5] * dy + R[8] * dz;
    }
    let n = 0;
    for (let i = 0; i < 4; i++) {
      const p = ring[i], q = ring[(i + 1) % 4], pin = -p[2] >= PASS.FROM, qin = -q[2] >= PASS.FROM;
      if (pin) kept[n++].set(p);
      if (pin !== qin) { const f = (-PASS.FROM - p[2]) / (q[2] - p[2]), k = kept[n++]; k[0] = p[0] + (q[0] - p[0]) * f; k[1] = p[1] + (q[1] - p[1]) * f; k[2] = p[2] + (q[2] - p[2]) * f; }
    }
    if (!n) return false;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, depth = Infinity;
    for (let i = 0; i < n; i++) {
      const p = kept[i], d = -p[2];
      depth = Math.min(depth, d);
      const x = r.x + ((P[0] * p[0] - P[8] * d) / d + 1) / 2 * r.w, y = r.y + (1 - (P[5] * p[1] - P[9] * d) / d) / 2 * r.h;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const o = 12 * node;
    V[0] = M.m[o + 9]; V[1] = M.m[o + 10]; V[2] = M.m[o + 11];
    const a = project(C, V, r, out);
    // (what reaches past the place — a floor going under the eye — as far as its edge)
    x0 = Math.max(-host.w, x0); x1 = Math.min(2 * host.w, x1); y0 = Math.max(-host.h, y0); y1 = Math.min(2 * host.h, y1);
    b[0] = r1(x0); b[1] = r1(y0); b[2] = r1(x1 - x0); b[3] = r1(y1 - y0);
    const D = a ? a[2] : depth;
    s.inFrame = b[0] < r.x + r.w && b[0] + b[2] > r.x && b[1] < r.y + r.h && b[1] + b[3] > r.y;
    s.hasAnchor = !!a; if (a) { s.anchor[0] = r1(a[0]); s.anchor[1] = r1(a[1]); }
    s.distance = r1(D); s.fade = Math.round(fadeOf(D) * 100) / 100;
    return true;
  }
  // (the same, as an object of its own: what is where, asked now and then)
  function seen(el, part, node, box) {
    const b = [0, 0, 0, 0];
    if (!seenInto(el, 0, part, node, box, b, sight)) return null;
    return { box: b, anchor: sight.hasAnchor ? [sight.anchor[0], sight.anchor[1]] : null, distance: sight.distance, fade: sight.fade, inFrame: sight.inFrame };
  }
  const pointAt = (el, p) => { world.sheetPoint(el, 0, p, cam().yaw, V); const q = projectXY(V); return q && [q[0], q[1]]; };
  const personBox = new Float32Array(4), pp = new Float64Array(3);
  // where an element's box is in the place now ([x, y, w, h], CSS px — into b), or null — the selection's, for the
  // page's card; from: the Camera it is seen from (the frame's: f.camera — IN4), else the film's. The sky: the whole
  // canvas; an insert: the safe frame it is laid over
  function boxOf(el, b = [0, 0, 0, 0], from = null) {
    if (el.kind === 'sky' || el.kind === 'insert') { const r = el.kind === 'sky' ? camera.seen : camera.rect; b[0] = r.x; b[1] = r.y; b[2] = r.w; b[3] = r.h; return b; }
    const box = el.kind === 'person' ? (world.people?.box(el.id, personBox) ? personBox : null) : el.box;
    view = from;
    const seen = !!box && seenInto(el, 0, -1, el.node, box, b, sight);
    view = null;
    return seen ? b : null;
  }
  function layout(from = null) {
    view = from;
    const all = {}, tick = world.step;
    world.elements.forEach((el, i) => {
      const key = el.id ?? el.spec.name ?? `${el.kind}#${i}`, r = el.kind === 'insert' ? camera.rect : camera.seen, e = { kind: el.kind };
      if (el.kind === 'sky' || el.kind === 'insert') { e.box = [r1(r.x), r1(r.y), r1(r.w), r1(r.h)]; e.seen = el.kind === 'sky' || el.open > 0; }
      // (weather fills the air round the eye: the whole canvas, seen while it gives — wherever its element stands)
      else if (el.spec.particles?.around) { e.box = [r1(r.x), r1(r.y), r1(r.w), r1(r.h)]; e.seen = el.visible && (el.emitter?.amount ?? 0) > 0; }
      else if (el.kind === 'person') {
        const s = world.people?.box(el.id, personBox) ? seen(el, -1, el.node, personBox) : null;
        Object.assign(e, s ? { box: s.box, anchor: s.anchor, distance: s.distance, fade: s.fade, seen: el.visible && s.inFrame && s.fade > 0 } : { seen: false });
        if (world.people?.point(el.id, 'head', pp)) e.at = (q => q && [q[0], q[1]])(projectXY(pp));
      } else {
        const s = seen(el, -1, el.node, el.box);
        Object.assign(e, s ? { box: s.box, anchor: s.anchor, distance: s.distance, fade: s.fade, seen: el.visible && s.inFrame && s.fade > 0 } : { seen: false });
        const at = world.markOf(el, null);
        if (at) e.at = pointAt(el, at);
        const names = new Set([...el.painted.keys(), ...[...el.marked.keys()].filter(k => el.marked.get(k).tick === tick)].filter(k => k !== null));
        if (names.size) { e.points = {}; for (const n of names) e.points[n] = pointAt(el, world.markOf(el, n)); }
        if (el.partSlots.length) e.parts = el.partSlots.map((p, k) => { const q = seen(el, k, p.nodes[0], p.box); return q ? { dx: p.dx, dz: p.dz, box: q.box, seen: q.inFrame && q.fade > 0, distance: q.distance } : { dx: p.dx, dz: p.dz, seen: false }; });
      }
      const n = [...el.notes, ...el.animNotes];
      if (n.length) e.notes = n.map(x => (x.at ? { value: x.value, at: pointAt(el, x.at) } : { value: x.value }));
      if (el.spec.paints) e.paint = { repaint: el.reads.size || el.spec.redraw ? 'state' : 'once', ...(el.reads.size ? { keys: [...el.reads] } : {}), ...(el.repaints > 1 ? { repaints: el.repaints - 1 } : {}) };
      all[key] = e;
    });
    view = null;
    return all;
  }
  // ?debug: over the frame (only: the ids to draw, or null — all)
  function overlay(only, t, errors, warnings) {
    const c = host.overlay;
    if (!c) return;
    const g = c.getContext('2d'), dpr = host.dpr || 1, cw = Math.max(1, host.w), ch = Math.max(1, host.h);
    if (c.width !== Math.round(cw * dpr) || c.height !== Math.round(ch * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cw, ch);
    g.font = '12px ui-monospace, Consolas, monospace'; g.textBaseline = 'top'; g.lineWidth = 1;
    const say = v => (typeof v === 'string' ? v : JSON.stringify(v, (k, x) => (typeof x === 'number' ? Math.round(x * 100) / 100 : x)) ?? String(v)).replace(/"/g, '');
    const label = (text, x, y, col) => { const w = g.measureText(text).width + 6; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x, y, w, 15); g.fillStyle = col; g.fillText(text, x + 3, y + 1.5); };
    const ids = only ? new Set(only.split(',')) : null, r = camera.seen;
    for (const [id, el] of Object.entries(layout())) {
      if (!el.seen || el.kind === 'sky' || !el.box || (ids && !ids.has(id))) continue;
      const col = `hsl(${hue(id)},85%,70%)`, [x, y, w, h] = el.box;
      g.globalAlpha = w * h > 0.5 * r.w * r.h ? 0.4 : 1;
      g.strokeStyle = col; g.setLineDash(el.kind === 'insert' || el.kind === 'plane' ? [4, 4] : []);
      g.strokeRect(x + 0.5, y + 0.5, w, h); g.setLineDash([]);
      if (el.anchor) { g.beginPath(); g.arc(el.anchor[0], el.anchor[1], 4, 0, 7); g.stroke(); }
      if (el.at) { const [ax, ay] = el.at; g.beginPath(); g.moveTo(ax - 7, ay); g.lineTo(ax + 7, ay); g.moveTo(ax, ay - 7); g.lineTo(ax, ay + 7); g.stroke(); }
      for (const [nm, q] of Object.entries(el.points || {})) {
        if (!q) continue;
        const [qx, qy] = q;
        g.beginPath(); g.moveTo(qx, qy - 5); g.lineTo(qx + 5, qy); g.lineTo(qx, qy + 5); g.lineTo(qx - 5, qy); g.closePath(); g.stroke();
        label(`#${nm}`, qx + 7, qy - 7, col);
      }
      g.setLineDash([2, 3]);
      for (const q of el.parts || []) if (q.seen) g.strokeRect(q.box[0] + 0.5, q.box[1] + 0.5, q.box[2], q.box[3]);
      g.setLineDash([]);
      const lx = Math.max(r.x, Math.min(x, r.x + r.w - 160)), ly = Math.max(r.y, y);
      label(id, lx, ly, col);
      (el.notes || []).forEach((nt, i) => {
        const text = say(nt.value).slice(0, 90);
        if (nt.at) { g.fillStyle = col; g.fillRect(nt.at[0] - 2, nt.at[1] - 2, 4, 4); label(text, nt.at[0] + 5, nt.at[1] - 7, col); } else label(text, lx, ly + 16 * (i + 1), col);
      });
      g.globalAlpha = 1;
    }
    const wrong = [...errors, ...warnings];
    if (wrong.length > 6) label(`… ${wrong.length - 6} more (window.__mooodErrors, __mooodWarnings)`, r.x + 8, r.y + 8, '#ffb4a0');
    wrong.slice(-6).forEach((m, i) => label(m.slice(0, 200), r.x + 8, r.y + 8 + 16 * (i + (wrong.length > 6)), '#ffb4a0'));
    const target = state.value('camera_target');
    label(`${t.toFixed(2)} s${target != null ? ` · camera_target ${target}` : ''}`, r.x + 8, r.y + r.h - 23, '#fff');
  }
  // the P panel: what the scene's ticks were over the last `seconds` of display timestamps. W: { ticks, ran, drawn,
  // held, idle, worst (the longest interval between run callbacks, ms) }; every: the pacer's step; period: the
  // display's (ms); counters: R.counters; memory: gpu.memory(); stats: sheets.stats()
  function perf(W, seconds, size, every, period, counters, memory, stats) {
    const line = (v, k) => `\n  ${String(v).padStart(11)}  ${k}`, mb = v => `${(v / 1048576).toFixed(1)} MB`;
    const pairs = o => Object.entries(o || {}).filter(([, v]) => typeof v === 'number' || typeof v === 'string').map(([k, v]) => line(typeof v === 'number' ? Math.round(v * 100) / 100 : v, k)).join('');
    return `engine 3 · ${size} · the last ${seconds.toFixed(2)} s: ${W.ticks} display callbacks, ${W.ran} run, ${W.drawn} drawn, ${W.idle} idle, ${W.held} held`
      + `\n  the display: ${(1000 / period).toFixed(1)} Hz; a frame every ${every} refresh${every > 1 ? 'es' : ''}; the longest wait between run callbacks ${W.worst.toFixed(1)} ms`
      + `\nrenderer${pairs(counters)}`
      + (memory ? `\ngpu memory${line(mb(memory.textures), 'textures')}${line(mb(memory.targets), 'targets')}${line(mb(memory.buffers), 'buffers')}${line(mb(memory.total), 'total')}` : '')
      + (stats ? `\nsheets${pairs(stats)}` : '');
  }
  return { layout, boxOf, overlay, perf };
}
