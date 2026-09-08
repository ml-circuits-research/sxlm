import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { slug } from './catalog.mjs';
import { readChapter } from './chapters.mjs';
const docs = new URL('../../docs/', import.meta.url);
const terms = [...readChapter(['WIKI', 'wiki', 'DS012-terminology.md'], docs).matchAll(/^## (.+)$/gm)].map(match => match[1]);
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const plurals = new Set(['Circuit', 'Pack', 'Provider', 'Linkage', 'Session', 'Certificate', 'Source span', 'Budget', 'Receipt', 'Atom']);
const aliases = terms.flatMap(term => [[term, slug(term)], ...(plurals.has(term) ? [[term + 's', slug(term)]] : [])]);
aliases.sort((a, b) => b[0].length - a[0].length);
const targets = new Map(aliases.map(([term, id]) => [term.toLowerCase(), id]));
const pattern = new RegExp('`[^`]+`|\\[[^\\]]+\\]\\([^)]+\\)|\\b(?:' + aliases.map(([term]) => escape(term)).join('|') + ')\\b', 'gi');
const files = ['../README.md', '../AGENTS.md', ...readdirSync(new URL('specs/', docs)).filter(name => /^DS/.test(name)).map(name => 'specs/' + name)];
for (const file of files) {
  let code = false, front = false;
  const source = readFileSync(new URL(file, docs), 'utf8');
  const output = source.split('\n').map((line, index) => {
    if (index === 0 && line === '---') { front = true; return line; }
    if (front) { if (line === '---') front = false; return line; }
    if (line.startsWith('```')) { code = !code; return line; }
    if (code || /^#|^<!--/.test(line)) return line;
    return line.replace(pattern, term => targets.has(term.toLowerCase())
      ? `[${term}](${file.startsWith('specs/') ? '../' : file.startsWith('../') ? 'docs/' : ''}wiki.html#definition-${targets.get(term.toLowerCase())})` : term);
  }).join('\n');
  writeFileSync(new URL(file, docs), output);
}
console.log(`Linked ${terms.length} canonical terms across ${files.length} documents.`);
