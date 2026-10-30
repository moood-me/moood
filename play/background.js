// A game's background — its beds of sound (the sea, the wind, a clock…) — as the game declares it, sounded where the
// picture changes (play/runtime.js: bespoke.background, show's `background`, bespoke.onBackground). The game says what
// its background is from now on — {bed: level (0…1)}, every other bed of its silent, {} none: data, its own names — and
// its code makes the sounds (fn(levels, seconds): each bed it names to its level, every other to silence, over
// `seconds`); the page says when and how fast. Declared while a show is under way, it waits for that show's cut — the
// moment its music crossfades —, else it sounds at once; each change over the music's crossfade (`fades(was)`: was —
// whether a background sounded before; none yet, the play's start: as a music comes in where none sounded). The same
// background declared again changes nothing.
//   const bg = createBackground({ fades, trouble })
//   bg.declare(levels) — the background from now on (bespoke.background)
//   bg.awaits(show, levels) — a show under way (its number; levels, if it declares one): what is declared waits for its
//     cut; bg.cut(show) — that show's cut (or its end without one: failed, or another took its place): sounded now, if
//     it was that show the background waited for
//   bg.on(fn) — fn(levels, seconds) as it changes: the game's code sounding it
export function createBackground({ fades, trouble }) {
  let declared = {}, sounded = null, awaited = 0; // (declared; sounded last — none yet; the show whose cut it waits for)
  const sounders = [];
  const levels = l => {
    if (!l || typeof l !== 'object' || Array.isArray(l)) throw new Error('a background is {bed: level, …}');
    return Object.fromEntries(Object.entries(l).map(([k, v]) => [k, Math.max(0, Number(v) || 0)]).filter(([, v]) => v > 0));
  };
  function sound() {
    if (JSON.stringify(declared) === JSON.stringify(sounded)) return;
    const seconds = fades(!!sounded && Object.keys(sounded).length > 0);
    sounded = declared;
    for (const fn of sounders) try { fn({ ...sounded }, seconds); } catch (e) { trouble(e); }
  }
  return {
    declare(l) { declared = levels(l); if (!awaited) sound(); },
    awaits(show, l) { if (l !== undefined) declared = levels(l); awaited = show; },
    cut(show) { if (awaited === show) { awaited = 0; sound(); } },
    on: fn => { sounders.push(fn); },
  };
}
