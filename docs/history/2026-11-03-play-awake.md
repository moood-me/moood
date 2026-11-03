# The screen kept on while a play goes on (2026-11-03)

**Why.** A player on an Android phone (Chrome) said the screen dims now and then while she plays. Her events agree: the
play's page went hidden mid-scene after ~50 s with no touch; long stretches of a play are watched and listened to, not
touched, and the phone dims and turns its screen off by its own timeout. Our Android app keeps the screen on itself
(PlayActivity); the web play page asked nothing. Pavel: fix it.

**How.** `play/awake.js`: the Screen Wake Lock (`navigator.wakeLock.request('screen')`) asked while the play is not
paused and its page is visible; let go when the play is paused; asked again when the page is seen again (the browser
lets the lock go itself as the page is hidden) or the play goes on. No lock in the browser, or refused: as before.
`play/play.js` calls `awake(b)` beside `landscape(b)` once the play is ready.
