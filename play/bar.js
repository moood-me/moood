// The play page's bar, calm (play.js): its buttons come and go as the play goes on, and none of them ever jumps into
// the place another was aimed at. One that goes is not to be pressed at once, fades out, then those right of it slide
// left into its place; one that comes: those right of its place are not to be pressed at once (dimmed), slide right
// opening a gap, then it fades in there. What moves, comes or goes is not to be pressed while it does, and a button
// that has come or arrived somewhere is pressed only once it has stood there a while (STILL) — so a press aimed at a
// spot some 0.4 s before never lands on a button that was not there to be aimed at. Changes may overlap: each item
// slides from wherever it is seen now. Reduced motion: the same times, every change seen at once (stepped).
// A press on a button not to be pressed is swallowed (the bar's, not the scene's); the keys the play gives (Space for
// ⏭: runtime.js) are not aimed at a spot and stay the play's.
export const FADE = 500, SLIDE = 500, STILL = 450;

// calm(bar): show(el, on) — the bar's item el wanted shown or not; shown(el) — whether it is wanted; change(fn) — fn
// changes the bar's items otherwise (a text), those it moves slide
export function calm(bar) {
  const items = new Map(); // el → { want, free (when it may be pressed), fade (its opacity's animation) }
  const of = el => items.get(el) ?? items.set(el, { want: !el.hidden, free: 0, fade: null }).get(el);
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const now = () => performance.now();

  // el not to be pressed till at least `until` (nor while it is not wanted: then until=null)
  function hold(el, until) {
    const s = of(el);
    el.setAttribute('aria-disabled', 'true');
    clearTimeout(s.timer);
    if (until == null) return;
    s.free = Math.max(s.free, until);
    s.timer = setTimeout(function free() {
      if (!s.want) return;
      if (now() < s.free) { s.timer = setTimeout(free, s.free - now()); return; }
      el.removeAttribute('aria-disabled');
    }, Math.max(0, until - now()));
  }
  const pressable = el => el.getAttribute('aria-disabled') !== 'true';
  // (a press on what is not to be pressed: nobody's — not the button's, not the volume's, not the scene's under it)
  for (const type of ['click', 'pointerdown', 'mousedown'])
    bar.addEventListener(type, e => {
      const el = [...bar.children].find(c => c.contains(e.target));
      if (el && !pressable(el)) { e.preventDefault(); e.stopPropagation(); }
    }, true);

  const shift = el => { const t = getComputedStyle(el).transform; return t === 'none' ? 0 : new DOMMatrixReadOnly(t).m41; };
  // fn changes the bar's layout: whatever it moves slides from where it is seen to its new place, held meanwhile and
  // STILL after; whether anything moved
  function change(fn) {
    const seen = new Map([...bar.children].filter(c => !c.hidden).map(c => [c, c.offsetLeft + shift(c)]));
    fn();
    let moved = false;
    for (const c of bar.children) {
      if (c.hidden || !seen.has(c)) continue;
      const d = seen.get(c) - c.offsetLeft;
      if (Math.abs(d) < 0.5) continue;
      moved = true;
      const s = of(c);
      s.slide?.cancel();
      s.slide = c.animate([{ transform: `translateX(${d}px)` }, { transform: 'none' }],
        { duration: SLIDE, easing: still() ? 'step-start' : 'ease-in-out' });
      hold(c, now() + SLIDE + STILL);
    }
    return moved;
  }

  // el's opacity to `to` over the part of FADE it has left to go, after `delay`; then done()
  function fade(el, to, delay, done) {
    const s = of(el), from = s.fade ? Number(getComputedStyle(el).opacity) : 1 - to;
    s.fade?.cancel();
    const duration = FADE * Math.abs(to - from);
    const a = s.fade = el.animate([{ opacity: from }, { opacity: to }],
      { duration, delay, fill: 'both', easing: still() ? (to ? 'step-start' : 'step-end') : 'ease' });
    a.finished.then(() => { if (s.fade === a) done(); }, () => {});
    return delay + duration;
  }

  function show(el, on) {
    const s = of(el);
    on = !!on;
    if (s.want === on) return;
    s.want = on;
    if (!on) {
      hold(el, null);
      fade(el, 0, 0, () => { change(() => { el.hidden = true; }); s.fade.cancel(); s.fade = null; });
      return;
    }
    // coming: into its place unseen (those right of it slide aside), then seen; or, still going, back from where it is
    const coming = el.hidden;
    if (coming) {
      s.fade?.cancel();
      s.fade = el.animate([{ opacity: 0 }], { fill: 'forwards' });
    }
    const delay = coming && change(() => { el.hidden = false; }) ? SLIDE : 0;
    hold(el, now() + fade(el, 1, delay, () => { s.fade.cancel(); s.fade = null; }) + STILL);
  }

  return { show, shown: el => of(el).want, change };
}
