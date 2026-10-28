// The chunk `sheets` (SH14): reading a sheet on the GPU — one read of the page table, then the cache — and SHEETS'
// bindings of `frame` (4.2: sheetTable, sheetCache, sheetSampler). It reads `e_view.sheetBias` by name (RENDER's chunk
// `frame` declares the uniform). Every module-scope name here is written with `e_` before the name the plan gives it
// (4.1 "Names in WGSL": an author's shader is assembled into the same module, and every other name is the author's);
// the names below are the plan's. The chunk's three bindings are in `frame`, GPU's (GP7; SHEETS' one layout of its
// own, `sheetUpload`, is its upload's: sheets/upload.js). This module touches nothing of a browser: the whole-set check imports it in node.
//   A sheet is a pyramid of levels, each half as fine as the one below, each cut into pages of SHEET.PAGE px; the pages
// painted so far lie in the cache (a 2D array of slots, each a 4 × 4 grid of units; a page in a cell of 1, 2 or 4
// units either way, SHEET.BORDER px of its neighbours round it; each with its own half level beside it — the array's
// second level). The table (sheets/table.js) has two rows a handle at its beginning — where the sheet's block is, its
// size px at level 0, its levels and the bits its pages take — and in the block an entry for every page of every
// level, found by arithmetic alone (sheetEntry: table.js Block.entry, step for step). An entry says where to read: the
// cell of the page, or of the finest of its own above it that is there (worked out when the table is written: a page
// not there costs nothing here), or that nothing is painted there, or the one colour that page is — and at which level
// that is. A level wider than
// 2^SHEET.WINDOW pages has a window of entries; one that is another page's now is asked once more, at the finest level
// the block holds whole.
//   What it gives (the names are the contract):
//     sheetOf(handle) → Sheet — either stage, from the table's first rows; a handle with no sheet reads as nothing
//     sheetCarry(s) → SheetCarry, sheetFrom(c) → Sheet — a quad's own sheet from its vertex stage to its fragments
//       (`a` flat; `b` carries nothing)
//     sheetLevel(dx, dy, taps) → the level the screen needs (4.8) — dx, dy: level-0 px of the sheet a screen px;
//       taps: 1, or 2 for a plane and a draped one — with the view's bias (quarter levels); the page read for it is
//       that of level ⌊level + SHEET.SOFT⌋ (sheetFind: the ask names the same)
//     sheetRead(s, page, at, dx, dy, taps) → premultiplied linear colour — page: whole pages at level 0 from the
//       sheet's corner to an origin near what is drawn; at: px at level 0 from that page's corner (a sheet may be
//       3 · 10^8 px wide: pages and px are taken apart in whole numbers, so the page read is the same wherever the
//       origin is). Outside the sheet's rect there is nothing — but where the sheet wraps (a drifting layer), read
//       round. One table read and `taps` reads of the cache, textureSampleLevel at the level sheetLevel gives: the
//       page of level ⌊level + SOFT⌋, blended into its own half level by what of the level is past it (none where
//       that page is wholly coarser). A page of one colour (its entry says which: SOLID) is that colour, no read. With two taps they lie a quarter of the
//       footprint's long axis either side of the point, never more than a texel of the page read: no tap reaches
//       further than one texel past its page, also when the level is clamped at the sheet's top.
//     sheetFind(s, page, at, level) → SheetHit — the table read ONCE: the page's entry and the point within it
//       (level: what sheetLevel gave); sheetNone(hit) → from that entry alone: nothing is painted there (or it is
//       outside the sheet, or there is no sheet); sheetTake(hit, dx, dy, taps) → the cache read by it. sheetRead is
//       sheetTake(sheetFind(…)): a pixel that drops what is empty before any read of the cache calls the three —
//       one reading of the table a pixel, never two (5.17)
//   The shaders' rules (4.6) are kept: no derivatives here (a fragment main takes dx, dy first thing), no discard.
import { chunk } from '../gpu/wgsl.js';
import { SHEET } from '../base.js';
import { TABLE } from './table.js';

const f = v => (Number.isInteger(v) ? `${v}.0` : `${v}`);

const SHEETS_WGSL = /* wgsl */ `
struct e_Sheet { at: u32, size: vec2u, info: u32 }
struct e_SheetCarry { a: vec4u, b: vec4f }
struct e_SheetSpot { page: vec2i, px: vec2f, there: bool }
struct e_SheetAxis { page: i32, px: f32, there: bool }
struct e_SheetHit { word: u32, page: vec2i, px: vec2f, level: f32 }

@group(0) @binding(4) var<storage, read> e_sheetTable: array<vec2u>;
@group(0) @binding(5) var e_sheetCache: texture_2d_array<f32>;
@group(0) @binding(6) var e_sheetSampler: sampler;

const e_SHEET_PAGE = ${f(SHEET.PAGE)};
const e_SHEET_PAGE_I = ${SHEET.PAGE};
const e_SHEET_SLOT = ${f(SHEET.SLOT)};
const e_SHEET_UNIT = ${f(SHEET.UNIT)};
const e_SHEET_BORDER = ${f(SHEET.BORDER)};
const e_SHEET_LAYER = ${f(SHEET.LAYER)};
const e_SHEET_WINDOW = ${SHEET.WINDOW};
const e_SHEET_TAIL = ${TABLE.TAIL};
const e_SHEET_HANDLES = ${TABLE.HANDLES}u;
const e_SHEET_EMPTY = ${TABLE.EMPTY}u;
const e_SHEET_SOLID = ${TABLE.SOLID}u;
const e_SHEET_SOFT = ${f(SHEET.SOFT)};

fn e_sheetOf(h: u32) -> e_Sheet {
  if (h >= e_SHEET_HANDLES) { return e_Sheet(0u, vec2u(0u), 0u); }
  let a = e_sheetTable[2u * h];
  let b = e_sheetTable[2u * h + 1u];
  return e_Sheet(a.x, vec2u(a.y, b.x), b.y);
}
fn e_sheetCarry(s: e_Sheet) -> e_SheetCarry { return e_SheetCarry(vec4u(s.at, s.size, s.info), vec4f(0.0)); }
fn e_sheetFrom(c: e_SheetCarry) -> e_Sheet { return e_Sheet(c.a.x, c.a.yz, c.a.w); }

fn e_sheetLevel(dx: vec2f, dy: vec2f, taps: f32) -> f32 {
  let a = length(dx);
  let b = length(dy);
  return max(log2(max(min(a, b), 1e-8)), log2(max(max(a, b), 1e-8) / taps)) + 0.25 * e_view.sheetBias;
}

// one way of a point of the sheet — whole pages and px from the origin — as a page of the sheet and px within it
// (0 … e_SHEET_PAGE): wrapped round where the sheet wraps (a whole number of its lengths taken off in whole pages and the
// rest: as exact at its seam as anywhere), else whether it is inside it
fn e_sheetAxis(page: i32, px: f32, size: u32, wraps: bool) -> e_SheetAxis {
  let whole = i32(size) / e_SHEET_PAGE_I;
  let rest = f32(i32(size) - whole * e_SHEET_PAGE_I);
  var f0 = floor(px / e_SHEET_PAGE);
  var p = page + i32(f0);
  var x = px - f0 * e_SHEET_PAGE;
  if (!wraps) { return e_SheetAxis(p, x, p >= 0 && (p < whole || (p == whole && x < rest))); }
  let k = i32(floor((f32(p) * e_SHEET_PAGE + x) / f32(size)));
  p -= k * whole;
  x -= f32(k) * rest;
  // (the pair made normal again — 0 ≤ x < e_SHEET_PAGE — before it is tested)
  f0 = floor(x / e_SHEET_PAGE);
  p += i32(f0);
  x -= f0 * e_SHEET_PAGE;
  // (a float's doubt at the seam: a length more or less, by whole numbers — and normal once more)
  if (p < 0) { p += whole; x += rest; }
  else if (p > whole || (p == whole && x >= rest)) { p -= whole; x -= rest; }
  f0 = floor(x / e_SHEET_PAGE);
  return e_SheetAxis(p + i32(f0), x - f0 * e_SHEET_PAGE, true);
}
fn e_sheetSpot(s: e_Sheet, page: vec2i, at: vec2f) -> e_SheetSpot {
  let x = e_sheetAxis(page.x, at.x, s.size.x, (s.info & 32768u) != 0u);
  let y = e_sheetAxis(page.y, at.y, s.size.y, (s.info & 65536u) != 0u);
  return e_SheetSpot(vec2i(x.page, y.page), vec2f(x.px, y.px), x.there && y.there);
}
// (the finest level its block holds whole — every page of it an entry of its own —, the levels under it a window each)
fn e_sheetWhole(s: e_Sheet) -> i32 {
  return max(max(i32((s.info >> 5u) & 31u), i32((s.info >> 10u) & 31u)) - e_SHEET_WINDOW, 0);
}
// what the table says of page p of level L (0: nothing — none of its own is there, or its entry is another page's now)
fn e_sheetEntry(s: e_Sheet, L: i32, p: vec2i) -> u32 {
  let bits = vec2i(i32((s.info >> 5u) & 31u), i32((s.info >> 10u) & 31u));
  let hi = max(bits.x, bits.y);
  let whole = max(hi - e_SHEET_WINDOW, 0);
  let b = vec2u(min(max(bits - vec2i(L), vec2i(0)), vec2i(e_SHEET_WINDOW)));
  let e = b.x + b.y;
  var row = e_SHEET_TAIL - 2 + i32(1u << e);
  if (e == 0u) { row = L - hi; }
  if (L < whole) {
    let w = vec2u(max(bits - vec2i(whole), vec2i(0)));
    row = e_SHEET_TAIL - 2 + i32(2u << (w.x + w.y)) + L * i32(1u << u32(e_SHEET_WINDOW + min(min(bits.x, bits.y), e_SHEET_WINDOW)));
  }
  let q = p & vec2i((vec2u(1u) << b) - vec2u(1u));
  let t = vec2u(p >> b) & vec2u(65535u);
  let entry = e_sheetTable[s.at + u32(row + (q.x | (q.y << b.x)))];
  if (entry.y != (t.x | (t.y << 16u))) { return 0u; }
  return entry.x;
}
// … of the page of level L the spot is in — a window's entry that is another page's: what the level held whole has
fn e_sheetWord(s: e_Sheet, L: i32, page: vec2i) -> u32 {
  let e = e_sheetEntry(s, L, page >> vec2u(u32(L)));
  let whole = e_sheetWhole(s);
  if (e == 0u && L < whole) { return e_sheetEntry(s, whole, page >> vec2u(u32(whole))); }
  return e;
}

// the table read once for a point of the sheet at a level (what sheetLevel gave): the entry's word of the page of
// level ⌊level + SOFT⌋ — 0 where there is no sheet, the point is outside it, or nothing of it is there —, the page and
// the px within it, the level clamped to the sheet's
fn e_sheetFind(s: e_Sheet, page: vec2i, at: vec2f, level: f32) -> e_SheetHit {
  if (s.at == 0u) { return e_SheetHit(0u, vec2i(0), vec2f(0.0), 0.0); }
  let spot = e_sheetSpot(s, page, at);
  if (!spot.there) { return e_SheetHit(0u, vec2i(0), vec2f(0.0), 0.0); }
  let top = f32(s.info & 31u) - 1.0;
  return e_SheetHit(e_sheetWord(s, i32(clamp(level + e_SHEET_SOFT, 0.0, top)), spot.page), spot.page, spot.px, clamp(level, 0.0, top));
}
// (nothing of it there; a page nothing is painted in)
fn e_sheetNone(h: e_SheetHit) -> bool { return h.word == 0u || (h.word & e_SHEET_EMPTY) != 0u; }
// the cache read by what the table said: the page read (its level: the finest there at or above the one asked) and
// the point within it — or the colour of a page of one colour (table.js wordOf: its bytes as the cache keeps an opaque
// one, sRGB-encoded — decoded as the cache's format decodes them)
fn e_sheetTake(h: e_SheetHit, dx: vec2f, dy: vec2f, taps: f32) -> vec4f {
  if (e_sheetNone(h)) { return vec4f(0.0); }
  let e = h.word;
  if ((e & e_SHEET_SOLID) != 0u) {
    let rgb = (e & 131071u) | ((e >> 25u) << 17u);
    let c = vec3f(f32(rgb & 255u), f32((rgb >> 8u) & 255u), f32(rgb >> 16u)) / 255.0;
    return vec4f(select(pow((c + 0.055) / 1.055, vec3f(2.4)), c / 12.92, c <= vec3f(0.04045)), 1.0);
  }
  let used = (e >> 17u) & 31u;
  let shrink = exp2(-f32(used));
  let low = h.page - ((h.page >> vec2u(used)) << vec2u(used));
  let within = (vec2f(low) * e_SHEET_PAGE + h.px) * shrink;
  // its cell: its slot in its layer, its unit in its slot (table.js wordOf), past its border
  let cell = vec2f(f32((e >> 4u) & 7u), f32((e >> 7u) & 7u)) * e_SHEET_SLOT + vec2f(f32(e & 3u), f32((e >> 2u) & 3u)) * e_SHEET_UNIT + e_SHEET_BORDER;
  let slice = i32((e >> 10u) & 127u);
  let blend = clamp(h.level - f32(used), 0.0, 1.0);
  if (taps < 1.5) { return textureSampleLevel(e_sheetCache, e_sheetSampler, (cell + within) / e_SHEET_LAYER, slice, blend); }
  // two taps along the footprint's long axis, a quarter of it either side — a texel of this page at the most
  var axis = dx;
  if (dot(dy, dy) > dot(dx, dx)) { axis = dy; }
  var aside = axis * (0.25 * shrink);
  let far = length(aside);
  if (far > 1.0) { aside = aside / far; }
  return 0.5 * (textureSampleLevel(e_sheetCache, e_sheetSampler, (cell + within + aside) / e_SHEET_LAYER, slice, blend)
    + textureSampleLevel(e_sheetCache, e_sheetSampler, (cell + within - aside) / e_SHEET_LAYER, slice, blend));
}
fn e_sheetRead(s: e_Sheet, page: vec2i, at: vec2f, dx: vec2f, dy: vec2f, taps: f32) -> vec4f {
  return e_sheetTake(e_sheetFind(s, page, at, e_sheetLevel(dx, dy, taps)), dx, dy, taps);
}
`;

chunk('sheets', SHEETS_WGSL);
