// What is under the pointer, and the selection's glow — the scene's thread's side of selecting (select.js: the
// page's — the click, the card). A point picks what is there — objects and landscape layers nearest first, then the
// sun / moon / planets, else the sky — pixel-exact: the candidate's own painting is painted again into a tiny canvas
// around the point and looked at for ink. The selected thing glows along its silhouette on an overlay the page laid
// over the scene's canvas (given over to this thread). Paths name the part inside the scene spec: "objects[3]",
// "layers[1]", "celestials[0]", "sky" — the same the server understands.
const MooodPick = (() => {
  const I = Moood.internals;
  const LAND = new Set(['mountains', 'hills', 'dunes', 'forest', 'city', 'water', 'ground']);
  const PROBE = 7, GLOW = 'rgba(255,228,160,0.95)', OFFER = 'rgba(255,236,190,0.8)';

  // the part of the spec a path points to
  function item(spec, path) {
    if (!spec || !path) return undefined;
    if (path === 'sky') return spec.sky;
    const m = /^(objects|layers|celestials)\[(\d+)\]$/.exec(path);
    return m ? spec[m[1]]?.[Number(m[2])] : undefined;
  }

  // host: the page's canvas as the engine has it (engine.js mount: w, h — CSS px, dpr); overlay: the canvas the
  // selection glows on, as big as the scene's; offer: the one what may be picked glows on (or none)
  function create({ stage, host, overlay, offer }) {
    let spec = null;
    const probe = I.layer(PROBE, PROBE), pg = probe.getContext('2d', { willReadFrequently: true });

    // Scenes are painted in CSS pixels of the frame here (W × H, the stage SW wide — engine.js),
    // so a plane's view() maps painted coordinates straight to where they are in the frame;
    // the frame lies at (x, y) in the canvas.
    const size = () => { const f = stage.frame(); return { W: f.w, H: f.h, SW: I.STAGE * f.h, x: f.x, y: f.y }; };
    // objects stand where the engine puts them now (its depths().now: their real distance, their `place`)
    const placed = (dz, o) => dz.now(o).o;
    // a platformer's hero is drawn moved and turned (engine.js heroMatrix): so is its outline
    function heroed(m, o, cam, SW, H) {
      if (!o || !cam.hero || o.id !== cam.hero.id) return m;
      const p = placed(I.depths(spec), o), h = I.heroMatrix(cam.hero, p.x * SW, p.size * H / (o.height || 2));
      return [m[0] * h[0], 0, 0, m[3], m[0] * h[4] + m[4], m[3] * h[5] + m[5]];
    }
    const layerSeed = i => I.hash(JSON.stringify(spec.layers || []) + (spec.title || '')) + i * 101;
    // the person an element is (people.js), if it is one
    const personOf = o => (o?.person && globalThis.MooodPeople && I.PEOPLE.get(String(o.id))) || null;

    // any ink within a few screen pixels of (px, py) when drawn at on-screen scale s?
    function inked(px, py, s, draw) {
      pg.setTransform(1, 0, 0, 1, 0, 0);
      pg.clearRect(0, 0, PROBE, PROBE);
      pg.setTransform(s, 0, 0, s, PROBE / 2 - px * s, PROBE / 2 - py * s);
      draw(pg);
      const d = pg.getImageData(0, 0, PROBE, PROBE).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 40) return true;
      return false;
    }

    // what is at (cx, cy) — CSS px of the canvas — a path, or null; allowed: the paths that may be picked (the others
    // let the point through to what is behind them), or null: any
    function pick(cx, cy, allowed) {
      const { W, H, SW, x, y } = size(), cam = stage.camera(), dz = I.depths(spec);
      // (where it is in the frame as drawn: a tipped camera's picture is turned, engine.js rollOf)
      const rl = I.rollOf(cam.roll, W, H, host.w, host.h), u = cx - x, v = cy - y;
      const back = rl ? I.invert(rl.m) : [1, 0, 0, 1, 0, 0], sx = back[0] * u + back[2] * v + back[4], sy = back[1] * u + back[3] * v + back[5];
      // nearest first, in the renderer's order: it paints far to near, and at equal distance
      // layers in spec order, then objects — so the later one is on top
      // (looking around, the elements standing about — no landscape layers, the sky behind them; what
      // is near the eye, while it is seen: not faded out as it is passed, engine.js nearFade)
      const round = I.camSetup(spec).round;
      const things = [
        ...(round ? [] : spec.layers || []).map((L, i) => ({ path: `layers[${i}]`, L, i, at: { m: I.view(cam, dz.Z[i], W, H, dz.yh), D: dz.Z[i] - cam.z } })).filter(t => LAND.has(t.L.kind)),
        ...(spec.objects || []).map((o, i) => ({ path: `objects[${i}]`, src: o, o: placed(dz, o), n: dz.now(o), at: round && o.sky ? null : I.placeOf(o, cam, W, H, dz, round) })).filter(t => t.o.kind !== 'bird' && !t.o.plane && !t.o.insert && !t.o.unseen),
      ].map((t, k) => ({ ...t, k })).filter(t => t.at && I.nearFade(t.at.D) >= 0.3 && (!allowed || allowed.has(t.path))).sort((a, b) => a.at.D - b.at.D || b.k - a.k);
      for (const t of things) {
        // (a card turned its own way: its painted point under the pointer where it lies — and its parts',
        // e.part, each as it lies where it is)
        const turn = t.o && !t.o.sky && I.turnOf(t.o);
        if (turn) {
          const recs = [], hit = I.cardUnder(t.n, turn, cam, sx, sy, W, H, dz.yh), own = g => I.drawObject(g, t.o, SW, H, 0, [], recs);
          // (painting it gives its parts: recs — painted all the same when it is not under the pointer)
          if (!hit) own(pg);
          else if (inked(hit[0], hit[1], hit[2], own)) return t.path;
          for (const q of recs) {
            const n = dz.part(t.src, q.dx, q.dz, q.box), at = I.cardUnder(n, I.turnOf(n.o), cam, sx, sy, W, H, dz.yh), [ax, ay, ppm] = I.anchorOf(n.o, SW, H);
            if (at && inked(at[0], at[1], at[2], g => q.paint(g, ax, ay, ppm, []))) return t.path;
          }
          continue;
        }
        const m = heroed(t.at.m, t.o, cam, SW, H), s = m[0], px = (sx - m[4]) / s, py = (sy - m[5]) / m[3];
        // (someone drawn in 3D: where they are drawn, not their silhouette's sketch)
        const drawn = personOf(t.o) && MooodPeople.inkAt(personOf(t.o), px, py, PROBE / 2 / s, H);
        if (drawn != null) {
          if (drawn) return t.path;
        } else if (t.o) {
          if (inked(px, py, s, g => I.drawObject(g, t.o, SW, H, 0, []))) return t.path;
        } else if (t.L.kind === 'water') {
          if (py >= t.L.y * H) return t.path;
        } else {
          const k = s, w = PROBE / k;
          I.staticLayer(t.L, SW, H, layerSeed(t.i), { x: px - w / 2, y: py - w / 2, w, h: w, k, canvas: probe });
          const d = pg.getImageData(0, 0, PROBE, PROBE).data;
          for (let j = 3; j < d.length; j += 4) if (d[j] > 40) return t.path;
        }
      }
      const m = I.view(cam, Infinity, W, H, dz.yh), px = (sx - m[4]) / m[0], py = (sy - m[5]) / m[3];
      const ci = (spec.celestials || []).findIndex(c => Math.hypot(px - c.x * SW, py - c.y * H) < c.size * H / 2 + 6);
      const far = ci >= 0 ? `celestials[${ci}]` : 'sky';
      return !allowed || allowed.has(far) ? far : null;
    }

    // ── the glow ────────────────────────────────────────────────────────
    // The selected thing glows along its silhouette; what may be picked now (offer: what a game offers) glows softer,
    // on an overlay of its own (the page lets it breathe). A silhouette is painted once — { c, x, y, k }: canvas c
    // covers painted coordinates from (x, y) at scale k — and the plane it stands on (Z); someone drawn in 3D is as the
    // camera saw them last (people.js), seen again every so often (`every`, ms: they breathe, they walk).
    let box = null; // where the selection is in the canvas now (CSS px), and which it is (path)
    const glow = (canvas, color, blurs, every) => ({ canvas, g: canvas?.getContext('2d'), color, blurs, every, paths: [], sils: new Map(), drawn: '' });
    const chosen = glow(overlay, GLOW, [3, 10, 22], 100), offered = glow(offer, OFFER, [4, 14], 400);
    // the part of a silhouette's canvas that has ink: { x, y, w, h } in its pixels
    function inkBox(c) {
      const k = Math.max(1, Math.ceil(Math.max(c.width, c.height) / 256)), w = Math.ceil(c.width / k), h = Math.ceil(c.height / k);
      const t = I.layer(w, h), tg = t.getContext('2d', { willReadFrequently: true });
      tg.drawImage(c, 0, 0, w, h);
      const d = tg.getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 24) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      return x1 < 0 ? { x: 0, y: 0, w: c.width, h: c.height } : { x: x0 * k, y: y0 * k, w: (x1 - x0 + 1) * k, h: (y1 - y0 + 1) * k };
    }
    function silhouette(path) {
      const { SW, H } = size(), dz = I.depths(spec), it = item(spec, path), i = Number(/\d+/.exec(path)?.[0]);
      if (path.startsWith('objects')) {
        const seen = personOf(it) && MooodPeople.silhouette(personOf(it), H);
        if (seen) return { ...seen, Z: dz.now(it).Z, obj: it, person: true };
        const o = placed(dz, it), b = I.objectBox(o, SW, H);
        const k = Math.min(2, 2048 / Math.max(1, b.bw), 2048 / Math.max(1, b.bh));
        const c = I.layer(b.bw * k, b.bh * k), g = c.getContext('2d');
        g.setTransform(k, 0, 0, k, -b.bx * k, -b.by * k);
        I.drawObject(g, o, SW, H, 0, []);
        return { c, x: b.bx, y: b.by, k, Z: dz.now(it).Z, obj: it };
      }
      if (path.startsWith('layers') && LAND.has(it.kind)) {
        if (it.kind === 'water') {
          const c = I.layer(4, 4); c.getContext('2d').fillRect(0, 0, 4, 4);
          return { c, x: -I.EXT * SW, y: it.y * H, k: 4 / ((1 + 2 * I.EXT) * SW), ky: 4 / ((I.DEEP - it.y) * H), Z: dz.Z[i] };
        }
        const k = 0.5, x = -I.EXT * SW;
        const st = I.staticLayer(it, SW, H, layerSeed(i), { x, y: 0, w: (1 + 2 * I.EXT) * SW, h: I.DEEP * H, k });
        return { c: st.canvas, x, y: 0, k, Z: dz.Z[i] };
      }
      if (path.startsWith('celestials')) {
        const r = it.size * H / 2, c = I.layer(2 * r + 4, 2 * r + 4), g = c.getContext('2d');
        g.beginPath(); g.arc(r + 2, r + 2, r, 0, 7); g.fill();
        return { c, x: it.x * SW - r - 2, y: it.y * H - r - 2, k: 1, Z: Infinity };
      }
      return null; // the sky: nothing to outline
    }
    // a silhouette glowing on its glow's overlay as the frame shows it now → where it is in the canvas (CSS px), or null
    function glowOne(G, sil, cam, dpr) {
      const { W, H, x, y } = size(), dz = I.depths(spec), round = I.camSetup(spec).round;
      const at = sil.obj && !sil.obj.sky ? I.placeOf(sil.obj, cam, W, H, dz, round) : { m: I.view(cam, sil.Z, W, H, dz.yh), D: Infinity };
      if (!at || at.D < 0.3) return null;
      const m = heroed(at.m, sil.obj, cam, I.STAGE * H, H);
      // the silhouette's canvas → the overlay's px: placed in the frame as drawn (a card turned its own
      // way: by three of its corners where it lies, a likeness), turned with a tipped camera's picture
      // (engine.js rollOf), the frame where it is in the canvas
      const rl = I.rollOf(cam.roll, W, H, host.w, host.h), turn = sil.obj && !sil.obj.sky && I.turnOf(placed(dz, sil.obj));
      let lay = [m[0] / sil.k, 0, 0, m[3] / (sil.ky || sil.k), m[0] * sil.x + m[4], m[3] * sil.y + m[5]];
      if (turn) {
        const world = I.cardWorldOf(dz.now(sil.obj), turn, H), cw = sil.c.width / sil.k, ch = sil.c.height / sil.k;
        const q = [[sil.x, sil.y], [sil.x + cw, sil.y], [sil.x, sil.y + ch]].map(([u, v]) => I.project(cam, ...world(u, v), W, H, dz.yh));
        if (q.some(v => !v)) return null;
        lay = [(q[1][0] - q[0][0]) / sil.c.width, (q[1][1] - q[0][1]) / sil.c.width, (q[2][0] - q[0][0]) / sil.c.height, (q[2][1] - q[0][1]) / sil.c.height, q[0][0], q[0][1]];
      }
      const f = I.mul(rl ? rl.m : [1, 0, 0, 1, 0, 0], lay);
      const t = I.mul([dpr, 0, 0, dpr, x * dpr, y * dpr], f), on = (u, v) => [t[0] * u + t[2] * v + t[4], t[1] * u + t[3] * v + t[5]];
      sil.ink ||= inkBox(sil.c);
      const { x: ix, y: iy, w: iw, h: ih } = sil.ink, q = [on(ix, iy), on(ix + iw, iy), on(ix + iw, iy + ih), on(ix, iy + ih)], xs = q.map(p => p[0]), ys = q.map(p => p[1]);
      // the shape itself is drawn far off-canvas; only its blurred shadow lands on screen —
      // then the shape's interior is cut out, leaving a glow around the outline
      const og = G.g, OFF = G.canvas.width + 4000;
      og.shadowColor = G.color;
      og.shadowOffsetX = OFF;
      for (const blur of G.blurs) {
        og.shadowBlur = blur * dpr;
        og.setTransform(t[0], t[1], t[2], t[3], t[4] - OFF, t[5]);
        og.drawImage(sil.c, 0, 0);
      }
      og.shadowColor = 'transparent';
      og.globalCompositeOperation = 'destination-out';
      og.setTransform(...t);
      og.drawImage(sil.c, 0, 0);
      og.globalCompositeOperation = 'source-over';
      return { x: Math.min(...xs) / dpr, y: Math.min(...ys) / dpr, w: (Math.max(...xs) - Math.min(...xs)) / dpr, h: (Math.max(...ys) - Math.min(...ys)) / dpr };
    }
    // a glow as the frame shows its paths now (but `skip`): their silhouettes made again when the state changed them
    // (a figure that walks) or the frame's size, someone drawn in 3D seen again every so often; drawn again only when
    // something of it changed
    function glowAll(G, skip, cam, dpr, w, h) {
      if (!G.canvas) return;
      if (G.canvas.width !== w || G.canvas.height !== h) { G.canvas.width = w; G.canvas.height = h; G.drawn = ''; }
      const now = performance.now(), paths = G.paths.filter(p => p !== skip), H = size().H;
      for (const p of paths) {
        const s = G.sils.get(p);
        // (painted for the frame's height: the frame resized, painted again)
        if (s === undefined || (s && (s.ver !== I.STATE.ver || s.H !== H || (s.person && now - s.at > G.every)))) {
          const next = silhouette(p) || s || null;
          if (next) Object.assign(next, { ver: I.STATE.ver, H, at: next === s ? s.at : now });
          G.sils.set(p, next);
        }
      }
      const sils = paths.map(p => G.sils.get(p)).filter(Boolean);
      const key = sils.length ? `${cam.x.toFixed(4)},${cam.y.toFixed(4)},${cam.z.toFixed(4)},${cam.yaw.toFixed(4)},${cam.roll.toFixed(4)},${cam.h},${w},${h},${sils.map(s => `${s.ver}:${s.at}`).join()}` : '';
      if (key === G.drawn) return;
      G.drawn = key;
      G.g.setTransform(1, 0, 0, 1, 0, 0);
      G.g.clearRect(0, 0, w, h);
      if (G === chosen) box = null;
      for (const s of sils) {
        const b = glowOne(G, s, cam, dpr);
        if (G === chosen) box = b && { ...b, path: chosen.paths[0] };
      }
    }
    // the glows as the frame shows them now (each frame: engine.js host.drawn)
    function drawGlow() {
      if (!spec) return;
      const dpr = host.dpr || 1, cam = stage.camera(), w = Math.max(1, Math.round(host.w * dpr)), h = Math.max(1, Math.round(host.h * dpr));
      glowAll(chosen, null, cam, dpr, w, h);
      glowAll(offered, chosen.paths[0], cam, dpr, w, h);
    }

    // Whether a part is of the background: the old landscape layers and sky, and any element covering more than a
    // quarter of the view from the start (the sky, a lake, far hills) — measured once per scene by painting it small
    const coverage = new Map();
    function background(path) {
      if (/^(layers\[|sky$)/.test(path)) return true;
      if (!path.startsWith('objects')) return false;
      if (!coverage.has(path)) {
        const { W, H, SW } = size(), dz = I.depths(spec), it = item(spec, path), n = 64, c = I.layer(n, n * H / W), g = c.getContext('2d');
        // from the start — looking around, turned toward it
        const round = I.camSetup(spec).round, p = round && !it.sky ? dz.now(it).at : null;
        const at = I.placeOf(it, { x: 0, y: 0, z: 0, h: 1, yaw: p ? Math.atan2(p.X, p.Z) : 0 }, W, H, dz, round && !it.sky), k = n / W;
        const m = at ? at.m : [0, 0, 0, 0, 0, 0];
        g.setTransform(m[0] * k, 0, 0, m[3] * k, m[4] * k, m[5] * k);
        try { I.drawObject(g, placed(dz, it), SW, H, 0, []); } catch {}
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let ink = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 40) ink++;
        coverage.set(path, ink / (d.length / 4));
      }
      return coverage.get(path) > 0.25;
    }

    return {
      // the scene the page selects in (another world or version: indices may mean other things now)
      spec(next) { spec = next; coverage.clear(); for (const G of [chosen, offered]) { G.paths = []; G.sils.clear(); G.drawn = 'dirty'; } },
      // what is at (x, y) — the canvas's CSS px — of `allowed` (paths; null: any): { path, background } — or null
      pick: (x, y, allowed) => { if (!spec) return null; const path = pick(x, y, allowed && new Set(allowed)); return path && { path, background: background(path) }; },
      // the selection (a path, or null): it glows
      select(path) { chosen.paths = path && item(spec, path) !== undefined ? [path] : []; chosen.sils.clear(); chosen.drawn = 'dirty'; },
      // what may be picked now (paths): it glows softer
      offer(paths) { offered.paths = (paths || []).filter(q => item(spec, q) !== undefined); offered.drawn = 'dirty'; },
      drawGlow,
      // where the selection is in the canvas now ({ x, y, w, h }, CSS px; path — which it is), or null
      box: () => (chosen.paths.length ? box : null),
    };
  }

  return { create };
})();
