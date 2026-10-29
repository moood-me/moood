# The play page when a play cannot be opened; a published game's play onto its new version (2026-10-29)

**Why.** Pavel saw on moood.me: a browser with a play of «The Fall of the House of Usher» / «The Chrysalids» begun on
the old publication (en, ru only) opened `/uk/play/<game>` — `GET play?…&lang=uk` refused `language` — and the page
showed only «Партію не вдалося відкрити: …» at the bottom on black: no ← back, no ↺. The game had been published anew
in twelve languages, but plays stay on what they began on, and for published games nothing offered the newer version
(branch plays have it: `follow`, the onward button, `continue`). In the studio a play had no ← back at all. His wishes:
the page's own bar — at least ← back and ↺ — there from the start and staying on any failure; a failure to open said
clearly with actions (back to the game, begin anew); a published game's play on an older publication offered the move
to the current one with what the game kept (if something goes wrong — ↺), and, when the old version lacks the language,
that move offered instead of the error; every text in all twelve languages.

**What.**
- `play/play.js`: the bar is put on the page at once — ← back, ↺, the onward button (hidden till the host tells
  `newer`), ⏸ (shown once the game runs), ⏭ and ☰ (as the game gives them), volume, the whole screen. Back is the
  host's page the page was opened with — a new `back` in the page's query (or the host's `moood-page` meta), taken only
  at the page's origin — labelled «← Back to the game», and, once `GET play` answers, its `back` and «← title».
  ↺ with no play yet (POST play failed) opens the page anew.
- What keeps the play from being opened (any failure before the game runs) is said in the middle (`#unopened`,
  `play.css`) with its actions: «Continue on the new version» (once `newer` is told), «Begin anew» (↺, asked first),
  «Back to the game». A refusal `language` with `newer` told is said as «This play began on an earlier version of the
  game, which is not in this language…» — the move offered in its place. The game's own failure stays the runtime's.
- The move's words say «version», not «commit»: the same button and question serve the studio's branch plays and the
  site's published ones (the question still warns that what the game kept may not fit, then ↺).
- `scene/host.js follow`: told `newer`, the page closes the stream (it listens no more) — a host may tell it once and end
  the stream (the public site does) without the browser reconnecting.
- `docs/host.md`: the page's `back`; `continue` and `newer` of a host that publishes games (a play on its publication,
  moved to the game's publication now).

**How.** New texts through `tr` in `play/lang/*.json` (ru, uk, be, de, es, fr, ja, ko, pl, pt, zh-hant); the three
«…new commit» texts replaced by «…new version». `node packages/check/cli.js play` (and `scene`) — «all right».
Test: `test/play-unopened.test.js` — play.js in node on stand-ins of the DOM, the host and EventSource: GET play
refused `language` (the bar with back and ↺; the panel; `newer` → the move offered, `POST continue`, the page shown
anew), and the host not reached (the bar, back from the query, ↺ opens anew). The site's and the studio's side: studio
`docs/history/2026-10-29-play-onward.md`.
