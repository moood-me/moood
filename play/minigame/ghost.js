// The ghost finger (docs/games/miniux/language.md §2.4): a see-through round a little larger than a fingertip (it grows
// with the frame as the marks do — the root's --mg-k), with a clear rim, a soft shadow and a short fading trail, that
// does gestures on their real marks — presses (it sinks in), holds, drags, rubs, turns. The player's touch stops it.
// It goes by the page's clock (it stands while the play is paused).
//   const ghost = createGhost(root)
//   ghost.show(parts) → a promise: done (true) or stopped (false). parts: [{moves, follow}, …] — one after another;
//     moves: [{x, y, down, ms}, …] — from the first, each reached over its ms (the first: where it appears), down:
//     pressed there; follow(p, down) — each frame of its part (the gesture shows its thing going with it),
//     follow(null) — its part has ended, or the showing was stopped
//   ghost.stop(); ghost.showing
import { el } from './layer.js';

const TRAIL = 6;
export function createGhost(root) {
  const g = el('div', 'mg-ghost', root);
  const dot = el('i', 'mg-ghost-tip', g);
  // (the trail fades and narrows behind the tip)
  const trail = Array.from({ length: TRAIL }, (_, k) => {
    const d = el('i', 'mg-ghost-trail', g);
    d.style.opacity = 0.6 * (1 - k / TRAIL);
    d.style.scale = 1 - 0.5 * k / TRAIL;
    return d;
  });
  g.hidden = true;
  let raf = 0, ending = null, following = null;
  const stop = ok => {
    cancelAnimationFrame(raf); raf = 0;
    g.hidden = true;
    const end = ending, f = following; ending = following = null;
    f?.(null);
    end?.(ok);
  };
  return {
    get showing() { return !!ending; },
    show(parts) {
      stop(false);
      // (one line of keys: each key knows whose part it is)
      const keys = [];
      let t = 0;
      for (const part of parts) for (const m of part.moves) { t += m.ms || 0; keys.push({ ...m, t, follow: part.follow || null }); }
      if (!keys.length) return Promise.resolve(true);
      const total = t + 400, past = []; // (the last pose held a moment, then it fades)
      let began = null;
      g.hidden = false;
      return new Promise(ok => {
        ending = ok;
        const frame = now => {
          began ??= now;
          const at = now - began;
          if (at >= total) { stop(true); return; }
          let i = keys.findIndex(k => k.t >= at);
          if (i < 0) i = keys.length - 1;
          const a = keys[Math.max(0, i - 1)], b = keys[i];
          const u = b.t > a.t ? ease((at - a.t) / (b.t - a.t)) : 1;
          const x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u;
          // (pressed while it moves to a pressed key from a pressed one; the press itself at a key)
          const down = u >= 1 ? b.down : a.down && b.down;
          dot.style.translate = `${x}px ${y}px`;
          g.classList.toggle('mg-down', !!down);
          // (a part over: its gesture told so; the next one's from here)
          if (b.follow !== following) { following?.(null); following = b.follow; }
          following?.({ x, y }, !!down);
          past.unshift([x, y]);
          past.length = Math.min(past.length, TRAIL * 3);
          trail.forEach((d, k) => {
            const p = past[(k + 1) * 3 - 1] || past[past.length - 1];
            d.style.translate = `${p[0]}px ${p[1]}px`;
          });
          g.style.opacity = at < 200 ? at / 200 : at > total - 300 ? Math.max(0, (total - at) / 300) : 1;
          raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
      });
    },
    stop: () => stop(false),
  };
}
const ease = u => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
