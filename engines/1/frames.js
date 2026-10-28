// What a scene's frames were, for the page's account of what people saw (MooodSeen: docs/host.md): counted in the scene's
// thread from what its engine already knows of each frame it runs — nothing timed anew, no loop of its own — and posted
// to the page every EVERY ms ({ t: 'frames', … }), begun anew each time. A frame is timed only if the scene moves: drawn,
// and the frame before it drawn too — the time between them; a still scene draws nothing (or, engine 1, draws itself as
// it stands), and that time is its stillness, not a long frame; a frame held (waiting for what it needs) is time apart.
//   MooodFrames(post, engine) → { frame(outcome, gap, late), tick(now), flush() }: frame — a frame the engine ran, gap
// ms after the one it ran before (−1: none before it — the first after a pause, a mount); outcome 2 drawn, 1 standing,
// 0 held; late — the engine counts it a frame lost (engine 3's pacer). tick(now) — each display callback (ms). flush() —
// what was counted posted now (the page asks it as it is hidden or left: the thread's `frames` call).
//   What is posted: drawn, standing, held (frames); moving, still, waiting (ms); long (timed frames of 50 ms or more),
// late, worst (ms); ms — the timed frames by whole ms ({ms: how many}; 100: 100 or more).
//   MooodFrames.card(canvas) — the graphics card a WebGL canvas draws on, as the browser names it ({vendor, renderer} —
// null: no WebGL there): told with the thread's `mounted`, once (the page keeps it with the device).
globalThis.MooodFrames ??= (post, engine) => {
  const EVERY = 2000, LONG = 50, GAP = 1000;
  const said = () => { if (c.drawn || c.standing || c.held) post(c); anew(); };
  let c = null, since = -1, before = -1;
  const anew = () => { c = { t: 'frames', engine, drawn: 0, standing: 0, held: 0, moving: 0, still: 0, waiting: 0, long: 0, late: 0, worst: 0, ms: {} }; };
  anew();
  return {
    frame(outcome, gap, late = false) {
      // (a gap of a second or more: the page was away — not a frame of the scene's)
      const known = gap >= 0 && gap < GAP;
      if (outcome === 2) {
        c.drawn++;
        if (known && before === 2) {
          c.moving += gap;
          const k = Math.min(100, Math.round(gap));
          c.ms[k] = (c.ms[k] || 0) + 1;
          if (gap >= LONG) c.long++;
          if (late) c.late++;
          if (gap > c.worst) c.worst = gap;
        } else if (known) c.still += gap;
      } else if (outcome === 1) { c.standing++; if (known) c.still += gap; }
      else { c.held++; if (known) c.waiting += gap; }
      before = outcome;
    },
    tick(now) {
      if (since < 0) since = now;
      if (now - since < EVERY) return;
      since = now;
      said();
    },
    flush: said,
  };
};
MooodFrames.card ??= canvas => {
  const gl = canvas.getContext('webgl2'), info = gl?.getExtension('WEBGL_debug_renderer_info');
  return gl && { vendor: gl.getParameter(info ? info.UNMASKED_VENDOR_WEBGL : gl.VENDOR), renderer: gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) };
};
