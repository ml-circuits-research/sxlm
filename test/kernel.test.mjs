import { installLexical } from './support/lexical.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CircuitRuntime, ref } from '../src/kernel/circuit.mjs';
import { Budget, canonical } from '../src/kernel/data.mjs';
import { installTermPrimitives } from '../src/kernel/terms.mjs';
import { Grammar } from '../src/language/grammar.mjs';
import { close, query, validateRule } from '../src/semantics/logic.mjs';
import { expression } from '../src/kernel/rational.mjs';
import { plan, verifyPlan } from '../src/tasks/planner.mjs';

function runtime() { return new CircuitRuntime().primitive('identity', { inputs: { x: 'number' }, output: 'number', run: ({ x }) => x }); }
const constant = (id, value) => ({ schema: 'sxlm.circuit.v1', id, inputs: {}, nodes: [{ id: 'same-node', op: 'identity', args: { x: value } }], output: ref('same-node') });
const a = (predicate, terms, negative = false, context = 'world') => ({ predicate, terms, negative, context });
test('content identity prevents specialized constant cache collisions', () => {
  const r = runtime(); r.compile(constant('first', 1)); r.compile(constant('second', 2));
  assert.deepEqual(['first','second','first','second'].map(id => r.execute(id, {})), [1,2,1,2]);
  assert.throws(() => r.compile(constant('first', 2)), /different definition/);
});
test('typed graph rejects forward references, bad arguments and cycles', () => {
  const r = runtime(), c = constant('bad', 1); c.nodes[0].args.x = ref('future'); assert.throws(() => r.compile(c), /reference/);
  c.nodes[0].args.x = 'word'; assert.throws(() => r.compile(c), /literal type/);
  c.nodes[0] = { id: 'x', call: 'bad', args: {} }; assert.throws(() => r.compile(c), /Unknown/);
});
test('nested circuits compose through typed inputs', () => {
  const r = runtime(); r.compile(constant('inner', 9));
  r.compile({ schema: 'sxlm.circuit.v1', id: 'outer', inputs: {}, nodes: [{ id: 'nested', call: 'inner', args: {} }], output: ref('nested') });
  assert.equal(r.execute('outer', {}), 9);
});
test('JSON boundary rejects code, non-finite values and prototype pollution', () => {
  for (const v of [() => 1, NaN, Infinity, JSON.parse('{"__proto__": {}}')]) assert.throws(() => canonical(v));
});
test('node budgets also apply to cache hits', () => { const r = runtime(); r.compile(constant('one', 1)); r.execute('one', {}); assert.throws(() => r.execute('one', {}, { budget: new Budget({ nodes: 0 }) }), /Budget exceeded/); });
test('grammar interpreter works with an unrelated alphabet and external semantics', () => {
  const r = installTermPrimitives(new CircuitRuntime());
  r.compile({ schema: 'sxlm.circuit.v1', id: 'pair', inputs: { children: 'array', scope: 'string' }, nodes: [{ id: 'out', op: 'data.get', args: { value: ref('$children'), path: [] } }], output: ref('out') });
  const g = new Grammar({ schema: 'sxlm.grammar.v1', start: 'S', classes: {}, lexicon: [], productions: [{ id: 'g', lhs: 'S', rhs: [{ literal: 'α' }, { literal: '⊕' }, { literal: 'β' }], action: 'pair' }] }, r, {policy:installLexical(r)});
  assert.deepEqual(g.parse('α ⊕ β').alternatives, [['α','⊕','β']]); assert.equal(g.parse('α β').status, 'unparsed');
  assert.throws(()=>new Grammar({...g.data,classes:{bad:{pattern:'[a]+[a]+[a]+[b]'}}},r,{policy:installLexical(r)}),/one variable repetition/);
});
test('unsafe and cross-world Horn rules are rejected', () => {
  assert.throws(() => validateRule({ body: [a('p',['?x'])], head: a('q',['?y']) }), /unbound/);
  assert.throws(() => validateRule({ body: [a('p',['?x'],false,'belief:x')], head: a('q',['?x']) }), /Cross-context/);
});
test('four-valued inference does not use absence as negation or explode on contradictions', () => {
  const c = close({ facts: [false,true].map(negative => ({ atom: a('p',['x'],negative), evidence: {} })), rules: [] });
  assert.equal(query(c,[a('p',['x'])]).truth,'both'); assert.equal(query(c,[a('q',['x'])]).truth,'unknown');
});
test('recursive closure terminates on a finite cyclic domain', () => {
  const c = close({ facts: [{ atom: a('p',['x']), evidence: {} }], rules: [{ id:'one',body:[a('p',['?x'])],head:a('q',['?x']),evidence:{} }, { id:'two',body:[a('q',['?x'])],head:a('p',['?x']),evidence:{} }] });
  assert.equal(c.facts.length,2); assert.equal(c.rounds,2);
});
test('exact arithmetic has precedence, parentheses, unary signs and no code execution', () => {
  assert.equal(expression('0.1 + 0.2'),'3/10'); assert.equal(expression('(2 + 3) * -4'),'-20');
  assert.throws(() => expression('1/0'),/zero/); assert.throws(() => expression('process.exit()'),/Unsupported/);
});
test('finite planner optimizes cost and has independently replayable witnesses', () => {
  const p = { initial:[a('at',['a'])], goals:[a('at',['c'])], actions:[
    {id:'direct',requires:[a('at',['a'])],remove:[a('at',['a'])],add:[a('at',['c'])],cost:5},
    {id:'first',requires:[a('at',['a'])],remove:[a('at',['a'])],add:[a('at',['b'])],cost:1},
    {id:'second',requires:[a('at',['b'])],remove:[a('at',['b'])],add:[a('at',['c'])],cost:1},
  ]}; const result=plan(p); assert.equal(result.cost,2); assert.equal(verifyPlan(p,result).valid,true);
  assert.equal(verifyPlan(p,{...result,steps:['second']}).valid,false);
});
