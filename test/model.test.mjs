import { graphsFromModules } from '../src/learning/sop-output.mjs';
import { decodeSOP } from '../src/kernel/sop-data.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SymbolicModel, induceConstruction, canonical, verifyProofs, learnSequencePack } from '../src/index.mjs';
import { conformance, composition, learningGates } from '../eval/cases.mjs';
import { evaluateCase } from '../src/learning/evaluate.mjs';

const model = new SymbolicModel();
for (const item of [...conformance,...composition]) test(item.id, () => { const r=evaluateCase(model,item); assert.equal(r.pass,true,r.failures.join('\n')); });
test('session state is isolated, serializable and model-bound', () => {
  const s=model.createSession();s.ask('Mira is a pilot.');const restored=model.createSession(s.snapshot());
  assert.equal(restored.ask('Is Mira a pilot?').truth,'true');assert.equal(model.ask('Is Mira a pilot?').truth,'unknown');
  assert.throws(()=>model.createSession({...s.snapshot(),model:'wrong'}),/different model/);
});
test('failed execution rolls back all statements from that request', () => {
  const s=model.createSession();const before=canonical(s.snapshot());const result=s.ask('Mira is a pilot. Is Mira a pilot?',{limits:{facts:0},cache:false});
  assert.equal(result.status,'budget-exceeded');assert.equal(canonical(s.snapshot()),before);
});
test('questions observe state at their narrative position', () => {
  const r=model.ask('Mira has 8 apples. How many apples does Mira have? Mira gives 3 apples to Theo. How many apples does Mira have?');
  assert.deepEqual(r.answers.map(a=>a.value),['8','5']);
});
test('cold, warm and disabled caches preserve semantics', () => {
  const text=conformance[6].text;const a=model.ask(text,{cache:false}),b=model.ask(text),c=model.ask(text);
  assert.deepEqual(a.answers,b.answers);assert.deepEqual(b.answers,c.answers);assert.ok(c.trace.some(t=>t.cached));
});
test('proof verifier rejects a forged conclusion and damaged evidence', () => {
  const s=model.createSession(),r=s.ask('Every human is mortal. Mira is a human. Is Mira mortal?');
  assert.equal(verifyProofs(r.proofs,s.state).valid,true);const forged=structuredClone(r.proofs);forged[0].atom.terms[0]='theo';
  assert.equal(verifyProofs(forged,s.state).valid,false);const broken=structuredClone(s.state);broken.sources.at(-1).text='changed';assert.equal(verifyProofs(r.proofs,broken).valid,false);
});
test('induction learns a compositional construction and transfers beyond its examples', () => {
  const spec=decodeSOP(readFileSync(new URL('../examples/learn-construction.sop',import.meta.url)));
  const pack=induceConstruction(model,spec),trained=new SymbolicModel({packs:[...model.packs,pack]});
  assert.equal(model.ask(learningGates[0].text).truth,'unknown');
  for(const item of learningGates){const r=evaluateCase(trained,item);assert.equal(r.pass,true,`${item.id}: ${r.failures}`);}
  assert.equal(trained.resources.grammar.productions.at(-1).lhs,'VP');assert.equal(graphsFromModules(pack.sop).some(c=>c.nodes.some(n=>n.op==='data.template')),false);assert.ok(graphsFromModules(pack.sop).some(c=>c.nodes.some(n=>n.op==='data.get')));
});
test('induction refuses unsupported alignments and duplicate examples', () => {
  const spec=decodeSOP(readFileSync(new URL('../examples/learn-construction.sop',import.meta.url)));
  assert.throws(()=>induceConstruction(model,{...spec,examples:[spec.examples[0],spec.examples[0]]}),/Identical/);
  assert.throws(()=>induceConstruction(model,{...spec,slotCategories:{}}),/semantic category/);
});
test('corpus-only learning expands completions without editing the runtime', () => {
  const text='The amber drone monitors volcanic activity.';
  const extension=learnSequencePack([text],{id:'drone-corpus',boundaries:['.','!','?'],parentModel:model.resources.hash});
  const trained=new SymbolicModel({packs:[...model.packs,extension]});assert.equal(model.complete('The amber drone').status,'unknown');assert.equal(trained.complete('The amber drone').text,text);
});
test('model resources and committed snapshots cannot silently mutate beneath cache identities', () => {
  assert.throws(()=>{model.resources.grammar.start='changed';},TypeError);
  assert.throws(()=>model.packs[0].sop.push({}),TypeError);
  const session=model.createSession();session.ask('Mira is a pilot.');assert.throws(()=>session.state.facts.push({}),TypeError);
});
test('an impossible transfer cannot certify the recipient inventory', () => {
  const r=model.ask('Mira has 2 apples. Theo has 4 apples. Mira gives 3 apples to Theo. How many apples does Theo have?');
  assert.equal(r.status,'unknown');assert.equal(r.reason,'uninterpreted-or-inconsistent-event');
});
test('existential answers realize the supported witness instead of an unbound variable', () => {
  assert.equal(model.ask('Mira owns a bird. Does Mira own a bird?').text,'Yes. Mira owns an unnamed bird.');
});
