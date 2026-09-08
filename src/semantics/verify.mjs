import { canonical, digest } from '../kernel/data.mjs';
import { atomKey } from './logic.mjs';
import { substitute } from '../kernel/terms.mjs';

/** Independent witness replay validates formal inference, not the adequacy of the language interpretation. */
export function verifyProofs(proofs, state) {
  const sources = new Map(state.sources.map(s => [s.id, s])), rules = new Map(state.rules.map(r => [r.id, r]));
  let count = 0;
  function evidence(e) { const s = sources.get(e?.source); return s && digest(s.text) === s.id && Number.isInteger(e.start) && Number.isInteger(e.end) && e.start >= 0 && e.end <= s.text.length && e.end > e.start; }
  function visit(node) {
    count++;
    if (node.truncated || node.missing || !evidence(node.evidence)) return false;
    if (node.kind === 'asserted') return state.facts.some(f => atomKey(f.atom) === atomKey(node.atom) && canonical(f.evidence) === canonical(node.evidence));
    const rule = rules.get(node.rule);
    if (node.kind !== 'rule' || !rule || !node.premises.every(visit)) return false;
    if (atomKey(substitute(rule.head, node.bindings)) !== atomKey(node.atom)) return false;
    const available = new Set(node.premises.map(p => atomKey(p.atom)));
    return rule.body.every(a => available.has(atomKey(substitute(a, node.bindings)))) && canonical(rule.evidence) === canonical(node.evidence);
  }
  return { valid: proofs.every(visit), checkedNodes: count };
}
export function verifyCertificate(certificate, state, { budget } = {}) {
  const index = new Map(certificate.records.map(r => [r.id, r])), sources = new Map(state.sources.map(s => [s.id, s])), rules = new Map(state.rules.map(r => [r.id, r]));
  const verified = new Set(), pending = [...certificate.records]; let checked = 0;
  if (index.size !== certificate.records.length || certificate.roots.some(id => !index.has(id))) return { valid: false, checkedNodes: 0 };
  const evidence = e => { const s = sources.get(e?.source); return s && digest(s.text) === s.id && Number.isInteger(e.start) && Number.isInteger(e.end) && e.start >= 0 && e.end > e.start && e.end <= s.text.length; };
  while (pending.length) {
    const before = pending.length;
    for (let i = pending.length - 1; i >= 0; i--) {
      budget?.tick();
      const record = pending[i], proof = record.proof;
      if (!evidence(proof.evidence) || record.id !== digest(atomKey(record.atom)).slice(0, 24)) return { valid: false, checkedNodes: checked };
      if (proof.kind === 'asserted') {
        if (!state.facts.some(f => atomKey(f.atom) === atomKey(record.atom) && canonical(f.evidence) === canonical(proof.evidence))) return { valid: false, checkedNodes: checked };
      } else {
        const rule = rules.get(proof.rule);
        if (proof.kind !== 'rule' || !rule || !proof.premises.every(id => index.has(id))) return { valid: false, checkedNodes: checked };
        if (!proof.premises.every(id => verified.has(id))) continue;
        const premises = new Set(proof.premises.map(id => atomKey(index.get(id).atom)));
        if (atomKey(substitute(rule.head, proof.bindings)) !== atomKey(record.atom) || !rule.body.every(a => premises.has(atomKey(substitute(a, proof.bindings)))) || canonical(rule.evidence) !== canonical(proof.evidence)) return { valid: false, checkedNodes: checked };
      }
      checked++; verified.add(record.id); pending.splice(i, 1);
    }
    if (pending.length === before) return { valid: false, checkedNodes: checked };
  }
  return { valid: certificate.roots.every(id => verified.has(id)), checkedNodes: checked, format: 'dag-certificate' };
}
