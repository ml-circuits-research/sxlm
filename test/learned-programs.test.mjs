import { normalizedGraphs } from '../src/learning/sop-output.mjs';
import { decodeSOP } from '../src/kernel/sop-data.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CircuitRuntime } from '../src/kernel/circuit.mjs';
import { Budget, canonical } from '../src/kernel/data.mjs';
import { expressionRuntime, executeExpression as instantiate, lowerProgram } from '../src/learning/expressions.mjs';
import { learnExpression, learnDispatch } from '../src/learning/programs.mjs';
import { SymbolicModel } from '../src/model.mjs';
import { synthesizeRealization } from '../scripts/learn-realization.mjs';
import { auditVision } from '../scripts/audit-vision.mjs';

test('expression induction learns role order and transfers to new multiword bindings', () => {
  const examples = [
    { values: { actor: 'Kestrel', patient: 'Cedar' }, text: 'Cedar is observed by Kestrel.' },
    { values: { actor: 'Juniper', patient: 'Rowan' }, text: 'Rowan is observed by Juniper.' },
  ];
  const learned = learnExpression('test.expression', examples), runtime = expressionRuntime();
  for(const circuit of learned.circuits)runtime.compile(circuit);
  assert.equal(runtime.execute('test.expression', { value: { values: { actor: 'North station', patient: '{an unknown device}' } } }), '{an unknown device} is observed by North station.');
  assert.equal(learned.receipt.mode, 'slot-induction');
  assert.ok(!JSON.stringify(learned.circuit.nodes).includes('Kestrel'));
});
test('ambiguous binding alignments require more evidence', () => {
  assert.throws(() => learnExpression('ambiguous', [
    { values: { a: 'Kestrel', b: 'Kestrel' }, text: 'Kestrel arrived.' },
    { values: { a: 'Juniper', b: 'Juniper' }, text: 'Juniper arrived.' },
  ]), /ambiguous/);
});
test('constant expression memory is distinguished from slot induction', () => {
  const learned = learnExpression('constant', [{ values: {}, text: 'Undetermined.' }, { values: {}, text: 'Undetermined.' }]);
  assert.equal(learned.receipt.mode, 'constant-output-memory');
  assert.equal(learned.receipt.uniqueTrainingExamples, 1);
});
test('decision-tree induction uses supplied features rather than host task names', () => {
  const learned = learnDispatch('test.dispatch', [
    { input: { phase: 'alpha', serial: '01' }, output: 'route-a' },
    { input: { phase: 'alpha', serial: '02' }, output: 'route-a' },
    { input: { phase: 'beta', serial: '03' }, output: 'route-b' },
    { input: { phase: 'beta', serial: '04' }, output: 'route-b' },
  ], { fallback: 'unclassified' });
  const runtime = expressionRuntime(); for(const circuit of learned.circuits)runtime.compile(circuit);
  assert.equal(runtime.execute('test.dispatch', { value: { input: { phase: 'alpha', serial: 'new' } } }), 'route-a');
  assert.equal(runtime.execute('test.dispatch', { value: { input: { phase: 'gamma', serial: 'new' } } }), 'unclassified');
});
test('conditionals and defaults evaluate only the selected expression', () => {
  assert.equal(instantiate({ $if: { test: false, then: { $get: ['missing'] }, else: 7 } }, {}), 7);
  assert.equal(instantiate({ $path: { value: { x: 3 }, path: ['x'], fallback: { $get: ['missing'] } } }, {}), 3);
  // Missing own properties use the fallback; inherited prototype values are
  // never returned. Materialized unsafe own fields remain rejected.
  for(const key of ['__proto__','constructor','prototype'])assert.equal(instantiate({$path:{value:{},path:[key],fallback:null}},{}),null);
  assert.throws(()=>instantiate({$path:{value:JSON.parse('{"__proto__":{}}'),path:['__proto__'],fallback:null}},{}),/Unsafe/);
});
test('map and choice cache identities include their control dependencies', () => {
  const runtime = expressionRuntime();
  for (const [id, value] of [['left',1],['right',2]]) runtime.compile({ schema:'sxlm.circuit.v1',id,inputs:{},nodes:[{id:'v',op:'data.get',args:{value,path:[]}}],output:{ref:'v'} });
  runtime.compile({schema:'sxlm.circuit.v1',id:'choice',inputs:{selector:'string'},nodes:[{id:'v',choose:{selector:{ref:'$selector'},cases:{a:'left'},otherwise:'right'},args:{}}],output:{ref:'v'}});
  assert.deepEqual(['a','b','a','b'].map(selector=>runtime.execute('choice',{selector})),[1,2,1,2]);
  runtime.compile({schema:'sxlm.circuit.v1',id:'identity',inputs:{item:'any'},nodes:[{id:'v',op:'data.get',args:{value:{ref:'$item'},path:[]}}],output:{ref:'v'}});
  runtime.compile({schema:'sxlm.circuit.v1',id:'mapped',inputs:{items:'array'},nodes:[{id:'v',map:'identity',item:'item',items:{ref:'$items'},args:{}}],output:{ref:'v'}});
  assert.deepEqual(runtime.execute('mapped',{items:[1,2]}),[1,2]);assert.deepEqual(runtime.execute('mapped',{items:[3]}),[3]);
  assert.throws(()=>runtime.execute('mapped',{items:[4]},{budget:new Budget({nodes:1}),cache:false}),/Budget exceeded/);
});
test('branch circuits must expose matching contracts', () => {
  const runtime = expressionRuntime();
  for(const [id,inputs]of [['one',{}],['two',{x:'string'}]]) runtime.compile({schema:'sxlm.circuit.v1',id,inputs,nodes:[{id:'v',op:'data.get',args:{value:0,path:[]}}],output:{ref:'v'}});
  assert.throws(()=>runtime.compile({schema:'sxlm.circuit.v1',id:'bad',inputs:{},nodes:[{id:'v',choose:{selector:'a',cases:{a:'one'},otherwise:'two'},args:{}}],output:{ref:'v'}}),/contracts must agree/);
});
test('active realization is reproducibly learned circuit execution, with authored adapters disclosed', () => {
  const curriculum=decodeSOP(readFileSync(new URL('../training/realization.sop',import.meta.url)));
  const adapters=decodeSOP(readFileSync(new URL('../training/realization-adapters.sop',import.meta.url)));
  const regenerated=synthesizeRealization(curriculum,adapters),model=new SymbolicModel();
  for(const circuit of normalizedGraphs(regenerated.circuits)) assert.equal(canonical(model.resources.circuits.find(c=>c.id===circuit.id)),canonical(circuit));
  assert.equal(model.runtime.primitives.has('language.realize'),false);assert.equal(Object.hasOwn(model.packs[0],'realization'),false);
  const answer=model.ask('Every human is mortal. Nara is a human. Is Nara mortal?',{cache:false});
  assert.equal(answer.text,'Yes. Nara is mortal.');
  assert.ok(answer.trace.some(n=>n.circuit.startsWith('learned.expression.')));
  assert.ok(answer.trace.some(n=>n.circuit==='learned.dispatch.answer'));
  assert.equal(regenerated.receipt.authoredAdapters,5);
});
test('the vision audit does not accept a fabricated learning tag as a derivation', () => {
  const base=new SymbolicModel(),pack=structuredClone(base.packs[0]);
  const unverified=pack.sop.find(m=>!m.learning);unverified.learning={kind:'claimed-induction-without-evidence'};
  const audit=auditVision({model:new SymbolicModel({packs:[pack]})});
  const requirement=audit.requirements.find(r=>r.id==='all-competence-learned');
  const baseline=auditVision({model:base}).requirements.find(r=>r.id==='all-competence-learned');
  assert.equal(audit.complete,false);assert.equal(requirement.achieved,false);
  assert.equal(requirement.evidence.circuitsWithVerifiedDerivation,baseline.evidence.circuitsWithVerifiedDerivation);
  assert.ok(requirement.evidence.withoutVerifiedDerivation.some(c=>c.id===unverified.id));
});
test('rendering circuits respect optional polarity and context in the shared atom contract', () => {
  const model=new SymbolicModel();
  const state={...model.initialState(),facts:[{atom:{predicate:'sensor',terms:['_:source']},evidence:{}}],labels:{nara:'Nara'}};
  const text=model.runtime.execute('render.atom',{value:{atom:{predicate:'own',terms:['nara','_:source']},state}});
  assert.equal(text,'Nara owns an unnamed sensor.');
});
