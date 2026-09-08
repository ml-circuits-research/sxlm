import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';
import { compileSOP } from '../src/kernel/sop.mjs';
import { graphToSOP, compileModule } from '../src/learning/sop-output.mjs';
import { expressionRuntime } from '../src/learning/expressions.mjs';
import { executionDigest, Budget } from '../src/kernel/data.mjs';
import { readPack, bootstrapURL, validatePack } from '../src/learning/packs.mjs';

test('SOP data uses the executable constructor syntax and preserves all inert values', () => {
  const values = [null, false, -0, 0, 1.25e-30, 'λ " # @output', [], {}, { z: [false, null, -0], a: { ref: '$this-is-data' } }];
  for (const value of values) {
    const source = encodeSOP(value), decoded = decodeSOP(source);
    assert.equal(executionDigest(value), executionDigest(decoded));
    const vm = expressionRuntime(); vm.compile(compileSOP('data', source));
    assert.equal(executionDigest(vm.execute('data', {})), executionDigest(decoded));
  }
  assert.notEqual(encodeSOP({ a: 1, b: 2 }), encodeSOP({ b: 2, a: 1 }));
  assert.equal(encodeSOP({ a: 1, b: 2 }, { canonical: true }), encodeSOP({ b: 2, a: 1 }, { canonical: true }));
});

test('source modules remain readable and inert, including apparent delimiters inside their bodies', () => {
  const source = '@input x string\n@end data.string value "@end\\n@module malicious"\n@output result $end';
  const value = { sop: [{ id: 'quoted', source }] }, encoded = encodeSOP(value);
  assert.ok(encoded.includes('\n' + source + '\n@end\n'));
  assert.deepEqual(decodeSOP(encoded), value);
  const prose={source:'# ordinary observation\nA broken quote: \"'}; assert.deepEqual(decodeSOP(encodeSOP(prose)),prose);
  assert.throws(() => decodeSOP(encoded.replace('chars ' + source.length, 'chars 1')), /quotation/);
});

test('data boundaries reject JSON, executable operations, malformed SSA and expansion attacks', () => {
  for (const source of [
    '{"answer":42}', '@a call "anything" bind\n@output result $a',
    '@a kernel.seq.make item $missing\n@output result $a',
    '@a kernel.seq.make item $b\n@b kernel.seq.make item $a\n@output result $a',
    '@a kernel.seq.make\n@a kernel.seq.make\n@output result $a',
    '@a kernel.value.record x 1 x 2\n@output result $a',
    '@a kernel.value.record "__proto__" 1\n@output result $a',
    '@a kernel.value.literal value Infinity\n@output result $a',
    '@a kernel.seq.make\n@output result $a\n@output result $a',
    '@a kernel.seq.make\n@unused kernel.seq.make item $absent\n@output result $a',
  ]) assert.throws(() => decodeSOP(source));
  const doubling = '@v0 kernel.seq.make item 1\n' + Array.from({ length: 10 }, (_, i) => `@v${i + 1} kernel.seq.make item $v${i} item $v${i}`).join('\n') + '\n@output result $v10';
  assert.throws(() => decodeSOP(doubling, { maxValues: 100 }), /budget/);
  assert.throws(() => decodeSOP(encodeSOP([1]), { maxCharacters: 1 }), /size limit/);
  let touched = false; const object = Object.defineProperty({}, 'x', { enumerable: true, get() { touched = true; return 1; } });
  assert.throws(() => encodeSOP(object), /Accessors/); assert.equal(touched, false);
  assert.throws(() => encodeSOP([, 1]));
});

test('SOP compilation rejects metadata bypasses and enforces SSA and typed bindings', () => {
  const source = '@a kernel.value.literal value 1\n@output result $a';
  for (const metadata of [{ nodes: [] }, { inputs: {} }, { output: { ref: 'forged' } }, { schema: 'forged' }]) assert.throws(() => compileSOP('safe', source, metadata), /metadata/);
  for (const invalid of [
    '@input a number\n@a kernel.value.literal value 1\n@output result $a',
    '@a data.number value $b\n@b data.number value $a\n@output result $a',
    '@a primitive "kernel.number.binary" bind operation "add" left "bad" right 1\n@output result $a',
    '@a primitive "kernel.number.binary" bind operation "add" left 1 right 1 left 2\n@output result $a',
  ]) assert.throws(() => expressionRuntime().compile(compileSOP('invalid', invalid)));
});

test('graph-to-source migration preserves constants, iteration roles, branch laziness and failure', () => {
  const vm = expressionRuntime(), other = expressionRuntime();
  const programs = [
    { schema: 'sxlm.circuit.v1', id: 'sum', inputs: { total: 'number', entry: 'number', offset: 'number' }, nodes: [{ id: 's', op: 'kernel.number.binary', args: { operation: 'add', left: { ref: '$total' }, right: { ref: '$entry' } } }], output: { ref: 's' } },
    { schema: 'sxlm.circuit.v1', id: 'bad', inputs: { total: 'number', entry: 'number', offset: 'number' }, nodes: [{ id: 's', op: 'kernel.number.binary', args: { operation: 'divide', left: 1, right: 0 } }], output: { ref: 's' } },
    { schema: 'sxlm.circuit.v1', id: 'fold', inputs: { list: 'array' }, nodes: [{ id: 'f', fold: 'sum', items: { ref: '$list' }, item: 'entry', accumulator: 'total', initial: -0, args: { offset: 0 } }], output: { ref: 'f' } },
    { schema: 'sxlm.circuit.v1', id: 'choose', inputs: { label: 'string' }, nodes: [{ id: 'c', choose: { selector: { ref: '$label' }, cases: { safe: 'sum' }, otherwise: 'bad' }, args: { total: 2, entry: 3, offset: 0 } }], output: { ref: 'c' } },
  ];
  for (const program of programs) { vm.compile(program); other.compile(compileModule(graphToSOP(program))); }
  for (const list of [[], [1, 2, 3], [3, -2, 0]]) assert.equal(executionDigest(vm.execute('fold', { list })), executionDigest(other.execute('fold', { list })));
  assert.equal(other.execute('choose', { label: 'safe' }), 5);
  assert.throws(() => other.execute('choose', { label: 'failure' }), /Non-finite/);
  assert.throws(() => other.execute('fold', { list: [1] }, { budget: new Budget({ nodes: 0 }) }), /Budget/);
});

test('the installed model and all owned data artifacts have SOP as their persistent format', () => {
  const pack = readPack(bootstrapURL); assert.equal(Object.hasOwn(pack, 'circuits'), false); assert.ok(pack.sop.length >= 800);
  assert.throws(() => validatePack({ ...pack, circuits: [] }));
  assert.throws(() => validatePack({ ...pack, sop: [...pack.sop, pack.sop[0]] }), /Duplicate SOP module/);
  const files = readdirSync(new URL('../', import.meta.url), { recursive: true });
  // Agent-manager configuration can be installed independently of this project.
  // It is excluded from the standalone runtime copy, never loaded as knowledge.
  const infrastructure = name => ['.git/','node_modules/','.agents/','.claude/'].some(prefix=>name.startsWith(prefix)) || name==='ploinky-skills-manifest.json';
  const json = files.filter(name => !infrastructure(name) && /\.json(?:l|5)?$/i.test(name));
  assert.deepEqual(json.sort(), ['package.json'], 'Model artifacts must use SOP; JSON is confined to Node/agent infrastructure');
  const data = readFileSync(bootstrapURL, 'utf8'); assert.ok(data.startsWith('@module '));
  assert.equal(executionDigest(decodeSOP(encodeSOP(pack))), executionDigest(pack));
});
