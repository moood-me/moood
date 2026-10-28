// The language's layer of the page (docs/games/miniux/language.md §2.8, §3): what it shows over the scene — marks at the
// scene's points, paths, the effects of touches and errors — and where. It never draws into the scene: the scene
// answers by its keys, the game's business; nothing here repaints the scene.
//   The window: the 4:3 rectangle inscribed in the scene's frame (stage.frame()) — seen on every screen: a scene puts
// what a player touches or follows in it (a point out of it is the scene's error, seen in the debug: off). Marks stand
// where their points are, anywhere on the screen — the scene's canvas, all an engine-3 scene shows: its frame and the
// world round it (a wide or a tall screen: beside the window too — a thing seen is drawn by the world, so it can be
// pressed; a camera that moves brings them in) —, not nearer than 0.08 of the window's height to the screen's edges,
// 0.15 to its top corners (buttons), nor under the plate at the window's top (0.15 of its height), nor in the band of
// speech at its foot (0.2): a point there — its mark moved to the nearest place allowed; a point off the screen (or
// unseen) — its mark is hidden till it comes back.
//   Sizes go with the frame: the language's px (marks, radii, the ghost, the effects) are px of a window REF px high —
// on a larger one all of it is k = window height / REF times larger (never smaller: on a phone they stay a finger's).
//   const layer = createLayer({ root, where, frame, screen, onFrame })
//     where(ref) → {x, y, seen} (page px) | null; frame() → the scene's frame on the page {x, y, w, h}; screen() → the
//     scene's canvas on the page {x, y, w, h}; onFrame(fn)
//   layer.k() → the scale now (≥ 1; the root's --mg-k, for the CSS); layer.window() → {x, y, w, h}; layer.allowed() → the box marks may stand in; layer.fit(p) → p kept within it, or
//     null (out of the frame, unseen)
//   layer.point(ref) → where a point's mark stands {x, y, off} (off: out of the window, or moved in) | null
//   layer.mark({at, kind, size}) → a mark (below), size in the language's px; at: a ref ('id#name', 'id@') or a function → {x, y} (page px)
//   layer.svg(tag, attrs) → an element of the paths' sheet; layer.onPlace(fn) → off — fn() each time things are placed
//   layer.touch(p) — a soft ring of light round the finger (seen beside it, not under it — М10)
//   layer.ripple(p, {double}), .spark(p), .crumb(p, side), .flash(p) — the effects
//   layer.place() — all placed now (as the scene says a frame, and on a resize); layer.host — where marks are (and what
//     stands with them: a press's petals); layer.clear() — none of it any more
// A mark — kinds: 'ring' (press), 'groove' (it will fill: hold), 'dash' (a way from it: pull, trace, turn), 'spot'
// (rub, seek), 'light' (a beat's sign: a soft light without edges, no touch). mark.pos ({x, y} where it stands now),
// .el, .size (px on the page now), .base (the language's px); .fill(u) — its fill; .arc(u, 'danger' | 'time') — its one outer arc; .is(state, on) — 'waiting' (it shows,
// by its kind, what to do with it), 'held', 'hidden', 'quiet', 'theirs' | 'own' (a way's colour), 'target', 'reached'
// (what is carried is in it now), 'closed' (a target not to go to), 'open' (its petals out); .do(effect, {toward}) —
// 'press', 'release', 'twitch', 'shake', 'jerk', 'pop'; .follow(fn | null) — it stands where fn says (a gesture moving
// it with its thing) or at its own place again; .own() — its own place; .where() — where it stands; .remove()
const NS = 'http://www.w3.org/2000/svg';
export const SIZES = { ring: 60, groove: 80, dash: 60, spot: 120, light: 150 }; // (a ring's circle drawn 44 across, §2.1)
export const REF = 640; // px: the window's height the language's px are of (a phone held sideways is about it, or less)

export function createLayer({ root, where, frame, screen, onFrame }) {
  const paths = document.createElementNS(NS, 'svg');
  paths.classList.add('mg-paths');
  const marks = el('div', 'mg-marks', root), fx = el('div', 'mg-fx', root);
  root.prepend(paths);
  const live = new Set(), placers = new Set();
  let K = 1; // the scale now: window height / REF, never below 1
  const k = () => K;
  const rescale = () => {
    const next = Math.max(1, frame().h / REF);
    if (Math.abs(next - K) < 0.005) return false;
    K = next; root.style.setProperty('--mg-k', K.toFixed(3));
    return true;
  };

  function window_() {
    const f = frame();
    const w = Math.min(f.w, f.h * 4 / 3);
    return { x: f.x + (f.w - w) / 2, y: f.y, w, h: f.h };
  }
  // (the screen less its margins; the plate's band and the speech's — the window's own: what is above or below the
  // window on a tall screen is the screen's)
  function allowed() {
    const W = window_(), S = screen(), e = 0.08 * W.h;
    return { x0: S.x + e, x1: S.x + S.w - e, y0: S.y + e, y1: S.y + S.h - e, plate: [W.y, W.y + 0.15 * W.h], speech: [W.y + 0.8 * W.h, W.y + W.h], corner: 0.15 * W.h, W, S };
  }
  // (y out of a band — to its nearer side that the screen allows)
  const outOf = (y, [a, b], A) => (y <= a || y >= b ? y : (y - a < b - y && a >= A.y0) || b > A.y1 ? a : b);
  function fit(p) {
    const A = allowed(), W = A.W, S = A.S;
    if (p.seen === false || p.x < S.x || p.x > S.x + S.w || p.y < S.y || p.y > S.y + S.h) return null;
    let x = Math.min(A.x1, Math.max(A.x0, p.x)), y = Math.min(A.y1, Math.max(A.y0, p.y));
    y = outOf(outOf(y, A.plate, A), A.speech, A);
    // (the corners above: the buttons' — out to whichever side is nearer)
    for (const cx of [S.x, S.x + S.w]) {
      const dx = Math.abs(x - cx), dy = y - S.y;
      if (dx < A.corner && dy < A.corner) { if (A.corner - dx < A.corner - dy) x = cx === S.x ? S.x + A.corner : S.x + S.w - A.corner; else y = S.y + A.corner; }
    }
    return { x, y, off: Math.hypot(x - p.x, y - p.y) > 1 || p.x < W.x || p.x > W.x + W.w || p.y < W.y || p.y > W.y + W.h };
  }
  const point = ref => { const p = where(ref); return p && fit(p); };

  function mark({ at, kind = 'ring', size = SIZES[kind] }) {
    if (rescale()) for (const mk of live) mk.sized();
    const m = el('div', `mg-mark mg-${kind}`, marks);
    const body = el('div', 'mg-body', m);
    const r = size / 2;
    // (drawn in the language's px, shown k times larger: its lines grow with it)
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `${-r} ${-r} ${size} ${size}`);
    const sized = () => { const px = size * K; m.style.setProperty('--size', `${px}px`); svg.setAttribute('width', px); svg.setAttribute('height', px); };
    sized();
    if (kind !== 'light') body.append(svg);
    const arc = (cls, rr) => {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('class', cls); c.setAttribute('r', rr); c.setAttribute('pathLength', 1);
      c.setAttribute('transform', 'rotate(-90)');
      svg.append(c);
      return c;
    };
    const ring = kind === 'spot' ? r - 2 : kind === 'groove' ? r - 9 : r - 8;
    if (kind === 'spot') arc('mg-blot', ring);
    // (a dark band under the light line: read on any ground, light or dark, busy or plain)
    if (kind !== 'groove') arc('mg-under', ring);
    arc('mg-edge', ring);
    const fill = kind === 'groove' || kind === 'spot' ? arc('mg-fill', kind === 'spot' ? r * 0.45 : ring) : null;
    const outer = arc('mg-arc', ring + 5);
    for (const a of [fill, outer]) if (a) a.style.strokeDasharray = '0 1';
    const own = typeof at === 'function' ? at : () => point(at);
    let place = own;
    const mk = {
      el: m, body, base: size, pos: null, sized,
      get size() { return size * K; },
      fill(u) { if (fill) fill.style.strokeDasharray = `${clamp(u)} 1`; },
      arc(u, meaning) { outer.style.strokeDasharray = `${clamp(u)} 1`; outer.setAttribute('class', `mg-arc mg-${meaning}`); },
      is(state, on = true) {
        m.classList.toggle(`mg-${state}`, !!on);
        // (a mark's petals out: the language's root knows — a plain choice takes the screen back meanwhile)
        if (state === 'open') root.classList.toggle('mg-petals', [...live].some(k => k.el.classList.contains('mg-open')));
      },
      do(effect, { toward } = {}) {
        if (effect === 'twitch' && toward && mk.pos) {
          const dx = toward.x - mk.pos.x, dy = toward.y - mk.pos.y, d = Math.hypot(dx, dy) || 1, k = Math.min(10, d / 4);
          body.animate([{ transform: 'none' }, { transform: `translate(${dx / d * k}px, ${dy / d * k}px)` }, { transform: 'none' }], { duration: 260, easing: 'ease-out' });
          return;
        }
        const frames = {
          press: [{ transform: 'scale(1)' }, { transform: 'scale(0.82)', offset: 0.35 }, { transform: 'scale(1.06)', offset: 0.75 }, { transform: 'scale(1)' }],
          release: [{ transform: 'scale(1.08)' }, { transform: 'scale(0.96)', offset: 0.5 }, { transform: 'scale(1)' }],
          shake: [{ transform: 'none' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-4px)' }, { transform: 'none' }],
          jerk: [{ transform: 'scale(1)' }, { transform: 'scale(0.7)', offset: 0.2 }, { transform: 'scale(1)' }],
          pop: [{ transform: 'scale(0.3)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.7 }, { transform: 'scale(1)', opacity: 1 }],
        }[effect];
        if (frames) body.animate(frames, { duration: effect === 'pop' ? 400 : effect === 'press' ? 150 : effect === 'release' ? 220 : 300, easing: 'ease-out' });
      },
      own,
      follow(fn) { place = fn || own; placeMark(mk); },
      where: () => place(),
      remove() { live.delete(mk); m.remove(); },
    };
    live.add(mk);
    placeMark(mk);
    return mk;
  }
  function placeMark(mk) {
    const p = mk.where();
    mk.el.hidden = !p;
    if (!p) { mk.pos = null; return; }
    mk.pos = p;
    mk.el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
    mk.el.classList.toggle('mg-off', !!p.off);
  }
  function place() {
    if (rescale()) for (const mk of live) mk.sized();
    for (const mk of live) placeMark(mk);
    for (const fn of placers) fn();
  }
  onFrame(place);
  addEventListener('resize', place);

  // the effects: page elements that play once and go (Web Animations: they stand while the play is paused)
  const once = (cls, p, frames, opts) => {
    const e = el('div', cls, fx);
    e.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
    const inner = el('i', '', e);
    inner.animate(frames, { fill: 'forwards', ...opts }).finished.then(() => e.remove(), () => e.remove());
    return e;
  };
  const RIPPLE = [{ transform: 'scale(0.4)', opacity: 0.9 }, { transform: 'scale(1.6)', opacity: 0 }];
  return {
    k, window: window_, allowed, fit, point, mark, place, host: marks,
    svg(tag, attrs = {}) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); paths.append(e); return e; },
    onPlace(fn) { placers.add(fn); return () => placers.delete(fn); },
    touch(p) { once('mg-touch', p, [{ transform: 'scale(0.5)', opacity: 1 }, { transform: 'scale(1)', opacity: 0.9, offset: 0.35 }, { transform: 'scale(1.5)', opacity: 0 }], { duration: 420, easing: 'ease-out' }); },
    // a ripple round the finger; two — «too often» (the second after a moment: a delay of its own animation, which
    // stands with the pause as the first does)
    ripple(p, { double = false } = {}) {
      once('mg-ripple', p, RIPPLE, { duration: 300, easing: 'ease-out' });
      if (double) once('mg-ripple', p, RIPPLE, { duration: 300, delay: 110, easing: 'ease-out' });
    },
    // a spark: the snap's
    spark(p) {
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * 2 * Math.PI + 0.3, d = 26 * K;
        once('mg-spark', p, [{ transform: 'translate(0, 0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) scale(0.3)`, opacity: 0 }], { duration: 250, easing: 'ease-out' });
      }
    },
    // a speck before or after a rhythm's edge (side −1 early, +1 late)
    crumb(p, side) { once('mg-crumb', { x: p.x + side * 18 * K, y: p.y - 30 * K }, [{ opacity: 1 }, { opacity: 0 }], { duration: 600 }); },
    // «come back here»: a point of a path flashes
    flash(p) { once('mg-flash', p, [{ transform: 'scale(0.5)', opacity: 1 }, { transform: 'scale(1.4)', opacity: 0 }], { duration: 450, easing: 'ease-out' }); },
    clear() { for (const mk of [...live]) mk.remove(); for (const fn of placers) placers.delete(fn); paths.replaceChildren(); },
  };
}

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function el(tag, cls, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  parent?.append(e);
  return e;
}
