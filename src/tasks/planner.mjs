import { SymbolicModel } from '../model.mjs';
export { verifyPlan } from '../semantics/verify-plan.mjs';

// Convenience adapter. All search policy is supplied by the installed SOP pack.
export function plan(problem, options = {}) { return new SymbolicModel().plan(problem, options); }
