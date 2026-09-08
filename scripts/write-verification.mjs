import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';
import { check, digest } from '../src/kernel/data.mjs';
import { SymbolicModel } from '../src/model.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => decodeSOP(readFileSync(join(root, 'reports', name + '.sop'), 'utf8'));
const write = (name, value) => writeFileSync(join(root, 'reports', name + '.sop'), encodeSOP(value));
const archive = name => {
  const path = join(root, 'reports', name + '.sop'), old = join(root, 'reports', name + '-before-document-chat.sop');
  if (existsSync(path) && !existsSync(old)) copyFileSync(path, old);
};
const evaluation = read('latest-evaluation'), audit = read('vision-audit'), rebuild = read('rebuild');
const standalone = read('independence'), browser = read('browser-smoke'), layout = read('chat-layout-browser');
const documents = read('docs-independence'), docsBrowser = read('docs-browser');
const live = read('chat-browser'), compatibility = read('compatibility-early-school');
const procedures = read('chat-procedures');
const preservation = read('chat-preservation');
const model = new SymbolicModel();
check(evaluation.model === model.resources.hash && audit.model === model.resources.hash, 'Evaluation/audit revision mismatch');
const tap = readFileSync(join(root, 'reports/current-tests.tap'), 'utf8');
const passed = Number(tap.match(/^# pass (\d+)$/m)?.[1]), failed = Number(tap.match(/^# fail (\d+)$/m)?.[1]);
check(Number.isInteger(passed) && passed > 0 && failed === 0 && evaluation.acceptance, 'Implementation verification failed or unfinished');
const focused = ['phrase-tests.tap', 'elementary-tests.tap', 'extraction-tests.tap'].map(file => {
  const log = readFileSync(join(root, 'reports', file), 'utf8');
  const passed = Number(log.match(/^[#ℹ] pass (\d+)$/m)?.[1]);
  const failed = Number(log.match(/^[#ℹ] fail (\d+)$/m)?.[1]);
  check(passed > 0 && failed === 0, 'Focused verification failed or unfinished: ' + file);
  return { file: 'reports/' + file, passed, failed };
});
check([rebuild, standalone, browser, layout, documents, docsBrowser, live, procedures, preservation]
  .every(report => report.passed), 'A workflow verification failed');
check(preservation.newConversationBase === compatibility.model, 'Chat and school evaluation use different elementary bases');

const excluded = new Set(['.git', '.sxlm', '.agents', '.claude', 'node_modules', 'reports', 'ploinky-skills-manifest.json']);
const files = [];
function walk(directory) {
  for (const name of readdirSync(directory).sort()) {
    if (excluded.has(name)) continue;
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else {
      const bytes = readFileSync(path);
      files.push({ path: relative(root, path), bytes: bytes.length, hash: createHash('sha256').update(bytes).digest('hex') });
    }
  }
}
walk(root);
const generated = new Date().toISOString(), hash = digest(files);
archive('verification'); archive('documentation'); archive('verification-files');
write('verification-files', { schema: 'sxlm.verification-files.v2', model: model.resources.hash, hash,
  excluded: [...excluded], files });
const wiki = readFileSync(join(root, 'docs/wiki.html'), 'utf8');
const documentation = { schema: 'sxlm.documentation-verification.v2', generated,
  chapters: documents.chapters, specifications: documents.specifications,
  wikiEntries: [...wiki.matchAll(/id="definition-/g)].length,
  source: 'DS-only authoring; generated HTML and matrix', consolidation: 'reports/documentation-consolidation.sop',
  deterministicRebuild: documents.isolatedRebuild, checkedLinks: documents.checkedLinks,
  browser: docsBrowser, qualification: 'Structural, link, isolated rebuild and browser checks; the model architecture remains incomplete.' };
write('documentation', documentation);
write('verification', { schema: 'sxlm.verification.v5', generated, model: model.resources.hash,
  runtime: model.resources.runtime.hash, codeAndKnowledgeHash: hash, files: files.length,
  sourceModules: model.packs.reduce((count, pack) => count + pack.sop.length, 0),
  installedModules: model.resources.circuits.length,
  format: 'SOP source modules and constructor documents',
  tests: { passed, failed, log: 'reports/current-tests.tap', focused,
    qualification: 'The full suite includes model pinning, SDK phrase compilation and source extraction. Focused logs retain additional compiler, elementary and unchanged extractor checks.' },
  evaluation: { report: 'reports/latest-evaluation.sop', acceptance: evaluation.acceptance,
    suites: Object.fromEntries(Object.entries(evaluation.suites).map(([name, suite]) =>
      [name, { passed: suite.passed, total: suite.total }])),
    learning: { before: evaluation.learning.gates.before.passed, after: evaluation.learning.gates.after.passed,
      regressionsIntroduced: evaluation.learning.regressionsIntroduced.length } },
  rebuild: { passed: rebuild.passed, stages: rebuild.stages.length, report: 'reports/rebuild.sop' },
  standalone: { passed: standalone.passed, modules: standalone.moduleFiles,
    localReferences: standalone.localReferences, report: 'reports/independence.sop' },
  browser: { passed: browser.passed, checks: browser.checks.length, report: 'reports/browser-smoke.sop' },
  chat: { liveCodex: live.liveCodex, liveBrowserChecks: live.checks.length,
    restoredLayoutChecks: layout.checks.length, liveReport: 'reports/chat-browser.sop',
    preservation: { report: 'reports/chat-preservation.sop', passed: preservation.passed,
      pinnedBase: preservation.pinnedBase, newConversationBase: preservation.newConversationBase },
    procedures: { report: 'reports/chat-procedures.sop', passed: procedures.passed,
      profiles: Object.fromEntries(Object.entries(procedures.profiles).map(([name, profile]) =>
        [name, { model: profile.model, passed: profile.passed, total: profile.total }])) },
    layoutReport: 'reports/chat-layout-browser.sop', url: 'http://127.0.0.1:3210',
    qualification: 'The live DOCX check is an observed run with its own retained conversation, candidate and model identity. It is not a claim of general document comprehension.' },
  documentation,
  compatibility: { passed: compatibility.passed, total: compatibility.total,
    model: compatibility.model, report: 'reports/compatibility-early-school.sop', allExperimentsCovered: false },
  architecture: { complete: audit.complete, report: 'reports/vision-audit.sop',
    nativeOperations: audit.primitives.length, privilegedFiles: audit.sourceFiles.length,
    privilegedBytes: audit.sourceFiles.reduce((count, file) => count + file.bytes, 0),
    requirements: audit.requirements },
  qualification: 'Passing implementation and local workflow checks do not establish a general symbolic LLM. Open-language challenges, imported compatibility failures, finite document capacity and incomplete architectural requirements remain explicit. Older learning experiments retain their original report identities; they are not relabeled as this revision.' });
console.log(`Verification recorded: ${passed} tests, ${documents.specifications} DS, ${documents.chapters} HTML chapters, compatibility ${compatibility.passed}/${compatibility.total}. Architecture complete: ${audit.complete}.`);
