#!/usr/bin/env node
// moood-check <folder> [--write] [--json] — a repository of worlds, games and articles (or a folder of moood's own
// pages): it checked, its texts translated (index.js); --write lays out each language's file anew from what the code says; --json — the whole
// report (every text; every line heard, in every language, as its voice is asked for: lines.js; each problem with its
// text; advice — what works, better written otherwise — beside them). What is wrong is said in English
// (problems/problems.js). Exits 1 when something is wrong; advice alone is all right.
import { check } from './index.js';
import { lines } from './lines.js';
import { say } from './problems/problems.js';
import { folder } from './repository.js';
import './i18n/i18n.js';

const args = process.argv.slice(2);
const source = folder(args.find(a => !a.startsWith('--')) || '.');
// (laid out, then checked: what is left to translate is said)
if (args.includes('--write')) await check(source, { write: true });
const report = await check(source), en = globalThis.MooodI18n.translator(globalThis.MooodI18n.source);
const sayAll = list => list.map(p => ({ ...p, text: say(p, en) }));
const said = sayAll(report.problems), advice = sayAll(report.advice);
if (args.includes('--json')) console.log(JSON.stringify({ ...report, problems: said, advice, lines: await lines(source, report) }, null, 1));
else {
  for (const p of said) console.log(`${p.at}: ${p.text}`);
  if (advice.length) {
    console.log('advice (works as it is, better written so):');
    for (const p of advice) console.log(`  ${p.at}: ${p.text}`);
  }
  const n = report.scopes.reduce((k, s) => k + s.entries.length, 0);
  console.log(`${report.problems.length ? `${report.problems.length} wrong` : 'all right'}${advice.length ? ` (${advice.length} advice)` : ''} — ${n} texts in ${report.scopes.length} scopes`);
}
process.exitCode = report.problems.length ? 1 : 0;  // (not exit(): a long report to a pipe is written out first)
