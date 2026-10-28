// Living-scene engine: paints a scene spec (see ../scene-prompt.mjs) on a canvas,
// animated. Everything is in device pixels.
// The frame is always landscape: 4:3 to 21:9, centred in the canvas; it sets the composition, and
// the canvas around it (a window narrower or wider) shows the scene going on, dimmed, the colour at
// the frame's edge carrying on where nothing is painted. Its height is the measure: the scene is painted on a 16:9 stage
// as tall as the frame (spec x is a fraction of the stage's width, y and sizes fractions of its
// height), the stage centred in the frame — a wider frame sees more on both sides, a narrower
// one less; nothing on it moves or stretches. What matters belongs in the stage's middle 4:3.
const Moood = (() => {
  const STAGE = 16 / 9, NARROWEST = 4 / 3, WIDEST = 21 / 9;
  // ── utilities ──────────────────────────────────────────────────────────
  function seeded(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function noise1D(seed) {
    const v = Array.from({ length: 512 }, seeded(seed));
    return x => {
      const i = Math.floor(x), f = x - i, k = f * f * (3 - 2 * f);
      return v[i & 511] + (v[(i + 1) & 511] - v[i & 511]) * k;
    };
  }
  function layer(w, h) {
    return new OffscreenCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
  function rgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) throw new Error(`bad colour ${hex}`);
    const n = parseInt(m[1], 16);
    return `${n >> 16},${(n >> 8) & 255},${n & 255}`;
  }
  // Glows are the most frequent thing drawn (fireflies, lamps, fog, fire): one
  // pre-rendered radial sprite per colour, stretched and faded with globalAlpha —
  // no gradient objects created per frame.
  const glowSprites = new Map();
  function glowSprite(col) {
    let s = glowSprites.get(col);
    if (!s) {
      s = layer(256, 256);
      const g = s.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      gr.addColorStop(0, `rgba(${col},1)`);
      gr.addColorStop(0.25, `rgba(${col},0.4)`);
      gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr;
      g.fillRect(0, 0, 256, 256);
      glowSprites.set(col, s);
    }
    return s;
  }
  function glow(ctx, x, y, r, col, a) {
    if (r <= 0 || a <= 0) return;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * Math.min(1, a);
    ctx.drawImage(glowSprite(col), x - r, y - r, 2 * r, 2 * r);
    ctx.globalAlpha = prev;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };


  // ── static layers ──────────────────────────────────────────────────────
  function ridge(L, W, H, seed) {
    const n1 = noise1D(seed), n2 = noise1D(seed + 1), n3 = noise1D(seed + 2);
    const base = L.y * H, h = (L.height ?? 0.2) * H, r = L.roughness ?? 0.5;
    return x => {
      const u = x / W;
      if (L.kind === 'mountains') {
        const sharp = 1 - Math.abs(2 * n1(u * 3 + 0.3) - 1);
        return base - h * (0.35 + 0.45 * sharp + r * 0.25 * n2(u * 12) + r * 0.08 * n3(u * 60));
      }
      if (L.kind === 'dunes') return base - h * (0.5 + 0.45 * Math.sin(u * 7 + n1(u * 2) * 4) * (0.6 + 0.4 * n2(u * 3)));
      if (L.kind === 'ground') return base - h * 0.15 * n1(u * 4);
      return base - h * (0.35 + 0.55 * n1(u * 2.5) + r * 0.15 * n2(u * 10)); // hills + base of forest/city
    };
  }

  function drawPine(g, x, base, h, color, rnd) {
    const w = h * (0.22 + rnd() * 0.08);
    g.fillStyle = color;
    g.fillRect(x - h * 0.012, base - h * 0.15, h * 0.024, h * 0.16);
    const tiers = 6 + Math.floor(rnd() * 3);
    for (let i = 0; i < tiers; i++) {
      const k = i / tiers, yb = base - h * (0.1 + k * 0.78), yt = yb - h * (0.17 + 0.05 * (1 - k));
      const wi = w * (1 - k) * (0.85 + rnd() * 0.3) + h * 0.02;
      g.beginPath();
      g.moveTo(x, yt);
      g.quadraticCurveTo(x - wi * 0.3, yb - (yb - yt) * 0.35, x - wi, yb + h * 0.01);
      g.quadraticCurveTo(x, yb - h * 0.025, x + wi, yb + h * 0.01);
      g.quadraticCurveTo(x + wi * 0.3, yb - (yb - yt) * 0.35, x, yt);
      g.fill();
    }
  }

  // Layers are painted wider and taller than the screen so the camera can pan and
  // zoom out: world x spans [-EXT·W, (1+EXT)·W], y spans [0, DEEP·H].
  const EXT = 0.4, DEEP = 1.3;

  // Paints a landscape layer. By default the whole layer at scale 1; `view` = { x, y, w, h, k }
  // paints only that region (layer coordinates) at scale k — for sharp close-ups.
  // Also returns, for each of TOP_STRIPS vertical strips, `tops`: the highest painted y, and
  // `solids`: the y below which the strip is solid colour. A renderer can skip the empty sky
  // above a layer and fill its body flat; only the band between needs a texture.
  // `view.canvas`, if given, is reused (cleared) instead of allocating a new canvas.
  const TOP_STRIPS = 64;
  function staticLayer(L, W, H, seed, view) {
    const x0 = -EXT * W, x1 = (1 + EXT) * W, bottom = DEEP * H;
    const v = view || { x: x0, y: 0, w: x1 - x0, h: bottom, k: 1 };
    const c = v.canvas || layer(v.w * v.k, v.h * v.k), g = c.getContext('2d'), rnd = seeded(seed), f = ridge(L, W, H, seed);
    if (v.canvas) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); }
    g.setTransform(v.k, 0, 0, v.k, -v.x * v.k, -v.y * v.k);
    const tops = new Array(TOP_STRIPS).fill(bottom), solids = new Array(TOP_STRIPS).fill(0), sw = (x1 - x0) / TOP_STRIPS;
    const mark = (xa, xb, y) => {
      for (let i = Math.max(0, Math.floor((xa - x0) / sw)); i <= Math.min(TOP_STRIPS - 1, Math.floor((xb - x0) / sw)); i++) tops[i] = Math.min(tops[i], y);
    };
    // finer outline steps when painting a close-up, but only across the painted region
    const step = Math.max(2, W / 400) / v.k;
    g.fillStyle = L.color;
    const top = (L.kind === 'forest' || L.kind === 'city')
      ? x => L.y * H - (L.y * H - f(x)) * 0.25 // a low base under the trees / buildings
      : f;
    g.beginPath();
    g.moveTo(x0, bottom);
    const coarse = Math.max(2, W / 400);
    for (let x = x0; x <= x1 + coarse; x += coarse) {
      const y = top(x);
      mark(x - coarse, x + coarse, y);
      const i = Math.min(TOP_STRIPS - 1, Math.max(0, Math.floor((x - x0) / sw)));
      solids[i] = Math.max(solids[i], y);
    }
    const pa = Math.max(x0, v.x - 2 * step), pb = Math.min(x1, v.x + v.w + 2 * step);
    g.lineTo(pa, bottom);
    for (let x = pa; x <= pb + step; x += step) g.lineTo(x, top(x));
    g.lineTo(pb + step, bottom);
    g.fill();
    const density = L.density ?? 0.5, h = (L.height ?? 0.2) * H;
    if (L.kind === 'forest') {
      const spacing = W * (0.035 - 0.028 * density);
      for (let x = x0 - spacing; x < x1 + spacing; x += spacing * (0.5 + rnd())) {
        const th = h * (0.55 + rnd() * 0.5), base = top(x) + h * 0.03;
        mark(x - th * 0.35, x + th * 0.35, base - th * 1.12);
        drawPine(g, x, base, th, L.color, rnd);
      }
    }
    const windows = [];
    if (L.kind === 'city') {
      let x = x0 - rnd() * W * 0.03;
      while (x < x1) {
        const bw = W * (0.03 + rnd() * 0.05) * (1.3 - density * 0.6), bh = h * (0.3 + rnd() * 0.7);
        const btop = L.y * H - bh;
        g.fillStyle = L.color;
        g.fillRect(x, btop, bw - W * 0.002, bh + bottom);
        mark(x, x + bw, btop - bh * 0.12);
        if (rnd() < 0.25) g.fillRect(x + bw * 0.4, btop - bh * 0.12, bw * 0.08, bh * 0.12);
        const cw = Math.max(2, W * 0.004), ch = Math.max(3, H * 0.009);
        for (let wy = btop + ch * 1.5; wy < L.y * H - ch; wy += ch * 2.2) {
          for (let wx = x + cw; wx < x + bw - cw * 2; wx += cw * 2.2) {
            if (rnd() < (L.lights ?? 0.2)) windows.push({ x: wx, y: wy, w: cw, h: ch, p: rnd() * 100 });
          }
        }
        x += bw;
      }
    }
    // margins: the outline is sampled, its true peaks and dips lie a little beyond the samples
    return { canvas: c, x0, windows, tops: tops.map(y => Math.max(0, y - 4 - H * 0.01)), solids: solids.map((y, i) => Math.min(bottom, Math.max(y, solids[i - 1] ?? y, solids[i + 1] ?? y) + 4 + H * 0.01)), stripW: sw };
  }

  // ── objects ────────────────────────────────────────────────────────────
  function figure(ctx, x, y, s, t, color, pose, flip) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip ? -s : s, s);
    ctx.fillStyle = ctx.strokeStyle = color;
    ctx.lineCap = ctx.lineJoin = 'round';
    const L = (w, ...p) => { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); ctx.stroke(); };
    const C = (cx, cy, r) => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); };
    const b = Math.sin(t * 1.3) * 0.008;
    if (pose === 'sit') {
      L(0.16, 0, -0.08, -0.28, -0.4); L(0.11, -0.28, -0.4, -0.33, -0.05);
      ctx.beginPath(); ctx.moveTo(0.13, -0.02); ctx.bezierCurveTo(0.22, -0.22, 0.18, -0.46, 0.05, -0.6 - b);
      ctx.lineTo(-0.08, -0.57 - b); ctx.bezierCurveTo(-0.1, -0.4, -0.06, -0.2, -0.04, -0.06); ctx.fill();
      L(0.075, 0.02, -0.52, -0.16, -0.46, -0.31, -0.36); C(-0.13, -0.69 - b, 0.11);
    } else {
      const walk = pose === 'walk' ? Math.sin(t * 3) * 0.08 : 0;
      L(0.1, -0.05, -0.4, -0.06 + walk, -0.02); L(0.1, 0.05, -0.4, 0.06 - walk, -0.02);
      ctx.beginPath(); ctx.moveTo(-0.11, -0.76 - b); ctx.quadraticCurveTo(-0.17, -0.74, -0.17, -0.64);
      ctx.lineTo(-0.19, -0.34); ctx.lineTo(0.19, -0.34); ctx.lineTo(0.17, -0.64);
      ctx.quadraticCurveTo(0.17, -0.74, 0.11, -0.76 - b); ctx.fill();
      L(0.08, -0.16, -0.68, -0.2 - walk * 0.5, -0.42); L(0.08, 0.16, -0.68, 0.2 + walk * 0.5, -0.42);
      C(pose === 'back' ? 0 : 0.02, -0.87 - b, 0.11);
    }
    ctx.restore();
  }

  // W × H: the stage, in pixels
  function drawObject(ctx, o, W, H, t, lightsOut, partsOut) {
    const t0 = clock();
    const x = o.x * W, y = o.y * H, s = o.size * H, col = o.color;
    const light = o.light ? rgb(o.light) : null, fl = 0.9 + 0.1 * Math.sin(t * 7 + x) * Math.sin(t * 3.1 + y);
    ctx.fillStyle = ctx.strokeStyle = col;
    ctx.lineCap = ctx.lineJoin = 'round';
    switch (o.kind) {
      case 'pine': drawPine(ctx, x, y, s, col, seeded(hash(o.x + ':' + o.y))); break;
      case 'tree': {
        const sw = Math.sin(t * 0.8 + x) * s * 0.01;
        ctx.fillRect(x - s * 0.03, y - s * 0.5, s * 0.06, s * 0.5);
        for (const [dx, dy, r] of [[0, -0.72, 0.28], [-0.18, -0.58, 0.2], [0.18, -0.6, 0.21], [0.05, -0.9, 0.18]]) {
          ctx.beginPath(); ctx.arc(x + dx * s + sw, y + dy * s, r * s, 0, 7); ctx.fill();
        }
        break;
      }
      case 'house': {
        const w = s * 0.9, h = s * 0.55;
        ctx.fillRect(x - w / 2, y - h, w, h);
        ctx.beginPath(); ctx.moveTo(x - w * 0.6, y - h); ctx.lineTo(x, y - s); ctx.lineTo(x + w * 0.6, y - h); ctx.fill();
        ctx.fillRect(x + w * 0.2, y - s * 0.92, w * 0.1, s * 0.2);
        if (light) lightsOut.push({ x: x - w * 0.15, y: y - h * 0.55, r: s * 0.9, col: light, a: 0.4 * fl, rect: [x - w * 0.27, y - h * 0.72, w * 0.22, h * 0.3] });
        break;
      }
      case 'tower': {
        const w = s * 0.22;
        ctx.fillRect(x - w / 2, y - s * 0.85, w, s * 0.85);
        ctx.beginPath(); ctx.moveTo(x - w * 0.7, y - s * 0.85); ctx.lineTo(x, y - s); ctx.lineTo(x + w * 0.7, y - s * 0.85); ctx.fill();
        if (light) lightsOut.push({ x, y: y - s * 0.7, r: s * 0.5, col: light, a: 0.4 * fl, rect: [x - w * 0.18, y - s * 0.75, w * 0.36, s * 0.08] });
        break;
      }
      case 'lamp': {
        ctx.lineWidth = s * 0.03;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - s); ctx.quadraticCurveTo(x, y - s * 1.05, x + s * 0.12, y - s * 1.02); ctx.stroke();
        ctx.fillRect(x + s * 0.06, y - s * 1.02, s * 0.12, s * 0.05);
        if (light) lightsOut.push({ x: x + s * 0.12, y: y - s * 0.95, r: s * 1.4, col: light, a: 0.45 * fl, dot: s * 0.04, cone: { y, w: s * 0.6 } });
        break;
      }
      case 'lantern': {
        const sway = Math.sin(t * 1.2 + x) * s * 0.05;
        ctx.lineWidth = Math.max(1, s * 0.02);
        ctx.beginPath(); ctx.moveTo(x, y - s * 0.6); ctx.lineTo(x + sway, y - s * 0.15); ctx.stroke();
        ctx.fillRect(x + sway - s * 0.08, y - s * 0.15, s * 0.16, s * 0.2);
        if (light) lightsOut.push({ x: x + sway, y: y - s * 0.05, r: s * 1.2, col: light, a: 0.5 * fl, dot: s * 0.07 });
        break;
      }
      case 'campfire': {
        ctx.lineWidth = s * 0.08;
        ctx.beginPath(); ctx.moveTo(x - s * 0.3, y); ctx.lineTo(x + s * 0.25, y - s * 0.08); ctx.moveTo(x + s * 0.3, y); ctx.lineTo(x - s * 0.25, y - s * 0.08); ctx.stroke();
        const fc = light || '255,150,60';
        for (let i = 0; i < 3; i++) {
          const fh = s * (0.5 + 0.2 * Math.sin(t * 9 + i * 2)), fw = s * (0.16 - i * 0.03);
          ctx.fillStyle = `rgba(${i === 2 ? '255,230,170' : fc},${0.85 - i * 0.15})`;
          ctx.beginPath(); ctx.moveTo(x - fw, y - s * 0.05); ctx.quadraticCurveTo(x - fw * 0.6, y - fh * 0.6, x + Math.sin(t * 5 + i) * s * 0.05, y - fh);
          ctx.quadraticCurveTo(x + fw * 0.6, y - fh * 0.6, x + fw, y - s * 0.05); ctx.fill();
        }
        lightsOut.push({ x, y: y - s * 0.25, r: s * 3, col: fc, a: 0.4 * (0.8 + 0.2 * Math.sin(t * 11)) });
        break;
      }
      case 'window': {
        const w = s * 0.6;
        if (light) lightsOut.push({ x, y: y - s / 2, r: s * 1.3, col: light, a: 0.35 * fl, rect: [x - w / 2, y - s, w, s] });
        ctx.lineWidth = Math.max(2, s * 0.05);
        ctx.strokeRect(x - w / 2, y - s, w, s);
        ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x, y); ctx.moveTo(x - w / 2, y - s * 0.55); ctx.lineTo(x + w / 2, y - s * 0.55); ctx.stroke();
        break;
      }
      case 'boat': {
        const bob = Math.sin(t * 1.1 + x) * s * 0.03;
        ctx.beginPath(); ctx.moveTo(x - s * 0.6, y - s * 0.12 + bob); ctx.quadraticCurveTo(x, y + s * 0.08 + bob, x + s * 0.6, y - s * 0.12 + bob); ctx.lineTo(x - s * 0.6, y - s * 0.12 + bob); ctx.fill();
        ctx.lineWidth = s * 0.025;
        ctx.beginPath(); ctx.moveTo(x, y - s * 0.1 + bob); ctx.lineTo(x, y - s + bob); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + s * 0.03, y - s * 0.95 + bob); ctx.lineTo(x + s * 0.4, y - s * 0.2 + bob); ctx.lineTo(x + s * 0.03, y - s * 0.2 + bob); ctx.fill();
        break;
      }
      case 'rock': {
        const r = seeded(hash(o.x + 'r' + o.y));
        ctx.beginPath(); ctx.moveTo(x - s * 0.7, y);
        for (let i = 0; i <= 6; i++) { const a = Math.PI * (1 - i / 6); ctx.lineTo(x + Math.cos(a) * s * (0.6 + r() * 0.2), y - Math.sin(a) * s * (0.7 + r() * 0.3)); }
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'bench': {
        ctx.fillRect(x - s * 0.8, y - s * 0.45, s * 1.6, s * 0.08);
        ctx.fillRect(x - s * 0.8, y - s * 0.85, s * 1.6, s * 0.07);
        ctx.fillRect(x - s * 0.7, y - s * 0.45, s * 0.06, s * 0.45); ctx.fillRect(x + s * 0.64, y - s * 0.45, s * 0.06, s * 0.45);
        ctx.fillRect(x - s * 0.7, y - s * 0.85, s * 0.05, s * 0.4); ctx.fillRect(x + s * 0.65, y - s * 0.85, s * 0.05, s * 0.4);
        break;
      }
      case 'figure': figure(ctx, x, y, s, t, col, o.pose || 'stand', o.flip); break;
      case 'cat': {
        ctx.beginPath(); ctx.ellipse(x, y - s * 0.3, s * 0.22, s * 0.3, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(x, y - s * 0.72, s * 0.15, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - s * 0.14, y - s * 0.78); ctx.lineTo(x - s * 0.1, y - s * 0.98); ctx.lineTo(x - s * 0.02, y - s * 0.84);
        ctx.moveTo(x + s * 0.14, y - s * 0.78); ctx.lineTo(x + s * 0.1, y - s * 0.98); ctx.lineTo(x + s * 0.02, y - s * 0.84); ctx.fill();
        ctx.lineWidth = s * 0.06;
        ctx.beginPath(); ctx.moveTo(x + s * 0.18, y - s * 0.05);
        ctx.quadraticCurveTo(x + s * 0.5, y - s * 0.05, x + s * (0.45 + Math.sin(t * 1.5) * 0.08), y - s * 0.4); ctx.stroke();
        break;
      }
      case 'bird': {
        const span = WIDEST * H + 4 * s, bx = ((x + t * s * 1.5 * (o.flip ? -1 : 1)) % span + span) % span + (W - WIDEST * H) / 2 - 2 * s;
        const by = y + Math.sin(t * 0.7 + x) * s * 0.4, fl2 = Math.sin(t * 8 + x) * s * 0.25;
        ctx.lineWidth = Math.max(1.5, s * 0.08);
        ctx.beginPath(); ctx.moveTo(bx - s * 0.5, by - fl2); ctx.quadraticCurveTo(bx - s * 0.2, by - s * 0.15, bx, by);
        ctx.quadraticCurveTo(bx + s * 0.2, by - s * 0.15, bx + s * 0.5, by - fl2); ctx.stroke();
        break;
      }
      case 'flower': {
        const sw = Math.sin(t * 1.4 + x) * s * 0.06;
        ctx.lineWidth = Math.max(1, s * 0.04);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x, y - s * 0.5, x + sw, y - s * 0.9); ctx.stroke();
        ctx.fillStyle = light ? `rgb(${light})` : col;
        for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + t * 0.2; ctx.beginPath(); ctx.ellipse(x + sw + Math.cos(a) * s * 0.1, y - s * 0.9 + Math.sin(a) * s * 0.1, s * 0.09, s * 0.05, a, 0, 7); ctx.fill(); }
        break;
      }
      case 'bridge': {
        ctx.lineWidth = s * 0.08;
        ctx.beginPath(); ctx.moveTo(x - s * 1.5, y); ctx.quadraticCurveTo(x, y - s * 0.9, x + s * 1.5, y); ctx.stroke();
        ctx.lineWidth = s * 0.03;
        ctx.beginPath(); ctx.moveTo(x - s * 1.5, y - s * 0.2); ctx.quadraticCurveTo(x, y - s * 1.15, x + s * 1.5, y - s * 0.2); ctx.stroke();
        for (let i = -4; i <= 4; i++) { const u = i / 4.5, yy = y - s * 0.45 * (1 - u * u) * 1.0; ctx.beginPath(); ctx.moveTo(x + u * s * 1.4, yy); ctx.lineTo(x + u * s * 1.4, yy - s * 0.22); ctx.stroke(); }
        break;
      }
      case 'custom': case undefined: paintCustom(ctx, o, W, H, t, lightsOut, partsOut); break;
      default: throw new Error(`unknown object kind ${o.kind}`);
    }
    PERF.add(o, clock() - t0);
  }

  // Elements the world's agent paints itself. `o.code` is the body of a function (g, e):
  // g is a 2D canvas context in metres — origin at the element's anchor (where it stands),
  // x to the right, y DOWN (a 6 m house spans y −6…0). e.t = seconds by the real clock (e.phase =
  // 0…1 of the loop for animated elements), e.id = the element's id, e.rnd() = seeded random, e.px = one screen pixel in metres,
  // e.light(x, y, radius, color, strength, name) = a glowing light the engine animates — and a source
  // of light the scene knows (below: lights), by the element's id, or 'id#name'; e.lights(x, y) = the
  // light falling on a point of the painting, from where and how strong (lightsAt); e.ambient = the
  // scene's ambient light now. What scenes share (kit.js): e.anim — the animator's toolkit; e.kit — the world's modules; e.lib — the scene's
  // lib. e.was(key, ago) — what a value of the state was `ago` seconds ago (what lags behind reads
  // it); e.speed(key) — how fast it is changing now (per second); e.cut — when the last cut was
  // (scenestate.js: scene.cut, or the scene's start), by e.t's clock: what keeps its own inertia (a
  // module's springs, cloth, hair) starts afresh after it. e.debug(value, x?, y?) — a note shown
  // only to whoever looks closely (?debug, a render's --debug and --json); e.warn(text) — something
  // wrong but not an error (a pose, a name it does not know), said once in the scene's errors.
  // Errors are collected (window.__mooodErrors) so the agent reviewing its work sees them.
  // The scene's state (scenestate.js): values the scene's scripts, agents and widgets set, which
  // the painting code reads as e.state; ver counts changes, so the renderer knows to repaint.
  const STATE = { values: {}, ver: 0, was: key => STATE.values[key], sample: null, cut: 0, shots: 0, views: 0, read: new Set() };
  // the state as the painting code reads it (e.state; a module's beforeFrame too): each key it reads is
  // kept (STATE.read, since the scene was shown) — a key set from outside that nothing in the scene
  // reads is said (scenestate.js) — and, by the painting that reads it (`keys`), with its value then:
  // what it is repainted for (moved). Listing the keys (Object.keys, for…in) reads them all. What the
  // modules' beforeFrame keep goes on from frame to frame: painting it reads the time (a module's
  // figure does), so an element painting through e.kit, e.lib is repainted for the keys it reads itself.
  // (a key kept once per painting: a read after the first costs a lookup)
  const keep = (keys, v, k) => { if (typeof k === 'string' && !keys.has(k)) { keys.set(k, v[k]); STATE.read.add(k); } };
  const stateRead = keys => new Proxy(STATE.values, {
    get: (v, k) => { keep(keys, v, k); return v[k]; },
    has: (v, k) => { keep(keys, v, k); return k in v; },
    ownKeys: v => { keys.set(ALL, STATE.ver); return Reflect.ownKeys(v); },
  });
  const ALL = Symbol('all');
  // the keys the modules' beforeFrame read (since the scene was shown)
  const BEFORE = new Map();
  // whether the state an element's painting read (READS: read.keys) has changed since it was painted
  function moved(read) {
    if (!read) return true;
    for (const [k, was] of read.keys) if (k === ALL ? was !== STATE.ver : !Object.is(STATE.values[k], was)) return true;
    return false;
  }
  // what the shown scene's code shares (kit.js): the world's modules it lists, the scene's lib and
  // its land (ground: (across, distance) → metres, or null — flat)
  let SHARED = { kit: {}, lib: {}, ground: null, tr: MooodKit.words(null) };
  // The scene's people (people.js: an element with "person"), by their element's id — made as the scene is shown,
  // kept while it is shown again with them the same (they go on with what they are doing); moved once a frame,
  // drawn or not, as beforeFrame is (stepPeople), their points marked as it marks them. Their painting is their
  // silhouette as they stand now (what is picked where they are); they are drawn in 3D (world.js). HERE: where the
  // engine's files are (people.js and what it loads)
  const PEOPLE = new Map(), HERE = location.href;
  // a point of the world by what names it (the shown stage's: a person's point, an element's, metres) → [across, up,
  // distance] metres, or null — what e.point finds where it is
  let aimOf = () => null;
  // a person's keys of the state (<id>_<key>: people.js)
  const PERSON_KEYS = ['do', 'turn', 'look', 'reach', 'with', 'wear', 'gait', 'steps', 'on', 'here', 'still', 'mood', 'talk'];
  // a person not in the scene now (<id>_here: false — gone off, not come yet): not seen, nothing of them drawn
  const away = o => !!o?.person && o.id != null && STATE.values[`${o.id}_here`] === false;
  const paintPerson = (g, e) => { const P = PEOPLE.get(String(e.id)); if (P) { void e.t; P.paint(g); } };
  const groundAt = (across, distance) => (SHARED.ground ? SHARED.ground(across, distance) : 0);
  // Where an element is now, as its painting code says (e.at): the point it marks, in metres from
  // its anchor as painted — speech bubbles and widgets follow it (stage.screenOf) wherever the
  // element is put (its `place`). FOCUS: its own point (the head, say) — it stays till marked
  // again; NAMED: the points it names (e.at(x, y, 'window')) — as its last painting marked them, so
  // one it no longer marks is gone. A point in one of its parts (e.part) carries the part's offset.
  // MARKED: the points the modules' and the lib's beforeFrame mark (at(id, x, y, name)), worked out
  // from what they keep — this frame's, drawn or not (a figure's head as it walks out of sight, as
  // the film is fast-forwarded): an element's point is the one marked so, else as painted.
  const FOCUS = new Map(), NAMED = new Map(), MARKED = new Map();
  const focusOf = id => MARKED.get(id)?.get(null) ?? FOCUS.get(id);
  const namedOf = (id, name) => MARKED.get(id)?.get(name) ?? NAMED.get(id)?.get(name);
  // A platformer's hero as it moves now (camera.mode platform): its painting code reads e.hero —
  // { vx, vy (m/s), ground } — to move its legs; the engine moves and turns the painting itself.
  const HERO = { id: null, vx: 0, vy: 0, ground: true };
  // What an element's code read as it was last painted (element → {time, state, keys, lights},
  // and how many parts it painted): one that reads the time is repainted every frame, one that reads
  // only the state (or the light falling on it) when a key it read changes (moved), one that reads
  // neither stays as painted (world.js) — whether it reads them itself or through the kit
  const READS = new WeakMap();
  // What looking closely at a scene shows (?debug, a render's --debug and --json), by element (its
  // id, else its name): NOTES — what its code wrote as it was last painted (e.debug: a value, and the
  // point it is about), PARTS — the parts it painted (e.part: dx, dz, box); what its painting cost
  // and what it read are PERF's (below).
  const NOTES = new Map(), PARTS = new Map(), keyOf = o => o.id ?? o.name;
  // the real clock, for what costs are timed by: a render stops the page's own (window.__mooodClock:
  // the clock before it did)
  const clock = globalThis.__mooodClock || (() => performance.now());
  const compiled = new Map();
  // what the scene does wrong without failing (a name it does not know, a value it can't take — e.warn's
  // too), said once (window.__mooodWarnings); what its code throws is an error (window.__mooodErrors)
  const warned = new Set();
  // the scene checked as it is drawn — in a render (mount's check) and with ?debug: what costs a
  // little each frame to find (world.js: a painting cut off by its box) is looked for only then
  const CHECK = { on: false };
  function warn(msg) {
    if (warned.has(msg)) return;
    warned.add(msg);
    (globalThis.__mooodWarnings ||= []).push(msg);
    console.warn('moood:', msg);
  }
  function reportError(o, err) {
    const msg = `${o.name || o.id || o.kind}: ${err && err.message || err}`;
    (globalThis.__mooodErrors ||= []).push(msg);
    console.warn('moood custom element:', msg);
  }
  // partsOut: where the parts it paints (e.part) go, each to be painted in a canvas of its own at its
  // own depth — { dx, dz, box, paint(g, ax, ay, ppm, lights) }; without it (a probe, the picking)
  // they are painted in place, as seen from the start
  function paintCustom(ctx, o, W, H, t, lightsOut, partsOut) {
    const code = String(o.code || '');
    // (made with the shown scene's translator in reach: made anew when it is another)
    let fn = o.person ? paintPerson : compiled.get(code);
    if (fn === undefined) {
      try { fn = MooodI18n.bind(SHARED.tr, 'g, e', code); } catch (err) { fn = null; reportError(o, err); }
      compiled.set(code, fn);
    }
    if (!fn) return;
    const [x, y, ppm] = anchorOf(o, W, H);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(ppm, ppm);
    ctx.fillStyle = ctx.strokeStyle = o.color || '#000000';
    ctx.lineCap = ctx.lineJoin = 'round';
    const period = o.period || 2;
    // what is painting now: the element itself, or one of its parts — its canvas, its anchor (x, y,
    // ppm on the stage) and the transform there, where its lights go, the part's offset
    const own = (g, ax, ay, k, lights, part) => { const base = g.getTransform(); return { g, x: ax, y: ay, ppm: k, base, unbase: base.inverse(), lights, part }; };
    let cur = own(ctx, x, y, ppm, lightsOut, null);
    // a point the code names, in its units from the anchor as painted — through whatever it did to
    // the canvas since (translate, scale, rotate): [x, y, how much it is scaled]
    const painted = (lx, ly) => {
      const now = cur.g.getTransform(), q = cur.unbase.transformPoint(now.transformPoint({ x: lx, y: ly }));
      return [q.x, q.y, Math.hypot(now.a, now.b) / Math.hypot(cur.base.a, cur.base.b)];
    };
    const read = { time: false, state: false, keys: new Map(), lights: false }, key = keyOf(o);
    let state = null;
    // a key read through e.was, e.speed, e.spot (its place), e.ambient (the light's looks)
    const reads = (...ks) => { read.state = true; for (const k of ks) { STATE.read.add(k); if (!read.keys.has(k)) read.keys.set(k, STATE.values[k]); } };
    // (an insert is painted through the iris its key opens: world.js)
    if (typeof o.insert === 'string') reads(o.insert);
    READS.set(o, read);
    NOTES.delete(key);
    const parts = [], named = new Map();
    if (o.id) NAMED.set(o.id, named);
    const e = {
      get t() { read.time = true; return t; },
      get phase() { read.time = true; return ((t / period) % 1 + 1) % 1; },
      get state() { read.state = true; return state ||= stateRead(read.keys); },
      id: o.id ?? null, rnd: seeded(hash(code) ^ hash(o.x + ':' + o.y)),
      get px() { return 1 / Math.max(1e-6, cur.base.a); }, W, H, aspect: W / H,
      // the part of its painting painted now, in its units: [left, top, right, bottom] — what a plane
      // travelled over (`travel`), endless, is painted for: only there
      get area() {
        const c = cur.g.canvas, a = cur.unbase.transformPoint({ x: 0, y: 0 }), b = cur.unbase.transformPoint({ x: c.width, y: c.height });
        return [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)];
      },
      light(lx, ly, r, color = '#ffd08a', strength = 0.6, name) {
        try {
          const [px, py, k] = painted(lx, ly);
          cur.lights.push({ x: cur.x + px * cur.ppm, y: cur.y + py * cur.ppm, r: r * k * cur.ppm, col: rgb(color), a: strength, flicker: o.flicker ?? 0.3, id: o.id == null ? null : name == null ? String(o.id) : `${o.id}#${name}` });
        } catch (err) { reportError(o, err); }
      },
      // the light falling on a point of the painting: [{ id, color, strength, x, y, z, dir, distance }]
      lights(lx, ly) {
        read.lights = true;
        const [px, py] = painted(lx, ly);
        return lightsAt(worldOf(o, px, py, cur.part), !!o.inside);
      },
      get ambient() { reads(...Object.keys(LOOK.spec?.light?.looks || {})); return (LOOK.now?.ambient ?? 1) * (o.inside ? LOOK.now?.inside ?? 1 : 1); },
      // where this element is now (its head, say): what speaks or hovers over it follows this point;
      // with a name, one of its points the game and the camera may aim at ('window', 'head', 'horn')
      at(lx, ly, name) {
        if (!o.id) return;
        // (to a millionth: worked back through the painting's transform, the same point comes out a last
        // digit off from one painting to the next — and what goes by it, a light from it, made anew)
        const [px, py] = painted(lx, ly).map(v => Math.round(v * 1e6) / 1e6), p = { x: px, y: py, part: cur.part };
        if (name == null) FOCUS.set(o.id, p); else named.set(String(name), p);
      },
      // a part of it standing dx metres to the right and dz farther than its anchor (on the ground
      // there): painted by paint(g, e) in metres from its own foot, at its own depth — what stands
      // between is drawn between (a fence along a road, a crowd, figures one behind another)
      part(dx, dz, paint, box) {
        if (!Number.isFinite(dx) || !Number.isFinite(dz) || typeof paint !== 'function') { reportError(o, new Error('e.part(dx, dz, paint, box?): metres to the right, metres farther, a function painting it')); return; }
        if (box !== undefined && !(Array.isArray(box) && box.length === 4 && box.every(Number.isFinite))) { reportError(o, new Error('e.part: box is [left, top, right, bottom], metres around its foot')); box = undefined; }
        parts.push({ dx, dz, box, paint });
      },
      // the ground's height (metres) at (across, distance) — spec.relief, 0 without one
      ground: groundAt,
      // where a point of the world is in its painting now — a person's ('david#hand_r', 'rosa' — the head), an
      // element's ('lamp', 'door#knob'), or [across, distance, elevation] metres — as [x, y] in the units it paints in
      // (metres from its anchor as painted, seen from the start, through what its code did to the canvas since); null
      // if there is none: a glow on someone's hand, a thought by a head, a thread from one to another
      point(ref) {
        // (what it follows moves: painted again each frame)
        read.time = true;
        const at = o._at, p = at && aimOf(ref, o.name || o.id);
        if (!p || !(p[2] > 0.05)) return null;
        const q = { x: p[0] * at.distance / p[2] - at.across, y: (EYE - p[1]) * at.distance / p[2] - EYE + at.elevation };
        const r = cur.g.getTransform().inverse().transformPoint(cur.base.transformPoint(q));
        return [r.x, r.y];
      },
      // ... and where that point is in the world now (metres): {across, distance, elevation}; null if there is none —
      // a torch carried in a hand, for what paints its light on the walls and the floor
      where(ref) {
        read.time = true;
        const p = aimOf(ref, o.name || o.id);
        return p ? { across: p[0], distance: p[2], elevation: p[1] } : null;
      },
      // where it stands now (metres): across, distance, its elevation and the ground's under it
      get spot() { if (o.place) reads(...Object.values(o.place).filter(k => typeof k === 'string')); return o._at ? { ...o._at } : null; },
      // a note for whoever looks closely (?debug): text or a value (a module's poses and their
      // weights), about the point (lx, ly) if given — shown by the element; nothing otherwise
      debug(value, lx, ly) {
        if (key == null) return;
        let at = null;
        try { if (typeof lx === 'number' && typeof ly === 'number') { const [px, py] = painted(lx, ly); at = { x: px, y: py }; } } catch (err) { reportError(o, err); }
        (NOTES.get(key) || NOTES.set(key, []).get(key)).push({ value, at });
      },
      // something wrong but not an error — a name it does not know (a pose, a figure) — said once
      warn(text) { warn(`${o.name || o.id || o.kind}: ${text}`); },
      anim: MooodKit.anim, kit: SHARED.kit, lib: SHARED.lib,
      was: (key, ago = 0) => { reads(String(key)); return STATE.was(key, ago); },
      speed: key => { reads(String(key)); const a = STATE.was(key, 0), b = STATE.was(key, 0.05); return typeof a === 'number' && typeof b === 'number' ? (a - b) / 0.05 : 0; },
      cut: STATE.cut,
    };
    if (o.id && o.id === HERO.id) { read.time = true; e.hero = { vx: HERO.vx, vy: HERO.vy, ground: HERO.ground }; }
    try { fn(ctx, e); } catch (err) { reportError(o, err); }
    ctx.restore();
    // its parts: each painted where the renderer puts it — or here, in place as seen from the start
    // (u, v: metres in its own plane, from its anchor)
    const run = part => (g, ax, ay, k, lights) => {
      g.save(); g.translate(ax, ay); g.scale(k, k);
      g.fillStyle = g.strokeStyle = o.color || '#000000';
      g.lineCap = g.lineJoin = 'round';
      const was = cur;
      cur = own(g, ax, ay, k, lights, { dx: part.dx, dz: part.dz });
      try { part.paint(g, e); } catch (err) { reportError(o, err); }
      cur = was;
      g.restore();
    };
    read.parts = parts.length;
    if (key != null) { if (parts.length) PARTS.set(key, parts.map(q => ({ dx: q.dx, dz: q.dz, box: q.box }))); else PARTS.delete(key); }
    for (const part of parts) {
      if (partsOut) { partsOut.push({ dx: part.dx, dz: part.dz, box: part.box, paint: run(part) }); continue; }
      const q = inPlace(o, part.dx, part.dz);
      if (q) run(part)(ctx, x + q.u * ppm, y + q.v * ppm, q.s * ppm, lightsOut);
    }
  }
  // A part (dx, dz) of element o painted in o's own plane as seen from the start — its foot u, v
  // metres from o's anchor, its scale s — or null (o is not where it could have parts). (o a card
  // turned its own way: its part's foot as it lies in its plane — one behind it, over it there)
  function inPlace(o, dx, dz) {
    const at = o._at, turn = o._frame && turnOf(o);
    if (turn) { const F = o._frame, { r, u } = axesOf(turn), D = [0, 1, 2].map(i => dx * F.r[i] + dz * F.ahead[i]); return { u: dot3(D, r), v: -dot3(D, u), s: 1 }; }
    if (!at || !(at.distance > 0) || !(at.distance + dz > 0.05)) return null;
    const s = at.distance / (at.distance + dz), feet = at.elevation - at.ground + groundAt(at.across + dx, at.distance + dz);
    return { u: (at.across + dx) * s - at.across, v: (EYE - feet) * s - (EYE - at.elevation), s };
  }
  // Where a custom element's painting has its origin on the W × H stage, and its scale: [x, y, px a
  // unit]. Sky, ground and insert elements are painted in stage heights from the stage's top-left
  // corner (x 0…W/H, y 0…1, with margins; the sky and the ground as seen from the start); others in
  // metres from their anchor.
  function anchorOf(o, W, H) {
    return o.sky || o.ground || o.insert ? [0, 0, H] : [o.x * W, o.y * H, o.size * H / (o.height || 2)];
  }
  // The box an object's painting fits in (pixels of the W × H stage): built-in kinds a fixed frame
  // around the base, custom ones their `box` in metres (default: a little wider than tall).
  function objectBox(o, W, H) {
    // the sky: as wide as the widest frame
    if (o.sky) return { bx: (W - WIDEST * H) / 2, by: -0.35 * H, bw: WIDEST * H, bh: 1.6 * H };
    // an insert: the frame itself, as wide as the widest
    if (o.insert) return { bx: (W - WIDEST * H) / 2, by: 0, bw: WIDEST * H, bh: H };
    // ground: from the horizon down, wider than the screen (for stepping aside and looking down)
    if (o.ground) return { bx: -EXT * W, by: o._yh * H, bw: (1 + 2 * EXT) * W, bh: (1.7 - o._yh) * H };
    const s = Math.max(2, o.size * H), x = o.x * W, y = o.y * H;
    if (o.kind === 'custom' || !o.kind) {
      const h = o.height || 2, ppm = s / h, b = Array.isArray(o.box) && o.box.length === 4 ? o.box : [-0.8 * h, -1.1 * h, 0.8 * h, 0.15 * h];
      return { bx: x + b[0] * ppm, by: y + b[1] * ppm, bw: (b[2] - b[0]) * ppm, bh: (b[3] - b[1]) * ppm };
    }
    return { bx: x - 1.7 * s, by: y - 1.3 * s, bw: 3.4 * s, bh: 1.6 * s };
  }


  // ── the scene's light ──────────────────────────────────────────────────
  // spec.light as the state has it now: the grade of the whole picture — tint, tintStrength,
  // vignette, grain, haze, hazeColor, brightness (×), saturation (×) — and, for a lit scene, ambient
  // (0…1: how much of its painted colour a thing keeps where no light falls on it) and ambientColor.
  // `looks`: { key: fields } — a state value `key` (0…1) mixes the light toward that look, in the
  // order they are listed (night over the day, dawn over the night): a script moves the key with
  // `over`, the light changes softly. A scene is lit — its light lies on what is painted, by how far
  // each thing is from each source (world.js) — as much as it or a look of it gives `ambient` now: `lit`
  // 1 when the light itself has it, else the weight of the most of the looks that do (0: not lit —
  // its sources come in as their look does, from nothing, so it never jumps). hazeGlow (0 unset): the
  // haze lit by the point sources (airOf).
  // inside (1 unset): how much of the light outside reaches what is `inside` (a room: through its windows)
  // lights (a look's only): { id: how much of its strength a light of the scene (spec.lights) has in
  // that look } — the moon's gone by morning, dimmed in a blizzard; mixed by the look's weight like
  // the rest, 1 where no look says (sourcesNow)
  // bounce 0…1 (0.5 unset): how much the light that what is lit gives back fills what is darker than its
  // surroundings — a cloth in a lamp's shadow, a wall turned from the lamp, the snow lighting a wall
  // haze 0…1 → how far (eye heights) the air hides a thing to 1/e; unset: clear air, 220
  const hazeReach = h => 600 * Math.pow(25 / 600, clamp(h, 0, 1));
  const LOOK_NUM = { tintStrength: 0, vignette: 0.5, grain: 0.5, haze: Math.log(220 / 600) / Math.log(25 / 600), brightness: 1, saturation: 1, ambient: 1, hazeGlow: 0, inside: 1, bounce: 0.5, people: 0.5 };
  const LOOK_COL = ['tint', 'hazeColor', 'ambientColor'];
  const LOOK = { spec: null, ver: -1, now: null };
  // "#rrggbb" → [r, g, b] 0…255, or null (said)
  function colourOf(hex, where) {
    const m = /^#?([0-9a-f]{6})$/i.exec(typeof hex === 'string' ? hex : '');
    if (!m) { warn(`${where}: ${JSON.stringify(hex)} is not a colour ("#rrggbb")`); return null; }
    const n = parseInt(m[1], 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  function lookOf(spec) {
    if (LOOK.spec === spec && LOOK.ver === STATE.ver) return LOOK.now;
    const L = spec?.light && typeof spec.light === 'object' ? spec.light : {}, v = {};
    for (const [k, d] of Object.entries(LOOK_NUM)) v[k] = typeof L[k] === 'number' ? L[k] : d;
    v.tint = L.tint ? colourOf(L.tint, 'light.tint') : null;
    v.hazeColor = colourOf(L.hazeColor || spec?.sky?.bottom || '#808080', 'light.hazeColor') || [128, 128, 128];
    v.ambientColor = (L.ambientColor && colourOf(L.ambientColor, 'light.ambientColor')) || [255, 255, 255];
    let lit = typeof L.ambient === 'number' ? 1 : 0;
    const looks = L.looks && typeof L.looks === 'object' ? L.looks : {}, ids = new Set((Array.isArray(spec?.lights) ? spec.lights : []).map(l => l && String(l.id)));
    v.lights = {};
    for (const [key, look] of Object.entries(looks)) {
      if (!look || typeof look !== 'object') { warn(`light.looks.${key}: an object of light fields`); continue; }
      for (const k of Object.keys(look)) if (!(k in LOOK_NUM) && !LOOK_COL.includes(k) && k !== 'lights') warn(`light.looks.${key}: "${k}" is not a field of the light (${[...Object.keys(LOOK_NUM), ...LOOK_COL, 'lights'].join(', ')})`);
      const ls = look.lights && typeof look.lights === 'object' && !Array.isArray(look.lights) ? look.lights : look.lights == null ? {} : (warn(`light.looks.${key}.lights: { light id: how much of its strength (0…) }`), {});
      for (const [id, k] of Object.entries(ls)) if (!ids.has(id) || !(typeof k === 'number' && k >= 0)) warn(`light.looks.${key}.lights.${id}: ${ids.has(id) ? 'how much of its strength, a number 0…' : 'there is no such light (spec.lights)'}`);
      const w = clamp(Number(STATE.values[key]) || 0, 0, 1);
      if (w <= 0) continue;
      for (const [id, k] of Object.entries(ls)) if (typeof k === 'number' && k >= 0) v.lights[id] = (v.lights[id] ?? 1) + (k - (v.lights[id] ?? 1)) * w;
      if (typeof look.ambient === 'number') lit = Math.max(lit, w);
      for (const k of Object.keys(LOOK_NUM)) if (typeof look[k] === 'number') v[k] += (look[k] - v[k]) * w;
      for (const k of LOOK_COL) {
        const c = look[k] && colourOf(look[k], `light.looks.${key}.${k}`);
        if (c) v[k] = v[k] ? v[k].map((a, i) => a + (c[i] - a) * w) : c;
      }
    }
    v.lit = lit;
    v.hazeReach = hazeReach(v.haze);
    Object.assign(LOOK, { spec, ver: STATE.ver, now: v });
    return v;
  }

  // ── where light comes from ─────────────────────────────────────────────
  // The scene's sources of light, as data its painting reads (e.lights) and the renderer lays on
  // what is painted (a lit scene) and casts shadows from (`shadow`):
  //   spec.lights: { id, across | x, distance, elevation (metres), place (as an element's: a lamp
  //     carried) — or at (a person's point: 'keeper#hand_r', a lantern in their hand), color, strength (1),
  //     reach (metres it lights, 8), on (a state key 0…1: it shines that much), flicker (0…1), glow (metres: its halo, which the renderer draws) } — a point: a
  //     lamp, a forge, a fire; with daylight (true, or how much): the light outside coming in at a
  //     window — its colour and strength the outside's light now, lighting only what is `inside`; or,
  //     { id, daylight, of: the window (an element: a card, turned or not, a pane of glass, a plane),
  //     reach, on }, coming in at all of it (windowOf): from the point of it nearest what it lights,
  //     only into the room — before its face — the less the more aslant; { id, of: an element's light (its id, or 'id#name' — below), color,
  //     strength, reach, on, flicker } — the light an element paints, where it paints it, shining as
  //     this says (a lantern in a hand: its glow small, its reach long); or { id, from: [bearing,
  //     height] (degrees: where it shines from — 0 the far side, 90 the right, 180 behind the viewer;
  //     how high above the horizon — or place: { bearing, height } state keys; or 'id#name': from where
  //     a sky element marks that point, e.at — the moon wherever it is painted), color, strength, on } —
  //     the moon, the sun, the dawn: far off, the same everywhere; with through: [pane, …] (each a
  //     flat polygon of [across, elevation, distance] points, metres: a window) it comes in only
  //     through them — what it reaches is what sees it through one (soft: metres its edge is soft
  //     over, 0.3): the sun's shafts in a gallery, lighting whoever stands in them. (Only point by
  //     point — the people, e.lights, the shadows: a scene the engine lights does not lay it on its
  //     surfaces; a painted one paints its patches of light itself);
  //   each as strong as a look says too (light.looks: lights);
  //   every e.light() an element paints (its id the element's, or 'id#name' for one it names),
  //     reaching twice its radius — as it was last painted.
  // World units, eye heights: X to the right, Y up, Z ahead. `ver` changes when any of them does:
  // what reads them is repainted then.
  const SOURCES = { list: [], ver: 0, on: new Map() };
  const hexOf = c => '#' + c.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  // the spec's sources now (dz: depths()); from: the elements' lights — as [{ id, at, reach, rgb,
  // strength }] — they too become the sources (but those the spec takes over: `of`). A source that
  // flickers has `flicker` (0…1) and `seed`; one with a halo `glow` (eye heights)
  function sourcesNow(spec, dz, from) {
    const list = [], taken = new Set(), shines = new Map(), looked = lookOf(spec).lights;
    (Array.isArray(spec.lights) ? spec.lights : []).forEach((l, i) => {
      if (!l || typeof l !== 'object') { warn(`lights[${i}]: an object`); return; }
      const id = l.id != null ? String(l.id) : `lights[${i}]`;
      const on = (typeof l.on === 'string' ? clamp(Number(STATE.values[l.on]) || 0, 0, 1) : 1) * (looked[id] ?? 1);
      const flicker = clamp(Number(l.flicker) || 0, 0, 1), seed = hash(id) % 1000;
      const day = l.daylight === true ? 1 : l.daylight == null || l.daylight === false ? 0 : typeof l.daylight === 'number' && l.daylight >= 0 ? l.daylight : (warn(`lights ${id}: "daylight" is true or a strength (1)`), 0);
      if (day && l.of != null) {
        const el = (spec.objects || []).find(o => o.id != null && String(o.id) === String(l.of)), win = el && windowOf(el, dz);
        if (!win) { warn(`lights ${id}: "daylight" "of" names the window it comes in at — an element of the scene standing in it (a card, a pane of glass, a plane), not ${JSON.stringify(l.of)}`); return; }
        list.push({ id, at: win.c, win, reach: (l.reach > 0 ? l.reach : 8) / EYE, rgb: [255, 255, 255], strength: 1, flicker, seed, halo: 0, inside: true, day: day * on });
        return;
      }
      if (l.of != null) {
        const el = from.find(s => s.id === String(l.of));
        if (!el) {
          // (an element painting no such light now: it is out)
          const owner = String(l.of).split('#')[0];
          if (!(spec.objects || []).some(o => o.id != null && String(o.id) === owner)) warn(`lights ${id}: "of" names an element's light ("lamp", "lamp#wick") — there is no element ${JSON.stringify(owner)}`);
          return;
        }
        taken.add(el);
        if (on < 1) shines.set(el.id, on);
        const rgb = l.color ? colourOf(l.color, `lights ${id}: color`) || el.rgb : el.rgb;
        list.push({ ...el, id, rgb, strength: (typeof l.strength === 'number' ? l.strength : el.strength) * on, reach: l.reach > 0 ? l.reach / EYE : el.reach, ...(flicker ? { flicker, seed, sprite: undefined } : {}) });
        return;
      }
      const rgb = colourOf(l.color || '#ffffff', `lights ${id}: color`) || [255, 255, 255];
      const strength = (typeof l.strength === 'number' ? l.strength : 1) * on;
      if (l.from != null) {
        const dir = farFrom(l, id, spec, dz), through = l.through == null ? null : panesOf(l.through, id, spec, dz);
        if (dir) list.push({ id, dir, rgb, strength, ...(through && { through, soft: (l.soft > 0 ? l.soft : 0.3) / EYE }) });
        return;
      }
      // (carried by someone: at a point of theirs — where it was as they were posed last; not while they are away)
      let at;
      if (l.at != null) {
        const [who, name = 'hands'] = String(l.at).split('#'), P = PEOPLE.get(who), o = (spec.objects || []).find(x => x?.person && String(x.id) === who);
        if (!o) { warn(`lights ${id}: "at" is a person's point ("keeper#hand_r") — there is no person ${JSON.stringify(who)}`); return; }
        const q = P && !away(o) && P.point(name);
        if (!q) return;
        at = { X: q[0] / EYE, Y: q[1] / EYE, Z: q[2] / EYE };
      } else {
        if (!(l.distance > 0) && typeof l.place?.distance !== 'string') { warn(`lights ${id}: a point light has a "distance" (metres); one far off has "from": [bearing, height]; one carried, "at": a person's point`); return; }
        at = dz.now({ ...l, on: undefined, kind: undefined, sky: false, plane: false, ground: false, height: 1 }).at;
      }
      list.push({ id, at: [at.X, at.Y, at.Z], reach: (l.reach > 0 ? l.reach : 8) / EYE, rgb, strength, flicker, seed, halo: l.glow > 0 ? l.glow / EYE : 0, ...(day ? { inside: true, day: day * on } : {}) });
    });
    list.push(...from.filter(s => !taken.has(s)));
    // the light coming in at a window (`daylight`): the light outside now — its ambient, the sun's and
    // the moon's — that much; it lights only what is inside
    const days = list.filter(s => s.day != null);
    if (days.length) {
      const amb = ambientOf(lookOf(spec), list), top = Math.max(...amb);
      for (const s of days) { s.rgb = amb.map(v => Math.round(255 * v / (top || 1))); s.strength = s.day * top; }
    }
    // (the same as a frame ago, to a thousandth, compared as numbers: nothing made each frame)
    const near = (a, b) => Math.abs(a - b) < 5e-4, was = SOURCES.list;
    const same = list.length === was.length && list.every((s, i) => {
      const where = x => (x.win ? [...x.at, ...x.win.a, ...x.win.b] : x.through ? [...x.dir, ...x.through.flatMap(W => [...W.o, ...W.n])] : x.at || x.dir), w = was[i], p = where(s), q = where(w);
      return s.id === w.id && near(s.strength, w.strength) && s.rgb.every((v, j) => v === w.rgb[j]) && p.length === q.length && p.every((v, j) => near(v, q[j]));
    });
    if (!same) SOURCES.ver++;
    SOURCES.list = list; SOURCES.on = shines;
    return list;
  }
  // Where a light far off shines from (`from`), a unit vector toward it (eye heights: X right, Y up, Z
  // ahead), or null: [bearing, height] (degrees; place.bearing, place.height — state keys — over them), or
  // a point a sky element marks ('id#name', 'id': its e.at) — seen from the start: on the stage, as the
  // sky is painted (looking around, round the full circle)
  function farFrom(l, id, spec, dz) {
    if (Array.isArray(l.from)) {
      const v = k => (typeof STATE.values[l.place?.[k]] === 'number' ? STATE.values[l.place[k]] : null);
      const [b, h] = [v('bearing') ?? l.from[0], v('height') ?? l.from[1]].map(x => (Number(x) || 0) * Math.PI / 180);
      return [Math.sin(b) * Math.cos(h), Math.sin(h), Math.cos(b) * Math.cos(h)];
    }
    const [el, name] = String(l.from).split('#'), o = typeof l.from === 'string' && (spec.objects || []).find(x => x.id != null && String(x.id) === el);
    if (!o?.sky) { warn(`lights ${id}: "from" is [bearing, height] (degrees) or a point of a sky element ("moon", "moon#disc")`); return null; }
    const p = name === undefined ? focusOf(o.id) : namedOf(o.id, name);
    if (!p) return null; // (not marked now: it does not shine)
    const up = dz.yh - p.y;
    if (camSetup(spec).round) { const b = p.x - Math.PI, n = Math.hypot(1, up); return [Math.sin(b) / n, up / n, Math.cos(b) / n]; }
    const x = p.x - STAGE / 2, n = Math.hypot(x, up, 1);
    return [x / n, up / n, 1 / n];
  }
  // how much an element's light (e.light, by its id: 'lamp', 'lamp#wick') glows now: as much as the
  // scene's light taken over from it is on (lights: "of", "on") — a lamp put out goes dark, glow and all
  const glowOn = id => (id == null ? 1 : SOURCES.on.get(id) ?? 1);
  // how strong a source that flickers (sourcesNow: flicker, seed) shines at t, 0…1
  const flickerNow = (s, t) => (s.flicker ? 1 - s.flicker * 0.5 * (0.5 + 0.5 * Math.sin(t * 9 + s.seed) * Math.sin(t * 5.3 + s.seed * 0.7)) : 1);
  // The light in the air, drawn among what stands, each at its depth (far: a source → its depth, as
  // the renderer orders what it draws): the halos of the scene's own lights (`glow`), and — the
  // light's hazeGlow — the haze round every point source (a lamp, a fire, a window's e.light) glowing
  // its colour as far as it reaches, a little nearer than the source (over what it lights). Farthest
  // first: [{ h: the source, fog, Z }]; with no point sources, or no hazeGlow, only the halos.
  function airOf(sources, look, far) {
    const out = [];
    for (const h of sources) {
      if (!h.at || h.strength <= 0.002) continue;
      if (h.halo) out.push({ h, fog: false, Z: far(h) });
      if (look.hazeGlow > 0) out.push({ h, fog: true, Z: far(h) - h.reach / 2 });
    }
    return out.sort((a, b) => b.Z - a.Z);
  }
  // how strongly the haze round point source s glows seen D eye heights away (0…1, 0: not at all): as
  // much as there is air within its reach (its haze — thick fog glows more), scattered toward the eye
  // (×3), through the air between, as the light shines now — × hazeGlow
  const airGlow = (look, s, D, t) => Math.min(1, look.hazeGlow * 3 * s.reach / look.hazeReach * Math.exp(-Math.max(0, D) / look.hazeReach) * Math.min(1, s.strength) * flickerNow(s, t));
  // how much of a point light reaches x of its reach away
  const falloff = x => (x >= 1 ? 0 : (1 - x * x) * (1 - x * x));
  // A window a `daylight` light comes in at (its `of`): the element's rectangle in the world, eye heights
  // — { c: its middle, a, b: half its sides, n: where its face looks (into the room: a card facing the
  // start, the viewer; a plane, up), size: its sides' mean } — or null (the sky, the ground, an insert)
  function windowOf(o, dz) {
    if (o.sky || o.ground || o.insert) return null;
    let c, a, b, n;
    if (o.plane) {
      const P = planeOf(o, dz);
      [c, a, b, n] = [P.on(0, 0), P.ax.r.map(v => v * P.w / 2), P.ax.u.map(v => v * P.d / 2), P.ax.n];
    } else {
      const e = dz.now(o).o, h = o.height || 2, bx = Array.isArray(o.box) && o.box.length === 4 ? o.box : [-0.8 * h, -1.1 * h, 0.8 * h, 0.15 * h], t = turnOf(e);
      const p = (x, y) => worldOf(e, x, y), m = p((bx[0] + bx[2]) / 2, (bx[1] + bx[3]) / 2), from = q => q.map((v, i) => v - m[i]);
      [c, a, b, n] = [m, from(p(bx[2], (bx[1] + bx[3]) / 2)), from(p((bx[0] + bx[2]) / 2, bx[1])), t ? axesOf(t).n : [0, 0, -1]];
    }
    return { c, a, b, n, size: Math.hypot(...a) + Math.hypot(...b) };
  }
  // how much of point source s reaches world point P (0…1: as it falls off) and from where — a window's
  // (s.win) from the point of it nearest P, as much as P is before its face: none behind its plane (the
  // wall it is in, what is outside), the less the more aslant — [share, the point, eye heights]
  function reachOf(s, P) {
    if (!s.win) return [falloff(Math.hypot(P[0] - s.at[0], P[1] - s.at[1], P[2] - s.at[2]) / s.reach), s.at];
    const { c, a, b, n } = s.win, e = [P[0] - c[0], P[1] - c[1], P[2] - c[2]], front = dot3(e, n);
    if (front <= 0) return [0, c];
    const ua = clamp(dot3(e, a) / dot3(a, a), -1, 1), ub = clamp(dot3(e, b) / dot3(b, b), -1, 1), Q = c.map((v, i) => v + a[i] * ua + b[i] * ub);
    const l = Math.hypot(P[0] - Q[0], P[1] - Q[1], P[2] - Q[2]);
    return [falloff(l / s.reach) * front / Math.max(l, 1e-6), Q];
  }
  // A point of an element's painting (metres, from its anchor as painted — or from the foot of its
  // part { dx, dz }, e.part: laid along the frame its parts are, _frame, else on the ground there) in
  // the world (eye heights), or null for what has no place in it (the sky, the ground's painting, an
  // insert)
  function worldOf(o, px, py, part) {
    if (o._plane) return o._plane.on(px / EYE, py / EYE);
    const at = o._at;
    if (!at || o.sky || o.ground || o.insert) return null;
    const F = part && o._frame, turn = turnOf(o);
    if (part && !F) {
      const across = at.across + part.dx, distance = at.distance + part.dz;
      return [(across + px) / EYE, (at.elevation - at.ground + groundAt(across, distance) - py) / EYE, distance / EYE];
    }
    const foot = [at.across, at.elevation, at.distance].map((v, i) => v + (F ? part.dx * F.r[i] + part.dz * F.ahead[i] : 0));
    if (turn) { const { r, u } = axesOf(turn); return foot.map((v, i) => (v + r[i] * px - u[i] * py) / EYE); }
    return [(foot[0] + px) / EYE, (foot[1] - py) / EYE, foot[2] / EYE];
  }
  // A light's panes (`through`: each a window element's id — its rectangle, windowOf — or a flat polygon of
  // [across, elevation, distance] points, metres) as it goes through them: each its corner o, its axes u, v in
  // its plane and its normal n, its corners in (u, v) — eye heights (what is wrong, said)
  function panesOf(list, id, spec, dz) {
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], unit = v => { const l = Math.hypot(...v) || 1; return v.map(c => c / l); };
    const polygon = w => Array.isArray(w) && w.length >= 3 && w.every(p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite));
    if (!Array.isArray(list) || !list.every(w => typeof w === 'string' || polygon(w))) { warn(`lights ${id}: "through" is a list of panes, each a window element's id or a polygon of [across, elevation, distance] points (metres)`); return null; }
    return list.map(w => {
      let P;
      if (typeof w === 'string') {
        const el = (spec.objects || []).find(o => o.id != null && String(o.id) === w), win = el && windowOf(el, dz);
        if (!win) { warn(`lights ${id}: "through" names ${JSON.stringify(w)} — an element of the scene standing in it, a window (a card, a pane of glass, a plane)`); return null; }
        const { c, a, b } = win;
        P = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => c.map((v, k) => v + a[k] * i + b[k] * j));
      } else P = w.map(([a, e, d]) => [a / EYE, e / EYE, d / EYE]);
      const o = P[0], u = unit(sub(P[1], o)), n = unit(cross(sub(P[1], o), sub(P[2], o))), v = cross(n, u);
      return { o, u, v, n, pts: P.map(p => [dot(sub(p, o), u), dot(sub(p, o), v)]) };
    }).filter(Boolean);
  }
  // How much of a light that comes in through panes reaches world point P (eye heights): 1 where the way to it
  // goes through one, 0 where it meets none, softly between (its `soft` over the pane's edge) — what is past
  // the panes, that is: what is in the room (inside), or beyond the plane of one; what is before them all
  // (outside, on the light's side: the yard the window looks out on) it lights as any light far off
  function throughAt(s, P, inside = false) {
    let best = 0, past = inside;
    for (const W of s.through) {
      const nd = W.n[0] * s.dir[0] + W.n[1] * s.dir[1] + W.n[2] * s.dir[2];
      if (Math.abs(nd) < 1e-6) continue;
      const t = (W.n[0] * (W.o[0] - P[0]) + W.n[1] * (W.o[1] - P[1]) + W.n[2] * (W.o[2] - P[2])) / nd;
      if (t <= 0) continue;
      past = true;
      const H = [0, 1, 2].map(i => P[i] + s.dir[i] * t - W.o[i]), x = H[0] * W.u[0] + H[1] * W.u[1] + H[2] * W.u[2], y = H[0] * W.v[0] + H[1] * W.v[1] + H[2] * W.v[2];
      // (how far inside its edge the way meets it: + inside, − outside)
      let within = false, d = Infinity;
      for (let i = 0, j = W.pts.length - 1; i < W.pts.length; j = i++) {
        const [ax, ay] = W.pts[j], [bx, by] = W.pts[i];
        if ((by > y) !== (ay > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) within = !within;
        const ex = bx - ax, ey = by - ay, k = clamp(((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey || 1), 0, 1);
        d = Math.min(d, Math.hypot(x - ax - ex * k, y - ay - ey * k));
      }
      const u = clamp(0.5 + (within ? d : -d) / s.soft, 0, 1);
      best = Math.max(best, u * u * (3 - 2 * u));
    }
    return past ? best : 1;
  }
  // The light falling on world point P (null: only what comes from far off), strongest first:
  // { id, color, strength (as much as reaches it), x, y (toward the light on the painting: x to the
  // right, y down — a unit vector with z), z (toward the viewer: + it lights the side we see, − it
  // is behind: an edge of light), dir (degrees on the screen toward the light: 0 right, 90 down,
  // −90 up, 180 left), distance (metres; null from far off) } — inside (a room's): the light coming in
  // at its windows (`daylight`), and of what comes from far off the share that comes in
  function lightsAt(P, inside) {
    const out = [];
    for (const s of SOURCES.list) {
      if (s.inside && !inside) continue;
      // (from far off: inside, a share — one coming in through panes, as much as comes through them)
      let v = s.dir, k = inside && s.dir && !s.through ? LOOK.now?.inside ?? 1 : 1, d = null;
      if (s.through) { if (!P) continue; k *= throughAt(s, P, inside); }
      if (!v) {
        if (!P) continue;
        const [f, Q] = reachOf(s, P);
        v = [Q[0] - P[0], Q[1] - P[1], Q[2] - P[2]];
        d = Math.hypot(v[0], v[1], v[2]);
        k *= f;
        v = d > 1e-6 ? v.map(c => c / d) : [0, 1, 0];
      }
      const strength = s.strength * k;
      if (strength < 0.002) continue;
      out.push({ id: s.id, color: hexOf(s.rgb), strength, x: v[0], y: -v[1], z: -v[2], dir: Math.atan2(-v[1], v[0]) * 180 / Math.PI, distance: d === null ? null : d * EYE });
    }
    return out.sort((a, b) => b.strength - a.strength);
  }
  // `shadow` on an element standing in the scene, or on a plane (a table top, a roof's slope, tilted
  // or level): it casts one from a light of the scene onto what
  // `onto` names — 'ground' (the ground under everything, height 0), a plane (a floor, a table top) or
  // an upright element (a wall) — each point of it onto the first of them its ray meets: its own
  // painting, black, softened by the size of the light (`soft`, metres), as dark as `strength` where
  // the light is full, fading as the light does. true = { light: the strongest at it, onto:
  // ['ground'], strength: 0.5, soft: 0.15 }. The scene's shadows: [{ id, onto: ['ground' | id],
  // light: id | null, strength, soft (eye heights), body: its id and those of what carries it (`on`,
  // all the way down) — the lights they paint (a stove's fire, painted on its front, carrying its side)
  // are inside it and cast none of its shadows }] (what is wrong with one, said)
  function shadowsOf(spec) {
    const objs = spec.objects || [], byId = new Map(objs.filter(o => o.id != null).map(o => [String(o.id), o])), out = [];
    const bodyOf = (o, ids = new Set()) => { ids.add(String(o.id)); const up = o.on != null && byId.get(String(o.on)); return up && !ids.has(String(up.id)) ? bodyOf(up, ids) : ids; };
    for (const o of objs) {
      const sh = o.shadow;
      if (!sh) continue;
      const who = o.name || o.id, c = sh === true ? {} : typeof sh === 'object' && !Array.isArray(sh) ? sh : null;
      if (!c || o.id == null || o.sky || o.ground || o.drape || o.insert || o.kind === 'bird') { warn(`${who}: "shadow" is true or { light, onto, strength, soft } — on something standing in the scene or a plane (not the land), with an id`); continue; }
      if (o.unseen) { warn(`${who}: it is unseen — what is not seen casts no shadow`); continue; }
      const onto = (c.onto == null ? ['ground'] : Array.isArray(c.onto) ? c.onto : [c.onto]).map(id => {
        const r = byId.get(String(id));
        if (id === 'ground' || (r && r !== o && !r.sky && !r.ground && !r.insert)) return String(id);
        warn(`${who}: its shadow falls on ${JSON.stringify(id)} — 'ground', a plane or an upright element of the scene`);
        return null;
      }).filter(Boolean);
      const light = c.light != null ? String(c.light) : null, owner = light && light.split('#')[0];
      if (light && !(spec.lights || []).some(l => l && String(l.id) === light) && !byId.has(owner)) warn(`${who}: its shadow's light "${light}" is not a light of the scene (a light's id, or an element's — "lamp", "lamp#wick")`);
      out.push({ id: String(o.id), onto, light, strength: clamp(Number(c.strength ?? 0.5) || 0, 0, 1) * (1 - translucentOf(o)), soft: Math.max(0, Number(c.soft ?? 0.15) || 0) / EYE, body: bodyOf(o) });
    }
    return out;
  }
  // how much of source s reaches world point P ([X, Y, Z], eye heights): its share there (0…1: as it falls off, as
  // much as comes in through its panes; inside: P is in a room) — where it is, not how strong it is now — times its
  // strength
  const reachShare = (s, P, inside = false) => (s.at ? reachOf(s, P)[0] : s.through ? throughAt(s, P, inside) : 1);
  const reaching = (s, P, inside = false) => s.strength * reachShare(s, P, inside);
  // how wide a light is, seen by a shadow (eye heights): its `soft` — a window's at least its size
  const softOf = (sh, s) => (s.win ? Math.max(sh.soft, s.win.size) : sh.soft);
  // the lights a shadow is cast from: the one it names (none while it does not shine: an element not
  // painting it now), else those lighting A (where the element stands, eye heights) noticeably — the
  // strongest SHADOW_LIGHTS, each at least SHADOW_SHARE of the strongest there — sources (sourcesNow);
  // not its body's own (sh.body: a stove's fire is inside the stove — from there a face of it would
  // throw its shadow out into the room, on the side the lamp lights)
  const SHADOW_LIGHTS = 3, SHADOW_SHARE = 0.15;
  function shadowLights(sources, sh, A) {
    if (sh.light) { const s = sources.find(s => s.id === sh.light); return s ? [s] : []; }
    const P = [A.X, A.Y, A.Z], lit = sources.filter(s => !sh.body?.has(s.owner)).map(s => [s, reaching(s, P)]).filter(([, k]) => k > 0.01).sort((a, b) => b[1] - a[1]);
    return lit.filter(([, k]) => k >= SHADOW_SHARE * lit[0][1]).slice(0, SHADOW_LIGHTS).map(([s]) => s);
  }
  // A lit scene's light where no source reaches: the ambient, and what comes from far off (as much as
  // the scene is lit: look.lit) — from the viewer's side it lights what we see, from beyond only a
  // little; for what is `inside`, the share of it that comes in (look.inside): [r, g, b], 0…1 a channel
  function ambientOf(look, sources, inside = false) {
    const amb = look.ambientColor.map(v => v / 255 * look.ambient);
    for (const s of sources) if (s.dir && !s.through) { const k = (1 - 0.7 * clamp(s.dir[2] / 0.3, 0, 1)) * look.lit; for (let i = 0; i < 3; i++) amb[i] += s.rgb[i] / 255 * s.strength * k; }
    return inside ? amb.map(v => v * look.inside) : amb;
  }
  // where a ray of light meets a plane { q: a point of it, n: its normal }: from a point L through C
  // (t ≥ 1: at C or beyond it), or from far off along d (toward the light) back through C (t ≥ 0: at C — a
  // foot on the plane it stands on — or beyond it) — [point, t], or null
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  function rayHit(pl, C, L, d) {
    if (d) {
      const nd = dot3(pl.n, d);
      if (Math.abs(nd) < 1e-6) return null;
      const t = (dot3(pl.n, C) - dot3(pl.n, pl.q)) / nd;
      return t > -1e-4 ? [[C[0] - d[0] * t, C[1] - d[1] * t, C[2] - d[2] * t], Math.max(0, t)] : null;
    }
    const v = [C[0] - L[0], C[1] - L[1], C[2] - L[2]], nv = dot3(pl.n, v);
    if (Math.abs(nv) < 1e-6) return null;
    const t = (dot3(pl.n, pl.q) - dot3(pl.n, L)) / nv;
    return t > 0.9999 ? [[L[0] + v[0] * t, L[1] + v[1] * t, L[2] + v[2] * t], t] : null;
  }
  // where a ray of light meets the ground — the land as it rises and falls (spec.relief), level ground
  // at height 0 without — as rayHit: from a point L through C (t ≥ 1), or from far off along d back
  // through C (t ≥ 0) — [point, t], or null. Over the land: stepped down from C each time by as much as
  // its height over the land lets it fall without meeting the land, at the steepest the land rises
  // (landOf: steep) — far above, long steps; near, short ones, none shorter than RAY_MIN eye heights —
  // the step where it goes under halved down to a millimetre or so; none past RAY_REACH along or below
  // the land's lowest. A point a hair under the land (a foot on it) meets it there
  const RAY_MIN = 0.05, RAY_REACH = 120, RAY_STEPS = 2400;
  function groundHit(C, L, d) {
    if (!SHARED.ground) return rayHit({ q: [0, 0, 0], n: [0, 1, 0] }, C, L, d);
    const v = d ? d.map(x => -x) : [C[0] - L[0], C[1] - L[1], C[2] - L[2]], t0 = d ? 0 : 1;
    if (v[1] >= 0) return null;
    const at = t => (d ? [C[0] + v[0] * t, C[1] + v[1] * t, C[2] + v[2] * t] : [L[0] + v[0] * t, L[1] + v[1] * t, L[2] + v[2] * t]);
    const over = t => { const P = at(t); return P[1] - groundAt(P[0] * EYE, P[2] * EYE) / EYE; };
    let a = t0, fa = over(a);
    if (fa < -1e-3) return null;
    if (fa <= 0) return [at(a), a];
    // (how fast its height over the land can fall a unit of t: as it drops, and as the land rises
    // under it at the steepest)
    const land = landOf(SHARED.ground), vh = Math.hypot(v[0], v[2]), fall = -v[1] + land.steep * vh;
    const least = RAY_MIN / Math.hypot(v[0], v[1], v[2]), last = t0 + Math.min(RAY_REACH / vh, (at(t0)[1] - land.low) / -v[1]);
    for (let i = 0; i < RAY_STEPS && a < last; i++) {
      const b = a + Math.max(fa / fall, least), fb = over(b);
      if (fb <= 0) {
        let lo = a, hi = b;
        for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (over(m) > 0) lo = m; else hi = m; }
        return [at(hi), hi];
      }
      a = b; fa = fb;
    }
    return null;
  }
  // The land (a relief's height function, metres) as a ray goes over it: { steep: how much it rises
  // at most a unit across (eye heights, as `over` falls), low: its lowest (eye heights) } — found once
  // for each relief from its heights LAND_STEP metres apart over LAND_SPAN (metres across, ahead:
  // where a scene is), the steepest × 1.25 (between the samples it may rise a little more)
  const LAND_STEP = 1, LAND_SPAN = [[-200, 200], [-40, 400]], LANDS = new WeakMap();
  function landOf(fn) {
    let L = LANDS.get(fn);
    if (L) return L;
    const [[x0, x1], [z0, z1]] = LAND_SPAN, nx = Math.round((x1 - x0) / LAND_STEP) + 1, nz = Math.round((z1 - z0) / LAND_STEP) + 1;
    let steep = 0, low = Infinity, prev = null;
    for (let j = 0; j < nz; j++) {
      const row = new Float64Array(nx);
      for (let i = 0; i < nx; i++) {
        row[i] = fn(x0 + i * LAND_STEP, z0 + j * LAND_STEP);
        if (row[i] < low) low = row[i];
        if (i) steep = Math.max(steep, Math.abs(row[i] - row[i - 1]));
        if (prev) steep = Math.max(steep, Math.abs(row[i] - prev[i]));
      }
      prev = row;
    }
    L = { steep: 1.25 * steep / LAND_STEP, low: low / EYE - 1 };
    LANDS.set(fn, L);
    return L;
  }
  // `redraw`: the state keys a painting depends on — [keys], or { key: step } (repainted once the
  // value has moved a step) — repainted when they change, whatever else it reads. What they are now,
  // as a string to compare; null without it
  function redrawOf(o) {
    const r = o.redraw;
    if (r == null) return null;
    const steps = Array.isArray(r) ? Object.fromEntries(r.map(k => [k, 0])) : r && typeof r === 'object' ? r : null;
    if (!steps || Object.entries(steps).some(([k, v]) => typeof v !== 'number' || v < 0)) { warn(`${o.name || o.id}: "redraw" is [state keys] or { key: step }`); return null; }
    return JSON.stringify(Object.entries(steps).map(([k, step]) => {
      const v = STATE.values[k];
      return typeof v === 'number' && step > 0 ? Math.round(v / step) : v ?? null;
    }));
  }

  // What the scene's code shares (a world's module, the scene's lib) may give beforeFrame({ t, dt,
  // state, was, speed, cut, at }): called once a frame before anything is painted, whether it is
  // drawn or not, and once as the scene is shown, before its first painting — what it keeps from
  // frame to frame (the springs and steps of a figure, in or out of sight) goes on there, painting
  // only reads it. t, state, was, speed, cut — as an element's e has them (what works a figure out
  // from e works it out from these too); at(id, x, y, name?) marks element id's point (as its e.at:
  // metres from its anchor as painted) — this frame's, so the camera and the lines follow it on
  // frames nobody sees too. (those that have one, found once for what is shared: a scene with none
  // does nothing a frame)
  let befores = null, beforesOf = null, beforeState = null, beforeValues = null;
  const wasBefore = (key, ago = 0) => { keep(BEFORE, STATE.values, String(key)); return STATE.was(String(key), ago); };
  const speedBefore = key => { const a = wasBefore(key, 0), b = wasBefore(key, 0.05); return typeof a === 'number' && typeof b === 'number' ? (a - b) / 0.05 : 0; };
  const mark = (id, x, y, name) => {
    if (id == null || !Number.isFinite(x) || !Number.isFinite(y)) return;
    if (!MARKED.has(id)) MARKED.set(id, new Map());
    MARKED.get(id).set(name == null ? null : String(name), { x, y });
  };
  function beforeFrame(t, dt) {
    if (beforesOf !== SHARED) {
      beforesOf = SHARED;
      befores = [...Object.entries(SHARED.kit), ['lib', SHARED.lib]].filter(([, m]) => typeof m?.beforeFrame === 'function');
    }
    if (!befores.length) return;
    // (the state's values are a new object when they change: read through one made for them)
    if (beforeValues !== STATE.values) { beforeValues = STATE.values; beforeState = stateRead(BEFORE); }
    MARKED.clear();
    for (const [name, m] of befores) {
      try { m.beforeFrame({ t, dt, state: beforeState, was: wasBefore, speed: speedBefore, cut: STATE.cut, at: mark }); } catch (err) { warn(`${name === 'lib' ? 'lib' : `module ${name}`}: beforeFrame: ${err?.message || err}`); }
    }
  }

  // ── what each element costs ────────────────────────────────────────────
  // While the performance panel is open (key P): the time each element's painting takes a frame (ms,
  // summed by its name; in WebGL its upload too). And always its last painting's, with what it read
  // (`last`, by its id, else its name — one with neither isn't told apart): what ?debug and a
  // render's --json show.
  const PERF = {
    on: false, ms: new Map(), last: new Map(),
    // how many times each live element (one painted again as what it reads moves) was repainted since
    // the scene was shown, by its id (else its name)
    repaints: new Map(),
    repainted(o) { const k = keyOf(o); if (k != null) PERF.repaints.set(k, (PERF.repaints.get(k) || 0) + 1); },
    add(o, ms, upload = false) {
      if (!upload && keyOf(o) != null) PERF.last.set(keyOf(o), { ms, read: READS.get(o) });
      if (PERF.on) { const k = o.name || o.id || o.kind || '?'; PERF.ms.set(k, (PERF.ms.get(k) || 0) + ms); }
    },
  };

  // ── inserts ────────────────────────────────────────────────────────────
  // An insert (`insert`: the state key that opens it) is a shot of its own over the scene — the six
  // fingers seen close, a letter, a face: painted in the frame's own coordinates (stage heights, as
  // the sky is), fixed to the frame whatever the camera does, and seen through an iris that its key
  // opens, 0 (closed: the scene) … 1 (open). `iris`: [x, y, rx, ry] — the window fully open (stage
  // heights: its centre and radii, an oval); without it the iris opens from the middle of the frame
  // to all of it. The scene goes on under it; closing it is the way back.
  const IRIS_ALL = Math.hypot(WIDEST / 2, 0.5) + 0.05;
  function opening(o) {
    if (typeof o.insert === 'string') return clamp(Number(STATE.values[o.insert]) || 0, 0, 1);
    warn(`${o.name || o.id}: "insert" is the state key that opens it`);
    return 0;
  }
  // the insert's glows painted in (they don't shine past the iris), then all cut to the iris opened u:
  // on g, a canvas holding the insert alone, transformed to the W × H stage
  function iris(g, o, W, H, u, lights) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const l of lights) { const on = glowOn(l.id); glow(g, l.x, l.y, l.r, l.col, l.a * 0.6 * on); if (l.dot) glow(g, l.x, l.y, l.dot * 3, '255,245,220', 0.9 * on); }
    lights.length = 0;
    let win = o.iris;
    if (win !== undefined && !(Array.isArray(win) && win.length === 4 && win.every(v => typeof v === 'number') && win[2] > 0 && win[3] > 0)) {
      warn(`${o.name || o.id}: "iris" is [x, y, rx, ry] (stage heights, radii above 0)`);
      win = undefined;
    }
    const [cx, cy, rx, ry] = win || [W / H / 2, 0.5, IRIS_ALL, IRIS_ALL], r = Math.min(rx, ry) * u;
    // a soft edge, about 2% of the frame's height
    const soft = clamp(0.02 / r, 0.002, 0.5), reach = 2 * WIDEST / r + 2, gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(1 - soft, '#000'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'destination-in';
    g.translate(cx * H, cy * H); g.scale(rx * u * H, ry * u * H);
    g.fillStyle = gr; g.fillRect(-reach, -reach, 2 * reach, 2 * reach);
    g.restore();
  }

  // ── camera ─────────────────────────────────────────────────────────────
  // A multiplane camera, the way 2.5D games do it: every layer and object is a flat
  // cut-out standing at a real distance Z, seen through a perspective camera. Distances
  // come from the picture itself: the eye is 1 unit above flat ground and the horizon is
  // at screen height yh, so ground painted h (screen heights) below the horizon is 1/h
  // away. Sky, sun, moon and stars are at infinity: walking never moves them.
  // cam = { x: steps sideways, z: steps forward (world units, eye heights), y: gaze — down (+) / up (−) }.
  const Z_NEAR = 0.6, Z_FAR = 150; // in eye heights (1.7 m)
  const LAND = new Set(['mountains', 'hills', 'dunes', 'forest', 'city', 'water', 'ground']);
  const depthAt = (y, yh) => (y > yh + 0.0125 ? clamp(1 / (y - yh), Z_NEAR, Z_FAR) : Z_FAR);
  // The horizon is the base of the farthest landscape layer. Clouds and fog stand just
  // behind the next nearer landscape layer (or in front of the last one).
  // Typical heights (m) of what the scene may hold, and the viewer's eye height.
  const EYE = 1.7;
  const HEIGHT = { pine: 15, tree: 8, house: 6, tower: 18, lamp: 4, lantern: 2.2, campfire: 0.6, boat: 4, rock: 1, bench: 0.9, figure: 1.75, cat: 0.3, flower: 0.35, bridge: 3 };
  // The horizon is at eye level, so it crosses everything standing on the ground at 1.7 m:
  // a person at the eyes, a house low on its wall, a bench not at all. Each object painted
  // `size` tall at `y` suggests a horizon at y − size·EYE/height; the median of those is
  // the eye level of the scene (without objects: the base of the farthest landscape layer).
  function horizonOf(spec, host) {
    // (lanterns often hang in the air: they don't vote)
    const guesses = (spec.objects || []).filter(o => HEIGHT[o.kind] && o.kind !== 'lantern' && !host(o) && o.size > 0)
      .map(o => o.y - o.size * EYE / (o.kind === 'figure' && o.pose === 'sit' ? 1.2 : HEIGHT[o.kind]))
      .sort((a, b) => a - b);
    if (guesses.length) return clamp(guesses[guesses.length >> 1], 0.2, 0.95);
    const land = (spec.layers || []).filter(L => LAND.has(L.kind));
    return land.length ? Math.min(...land.map(L => L.y)) : 0.6;
  }
  // An element that moves through the world has `place`: its across, distance, elevation or x are the
  // names of numbers in the state (metres) — it is where they say now, the rest as the spec has it;
  // its facing and tilt (degrees) too: a surface turns about its anchor (a door on its hinge, a lid).
  const PLACE = ['across', 'distance', 'elevation', 'x', 'facing', 'tilt'];
  function placed(o) {
    const held = o.person && o.id != null && heldAt(String(o.id));
    if (!o.place && !held) return o;
    const n = { ...o };
    if (o.place) for (const f of PLACE) { const k = o.place[f]; if (typeof k === 'string' && typeof STATE.values[k] === 'number') n[f] = STATE.values[k]; }
    if (held) Object.assign(n, { across: held[0], elevation: held[1], distance: held[2], onLand: false });
    return n;
  }
  // a person on another's arms (<id>_on: "mother#hands" — a point of the other's, the hands by default; or {at, up}: as
  // much higher — lower, below 0 — than it, metres: a big child held by the waist, the arms round her back) — or sat on
  // a seat ([across, distance, elevation]: the top of a barrel, a wall, a high stool — the hips over it as high as a
  // pelvis sits, SEATED of a man's 1.76 m) — or on a thing (an element's point, "cart#bed", "boat": their floor there,
  // the hips over it — lying in a coffin, standing on a cart — going and turning with it): where they stand so that
  // their hips are there (as they were posed last), metres [across, up, distance]; null — on their feet
  const SEATED = 0.14;
  // how much of an arm's length a hand held in another's is out at most (the elbow a little bent)
  const REACHED = 0.97;
  const heldBy = on => (typeof on === 'string' && on ? { at: on, up: 0 } : Array.isArray(on) ? (on.length >= 2 && on.every(Number.isFinite) ? { seat: on } : null)
    : on && typeof on === 'object' && typeof on.at === 'string' ? { at: on.at, up: Number(on.up) || 0 } : null);
  function heldAt(id) {
    const on = heldBy(STATE.values[`${id}_on`]);
    if (!on) return null;
    const me = PEOPLE.get(id), off = me?.offset('hips') ?? [0, 0.5 * (me?.height ?? 1.7), 0];
    if (on.seat) return [on.seat[0] - off[0], (on.seat[2] ?? 0) + SEATED * (me?.height ?? 1.76) / 1.76 - off[1], on.seat[1] - off[2]];
    const [who, name] = on.at.split('#'), by = PEOPLE.get(who);
    if (!by) { const q = aimOf(on.at, id); return q && [q[0] - off[0], q[1] + on.up, q[2] - off[2]]; }
    const q = by.point(name || 'hands');
    if (!q) return null;
    return [q[0] - off[0], q[1] + on.up - off[1], q[2] - off[2]];
  }
  function depths(spec) {
    const layers = spec.layers || [];
    // An object stands where its base is — unless it is attached to a bigger one (a window on
    // a wall, a lantern on a porch): its base inside the other's outline. Then it shares that depth.
    const objs = spec.objects || [];
    const host = o => objs.find(h => h !== o && h.kind !== 'bird' && h.size > o.size &&
      Math.abs(o.x - h.x) * 16 / 9 < h.size * 0.6 && o.y > h.y - h.size && o.y < h.y + 0.01);
    // the director may set the eye level explicitly (spec.horizon); else it is estimated
    const yh = typeof spec.horizon === 'number' ? clamp(spec.horizon, 0.05, 0.95) : horizonOf(spec, host);
    const Z = layers.map(L => (LAND.has(L.kind) ? depthAt(L.y, yh) : null));
    for (let i = 0; i < Z.length; i++) {
      if (Z[i] !== null) continue;
      const next = Z.slice(i + 1).find(z => z !== null), prev = Z.slice(0, i).reverse().find(z => z !== null);
      Z[i] = next !== undefined ? next * 1.05 : prev !== undefined ? prev * 0.95 : Z_FAR;
    }
    // How far an object is: from how big it looks for what it is (a house painted 16% of
    // the screen tall is ~22 eye heights away) — robust, unlike the height of its base above
    // the horizon, which blows up for things painted near the horizon line.
    // And so everything agrees on the eye level, each ground-standing object's base is nudged
    // (usually 1–3% of the screen) to where, at that distance, it meets the ground:
    // yh + size·EYE/height. Attached things move with their host; hanging lanterns stay.
    const realH = o => (o.kind === 'figure' && o.pose === 'sit' ? 1.2 : HEIGHT[o.kind]);
    const own = o => (realH(o) && o.size > 0 ? clamp(realH(o) / EYE / o.size, Z_NEAR, Z_FAR) : depthAt(o.y, yh));
    const shift = o => {
      const h = host(o);
      if (h) return shift(h);
      return realH(o) && o.size > 0 && o.kind !== 'lantern' ? yh + o.size * EYE / realH(o) - o.y : 0;
    };
    // Custom elements say where they are: `distance` (m) or `y` (where they touch the ground),
    // plus `elevation` (m above the ground) and `height` (m); size on screen follows. It stands at
    // its real distance, however far — a range 8 km away looks 8 km away and stays where it is as the
    // camera flies toward it; only drawn against the landscape layers, it counts as no farther than
    // Z_FAR (world.js: orderOf), and holds the haze of Z_FAR at most (world.js: HAZE).
    const sightZ = o => (o.distance > 0 ? Math.max(Z_NEAR, o.distance / EYE) : depthAt(o.y, yh));
    const custom = o => o.kind === 'custom' || !o.kind;
    // across the view: `x` — where it is seen from the start, a fraction of the stage's width; or
    // `across` — metres to the right of the start's line of sight (left: negative); or, looking
    // around (around, roam), `bearing` — degrees from straight ahead (right: positive), with its
    // `distance`: such an element is painted as if straight ahead, and stood where it is
    const planeZ = o => (o.distance > 0 ? o.distance : 10) / EYE;
    const bearing = o => typeof o.bearing === 'number' && o.distance > 0 && !o.sky;
    const paintZ = o => (o.plane ? planeZ(o) : custom(o) ? sightZ(o) : own(host(o) || o));
    const objectX = o => (bearing(o) ? 0.5 : typeof o.across === 'number' && !o.sky ? 0.5 + o.across / EYE / STAGE / paintZ(o) : o.x ?? 0.5);
    // where it is over the land (metres: across, ahead) — for an element placed by its distance
    const spotOf = o => {
      if (bearing(o)) { const b = o.bearing * Math.PI / 180; return [o.distance * Math.sin(b), o.distance * Math.cos(b)]; }
      return [(objectX(o) - 0.5) * STAGE * sightZ(o) * EYE, o.distance];
    };
    // with a relief (spec.relief), what stands where its distance says stands on the ground there:
    // its elevation is above it — unless it is a picture of that land itself ("onLand": false: a bank painted on a
    // card, the stones on it, drawn in the land's own metres)
    const onLand = o => !!SHARED.ground && !o._carried && o.onLand !== false && custom(o) && o.distance > 0 && !o.sky && !o.ground && !o.insert && !o.plane;
    // the planes people walk on (`walk`: a bridge over a stream, a deck, a landing): where one lies over a point higher
    // than the land, people stand on it there — their footing (the land without such planes)
    const walks = objs.filter(o => o.plane && o.walk);
    const footing = (across, distance) => walks.reduce((h, o) => {
      const y = planeTop(planeOf(o, { placed: resolved, objectAt: q => objectAt(resolved(q)) }), across, distance);
      return y != null && y > h ? y : h;
    }, groundAt(across, distance));
    const landUnder = o => (o.person && walks.length && !o._carried && o.onLand !== false ? footing(...spotOf(o)) : onLand(o) ? groundAt(...spotOf(o)) : 0);
    const objectY = o => (o.sky || o.ground ? 0 : custom(o) ? yh + (1 - ((o.elevation || 0) + landUnder(o)) / EYE) / sightZ(o) : o.kind === 'bird' ? o.y : o.y + shift(o));
    const objectSize = o => (o.sky || o.ground ? 1 : custom(o) ? (o.height || 2) / EYE / sightZ(o) : o.size);
    // where it stands in the world (eye heights: X to the right, Z ahead, Y its anchor's height) and
    // the distance Zp it is painted for
    const objectAt = o => {
      const Zp = paintZ(o), Y = 1 - (objectY(o) - yh) * Zp;
      if (!bearing(o)) return { X: (objectX(o) - 0.5) * STAGE * Zp, Y, Z: Zp, Zp };
      const b = o.bearing * Math.PI / 180, d = o.distance / EYE;
      return { X: d * Math.sin(b), Y, Z: d * Math.cos(b), Zp };
    };
    // ground planes are drawn right after the sky, under everything standing on them
    // a horizontal plane (world.js) is ordered by its far edge, before what stands on it
    const objectZ = o => (o.sky ? Infinity : o.ground ? Z_FAR * 4 : o.plane ? clamp(planeZ(o) + (o.depth || 4) / 2 / EYE, Z_NEAR, Z_FAR) : custom(o) ? sightZ(o) : o.kind === 'bird' ? 30 : own(host(o) || o));
    // an element where it is now (its `place`), the one truth the renderers, the picking and
    // whatever follows it go by: { o: as painted on the stage (x, y, size: fractions of it; _at:
    // where it is in the world, metres — across, distance, its anchor's height and the ground's
    // under it), Z: the depth it is drawn at, at: where it stands in the world }
    // An element `on` another (its id) stands and turns with it: its across, distance, elevation (and
    // those its `place` gives) are metres from the other's anchor along the other's own axes (as if it
    // faced the start: across to its right, up, distance away behind its face; on a plane: across it,
    // up from its face, toward its far edge), and its own turn (facing, tilt; a plane's rotation, tilt)
    // is within the other's — the whole turn: a deck heeling heels what stands on it. One facing the
    // eye on something tilted leans with it, its face toward the start. A chain carries along (a lamp
    // on a mast on a ship); what it stands on puts it on the land, not the relief under it. → o as
    // placed in the world (placed(); _carried, _turn: its turn in the world), or as it is (no `on`, or
    // a wrong one: said)
    const byId = new Map(objs.filter(o => o.id != null).map(o => [String(o.id), o])), round = camSetup(spec).round;
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const unit = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
    // what an element carries stands in its frame: { r: across, up, ahead } (world unit vectors)
    const frameOf = P => {
      const t = turnOf(P);
      if (!t) return { r: [1, 0, 0], up: [0, 1, 0], ahead: [0, 0, 1] };
      const ax = axesOf(t);
      return P.plane ? { r: ax.r, up: ax.n, ahead: ax.u } : { r: ax.r, up: ax.u, ahead: ax.n.map(v => -v) };
    };
    // a turn by its axes, its yaw and lean as near as they say it (what changed, compared)
    const turned = ax => ({ yaw: Math.atan2(ax.r[2], -ax.r[0]) * 180 / Math.PI, lean: Math.asin(clamp(ax.n[1], -1, 1)) * 180 / Math.PI, ax });
    // (n: as placed, `self` the element itself; chain: what carries it so far)
    const carried = (n, chain = []) => {
      if (n.on == null) return n;
      const who = n.name || n.id, on = byId.get(String(n.on));
      if (!on) { warn(`${who}: "on" names the element it stands on — there is no element ${JSON.stringify(n.on)}`); return n; }
      if (on.sky || on.insert || on.ground) { warn(`${who}: "on" ${JSON.stringify(n.on)} — the sky, the ground or an insert carries nothing: an element standing in the scene, or a plane`); return n; }
      if (on === n.self || chain.includes(on)) { warn(`${who}: "on" goes round in a circle (${[...chain, n.self, on].map(o => o.id).join(' → ')})`); return n; }
      if (n.x != null || n.y != null || n.bearing != null) warn(`${who}: on "${n.on}" it stands by "across", "distance", "elevation" from its anchor — not "x", "y", "bearing"`);
      const P = carried({ ...placed(on), self: on }, [...chain, n.self]), A = objectAt(P), F = frameOf(P);
      const world = v => [0, 1, 2].map(i => F.r[i] * v[0] + F.up[i] * v[1] + F.ahead[i] * v[2]);
      const off = world([n.across || 0, n.elevation || 0, n.distance || 0]), X = A.X * EYE + off[0], Y = A.Y * EYE + off[1], Z = A.Z * EYE + off[2];
      // (_frame: what carries it — its parts are laid along it: part)
      const { x, y, bearing, self, ...rest } = n, out = { ...rest, ...worldAt(X, Y, Z), _carried: true, _frame: F }, own = turnOf(n);
      let turn = null;
      // (a person stands upright on what carries them as it heels — a deck rolling under their feet: where they stand is
      // carried, their card is not turned with it; they stand on it as on the land: stepPeople)
      if (n.person) turn = null;
      else if (own) { const L = axesOf(own); turn = turned({ r: world(L.r), u: world(L.u), n: world(L.n) }); }
      else if (Math.abs(F.up[1]) < 0.9999) {
        // facing the eye on something tilted: its up the other's, its face toward the start
        const v = unit([-X, EYE - Y, -Z]), k = v[0] * F.up[0] + v[1] * F.up[1] + v[2] * F.up[2], f = unit(v.map((c, i) => c - k * F.up[i]));
        turn = turned({ r: cross(f, F.up), u: F.up, n: f });
      }
      if (turn) {
        out._turn = turn;
        if (n.plane) Object.assign(out, { rotation: 180 - turn.yaw, tilt: 90 - turn.lean });
        else Object.assign(out, { facing: turn.yaw, tilt: turn.lean });
      }
      return out;
    };
    // a point of the world (metres: X across, Y up, Z ahead) as an element's place: across, distance,
    // elevation — looking around, by its bearing (what stands behind the start too)
    function worldAt(X, Y, Z) {
      return round ? { bearing: Math.atan2(X, Z) * 180 / Math.PI, distance: Math.max(0.01, Math.hypot(X, Z)), across: undefined, elevation: Y } : { across: X, distance: Z, elevation: Y };
    }
    // where an element is now: its place (placed), carried by what it stands on (carried)
    const resolved = o => { const { self, ...n } = carried({ ...placed(o), self: o }); return n; };
    // the frame its parts (e.part) are laid along: a card turned its own way (`facing`, `tilt` — within
    // what carries it, if anything does), its own — its parts lie as it does, turned with it; else
    // what carries it (`on`); null — they stand on the ground
    const partsFrame = (o, n) => (!o.plane && turnOf(placed(o)) ? frameOf(n) : n._frame || null);
    const now = o => {
      const n = resolved(o), at = objectAt(n), ground = landUnder(n), F = partsFrame(o, n);
      const _at = o.sky || o.ground || o.insert ? null : { across: at.X * EYE, distance: at.Z * EYE, elevation: at.Y * EYE, ground };
      return { o: { ...o, ...(n.facing !== o.facing && { facing: n.facing }), ...(n.tilt !== o.tilt && { tilt: n.tilt }), ...(n._turn && { _turn: n._turn }), ...(F && { _frame: F }), x: objectX(n), y: objectY(n), size: objectSize(n), _yh: yh, _at }, Z: objectZ(n), at };
    };
    // does it move with the state: its place, or what carries it moves — or it is someone (held by another, on a thing:
    // where they are is where that is)
    const moves = (o, chain = []) => !!o.place || !!o.person || (o.on != null && byId.has(String(o.on)) && !chain.includes(o) && moves(byId.get(String(o.on)), [...chain, o]));
    return {
      yh, Z, objectX, objectZ, now, moves, placed: resolved, footing: walks.length ? footing : null,
      objectAt: o => objectAt(resolved(o)),
      // part (dx, dz) of element o (e.part) as an element of its own: standing dx metres to the
      // right and dz farther than o's anchor, at o's elevation over the ground there, its box `box`
      // (o's without one) — where it is now, like now()
      // — or, o a card turned its own way, along its right and behind its face, lying as it does; on
      // another element (`on`), along what carries it: at its own height (partsFrame)
      part: (o, dx, dz, box) => {
        const n = resolved(o), at = objectAt(n), F = partsFrame(o, n);
        const { x, y, bearing, place, on, ...rest } = o;
        if (F) {
          const p = [0, 1, 2].map(i => [at.X, at.Y, at.Z][i] * EYE + dx * F.r[i] + dz * F.ahead[i]);
          return now({ ...rest, ...worldAt(...p), facing: n.facing, tilt: n.tilt, _turn: n._turn, box: box || o.box, _carried: true });
        }
        const elevation = at.Y * EYE - landUnder(n);
        return now({ ...rest, across: at.X * EYE + dx, distance: Math.max(0.05, at.Z * EYE + dz), elevation, box: box || o.box });
      },
    };
  }
  // ── in front, behind, cut by another ───────────────────────────────────
  // What is drawn in front of what is their depth — at equal depth the later in the spec's objects —
  // unless an element says: `behind: [ids]` — drawn behind those, `inFront: [ids]` — in front of
  // them, whatever the depths. The rules of a spec: [the one behind, the one in front] by id.
  // v: an id or a list of them, given as o's `key` — those naming other elements of the scene (ids:
  // what stands in it — an insert is over all of it, not among them)
  const idList = (v, o, key, ids) => {
    if (v === undefined) return [];
    const list = typeof v === 'string' ? [v] : Array.isArray(v) ? v : null;
    if (!list) { warn(`${o.name || o.id}: "${key}" is a list of element ids`); return []; }
    return list.filter(id => {
      if (ids.has(id) && id !== o.id) return true;
      warn(`${o.name || o.id}: "${key}" names "${id}" — not another element standing in the scene (an insert is over all of it)`);
      return false;
    });
  };
  function orderRules(spec) {
    const objs = spec.objects || [], ids = new Set(objs.filter(o => !o.insert).map(o => o.id).filter(id => id != null)), rules = [];
    for (const o of objs) {
      if (o.insert && (o.behind || o.inFront || o.clip)) warn(`${o.name || o.id}: an insert is over the whole scene — "behind", "inFront" and "clip" are for what stands in it`);
      if (o.id == null || o.insert) continue;
      for (const id of idList(o.behind, o, 'behind', ids)) rules.push([o.id, id]);
      for (const id of idList(o.inFront, o, 'inFront', ids)) rules.push([id, o.id]);
    }
    return rules;
  }
  // list (far to near) with the rules kept: what is to be behind moved to just before the first
  // drawing of what it is behind (an element drawn in parts: all of them). idOf(item) → its element's id
  function arrange(list, rules, idOf) {
    for (let pass = 0; pass <= rules.length; pass++) {
      let moved = false;
      for (const [far, near] of rules) {
        const first = list.findIndex(it => idOf(it) === near), late = [];
        if (first < 0) continue;
        for (let i = list.length - 1; i > first; i--) if (idOf(list[i]) === far) late.unshift(...list.splice(i, 1));
        if (late.length) { list.splice(first, 0, ...late); moved = true; }
      }
      if (!moved) return list;
    }
    warn('behind / inFront: elements put each in front of the other, round in a circle');
    return list;
  }
  // `clip`: an element seen only within what other elements paint — {inside: ids} (a figure in a
  // doorway, a face in a window) — or only out of it — {outside: ids} (under a table top, below
  // water) — as they are in the frame now. An element with `unseen: true` is not shown itself: a
  // shape others are cut by. → { inside: true | false, ids } or null
  function clipOf(o, ids) {
    const c = o.clip;
    if (c == null) return null;
    const side = c && typeof c === 'object' && !Array.isArray(c) ? ['inside', 'outside'].find(k => k in c) : null;
    if (!side) { warn(`${o.name || o.id}: "clip" is {inside: ids} or {outside: ids}`); return null; }
    const list = idList(c[side], o, `clip.${side}`, ids);
    return list.length ? { inside: side === 'inside', ids: list } : null;
  }
  // ── flat pieces of the world ───────────────────────────────────────────
  // A plane (`plane`: a floor, a deck, a table top; the land, draped over the relief) where it lies:
  // { Xc, Y, Zc: its centre (eye heights), w, d: across and away, cos, sin: its turn, drape, mirror,
  // pool } — mirror: what it reflects (mirrorOf), pool: how much the scene's lights lie on it unlit (lit)
  // The way a surface lies — a card turned its own way (`facing`, `tilt`) or a plane — one turn for
  // all: { yaw, lean } (degrees; yaw: where its face looks, 0 ahead, 180 toward the start; lean: tilted
  // back from upright, 0 a card standing, 90 lying face up), null for a card facing the eye. A plane is
  // a surface lying: its `rotation` turns it about the vertical, its `tilt` raises its far edge. (What
  // turns it more — what it stands on — adds its own to these.)
  // (what makes a mess of it is said, once: a plane stood upright is a card, a card laid down a plane)
  // where an element is turned about the vertical (degrees: 180 — as one facing the start, a plane as laid): what is
  // on it turns with it
  const yawOf = o => turnOf(o)?.yaw ?? 180;
  function turnOf(o) {
    if (o._turn) return o._turn;
    const who = o.name || o.id, bad = k => o[k] != null && !Number.isFinite(o[k]) && warn(`${who}: "${k}" is degrees, a number`);
    bad('tilt'); bad('facing');
    const tilt = Number.isFinite(o.tilt) ? o.tilt : 0;
    if (o.plane) {
      if (o.facing != null) warn(`${who}: a plane turns by "rotation" (and "tilt"), not "facing"`);
      // (a mirror stands upright as well as it lies: a plane, its glass painted from before it)
      if (Math.abs(tilt) >= 80 && !o.reflect) warn(`${who}: a plane tilted ${tilt}° stands nearly upright — a wall, a door is a card ("facing", "tilt" from upright); a mirror on a wall is a plane ("reflect")`);
      return { yaw: 180 - (o.rotation || 0), lean: 90 - tilt };
    }
    if (!Number.isFinite(o.facing) && !Number.isFinite(o.tilt)) return null;
    if (Math.abs(tilt) > 90) warn(`${who}: "tilt" ${tilt}° lays it face down — a card leans from upright, −90…90; what lies flat is a plane`);
    return { yaw: Number.isFinite(o.facing) ? o.facing : 180, lean: tilt };
  }
  // [cos, sin] of a — exact at the right angles (a plane lies truly level)
  const cosSin = a => { const r = ((a % 360) + 360) % 360; return r === 0 ? [1, 0] : r === 90 ? [0, 1] : r === 180 ? [-1, 0] : r === 270 ? [0, -1] : [Math.cos(a * Math.PI / 180), Math.sin(a * Math.PI / 180)]; };
  // a turn's axes in the world: r — its painting's right, u — its up (a plane's far edge), n — its face
  // (a turn composed of others, `on`: the axes it has, ax)
  function axesOf({ yaw, lean, ax }) {
    if (ax) return ax;
    const [c, s] = cosSin(yaw), [cl, sl] = cosSin(lean);
    return { r: [-c, 0, s], u: [-s * sl, cl, -c * sl], n: [s * cl, sl, c * cl] };
  }
  // A card turned its own way (turnOf) where it is now (n: depths().now of it — its painting placed on
  // the W·STAGE-wide stage — and its turn): the world point (eye heights) of its painted point (x, y:
  // the stage's px)
  function cardWorldOf(n, turn, H) {
    const p = n.at, k = p.Zp / H, ax = n.o.x * STAGE * H, ay = n.o.y * H, { r, u } = axesOf(turn);
    return (x, y) => { const a = (x - ax) * k, b = (y - ay) * k; return [p.X + r[0] * a - u[0] * b, p.Y + r[1] * a - u[1] * b, p.Z + r[2] * a - u[2] * b]; };
  }
  // ... and the other way: its painted point under the frame's point (x, y) seen from cam — [x, y on
  // the stage, how many frame px a painted px is there, its depth along the gaze], or null (behind the
  // eye, or seen edge on)
  function cardUnder(n, turn, cam, x, y, W, H, yh) {
    const c = Math.cos(cam.yaw || 0), s = Math.sin(cam.yaw || 0), dx = (x - W / 2) / H, dy = -(y + cam.y * H - yh * H) / H;
    const d = [dx * c + s, dy, -dx * s + c], E = [cam.x, cam.h ?? 1, cam.z], p = n.at, { r, u, n: nn } = axesOf(turn);
    const dn = d[0] * nn[0] + d[1] * nn[1] + d[2] * nn[2];
    if (Math.abs(dn) < 1e-6) return null;
    const t = ((p.X - E[0]) * nn[0] + (p.Y - E[1]) * nn[1] + (p.Z - E[2]) * nn[2]) / dn;
    if (t < 0.05) return null;
    const q = [E[0] + d[0] * t - p.X, E[1] + d[1] * t - p.Y, E[2] + d[2] * t - p.Z], k = H / p.Zp;
    return [n.o.x * STAGE * H + (q[0] * r[0] + q[1] * r[1] + q[2] * r[2]) * k, n.o.y * H - (q[0] * u[0] + q[1] * u[1] + q[2] * u[2]) * k, p.Zp / t, t];
  }
  function planeOf(o0, dz) {
    const o = dz.placed(o0), at = dz.objectAt(o0), rot = (o.rotation || 0) * Math.PI / 180, w = Math.max(0.05, o.width || 4) / EYE, d = Math.max(0.05, o.depth || 4) / EYE;
    const turn = turnOf(o), ax = axesOf(turn), Y = (o.elevation || 0) / EYE;
    // the point u across, v toward the viewer from its middle (eye heights), in the world
    const on = (u, v) => [at.X + ax.r[0] * u - ax.u[0] * v, Y + ax.r[1] * u - ax.u[1] * v, at.Z + ax.r[2] * u - ax.u[2] * v];
    // (far: its far edge ahead — looking ahead, it is drawn as far as that, before what stands on it)
    const far = Math.max(...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => on(a * w / 2, b * d / 2)[2]));
    return { Xc: at.X, Y, Zc: at.Z, w, d, cos: Math.cos(rot), sin: Math.sin(rot), turn, ax, on, far, drape: !!o.drape, mirror: mirrorOf(o), pool: poolOf(o), travel: travelOf(o) };
  }
  // how high a plane (planeOf) lies over a point of the world (metres across, ahead) — metres; null where the point is
  // not under it, or the plane stands near upright (no floor)
  function planeTop(P, across, distance) {
    const n = P.ax.n, X = across / EYE, Z = distance / EYE;
    if (Math.abs(n[1]) < 0.2) return null;
    const Y = P.Y - (n[0] * (X - P.Xc) + n[2] * (Z - P.Zc)) / n[1], q = [X - P.Xc, Y - P.Y, Z - P.Zc];
    const u = q[0] * P.ax.r[0] + q[1] * P.ax.r[1] + q[2] * P.ax.r[2], v = -(q[0] * P.ax.u[0] + q[1] * P.ax.u[1] + q[2] * P.ax.u[2]);
    return Math.abs(u) <= P.w / 2 && Math.abs(v) <= P.d / 2 ? Y * EYE : null;
  }
  // `travel` on a plane: { across, distance } — state keys, metres the viewer has gone over its painting
  // (a train's way, a road driven): the plane stays, its painting passes under it, endless (planeShift)
  function travelOf(o) {
    const t = o.travel;
    if (t == null) return null;
    const ok = typeof t === 'object' && !Array.isArray(t) && Object.keys(t).every(k => (k === 'across' || k === 'distance') && typeof t[k] === 'string') && Object.keys(t).length;
    if (ok && !o.drape) return { across: t.across, distance: t.distance };
    warn(`${o.name || o.id}: "travel" on a plane is { "across": state key, "distance": state key } — metres gone over its painting${o.drape ? ' (not on a draped plane)' : ''}`);
    return null;
  }
  // What is laid wrong for the scene's own camera, as it starts (said once, as the scene is shown):
  // the ground ending short of the horizon, the sky showing through under it — when nothing farther
  // covers that strip all across
  function lookOver(spec, dz) {
    const objs = spec.objects || [], cam = camSetup(spec), h = cam.h + (Number(STATE.values.camera_h) || 0) / EYE;
    const planes = objs.filter(o => o.plane && !o.unseen && !o.insert).map(o => ({ o, P: planeOf(o, dz) }));
    if (cam.round || spec.relief || objs.some(o => o.ground) || (spec.layers || []).some(L => LAND.has(L.kind))) return;
    const ground = planes.filter(({ o, P }) => !o.tilt && Math.abs(P.Y) < 0.2 / EYE);
    if (!ground.length) return;
    const far = Math.max(...ground.map(({ P }) => P.far)), yh = dz.yh, edge = yh + h / far;
    // what stands far off all across, from over the horizon down to the ground's far edge
    const covers = objs.some(o => {
      if (o.plane || o.sky || !(o.distance > 0) || !Array.isArray(o.box)) return false;
      const Z = o.distance / EYE, low = ((o.elevation || 0) - o.box[3]) / EYE, top = ((o.elevation || 0) - o.box[1]) / EYE;
      return yh + (h - low) / Z >= edge && top > h && (o.box[2] - o.box[0]) / EYE >= STAGE * Z;
    });
    if (!covers && (edge - yh) * 1000 > 2) warn(`${ground.find(g => g.P.far === far).o.name || 'the ground'}: the ground ends ${Math.round(far * EYE)} m away — under the horizon beyond it the sky shows, a light strip: lay the ground farther, or what stands far off down over its edge`);
  }
  // A plane that reflects (`reflect`: a polished floor, still water, a wet roof, a deck heeling over):
  // all that is before its face is seen in it as in a mirror — { strength: how much (0.35), fade: metres above the plane over which what it
  // mirrors fades out (4; 0: never), blur: how much the mirrored spreads per metre above it (0.05),
  // rough: 0…1 how much it is stretched down and up (0: a mirror; water under a breeze, wet stone:
  // a light, the moon draw a long path), ripple: 0…1 how much small waves going over it break it };
  // true, or a number: the strength. → { strength, fade (eye heights), blur, rough, ripple } or null
  // (what is wrong, said)
  function mirrorOf(o) {
    const r = o.reflect;
    if (!r) return null;
    const c = r === true ? {} : typeof r === 'number' ? { strength: r } : typeof r === 'object' && !Array.isArray(r) ? r : null;
    if (!c || [c.strength, c.fade, c.blur, c.rough, c.ripple].some(v => v != null && !(typeof v === 'number' && v >= 0))) { warn(`${o.name || o.id}: "reflect" on a plane is true, a strength 0…1 or { "strength", "fade" (metres), "blur", "rough" 0…1, "ripple" 0…1 }`); return null; }
    return { strength: clamp(c.strength ?? 0.35, 0, 1), fade: (c.fade ?? 4) / EYE, blur: c.blur ?? 0.05, rough: clamp(c.rough ?? 0, 0, 1), ripple: clamp(c.ripple ?? 0, 0, 1) };
  }
  // An upright pane of glass (`glass` on an element: a window at night, a train's window, a shop
  // window): what it paints is where the glass is — the element itself is not shown — and in it, faintly,
  // what is on the viewer's side of it, mirrored: the room, lit as it is, its lamps. It shows where it is
  // dark beyond the glass and light before it (at night; by day hardly) — { strength: how much (0.25),
  // blur: how much the mirrored spreads per metre it is from the glass (0.03) }; true, or a number: the
  // strength. WebGL only. → { strength, blur } or null (what is wrong, said)
  function glassOf(o) {
    const r = o.glass;
    if (r == null || r === false) return null;
    const c = r === true ? {} : typeof r === 'number' ? { strength: r } : typeof r === 'object' && !Array.isArray(r) ? r : null;
    if (!c || o.plane || o.sky || [c.strength, c.blur].some(v => v != null && !(typeof v === 'number' && v >= 0))) { warn(`${o.name || o.id}: "glass" is on an upright element: true, a strength 0…1 or { "strength", "blur" }`); return null; }
    return { strength: clamp(c.strength ?? 0.25, 0, 1), blur: c.blur ?? 0.03 };
  }
  // `lit` on a plane: the scene's point lights lie on it where the scene is not lit (lookOf) — a pool
  // under a lamp, a fire's glow on the floor; true, or how strongly (1). → 0…
  // `translucent` on something thin — a sail, a leaf, paper, a curtain: how much of the light behind it
  // comes through, 0…1 (lit from behind it glows its colour, that much; its shadow lets as much through).
  // The engine cannot tell a sheet from a wall painted flat: both are a card. → 0…1
  function translucentOf(o) {
    if (o.translucent == null) return 0;
    if (typeof o.translucent === 'number' && o.translucent >= 0 && o.translucent <= 1) return o.translucent;
    warn(`${o.name || o.id}: "translucent" is how much of the light behind it comes through, 0…1`);
    return 0;
  }
  function poolOf(o) {
    if (o.lit == null || o.lit === false) return 0;
    if (o.lit === true) return 1;
    if (typeof o.lit === 'number' && o.lit >= 0) return o.lit;
    warn(`${o.name || o.id}: "lit" on a plane is true or a strength (1)`);
    return 0;
  }
  // is world point A ({ X, Y, Z }, eye heights) on a reflecting plane of `planes` (planeOf's) — before its
  // face, over it? — what stands on it is mirrored in it (its own `reflect` copy is not drawn)
  const overMirror = (planes, A) => !!A && planes.some(P => {
    if (!P.mirror) return false;
    const { r, u, n } = P.ax, d = [A.X - P.Xc, A.Y - P.Y, A.Z - P.Zc], dot = v => d[0] * v[0] + d[1] * v[1] + d[2] * v[2];
    return dot(n) >= -0.01 && Math.abs(dot(r)) <= P.w / 2 && Math.abs(dot(u)) <= P.d / 2;
  });
  // the point (f, g) of a plane's painting (both 0…1: across, and from its far edge toward the viewer)
  // in the world, eye heights — a draped one over the land there
  const onPlane = P => (f, g) => {
    const q = P.on(-P.w / 2 + P.w * f, -P.d / 2 + P.d * g);
    if (P.drape) q[1] += groundAt(q[0] * EYE, q[2] * EYE) / EYE;
    return q;
  };
  // A tile of a plane's painting (its whole: `base` px on its long side): of level L ≥ 1, PLANE_TILE px square and 2^L
  // times finer than the whole (2·base/PLANE_TILE of level 1 along the long side, each the 2 × 2 of the next level);
  // a plane its painting travels over (`travel`: planeShift) is an endless painting, tiled on. → { L, i, j, f0, g0,
  // f1, g1: its part of the painting (0…1 the plane's own, from the start) }
  const PLANE_TILE = 512;
  function planeTile(P, base, L, i, j) {
    const s = Math.max(P.w, P.d) * PLANE_TILE / base / 2 ** L, end = P.travel ? Infinity : 1;
    return { L, i, j, f0: i * s / P.w, g0: j * s / P.d, f1: Math.min(end, (i + 1) * s / P.w), g1: Math.min(end, (j + 1) * s / P.d) };
  }
  // How far a plane's painting has travelled under it (`travel`: { across, distance } — the names of
  // state keys, metres the viewer has gone to the right and ahead over it): [f, g], its own fractions
  // (what is painted at f + sf is seen at f) — [0, 0] for one that does not travel
  function planeShift(P) {
    const tr = P.travel;
    if (!tr) return [0, 0];
    const v = k => { if (k == null) return 0; STATE.read.add(k); const x = STATE.values[k]; return typeof x === 'number' && Number.isFinite(x) ? x / EYE : 0; };
    return [v(tr.across) / P.w, -v(tr.distance) / P.d];
  }
  // the land's normal at (X, Z) (eye heights): as the relief slopes there — up where it is level
  const SLOPE_STEP = 0.05;
  function groundNormal(X, Z) {
    if (!SHARED.ground) return [0, 1, 0];
    const e = SLOPE_STEP, y = (x, z) => groundAt(x * EYE, z * EYE) / EYE, gx = (y(X + e, Z) - y(X - e, Z)) / (2 * e), gz = (y(X, Z + e) - y(X, Z - e)) / (2 * e), l = Math.hypot(gx, 1, gz);
    return [-gx / l, 1 / l, -gz / l];
  }

  // Screen transform [a b c d e f] for a plane at distance Z (Infinity = the sky): maps the
  // scene as painted from the starting spot (on the stage) to the frame (W × H) from where the
  // camera is now.
  // Walking forward grows a plane by Z/(Z−z) around the vanishing point on the horizon.
  // A camera raised to cam.h eye heights (1 = standing) sees a plane (h − 1)/D lower: things
  // stay upright, the ground opens up below — a raised camera with a shifted, not tilted, lens.
  // A film's camera turned ahead (camera_yaw outside around, roam: cam.pan, the turn in radians) pans
  // what is painted on the stage, a screen height a radian — a backdrop round the start.
  function view(cam, Z, W, H, yh) {
    const pan = (cam.pan || 0) * H;
    if (!isFinite(Z)) return [1, 0, 0, 1, (W - STAGE * H) / 2 - pan, -cam.y * H];
    const D = Math.max(1e-3, Z - cam.z), s = Z / D;
    return [s, 0, 0, s, (W - s * STAGE * H) / 2 - H * cam.x / D - pan, yh * H * (1 - s) - cam.y * H + H * ((cam.h ?? 1) - 1) / D];
  }
  // A film's camera tipped (camera_roll: cam.roll radians, to the right): the picture as drawn turned
  // about the frame's middle the other way — the horizon rising to the right — and brought that much
  // closer that it still fills the canvas (CW × CH around the frame W × H, in the same units), as a
  // tilted shot is cropped. → { m: frame px as drawn → as seen, cos, sin, s }, or null (not tipped)
  function rollOf(r, W, H, CW = W, CH = H) {
    if (!r) return null;
    const c = Math.cos(r), sn = Math.sin(r), ac = Math.abs(c), as = Math.abs(sn), a = CW / 2, b = CH / 2;
    const s = Math.max((a * ac + b * as) / a, (a * as + b * ac) / b), x = W / 2, y = H / 2;
    const m = [s * c, -s * sn, s * sn, s * c];
    return { m: [...m, x - m[0] * x - m[2] * y, y - m[1] * x - m[3] * y], cos: c, sin: sn, s };
  }
  // the inverse of an affine m [a b c d e f]
  const invert = m => { const d = m[0] * m[3] - m[1] * m[2]; return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d]; };
  // Looking around (around, roam): the camera also turns, cam.yaw radians (clockwise, 0 = the
  // start's straight ahead). A point of the world (X, Y, Z eye heights) is seen at
  // [x, y, its depth along the gaze], or null behind the eye. With yaw 0 it is what view() does.
  function project(cam, X, Y, Z, W, H, yh) {
    const rx = X - cam.x, rz = Z - cam.z, c = Math.cos(cam.yaw || 0), s = Math.sin(cam.yaw || 0);
    const x = rx * c - rz * s, z = rx * s + rz * c;
    if (z < 0.05) return null;
    return [W / 2 + H * x / z, yh * H + H * ((cam.h ?? 1) - Y) / z - cam.y * H, z];
  }
  // An element as a card facing the eye: p = { X, Y, Z, Zp } and its anchor as painted (ax, ay):
  // { m: screen transform of its painting, D: its depth }, or null when behind the eye
  function billboard(cam, p, ax, ay, W, H, yh) {
    const q = project(cam, p.X, p.Y, p.Z, W, H, yh);
    if (!q) return null;
    const s = p.Zp / q[2];
    return { m: [s, 0, 0, s, q[0] - s * ax, q[1] - s * ay], D: q[2] };
  }
  // Where an element's painting (as depths() places it on the SW-wide stage) goes on the frame from
  // camera cam, where it is now: { m: the transform, D: its distance along the gaze }, or null behind the eye
  function placeOf(o, cam, W, H, dz, round) { return seenOf(cam, dz.now(o), W, H, dz.yh, round); }
  // where something standing — n: { o, at, Z }, a now() of it (depths: the element, or a part of it) —
  // is seen from cam: { m, D }, or null (behind the eye, looking around)
  function seenOf(cam, n, W, H, yh, round) {
    if (away(n.o)) return null;
    return round || (cam.pan && !n.o.sky && !n.o.ground) ? billboard(cam, n.at, n.o.x * STAGE * H, n.o.y * H, W, H, yh) : { m: view(cam, n.Z, W, H, yh), D: n.Z - cam.z };
  }
  // The hero of a platformer h = { dx, dy (metres from where it is painted), flip } as a transform
  // of its painting: its anchor painted at x = ax, `ppm` painted px per metre
  const heroMatrix = (h, ax, ppm) => [h.flip ? -1 : 1, 0, 0, 1, (h.flip ? 2 * ax : 0) + h.dx * ppm, -h.dy * ppm];
  // (2D) affine m after n: [a b c d e f] each
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  // The full circle of the sky looking around: painted 2π stage heights wide, straight ahead in
  // its middle; seen through the frame as a cylinder.
  const TAU = 2 * Math.PI;
  // Where you may walk and look (limitCam). Walking forward: as far as the things standing in the
  // scene (not the far ones, Z_FAR or farther — painted mountains, flat up close).
  // An object painted at stage x, Z away, stands at world x = (x − ½)·STAGE·Z (+ its box centre).
  const LOOK_UP = -0.3, LOOK_DOWN = 0.2, WALK_BACK = -0.6, TRACK = 40 / EYE, ROOM = 30 / EYE;
  // The scene's camera (spec.camera) — how the viewer moves through it, one of:
  //   picture — a still picture: the camera stands, breathes a little and leans toward the
  //     pointer (or the phone's tilt), so the near things shift against the far ones;
  //   walk — stand at eye level and walk: forward and back, sideways, look up and down (default);
  //   panorama — a long place passed along sideways (a park alley, a street, a shore): along it
  //     as far as `span` [left, right] metres from the start, else as far as the things within
  //     TRACK of the viewer reach; the wheel comes closer as when walking, and closer you still
  //     pass along at that depth;
  //   overhead — raised `height` metres and looking down (`look`, screen heights): a map, a yard,
  //     a board; moving over it and closer;
  //   around — stand at one spot and turn your head all around (or within `turn` degrees either
  //     way) and up and down: things stand all around you (`bearing`);
  //   roam — walk about a place and look anywhere, as in a room: within `area` [left, right,
  //     back, front] metres of the start, else among the things standing around;
  //   platform — a platformer seen from the side: you run and jump as the `hero` element over
  //     the `solid` ones, the camera riding along (the mount's platform section).
  // Looking around, elements are cards standing up in the world, facing the eye — or, with
  // `facing` (degrees: where its face looks), turned their own way, like a wall or a cupboard.
  // `follow`: elements the camera keeps in view — it slides sideways when one is leaving the
  // visible part of the screen (not while the viewer moves it themselves).
  const MODES = ['picture', 'walk', 'panorama', 'overhead', 'around', 'roam', 'platform'];
  const SWAY = { picture: 0.033 };
  function camSetup(spec) {
    const c = spec?.camera || {}, mode = MODES.includes(c.mode) ? c.mode : 'walk';
    const h = mode === 'overhead' ? clamp((c.height ?? 8) / EYE, 1, 60) : 1;
    const look = clamp(c.look ?? (mode === 'overhead' ? 0.25 : 0), -0.3, 0.45);
    const follow = Array.isArray(c.follow) ? c.follow.filter(id => typeof id === 'string') : [];
    const span = mode === 'panorama' && Array.isArray(c.span) && c.span.length === 2 ? [-Math.abs(c.span[0]) / EYE, Math.abs(c.span[1]) / EYE] : null;
    const round = mode === 'around' || mode === 'roam';
    const turn = mode === 'around' && typeof c.turn === 'number' && c.turn > 0 && c.turn < 180 ? c.turn * Math.PI / 180 : null;
    const area = ['roam', 'walk', 'overhead'].includes(mode) && Array.isArray(c.area) && c.area.length === 4 ? c.area.map(v => Math.abs(v) / EYE) : null;
    const hero = mode === 'platform' && typeof c.hero === 'string' ? c.hero : null;
    return { mode, h, look, follow: round || hero ? [] : follow, sway: SWAY[mode] || 0, span, round, turn, area, hero, jump: c.jump };
  }
  function limits(spec, W, H) {
    const { Z, objectZ, objectX } = depths(spec), aspect = W / H;
    const land = (spec.layers || []).map((L, i) => (LAND.has(L.kind) ? Z[i] : null)).filter(z => z !== null);
    const things = (spec.objects || []).filter(o => o.kind !== 'bird' && !o.sky && !o.ground && !o.plane && !o.insert).map(o => {
      const z = objectZ(o), b = Array.isArray(o.box) && o.box.length === 4 ? (o.box[0] + o.box[2]) / 2 / EYE : 0;
      return { x: (objectX(o) - 0.5) * STAGE * z + b, z };
    });
    // what stands in the scene shapes where you may go — not what is as far as Z_FAR or farther
    const real = things.filter(t => t.z < Z_FAR * 0.99), around = real.length ? real : things;
    const far = around.length ? Math.max(...around.map(t => t.z)) : Math.max(1, ...land.filter(z => z < Z_FAR * 0.9));
    const setup = camSetup(spec);
    // roaming: within the area, else among the things standing within ROOM of the start, a
    // little inside them
    let room = null;
    if (setup.mode === 'roam') {
      if (setup.area) { const [l, r, b, f] = setup.area; room = [-l, r, -b, f]; }
      else {
        const dz = depths(spec), at = (spec.objects || []).filter(o => !o.sky && !o.ground && !o.insert && o.kind !== 'bird').map(o => dz.objectAt(o)).filter(p => Math.hypot(p.X, p.Z) <= ROOM);
        const xs = [0, ...at.map(p => p.X)], zs = [0, ...at.map(p => p.Z)], k = 1 / EYE;
        room = [Math.min(0, Math.min(...xs) + k), Math.max(0, Math.max(...xs) - k), Math.min(0, Math.min(...zs) + k), Math.max(0, Math.max(...zs) - k)];
      }
    }
    return { aspect, things: around, zMax: clamp(far - 1.1, 1, 100), setup, room };
  }
  function limitCam(cam, lim) {
    const s = lim.setup;
    if (s?.round) {
      cam.y = clamp(cam.y, s.look - 0.6, s.look + 0.6);
      if (s.turn) cam.yaw = clamp(cam.yaw, -s.turn, s.turn);
      if (lim.room) { cam.x = clamp(cam.x, lim.room[0], lim.room[1]); cam.z = clamp(cam.z, lim.room[2], lim.room[3]); }
      else { cam.x = 0; cam.z = 0; }
      return;
    }
    if (s?.sway) { // stays put: only the small sway
      cam.x = clamp(cam.x, -s.sway, s.sway); cam.z = 0; cam.y = clamp(cam.y, s.look - s.sway / 3, s.look + s.sway / 3);
      return;
    }
    if (s?.mode === 'platform') { // the camera rides along with the hero (the mount), over the level
      cam.z = 0;
      cam.y = clamp(cam.y, s.look - 0.8, s.look + 0.15);
      if (lim.level) cam.x = clamp(cam.x, lim.level[0], lim.level[1]);
      return;
    }
    if (s?.mode === 'panorama') {
      cam.z = clamp(cam.z, 0, Math.max(lim.zMax, lim.reach ?? -Infinity));
      cam.y = clamp(cam.y, s.look + LOOK_UP / 2, s.look + LOOK_DOWN / 2);
      let lo = 0, hi = 0;
      if (s.span) [lo, hi] = s.span;
      else {
        // as far as the nearest things reach: the outermost one may come to the frame's middle
        const near = lim.things.filter(t => t.z <= TRACK);
        if (near.length) { lo = Math.min(0, ...near.map(t => t.x)); hi = Math.max(0, ...near.map(t => t.x)); }
      }
      // the whole camera within it — camera_x (the scene's own, or a game's: a look along it begun elsewhere) and the
      // viewer's moves on top of it together
      const off = typeof STATE.values.camera_x === 'number' ? STATE.values.camera_x / EYE : 0;
      cam.x = clamp(cam.x, lo - off, hi - off);
      return;
    }
    cam.y = clamp(cam.y, (s?.look ?? 0) + LOOK_UP, (s?.look ?? 0) + LOOK_DOWN);
    // Where you may stand: what is seen from the back of the bounds — a triangle as wide as the
    // frame (a camera inside it sees only what lies inside it too, so walking toward anything you
    // see never leaves it), within the scene's area when it gives one; forward as far as the
    // things in the scene, or as far as the wheel took you toward one. Walking, the start is the
    // back: the farthest you can draw back, and no stepping aside there — only coming closer.
    let zb = s?.mode === 'walk' ? 0 : WALK_BACK, zf = Math.max(lim.zMax, lim.reach ?? -Infinity), lo = -Infinity, hi = Infinity;
    if (s?.area) { const [l, r, b, f] = s.area; zb = -b; zf = f; lo = -l; hi = r; }
    cam.z = clamp(cam.z, zb, zf);
    const hw = Math.max(0, cam.z - zb) * lim.aspect / 2;
    cam.x = clamp(cam.x, Math.max(lo, -hw), Math.min(hi, hw));
  }
  // Near things: an element D away along the gaze (eye heights) fades over the last steps before
  // the eye — from PASS_TO (60 cm) to PASS_FROM (20 cm), as you walk through a curtain of leaves: a
  // painted card is not to pass the eye magnified many times over. Nearer than that, and behind the
  // eye, it is not drawn. One beside the way (a post, a figure a metre aside) slides out of the frame
  // whole before it comes so near.
  const PASS_FROM = 0.12, PASS_TO = 0.35;
  const nearFade = D => clamp((D - PASS_FROM) / (PASS_TO - PASS_FROM), 0, 1);

  // Mounts the engine on a canvas: returns { show(spec), resetCamera() }.
  // Camera: drag = step sideways / turn the head up-down, wheel / pinch = walk toward the cursor,
  // keys: A D ← → = sideways, W S ↑ ↓ = forward-back, 0 = back to the start.
  // The stage on a canvas of the scene's thread (thread.js: an OffscreenCanvas the page gave it), as the page tells
  // it — host: { w, h (the canvas's CSS px on the page), dpr, flags: { check: the scene checked as it is drawn
  // (CHECK — debug does it too), debug: what is where, over the frame (null: not; '' all; 'keeper,boy' only those) },
  // overlay: a canvas over the scene's for debug, on(type, fn): what
  // the page passes on — 'size', the pointer's ('pointerdown' … { pointerId, x, y }: CSS px of the canvas), 'wheel'
  // { x, y, deltaX, deltaY }, 'keydown' / 'keyup' { key, code }, 'lean' { x, y } (−1…1: where the mouse is, how the
  // phone is held), 'blur'; perf(text): the frame times shown (null: hidden); drawn(): after each frame; frames: what
  // they were, counted (frames.js — none: not counted) }
  // the keys the viewer moves by
  const KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's', ' '];
  // — or throws: the browser gives no WebGL2 (the page says this device cannot show the scene)
  function mount(canvas, { host }) {
    CHECK.on = !!host.flags.check || host.flags.debug != null;
    const R = MooodWorld.create(canvas);
    if (!R) throw new Error('this browser gives no WebGL2');
    // t: seconds since the stage was made, by the real clock — what the painting code sees (e.t),
    // in step with the state's moves; dt: the step of the camera's motion (capped, so a long frame
    // doesn't throw it)
    const born = performance.now();
    let spec = null, S = null, t = 0, last = born, pending;
    const cam = { x: 0, y: 0, z: 0, h: 1, yaw: 0 }, target = { x: 0, y: 0, z: 0, h: 1, yaw: 0 };
    let seen = [0, 1], lim = { aspect: STAGE, zMax: 1, things: [], view: [0, 1] };
    // the frame within the canvas (CSS px): landscape, centred, bars around it
    let box = { x: 0, y: 0, w: 1, h: 1 };
    const frameBox = () => {
      const cw = Math.max(1, host.w), ch = Math.max(1, host.h), a = clamp(cw / ch, NARROWEST, WIDEST);
      const w = Math.min(cw, ch * a), h = w / a;
      return { x: (cw - w) / 2, y: (ch - h) / 2, w, h };
    };
    // the film's camera tipped (camera_roll, rollOf) as camera c has it, in the frame's CSS px; [x, y]
    // of the frame as drawn → as seen (back: as seen → as drawn)
    const rollIn = c => rollOf(c.roll, box.w, box.h, host.w, host.h);
    const tipped = (c, x, y, back = false) => { const r = rollIn(c); if (!r) return [x, y]; const m = back ? invert(r.m) : r.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; };
    // a point of the canvas (CSS px) in the frame's, as drawn
    const local = (cx, cy) => tipped(shown, cx - box.x, cy - box.y, true);
    // the part of the frame the page's panels leave open, as fractions of its width
    const openView = () => [0, 1].map(i => clamp((seen[i] * host.w - box.x) / box.w, 0, 1));
    const keys = new Set(), pointers = new Map();
    let pinch = null;

    // GPU budget. A calm scene doesn't need the display's refresh rate (120–165 Hz on
    // many laptops): render fpsIdle while idle, 60 while the camera moves. The canvas is
    // capped at the renderer's pixel budget whatever the monitor, and stretched by the
    // browser — invisible in this soft, hazy style.
    const FPS_ACTIVE = 60, PIXEL_BUDGET = R.pixelBudget, RES_MIN = 0.6;
    let fpsIdle = R.fpsIdle;
    const resCap = () => Math.min(host.dpr || 1, R.resMax, Math.sqrt(PIXEL_BUDGET / Math.max(1, host.w * host.h)));
    let res = resCap(), frameEma = 1 / fpsIdle, checkAt = performance.now() + 3000, lastDowngrade = 0, activeUntil = 0;
    let waiting = null; // a spec to show once its modules are here
    const rebuild = () => {
      box = frameBox();
      res = Math.min(res, resCap());
      canvas.width = Math.max(1, Math.round(host.w * res));
      canvas.height = Math.max(1, Math.round(host.h * res));
      if (spec) {
        S = R.build(spec, Math.round(box.w * res), Math.round(box.h * res), S, { x: Math.round(box.x * res), y: Math.round(box.y * res), cw: canvas.width, ch: canvas.height, css: [host.w, host.h], dpr: host.dpr || 1 });
        const was = lim.setup;
        lim = { ...S.lim, view: openView(), level: plat?.level };
        // a new camera setup: go to its starting spot at once
        if (!was || was.mode !== lim.setup.mode || was.h !== lim.setup.h || was.look !== lim.setup.look) { reset(); Object.assign(cam, target); }
        limitCam(target, lim);
      }
    };
    // If the machine can't hold the frame rate: first a calmer idle rate, then fewer pixels — at once as many fewer as
    // the frames are slower than they should be (what a frame costs goes as its pixels), not step after step; then the
    // frames timed afresh, a while, before it is looked at again (a resolution changed is a canvas and its targets made
    // anew: a moment's stall, once)
    const adapt = (now, target) => {
      if (now < checkAt || !S) return;
      checkAt = now + 2000;
      const anew = r => { res = r; rebuild(); frameEma = 1 / target; checkAt = now + 4000; };
      if (frameEma > 1.4 / target && target === fpsIdle && fpsIdle > 30) {
        fpsIdle = 30;
        lastDowngrade = now;
      } else if (frameEma > 1.4 / target && res > RES_MIN) {
        lastDowngrade = now;
        anew(Math.max(RES_MIN, Math.min(0.9 * res, res * Math.sqrt(0.9 / target / frameEma))));
      } else if (frameEma < 1.05 / target && res < resCap() && now - lastDowngrade > 15000) anew(Math.min(resCap(), res * 1.15));
    };
    let frames = 0, perfAt = performance.now(), drawMs = 0;
    host.on('size', () => { clearTimeout(pending); pending = setTimeout(rebuild, 150); });

    // Wheel / pinch: walk along the ray through the cursor toward what is seen under it — the
    // first thing truly painted at that point (not a veil of leaves, not a transparent edge), else
    // the ground there, else (the sky) a few steps ahead. It is chosen when the gesture starts or
    // the pointer moves, and kept till the gesture ends; it stays under the cursor all the way —
    // the gaze lifting or lowering with it — and the walk stops where it about fills the frame
    // (something high up: where it still shows with the gaze lifted as far as it goes).
    // What the viewer points at is seen from the camera as shown — the film's camera on top of the
    // viewer's own (off: how far the film moves it); the viewer's moves change their own.
    const off = { x: 0, y: 0, z: 0, h: 0, yaw: 0 }, seenCam = () => ({ x: target.x + off.x, y: target.y + off.y, z: target.z + off.z, h: target.h + off.h, yaw: target.yaw + off.yaw, pan: shown.pan });
    let aim = null, aimAt = 0;
    // is the element truly painted at the cursor: nearly opaque paint on a tenth of the 9×9
    // pixels around it (the thin spokes of a wheel count; a veil, a glow, empty air don't)?
    const probe = layer(9, 9), pg = probe.getContext('2d', { willReadFrequently: true });
    const seenAt = (o, m, cx, cy, Hc) => {
      pg.setTransform(1, 0, 0, 1, 0, 0);
      pg.clearRect(0, 0, 9, 9);
      pg.setTransform(m[0], 0, 0, m[3], m[4] - cx + 4.5, m[5] - cy + 4.5);
      try { drawObject(pg, o, STAGE * Hc, Hc, t, []); } catch { return false; }
      const d = pg.getImageData(0, 0, 9, 9).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 160) n++;
      return n >= 8;
    };
    const pick = (clientX, clientY) => {
      const [cx, cy] = local(clientX, clientY), Hc = box.h, Wc = box.w, yh = S?.yh ?? 0.6, dz = spec ? depths(spec) : null, v = seenCam();
      const at = D => ({ Z: v.z + D, x: v.x + (cx - Wc / 2) / Hc * D });
      const near = (spec?.objects || []).filter(o => o.kind !== 'bird' && !o.sky && !o.ground && !o.plane && !o.insert && !o.unseen).map(o => dz.now(o))
        .filter(({ Z }) => nearFade(Z - v.z) > 0).sort((a, b) => a.Z - b.Z);
      for (const { o, Z } of near) {
        const m = view(v, Z, Wc, Hc, yh), b = objectBox(o, STAGE * Hc, Hc);
        const x0 = m[0] * b.bx + m[4], y0 = m[3] * b.by + m[5];
        if (cx < x0 || cx > x0 + m[0] * b.bw || cy < y0 || cy > y0 + m[3] * b.bh) continue;
        if (!seenAt(o, m, cx, cy, Hc)) continue;
        // the point under the cursor, Y eye heights up; stop where the thing about fills the
        // frame, or — high up — where the point still shows with the gaze lifted as far as it goes
        const D = Z - v.z, Y = v.h - (cy / Hc - yh + v.y) * D, up = (lim.setup?.look ?? 0) + LOOK_UP;
        const sight = Y > v.h ? (Y - v.h) / Math.max(0.05, yh - cy / Hc - up) : 0;
        return { ...at(D), Y, cy: cy / Hc, stop: Math.max(1.1, 1.15 * o.size * Z, sight) };
      }
      const below = cy - (yh - v.y) * Hc;
      return { ...at(below > 0.02 * Hc ? clamp(Hc * v.h / below, 0.8, 100) : 6), stop: 1.2 };
    };
    const walkToward = (factor, clientX, clientY) => {
      const now = performance.now();
      if (!aim || now - aimAt > 400 || Math.hypot(clientX - aim.px, clientY - aim.py) > 6) aim = { ...pick(clientX, clientY), px: clientX, py: clientY };
      aimAt = now;
      const v = seenCam(), d0 = aim.Z - v.z;
      if (d0 <= 0.05) return;
      // each notch covers a share of the way left (the approach slows by itself), up to the stop
      const d = factor > 1 ? Math.max(Math.min(d0, aim.stop), d0 / factor) : d0 / factor;
      target.z = aim.Z - d - off.z;
      target.x = aim.x - (aim.x - v.x) * d / d0 - off.x;
      if (aim.Y !== undefined) target.y = (S?.yh ?? 0.6) - aim.cy + (v.h - aim.Y) / Math.max(0.05, d) - off.y;
      // what you walked up to may lie past where walking goes: you may stand there
      lim.reach = target.z > lim.zMax ? Math.max(lim.reach ?? 0, target.z) : undefined;
      limitCam(target, lim);
    };

    // Drag: sideways = step, keeping what you took hold of (an object, else that spot of
    // ground) under the finger — a step of dx·D/H for its distance D, so near grass moves you
    // a little and a far house carries you along. Up / down = turn your head: the gaze tilts
    // and the grabbed point follows the finger. Walking is the wheel, pinch or keys.
    // Let go while moving and the camera glides on a little.
    let grab = null, glide = null, lastMove = 0;
    const grabAt = (clientX, clientY) => {
      // looking around, a drag turns the head: what you took hold of follows the finger
      if (round()) { const [cx, cy] = local(clientX, clientY); grab = { round: true, cx, cy, yaw: target.yaw, look: target.y }; return; }
      const [cx, cy] = local(clientX, clientY), v = seenCam(), D = clamp(pick(clientX, clientY).Z - v.z, 0.4, 60);
      grab = { x: v.x + (cx - box.w / 2) / box.h * D, D, cy, look: target.y };
    };
    const dragTo = (clientX, clientY) => {
      const [cx, cy] = local(clientX, clientY), x0 = target.x, y0 = target.y, now = performance.now();
      if (grab.round) {
        const yaw0 = target.yaw;
        target.yaw = grab.yaw - (Math.atan((cx - box.w / 2) / box.h) - Math.atan((grab.cx - box.w / 2) / box.h));
        target.y = grab.look - (cy - grab.cy) / box.h;
        limitCam(target, lim);
        const dt = Math.max(8, now - lastMove) / 1000, k = Math.min(1, dt * 20);
        glide = glide || { vx: 0, vy: 0, vyaw: 0 };
        glide.vyaw += ((target.yaw - yaw0) / dt - glide.vyaw) * k;
        lastMove = now;
        return;
      }
      target.x = grab.x - (cx - box.w / 2) / box.h * grab.D - off.x;
      target.y = grab.look - (cy - grab.cy) / box.h;
      limitCam(target, lim);
      const dt = Math.max(8, now - lastMove) / 1000, k = Math.min(1, dt * 20);
      glide = glide || { vx: 0, vy: 0, vyaw: 0 };
      glide.vx += ((target.x - x0) / dt - glide.vx) * k;
      glide.vy += ((target.y - y0) / dt - glide.vy) * k;
      lastMove = now;
    };
    // A point of an element, by `ref`: its id — the point its code marks (e.at), else its anchor — or
    // 'id#name', a point its painting names (e.at(x, y, name)). → { o: the element, n: it where it is
    // now (depths().now — or the part the point is in, depths().part), f: the point in metres from
    // n's anchor as painted, or null (its anchor), named }, or null: no such element, or its painting
    // marks no such point now
    function pointOf(ref, dz) {
      const [id, name] = String(ref).split('#'), o = byId.get(id);
      if (!o) return null;
      const f = name !== undefined ? namedOf(id, name) : focusOf(id);
      if (name !== undefined && !f) return null;
      const n = f?.part ? dz.part(o, f.part.dx, f.part.dz) : dz.now(o);
      return { o, n, f: f || null, named: name !== undefined };
    }
    // where in the canvas (CSS px) an element's point (pointOf) is from camera c — where its `place`
    // has it now — its anchor's top (with over) when its code marks none — lifted by `lift` metres:
    // [x, y, its distance]; null when out of sight
    function seenFrom(c, ref, lift = 0, over = false) {
      const p = seenDrawn(c, ref, lift, over);
      return p && [...tipped(c, p[0], p[1]).map((v, i) => v + (i ? box.y : box.x)), p[2]];
    }
    // ... in the frame as drawn (not tipped: camera_roll)
    function seenDrawn(c, ref, lift, over) {
      if (!spec) return null;
      const dz = depths(spec), P = pointOf(ref, dz);
      if (!P || P.o.sky || P.o.insert) return null;
      const { o, n, f } = P, W = box.w, H = box.h, yh = dz.yh;
      if (o.plane) {
        const p = dz.objectAt(o), Z = p.Zp, up = lift / EYE + (o.drape ? groundAt(p.X * EYE, p.Z * EYE) / EYE : 0);
        if (round()) {
          const q = project(c, p.X, p.Y + up, p.Z, W, H, yh);
          return q && q[2] > 0.3 ? q : null;
        }
        if (Z - c.z <= 0.05) return null; // (behind the eye)
        const q = dz.placed(o), m = view(c, Z, W, H, yh), px = dz.objectX(q) * STAGE * H, py = (yh + (1 - (q.elevation || 0) / EYE) / Z - up / Z) * H;
        return [m[0] * px + m[4], m[3] * py + m[5], Z - c.z];
      }
      const turn = turnOf(n.o);
      if (turn) {
        // (a card turned its own way, or a part of one: its point where it lies, lifted)
        const [ax, ay, ppm] = anchorOf(n.o, STAGE * H, H);
        if (over && !f) lift += o.height ?? EYE;
        const q = cardWorldOf(n, turn, H)(ax + (f ? f.x : 0) * ppm, ay + (f ? f.y : 0) * ppm), seen = project(c, q[0], q[1] + lift / EYE, q[2], W, H, yh);
        return seen && nearFade(seen[2]) >= 0.3 ? seen : null;
      }
      const at = seenOf(c, n, W, H, yh, round());
      // behind the eye, or faded out as it is passed (nearFade)
      if (!at || nearFade(at.D) < 0.3) return null;
      const [ax, ay, ppm] = anchorOf(n.o, STAGE * H, H);
      if (over && !f) lift += o.height ?? EYE;
      let px = ax + (f ? f.x : 0) * ppm, py = ay + (f ? f.y : 0) * ppm - lift / EYE * H / n.at.Zp;
      if (c.hero && o.id === c.hero.id && !f?.part) { const hm = heroMatrix(c.hero, ax, ppm); px = hm[0] * px + hm[4]; py += hm[5]; }
      return [at.m[0] * px + at.m[4], at.m[3] * py + at.m[5], at.D];
    }
    // the camera keeps the elements it follows in the visible part of the screen: together when
    // they fit, else the first of them
    function keepInView() {
      const ids = lim.setup?.follow;
      if (!ids?.length || pointers.size || keys.size || glide || op.pose) return;
      const [vl, vr] = lim.view, L = box.x + (vl + 0.1) * box.w, R = box.x + (vr - 0.1) * box.w;
      const pts = ids.map(id => seenFrom(target, id)).filter(Boolean);
      if (!pts.length) return;
      const lo = Math.min(...pts.map(p => p[0])), hi = Math.max(...pts.map(p => p[0]));
      if (lo >= L && hi <= R) return;
      const aim = hi - lo <= R - L ? (lo + hi) / 2 : pts[0][0];
      target.x += (aim - (L + R) / 2) * pts[0][2] / box.h;
    }
    // What is where in the frame now, seen from camera c — for whoever looks closely (?debug, a
    // render's --json). By element (its id, else its name, else its kind and place in the spec):
    // { kind, seen, box: [x, y, w, h] — where its painting may reach, in the canvas's CSS px; at — the
    // point its code marks (e.at), anchor — where it stands, [x, y]; distance (m); fade — 1, less in
    // the last steps before the eye (nearFade); points — those its code names (e.at(x, y, name)): {name: [x, y]};
    // parts — those it paints (e.part): [{dx, dz, box, seen, distance}]; notes — what its code wrote
    // (e.debug): {value, at?}; paint — its last painting: {ms, repaint: 'frame' (it reads the time),
    // 'state' (the state or the light on it) or 'once'} }
    function layout(c) {
      const out = {};
      if (!spec || !dzOf) return out;
      const W = box.w, H = box.h, SW = STAGE * H, yh = dzOf.yh;
      // (as seen: a tipped camera's picture turned, camera_roll — a rect the box around it turned)
      const r1 = v => Math.round(v * 10) / 10, pt = (x, y) => { const [u, v] = tipped(c, x, y); return [r1(box.x + u), r1(box.y + v)]; };
      const rect = (x0, y0, x1, y1) => {
        const q = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => tipped(c, x, y)), xs = q.map(v => v[0]), ys = q.map(v => v[1]);
        return [r1(box.x + Math.min(...xs)), r1(box.y + Math.min(...ys)), r1(Math.max(...xs) - Math.min(...xs)), r1(Math.max(...ys) - Math.min(...ys))];
      };
      const inFrame = ([x, y, w, h]) => x < box.x + W && x + w > box.x && y < box.y + H && y + h > box.y;
      (spec.objects || []).forEach((o, i) => {
        const key = keyOf(o), el = { kind: o.sky ? 'sky' : o.ground ? 'ground' : o.plane ? 'plane' : o.insert ? 'insert' : o.kind || 'custom' };
        let place = null; // a point its code names (its units, from its anchor) → [x, y] on the canvas
        if (o.sky || o.insert) { el.box = rect(0, 0, W, H); el.seen = !!o.sky || opening(o) >= 0.002; }
        else if (o.ground) {
          const m = view(c, Z_FAR, W, H, yh), y = m[5] + m[3] * yh * H;
          el.box = rect(0, y, W, H); el.seen = y < H;
        } else if (o.plane) {
          const p = dzOf.objectAt(o), w = (o.width || 4) / EYE / 2, d = (o.depth || 4) / EYE / 2, a = (dzOf.placed(o).rotation || 0) * Math.PI / 180;
          const q = [[-w, -d], [w, -d], [w, d], [-w, d]].map(([u, v]) => project(c, p.X + u * Math.cos(a) + v * Math.sin(a), (o.elevation || 0) / EYE, p.Z - v * Math.cos(a) + u * Math.sin(a), W, H, yh)).filter(Boolean);
          if (q.length) { const xs = q.map(v => v[0]), ys = q.map(v => v[1]); el.box = rect(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)); }
          el.seen = !!el.box && inFrame(el.box);
        } else {
          // where something standing (the element, or one of its parts: a now() of it) is in the frame:
          // its box, anchor, distance, fade, and onFrame — its painting's point → the canvas
          const stand = (n, hero) => {
            const turn = turnOf(n.o);
            if (turn) {
              // (a card turned its own way: its box where it lies, as it is seen)
              const world = cardWorldOf(n, turn, H), [ax, ay, ppm] = anchorOf(n.o, SW, H), b = objectBox(n.o, SW, H);
              const q = [[b.bx, b.by], [b.bx + b.bw, b.by], [b.bx + b.bw, b.by + b.bh], [b.bx, b.by + b.bh]].map(([x, y]) => project(c, ...world(x, y), W, H, yh)), a = project(c, ...world(ax, ay), W, H, yh);
              if (!a || q.some(v => !v)) return null;
              const box_ = rect(Math.min(...q.map(v => v[0])), Math.min(...q.map(v => v[1])), Math.max(...q.map(v => v[0])), Math.max(...q.map(v => v[1]))), fade = Math.round(nearFade(a[2]) * 100) / 100;
              const on = (x, y) => { const v = project(c, ...world(ax + x * ppm, ay + y * ppm), W, H, yh); return v ? pt(v[0], v[1]) : null; };
              return { box: box_, fade, seen: fade > 0 && inFrame(box_), anchor: pt(a[0], a[1]), distance: r1(a[2] * EYE), on };
            }
            const at = seenOf(c, n, W, H, yh, round());
            if (!at) return null;
            const [ax, ay, ppm] = anchorOf(n.o, SW, H), b = objectBox(n.o, SW, H), m = at.m;
            const hm = hero ? heroMatrix(c.hero, ax, ppm) : null;
            const onFrame = (x, y) => { if (hm) { x = hm[0] * x + hm[4]; y += hm[5]; } return [m[0] * x + m[4], m[3] * y + m[5]]; };
            const p0 = onFrame(b.bx, b.by), p1 = onFrame(b.bx + b.bw, b.by + b.bh), box_ = rect(p0[0], p0[1], p1[0], p1[1]);
            const fade = Math.round(nearFade(at.D) * 100) / 100;
            return { box: box_, fade, seen: fade > 0 && inFrame(box_), anchor: pt(...onFrame(ax, ay)), distance: r1(at.D * EYE), on: (x, y) => pt(...onFrame(ax + x * ppm, ay + y * ppm)) };
          };
          const own = stand(dzOf.now(o), c.hero && o.id === c.hero.id);
          if (!own) el.seen = false;
          else {
            const { on, ...rest } = own;
            Object.assign(el, rest);
            place = on;
            // its points: the one its code marks (e.at), and those it names (e.at(x, y, name)) — each
            // where it was painted, in the element or in one of its parts
            const where = f => (f.part ? stand(dzOf.part(o, f.part.dx, f.part.dz), false)?.on(f.x, f.y) ?? null : on(f.x, f.y));
            const f = focusOf(o.id), named = new Map([...(NAMED.get(o.id) || []), ...[...(MARKED.get(o.id) || [])].filter(([nm]) => nm !== null)]);
            if (f) el.at = where(f);
            if (named.size) el.points = Object.fromEntries([...named].map(([nm, p]) => [nm, where(p)]));
            // its parts (e.part), each standing at its own depth
            const parts = PARTS.get(key);
            if (parts?.length) el.parts = parts.map(q => { const s_ = stand(dzOf.part(o, q.dx, q.dz, q.box), false); return s_ ? { dx: q.dx, dz: q.dz, box: s_.box, seen: s_.seen, distance: s_.distance } : { dx: q.dx, dz: q.dz, seen: false }; });
          }
        }
        const notes = NOTES.get(key), last = PERF.last.get(key), ms = last?.ms, read = last?.read;
        if (notes) el.notes = notes.map(nt => (nt.at && place ? { value: nt.value, at: place(nt.at.x, nt.at.y) } : { value: nt.value }));
        if (ms != null) el.paint = { ms: Math.round(ms * 100) / 100, repaint: read?.time || o.frames > 1 ? 'frame' : read?.state || read?.lights ? 'state' : 'once', ...(read?.keys.size ? { keys: [...read.keys.keys()].map(k => (k === ALL ? '*' : k)) } : {}), ...(PERF.repaints.has(key) ? { repaints: PERF.repaints.get(key) } : {}) };
        out[key ?? `${el.kind}#${i}`] = el;
      });
      return out;
    }
    // ?debug: over the frame, what is where — each element seen: its box and id, its anchor (a ring),
    // the point its code marks (a cross), what its code wrote (e.debug); the scene's second, and
    // what it does wrong (window.__mooodErrors, then __mooodWarnings: e.warn's too) (?debug=keeper,boy: only those)
    const looking = host.flags.debug != null && host.overlay ? overlay(host.flags.debug) : null;
    function overlay(only) {
      const ids = only ? new Set(only.split(',')) : null;
      const c = host.overlay, g = c.getContext('2d');
      const say = v => (typeof v === 'string' ? v : JSON.stringify(v, (k, x) => (typeof x === 'number' ? Math.round(x * 100) / 100 : x)) ?? String(v)).replace(/"/g, '');
      const hue = k => hash(k) % 360;
      return {
        draw(cam, t) {
          const dpr = host.dpr || 1, cw = Math.max(1, host.w), ch = Math.max(1, host.h);
          if (c.width !== Math.round(cw * dpr) || c.height !== Math.round(ch * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
          g.setTransform(dpr, 0, 0, dpr, 0, 0);
          g.clearRect(0, 0, cw, ch);
          g.font = '12px ui-monospace, Consolas, monospace'; g.textBaseline = 'top'; g.lineWidth = 1;
          const label = (text, x, y, col) => {
            const w = g.measureText(text).width + 6;
            g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x, y, w, 15);
            g.fillStyle = col; g.fillText(text, x + 3, y + 1.5);
          };
          for (const [id, el] of Object.entries(layout(cam))) {
            if (!el.seen || el.kind === 'sky' || el.kind === 'ground' || !el.box || (ids && !ids.has(id))) continue;
            const col = `hsl(${hue(id)},85%,70%)`, [x, y, w, h] = el.box;
            // what spans most of the frame (a wall, a floor) is drawn faintly, so the rest reads
            g.globalAlpha = w * h > 0.5 * box.w * box.h ? 0.4 : 1;
            g.strokeStyle = col; g.setLineDash(el.kind === 'insert' || el.kind === 'plane' ? [4, 4] : []);
            g.strokeRect(x + 0.5, y + 0.5, w, h); g.setLineDash([]);
            if (el.anchor) { g.beginPath(); g.arc(...el.anchor, 4, 0, 7); g.stroke(); }
            if (el.at) { const [ax, ay] = el.at; g.beginPath(); g.moveTo(ax - 7, ay); g.lineTo(ax + 7, ay); g.moveTo(ax, ay - 7); g.lineTo(ax, ay + 7); g.stroke(); }
            // its named points (a diamond and the name), its parts (dashed, each where it stands)
            for (const [nm, q] of Object.entries(el.points || {})) {
              if (!q) continue;
              const [qx, qy] = q; g.beginPath(); g.moveTo(qx, qy - 5); g.lineTo(qx + 5, qy); g.lineTo(qx, qy + 5); g.lineTo(qx - 5, qy); g.closePath(); g.stroke();
              label(`#${nm}`, qx + 7, qy - 7, col);
            }
            g.setLineDash([2, 3]);
            for (const q of el.parts || []) if (q.seen) g.strokeRect(q.box[0] + 0.5, q.box[1] + 0.5, q.box[2], q.box[3]);
            g.setLineDash([]);
            const lx = Math.max(box.x, Math.min(x, box.x + box.w - 160)), ly = Math.max(box.y, y);
            label(`${id}${el.paint?.ms >= 0.1 ? ` · ${el.paint.ms.toFixed(1)} ms` : ''}`, lx, ly, col);
            (el.notes || []).forEach((nt, i) => {
              const text = say(nt.value).slice(0, 90);
              if (nt.at) { const [px, py] = nt.at; g.fillStyle = col; g.fillRect(px - 2, py - 2, 4, 4); label(text, px + 5, py - 7, col); }
              else label(text, lx, ly + 16 * (i + 1), col);
            });
            g.globalAlpha = 1;
          }
          // what the scene does wrong (its errors, what its modules said they do not know), the latest
          const wrong = [...(globalThis.__mooodErrors || []), ...(globalThis.__mooodWarnings || [])];
          if (wrong.length > 6) label(`… ${wrong.length - 6} more (window.__mooodErrors, __mooodWarnings)`, box.x + 8, box.y + 8, '#ffb4a0');
          wrong.slice(-6).forEach((m, i) => label(m.slice(0, 200), box.x + 8, box.y + 8 + 16 * (i + (wrong.length > 6)), '#ffb4a0'));
          const target = STATE.values.camera_target;
          label(`${t.toFixed(2)} s${target != null ? ` · camera_target ${target}` : ''}`, box.x + 8, box.y + box.h - 23, '#fff');
        },
      };
    }
    // false: the scene goes on unseen — each frame steps it (beforeFrame, R.tick),
    // nothing is painted or drawn (a render seeking a late moment draws only the frames it takes);
    // 'whole' — drawn, each frame with every sharp tile its view needs painted first (a frame a render
    // takes: as when the film has stood there a while); drawn again, the next frame is drawn whatever
    // the frame rate (owed)
    let drawn = true, owed = false;
    const reset = () => { Object.assign(target, { x: 0, y: lim.setup?.look ?? 0, z: 0, h: lim.setup?.h ?? 1, yaw: 0 }); };
    const round = () => !!lim.setup?.round, roam = () => lim.setup?.mode === 'roam';
    const platform = () => lim.setup?.mode === 'platform';
    // ── a platformer ─────────────────────────────────────────────────────
    // The hero (camera.hero) runs and jumps in its plane, seen from the side: x metres across, y
    // metres up. Solid elements (solid: true) are boxes it stands on and bumps into — across their
    // box, from their elevation up their height. Gravity G, running RUN, a jump camera.jump metres
    // high (default 2.2). Fallen FALL metres below the lowest place to stand, it is back at the start.
    // The camera rides along.
    // Keys: ← → A D run, space W ↑ jump; touch: hold the left or right third to run, the middle to jump.
    const G = 22, RUN = 5.5, FALL = 5;
    let plat = null;
    function platformOf(spec) {
      const s = camSetup(spec), o = s.hero && (spec.objects || []).find(o => o.id === s.hero);
      if (!o) return null;
      const dz = depths(spec), p = dz.objectAt(o);
      const solids = (spec.objects || []).filter(e => e.solid && e !== o).map(e => {
        const q = dz.objectAt(e), h = e.height || 2, b = Array.isArray(e.box) && e.box.length === 4 ? e.box : [-0.8 * h, 0, 0.8 * h, 0];
        const x = q.X * EYE, y = e.elevation || 0;
        return { x0: x + b[0], x1: x + b[2], y0: y, y1: y + h };
      });
      const x = p.X * EYE, y = o.elevation || 0;
      return {
        id: o.id, Zp: p.Zp, x0: x, y0: y, x, y, floor: y, vx: 0, vy: 0, ground: false, air: 0, jumped: false, dir: 1,
        w: o.width || 0.6, h: o.height || 1.7, solids, jumpV: Math.sqrt(2 * G * clamp(s.jump ?? 2.2, 0.5, 8)),
        level: [Math.min(x, ...solids.map(r => r.x0)) / EYE, Math.max(x, ...solids.map(r => r.x1)) / EYE],
        bottom: Math.min(y, ...solids.map(r => r.y1)), // the lowest place to stand
      };
    }
    // what the viewer asks for now: { left, right, jump }
    function controls() {
      const c = { left: keys.has('ArrowLeft') || keys.has('a'), right: keys.has('ArrowRight') || keys.has('d'), jump: keys.has(' ') || keys.has('w') || keys.has('ArrowUp') };
      for (const p of pointers.values()) {
        const f = local(p.x, p.y)[0] / box.w;
        if (f < 1 / 3) c.left = true; else if (f > 2 / 3) c.right = true; else c.jump = true;
      }
      return c;
    }
    function stepHero(P, dt) {
      const c = controls(), want = (c.right ? 1 : 0) - (c.left ? 1 : 0), hw = P.w / 2;
      P.vx += (want * RUN - P.vx) * Math.min(1, dt * (P.ground ? 14 : 5));
      if (want) P.dir = want;
      P.air = P.ground ? 0 : P.air + dt;
      // one jump a press; a moment after running off an edge still counts
      if (c.jump && !P.jumped && P.air < 0.1) { P.vy = P.jumpV; P.jumped = true; P.air = 1; }
      if (!c.jump) P.jumped = false;
      P.vy = Math.max(P.vy - G * dt, -30);
      // across, then up: out of whatever solid it moved into
      P.x += P.vx * dt;
      for (const r of P.solids) {
        if (P.y >= r.y1 - 0.01 || P.y + P.h <= r.y0 + 0.01 || P.x + hw <= r.x0 || P.x - hw >= r.x1) continue;
        if (P.vx > 0) P.x = r.x0 - hw; else if (P.vx < 0) P.x = r.x1 + hw;
        P.vx = 0;
      }
      const y0 = P.y;
      P.y += P.vy * dt; P.ground = false;
      for (const r of P.solids) {
        if (P.x + hw <= r.x0 || P.x - hw >= r.x1) continue;
        if (P.vy <= 0 && y0 >= r.y1 - 0.01 && P.y < r.y1) { P.y = r.y1; P.vy = 0; P.ground = true; }
        else if (P.vy > 0 && y0 + P.h <= r.y0 + 0.01 && P.y + P.h > r.y0) { P.y = r.y0 - P.h; P.vy = 0; }
      }
      if (P.y < P.bottom - FALL) Object.assign(P, { x: P.x0, y: P.y0, floor: P.y0, vx: 0, vy: 0 });
      if (P.ground) P.floor = P.y;
      Object.assign(HERO, { id: P.id, vx: P.vx, vy: P.vy, ground: P.ground });
      // the camera: the hero a little behind the middle, the way it runs; up and down with what it
      // stands on, not with every jump
      target.x = (P.x + P.dir * 1.2) / EYE;
      target.y = lim.setup.look - 0.8 * (P.floor - P.y0) / EYE / P.Zp;
      limitCam(target, lim);
    }
    // roaming: a step of `d` eye heights toward `ang` (radians, as yaw)
    const stepTo = (ang, d) => { target.x += Math.sin(ang) * d; target.z += Math.cos(ang) * d; limitCam(target, lim); };
    // a picture: the camera stands and only leans (lean: −1…1 each way, toward the
    // pointer or with the phone's tilt) and breathes
    const fixed = () => lim.setup?.sway > 0, panorama = () => lim.setup?.mode === 'panorama';
    const lean = { x: 0, y: 0 };
    // Moving through the scene, the view still leans a little toward the pointer (or with the
    // phone's tilt): near things shift against far ones, the depth is felt standing still too.
    // `shown` is the camera as drawn: where you are, plus the lean (eased, LEAN eye heights).
    const LEAN = 0.047, leaned = { x: 0, y: 0 }, shown = { ...cam };
    // ── the film's camera ────────────────────────────────────────────────
    // A film moves the camera through the state. camera_target — an element to look at: an operator
    // frames it (camera_shot: how big — wide, full, medium, close, or how many times the frame's
    // height it is tall; camera_frame: where in the frame its point goes, [x, y] fractions of the
    // frame, or x alone — its point is the one its code marks, e.at, else its box's middle) and keeps
    // it there as it moves, leaving it room ahead the way it goes — with a cameraman's weight: setting
    // off and settling gently, over camera_glide seconds (from one target to the next too, and back to
    // the scene's own camera when the target is gone; 0 — there at once). Standing ahead the operator
    // dollies and slides; looking around (around, roam) it turns toward the target and comes as near
    // as the shot needs.
    // On top of that: camera_x (metres to the right), camera_z (metres ahead — a dolly in, with all
    // the depth the scene has), camera_look (screen heights the gaze is lowered), camera_h (metres up
    // — the operator still keeps the target framed), and the camera turned, degrees: camera_pitch (up;
    // as camera_look, the lens shifted so what stands stays upright), camera_yaw (to the right —
    // looking around only: ahead the scene is a stage seen from its front), camera_roll (tipped to
    // the right, the horizon rising to the right: the picture turned, rollOf); and on top of all,
    // wherever the viewer moved from the start. A cut (scene.cut) puts the operator where it is meant
    // to be at once.
    const num = k => (typeof STATE.values[k] === 'number' ? STATE.values[k] : 0);
    const SHOTS = { wide: 0.3, full: 0.8, medium: 1.6, close: 3.5 }, GLIDE = 1.5, AXES = ['x', 'y', 'z', 'h', 'yaw'];
    // where a head goes down the frame for a shot: the whole figure in the middle while it fits, then
    // a head with room above it, the eyes near the upper third close up
    const HEAD = [[0, 0.5], [0.8, 0.18], [1.6, 0.3], [3.5, 0.38]];
    const headAt = shot => { const i = HEAD.findIndex(([k]) => k > shot); if (i < 0) return HEAD.at(-1)[1]; const [a, u] = HEAD[i - 1], [b, v] = HEAD[i]; return u + (v - u) * (shot - a) / (b - a); };
    // the operator: its pose (as the scene's start pose is — the viewer's moves go on top), how fast
    // it moves, the target's point a frame ago and how fast that moves; null pose: the scene's own camera
    let op = { pose: null, vel: null, cut: null, fresh: false, id: null, at: null, v: { X: 0, Y: 0, Z: 0 }, view: null };
    let byId = new Map(), dzOf = null;
    const glideOf = () => { const g = STATE.values.camera_glide; return typeof g === 'number' && g >= 0 ? g : GLIDE; };
    const startPose = () => ({ x: 0, y: lim.setup?.look ?? 0, z: 0, h: lim.setup?.h ?? 1, yaw: 0 });
    // the target's point in the world (eye heights) and how tall it is (metres), or null
    // (id, or 'id#name' — a point its painting names: aimed at, the shot measured by the element)
    function targetOf(ref) {
      const o = byId.get(ref.split('#')[0]);
      if (!o) { warn(`camera_target: there is no element "${ref}"`); return null; }
      if (o.sky || o.ground || o.plane || o.insert) { warn(`camera_target: "${ref}" is not something standing in the scene`); return null; }
      const custom = o.kind === 'custom' || !o.kind, tall = custom ? o.height || 2 : HEIGHT[o.kind] || 2, P = custom ? pointOf(ref, dzOf) : null;
      if (ref.includes('#') && !P) return null; // a point it doesn't mark now: the camera stays as it is
      let f = P?.f;
      const at = P ? P.n.at : dzOf.now(o).at;
      if (!f) {
        const b = custom && Array.isArray(o.box) && o.box.length === 4 ? o.box : [0, -tall, 0, 0];
        f = { x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2 };
      }
      return { X: at.X + f.x / EYE, Y: at.Y - f.y / EYE, Z: at.Z, tall, marked: !!P?.f, known: !custom || READS.has(o) };
    }
    const shotOf = v => {
      if (v == null) return SHOTS.full;
      if (typeof v === 'number' && v > 0) return v;
      if (SHOTS[v]) return SHOTS[v];
      warn(`camera_shot: ${JSON.stringify(v)} — one of ${Object.keys(SHOTS).join(', ')}, or how many times the frame's height the target is tall`);
      return SHOTS.full;
    };
    const frameOf = v => {
      if (v == null) return [null, null];
      if (typeof v === 'number') return [v, null];
      if (Array.isArray(v) && v.length === 2 && v.every(k => typeof k === 'number')) return v;
      warn(`camera_frame: ${JSON.stringify(v)} — [x, y] (fractions of the frame) or x`);
      return [null, null];
    };
    // ── a clear view (looking around) ──
    // An operator never shoots through what stands between the lens and the target, nor stands inside
    // it: as a shot begins (a cut, another target, another size) the place the shot asks for is
    // looked through — lines of sight from it to what of the target the frame holds — and if most of
    // them meet something that stands (a person; a card where it is truly painted: a veil, glass,
    // a glow let the eye through), the operator goes round the target to the nearest bearing that
    // sees it, then nearer, within the scene's area — and keeps that for the shot. A shot the scene
    // moves itself (camera_x, camera_z, camera_h, camera_yaw) is taken as it says.
    const SIGHTS = 5, HIDDEN = 1 / SIGHTS, BEARING = Math.PI / 12, NEARER = [1, 0.8, 0.64, 0.5];
    // what stands in the scene now, but the target and what it stands on or holds: people (solid,
    // as tall as they stand, as wide as their body) and cards (where their painting is opaque)
    function standing(skip) {
      const out = [];
      for (const o of spec?.objects || []) {
        if (o.id == null || skip.has(String(o.id)) || o.sky || o.ground || o.plane || o.insert || o.unseen || o.kind === 'bird') continue;
        if (o.kind && o.kind !== 'custom') continue; // (a painted kind has no box in metres to look through)
        const n = dzOf.now(o), A = n.at, b = Array.isArray(o.box) && o.box.length === 4 ? o.box : null;
        if (!A || !b || b[2] <= b[0] || b[3] <= b[1]) continue;
        if (o.person) out.push({ body: true, X: A.X + (b[0] + b[2]) / 2 / EYE, Z: A.Z, r: Math.min(0.35, (b[2] - b[0]) / 2) / EYE, lo: A.Y - b[3] / EYE, hi: A.Y - b[1] / EYE });
        else out.push({ o: n.o, A, b, turn: turnOf(n.o) });
      }
      return out;
    }
    // is a card truly painted at its point (px, py: metres from its anchor, as e.at has them)? — the
    // probe the wheel looks with (seenAt), at about 6 cm a pixel
    function paintedAt(no, px, py) {
      const h = no.height || 2, H = Math.max(64, Math.round(16 * h / Math.max(1e-3, no.size))), ppm = Math.max(2, no.size * H) / h;
      pg.setTransform(1, 0, 0, 1, 0, 0);
      pg.clearRect(0, 0, 9, 9);
      pg.setTransform(1, 0, 0, 1, 4.5 - (no.x * STAGE * H + px * ppm), 4.5 - (no.y * H + py * ppm));
      try { drawObject(pg, no, STAGE * H, H, t, []); } catch { return false; }
      const d = pg.getImageData(0, 0, 9, 9).data;
      let k = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 160) k++;
      return k >= 8;
    }
    // does the line of sight from C to T (eye heights) meet something of `things`? (nearer the eye
    // than PASS_FROM: faded out, not seen)
    function meets(C, T, things) {
      const d = [T[0] - C[0], T[1] - C[1], T[2] - C[2]], L = Math.hypot(...d);
      if (L < 1e-6) return false;
      const yaw = Math.atan2(d[0], d[2]);
      for (const s of things) {
        if (s.body) {
          // a person: the nearest the line comes to their axis, within their height
          const fx = C[0] - s.X, fz = C[2] - s.Z, a = d[0] * d[0] + d[2] * d[2];
          const u = a > 1e-9 ? clamp(-(fx * d[0] + fz * d[2]) / a, 0, 1) : 0;
          if (u * L < PASS_FROM || u > 0.999) continue;
          const y = C[1] + d[1] * u;
          if (Math.hypot(fx + d[0] * u, fz + d[2] * u) < s.r && y > s.lo && y < s.hi) return true;
          continue;
        }
        // a card: where the line goes through its plane (turned its way, or facing the eye as a
        // card looking around does), and whether its painting is there
        const { r, u, n } = s.turn ? axesOf(s.turn) : { r: [Math.cos(yaw), 0, -Math.sin(yaw)], u: [0, 1, 0], n: [Math.sin(yaw), 0, Math.cos(yaw)] };
        const A = [s.A.X, s.A.Y, s.A.Z], dn = d[0] * n[0] + d[1] * n[1] + d[2] * n[2];
        if (Math.abs(dn) < 1e-9) continue;
        const k = ((A[0] - C[0]) * n[0] + (A[1] - C[1]) * n[1] + (A[2] - C[2]) * n[2]) / dn;
        if (k * L < PASS_FROM || k > 0.999) continue;
        const q = [C[0] + d[0] * k - A[0], C[1] + d[1] * k - A[1], C[2] + d[2] * k - A[2]];
        const px = (q[0] * r[0] + q[1] * r[1] + q[2] * r[2]) * EYE, py = -(q[0] * u[0] + q[1] * u[1] + q[2] * u[2]) * EYE;
        if (px < s.b[0] || px > s.b[2] || py < s.b[1] || py > s.b[3]) continue;
        if (paintedAt(s.o, px, py)) return true;
      }
      return false;
    }
    // the operator's way round for this shot: { turn — radians round the target from the bearing
    // the shot asks for, near — the share of its distance } (none: as asked)
    function clearView(ref, P, X, Z, D, c, h) {
      const o = byId.get(ref.split('#')[0]), skip = new Set([String(o.id)]);
      // (what the target stands on, and what stands on it)
      for (let p = o.on; typeof p === 'string' && !skip.has(p.split('#')[0]); p = byId.get(p.split('#')[0])?.on) skip.add(p.split('#')[0]);
      for (const e of spec.objects || []) if (typeof e.on === 'string' && e.on.split('#')[0] === String(o.id)) skip.add(String(e.id));
      const things = standing(skip), b = Array.isArray(o.box) && o.box.length === 4 ? o.box : [0, -P.tall, 0, 0], A = dzOf.now(o).at;
      // what of it the frame holds: its height, within a frame's height (D eye heights there) round its point
      const lo = Math.max(A.Y - b[3] / EYE, P.Y - D / 2), hi = Math.min(A.Y - b[1] / EYE, P.Y + D / 2);
      const sights = Array.from({ length: SIGHTS }, (_, i) => [X, lo + (hi - lo) * (i + 0.5) / SIGHTS, Z]);
      const room = lim.room, bearing = Math.atan2(X - c.x, Z - c.z);
      let best = null;
      for (const near of NEARER) for (let i = 0; i <= 12; i++) for (const sgn of i ? [1, -1] : [1]) {
        const turn = sgn * i * BEARING, a = bearing + turn, Dk = Math.max(PASS_TO, D * near);
        const C = [X - Dk * Math.sin(a), h, Z - Dk * Math.cos(a)];
        if (room && (C[0] < room[0] || C[0] > room[1] || C[2] < room[2] || C[2] > room[3])) continue;
        const hidden = sights.filter(T => meets(C, T, things)).length / SIGHTS;
        // (the nearest way round first, then nearer; failing all, the one that sees most of it)
        if (hidden <= HIDDEN) return { turn, near };
        if (!best || hidden < best.hidden) best = { turn, near, hidden };
      }
      return best && best.hidden < 1 ? best : { turn: 0, near: 1 };
    }
    // where the operator would stand for target `id` now: { pose — like the start pose, lead — how far
    // ahead it aims and how fast the target goes }; c: the camera as the viewer has it (its height and
    // where it stands count)
    function framing(id, c, dt) {
      const P = targetOf(id);
      if (!P) return null;
      // how fast its point moves (smoothed): the operator aims where it is going, not where it was
      if (op.at && dt > 0) {
        const k = 1 - Math.exp(-dt / 0.3);
        for (const a of ['X', 'Y', 'Z']) op.v[a] += ((P[a] - op.at[a]) / dt - op.v[a]) * k;
      }
      op.at = P;
      const w = 5 / Math.max(0.1, glideOf()), ahead = 2 / w, s = lim.setup;
      const X = P.X + op.v.X * ahead, Z = P.Z + op.v.Z * ahead, shot = shotOf(STATE.values.camera_shot);
      // (never so near that the target itself fades as a passed thing does: nearFade)
      const D = Math.max(PASS_TO, P.tall / EYE / shot), A = box.w / box.h, yh = S?.yh ?? 0.6;
      op.D = D;
      const b = startPose(), yaw = s?.round ? Math.atan2(X - c.x, Z - c.z) : 0;
      // room ahead: a tenth of the frame at a walk across it
      const across = op.v.X * Math.cos(yaw) - op.v.Z * Math.sin(yaw);
      let [fx, fy] = frameOf(STATE.values.camera_frame);
      fx ??= 0.5 - 0.1 * clamp(across * EYE / 1.4, -1, 1);
      fy ??= P.marked ? headAt(shot) : 0.5;
      // closer than full height the camera comes down (or up) to the point's own height, as an
      // operator does: a close-up is level with the face, not looked at from far below with a shifted lens
      const ph = b.h + (P.Y - b.h) * clamp((shot - SHOTS.full) / (SHOTS.medium - SHOTS.full), 0, 1);
      const h = c.h + ph - b.h + num('camera_h') / EYE, off = Math.atan((fx - 0.5) * A);
      // (aimed ahead by `lead`: where an operator following it all along would be is that much behind)
      const lead = { x: op.v.X * ahead, z: op.v.Z * ahead, vx: op.v.X, vz: op.v.Z };
      if (s?.round) {
        // (the way round chosen as the shot begins, kept for it — chosen anew till the target is painted)
        const shotKey = `${op.cut}|${id}|${shot}`;
        if (op.view?.key !== shotKey || !op.view.known) {
          const asked = ['camera_x', 'camera_z', 'camera_h', 'camera_yaw'].some(k => num(k) !== 0);
          op.view = { key: shotKey, known: P.known, ...(asked ? { turn: 0, near: 1 } : clearView(id, P, X, Z, D, c, h)) };
        }
        const a = yaw + op.view.turn, Dk = Math.max(PASS_TO, D * op.view.near);
        op.D = Dk;
        return { pose: { x: X - Dk * Math.sin(a), z: Z - Dk * Math.cos(a), y: yh + (h - P.Y) / (Dk * Math.cos(off)) - fy, h: ph, yaw: a - off }, lead, known: P.known };
      }
      return { pose: { x: X - (fx - 0.5) * A * D, z: Z - D, y: yh + (h - P.Y) / D - fy, h: ph, yaw: 0 }, lead, known: P.known };
    }
    // the operator's step: c — the camera as the viewer has it — becomes the film's camera
    function directed(c, dt) {
      const id = STATE.values.camera_target, s = lim.setup, b = startPose();
      op.D = null; // (framing: the shot's distance, while a target is framed)
      if (op.cut !== STATE.cut) { op.cut = STATE.cut; op.fresh = true; op.at = null; op.v = { X: 0, Y: 0, Z: 0 }; }
      if (id !== op.id) { op.id = id; op.at = null; op.v = { X: 0, Y: 0, Z: 0 }; }
      // (not while a scene is on its way: the state may be the next one's already)
      const aim = id != null && S && !waiting && s?.mode !== 'platform' ? framing(String(id), c, dt) : null;
      // without a target: the scene's own camera (looking around, where the viewer stands)
      const own = { ...b, ...(s?.round ? { x: c.x, z: c.z } : {}) }, goal = aim ? aim.pose : own;
      if (aim || op.pose) {
        // just after a cut, there at once (until the target has been painted: its painting marks its
        // point as it is painted); else from where the camera is, along a critically damped spring (exact for
        // any step): it sets off and settles without overshoot
        const snap = op.fresh || glideOf() < 0.01;
        if (snap || !op.pose) {
          op.pose = { ...(snap ? goal : own) }; op.vel = { x: 0, y: 0, z: 0, h: 0, yaw: 0 };
          // at a moving target: as if following it all along — on it, moving with it
          if (snap && aim) { op.pose.x -= aim.lead.x; op.pose.z -= aim.lead.z; op.vel.x = aim.lead.vx; op.vel.z = aim.lead.vz; }
        }
        if (!snap) {
          const w = 5 / glideOf(), e = Math.exp(-w * dt);
          if (s?.round) goal.yaw = op.pose.yaw + ((((goal.yaw - op.pose.yaw) % TAU) + 3 * Math.PI) % TAU - Math.PI);
          for (const a of AXES) {
            const d = op.pose[a] - goal[a], k = (op.vel[a] + w * d) * dt;
            op.vel[a] = (op.vel[a] - w * k) * e;
            op.pose[a] = goal[a] + (d + k) * e;
          }
        }
        const p = op.pose;
        // settled back on the scene's own camera: the operator steps away
        if (!aim && AXES.every(a => Math.abs(p[a] - goal[a]) < 1e-4 && Math.abs(op.vel[a]) < 1e-4)) op.pose = null;
        else {
          if (s?.round) { c.x = p.x; c.z = p.z; } else { c.x += p.x - b.x; c.z += p.z - b.z; }
          c.y += p.y - b.y; c.h += p.h - b.h; c.yaw += p.yaw - b.yaw;
        }
      }
      if (op.fresh) op.fresh = id != null && !aim?.known;
      c.x += num('camera_x') / EYE; c.h = (c.h ?? 1) + num('camera_h') / EYE; c.z += num('camera_z') / EYE; c.y += num('camera_look');
      const deg = Math.PI / 180, yaw = num('camera_yaw');
      c.y -= Math.tan(clamp(num('camera_pitch'), -75, 75) * deg);
      // ahead too the camera turns all the way round: what stands in the world is seen turned truly;
      // what is painted on the stage from its front (the sky, the landscape) is a backdrop round the
      // start at its bearing, a screen height a radian, as the sky looking around (view: pan, the turn
      // within ±π) — behind it the sky's edges carry on
      c.yaw += yaw * deg;
      c.pan = yaw && !s?.round ? ((yaw * deg + Math.PI) % TAU + TAU) % TAU - Math.PI : 0;
      c.roll = num('camera_roll') * deg;
    }
    const operating = () => !!op.pose && AXES.some(a => Math.abs(op.vel[a]) > 1e-4);
    // the camera as `values` (the camera's keys, over the film's) would have it, the operator there at once — the film's
    // own camera, its operator, untouched
    function cameraFor(values) {
      const film = STATE.values, was = structuredClone(op), c = Object.fromEntries(AXES.map(a => [a, shown[a] - off[a]]));
      c.hero = shown.hero;
      try {
        STATE.values = { ...film, ...values, camera_glide: 0 };
        op.fresh = true;
        directed(c, 0);
        return c;
      } finally { STATE.values = film; op = was; }
    }
    // the cameras ahead (stage.prepare): till their moment is a second past
    let ahead = [];
    // The viewer's own moves over the film's camera (target: where they moved from the start): while
    // the operator frames a target they are a look aside — they ease back to nothing once the viewer
    // lets go (VIEWER_BACK s), they come at most VIEWER_NEAR of the way to the target (never through
    // it, nor so near that it fades: nearFade). A cut — a new shot (scene.cut, not the scene's start: shown again, the viewer
    // stays where they were) — takes them back to the start at once.
    const VIEWER_BACK = 0.8, VIEWER_NEAR = 0.5;
    let viewerShot = 0;
    function overTarget(dt) {
      // (a platformer's camera rides with its hero: no moves of the viewer's own)
      if (viewerShot !== STATE.shots && !platform()) { viewerShot = STATE.shots; Object.assign(target, startPose()); Object.assign(cam, target); }
      if (!op.pose || !(op.D > 0)) return;
      // (looking around, the operator stands where the shot needs: the viewer only turns their head)
      const b = startPose(), axes = round() ? ['y', 'yaw'] : AXES;
      if (!round()) target.z = Math.min(target.z, b.z + Math.min(VIEWER_NEAR * op.D, op.D - PASS_TO));
      if (fixed() || pointers.size || keys.size || glide || performance.now() - aimAt < 600) return;
      const k = 1 - Math.exp(-dt / VIEWER_BACK);
      for (const a of axes) target[a] += (b[a] - target[a]) * k;
    }
    function leanShown(dt) {
      const k = 1 - Math.exp(-dt * 3), s = lim.setup;
      leaned.x += ((s?.sway ? 0 : lean.x) - leaned.x) * k; leaned.y += ((s?.sway ? 0 : lean.y) - leaned.y) * k;
      Object.assign(shown, cam);
      const dx = leaned.x * LEAN, dy = leaned.y * LEAN / 3;
      if (s?.round) { shown.x += dx * Math.cos(cam.yaw); shown.z -= dx * Math.sin(cam.yaw); }
      else shown.x += dx;
      shown.y += dy;
    }
    function leanTo(t) {
      const s = lim.setup, b = 0.25;
      target.x = (lean.x + b * Math.sin(t * 0.31)) * s.sway / (1 + b);
      target.y = s.look + (lean.y + b * Math.sin(t * 0.19 + 1)) * s.sway / 3 / (1 + b);
    }

    host.on('pointerdown', e => {
      pointers.set(e.pointerId, { x: e.x, y: e.y });
      glide = null; lastMove = performance.now();
      if (pointers.size === 1 && !fixed() && !platform()) grabAt(e.x, e.y);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) };
      }
    });
    host.on('pointermove', e => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      if (fixed()) return;
      const now = { x: e.x, y: e.y };
      pointers.set(e.pointerId, now);
      if (platform()) return; // fingers held are the controls (controls())
      if (pointers.size === 1) {
        if (grab) dragTo(now.x, now.y);
      } else if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (roam()) stepTo(target.yaw, Math.log(dist / pinch.dist) * 3);
        else if (!round()) walkToward(dist / pinch.dist, (a.x + b.x) / 2, (a.y + b.y) / 2);
        pinch.dist = dist;
      }
    });
    const up = e => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      grab = null; // a finger lifted from a pinch doesn't turn the other into a grab
      // glide only if the finger was still moving when it let go
      if (glide && (pointers.size > 0 || performance.now() - lastMove > 80)) glide = null;
    };
    host.on('pointerup', up);
    host.on('pointercancel', up);
    host.on('wheel', e => {
      glide = null;
      if (fixed() || platform()) return;
      // roaming: the wheel walks toward where the pointer is; standing and looking around, nowhere
      if (round()) {
        if (roam()) { const [cx] = local(e.x, e.y); stepTo(target.yaw + Math.atan((cx - box.w / 2) / box.h), -e.deltaY * 0.004); }
        return;
      }
      // a panorama: a sideways swipe (a touchpad's) carries you along
      if (panorama() && Math.abs(e.deltaX) > Math.abs(e.deltaY)) { target.x += e.deltaX * 0.006; limitCam(target, lim); return; }
      walkToward(Math.exp(-e.deltaY * 0.0015), e.x, e.y);
    });
    // the view leans toward wherever the pointer is, or as the phone is held (the page works it out)
    host.on('lean', e => { lean.x = clamp(e.x, -1, 1); lean.y = clamp(e.y, -1, 1); });

    // the keys (the page passes on what is not typed, with no Ctrl, Alt, ⌘ — and keeps the scene's own, KEYS, from the
    // page while it moves: fixed())
    host.on('keydown', e => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === '0') { reset(); return; }
      // (P by the key itself, whatever the layout: З on a Russian one)
      if (e.code === 'KeyP') { PERF.on = !PERF.on; PERF.ms.clear(); if (!PERF.on) host.perf(null); return; }
      if (KEYS.includes(k) && !fixed()) keys.add(k);
    });
    host.on('keyup', e => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
    host.on('blur', () => keys.clear());

    // The people of a spec: their engine's part loaded (people.js, the skeleton, the figures), then each made — or
    // kept: the same person of the same cast — and what their look needs fetched. null when all is here, else a
    // promise of it. (What failed to load: no people — said.)
    let settled = null, peopleLoad = null, peopleFailed = false;
    const NO_CAST = Object.freeze({});  // (a person of no cast: the engine's alone — the same each time it is shown)
    function peopleOf(next, kit) {
      const list = (Array.isArray(next.objects) ? next.objects : []).filter(o => o && o.person);
      if (!list.length || peopleFailed) { PEOPLE.clear(); return null; }
      if (!globalThis.MooodPeople?.loaded()) {
        return peopleLoad ??= Promise.resolve().then(() => { if (!globalThis.MooodPeople) importScripts(new URL('people.js', HERE).href); }).then(() => MooodPeople.load())
          .catch(err => { peopleFailed = true; warn(`people: ${err?.message || err}`); });
      }
      const kept = new Map(), waits = [];
      for (const o of list) {
        if (o.id == null) { warn(`${o.name || 'person'}: a person needs an id — the keys of their state are named by it`); continue; }
        const name = o.person.cast, cast = name == null ? NO_CAST : kit[name];
        if (name != null && !cast) warn(`${o.id}: "cast": no module ${name} among the scene's modules`);
        const key = JSON.stringify(o.person), was = PEOPLE.get(String(o.id));
        const P = was && was.key === key && was.from === cast ? was : MooodPeople.make(o, cast || NO_CAST);
        P.key = key; P.from = cast;
        kept.set(String(o.id), P);
        const w = P.ready();
        if (w) waits.push(w);
      }
      PEOPLE.clear();
      for (const [id, P] of kept) PEOPLE.set(id, P);
      return waits.length ? Promise.all(waits).catch(err => warn(`people: ${err?.message || err}`)) : null;
    }
    // the spec as drawn: each person as tall as their figure, their box round them
    const peopled = next => (!PEOPLE.size ? next : { ...next, objects: next.objects.map(o => {
      const P = o && o.person && PEOPLE.get(String(o.id));
      return P ? { ...o, height: P.height, box: P.box.map(v => v * P.height) } : o;
    }) });
    // the people where they stand now, doing what the state says (their keys: people.js) — and the points they mark
    // (the head: what speaks over them; head, hands: what the camera and the game may aim at)
    // A person's aim — what they look at or reach for — as a point of the world (metres: across, up, distance): an
    // element's id (a person's head; an element's point — its e.at, else its anchor), "id#name" (a point it names: a
    // person's head, hand_r, hand_l, shoulder_r, shoulder_l, chest, hips, feet; an element's e.at name), or [across, distance, elevation]
    aimOf = personAim;
    function personAim(v, who) {
      if (Array.isArray(v)) return v.length >= 2 && v.every(Number.isFinite) ? [v[0], v[2] ?? 0, v[1]] : (warn(`${who}: aims at [across, distance, elevation] (metres)`), null);
      if (typeof v !== 'string' || !v) return null;
      const [id, name] = v.split('#'), P = PEOPLE.get(id);
      // (not posed yet — before their first frame — none of their points is anywhere: nothing to warn of)
      if (P) return P.point(name || 'head') ?? (!P.point('head') ? null : (warn(`${who}: ${id} has no point "${name}" (head, hand_r, hand_l, hands, shoulder_r, shoulder_l, chest, back, nape, hips, foot_r, foot_l, feet — and those of the parts they have with them)`), null));
      const o = byId.get(id);
      if (!o) { warn(`${who}: aims at "${id}" — no element of that id`); return null; }
      const n = dzOf.now(o), pt = name ? namedOf(id, name) : focusOf(id), q = worldOf(n.o, pt?.x ?? 0, pt?.y ?? 0, pt?.part ?? null);
      return q && q.map(c => c * EYE);
    }
    // Hand in hand: a hand reaching for another's hand ("guide#hand_r") that reaches back for it ("led#hand_l") — the two
    // meet between, where each one's motion has it (each hand chasing where the other is would never rest): halfway, or,
    // where one of them cannot reach so far (a tall man a step behind, both arms hanging), the nearest to it that both
    // arms reach — the hands raised to each other; null if it is not so
    function handInHand(id, h, ref) {
      const m = (h === 'r' || h === 'l') && typeof ref === 'string' && /^(.+)#hand_([rl])$/.exec(ref);
      if (!m || STATE.values[`${m[1]}_reach`]?.[m[2]] !== `${id}#hand_${h}`) return null;
      const A = PEOPLE.get(id)?.arm(h), B = PEOPLE.get(m[1])?.arm(m[2]);
      if (!A || !B) return null;
      // (from halfway, brought each time to what both arms reach: the mean of the nearest points within each one's reach —
      // the same for both of them, whichever asks)
      const within = (q, S) => {
        const d = [0, 1, 2].map(k => q[k] - S.shoulder[k]), l = Math.hypot(...d), r = REACHED * S.length;
        return l <= r ? q : d.map((v, k) => S.shoulder[k] + v * r / l);
      };
      let q = [0, 1, 2].map(k => (A.hand[k] + B.hand[k]) / 2);
      for (let i = 0; i < 24; i++) { const a = within(q, A), b = within(q, B); q = [0, 1, 2].map(k => (a[k] + b[k]) / 2); }
      return q;
    }
    function stepPeople(t) {
      const v = STATE.values;
      for (const o of spec.objects) {
        const P = o.person && PEOPLE.get(String(o.id));
        const at = P && dzOf.now(o).o._at;
        if (!at) continue;
        const id = String(o.id), keys = Object.fromEntries(PERSON_KEYS.map(n => [n, `${id}_${n}`]));
        for (const k of Object.values(keys)) STATE.read.add(k);
        const got = Object.fromEntries(Object.entries(keys).map(([n, k]) => [n, v[k]]));
        // (what they look at and reach for: points of the world)
        got.look = personAim(got.look, id);
        got.aims = got.reach && typeof got.reach === 'object' ? got.reach : null;
        got.reach = got.aims ? Object.fromEntries(['r', 'l', 'foot_r', 'foot_l'].map(h => [h, handInHand(id, h, got.aims[h]) ?? personAim(got.aims[h], id)])) : null;
        // (on another's arms: turned as they are, as much again as their own turn says; not on the land, no steps)
        // (sat on a seat: turned as their own turn says; neither: no steps, not on the land)
        // (on a thing: turned as it is turned — its own turn 180, the start's way, is theirs as it says)
        const held = heldBy(got.on), by = held?.at && PEOPLE.get(held.at.split('#')[0]), thing = held?.at && !by && byId.get(held.at.split('#')[0]);
        if (by) got.turn = (by.facing() * 180) / Math.PI + (typeof got.turn === 'number' ? got.turn : 0);
        else if (thing) got.turn = yawOf(dzOf.now(thing).o) - 180 + (typeof got.turn === 'number' ? got.turn : o.person.turn ?? 180);
        if (held) got.steps = false;
        got.held = !!held;
        // (sat on a seat: the floor under it — the land there and what they stand on off the seat, their own elevation)
        if (held?.seat) got.floor = typeof o.place?.elevation === 'string' && typeof v[o.place.elevation] === 'number' ? v[o.place.elevation] : o.elevation ?? 0;
        // (on something that heels — a deck: they stand on its plane through where they stand, as on a slope of the land)
        const F = o.on != null && !held ? dzOf.placed(o)._frame : null;
        const deck = F && Math.abs(F.up[1]) < 0.9999 ? (x, z) => at.elevation - (F.up[0] * (x - at.across) + F.up[2] * (z - at.distance)) / F.up[1] : null;
        P.update(t, at, got, held ? null : deck ?? dzOf.footing ?? (SHARED.ground ? groundAt : null), STATE.shots);
        // (as tall as their look is now — after what they wear now is put on: one that wears another height, the boy years
        // later — their card round them as they are now: an arm raised, lying full length)
        const box = P.box.map(v => v * P.height);
        if (o.height !== P.height || box.some((v, i) => v !== o.box?.[i])) { o.height = P.height; o.box = box; }
        // (marked as beforeFrame marks: this frame's, drawn or not — the head their point, and by its name)
        for (const [n, q] of Object.entries(P.points())) { mark(id, q[0], q[1], n); if (n === 'head') mark(id, q[0], q[1]); }
      }
    }

    const loop = now => {
      requestAnimationFrame(loop);
      const moving = keys.size > 0 || pointers.size > 0 || !!glide || operating() || (plat && (Math.abs(plat.vx) > 0.01 || !plat.ground)) || Math.abs(target.x - cam.x) + Math.abs(target.y - cam.y) + Math.abs(target.z - cam.z) + Math.abs(target.h - cam.h) + Math.abs(target.yaw - cam.yaw) > 0.001;
      if (moving) activeUntil = now + 500;
      const fps = now < activeUntil ? FPS_ACTIVE : fpsIdle;
      const real = (now - last) / 1000;
      // skip this display refresh; the tolerance is under half a refresh so vsync jitter
      // never drops a frame we meant to draw (that made 30 fps stutter at ~27)
      if (real < 1 / fps - 0.006 && !owed) return;
      owed = false;
      const dt = Math.min(0.05, real), was = t;
      last = now; t = Math.max(t, (performance.now() - born) / 1000);
      STATE.sample?.(); // the state's moves where they are this very moment
      if (spec && !waiting) beforeFrame(t, t - was);
      if (spec && !waiting && PEOPLE.size) stepPeople(t);
      if (real < 0.5) frameEma += (real - frameEma) * 0.1; // ignore tab-switch gaps
      adapt(now, fps);
      // a brisk walk: ~6 m/s forward, ~3.5 m/s sideways (world units are eye heights)
      const step = dt * 2;
      if (plat) stepHero(plat, dt);
      else if (round()) {
        // looking around: arrows left and right turn; roaming, W S walk where you look and A D
        // step aside; standing, W S and the arrows up and down look up and down, A D turn too
        const turn = dt * 1.4;
        if (keys.has('ArrowLeft')) target.yaw -= turn;
        if (keys.has('ArrowRight')) target.yaw += turn;
        if (roam()) {
          if (keys.has('w') || keys.has('ArrowUp')) stepTo(target.yaw, step * 1.5);
          if (keys.has('s') || keys.has('ArrowDown')) stepTo(target.yaw, -step * 1.5);
          if (keys.has('a')) stepTo(target.yaw - Math.PI / 2, step);
          if (keys.has('d')) stepTo(target.yaw + Math.PI / 2, step);
        } else {
          if (keys.has('a')) target.yaw -= turn;
          if (keys.has('d')) target.yaw += turn;
          if (keys.has('w') || keys.has('ArrowUp')) target.y -= dt * 0.6;
          if (keys.has('s') || keys.has('ArrowDown')) target.y += dt * 0.6;
        }
      } else {
        if (keys.has('ArrowLeft') || keys.has('a')) target.x -= step;
        if (keys.has('ArrowRight') || keys.has('d')) target.x += step;
        if (keys.has('ArrowUp') || keys.has('w')) target.z += step * 1.8;
        if (keys.has('ArrowDown') || keys.has('s')) target.z -= step * 1.8;
      }
      if (fixed()) leanTo(t);
      keepInView();
      limitCam(target, lim);
      overTarget(dt);
      if (glide && pointers.size === 0) {
        target.x += glide.vx * dt; target.y += glide.vy * dt; target.yaw += glide.vyaw * dt;
        limitCam(target, lim);
        const f = Math.exp(-dt * 4);
        glide.vx *= f; glide.vy *= f; glide.vyaw *= f;
        if (Math.abs(glide.vx) + Math.abs(glide.vy) + Math.abs(glide.vyaw) < 0.005) glide = null;
      }
      // the camera eases toward the target: quickly under the finger (a light trail, ~55 ms),
      // more softly for the wheel and keys (~170 ms); frame-rate independent
      const k = 1 - Math.exp(-dt * (pointers.size === 1 || glide ? 18 : 6));
      cam.x += (target.x - cam.x) * k; cam.y += (target.y - cam.y) * k; cam.z += (target.z - cam.z) * k; cam.h += (target.h - cam.h) * k; cam.yaw += (target.yaw - cam.yaw) * k;
      cam.hero = plat && { id: plat.id, dx: plat.x - plat.x0, dy: plat.y - plat.y0, flip: plat.dir < 0 };
      leanShown(dt);
      const own = { ...shown };
      // on a relief (spec.relief) the viewer's eyes go over the land as they walk: 1.7 m over the
      // ground where they stand, as they were at the start
      if (SHARED.ground && !plat) shown.h += (groundAt(shown.x * EYE, shown.z * EYE) - groundAt(0, 0)) / EYE;
      directed(shown, dt);
      for (const a of AXES) off[a] = (shown[a] ?? 0) - (own[a] ?? 0);
      const t0 = performance.now();
      if (S && drawn) {
        lookOf(spec);
        ahead = ahead.filter(a => a.until > now);
        R.frame(S, spec, shown, t, dt, now >= activeUntil, op.pose ? shown : target, drawn === 'whole', ahead.map(a => cameraFor(a.values)));
        if (looking) looking.draw(shown, t);
      } else if (S) R.tick(S, t, dt);
      drawMs += performance.now() - t0;
      frames++;
      // (what people saw of it — frames.js: a frame of the scene moving, or of it standing as it is)
      if (S) host.frames?.frame(drawn && now < activeUntil ? 2 : 1, real * 1000);
      host.frames?.tick(now);
      if (now - perfAt > 1000 && PERF.on) {
        // and the elements that cost the most: their painting's ms a frame
        const costly = [...PERF.ms].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, ms]) => `\n  ${(ms / frames).toFixed(2).padStart(6)} ms  ${k.slice(0, 28)}`).join('');
        host.perf(`${R.name} · ${Math.round(frames * 1000 / (now - perfAt))} fps (cap ${fps})\n${canvas.width}×${canvas.height} · res ${res.toFixed(2)}\njs ${(drawMs / frames).toFixed(1)} ms/frame${costly}`);
        frames = 0; drawMs = 0; perfAt = now; PERF.ms.clear();
      } else if (now - perfAt > 1000) { frames = 0; drawMs = 0; perfAt = now; }
      host.drawn();
    };
    requestAnimationFrame(loop);
    return {
      // modules: where the spec's modules come from (kit.js: {world, refs} or {texts})
      show(next, modules) {
        // what the scene's code shares (its modules may still be on their way): shown once they are here
        const shared = MooodKit.shared(next, modules);
        const later = shared instanceof Promise ? shared : peopleOf(next, shared.kit);
        if (later) { waiting = next; settled = later.then(() => { if (waiting === next) { waiting = null; this.show(next, modules); } }); return; }
        if (SHARED?.tr !== shared.tr) compiled.clear();  // (the code made with another translator: made anew)
        waiting = null; SHARED = shared; settled = null;
        spec = peopled(next); FOCUS.clear(); NAMED.clear(); MARKED.clear(); NOTES.clear(); PARTS.clear(); PERF.last.clear(); warned.clear(); STATE.read.clear(); BEFORE.clear(); PERF.repaints.clear();
        dzOf = depths(spec); byId = new Map((spec.objects || []).filter(o => o.id != null).map(o => [String(o.id), o]));
        // values not set yet (the state may start after the scene is shown) are where the scene starts them
        if (spec.state && typeof spec.state === 'object') STATE.values = { ...spec.state, ...STATE.values };
        // a new level, or the same one edited: the hero stays where it got to
        const was = plat; plat = platformOf(spec); HERO.id = plat?.id ?? null;
        if (plat && was && was.id === plat.id) Object.assign(plat, { x: was.x, y: was.y, floor: was.floor, dir: was.dir });
        // (what the scene's code keeps worked out before anything is painted — the scene's first painting too)
        beforeFrame(t, 0);
        if (PEOPLE.size) stepPeople(t);
        rebuild();
        lookOver(spec, dzOf);
        if (plat) { Object.assign(target, { x: plat.x / EYE }); Object.assign(cam, target); }
      },
      // a platformer's hero now: { across, elevation (metres), ground } — or null
      hero: () => (plat ? { across: plat.x, elevation: plat.y, ground: plat.ground } : null),
      // when what the scene shown needs is here (its modules, its people) — a render waits for it (each step of it: the
      // modules, then the people's engine, then what their looks need)
      ready: async () => { while (settled) await settled; },
      // ... and it is drawn: the renderer had all it waits for before it draws it (R.warming: its programs) — the page
      // shows it then (the viewer's picture goes). (Frames go by: not in a render, whose clock stands still till moved.)
      seen: async () => { while (settled) await settled; for (let w; (w = R.warming(S)); ) await w; },
      // where person id's motion `name`, done once facing `turn` (degrees) at its end, begins (scenestate.js: go) —
      // {across, distance, turn}, from its end; null: no such person or motion (yet)
      startOf: (id, name, turn) => PEOPLE.get(String(id))?.startOf(name, turn) ?? null,
      resetCamera() { reset(); Object.assign(cam, target); },
      // the part of the canvas not covered by the page's panels, as fractions of its width
      setView(left, right) { seen = [left, right]; lim = { ...lim, view: openView() }; },
      // where the frame lies in the canvas (CSS px)
      frame: () => ({ ...box }),
      // whether the viewer's moves are the scene's own now (a fixed camera, a level's hero): the keys go to the page
      fixed: () => fixed(),
      // where the camera is now (for picking things on screen, select.js)
      camera: () => ({ x: shown.x, y: shown.y, z: shown.z, h: shown.h, yaw: shown.yaw, pan: shown.pan || 0, roll: shown.roll || 0, hero: shown.hero }),
      // the scene's state changed (scenestate.js): the painting code sees it as e.state
      // was(key, ago): what a value was `ago` seconds ago (e.was); sample(): brings the values that
      // are moving to where they are now — called as each frame starts, so it paints them on time
      // cutAt: when the last cut was (the scene's start or scene.cut); shots: how many scene.cuts; views: how many times the
      // camera has been elsewhere at once (a new shot: the renderer makes all it shows before it is shown)
      setState(values, was, sample, cutAt, shots, views) {
        STATE.values = values || {}; if (was) STATE.was = was; if (sample) STATE.sample = sample;
        if (cutAt != null) STATE.cut = (cutAt - born) / 1000;
        if (shots != null) STATE.shots = shots;
        if (views != null) STATE.views = views;
        STATE.ver++; activeUntil = performance.now() + 300;
      },
      // where in the canvas (CSS px) an element is now — the point its code marks (e.at), else its
      // anchor (its top, with over); 'id#name' — a point its painting names — lifted by `lift`
      // metres: [x, y, its distance]; null when out of sight (behind the eye, passed, a point its
      // painting doesn't mark now)
      screenOf: (ref, lift = 0, over = false) => seenFrom(shown, ref, lift, over),
      // the ground's height (metres) at (across, distance): spec.relief, 0 without one
      ground: groundAt,
      // the state keys the shown scene's painting has read so far — its elements' code, its modules
      read: () => STATE.read,
      // the camera will be as `values` say (its keys) in about `seconds` (scenestate.js prepare): what it will see made
      // ready meanwhile, with what the frames leave (R.frame: ahead)
      prepare(values, seconds) { ahead.push({ values, until: performance.now() + (Math.max(0, seconds) + 1) * 1000 }); },
      // the moment drawn as another camera sees it (a render's --views): `values` — the camera's keys
      // (camera_target, camera_shot, camera_x…) over the film's — one that names its target, a shot of its
      // own: the film's camera keys not under it —, the operator there at once; the film
      // itself — its state, its clock, its operator — goes on untouched (the next frame is its own)
      still(values) {
        if (!S || !spec || !drawn) return;
        const film = STATE.values;
        try {
          if ('camera_target' in values) STATE.values = Object.fromEntries(Object.entries(film).filter(([k]) => !k.startsWith('camera_')));
          const c = cameraFor(values);
          STATE.values = { ...STATE.values, ...values, camera_glide: 0 };
          lookOf(spec);
          R.frame(S, spec, c, t, 0, false, c, drawn === 'whole');
          if (looking) looking.draw(c, t);
        } finally { STATE.values = film; }
      },
      // true: drawn; false: the scene goes on unseen; 'whole': drawn, its view's tiles all painted (above)
      draw(how = true) { owed = !!how && how !== drawn; drawn = how === true || how === 'whole' ? how : false; return drawn; },
      // what is where now, for whoever looks closely: { t (s), camera, frame (CSS px), elements (layout) }
      inspect: () => ({ t: Math.round(t * 1000) / 1000, camera: Object.fromEntries(AXES.map(a => [a, Math.round(shown[a] * 1e4) / 1e4])), frame: { ...box }, elements: layout(shown) }),
    };
  }

  return {
    mount, KEYS,
    // for the WebGL renderer (world.js): the one-time painting code and camera maths
    internals: { clock, STAGE, TAU, project, rollOf, invert, mul, placeOf, camSetup, heroMatrix, STATE, READS, EXT, DEEP, Z_FAR, EYE, depths, view, limits, nearFade, objectBox, anchorOf, iris, opening, warn, hash, clamp, layer, rgb, glowSprite, staticLayer, drawObject,
      PEOPLE, away, lightsAt, orderRules, arrange, clipOf, groundAt, CHECK, planeOf, overMirror, glassOf, onPlane, groundNormal, planeTile, planeShift, turnOf, axesOf, cardWorldOf, cardUnder,
      lookOf, hazeReach, airOf, airGlow, sourcesNow, SOURCES, flickerNow, glowOn, redrawOf, moved, PERF, shadowsOf, shadowLights, rayHit, groundHit, ambientOf, reachShare, softOf, translucentOf },
  };
})();
