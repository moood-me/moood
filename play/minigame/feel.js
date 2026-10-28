// What the mini-game language sounds and feels like (docs/games/miniux/language.md §6): the sounds the owner picked from the
// board (sounds.js — LANGUAGE says which for each role and process), as loud as the site's "sounds" slider
// (MooodVolume.output), through a small room, and the phone's vibration (Android; an iPhone has none — nothing rests on
// it). Their character (П40, П42, П48): low, on the game's key (its tonic and pure intervals over it); what is right
// is a fifth and an octave, what is not a tritone, an augmented or a diminished chord. A game may replace any sound by
// its own (§7).
//   const feel = createFeel()
//   feel.play(role, opts) — once: enter, tap, snap, halfway, miss, slip, fault, quarter, beat ({strong}), tick, found, end
//     ({how: 'clean' | 'flawed' | 'neutral' | 'loss'}); a game's own for that role if its style has one
//     (fn({ctx, out, at, opts}))
//   feel.tone(role) → {set(u, level), stop()} — a process (П47), lasting while it goes on: fill (u — how full),
//     motion (level — the finger's speed), seek (u — how near), zone (u 1 in it, 0 out),
//     tension (u — the danger), time (u — how near the limit; level 0 — the time stands)
//   feel.buzz(ms | [ms…]) — a vibration, if the phone has one and the game's style allows it
//   feel.style(style) — the game's key (style.key: Lyria's name of a relative pair, sounds.js KEYS; none — KEY, D
//     major / B minor), its sounds and whether it vibrates; feel.mute(on) — no sound at all (the author's switch); feel.pause(on) — the audio stands with the play; feel.away(on) — and while the page is not seen
//   feel.wake() — the page may be heard: called on a touch (a browser lets audio start only then)
//   feel.heard() → {sounds: [[event, as]…], tones: [[process, as]…]} — what the language sounds, by role (the author's
//     board: an event 'end:<how>' is played as play('end', {how}))
import { LANGUAGE, KEYS, KEY, sound, layer, load } from './sounds.js';

export function createFeel() {
  let ctx = null, out = null, key = KEY, own = {}, vibrate = true, muted = false, paused = false, away = false;
  const live = () => !!ctx && ctx.state === 'running' && !muted;
  // (the audio stands while the play is paused or the page is not seen; goes on when neither holds)
  const stand = () => { if (!ctx) return; if (paused || away) ctx.suspend(); else ctx.resume(); };
  const turn = {}; // event → which of its sounds is next (taken in turn)
  const audio = () => {
    if (ctx) return ctx;
    ctx = new AudioContext();
    // the chain: the sounds → dry and a small room → as loud as the site says
    out = ctx.createGain();
    out.gain.value = 1.1;
    const room = ctx.createConvolver(), wet = ctx.createGain(), level = MooodVolume.output(ctx);
    room.buffer = roomOf(ctx);
    wet.gain.value = 0.28;
    out.connect(level);
    out.connect(room).connect(wet).connect(level);
    level.connect(ctx.destination);
    load(ctx); // (the recorded ones, fetched once)
    return ctx;
  };
  // into the chain, k as loud
  const into = k => { const g = ctx.createGain(); g.gain.value = k; g.connect(out); return g; };
  // an event's sound: the end by how it ended; a strong beat a little louder
  function voice(name, opts) {
    const role = name === 'end' ? `end:${opts.how || 'clean'}` : name, v = LANGUAGE.sounds[role];
    if (!v) return;
    const i = turn[role] = ((turn[role] ?? -1) + 1) % v.ids.length;
    const k = v.k * (name === 'beat' && opts.strong ? 1.3 : 1);
    sound(v.ids[i], key).play(ctx, into(k), ctx.currentTime).catch(() => {});
  }
  return {
    // → a promise: once it may be heard (or could not be)
    wake() { audio(); return ctx.state === 'suspended' && !paused && !away ? ctx.resume().catch(() => {}) : Promise.resolve(); },
    play(name, opts = {}) {
      if (!live()) return;
      try {
        if (own[name]) own[name]({ ctx, out, at: ctx.currentTime, opts });
        else voice(name, opts);
      } catch {}
    },
    // (made once the audio may be heard: a process begun before the first touch sounds as soon as it may)
    tone(name) {
      const t = LANGUAGE.tones[name];
      let l = null, over = !t;
      return {
        set(u, level = 1) {
          if (over) return;
          if (!l && live()) { l = layer(t.id, key).make(ctx, into(t.k)); l.start(); }
          l?.set(u, level);
        },
        stop() { if (!over) { over = true; l?.stop(); } },
      };
    },
    buzz(ms) { if (vibrate && !muted) try { navigator.vibrate?.(ms); } catch {} },
    style(s = {}) {
      if (s.key !== undefined && !KEYS.includes(s.key)) throw new Error(`key: ${s.key} — not one of ${KEYS.join(', ')}`);
      key = s.key || KEY; own = s.sounds || {}; vibrate = s.vibrate !== false;
    },
    heard: () => ({ sounds: Object.entries(LANGUAGE.sounds).map(([e, v]) => [e, v.as]), tones: Object.entries(LANGUAGE.tones).map(([p, v]) => [p, v.as]) }),
    mute(on) { muted = !!on; },
    pause(on) { paused = !!on; stand(); },
    // the page not seen (another tab, the phone's call): what lasts stands, and goes on when it is seen again
    away(on) { away = !!on; stand(); },
  };
}

// a small room's answer: half a second of noise fading away, darker as it fades
function roomOf(ctx) {
  const n = Math.round(ctx.sampleRate * 0.6), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const c = b.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const k = i / n, x = (Math.random() * 2 - 1) * (1 - k) ** 3;
      last += (x - last) * (0.6 - 0.45 * k); // (a low-pass that closes as it fades)
      c[i] = last;
    }
  }
  return b;
}
