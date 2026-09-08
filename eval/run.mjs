import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SymbolicModel, induceConstruction } from '../src/index.mjs';
import { evaluate } from '../src/learning/evaluate.mjs';
import { validateCandidate } from '../src/learning/workflow.mjs';
import { conformance, composition, metamorphic, learningGates, challenges } from './cases.mjs';
import { planningGates } from './planning-cases.mjs';
import { normalizationGates } from './lexical-cases.mjs';

export function runEvaluation() {
  const model = new SymbolicModel();
  const specification = decodeSOP(readFileSync(new URL('../examples/learn-construction.sop', import.meta.url)));
  const candidate = induceConstruction(model, specification);
  const promotion = validateCandidate(model, candidate, { gates: learningGates, regressions: [...conformance, ...composition] });
  const suites = { conformance: evaluate(model, conformance), composition: evaluate(model, composition), metamorphic: evaluate(model, metamorphic), planning: evaluate(model, planningGates()), normalization: evaluate(model, normalizationGates()), challenges: evaluate(model, challenges) };
  return { schema: 'sxlm.benchmark.v1', generated: new Date().toISOString(), node: process.version, model: model.resources.hash, manifests: model.resources.manifests, acceptance: suites.conformance.failed === 0 && suites.composition.failed === 0 && suites.metamorphic.failed === 0 && suites.planning.failed === 0 && suites.normalization.failed === 0 && promotion.accepted, suites, learning: promotion, caveats: [
    'Authored repository tests, not a blind external natural-language benchmark.',
    'Compositional learning gates are held out from the two induction examples, not from the implementation author.',
    'Metamorphic renaming probes are grouped separately and do not establish open-domain competence.',
    'Challenge failures remain failures; abstentions are not relabeled as reasoning successes.',
    'Summary tests check extraction fidelity and selected content, not broad human-rated summary quality.',
    'Completion tests establish source continuation and learned sequence behavior, not pretrained LLM quality.',
    'Planning uses formal signed transitions and an independently implemented small-state cost oracle. This does not measure natural-language planning interpretation or externally blind performance.',
    'Normalization transfer tests a synthesized two-operation Unicode procedure, not learned token boundaries, grammar or open-language competence.',
  ] };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = runEvaluation(), directory = new URL('../reports/', import.meta.url); mkdirSync(directory, { recursive: true });
  writeFileSync(new URL('latest-evaluation.sop', directory), encodeSOP(report) + '\n');
  for (const [name, suite] of Object.entries(report.suites)) {
    console.log(`${name}: ${suite.passed}/${suite.total}`);
    if (name !== 'challenges') for (const result of suite.results.filter(r => !r.pass)) console.log(`  FAIL ${result.id}: ${result.failures.join('; ')}`);
  }
  console.log(`learning gates: ${report.learning.gates.before.passed} -> ${report.learning.gates.after.passed}/${report.learning.gates.after.total}; regressions introduced: ${report.learning.regressionsIntroduced.length}`);
  console.log(`Acceptance: ${report.acceptance ? 'PASS' : 'FAIL'}. Raw report: reports/latest-evaluation.sop`);
  console.log('Challenge results are exploratory and are excluded from the acceptance gate; see report caveats.');
  if (!report.acceptance) process.exitCode = 1;
}
