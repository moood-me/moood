// A painting recorded once and replayed as often as it is needed — a display list. An element's paint code paints into
// a Recorder (the API of a CanvasRenderingContext2D, in the painting's own units — metres; stage heights for the sky
// and inserts); what it did is kept as a Recording, which replays any region of it at any scale into a 2D context (a
// page, in a painter's thread). The code runs once per state, not once per page (SH7, 5.6).
//   The list is flat. Every draw is an item that needs nothing before it: its kind and numbers, the transform it was
// made under, its row of the context's properties, its clip (a node of the clips made so far, each naming the one it
// was made inside), and its box — where it lies, as far as it reaches (its stroke's width, mitres and caps, its
// shadow, its filter) and as its clips let it through. The items' boxes are kept as a tree; a replay asks the tree for
// the items that touch its region and draws those alone, in their order, setting only what differs from the item
// before. So a page's raster costs what lies in that page — not what the painting holds.
//   Paths. The context's path is a stream of commands in the units they were given, with the transform each stretch was
// given under; a fill, a stroke, a clip names the stretch from the last beginPath to itself. A path given as an object
// (new Path2D — PaintPath here) is copied into the stream the first time it is drawn, as it is then.
//   Runs. A long path is kept in runs of RUN commands (lines and curves that follow one another in one transform),
// each with the box round its points and its curves' controls, the point it begins from among them. In a replay a run
// whose box, grown by as far as the draw reaches, does not meet the region is replaced by one line to its last point.
// That is exact:
//   - a fill, a clip: the run and that line (its chord) close a loop that lies inside the run's box — a curve lies in
//     the hull of its points and controls, and the box is convex. A closed curve winds zero times round a point outside
//     its hull, so the winding number of every point outside the box — every point of the region — is the same with the
//     run or with its chord; both fill rules read only that number.
//   - a stroke: the stroke of the run and the stroke of its chord both lie within the stroke's reach of the box (the
//     reach holds half the width, the mitres at their limit and a square cap's corner; the chord's joins are at points
//     of the box) — outside the region; the stretches before and after are drawn from the same points as before, and
//     the joins they make with the chord are at those points, outside the region too.
//   - a dashed stroke is the exception: where a dash falls depends on the length of the path before it, which a chord
//     shortens. A dashed stroke's runs are never replaced.
//   What a recording keeps besides: extent — where anything was drawn ([l, t, r, b]; null: nothing: `empty`); dense —
// how much one draw of it covers a pixel at most (0…1: denseOf — the camera's rays see through a veil); rect — the
// rectangle its sheet is laid over (the element's box, a part's, a layer's: the sheet's pages are counted from its
// corner); its content's hash (h1, h2) — two recordings of the same hash, the same numbers and the same things named
// (same()) are one picture, painted once for all who show it.
//   Units: everything a painting gives is in its own units, scaled as it is replayed — line widths, fonts, dashes (the
// transform's), and also shadows (shadowBlur, shadowOffsetX / Y) and the lengths of a filter (blur(0.02px) is two
// centimetres), which Canvas itself keeps in the canvas's pixels.
//   Exact at any size: Canvas works in 32-bit floats. A replay passes Canvas only small numbers — every point less the
// region's corner as the item's transform has it there (in doubles, here), the transform without its translation — so
// a page of a painting a hundred kilometres across is as exact as one of a card. A rect filled is cut to the region
// first (its far edges, far off, are not small numbers).
//   Properties. What a painting sets is given to a real 2D context first, and what that context holds afterwards is
// what is recorded (and what the getter returns): Canvas's own rule of what it takes — an alpha outside 0…1, a width
// of 0, a colour that is none leave the value before — and of how it keeps it. So every item's row holds values a
// context takes, a replay's result does not depend on which items it replays before, and an item's box is worked out
// from the value it is drawn with.
//   Images. A painting may build pictures in canvases of its own and draw them (drawImage, a pattern); a recording
// carries them — each as it is when it is drawn: a canvas is copied then (its pixels, one copy for each content — a
// scratch canvas drawn, changed and drawn again is two pictures). What a painting may not do is read back the canvas
// it paints into (getImageData, putImageData, isPointInPath, isPointInStroke): said once, as a warning.
//   A ground (a form's: 5.23): an opaque colour laid UNDER the finished painting when it is rastered — over the whole
// of what is replayed, after the items —, so it also lies under what the painting erased: the sheet is opaque by
// construction.
//   Between threads: the artist ends a Recorder (end() → Recording), sends it (wire(), Recording.transfers); the scene's
// thread makes it live (Recording.fromWire) and asks it same(), touches() and uniform(); the painters are sent the same data and
// replay it. A draw of full transparency is ink like any other (extent, touches).

// a path's commands (each followed by its numbers)
const P_MOVE = 1, P_LINE = 2, P_BEZIER = 3, P_QUAD = 4, P_ARC = 5, P_ARC_TO = 6, P_ELLIPSE = 7, P_RECT = 8, P_ROUND_RECT = 9, P_CLOSE = 10, P_SUB = 11, P_MAT = 12;
// an item: ITEM numbers — its kind, its row of properties, its transform, its clip, its box (l, t, r, b), its reach, then
// what its kind takes (ARG on): a fill or a stroke — the path's stretch (from, to), the fill rule (a ref), whether the
// stretch is a path object's (its points in the item's own transform); a rect — x, y, w, h; a text — the text (a ref),
// x, y, the most width (NaN: none); an image — the image (a ref), then drawImage's eight numbers
const FILL = 1, STROKE = 2, FILL_RECT = 3, STROKE_RECT = 4, CLEAR_RECT = 5, FILL_TEXT = 6, STROKE_TEXT = 7, IMAGE = 8;
const ITEM = 18, I_ROW = 1, I_MAT = 2, I_CLIP = 3, I_BOX = 4, I_REACH = 8, ARG = 9;
// a clip: its parent (0: none), its path's stretch, its rule (a ref), whether the stretch is a path object's, and the
// transform it was made under
const CLIP = 6;
// a run: where it begins and ends in the path, its box (l, t, r, b: the commands' own units), its last point
const RUNS = 8, RUN = 64;

// the properties a painting may set: kept as they are (strings, numbers), or scaled as they are replayed (SCALED:
// Canvas keeps them in the canvas's pixels; here they are the painting's units, like everything else)
const PROPS = ['fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'lineJoin', 'miterLimit', 'lineDashOffset', 'globalAlpha',
  'globalCompositeOperation', 'filter', 'shadowBlur', 'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'font', 'textAlign',
  'textBaseline', 'direction', 'letterSpacing', 'wordSpacing', 'fontKerning', 'imageSmoothingEnabled', 'imageSmoothingQuality'];
const PROP_ID = new Map(PROPS.map((p, i) => [p, i]));
// (a row of properties: each one's ref, then the dash's)
const DASH = PROPS.length, ROW = PROPS.length + 1;
const FILL_STYLE = PROP_ID.get('fillStyle'), STROKE_STYLE = PROP_ID.get('strokeStyle'), FILTER = PROP_ID.get('filter');
const ALPHA = PROP_ID.get('globalAlpha'), COMPOSITE = PROP_ID.get('globalCompositeOperation'), SHADOW = PROP_ID.get('shadowColor');
// an opaque colour as a context keeps it; its bytes (red the low one) from that, or from rgb(r, g, b) — a ground read
// back (Recorder.ground)
const OPAQUE_HEX = /^#[0-9a-f]{6}$/;
const bytesOf = c => {
  if (c[0] === '#') { const v = parseInt(c.slice(1), 16); return (v >> 16) | (v & 0xff00) | (v & 0xff) << 16; }
  const [r, g, b] = c.match(/\d+/g).map(Number);
  return r | g << 8 | b << 16;
};
const SCALED = PROPS.map(p => p === 'shadowBlur' || p === 'shadowOffsetX' || p === 'shadowOffsetY');
const DEFAULTS = {
  fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', miterLimit: 10, lineDashOffset: 0,
  globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none', shadowBlur: 0, shadowColor: 'rgba(0, 0, 0, 0)',
  shadowOffsetX: 0, shadowOffsetY: 0, font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic', direction: 'inherit',
  letterSpacing: '0px', wordSpacing: '0px', fontKerning: 'auto', imageSmoothingEnabled: true, imageSmoothingQuality: 'low',
};
// the ways of compositing that change the canvas where the draw itself is not (everywhere its clip lets it)
const UNBOUNDED = new Set(['copy', 'source-in', 'source-out', 'destination-in', 'destination-atop']);
// lengths in a filter (blur(3px), drop-shadow(1px 2px 3px …)): the painting's units, scaled as it is replayed
const PX = /(-?\d*\.?\d+(?:e-?\d+)?)px/g;
const scaledFilter = (f, k) => (f === 'none' ? f : f.replace(PX, (_, v) => `${Number(v) * k}px`));
// how far a filter's blur reaches past what is drawn (its largest length, three times: a gaussian's reach) — one whose
// lengths are not all told here (another unit, a filter of the page's by url): anywhere
const UNTOLD = /url\(|\d\s*(em|rem|ex|ch|vw|vh|vmin|vmax|cm|mm|in|pt|pc|q)\b/i;
const filterReach = f => {
  if (f === 'none') return 0;
  if (UNTOLD.test(f)) return Infinity;
  let r = 0;
  for (const m of f.matchAll(PX)) r = Math.max(r, Math.abs(Number(m[1])));
  return 3 * r;
};

// ── the content's hash: two 32-bit hashes of every number and every thing named, in order ──
const F64 = new Float64Array(1), U32 = new Uint32Array(F64.buffer);
const mixWord = (H, w) => {
  H[0] = Math.imul(H[0] ^ w, 0x01000193);
  H[1] = Math.imul(H[1] ^ w, 0x5bd1e995); H[1] ^= H[1] >>> 15;
};
const mixNumber = (H, v) => { F64[0] = v; mixWord(H, U32[0]); mixWord(H, U32[1]); };
const mixString = (H, s) => { mixWord(H, s.length); for (let i = 0; i < s.length; i++) mixWord(H, s.charCodeAt(i)); };
const mixNumbers = (H, a) => { const w = new Uint32Array(a.buffer, a.byteOffset, a.byteLength >> 2); mixWord(H, w.length); for (let i = 0; i < w.length; i++) mixWord(H, w[i]); };
// (what is the same only as itself — an image: its number)
const identities = new WeakMap();
let identity = 0;
const identityOf = o => { let n = identities.get(o); if (n === undefined) identities.set(o, n = ++identity); return n; };
function mixRef(H, v) {
  if (typeof v === 'string') { mixWord(H, 1); mixString(H, v); } else if (typeof v === 'number') { mixWord(H, 2); mixNumber(H, v); }
  else if (typeof v === 'boolean') mixWord(H, v ? 3 : 4);
  else if (v == null) mixWord(H, 5);
  else if (v instanceof Style) { mixWord(H, 6); mixString(H, v.kind); for (const a of v.args) mixRef(H, a); for (const s of v.stops) mixRef(H, s); mixWord(H, v.image ? identityOf(v.image) : 0); }
  else if (Array.isArray(v)) { mixWord(H, 8); mixString(H, JSON.stringify(v)); }
  else { mixWord(H, 9); mixWord(H, identityOf(v)); }
}
const sameNumber = (a, b) => a === b || (a !== a && b !== b);
const sameNumbers = (a, b) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (!sameNumber(a[i], b[i])) return false; return true; };
// (a gradient or a pattern: as a painting made it, or as it is sent)
const kindOf = v => (v instanceof Style ? v.kind : v.style);
const isStyle = v => v != null && typeof v === 'object' && (v instanceof Style || typeof v.style === 'string');
function sameRef(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return typeof a === 'number' && typeof b === 'number' && sameNumber(a, b);
  if (isStyle(a) && isStyle(b)) {
    return kindOf(a) === kindOf(b) && a.image === b.image && a.args.length === b.args.length && a.args.every((x, i) => sameRef(x, b.args[i]))
      && a.stops.length === b.stops.length && a.stops.every((x, i) => sameRef(x, b.stops[i]));
  }
  if (Array.isArray(a) && Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b);
  return false;
}

// a gradient or a pattern as a painting makes it: its numbers and its stops (sent as { style, args, stops, image }).
// The painting may go on adding stops to it after it has drawn with it: a recording names a copy of it as it is at
// each draw (Recorder.styleNow), never the one the painting holds.
class Style {
  constructor(kind, args, image = null) { this.kind = kind; this.args = args; this.image = image; this.stops = []; }
  addColorStop(offset, color) { this.stops.push(Number(offset), String(color)); }
  copy() { const c = new Style(this.kind, this.args, this.image); c.stops = this.stops.slice(); return c; }
  setTransform() { throw new Error('a pattern of a painting is not transformed apart: transform the painting'); }
}
// … made for the context it is replayed into, and for where the replay has the painting's points (its numbers less
// the region's corner in the item's units: q) — kept while both stay
function styleAt(v, g, qx, qy) {
  const m = v.made;
  if (m && m.g === g && m.qx === qx && m.qy === qy) return m.s;
  const a = v.args;
  let s;
  if (v.style === 'linear') s = g.createLinearGradient(a[0] - qx, a[1] - qy, a[2] - qx, a[3] - qy);
  else if (v.style === 'radial') s = g.createRadialGradient(a[0] - qx, a[1] - qy, a[2], a[3] - qx, a[4] - qy, a[5]);
  else if (v.style === 'conic') s = g.createConicGradient(a[0], a[1] - qx, a[2] - qy);
  else {
    s = g.createPattern(v.image, a[0]);
    // (its tiles from the painting's origin: that far back — by whole tiles where it repeats, the rest small)
    const rep = a[0] ?? 'repeat', w = v.image.width, h = v.image.height;
    const ox = (rep === 'repeat' || rep === 'repeat-x') && w > 0 ? qx - Math.floor(qx / w) * w : qx;
    const oy = (rep === 'repeat' || rep === 'repeat-y') && h > 0 ? qy - Math.floor(qy / h) * h : qy;
    if (s && (ox || oy)) s.setTransform(new DOMMatrix([1, 0, 0, 1, -ox, -oy]));
  }
  if (v.style !== 'pattern') for (let i = 0; i < v.stops.length; i += 2) s.addColorStop(v.stops[i], v.stops[i + 1]);
  v.made = { g, qx, qy, s };
  return s;
}

// a context of the recorder's own, one pixel: text is measured there, and every property a painting sets is given to
// it first (below)
let measuring = null;
const measurer = () => (measuring ??= new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true }));
// what a context holding `held` of property `name` holds after it is given v: Canvas's own validation and keeping
function taken(name, held, v) {
  const g = measurer();
  g[name] = held; g[name] = v;
  return g[name];
}
// … the same for a fill or a stroke style where what is held is no value a context takes (a gradient of the
// painting's, nothing): given v over two colours — what it holds after both is what it took of v; `held` if it
// refused it
function probed(name, v, held) {
  const g = measurer();
  g[name] = '#000000'; g[name] = v;
  const a = g[name];
  if (a !== '#000000') return a;
  g[name] = '#ffffff'; g[name] = v;
  return g[name] === '#000000' ? a : held;
}
// the alpha (0…1) of a colour as a context keeps it: #rrggbb whole, rgba(r, g, b, a) its a; any other form is painted
// — one pixel — and read (not a string: whole)
const RGBA = /^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.e+-]+)\s*\)$/;
function alphaOf(c) {
  if (typeof c !== 'string') return 1;
  if (OPAQUE_HEX.test(c) || c.startsWith('rgb(')) return 1;
  const m = RGBA.exec(c);
  if (m) return Math.min(1, Math.max(0, Number(m[1])));
  const g = measurer();
  g.save();
  g.globalAlpha = 1; g.filter = 'none'; g.shadowColor = DEFAULTS.shadowColor; g.globalCompositeOperation = 'copy';
  g.fillStyle = c; g.fillRect(0, 0, 1, 1);
  g.restore();
  return g.getImageData(0, 0, 1, 1).data[3] / 255;
}
// … of a fill's or a stroke's style: a colour's; a gradient's — its most opaque stop (a stop's colour as a context
// takes it; one it refuses: whole; no stop: nothing — Canvas paints such a gradient transparent); a pattern's: whole
function styleAlpha(v) {
  if (!(v instanceof Style)) return alphaOf(v);
  if (v.kind === 'pattern') return 1;
  let a = 0;
  for (let i = 1; i < v.stops.length && a < 1; i += 2) { const c = probed('fillStyle', v.stops[i], null); a = Math.max(a, c === null ? 1 : alphaOf(c)); }
  return a;
}
// How much one draw of a recording covers a pixel at most (0…1: its `dense`), as far as what it is drawn with says:
// its style's alpha (a fill's or a stroke's; an image: whole) or its shadow's, the greater, times globalAlpha; a draw
// composited any other way than source-over, or through a filter by url, covers whole; a rect cleared covers nothing;
// a ground covers whole. The draws are taken each by itself: faint ones laid over one another are no denser than the
// densest of them. (Worked out where the painting is recorded — the artist's thread, a context of its own at hand.)
function denseOf(items, rows, refs, under) {
  if (under != null) return 1;
  const seen = new Map();
  const alpha = (r, f) => { let a = seen.get(r); if (a === undefined) seen.set(r, a = f(refs[r])); return a; };
  let most = 0;
  for (let o = 0; o < items.length && most < 1; o += ITEM) {
    const kind = items[o];
    if (kind === CLEAR_RECT) continue;
    const row = items[o + I_ROW] * ROW, filter = refs[rows[row + FILTER]];
    if (refs[rows[row + COMPOSITE]] !== 'source-over' || (typeof filter === 'string' && filter.includes('url('))) return 1;
    const stroke = kind === STROKE || kind === STROKE_RECT || kind === STROKE_TEXT;
    const a = kind === IMAGE ? 1 : alpha(rows[row + (stroke ? STROKE_STYLE : FILL_STYLE)], styleAlpha);
    most = Math.max(most, refs[rows[row + ALPHA]] * Math.max(a, alpha(rows[row + SHADOW], alphaOf)));
  }
  return Math.min(1, most);
}
// the pixels of a picture a painting draws are read in a canvas of the recorder's own
let copying = null;
const sameBytes = (a, b) => {
  if (a.length !== b.length) return false;
  const x = new Uint32Array(a.buffer, a.byteOffset, a.byteLength >> 2), y = new Uint32Array(b.buffer, b.byteOffset, b.byteLength >> 2);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
};
// a ground laid under what context g holds, all of its canvas (whatever state g is in)
function laidUnder(g, color) {
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1; g.filter = 'none'; g.shadowColor = DEFAULTS.shadowColor;
  g.globalCompositeOperation = 'destination-over';
  g.fillStyle = color;
  g.fillRect(0, 0, g.canvas.width, g.canvas.height);
  g.restore();
}

// ── paths ──
const TAU = 2 * Math.PI;
const grow = (b, x, y) => { if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; };
const noBox = () => [Infinity, Infinity, -Infinity, -Infinity];
// an arc of an ellipse (centre x, y, radii, turned rot, from angle a0 to a1 as the canvas sweeps it) into box b — through
// matrix m if given: its ends and those of its widest points across and down it passes
function arcInto(b, m, x, y, rx, ry, rot, a0, a1, ccw) {
  rx = Math.abs(rx); ry = Math.abs(ry);
  const c = Math.cos(rot), s = Math.sin(rot);
  let sweep = ccw ? a0 - a1 : a1 - a0;
  if (sweep >= TAU) sweep = TAU; else { sweep %= TAU; if (sweep < 0) sweep += TAU; }
  const point = t => {
    const px = x + rx * Math.cos(t) * c - ry * Math.sin(t) * s, py = y + rx * Math.cos(t) * s + ry * Math.sin(t) * c;
    if (m) grow(b, m[0] * px + m[2] * py + m[4], m[1] * px + m[3] * py + m[5]); else grow(b, px, py);
  };
  const on = t => { let d = (ccw ? a0 - t : t - a0) % TAU; if (d < 0) d += TAU; if (d <= sweep) point(t); };
  point(a0); point(ccw ? a0 - sweep : a0 + sweep);
  const tx = Math.atan2(-ry * s, rx * c), ty = Math.atan2(ry * c, rx * s);
  on(tx); on(tx + Math.PI); on(ty); on(ty + Math.PI);
}
// (a roundRect's radii as numbers: how many, then each corner's x and y)
function radiiOf(r) {
  const list = Array.isArray(r) ? r : [r], out = [list.length];
  for (const q of list) { const x = typeof q === 'number' ? q : Number(q?.x ?? 0), y = typeof q === 'number' ? q : Number(q?.y ?? x); out.push(x, y); }
  return out;
}
// how many numbers the command at i takes, itself among them
function sizeOf(P, i) {
  switch (P[i]) {
    case P_MOVE: case P_LINE: return 3;
    case P_BEZIER: case P_ARC: return 7;
    case P_QUAD: case P_RECT: return 5;
    case P_ARC_TO: return 6;
    case P_ELLIPSE: return 9;
    case P_ROUND_RECT: return 6 + 2 * P[i + 5];
    case P_CLOSE: return 1;
    case P_SUB: return 8 + P[i + 7];
    case P_MAT: return 2;
    default: throw new Error(`path: command ${P[i]} at ${i}`);
  }
}
// The runs of path P from where `s` stands up to `end`, added to `runs` (s: { at, ok — the point the path is at is
// known —, x, y, n — the commands of the run begun —, start, l, t, r, b }). Lines and curves that follow one another
// make runs; whatever else comes between (a move, an arc, a rect, a close, another transform, a path added) ends the
// run begun — its commands stay as they are, in no run.
function scanRuns(P, s, end, runs) {
  let i = s.at;
  while (i < end) {
    const c = P[i], n = c === P_LINE ? 3 : c === P_BEZIER ? 7 : c === P_QUAD ? 5 : 0;
    if (n) {
      const x = P[i + n - 2], y = P[i + n - 1];
      if (s.ok) {
        if (!s.n) { s.start = i; s.l = s.r = s.x; s.t = s.b = s.y; }
        for (let k = 1; k < n; k += 2) { const px = P[i + k], py = P[i + k + 1]; if (px < s.l) s.l = px; if (px > s.r) s.r = px; if (py < s.t) s.t = py; if (py > s.b) s.b = py; }
        if (++s.n === RUN) { runs.push(s.start, i + n, s.l, s.t, s.r, s.b, x, y); s.n = 0; }
      }
      s.ok = true; s.x = x; s.y = y; i += n;
      continue;
    }
    s.n = 0;
    if (c === P_MOVE) { s.ok = true; s.x = P[i + 1]; s.y = P[i + 2]; i += 3; } else { s.ok = false; i += sizeOf(P, i); }
  }
  s.at = end;
}
const scanFrom = at => ({ at, ok: false, x: 0, y: 0, n: 0, start: 0, l: 0, t: 0, r: 0, b: 0 });

// an SVG path's data → commands (absolute; smooth curves' reflected controls; arcs as ellipses), its box into b
function svgCommands(d, c, b) {
  const T = String(d).match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, cx = 0, cy = 0, prev = '';
  const n = () => Number(T[i++]);
  const number = () => i < T.length && !/[A-Za-z]/.test(T[i]);
  while (i < T.length) {
    if (/[A-Za-z]/.test(T[i])) cmd = T[i++];
    else if (!cmd) { i++; continue; }
    const rel = cmd !== cmd.toUpperCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'Z') { c.push(P_CLOSE); x = sx; y = sy; prev = 'Z'; cmd = ''; continue; }
    if (!number()) { cmd = ''; continue; }
    if (C === 'M') {
      x = n() + ox; y = n() + oy; sx = x; sy = y; c.push(P_MOVE, x, y); grow(b, x, y);
      cmd = rel ? 'l' : 'L';
    } else if (C === 'L' || C === 'H' || C === 'V') {
      if (C !== 'V') x = n() + ox;
      if (C !== 'H') y = n() + oy;
      c.push(P_LINE, x, y); grow(b, x, y);
    } else if (C === 'C' || C === 'S') {
      let x1, y1;
      if (C === 'C') { x1 = n() + ox; y1 = n() + oy; } else if (prev === 'C' || prev === 'S') { x1 = 2 * x - cx; y1 = 2 * y - cy; } else { x1 = x; y1 = y; }
      const x2 = n() + ox, y2 = n() + oy, ex = n() + ox, ey = n() + oy;
      c.push(P_BEZIER, x1, y1, x2, y2, ex, ey); grow(b, x1, y1); grow(b, x2, y2); grow(b, ex, ey);
      cx = x2; cy = y2; x = ex; y = ey;
    } else if (C === 'Q' || C === 'T') {
      let x1, y1;
      if (C === 'Q') { x1 = n() + ox; y1 = n() + oy; } else if (prev === 'Q' || prev === 'T') { x1 = 2 * x - cx; y1 = 2 * y - cy; } else { x1 = x; y1 = y; }
      const ex = n() + ox, ey = n() + oy;
      c.push(P_QUAD, x1, y1, ex, ey); grow(b, x1, y1); grow(b, ex, ey);
      cx = x1; cy = y1; x = ex; y = ey;
    } else if (C === 'A') {
      let rx = Math.abs(n()), ry = Math.abs(n());
      const phi = n() * Math.PI / 180, large = n() !== 0, sweep = n() !== 0, ex = n() + ox, ey = n() + oy;
      if (!rx || !ry || (ex === x && ey === y)) { c.push(P_LINE, ex, ey); grow(b, ex, ey); }
      else {
        // (the SVG's endpoints and flags → its centre and angles: SVG 1.1, F.6.5)
        const cs = Math.cos(phi), sn = Math.sin(phi), dx = (x - ex) / 2, dy = (y - ey) / 2;
        const x1 = cs * dx + sn * dy, y1 = -sn * dx + cs * dy, lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
        if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
        const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1, den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
        const k = (large !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, num / den));
        const cxp = k * rx * y1 / ry, cyp = -k * ry * x1 / rx;
        const ccx = cs * cxp - sn * cyp + (x + ex) / 2, ccy = sn * cxp + cs * cyp + (y + ey) / 2;
        const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
        const a0 = ang(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry);
        let da = ang((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry);
        if (!sweep && da > 0) da -= 2 * Math.PI; else if (sweep && da < 0) da += 2 * Math.PI;
        c.push(P_ELLIPSE, ccx, ccy, rx, ry, phi, a0, a0 + da, da < 0 ? 1 : 0);
        arcInto(b, null, ccx, ccy, rx, ry, phi, a0, a0 + da, da < 0);
      }
      x = ex; y = ey;
    } else { i++; continue; }
    prev = C;
  }
}
// A Path2D that knows where it lies (its points, its curves' controls: a box round it, its own units) and what it is —
// its commands, in doubles: copied into a recording when it is drawn. It is a Path2D of the platform too (a painting's
// own canvases take it), and stands for the global one in the artist's thread (sheets/artist.js). An SVG path's data
// is read into commands as well (arcs as ellipses round their centres).
const BaseP2D = globalThis.Path2D;
export class PaintPath extends (BaseP2D || Object) {
  constructor(from) {
    super(from);
    this.b = noBox();
    this.cmds = [];
    if (from instanceof PaintPath) { this.cmds = from.cmds.slice(); const f = from.b; grow(this.b, f[0], f[1]); grow(this.b, f[2], f[3]); }
    else if (typeof from === 'string') svgCommands(from, this.cmds, this.b);
  }
  moveTo(x, y) { super.moveTo(x, y); this.cmds.push(P_MOVE, x, y); grow(this.b, x, y); }
  lineTo(x, y) { super.lineTo(x, y); this.cmds.push(P_LINE, x, y); grow(this.b, x, y); }
  bezierCurveTo(a, b, c, d, x, y) { super.bezierCurveTo(a, b, c, d, x, y); this.cmds.push(P_BEZIER, a, b, c, d, x, y); grow(this.b, a, b); grow(this.b, c, d); grow(this.b, x, y); }
  quadraticCurveTo(a, b, x, y) { super.quadraticCurveTo(a, b, x, y); this.cmds.push(P_QUAD, a, b, x, y); grow(this.b, a, b); grow(this.b, x, y); }
  arc(x, y, r, a0, a1, ccw = false) { super.arc(x, y, r, a0, a1, ccw); this.cmds.push(P_ARC, x, y, r, a0, a1, ccw ? 1 : 0); arcInto(this.b, null, x, y, r, r, 0, a0, a1, ccw); }
  arcTo(x1, y1, x2, y2, r) { super.arcTo(x1, y1, x2, y2, r); this.cmds.push(P_ARC_TO, x1, y1, x2, y2, r); grow(this.b, x1, y1); grow(this.b, x2, y2); }
  ellipse(x, y, rx, ry, rot, a0, a1, ccw = false) {
    super.ellipse(x, y, rx, ry, rot, a0, a1, ccw);
    this.cmds.push(P_ELLIPSE, x, y, rx, ry, rot, a0, a1, ccw ? 1 : 0);
    arcInto(this.b, null, x, y, rx, ry, rot, a0, a1, ccw);
  }
  rect(x, y, w, h) { super.rect(x, y, w, h); this.cmds.push(P_RECT, x, y, w, h); grow(this.b, x, y); grow(this.b, x + w, y + h); }
  roundRect(x, y, w, h, r = 0) { super.roundRect(x, y, w, h, r); this.cmds.push(P_ROUND_RECT, x, y, w, h, ...radiiOf(r)); grow(this.b, x, y); grow(this.b, x + w, y + h); }
  closePath() { super.closePath(); this.cmds.push(P_CLOSE); }
  // another path added through matrix m: its commands kept with the matrix (a sub-path), its box through it
  addPath(p, m) {
    if (!(p instanceof PaintPath)) throw new TypeError('addPath: a path the painting made (new Path2D)');
    super.addPath(p, m);
    const M = m ? [m.a ?? m.m11 ?? 1, m.b ?? m.m12 ?? 0, m.c ?? m.m21 ?? 0, m.d ?? m.m22 ?? 1, m.e ?? m.m41 ?? 0, m.f ?? m.m42 ?? 0] : [1, 0, 0, 1, 0, 0];
    const c = p.cmds;
    this.cmds.push(P_SUB, M[0], M[1], M[2], M[3], M[4], M[5], c.length);
    for (let i = 0; i < c.length; i++) this.cmds.push(c[i]);
    const f = p.b;
    if (f[0] > f[2]) return;
    for (const [x, y] of [[f[0], f[1]], [f[2], f[1]], [f[2], f[3]], [f[0], f[3]]]) grow(this.b, M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]);
  }
}

// The context a painting paints into. rect: the rectangle its sheet is laid over ([l, t, r, b], its units);
// warn(text) — what it does that is not recorded.
export class Recorder {
  constructor(rect, warn) {
    this.laid = rect.slice(); this.warn = warn;
    // the list: the context's path and the paths given as objects (two streams, joined at the end), their runs, the
    // items, the transforms (0: none), the rows of properties (0: a context's own), the clips (0: none), what is named
    this.path = []; this.own = []; this.runs = []; this.ownRuns = []; this.items = [];
    this.mats = [1, 0, 0, 1, 0, 0]; this.rows = []; this.clips = [0, 0, 0, 0, 0, 0]; this.refs = []; this.known = new Map();
    // the properties now, as set (p) and as refs (cur; row: its row of `rows`, −1 — not written yet)
    this.p = { ...DEFAULTS }; this.dash = [];
    this.cur = PROPS.map(name => this.ref(DEFAULTS[name])); this.cur.push(this.ref(this.dash));
    this.rows.push(...this.cur); this.row = 0;
    // the transform now ([a b c d e f], the painting's units; mat: its row of `mats`, −1 — not written yet), the clip
    // now and the box round it (nothing is drawn past it); what save() keeps
    this.m = [1, 0, 0, 1, 0, 0]; this.mat = 0; this.clipNow = 0; this.cb = [-Infinity, -Infinity, Infinity, Infinity]; this.stack = [];
    // the path now: where it begins in the stream, the transform its last commands were given under, where it lies
    // (painting units), how far its runs are found
    this.begun = 0; this.pmat = -1; this.pb = noBox(); this.scan = scanFrom(0);
    this.extent = noBox();
    // (the path objects copied so far: each with how long it was then; the pictures drawn so far, by their content;
    // the gradients and patterns drawn with so far: each one's copy as it was at its last draw; the colour laid under
    // the finished painting — a form's ground)
    this.copied = new Map(); this.pictures = new Map(); this.styles = new Map(); this.under = null;
  }
  // ── what is named, the rows ──
  ref(v) {
    let i = this.known.get(v);
    if (i === undefined) { i = this.refs.length; this.refs.push(v); this.known.set(v, i); }
    return i;
  }
  rowNow() {
    if (this.row < 0) { this.row = this.rows.length / ROW; for (let k = 0; k < ROW; k++) this.rows.push(this.cur[k]); }
    return this.row;
  }
  matNow() {
    if (this.mat < 0) { this.mat = this.mats.length / 6; for (let k = 0; k < 6; k++) this.mats.push(this.m[k]); }
    return this.mat;
  }
  // a gradient or a pattern held as a fill's or a stroke's style (property `id`), named as it is now — at a draw: the
  // copy made of it at its last draw, or a new one if it has more stops since (what was drawn before keeps its own)
  styleNow(id) {
    const v = this.p[PROPS[id]];
    if (!(v instanceof Style)) return;
    let c = this.styles.get(v);
    if (!c || c.stops.length !== v.stops.length) this.styles.set(v, c = v.copy());
    const r = this.ref(c);
    if (this.cur[id] !== r) { this.cur[id] = r; this.row = -1; }
  }
  // ── where things lie ──
  at(x, y, b) {
    const m = this.m, X = m[0] * x + m[2] * y + m[4], Y = m[1] * x + m[3] * y + m[5];
    if (X < b[0]) b[0] = X; if (Y < b[1]) b[1] = Y; if (X > b[2]) b[2] = X; if (Y > b[3]) b[3] = Y;
  }
  // a box (its own units, through the transform) into b
  box(x0, y0, x1, y1, b) { this.at(x0, y0, b); this.at(x1, y0, b); this.at(x1, y1, b); this.at(x0, y1, b); return b; }
  // how far what is drawn reaches past its outline: a stroke's half width — as wide as the transform makes it the way
  // it stretches most —, its mitres, its square caps' corners; a shadow; a filter
  reach(stroke) {
    const m = this.m, p = this.p;
    let r = 0;
    if (stroke) {
      const T2 = m[0] * m[0] + m[1] * m[1] + m[2] * m[2] + m[3] * m[3], det = m[0] * m[3] - m[1] * m[2];
      const k = Math.sqrt((T2 + Math.sqrt(Math.max(0, T2 * T2 - 4 * det * det))) / 2) || 0;
      r = p.lineWidth * k * Math.max(p.lineJoin === 'miter' ? Math.max(1, p.miterLimit) : 1, p.lineCap === 'square' ? Math.SQRT2 : 1) / 2;
    }
    if (p.shadowColor !== DEFAULTS.shadowColor) r += p.shadowBlur * 2 + Math.hypot(p.shadowOffsetX, p.shadowOffsetY);
    return r + filterReach(p.filter);
  }
  // An item: what is drawn lies in b (painting units), reaching as far as a stroke or a fill of it does — kept as far as
  // the clip lets it through; one that lies nowhere is not kept
  item(kind, b, stroke, a0 = 0, a1 = 0, a2 = 0, a3 = 0, a4 = 0, a5 = 0, a6 = 0, a7 = 0, a8 = 0) {
    const r = this.reach(stroke), c = this.cb, all = UNBOUNDED.has(this.p.globalCompositeOperation);
    const l = all ? c[0] : Math.max(b[0] - r, c[0]), t = all ? c[1] : Math.max(b[1] - r, c[1]), rt = all ? c[2] : Math.min(b[2] + r, c[2]), bt = all ? c[3] : Math.min(b[3] + r, c[3]);
    if (!(l <= rt && t <= bt)) return;
    this.styleNow(FILL_STYLE); this.styleNow(STROKE_STYLE);
    this.items.push(kind, this.rowNow(), this.matNow(), this.clipNow, l, t, rt, bt, r, a0, a1, a2, a3, a4, a5, a6, a7, a8);
    if (kind === CLEAR_RECT) return;
    const e = this.extent;
    if (l < e[0]) e[0] = l; if (t < e[1]) e[1] = t; if (rt > e[2]) e[2] = rt; if (bt > e[3]) e[3] = bt;
  }
  // ── the path ──
  // (a command of the path now: under the transform now, said in the stream where it is another than the last's)
  cmd(...nums) {
    const mat = this.matNow(), P = this.path;
    if (this.pmat !== mat) { P.push(P_MAT, mat); this.pmat = mat; }
    for (let i = 0; i < nums.length; i++) P.push(nums[i]);
  }
  beginPath() { this.begun = this.path.length; this.pmat = -1; this.pb = noBox(); this.scan = scanFrom(this.begun); }
  moveTo(x, y) { this.cmd(P_MOVE, x, y); this.at(x, y, this.pb); }
  lineTo(x, y) { this.cmd(P_LINE, x, y); this.at(x, y, this.pb); }
  bezierCurveTo(a, b, c, d, x, y) { this.cmd(P_BEZIER, a, b, c, d, x, y); this.at(a, b, this.pb); this.at(c, d, this.pb); this.at(x, y, this.pb); }
  quadraticCurveTo(a, b, x, y) { this.cmd(P_QUAD, a, b, x, y); this.at(a, b, this.pb); this.at(x, y, this.pb); }
  arc(x, y, r, a0, a1, ccw = false) { this.cmd(P_ARC, x, y, r, a0, a1, ccw ? 1 : 0); arcInto(this.pb, this.m, x, y, r, r, 0, a0, a1, ccw); }
  arcTo(x1, y1, x2, y2, r) { this.cmd(P_ARC_TO, x1, y1, x2, y2, r); this.at(x1, y1, this.pb); this.at(x2, y2, this.pb); }
  ellipse(x, y, rx, ry, rot, a0, a1, ccw = false) { this.cmd(P_ELLIPSE, x, y, rx, ry, rot, a0, a1, ccw ? 1 : 0); arcInto(this.pb, this.m, x, y, rx, ry, rot, a0, a1, ccw); }
  rect(x, y, w, h) { this.cmd(P_RECT, x, y, w, h); this.box(x, y, x + w, y + h, this.pb); }
  roundRect(x, y, w, h, radii = 0) { this.cmd(P_ROUND_RECT, x, y, w, h, ...radiiOf(radii)); this.box(x, y, x + w, y + h, this.pb); }
  closePath() { this.cmd(P_CLOSE); }
  // a path object's commands in the stream of those (as it is now: one changed after it is drawn draws as it was) →
  // where they lie there
  copy(p) {
    const had = this.copied.get(p);
    if (had && had.n === p.cmds.length) return had;
    const O = this.own, start = O.length;
    for (let i = 0; i < p.cmds.length; i++) O.push(p.cmds[i]);
    scanRuns(O, scanFrom(start), O.length, this.ownRuns);
    const now = { n: p.cmds.length, start, end: O.length };
    this.copied.set(p, now);
    return now;
  }
  // a fill, a stroke or a clip — of the path now, or of a path given
  drawn(kind, stroke, clip, a, rule) {
    let start, end, own = 0, b;
    if (a instanceof PaintPath) {
      const c = this.copy(a), f = a.b;
      start = c.start; end = c.end; own = 1;
      b = f[0] <= f[2] ? this.box(f[0], f[1], f[2], f[3], noBox()) : noBox();
    } else {
      rule = a;
      scanRuns(this.path, this.scan, this.path.length, this.runs);
      start = this.begun; end = this.path.length; b = this.pb;
    }
    const r = this.ref(rule === 'evenodd' ? 'evenodd' : 'nonzero');
    if (clip) {
      this.clips.push(this.clipNow, start, end, r, own, this.matNow());
      this.clipNow = this.clips.length / CLIP - 1;
      const c = this.cb;
      this.cb = [Math.max(c[0], b[0]), Math.max(c[1], b[1]), Math.min(c[2], b[2]), Math.min(c[3], b[3])];
      return;
    }
    if (b[0] > b[2] && !UNBOUNDED.has(this.p.globalCompositeOperation)) return;
    this.item(kind, b, stroke, start, end, r, own);
  }
  fill(a, b) { this.drawn(FILL, false, false, a, b); }
  stroke(a) { this.drawn(STROKE, true, false, a, undefined); }
  clip(a, b) { this.drawn(0, false, true, a, b); }
  // ── draws of their own ──
  fillRect(x, y, w, h) { this.item(FILL_RECT, this.box(x, y, x + w, y + h, noBox()), false, x, y, w, h); }
  strokeRect(x, y, w, h) { this.item(STROKE_RECT, this.box(x, y, x + w, y + h, noBox()), true, x, y, w, h); }
  clearRect(x, y, w, h) { this.item(CLEAR_RECT, this.box(x, y, x + w, y + h, noBox()), false, x, y, w, h); }
  // (the measuring context with the text's properties as they are now: every one a measure depends on)
  textContext() {
    const g = measurer(), p = this.p;
    g.font = p.font; g.textAlign = p.textAlign; g.textBaseline = p.textBaseline; g.direction = p.direction;
    g.letterSpacing = p.letterSpacing; g.wordSpacing = p.wordSpacing; g.fontKerning = p.fontKerning;
    return g;
  }
  textBox(text, x, y, maxWidth) {
    const t = this.textContext().measureText(text), k = maxWidth != null && t.width > maxWidth ? maxWidth / t.width : 1;
    return this.box(x - t.actualBoundingBoxLeft * k, y - t.actualBoundingBoxAscent, x + t.actualBoundingBoxRight * k, y + t.actualBoundingBoxDescent, noBox());
  }
  fillText(text, x, y, maxWidth) { text = String(text); this.item(FILL_TEXT, this.textBox(text, x, y, maxWidth), false, this.ref(text), x, y, maxWidth ?? NaN); }
  strokeText(text, x, y, maxWidth) { text = String(text); this.item(STROKE_TEXT, this.textBox(text, x, y, maxWidth), true, this.ref(text), x, y, maxWidth ?? NaN); }
  measureText(text) { return this.textContext().measureText(String(text)); }
  // A picture a painting draws (drawImage, a pattern), as it is now: an ImageBitmap never changes and is taken as it
  // is; a canvas is copied — its pixels read —, one copy for each content: the same canvas drawn again unchanged (or
  // another with the same pixels) is the copy there is, one changed in between is another picture. What Canvas
  // refuses to draw (a canvas of no size, a thing that is no image) throws here as it does there.
  pictured(image) {
    if (image instanceof ImageBitmap) return image;
    const w = image.width, h = image.height;
    const g = (copying ??= new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true })), c = g.canvas;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } else g.clearRect(0, 0, w, h);
    g.drawImage(image, 0, 0);
    const copy = g.getImageData(0, 0, w, h), H = [0x811c9dc5, 0x9747b28c];
    mixNumbers(H, copy.data);
    const key = `${w}:${h}:${H[0]}:${H[1]}`, had = this.pictures.get(key);
    if (!had) { this.pictures.set(key, [copy]); return copy; }
    for (const one of had) if (sameBytes(one.data, copy.data)) return one;
    had.push(copy);
    return copy;
  }
  // an image the painting made itself (an OffscreenCanvas, an ImageBitmap): drawn as it is now
  drawImage(image, ...a) {
    const picture = this.pictured(image);
    const [sx, sy, sw, sh, dx, dy, dw, dh] = a.length === 2 ? [0, 0, image.width, image.height, a[0], a[1], image.width, image.height]
      : a.length === 4 ? [0, 0, image.width, image.height, a[0], a[1], a[2], a[3]] : a;
    this.item(IMAGE, this.box(dx, dy, dx + dw, dy + dh, noBox()), false, this.ref(picture), sx, sy, sw, sh, dx, dy, dw, dh);
  }
  // ── state ──
  save() { this.stack.push([this.m.slice(), this.mat, { ...this.p }, this.dash, this.cur.slice(), this.row, this.clipNow, this.cb]); }
  restore() {
    const s = this.stack.pop();
    if (s) [this.m, this.mat, this.p, this.dash, this.cur, this.row, this.clipNow, this.cb] = s;
  }
  // (Canvas's rule: a transform given a number that is not finite is ignored)
  mul(a, b, c, d, e, f) {
    if (!(Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) && Number.isFinite(d) && Number.isFinite(e) && Number.isFinite(f))) return;
    const m = this.m;
    this.m = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]];
    this.mat = -1;
  }
  translate(x, y) { this.mul(1, 0, 0, 1, x, y); }
  rotate(a) { const c = Math.cos(a), s = Math.sin(a); this.mul(c, s, -s, c, 0, 0); }
  scale(x, y) { this.mul(x, 0, 0, y, 0, 0); }
  transform(a, b, c, d, e, f) { this.mul(a, b, c, d, e, f); }
  // (six numbers, or a matrix — none given: the identity, as Canvas has it; one that is not finite: ignored)
  setTransform(a, b, c, d, e, f) {
    if (arguments.length < 2) {
      const M = a ?? {};
      a = M.a ?? M.m11 ?? 1; b = M.b ?? M.m12 ?? 0; c = M.c ?? M.m21 ?? 0; d = M.d ?? M.m22 ?? 1; e = M.e ?? M.m41 ?? 0; f = M.f ?? M.m42 ?? 0;
    }
    const m = [Number(a), Number(b), Number(c), Number(d), Number(e), Number(f)];
    if (!m.every(Number.isFinite)) return;
    this.m = m; this.mat = -1;
  }
  resetTransform() { this.m = [1, 0, 0, 1, 0, 0]; this.mat = 0; }
  getTransform() { return new DOMMatrix(this.m); }
  // (as a context takes it: a list with a number below zero or not finite is refused, one of an odd count doubled)
  setLineDash(d) {
    const g = measurer();
    g.setLineDash(this.dash); g.setLineDash(d);
    const dash = g.getLineDash();
    if (sameNumbers(dash, this.dash)) return;
    this.dash = dash; this.cur[DASH] = this.ref(dash); this.row = -1;
  }
  getLineDash() { return this.dash.slice(); }
  createLinearGradient(...a) { return new Style('linear', a); }
  createRadialGradient(...a) { return new Style('radial', a); }
  createConicGradient(...a) { return new Style('conic', a); }
  createPattern(image, repetition) { return new Style('pattern', [repetition], this.pictured(image)); }
  // ── not recorded: what reads pixels ──
  getImageData() { this.warn('a painting does not read pixels (getImageData): it paints'); return null; }
  putImageData() { this.warn('a painting does not put pixels (putImageData): paint with paths, or drawImage of its own canvas'); }
  isPointInPath() { this.warn('a painting does not ask the canvas (isPointInPath)'); return false; }
  isPointInStroke() { this.warn('a painting does not ask the canvas (isPointInStroke)'); return false; }
  // A colour laid under the finished painting (a form's ground: 5.23) — taken opaque: one with alpha is said, and its
  // alpha dropped → false: it is no colour (nothing is taken)
  ground(color) {
    const c = probed('fillStyle', color, null);
    if (typeof c !== 'string') return false;
    this.under = c;
    // (a context keeps an opaque colour as #rrggbb; any other is painted — one pixel — and read)
    if (c[0] !== '#') {
      const g = measurer();
      g.save();
      g.globalAlpha = 1; g.filter = 'none'; g.shadowColor = DEFAULTS.shadowColor; g.globalCompositeOperation = 'copy';
      g.fillStyle = c; g.fillRect(0, 0, 1, 1);
      g.restore();
      const px = g.getImageData(0, 0, 1, 1).data;
      if (px[3] < 255) { this.warn(`e.form: its ground is opaque — the alpha of "${color}" is dropped`); this.under = `rgb(${px[0]}, ${px[1]}, ${px[2]})`; }
    }
    return true;
  }
  // the recording made — its content hashed, its tree made —, the recorder done with
  end() {
    const shift = this.path.length, R = this.laid;
    const path = new Float64Array(this.path.concat(this.own));
    const runs = new Float64Array(this.runs.concat(this.ownRuns));
    for (let o = this.runs.length; o < runs.length; o += RUNS) { runs[o] += shift; runs[o + 1] += shift; }
    const clips = new Float64Array(this.clips);
    for (let o = CLIP; o < clips.length; o += CLIP) if (clips[o + 4]) { clips[o + 1] += shift; clips[o + 2] += shift; }
    const e = this.extent;
    // (a ground is ink over the whole rect)
    if (this.under != null) { grow(e, R[0], R[1]); grow(e, R[2], R[3]); }
    const items = new Float64Array(this.items);
    for (let o = 0; o < items.length; o += ITEM) if ((items[o] === FILL || items[o] === STROKE) && items[o + ARG + 3]) { items[o + ARG] += shift; items[o + ARG + 1] += shift; }
    const mats = new Float64Array(this.mats), rows = new Int32Array(this.rows);
    const H = [0x811c9dc5, 0x9747b28c];
    mixNumbers(H, path); mixNumbers(H, items); mixNumbers(H, mats); mixNumbers(H, rows); mixNumbers(H, clips);
    for (let i = 0; i < this.refs.length; i++) mixRef(H, this.refs[i]);
    mixRef(H, this.under);
    const tree = boxTree(items);
    return new Recording({ path, runs, items, mats, rows, clips, refs: this.refs, order: tree.order, levels: tree.levels, extent: e[0] <= e[2] ? e : null, rect: R, under: this.under, dense: denseOf(items, rows, this.refs, this.under), h1: H[0] >>> 0, h2: H[1] >>> 0 });
  }
}
for (const name of PROPS) {
  const id = PROP_ID.get(name), style = id === FILL_STYLE || id === STROKE_STYLE;
  Object.defineProperty(Recorder.prototype, name, {
    get() { return this.p[name]; },
    // A gradient or a pattern of the painting's own making is held as it is (a fill's, a stroke's). Anything else is
    // given to a real context that holds the value now: what it holds afterwards is the value — the one before, where
    // Canvas refuses what it was given; as Canvas keeps it, where it takes it.
    set(v) {
      const held = this.p[name];
      let value = v;
      if (!(style && v instanceof Style)) {
        value = held instanceof Style ? probed(name, v, held) : taken(name, held, v);
        // (a gradient or a pattern another canvas's context made: a context takes it, a recording cannot carry it)
        if (value !== null && typeof value === 'object' && value !== held) { this.warn(`${name}: a gradient or a pattern is made with the painting's own canvas (g.createLinearGradient, g.createPattern …) — one of another canvas is not taken`); return; }
      }
      if (value === held) return;
      this.p[name] = value;
      // (a gradient or a pattern is named where it is drawn with, as it is then: styleNow)
      if (value instanceof Style) return;
      const r = this.ref(value);
      if (this.cur[id] !== r) { this.cur[id] = r; this.row = -1; }
    },
  });
}

// The items' boxes as a tree: the boxes in the order of where they lie (their centres along a Z-curve over all of
// them: neighbours in it lie near), then level after level each FAN of the level below in the box round them, till one
// level is FAN boxes or fewer → { order — each leaf's item —, levels — the leaves' boxes first ([l, t, r, b] each) }
const FAN = 8;
function boxTree(items) {
  const n = items.length / ITEM, order = new Uint32Array(n), code = new Uint32Array(n);
  // (the finite span of them: a box reaching anywhere — a filter's untold reach, a clip's — is placed by its finite sides)
  let lx = Infinity, ly = Infinity, hx = -Infinity, hy = -Infinity;
  for (let i = 0; i < n; i++) {
    const o = i * ITEM + I_BOX;
    for (let k = 0; k < 4; k += 2) { const x = items[o + k], y = items[o + k + 1]; if (Number.isFinite(x)) { if (x < lx) lx = x; if (x > hx) hx = x; } if (Number.isFinite(y)) { if (y < ly) ly = y; if (y > hy) hy = y; } }
  }
  const kx = hx > lx ? 65535 / (hx - lx) : 0, ky = hy > ly ? 65535 / (hy - ly) : 0;
  const spread = v => { v = (v | (v << 8)) & 0x00ff00ff; v = (v | (v << 4)) & 0x0f0f0f0f; v = (v | (v << 2)) & 0x33333333; return (v | (v << 1)) & 0x55555555; };
  const mid = (a, b, lo, hi) => { const m = (Math.max(a, lo) + Math.min(b, hi)) / 2; return Number.isFinite(m) ? m : lo; };
  for (let i = 0; i < n; i++) {
    const o = i * ITEM + I_BOX;
    const x = Math.round((mid(items[o], items[o + 2], lx, hx) - lx) * kx) || 0, y = Math.round((mid(items[o + 1], items[o + 3], ly, hy) - ly) * ky) || 0;
    order[i] = i; code[i] = (spread(x) | (spread(y) << 1)) >>> 0;
  }
  order.sort((a, b) => code[a] - code[b] || a - b);
  let level = new Float64Array(n * 4);
  for (let i = 0; i < n; i++) { const o = order[i] * ITEM + I_BOX; level[i * 4] = items[o]; level[i * 4 + 1] = items[o + 1]; level[i * 4 + 2] = items[o + 2]; level[i * 4 + 3] = items[o + 3]; }
  const levels = [level];
  while (level.length > FAN * 4) {
    const below = level, m = below.length >> 2, up = new Float64Array(Math.ceil(m / FAN) * 4);
    for (let j = 0; j * FAN < m; j++) {
      let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
      for (let i = j * FAN; i < Math.min(m, (j + 1) * FAN); i++) { if (below[i * 4] < l) l = below[i * 4]; if (below[i * 4 + 1] < t) t = below[i * 4 + 1]; if (below[i * 4 + 2] > r) r = below[i * 4 + 2]; if (below[i * 4 + 3] > b) b = below[i * 4 + 3]; }
      up[j * 4] = l; up[j * 4 + 1] = t; up[j * 4 + 2] = r; up[j * 4 + 3] = b;
    }
    levels.push(level = up);
  }
  return { order, levels };
}
// the items a replay found (a thread replays one region at a time: one list, grown as needed)
let found = new Int32Array(1024), nFound = 0;

// What a painting did, to be replayed. replay(g, region, scale): into context g — the region [l, t, r, b] of the
// painting at `scale` (canvas pixels a unit), the region's top-left at g's origin as it is now (the caller's own
// transform kept: a device scale, an uneven stretch). touches(l, t, r, b): whether any draw reaches that box.
// uniform(l, t, r, b, pad): the one opaque colour a replay leaves all over that box, if it is one. same(o):
// the same picture. wire() → what another thread is sent (Recording.transfers: what of it is moved, not copied;
// Recording.fromWire there).
export class Recording {
  constructor(d) {
    this.path = d.path; this.runs = d.runs; this.items = d.items; this.mats = d.mats; this.rows = d.rows; this.clips = d.clips; this.refs = d.refs;
    this.order = d.order; this.levels = d.levels; this.extent = d.extent; this.rect = d.rect; this.h1 = d.h1; this.h2 = d.h2;
    // (the colour laid under it as it is rastered — a form's ground —, or null)
    this.under = d.under ?? null;
    // (how much one draw of it covers a pixel at most, 0…1: denseOf)
    this.dense = d.dense ?? 1;
    // (as it came from another thread: sent on as it is)
    this.wired = null;
  }
  get empty() { return this.extent === null; }
  // Whether anything is drawn in the box [l, t, r, b] (painting units; edges touching count): a draw's box — as far as
  // it reaches, as its clips let it through — meets it. Never false where something is painted (a draw's box holds all
  // it paints); true, at worst, where a draw's box is wider than its ink.
  touches(l, t, r, b) {
    const e = this.extent, R = this.rect;
    if (!e || e[2] < l || e[0] > r || e[3] < t || e[1] > b) return false;
    // (a ground is drawn all over the rect)
    if (this.under != null && !(R[2] < l || R[0] > r || R[3] < t || R[1] > b)) return true;
    const T = this.levels, top = T.length - 1;
    return this.touched(top, 0, T[top].length >> 2, l, t, r, b);
  }
  touched(at, from, to, l, t, r, b) {
    const L = this.levels[at];
    for (let i = from; i < to; i++) {
      const o = i * 4;
      if (L[o + 2] < l || L[o] > r || L[o + 3] < t || L[o + 1] > b) continue;
      if (at === 0) { if (this.items[this.order[i] * ITEM] !== CLEAR_RECT) return true; }
      else if (this.touched(at - 1, i * FAN, Math.min((i + 1) * FAN, this.levels[at - 1].length >> 2), l, t, r, b)) return true;
    }
    return false;
  }
  // The one opaque colour a replay leaves in every pixel of box [l, t, r, b] (painting units), if it is one — the last
  // draw whose box meets the box grown by `pad` (as touches() finds them, a rect cleared too) is a rect filled over
  // all of the box: straight (no turn, no clip), in an opaque colour (#rrggbb, as a context keeps one), at full alpha,
  // over what is there (source-over), with no shadow and no filter; or no draw meets it and the ground is laid there
  // → the colour's three bytes, as Canvas rasters it (red the low byte); −1: it is not one colour (or nothing is painted)
  uniform(l, t, r, b, pad) {
    if (!this.extent) return -1;
    const T = this.levels, top = T.length - 1;
    nFound = 0;
    this.find(top, 0, T[top].length >> 2, l - pad, t - pad, r + pad, b + pad);
    if (!nFound) return this.under != null && (OPAQUE_HEX.test(this.under) || this.under.startsWith('rgb(')) ? bytesOf(this.under) : -1;
    let last = 0;
    for (let n = 0; n < nFound; n++) if (found[n] > last) last = found[n];
    const I = this.items, o = last * ITEM, a = o + ARG, row = I[o + I_ROW] * ROW, M = this.mats, m = I[o + I_MAT] * 6, refs = this.refs, RW = this.rows;
    if (I[o] !== FILL_RECT || I[o + I_CLIP] !== 0 || M[m + 1] !== 0 || M[m + 2] !== 0) return -1;
    const fill = refs[RW[row + FILL_STYLE]];
    if (typeof fill !== 'string' || !OPAQUE_HEX.test(fill) || refs[RW[row + ALPHA]] !== 1 || refs[RW[row + COMPOSITE]] !== 'source-over'
      || refs[RW[row + FILTER]] !== 'none' || refs[RW[row + SHADOW]] !== DEFAULTS.shadowColor) return -1;
    const x0 = M[m] * I[a] + M[m + 4], x1 = M[m] * (I[a] + I[a + 2]) + M[m + 4], y0 = M[m + 3] * I[a + 1] + M[m + 5], y1 = M[m + 3] * (I[a + 1] + I[a + 3]) + M[m + 5];
    return Math.min(x0, x1) <= l && Math.max(x0, x1) >= r && Math.min(y0, y1) <= t && Math.max(y0, y1) >= b ? bytesOf(fill) : -1;
  }
  // (the items whose boxes meet [l, t, r, b], into `found`)
  find(at, from, to, l, t, r, b) {
    const L = this.levels[at];
    for (let i = from; i < to; i++) {
      const o = i * 4;
      if (L[o + 2] < l || L[o] > r || L[o + 3] < t || L[o + 1] > b) continue;
      if (at > 0) { this.find(at - 1, i * FAN, Math.min((i + 1) * FAN, this.levels[at - 1].length >> 2), l, t, r, b); continue; }
      if (nFound === found.length) { const wider = new Int32Array(found.length * 2); wider.set(found); found = wider; }
      found[nFound++] = this.order[i];
    }
  }
  // the same picture: the same numbers, the same things named
  same(o) {
    if (o === this) return true;
    if (!o || o.h1 !== this.h1 || o.h2 !== this.h2 || o.refs.length !== this.refs.length || o.under !== this.under) return false;
    if (!sameNumbers(this.items, o.items) || !sameNumbers(this.path, o.path) || !sameNumbers(this.mats, o.mats) || !sameNumbers(this.rows, o.rows) || !sameNumbers(this.clips, o.clips)) return false;
    for (let i = 0; i < this.refs.length; i++) if (!sameRef(this.refs[i], o.refs[i])) return false;
    return true;
  }
  replay(g, region, scale) {
    if (!this.extent) return;
    const I = this.items, P = this.path, RN = this.runs, M = this.mats, RW = this.rows, C = this.clips, refs = this.refs;
    const l = region[0], t = region[1], r = region[2], b = region[3];
    // (what lies outside the region by less than a pixel still touches it: antialiasing)
    const pad = 1 / scale, top = this.levels.length - 1;
    nFound = 0;
    this.find(top, 0, this.levels[top].length >> 2, l - pad, t - pad, r + pad, b + pad);
    if (!nFound) { if (this.under != null) laidUnder(g, this.under); return; }
    const hits = found.subarray(0, nFound).sort(), nHits = nFound, nRuns = RN.length / RUNS;
    // A: the caller's transform and the scale; the item's transform (a b c d e f) kept here in doubles — Canvas is given
    // A · it without its translation and each point p as p − q, q being where the region's corner is in its units
    const base = g.getTransform(), Aa = base.a * scale, Ab = base.b * scale, Ac = base.c * scale, Ad = base.d * scale, Ae = base.e, Af = base.f;
    let ma = 1, mb = 0, mc = 0, md = 1, me = 0, mf = 0, qx = l, qy = t, gen = 0, mat = -1;
    const placed = () => {
      const det = ma * md - mb * mc;
      if (det) { const rx = l - me, ry = t - mf; qx = (md * rx - mc * ry) / det; qy = (-mb * rx + ma * ry) / det; } else { qx = 0; qy = 0; }
      gen++;
      g.setTransform(Aa * ma + Ac * mb, Ab * ma + Ad * mb, Aa * mc + Ac * md, Ab * mc + Ad * md, Ae, Af);
    };
    const setMat = id => {
      if (id === mat) return;
      mat = id;
      const o = id * 6;
      ma = M[o]; mb = M[o + 1]; mc = M[o + 2]; md = M[o + 3]; me = M[o + 4]; mf = M[o + 5];
      placed();
    };
    // ── a path's stretch into the context's path — its far runs as their chords ──
    // (the region in the units of the transform now, grown by as far as the draw reaches and a pixel: found for the
    // transform and the draw it is asked under — none where the transform has no inverse: nothing is far)
    let reach = 0, chords = false, ux0 = 0, uy0 = 0, ux1 = 0, uy1 = 0, uGen = -1;
    const far = o => {
      if (uGen !== gen) {
        uGen = gen;
        const det = ma * md - mb * mc;
        if (!det) { ux0 = uy0 = -Infinity; ux1 = uy1 = Infinity; }
        else {
          const T2 = ma * ma + mb * mb + mc * mc + md * md, smin = Math.sqrt(Math.max(1e-300, (T2 - Math.sqrt(Math.max(0, T2 * T2 - 4 * det * det))) / 2));
          const by = (reach + 2 * pad) / smin;
          ux0 = uy0 = Infinity; ux1 = uy1 = -Infinity;
          for (let k = 0; k < 4; k++) {
            const X = (k & 1 ? r : l) - me, Y = (k & 2 ? b : t) - mf, u = (md * X - mc * Y) / det, v = (-mb * X + ma * Y) / det;
            if (u < ux0) ux0 = u; if (u > ux1) ux1 = u; if (v < uy0) uy0 = v; if (v > uy1) uy1 = v;
          }
          ux0 -= by; uy0 -= by; ux1 += by; uy1 += by;
        }
      }
      return RN[o + 4] < ux0 || RN[o + 2] > ux1 || RN[o + 5] < uy0 || RN[o + 3] > uy1;
    };
    const emit = (i, end, level) => {
      // (the first run that begins at or after i: only a stretch's own commands are in runs, never a path added to it)
      let ri = nRuns;
      if (level === 0) { let lo = 0, hi = nRuns; while (lo < hi) { const m = (lo + hi) >> 1; if (RN[m * RUNS] < i) lo = m + 1; else hi = m; } ri = lo; }
      while (i < end) {
        if (ri < nRuns && RN[ri * RUNS] === i) {
          const o = ri * RUNS;
          ri++;
          if (chords && RN[o + 1] <= end && far(o)) { g.lineTo(RN[o + 6] - qx, RN[o + 7] - qy); i = RN[o + 1]; continue; }
        }
        switch (P[i]) {
          case P_MAT: setMat(P[i + 1]); i += 2; break;
          case P_MOVE: g.moveTo(P[i + 1] - qx, P[i + 2] - qy); i += 3; break;
          case P_LINE: g.lineTo(P[i + 1] - qx, P[i + 2] - qy); i += 3; break;
          case P_BEZIER: g.bezierCurveTo(P[i + 1] - qx, P[i + 2] - qy, P[i + 3] - qx, P[i + 4] - qy, P[i + 5] - qx, P[i + 6] - qy); i += 7; break;
          case P_QUAD: g.quadraticCurveTo(P[i + 1] - qx, P[i + 2] - qy, P[i + 3] - qx, P[i + 4] - qy); i += 5; break;
          case P_ARC: g.arc(P[i + 1] - qx, P[i + 2] - qy, P[i + 3], P[i + 4], P[i + 5], !!P[i + 6]); i += 7; break;
          case P_ARC_TO: g.arcTo(P[i + 1] - qx, P[i + 2] - qy, P[i + 3] - qx, P[i + 4] - qy, P[i + 5]); i += 6; break;
          case P_ELLIPSE: g.ellipse(P[i + 1] - qx, P[i + 2] - qy, P[i + 3], P[i + 4], P[i + 5], P[i + 6], P[i + 7], !!P[i + 8]); i += 9; break;
          case P_RECT: g.rect(P[i + 1] - qx, P[i + 2] - qy, P[i + 3], P[i + 4]); i += 5; break;
          case P_ROUND_RECT: {
            const n = P[i + 5], radii = [];
            for (let k = 0; k < n; k++) radii.push({ x: P[i + 6 + 2 * k], y: P[i + 7 + 2 * k] });
            g.roundRect(P[i + 1] - qx, P[i + 2] - qy, P[i + 3], P[i + 4], radii);
            i += 6 + 2 * n; break;
          }
          case P_CLOSE: g.closePath(); i += 1; break;
          case P_SUB: {
            // (a path added through its matrix: its commands under the transform now and that matrix, then back)
            const a = P[i + 1], b2 = P[i + 2], c = P[i + 3], d = P[i + 4], e = P[i + 5], f = P[i + 6], n = P[i + 7];
            const wa = ma, wb = mb, wc = mc, wd = md, we = me, wf = mf, was = mat, wasChords = chords;
            ma = wa * a + wc * b2; mb = wb * a + wd * b2; mc = wa * c + wc * d; md = wb * c + wd * d; me = wa * e + wc * f + we; mf = wb * e + wd * f + wf;
            mat = -1; chords = false;
            placed();
            emit(i + 8, i + 8 + n, level + 1);
            ma = wa; mb = wb; mc = wc; md = wd; me = we; mf = wf; mat = was; chords = wasChords;
            placed();
            i += 8 + n; break;
          }
          default: throw new Error(`recording: path command ${P[i]} at ${i}`);
        }
      }
    };
    // (a stretch as the context's path: `own` — a path object's, its points in transform `m`)
    const pathOf = (from, to, own, m, by, whole) => {
      reach = by; chords = !whole; uGen = -1;
      g.beginPath();
      if (own) setMat(m);
      emit(from, to, 0);
    };
    // ── the properties: only what differs from the row before is set ──
    let row = 0, fillS = null, strokeS = null, fillGen = -1, strokeGen = -1, dashed = false, clip = 0;
    const setRow = to => {
      if (to === row) return;
      const a = row * ROW, c = to * ROW;
      for (let k = 0; k < ROW; k++) {
        const v = RW[c + k];
        if (v === RW[a + k]) continue;
        const value = refs[v];
        if (k === DASH) { g.setLineDash(value); dashed = value.length > 0; continue; }
        if (isStyle(value)) { if (k === FILL_STYLE) { fillS = value; fillGen = -1; } else { strokeS = value; strokeGen = -1; } continue; }
        if (k === FILL_STYLE) fillS = null; else if (k === STROKE_STYLE) strokeS = null;
        g[PROPS[k]] = SCALED[k] ? value * scale : k === FILTER ? scaledFilter(value, scale) : value;
      }
      row = to;
    };
    // (the styles made for where the points are now, before a draw that uses them)
    const fills = () => { if (fillS && fillGen !== gen) { g.fillStyle = styleAt(fillS, g, qx, qy); fillGen = gen; } };
    const strokes = () => { if (strokeS && strokeGen !== gen) { g.strokeStyle = styleAt(strokeS, g, qx, qy); strokeGen = gen; } };
    // (a clip: the context back as it began, then the clips it was made inside and itself, outermost first)
    const chain = [];
    const setClip = to => {
      g.restore(); g.save();
      row = 0; fillS = strokeS = null; dashed = false; mat = -1;
      chain.length = 0;
      for (let k = to; k > 0; k = C[k * CLIP]) chain.push(k);
      for (let n = chain.length - 1; n >= 0; n--) {
        const o = chain[n] * CLIP;
        pathOf(C[o + 1], C[o + 2], C[o + 4], C[o + 5], 0, false);
        g.clip(refs[C[o + 3]]);
      }
      clip = to;
    };
    // (a rect filled or cleared, cut to the region — in the item's units, a little past it and past what its effects
    // reach: its far edges, far off, are no small numbers) → whether any of it is left (in `cut`: x, y, w, h)
    const cut = [0, 0, 0, 0];
    const cutRect = (x, y, w, h, by) => {
      let x0 = Math.min(x, x + w), x1 = Math.max(x, x + w), y0 = Math.min(y, y + h), y1 = Math.max(y, y + h);
      const det = ma * md - mb * mc;
      if (det) {
        const T2 = ma * ma + mb * mb + mc * mc + md * md, smin = Math.sqrt(Math.max(1e-300, (T2 - Math.sqrt(Math.max(0, T2 * T2 - 4 * det * det))) / 2));
        const px = (4 * pad + by) / smin;
        let lx = Infinity, ly = Infinity, hx = -Infinity, hy = -Infinity;
        for (let k = 0; k < 4; k++) {
          const X = (k & 1 ? r : l) - me, Y = (k & 2 ? b : t) - mf, u = (md * X - mc * Y) / det, v = (-mb * X + ma * Y) / det;
          if (u < lx) lx = u; if (u > hx) hx = u; if (v < ly) ly = v; if (v > hy) hy = v;
        }
        x0 = Math.max(x0, lx - px); x1 = Math.min(x1, hx + px); y0 = Math.max(y0, ly - px); y1 = Math.min(y1, hy + px);
        if (x0 >= x1 || y0 >= y1) return false;
      }
      cut[0] = x0 - qx; cut[1] = y0 - qy; cut[2] = x1 - x0; cut[3] = y1 - y0;
      return true;
    };
    g.save();
    // the context as a painting starts it (the caller's may differ)
    for (let k = 0; k < PROPS.length; k++) { const v = DEFAULTS[PROPS[k]]; g[PROPS[k]] = SCALED[k] ? v * scale : v; }
    g.setLineDash([]);
    g.save();
    for (let h = 0; h < nHits; h++) {
      const o = hits[h] * ITEM, a = o + ARG;
      if (I[o + I_CLIP] !== clip) setClip(I[o + I_CLIP]);
      setRow(I[o + I_ROW]);
      switch (I[o]) {
        case FILL:
          pathOf(I[a], I[a + 1], I[a + 3], I[o + I_MAT], I[o + I_REACH], false);
          setMat(I[o + I_MAT]); fills();
          g.fill(refs[I[a + 2]]);
          break;
        case STROKE:
          pathOf(I[a], I[a + 1], I[a + 3], I[o + I_MAT], I[o + I_REACH], dashed);
          setMat(I[o + I_MAT]); strokes();
          g.stroke();
          break;
        case FILL_RECT:
          setMat(I[o + I_MAT]);
          if (cutRect(I[a], I[a + 1], I[a + 2], I[a + 3], I[o + I_REACH])) { fills(); g.fillRect(cut[0], cut[1], cut[2], cut[3]); }
          break;
        case CLEAR_RECT:
          setMat(I[o + I_MAT]);
          if (cutRect(I[a], I[a + 1], I[a + 2], I[a + 3], 0)) g.clearRect(cut[0], cut[1], cut[2], cut[3]);
          break;
        case STROKE_RECT: setMat(I[o + I_MAT]); strokes(); g.strokeRect(I[a] - qx, I[a + 1] - qy, I[a + 2], I[a + 3]); break;
        case FILL_TEXT: case STROKE_TEXT: {
          setMat(I[o + I_MAT]);
          const fill = I[o] === FILL_TEXT, f = fill ? 'fillText' : 'strokeText', w = I[a + 3];
          if (fill) fills(); else strokes();
          if (w !== w) g[f](refs[I[a]], I[a + 1] - qx, I[a + 2] - qy); else g[f](refs[I[a]], I[a + 1] - qx, I[a + 2] - qy, w);
          break;
        }
        case IMAGE: setMat(I[o + I_MAT]); g.drawImage(refs[I[a]], I[a + 1], I[a + 2], I[a + 3], I[a + 4], I[a + 5] - qx, I[a + 6] - qy, I[a + 7], I[a + 8]); break;
        default: throw new Error(`recording: item ${I[o]} at ${o}`);
      }
    }
    g.restore();
    g.restore();
    // the ground under all of it, what the painting erased too
    if (this.under != null) laidUnder(g, this.under);
  }

  // What another thread is sent: its numbers, and what they name as a thread can be sent it — a gradient as its
  // numbers, an image (the pixels copied when it was drawn, or an ImageBitmap of the painting's) as an ImageBitmap
  // made of it (asynchronously — so this is a promise). One that came from another thread is sent on as it came.
  // Where one of its images is no picture it fails with that, the ImageBitmaps made of the others closed.
  async wire() {
    if (this.wired) return this.wired;
    // (an ImageBitmap of each, of the painting's own bitmaps too: what is sent is moved, and the painting keeps its own)
    const snap = img => createImageBitmap(img);
    const made = await Promise.allSettled(this.refs.map(async v => {
      if (v instanceof Style) return { style: v.kind, args: v.args, stops: v.stops, image: v.image ? await snap(v.image) : null };
      if (v != null && typeof v === 'object' && !Array.isArray(v)) return snap(v);
      return v;
    }));
    const failed = made.find(r => r.status === 'rejected');
    if (failed) {
      for (const { value: v } of made) {
        if (v instanceof ImageBitmap) v.close();
        else if (v != null && typeof v === 'object' && v.image instanceof ImageBitmap) v.image.close();
      }
      throw failed.reason;
    }
    const refs = made.map(r => r.value);
    return { path: this.path, runs: this.runs, items: this.items, mats: this.mats, rows: this.rows, clips: this.clips, refs, order: this.order, levels: this.levels, extent: this.extent, rect: this.rect, under: this.under, dense: this.dense, h1: this.h1, h2: this.h2 };
  }
  // what of a sent recording is moved to the thread it is sent to: its numbers' memory, its images
  static transfers(w) {
    const list = [w.path.buffer, w.runs.buffer, w.items.buffer, w.mats.buffer, w.rows.buffer, w.clips.buffer, w.order.buffer];
    for (const level of w.levels) list.push(level.buffer);
    for (const v of w.refs) {
      if (v instanceof ImageBitmap) list.push(v);
      else if (v != null && typeof v === 'object' && v.image instanceof ImageBitmap) list.push(v.image);
    }
    return [...new Set(list)];
  }
  static fromWire(w) {
    const rec = new Recording(w);
    rec.wired = w;
    return rec;
  }
  // The recording ended on this thread: the images it carries closed (their memory is not the collector's to count).
  // The sheets end what they were given (sheets/cache.js release: SH1), a painter its copy (sheets/painters.js drop).
  close() {
    for (const v of this.refs) {
      if (v instanceof ImageBitmap) v.close();
      else if (v != null && typeof v === 'object' && v.image instanceof ImageBitmap) v.image.close();
    }
  }
}
