# The local player

A small server that shows the worlds and plays the bespoke games of a folder on your disk — your repository of
content, as it lies — with the same scene and play pages moood shows them with anywhere. For authors and their agents
to see their work before it is anywhere else.

## Run it

With Docker — the image moood publishes from `main` (or build it: `docker build -t moood-player .` at this
repository's root):

    docker run -v ./my-repo:/work -v moood-plays:/data -p 127.0.0.1:8080:8080 ghcr.io/moood-me/moood-player

With Node 22 (nothing to install):

    node player/server.js ./my-repo

Then open http://localhost:8080/: the folder's worlds with their scenes and its games, each linked to its page, in any
of moood's languages it is in; and what `check` finds wrong with where they lie or what they say of themselves, in
the page's language.

- `PORT` — the port (8080); `MOOOD_BIND` — the address it listens on (127.0.0.1; 0.0.0.0 in the image);
  `MOOOD_DATA` — where the plays are kept (`~/.moood/player`; `/data` in the image — a volume keeps them past the
  container). Nothing is written into your folder.
- `MOOOD_WORKSHOP` — the studio whose workshop voices and music are taken from (`https://studio.moood.me`);
  `MOOOD_TOKEN` — your token there, to have what is not made yet made under your quota (below). With Docker:

      docker run -v ./my-repo:/work -v moood-plays:/data -p 127.0.0.1:8080:8080 \
        -e MOOOD_WORKSHOP=https://studio.moood.me -e MOOOD_TOKEN=moood_… ghcr.io/moood-me/moood-player
- Save a file and the open pages show it anew by themselves — the index, a scene of that world, a play of that game
  or its world (the play goes on from what the game kept). The folder is watched (its hidden files and folders not)
  and read anew for every request.

## What it is

- A world is any folder with `world.json`, a game any with `game.json`, at any depth (`packages/check/README.md`); each
  is named by its path in the folder (`.` the root). An article (`article.json`) is checked, not shown. Each says its languages (`"languages"`): shown in another, it is
  refused. A game names its world by a path from its own folder (`"world": "../usher"`).
- The scene's page (`scene/`) and the play's (`play/`) ask it what `docs/host.md` says, and nothing else: a scene is put
  together from its folder as that says; the world's files go by their content's id (git's blob sha); a game's code is
  served from its `bespoke/`; files saved are told on `changes`. One play a game — kept, its save too; ↺ begins it
  anew. What it refuses it refuses by a code (`docs/host.md`: Refusals): the pages say it in their own words, in their
  language.
- Voices and music are moood's workshop's (a studio's — `docs/host.md`: The workshop). With `MOOOD_WORKSHOP` they are
  taken from it by their key: what is made already is heard; what is not — the line is shown without it, the scene
  silent (refused `unmade`). With `MOOOD_TOKEN` too — a token made on your profile in that studio (Agents → Tokens) —
  what is not made yet is made there under your quota. Without `MOOOD_WORKSHOP` they are refused: the page says once,
  in a corner, that voices are not made here, and the lines are shown without them; the scenes are silent. A game's
  world in another repository (`owner/repo@ref:path`) — refused, saying so: lay it beside the game in the folder and
  name it by its path.
- Engine 3 scenes need a browser with WebGPU, the old engine's WebGL2.
- It is yours, on your machine: it answers pages at `localhost` only (a request for another host's name — a site
  pointing its name at your machine — is refused) and takes a change (POST, PUT) only from its own pages; publish the
  port on `127.0.0.1`, as above. It reads your folder as git does: a symbolic link in it is not followed, nothing
  outside it is read.

Its own page's words are translated in `lang/<lang>.json` beside it: `check` lays them out and checks them
(`node packages/check/cli.js player --write`, after `npm ci && npm run build` in `packages/check`).
