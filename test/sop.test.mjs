import { decodeSOP } from '../src/kernel/sop-data.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {compileSOP} from '../src/kernel/sop.mjs';
import {CircuitRuntime} from '../src/kernel/circuit.mjs';
import {installTermPrimitives} from '../src/kernel/terms.mjs';
import {installCollectionPrimitives} from '../src/kernel/collections.mjs';
import {SymbolicModel} from '../src/model.mjs';
import {Budget, canonical} from '../src/kernel/data.mjs';
import {summarize as reference} from './reference/text-v1.mjs';
const fresh=()=>installCollectionPrimitives(installTermPrimitives(new CircuitRuntime()));

test('SOP graph compilation supports sharing, forward references and scalar strings as inert data',()=>{
 const vm=fresh();vm.compile(compileSOP('pairs','@input x string\n@r kernel.value.record first $a second $a\n@a kernel.seq.make item $x item "# @evil is text"\n@output result $r'));
 assert.deepEqual(vm.execute('pairs',{x:'λ'}),{first:['λ','# @evil is text'],second:['λ','# @evil is text']});
 assert.equal(vm.programs.get('pairs').program.nodes.filter(n=>n.id==='a').length,1);
});
test('SOP rejects cycles, unbound wires, executable literals and malformed arguments',()=>{
 for(const source of ['@a core.identity value $a\n@output result $a','@output result $missing','@a kernel.value.record value {}\n@output result $a','@input "x" string\n@output result $x','@a kernel.value.record x 1 x 2\n@output result $a','@a kernel.value.record x 1e999\n@output result $a'])assert.throws(()=>compileSOP('bad',source));
});
test('SOP branches preserve laziness, typed contracts and dependency content identity',()=>{
 const build=n=>{const vm=fresh();vm.compile(compileSOP('branch','@input with object\n@r kernel.number.binary operation "add" left '+n+' right 0\n@output result $r'));vm.compile(compileSOP('failure','@input with object\n@r kernel.number.binary operation "divide" left 1 right 0\n@output result $r'));vm.compile(compileSOP('main','@input condition boolean\n@w kernel.value.record\n@r kernel.flow.choose condition $condition then "branch" else "failure" with $w\n@output result $r'));return vm;};
 const a=build(2),b=build(3);assert.equal(a.execute('main',{condition:true}),2);assert.equal(b.execute('main',{condition:true}),3);assert.notEqual(a.programs.get('main').hash,b.programs.get('main').hash);assert.throws(()=>a.execute('main',{condition:false}),/Non-finite/);
 assert.throws(()=>a.execute('main',{condition:true},{budget:new Budget({nodes:0})}),/Budget exceeded/);
});
test('the active summary runs its strategy in SOP with no native task shortcut',()=>{
 const model=new SymbolicModel();assert.equal(model.runtime.primitives.has('text.summarize'),false);
 const trace=[],config=model.runtime.execute(model.resources.entrypoints.text,{with:{}}),text='Particles drift slowly. Sensors measure their motion. The notebook is blue.';
 model.runtime.execute(model.resources.entrypoints.summarize,{text,options:{sentences:2,focus:'sensors motion'}},{cache:false,trace});
 assert.ok(trace.some(t=>t.circuit==='summary.score'));assert.ok(trace.some(t=>t.circuit==='summary.marginal'));assert.ok(trace.some(t=>t.mode==='fold'&&t.operation==='summary.step'));
 assert.ok(!model.resources.circuits.filter(c=>c.id.startsWith('summary.')).some(c=>c.nodes.some(n=>n.op==='data.template')));
 assert.deepEqual(strip(model.summarize(text,{sentences:2,focus:'sensors motion'})),reference(text,config,{sentences:2,focus:'sensors motion'}));
});
const strip=({model,metrics,...value})=>value;
test('SOP selection preserves source spans and the historical policy across lengths, ties and focus changes',()=>{
 const model=new SymbolicModel({cacheSize:0});
 const texts=['','A fact.','Amber glows. Cobalt glows. Amber glows.','🛰️ A detector registered a pulse. Technicians recalibrated the detector. The pulse persisted! The office was empty.','A clock ticks. A gate opens. A valve closes. A timer stops. A sensor blinks. A counter resets.'];
 for(const text of texts)for(const sentences of [1,2,3])for(const focus of ['','detector pulse','gate']){
  const options={sentences,focus};const result=model.summarize(text,options);assert.deepEqual(strip(result),reference(text,model.runtime.execute(model.resources.entrypoints.text,{with:{}}),options));
  for(const evidence of result.evidence)assert.ok(result.text.includes(text.slice(evidence.start,evidence.end)));
 }
 for(const sentences of [0,1.2,31])assert.throws(()=>model.summarize('x.',{sentences}),/Summary length/);
});
test('a source-only SOP strategy update changes behavior while preserving the primitive registry',()=>{
 const baseline=new SymbolicModel(),pack=structuredClone(baseline.packs[0]);
 const module=pack.sop.find(m=>m.id==='summary.score');
 // A deliberate policy proposal, not a claim of automatic learning.
 module.source=module.source.replace('score $score','score $index');
 const changed=new SymbolicModel({packs:[pack]});assert.deepEqual([...baseline.runtime.primitives.keys()],[...changed.runtime.primitives.keys()]);
 const text='Stars shine. Comets move. Satellites orbit.';
 assert.notEqual(canonical(baseline.summarize(text,{sentences:1}).selected),canonical(changed.summarize(text,{sentences:1}).selected));
 assert.notEqual(baseline.runtime.programs.get('summary.run').hash,changed.runtime.programs.get('summary.run').hash);
});

test('affine supervision induces a reusable SOP program over unrelated feature names',async()=>{
 const {learnAffineSOP}=await import('../src/learning/affine.mjs');
 const examples=[[0,0],[1,0],[0,1],[2,3],[7,-2]].map(([x,y])=>({input:{distance:x,offset:y},output:5+2*x-3*y}));
 const {module,receipt}=learnAffineSOP('learned.transform',examples);const vm=fresh();vm.compile(compileSOP(module.id,module.source,{learning:module.learning}));
 assert.ok(receipt.maxResidual<1e-9);
 for(const [distance,offset] of [[-11,19],[0.125,-4.75],[101,97]])assert.equal(vm.execute(module.id,{with:{distance,offset}}),5+2*distance-3*offset);
 assert.throws(()=>learnAffineSOP('bad',[{input:{x:1,y:2},output:3},{input:{x:2,y:4},output:6},{input:{x:3,y:6},output:9}]),/rank-deficient/);
 assert.throws(()=>learnAffineSOP('nonlinear',[0,1,2,3].map(x=>({input:{x},output:x*x}))),/affine hypothesis/);
});
test('the learned summary score is necessary, reproducible and transfers to new feature bindings',async()=>{
 const {learnAffineSOP}=await import('../src/learning/affine.mjs');
 const {readFileSync}=await import('node:fs');
 const curriculum=decodeSOP(readFileSync(new URL('../training/summary-scores.sop',import.meta.url)));
 const model=new SymbolicModel(),installed=model.packs[0].sop.find(m=>m.id==='learned.summary.score');
 assert.equal(learnAffineSOP(installed.id,curriculum.examples).module.source,installed.source);
 assert.equal(model.runtime.execute(installed.id,{with:{centrality:7.25,lead:0,focus:0.75}}),14.75);
 const ablated=structuredClone(model.packs[0]);ablated.sop=ablated.sop.filter(m=>m.id!==installed.id);
 assert.throws(()=>new SymbolicModel({packs:[ablated]}),/Unresolvable/);
 assert.equal(model.runtime.primitives.has('text.summarize'),false);
});

test('ordinary document lengths fit the default circuit budget while explicit limits still stop selection',()=>{
 const model=new SymbolicModel({cacheSize:0}),text=Array.from({length:20},(_,i)=>`Instrument ${i} records a distinct signal at station ${i}.`).join(' ');
 const result=model.summarize(text,{sentences:3});assert.deepEqual(strip(result),reference(text,model.runtime.execute(model.resources.entrypoints.text,{with:{}}),{sentences:3}));assert.ok(result.metrics.nodes>1000);
 assert.throws(()=>model.summarize(text,{sentences:3,limits:{nodes:1000}}),/Budget exceeded: nodes/);
});

test('ablating the learned scoring rule loses focus selection on an unseen document',()=>{
 const learned=new SymbolicModel(),pack=structuredClone(learned.packs[0]);
 pack.sop.find(m=>m.id==='learned.summary.score').source='@input with object\n@z kernel.number.binary operation "add" left 0 right 0\n@output result $z';
 const ablated=new SymbolicModel({packs:[pack]});
 const text='Quartz gleams softly. Lanterns glow quietly. Detectors measure radiation.';
 assert.deepEqual(learned.summarize(text,{sentences:1,focus:'detectors radiation'}).selected,[2]);
 assert.deepEqual(ablated.summarize(text,{sentences:1,focus:'detectors radiation'}).selected,[0]);
});

test('a learned SOP receipt cannot certify changed program content',async()=>{
 const {auditVision}=await import('../scripts/audit-vision.mjs');
 const model=new SymbolicModel(),pack=structuredClone(model.packs[0]),module=pack.sop.find(m=>m.id==='learned.summary.score');
 module.source=module.source.replace('@output result $sum2','@output result $bias');
 const audit=auditVision({model:new SymbolicModel({packs:[pack]})}),requirement=audit.requirements.find(r=>r.id==='all-competence-learned');
 assert.equal(audit.demonstratedMigration.sopReplay,false);
 assert.ok(requirement.evidence.withoutVerifiedDerivation.some(c=>c.id===module.id));
});
