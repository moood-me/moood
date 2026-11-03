// The screen kept on while a play goes on: a phone dims and turns its screen off when it is not touched for a while,
// and a play is often watched and listened to, not touched (a player's word: "the screen dims now and then"). The
// platform's way — the Screen Wake Lock — asked while the play is not paused and its page is seen; let go as it is
// paused (the phone may sleep then); the platform lets it go itself as the page is hidden, so it is asked again as the
// page is seen again. A browser without it, or one that refuses it (a battery saver): the screen as the phone keeps it.
//   awake(b) — b: the play (runtime.js: paused, onPause)
export function awake(b) {
  if (!navigator.wakeLock) return;
  let lock = null;
  const keep = async () => {
    const wanted = !b.paused && document.visibilityState === 'visible';
    if (wanted && !lock) {
      try {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => { lock = null; });
      } catch { lock = null; }
    } else if (!wanted && lock) await lock.release().catch(() => {});
  };
  b.onPause(keep);
  document.addEventListener('visibilitychange', keep);
  keep();
}
