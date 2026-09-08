import { memoryModules } from './memory.mjs';
import { assertData, check, digest } from '../kernel/data.mjs';
import { validateRule } from '../semantics/logic.mjs';

/** Offline preservation of supplied knowledge. Compilation is not induction. */
export function compileKnowledge(value, { id, origin, kind = 'compiled-knowledge-proposal' }) {
  assertData(value);
  check(typeof id === 'string' && /^[a-z0-9][a-z0-9._-]*$/.test(id), 'Invalid knowledge module identity');
  check(origin && typeof origin.kind === 'string', 'Knowledge requires source provenance');
  const knowledgeHash = digest(value);
  const provenance = { kind, knowledgeHash, origin, qualification: 'Constructor compilation preserves supplied knowledge; its learning must be established separately.' };
  const sop = memoryModules(id, value, { kind: 'compiler-input', knowledgeHash }).map(({ learning, ...module }) => ({ ...module, provenance }));
  return { sop, knowledgeHash };
}

export function compileTheoryKnowledge(rules, { id, origin, sourceName = id }) {
  check(Array.isArray(rules), 'Theory requires a rule sequence');
  check(typeof sourceName === 'string' && sourceName.length > 0, 'Theory requires a source name');
  for (const rule of rules) validateRule(rule);
  const result = compileKnowledge(rules.map(rule => ({ rule, pack: sourceName })), { id, origin, kind: 'compiled-theory-proposal' });
  return { ...result, providers: { 'theory-fragments': [id] } };
}
