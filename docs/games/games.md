# Bespoke games — how one is built

A bespoke game is its own code (`bespoke/game.js` of its repository and what it imports), run by the play page with
`bespoke` — what the page gives it (the head of `play/runtime.js` is the full reference). The page
knows nothing of the game; it gives the scenes, the save, the voices, its buttons (⏸, ⏭, ☰) and the language of
mini-games (`minigames.md`). What follows is how a game is put together so that the player can always find their way
in it.

## 1. Chapters and steps

- A play is **chapters**, each a row of **steps**. A step is the game's code for a piece of the story: it opens its
  scene, has lines said, offers a choice, plays a mini-game. What the play carries from step to step — the scales,
  what people remember, the choices made — is a plain object: the step works on a copy of it, kept only once the step
  is through.
- The game keeps the play after every step (`bespoke.keep`). A step cut short (the page closed, the player went to the
  map) is played again **from its beginning** — so everything a step needs is in what the play carried into it.
- A chapter's choices that matter are its **forks**: listed with the chapter (each a row of options), so the map can
  draw them.
- As each step begins, the game says where the play is — `bespoke.at({chapter, step, replay})` (replay: played
  again, not the main run) — and, played through, that it has ended — `bespoke.ended({ending})`. moood counts what
  players do by them (how long a step takes, where people stop); the rest — scenes, choices, mini-games — it sees by
  itself.

## 2. The map of the play

- The map is **a background scene of the game's world and the game's own drawing over it**. The scene: the place
  the play is seen on (a sky, a sea, a wall — in its world's look, alive by its shader or its film, painted once), a
  panorama camera whose `span` covers all chapters — the game names the chapter to be at (a key of the scene), the
  scene brings the view there by moving `camera_x`; the player drags the view anywhere (a press on the chapter already
  named brings it back: one more key, `come`, its each new value moving `camera_x` there again) —, an unseen point for each
  chapter (where its knot is) and one for the author's sign. The game draws each chapter's tree — its number and
  title, its knot, its forks (rows of options, what was chosen brighter), the threads between them (a replay's beside
  the main run's), where the play is (a pointer with its words: the main run's, a replay's), the chapters to come as a
  number only — as HTML, CSS and SVG in `bespoke.underlay` (under the language's marks), in its own style: laid out by
  CSS, so no words run into one another and the text is sharp. Each
  tree stands at its chapter's point every frame the scene says (`bespoke.where` in `bespoke.onFrame`), as large as
  the point's depth makes it (the wheel and a pinch walk toward the sky: nearer, larger; the wheel over what takes a
  press walks too — the runtime gives the wheel over its places to the scene, but over what of them scrolls). What lives in it is CSS
  (transform and opacity): a knot breathing, a pointer's arrow nudging, a chapter just played growing row by row.
- **What can be done on it is the map's own drawing** — no mark waits idle on it (but a replay's end, §4). What has something to do takes a
  press (pointer-events on it, ≥ 44 px; the rest of the sky stays the scene's, dragged), all of it at once (not only
  near where the view is); pressed, the language's mark of a plain choice (`minigame.start({plate: false})`) appears
  right there **born open** (`press({on, petals, open: true})`, `minigames.md`): its petals in words, its sounds; a
  touch off them folds it (`'fold'`) and the game takes it away. Its `at` is a function giving the page point of what
  was pressed. Its petals (the game's words, as all of them: `tr`, English the source, the translations in
  `bespoke/lang/<lang>/strings.json`; the Russian ones given beside them):
  - the main run's pointer — "Start" («Начать», not begun) or "Continue" («Продолжить», from the beginning of the
    step it stopped in), its own words by the same rule ("start the game" / "continue the game");
  - a chapter played, its knot or title — "Replay the chapter" («Переиграть главу»); each of its forks the main run
    reached, its dot or answer — "Replay from here" («Переиграть отсюда»): from the step of that fork, with all the
    main run chose before it (only where that state is kept, §3);
  - the author's sign (§6).
- **When the player is on it**: the play begins on it; it comes after each chapter (the chapter's threads growing,
  then the view going on to what is next); by ☰ — `bespoke.menu(open)` for every player, `open()` goes to the map (the
  step going on is left: its lines hushed, its mini-game gone); always after the play is opened again. On the map
  itself there is no ☰ (`bespoke.menu(null)`).
- How things stand (the scales in words, the people) — as the game shows them, in a corner of the map.
- **The scene's part**: the background, the camera, the chapters' points (unseen elements, as far apart as the trees
  need: their knots near the frame's top, the trees going down to the middle of the frame, not into its foot) and the
  author's point at the map's edge, within reach of the view. Its notes say its key and points.

## 3. What the game keeps

- **The main run** — where the play is and what it carries.
- **Its state at the beginning of every step** of every chapter (and at each chapter's end): what "Replay from here"
  starts from. Small — the save has a limit of 1 MB.
- **How far each chapter has been seen**: the steps the player has ever played through in it — by the main run or a
  replay. Never lessened (not even when a kept replay makes later chapters to be played again): the ⏭ goes by it (§5).
- **Never a replay** (§4).
- A save of an older version of the game opens all the same: read what it kept, give the map what it can (a fork
  whose state was not kept has no mark).

## 4. Replays

- A chapter or a fork begun from the map is a **replay**: it plays as ever but is **not kept** — closed, it is gone,
  and the play opens on the main run.
- ☰ in a replay — the map, the replay on it: **a plate "Replay"** («Переигровка») on its chapter's tree (the game's
  own, in its style; nothing of it in a corner) — pressed, as its chapter's knot, its mark opens with "Continue the
  replay" and "Drop the replay" («Бросить переигровку»); its threads beside the main run's, its pointer "Continue the
  replay" («Продолжить переигровку») or "Back to the main run" («Вернуться к основной»: the main run, played on at
  once). Whatever would leave it — another choice, "Back to the main run" — asks again first: its mark opens again
  with the petal "Drop the replay" («Бросить переигровку»); the main run's pointer says it at once (that petal is its
  question).
- **A replay played to its chapter's end** — on the map, on that chapter's knot: "Keep" («Оставить») or "Undo"
  («Отменить»), its mark open by itself as the map comes (the one mark that opens untouched: it is the question the
  map asks). Kept, it is the main run from the next chapter on, and the chapters after it are to be played anew —
  say so in words before the choice, with how things would stand either way.

## 5. The page's ⏭

- The page draws it (beside ⏸ and ☰, with the hint "fast forward (Space)" in the play's language; Space does the same) — the game says when it
  is there and what it does: `bespoke.forward(fn)`, `null` — none.
- Pressed while a line is heard, the page speeds the line up itself (to ×2.5, the voice at its pitch); pressed again,
  or with no line, it calls `fn`.
- **Show it only where the player has been**: in a step not past what they have seen of its chapter (§3) — so in a
  replay, and in chapters played again after a replay was kept; in the main run, usually not. None while a choice is
  offered, none where there is nothing to forward (past what was seen, the chapter's end, the map).
- **`fn` goes to the next interaction** — the next line, choice, mini-game, scene, or shot (a beat begun) —, and all
  between ends at once: the game's own waits over, the line heard and those still to come dropped (`bespoke.hush`),
  the scene in its instant mode (`bespoke.instant(true)`: every action ends as it would, the scene's beats run through
  and tell what they tell on the way); at the interaction `bespoke.instant(false)` — the scene as it is then, in one
  cut — and on as ever.
- **In a mini-game** ⏭ skips it (`bespoke.minigame.skip()`), where the game lets it: in a step seen, or once the player
  has been in it a while (some twenty seconds) or failed it several times — not to be tormented. When, the game decides (not the language of
  mini-games). A skipped mini-game leaves the trace a played one would (the plain good outcome).
- A game that never calls `forward` has no ⏭ of the page (an older game may draw its own).

## 6. The author

- The author's sign (`bespoke.game.mine`: on the author's site; on the public site too — to the game's author, signed
  in there with the same Google account as in the studio) opens the author's map: every chapter, its steps, the mini-games of each — to go straight to any. Gone to, a step is a replay from there — in a
  chapter the main run has played, from its state kept at that step, as "Replay from here" (else as if nothing was
  chosen before it: a kept replay never loses the main run's choices); a mini-game — its step played up to it unseen and without time (the scene catching up
  in its instant mode: `bespoke.show` with `then`), then on, seen. A jump tells the game nothing — what the scene
  tells or signals in it is never heard (said in the scene's warnings): the piece the step waits on (a beat whose end
  it hears) is set after the show, not in `then`.
- The author's ⏭ is the player's.

## 7. Scenes, cuts and the fade

- **Fades are the game's and the page's, never a scene's.** `bespoke.fade(level, seconds)` → a promise, done when
  the black over the scene is at `level` (0 clear … 1 black): a dim under a letter (`fade(0.9, 3)`, held as long as the
  letter is read, then `fade(0, 2)`), black at the end (`fade(1, 1.5)`). It is no value of the scene: not saved, not
  in its pictures. An engine-3 scene has no `fade` key (a spec that still starts one is told so);
  don't set the one older engine-1 scenes have.
- **A scene change**: `bespoke.show(scene, {fade})` — without `fade` (the default) the new scene comes in one cut,
  never from black; `fade: true` (1.4 s) or seconds — through black. Meanwhile the scene before goes on as it is
  (its film, its people, its lines — the page stops nothing of it: show the next scene where its beat is over), and
  its music with it till the new one is shown; what it tells meanwhile comes to the game with its own scene's folder
  (`on('line', (data, scene) => …)`, `on('tell', (text, about, scene) => …)`). The page's scene (`bespoke.spec`, its
  state) is the new one once it is shown; a show that fails throws, and the scene before stays.
- **A cut through black**: `bespoke.cut(values, {fade: seconds})`. A plain cut whose picture is not ready makes the
  scene's story wait (a moment, under the page's sign if it lasts) while the last picture lives — no black is needed
  to hide anything.
