// A scene's music (spec.music: weighted text descriptions and settings — instrumental, made by the host's music, as
// Lyria RealTime makes it), heard from its recording: made once, kept — everyone hears the same, whoever came first
// had it made. It starts at once where the browser lets sound begin, else at the first gesture on the page, and
// follows the open scene.
//   Its recording, the host's (docs/host.md): POST <host>music {music} → {key} — its recording begun there, unless it is
// recorded or being made; GET <host>music?key=… only listens — frames [type:1][length:4 LE][payload], 3 = a second as
// it is kept (a byte — 1: a new encoder begins there —, then its Opus packets, each [length:2 LE][packet]), 2 = a JSON
// event; sent up to a minute ahead (a slow or a broken connection is not heard), held here as they came and decoded
// (WebCodecs, one decoder throughout) only AHEAD seconds before they sound. A whole recording is heard round and round:
// a stream that ends has heard a making that failed or was lost — the music is asked for again (its POST begins it
// anew), TRIES times at most while nothing more is heard. Weight 0 means "not now" and is never sent.
//   One music gives way to another (another scene's) crossfading over FADE seconds; the same music — the same
// descriptions, weights, settings — goes on as it was. What goes wrong lands in window.__mooodErrors, and is said
// (silent): a host's refusal in the page's words — one that makes no music is asked no more, the scenes go silent; the
// quota spent, that music is asked no more.
//   MooodMusic.init({ track, listen, silent }) — once (a page with a stage, or without: with i18n.js and volume.js
// before it, its words said — words.js speak): track(music, signal) → a promise of its key (POST music),
// listen(key, signal) → of its stream (GET music: a Response) — a refusal an Error in the page's language, its code
// with it (scene/host.js); silent(why) — the music could not be heard (why: in the page's language); show(music) — the
// open scene's (or none); pause(on) — the play paused (the music fades out over HUSH seconds, and its sound stands
// till the play goes on — fading back in to the volume set); asked(music) — a scene's music as the host is asked for it (the
// body of POST music: {prompts, config}), or null — none sounds: what a host that makes the music ahead makes; LIMITS —
// what a host making it with Lyria takes (beyond it, a request refused: check says it of a scene). A classic script:
// it sets globalThis.MooodMusic (a page's script; a module's import — check and the host's side read asked() and
// LIMITS so).
globalThis.MooodMusic = (() => {
  const RATE = 48000, LEAD = 0.25, FADE = 4, AHEAD = 8; // seconds of audio queued ahead; of a crossfade; of a recording decoded ahead
  const TRIES = 3, AGAIN = 5; // a music asked for again while nothing more is heard, and seconds between
  const HUSH = 0.8; // seconds the music fades out as the play is paused (then its sound stands), and back in as it goes on
  const OPUS = { codec: 'opus', sampleRate: RATE, numberOfChannels: 2 };
  // (Lyria RealTime's: its settings' ranges — bpm a whole number —, its scales — a major and its relative minor —, the
  // descriptions that sound at most, and their characters)
  const LIMITS = { prompts: 20, text: 500, ranges: { bpm: [60, 200], density: [0, 1], brightness: [0, 1] },
    scales: ['C_MAJOR_A_MINOR', 'D_FLAT_MAJOR_B_FLAT_MINOR', 'D_MAJOR_B_MINOR', 'E_FLAT_MAJOR_C_MINOR', 'E_MAJOR_D_FLAT_MINOR', 'F_MAJOR_D_MINOR',
      'G_FLAT_MAJOR_E_FLAT_MINOR', 'G_MAJOR_E_MINOR', 'A_FLAT_MAJOR_F_MINOR', 'A_MAJOR_G_FLAT_MINOR', 'B_FLAT_MAJOR_G_MINOR', 'B_MAJOR_A_FLAT_MINOR'] };
  let track = null, listen = null, silent = null, music = null;  // (music: asked(the open scene's))
  let ctx = null, out = null;
  let playing = false, pushTimer = null;
  let deck = null; // what sounds now: { what, gain, nextT, stop() }
  let held = false; // the play paused, or an engine 3 scene standing (Moood.onPause): what starts meanwhile waits with it
  let hushing = 0; // (the sound's standing, due once the music has faded out)
  let mute = false; // the host makes no music
  const refused = new Set(); // the musics refused (the quota spent): not asked for again

  const tr = MooodI18n.part('engine1');  // (the engine's words, as the page said its language: words.js speak)
  // what went wrong: noted, and said — a host's refusal in the page's words, anything else as music not heard
  const failed = e => {
    const detail = e?.detail || e?.message || String(e);
    (window.__mooodErrors ||= []).push(`music: ${detail}`);
    globalThis.MooodSeen?.say('music', { failed: String(detail).slice(0, 200) });
    silent?.(e?.code ? e.message : tr('the music could not be heard'));
  };
  // What music sounds: its descriptions that have weight (trimmed) and its settings — the same, the same music
  function asked(m) {
    const prompts = (Array.isArray(m?.prompts) ? m.prompts : []).map(p => ({ text: String(p?.text || '').trim(), weight: Number(p?.weight) || 0 }))
      .filter(p => p.text && p.weight > 0);
    if (!prompts.length) return null;
    const config = {};
    for (const k of ['density', 'brightness']) if (typeof m[k] === 'number') config[k] = m[k];
    if (typeof m.bpm === 'number') config.bpm = Math.round(m.bpm);
    if (typeof m.scale === 'string') config.scale = m.scale; // the world's key (Lyria's name: C_MAJOR_A_MINOR…)
    return { prompts, config };
  }

  // ── a deck: one music, into its own gain ─────────────────────────────────
  function deckOf(whatNow) {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(out);
    const d = { what: whatNow, gain, nextT: 0, aborted: false, abort: new AbortController(), held: [], heard: 0, dec: null, feeding: false, timer: 0,
      pcm: [], frames: 0, used: 0 };
    d.stop = () => {
      d.aborted = true; d.abort.abort(); clearInterval(d.timer);
      if (d.dec?.state === 'configured') d.dec.close();
      d.pcm.forEach(a => a.close()); d.pcm = [];
      setTimeout(() => gain.disconnect(), 200);
    };
    return d;
  }
  // a recording's second, as it came: held till it is near its time
  function hold(d, bytes) {
    window.__mooodMusicChunks = (window.__mooodMusicChunks || 0) + 1; // for checking the stream
    if (d.aborted) return;
    d.heard++;
    d.held.push(bytes);
    d.timer ||= setInterval(() => feed(d), 1000);
    feed(d);
  }
  // what is held decoded and queued, while what is queued (and in the decoder) sounds for less than AHEAD seconds more —
  // one decoder for the whole recording, never flushed between its seconds (Opus carries its state from packet to packet:
  // a decoder started anew each second clicks at every second's edge); anew only where a new encoder began
  async function feed(d) {
    if (d.feeding) return;
    d.feeding = true;
    try {
      while (!d.aborted && d.held.length && ahead(d) < AHEAD) {
        const bytes = d.held.shift();
        if (bytes[0] === 1 || !d.dec) await anew(d);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
        for (let i = 1; i < bytes.length;) {
          const n = view.getUint16(i, true);
          d.dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: (d.ts += 20000), data: bytes.subarray(i + 2, i + 2 + n) }));
          i += 2 + n;
        }
      }
    } catch (e) { if (!d.aborted && deck === d) failed(e); } finally { d.feeding = false; }
  }
  // seconds the deck has ahead of now: queued to sound, decoded and not yet queued, still in the decoder (20 ms a packet)
  const ahead = d => Math.max(0, d.nextT - ctx.currentTime) + d.frames / RATE + (d.dec ? d.dec.decodeQueueSize * 0.02 : 0);
  // a decoder for what a new encoder made: the one before let out to its end first (its last part sounded as it is)
  async function anew(d) {
    if (d.dec?.state === 'configured') {
      await d.dec.flush();
      if (d.frames) sound(d, take(d, d.frames));
      d.dec.close();
    }
    d.dec = new AudioDecoder({ output: a => gather(d, a), error: () => {} });
    d.dec.configure(OPUS);
    d.ts = 0;
  }
  // what the decoder lets out, gathered into seconds: each whole one queued to sound
  function gather(d, a) {
    if (d.aborted) { a.close(); return; }
    d.pcm.push(a);
    d.frames += a.numberOfFrames;
    while (d.frames >= RATE) sound(d, take(d, RATE));
  }
  // n frames of what is gathered, as a buffer (from the oldest, a piece of one at its edge)
  function take(d, n) {
    const buf = ctx.createBuffer(2, n, RATE);
    for (let at = 0; at < n;) {
      const a = d.pcm[0], k = Math.min(n - at, a.numberOfFrames - d.used);
      for (let c = 0; c < 2; c++) a.copyTo(buf.getChannelData(c).subarray(at, at + k), { planeIndex: c, frameOffset: d.used, frameCount: k, format: 'f32-planar' });
      at += k; d.used += k;
      if (d.used === a.numberOfFrames) { d.pcm.shift().close(); d.used = 0; }
    }
    d.frames -= n;
    return buf;
  }
  // a buffer after what the deck has queued
  function sound(d, buf) {
    if (d.aborted) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(d.gain);
    const at = Math.max(d.nextT, ctx.currentTime + LEAD);
    src.start(at);
    d.nextT = at + buf.duration;
  }
  // a stream of frames (a Response) into the deck: ev(event) for its events; → once it has ended — whether it ended
  // there (event ended: nothing is being made of it)
  async function read(d, r, ev) {
    if (!r.body) throw new Error('the music stream did not open');
    const reader = r.body.getReader();
    let buf = new Uint8Array(0);
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      const joined = new Uint8Array(buf.length + value.length);
      joined.set(buf); joined.set(value, buf.length);
      buf = joined;
      while (buf.length >= 5) {
        const len = buf[1] | (buf[2] << 8) | (buf[3] << 16) | (buf[4] << 24);
        if (buf.length < 5 + len) break;
        const type = buf[0], payload = buf.slice(5, 5 + len);
        buf = buf.slice(5 + len);
        if (type === 3) hold(d, payload);
        else if (type === 2) ev(JSON.parse(new TextDecoder().decode(payload)));
      }
    }
  }
  // the deck that sounds now gives way to d over `fade` seconds (nothing sounded: d comes in quickly)
  function swap(d, fade = FADE) {
    const was = deck, t = ctx.currentTime;
    deck = d;
    if (was) {
      was.gain.gain.cancelScheduledValues(t);
      was.gain.gain.setValueAtTime(was.gain.gain.value, t);
      was.gain.gain.linearRampToValueAtTime(0, t + fade);
      setTimeout(() => was.stop(), fade * 1000 + 300);
    }
    if (d) {
      d.gain.gain.setValueAtTime(0, t);
      d.gain.gain.linearRampToValueAtTime(1, t + (was ? fade : 0.3));
    }
  }

  // the music's recording: asked for (its making begun, if it is neither recorded nor being made) and heard. A stream
  // that ends, or breaks (the connection's TypeError), before the recording is whole — its making failed or was lost, the
  // host went — is asked for again, TRIES times while nothing more is heard. A refusal ends it: no music made here — none
  // asked for again; the quota spent — not this music
  function recorded(whatNow, m) {
    const d = deckOf(whatNow);
    (async () => {
      for (let tries = 0, heard = 0; ; tries = d.heard > heard ? 0 : tries + 1, heard = d.heard) {
        if (tries === TRIES) throw new Error(`the music's stream ended ${TRIES} times with nothing more heard`);
        if (tries) await new Promise(ok => setTimeout(ok, AGAIN * 1000));
        if (d.aborted) return;
        try {
          const key = await track(m, d.abort.signal);
          await read(d, await listen(key, d.abort.signal), e => {
            if (e.ready && deck === d) globalThis.MooodSeen?.say('music', { playing: true });
          });
        } catch (e) {
          if (d.aborted) return;
          if (e?.code || !(e instanceof TypeError)) throw e;
        }
      }
    })().catch(e => {
      if (e?.code === 'no-music') mute = true;
      if (e?.code === 'quota') refused.add(whatNow);
      if (!d.aborted && deck === d) failed(e);
    });
    return d;
  }

  // what should sound now, sounding: nothing (no weights, no music), or its recording
  function push() {
    if (!playing) return;
    const now = music && JSON.stringify(music);
    if (!music || mute || refused.has(now)) { swap(null); return; }
    if (deck && deck.what === now) return;
    swap(recorded(now, music));
  }
  function pushSoon() { clearTimeout(pushTimer); pushTimer = setTimeout(push, 200); }

  // It may be asked again while it is starting: a browser that does not let sound begin yet leaves the context's
  // resume() unanswered — for ever, if nothing asks it again —, and the first gesture's asking is what it answers. Of
  // the askings then answered the first one plays; the others find it playing
  async function start() {
    if (playing) return;
    try {
      ctx = ctx || new AudioContext({ sampleRate: RATE });
      // (the play paused, an engine 3 scene standing: the music begins as it goes on — pause)
      await (held ? ctx.suspend() : ctx.resume());
      if (playing) return; // begun by another asking meanwhile
      if (!out) { out = ctx.createGain(); out.gain.value = 0; out.connect(ctx.destination); }
      playing = true;
      hush(); // (faded in to the volume set — or held at 0, if it is held meanwhile)
      push();
    } catch (e) { playing = false; failed(e); }
  }

  // ── the page's side ──────────────────────────────────────────────────────
  function init(opts) {
    ({ track, listen, silent } = opts);
    // (held: it fades back in to the volume set as it goes on)
    MooodVolume.on((kind, v) => { if (kind === 'music' && out && !held) out.gain.setTargetAtTime(v, ctx.currentTime, 0.1); });
    // it starts at once, as far as the browser lets sound begin; where it does not, the first gesture of any kind
    // starts it
    const first = () => { removeEventListener('pointerdown', first, true); removeEventListener('keydown', first, true); start(); };
    addEventListener('pointerdown', first, true);
    addEventListener('keydown', first, true);
    start();
    // (an engine 3 scene standing — the play paused, nobody watching it: the music stands with it; of any stage of the
    // page, mounted before this or after — a page without a stage, none: a host's page where music is tuned. Moood is
    // stage.js's global binding, not a property of globalThis: a classic script's const)
    if (typeof Moood !== 'undefined') Moood.onPause(pause);
  }

  // the open scene's music (from its spec), or none
  function show(m) {
    music = asked(m);
    if (playing) pushSoon();
  }

  // the play paused — or an engine 3 scene standing (the play paused, nobody watching it, a layer of the page over it):
  // the music fades out and stands where it is, and goes on when it isn't, fading back in (it is the sound's clock that
  // stands, not what plays; going on, it ends an engine 3 scene's standing too — of one the stage left for another
  // engine's while the play was paused)
  function pause(on) { held = !!on; hush(); }
  // the music as it is held or not: the output faded to 0 over HUSH seconds, then the sound's clock stood — by the
  // browser's own timer (a play's clock stands with the play: ../1/clock.js); or the clock going on and the output
  // faded back in to the volume set. A change meanwhile takes the fade over from where it is (going on during a fade
  // out, the sound never stands)
  function hush() {
    if (!ctx) return;
    const T = globalThis.__mooodTimers ?? globalThis;
    T.clearTimeout(hushing);
    if (out) {
      const g = out.gain, t = ctx.currentTime, v = g.value; // (where it is now: read before its fade is taken off)
      g.cancelScheduledValues(t);
      g.setValueAtTime(v, t);
      g.linearRampToValueAtTime(held ? 0 : MooodVolume.get('music'), t + HUSH);
    }
    if (held) hushing = T.setTimeout(() => { if (held) ctx.suspend().catch(() => {}); }, out ? HUSH * 1000 : 0);
    else ctx.resume().catch(() => {});
  }

  return { init, show, pause, asked, LIMITS };
})();
