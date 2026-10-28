// A repository of content as it lies: a folder in which every folder (at any depth, the root too) with world.json is
// a world, with game.json a game, with article.json an article — as many as it has, mixed; a folder that is one is not
// searched further (its scenes/, modules/, bespoke/ are its own), and one with two of these files is wrong — and how
// they name each other: a path from the one that names, or `repo@ref:path` for another repository. What check reads
// (scopes.js) and the hosts serve (the local player: player/; moood's studio: a git tree at a commit).
//   A repository is read through a source of its files — a folder on disk (folder), or whatever a host reads one from:
//     list(dir) → the entries of a folder ('' the root, else ending in /): [{name, dir}], or null — there is none;
//     read(path) → a file's text (UTF-8), or null — there is none;
//   and one that is written to (a folder: check --write lays out the translations' files) —
//     write(path, text) — the file, its folders made as needed;
//   and a host's (docs/host.md: the files the pages are given by their content) —
//     id(path) → the id of a file's content: git's blob sha (blobId), or null — there is none.
//   A folder on disk is read as git reads a repository: a symbolic link is no file and no folder of it — never followed,
// never written through —, and nothing outside it is read.
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep, posix as P } from 'node:path';
import { problem } from './problems/problems.js';

export const natural = (a, b) => a.localeCompare(b, 'en', { numeric: true });
const KINDS = ['world', 'game', 'article'];

// A path of a folder (real: the folder's own path, links resolved) as it lies there → the path, or null: it leads out
// of the folder, or through a symbolic link (or there is nothing there)
export function within(real, path) {
  const p = resolve(real, `.${sep}${path}`);
  if (p !== real && !p.startsWith(`${real}${sep}`)) return null;
  try { return realpathSync(p) === p ? p : null; } catch { return null; }
}
const kind = p => { try { return lstatSync(p); } catch { return null; } };

// the id of a file's content (its bytes): git's blob sha — the same whether a host reads it from disk or from git
export const blobId = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

// a folder on disk as a source
export function folder(root) {
  const real = realpathSync(root);
  return {
    async list(dir) {
      const p = within(real, dir);
      if (!p || !kind(p).isDirectory()) return null;
      return readdirSync(p, { withFileTypes: true }).filter(d => d.isDirectory() || d.isFile()).map(d => ({ name: d.name, dir: d.isDirectory() }));
    },
    async read(path) {
      const p = within(real, path);
      return p && kind(p).isFile() ? readFileSync(p, 'utf8') : null;
    },
    // (a file that is there is written over only if it is one, not a link; folders made only under one that is the
    // folder's own)
    async write(path, text) {
      const p = resolve(real, `.${sep}${path}`);
      let up = dirname(p);
      while (!kind(up)) up = dirname(up);
      const there = kind(p);
      if (!p.startsWith(`${real}${sep}`) || !within(real, up.slice(real.length + 1)) || (there && !there.isFile())) throw new Error(`${path}: not a file of the folder (a symbolic link on the way, or out of it) — not written`);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, text);
    },
  };
}

// The worlds, games and articles of a repository (its source): [{kind, base — its folder from root ('' the root, else
// ending in /), json — its world.json, game.json or article.json read (null: not an object — the problem said)}], and
// what is wrong with where they lie (problems/problems.js)
export async function units(source) {
  const problems = [];
  const walk = async folder => {
    const entries = await source.list(folder) ?? [];
    const kinds = KINDS.filter(k => entries.some(e => !e.dir && e.name === `${k}.json`));
    if (kinds.length > 1) { problems.push(problem(folder || './', 'two-kinds', { files: kinds.map(k => `${k}.json`).join(', ') })); return []; }
    if (kinds.length) {
      const name = `${folder}${kinds[0]}.json`;
      let json = null;
      try { json = JSON.parse(await source.read(name)); } catch (e) { problems.push(problem(name, 'json', { error: e.message })); }
      if (json !== null && (typeof json !== 'object' || Array.isArray(json))) { problems.push(problem(name, 'not-object')); json = null; }
      return [{ kind: kinds[0], base: folder, json }];
    }
    const inside = entries.filter(e => e.dir && !e.name.startsWith('.') && e.name !== 'node_modules').sort((a, b) => natural(a.name, b.name));
    return (await Promise.all(inside.map(e => walk(`${folder}${e.name}/`)))).flat();
  };
  const found = await walk('');
  return { units: found, problems };
}

// The languages a world, a game or an article says it is in (its "languages": a list of moood's — `known` —, each
// once) → {languages} | {problem: {code, values}} — not said rightly: in none (the one rule of check and the hosts)
export function languagesOf(json, known) {
  const l = json?.languages, all = known.join(', ');
  if (!Array.isArray(l) || !l.length || !l.every(x => typeof x === 'string')) return { problem: { code: 'languages', values: { known: all } } };
  const bad = l.filter(x => !known.includes(x)), twice = l.filter((x, i) => l.indexOf(x) !== i);
  if (bad.length) return { problem: { code: 'languages-unknown', values: { languages: bad.join(', '), known: all } } };
  if (twice.length) return { problem: { code: 'languages-twice', values: { languages: twice.join(', ') } } };
  return { languages: l };
}

// A reference to a world, a game or a scene (a game's "world"; an article's "about"): another
// repository's — repo@ref:path (owner/name; a branch, a tag or a commit; a path in it, `.` its root) —, or a path from
// the folder `from` (from root, '' or ending in /), within the repository:
// → {foreign: {repo, ref, path — from its root, posix, '' the root}} | {path: from root, posix, '' the root} | {wrong:
// {code, values} — what is wrong with it: a problem's (problems/problems.js), with the field and the reference}
const REPO = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;
const REF = /^(?![-/.])(?!.*(?:\.\.|\/\/|@\{|\.lock$|[/.]$))[A-Za-z0-9._/-]+$/;
const relativePath = p => p !== '' && !p.startsWith('/') && !p.includes('\\');
const wrong = (code, values = {}) => ({ wrong: { code, values } });
export function reference(ref, from) {
  if (typeof ref !== 'string' || !ref) return wrong('ref-not-path');
  const m = /^([^@:]+)@([^:]+):(.*)$/.exec(ref);
  if (m) {
    if (!REPO.test(m[1])) return wrong('ref-repository', { name: m[1] });
    if (!REF.test(m[2])) return wrong('ref-version', { version: m[2] });
    const p = P.normalize(m[3] || '/');
    if (!relativePath(m[3]) || p === '..' || p.startsWith('../')) return wrong('ref-path', { path: m[3] });
    return { foreign: { repo: m[1], ref: m[2], path: p === '.' ? '' : p.replace(/\/$/, '') } };
  }
  if (ref.includes(':') || !relativePath(ref)) return wrong('ref-neither');
  const p = P.normalize(`${from}${ref}`);
  if (p === '..' || p.startsWith('../')) return wrong('ref-out');
  return { path: p === '.' ? '' : p.replace(/\/$/, '') };
}

// a path in a repository as a world's scene (<world>/scenes/<folder>): {world — the world's folder ('' the root),
// folder} | null — it is not one
export function scenePath(path) {
  const m = /^(?:(.*)\/)?scenes\/([^/]+)$/.exec(path);
  return m ? { world: m[1] ?? '', folder: m[2] } : null;
}
