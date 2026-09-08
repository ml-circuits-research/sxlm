import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { SymbolicModel, induceConstruction, encodeSOP } from '../src/index.mjs';
import { executionDigest } from '../src/kernel/data.mjs';
import { readPack } from '../src/learning/packs.mjs';
import { compileGrammarKnowledge } from '../src/learning/grammar.mjs';
import { inferStructuralProgram } from '../src/learning/structural-program.mjs';
import { buildConstructions } from '../scripts/build-constructions.mjs';
import { replayConstructions } from '../scripts/support/construction-replay.mjs';
import { evaluate } from '../src/learning/evaluate.mjs';
import { conformance, composition, challenges } from '../eval/cases.mjs';
import { constructionGates } from '../eval/construction-cases.mjs';

const base = new SymbolicModel(), pack = readPack(new URL('../packs/english-constructions.sop', import.meta.url));
const lexicon = compileGrammarKnowledge({ productions: [],
  lexicon: [{ category: 'PARTICIPLE', surface: 'followed', value: 'follow' }], classes: {} },
{ id: 'memory.eval-participle', origin: { kind: 'evaluator-supplied-lexeme' } });
const vocabulary = { schema: 'sxlm.pack.v1', id: 'eval-participle', version: '1.0.0',
  provenance: { kind: 'evaluator-supplied-lexeme' }, sop: lexicon.sop, providers: lexicon.providers };
const model = new SymbolicModel({ packs: [...base.packs, pack, vocabulary] });

test('typed spans induce a reusable SOP procedure with source-identical reconstruction', () => {
  assert.equal(executionDigest(buildConstructions()), executionDigest(pack));
  assert.equal(model.resources.runtime.hash, base.resources.runtime.hash);
  const action = pack.sop.find(module => module.id === 'learned-passive.compose');
  for (const forbidden of ['Mira', 'Theo', 'medic', 'pilot', 'owned', 'helped', 'data.template']) {
    assert.equal(action.source.includes(forbidden), false, forbidden);
  }
  assert.equal(action.learning.algorithm, 'typed-span-composition-v1');
  const parent = new SymbolicModel({ packs: [...base.packs, vocabulary] });
  const before = evaluate(parent, constructionGates), after = evaluate(model, constructionGates);
  for (const result of after.results) assert.equal(result.pass, true, `${result.id}: ${result.failures.join('; ')}`);
  assert.equal(before.passed, 0);
  const regression = evaluate(model, [...conformance, ...composition]);
  assert.equal(regression.failed, 0, regression.results.filter(result => !result.pass).map(result => result.id).join(', '));
  const open = evaluate(model, challenges);
  assert.equal(open.results.find(result => result.id === 'passive-voice').pass, true);
  const ablated = structuredClone(pack);
  ablated.providers['grammar-fragments'] = ablated.providers['grammar-fragments']
    .filter(id => id !== 'memory.learned-passive.grammar');
  const without = new SymbolicModel({ packs: [...base.packs, ablated, vocabulary] });
  const ablation = evaluate(without, constructionGates);
  assert.equal(ablation.passed, 0);
  const cold = evaluate(model, constructionGates.map(gate => ({ ...gate, options: { cache: false } })));
  assert.equal(cold.failed, 0);
  writeFileSync(new URL('../reports/construction-transfer.sop', import.meta.url), encodeSOP({
    schema: 'sxlm.construction-transfer.v1', generated: new Date().toISOString(),
    native: base.resources.runtime.hash, model: model.resources.hash, parent: base.resources.hash,
    candidate: executionDigest(pack), teachingExamples: pack.training.specification.examples.length,
    before, after, regression, challenges: open, ablation, cacheDisabled: cold,
    qualification: 'Development-visible, same-author gates outside the six teaching phrases. A supplied new participle tests semantic role transfer, not morphology induction. Vocabulary remains authored. These results do not establish general passive tense, quantifier scope or open-domain conversation.'
  }) + '\n');
});

test('the induced sequence composition preserves arbitrary nested constraints and binding identity', () => {
  const constraints = Array.from({ length: 17 }, (_, index) => ({ predicate: 'relation' + index,
    terms: ['_:fresh-agent', 'node' + index], negative: index % 2 === 0, context: 'context' + index }));
  for (const count of [0, 1, 17]) {
    const carried = constraints.slice(0, count);
    const input = { children: ['new-relation', 'by', { term: '_:fresh-agent', constraints: carried }], scope: 'new-scope' };
    const result = model.runtime.execute('learned-passive.compose', input, { cache: false });
    assert.deepEqual(result, [...carried, { predicate: 'new-relation', terms: ['_:fresh-agent', '?subject'],
      negative: false, context: 'world' }]);
    assert.equal(input.children[2].constraints.length, count);
  }
});

test('construction derivation credit requires exact teaching, program and provider replay', () => {
  const good = replayConstructions(model);
  assert.equal(good.receipts[0].reproduced, true);
  assert.deepEqual(good.circuits.map(module => module.id), ['learned-passive.compose']);
  for (const modify of [
    changed => { delete changed.training; },
    changed => { changed.training.specification.examples[0].meaning[0].predicate = 'forged'; },
    changed => { changed.providers['grammar-fragments'].pop(); },
    changed => { changed.sop.find(module => module.id === 'learned-passive.compose').source += '\n'; },
  ]) {
    const changed = structuredClone(pack); modify(changed);
    const active = new SymbolicModel({ packs: [...base.packs, changed] });
    assert.equal(replayConstructions(active).circuits.length, 0);
  }
});

test('span teaching rejects invalid boundaries, unresolved ambiguity and unexplained semantics', () => {
  const training = structuredClone(pack.training.specification), vocabulary = pack.training.vocabulary;
  const grammar = compileGrammarKnowledge(vocabulary.grammar, { id: 'memory.test-vocabulary', origin: { kind: 'test' } });
  const parent = new SymbolicModel({ packs: [...base.packs, { schema: 'sxlm.pack.v1', id: 'test-vocabulary',
    version: '1.0.0', provenance: { kind: 'test' }, sop: [...vocabulary.sop, ...grammar.sop], providers: grammar.providers }] });
  const bad = structuredClone(training); bad.examples[0].spans.agent.start++;
  assert.throws(() => induceConstruction(parent, bad), /token-aligned/);
  const delimiters = structuredClone(training); delimiters.examples[0].text = delimiters.examples[0].text.replace('by', 'to');
  assert.throws(() => induceConstruction(parent, delimiters), /delimiters/);
  const missing = structuredClone(training); missing.examples[0].meaning[0].predicate = 'unexplained';
  assert.throws(() => induceConstruction(parent, missing), /cannot be expressed/);
  assert.throws(() => inferStructuralProgram([{ name: 'item', index: 0,
    values: [{ first: 'a', second: 'a' }, { first: 'b', second: 'b' }] }], ['a', 'b']), /Ambiguous/);
});

test('new span induction treats expression-shaped annotations as inert data', () => {
  const training = structuredClone(pack.training.specification), vocabulary = pack.training.vocabulary;
  const grammar = compileGrammarKnowledge(vocabulary.grammar, { id: 'memory.annotation-vocabulary', origin: { kind: 'test' } });
  const parent = new SymbolicModel({ packs: [...base.packs, { schema: 'sxlm.pack.v1', id: 'annotation-vocabulary',
    version: '1.0.0', provenance: { kind: 'test' }, sop: [...vocabulary.sop, ...grammar.sop], providers: grammar.providers }] });
  for (const example of training.examples) example.meaning.at(-1).annotation = { $get: ['not executable'], ref: '$children' };
  const learned = induceConstruction(parent, training), active = new SymbolicModel({ packs: [...parent.packs, learned] });
  const parsed = active.grammar.parse('owned by Juniper', { start: 'Comp' });
  assert.equal(parsed.status, 'parsed');
  assert.deepEqual(parsed.alternatives[0].at(-1).annotation, { $get: ['not executable'], ref: '$children' });
});
