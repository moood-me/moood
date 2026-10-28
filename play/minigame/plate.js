// The plate (docs/games/miniux/language.md §2.6): a horizontal plate at the top middle of the window, where a film's title
// would be — the overview; what matters while the hand works is at the thing (§3). What is on it the game sets; the
// plate only draws it:
//   - the phrase — what is happening;
//   - the bar: the fill from the left — how much is done (rising at once and smoothly, falling seen ebbing — П43); the
//     notches — steps, if the game names them; the glow at the fill's edge — 'idle' (calm), 'good' (brighter), 'bad'
//     (trembling, warmer), null (none: a choice); the shade from the right — how much is left before a limit, if the
//     game has one; the chips — errors, quiet, where on the bar they happened; the ways — a choice's pieces, each
//     coloured and drawn as the way it went ('theirs', 'own', 'none');
//   - the sample at the bar's left — what to compare with, if the game gives one.
//   const plate = createPlate(root)
//   plate.open({phrase, sample}); plate.close() — shown / gone at once (an end fades it itself)
//   plate.place(W) — at the window's top middle ({x, y, w, h}, page px); a long phrase on several lines
//   plate.set({phrase, fill, notches: [u…], glow, shade: u | null, ways: [{from, to, as}], sample: element | null}) —
//     what is given changes, the rest stays
//   plate.chip() — an error's chip, where the fill is; plate.breathe(on) — the scene's turn: its glow breathes
//   plate.end(how) → a promise once it has faded: 'clean' — the bar flashes all its length; 'flawed' — shorter;
//     'neutral' — evenly; 'loss' — the shade covers it (an end fades only the opening it ended)
import { el, clamp } from './layer.js';

const EBB = 1.2; // the share of the bar a second it ebbs at, falling
export function createPlate(root) {
  const p = el('div', 'mg-plate', root);
  const phrase = el('div', 'mg-task', p);
  const row = el('div', 'mg-row', p);
  const sample = el('div', 'mg-sample', row);
  const bar = el('div', 'mg-bar', row);
  const fill = el('i', 'mg-fill-bar', bar), shade = el('i', 'mg-shade', bar), notches = el('div', 'mg-notches', bar),
    chips = el('div', 'mg-notches', bar), ways = el('div', 'mg-notches', bar), glow = el('i', 'mg-glow', bar);
  // (the plate takes what is pressed on it: not a gesture's)
  for (const ev of ['pointerdown', 'pointerup']) p.addEventListener(ev, e => e.stopPropagation());
  let done = 0, wide = 0, epoch = 0; // epoch: which opening it is (an end fades only its own)
  const at = u => `${clamp(u) * 100}%`;
  // (the plate as wide as its phrase needs, from 40% of the window — not under 280 px — to 60%; a phrase longer still
  // goes on to the next lines)
  const set = o => {
    if (o.phrase != null && phrase.textContent !== o.phrase) {
      const was = phrase.textContent;
      phrase.textContent = o.phrase;
      if (was) phrase.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 300 });
    }
    if (o.fill != null) {
      const u = clamp(o.fill);
      // (rising: at once and smoothly; falling: ebbing, seen)
      p.style.setProperty('--ebb', `${u < done ? (done - u) / EBB : 0.12}s`);
      done = u;
      p.style.setProperty('--done', u);
    }
    if (o.notches) notches.replaceChildren(...o.notches.map(u => { const n = el('i', 'mg-notch'); n.style.left = at(u); return n; }));
    if (o.glow !== undefined) glow.className = o.glow ? `mg-glow mg-${o.glow}` : 'mg-glow mg-none';
    if (o.shade !== undefined) { shade.hidden = o.shade == null; if (o.shade != null) shade.style.width = at(o.shade); }
    if (o.ways) ways.replaceChildren(...o.ways.map(w => { const e = el('i', `mg-way-${w.as}`); e.style.left = at(w.from); e.style.width = at(w.to - w.from); return e; }));
    if (o.sample !== undefined) { sample.replaceChildren(...(o.sample ? [o.sample] : [])); sample.hidden = !o.sample; }
  };
  // (gone, the plate keeps nothing of its mini-game: no phrase, sample or marks left in the page)
  const empty = () => {
    phrase.textContent = '';
    sample.replaceChildren(); sample.hidden = true;
    notches.replaceChildren(); chips.replaceChildren(); ways.replaceChildren();
  };
  return {
    open({ phrase: t = '', sample: s = null } = {}) {
      epoch++;
      empty();
      done = 0;
      p.style.setProperty('--done', 0);
      shade.hidden = true;
      p.className = 'mg-plate mg-in';
      glow.className = 'mg-glow mg-idle';
      set({ phrase: t, sample: s });
    },
    close() {
      const mine = epoch;
      p.classList.remove('mg-in', 'mg-breathe');
      setTimeout(() => { if (epoch === mine) empty(); }, 450); // (after its fading: not an empty box fading)
    },
    place(W) {
      p.style.transform = `translate(${Math.round(W.x + W.w / 2)}px, ${Math.round(W.y + 0.06 * W.h)}px) translateX(-50%)`;
      if (Math.round(W.w) === wide) return;
      wide = Math.round(W.w);
      p.style.minWidth = `${Math.round(Math.max(280, 0.4 * W.w))}px`;
      p.style.maxWidth = `${Math.round(Math.max(280, 0.6 * W.w))}px`;
    },
    set,
    chip() { el('i', 'mg-chip', chips).style.left = at(done); },
    breathe(on) { p.classList.toggle('mg-breathe', !!on); },
    end(how) {
      const mine = epoch;
      p.classList.remove('mg-breathe');
      glow.className = 'mg-glow mg-none';
      const a = how === 'loss'
        ? (shade.hidden = false, shade.animate([{ width: shade.style.width || '0%' }, { width: '100%' }], { duration: 800, fill: 'forwards', easing: 'ease-in' }))
        : bar.animate([{ filter: 'brightness(1)' }, { filter: `brightness(${how === 'flawed' ? 1.6 : how === 'neutral' ? 1.4 : 2.2})`, offset: 0.35 }, { filter: 'brightness(1)' }], { duration: 800, easing: 'ease-out' });
      return a.finished.catch(() => {})
        .then(() => new Promise(ok => setTimeout(ok, 1000)))
        .then(() => { if (epoch === mine) p.classList.remove('mg-in'); return new Promise(ok => setTimeout(ok, 500)); })
        .then(() => { if (epoch === mine) empty(); });
    },
  };
}
