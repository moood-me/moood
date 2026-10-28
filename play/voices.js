// How a game's line is heard (runtime.js speaks it; moood's check lists every line of every language so — the voices
// a game needs): its text as written, inline tags and all (<sigh>, <short pause> — heard, never shown), in the voice of
// whoever says it (people.json: voice — its name; how — the manner it lasts, in English) — and the line's own manner
// after it (say's, think's, tr.line's how: this line only, in English); a thought — the same line, whispered in the
// mind (shown as the play's words frame it: «text» — the short name).
export const THOUGHT = 'without a sound, in the mind: a whisper, as if right inside the head';

// p — the person (people.json's); said — 'say' | 'think'; text — the line in the play's language; how — its own manner
// (or '') → {text, voice, how}: what the voice is asked for — its how the person's, the line's, a thought's, joined by '; '
export function heard(p, said, text, how) {
  return { text, voice: p.voice, how: [p.how, how, said === 'think' && THOUGHT].filter(Boolean).join('; ') };
}
