// Timed captions — the director's lines that appear over the scene one after another
// (spec.captions: [{ text, at: seconds, for?: seconds }]). Without `for` a line stays. show(list, stage?): with the
// stage, by the scene's time as each frame is drawn (a render: its frames show them as the page does then).
//   card(el, stage) — the page's card (the scene's title and caption: .titles) over the scene's opening only: gone
// CARD seconds into it, as a game's page has it (site/free/play.js) — into its showcase, while one plays (sought back to
// its start, it is there again); looked at as each frame is drawn: a render's frame of a moment shows it as the page
// does then. A scene at rest says no frames (engine 3): the card and the lines are then looked at at their own moments
// too, by the page's clock — each look with the moment it was set for (a timer may fire a little before it).
const MooodCaptions = (() => {
  const CARD = 7;
  let box = null, timers = [];
  function card(el, stage) {
    const opened = performance.now();
    let gone = null;
    const look = (moment = 0) => {
      const info = stage.showcase?.info, at = info ? info.at : Math.max(moment, (performance.now() - opened) / 1000), now = at >= CARD;
      if (now !== gone) { gone = now; el.classList.toggle('gone', now); }
    };
    look();
    stage.onFrame(look);
    // (which engine the scene is, is known only then: the card is put up before a scene is shown)
    setTimeout(() => { if (stage.state.engine === 3) look(CARD); }, CARD * 1000);
  }
  // list: the lines; stage — given, they follow the scene's time, looked at as each frame is drawn (its showcase's
  // while one plays, else since they were shown — a render's virtual clock: a frame of a moment shows what the page
  // does then); without it, timers
  let follow = null;
  function show(list, stage = null) {
    for (const t of timers) clearTimeout(t);
    timers = [];
    if (!box) { box = document.createElement('div'); box.id = 'captions'; document.body.append(box); }
    box.textContent = '';
    const lines = [];
    for (const c of Array.isArray(list) ? list : []) {
      if (!c || typeof c.text !== 'string') continue;
      const p = document.createElement('p');
      p.textContent = c.text;
      box.append(p);
      const at = Math.max(0, c.at || 0), to = c.for > 0 ? at + c.for : Infinity;
      if (stage) { lines.push({ p, at, to, on: null }); continue; }
      timers.push(setTimeout(() => p.classList.add('on'), at * 1000));
      if (c.for > 0) timers.push(setTimeout(() => p.classList.remove('on'), to * 1000));
    }
    follow = null;
    if (!stage || !lines.length) return;
    const shown = performance.now(), mine = follow = (moment = 0) => {
      if (follow !== mine) return;
      const info = stage.showcase?.info, t = info ? info.at : Math.max(moment, (performance.now() - shown) / 1000);
      for (const l of lines) { const on = t >= l.at && t < l.to; if (on !== l.on) { l.on = on; l.p.classList.toggle('on', on); } }
    };
    mine();
    stage.onFrame(mine);
    if (stage.state.engine === 3) for (const l of lines) for (const t of [l.at, l.to]) if (t > 0 && t < Infinity) timers.push(setTimeout(() => mine(t), t * 1000));
  }
  return { show, card };
})();
