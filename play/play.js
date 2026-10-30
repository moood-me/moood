// A bespoke play's page (?game=<game>, ?lang=, ?back=): my play of the game — begun now if there is none — as the host
// keeps it (host.js, docs/host.md), its scenes as its world is in the play, run by the game's own code (runtime.js).
// The page's bar over it, there from the start and staying whatever fails: the way back to the host's page of the game
// (its answer's back, "← its title"; before it, or without it, the back the host put in the page's query — a page of its
// own), ↺ (the play anew, asked first), and, once the game runs, ⏸, the game's ⏭ (while it gives one: bespoke.forward)
// and ☰ (while it has one: bespoke.menu); how loud (volume.js), the whole screen; a phone plays it across
// (landscape.js). Its buttons come and go calmly, none jumping into the place of one aimed at (bar.js). What keeps
// the play from being opened (a refusal, the network) is said in the middle, with what can be
// done: continue on the game's new version (once the host tells of one), begin anew, back to the game. A host that
// tells of files saved (the game's, its world's changes) has the page shown anew as one of them is: the play goes on
// from what the game kept. A host whose plays are pinned to the commits (a published game's: the publication) they
// began on tells instead when newer ones are there: then the bar offers to continue on them (asked first: what the game
// kept may not fit the new code) — the play moved there, with what the game kept, and shown anew; a play that cannot be
// opened in the page's language while its game's new version can is offered just that.
import { ask, asked, at, follow, HOST, lang, music, query, scene, voice } from '../scene/host.js';
import { start } from './runtime.js';
import { full, landscape } from './landscape.js';
import { speak, words } from '../i18n/words.js';
import { calm } from './bar.js';

const tr = await words(new URL('./', import.meta.url), lang);
const trouble = text => { const t = document.getElementById('trouble'); t.textContent = text; t.classList.add('on'); };
document.documentElement.lang = lang;

// the bar: its buttons, each its sign and its words
const sign = paths => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
const button = (id, label, paths, hidden = false) => Object.assign(document.createElement('button'),
  { type: 'button', title: label, ariaLabel: label, innerHTML: paths == null ? '' : sign(paths), hidden }, id && { id });
// (the host's page the page was opened with — only one of its own origin)
const home = (() => {
  const b = asked.get('back'), u = b ? new URL(b, HOST) : null;
  return u?.origin === location.origin ? u.href : null;
})();
const back = Object.assign(document.createElement('a'), { className: 'back', href: home ?? '', textContent: `← ${tr('Back to the game')}`, hidden: !home });
const again = button('restart', tr('The whole play from the start'), '<path d="M5 12a7 7 0 1 0 2.1-5M5 4v4h4"/>');
const onward = button('onward', tr('Continue on the new version'), '<path d="M3 12h9M9 8.5l3.5 3.5L9 15.5"/><circle cx="18" cy="12" r="3"/>', true);
const pause = button('pause', tr('Pause'), '<path class="pause" d="M8 5v14M16 5v14"/><path class="go" d="M7 5l12 7-12 7z"/>', true);
const forward = button('forward', tr('Fast forward (Space)'), '<path class="solid" d="M5 6l6 6-6 6zM12 6l6 6-6 6z"/><path d="M20 6v12"/>', true);
const menu = button('menu', tr('Chapters'), '<path d="M5 7h14M5 12h14M5 17h14"/>', true);
const volume = button(null, tr('Volume'), null);
volume.dataset.volume = '';
const whole = button('full', tr('The whole screen'), '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>');
const bar = document.createElement('div');
bar.className = 'bar';
bar.append(back, again, onward, pause, forward, menu, volume, whole);
document.body.append(bar);
// (its buttons come and go calmly: bar.js)
const { show, shown, change } = calm(bar);
whole.onclick = () => full();

// my play's id (none till the host gives it), whether the host told of a newer version, what kept it from being opened
let id = null, newer = false, failure = null;

// the play anew: the host begins a new one (on the game's version now); no play yet — the page opened anew
const restart = async () => {
  globalThis.MooodSeen?.say('play.restart');
  if (id) await ask('POST', `restart?${query({ play: id })}`);
  location.reload();
};
const anew = () => {
  if (confirm(tr('Begin the whole play again?'))) restart().catch(e => trouble(tr('The play could not be begun anew: {why}', { why: e.message })));
};
again.onclick = anew;
// the play moved to the game's new version, with what the game kept
const move = async () => {
  if (!confirm(tr("Continue the play on the game's new version? What the game kept goes on with it, but it may not fit the new version, and something may break — then begin the play again (↺). There is no going back."))) return;
  globalThis.MooodSeen?.say('play.continue');
  try {
    await ask('POST', `continue?${query({ play: id })}`);
    location.reload();
  } catch (e) {
    trouble(tr('The play could not continue on the new version: {why}', { why: e.message }));
  }
};
onward.onclick = move;

// what kept the play from being opened, said in the middle with what can be done (said again as the host tells of a
// newer version: a play not in this language is offered to move there instead)
const unopened = Object.assign(document.createElement('div'), { id: 'unopened', role: 'alert', hidden: true });
document.body.append(unopened);
function say() {
  if (!failure) return;
  const act = (label, onclick) => Object.assign(document.createElement('button'), { type: 'button', textContent: label, onclick });
  const text = newer && failure.code === 'language'
    ? tr('This play began on an earlier version of the game, which is not in this language. Continue it on the new version, with what the game kept, or begin it anew.')
    : tr('The play could not be opened: {why}', { why: failure.message || failure });
  unopened.replaceChildren(Object.assign(document.createElement('p'), { textContent: text }), Object.assign(document.createElement('div'), { className: 'acts' }));
  unopened.lastChild.append(...[newer && act(tr('Continue on the new version'), move), act(tr('Begin anew'), anew),
    shown(back) && Object.assign(document.createElement('a'), { href: back.href, textContent: tr('Back to the game') })].filter(Boolean));
  unopened.hidden = false;
}

// the play as the host has it, its world in the page's language
async function open() {
  const game = asked.get('game');
  if (!game) throw new Error(tr('No game is asked for (?game=).'));
  ({ id } = await ask('POST', 'play', { game }));
  follow({ game }, () => { newer = true; show(onward, true); say(); });
  // {id, game: {id, title, mine}, world, code, save, back?}
  const play = await ask('GET', `play?${query({ play: id, lang })}`);
  document.title = play.game.title;
  if (play.back) back.href = at(play.back);
  if (play.back || home) { change(() => { back.textContent = `← ${play.game.title}`; }); show(back, true); }
  const [world] = await Promise.all([ask('GET', `world?${query({ world: play.world, lang })}`), speak(lang)]);
  return { play, world };
}
const { play, world } = await open().catch(e => { failure = e; say(); throw e; });

// (the game's own failure is the runtime's to say)
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
    show(pause, true);
    b.onPause(said);
    landscape(b);
  },
  menu: open => { show(menu, open); if (open) menu.onclick = open; },
  forward: press => { show(forward, press); if (press) forward.onclick = press; },
});
