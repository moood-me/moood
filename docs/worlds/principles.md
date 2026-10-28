# How we make scenes and games — the principles

Read this first. It is how this project works, said by its author; the other documents (`scene-format-3.md`,
`scene-format-1.md`, `people.md`, `motion.md`) say how — this says what matters and what never to do. When a rule here
and a habit of yours disagree, the rule wins.

Two engines run scenes, and a scene says which (`README.md`, "What a scene is"). Every new scene is engine 3's
(`"engine": 3`): its language, with that engine's own rules and principles, is `scene-format-3.md`. What follows stands
for every scene; where `scene-format-3.md` says otherwise for an engine-3 scene — what a scene must be, what a frame
costs —, that text is the one to follow.

## What matters

- **Quality for the viewer and performance** — not ease of making. Never pick the easy way or "good enough";
  pick what the viewer sees and what runs smoothly. Rewriting a scene (or the engine) whole is fine; backwards
  compatibility isn't needed.
- **Only the right ways.** No compromise, no workarounds, no shortcuts — common sense and real best practice, every
  time, not "the game is simple, we'll do it later". If something doesn't work, don't make it work at any cost:
  fix it in the right direction, or say what's missing.
- **No prop-ups for one scene.** There will be many scenes: anything bent to fit one breaks another. The engine is
  general and right; a scene that hits an engine gap reports it (what, where, how to reproduce) and doesn't fake
  around it — an invisible element standing in for a point, a clip trick, a number tuned to hide a bug, a scene
  light making up for light the engine should give.
- **Keep all the beauty.** Nothing beautiful in a scene is dropped or simplified when it is rewritten. Reach it
  another way if the old way doesn't fit (a GPU-friendly way, as good games do) — don't insist on "as it was",
  but never lose it.
- **Beauty is what the viewer perceives** — mood, light, colour, people clearly read, a reflection in a mirror, haze
  in a room — not mathematical exactness or physical truth. The same impression can be reached dearly or cheaply:
  choose the cheap way that looks alike.
- **For every device.** The game is for weak laptops with integrated graphics and Android phones as much as for a
  strong machine: what is known to be costly there is given up — known from theory and from reading the code, not
  waited for as a measurement on one machine.
- **Don't code uncertainty.** No fallback paths: a thing is done one way, always. It works — or it doesn't, and then
  it is fixed. Two modes only as a deliberate decision with reasons that fit the other rules. A prop on a prop means
  something was not done as asked: remove the cause.

## How to work

- **By reading, not by render loops.** Write the whole thing; review it by reading against the language (every
  promise of the scene's language (`scene-format-3.md`) → your code; every seam → both sides); collect every defect; fix them all at once;
  only then render. Fix everything the renders show in one batch; render once more. Never "tweak a little, look
  at a hundred frames, tweak again" — renders are slow, and errors found one by one by rendering are found late.
- **Render on the GPU through moood**, never on your own machine in software: `render_scene` — a branch's scene, or
  your draft's files (`sheet`, `at`, `state`, `showcase`). Open a picture only when you need it — it costs.
- **Long commands with long timeouts, polling loops, killing processes by name** — none of them.
- **Say what you did**: the scene's `notes.md` (what is where, why, what changed in meaning); a generator that
  makes a scene lives in the world's repository (`tools/`), never only on your machine.

## A scene

- **Painted once, moved by the engine.** A painting is drawn once per state; nothing a painting reads may move
  while a scene plays. Motion is the engine's, on the GPU: layers (`wind`, `drift`, `flicker`, `shimmer`, `pivot`)
  moved by `animate`, an element's own shader, particles, people, light. A key a painting reads that changes every
  frame repaints every frame — never. A painting that keeps repainting gets a warning: it means this rule is
  broken.
- **What happens must be seen.** People, faces and the action read clearly in every frame — at night and in dark
  rooms too: keep the mood by colour and contrast (pools of light, rims, moonlight), not by hiding people in the
  dark. An older version of a scene is not the measure of darkness — some were too dark; be bolder than they were.
- **Light is the engine's.** Paint in daylight colours; the scene's light lays the look (time of day, lamps,
  rims, the haze after the light — linear: old look numbers come out darker, tune them on renders). Don't paint
  pools, rims, halos or the hour into pictures; a lamp's halo is its light plus the haze's glow.
- **Driven by the game's events, not by seconds.** The scene is the presentation (what is there, how it looks,
  how it can move); the game is the logic (what and when). The scene offers actions to await, tracks, sequences
  and events (`scene-format-3.md`, the director); its beats are ≤ 30 s, a seek point at each start. A film that is a
  table of seconds is the mistake we left behind.
- **Its own showcase** (`showcase.js`): outside games the scene plays its own little scenario showing everything it
  can do, with a timeline and seeking.
- **People at their real speed.** A motion plays at the speed its body model gives — never faster or slower,
  never stretched to fit a time or a distance; another speed is another gait, made as such (`make_motion`).
  A scene that needs someone somewhere by a moment waits for them to arrive.
- **At rest, always visible.** A scene's starting state is never black or dimmed: its picture, its preview and its
  page show it.
- **A scene never fades itself** — not at its start, not on cuts, not at its end; it has no veil or fade key of its
  own. Fades are the game's and the page's: a scene change with or without black (`bespoke.show(scene, {fade})`),
  a cut through black (`bespoke.cut(values, {fade})`), a dim under a text and black at the end
  (`bespoke.fade(level, seconds)`) — `../games/games.md` section 7.
- **No fades to hide a change.** Prepare the next shot ahead (`s.shot`) and cut; the change happens on the cut's
  frame. A cut that is not ready makes the story wait while the picture lives.
- **A world where it is.** Lay things where they are and move the camera over them (kilometre worlds are fine) —
  never scroll paintings past the eye to fake travel.
- **The game's contract is kept.** Keys, element ids, named points, beat names a game or another scene uses keep
  their meaning — or say in `notes.md` what changes and why. Tell the game the moments it needs (`scene.tell`,
  a key it can watch, where someone is in the game's own units); a game must never copy a scene's numbers or
  wait milliseconds for a scene's moment.

### Pitfalls already met

- A cast's `F.fit.h` is the person's height as a **share** of a man's 1.76 m — `F.fit.h / 1.76` makes every part
  0.57 size. Parts are in metres of a man: `x * F.fit.h`.
- A layer that travels (drifts, wraps in a shader, is moved by `animate`) needs a `box` covering its whole path,
  including a shader's wrap range; a layer that paints nothing drops out and renumbers `layer(k)`.
- Everything an `animate` sets must be a number (`e.aspect` exists there too); a non-number is refused.
- Something seen only in a mirror: `"seen": "reflection"` — never a clip or an invisible plane.
- A point a game needs on a close-up or the sky: mark it (`e.at`) in the insert / sky — the page gets it as a
  screen point.
- A mirror shows only where its plane is painted.
- A mirror's image is a small plain copy: no shadows in it, a little softer than the scene, and a mirror seen in
  another mirror does not mirror there. A looking-glass that must be sharp: `"blur"` under 0.03.
- The light in the air (`hazeGlow`, `shafts`) is soft: a beam has no sharp edge and shows no glazing bars.
- Light is worked out at a painting's points, not at every pixel: a lamp's pool on a wall or a floor is soft, and a
  shadow or the sun's patch through a window is sharp only on what is opaque and faces a way (the ground, a plane, a
  card with `facing`) or is named in the shadow's `onto` — a floor meant to take them is a plane, a wall a card with
  `facing`; on a card with no `facing`, on a layer, on anything see-through they are a soft dimming. Only the two
  lights that matter most to the view cast sharp shadows at once.
- A `translucent` thing casts a lighter shadow, not a coloured one.
- Several agents on one world: the shared modules have one owner; others ask for changes through them.

## A game

- **How a bespoke game is put together** — chapters and steps, the map of the play the player finds their way on,
  what it keeps, replays, the page's ⏭ and ☰: `../games/games.md`.
- **The game leads the scene by events**: it sets keys and runs actions, and waits for what the scene tells
  (an action ended, someone arrived, a line was heard, a shot cut) — not for seconds. Its own pauses are its own;
  a scene's moment is the scene's event.
- **Fades are the game's**: it asks them of the page (`show`, `cut`, `fade`); it never sets a scene's own fade or
  veil key.
- **Nothing slow for the player**: a click, a menu, a highlight, a minigame answer at once (the next frame); the
  page's main thread does almost nothing per frame.
- **The player always sees what the game waits for** (a line saying what's now; what can be pressed glows);
  something meaningful in the first 30 seconds; short chapters (5–10 min) that continue where left; fewer choices
  but sharper, their consequences seen soon; minigames that work on a phone and can be skipped after a failure (the
  page's ⏭: `../games/games.md` §5);
  everything voiced; an AI character with a wish and a secret; every branch checked automatically (each beat
  played: black frames, errors, stalls).

## What a frame must cost (the stand: `measure_scene`)

A scene is played on moood's GPU as a viewer has it — opened, its film or showcase, the wheel, a drag, leaning,
walking, a cut at once and one made ready ahead — and held against these; one that doesn't pass, isn't done.

- Every scene: 60 fps — frames p95 ≤ 16.7 ms, worst ≤ 33 ms (its film, the zoom, the drag); the scene's thread's JS
  ≤ 3 ms a frame (median; p99 ≤ 6 ms); no GC pause over 2 ms, ≤ 1 KB allocated a frame; the page's main thread ≤ 1 ms
  a frame, no task over 50 ms (opening too); a prepared cut ≤ 1 frame late; input seen the next frame.
- The old engine's scene (1080p and 4k): also, in a settled frame, zero repaints and zero uploads; GPU p95 ≤ 8 ms;
  open to a ready frame ≤ 2 s.
- An engine-3 scene, in each profile (desktop, laptop, phone — the device's tier, given): also its soft run (what
  the view lacks while it moves, painted) ≤ 0.5 s (a phone 1 s), pages painted again ≤ 8 a second (a phone 4), an
  insert ≤ 0.25 s late; the GPU's time and the opening are reported, not judged (`scene-format-3.md` says what its
  frame costs).

The report says which hold; when the GPU's time is over, its "by pass" lines (and, on a scene's page, the P key's
panel) say which pass of the frame it goes to.
