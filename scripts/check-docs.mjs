import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { sources } from './docs/catalog.mjs';
import { readChapter } from './docs/chapters.mjs';
import { encodeSOP } from '../src/kernel/sop-data.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const specs = readdirSync(join(root, 'docs/specs')).filter(name => /^DS\d{3}-.+\.md$/.test(name)).sort();
const hash = value => createHash('sha256').update(value).digest('hex');
assert.equal(existsSync(join(root, 'vision.md')), false, 'The theory belongs in DS000');
assert.deepEqual(readdirSync(join(root, 'docs')).filter(name => name.endsWith('.md')), []);
assert.deepEqual(readdirSync(join(root, 'docs/specs')).filter(name => name.endsWith('.md') && !specs.includes(name)), ['matrix.md']);
for (const [index, name] of specs.entries()) {
  assert.ok(name.startsWith(`DS${String(index).padStart(3, '0')}-`));
  const source = readFileSync(join(root, 'docs/specs', name), 'utf8');
  assert.match(source, new RegExp(`^---\\ntitle: ${name.slice(0, -3)}\\nsummary: [^\\n]+\\n---\\n`));
  let fence = false;
  const headings = source.split('\n').filter(line => {
    if (line.startsWith('```')) fence = !fence;
    return !fence && /^## /.test(line);
  });
  assert.deepEqual(headings, ['## Introduction', '## Core Content'], name);
}
const files = ['README.md', 'AGENTS.md', ...specs.map(name => 'docs/specs/' + name),
  ...sources.map(([, page]) => 'docs/' + page + '.html')];
let checkedLinks = 0;
for (const file of files) {
  const source = readFileSync(join(root, file), 'utf8');
  const links = file.endsWith('.html') ? [...source.matchAll(/href="([^"]+)"/g)].map(m => m[1])
    : [...source.replace(/```[^]*?```/g, '').matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(m => m[1]);
  for (const link of links) {
    if (/^[a-z]+:/i.test(link)) continue;
    const url = new URL(link.replaceAll('&amp;', '&'), 'https://docs.invalid/' + file);
    const target = join(root, decodeURIComponent(url.pathname));
    assert.ok(existsSync(target), `Missing link ${file} -> ${link}`);
    const specification = url.searchParams.get('spec');
    if (specification) assert.ok(existsSync(join(dirname(target), 'specs', specification)), link);
    if (url.hash && target.endsWith('.html') && !specification) {
      assert.ok(readFileSync(target, 'utf8').includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), `Missing anchor ${file} -> ${link}`);
    }
    checkedLinks++;
  }
}
for (const entry of sources) assert.match(readChapter(entry), /^# [^\n]+\n/);
const scratch = mkdtempSync(join(tmpdir(), 'sxlm-docs-'));
try {
  for (const path of ['docs', 'README.md', 'AGENTS.md', 'scripts/docs', 'scripts/build-docs.mjs']) {
    cpSync(join(root, path), join(scratch, path), { recursive: true });
  }
  for (const command of ['scripts/docs/link-terms.mjs', 'scripts/build-docs.mjs']) {
    const result = spawnSync(process.execPath, [command], { cwd: scratch, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
  for (const path of [...files, 'docs/specs/matrix.md', 'docs/partials/header.html', 'docs/partials/footer.html']) {
    assert.equal(hash(readFileSync(join(scratch, path))), hash(readFileSync(join(root, path))), `Non-reproducible documentation: ${path}`);
  }
  writeFileSync(join(root, 'reports/docs-independence.sop'), encodeSOP({
    schema: 'sxlm.docs-independence.v3', passed: true, specifications: specs.length,
    chapters: sources.length, checkedLinks, isolatedRebuild: true,
    source: 'DS specifications only; no chapter Markdown, root vision or imported authoring tools.',
  }));
  console.log(`${specs.length} specifications, ${sources.length} DS-derived chapters, ${checkedLinks} local links; isolated rebuild matches.`);
} finally { rmSync(scratch, { recursive: true, force: true }); }
