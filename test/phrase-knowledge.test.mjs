import test from 'node:test';
import assert from 'node:assert/strict';
import { SymbolicModel } from '../src/model.mjs';
import { Budget, executionDigest } from '../src/kernel/data.mjs';
import { compilePhraseKnowledge } from '../src/learning/phrases.mjs';
import { compileGrammarKnowledge } from '../src/learning/grammar.mjs';
import { memoryModules } from '../src/learning/memory.mjs';

const base = new SymbolicModel(), origin = { kind: 'test-authored-lexical-observations' };
const build = entries => compilePhraseKnowledge(entries, { id: 'test.phrases', origin,
  tokenize: text => base.grammar.tokenize(text) });
const install = fragment => new SymbolicModel({ packs: [...base.packs, {
  schema: 'sxlm.pack.v1', id: 'phrase-test', version: '1', provenance: origin,
  sop: fragment.sop, providers: fragment.providers
}] });
const meanings = answer => answer.alternatives.map(executionDigest).sort();
const parse = (model, text, options = {}) => model.grammar.parse(text, { start: 'Catalog', ...options });

test('phrase compilation preserves exact values, prefixes and ambiguity under the parent lexical policy', () => {
  const entries = [
    { category: 'Catalog', surface: 'Amber', value: { name: 'short' } },
    { category: 'Catalog', surface: 'Amber station', value: { name: 'station' } },
    { category: 'Catalog', surface: 'Amber station east', value: { name: 'east' } },
    { category: 'Catalog', surface: 'Amber station east', value: { name: 'other' } },
    { category: 'Catalog', surface: 'Amber station east', value: { name: 'east' } },
    { category: 'Catalog', surface: 'Quartz control', value: { count: -0, nested: [null, true] } },
    { category: 'Catalog', surface: 'Quartz control', value: { count: 0, nested: [null, true] } },
    { category: 'Catalog', surface: 'Ω panel', value: { a: 1, b: 2 } },
    { category: 'Catalog', surface: 'Ω panel', value: { b: 2, a: 1 } },
    { category: 'Catalog', surface: 'sensor ( Mk-2 )', value: 'device' },
    { category: 'Catalog', surface: '__proto__', value: false }
  ];
  const compiled = build(entries), model = install(compiled);
  assert.equal(compiled.receipt.observations, entries.length - 1);
  assert.deepEqual(compiled, build(entries));
  const tokens = text => base.grammar.tokenize(text).map(token => token.value);
  for (const text of [...entries.map(entry => entry.surface), 'AMBER STATION', 'ω panel',
    'Amber station west', 'station', 'sensor ( Mk-2 ) extra', '']) {
    const expected = [...new Set(entries.filter(entry =>
      executionDigest(tokens(entry.surface)) === executionDigest(tokens(text)))
      .map(entry => executionDigest(entry.value)))].sort();
    for (const cache of [true, false]) assert.deepEqual(meanings(parse(model, text, { cache })), expected, text);
  }
  const ablated = install({ ...compiled, providers: {} });
  assert.equal(parse(ablated, 'Amber station').status, 'unparsed');
  assert.equal(model.resources.runtime.hash, base.resources.runtime.hash);
  assert.ok(compiled.sop.every(module => !module.learning));
});

test('shared lexical prefixes compose in new structures and reduce flat recognition work', () => {
  const entries = Array.from({ length: 320 }, (_, index) => ({
    category: 'Catalog', surface: `Sector ${index % 8} station ${index}`,
    value: { entity: `location-${index}`, flags: [index % 2 === 0] }
  }));
  const compact = build(entries), flatGrammar = { productions: [], lexicon: [] }, flatSop = [];
  for (const [index, entry] of entries.entries()) {
    const id = `reference.value${index}`;
    const constants = memoryModules(id, entry.value, { kind: 'reference-authored-values' });
    flatSop.push(...constants.map(({ learning, ...module }) => ({ ...module, provenance: origin })), {
      id: id + '.action', provenance: origin,
      source: `@input children array\n@input scope string\n@with kernel.value.record\n@value ${id} with $with\n@output result $value\n`
    });
    flatGrammar.productions.push({ id, lhs: 'Catalog',
      rhs: base.grammar.tokenize(entry.surface).map(token => ({ literal: token.text })), action: id + '.action' });
  }
  const reference = compileGrammarKnowledge(flatGrammar, { id: 'reference.grammar', origin });
  const flat = install({ ...reference, sop: [...reference.sop, ...flatSop] });
  const model = install(compact);
  for (const text of [entries[0].surface, entries[173].surface, 'Sector 0 station missing']) {
    const compactBudget = new Budget();
    const actual = parse(model, text, { budget: compactBudget });
    const flatBudget = new Budget();
    const expected = parse(flat, text, { budget: flatBudget });
    assert.deepEqual(meanings(actual), meanings(expected));
    assert.ok(actual.states < expected.states / 3, 'Prefix sharing must reduce actual chart states');
    assert.ok(compactBudget.used.nodes < flatBudget.used.nodes, 'SOP callback work must also decrease');
  }
  const composition = compileGrammarKnowledge({ productions: [{ id: 'test.pair', lhs: 'Pair',
    rhs: ['Catalog', { literal: 'beside' }, 'Catalog'], action: 'test.pair.action' }] },
  { id: 'test.pair.grammar', origin });
  const paired = install({ sop: [...compact.sop, ...composition.sop, { id: 'test.pair.action', provenance: origin,
    source: '@input children array\n@input scope string\n@left kernel.value.get value $children key 0 fallback null\n@right kernel.value.get value $children key 2 fallback null\n@out kernel.value.record left $left right $right\n@output result $out\n' }],
    providers: { 'grammar-fragments': [...compact.providers['grammar-fragments'],
      ...composition.providers['grammar-fragments']] } });
  const answer = paired.grammar.parse(entries[17].surface + ' beside ' + entries[306].surface, { start: 'Pair' });
  assert.deepEqual(answer.alternatives, [{ left: entries[17].value, right: entries[306].value }]);
  assert.throws(() => parse(model, entries[17].surface, { budget: new Budget({ nodes: 3 }) }), /Budget exceeded/);
});

test('phrase compilation requires supplied tokenization and inert lexical meanings', () => {
  assert.throws(() => compilePhraseKnowledge([], { id: 'x', origin }), /parent token policy/);
  assert.throws(() => build([{ category: 'Catalog', surface: '', value: 'empty' }]), /phrase tokens/);
  assert.throws(() => build([{ category: 'Catalog', surface: 'x', value: () => 1 }]), /data|value|Unsupported/i);
});
