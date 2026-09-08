import test from 'node:test';
import assert from 'node:assert/strict';
import { CircuitRuntime } from '../src/kernel/circuit.mjs';
import { compileSOP } from '../src/kernel/sop.mjs';
import { expressionRuntime } from '../src/learning/expressions.mjs';
import { graphToSOP, compileModule } from '../src/learning/sop-output.mjs';
import { Budget, LimitError, executionDigest } from '../src/kernel/data.mjs';

const guard = '@input current number\n@input target number\n@order kernel.value.compare left $current right $target\n@more kernel.value.equal left $order right -1\n@output result $more';
const step = '@input current number\n@input target number\n@next kernel.number.binary operation "add" left $current right 1\n@output result $next';
const loop = '@input start number\n@input target number\n@input limit number\n@done iterate "advance" while "pending" state "current" seed $start limit $limit bind target $target\n@output result $done';
function counter() { const vm = expressionRuntime(); for (const [id, source] of [['pending', guard], ['advance', step], ['counter', loop]]) vm.compile(compileSOP(id, source)); return vm; }

test('guarded iteration preserves typed state, early termination and explicit bounds in cold/warm runs', () => {
  const vm = counter();
  for (const cache of [false, true, true]) for (const [start, target, limit, expected] of [[0, 4, 4, 4], [7, 2, 0, 7], [-3, 2, 7, 2]]) assert.equal(vm.execute('counter', { start, target, limit }, { cache }), expected);
  for (const limit of [0, 1, 3]) assert.throws(() => vm.execute('counter', { start: 0, target: 4, limit }), error => error instanceof LimitError && error.resource === 'iterations');
  for (const limit of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => vm.execute('counter', { start: 5, target: 2, limit }), /iteration limit/);
  assert.throws(() => vm.execute('counter', { start: 0, target: 4, limit: 8 }, { cache: false, budget: new Budget({ iterations: 2 }) }), LimitError);
});

test('termination is not assumed at the bound and attempt cannot swallow resource exhaustion', () => {
  const vm = counter();
  vm.compile(compileSOP('captured', '@input start number\n@input target number\n@input limit number\n@out attempt "counter" bind start $start target $target limit $limit\n@output result $out'));
  assert.throws(() => vm.execute('captured', { start: 0, target: 4, limit: 2 }), LimitError);
  assert.deepEqual(vm.execute('captured', { start: 0, target: 4, limit: 4 }), { ok: true, value: 4 });
  const trace = []; vm.execute('counter', { start: 0, target: 2, limit: 4 }, { cache: false, trace });
  assert.equal(trace.filter(t => t.circuit === 'pending' && t.node === 'more').length, 3);
  assert.equal(trace.at(-1).mode, 'iterate');
});

test('iteration admits sequence/string states without task-specific host branches', () => {
  const vm = expressionRuntime();
  const inputs = '@input state string\n@input target number\n';
  vm.compile(compileSOP('short', inputs + '@size kernel.seq.count items $state\n@order kernel.value.compare left $size right $target\n@more kernel.value.equal left $order right -1\n@output result $more'));
  vm.compile(compileSOP('append', inputs + '@next kernel.text.concat left $state right "λ"\n@output result $next'));
  vm.compile(compileSOP('string', '@input start string\n@input target number\n@out iterate "append" while "short" state "state" seed $start limit 20 bind target $target\n@output result $out'));
  assert.equal(vm.execute('string', { start: 'α', target: 5 }), 'αλλλλ');
  assert.equal(vm.execute('string', { start: '', target: 0 }), '');
});

test('iteration compilation rejects inconsistent guard, state, limit and binding contracts', () => {
  const vm = counter();
  for (const source of [
    loop.replace('while "pending"', 'while "advance"'),
    loop.replace('state "current"', 'state "missing"'),
    loop.replace('seed $start', 'seed "bad"'),
    loop.replace('limit $limit', 'limit -1'),
    loop.replace('bind target $target', 'bind current $start target $target'),
    loop.replace('limit $limit', 'limit $unknown'),
  ]) assert.throws(() => vm.compile(compileSOP('invalid', source)));
  vm.compile(compileSOP('loose', '@input value any\n@out data.string value "result"\n@output result $out'));
  vm.compile(compileSOP('guard-any', '@input value any\n@out kernel.value.literal value false\n@output result $out'));
  assert.throws(() => vm.compile(compileSOP('seed-invalid', '@input initial any\n@out iterate "loose" while "guard-any" state "value" seed $initial limit 0 bind\n@output result $out')), /initial/);
});

test('guard dependency contents participate in caller identity and graph printing preserves iteration', () => {
  const first = counter(), second = expressionRuntime();
  for (const [id, source] of [['pending', guard.replace('right -1', 'right 0')], ['advance', step], ['counter', loop]]) second.compile(compileSOP(id, source));
  assert.notEqual(first.programs.get('counter').hash, second.programs.get('counter').hash);
  assert.equal(first.execute('counter', { start: 0, target: 2, limit: 4 }), 2);
  assert.equal(second.execute('counter', { start: 0, target: 2, limit: 4 }), 0);
  const module = graphToSOP({ ...first.programs.get('counter').program, id: 'printed' }); first.compile(compileModule(module));
  for (const input of [{ start: 0, target: 2, limit: 2 }, { start: 7, target: 2, limit: 0 }]) assert.equal(first.execute('printed', input), first.execute('counter', input));
});

test('impure guards prevent aggregate caching and immutable records flow between iterations', () => {
  let calls = 0;
  const vm = new CircuitRuntime();
  vm.primitive('guard', { inputs: { state: 'object' }, output: 'boolean', pure: false, run: ({ state }) => { assert.ok(Object.isFrozen(state)); return ++calls < 3; } });
  vm.primitive('step', { inputs: { state: 'object' }, output: 'object', run: ({ state }) => ({ value: state.value + 1 }) });
  for (const id of ['guard', 'step']) vm.compile(compileSOP(id, `@input state object\n@out primitive "${id}" bind state $state\n@output result $out`));
  vm.compile(compileSOP('loop', '@input initial object\n@out iterate "step" while "guard" state "state" seed $initial limit 9 bind\n@output result $out'));
  const initial = { value: 0 }, result = vm.execute('loop', { initial });
  assert.equal(vm.programs.get('loop').pure, false); assert.deepEqual(result, { value: 2 });
  assert.deepEqual(vm.execute('loop', { initial }), { value: 0 }); assert.equal(Object.isFrozen(initial), false);
  result.value = 99; assert.equal(executionDigest(initial), executionDigest({ value: 0 }));
});
