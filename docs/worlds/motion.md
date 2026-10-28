# People's motions made by a model

A world's people module plays recorded motions (entries of `modules/<name>.data.json`). What none of its
recordings gives — getting up from a chair and walking to the window, a hand on someone's shoulder — a model
makes: **NVIDIA Kimodo** (Kimodo-SOMA-RP-v1.1), a motion diffusion model trained on 700 hours of studio motion
capture with human-written descriptions. The MCP tools:

People in a scene play these motions: people.md — a motion goes into the world's cast with
`put_motion`. A world's older people module plays them as clips (below).

- `make_motion` — a motion from prompts, their seconds, constraints and the model's settings; made once and kept
  (the same ask is the same motion, at once). A new one takes the model a minute or two, minutes more when it has
  slept: it answers its key and `making` — ask `motion(key)` every few seconds till it is made.
- `look_at_motion` — a made motion's frames on a body, as a picture: front, side or back, at the moments you
  name (a render: `render_result(id)` gives the picture). Look before you use one.
- `motion(key)` — one: its whole ask, whether it is made, its making; with `data` — its clip (the module's data
  entry), `person` (as a cast has it) or `body` (every joint's rotation and place each frame: Kimodo's own data).
  `list_motions` — every motion asked for.
- `search_descriptions(q)` — what it was trained on (below), searched in the studio.

## Reading first

- Kimodo's best practices: https://github.com/nv-tlabs/kimodo/blob/main/docs/source/key_concepts/limitations.md
- Its constraints: https://github.com/nv-tlabs/kimodo/blob/main/docs/source/user_guide/constraints.md and
  https://github.com/nv-tlabs/kimodo/blob/main/docs/source/key_concepts/constraints.md
- Its settings: https://github.com/nv-tlabs/kimodo/blob/main/docs/source/user_guide/configuration.md
- The tech report: https://research.nvidia.com/labs/sil/projects/kimodo/assets/kimodo_tech_report.pdf
- **What it was trained on** — the descriptions of the public part of its data (BONES-SEED, 142,220 motions,
  an overview and timed events each; CC BY 4.0):
  https://huggingface.co/datasets/nvidia/SEED-Timeline-Annotations (`timelines.jsonl`, 80 MB:
  https://huggingface.co/datasets/nvidia/SEED-Timeline-Annotations/resolve/main/timelines.jsonl). Search it for
  the motion you need before you write a prompt: how annotators said it, which hand, how long such an event lasts.

## Prompts

- Begin with the subject: "A person …", or a styled one — "An old person", "A tired person", "A scared person",
  "A stealthy person", "A drunk person", "An injured person", "A childlike person".
- One behaviour, at most two ("… walks forward while carrying a box", "… stands up and walks away"). More goes
  into a chain: several prompts, each its seconds (up to 10), done one after another; each must stand on its own
  ("A person walking with a box comes to a stop", not "Then they stop"). The start of each next prompt is spent
  on the join.
- The words the data uses: which hand ("with their right hand", "using both hands"), how high ("at waist height",
  "at mid-height", "overhead"), which way ("to their left", "over their right shoulder", "in front of them"), the
  posture ("A seated person …", "A bent person …", "A person kneeling on the floor …", "A crouching person …"),
  things in general words ("a small, light object", "a big, heavy box", "a lever", "a door with a knob", "a
  baby", "a leash"). Rhythm in words ("at a steady pace", "three times", "repeatedly"), never in numbers or
  seconds.
- The data is mostly "stands — does it — stands again": a prompt for an action makes it in the middle of the
  clip. For something that goes on the whole clip, say it as going on ("A bent person is hammering a nail on
  the table at a steady pace"), or chain the same prompt.
- Only what was recorded: locomotion, gestures, everyday actions, common object interactions, sitting, kneeling,
  lying, falls, fights, dances, the styles above. Not there, and coming out poorly: smithing at an anvil,
  singing, riding a horse, archery, swimming and wading, whistling, hanging from a branch, two people touching
  (make each separately, their contact a shared point). Search the descriptions: if nothing like it is there,
  a prompt won't make it — take the nearest that is ("hammers a nail on the table" for an anvil), or a pose
  in the module.

## Constraints

Kimodo's coordinates: y up, metres; at frame 0 the pelvis is over the origin and the person faces +z, their
left is +x; 30 frames a second; fewer than 20 constrained frames per type. Types: `root2d` (where the person is
on the floor: waypoints, or a dense path, optionally the heading), `fullbody` (the whole pose at frames),
`left-hand` / `right-hand` / `left-foot` / `right-foot` / `end-effector` (a hand's or a foot's place and turn,
the rest free). Don't let them contradict the prompt.

Poses are rotations of all 77 joints — nobody writes them by hand: take them from motions already made. A
constraint may name, instead of its numbers, a made motion's frames —
`{"type": "right-hand", "frame_indices": [45], "from": {"key": "<a made motion>", "frames": [60]}, "turn": 0.5,
"move": [0.3, 1.2]}` — that motion's pose at its frame 60 (its hand there, for "right-hand"), turned about the
vertical (radians) and moved ([x, z] metres), at the new motion's frame 45. For `root2d`, where that motion was
and which way it faced.

To go on from a made motion: `after: {"key": "<it>", "frames": 5}` — its last 5 frames become the new
motion's first 5 (the whole pose, the hands and feet exactly — the way Kimodo joins its own chained prompts), so
the new one starts as it ended, moving as it moved. Play the earlier one, then the new one from its frame 5;
`starts_at` ({x, z}) says where the new one's origin is in the earlier one's frame (it faces as the earlier one
did then: its heading is kept).

## Settings

`seed` — another take of the same ask (look at two or three and keep the best). `steps` — denoising steps
(100; 50 faster, 200 a little finer). `cfg` / `cfg_weight` — classifier-free guidance: `separated` with
`[text, constraints]` weighs the words and the constraints apart (Kimodo's default is [2, 2]; raise one when it
gives way to the other). `transition_frames` — frames blending one prompt of a chain into the next (5).
`postprocess` — clean up foot skating and hit the constraints exactly (on). `root_margin` — how far the
post-processing lets the pelvis stray from a constraint (0.04 m). `heading` — which way the person faces at
frame 0 (radians, 0: +z).

## What comes back

Its key — for `look_at_motion`, and for `put_motion(key, world, branch, name)`: the motion written into the world's
cast (its module's data, in your branch) as people in a scene play it (people.md). And a clip — an entry of an older
people module's data, as `dev/mocap` makes them from recordings: `{n, fps, v, p, c, r,
kind}` — bone directions relative to the body (no proportions), foot contacts, `r` the person's path over the
floor as Kimodo made it (from where it starts, facing forward), `p` the pelvis from that path. Name it and put it
into the module's data. The module plays it in place, at the figure's `at`; with `travel: true` the body goes
along the path from there — the steps and the way over the floor from one motion, nothing sliding. Contacts
Kimodo made exact (a hand on a shoulder) land a few centimetres off on a body of other proportions: where it
matters, the module has to bring the hand there itself.

## How a person is seen

`look_at_motion(key, look=…)` shows a motion on a person of your
choosing — the motion is the same on anyone: it is put on their own bones (a child's, a tall man's), the walk
as long as their legs. Two kinds:

**A figure of designed shapes** — `{"kind": "shapes", "style", "who", …}`: a stylised person built of simple
volumes on the skeleton (each limb one tube along its bones, garments hanging from what they rest on), drawn
flat or in two tones, in depth.

- `style` — `shadow` (slender, small-headed, tapering to points; a silhouette with a warm rim — Gris, Limbo),
  `soft` (round, big-headed, mittens, tinted lines — Cartoon Saloon), `graphic` (broad shoulders, narrow waist,
  flat — UPA), `toy` (soft chunky figurines in matte clay, simple faces), `geometry` (faceted, two tones —
  Kentucky Route Zero), `flat` (straight-edged flat geometry lit by the scene: a coat a trapezoid, legs bars).
- `who` — `man`, `woman`, `teen`, `child`, `toddler`, `old`, `smith`, `death`, `school` (a schoolgirl),
  `youth`, `lady` (in a coat, a hat, a scarf), `grandpa` (in a cap and a scarf), `janitor`: proportions,
  clothes, hair and colours of their own; anything below overrides them.
- `garment` — `none` (a shirt and trousers), `tunic`, `coat`, `dress`, `robe`, `apron`, `jacket`, `skirt`,
  `sailor`; `hood`, `scarf`, `socks` — true or false; `hair` — `none`, `short`, `long`, `bun`, `bob`,
  `straight`, `ponytail`, `spiky`; `hat` — `none`, `cap`, `hat`; `face` — `none`, `simple` (eyes, brows, nose, mouth: at rest, or with an `expression` — the names a minimal face has, below; `<id>_mood` in a scene), `dot`.
- `paint` — `silhouette`, `rim` (a silhouette with a rim of light: in a scene, dark where little light reaches it,
  its lit side showing its colours as the light on it grows, its edge rimmed by the lights beside it), `flat`, `toned`, `clay`, `lit` (flat
  colours under the scene's light); `line` — outlines, true or false; `ground` — the light and background:
  `studio`, `fog`, `night`, `dusk`, `day`, `paper`, `sunset`, `lamp`, `mist`.
- `body` — proportions as factors of a man's: `height`, `head`, `neck`, `shoulders`, `arms`, `hips`, `legs`,
  `thick`; `colors` — `skin`, `hair`, `top`, `bottom`, `shoes`, `garment`, `hat`, `accent`, `socks` ("#rrggbb").

**A body** — `{"who", "style", …}` (no `kind`): a real human body of any age and build (NAVER's Anny) in real
clothes fitted to it, loose cloth swinging.

- `who` — `man`, `woman`, `boy`, `girl`, `child`, `toddler`, `oldman`, `oldwoman`, `smith`, `death`.
- `style` — `clay` (soft matte sculpture), `flat` (flat colour, one shade), `silhouette`; `light` — `studio`,
  `day`, `evening`, `night`.
- `outfit` — `work` (a sweater and trousers), `polo`, `summer` (a t-shirt and shorts), `dress`, `skirt`,
  `loose` (an oversized sweater), `looseskirt`, `tunic`, `smith` (a shirt and an apron); `hair` — `none`,
  `short`, `fringe`, `bob`, `shoulder`, `long`, `bun`, `braid`; `face` — `minimal`, `none`; `colors` — `skin`,
  `hair`, `top`, `bottom`, `shoes`, `apron`.
- A minimal face's `expression` — `neutral`, `smile`, `laugh`, `sad`, `angry`, `surprised`, `afraid`, `disgusted`,
  `thinking`, `tired`, `talking`; `intensity` — how much of it (1; up to 1.5); `blink` — blinks now and then (true);
  `talk` — the mouth talks, whatever the expression (false). The same moment is the same face every time.

Everyone in every style, walking and sitting (one sheet a style):
[shapes: shadow](people/shapes-shadow.webp) · [soft](people/shapes-soft.webp) ·
[graphic](people/shapes-graphic.webp) · [toy](people/shapes-toy.webp) · [geometry](people/shapes-geometry.webp) ·
[flat](people/shapes-flat.webp) · [body: clay](people/body-clay.webp) · [flat](people/body-flat.webp) ·
[silhouette](people/body-silhouette.webp). To see your own: `look_at_motion` with the look.

In a scene, a person is an element with `person` and this very look (people.md); a world adds its own styles,
characters, garments, parts and bodies there (its cast).

What it can't do (yet): only people — two arms, two legs (Kimodo moves one human skeleton); children and old
people move as adults do (it has no age); a figure of shapes' face shows an expression but does not talk, a body's talks without words (its
lips follow no voice).
