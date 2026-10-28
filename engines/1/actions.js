// What can be done with the things in a scene: whatever plays on it (a game) offers some of the
// scene's elements, each with what can be done with it. The player picks one — it glows (select.js), its actions open
// beside it — and picks an action. Only for scenes of engine 1: on an engine 3 scene a choice is the language of
// mini-games' (play/minigame).
//   The pointer over a thing offered is a hand, a click on it picks it (what is under the pointer asked of the scene:
// select.js); the others don't answer a click.
//   const actions = MooodActions.create({ canvas, stage, onAct(element, action) })
//   actions.setSpec(spec) — the scene shown (what was offered is gone with the scene before)
//   actions.offer({ <element id>: [{ id, label } | label, …], … }) — what is offered now (in place of what was),
//     glowing softly; {} — nothing
//   actions.clear() — nothing picked
const MooodActions = (() => {
  function create({ canvas, stage, onAct }) {
    let spec = null, offers = {}, open = null; // open: the element whose actions are shown
    const menu = document.createElement('div');
    menu.id = 'actions';
    menu.hidden = true;
    document.body.append(menu);
    const idAt = path => {
      const m = /^objects\[(\d+)\]$/.exec(path || '');
      return m ? spec?.objects?.[Number(m[1])]?.id ?? null : null;
    };
    // (picked by a click: engine 1's scenes — an engine 3 scene's never)
    const old = () => spec?.engine !== 3;
    const listed = id => (offers[id] || []).map(a => (typeof a === 'string' ? { id: a, label: a } : a));
    const offered = id => !!offers[id]?.length;
    const selection = MooodSelect.create({ canvas, stage, only: path => offered(idAt(path)), picks: old, onChange: show });
    let hovered = 0;
    canvas.addEventListener('pointermove', e => {
      if (!old()) return;
      if (e.pointerType !== 'mouse' || performance.now() - hovered < 120) return;
      hovered = performance.now();
      if (!Object.keys(offers).length) { canvas.style.cursor = ''; return; }
      selection.at(e.clientX, e.clientY).then(path => { canvas.style.cursor = path ? 'pointer' : ''; });
    });

    function show() {
      const o = selection.object();
      const acts = o ? listed(o.id) : [];
      open = acts.length ? o : null;
      menu.hidden = !open;
      if (!open) return;
      const title = document.createElement('b');
      title.textContent = o.name || '';
      menu.replaceChildren(title, ...acts.map(a => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = a.label;
        b.onclick = () => { const el = open; selection.clear(); onAct?.(el, a); };
        return b;
      }));
      placed = null;
      menu.classList.remove('placed');
      if (!placing) { placing = true; place(); }
    }
    // beside the thing, wherever it is (the camera moves, it walks): right of it, else left, within the screen. Not
    // shown until it is known where the thing is (the frame after it was picked); then it stays while the thing only
    // stirs (breathes, turns its head) and glides after it once it has gone further (STIR px) — never under the pointer
    const STIR = 40;
    let placed = null, placing = false; // where the menu stands: [x, y]
    function place() {
      if (!open) { placing = false; return; }
      requestAnimationFrame(place);
      const b = selection.box();
      if (!b) { if (!placed) menu.style.visibility = 'hidden'; return; }
      const w = menu.offsetWidth, h = menu.offsetHeight, m = 12;
      const x = b.x + b.w + m + w < innerWidth ? b.x + b.w + m : Math.max(m, b.x - m - w);
      const y = Math.min(innerHeight - h - m, Math.max(m, b.y + b.h / 2 - h / 2));
      if (placed && (menu.matches(':hover') || Math.hypot(x - placed[0], y - placed[1]) < STIR)) return;
      if (placed) menu.classList.add('placed');
      placed = [x, y];
      menu.style.visibility = '';
      menu.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }

    return {
      setSpec(next) { spec = next; offers = {}; canvas.style.cursor = ''; selection.setSpec(next); },
      offer(next) {
        offers = next || {};
        selection.offered();
        const o = selection.object();
        if (o && !offered(o.id)) selection.clear(); else show();
      },
      clear: () => selection.clear(),
    };
  }
  return { create };
})();
