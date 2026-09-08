import test from 'node:test';
import assert from 'node:assert/strict';
import { SymbolicModel } from '../src/model.mjs';
import { readPack } from '../src/learning/packs.mjs';
import { compileGrammarKnowledge } from '../src/learning/grammar.mjs';
import { evaluate } from '../src/learning/evaluate.mjs';
import { relationalCases } from '../eval/relational-cases.mjs';

const base = new SymbolicModel(), pack = readPack(new URL('../packs/elementary-knowledge.sop', import.meta.url));
const model = new SymbolicModel({ packs: [...base.packs, pack] });

test('relational language composes user rules, relative restrictions, selection and declared order axioms', () => {
  const report = evaluate(model, relationalCases);
  assert.deepEqual(report.results.filter(row => !row.pass), []);
  assert.equal(model.resources.runtime.hash, base.resources.runtime.hash);
});

test('a supplied relation meaning transfers through the same construction without new native or sentence rules', () => {
  const origin = { kind: 'evaluator-authored-new-relation-meaning' };
  const language = compileGrammarKnowledge({ lexicon: [{ category: 'ELEMENTARY_RELATION_NOUN',
    surface: 'custodian', value: 'protects_resource' }], productions: [] }, { id: 'test.custodian', origin });
  const extension = { schema: 'sxlm.pack.v1', id: 'custodian-language', version: '1', provenance: origin,
    sop: language.sop, providers: language.providers };
  const trained = new SymbolicModel({ packs: [...model.packs, extension] });
  const text = 'Every pilot is a custodian of Archive. Kala is a pilot. Who is a custodian of Archive?';
  const answer = trained.ask(text);
  assert.deepEqual(answer.values, ['kala']); assert.equal(answer.verification.valid, true);
  assert.equal(answer.document.coverage.gaps, 0);
  assert.ok(answer.certificate.records.some(record => record.atom.predicate === 'protects_resource'));
  const wrong = trained.ask('Every pilot is a custodian of Archive. Kala is a pilot. Is Kala a custodian of Vault?');
  assert.equal(wrong.truth, 'unknown');
  const ablated = new SymbolicModel({ packs: [...model.packs, { ...extension, providers: {} }] });
  assert.ok(ablated.ask(text).document.coverage.gaps > 0);
  assert.equal(trained.resources.runtime.hash, model.resources.runtime.hash);
});

test('theory ablation removes relational chains but preserves direct observations and transactional limits', () => {
  const noTheory = new SymbolicModel({ packs: [...base.packs,
    { ...pack, providers: { ...pack.providers, 'theory-fragments': [] } }] });
  const text = 'Kira is a parent of Leno. Leno is a parent of Miri. Is Kira a grandparent of Miri?';
  assert.equal(noTheory.ask(text).truth, 'unknown');
  assert.equal(model.ask(text).truth, 'true');
  assert.equal(noTheory.ask('Kira is a mother of Leno. Is Kira a mother of Leno?').truth, 'true');
  const session = model.createSession();
  session.ask('Kira is a parent of Leno.');
  const before = session.snapshot();
  assert.equal(session.ask('Leno is a parent of Miri. Is Kira a grandparent of Miri?',
    { limits: { nodes: 50 } }).status, 'budget-exceeded');
  assert.deepEqual(session.snapshot(), before);
});
