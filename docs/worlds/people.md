# People in a scene

An element with `person` is someone standing in the scene — drawn in 3D as the scene's camera sees them, moved by
real human motion (NVIDIA Kimodo's), lit by the scene's light, in front of and behind what is round them pixel by
pixel, casting shadows like any element. Who they are is a **look** (the same as `look_at_motion`'s — motion.md,
"How a person is seen": a figure of designed shapes in one of its styles, or a real body in real clothes); how they
move is the scene's **state**: where they stand (the element's `place`), what they do, where they face.

```json
{ "id": "rosa", "name": "Роза", "person": { "look": { "kind": "shapes", "style": "soft", "who": "lady" } },
  "across": -0.6, "distance": 4.6, "place": { "across": "rosa_a", "distance": "rosa_d" }, "shadow": true }
```

```js
// the scene's script: she walks to the lamp, turns to us, waves (a motion of the world's cast)
scene.sequence(async s => {
  const rosa = s.person('rosa');
  await rosa.walk([[0.2, 4.2]]);
  await rosa.turn(180);
  await rosa.do('wave');
});
```

This is engine 3's (a scene with `"engine": 3` — every new scene): what people do are actions of the scene's director
— each takes as long as it truly takes, and what follows waits for it (`scene-format-3.md`: Scripts and the director);
what its people do not have of this guide (a real body) is said there too: People. A scene made for the old engine (no
`"engine"`) says the same through its keys and seconds: `scene.person(id).walk(…)` returns its seconds,
`scene.after(seconds, …)` goes on (`scene-format-1.md`).

Two people by a lamp — a figure of shapes and a body, lit by it, their shadows cast:
[people/scene-lamp.webp](people/scene-lamp.webp).

She stands and breathes, walks at her gait's own pace (the motion played at the speed it was made — never faster or
slower; her feet never slide), faces the way she goes, turns, does what she is told, and goes back to standing; she looks at what she is told to, reaches for it,
holds what is hers. Her head is her point (`e.at`): her lines appear over it, `camera_target: "rosa"` frames her.
Her points — `head`, `hand_r`, `hand_l`, `hands`, `elbow_r`, `elbow_l` (engine 3), `chest`, `hips`, `shoulder_r`, `shoulder_l`, `back`, `nape`, `foot_r`, `foot_l`, `feet`, and
those of the parts she has with her (a torch's `flame`) — are where they are now, on her as she is drawn: `"rosa#hand_r"` is her right hand, for anyone to look at, reach for, aim a camera at (`back` — between
her shoulder blades, where arms round her hold; `nape` — behind her neck, where hands round it meet) — and for an
element to follow: `e.point("rosa#hand_r")` in its `animate` is where it is in that element's painting now (a glow in
her palm, a thought by her head, a book's point at the reader's hands, a rope from a hand to a calf's halter — a layer
moved there each frame; the old engine's painting reads it so).

## The element

| field | what it is |
|---|---|
| `id` | needed: the keys of their state are named by it |
| `person.look` | who and how seen: `{"kind": "shapes", "style", "who", "garment", "hair", …}` or a body `{"who", "style", "outfit", …}` — motion.md, "How a person is seen" (and its gallery) |
| `person.cast` | the world's module their people are of (it must be in the scene's `modules`): its motions, characters, styles, garments, bodies… (below) |
| `person.who` | a character of the cast (`cast.characters[who]`: a look); `person.look` goes over it |
| `person.turn` | where they face standing, degrees: 0 away from the camera at the start, 90 to its right, 180 towards it (the default), 270 to its left |
| `person.does` | what they do when nothing is said (a motion's name; `stand` by default); `person.gait` — how they walk (`walk`) |
| `across`, `distance`, `elevation`, `place` | where they stand, as any element; to walk, `place` names the state keys of `across` and `distance` |
| `shadow`, `behind`, `inFront`, `inside`, `after`, … | as any element's |

Their height comes from their look (a child is small), their box from how they are now (an arm up with a torch, lying
full length); no `code`, no `height`, no `box`.

## Their state

| key | what it is |
|---|---|
| `<id>_do` | what they do: a motion's name (`"sit"`), or `{"motion", "loop": true \| false, "from": seconds into it, "going": true}`. A new value goes over from what they did in a third of a second. Looped: on the spot, on the motion's best loop (found by itself); not: played once, then held at its end — and it **ends where they stand, facing their turn**: the place and the turn are its end's (sitting down ends on the seat; where it begins is `stage.startOf`, and `go` takes them there). `going`: done once as they go — on the spot, their place carrying them on, in place of their gait while it plays (a stumble in the middle of a run), the gait back as it ends |
| `<id>_turn` | where they face standing (degrees, as `person.turn`; carried — standing `on` an element, held, sat in it — within its turn); they turn to it at a person's pace |
| `<id>_look` | what they look at: an element's id (its point; a person's head), `"id#point"` (a person's point, an element's named point), `[across, distance, elevation]` metres, or `{"on": id, "at": [across, distance, elevation]}` — a point in an element's own frame, going and turning with it (metres from its anchor along its axes, as `"on"` places things: 40 m ahead out of a running carriage's window), or in a person's — their own too: where they stand, turned as they face, the frame an element standing there turned so has (facing the start: across to the right as seen from it, distance away behind them, elevation up from their feet — `{"on": "matryona", "at": [0, -0.3, 1.1]}`: 0.3 m before her, 1.1 m up, wherever she turns; none while they are not here); `null` — ahead. The head and the neck turn to it, over the motion, as far as a head turns (70° aside, 40° up or down); further round — back over a shoulder — the waist and the chest turn the rest (up to 50° more), the hips going on as the motion has them; what lies steeply below or above the head (their own hands, the floor at their feet) they look down or up at, not round (engine 3). The body stays as turned: told to look at someone behind them on the far side from the camera, they show the back of the head — turn them toward what they look at (`_turn`) |
| `<id>_reach` | what their hands and feet reach for: `{"r": …, "l": …, "foot_r": …, "foot_l": …}`, each as `_look`'s; `null` — back to the motion's. A limb's reach (two bones): as far as it is long — a foot caught between stones, a hand on another's foot; a point past its end, straight toward it (arms along the sides of one lying in a coffin). Told to reach for another thing, the hand goes over to it from the one it held, in a moment (off the lid onto a friend's hand). Hand in hand: a hand reaching for another's hand (`"led#hand_l"`) that reaches back for it (`"guide#hand_r"`) — the two meet between, halfway from where their motions have them, raised to each other where one could not reach so far |
| `<id>_with` | what they have with them now besides what their look wears: `["guitar"]` (the cast's `parts`, drawn on them as they move), added to the look's own `parts`; `null` or `[]` — nothing besides. The look's own `parts` stay on them whatever `_with` says: a thing they have only some of the time is not in the look's `parts` but given by `_with` (or the look's `parts` changed by `_wear`: `{"parts": ["box"]}` — a look made anew) |
| `<id>_wear` | their look's fields over it now (a figure of shapes): `{"barefoot": "right"}` — a shoe off (`left`, `right`, `both`), `{"hat": "none"}`; a whole other look of theirs (the boy years later) — the look's own object, taken from the cast module (`scene.kit.<module>.characters.david_teen`), NOT its name: a string is read as nothing and the figure stays as it was (the engine takes only an object here); `null` — as it is |
| `<id>_gait` | how they walk now: a motion of theirs that walks (`"carry_walk"`, `"climb"`, a walk backwards: they face the way it faces as it goes — backing away, pulling a door shut); `null` — the cast's. A new gait goes over from the one before in a third of a second (a run slowing into a walk) |
| `<id>_steps` | `false`: moved as they are, no steps — sliding down a bank sitting, pushed, carried (a place that moves with them does not walk them) |
| `<id>_on` | on another's arms: a point of theirs (`"mother#hands"`), or `{"at": "mother#hands", "up": -0.22}` (that much higher — lower: a big child held by the waist); their hips there as the other moves, turned as the other is (their `_turn` from it: 180 — facing them), no steps, not on the land. Or sat on a seat: `[across, distance, elevation]` — a point of the world, its elevation over the land there, as everywhere (`{"on": "carriage", "at": […]}` — one in an element's frame, carried with it; not in a person's: a person carries no one in their frame — on their arms is how) — the top of a barrel, a wall, a high stool: their hips over it as high as a pelvis sits, turned as their own `_turn`, a seated motion of theirs doing the rest — the feet it has on its floor set on the floor under the seat as far as the legs reach with the knee bent (a low stool: the knees up; a chair a little high for her: the feet down to the floor), else hanging as the motion has them (a barrel, a child on a tall stool). `null` — on their feet; let down into a motion done once (off the barrel onto their feet), they go from where they were held to where it puts them as the motion goes from its first pose to its last. Or on a thing: an element's point (`"coffin_floor#bed"`, `"cart"`) — their floor there, their hips over it, going and turning with it (their `_turn` within its turn: lying in a coffin as it is carried, standing on a cart); a point its animate marks (a saddle rocking with the stride) holds them in the same frame — so does one they look at or reach for (engine 3). `null` — on their feet; let down into a motion done once (off the barrel onto their feet), they go from where they were held to where it puts them as the motion goes from its first pose to its last |
| `<id>_here` | `false`: not in the scene now — come later, gone (not drawn, no shadow, nothing of them worked out); `true` by default. Back, they are at once where the state has them then, doing what it says (engine 3) — not walking in from where they went |
| `<id>_reflected` | `false`: not in mirrors — no mirroring plane, no pane of glass shows them (a ghost, a vampire before the looking-glass); seen directly, casting their shadow, picked as ever. `true` by default; set it to `true` and they show in the mirror from that moment (the ghost appearing in it). Engine 3 |
| `<id>_still` | `true`: they stop in time — the pose of that very moment held (in the middle of a step, if they were walking), no breath, the cloth hanging as it hung; `false`: they go on from it |
| `<id>_mood` | the face's expression (`neutral`, `smile`, `laugh`, `sad`, `angry`, `surprised`, `afraid`, `disgusted`, `thinking`, `tired` — motion.md; and `eyes_closed` — the eyes shut, the rest at rest: dozing, leaning back with the eyes closed, engine 3's figure of shapes only); a figure of shapes shows it with the face `simple` (eyes, brows, nose, mouth — at rest without a mood) |
| `<id>_talk` | a body's mouth talking: 0…1 |
| `place`'s keys | where they stand; moved, they walk there |

A cut (`scene.cut`: a new shot) finds them where it puts them: set there in it, they do not walk there — doing what it says, turned as it turns them, looking and reaching at what it says, nothing going over from before it.

A game sets these as it sets any key — or acts through the director (engine 3: `MooodState.act(id, 'walk', points)` …,
awaitable). A script has `scene.person(id)` — in engine 3 each verb that takes time is an action (awaitable; `ending`,
`cancel`, `pause`, `resume`), on the person's own track (a new walk replaces the one going, from where they are):

| | |
|---|---|
| `.do(motion, {loop, from, going})` | what they do (again, if it is the same: it starts over); engine 3: done once — done as long as the motion is; looped — at once (what they do from now) |
| `.walk([[across, distance], …], {speed, gait})` | from where they stand (their place's keys — not set yet, the element's own across and distance) along the points (metres), facing the way, and stays facing so — at their gait's own pace (engine 3; `speed` only for a gait made for it); done as they arrive (the old engine: at `speed` m/s, 1.3; returns its seconds) |
| `.go(motion, {to \| from: [across, distance], turn, speed})` | a motion done once that ends at `to` (or begins at `from`) facing `turn` at its end: they walk to where it begins, turn as it begins, and do it — done as it is (the old engine: returns its seconds till it begins). `go('sit_down', {to: SEAT, turn: 180})` — onto the seat; `go('rise', {from: SEAT})` — up out of it |
| `.say(text, {voice, how})` | engine 3: the line over them, in their voice (its name; how — the manner, a line's own if it has one; inline tags — `<sigh>` — heard, not shown), done as it has been heard |
| `.turn(degrees, over?, ease?)` | where they face standing |
| `.look(at)`, `.reach({r, l, foot_r, foot_l})`, `.with(parts)`, `.wear(fields)`, `.gait(motion)`, `.on(point)`, `.here(yes)`, `.still(on)`, `.reflected(yes)` | as the keys |
| `.walk(points, {speed, steps: false})` | moved along the points as they are, no steps (sliding); steps again at the end |
| `.startOf(motion, turn)` | where that motion done once begins, from where it ends — what a script needs to know where they will be |
| `.mood(expression)`, `.talk(on)` | the face: its expression (a body's, or a figure of shapes' face `simple`); talking — a body's |

`stage.startOf(id, motion, turn)` — where a motion done once begins, from where it ends: `{across, distance, turn}`.

## Motions

The engine has `stand` and `walk`. Everything else is your world's: make it, look at it, put it into the cast.

1. `make_motion(["A person waves with the right hand, smiling."], [3])` (motion.md: how to ask well) → its key.
2. `look_at_motion(key, look={…the person's look…})` — on the person who will do it.
3. `put_motion(key, world, branch, "wave")` — written into `modules/cast.data.json` of your branch (the module made
   if there is none: its data is the cast). The motion never passes through you: no tokens spent on it.
4. In the scene: `"modules": ["cast"]`, the person's `"cast": "cast"`; then `<id>_do: "wave"`.

A loop is played on the spot (what it does over the floor left out). A motion done once is its own way over the
floor, and it ends where they stand: a step back, a sitting down, a getting up — each fits the place it ends at. To
go somewhere far — walk.

## The cast: the world's own

The cast module returns its cast (`return data;` — its data is it; or code adding to it):

```js
// modules/cast.js
return {
  ...data,                                   // motions: put_motion's
  characters: {                              // looks by name: person.who
    rosa: { kind: 'shapes', style: 'ink', who: 'lady', colors: { garment: '#5a2e3a' }, parts: ['satchel'] },
    gleb: { who: 'oldman', outfit: 'warm', style: 'clay' },
  },
  shapes: {                                  // a figure of shapes' own, over ours
    styles: { ink: { from: 'graphic', line: 2.4, paint: 'toned', ground: 'paper' } },
    characters: { lady: { from: 'lady', body: { height: 0.9 } } },
    garments: { cloak: { name: 'плащ', hang: [{ to: 1.6, from: 'shoulders', flare: 0.35, ragged: true }], sleeves: 'garment' } },
    hair: { curls: { name: 'кудри', draw: F => { /* F.head, F.ball… (below) */ } } },
    // a part may name its points: { torch: { points: { flame: { joint: 'LeftHand', off: [0.08, 0, 0], rise: 0.33 } }, draw } }
    // — off that joint along its axes ([side, up, forward] metres of a man's 1.76 m) and `rise` straight up: "keeper#flame";
    // or its draw marks it where it draws it — F.point('candle', centre) (below): a point on what is held between the hands
    parts: { satchel: { name: 'сумка', draw: F => {        // a bag in her right hand: where the hand is, as it turns
      const { add, mul } = MooodShapes.V, hand = F.P('RightHand'), axes = [F.side('RightHand'), F.up('RightHand'), F.fwd('RightHand')];
      F.ball(add(hand, mul(axes[1], -0.1 * F.k)), axes, [0.05, 0.09, 0.11].map(v => v * F.k), F.colors.accent, 14);
    } } },
  },
  outfits: { warm: { name: 'тепло одет', wear: ['boots', 'vikingpants', 'sweater'] } },  // a body's: our garments and the cast's
  // garments: { cape: {kind, bin, credit} }, bodies: { hero: {base, bin, height, parts, credit} } — the people tools'
};
```

This very cast in a scene — rosa in the `ink` style with her bag, gleb in the `warm` outfit:
[people/scene-cast.webp](people/scene-cast.webp).

**A figure of shapes** (`cast.shapes`) — each table over ours by name; a style or a character may say `from` (one it
is made from, ours or the world's, its own fields over it):

| table | an entry |
|---|---|
| `styles` | `{name, head, egg, neck, legs, limb, sides, square, trunk: {w, d}, arms, feet, paint, line, folds, ragged, rigid, straight, drape, face, ground, …}` (shapes.js: STYLES) |
| `characters` | `{name, body, garment, hair, hat, hood, scarf, socks, face, parts, colors}` |
| `garments` | `{name, hang: [{to, from: 'shoulders' \| 'waist', flare, off, color, folds, ragged, pleats}…], sleeves, short, bare, bodice, draw?}` |
| `hair`, `hats`, `faces`, `parts` | `{name, draw(F)}` — `parts` worn by a look's `parts: [names]` |
| `arms`, `legs` | profiles `[[where, half-width]…]` (0 shoulder/hip, 1 elbow/knee, 2 wrist/ankle, 3 tips) |
| `paints`, `grounds` | names; `{name, bg, ink, grid, rim, light, haze}` |

`draw(F)` draws on the figure being made, as ours do (all of ours are made so — shapes.js shows them):
`F.look`, `F.style`, `F.colors` (each `[r, g, b, toned]`; a part's own colour may say, as its fourth, `2` — it glows: its own
colour whatever the paint and the light, a lamp's glass, a flame — or `3` — in colours on a silhouette: a book's pages in
a candle's light on someone drawn as a shadow), `F.fit.h` (their height as a share of a man's 1.76 m — a man's metre at their size: a length of a man's `x` metres is `x * F.fit.h`; not metres), `F.k` (thickness, the same way), `F.sides`;
the joints — `F.P(name)` (where; SOMA's names: Hips, Spine1, Chest, Neck1, Head, LeftArm, LeftForeArm, LeftHand,
LeftLeg, LeftShin, LeftFoot… motion.md), `F.fwd(name)`, `F.side(name)`, `F.up(name)` (its axes); the head —
`F.head {at, axes, egg, r, out, sides, square, on(direction, out)}`; the trunk's sections `F.trunk(scale)`,
`F.ringOf(section, n, square)`; what is worn round the chest `F.worn`; `F.clear(point, ±1, r)` (kept before or
behind what is worn); `F.swing(name, target, stiffness)` (a point following, a little late: hanging things); `F.keep(make)` — what a draw keeps from one frame to the next (its lists, its sizes: `make(F)` once a figure, the same object after — a part drawn each frame, a lantern held, makes nothing anew); `F.point(name, at)` — a part's point where it is drawn (`at`: a position as F's others), the person's `#name` point like the others (a light's `at`, a look, a reach, the camera; both engines); and
the solids — `F.ball(c, axes, radii, colour, sides, square?)`, `F.cap(c, axes, radii, direction, edge, colour,
sides, square?)`, `F.tube(points, profile, colours, sides, hint, flat?, square?, cut?)`, `F.bar(a, b, ra, rb, colours,
sides, hint, flat?, square?)`, `F.shell(c, axes, radii, edge(a), flare, colour, sides, square?)`, `F.rings(rings,
colours, first?, last?)` — `flat` (a tube's, a bar's) is a number, not a yes/no: the section's depth (across the hint) as a share
of its width — 1 round (unless said), 0.25 a board, 0 nothing (a sheet seen edge on); `square` — 2 round (unless said),
more — squarer (3: a plank's section); `cut` — a tube's ends flat; a sheet hanging as cloth — `F.cloth(rows, colour, held?)`: rows of points across it, top down,
the first `held` (1) going with the trunk, the rest cloth hanging from them (an apron: over the thighs sitting, swinging
as they go; only in what is worn from the start — a garment, the look's parts). An open solid — a cap that is no
whole egg, a shell, rings left open at an end — is seen from both sides, each lit as it faces (engine 3). Vectors: `MooodShapes.V` (`add, sub, mul, dot, cross, mix, unit, level, mean`).

**A body** — the cast's `bodies`, `garments`, `outfits`; a look's `who` may name a cast body, `outfit` a cast outfit
(its `wear` from the inside out: shoes, a bottom, a top, an apron, then hair — ours and the cast's), `hair` a cast
garment of kind hair. Made with the people tools (Docker):

```
docker run --rm -v people-tools:/cache -v "$PWD:/work" ghcr.io/moood-me/people-tools neutral       # the body to model on
docker run --rm -v people-tools:/cache -v "$PWD:/work" ghcr.io/moood-me/people-tools garment cape.obj cape --kind top --hangs --middle
docker run --rm -v people-tools:/cache -v "$PWD:/work" ghcr.io/moood-me/people-tools body hero.glb hero --part Shirt=top
```

Each writes a JSON snippet for the cast's data and a picture to look at first (the image's README: every knob).

## Recipes

- **Someone walks in, stops, talks.** `place` keys; `walk(points)`; at its end `turn(180)` and, a body,
  `talk(true)` while their lines show; `talk(false)`.
- **Sitting.** A chair is an element; its seat is where the person sits (`across`, `distance` — the hips over it,
  measured once on the scene with `--debug`). Seated from the start: their place the seat's, `person.does` a
  seated loop of yours. Sitting down: `go('sit_down', {to: SEAT, turn: 180})`, then, when it ends, `do('seated')`
  looped. Up: `go('rise', {from: SEAT})` — it ends where the getting up takes them. Make the motions so: one sits
  down and ends still; one starts seated and ends standing.
- **Hand in hand** (leading someone out, walking together). Each reaches for the other's hand — `guide_reach: {r: "led#hand_l"}`,
  `led_reach: {l: "guide#hand_r"}` — and they meet between as the two walk (a step apart: the hands raised to each other
  as far as both arms reach); `null` both to let go. Drawn back the other way, a walk backwards as their `gait`.
- **A handshake, a touch.** `reach` the hand to the other's point (`"guest#hand_r"`), the other's hand out to a
  point between them (`[across, distance, 1.0]`); a motion of the hands meeting under it gives the grip.
- **Looking.** `look('rosa')`, `look([-3, 10.4, 2.9])` — a portrait high on a wall; with a motion that keeps the
  head still, the look is all the head does.
- **Something in the hands.** A part of the cast (`parts: { guitar: { draw: F => … } }` — drawn between
  `F.P('RightHand')` and `F.P('LeftHand')`, as the hands go); `with(['guitar'])` when it is picked up, `with(null)`
  when it is laid down — the scene's own guitar element hides while it is theirs (its code reads `<id>_with`; its point,
  for a game's choice on it, `e.at(...e.point("roderick#hands"))`). A lamp carried: the part (its glass a colour that
  glows, `[r, g, b, 2]`) and the scene's light at the hand, `{"id": "lamp", "at": "roderick#hand_r", "on": "lamp_held"}`.
  Put down: where the motion's hand sets it (a motion done once at a known place and turn puts the hand at a known
  spot) — the floor's lamp an element's painting there (`e.point([across, distance, 0])`), a light there.
- **Holding each other.** Kimodo moves one person: make each one's motion alone (she lurches forward, the arms up; he
  opens his arms and is borne back a step; each goes down onto the knees in place — a `root2d` constraint at the
  origin), bring them to where those motions end facing each other (`go(motion, {to})`), and their arms round each other
  by `reach` — her hands to `"roderick#nape"`, his to `"madeline#back"`; a head bowed over the other by `look`.
- **A beat as long as its people.** A row a beat ends on must be there: `[10.6, () => {}]` holds it while they
  finish what they do.
- **Running, stumbling.** A run of the cast's as their `gait` (`"flee"`): as fast as their place goes, the steps as many
  as the way gone — a place a game moves frame by frame runs them too. A stumble as they run: `do('stumble', {loop:
  false, going: true})` — the place goes on, the stumble is played over it; they run on as it ends. Slowing to a stop:
  the gait back to the walk (`gait(null)`) as the pace drops.
- **Running hand in hand.** Both hands to the one point between them (`[across, distance, 1.0]`, set as their places
  move — `scene.on('move', …)`), a stride apart at most: arms are as long as they are.
- **A crowd.** Several elements, each its own id and look; start them a little apart in time (a sequence each, a
  `s.wait(scene.random() * 0.6)` first) — their statures and gaits give each their own pace: never in step.
- **Inside, by a lamp.** `"inside": true` on them as on the room; the lamp's light falls on the side facing it.
- **A silhouette in a lit scene** (a style painted `rim`; a body's `silhouette`): dark where little light reaches it; where
  more does — a window's shaft, a lamp near — its colours come through on the side lit (the body's silhouette stays its
  one dark colour), and its edge is rimmed by the lights beside and behind it: crossing a shaft it shows its lit side and
  rim, in the dark between it is a shadow again.
- **At a table under its lamp.** The table top a plane with `"shadow": {"light": "lamp", …}` (`"onto": []` if it is to darken
  nothing painted): those sitting at it are shadowed by it where it stands between them and the lamp — their knees and
  legs under it dark, their chests and faces lit (a painted room: the planes casting a light's shadows stand between it
  and the people, point by point).
- **A painted room** (a scene that lays no light itself: its art is its light). Give it `lights` — sources where
  its candles and windows are (`{"of": "candles", "reach": 6}`, a window's colour and strength, `on` a key) — and
  `light.people` (the light all round them, 0…1, `ambientColor` its colour): they are lit by the two strongest at
  their chest, by how they face them; a silhouette style rimmed by them — and, as the light all round grows towards daylight (`light.people`, a look of it by
  day), showing its colours through the silhouette. Sun or moonlight through its windows: a
  light from far off (`from`) with `through` — the windows' panes: a window element's id, or a polygon of `[across, distance, elevation]` (engine 3; the old engine: `[across, elevation, distance]`) —
  lights only who stands in its shafts.
- **On a slope, on steps.** A `relief`: they touch the land where the motion touches its floor — standing, walking: the
  feet on it; sitting, kneeling, lying, leaning on a hand: the body laid along the slope under what touches it (sliding
  down a bank sitting: a sitting loop, `walk(points, {steps: false})` down it). A flight (off a lip, a jump far):
  their place's `elevation` key over the land as a throw goes, from where they leave it to where they land.
- **On a bridge, a deck, a pyre.** A plane with `"walk": true`: where it lies over them higher than the land (the relief, or
  the ground), they stand and walk on it — over a stream's bed by its bridge, up a stepped end (a tilted one) onto the top
  of a pyre and down again. One the scene paints with a card (the pyre's logs) is an `"unseen"` plane where its top is.
- **On a deck, in a carriage.** The person `on` the ship (an element that heels: its `tilt` a key), the carriage (on a
  train that runs): where they stand goes with it (`across` along it, `distance` across it, `elevation` the deck's),
  they stay upright as it rolls, their feet on its plane as on a slope of the land. Carried — so too on another's arms,
  on a thing, sat in it — they move in its frame: their place's keys and `_turn` are in it, only those walk and turn
  them; it running or turning walks no one (seated, they stay seated), and they turn with it. What they look at and
  reach for in it: `{"on": "carriage", "at": [across, distance, elevation]}`.
- **A bank painted on a card.** The land is `relief.js` (the bank's profile, where the people go); the card that paints
  it — and what is painted with it, its stones — says `"onLand": false` (a picture of the land, not lifted onto it);
  the people `"inFront": ["bank"]`.
- **Carried.** `on('mother#hands')` as the carrier's motion lifts (the child's place follows the hands from there); a
  carrying walk as the carrier's `gait`; `on(null)` to set them down.
- **Not there yet.** `here(false)` until they come (a mother out of sight up the path), `here(true)` as they do.
- **On a high seat.** `on([across, distance, top])` (its top over the land there) with a seated loop (a boy on a barrel, legs hanging); off it: `on(null)`
  and, in the same moment, a motion done once that gets down (sitting on a table, slides forward onto the feet) — from
  the seat to the floor as it goes.
- **Lying in a coffin, carried in it.** The coffin built of cards and planes on an unseen anchor (its walls, its floor, its lid
  on it: what is in it hidden by its walls, point by point); she `on` a point of its floor, a lying motion done once (no
  breath), her limbs reaching on toward its foot (`reach` to points it marks there: arms along her sides, feet together).
  Her gown lies along her (a body lying wears its garment as standing, laid down with it; what would be below the floor
  lies on it; long hair too). The bearers' hands `reach` for the corners of its ends (points its walls mark), a carrying
  walk their `gait` (one walks backwards); the coffin's place and turn moved along the way, they a step off its ends.
- **A thing slid by the hands on it.** A lid on the coffin moved by its own key; his hands `reach` for points it marks;
  he steps with it — a sidestep as his `gait` (a walk sideways: facing as he faced), the lid's key and his place in one
  path.
- **A lantern in the hand.** A part of the cast drawn in the hand, and a light of the scene `"at": "keeper#hand_r"` (its
  `on` a key: out when it is dropped); a glow in someone's head — the same at `"#head"`.
- **A tool at its work.** A smith's blow lands where his motion's hand comes down: stand them so (measure where the
  hand is at the blow, from the motion — `motion(key, data="body")`), not the tool moved to it; the tool a part drawn
  along the forearm, its sparks the scene's at the moment of the blow.
- **The same person in every scene.** A character of the cast (`person.who`), not a look written out each time.
- **Your own style.** `shapes.styles: { mine: { from: 'soft', … } }`; look at it with `look_at_motion(key,
  look={kind: 'shapes', style: 'mine', cast: {shapes: {styles: {mine: …}}}})` — a look's `cast` is taken as the
  cast's tables (what is data: a `draw` is code, it comes with the module — see it in a scene: `render_scene`).

## Limits

- People only: Kimodo moves one human skeleton (no animals, no four legs). Children and old people move as adults do.
- A motion's way over the floor is left out (above): steps somewhere are a walk, not a motion.
- One walk (the cast's `gait`): engine 3 plays it at its own pace, its stride and cadence the motion's — a run, a
  slow walk are motions of their own; a place a game moves faster or slower than any gait is moved without steps
  (`steps: false`) or is said as a warning. (The old engine stretched the cadence to the speed.) The warning is of
  their own walking only: engine 3 counts no way walked where they are put — their place (or what carries them) set at
  once (a walk begun in that same step too: it walks from where they were put), a cut, set on or let down from what carries them — nor while they are carried or seated; standing `on`
  something that moves, their way is measured in its whole frame — a deck going, turning or heeling, a back tipping
  under them is no step of theirs.
- Nobody looks or reaches by themselves: the script says at what (`look`, `reach`). A reach is a limb's: no
  leaning to get further.
- Kimodo's "sitting" is often a chair: ask for "sits on the floor with the knees drawn up / the legs stretched out
  in front" and check the pelvis's height (a chair's ~0.55 m, the floor's ~0.15 m) before using it. Children move as
  small adults; "carrying a child" comes with the arms held out — lower the child with `on`'s `up`.
- A figure of shapes' face (`simple`) takes an expression (`<id>_mood`) but does not talk; a body's mouth talks without words (it follows no voice).
- Loose cloth (a gown's skirt, a coat's tails, long hair) swings by what the body did in the last second or two. A
  cut puts it on as it hangs at rest in the new pose, at once; so does a jump in the showcase (to the start of the beat
  it lands in — everything else there is exactly as played) and a body set somewhere else at once (further than half a
  metre in a frame). A render of a moment is the same picture every time.
- A scene of the old engine needs WebGL2, one of engine 3 WebGPU: a browser without it is told it cannot show the
  scene.

## How it is made (if you need it)

Engine 3: `engines/3/people/` — its own, reading the same motions and data as the old engine (`engines/1/people/`).

The old engine: `engines/1/people.js`: a person's player mixes their motions on Kimodo's 77-joint skeleton
(skeleton.js) — the act now and the one it goes over from, a loop's seam crossfaded, the walk mixed in by the speed
their place moves, its phase by the way gone; the feet set on the relief (a two-bone reach). Each frame they are drawn
by shapes.js or figure.js into a texture of their own (ink.js: depth, lines, and how each pixel faces and how far it
is), laid as their element's card by world.js — each pixel as deep as it is in the depth buffer, the scene's light laid
on it by how it faces. Their painting is a silhouette (what is picked where they are).
