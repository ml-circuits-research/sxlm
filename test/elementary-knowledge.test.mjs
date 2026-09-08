import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SymbolicModel } from '../src/model.mjs';
import { readPack, validatePack } from '../src/learning/packs.mjs';
import { decodeSOP } from '../src/kernel/sop-data.mjs';
import { digest, executionDigest } from '../src/kernel/data.mjs';
import { evaluateCase } from '../src/learning/evaluate.mjs';
import { buildElementary } from '../scripts/build-elementary.mjs';
import { compileKnowledge } from '../src/learning/knowledge.mjs';
import { elementaryCases, elementaryOpenQuestions } from '../eval/elementary-cases.mjs';

const base = new SymbolicModel();
const pack = readPack(new URL('../packs/elementary-knowledge.sop', import.meta.url));
const model = new SymbolicModel({ packs: [...base.packs, pack] });
const createSession = (target = model) => target.createSession();

test('elementary supervision reproduces exact SOP, remains optional, and has no native dependency changes', () => {
  const replay = buildElementary();
  assert.equal(executionDigest(replay.pack), executionDigest(pack));
  assert.equal(replay.receipt.packHash, validatePack(pack).hash);
  assert.equal(model.resources.runtime.hash, base.resources.runtime.hash);
  assert.equal(pack.sop.every(module => !module.learning), true);
  for (const field of ['facts', 'grammar', 'theory', 'corpus', 'circuits']) assert.equal(Object.hasOwn(pack, field), false);
  assert.equal(pack.entrypoints, undefined);
  assert.equal(base.ask('Is Earth a planet?').truth, 'unknown');
  assert.equal(model.ask('Is Earth a planet?').truth, 'true');
  assert.equal(createSession().ask('Is Earth a planet?').truth, 'true');
});

test('elementary language composes over categories, bindings, source facts and new user rules', () => {
  const adapter = { ask: (text, options) => createSession().ask(text, options) };
  const results = elementaryCases.map(item => evaluateCase(adapter, item));
  const failed = results.filter(result => !result.pass);
  assert.deepEqual(failed, [], failed.map(item => item.id + ': ' + item.failures.join(', ')).join('\n'));
});

test('source-backed chains have checked multi-step certificates and exact evidence spans', () => {
  const session = createSession();
  const answer = session.ask('Nori is a dolphin. Is Nori an animal?');
  assert.equal(answer.truth, 'true');
  assert.equal(answer.verification.valid, true);
  assert.ok(answer.verification.checkedNodes >= 4);
  const sources = new Map(answer.sources.map(source => [source.id, source]));
  const evidence = answer.certificate.records.map(record => sources.get(record.proof.evidence.source));
  const compiled = evidence.filter(source => source?.pack === pack.id);
  assert.ok(compiled.length >= 3);
  for (const source of compiled) {
    assert.equal(digest(source.text), source.id);
    const declaration = decodeSOP(source.text);
    assert.ok(declaration.teaching.citations.length > 0);
    assert.ok(declaration.teaching.citations.every(citation => citation.url.startsWith('https://')));
  }
  for (const record of answer.certificate.records) {
    const span = record.proof.evidence, source = sources.get(span.source);
    assert.ok(source.text.slice(span.start, span.end).length > 0);
  }
});

test('theory ablation removes a new structural inference and restoration recovers it', () => {
  const ablated = structuredClone(pack);
  ablated.providers['theory-fragments'] = [];
  const noTheory = new SymbolicModel({ packs: [...base.packs, ablated] });
  const text = 'Dori is a dolphin. Is Dori an animal?';
  assert.equal(createSession(noTheory).ask(text).truth, 'unknown');
  assert.equal(createSession().ask(text).truth, 'true');
  assert.equal(noTheory.resources.runtime.hash, model.resources.runtime.hash);
  assert.notEqual(noTheory.resources.hash, model.resources.hash);
});

test('cycle questions reuse a supplied branching graph without assuming a single or exhaustive answer', () => {
  const text = 'The supplied example graph has Amber followed by Azure and Jade. Azure is followed by Ochre.';
  const source = { id: digest(text), text, pack: 'test-sequence-graph' };
  const values = [['amber', 'azure'], ['amber', 'jade'], ['azure', 'ochre']].map(terms => ({
    atom: { predicate: 'next_in_cycle', terms, negative: false, context: 'world' },
    source, evidence: { source: source.id, start: 0, end: text.length }
  }));
  const origin = { kind: 'evaluator-authored-formal-graph' };
  const memory = compileKnowledge(values, { id: 'test.sequence-graph', origin });
  const graph = { schema: 'sxlm.pack.v1', id: 'test-sequence-graph', version: '1', provenance: origin,
    sop: memory.sop, providers: { 'fact-fragments': ['test.sequence-graph'] } };
  const extended = new SymbolicModel({ packs: [...model.packs, graph] });
  const forward = extended.ask('What comes after Amber?');
  assert.deepEqual(forward.values, ['azure', 'jade']);
  assert.equal(forward.verification.valid, true);
  assert.deepEqual(extended.ask('What comes before Jade?').values, ['amber']);
  assert.deepEqual(extended.ask('What comes after Ochre?').values, []);
  const ablated = { ...pack, providers: { ...pack.providers, 'theory-fragments': [] } };
  const noInverse = new SymbolicModel({ packs: [...base.packs, ablated, graph] });
  assert.deepEqual(noInverse.ask('What comes before Jade?').values, []);
});

test('new knowledge persists across model-bound turns and strict resource failure preserves state', () => {
  const session = createSession();
  session.ask('Nori is a dolphin.');
  const answer = session.ask('What is Nori?');
  assert.deepEqual(answer.values, ['animal', 'dolphin', 'mammal', 'vertebrate']);
  assert.equal(answer.verification.valid, true);
  const snapshot = session.snapshot();
  const limited = session.ask('Panel is a rectangle. Is Panel a polygon?', { limits: { nodes: 10 } });
  assert.equal(limited.status, 'budget-exceeded');
  assert.deepEqual(session.snapshot(), snapshot);
  assert.throws(() => base.createSession(snapshot), /different model/);
});

test('compiler rejects unsupported provenance and unsafe facts instead of manufacturing evidence', () => {
  const input = decodeSOP(readFileSync(new URL('../training/elementary-knowledge.sop', import.meta.url)));
  const missing = structuredClone(input);
  missing.facts[0].citations = ['missing'];
  assert.throws(() => buildElementary({ input: missing }), /Unresolved teaching citation/);
  const variable = structuredClone(input);
  variable.facts[0].atom.terms = ['?x'];
  assert.throws(() => buildElementary({ input: variable }), /Invalid atom term/);
  const unsafe = structuredClone(input);
  unsafe.rules[0].rule.head.terms = ['?unbound'];
  assert.throws(() => buildElementary({ input: unsafe }), /unbound/);
});

test('ordinary school conversation gaps remain exposed and are not counted as capability successes', () => {
  for (const item of elementaryOpenQuestions) {
    const result = createSession().ask(item.text);
    assert.ok(result.document?.coverage.gaps > 0 || result.status !== 'answered', item.id);
  }
});
