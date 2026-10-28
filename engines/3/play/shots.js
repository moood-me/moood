// Shots made ready ahead, and their cuts (2.3, LG4). scene.shot(values) / s.shot(values) (the director) and the page's
// call('prepare', values) make one: it lives until it is cut to or cancelled — no seconds. While it lives, every seen
// tick: what its values paint anew is made by the artist and kept as its swaps, the nodes its values place elsewhere
// are worked out (world.shot — the very object that rides in f.ahead: RN4), its camera is the one a cut to its values
// would give, its people's looks are built (people.prepare). RENDER asks its views' pages and writes `whole`,
// `bias`, `pages` (those its views still lack: the wait sign's count) and `land` (the tiles of its land still lacking) on it; `ready` is computed here only: painted && whole — and true where nothing is being played (an unseen
// step, a thread with no loop, before the scene's first frame).
//   At most SHOTS_LIVE live for each maker — each sequence; outside sequences each code by itself: the scene's script,
// an element's script, the showcase's code (the film module's shots are the film's own); the page —: a maker's next
// cancels that maker's oldest (its `ready` stays false; its cut() is a plain cut).
//   A cut whose shot is not ready waits for it (2.4: the director keeps it, the story standing): `waitFor` says which
// shot that is — the one it is by, a live one of its values, or one made now for them (maker 'cut', asked as the
// frame is) —, or null where it is made at once (ready, or nothing is being played).
//   A cut by a shot — its own cut(), or a plain cut to the very values of a ready one — gives the scene that shot's
// paintings in the cut's own step (world.shotCut) and starts the new shot from that shot's operator (camera.cutBy:
// the camera its views were asked from); at the end of that step its people's looks are let go
// (people.unprepare) and the shot ends. A shot that has been cut to is no longer cancelled — not by cancel(), not by
// its maker's next, not by its sequence ending in the cut's own tick (a sequence whose last word is the cut): its
// paintings are taken first.
import { SHOTS_LIVE, empty } from '../base.js';
import { newCamera } from './camera.js';

const keyOf = values => JSON.stringify(Object.keys(values).sort().map(k => [k, values[k]]));

// env: { world, camera (play/camera.js), state, host: { w, h }, playing() — a viewer is being shown the scene's frames
// now (a loop, its first frame drawn, no job apart) }
export function createShots(env) {
  const { world, camera, state, host } = env;
  // live: the shots; ahead: their entries of f.ahead; cut: those cut to in the step being made (each has `cut` set)
  const live = [], ahead = [], cut = [];
  // (the last cut to a live shot — by it, or plainly to the values of one, ready or not; n: how many there have been —:
  // whether that shot was ready then, and its bias: the stand's row tells it, ST2)
  const last = { n: 0, ready: false, bias: 0 };
  function end(s) {
    const i = live.indexOf(s);
    if (i < 0) return;
    live.splice(i, 1);
    s.ended = true;
    world.people?.unprepare(s.values);
    world.people?.ended();
    world.shotEnd(s.w);
  }
  return {
    // f.ahead: the live shots' entries, the same objects while each lives
    ahead,
    cut: last,
    // a viewer is being shown the scene's frames now: a shot's `ready` is worked out (else it is true)
    get playing() { return env.playing(); },
    // the shot a cut to `values` (by: a shot's own cut) must wait for — or null: it is made at once (2.4)
    waitFor(values, by) {
      if (!env.playing()) return null;
      let s = by && !by.ended ? by : null;
      if (!s) { const key = keyOf(values || {}); for (let i = 0; i < live.length; i++) if (live[i].key === key && (!s || live[i].ready)) { s = live[i]; if (s.ready) break; } }
      if (s) return s.ready ? null : s;
      return this.make(values || {}, 'cut', true);
    },
    // a shot of `values`, made by `maker` (a sequence's action; a script's or the showcase's own API object; 'page');
    // next: the showcase's own code made it — the film's next beat (its entry's `next`: RENDER asks its views at the
    // frame's weight) → { values, ready, cancel() }
    make(values, maker, next = false) {
      values = { ...values };
      const mine = live.filter(s => s.maker === maker && !s.cut);
      if (mine.length >= SHOTS_LIVE) end(mine[0]);
      const w = world.shot(values);
      w.camera = newCamera(); w.whole = false; w.bias = 0; w.pages = 0; w.land = 0; w.next = next;
      const s = { values, key: keyOf(values), maker, w, op: camera.makeOp(), version: -1, paintings: -1, cw: 0, ch: 0, painted: false, cut: false, ended: false, get ready() { return !s.ended && (!env.playing() || (s.painted && w.whole)); }, cancel() { if (!s.cut) end(s); } };
      live.push(s);
      return s;
    },
    // the scene is being cut to `values` — by a shot made ready (by: the director's own cut of one), or plainly: then a
    // live shot of those very values that is ready is the one — one of them that is not ready yet is told to the stand
    // (`cut`), and the cut is plain. Its paintings are the scene's from this step's world, and the scene's operator
    // goes on from its own (one whose camera was never worked out — made and cut to in one step — has none: the
    // operator is made fresh, as at a plain cut)
    cutting(values, by) {
      let s = by && !by.ended ? by : null;
      if (!s) { const key = keyOf(values || {}); for (let i = 0; i < live.length; i++) if (live[i].key === key && (!s || live[i].ready)) { s = live[i]; if (s.ready) break; } }
      if (s) { last.n++; last.ready = s.ready; last.bias = s.w.bias; }
      if (s && !by && !s.ready) s = null;
      camera.cutBy(s && s.version >= 0 ? s.op : null);
      if (!s) return;
      world.shotCut(s.w);
      if (!s.cut) { s.cut = true; cut.push(s); }
    },
    // a seen tick's share of every live shot (2.1 step 7; keys: those changed this step)
    step(keys) {
      empty(ahead);
      for (let i = 0; i < live.length; i++) {
        const s = live[i], w = s.w;
        world.shotStep(w, keys);
        // (its camera: as a cut to its values would have it, as things are now — the state, the place's size, the
        // paintings taken: its way round is chosen by what is painted, SH4 —, and, a shot that frames a person, every
        // tick: their point under its values is PEOPLE's answer for them posed as its cut will set them, as they are
        // now — PP5)
        const target = 'camera_target' in s.values ? s.values.camera_target : state.value('camera_target');
        const person = typeof target === 'string' && world.byId.get(world.refOf(target).id)?.kind === 'person';
        if (person || s.version !== state.version || s.paintings !== world.paintings || s.cw !== host.w || s.ch !== host.h) { s.version = state.version; s.paintings = world.paintings; s.cw = host.w; s.ch = host.h; camera.cameraFor(s.values, w.camera, s.op); }
        const looks = world.people ? world.people.prepare(s.values) : true;
        s.painted = w.painted && looks;
        ahead.push(w);
      }
    },
    // the end of a step: the shots cut to in it end (their people's looks let go)
    stepped() { while (cut.length) end(cut.pop()); },
    // every shot let go (a moment restored, a scene stopped)
    clear() { empty(cut); while (live.length) end(live[0]); empty(ahead); },
  };
}
