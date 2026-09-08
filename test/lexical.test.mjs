import test from 'node:test';
import assert from 'node:assert/strict';
import { SymbolicModel } from '../src/model.mjs';
import { Grammar } from '../src/language/grammar.mjs';
import { Grammar as HistoricalGrammar, tokenize } from './reference/grammar-v1.mjs';
import { expressionRuntime } from '../src/learning/expressions.mjs';
import { compileSOP } from '../src/kernel/sop.mjs';
import { installLexical } from './support/lexical.mjs';
import { Budget, LimitError, executionDigest } from '../src/kernel/data.mjs';
import { compileGrammarKnowledge } from '../src/learning/grammar.mjs';
import { evaluate } from '../src/learning/evaluate.mjs';
import { normalizationGates } from '../eval/lexical-cases.mjs';
import { auditVision } from '../scripts/audit-vision.mjs';

function parser() {
  const vm=expressionRuntime(),policy=installLexical(vm);
  vm.compile(compileSOP('collect','@input children array\n@input scope string\n@output result $children'));
  const data={schema:'sxlm.grammar.v1',start:'S',productions:[{id:'sequence',lhs:'S',rhs:[{class:'identifier'},{literal:'→'},{class:'identifier'}],action:'collect'}],
    lexicon:[{surface:'Ａ',category:'reserved',value:'reserved-a'},{surface:'λ',category:'entry',value:{a:1,b:2}},{surface:'λ',category:'entry',value:{b:2,a:1}},{surface:'zero',category:'entry',value:-0}],
    classes:{identifier:{pattern:'[\\p{L}]+',excludeCategories:['reserved']},exact:{pattern:'[A-Z]+',caseSensitive:true,preserveCase:true},folded:{pattern:'[a-z]+',caseSensitive:false,preserveCase:false}}};
  return {vm,policy,data,grammar:new Grammar(data,vm,{policy}),historical:new HistoricalGrammar(data,vm)};
}

test('generic Unicode primitives expose explicit operations, validate requests and charge work',()=>{
  const vm=expressionRuntime();
  vm.compile(compileSOP('normalize','@input text string\n@input form string\n@out kernel.text.normalize text $text form $form\n@output result $out'));
  vm.compile(compileSOP('case','@input text string\n@input mode string\n@out kernel.text.case text $text mode $mode\n@output result $out'));
  assert.equal(vm.execute('normalize',{text:'A\u030a',form:'NFC'}),'Å');
  assert.equal(vm.execute('normalize',{text:'Å',form:'NFD'}),'A\u030a');
  assert.equal(vm.execute('normalize',{text:'①',form:'NFKC'}),'1');
  assert.equal(vm.execute('case',{text:'ΣΟΣ',mode:'lower'}),'σος');
  assert.equal(vm.execute('case',{text:'straße',mode:'upper'}),'STRASSE');
  assert.throws(()=>vm.execute('normalize',{text:'a',form:'unknown'}),/normalization form/);
  assert.throws(()=>vm.execute('case',{text:'a',mode:'title'}),/case operation/);
  assert.throws(()=>vm.execute('normalize',{text:'abc',form:'NFC'},{cache:false,budget:new Budget({steps:2})}),LimitError);
});

test('restricted character membership agrees with independent finite-string predicates',()=>{
  const vm=expressionRuntime();vm.compile(compileSOP('match','@input text string\n@input pattern string\n@out kernel.text.matchClass text $text pattern $pattern\n@output result $out'));
  const alphabet=['a','b','c','😀','\n'];let frontier=[''],strings=[''];
  for(let length=1;length<=4;length++){frontier=frontier.flatMap(prefix=>alphabet.map(c=>prefix+c));strings.push(...frontier);}
  const predicates=[['[ab]*',s=>[...s].every(c=>'ab'.includes(c))],['[a][bc]+',s=>s[0]==='a'&&s.length>=2&&[...s.slice(1)].every(c=>'bc'.includes(c))],['[^a]?',s=>[...s].length<=1&&s!=='a'],['[😀][ab]?',s=>s.startsWith('😀')&&([...s].length===1||[...s].length===2&&'ab'.includes([...s][1]))],['[a-c]',s=>['a','b','c'].includes(s)]];
  for(const [pattern,reference]of predicates)for(const text of strings)assert.equal(vm.execute('match',{text,pattern}),reference(text),pattern+' '+text);
  assert.equal(vm.execute('match',{text:'a\n',pattern:'[a]'}),false,'Final newline is not ignored');
  for(const pattern of ['.*','(a+)+','[a]+[a]+','[a]{9}','[a]|[b]','(?=a)','[a][b][c][d][e]'])assert.throws(()=>vm.execute('match',{text:'a',pattern}));
  assert.throws(()=>vm.execute('match',{text:'a'.repeat(100),pattern:'[a]*'},{cache:false,budget:new Budget({steps:10})}),LimitError);
});

test('SOP terminal policy preserves lookup alternatives, class exclusion, case choices and source spans',()=>{
  const {grammar,historical}=parser();
  for(const text of ['λ','Λ','zero','Ａ','A','a','BC','bc','αβ','1','😀'])for(const symbol of [{literal:'Λ'},{lex:'entry'},{class:'identifier'},{class:'exact'},{class:'folded'}]) {
    const token={text,value:text.normalize('NFKC').toLowerCase(),start:0,end:text.length};
    assert.equal(executionDigest(grammar.terminal(symbol,token)),executionDigest(historical.terminal(symbol,token)));
  }
  for(const text of ['λ → β','Λ → Β','Ａ → β','λ β','  λ → β  '])for(const cache of [false,true,true])assert.deepEqual(grammar.parse(text,{cache}),historical.parse(text,{cache}));
  const trace=[];grammar.parse('λ → β',{trace,cache:false});
  assert.ok(trace.some(n=>n.circuit==='lexical.class'));assert.ok(trace.some(n=>n.circuit==='learned.lexical.normalize'));
  assert.deepEqual(tokenize('  λ → β  ').map(t=>[t.start,t.end]),[[2,3],[4,5],[6,7]]);
});

test('a synthesized normalization composition transfers and affects parsing without native changes',()=>{
  const base=new SymbolicModel();assert.equal(evaluate(base,normalizationGates()).failed,0);
  const fragment=compileGrammarKnowledge({productions:[{id:'probe',lhs:'Probe',rhs:[{literal:'Alpha'}],action:'lexical-probe'}]},{id:'memory.lexical-probe',origin:{kind:'test'}});
  const extension={schema:'sxlm.pack.v1',id:'lexical-probe',version:'1',provenance:{kind:'test'},providers:fragment.providers,sop:[...fragment.sop,{id:'lexical-probe',source:'@input children array\n@input scope string\n@output result $children'}]};
  const active=new SymbolicModel({packs:[...base.packs,extension]});assert.equal(active.grammar.parse('ALPHA',{start:'Probe'}).status,'parsed');
  const pack=structuredClone(base.packs[0]),module=pack.sop.find(m=>m.id==='learned.lexical.normalize'),source=module.source;
  module.source='@input text string\n@output result $text';
  const ablated=new SymbolicModel({packs:[pack,extension]});assert.equal(ablated.resources.runtime.hash,active.resources.runtime.hash);
  assert.equal(ablated.grammar.parse('ALPHA',{start:'Probe'}).status,'unparsed');assert.ok(evaluate(ablated,normalizationGates()).failed>0);
  module.source=source;assert.equal(new SymbolicModel({packs:[pack,extension]}).grammar.parse('ALPHA',{start:'Probe'}).status,'parsed');
});

test('lexical callbacks are explicit, pure and typed; invalid token evidence is rejected',()=>{
  const {data,vm,policy}=parser();
  assert.throws(()=>new Grammar(data,vm),/explicit lexical/);
  assert.throws(()=>new Grammar(data,vm,{policy:{...policy,terminal:'collect'}}),/lexical circuit contract/);
  vm.primitive('impure',{inputs:{text:'string'},output:'array',pure:false,run:()=>[]});
  vm.compile(compileSOP('impure-tokenizer','@input text string\n@out primitive "impure" bind text $text\n@output result $out'));
  assert.throws(()=>new Grammar(data,vm,{policy:{...policy,tokenize:'impure-tokenizer'}}),/lexical circuit contract/);
  vm.compile(compileSOP('forged-tokenizer','@input text string\n@token kernel.value.record text "forged" value "λ" start 0 end 1\n@out kernel.seq.make item $token\n@output result $out'));
  assert.throws(()=>new Grammar(data,vm,{policy:{...policy,tokenize:'forged-tokenizer'}}).parse('λ'),/token spans/);
  vm.compile(compileSOP('overlapping-tokenizer','@input text string\n@token kernel.value.record text "λ" value "λ" start 0 end 1\n@out kernel.seq.make item $token item $token\n@output result $out'));
  assert.throws(()=>new Grammar(data,vm,{policy:{...policy,tokenize:'overlapping-tokenizer'}}).parse('λ'),/token spans/);
  assert.throws(()=>new Grammar({...data,classes:{bad:{pattern:'[a]',preserveCase:'yes'}}},vm,{policy}));
  assert.throws(()=>new Grammar(data,vm,{policy,budget:new Budget({nodes:2})}),LimitError);
});

test('lexical audit requires matching source and training evidence and keeps authored policy unverified',()=>{
  const model=new SymbolicModel(),report=auditVision({model});
  assert.equal(report.lexicalMigration.policyReplay,true);assert.equal(report.lexicalMigration.methodReplay,true);assert.equal(report.complete,false);
  const pack=structuredClone(model.packs[0]);delete pack.training.components.lexicalNormalization;
  const missing=auditVision({model:new SymbolicModel({packs:[pack]})});assert.equal(missing.lexicalMigration.methodReplay,false);
  const entries=missing.requirements.find(r=>r.id==='all-competence-learned').evidence.withoutVerifiedDerivation;
  assert.ok(entries.some(c=>c.id==='learned.lexical.normalize'));assert.ok(entries.some(c=>c.id==='lexical.class'));
});
