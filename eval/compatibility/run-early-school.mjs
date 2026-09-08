import { readFileSync, writeFileSync } from 'node:fs';
import { SymbolicModel } from '../../src/model.mjs';
import { readPack } from '../../src/learning/packs.mjs';
import { encodeSOP, decodeSOP } from '../../src/kernel/sop-data.mjs';
import { canonical, digest, check } from '../../src/kernel/data.mjs';
import { rational, format } from '../../src/kernel/rational.mjs';

const dataset = decodeSOP(readFileSync(new URL('./sdlm-early-school.sop', import.meta.url), 'utf8'));
check(new Set(dataset.cases.map(item => item.id)).size === dataset.cases.length, 'Duplicate imported case identity');
const base = new SymbolicModel();
const model = new SymbolicModel({ packs: [...base.packs,
  readPack(new URL('../../packs/elementary-knowledge.sop', import.meta.url))] });

// Translate result contracts only. Input sentences and expected answers remain untouched.
function matches(answer, expected) {
  if (expected.kind === 'boolean') return answer.kind === 'truth' && answer.truth === expected.status;
  if (expected.kind === 'bindings') return answer.kind === 'select' &&
    canonical([...(answer.values ?? [])].sort()) === canonical([...expected.values].sort());
  if (expected.kind === 'number') return ['arithmetic', 'quantity'].includes(answer.kind) &&
    answer.value != null && format(rational(answer.value)) === format(rational(expected.value));
  throw new Error('Unadapted expected answer kind: ' + expected.kind);
}
const results = [];
for (const item of dataset.cases) {
  const session = model.createSession(), turns = [], failures = [];
  let contractMatch = false;
  try {
    for (const text of [...item.context, item.question]) {
      const answer = session.ask(text);
      turns.push({ text, kind: answer.kind ?? null, status: answer.status ?? null,
        truth: answer.truth ?? null, value: answer.value ?? null, values: answer.values ?? null,
        gaps: answer.document?.coverage.gaps ?? null, answer: answer.text,
        verification: answer.verification ?? null, metrics: answer.metrics });
      if (answer.status === 'budget-exceeded') failures.push('Request budget exhausted');
      if (answer.document?.coverage.gaps !== 0) failures.push('Unsupported or ambiguous input: ' + text);
    }
    const answer = turns.at(-1);
    contractMatch = matches(answer, item.expected);
    if (!contractMatch) failures.push('Answer contract differs from the imported expectation');
    if (['truth', 'select'].includes(answer.kind) && !answer.verification?.valid)
      failures.push('Missing verified logical certificate');
  } catch (error) { failures.push(error.message); }
  results.push({ id: item.id, domain: item.domain, split: item.split,
    expected: item.expected, contractMatch, passed: failures.length === 0, failures, turns });
  console.log(`${failures.length ? 'FAIL' : 'PASS'} ${item.id}`);
}
const byDomain = Object.fromEntries([...new Set(results.map(item => item.domain))].map(domain => {
  const rows = results.filter(item => item.domain === domain);
  return [domain, { passed: rows.filter(item => item.passed).length, total: rows.length }];
}));
const report = { schema: 'sxlm.compatibility-evaluation.v1', generated: new Date().toISOString(),
  source: dataset.source, casesHash: digest(dataset.cases), model: model.resources.hash,
  manifests: model.resources.manifests, profile: 'bootstrap-plus-elementary',
  total: results.length, passed: results.filter(item => item.passed).length,
  answerContractMatches: results.filter(item => item.contractMatch).length, byDomain, results,
  qualifications: [
    'Repository-owned runner over copied case data; no sibling code is imported or executed.',
    'Each case uses a fresh session and sequential, unchanged context statements followed by its question.',
    'Unknown counts only where expected and only with complete interpretation. Resource failure is never a logical negative.',
    'Passing requires exact typed answer agreement, zero interpretation gaps across all turns and checked logical certificates.',
    'Cases are public and development-visible. This is compatibility measurement, not blind educational validation.',
    'Original expectations include simplified world assumptions; disagreement may require explicit contract review.',
    'This runner covers one imported suite. Other inventoried experiments and the semantic review of ESLM cases remain outstanding.'
  ] };
writeFileSync(new URL('../../reports/compatibility-early-school.sop', import.meta.url), encodeSOP(report));
console.log(`Early-school compatibility: ${report.passed}/${report.total}; typed answer matches: ${report.answerContractMatches}`);
if (report.passed !== report.total) process.exitCode = 1;
