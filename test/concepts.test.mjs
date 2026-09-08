import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { SymbolicModel } from '../src/model.mjs';
import { readPack } from '../src/learning/packs.mjs';
import { compileConceptKnowledge } from '../src/learning/concepts.mjs';
import { digest, canonical } from '../src/kernel/data.mjs';
import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';

const base = new SymbolicModel();
const elementary = new SymbolicModel({ packs: [...base.packs,
  readPack(new URL('../packs/elementary-knowledge.sop', import.meta.url))] });
const text = 'In this fictional classification, every amber glider is an aerial device. ' +
  'Every aerial device is a mechanism. No amber glider is a ground device.';
const source = { id: digest(text), text };
const evidence = { source: source.id, start: 0, end: text.length };
const specification = { concepts: [
  { id: 'amber_glider', singular: 'amber glider', plural: 'amber gliders' },
  { id: 'aerial_device', singular: 'aerial device', plural: 'aerial devices' },
  { id: 'mechanism', singular: 'mechanism', plural: 'mechanisms' },
  { id: 'ground_device', singular: 'ground device', plural: 'ground devices' }
], inclusions: [
  { subtype: 'amber_glider', supertype: 'aerial_device', negative: false, source, evidence },
  { subtype: 'aerial_device', supertype: 'mechanism', negative: false, source, evidence },
  { subtype: 'amber_glider', supertype: 'ground_device', negative: true, source, evidence }
] };
const compiled = compileConceptKnowledge(specification, { id: 'test.concepts',
  origin: { kind: 'evaluator-authored-fictional-taxonomy' }, tokenize: text => elementary.grammar.tokenize(text) });
const pack = { schema: 'sxlm.pack.v1', id: 'concept-transfer', version: '1',
  provenance: { kind: 'compiled-source-supervision' }, sop: compiled.sop, providers: compiled.providers };
const model = new SymbolicModel({ packs: [...elementary.packs, pack] });

test('one taught concept graph transfers across definition, plural, composition and instances', () => {
  const cases = [
    ['What is an amber glider?', { values: ['aerial_device', 'mechanism'] }],
    ['What are amber gliders?', { values: ['aerial_device', 'mechanism'] }],
    ['Tell me about amber gliders.', { values: ['aerial_device', 'mechanism'] }],
    ['Is an amber glider a mechanism?', { truth: 'true' }],
    ['Are amber gliders aerial devices and mechanisms?', { truth: 'true' }],
    ['Why is an amber glider a mechanism?', { truth: 'true' }],
    ['Rowan is an amber glider. Is Rowan a mechanism?', { truth: 'true' }],
    ['Rowan is an amber glider. What is Rowan?', { values: ['aerial_device', 'amber_glider', 'mechanism'] }],
    ['Every mechanism who owns a bird is careful. Rowan is an amber glider. Rowan owns a bird. Is Rowan careful?', { truth: 'true' }],
    ['Are amber gliders ground devices?', { truth: 'false' }],
    ['Rowan is an amber glider. Is Rowan a ground device?', { truth: 'false' }],
    ['Is a mechanism an amber glider?', { truth: 'unknown' }],
    ['Is some amber glider a mechanism?', { truth: 'unknown' }],
    ['Rowan is an amber glider. Is some amber glider a mechanism?', { truth: 'true' }],
    ['Mira believes that Rowan is an amber glider. Is Rowan a mechanism?', { truth: 'unknown' }],
    ['Rowan is a ground device. Is Rowan an amber glider?', { truth: 'unknown' }]
  ];
  const results = cases.map(([input, expect]) => {
    const answer = model.ask(input);
    return { input, expect, status: answer.status, truth: answer.truth ?? null,
      values: answer.values ?? null, text: answer.text, coverage: answer.coverage,
      verification: answer.verification ?? null, milliseconds: answer.metrics.milliseconds,
      pass: Object.entries(expect).every(([key, value]) =>
        canonical(answer[key] ?? null) === canonical(value)) && answer.coverage?.gaps === 0 };
  });
  writeFileSync(new URL('../reports/concept-transfer.sop', import.meta.url), encodeSOP({
    schema: 'sxlm.concept-transfer.v1', model: model.resources.hash, parent: elementary.resources.hash,
    native: model.resources.runtime.hash, sourceHash: digest(specification),
    total: results.length, passed: results.filter(item => item.pass).length, results,
    qualification: 'Same-author, development-visible structural transfer of authored concept semantics and compiled source knowledge. Neither blind evaluation nor autonomous concept induction.'
  }));
  assert.deepEqual(results.filter(item => !item.pass), []);
  assert.equal(model.resources.runtime.hash, base.resources.runtime.hash);
});

test('removing the taught knowledge removes competence and restores it without native changes', () => {
  const input = 'Is an amber glider a mechanism?';
  assert.notEqual(elementary.ask(input).truth, 'true');
  const ablated = { ...pack, providers: { ...pack.providers, 'fact-fragments': [], 'theory-fragments': [] } };
  const absent = new SymbolicModel({ packs: [...elementary.packs, ablated] });
  assert.equal(absent.ask(input).truth, 'unknown');
  assert.equal(model.ask(input).truth, 'true');
  assert.equal(model.ask(input, { cache: false }).truth, 'true');
  assert.ok(pack.sop.every(module => !module.learning));
});

test('concept supervision rejects invalid spans, undeclared categories and hidden context loss', () => {
  const compile = input => compileConceptKnowledge(input, { id: 'test.invalid',
    origin: { kind: 'test' }, tokenize: text => elementary.grammar.tokenize(text) });
  const bad = structuredClone(specification); bad.inclusions[0].evidence.end = text.length + 1;
  assert.throws(() => compile(bad), /span/);
  const unknown = structuredClone(specification); unknown.inclusions[0].supertype = 'missing';
  assert.throws(() => compile(unknown), /undeclared/);
  const attributed = structuredClone(specification); attributed.inclusions[0].context = 'belief:mira';
  assert.throws(() => compile(attributed), /contextual/);
});

test('ordinary category dialogue is coherent without inventing an instance or biological explanation', () => {
  for (const input of ['What is a cat?', 'What are cats?', 'Tell me about cats.']) {
    const answer = elementary.ask(input);
    assert.deepEqual(answer.values, ['animal', 'mammal', 'vertebrate']);
    assert.equal(answer.verification.valid, true);
    assert.match(answer.text, /Cats are mammals/);
    assert.doesNotMatch(answer.text, /fur|pet|whisker|exhaustive/);
  }
  assert.equal(elementary.ask('Is a cat an animal?').truth, 'true');
  assert.equal(elementary.ask('Is some cat an animal?').truth, 'unknown');
  const result = elementary.ask('Are cats careful?');
  assert.equal(result.status, 'unsupported');
  const input = decodeSOP(readFileSync(new URL('../training/elementary-knowledge.sop', import.meta.url)));
  assert.ok(input.concepts.every(item => typeof item.plural === 'string'));
});
