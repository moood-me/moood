// A bespoke play, run on a page that has its places (#scene, #underlay, #minigame, #layer, #trouble) and the scene runtime's
// scripts (index.html): the game is its own code — its files, at the commit the play began on (`code`): its game.js
// is imported and its default export run with `bespoke`, what the page gives it. The page knows nothing of the
// game; where the play's scenes, save and voices come from is the page's (play.js: the host's, docs/host.md).
//   bespoke.game, .play — {id, title, mine: the player is its author}, {id}
//   bespoke.lang — the language the play is shown in (i18n.js: the game's texts, its scenes', the voices, in it). The
//     game's code has `tr` (i18n.js: tr, tr.n, tr.c) — its texts (written in the source language, as literals) in it,
//     by the game's translations (bespoke/lang/<lang>/strings.json); bespoke.data(name) → a promise of its data in it
//     (bespoke/lang/<lang>/<name>.json: what is made of the language itself — a hymn's syllables under its notes)
//   bespoke.scenes — the world's scenes, as they were when the play began: [{folder, title}]
//   bespoke.show(scene, {state, fade, captions, then}) — a scene full-screen (by its folder), its state
//     set on top of where it starts; then — where the game has got to in it: what it did there since (in order:
//     [[key, value] | ['cut', {values}] | ['wait', seconds] | ['heard', text, seconds?], …]), worked out without time before
//     it is seen — a jump into the middle of what the game does there: the old engine catches up on one clock with the
//     game (scenestate.js catchUp); engine 3 takes the values and cuts in its instant mode (bespoke.instant) as it
//     opens, before anything of it is painted — all the scene does then ends at once, as it would end (the waits and what was heard need no time there) — and
//     shows the scene in one cut. Meanwhile the game is told nothing (tell, arrived, line, cut, signal): a piece whose
//     end the game waits for (a beat that tells it is over) is set after the show, never in `then` — set there, it ends
//     unheard (engine 3 says so in the scene's warnings). fade: false
//     (the default) — the scene comes in one cut, never from black; true (1.4 s) or seconds — through black: the one
//     before fades out, the new one in once it is drawn. An engine-3 scene shown after another lives on — its film,
//     its people, its lines, as it would go — while the new one is made, and goes when that one is whole (a game shows
//     the next scene where its beat is over). Its own timed captions shown unless captions: false (the game tells it in
//     its own words); its music (music.js) crossfades in from the one before's as the new scene is shown. The page's
//     scene (bespoke.spec, its state, what its things offer) is the new one from that moment; a show that fails throws,
//     and the scene before stays the page's and the scene's. → the scene shown
//   bespoke.fade(level, seconds) — the black over the scene (the stage's: no value of the scene, in none of its
//     pictures), 0 clear … 1 black, moved there over seconds: a dim under a letter, black at the end; → a promise, done
//     when it is there. Scenes never fade themselves (an engine-3 scene has no `fade` key)
//   bespoke.specOf(scene) — a scene's spec (by its folder), shown or not: → promise
//   bespoke.spec — the shown scene's spec; bespoke.states — what its values are (spec.states: each
//     key's range or values, whether it moves smoothly, what it means), or null
//   bespoke.where(element, lift) — where it is on the screen now ({x, y, depth, seen} in CSS pixels — depth: metres
//     from the eye, Infinity for a point of the sky, 0 for an insert's; lift:
//     metres above its anchor): the point its code marks (e.at — a head), else its anchor; 'element#name'
//     — a point its painting names (e.at(x, y, 'window')); seen: the point is on what the scene shows — an
//     engine-3 scene: all its canvas, the world round its frame too; another engine's: its frame (out of
//     it, it is still where it is — off the screen's edge); null when it is nowhere to be seen — behind
//     the eye, passed, or a point its painting doesn't mark now — and the first time it is asked, till the
//     scene (in its own thread: stage.js) has said where it is, a frame later
//   bespoke.frame() — the scene's frame on the screen now ({x, y, w, h} in CSS pixels): an insert's or the sky's
//     stage heights map onto it (frame height 1)
//   bespoke.onFrame(fn) — fn() each time the scene has said where things are now (a frame of it), in the moment the
//     page's own layers over it are placed: a game moves what it lays over the scene's points there, and nowhere else
//   bespoke.pointer(element, radius, fn) → stop() — while it stands, what the pointer does within `radius` CSS pixels
//     of the element's point ('element#name' too, as where's) goes to fn({type, dx, dy, id}) — type: pointerdown |
//     pointermove | pointerup | pointercancel; dx, dy: CSS pixels from the point; id: the pointer's — and not to the
//     scene's camera (nor the wheel over it): a thing dragged, rubbed, turned over the scene; a pointer pressed there stays fn's till it is
//     let go, wherever it is dragged. (A game's own layer never stops the scene: it
//     goes on, its voices too, under whatever the game shows — unless the game pauses the play itself, bespoke.pause)
//   bespoke.ground(across, distance) — the shown scene's ground there: a promise (metres; its relief, else 0)
//   bespoke.prepare(values, seconds) — the camera will be as `values` say (its keys) in about `seconds`: what it will
//     see made ready meanwhile (a camera value set without seconds is a new shot: shown once made). An engine 3 scene:
//     `values` is a shot the game will cut to (no seconds) — made ready ahead, so that bespoke.cut(values) to it comes
//     at once, finished; → a promise of the shot's id; bespoke.unprepare(id) — a shot made ready that will not be cut to
//   bespoke.cut(values, {fade}) — the shown scene cut to its values (a shot: its camera, where its people are…); fade:
//     seconds — through black (the black lifted once the cut's picture is there). A cut whose picture is not ready
//     yet makes the scene's story wait for it — its lines, its film — while the last picture lives on (engine 3)
//   bespoke.get(key) / .set(key, value, seconds) / .on('change', [key,] fn(value, old, key)) — the
//     shown scene's state (scenestate.js): what its painting and its scripts follow; 'change' once, as
//     a value is set (with seconds: where it goes); .on('move', [key,] fn(value, last, key)) — each
//     frame while a value moves
//   bespoke.offer({ <element id>: [{id, label} | label, …] }) — what the player can do with which of
//     the shown scene's elements (actions.js; they glow softly meanwhile): they pick one, then one of its actions;
//     {} — nothing. Only an engine 1 scene: on engine 3 a choice is the language of mini-games' (bespoke.minigame,
//     plate: false)
//   bespoke.on('act', fn(element, action)) — the player did it (the element: {id, name…})
//   bespoke.say(who, text, {at, how, spoken}) — a line someone of the game's people (bespoke/people.json: {who: {voice, how,
//     short}} — voice: the voice's name (the host's, docs/host.md: speak); how: the manner it lasts, in English; short:
//     what the player reads them as) says in the scene (speech.js), in the play's language: over the element `at`
//     ('who#name' — over a point it names, e.at(x, y, name); by default who), or 'narrator' — low in the middle; heard
//     in their voice if they have one — its inline tags (<sigh>, <short pause>) heard, not shown; how — this line's own
//     manner, in English, after the one they last in (voices.js); spoken — what the voice says instead of the line (a
//     literal, as written — never translated: words in a language other than the play's), the line shown as their
//     subtitle, in the play's language. bespoke.think(who, text, {at, how, spoken}) — what they say
//     without words, mind to mind: their voice, a whisper inside the head; shown as “text” — Short (by default low in
//     the middle). → when it has been said (heard, if voiced): {heard — whether its voice was heard, text — what was
//     shown}. A line is written where it is said, a literal (check finds it), or kept where it is written (tr.line,
//     tr.thought — its own manner and spoken words kept with it: said as it is, with no how or spoken of its own
//     here).
//     bespoke.hush() — what is still to be said is dropped
//   bespoke.on('tell', fn(text, about, scene)) — the scene's scripts tell that something happened (scene: the folder of the
//     scene that told it — while a scene is made beside the one shown, that one goes on telling its own)
//   The director of engine 3 (a scene with "engine": 3; MooodState):
//   bespoke.act(actor, verb, ...args) → an action (actor: a person's id — walk, go, do, turn, say, look…; 'state' — set,
//     move, turn, path; 'camera' — frame, cut; 'light:<id>' — fade): awaitable ('done' | 'cancelled' | 'replaced'),
//     ending(), cancel(), pause(), resume(), finish() — at once, as it would end, on(ev, fn)
//   bespoke.signal(name, data) — the scene's sequence waiting on that event goes on
//   bespoke.on('arrived' | 'line' | 'cut' | 'signal', [who,] fn(data, scene)) — a walk's end, a line ({who, text, ev: start |
//     heard | end, duration}), a cut, a signal; scene: the folder of the scene it happened in
//   bespoke.save() → the scene at this moment, as data; bespoke.restore(data) — the scene as it was then
//   bespoke.instant(on) — the game jumping to a moment of itself: on, every action ends at once, as it would, nothing
//     drawn; off — the scene as it is then shown in one cut (a promise: done). show(scene, {then}) does it itself
//   bespoke.layer — an element over the scene for whatever the game shows; bespoke.underlay — one under the language
//     of mini-games' marks (and over the scene): what the game draws for marks to stand on (a map's trees — the marks at
//     its points on the page: minigame mark's at as a function); it takes no touch — the scene's camera has them —
//     but what of it the game gives `pointer-events: auto` (a map's pointers, forks, knots: games.md §2). The wheel
//     over the layer, the underlay and the language's marks is the scene's, as over the scene itself (the camera walks
//     toward the pointer) — but over what scrolls along its axis (a list, a panel too long: its own) and a mini-game's
//     veil or bespoke.pointer's circle (the camera stands under the hand);
//     bespoke.css(path) — a stylesheet of the game's
//   bespoke.saved — what the game kept of the play ({} at first); bespoke.keep(object) — keeps it
//   bespoke.restart() — the play from the beginning, on the game and its world as they are now
//   bespoke.trouble(text) — says (quietly, in a corner) that something went wrong
//   bespoke.at({chapter, step, replay}) — where the play is in the game's own story now (a step of a chapter begun:
//     numbers or names, as the game counts them; replay — played again, not the main run); bespoke.ended(about) — the
//     play played through (about: how it ended, if it ends in more ways than one — {ending}). For the account of what
//     players do (MooodSeen, the host's: docs/host.md): what is done after it is of that chapter and step, the time on
//     each is seen
//   bespoke.minigame — the language of mini-games (minigame/index.js; docs/games/miniux/language.md), for an engine 3 scene: a vocabulary,
//     no logic — start({phrase, sample, plate, signal}) → a mini-game: marks on the scene's points, gestures on them or
//     anywhere that report what the hand does every frame (press, hold, pull, trace, turn, rub, seek, rhythm, lead,
//     touch), the responses the game calls (snap, error, glow, sceneTurn, end), the ghost finger, sounds, the plate
//     the game fills — the same in every game; tricks — ready ones made of it (minigame/tricks.js: hold till full,
//     steps with notches, the ghost at the first meeting…); relative(p, a, b) — a page point between two points of the
//     scene (where to draw a thing carried); style(s) — the game's look and key of it. Its author's tools, only while the author
//     plays (b.game.mine): author.settings({sound, debug}) — the language as with no sound, its debug drawn;
//     author.forget() — every gesture as if never shown (the tricks' ghost shows it again); author.sounds — the
//     language's sounds to hear one by one (list, play, tone: a board of them). skip() → whether a mini-game was
//     going — it is told 'skip' (the language has no ⏭ of its own: the game calls this from the page's ⏭ —
//     bespoke.forward — when it lets the mini-game be skipped; a game without forward, from its own ⏭)
//   bespoke.pause(on) — the play paused (true) or going on: its time stands (the game's timers, the scene's painting
//     and film: clock.js), the voice heard and the music wait, the page's animations stand (an engine 3 scene stands
//     for other reasons too — nobody watching it, a layer of the site over it —, its voices and music with it: they go
//     on when none of the reasons holds); bespoke.paused — whether it is. The pause is the page's: its ⏸, the same for
//     every game — a game draws none of its own
//   bespoke.onPause(fn) — fn(paused) as the play is paused or goes on: what the game stops itself (its own sounds)
//   bespoke.menu(open) — what the page's ☰ opens: the game's own menu (its chapters, where the play stands), drawn as the
//     game likes; open() each time ☰ is pressed. None (null, or never given) — no ☰. A game draws no ☰ of its own
//   bespoke.forward(fn) — the page's ⏭ (and Space, but in a field typed into), shown while fn is given: pressed, a line
//     being heard (speech.js) is sped up first — smoothly to ×2.5, its voice at its own pitch; pressed again, or with no
//     line heard, fn(): the game goes on to its next interaction — the next line, choice, mini-game, scene or shot, as it
//     decides —, what is between ending at once (bespoke.instant) and its lines unsaid; or, in a mini-game, skips it.
//     null — no ⏭. Nothing while the play is paused. Where the game shows it is its own (docs/games/games.md:
//     where the player has been, a mini-game it lets go); a game that never gives it has none of the page's
import { createMinigames } from './minigame/index.js';
import { createTricks } from './minigame/tricks.js';
import { words } from '../i18n/words.js';
import { heard } from './voices.js';

const { MooodI18n } = globalThis;

// game — {id, title, mine: the player is its author}; play — {id}; lang — the language it is shown in; scenes —
// [{folder, title}] the play's; people — the game's (bespoke/people.json, {} — none); load(scene) — a promise of it as
// the play has it in that language ({spec, modules, strings, files — where its world's files are by their sha:
// kit.js}); saved — what the game kept; keep(save) — a promise of it kept; restart() — the play anew; code — where the game's files are (a URL, ending in /); speak — a line's voice
// (speech.js: speak); music — a scene's music, its key and its stream (music.js: {track, listen} — one not heard is said
// in a corner); over — the page's elements over the scene's edges, its bar: the lines said kept off them (speech.js);
// ready(bespoke) — the page's own hold on the play, before the game is run (its ⏸: bespoke.pause); menu(open) — the
// game's menu given or taken (bespoke.menu: the page shows its ☰ while there is one, and calls open()); forward(press) —
// the page's ⏭ given or taken (bespoke.forward: shown while there is one, press() as it is pressed — Space is the
// runtime's own)
export async function start({ game, play, lang, scenes, people, load, saved, keep, restart, code, speak, music, over = [], ready = null, menu = () => {}, forward = () => {} }) {
  const $ = id => document.getElementById(id);
  // the play's words: the page's own (this folder's), the game's — in the play's language
  const json = async path => {
    const r = await fetch(`${code}${path}`);
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    return r.json();
  };
  const strange = lang === MooodI18n.source || lang === MooodI18n.PSEUDO;
  const [tr, gameWords] = await Promise.all([words(new URL('./', import.meta.url), lang),
    strange ? [] : json(`lang/${lang}/strings.json`).then(f => f.strings || [])]);
  // (the game's code has its own translator as tr)
  const gameTr = globalThis.tr = MooodI18n.translator(lang, gameWords, 'the game');
  const trouble = text => { const t = $('trouble'); t.textContent = text; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 8000); };
  const canvas = $('scene'), stage = Moood.mount(canvas), widgets = MooodWidgets.create({ canvas, stage });
  // The wheel over the page's places over the scene (the game's underlay and layer, the language of mini-games'): the
  // scene's, as over the scene itself — what of them takes a touch (a map's pointer, a fork, a mark) leaves the wheel
  // to the camera, which walks toward where the pointer is. But for what scrolls under it, along the wheel's axis (a
  // list, a panel too long for the screen: its own), and what keeps the camera still under the hand (a mini-game's
  // veil, bespoke.pointer's circle: they stop it themselves). Given to the stage as made on its place (stage.js: the
  // point where it was, the camera's walk, onInput).
  const scrolls = (e, root) => {
    const y = Math.abs(e.deltaY) >= Math.abs(e.deltaX);
    for (let n = e.target; n && n !== root && n.nodeType === 1; n = n.parentElement) {
      const o = getComputedStyle(n)[y ? 'overflowY' : 'overflowX'];
      if ((o === 'auto' || o === 'scroll' || o === 'overlay') && (y ? n.scrollHeight > n.clientHeight : n.scrollWidth > n.clientWidth)) return true;
    }
    return false;
  };
  for (const root of [$('underlay'), $('minigame'), $('layer')]) root?.addEventListener('wheel', e => {
    if (scrolls(e, root)) return;
    e.preventDefault();
    const { deltaX, deltaY, deltaZ, deltaMode, clientX, clientY, screenX, screenY, ctrlKey, shiftKey, altKey, metaKey } = e;
    canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX, deltaY, deltaZ, deltaMode, clientX, clientY, screenX, screenY, ctrlKey, shiftKey, altKey, metaKey }));
  }, { passive: false });
  // a scene's folder → it as the play has it, whole: {spec, modules — its world's modules it lists, strings, files}
  const versions = new Map();
  const versionOf = s => versions.get(s.folder) || versions.set(s.folder, load(s)).get(s.folder);
  const find = folder => scenes.find(s => s.folder === folder);

  const listeners = { act: [], tell: [] }, DIRECTOR = new Set(['arrived', 'line', 'cut', 'signal']);
  const emit = (ev, ...args) => { for (const fn of listeners[ev]) try { fn(...args); } catch (e) { trouble(String(e.message || e)); } };
  // what the player does in the play, for its account (MooodSeen: docs/host.md): the game and the play every event is of, begun or
  // gone on with; each scene shown (a step: the time on the one before), each choice, ⏭, the pause, ↺ — the same for
  // every game (the language of mini-games tells its own: minigame/index.js)
  const noted = globalThis.MooodSeen;
  noted?.context({ game: game.id, play: play.id });
  noted?.say(Object.keys(saved || {}).length ? 'play.resume' : 'play.begin', {});
  let shownAt = 0, atAt = 0;
  const actions = MooodActions.create({ canvas, stage, onAct: (element, action) => {
    noted?.say('play.choice', { element: element?.id ?? null, action: action?.id ?? action ?? null });
    emit('act', element, action);
  } });
  MooodSpeech.init({ stage, canvas, speak, over, voiceless: why => trouble(tr('no voice: {why}', { why })) });
  // the scenes' music, heard (not tuned): each scene's crossfades into the next one's — a scene with the same music goes on
  MooodMusic.init({ ...music, silent: why => trouble(tr('no music: {why}', { why })) });

  let shown = null, spec = null;
  let quiet = 0;  // (the show jumping now: the game told nothing of its scene meanwhile)
  let showing = 0;  // (the show asked last: one asked before it, still on its way, shows nothing)
  const FADE = 1.4; // (s: a scene's fade through black, unless the game says how long)
  async function show(ref, { state = {}, fade = false, captions = true, then = null } = {}) {
    const s = find(ref), mine = ++showing;
    if (!s) throw new Error(`the world has no scene "${ref}"`);
    const v = await versionOf(s);
    const over = fade === true ? FADE : Math.max(0, Number(fade) || 0), three = v.spec?.engine === 3;
    // (an engine-3 scene after another: made beside it, which lives on — through black, its thread does both fades;
    // else the scene before is faded out here first, and the new one in once it is drawn)
    const beside = three && stage.state.engine === 3;
    if (over && shown && !beside) await stage.fade(1, over);
    // (a jump on engine 1: not seen till it is where the game has got to)
    if (then?.length && !three) await stage.fade(1, 0);
    // (the scene's words: its code's tr, what the page shows of it — its captions, its widgets, its elements' names)
    const modules = { files: v.files, refs: v.modules, lang, strings: v.strings };
    const sceneTr = MooodI18n.translator(lang, v.strings, `the scene ${s.folder}`), seen = MooodI18n.shown(v.spec, sceneTr);
    // (the page's scene — its spec, what can be done with its things — is the new one as it is shown: an engine-3
    // scene's once its thread has switched to it — the one before living on meanwhile, and staying where the show fails)
    const take = () => {
      spec = v.spec;
      actions.setSpec(seen);
      noted?.context({ scene: s.folder });
      noted?.say('play.scene', { scene: s.folder, before: shownAt ? Math.round(performance.now() - shownAt) : null, jump: !!then?.length });
      shownAt = performance.now();
      MooodMusic.show(v.spec?.music);
    };
    // (engine 3 jumps as it opens; engine 1 catches up)
    const jump = !!then?.length;
    // the state first — its scripts set it up (a film's beat, where its people are) — then the scene
    // shown: its first frame is already as they put it (not its starting state for a frame, which
    // recorded movements would then play out of). What the scene tells is told with whose it is (its id)
    MooodState.start(v.spec, state, { stage, modules, jump: jump && !three, tell: (text, about, at, of) => { if (!quiet) emit('tell', text, about, of ?? s.folder); } });
    const showing3 = stage.show(v.spec, modules, three ? { fade: beside ? over : 0, then: jump ? then : null, tag: s.folder } : undefined);
    stage.resetCamera();
    if (three) {
      // (shown — or failed: the scene before stays the page's — or another show took its place)
      const done = await showing3;
      if (done?.replaced || mine !== showing) return s;
      take();
    } else take();
    // (a jump: not seen till it is where the game has got to — the game told nothing of it meanwhile)
    if (jump && !three) {
      quiet = mine;
      try { await MooodState.catchUp(then); } finally { if (quiet === mine) quiet = 0; }
    }
    // (faded in once it is drawn — its modules, its people here, all it shows made: not the scene before while it is on
    // its way, then it at a jump), its captions and widgets with it
    await stage.seen();
    if (mine !== showing) return s;
    MooodCaptions.show(captions ? seen.captions : []);
    widgets.show(seen, sceneTr);
    // (in, once drawn: what this page faded out — the scene before, a jump — its thread did the rest)
    if ((over && shown && !beside) || (jump && !three)) stage.fade(0, over || FADE);
    shown = s;
    return s;
  }

  // What the pointer does near a point of the scene, given to the game (bespoke.pointer): a round element of the page,
  // unseen, `radius` CSS px about the point — where the scene last said it is (placed with the page's own layers:
  // stage.onFrame) —, so the browser itself sends there what the pointer does within it, and none of it reaches the
  // scene's camera. A pointer pressed in it is its own till it is let go (captured: a drag that leaves the circle goes
  // on to its pointerup). It lies in the game's own layer, among what the game puts there. Not there while the point is
  // out of the frame or nowhere to be seen — but while a pointer pressed in it is held it stays, about where the point
  // was last seen: the drag goes on to its end.
  function pointer(ref, radius, fn) {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;left:0;top:0;width:${2 * radius}px;height:${2 * radius}px;margin:${-radius}px 0 0 ${-radius}px;border-radius:50%;pointer-events:auto;touch-action:none`;
    el.hidden = true;
    let stands = true, at = null;  // at: the point on the page — [x, y], CSS px
    const held = new Set();        // the pointers pressed in it and not let go yet
    const place = () => {
      if (!stands) return;
      const p = bespoke.where(ref);
      if (!p?.seen) { if (!held.size) { at = null; el.hidden = true; } return; }
      const r = canvas.getBoundingClientRect(), k = r.width / Math.max(1, canvas.clientWidth) || 1;
      at = [r.left + p.x * k, r.top + p.y * k];
      el.style.transform = `translate(${Math.round(at[0])}px, ${Math.round(at[1])}px)`;
      el.hidden = false;
    };
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) el.addEventListener(type, e => {
      e.stopPropagation();
      if (type === 'pointerdown') { el.setPointerCapture(e.pointerId); held.add(e.pointerId); }
      if (!at) return;
      try { fn({ type, dx: e.clientX - at[0], dy: e.clientY - at[1], id: e.pointerId }); } catch (err) { trouble(String(err.message || err)); }
      // (let go: gone now, if its point went out of sight meanwhile)
      if ((type === 'pointerup' || type === 'pointercancel') && held.delete(e.pointerId)) place();
    });
    // (nor the wheel over it: the thing under the hand stays where it is)
    el.addEventListener('wheel', e => e.stopPropagation());
    $('layer').append(el);
    const off = stage.onFrame(place);
    addEventListener('resize', place);
    place();
    return () => { stands = false; off(); removeEventListener('resize', place); el.remove(); };
  }

  // the language of mini-games: its marks at the scene's points as the page has them (as pointer's, above)
  const onPage = p => {
    const r = canvas.getBoundingClientRect(), k = r.width / Math.max(1, canvas.clientWidth) || 1;
    return { x: r.left + p.x * k, y: r.top + p.y * k };
  };
  const minigames = createMinigames({
    root: $('minigame'),
    where: ref => { const p = bespoke.where(ref); return p && { ...onPage(p), seen: p.seen }; },
    frame: () => { const f = stage.frame(), o = onPage(f), e = onPage({ x: f.x + f.w, y: f.y + f.h }); return { x: o.x, y: o.y, w: e.x - o.x, h: e.y - o.y }; },
    screen: () => { const o = onPage({ x: 0, y: 0 }), e = onPage({ x: canvas.clientWidth, y: canvas.clientHeight }); return { x: o.x, y: o.y, w: e.x - o.x, h: e.y - o.y }; },
    onFrame: fn => stage.onFrame(fn),
    // the thing itself glows (IN3) — the language's alone on an engine 3 scene (bespoke.offer is not there): 'waiting' —
    // OFFERED (it pulses), 'working' — SELECTED (steady)
    highlight(id, how) {
      const i = id == null ? -1 : (spec?.objects || []).findIndex(o => o?.id === id);
      stage.offer(how === 'waiting' && i >= 0 ? [`objects[${i}]`] : []);
      stage.select(how === 'working' && i >= 0 ? `objects[${i}]` : null);
      return i >= 0;
    },
    // (a mini-game going on: the view leans no more toward the pointer — nothing moves under the finger)
    steady: on => stage.steady(on),
    trouble: e => trouble(tr('mini-game: {why}', { why: e.message || e })),
  });
  const tricks = createTricks({ play: play.id });
  const three = () => { if (spec?.engine !== 3) throw new Error("the language of mini-games is an engine-3 scene's only"); };

  // a line of someone of the game's people, in the play's language: who's {voice, how} — heard (speech.js)
  const person = who => {
    if (!(who in people)) throw new Error(`no one "${who}" among the game's people (bespoke/people.json)`);
    return people[who];
  };
  const line = (who, text) => gameTr.said(who, text);
  // said: {heard — its voice heard (speech.js tells it as it begins), text — what was shown}; text — written here (how:
  // its own manner; spoken: what its voice says instead of it, as written), or kept (tr.line, tr.thought: {text, how,
  // spoken})
  // (a line as it is heard — voices.js; a thought shown in the play's words)
  async function utter(at, who, said, text, how, spoken) {
    if (typeof text !== 'string') {
      if (how || spoken != null) throw new Error(`a kept line (tr.line, tr.thought) keeps its own manner and spoken words: ${said} it with none`);
      ({ text, how, spoken } = text);
    }
    const p = person(who), l = line(who, text), words = spoken ?? l;
    const shown = MooodSpeech.shown(said === 'think' ? tr('“{text}” — {who}', { text: l, who: gameTr(p.short) }) : l);
    let on = false;
    const hear = e => { if (e.detail.on && e.detail.text === shown) on = true; };
    addEventListener('moood:speech', hear);
    try { await MooodSpeech.say(at, words, { ...heard(p, said, words, how), shown }); } finally { removeEventListener('moood:speech', hear); }
    return { heard: on, text: shown };
  }

  let keeping = Promise.resolve();
  const bespoke = {
    game,
    play,
    scenes,
    show,
    get spec() { return spec; },
    async specOf(ref) {
      const s = find(ref);
      if (!s) throw new Error(`the world has no scene "${ref}"`);
      return (await versionOf(s)).spec;
    },
    get states() { return MooodState.states; },
    where(ref, lift = 0) {
      // (seen: on what the scene shows — an engine-3 scene all its canvas, the world round its frame too; another
      // engine's, its frame)
      const p = stage.screenOf(ref, lift), f = stage.state.engine === 3 ? { x: 0, y: 0, w: canvas.clientWidth, h: canvas.clientHeight } : stage.frame();
      return p && { x: p[0], y: p[1], depth: p[2], seen: p[0] >= f.x && p[0] <= f.x + f.w && p[1] >= f.y && p[1] <= f.y + f.h };
    },
    frame: () => stage.frame(),
    onFrame: fn => stage.onFrame(fn),
    pointer,
    minigame: {
      start: opts => { three(); return minigames.start(opts); },
      tricks,
      relative: (p, a, b) => minigames.relative(p, a, b),
      style: s => minigames.style(s),
      skip: () => minigames.skip(),
      ...(game.mine ? { author: { settings: s => minigames.settings(s), forget: () => tricks.forget(), sounds: minigames.sounds } } : {}),
    },
    ground: (across, distance) => stage.ground(across, distance),
    offer: offers => {
      if (spec?.engine === 3) throw new Error("an engine-3 scene's choice is the language of mini-games' (minigame.start({plate: false}))");
      actions.offer(offers);
    },
    lang,
    data: name => json(`lang/${lang === MooodI18n.PSEUDO ? MooodI18n.source : lang}/${name}.json`),
    say: (who, text, { at = who, how = '', spoken = null } = {}) => utter(at, who, 'say', text, how, spoken),
    think: (who, text, { at = 'narrator', how = '', spoken = null } = {}) => utter(at, who, 'think', text, how, spoken),
    hush: () => MooodSpeech.hush(),
    get: key => MooodState.get(key),
    set: (key, value, seconds) => MooodState.set(key, value, seconds, undefined, { who: 'the game' }),
    // (through black: the black lifted once the cut's picture is there — engine 3 holds the lift while its cut waits)
    async cut(values, { fade = 0 } = {}) {
      const over = Math.max(0, Number(fade) || 0);
      if (!over) return MooodState.cut(values, { who: 'the game' });
      await stage.fade(1, over);
      await MooodState.cut(values, { who: 'the game' });
      await stage.fade(0, over);
    },
    fade: (level, seconds) => stage.fade(level, seconds),
    prepare: (values, seconds) => MooodState.prepare(values, seconds),
    unprepare: id => MooodState.unprepare(id),
    on(ev, a, b) {
      if (ev in listeners) { listeners[ev].push(a); return; }
      if (!DIRECTOR.has(ev)) { MooodState.on(ev, a, b); return; }
      // (with whose it is: the folder of the scene that told it — while one scene is made beside another, the one before
      // goes on telling its own)
      const fn = typeof a === 'function' ? a : b, heard = (d, of) => { if (!quiet) fn(d, of ?? shown?.folder ?? null); };
      if (typeof a === 'function') MooodState.on(ev, heard); else MooodState.on(ev, a, heard);
    },
    act: (actor, verb, ...args) => MooodState.act(actor, verb, ...args),
    signal: (name, data) => MooodState.signal(name, data),
    save: () => MooodState.save(),
    restore: data => MooodState.restore(data),
    instant: on => MooodState.instant(on),
    layer: $('layer'),
    underlay: $('underlay'),
    css: path => new Promise((ok, fail) => document.head.append(Object.assign(document.createElement('link'),
      { rel: 'stylesheet', href: `${code}${path}`, onload: ok, onerror: () => fail(new Error(`no stylesheet ${path}`)) }))),
    saved,
    keep: save => (keeping = keeping.then(() => keep(save)).catch(e => trouble(tr('not kept: {why}', { why: e.message })))),
    restart,
    trouble,
    at({ chapter, step, replay = false } = {}) {
      noted?.context({ chapter, step });
      noted?.say('play.step', { chapter: chapter ?? null, step: step ?? null, replay: !!replay, before: atAt ? Math.round(performance.now() - atAt) : null });
      atAt = performance.now();
    },
    ended: (about = {}) => noted?.say('play.end', about),
    pause(on) {
      paused = !!on;
      noted?.say('play.pause', { on: paused });
      window.__mooodTime.pause(paused);
      // (an engine 3 scene: its voices and its music stand and go on with the scene itself — the stage's onPause, which
      // the play's pause is one reason of)
      if (stage.state.engine !== 3) { MooodSpeech.pause(paused); MooodMusic.pause(paused); }
      minigames.pause(paused);
      if (paused) stood = document.getAnimations().filter(a => a.playState === 'running').map(a => (a.pause(), a));
      else { for (const a of stood) a.play(); stood = []; }
      for (const fn of pausing) try { fn(paused); } catch (e) { trouble(String(e.message || e)); }
    },
    get paused() { return paused; },
    onPause: fn => { pausing.push(fn); },
    menu: open => menu(typeof open === 'function' ? open : null),
    forward(fn) {
      ahead = typeof fn === 'function' ? fn : null;
      forward(ahead && (() => press()));
    },
  };
  let paused = false, stood = []; // (the page's animations the pause stopped)
  const pausing = []; // (the game's: told as the play is paused or goes on)

  // the page's ⏭ (bespoke.forward): the line heard hurried, else the game's fn; Space — the same, while it is shown (a
  // Space taken so does not press a button that has the focus)
  let ahead = null, spaced = false;
  function press(how = 'button') {
    if (!ahead || paused) return;
    const hurried = MooodSpeech.hurry();
    noted?.say('play.forward', { how, hurried });
    if (hurried) return;
    try { ahead(); } catch (e) { trouble(String(e.message || e)); }
  }
  const typing = t => t?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName || '');
  addEventListener('keydown', e => {
    if (e.code !== 'Space' || !ahead || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    e.preventDefault();
    spaced = true;
    if (!e.repeat) press('space');
  });
  addEventListener('keyup', e => { if (e.code === 'Space' && spaced) { spaced = false; e.preventDefault(); } });

  // (the game broke — an exception it did not catch: a mini-game it left going is left, the scene answers again)
  addEventListener('unhandledrejection', () => minigames.abandon());
  ready?.(bespoke);
  try {
    await (await import(`${code}game.js`)).default(bespoke);
  } catch (e) {
    minigames.abandon();
    trouble(tr('the game broke: {why}', { why: e.message || e }));
    throw e;
  }
}
