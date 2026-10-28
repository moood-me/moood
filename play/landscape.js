// A play is played across: a phone holds it lying on its side (the scene is wide; the game's marks are where the scene
// puts them). The way the platform has for it, and nothing turned by hand:
//   full(el) — the whole screen for the page (or el: a scene's frame; pressed again: back); on a phone that can,
//     turned across and held so — Android's screen.orientation.lock, which only the whole screen allows, let go as it
//     is left
//   landscape(b) — a phone that has no whole screen for a page (an iPhone: nor the lock), held upright, is asked to
//     turn it, the play paused meanwhile and going on once it is turned, unless it was paused before. One that has it
//     (Android) is asked nothing: its whole screen turns it (the page's button), and out of it the player plays as
//     they hold it. Its words: this folder's, in the play's language (b.lang)
import { words } from '../i18n/words.js';

const PHONE = matchMedia('(pointer: coarse) and (max-width: 600px), (pointer: coarse) and (max-height: 600px)');
const UPRIGHT = matchMedia('(orientation: portrait)');

export async function full(el = document.documentElement) {
  if (document.fullscreenElement) { await document.exitFullscreen(); return; }
  try {
    await el.requestFullscreen({ navigationUI: 'hide' });
    if (PHONE.matches) await screen.orientation.lock('landscape');
  } catch { /* (no whole screen here, or no lock: played as it is held) */ }
}

export async function landscape(b) {
  const tr = await words(new URL('./', import.meta.url), b.lang);
  const ask = document.createElement('div');
  ask.id = 'turn';
  ask.hidden = true;
  ask.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="16" y="6" width="16" height="28" rx="3"/>'
    + '<path d="M8 38c4 4 10 5 16 5M24 43l-3-3M24 43l-3 3"/><rect x="26" y="30" width="16" height="10" rx="2" class="after"/></svg>'
    + `<b>${tr('Turn your phone')}</b><span>${tr('The game is played across.')}</span>`;
  document.body.append(ask);
  let ours = false;  // (the pause is this one's: the play goes on once turned)
  const check = () => {
    const upright = PHONE.matches && UPRIGHT.matches && !document.fullscreenEnabled;
    ask.hidden = !upright;
    if (upright && !b.paused) { b.pause(true); ours = true; }
    if (!upright && ours) { ours = false; b.pause(false); }
  };
  PHONE.addEventListener('change', check);
  UPRIGHT.addEventListener('change', check);
  check();
}
