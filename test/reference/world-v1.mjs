import { encodeSOP, decodeSOP } from '../../src/kernel/sop-data.mjs';
// Archived migration oracle; never imported by the runtime.
import { copy, digest, check, Budget } from '../../src/kernel/data.mjs';
import { validateAtom, validateRule, atomKey } from '../../src/semantics/logic.mjs';
import { calculate, rational, format } from '../../src/kernel/rational.mjs';

export const emptyWorld = () => ({ schema: 'sxlm.world.v1', revision: 0, sources: [], facts: [], rules: [], quantities: {}, events: [], gaps: [], labels: {} });
export const quantityKey = (owner, item, context = 'world') => encodeSOP([context, owner, item]);

/** Pure application: the caller commits the entire new snapshot only after all stages succeed. */
export function applyDocument(previous, document, { budget = new Budget() } = {}) {
  check(previous.schema === 'sxlm.world.v1' && document.schema === 'sxlm.document.v1', 'Invalid world/document schema');
  const state = copy(previous), knownFacts = new Set(state.facts.map(f => atomKey(f.atom))), knownRules = new Set(state.rules.map(r => r.id));
  if (!state.sources.some(s => s.id === document.source.id)) state.sources.push(copy(document.source));
  Object.assign(state.labels, document.labels);
  for (const entry of document.entries) {
    budget.tick();
    const evidence = { source: document.source.id, start: entry.span.start, end: entry.span.end };
    check(evidence.start >= 0 && evidence.end <= document.source.text.length && evidence.start < evidence.end, 'Invalid evidence span');
    if (entry.kind === 'fact') {
      validateAtom(entry.atom, { ground: true }); const key = atomKey(entry.atom);
      if (!knownFacts.has(key)) { state.facts.push({ atom: copy(entry.atom), evidence }); knownFacts.add(key); }
    } else if (entry.kind === 'rule') {
      validateRule(entry.rule); const id = digest({ body: entry.rule.body, head: entry.rule.head }).slice(0, 24);
      if (!knownRules.has(id)) { state.rules.push({ ...copy(entry.rule), id, evidence }); knownRules.add(id); }
    } else if (entry.kind === 'quantity') {
      const event = { ...copy(entry.event), evidence }, context = event.context ?? 'world';
      check(['set', 'add', 'subtract', 'transfer'].includes(event.operation), 'Invalid quantity event');
      const amount = format(rational(event.amount)); check(rational(amount)[0] >= 0n, 'Quantity events need nonnegative amounts');
      const key = quantityKey(event.owner, event.item, context);
      const old = state.quantities[key] ?? { value: null, delta: '0', evidence: [], tainted: [] };
      const update = (record, op) => ({
        value: record.value === null ? null : calculate(record.value, op, amount),
        delta: calculate(record.delta, op, amount), evidence: [...record.evidence, evidence], tainted: [...record.tainted],
      });
      if (event.operation === 'set') state.quantities[key] = { value: amount, delta: '0', evidence: [evidence], tainted: [] };
      else state.quantities[key] = update(old, event.operation === 'add' ? '+' : '-');
      if (event.operation === 'transfer') {
        check(event.recipient && event.recipient !== event.owner, 'Transfer requires a distinct recipient');
        const other = quantityKey(event.recipient, event.item, context);
        state.quantities[other] = update(state.quantities[other] ?? { value: null, delta: '0', evidence: [], tainted: [] }, '+');
      }
      if (state.quantities[key].value !== null && rational(state.quantities[key].value)[0] < 0n) {
        const inconsistency = { ...evidence, reason: 'negative-inventory' };
        state.quantities[key].tainted.push(inconsistency);
        if (event.operation === 'transfer' && old.tainted.length === 0) state.quantities[quantityKey(event.recipient, event.item, context)].tainted.push(inconsistency);
      }
      state.events.push(event);
    } else if (entry.kind === 'gap') {
      const gap = { text: entry.text, reason: entry.reason, evidence, affected: entry.affected ?? [] }; state.gaps.push(gap);
      // Unknown statements about an owner may change its state. Never return a stale exact inventory.
      for (const [key, record] of Object.entries(state.quantities)) {
        const [, owner] = decodeSOP(key);
        if (gap.affected.includes(owner)) record.tainted.push(gap);
      }
    } else check(entry.kind === 'query', `Unknown document entry: ${entry.kind}`);
  }
  state.revision++;
  return state;
}
export function quantityAnswer(state, owner, item, context = 'world') {
  const record = state.quantities[quantityKey(owner, item, context)];
  if (!record || record.value === null) return { known: false, reason: 'missing-initial-value', delta: record?.delta ?? '0', evidence: record?.evidence ?? [] };
  if (record.tainted.length) return { known: false, reason: 'uninterpreted-or-inconsistent-event', lastKnownValue: record.value, gaps: record.tainted, evidence: record.evidence };
  return { known: true, value: record.value, evidence: record.evidence };
}
