// What a file says to a person: the texts of its code (tr, tr.n, tr.c, say, think — their literals), of a widget's
// markup (its text), of a JSON file's fields that are read or heard (FIELDS). Each found is an entry —
//   {text, plural?, context?, who?, voice?, how?, spoken?, where}
// (who: a line said — say/think; voice: how it is heard, when the code says it: a scene's say(who, text, {voice,
// how}); how: a game's line's own manner — its say(who, text, {how}), think's, tr.line's, tr.thought's: its voice is
// its person's; spoken: what a game's line's voice says instead of it — say(who, text, {spoken}), as written, never
// translated) — and what is wrong is a problem: a text that is not a literal (nothing could find it), a name of the
// language's own (tr, say, think) made the code's own (problems/problems.js).
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { problem } from './problems/problems.js';
import './i18n/i18n.js';

// a JSON file's fields that are read: by its name — [path] (the language's own list: what a page shows translated)
export const { FIELDS } = globalThis.MooodI18n;
const OWN = new Set(['tr', 'say', 'think']);
// (a text a page shows as it is — a field, markup — is given nothing to put in: a {name} in it is an error)
const BRACED = /\{\w+\}/;

const literal = node => {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return null;
};

// a line's text that is not a literal: whether a text is in it bare (cond ? 'a' : 'b', 'a' + b) — not a line marked
// where it is written (tr.line, tr.thought) — nothing could find it
function bareText(arg) {
  let bare = false;
  walk.recursive(arg, null, {
    Literal(n) { if (typeof n.value === 'string') bare = true; },
    TemplateLiteral() { bare = true; },
    CallExpression(n, st, c) {
      if (n.callee.type === 'MemberExpression' && n.callee.object.type === 'Identifier' && n.callee.object.name === 'tr') return;
      c(n.callee, st);
      for (const a of n.arguments) c(a, st);
    },
    // (what chooses the text is not it: a condition, a comparison, a key)
    ConditionalExpression(n, st, c) { c(n.consequent, st); c(n.alternate, st); },
    BinaryExpression(n, st, c) { if (n.operator === '+') { c(n.left, st); c(n.right, st); } },
    MemberExpression(n, st, c) { c(n.object, st); },
  });
  return bare;
}

function parse(code) {
  const opts = { ecmaVersion: 'latest', locations: true, allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true,
    allowImportExportEverywhere: true, allowHashBang: true };
  try { return acorn.parse(code, { ...opts, sourceType: 'module' }); } catch {
    return acorn.parse(code, { ...opts, sourceType: 'script' });
  }
}

// The code's texts. file — its path (what an entry and a problem say where); own — the language's own names are the
// language's (a world's, a game's code: tr, say, think none of its own); moood's own pages make their translator
// themselves; game — a game's code (its lines are b.say's, never a scene's act(who, 'say', …)).
export function fromCode(code, file, own = true, game = false) {
  const entries = [], problems = [];
  let ast;
  try { ast = parse(code); } catch (e) { return { entries, problems: [problem(file, 'not-javascript', { error: e.message })] }; }
  const wrong = (node, code, values) => problems.push(problem(`${file}:${node.loc.start.line}`, code, values));
  const add = (node, e) => entries.push({ ...e, where: file, line: node.loc.start.line });
  // a line's voice, as it is asked for (the options it is said with): a scene's — {voice, how}; a game's — {how}, the
  // line's own manner (its voice is its person's: people.json), and {spoken}, the words its voice says instead of it;
  // literals, written whole; who no longer (the voice says it is someone; the manner, how)
  const voiceOf = (arg, node, name) => {
    const o = arg?.type === 'ObjectExpression' ? arg : null;
    const voice = o && Object.fromEntries(o.properties.filter(p => p.type === 'Property' && ['voice', 'how'].includes(p.key?.name))
      .map(p => [p.key.name, literal(p.value)]));
    if (voice && Object.values(voice).some(v => v == null)) wrong(node, game ? 'how-not-literal' : 'voice-not-literal', { name });
    if (o?.properties.some(p => p.type === 'Property' && p.key?.name === 'who')) wrong(node, 'voice-who', { name });
    if (o?.properties.some(p => p.type === 'SpreadElement')) wrong(node, 'voice-spread', { name });
    if (game && voice && 'voice' in voice) wrong(node, 'voice-game', { name });
    if (game) {
      const said = o?.properties.find(p => p.type === 'Property' && p.key?.name === 'spoken'), spoken = said && literal(said.value);
      if (said && spoken == null) wrong(node, 'spoken-not-literal', { name });
      return { ...(voice?.how ? { how: voice.how } : {}), ...(spoken != null ? { spoken } : {}) };
    }
    return voice?.voice ? { voice } : {};
  };
  walk.ancestor(ast, {
    CallExpression(node) {
      const c = node.callee, args = node.arguments;
      const name = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && !c.computed ? c.property.name : null;
      const obj = c.type === 'MemberExpression' && c.object.type === 'Identifier' ? c.object.name : null;
      if (c.type === 'Identifier' && name === 'tr') {
        const text = literal(args[0]);
        if (text == null) wrong(node, 'tr-not-literal');
        else add(node, { text });
      } else if (obj === 'tr' && name === 'n') {
        const one = literal(args[1]), other = literal(args[2]);
        if (one == null || other == null) wrong(node, 'tr-n-not-literal');
        else add(node, { text: one, plural: other });
      } else if (obj === 'tr' && name === 'c') {
        const context = literal(args[0]), text = literal(args[1]);
        if (context == null || text == null) wrong(node, 'tr-c-not-literal');
        else add(node, { context, text });
      } else if (obj === 'tr' && (name === 'line' || name === 'thought')) {
        const who = literal(args[0]), text = literal(args[1]);
        if (who == null || text == null) wrong(node, 'tr-line-not-literal', { name });
        else add(node, { who, text, said: name === 'line' ? 'say' : 'think', ...voiceOf(args[2], node, `tr.${name}`) });
      } else if (obj === 'tr' && own) {
        wrong(node, 'tr-not-own', { name });
      } else if (own && (name === 'say' || name === 'think') && c.type === 'MemberExpression' && c.object.type === 'CallExpression'
        && c.object.callee.type === 'MemberExpression' && c.object.callee.property.name === 'person') {
        // (a person's own verb: s.person('who').say('…', {voice, how, who}) — their line)
        const who = literal(c.object.arguments[0]), text = literal(args[0]);
        if (who == null || text == null) wrong(node, 'person-line-not-literal', { name });
        else add(node, { who, text, said: name, ...voiceOf(args[1], node, name) });
      } else if (own && name === 'act' && literal(args[1]) === 'say') {
        // (an action: act('who', 'say', '…') — a scene's: the scene translates it; a game's line is b.say)
        const who = literal(args[0]), text = literal(args[2]);
        if (game) wrong(node, 'act-say-game');
        else if (who == null || text == null) wrong(node, 'act-say-not-literal');
        else add(node, { who, text, said: 'say' });
      } else if (own && (name === 'say' || name === 'think')) {
        // (a line written where it is said; else it was marked where it is kept: tr.line, tr.thought)
        const who = literal(args[0]), text = literal(args[1]);
        if (who != null && text != null) {
          add(node, { who, text, said: name, ...voiceOf(args[2], node, name) });
        } else if (literal(args[1]) != null || args[1]?.type === 'TemplateLiteral') {
          wrong(node, 'line-speaker', { name });
        } else if (c.type === 'MemberExpression' && (literal(args[0]) != null || args[0]?.type === 'TemplateLiteral') && (!args[1] || args[1].type === 'ObjectExpression')) {
          // (a person's verb on a name of the code's own: who says it is not written beside it)
          wrong(node, 'line-whose', { name });
        } else if (text == null && args[1] && bareText(args[1])) {
          wrong(node, 'line-bare', { name });
        } else if (game && text == null && args[2]?.type === 'ObjectExpression' && args[2].properties.some(p => p.type === 'Property' && ['how', 'spoken'].includes(p.key?.name))) {
          // (a line kept is said as it was kept: its own manner and spoken words with it)
          wrong(node, 'line-kept-how', { name });
        }
      }
    },
    // the language's own names are the language's: tr, say, think made a variable, a function, a parameter of the code's
    // (a name inside a pattern too: [tr] = …, { say } = …, (a = tr) => …)
    VariableDeclarator(node) { if (own) for (const n of bound(node.id)) if (OWN.has(n)) wrong(node, 'own-variable', { name: n }); },
    FunctionDeclaration(node) { if (own && OWN.has(node.id?.name)) wrong(node, 'own-function', { name: node.id.name }); },
    AssignmentExpression(node) { if (own) for (const n of bound(node.left)) if (OWN.has(n)) wrong(node, 'own-set', { name: n }); },
    // tr is called where its text is written: never made another name (T = tr), handed on (f(tr)), a tag (tr`…`)
    TaggedTemplateExpression(node) { if (own && node.tag.type === 'Identifier' && node.tag.name === 'tr') wrong(node, 'tr-tag'); },
    Identifier(node, ancestors) {
      const up = ancestors[ancestors.length - 2];
      if (!own || node.name !== 'tr' || (up?.type === 'CallExpression' && up.callee === node) || (up?.type === 'MemberExpression' && up.object === node)
        || up?.type === 'TaggedTemplateExpression') return;
      wrong(node, 'tr-value');
    },
    Function(node) { if (own) for (const p of node.params) for (const n of bound(p)) if (OWN.has(n)) wrong(node, 'own-parameter', { name: n }); },
  });
  return { entries, problems };
}

// the names a pattern binds (a declarator's, a parameter's)
function bound(p) {
  if (!p) return [];
  if (p.type === 'Identifier') return [p.name];
  if (p.type === 'ArrayPattern') return p.elements.flatMap(bound);
  if (p.type === 'ObjectPattern') return p.properties.flatMap(q => bound(q.type === 'RestElement' ? q.argument : q.value));
  if (p.type === 'AssignmentPattern') return bound(p.left);
  if (p.type === 'RestElement') return bound(p.argument);
  return [];
}

// A widget's markup: its texts (the language's own reading of markup: what a page translates), and its scripts'.
export function fromMarkup(html, file, own = true, game = false) {
  const entries = [], problems = [];
  for (const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    const r = fromCode(m[1], file, own, game);
    entries.push(...r.entries); problems.push(...r.problems);
  }
  for (const text of globalThis.MooodI18n.markupTexts(html)) {
    if (BRACED.test(text)) problems.push(problem(file, 'braced', { text }));
    else entries.push({ text, where: file });
  }
  return { entries, problems };
}

// A JSON file's texts: its FIELDS.
export function fromJson(json, file, fields) {
  const entries = [], problems = [];
  let data;
  try { data = JSON.parse(json); } catch (e) { return { entries, problems: [problem(file, 'json', { error: e.message })] }; }
  const take = (value, path, where) => {
    if (!path.length) {
      if (typeof value === 'string' && BRACED.test(value)) problems.push(problem(file, 'braced', { text: value }));
      else if (typeof value === 'string' && value.trim()) entries.push({ text: value, where });
      else if (value != null && typeof value !== 'string') problems.push(problem(file, 'not-text', { field: where.slice(file.length).trim() }));
      return;
    }
    const [head, ...rest] = path;
    if (value == null || typeof value !== 'object') return;
    if (head === '*') for (const [k, v] of Object.entries(value)) take(v, rest, `${where}.${k}`);
    else if (head.endsWith('[]')) (value[head.slice(0, -2)] || []).forEach((v, i) => take(v, rest, `${where} ${head.slice(0, -2)}[${i}]`));
    else take(value[head], rest, path.length === 1 ? `${where} ${head}` : where);
  };
  for (const f of fields) take(data, f.split('.'), file);
  return { entries, problems };
}
