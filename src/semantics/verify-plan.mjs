import { atomKey, validateAtom } from './logic.mjs';
import { assertData, check, Budget, LimitError } from '../kernel/data.mjs';

/** Replay a finite signed transition witness. No search or action selection. */
export function verifyPlan(problem, candidate, { budget = new Budget() } = {}) {
  try {
    assertData(problem); assertData(candidate);
    check(candidate.status === 'solved' && Array.isArray(candidate.steps) && candidate.steps.every(id => typeof id === 'string') && Number.isFinite(candidate.cost) && candidate.cost >= 0, 'Invalid plan witness');
    const keys = atoms => {
      check(Array.isArray(atoms), 'Expected ground atoms');
      return atoms.map(atom => { budget.tick(); validateAtom(atom, { ground: true }); return atomKey(atom); });
    };
    const state = new Set(keys(problem.initial)), goals = keys(problem.goals), actions = new Map();
    check(Array.isArray(problem.actions), 'Expected action declarations');
    for (const action of problem.actions) {
      budget.tick(); const cost = action.cost ?? 1;
      check(typeof action.id === 'string' && !actions.has(action.id) && Number.isFinite(cost) && cost >= 0, 'Invalid or duplicate action');
      actions.set(action.id, { requires: keys(action.requires), add: keys(action.add), remove: keys(action.remove), cost });
    }
    let cost = 0;
    for (const id of candidate.steps) {
      budget.tick(); const action = actions.get(id);
      if (!action || !action.requires.every(key => state.has(key))) return { valid: false, reason: `Inapplicable action: ${id}` };
      action.remove.forEach(key => { budget.tick(); state.delete(key); });
      action.add.forEach(key => { budget.tick(); state.add(key); });
      cost += action.cost; check(Number.isFinite(cost), 'Non-finite path cost');
    }
    return { valid: goals.every(key => state.has(key)) && cost === candidate.cost, cost };
  } catch (error) {
    if (error instanceof LimitError) throw error;
    return { valid: false, reason: error.message };
  }
}
