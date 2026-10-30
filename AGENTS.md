# For agents

Writing worlds and games: [docs/README.md](docs/README.md) — start there.

- **Changes to this repository** — the engines, the scene and play pages, mini-games, `check`, the player, these docs —
  are asked for through GitHub issues here (what, where, how to reproduce, why the engine and not a scene). An agent
  writing a world or a game does not patch the engine around a problem: it reports it.
- **No workarounds**: if something doesn't work, fix it the right way or say what's missing; no fallbacks, no special
  cases for one scene, no dead code.
- **Everything multilingual**: English is the source, translations beside it (`lang/`); a text a person reads is a
  literal through `tr`/`tr.n`/`tr.c`/`say`/`think`/`tr.line`/`tr.thought` or a read field of JSON; `check` finds and
  checks them. A missing translation is an error, never English in its place.
- **History**: a change here gets a short note in `docs/history/` (what was done, why — what called for it, what was
  decided and by whom —, and how, so another agent can repeat it). A note about a world or a game goes into that world's or game's repository, not here.

## Working with me

- **Keep my meaning and my level.** Helping me say it in better words is good; pulling the meaning aside is not.
  Don't turn my thought into needless specifics: they distort the meaning and hide what matters. Stay at the level of
  abstraction I speak at.
- **My explanations are not rules.** When I tell you what matters and why, don't make it an absolute or a ban.
- **Don't write anti-points** — points that argue with something earlier: on their own they aren't needed.
- **My question is a question.** "Can we…", "how is…", "why…" — answer, and that's all. If the answer is "no", say so;
  don't start doing what I only asked about.
- **Object at once.** If my request has a catch, say it in your first sentence. Don't answer "I'll do it" only to
  explain later why it is useless.
- **Know, don't guess.** If you'd answer "maybe", check first and answer exactly. Name plainly what you didn't check.
- **Agreed means done that way.** Don't narrow or change what we agreed on silently — also when handing work to
  another agent. If you depart from what we agreed, tell me first, and only then merge.
- **Don't fuss.** If my words must go to an agent, understand them calmly, let me finish, check with me, and give them
  to it in one message. Don't send correction after correction: it muddles its head.
- **Don't overcorrect when I correct you.** "Don't do this here" doesn't mean "do nothing here". I say only what I say.
- **Explain so that I understand.** If I ask again, it was said unclearly. Say it more simply, not longer.
- **Do and pass on exactly what I ask.** Don't add things "while you're at it" and don't widen the task. When you hand
  my request to another agent, hand it as it is, not your wider version. Bring your own ideas to me.
- **Before removing something, find out why it was there.** If something looks needless or odd, first see whether it
  was meant. Don't remove what was meant silently: ask me.
- **Look with your own eyes, as a person.** Checks and numbers won't tell you whether it is beautiful and clear to the
  player. Look yourself, as one who plays would.
- **A short look beats a long run.** Read carefully, fix, check briefly — minutes. No need to run everything for hours.
- **When I criticise, listen.** Don't rush to fix, don't launch agents, don't build plans. First understand what I'm
  saying, and discuss it with me.
- **Look yourself before showing.** Before you give me a picture or a result, check yourself that it really is what I
  asked for.
- **Speak briefly and in plain words.** Write only what is new to me, what went wrong, and what is mine to decide.
  Don't retell my words, and don't talk to me in your internal terms.
- **When I scold, listen.** Don't answer with a plan and don't rush to fix. First understand what is wrong; how to fix
  it, we'll discuss.
