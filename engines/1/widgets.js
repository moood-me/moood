// Widgets — the scene's own bits of interface over the picture: a sign over someone's head,
// a clock, a letter, a scoreboard, a panel with buttons (spec.widgets). Each is the artist's
// HTML + CSS + JS, living right in the page: its markup and styles in a shadow root (so its CSS
// and the page's don't mix), its scripts run as the page's own, given `root` (that shadow root:
// root.getElementById, root.querySelector) and `widget` (its element). A widget is laid out in px
// for a 1080-px-tall screen and scaled with the screen, so it looks the same everywhere. It
// stands at a point of the frame (interface: a corner, the middle), or follows an element of the scene (hovering `lift` metres
// over its anchor) as the viewer walks. Errors its scripts throw land in window.__mooodErrors. (An engine 3 scene: placed
// as the stage says a frame of it changed — stage.onFrame —, not every frame of the page.) show(spec, tr): the scene as
// the page shows it (MooodI18n.shown: its markup translated already), its scripts given the scene's translator (tr).
const MooodWidgets = (() => {
  const REF = 1080;
  const ANCHORS = { center: [0.5, 0.5], top: [0.5, 0], bottom: [0.5, 1], left: [0, 0.5], right: [1, 0.5],
    'top-left': [0, 0], 'top-right': [1, 0], 'bottom-left': [0, 1], 'bottom-right': [1, 1] };
  const report = (key, err) => (window.__mooodErrors = window.__mooodErrors || []).push(`widget ${key}: ${err && err.message || err}`);

  // builds a widget's element: markup into its shadow root, then its scripts, in order
  function make(w, key, tr) {
    const el = document.createElement('div');
    el.className = 'widget';
    el.dataset.id = key;
    const root = el.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>:host{display:block;overflow:hidden}</style>${w.html}`;
    // markup set as HTML doesn't run its scripts: run them ourselves (after the element is in the page)
    const scripts = [...root.querySelectorAll('script')];
    for (const s of scripts) s.remove();
    el.start = () => {
      for (const s of scripts) {
        if (s.src) { const n = document.createElement('script'); n.src = s.src; n.onerror = () => report(key, `can't load ${s.src}`); document.head.append(n); continue; }
        try { MooodI18n.bind(tr, 'root, widget', s.textContent)(root, el); } catch (err) { report(key, err); }
      }
    };
    return el;
  }

  function create({ canvas, stage }) {
    let spec = null, items = [], timers = [], raf = 0, gen = 0;
    const box = document.createElement('div');
    box.id = 'widgets';
    canvas.after(box);

    // (tr: the scene's translator — none: its texts as written, a sketch being drawn and the pages of game types moood,
    // free, asked: their scenes have no translations)
    function show(next, tr = MooodI18n.translator(MooodI18n.source)) {
      spec = next;
      for (const t of timers) clearTimeout(t);
      timers = [];
      const list = (Array.isArray(spec?.widgets) ? spec.widgets : []).filter(w => w && typeof w.html === 'string');
      // keep a widget (and its state) when only its placement changed
      const old = new Map(items.map(it => [it.src, it]));
      const fresh = [];
      items = list.map((w, i) => {
        const key = w.id || `widget${i}`, src = `${key}\n${w.html}`;
        let it = old.get(src);
        if (it) old.delete(src);
        else { it = { src, el: make(w, key, tr) }; fresh.push(it); }
        it.w = w;
        const el = it.el;
        el.style.width = `${Math.max(1, w.width || 320)}px`;
        el.style.height = `${Math.max(1, w.height || 120)}px`;
        el.style.pointerEvents = w.interactive ? 'auto' : 'none';
        el.classList.toggle('on', !(w.at > 0));
        if (w.at > 0) timers.push(setTimeout(() => el.classList.add('on'), w.at * 1000));
        if (w.for > 0) timers.push(setTimeout(() => el.classList.remove('on'), (Math.max(0, w.at || 0) + w.for) * 1000));
        box.append(el); // in spec order: later ones on top
        return it;
      });
      for (const it of old.values()) it.el.remove();
      for (const it of fresh) it.el.start();
      cancelAnimationFrame(raf);
      const g = ++gen;
      // (an engine 3 scene: placed now, then as the scene says where things are — below)
      if (spec?.engine === 3) { place(); return; }
      const loop = () => { if (g !== gen) return; place(); raf = requestAnimationFrame(loop); };
      if (items.length) loop();
    }

    function place() {
      // in the frame (engine.js): bars around it on screens too narrow or wide for it
      const f = stage.frame(), k = f.h / REF;
      for (const { w, el } of items) {
        const [ax, ay] = ANCHORS[w.anchor] || (w.follow ? ANCHORS.bottom : ANCHORS.center);
        const at = w.follow ? stage.screenOf(w.follow, w.lift ?? 0) : [f.x + (w.x ?? 0.5) * f.w, f.y + (w.y ?? 0.5) * f.h];
        el.style.visibility = at ? '' : 'hidden';
        if (!at) continue;
        const fw = Math.max(1, w.width || 320), fh = Math.max(1, w.height || 120);
        el.style.transform = `translate(${at[0] - ax * fw * k}px, ${at[1] - ay * fh * k}px) scale(${k})`;
      }
    }

    stage.onFrame(() => { if (spec?.engine === 3 && items.length) place(); });

    return { show };
  }
  return { create };
})();
