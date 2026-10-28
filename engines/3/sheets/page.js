// A sheet as pages, and a page as its bytes — what the scene's thread (sheets/cache.js, sheets/ask.js) and the painters
// (sheets/painters.js) both need of a sheet's geometry; no GPU, nothing of a browser as it is imported.
//   A sheet is a pyramid of levels over its recording's rect (the element's box, a part's, a layer's): level 0 at
// SHEET.MAX_PPM px a unit of the rect (metres; stage heights for the sky and inserts), each level above half as fine,
// up to its top — the first level no larger than SHEET.TOP px either way, one small page. Each level is cut into pages
// of SHEET.PAGE px from the rect's corner.
//   A page is painted into its cell: the page as far as the level reaches and SHEET.BORDER px round it, painted as its
// neighbours are (a filtered read across its edge reads them). A cell is 1, 2 or 4 units either way (a unit: a quarter
// of a page and its border — a top is one unit square); a slot of the cache holds cells of one shape.
//   Past the rect's edge a cell repeats the rect's last whole column or row (as a clamped read would): a wholly opaque
// painting is opaque to its last pixel, and a read at its very edge mixes in nothing that is not its own. A level under
// one pixel across or down has no whole column or row: it is painted stretched to the pixel, so that pixel is all of
// it. Where the sheet wraps (a drifting layer, a sky round the circle) the painting's other side is painted past the
// edge instead — in a corner of a sheet that wraps both ways, its diagonal neighbour.
//   What a page is: a painter reads its canvas's alpha and says whether it is empty, opaque in every pixel, or with
// some opaque paint (kindOf), and a top's mask; the canvas itself goes to the cache as an image, made premultiplied
// linear colour stored sRGB-encoded — what the cache's format (rgba8unorm-srgb) decodes into premultiplied linear,
// filtered as light is —, with its half level beside it, on the GPU (sheets/upload.js). A picture (SH9) is turned into
// those bytes here (convert).
import { SHEET } from '../base.js';

const { PAGE, BORDER, UNIT, TOP, MAX_PPM, OPAQUE } = SHEET;
export const log2ceil = n => Math.max(0, Math.ceil(Math.log2(Math.max(1, n)) - 1e-9));

// ── cells: their shapes (units across, down: 1, 2, 4 — shape = 3 · log2 across + log2 down), where each may lie in a
// slot (its first unit, its units' bits) ──
export const FULL = 8, SHAPES = 9;
const unitsFor = n => (n <= TOP ? 1 : n <= 2 * UNIT - 2 * BORDER ? 2 : 4);
const shapeOf = (wu, hu) => Math.log2(wu) * 3 + Math.log2(hu);
export const shapeW = s => UNIT * 2 ** Math.floor(s / 3), shapeH = s => UNIT * 2 ** (s % 3);
// (how many units a cell of a shape takes of its slot's sixteen)
export const shapeUnits = s => 2 ** Math.floor(s / 3) * 2 ** (s % 3);
export const POS = [], MASK = [];
for (let s = 0; s < SHAPES; s++) {
  const wu = 2 ** Math.floor(s / 3), hu = 2 ** (s % 3), pos = [], mask = [];
  for (let uy = 0; uy < 4; uy += hu) for (let ux = 0; ux < 4; ux += wu) {
    let m = 0;
    for (let y = 0; y < hu; y++) for (let x = 0; x < wu; x++) m |= 1 << ((uy + y) * 4 + ux + x);
    pos.push(uy * 4 + ux); mask.push(m);
  }
  POS.push(Int32Array.from(pos)); MASK.push(Int32Array.from(mask));
}

// What a page is, as its painter found it (bits): nothing painted; every pixel opaque; some pixel opaque
export const KIND = Object.freeze({ EMPTY: 1, OPAQUE: 2, SOME: 4 });

// how many px at level 0 a length of a sheet's rect is (its units): whole ones, the last begun counted
export const px0 = length => Math.max(1, Math.ceil(Math.max(1e-6, length) * MAX_PPM - 1e-9));
// A sheet's layout over rect [l, t, r, b], wrapping or not across and down: { l, t, r, b, W0, H0 (px at level 0),
// levels, wrap: [x, y] } — plain numbers: the painters are sent it as it is. Where it wraps, the rect is a whole
// number of level-0 px that way (SH7: the easel lays a wrapping layer's box so), so the painting's other side — the
// rect's length away — lies W0 px away: the painters' period and the shader's are one number.
export function layOf(rect, wrap) {
  const l = rect[0], t = rect[1], r = rect[2], b = rect[3], W0 = px0(r - l), H0 = px0(b - t);
  return { l, t, r, b, W0, H0, levels: Math.min(31, Math.max(log2ceil(W0 / TOP), log2ceil(H0 / TOP)) + 1), wrap: [!!wrap[0], !!wrap[1]] };
}
// how many pages level L is, across and down
export const pagesX = (lay, L) => Math.ceil(lay.W0 / (PAGE * 2 ** L) - 1e-9);
export const pagesY = (lay, L) => Math.ceil(lay.H0 / (PAGE * 2 ** L) - 1e-9);
// the shape of page (L, i, j)'s cell: as much of the level as the page holds
export function pageShape(lay, L, i, j) {
  const k = 2 ** -L, cw = Math.ceil(Math.min(PAGE, lay.W0 * k - i * PAGE) - 1e-9), ch = Math.ceil(Math.min(PAGE, lay.H0 * k - j * PAGE) - 1e-9);
  return shapeOf(unitsFor(cw), unitsFor(ch));
}
// Whether nothing is painted in page (L, i, j): no draw of the recording reaches its cell — what paintPage paints there:
// the cell within the rect, a px more each way (what a replay takes as touching), and, where the sheet wraps, the
// painting's other side in the border past its edge. Never true where something is drawn.
export function pageBlank(rec, lay, L, i, j) {
  if (rec.empty) return true;
  const s = 2 ** L / MAX_PPM, sh = pageShape(lay, L, i, j), { l, t, r, b } = lay;
  let x0 = l + (i * PAGE - BORDER) * s, y0 = t + (j * PAGE - BORDER) * s, x1 = x0 + shapeW(sh) * s, y1 = y0 + shapeH(sh) * s;
  const wx = lay.wrap[0], wy = lay.wrap[1], left = wx && x0 < l, right = wx && x1 > r, up = wy && y0 < t, down = wy && y1 > b;
  if (!wx) { x0 = Math.max(x0, l); x1 = Math.min(x1, r); }
  if (!wy) { y0 = Math.max(y0, t); y1 = Math.min(y1, b); }
  x0 -= s; y0 -= s; x1 += s; y1 += s;
  for (let dy = up ? -1 : 0; dy <= (down ? 1 : 0); dy++) {
    for (let dx = left ? -1 : 0; dx <= (right ? 1 : 0); dx++) {
      // (the painting's other side: its rect's width or height away)
      const ox = -dx * (r - l), oy = -dy * (b - t);
      if (rec.touches(x0 + ox, y0 + oy, x1 + ox, y1 + oy)) return false;
    }
  }
  return true;
}

// The one opaque colour page (L, i, j) is all over its cell, if it is one: what paintPage leaves in every pixel of
// the cell, past an edge it does not wrap round what lies inside repeated (cellInside), is that colour — the cell
// within the rect and, where the sheet wraps, the painting's other side past its edge are each one colour, the same
// (Recording.uniform: no draw reaches a part, a px round it, after a rect filled over all of it). A seam of a sheet
// that wraps within the cell must lie between two pixels (paintPage clips each side there: one within a pixel mixes
// two replays in it) → its bytes (Recording.uniform), −1: not one colour. Never a colour where a pixel is another.
export function pageSolid(rec, lay, L, i, j) {
  const k = MAX_PPM / 2 ** L, s = 1 / k, sh = pageShape(lay, L, i, j);
  const x0 = lay.l + (i * PAGE - BORDER) * s, y0 = lay.t + (j * PAGE - BORDER) * s;
  const nx = partsOf(ACROSS, x0, x0 + shapeW(sh) * s, lay.l, lay.r, lay.wrap[0], k), ny = partsOf(DOWN, y0, y0 + shapeH(sh) * s, lay.t, lay.b, lay.wrap[1], k);
  if (!nx || !ny) return -1;
  const across = ACROSS, down = DOWN;
  let colour = -1;
  for (let v = 0; v < ny; v += 2) {
    for (let u = 0; u < nx; u += 2) {
      const c = rec.uniform(across[u], down[v], across[u + 1], down[v + 1], s);
      if (c < 0 || (colour >= 0 && c !== colour)) return -1;
      colour = c;
    }
  }
  return colour;
}
// (one way of a cell from c0 to c1 over the rect's [e0, e1] as the parts of the painting it shows — [from, to] each,
// into `out`: within the rect, and where it wraps the other side past each edge → how many numbers; 0 where a seam is
// not between two pixels. The arrays kept: a page's record is made in the tick)
const ACROSS = new Float64Array(6), DOWN = new Float64Array(6);
const whole = v => Math.abs(v - Math.round(v)) < 1e-6;
function partsOf(out, c0, c1, e0, e1, wraps, k) {
  out[0] = Math.max(c0, e0); out[1] = Math.min(c1, e1);
  if (!wraps) return 2;
  let n = 2;
  if (c0 < e0) { if (!whole((e0 - c0) * k)) return 0; out[n++] = c0 + (e1 - e0); out[n++] = e1; }
  if (c1 > e1) { if (!whole((e1 - c0) * k)) return 0; out[n++] = e0; out[n++] = c1 - (e1 - e0); }
  return n;
}

// ── painting a page (a painter's) ──
export const pageContext = canvas => canvas.getContext('2d', { willReadFrequently: true });

// Page (L, i, j) of a recording laid as `lay`, replayed into g — a context of a canvas w × h px (the cell's). Where the
// sheet wraps, the painting's other side is painted past the rect's edge; where it does not, what lies there is
// taken as the rect's last whole pixel when the page is read (cellInside) — so nothing is cleared here but the whole
// cell first.
export function paintPage(g, rec, lay, L, i, j, w, h) {
  const k = MAX_PPM / 2 ** L, s = 1 / k, { l, t, r, b } = lay;
  const x0 = l + (i * PAGE - BORDER) * s, y0 = t + (j * PAGE - BORDER) * s, x1 = x0 + w * s, y1 = y0 + h * s;
  const rw = r - l, rh = b - t;
  // A level under one pixel across (or down) of a sheet that does not wrap that way: stretched about the rect's corner
  // till it is the one pixel — which is then all of the painting's width there, in its own alpha, not a part-covered
  // pixel to repeat past it (a wholly opaque strip is opaque at every level). The replay keeps this stretch.
  const sx = !lay.wrap[0] && rw * k < 1 ? 1 / (rw * k) : 1, sy = !lay.wrap[1] && rh * k < 1 ? 1 / (rh * k) : 1;
  const ox = BORDER * (1 - sx), oy = BORDER * (1 - sy);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, w, h);
  g.setTransform(sx, 0, 0, sy, ox, oy);
  const region = [x0, y0, x1, y1];
  rec.replay(g, region, k);
  // (px of the rect's edges in the cell; then, each way: the border before the rect — the painting's far side —, the
  // rect itself, the border after it: [the way the region is moved, from, to])
  const el = (l - x0) * k, er = (r - x0) * k, et = (t - y0) * k, eb = (b - y0) * k;
  const across = [[rw, 0, el], [0, Math.max(0, el), Math.min(w, er)], [-rw, er, w]], down = [[rh, 0, et], [0, Math.max(0, et), Math.min(h, eb)], [-rh, eb, h]];
  for (const [dy, cy0, cy1] of down) {
    for (const [dx, cx0, cx1] of across) {
      // (the other side across, the other side down, and — in a corner — both: the diagonal neighbour)
      if ((!dx && !dy) || (dx && !lay.wrap[0]) || (dy && !lay.wrap[1]) || cx1 <= cx0 || cy1 <= cy0) continue;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.save();
      g.beginPath(); g.rect(cx0, cy0, cx1 - cx0, cy1 - cy0); g.clip();
      g.clearRect(0, 0, w, h);
      g.setTransform(sx, 0, 0, sy, ox, oy);
      region[0] = x0 + dx; region[1] = y0 + dy; region[2] = x1 + dx; region[3] = y1 + dy;
      rec.replay(g, region, k);
      g.restore();
    }
  }
}

// The part of a cell that is painted (px: [x0, x1, y0, y1] of w × h): past an edge the sheet does not wrap round, every
// pixel is the rect's last whole pixel of its row or column there — the cache's upload repeats it (sheets/upload.js)
// and a painter's look at the page (kindOf, topMask) reads only up to it; a level under a pixel that way is one whole
// pixel (paintPage). Where it wraps, all of the cell.
export function cellInside(lay, L, i, j, w, h, into = [0, 0, 0, 0]) {
  const k = 2 ** -L;
  if (lay.wrap[0]) { into[0] = 0; into[1] = w; } else {
    into[0] = Math.max(0, BORDER - i * PAGE);
    into[1] = Math.min(w, Math.max(into[0] + 1, Math.floor(BORDER - i * PAGE + (lay.r - lay.l) * MAX_PPM * k + 1e-6)));
  }
  if (lay.wrap[1]) { into[2] = 0; into[3] = h; } else {
    into[2] = Math.max(0, BORDER - j * PAGE);
    into[3] = Math.min(h, Math.max(into[2] + 1, Math.floor(BORDER - j * PAGE + (lay.b - lay.t) * MAX_PPM * k + 1e-6)));
  }
  return into;
}

// What a page is (KIND's bits), from its cell as a canvas gives it (px: RGBA, not premultiplied, w px wide) within
// `inside` (cellInside: past it the cell repeats what is inside): nothing painted (every alpha 0); every pixel opaque
// (alpha ≥ SHEET.OPAQUE); some pixel opaque. Its alpha alone is read, and no further than the first pixel that makes
// it mixed
export function kindOf(px, w, inside) {
  let all = true, some = false, none = true;
  for (let y = inside[2]; y < inside[3]; y++) {
    for (let o = (y * w + inside[0]) * 4 + 3, end = (y * w + inside[1]) * 4 + 3; o < end; o += 4) {
      const a = px[o];
      if (a >= OPAQUE) { some = true; none = false; } else { all = false; if (a) none = false; }
      if (some && !all) return KIND.SOME;
    }
  }
  return none ? KIND.EMPTY : (all ? KIND.OPAQUE : 0) | (some ? KIND.SOME : 0);
}

// ── the bytes ──
// sRGB's curve as tables: a byte → linear 0…1; linear · 4096 → a byte
const DEC = new Float32Array(256), ENC = new Uint8Array(4097);
for (let c = 0; c < 256; c++) { const s = c / 255; DEC[c] = s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); }
for (let v = 0; v <= 4096; v++) { const x = v / 4096; ENC[v] = Math.round(255 * (x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055)); }

// A picture's pixels as a canvas gives them (px: RGBA, sRGB, not premultiplied; w × h) → premultiplied linear stored
// sRGB-encoded (SH9)
export function convert(px, w, h) {
  const n = w * h, pixels = new Uint8Array(n * 4);
  for (let o = 0, end = n * 4; o < end; o += 4) {
    const a = px[o + 3];
    if (a === 255) { pixels[o] = px[o]; pixels[o + 1] = px[o + 1]; pixels[o + 2] = px[o + 2]; pixels[o + 3] = 255; continue; }
    if (a === 0) continue;
    const m = a * 4096 / 255;
    pixels[o] = ENC[(DEC[px[o]] * m + 0.5) | 0]; pixels[o + 1] = ENC[(DEC[px[o + 1]] * m + 0.5) | 0]; pixels[o + 2] = ENC[(DEC[px[o + 2]] * m + 0.5) | 0]; pixels[o + 3] = a;
  }
  return pixels;
}
// A top's mask (SH4): one byte a pixel of the top level within the rect — 1 where its alpha is above 160 of 255 —
// from the top's cell as a canvas gives it (px, w px wide; inside: cellInside's — a pixel past it is the last inside)
// → { mask, mw, mh }; its size (topSize) → [mw, mh]
export const topSize = lay => { const k = 2 ** -(lay.levels - 1); return [Math.max(1, Math.ceil(lay.W0 * k - 1e-9)), Math.max(1, Math.ceil(lay.H0 * k - 1e-9))]; };
export function topMask(px, lay, w, inside) {
  const [mw, mh] = topSize(lay), mask = new Uint8Array(mw * mh);
  for (let y = 0; y < mh; y++) {
    const row = Math.min(y + BORDER, inside[3] - 1) * w;
    for (let x = 0; x < mw; x++) if (px[(row + Math.min(x + BORDER, inside[1] - 1)) * 4 + 3] > 160) mask[y * mw + x] = 1;
  }
  return { mask, mw, mh };
}
