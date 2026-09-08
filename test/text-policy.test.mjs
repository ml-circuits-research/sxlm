import test from 'node:test';
import assert from 'node:assert/strict';
import { SymbolicModel, Budget, createTextProcessor, textPolicyForModel, textPolicyFromModules, learnSequencePack, induceConstruction, encodeSOP, decodeSOP } from '../src/index.mjs';
import { readFileSync } from 'node:fs';
import { textPolicyIdentity } from '../src/learning/text-policy.mjs';
import { segment as historicalSegment } from './reference/document-v1.mjs';
import { tokenize as historicalTokenize } from './reference/grammar-v1.mjs';
import { CircuitRuntime } from '../src/kernel/circuit.mjs';
import { installCollectionPrimitives } from '../src/kernel/collections.mjs';
import { compileSOP } from '../src/kernel/sop.mjs';
import { auditVision } from '../scripts/audit-vision.mjs';

const model=new SymbolicModel(),processor=createTextProcessor(textPolicyForModel(model));

test('generic leading trim preserves non-whitespace code units and accounts for input work',()=>{
  const vm=installCollectionPrimitives(new CircuitRuntime());
  vm.compile(compileSOP('trim','@input text string\n@out kernel.text.trimStart text $text\n@output result $out'));
  const whitespace=['\t','\n','\r','\v','\f',' ','\u00a0','\u1680','\u2000','\u200a','\u2028','\u2029','\u202f','\u205f','\u3000','\ufeff'];
  for(const prefix of whitespace)for(const body of ['λ\n ','\u200b','\ud800','🛰️',''])assert.equal(vm.execute('trim',{text:prefix+prefix+body},{cache:false}),body);
  assert.throws(()=>vm.execute('trim',{text:'     x'},{cache:false,budget:new Budget({steps:5})}),/Budget exceeded/);
  assert.throws(()=>vm.execute('trim',{text:3}),/Wrong circuit input/);
});

test('SOP segmentation agrees with a frozen historical oracle on finite boundaries and UTF-16 spans',()=>{
  const alphabet=['x','.',' ','?'];let frontier=[''],strings=[''];
  for(let length=1;length<=3;length++){frontier=frontier.flatMap(s=>alphabet.map(c=>s+c));strings.push(...frontier);}
  strings.push('  A 🛰️ sensor .\n\t B? C  ','x..y.','a.b c-d e’f!','\ud800 . λ?', '\ufeff!\u200b?\u00a0', '  .   ?  !  ', 'a  .   b');
  for(const text of strings)for(const boundaries of [[],['.'],['.','?'],['x']])for(const keep of [[],boundaries]){
    assert.deepEqual(processor.segment(text,{boundaries,keep},{cache:false}),historicalSegment(text,{boundaries,keep}),text);
  }
  const input='  alpha  . beta?';
  const spans=processor.segment(input,{boundaries:['.','?'],keep:['?']});
  assert.deepEqual(spans,[{text:'alpha',start:2,end:10},{text:'beta?',start:11,end:16}]);
  const trace=[];assert.deepEqual(processor.segment(input,{}, {trace,cache:false}),processor.segment(input));
  assert.ok(trace.some(n=>n.circuit==='text.segment-step'));
  assert.equal(model.runtime.primitives.has('kernel.text.segment'),false);
  assert.throws(()=>processor.segment(input,{}, {budget:new Budget({nodes:2})}),/Budget exceeded/);
});

test('offline learning executes a captured SOP dependency closure with the deployed identity',()=>{
  assert.equal(processor.identity,textPolicyIdentity(model.runtime,processor.policy.entrypoints));
  const text='  Ａlpha turns. β glows!';
  assert.deepEqual(processor.tokenize(text),model.grammar.tokenize(text));
  assert.deepEqual(processor.tokenize(text),historicalTokenize(text));
  assert.ok(processor.policy.sop.every(m=>m.id.startsWith('lexical.')||m.id.startsWith('text.segment')||m.id==='learned.lexical.normalize'));
  assert.throws(()=>createTextProcessor({...processor.policy,sop:processor.policy.sop.slice(1)}),/Missing text-policy dependency/);
  assert.throws(()=>createTextProcessor({...processor.policy,sop:[...processor.policy.sop,{id:'unrelated',source:'@input text string\n@output result $text'}]}),/exactly its dependency closure/);
  assert.throws(()=>textPolicyFromModules([{id:'cycle',source:'@input text string\n@out cycle text $text\n@output result $out'}],{tokenize:'cycle',segment:'cycle'}),/Cyclic text policy/);
  const malformed=structuredClone(processor.policy);
  malformed.sop.find(m=>m.id==='text.segment').source='@input text string\n@output result $text';
  assert.throws(()=>createTextProcessor(textPolicyFromModules(malformed.sop,malformed.entrypoints)),/Invalid text-policy contract/);
});

test('sequence learning follows changed SOP normalization and audit rejects a mismatched deployed policy',()=>{
  const bootstrap=structuredClone(model.packs[0]);
  bootstrap.sop.find(m=>m.id==='learned.lexical.normalize').source='@input text string\n@output result $text';
  const changed=new SymbolicModel({packs:[bootstrap]}),policy=textPolicyForModel(changed);
  const candidate=learnSequencePack(['Sable apparatus moves.'],{id:'policy-observation',boundaries:['.'],textPolicy:policy});
  const active=new SymbolicModel({packs:[bootstrap,candidate]});
  assert.deepEqual(active.runtime.execute('memory.policy-observation.distribution',{with:{key:encodeSOP(['Sable'])}}),[{token:'apparatus',count:1}]);
  assert.deepEqual(active.runtime.execute('memory.policy-observation.distribution',{with:{key:encodeSOP(['sable'])}}),[]);
  assert.equal(candidate.provenance.textPolicy,textPolicyIdentity(active.runtime,policy.entrypoints));
  const good=auditVision({model:active}).demonstratedMigration.sequenceReplays.at(-1);
  assert.equal(good.reproduced,true);assert.equal(good.textPolicyMatches,true);
  const wrong=auditVision({model:new SymbolicModel({packs:[...model.packs,candidate]})}).demonstratedMigration.sequenceReplays.at(-1);
  assert.equal(wrong.contentsMatch,true);assert.equal(wrong.textPolicyMatches,false);assert.equal(wrong.reproduced,false);
});

test('construction alignment uses the parent tokenizer, including circuit-defined ignored surfaces',()=>{
  const bootstrap=structuredClone(model.packs[0]),tokenizer=bootstrap.sop.find(m=>m.id==='lexical.tokenize');
  tokenizer.source=tokenizer.source.replace('@empty kernel.value.empty','@visible kernel.seq.without items $tokens key "text" value "◆"\n@empty kernel.value.empty').replace('items $tokens circuit','items $visible circuit');
  const parent=new SymbolicModel({packs:[bootstrap]});
  const specification=decodeSOP(readFileSync(new URL('../examples/learn-construction.sop',import.meta.url)));
  specification.examples=specification.examples.map(e=>({...e,text:'◆ '+e.text}));
  const candidate=induceConstruction(parent,specification);
  assert.equal(candidate.provenance.tokenPolicy,parent.runtime.programs.get(parent.resources.entrypoints.tokenize).hash);
  const active=new SymbolicModel({packs:[bootstrap,candidate]});
  assert.equal(active.ask('Nara is certified as a pilot. Is Nara a pilot?').truth,'true');
  assert.equal(active.resources.runtime.hash,model.resources.runtime.hash);
});
