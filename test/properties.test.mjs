import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { SymbolicModel, encodeSOP, induceConstruction } from '../src/index.mjs';
import { readPack } from '../src/learning/packs.mjs';
import { compileConceptProperties } from '../src/learning/properties.mjs';
import { buildEveryday, everydayBase } from '../scripts/build-everyday.mjs';
import { replayConstructions } from '../scripts/support/construction-replay.mjs';
import { propertyDomain } from './support/property-domain.mjs';
import { propertyGates } from '../eval/property-cases.mjs';
import { evaluate } from '../src/learning/evaluate.mjs';
import { conformance, composition } from '../eval/cases.mjs';
import { digest, executionDigest } from '../src/kernel/data.mjs';

const base = everydayBase(), pack = readPack(new URL('../packs/everyday-knowledge.sop', import.meta.url));
const domain = propertyDomain(base);
const parent = new SymbolicModel({ packs: [...base.packs, domain] });
const model = new SymbolicModel({ packs: [...base.packs, pack, domain] });

test('qualified property constructions transfer to new relations, inheritance and restricted instances', () => {
  const before = evaluate(parent, propertyGates), after = evaluate(model, propertyGates);
  for (const result of after.results) assert.equal(result.pass, true, result.id + ': ' + result.failures.join('; '));
  assert.ok(after.passed > before.passed);
  const regression = evaluate(model, [...conformance, ...composition]);
  assert.equal(regression.failed, 0, regression.results.filter(item => !item.pass).map(item => item.id).join(', '));
  const ablated = structuredClone(pack);
  ablated.providers['grammar-fragments'] = ablated.providers['grammar-fragments']
    .filter(id => !id.startsWith('memory.learned-'));
  const without = new SymbolicModel({ packs: [...base.packs, ablated, domain] });
  const ablation = evaluate(without, propertyGates);
  assert.ok(ablation.passed < after.passed);
  const cold = evaluate(model, propertyGates.map(gate => ({ ...gate, options: { cache: false } })));
  assert.equal(cold.failed, 0, cold.results.filter(item => !item.pass).map(item => item.id).join(', '));
  assert.equal(base.resources.runtime.hash, model.resources.runtime.hash);
  writeFileSync(new URL('../reports/property-transfer.sop', import.meta.url), encodeSOP({
    schema: 'sxlm.property-transfer.v1', generated: new Date().toISOString(), native: model.resources.runtime.hash,
    model: model.resources.hash, candidate: executionDigest(pack), before, after, regression, ablation, cacheDisabled: cold,
    qualification: 'Same-author, development-visible probes with a separately supplied fictional ontology and new relation. Two question procedures are induced from annotated examples; knowledge, lexical meanings and reference policies are authored. No broad language competence or autonomous ontology discovery is established.'
  }) + '\n');
});

test('source properties distinguish definitions, universal inheritance, typicality and explicit negation', () => {
  const text = 'Fictional calibration: a unit has a nominal label; its members need water, typically need shade, and do not need shelter.';
  const source = { id: digest(text), text }, evidence = { source: source.id, start: 0, end: text.length };
  const properties = [
    { relation: 'label', values: ['nominal'], mode: 'definition', negative: false },
    { relation: 'need', values: ['water'], mode: 'all-instances', negative: false },
    { relation: 'need', values: ['shade'], mode: 'typical', negative: false },
    { relation: 'need', values: ['shelter'], mode: 'all-instances', negative: true }
  ].map(item => ({ ...item, concept: 'unit', source, evidence }));
  const compiled = compileConceptProperties({ properties }, { id: 'memory.test-properties', origin: { kind: 'test' } });
  const active = new SymbolicModel({ packs: [...base.packs, pack, { schema: 'sxlm.pack.v1', id: 'test-properties',
    version: '1', provenance: { kind: 'test' }, sop: compiled.sop, providers: compiled.providers }] });
  const state = active.initialState();
  const facts = state.facts.filter(fact => fact.evidence?.source === source.id);
  assert.equal(facts.length, 4);
  assert.equal(facts.some(fact => fact.atom?.predicate === 'unit'), false);
  const rules = state.rules.filter(rule => rule.teaching?.source?.id === source.id);
  assert.equal(rules.some(rule => rule.head.predicate === 'label' || rule.head.predicate === 'typical_property'), false);
  assert.equal(rules.some(rule => rule.head.predicate === 'need' && rule.head.terms.includes('shade')), false);
  assert.ok(rules.some(rule => rule.head.predicate === 'need' && rule.head.negative));
  for (const [word, expected] of [['water', 'true'], ['shelter', 'false']]) {
    const answer = active.ask(`Tarin is a unit. Does Tarin need ${word}?`);
    assert.equal(answer.truth, expected);
    assert.equal(answer.verification.valid, true);
  }
  for (const rule of rules.filter(rule => rule.head.predicate === 'property' && rule.head.terms[0] === 'concept')) {
    assert.ok(rule.body.some(atom => atom.predicate === 'category_kind'));
  }
  assert.ok(rules.some(rule => rule.head.predicate === 'category_kind' &&
    rule.body.some(atom => atom.predicate === 'declared_category')));
  for (const mutate of [
    item => { item.source.id = 'forged'; }, item => { item.evidence.end = text.length + 1; },
    item => { item.mode = 'assumed'; }, item => { item.context = 'belief'; },
    item => { item.values = ['?unbound']; }, item => { delete item.negative; }
  ]) {
    const bad = structuredClone(properties[0]); mutate(bad);
    assert.throws(() => compileConceptProperties({ properties: [bad] }, { id: 'memory.bad', origin: {} }));
  }
});

test('property teaching replays exactly and syntax-only slots cannot acquire semantic credit', () => {
  assert.equal(executionDigest(buildEveryday()), executionDigest(pack));
  const replay = replayConstructions(model);
  const receipt = replay.receipts.find(item => item.pack === pack.id);
  assert.equal(receipt.reproduced, true);
  assert.deepEqual(receipt.inducedModules, ['learned-property-question.compose', 'learned-category-property-question.compose']);
  const teaching = structuredClone(pack.training.language.constructions[0]);
  for (const slot of teaching.slots) slot.semantic = false;
  assert.throws(() => induceConstruction(model, teaching), /at least one semantic slot/);
  teaching.slots[1].semantic = 'yes';
  assert.throws(() => induceConstruction(model, teaching), /must be boolean/);
  const changed = structuredClone(pack);
  changed.sop.find(module => module.id === 'learned-property-question.compose').source += '\n';
  const tampered = new SymbolicModel({ packs: [...base.packs, changed] });
  assert.equal(replayConstructions(tampered).receipts.find(item => item.pack === pack.id).reproduced, false);
});
