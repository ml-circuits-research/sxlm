import { installLexical } from './support/lexical.mjs';
import { decodeSOP } from '../src/kernel/sop-data.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SymbolicModel,compileGrammarKnowledge,validatePack,Budget,LimitError,parseDocument,digest} from '../src/index.mjs';
import {Grammar} from '../src/language/grammar.mjs';
import {CircuitRuntime} from '../src/kernel/circuit.mjs';
import {installCollectionPrimitives} from '../src/kernel/collections.mjs';
import {installTermPrimitives} from '../src/kernel/terms.mjs';
import {compileSOP} from '../src/kernel/sop.mjs';
import {parseDocument as reference} from './reference/document-v1.mjs';
import {conformance,composition} from '../eval/cases.mjs';

const model=new SymbolicModel();
const raw=(m,text,options={})=>m.runtime.execute('document.run',{text,scope:'7',config:m.resources.grammar.segmentation,start:m.resources.grammar.start},{cache:false,...options});
const fresh=()=>installCollectionPrimitives(installTermPrimitives(new CircuitRuntime()));
const extension=(id,fragment,sop=[])=>{
 const knowledge=compileGrammarKnowledge(fragment,{id:'memory.'+id,origin:{kind:'test-proposal'}});
 return{schema:'sxlm.pack.v1',id,version:'1',provenance:{kind:'test-proposal'},sop:[...sop,...knowledge.sop],providers:knowledge.providers};
};

test('SOP document policy preserves historical interpretation, scopes, source spans and coverage',()=>{
 const texts=[...conformance,...composition].filter(c=>!c.task||c.task==='reason').map(c=>c.text);
 texts.push('  Mira is a pilot.\nIs Mira a pilot?','🛰️ unusual symbols? Mira is a pilot.','Mira is a pilot. mira is a pilot.','Aster says that Mira is a pilot. Is Mira a pilot?');
 for(const text of texts)assert.deepEqual(raw(model,text),reference(text,model.grammar,{scope:'7',cache:false,lowering:model.resources.entrypoints.lower}),text);
 assert.deepEqual(parseDocument('Mira is a pilot.',model.grammar,{scope:'7',cache:false}),raw(model,'Mira is a pilot.'));
 for(const text of ['', ' \n\t', 'x'.repeat(60001)])assert.throws(()=>raw(model,text),/nonempty string/);
 const trace=[];raw(model,'Mira is a pilot. Is Mira a pilot?',{trace});
 assert.equal(model.runtime.primitives.has('language.parse'),false);
 assert.ok(trace.some(t=>t.circuit==='document.span'));
 assert.ok(trace.some(t=>t.mode==='attempt'&&t.operation==='document.lower-array'));
 assert.throws(()=>raw(model,'Mira is a pilot.',{budget:new Budget({nodes:10})}),LimitError);
});

test('unparsed, ambiguous and invalid semantic results become explicit SOP gaps',()=>{
 const action=(id,kind)=>({id,source:'@input children array\n@input scope string\n@value kernel.value.record kind '+JSON.stringify(kind)+'\n@output result $value'});
 const pack=extension('invalid-meaning',{productions:[{id:'probe-root',lhs:'Root',rhs:[{literal:'blorple'}],action:'probe.invalid'}]},[action('probe.invalid','unsupported-kind')]);
 const invalid=new SymbolicModel({packs:[...model.packs,pack]});
 const text='blorple.';assert.deepEqual(raw(invalid,text),reference(text,invalid.grammar,{scope:'7',cache:false,lowering:invalid.resources.entrypoints.lower}));
 assert.match(raw(invalid,text).entries[0].reason,/invalid-semantics/);
 const ambiguous=extension('ambiguous-meaning',{productions:[{id:'probe-a',lhs:'Root',rhs:[{literal:'blorple'}],action:'probe.a'},{id:'probe-b',lhs:'Root',rhs:[{literal:'blorple'}],action:'probe.b'}]},[action('probe.a','one'),action('probe.b','two')]);
 const multiple=new SymbolicModel({packs:[...model.packs,ambiguous]});
 const gap=raw(multiple,text).entries[0];assert.equal(gap.reason,'ambiguous');assert.equal(gap.alternatives,2);
 assert.equal(raw(model,'unfamiliar question?').entries[0].intent,'query');
 assert.equal(raw(model,'unfamiliar statement.').entries[0].intent,'statement');
});

test('grammar proposals execute as circuit knowledge and removal of wiring removes their competence',()=>{
 const archived=decodeSOP(readFileSync(new URL('../training/grammar-bootstrap.sop',import.meta.url))).grammar;
 assert.deepEqual(model.runtime.execute('language.grammar',{with:{}}),archived);
 assert.ok(model.packs.every(p=>!Object.hasOwn(p,'grammar')));
 const lexeme={category:'N',surface:'aeronaut',value:'pilot'},pack=extension('new-lexeme',{lexicon:[lexeme]});
 const trained=new SymbolicModel({packs:[...model.packs,pack]});
 assert.equal(trained.ask('Aster is an aeronaut. Is Aster a pilot?').truth,'true');
 assert.equal(model.ask('Aster is an aeronaut. Is Aster a pilot?').truth,'unknown');
 const ablated=structuredClone(pack);ablated.providers={};
 assert.equal(new SymbolicModel({packs:[...model.packs,ablated]}).ask('Aster is an aeronaut. Is Aster a pilot?').truth,'unknown');
 assert.throws(()=>validatePack({schema:'sxlm.pack.v1',id:'raw-grammar',version:'1',provenance:{kind:'test'},grammar:archived}),/compiled into circuits/);
 assert.throws(()=>new SymbolicModel({packs:[...model.packs,extension('wrong-root',{start:'Other'})]}),/cannot replace the grammar entry point/);
 assert.throws(()=>new SymbolicModel({packs:[...model.packs,extension('wrong-segmentation',{segmentation:archived.segmentation})]}),/cannot replace segmentation/);
 assert.throws(()=>new SymbolicModel({packs:[...model.packs,extension('wrong-class',{classes:{name:{pattern:'[0-9]'}}})]}),/Lexical class collision/);
 assert.throws(()=>new SymbolicModel({packs:[...model.packs,extension('missing-action',{productions:[{id:'missing-action',lhs:'Root',rhs:[{literal:'x'}],action:'missing'}]})]}),/Missing semantic circuit/);
});

test('changing document interpretation policy changes SOP content, not the host implementation',()=>{
 const pack=structuredClone(model.packs[0]),module=pack.sop.find(m=>m.id==='document.gap');
 module.source=module.source.replace('true "query"','true "statement"');
 const changed=new SymbolicModel({packs:[pack]});
 assert.equal(raw(changed,'unknown question?').entries[0].intent,'statement');
 assert.equal(raw(model,'unknown question?').entries[0].intent,'query');
 const implementation=m=>digest([...m.runtime.primitives].map(([id,p])=>({id,inputs:p.inputs,output:p.output,source:p.run.toString()})));
 assert.equal(implementation(model),implementation(changed));
 assert.notEqual(model.runtime.programs.get('document.parse').hash,changed.runtime.programs.get('document.parse').hash);
});

test('attempt is typed, dependency-bound and does not convert resource exhaustion to ordinary failure',()=>{
 const build=denominator=>{const vm=fresh();vm.compile(compileSOP('operation','@input with object\n@value kernel.number.binary operation "divide" left 12 right '+denominator+'\n@output result $value'));vm.compile(compileSOP('guard','@input with object\n@result kernel.flow.attempt circuit "operation" with $with\n@output result $result'));return vm;};
 const success=build(3),failure=build(0);assert.deepEqual(success.execute('guard',{with:{}}),{ok:true,value:4});
 const failed=failure.execute('guard',{with:{}});assert.equal(failed.ok,false);assert.match(failed.error.message,/Non-finite/);
 assert.deepEqual(failure.execute('guard',{with:{}},{cache:false}),failed);
 assert.notEqual(success.programs.get('guard').hash,failure.programs.get('guard').hash);
 assert.throws(()=>success.execute('guard',{with:{}},{cache:false,budget:new Budget({nodes:1})}),LimitError);
 assert.throws(()=>success.compile(compileSOP('wrong','@x kernel.flow.attempt circuit "operation" with 3\n@output result $x')),/Wrong literal type/);
});

test('runtime inspection cannot mutate programs, primitive contracts or cached answers',()=>{
 const vm=fresh(),source='@input with object\n@value data.number value 7\n@output result $value';
 vm.compile(compileSOP('child',source));vm.compile(compileSOP('parent','@input with object\n@value child with $with\n@output result $value'));
 assert.equal(vm.execute('parent',{with:{}}),7);const hash=vm.programs.get('parent').hash;
 vm.programs.set('child',{...vm.programs.get('child'),program:compileSOP('child',source.replace('value 7','value 8'))});
 vm.primitives.delete('data.number');vm.types.delete('number');
 for(const key of vm.cache.keys())vm.cache.set(key,99);
 assert.throws(()=>{vm.primitives.get('data.number').inputs.value='object';},TypeError);
 assert.equal(vm.execute('parent',{with:{}},{cache:false}),7);assert.equal(vm.execute('parent',{with:{}}),7);assert.equal(vm.programs.get('parent').hash,hash);
 assert.throws(()=>vm.compile(compileSOP('child',source.replace('value 7','value 8'))),/different definition/);
});

test('grammar indexes are immutable views with normalized and collision-free lexical identity',()=>{
 const vm=fresh();vm.compile(compileSOP('tokens','@input children array\n@input scope string\n@output result $children'));
 const grammar={schema:'sxlm.grammar.v1',start:'S',productions:[{id:'root',lhs:'S',rhs:[{lex:'A|x'}],action:'tokens'}],lexicon:[{category:'A|x',surface:'y',value:'first'},{category:'A',surface:'x|y',value:'second'},{category:'A|x',surface:'Ａ',value:'normalized'}]};
 const g=new Grammar(grammar,vm,{policy:installLexical(vm)});grammar.lexicon[0].value='mutated';g.lexicon.clear();g.productions.clear();
 assert.deepEqual(g.parse('y').alternatives,[['first']]);assert.deepEqual(g.parse('a').alternatives,[['normalized']]);
 assert.deepEqual(g.terminal({lex:'A'},{value:'x|y',text:'x|y'}),['second']);
 assert.throws(()=>g.productions.get('S').push({}),TypeError);assert.throws(()=>{g.data.start='Other';},TypeError);
 assert.throws(()=>g.parse('y',{maxAlternatives:0}),/parse options/);
});

test('prototype-like text remains in source evidence without unsafe label keys',()=>{
 const result=raw(model,'Constructor is a pilot. Is Constructor a pilot?');
 assert.equal(result.coverage.gaps,0);assert.equal(Object.hasOwn(result.labels,'constructor'),false);
 assert.equal(result.source.text,'Constructor is a pilot. Is Constructor a pilot?');
 assert.equal(model.ask(result.source.text).truth,'true');
});
