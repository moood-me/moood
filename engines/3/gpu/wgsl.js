// WGSL as plain strings: named chunks, and modules assembled from them (GP5). No GPU here, nothing of a browser —
// imported in node by the whole-set check as it is.
//   A chunk is a text, or a function of the assembly's options that gives a text. Each area registers its own, once,
// as its module is imported: chunk(name, text | options => text); forget(name) lets one go (an own shader's text, when
// no world has it any more). assemble(names, options) is the chunks' texts one after another, in the order named —
// WGSL's module-scope declarations may stand in any order, so nothing is sorted and nothing is resolved. No
// preprocessor, no `override`s: what varies is an option read by a chunk's function.
//   Before each chunk's text assemble writes one line, `//## <name>`: a comment to WGSL, and the whole of the map from
// a line of the module back to a chunk — locate(wgsl, line) finds the mark above that line; the line it answers is the
// line in the chunk's own text (an author's shader given as a chunk's text: the line in the author's text).
//   directive(wgsl) finds an `enable` or a `requires` (both are WGSL's reserved words: outside a comment either one
// is a directive, or an error) — gpu.module refuses a text that has one: the viewers' browsers may be older than the
// compiler the check runs.
//   Lines are broken, and a `//` comment ended, where WGSL breaks them — LF, VT, FF, CR, CR LF (one break), U+0085,
// U+2028, U+2029 — so a line told here is the compiler's line; a word is WGSL's identifier (Unicode letters).
const MARK = '//## ';
const BREAKS = /\r\n|[\n\v\f\r\u0085\u2028\u2029]/g, BREAK = new RegExp(BREAKS.source, 'y');
const WORD = /[\p{XID_Start}_]\p{XID_Continue}*/uy;
const chunks = new Map();

// the length of the line break that begins at i (0: none does)
function breakAt(text, i) {
  BREAK.lastIndex = i;
  return BREAK.test(text) ? BREAK.lastIndex - i : 0;
}

export function chunk(name, text) {
  if (typeof name !== 'string' || !name || name.search(BREAKS) >= 0) throw new Error('wgsl: a chunk needs a name of one line');
  if (typeof text !== 'string' && typeof text !== 'function') throw new Error(`wgsl: chunk '${name}' is neither a text nor a function`);
  if (chunks.has(name)) throw new Error(`wgsl: chunk '${name}' is registered twice`);
  chunks.set(name, text);
}

export function forget(name) {
  if (!chunks.delete(name)) throw new Error(`wgsl: no chunk '${name}' to forget`);
}

export function assemble(names, options = {}) {
  const taken = new Set();
  let wgsl = '';
  for (const name of names) {
    const made = chunks.get(name);
    if (made === undefined) throw new Error(`wgsl: no chunk '${name}'`);
    if (taken.has(name)) throw new Error(`wgsl: chunk '${name}' is named twice in one module`);
    taken.add(name);
    const text = typeof made === 'function' ? made(options) : made;
    if (typeof text !== 'string') throw new Error(`wgsl: chunk '${name}' gave no text`);
    wgsl += `${MARK}${name}\n${text}${text.endsWith('\n') ? '' : '\n'}`;
  }
  return wgsl;
}

// (line: of the module, from 1 — a compilation message's lineNum) → { chunk, line }: the chunk and the line in its
// text; chunk null — the line is above every mark (a text that was not assembled): the line is the module's
export function locate(wgsl, line) {
  let at = 0, chunk = null, mark = 0;
  for (let n = 1; n <= line; n++) {
    BREAKS.lastIndex = at;
    const end = BREAKS.exec(wgsl);
    if (wgsl.startsWith(MARK, at)) { chunk = wgsl.slice(at + MARK.length, end ? end.index : wgsl.length).trimEnd(); mark = n; }
    if (!end) break;
    at = end.index + end[0].length;
  }
  return { chunk, line: line - mark };
}

// → { word, line } of the first `enable` or `requires` outside a comment, or null
export function directive(wgsl) {
  const n = wgsl.length;
  let line = 1;
  for (let i = 0; i < n;) {
    const broken = breakAt(wgsl, i);
    if (broken) { line++; i += broken; }
    else if (wgsl.startsWith('//', i)) { while (i < n && !breakAt(wgsl, i)) i++; }
    else if (wgsl.startsWith('/*', i)) {
      // (WGSL's block comments nest)
      let depth = 1;
      i += 2;
      while (i < n && depth) {
        const inside = breakAt(wgsl, i);
        if (inside) { line++; i += inside; }
        else if (wgsl.startsWith('/*', i)) { depth++; i += 2; }
        else if (wgsl.startsWith('*/', i)) { depth--; i += 2; }
        else i++;
      }
    }
    else {
      WORD.lastIndex = i;
      const word = WORD.exec(wgsl);
      if (!word) i += wgsl.codePointAt(i) > 0xffff ? 2 : 1;
      else if (word[0] === 'enable' || word[0] === 'requires') return { word: word[0], line };
      else i = WORD.lastIndex;
    }
  }
  return null;
}
