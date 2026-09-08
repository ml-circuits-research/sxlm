import { readFileSync, writeFileSync } from 'node:fs';
import { SymbolicModel } from '../src/model.mjs';
import { learnProgramPack } from '../src/learning/search.mjs';
import { evaluate } from '../src/learning/evaluate.mjs';
import { validateCandidate } from '../src/learning/workflow.mjs';
import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';
import { executionDigest, check } from '../src/kernel/data.mjs';
import { coverageGates } from '../eval/program-cases.mjs';

const model = new SymbolicModel(), specification = decodeSOP(readFileSync(new URL('../examples/learn-coverage.sop', import.meta.url)));
const candidate = learnProgramPack(model, specification), trained = new SymbolicModel({ packs: [...model.packs, candidate] });
const gates = coverageGates(), before = evaluate(model, gates), after = evaluate(trained, gates);
const next = { id: 'learned.incomplete', inputs: specification.inputs, output: 'boolean', library: [{ call: specification.id }, { op: 'kernel.boolean.not' }], examples: specification.examples.map(e => ({ input: e.input, output: !e.output })), limits: { applications: 2 } };
const reused = learnProgramPack(trained, next), combined = new SymbolicModel({ packs: [...trained.packs, reused] });
const reuse = evaluate(combined, coverageGates(next.id).map(g => ({ ...g, expect: { value: !g.expect.value } })));
const weak = learnProgramPack(model, { ...specification, id: 'learned.weak', examples: [{ input: { required: ['a'], available: ['a'] }, output: true }, { input: { required: ['b'], available: [] }, output: false }] });
const rejection = validateCandidate(model, weak, { gates: coverageGates(weak.id), regressions: [] });
const ablated = evaluate(new SymbolicModel({ packs: [...model.packs, { ...candidate, sop: [] }] }), gates);
const report = {
  schema: 'sxlm.program-learning-evaluation.v1', model: model.resources.hash, runtime: model.resources.runtime.hash,
  generated: new Date().toISOString(), sourcePack: executionDigest(candidate), receipt: candidate.sop[0].learning,
  exactReplay: executionDigest(candidate) === executionDigest(learnProgramPack(model, specification)),
  unchangedRuntime: combined.resources.runtime.hash === model.resources.runtime.hash,
  before, after, ablated, reuse,
  counterexample: { trainingFit: weak.sop[0].learning.fit, transferPassed: rejection.gates.after.passed, transferTotal: rejection.gates.after.total, promotionAccepted: rejection.accepted },
  qualification: 'Public same-project finite-set procedure evaluation. The teacher supplies types, constants and library choices. This demonstrates bounded program learning and reuse, not general language understanding or an external benchmark.'
};
check(report.exactReplay && report.unchangedRuntime && before.passed === 0 && ablated.passed === 0 && after.failed === 0 && reuse.failed === 0 && !rejection.accepted, 'Program learning evaluation failed');
writeFileSync(new URL('../reports/program-learning.sop', import.meta.url), encodeSOP(report));
writeFileSync(new URL('../reports/learned-coverage.sop', import.meta.url), encodeSOP(candidate));
writeFileSync(new URL('../reports/learned-coverage-module.sop', import.meta.url), candidate.sop[0].source);
console.log(`Program learning: ${before.passed} -> ${after.passed}/${after.total}; reuse ${reuse.passed}/${reuse.total}; weak-supervision promotion rejected; runtime unchanged.`);
