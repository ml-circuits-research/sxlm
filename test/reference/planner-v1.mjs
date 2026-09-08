import { atomKey, validateAtom } from '../../src/semantics/logic.mjs';
import { check, Budget } from '../../src/kernel/data.mjs';

/** Finite grounded state planning with explicit preconditions, effects and independently replayable witness. */
export function plan(problem, { budget = new Budget() } = {}) {
  check(Array.isArray(problem.initial) && Array.isArray(problem.goals) && Array.isArray(problem.actions), 'Invalid planning problem');
  [...problem.initial, ...problem.goals].forEach(a => validateAtom(a, { ground: true }));
  check(problem.actions.length <= 1000, 'Too many actions');
  for (const action of problem.actions) {
    check(typeof action.id === 'string' && Number.isFinite(action.cost ?? 1) && (action.cost ?? 1) >= 0, 'Invalid action');
    for (const group of ['requires', 'add', 'remove']) { check(Array.isArray(action[group]), `Action needs ${group}`); action[group].forEach(a => validateAtom(a, { ground: true })); }
  }
  check(new Set(problem.actions.map(a => a.id)).size === problem.actions.length, 'Duplicate action ID');
  const key = state => [...state].sort().join('\n');
  const agenda = [{ state: new Set(problem.initial.map(atomKey)), cost: 0, steps: [] }], best = new Map();
  while (agenda.length) {
    budget.tick(); agenda.sort((a, b) => a.cost - b.cost || a.steps.length - b.steps.length);
    const node = agenda.shift(), hash = key(node.state);
    if ((best.get(hash) ?? Infinity) <= node.cost) continue; best.set(hash, node.cost);
    if (problem.goals.every(a => node.state.has(atomKey(a)))) return { status: 'solved', steps: node.steps, cost: node.cost, explored: best.size, assumptions: ['The supplied finite action model is complete for this plan.'] };
    for (const action of problem.actions) {
      budget.tick(); if (!action.requires.every(a => node.state.has(atomKey(a)))) continue;
      const state = new Set(node.state); action.remove.forEach(a => state.delete(atomKey(a))); action.add.forEach(a => state.add(atomKey(a)));
      agenda.push({ state, cost: node.cost + (action.cost ?? 1), steps: [...node.steps, action.id] });
    }
  }
  return { status: 'unreachable-in-model', steps: [], explored: best.size, assumptions: ['Only the supplied actions were searched.'] };
}
export function verifyPlan(problem, candidate) {
  const state = new Set(problem.initial.map(atomKey)); let cost = 0;
  for (const id of candidate.steps) {
    const action = problem.actions.find(a => a.id === id);
    if (!action || !action.requires.every(a => state.has(atomKey(a)))) return { valid: false, reason: `Inapplicable action: ${id}` };
    action.remove.forEach(a => state.delete(atomKey(a))); action.add.forEach(a => state.add(atomKey(a))); cost += action.cost ?? 1;
  }
  return { valid: problem.goals.every(a => state.has(atomKey(a))) && cost === candidate.cost, cost };
}
