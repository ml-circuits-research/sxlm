import { canonical, check, digest, Budget } from '../kernel/data.mjs';

export const isVariable = term => typeof term === 'string' && term.startsWith('?');
export const atomKey = atom => canonical({ context: atom.context ?? 'world', negative: Boolean(atom.negative), predicate: atom.predicate, terms: atom.terms });
const signature = atom => canonical([atom.context ?? 'world', Boolean(atom.negative), atom.predicate, atom.terms.length]);
export const negate = atom => ({ ...atom, negative: !atom.negative });
export function validateAtom(atom, { ground = false } = {}) {
  check(atom && typeof atom.predicate === 'string' && atom.predicate.length > 0 && atom.predicate.length < 100, 'Invalid predicate');
  check(Array.isArray(atom.terms) && atom.terms.length > 0 && atom.terms.length <= 8, 'Invalid atom arity');
  check(atom.terms.every(t => typeof t === 'string' && t.length > 0 && t.length <= 300 && (!ground || !isVariable(t))), 'Invalid atom term');
  check(atom.context === undefined || typeof atom.context === 'string', 'Invalid atom context');
  check(atom.negative === undefined || typeof atom.negative === 'boolean', 'Invalid atom polarity');
}
export function validateRule(rule) {
  check(rule && Array.isArray(rule.body) && rule.body.length > 0 && rule.body.length <= 16, 'Rules need 1–16 premises');
  rule.body.forEach(a => validateAtom(a)); validateAtom(rule.head);
  const bound = new Set(rule.body.flatMap(a => a.terms).filter(isVariable));
  check(rule.head.terms.filter(isVariable).every(v => bound.has(v)), 'Unsafe rule: conclusion contains an unbound variable');
  const contexts = new Set([...rule.body, rule.head].map(a => a.context ?? 'world'));
  check(contexts.size === 1, 'Cross-context inference requires an explicit trusted primitive');
}
function indexFacts(facts) {
  const index = new Map();
  for (const fact of facts) { const key = signature(fact.atom); if (!index.has(key)) index.set(key, []); index.get(key).push(fact); }
  return index;
}
function unify(pattern, atom, env) {
  const bound = { ...env };
  for (let i = 0; i < pattern.terms.length; i++) {
    const term = pattern.terms[i], value = atom.terms[i];
    if (isVariable(term)) { if (Object.hasOwn(bound, term) && bound[term] !== value) return null; bound[term] = value; }
    else if (term !== value) return null;
  }
  return bound;
}
export function join(patterns, facts, { budget = new Budget(), bindings = {}, index = indexFacts(facts) } = {}) {
  patterns.forEach(a => validateAtom(a));
  // Reorder conjunctions by selectivity without changing their logical scope.
  const ordered = [...patterns].sort((a, b) => (index.get(signature(a))?.length ?? 0) - (index.get(signature(b))?.length ?? 0));
  let rows = [{ bindings, premises: [] }];
  for (const pattern of ordered) {
    const next = [];
    for (const row of rows) for (const fact of index.get(signature(pattern)) ?? []) {
      budget.tick('matches');
      const env = unify(pattern, fact.atom, row.bindings);
      if (env) next.push({ bindings: env, premises: [...row.premises, fact.id] });
    }
    rows = next; if (!rows.length) break;
  }
  return rows;
}
export function close(state, { budget = new Budget() } = {}) {
  const records = new Map();
  for (const fact of state.facts) {
    validateAtom(fact.atom, { ground: true }); const key = atomKey(fact.atom);
    if (!records.has(key)) { budget.tick('facts'); records.set(key, { id: digest(key).slice(0, 24), atom: fact.atom, proof: { kind: 'asserted', evidence: fact.evidence } }); }
  }
  state.rules.forEach(validateRule);
  let delta = new Set([...records.values()].map(f => f.id)), rounds = 0;
  while (delta.size) {
    budget.tick(); rounds++;
    const snapshot = [...records.values()], index = indexFacts(snapshot), next = new Set();
    for (const rule of state.rules) {
      budget.tick();
      for (const row of join(rule.body, snapshot, { budget, index })) {
        if (!row.premises.some(id => delta.has(id))) continue;
        const atom = { ...rule.head, terms: rule.head.terms.map(t => row.bindings[t] ?? t) }, key = atomKey(atom);
        if (records.has(key)) continue;
        budget.tick('facts'); const id = digest(key).slice(0, 24);
        records.set(key, { id, atom, proof: { kind: 'rule', rule: rule.id, evidence: rule.evidence, premises: row.premises, bindings: row.bindings } }); next.add(id);
      }
    }
    delta = next;
  }
  return { facts: [...records.values()], complete: true, rounds };
}
export function query(closure, patterns, { budget = new Budget() } = {}) {
  const rows = join(patterns, closure.facts, { budget });
  // Absence is never explicit negation. Existential conjunctions are not negated by a negative instance.
  const ground = patterns.length === 1 && patterns[0].terms.every(t => !isVariable(t));
  const negative = ground ? join([negate(patterns[0])], closure.facts, { budget }) : [];
  return { truth: rows.length ? negative.length ? 'both' : 'true' : negative.length ? 'false' : 'unknown', rows, counterevidence: negative };
}
export function proofTree(closure, ids, depth = 12) {
  const byId = new Map(closure.facts.map(f => [f.id, f]));
  let exported = 0;
  const visit = (id, remaining, path) => {
    const fact = byId.get(id); if (!fact) return { id, missing: true };
    if (!remaining || path.has(id) || exported++ >= 200) return { id, atom: fact.atom, truncated: true };
    return { id, atom: fact.atom, ...fact.proof, premises: (fact.proof.premises ?? []).map(p => visit(p, remaining - 1, new Set([...path, id]))) };
  };
  return [...new Set(ids)].slice(0, 50).map(id => visit(id, depth, new Set()));
}
export function proofCertificate(closure, roots, { budget = new Budget() } = {}) {
  const index = new Map(closure.facts.map(f => [f.id, f])), records = new Map(), pending = [...new Set(roots)];
  while (pending.length) {
    budget.tick(); const id = pending.pop(); if (records.has(id)) continue;
    const record = index.get(id); check(record, 'Missing certificate premise'); records.set(id, record); pending.push(...(record.proof.premises ?? []));
  }
  return { schema: 'sxlm.proof.v1', roots: [...new Set(roots)], records: [...records.values()] };
}
