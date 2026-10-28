# moood — for agents

moood (https://moood.me) is living, animated worlds. A **world** is a collection of
**scenes** — places with their mood, painted in code, animated, with state that changes as the
world is played. Games are played on worlds; this is about the worlds.

You act for a person, with their rights: what they may see, you see; what they may change, you
change.

**Read `principles.md` first**: what matters here (the viewer's quality and performance, only the right ways, no
prop-ups for one scene, all the beauty kept), how to work (by reading, not by render loops; rendering on the GPU),
what a scene and a game must be, and the pitfalls already met.

## Where a world lives

A world lives in a git repository: it is a folder with `world.json` — at the repository's root or deeper, beside
other worlds, games and articles. Its address is `owner/name@ref:path` — the repository, a branch, tag or commit, the
folder (`.` the root). The repository is the author's own on GitHub with moood's App installed on it, or one moood
made for them in `moood-me` (`u-…`, in the studio's Repos). Who may change it is GitHub's to say: collaborators,
branches, pull requests, as anywhere.

Work in the repository: clone it (with your own GitHub access; a repository moood made for the person —
`clone_repo(repo)`, an MCP tool, gives a token for it alone), work in a branch, commit, push. The studio shows any
branch at once by its address — nothing to deploy, nothing to merge into moood; what the public site shows is
published: a game asked for (the studio's "ask to publish", `ask_to_publish`) takes its world's commit with it, and a
sketch of a scene or a game coming soon is put on a world's commit by moood — a world is never published by itself.

**moood's MCP** (`studio.<host>/mcp`; connected by OAuth — the person allows it on the studio's page —, or with a
token they make on their profile in the studio): you act as that person — what they may see and do, under their
quotas. It reads repositories, worlds, scenes and games
(`list_worlds`, `read_scene` …), draws and measures scenes on moood's GPU (Looking at your work, below), checks,
voices lines, makes people's motions; `guide` gives these documents.

## The repository

    world.json                         title, description, languages, themes, main (the main scene's folder; none: the first scene)
    scenes/<folder>/scene.json         a scene: its spec without its code
    scenes/<folder>/elements/<id>.js   an element's code          (objects[].code in the spec)
    scenes/<folder>/elements/<id>.script.js   an element's script (objects[].script)
    scenes/<folder>/elements/<id>.animate.js  what moves it each frame (objects[].animate — engine 3)
    scenes/<folder>/elements/<id>.wgsl  its own shader            (objects[].shader — engine 3)
    scenes/<folder>/script.js          the scene's script          (spec.script)
    scenes/<folder>/showcase.js        its own scenario outside games (spec.showcase — engine 3)
    scenes/<folder>/lib.js             code its elements share      (spec.lib)
    scenes/<folder>/relief.js          the land's shape            (spec.relief)
    scenes/<folder>/widgets/<id>.html  a widget's markup           (widgets[].html)
    scenes/<folder>/notes.md           the scene's notes            (spec.notes)
    modules/<name>.js                  a module: code the world's scenes share
    modules/<name>.data.json           its data, if it has any (not formatted)
    modules/<name>.md                  what it offers and how to call it

A file belongs to the element or widget of `scene.json` with that `id`; a file nothing in
`scene.json` names is an error — so is an engine-3 file (`animate`, a shader, a showcase) in a scene of the old
engine. An element's code is the body of its draw function, as the scene's language describes (its engine's text: What
a scene is, below). A new folder is a new scene.

## Modules

A module is code the world's scenes share — its people, its animals, its things — so they are the
same in every scene. `modules/<name>.js` is the body of `function (anim, data)` returning what it
offers (`anim`: the animator's toolkit; `data`: `modules/<name>.data.json` parsed, or null); its
`.md` says what it offers and how to call it — read it before using the module, and keep it true
when you change the module. A scene lists the modules it uses in `scene.json` (`"modules":
["people"]`) and gets them as `e.kit.people` in its elements' code (`scene.kit.people` in scripts,
`kit.people` in its lib).

Every scene shows the modules as the world has them now: a change of a module reaches every scene that
uses it, at once — it is a new version of the world, not of those scenes (a scene's versions are
the changes of its own folder; an old version opens with the modules as they were then). So before
you push a change of a module to a branch others use, look at the scenes that use it (`render_scene`), not only at the
one you made it for; `check` finds a scene that lists a module that isn't there.

People in a scene are elements with `person`: drawn in 3D as the camera sees them — a figure of designed
shapes in one of its styles, or a real body in real clothes — moved by real human motion, lit by the scene, walking
where their place goes; what they do is the scene's state (`<id>_do`, `scene.person(id)`). Who they are is the
world's: a module that is its cast (its motions — `put_motion` writes one in —, its characters, its own styles,
garments, parts, bodies). All of it: people.md here.

An older people module's recorded motions are entries of its data (`{n, fps, v, p, c}`: bone directions, the
pelvis, foot contacts). A motion none of its recordings gives — someone getting up and walking to the
window, a hand on another's shoulder — `make_motion` makes: a model trained on motion capture, from plain
English prompts and constraints (where the person goes, poses taken from motions made before; going on
from one). `look_at_motion` shows it on a person — anyone, in any of the styles (a real body in clay, flat or
silhouette; a figure of shapes from a sign to a toy), with a gallery of them all; it answers with such an
entry. How to ask it well, and how a person may be seen: motion.md here.

## Working in it

1. Clone the repository (Where a world lives, above).
2. Work in a branch of your own; commit and push it as often as you like.
3. `render_scene(world, scene)` shows a scene of your branch rendered, with the errors its code throws (moments,
   sheets, films: Looking at your work, below) — `world` its address at your branch; or, before you push, with the
   files of your draft sent along (`files`). Look at your work: does it show what was asked, and is it beautiful?
4. `check(at)` — moood's check over it: the translations, the references, every scene put together in every
   language (or `moood-check <clone>` yourself).
5. Merge into the branch the world is shown from (its default), as the repository's people do — a pull request, or
   git. A branch shared with others only goes forward: never rewrite it (no force-push, no rebase) — plays hold its
   commits.

A new world: a folder with `world.json` (`{"title", "description", "languages": ["en", …]}`) and its scenes' folders,
if any yet, in a repository. A world may have no scene; its main scene is its first, unless `world.json`'s `"main"`
names another's folder.

Write your code readably: one statement a line.

## Texts and languages

moood speaks several languages (English — the source — and Russian; the list is moood's own). A world and a game are
written in English; every other language is a translation beside it. Every text a person reads or hears is found by
moood's check (`npm i -g @moood/check`: `moood-check <clone> --write` lays out the translations' files, `moood-check
<clone>` checks them — its README says where they lie):
- in code, as a literal: `tr('A text {name}', { name })`, `tr.n(count, 'one {n} thing', '{n} things')`,
  `tr.c('what it means here', 'Text')`; a line someone says — `say('who', 'Text')` (a scene's script) or
  `bespoke.say('who', 'Text')` / `bespoke.think(…)` (a game: translated and voiced by the runtime — the game's people
  in `bespoke/people.json`: `voice` — the voice's name (who they are: timbre, age, accent), `how` — the manner it
  lasts, in English; `short`, translated); a line in a manner of its own — `bespoke.say('who', 'Text', { how: 'with
  envy and delight' })`, heard after the lasting one (English, not translated, a literal too). What a line says is all
  its voice says: how to say it is `how`, never words in the line; a moment's sound or pause is an inline tag in it, in English — `<sigh>`, `<short pause>`, `<laughs>` —
  heard, not shown, kept as written in every translation. A line
  kept to be said later — `tr.line('who', 'Text', { how })` (aloud; `how` — its own manner, if any) or
  `tr.thought(…)`, then `bespoke.say('who', line)` — its manner kept with it. A phrase is one text with
  its values as {names} — never put together of pieces. `tr`, `say`, `think` are the language's: never a name of
  your own code.
- in JSON: what is read (scene.json `title`, `description`, `caption`, captions; world.json, game.json their texts).
- not translated: names of things — element ids and names, keys, state values, beats, folders — English, and never
  shown to a player as words.

A text with no translation in the language it is shown in is an error, never the English in its place: ask to publish
once every language is translated. New folders and repositories are named in short English, not transliterated.

## Looking at your work

`render_scene` draws a scene with moood's own engine — the one the studio runs — on moood's GPU, and answers the
picture and the errors and warnings its code gave: as a world has it at an address (any branch, tag or commit), or with
files of yours laid over it — `files: {path from the world's folder: text}`, your draft, not pushed anywhere (a scene's
folder sent is taken whole; a module sent takes the world's place).
- `kind`: `picture` (the default — 1920×1080 without the words over it, kept for good: drawn once, then taken ready),
  `frame` (`at: [second]`), `sheet` (`at: [0, 10, 30, 60]` — all of them in one labelled picture, up to 32: the
  cheapest way to see a film move), `film` (`from`, `to`, `fps` — an MP4), `pack` (`at: [...]` — the frames as PNGs in
  a ZIP); `device`: `16:9`, `4:3`, `21:9` (landscape, the same height), `9:16` (a phone upright), `32:9`; `state` —
  values over its starting state; `showcase` — the moments are its showcase's; `lang` — the language it is drawn in.
- It is made in the background: the answer comes at once with an id — `render_result(id)` every few seconds tells how
  it goes, and once it is done gives what it made: as content (the picture as an image) or as a link to the studio
  (`as: "link"`, fetched with a token the person made on their profile; connected by OAuth — ask for content). A file
  is kept an hour.
- The GPU sleeps while unused: the first render wakes it (a minute or two, more after a new engine) and waits for
  it by itself. Each render not taken ready is an action under the person's quota.

**Measuring.** `measure_scene(world, scene)` measures what the scene's frames cost: played on the GPU on the real
clock as a viewer has it (opened, its film or showcase, zoom, drag, lean, walking, cuts) and held against the
thresholds of `principles.md` ("What a frame must cost"). About two minutes a size (an engine-1 scene: `sizes`,
`["1080p"]` by default, `"4k"`); an engine-3 scene in `profiles` — some of desktop, laptop, phone, all three by
default: about ten minutes. In the background, as a render: `render_result(id)` gives the report as text — each
threshold ok or FAIL; per segment the frame intervals, the scene thread's JS, the GPU's time, repaints; the GPU's and
the thread's time by pass of the renderer's frame; GC pauses. Kept for good; the studio shows it at /measurings.
Measure a scene once it is written and reviewed — not after every change.

## On your own machine

The local player (`player/README.md`: `docker run … ghcr.io/moood-me/moood-player`, or `node player/server.js <folder>`)
shows the worlds of your clone with the same scene page moood shows them with, anew as you save; `moood-check <clone>`
(`npm i -g @moood/check`) checks them.

## What a scene is

A scene's language and its craft — the schema, the elements, how they are painted and moved, state and the director
(actions, sequences, events), the showcase, the camera, light — is its engine's text (below); `guide` gives it.

Two engines run scenes; a scene's `scene.json` says which, and a scene keeps the engine it says and that engine's
language.
- **Engine 3** (`"engine": 3`) — every new scene. WebGPU: it opens where the browser has WebGPU, and its pictures come
  only from the GPU machine (above). Its language, complete in itself, with its own rules and principles:
  `scene-format-3.md`.
- **The old engine** (no `"engine"`): a scene made before runs on it in its own older language (WebGL2) —
  `scene-format-1.md`.
