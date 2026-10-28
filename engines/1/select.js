// Selecting a part of the scene — the page's side (pick.js, in the scene's thread: what is under the pointer, the
// glow along the selection's silhouette on an overlay given over to it) — for what a game offers on a scene of engine 1
// (actions.js). A click (not a drag) on a part that may be picked picks it; a click on it again, or on nothing that may
// be, lets it go. Paths name the selected part inside the scene spec: "objects[3]", "layers[1]", "celestials[0]",
// "sky"; a scene's element also carries a stable id (object()).
//   MooodSelect.create({ canvas, stage, only, picks, onChange }) — only(path): whether that part may be picked (they
// glow, breathing: scene.css); picks(): whether a click on the scene picks what is there now (else it only lets the
// selection go); onChange(path) as the selection changes.
const MooodSelect = (() => {
  // the part of the spec a path points to
  function item(spec, path) {
    if (!spec || !path) return undefined;
    if (path === 'sky') return spec.sky;
    const m = /^(objects|layers|celestials)\[(\d+)\]$/.exec(path);
    return m ? spec[m[1]]?.[Number(m[2])] : undefined;
  }

  function create({ canvas, stage, only, picks, onChange }) {
    let spec = null, sel = null;
    // the selection glows on one overlay; what may be picked on another, softer, breathing (scene.css)
    const overlay = document.createElement('canvas'), offer = document.createElement('canvas');
    overlay.id = 'select-overlay';
    offer.id = 'offer-overlay';
    canvas.after(overlay);
    canvas.after(offer);
    stage.selecting(overlay, offer);

    // the paths that may be picked
    const allowed = () => [...(spec.objects || []).map((_, i) => `objects[${i}]`), ...(spec.layers || []).map((_, i) => `layers[${i}]`),
      ...(spec.celestials || []).map((_, i) => `celestials[${i}]`), 'sky'].filter(only);
    // what is at a point of the page (clientX, clientY): { path, background } — or null
    const at = (clientX, clientY) => {
      if (!picks()) return Promise.resolve(null);
      const p = stage.local({ clientX, clientY });
      return stage.pick(p.x, p.y, allowed());
    };

    function select(path) {
      sel = path && item(spec, path) !== undefined ? path : null;
      stage.select(sel);
      onChange?.(sel);
    }

    // a click is a press and release without dragging, with one finger
    let down = null;
    canvas.addEventListener('pointerdown', e => {
      down = down ? { multi: true } : { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    canvas.addEventListener('pointerup', e => {
      const d = down;
      down = null;
      if (!d || d.multi || !spec) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5 || performance.now() - d.t > 500) return;
      if (!picks()) { if (sel) select(null); return; }
      const was = spec;
      at(e.clientX, e.clientY).then(hit => {
        if (spec !== was) return;
        if (hit) select(hit.path === sel ? null : hit.path);
        else if (sel) select(null);
      });
    });
    canvas.addEventListener('pointercancel', () => { down = null; });
    addEventListener('keydown', e => {
      if (e.key === 'Escape' && sel && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) select(null);
    });

    return {
      // a new scene: indices may mean other things now
      setSpec(next) { if (next !== spec) { spec = next; stage.pickSpec(next); select(null); } },
      // the selected scene element itself (with its stable id), or null
      object: () => (sel && sel.startsWith('objects') ? item(spec, sel) : null),
      // where the selection is on the screen now — {x, y, w, h} in CSS pixels — or null
      box() {
        // (as the last frame had it: not yet there for a selection just made — or another's)
        const b = sel && stage.selected();
        if (!b || b.path !== sel) return null;
        const r = canvas.getBoundingClientRect(), k = r.width / Math.max(1, canvas.clientWidth) || 1;
        return { x: r.left + b.x * k, y: r.top + b.y * k, w: b.w * k, h: b.h * k };
      },
      // what a click there would pick: a promise of a path, or null
      at: (clientX, clientY) => (spec ? at(clientX, clientY).then(hit => hit?.path ?? null) : Promise.resolve(null)),
      // what may be picked changed: it glows
      offered: () => { if (spec) stage.offer(allowed()); },
      clear: () => select(null),
    };
  }

  return { create };
})();
