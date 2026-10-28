# Mini-games — for authors of games

A bespoke game on engine-3 scenes makes its mini-games with **the language of mini-games** — a vocabulary of
interaction, the same in every game: marks on things (where one can touch), gestures (what the hand does there —
press, hold, pull, trace, turn, rub, seek, rhythm, lead), responses (a snap, an error with its cause, the glow of the
thing that is yours now, the ghost finger showing a gesture, sounds) and the plate at the top. **There is no logic in
it.** A mini-game is your game's code: a short scenario inside the scene that begins and ends. Your code decides
what happens, in what order, what is done, what is an error, a success, a loss, how long anything lasts, what the
scene does meanwhile — it may wait for the player or go on its own. Put as many marks and gestures at once as the
moment needs; the language only reports what the hand does and shows what you tell it to.

For reference, in this repository:
- `miniux/language.md` — the vocabulary: every mark, gesture, response, the plate, sounds, style — how each is
  for the player; what your game decides and how to do it well (§8); `miniux/wishes.md` — why.
- `play/minigame/` — the code; the heads of its files are the reference of the API.
- `games.md` — the bespoke game as a whole (`b.*`; the head of `play/runtime.js` is its full reference).
- `miniux/playground.md` — moood's playground of the language: every gesture, variant and part of the frame, one
  demonstration each — what it shows, **not** wording or a mood to take (below).

## 1. Choose the mechanic from the story — always

A mini-game is the character's action, lived through the player's hands. Before choosing a gesture, write four
lines for yourself:
1. **what the character does** here — the action in the story;
2. **what they want** — the intent;
3. **what state they are in, what they feel**;
4. **what the player, who feels for them, should feel** while doing it.

Then choose the gesture whose bodily feeling *is* that action and that feeling — not the one that is easiest, not
the one used last time:

| The hands do | It feels like |
| --- | --- |
| press | touching, deciding, a knock |
| hold (and hold with danger, hold still) | holding on, enduring, tenderness, not daring to move |
| pull, pull with resistance | effort, bringing near, someone reluctant |
| tear (pull without a target) | breaking free, letting go |
| trace a line | care, precision, following |
| turn | tightening, fixing, effort by degrees |
| rub | uncovering, cleaning, patient work |
| seek, inspect | searching, listening, noticing |
| rhythm (with the other, or one's own) | joining others, keeping pace, breathing, defying |
| lead (keep the arrow in a zone, away, after a moving thing) | steering, balance, restraint |
| wait | patience, enduring, letting it happen |

- **Choice or skill.** If the moment is a decision (to follow him or keep one's own beat, to leave the screw loose,
  to wait), make it a choice: the gesture's second path is visible from the start, the feedback is neutral, nothing
  says "wrong". If it is skill, it is done fully and rightly by the player, or it is not done (nothing finishes by
  itself).
- **Length by the emotion** — usually 20–90 seconds; stop before it tires.
- **No mini-game where no action is felt.** A moment that is only watched stays watched.
- **No dead ends.** A mini-game must always be passable; an error costs seconds. The player's ⏭ (§4) is there so that
  no one is stuck or tormented, not a way through.
- **An honest bar.** The plate's bar moves when the player does it right and stands or ebbs when not.
- **The outcome matters.** What the player did shows later in the story; a result thrown away teaches that the hands
  mean nothing.

## 2. The words on the plate

The plate in the middle at the top shows one short line while the mini-game goes on — the plate's phrase, which your game
sets and changes when it wants. That line:
- is written **as it would be written in the book** the game is made from, in its language: the author's narration,
  words, rhythm, genre, style and voice;
- **only describes the situation**: what is happening to the thing, what it lacks, what is at stake — so that what
  can be done is plain; it never commands the player ("hold", "pull" — no), never says "you";
- is written for adults: no cute personification of things, nothing that explains the obvious, nothing mechanical;
- says only what the scene shows (if the line has wind, the scene has wind).

**Do not take the playground's lines (`miniux`) as an example.** They are neutral test lines about a workshop table; your
game's lines come from its own world. The same moment, a knot that must give way, would be one line in a gothic
tale and another in a seaside fairy tale — find yours from the book's (or the game's own) text, not from the playground.

## 3. The scene's part

- Every mark stands on **a point the scene names** (`e.at(x, y, name)` → `'id#name'`, or `'id@'` — where the element
  is pressed; a person's is their head — the mark over the face —, another point of theirs puts it there: `'id#chest'`). Points live in **the middle 4:3 of the frame** (every screen sees it), not in its corners (the game's
  buttons), not at the bottom (the speech captions), not under the plate. A mark follows its point anywhere in the
  frame (a wide screen, a camera that moves) and is hidden while the point is out of it.
- The thing that is yours glows by itself (your game names the thing that glows; only if it *is* the thing — a point
  on a big thing glows nothing). Make the thing readable: one clear target with an accent, nothing that competes.
- The scene answers through its keys (the scene's animation values): a gesture reports what the hand does every frame, your code sets the keys
  (the sail rises, the screw turns). A thing the finger carries is drawn by the scene where the gesture says it is.
- Under a gesture aimed at a point the camera stands (the language stops the view leaning to the pointer; the scene
  must not move it). Gestures done anywhere (rhythm, lead, hold anywhere) may have a moving camera.

## 4. The API

`bespoke.minigame` (the heads of `play/minigame/index.js`, `gestures.js`, `tricks.js` are the full
reference). Every word is one call with one options object; what it makes is a handle — `h.set(o)`, `h.remove()`, and
for what lives `h.on(event, fn)` and `h.state`.

```js
const mg = b.minigame.start({ phrase: '…', signal });          // начало: the plate, the entering's sound
const knot = mg.mark({ at: 'knot#knot', kind: 'dash' });       // where one can touch: on a point of the scene
const pull = mg.pull({ on: knot, tear: 0.05 });                // what the hand does there — reported every frame
mg.glow('knot');                                               // the thing itself glows: it is yours now
pull.on('frame', s => { b.set('knot', s.u); mg.plate.set({ fill: s.u }); });
pull.on('tear', () => { mg.snap({ at: knot }); mg.end({ as: 'clean' }); });   // what it means — your code
```

- `start({phrase, sample, plate, signal})` → `mg`; `plate: false` — a plain choice between mini-games, no plate:
  a mark on each point, `press` with `petals` — always, one too: what a touch means is seen in words and pressed
  (a press with no petals is a mini-game's, the touch itself the action); gestures on marks only. It takes no
  screen: a touch off its marks is the scene's (its camera dragged as the scene lets — a map the player walks along)
  and no miss; while a mark's petals are out, a touch off them folds them. While it goes on the view stands (no lean). On
  engine 3 the glow of things is the language's alone: `b.offer` (the old rings) is an error there.
- Marks: `mg.mark({at, kind: ring | groove | dash | spot | light, quiet, color, danger, time, hidden})`; `at` — a
  point of the scene, or a function giving a page point of your own drawing over it (a map's tree: `games.md` §2),
  placed by the same rules and hidden out of the frame. Marks are drawn light on a dark band (seen on any ground) and
  **grow with the frame**: the language's px (mark sizes, and the radii and tolerances gestures take — `turn` radius,
  `rub` radius, `seek` radius and near, `trace` tolerance) are px of a window 640 high; on a taller one all of it is
  height / 640 times larger (never smaller — on a phone they stay a finger's). A touch on a mark counts within its
  **touch circle**, wider than it is drawn (1.4× its radius, never under 32 language px); every touch taken is answered
  by a ring of light round the finger, wider than a fingertip.
- A mark born open: `mg.press({on, petals, open: true})` — its petals out at once, as if just touched (the touch
  answered there), for a choice the player opened by pressing your own drawing (a map's pointer, fork, knot —
  `games.md` §2): no mark waits idle; a touch off the petals folds them — the press's `'fold'` —, and you take the
  mark away (`mg.leave()`).
- Gestures, on a mark (`on`) or anywhere (`on: null`), any number at once: `press` (petals), `hold`, `pull` (to a
  target along a way, free to targets, tear; heavy, spring), `trace`, `turn`, `rub`, `seek`, `rhythm` (bpm or the
  moments, breath; on a `light` — only shown), `lead`, `touch` (the touch as it is — for a gesture of your own).
  A `pull`'s mark is on the thing and stays with it where it is let go (unless `spring`): the next pull takes the
  thing where it is now, as a hand would. A `lead`'s track is seen all the while the gesture lasts: under the finger
  (or the ghost) where it presses, and between presses resting, quieter, where it was last laid (at first in the
  middle).
- Responses: `mg.snap`, `mg.error(reason, {at, finger, chip})`, `mg.glow(id)`, `mg.sceneTurn(on)`,
  `mg.end({as: clean | flawed | neutral | loss})`, `mg.leave()`; the ghost: `mg.show({gestures} | {handsOff})`;
  sounds: `mg.sound(role)`, `mg.layer(role)`; the ghost shows each gesture slowly enough to be read the first time
  (it comes, presses and holds a beat before it moves, holds the end a beat; a tear is pulled a fifth of the window's
  height at least); the plate: `mg.plate.set({phrase, fill, notches, glow, shade, ways,
  sample})`; `mg.on('frame' | 'down' | 'miss' | 'pause' | 'resume' | 'skip' | 'end')`, `mg.t`.
- `b.minigame.tricks` — ready ones on the same words: `holdTillFull`, `pullTo`, `traceLine`, `turnTimes`, `rubTill`,
  `seekAndHold`, `hitsInBeat`, `keepInZone`, `steps` (each its part of the bar), `teach` (the ghost at the first
  meeting and when the player stands still), soft first meetings. Use them, copy them, or write your own.
- `style(s)` — your game's look and sounds, and its key (`key`: Lyria's name of a pair, the `scale` of its world's
  music — `C_MAJOR_A_MINOR`…; the language's tonal sounds are on its tonic; none — `D_MAJOR_B_MINOR`); `relative(p, a, b)` — where to draw a thing the finger carries.
- The skip: the language draws no button — the page's ⏭ does it (`games.md` §5): give `b.forward(fn)` a fn that calls
  `b.minigame.skip()` while the mini-game may be skipped (the mini-game hears `'skip'` and decides what to skip), and
  `null` while it may not. When it may, your game decides — not the language: in a step the player has seen before;
  in one not seen, once they have been in it a while (some twenty seconds) or failed it several times — so that
  no one is stuck or tormented; it is not a way through — make every mini-game passable all the same. A skipped
  mini-game leaves in the story the same trace as one played: end it with the result a play gives — the plain good
  outcome, as if played cleanly — not a mark your chapters would read as missing. (A game that does not use
  `b.forward` draws its own ⏭ in its row of buttons and calls `b.minigame.skip()` from it.)

## 5. Your own gestures

When none of the nine is the action, make your own on `touch` (the touch as it is) and the same marks, responses and
plate, by the language's rules:
presses and drags with a press, never hover; one finger; a target ≥ 64 px to touch (more on a large screen — the
language's px grow with the frame, §4: a mark's touch circle is wider than it is drawn), in the middle 4:3; an answer to
every touch at once; it plays on a phone held sideways and on a computer alike. Prefer the language's gestures — a
player who learnt one once knows it in every game.

## 6. Before you merge

- The four lines of §1 are written down (in the scene's or the game's notes) and the gesture fits them.
- Every plate line is in the game's voice, describes the situation, is true to the scene.
- Every point is in the middle 4:3, not in a corner, not at the bottom; the glowing thing is the thing itself.
- Every result reaches the story.
