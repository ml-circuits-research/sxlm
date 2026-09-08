// Archived migration oracle; never imported by the runtime.
import { applyDocument, quantityAnswer } from './world-v1.mjs';
import { close, query, proofTree, proofCertificate } from '../../src/semantics/logic.mjs';
import { expression } from '../../src/kernel/rational.mjs';
import { Budget, copy, check } from '../../src/kernel/data.mjs';

export function solve(state, closure, task, { budget = new Budget() } = {}) {
  if (task.kind === 'truth' || task.kind === 'select') {
    const answer = query(closure, task.patterns, { budget });
    const roots = [...answer.rows.flatMap(r => r.premises), ...answer.counterevidence.flatMap(r => r.premises)];
    const proofs = proofTree(closure, roots, 6), certificate = proofCertificate(closure, roots, { budget });
    if (task.kind === 'truth') return { kind: 'truth', status: answer.truth === 'unknown' ? 'unknown' : 'answered', truth: answer.truth, witness: answer.rows[0]?.bindings ?? {}, task, proofs, certificate, completeness: 'open-world', inferenceComplete: closure.complete };
    const values = [...new Set(answer.rows.map(r => r.bindings[task.variable]).filter(Boolean))].sort();
    return { kind: 'select', status: values.length ? 'answered' : 'unknown', values, bindings: answer.rows, task, proofs, certificate, completeness: 'open-world', inferenceComplete: closure.complete };
  }
  if (task.kind === 'quantity') {
    const answer = quantityAnswer(state, task.owner, task.item, task.context);
    return { kind: 'quantity', status: answer.known ? 'answered' : 'unknown', ...answer, task, completeness: answer.known ? 'query-dependencies-resolved' : 'incomplete' };
  }
  if (task.kind === 'arithmetic') {
    try { return { kind: 'arithmetic', status: 'answered', value: expression(task.expression), task, method: 'exact-rational-arithmetic' }; }
    catch (error) { return { kind: 'arithmetic', status: 'unsupported', reason: error.message, task }; }
  }
  throw new Error(`No solver for task type: ${task.kind}`);
}

/** Instruction interpretation respects query position in a narrative, and produces one atomic candidate state. */
export function interpret(previous, document, { budget = new Budget() } = {}) {
  let state = copy(previous), pending = [], changed = false, closure = null;
  const answers = [];
  const flush = () => {
    if (!pending.length) return;
    state = applyDocument(state, { ...document, entries: pending }, { budget }); pending = []; changed = true; closure = null;
  };
  for (const entry of document.entries) {
    budget.tick();
    if (entry.kind === 'gap' && entry.intent === 'query') {
      flush(); answers.push({ kind: 'acknowledgement', status: 'unsupported', coverage: document.coverage, gaps: [entry], querySpan: entry.span }); continue;
    }
    if (entry.kind !== 'query') { pending.push(entry); continue; }
    flush(); closure ??= close(state, { budget });
    const result = solve(state, closure, entry.query, { budget });
    result.querySpan = entry.span; result.coverage = copy(document.coverage); result.gaps = copy(state.gaps);
    answers.push(result);
  }
  flush();
  // One committed input produces one revision, even when several queries observed intermediate states.
  state.revision = previous.revision + Number(changed);
  if (!answers.length) answers.push({ kind: 'acknowledgement', status: document.coverage.gaps ? 'unsupported' : 'acknowledged', facts: state.facts.length - previous.facts.length, rules: state.rules.length - previous.rules.length, events: state.events.length - previous.events.length, coverage: document.coverage, gaps: copy(state.gaps) });
  check(answers.length > 0, 'No interpreter result');
  return { state, answers, document, committedChanges: changed };
}
