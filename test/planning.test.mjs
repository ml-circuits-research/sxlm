import test from 'node:test';
import assert from 'node:assert/strict';
import { SymbolicModel } from '../src/model.mjs';
import { verifyPlan } from '../src/semantics/verify-plan.mjs';
import { Budget, LimitError } from '../src/kernel/data.mjs';
import { plan as historicalPlan } from './reference/planner-v1.mjs';
import { planningGates } from '../eval/planning-cases.mjs';
import { coverageGates } from '../eval/program-cases.mjs';
import { evaluate } from '../src/learning/evaluate.mjs';
import { auditVision } from '../scripts/audit-vision.mjs';

const atom = (name, extra = {}) => ({ predicate: 'located', terms: [name], ...extra });
const action = (id, from, to, cost = 1) => ({ id, requires: [atom(from)], remove: [atom(from)], add: [atom(to)], cost });
const problem = { initial: [atom('west')], goals: [atom('east')], actions: [action('direct', 'west', 'east', 5), action('first', 'west', 'middle'), action('second', 'middle', 'east')] };

test('SOP planning agrees with the historical search and an independent exhaustive cost oracle', () => {
  const model = new SymbolicModel();
  const cases = planningGates(); assert.equal(cases.length, 64);
  assert.ok(cases.some(item => item.expect.status === 'solved')); assert.ok(cases.some(item => item.expect.status !== 'solved'));
  for (const item of cases) {
    const expected = historicalPlan(item.problem);
    const { verification, trace, metrics, model: identity, ...actual } = model.plan(item.problem, { cache: false });
    assert.deepEqual(actual, expected, item.id);
    assert.equal(actual.status, item.expect.status, item.id);
    if (actual.status === 'solved') { assert.equal(actual.cost, item.expect.cost, item.id); assert.equal(verification.valid, true); }
    const reordered = model.plan({ ...item.problem, actions: [...item.problem.actions].reverse() });
    assert.equal(reordered.status, actual.status); assert.equal(reordered.cost, actual.cost);
  }
});

test('priority, ties, zero cycles, deletion, precondition conjunctions and signed scopes compose', () => {
  const model = new SymbolicModel();
  for (const cache of [false, true, true]) {
    const result = model.plan(problem, { cache }); assert.equal(result.cost, 2); assert.deepEqual(result.steps, ['first', 'second']);
  }
  const tie = { ...problem, actions: [action('direct', 'west', 'east', 2), ...problem.actions.slice(1)] };
  assert.deepEqual(model.plan(tie).steps, ['direct']);
  assert.equal(model.plan({ ...problem, actions: [action('loop', 'west', 'west', 0)] }).status, 'unreachable-in-model');
  assert.deepEqual(model.plan({ ...problem, goals: [] }).steps, []);
  const both = { initial: [atom('west')], goals: [atom('west'), atom('east')], actions: [action('remove-west', 'west', 'east')] };
  assert.equal(model.plan(both).status, 'unreachable-in-model');
  const blocked = { ...problem, actions: [{ ...action('needs-two', 'west', 'east'), requires: [atom('west'), atom('permit')] }] };
  assert.equal(model.plan(blocked).status, 'unreachable-in-model');
  for (const mismatch of [atom('west', { negative: true }), atom('west', { context: 'other' }), { predicate: 'located', terms: ['west', 'role'] }]) {
    assert.equal(model.plan({ ...problem, initial: [mismatch] }).status, 'unreachable-in-model');
  }
});

test('invalid declarations and resource exhaustion cannot become a completed planning result', () => {
  const model = new SymbolicModel();
  for (const invalid of [
    { ...problem, initial: null }, { ...problem, goals: [atom('?unbound')] },
    { ...problem, actions: [{ ...problem.actions[0], cost: -1 }] },
    { ...problem, actions: [{ ...problem.actions[0], cost: Infinity }] },
    { ...problem, actions: [{ ...problem.actions[0], requires: null }] },
    { ...problem, actions: [problem.actions[0], problem.actions[0]] },
    { ...problem, actions: Array(1001).fill(problem.actions[0]) },
  ]) assert.throws(() => model.plan(invalid));
  for (const options of [{ maxIterations: 0 }, { maxIterations: 1 }, { limits: { nodes: 10 } }, { limits: { steps: 0 } }, { limits: { iterations: 1 } }]) assert.throws(() => model.plan(problem, { ...options, cache: false }), LimitError);
  for (const maxIterations of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => model.plan(problem, { maxIterations }), /iteration limit/);
  const overflow = { ...problem, actions: [action('first', 'west', 'middle', Number.MAX_VALUE), action('second', 'middle', 'east', Number.MAX_VALUE)] };
  assert.throws(() => model.plan(overflow), /Non-finite/);
});

test('formal witness replay rejects forgery independently of the search policy', () => {
  const good = { status: 'solved', steps: ['first', 'second'], cost: 2 };
  assert.equal(verifyPlan(problem, good).valid, true);
  for (const bad of [{ ...good, steps: ['second'] }, { ...good, steps: ['missing'] }, { ...good, steps: [] }, { ...good, cost: 0 }, { ...good, status: 'unreachable-in-model' }]) assert.equal(verifyPlan(problem, bad).valid, false);
  assert.equal(verifyPlan({ ...problem, goals: [atom('east', { negative: true })] }, good).valid, false);
  assert.equal(verifyPlan({ ...problem, actions: [...problem.actions, problem.actions[0]] }, good).valid, false);
  assert.throws(() => verifyPlan(problem, good, { budget: new Budget({ steps: 0 }) }), LimitError);
  const pack = structuredClone(new SymbolicModel().packs[0]);
  pack.sop.find(m => m.id === 'planning.run').source = '@input problem object\n@input options object\n@steps kernel.seq.empty\n@out kernel.value.record status "solved" steps $steps cost 0\n@output result $out';
  assert.throws(() => new SymbolicModel({ packs: [pack] }).plan(problem), /witness verification/);
});

test('learned coverage is reused for planning, ablation loses capability and restoration recovers it', () => {
  const base = new SymbolicModel(), result = base.plan(problem, { cache: false });
  assert.equal(base.runtime.primitives.has('planning.search'), false);
  assert.ok(result.trace.some(node => node.circuit === 'learned.set.coverage'));
  assert.ok(result.trace.some(node => node.circuit === 'planning.run' && node.mode === 'iterate'));
  assert.equal(evaluate(base, coverageGates('learned.set.coverage')).failed, 0);
  const pack = structuredClone(base.packs[0]), method = pack.sop.find(m => m.id === 'learned.set.coverage');
  const source = method.source;
  method.source = '@input required array\n@input available array\n@out kernel.value.literal value false\n@output result $out';
  const ablated = new SymbolicModel({ packs: [pack] });
  assert.equal(ablated.resources.runtime.hash, base.resources.runtime.hash);
  assert.equal(ablated.plan(problem).status, 'unreachable-in-model');
  method.source = source;
  assert.deepEqual(new SymbolicModel({ packs: [pack] }).plan(problem).steps, result.steps);
  pack.sop = pack.sop.filter(m => m.id !== method.id);
  assert.throws(() => new SymbolicModel({ packs: [pack] }), /Unresolvable circuit/);
});

test('planning derivations bind deployed source and teacher evidence without relabeling authored policy', () => {
  const base = new SymbolicModel(), audit = auditVision({ model: base });
  assert.equal(audit.planningMigration.policyReplay, true); assert.equal(audit.planningMigration.methodReplay, true);
  assert.equal(audit.planningMigration.nativePlanningRemoved, true); assert.equal(audit.planningMigration.compilerOutsideRuntime, true);
  assert.equal(audit.complete, false);
  const pack = structuredClone(base.packs[0]); delete pack.training.components.setCoverage;
  const missing = auditVision({ model: new SymbolicModel({ packs: [pack] }) });
  assert.equal(missing.planningMigration.methodReplay, false);
  const evidence = missing.requirements.find(r => r.id === 'all-competence-learned').evidence;
  assert.ok(evidence.withoutVerifiedDerivation.some(c => c.id === 'learned.set.coverage'));
  assert.ok(evidence.withoutVerifiedDerivation.some(c => c.id === 'planning.run'));
  pack.training.components.setCoverage = structuredClone(base.packs[0].training.components.setCoverage);
  pack.sop.find(m => m.id === 'learned.set.coverage').source = '@input required array\n@input available array\n@out kernel.value.literal value false\n@output result $out';
  pack.sop.find(m => m.id === 'planning.cost-default').source = '@input with object\n@out data.number value 2\n@output result $out';
  const altered = auditVision({ model: new SymbolicModel({ packs: [pack] }) });
  assert.equal(altered.planningMigration.methodReplay, false); assert.equal(altered.planningMigration.policyReplay, false);
});
