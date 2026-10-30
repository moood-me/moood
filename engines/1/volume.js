// How loud the site is for whoever listens here: one setting for all of it, every scene — kept in this browser (and
// followed by its other tabs). Three channels — the music, the voices, the games' own sounds — each its level 0..1 and
// its mute; over them the whole: a level and a mute. What plays a channel asks get(kind) — how loud it is now, all of
// that taken in — and listens on(); it never reads the rest.
//   Its sign: any [data-volume] button, wherever it is put (the crumbs, the public bar), shows how loud the site is —
// a speaker, its three waves lit as loud as the loudest channel is in fact; crossed out when the whole is muted (or
// nothing is heard). The sliders (that button opens them), as a mixer does it: the whole's on top moves the three
// with it, in proportion (each shows how loud it is in fact); one of the three pulled above the whole pulls the whole
// up with it, the others staying as loud as they were. A mute beside each; the whole's mute silences the three and
// stills their controls. A slider moved takes its mute off.
const MooodVolume = (() => {
  const tr = MooodI18n.part('engine1');  // (the engine's words, as the page said its language: words.js speak)
  const DEFAULT = { music: 0.4, voice: 1, sound: 0.4 }; // until the listener moves a slider (the owner's balance, 2026-10-16)
  const KINDS = Object.keys(DEFAULT);
  const PREFIX = 'moood:volume:';
  const listeners = new Set();

  const read = (k, fallback) => {
    try { const v = localStorage.getItem(PREFIX + k); if (v !== null) return v; } catch {}
    return fallback;
  };
  const write = (k, v) => { try { localStorage.setItem(PREFIX + k, String(v)); } catch {} };
  const level = k => { const v = parseFloat(read(k === 'all' ? 'master' : k, '')); return v >= 0 && v <= 1 ? v : k === 'all' ? 1 : DEFAULT[k]; };
  const muted = k => read(`muted:${k}`, '') === '1';

  // how loud a channel is now: its level, the whole's, neither muted
  function get(k) { return muted('all') || muted(k) ? 0 : level(k) * level('all'); }
  function tell() { for (const f of listeners) for (const k of KINDS) f(k, get(k)); }
  // f(kind, value): kind 'music', 'voice' or 'sound' may have changed
  function on(f) { listeners.add(f); }
  // a channel to `v`, as loud in fact: above the whole — the whole up to it, the others kept as loud as they were
  function set(k, v) {
    const all = level('all');
    if (k === 'all') write('master', v);
    else if (v > all) {
      if (all > 0) for (const o of KINDS) if (o !== k) write(o, level(o) * all / v); // (the whole at 0: theirs kept as they were)
      write('master', v);
      write(k, 1);
    } else write(k, all > 0 ? v / all : v);
    write(`muted:${k}`, 0);
    tell();
  }
  function mute(k, on) { write(`muted:${k}`, on ? 1 : 0); tell(); }
  // output(ctx) → a GainNode of that AudioContext as loud as the "sounds" channel: what plays sounds connects to it
  // (and it, onward, to ctx.destination or its own chain) instead of to the destination. The context is then this
  // page's to run: it sounds as soon as the browser lets sound begin (again at a touch or a key of the page: a browser
  // lets it begin only then) — unless the sounds are held (hold: told by the scene's music, music.js pause — the one
  // place the page's sound is held): held, every output fades to 0 in the music's fade, then its context stands (what
  // was asked of it meanwhile waits, and begins as it goes on); going on, its context runs again and it fades back in to
  // the volume set. A sound's code never suspends or resumes it.
  const outputs = new Set(); // {ctx, node, standing: its timer}
  let held = false;
  function output(ctx) {
    const node = ctx.createGain(), o = { ctx, node, standing: 0 };
    node.gain.value = held ? 0 : get('sound');
    outputs.add(o);
    on((k, v) => { if (k === 'sound' && !held) node.gain.setTargetAtTime(v, ctx.currentTime, 0.1); });
    if (held) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {});
    return node;
  }
  // the sounds held (as the music is: the play paused, its scene standing) or going on, over `seconds`: each output's
  // fade taken over from where it is; the context stood after its fade — by the browser's own timer (a play's clock
  // stands while the play is paused: clock.js) — unless it goes on meanwhile (then it never stands)
  function hold(on, seconds) {
    if (!!on === held) return;
    held = !!on;
    const T = globalThis.__mooodTimers ?? globalThis;
    for (const o of outputs) {
      const { ctx, node } = o;
      if (ctx.state === 'closed') { outputs.delete(o); continue; }
      T.clearTimeout(o.standing);
      const g = node.gain, t = ctx.currentTime, v = g.value; // (where it is now: read before its fade is taken off)
      g.cancelScheduledValues(t);
      g.setValueAtTime(v, t);
      g.linearRampToValueAtTime(held ? 0 : get('sound'), t + seconds);
      if (held) o.standing = T.setTimeout(() => { if (held) ctx.suspend().catch(() => {}); }, seconds * 1000);
      else ctx.resume().catch(() => {});
    }
  }
  // (a context the browser held back: asked again at a touch or a key — what it answers)
  const touched = () => { if (!held) for (const { ctx } of outputs) if (ctx.state === 'suspended') ctx.resume().catch(() => {}); };
  addEventListener('pointerdown', touched, true);
  addEventListener('keydown', touched, true);
  addEventListener('storage', e => { if (e.key?.startsWith(PREFIX)) tell(); });

  // ── the sign on the buttons ──────────────────────────────────────────────
  const WAVES = ['M15.5 10a2.8 2.8 0 0 1 0 4', 'M17.8 7.8a6 6 0 0 1 0 8.4', 'M20.2 5.4a9.4 9.4 0 0 1 0 13.2'];
  const BUTTON = '<svg class="volume-sign" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 9v6h4l5 4V5l-5 4z"/>'
    + WAVES.map(d => `<path class="wave" d="${d}"/>`).join('') + '<path class="cross" d="M16.5 9.5l5 5M21.5 9.5l-5 5"/></svg>';
  function sign(b) {
    if (!b.querySelector('.volume-sign')) b.innerHTML = BUTTON;
    const v = muted('all') ? 0 : Math.max(...KINDS.map(get)), quiet = v === 0, svg = b.firstElementChild;
    svg.querySelector('.cross').style.display = quiet ? '' : 'none';
    svg.querySelectorAll('.wave').forEach((w, i) => {
      w.style.display = quiet ? 'none' : '';
      w.style.opacity = String(0.22 + 0.78 * Math.min(1, Math.max(0, v * 3 - i)));
    });
  }
  const signs = () => { for (const b of document.querySelectorAll('[data-volume]')) sign(b); };
  on(signs);
  // (a button may be put on the page any time — the crumbs come once the page has what it shows)
  new MutationObserver(list => { if (list.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && (n.matches('[data-volume]') || n.querySelector('[data-volume]'))))) signs(); })
    .observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', signs); else signs();

  // ── the sliders ──────────────────────────────────────────────────────────
  const SIGN = {
    on: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    off: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/>',
  };
  let panel = null;
  function build() {
    panel = document.createElement('div');
    panel.id = 'volume';
    panel.hidden = true;
    const names = { all: tr('all'), music: tr('music'), voice: tr('voices'), sound: tr('sounds') };
    for (const k of ['all', ...KINDS]) {
      const row = document.createElement('div');
      row.className = k === 'all' ? 'row all' : 'row';
      row.dataset.kind = k;
      // (both signs made once, the row's class picks one: a sign redrawn under the pointer would leave the click
      // outside the panel — and close it)
      row.innerHTML = `<button type="button" class="mute" aria-label="${tr('{name}: muted', { name: names[k] })}"><svg class="on" viewBox="0 0 24 24" aria-hidden="true">${SIGN.on}</svg>`
        + `<svg class="off" viewBox="0 0 24 24" aria-hidden="true">${SIGN.off}</svg></button><span>${names[k]}</span>`
        + `<input type="range" min="0" max="1" step="0.01" aria-label="${names[k]}">`;
      row.querySelector('input').oninput = e => set(k, Number(e.target.value));
      row.querySelector('.mute').onclick = () => mute(k, !muted(k));
      panel.append(row);
    }
    document.body.append(panel);
    on(draw);
  }
  // the panel as things are: each slider at how loud it is in fact (the three: their level times the whole's)
  function draw() {
    if (!panel || panel.hidden) return;
    const hushed = muted('all');
    for (const row of panel.querySelectorAll('.row')) {
      const k = row.dataset.kind, off = muted(k), input = row.querySelector('input'), b = row.querySelector('.mute');
      const v = k === 'all' ? level('all') : level(k) * level('all');
      if (document.activeElement !== input || Math.abs(Number(input.value) - v) > 0.005) input.value = v;
      b.setAttribute('aria-pressed', String(off));
      row.classList.toggle('off', off || (k !== 'all' && hushed));
      if (k !== 'all') { input.disabled = hushed; b.disabled = hushed; }
    }
  }
  function open(button) {
    if (!panel) build();
    const at = button.getBoundingClientRect();
    panel.style.left = `${Math.max(8, Math.min(at.left, innerWidth - 248))}px`;
    panel.style.top = `${at.bottom + 8}px`;
    panel.hidden = false;
    draw();
  }
  document.addEventListener('click', e => {
    const b = e.target.closest?.('[data-volume]');
    if (b) { panel && !panel.hidden ? (panel.hidden = true) : open(b); return; }
    if (panel && !panel.hidden && !panel.contains(e.target)) panel.hidden = true;
  });

  return { get, set, mute, on, output, hold, get held() { return held; } };
})();
