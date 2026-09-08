import { close, query, validateAtom, validateRule, atomKey, proofTree, proofCertificate } from './logic.mjs';
import { expression } from '../kernel/rational.mjs';

/** Formal relations and arithmetic only; no document, task or state-update dispatch. */
export function installFormalPrimitives(runtime) {
  runtime.primitive('relation.validateAtom', { inputs: { atom: 'object', ground: 'boolean' }, output: 'object', run: ({ atom, ground }) => { validateAtom(atom, { ground }); return atom; } });
  runtime.primitive('kernel.relation.validateRule', { inputs: { rule: 'object' }, output: 'object', run: ({ rule }) => { validateRule(rule); return rule; } });
  runtime.primitive('relation.key', { inputs: { atom: 'object' }, output: 'string', run: ({ atom }) => atomKey(atom) });
  runtime.primitive('relation.close', { inputs: { state: 'object' }, output: 'object', run: ({ state }, { budget }) => close(state, { budget }) });
  runtime.primitive('relation.query', { inputs: { closure: 'object', patterns: 'array' }, output: 'object', run: ({ closure, patterns }, { budget }) => query(closure, patterns, { budget }) });
  runtime.primitive('relation.tree', { inputs: { closure: 'object', roots: 'array', depth: 'number' }, output: 'array', run: ({ closure, roots, depth }) => proofTree(closure, roots, depth) });
  runtime.primitive('relation.certificate', { inputs: { closure: 'object', roots: 'array' }, output: 'object', run: ({ closure, roots }, { budget }) => proofCertificate(closure, roots, { budget }) });
  runtime.primitive('math.expression', { inputs: { text: 'string' }, output: 'object', run: ({ text }) => { try { return { ok: true, value: expression(text) }; } catch (error) { return { ok: false, error: error.message }; } } });
  return runtime;
}
