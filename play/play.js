// A bespoke play's page (?game=<game>, ?lang=): my play of the game — begun now if there is none — as the host keeps it
// (host.js, docs/host.md), its scenes as its world is in the play, run by the game's own code (runtime.js). The page's
// bar over it: the way back to the host's page of the game (if it gives one: back), ↺ (the play anew, asked first), ⏸, the game's ⏭ (while it gives one: bespoke.forward) and ☰ (while it
// has one: bespoke.menu), how loud (volume.js), the whole screen; a phone plays it across (landscape.js). What goes
// wrong before the game runs is said in a corner. A host that tells of files saved (the game's, its world's changes) has
// the page shown anew as one of them is: the play goes on from what the game kept. A host whose plays are pinned to the
// commits they began on tells instead when newer ones are there: then the bar offers to continue on them (asked first:
// what the game kept may not fit the new code) — the play moved there, with what the game kept, and shown anew.
import { ask, asked, at, follow, lang, music, query, scene, voice } from '../scene/host.js';
import { start } from './runtime.js';
import { full, landscape } from './landscape.js';
import { speak, words } from '../i18n/words.js';

const tr = await words(new URL('./', import.meta.url), lang);
const trouble = text => { const t = document.getElementById('trouble'); t.textContent = text; t.classList.add('on'); };

// the bar: its buttons, each its sign and its words
const sign = paths => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
const button = (id, label, paths, hidden = false) => Object.assign(document.createElement('button'),
  { type: 'button', title: label, ariaLabel: label, innerHTML: paths == null ? '' : sign(paths), hidden }, id && { id });
const bar = document.createElement('div');
bar.className = 'bar';
const again = button('restart', tr('The whole play from the start'), '<path d="M5 12a7 7 0 1 0 2.1-5M5 4v4h4"/>');
const onward = button('onward', tr('Continue on the new commit'), '<path d="M3 12h9M9 8.5l3.5 3.5L9 15.5"/><circle cx="18" cy="12" r="3"/>', true);
const pause = button('pause', tr('Pause'), '<path class="pause" d="M8 5v14M16 5v14"/><path class="go" d="M7 5l12 7-12 7z"/>');
const forward = button('forward', tr('Fast forward (Space)'), '<path class="solid" d="M5 6l6 6-6 6zM12 6l6 6-6 6z"/><path d="M20 6v12"/>', true);
const menu = button('menu', tr('Chapters'), '<path d="M5 7h14M5 12h14M5 17h14"/>', true);
const volume = button(null, tr('Volume'), null);
volume.dataset.volume = '';
const whole = button('full', tr('The whole screen'), '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>');
bar.append(again, onward, pause, forward, menu, volume, whole);

try {
  const game = asked.get('game');
  if (!game) throw new Error(tr('No game is asked for (?game=).'));
  const { id } = await ask('POST', 'play', { game });
  follow({ game }, () => { onward.hidden = false; });
  // {id, game: {id, title, mine}, world, code, save, back?}
  const play = await ask('GET', `play?${query({ play: id, lang })}`);
  const [world] = await Promise.all([ask('GET', `world?${query({ world: play.world, lang })}`), speak(lang)]);
  document.documentElement.lang = lang;
  document.title = play.game.title;
  if (play.back) bar.prepend(Object.assign(document.createElement('a'), { className: 'back', href: at(play.back), textContent: `← ${play.game.title}` }));
  document.body.append(bar);
  const restart = async () => {
    globalThis.MooodSeen?.say('play.restart');
    await ask('POST', `restart?${query({ play: play.id })}`);
    location.reload();
  };
  again.onclick = () => { if (confirm(tr('Begin the whole play again?'))) restart(); };
  onward.onclick = async () => {
    if (!confirm(tr('Continue the play on the new commit? What the game kept goes on with it, but it may not fit the new code, and something may break — then begin the play again (↺). There is no going back.'))) return;
    globalThis.MooodSeen?.say('play.continue');
    try {
      await ask('POST', `continue?${query({ play: play.id })}`);
      location.reload();
    } catch (e) {
      trouble(tr('The play could not continue on the new commit: {why}', { why: e.message }));
    }
  };
  whole.onclick = () => full();
  await start({
    game: play.game, play: { id: play.id }, lang,
    scenes: world.scenes, people: play.people,
    load: s => scene(play.world, s.folder, play.id),
    saved: play.save, keep: save => ask('PUT', `play?${query({ play: play.id })}`, save), restart,
    code: at(play.code), speak: voice, music,
    over: [bar], // (the lines said kept off the bar over the scene: speech.js)
    // the play's pause, the game's ⏭ and its menu: the page's (runtime.js — bespoke.pause, bespoke.forward, bespoke.menu)
    ready: b => {
      const said = () => { pause.classList.toggle('paused', b.paused); pause.ariaLabel = pause.title = b.paused ? tr('Go on') : tr('Pause'); };
      pause.onclick = () => b.pause(!b.paused);
      b.onPause(said);
      landscape(b);
    },
    menu: open => { menu.hidden = !open; menu.onclick = open; },
    forward: press => { forward.hidden = !press; forward.onclick = press; },
  });
} catch (e) {
  // (the game's own failure is the runtime's to say: it has said it)
  if (!document.getElementById('trouble').classList.contains('on')) trouble(tr('The play could not be opened: {why}', { why: e.message || e }));
  throw e;
}
