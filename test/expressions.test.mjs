import { installLexical } from './support/lexical.mjs';
import { graphToSOP, compileModule } from '../src/learning/sop-output.mjs';
import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { instantiate as historical } from './reference/template-v1.mjs';
import { compileExpression, expressionRuntime, executeExpression, lowerPrograms } from '../src/learning/expressions.mjs';
import { Budget, LimitError } from '../src/kernel/data.mjs';
import { SymbolicModel } from '../src/model.mjs';
import { induceConstruction } from '../src/learning/induce.mjs';
import { validatePack } from '../src/learning/packs.mjs';
import { Grammar } from '../src/language/grammar.mjs';

const get=(...path)=>({$get:path});
const expressions=[
  null,true,17,'literal',[1,2,{record:'value'}],
  {$literal:{$get:['this is data']}},{$literal:{ref:'not a wire'}},
  {$get:['nested','value']},{$type:get('nested')},{$leaves:get('nested')},
  {$let:{bindings:{a:'1/3',b:'1/6',sum:{$rational:{left:get('a'),operation:'+',right:get('b')}}},body:get('sum')}},
  {$assert:{test:true,message:'invariant',value:get('items')}},
  {$compare:[get('number'),12]},{$number:{left:get('number'),operation:'*',right:2}},
  {$rational:{left:'2/6'}},{$rational:{left:'1/3',operation:'compare',right:'1/4'}},
  {$contains:[get('items'),2]},{$encode:get('nested')},{$decode:encodeSOP({literal:[1,true]})},{$hash:get('nested')},
  {$slice:{value:get('items'),start:1,end:3}},{$slice:{value:'abcdef',start:1,end:4}},
  {$entries:get('nested')},{$record:[['a',1],['b',2]]},{$unique:[1,1,2,1]},{$sort:['z','a','m']},{$flatten:[[1],[2,3]]},
  {$path:{value:get('nested'),path:['absent'],fallback:get('number')}},
  {$path:{value:get('nested'),path:['value'],fallback:{$decode:'invalid'}}},
  {$if:{test:get('flag'),then:get('number'),else:{$length:get('items')}}},
  {$eq:[get('number'),7]},{$and:[true,get('flag')]},{$or:[false,get('flag')]},{$not:get('flag')},
  {$at:{value:get('items'),index:-1,fallback:0}},{$at:{value:[],index:-1,fallback:42}},
  {$startsWith:['alphabet','alpha']},{$replace:{value:'a.b.a',from:'a',to:'{x}'}},
  {$format:{pattern:'{subject} / {count} / {ready}',values:{subject:get('word'),count:get('number'),ready:get('flag')}}},
  {$concat:[get('items'),[3,4]]},{$merge:[get('nested'),{extra:true}]},
  {$substitute:{value:['?x',{role:'?y'}],bindings:{'?x':get('word'),'?y':get('number')}}},
  {$fresh:'witness'},{$join:{values:[get('word'),'suffix'],separator:' / '}},
  {$map:{items:get('items'),template:{item:get('item'),index:get('index'),fresh:{$fresh:'local'},outer:get('word')}}},
  {$filter:{items:get('items'),test:{$eq:[get('item'),2]}}},
];

test('all retired operator families lower to one graph VM with differential value checks', () => {
  for(const [index,expression]of expressions.entries()){
    const runtime=expressionRuntime(),programs=compileExpression(expression,{id:'case'+index});
    assert.ok(programs.every(c=>c.nodes.every(n=>n.op!=='data.template')));
    for(const program of programs)runtime.compile(program);
    for(const flag of [false,true])for(const number of [7,13]){
      const value={nested:{value:9,other:'entry'},items:[1,2,2],number,flag,word:'unseen binding'};
      const expected=historical(expression,value,{scope:'outer'});
      for(const cache of [false,true,true])assert.deepEqual(runtime.execute('case'+index,{value,scope:'outer'},{cache}),expected,`operator case ${index}`);
    }
  }
});

test('lazy branches, boolean short circuits and defaults preserve failure boundaries', () => {
  const bad={$decode:'invalid JSON'};
  for(const [expression,expected]of [
    [{$if:{test:false,then:bad,else:7}},7],
    [{$and:[false,bad]},false],[{$or:[true,bad]},true],
    [{$path:{value:{x:9},path:['x'],fallback:bad}},9],
    [{$at:{value:[4],index:0,fallback:bad}},4],
  ])assert.equal(executeExpression(expression,{}),expected);
  for(const expression of [{$if:{test:true,then:bad,else:7}},{$and:[true,bad]},{$or:[false,bad]},{$path:{value:{},path:['x'],fallback:bad}}])assert.throws(()=>executeExpression(expression,{}));
  // Compiler temporaries must never shadow user bindings.
  const environment={'compiled-probe-0':'retained','compiled-probe-4':'also retained'};
  assert.deepEqual(executeExpression({$path:{value:{},path:['x'],fallback:get()}},environment),environment);
});

test('nested iteration preserves source scope and variable shadowing', () => {
  const inner={$map:{items:get('item'),template:{value:get('item'),inner:get('index'),symbol:{$fresh:'same-name'}}}};
  const expression={$map:{items:get('groups'),template:{outer:get('index'),values:inner}}};
  const environment={groups:[[1,1],[1]],item:'caller',index:99};
  const actual=executeExpression(expression,environment,{scope:'document'});
  assert.deepEqual(actual,historical(expression,environment,{scope:'document'}));
  assert.equal(new Set(actual.flatMap(group=>group.values.map(item=>item.symbol))).size,3);
  assert.equal(environment.item,'caller');assert.equal(environment.index,99);
});

test('categorical fusion is compact and preserves equality and fallback behavior', () => {
  let expression='missing';
  for(let i=23;i>=0;i--)expression={$if:{test:{$eq:[get('category'),{$literal:'c'+i}]},then:'result'+i,else:expression}};
  const programs=compileExpression(expression),runtime=expressionRuntime();for(const program of programs)runtime.compile(program);
  const choice=programs.flatMap(c=>c.nodes).find(n=>Object.keys(n.choose?.cases??{}).length===24);assert.ok(choice);
  for(const category of ['c0','c12','c23','new'])assert.equal(runtime.execute('expression',{value:{category},scope:''}),historical(expression,{category}));
  let tooDeep=expression;for(let i=0;i<80;i++)tooDeep={$if:{test:true,then:0,else:tooDeep}};
  assert.throws(()=>compileExpression(tooDeep),/nesting limit/);
  // A literal null probe is not the compiler's absence sentinel.
  const differing={$if:{test:{$eq:[null,{$literal:1}]},then:'wrong',else:{$if:{test:{$eq:[get('category'),{$literal:2}]},then:'right',else:'missing'}}}};
  assert.equal(executeExpression(differing,{category:2}),'right');
});

test('compiled iteration and branches respect budgets and reject malformed values', () => {
  const expression={$map:{items:get('items'),template:{$fresh:'id'}}};
  assert.throws(()=>executeExpression(expression,{items:Array(100).fill(1)},{budget:new Budget({nodes:20})}),LimitError);
  for(const key of ['constructor','prototype','__proto__'])assert.equal(executeExpression({$path:{value:{},path:[key],fallback:null}},{}),null);
  assert.throws(()=>executeExpression({$decode:'@a kernel.value.record "constructor" 0\n@output result $a'},{}),/Invalid SOP constructor field/);
  assert.throws(()=>executeExpression({$record:[['__proto__',{}]]},{}),/Unsafe/);
  assert.throws(()=>executeExpression({$number:{left:1,operation:'/',right:0}},{}),/Non-finite/);
  assert.throws(()=>compileExpression({$format:{pattern:get('pattern'),values:{}}}),/explicit circuit/);
});

test('the active library cannot execute expression objects or install the retired opcode', () => {
  const model=new SymbolicModel();
  assert.equal(model.runtime.primitives.has('data.template'),false);
  assert.ok(model.resources.circuits.every(c=>c.nodes.every(n=>n.op!=='data.template')));
  assert.ok(!model.resources.runtime.sourceFiles.some(f=>f.path.includes('learning/expressions')||f.path.includes('template-v1')));
  const source=decodeSOP(readFileSync(new URL('../training/legacy-circuits.sop',import.meta.url)));
  assert.throws(()=>validatePack({schema:'sxlm.pack.v1',id:'legacy',version:'1',provenance:{kind:'test'},circuits:source.circuits}),/Unknown pack field|compiled offline/);
  const lowered=lowerPrograms(source.circuits);
  assert.ok(lowered.every(c=>c.nodes.length<=256));
});

test('construction induction preserves expression-shaped constants as inert semantic data', () => {
  const model=new SymbolicModel(),specification=decodeSOP(readFileSync(new URL('../examples/learn-construction.sop',import.meta.url)));
  for(const example of specification.examples)example.meaning[0].annotation={$get:['this is not executable']};
  const candidate=induceConstruction(model,specification),trained=new SymbolicModel({packs:[...model.packs,candidate]});
  const result=trained.grammar.parse('is certified as a navigator',{start:'VP'});
  assert.equal(result.status,'parsed');assert.deepEqual(result.alternatives[0][0].annotation,{$get:['this is not executable']});
});

test('a replay receipt cannot certify a reordered executable record or an obsolete fragment', async () => {
  const {auditVision}=await import('../scripts/audit-vision.mjs');
  const model=new SymbolicModel(),pack=structuredClone(model.packs[0]);
  const changed=pack.sop.find(c=>c.learning&&c.compilation?.root),graph=compileModule(changed);
  const node=graph.nodes.find(n=>Object.keys(n.args).length>1);
  node.args=Object.fromEntries(Object.entries(node.args).reverse());
  changed.source=graphToSOP(graph).source;
  const audit=auditVision({model:new SymbolicModel({packs:[pack]})});
  assert.equal(audit.expressionMigration.replay,false);
  assert.ok(audit.requirements.find(r=>r.id==='all-competence-learned').evidence.withoutVerifiedDerivation.some(c=>c.id===changed.id));
  const stale=structuredClone(model.packs[0]),fragment=structuredClone(stale.sop.find(c=>c.compilation?.root));
  fragment.id+='obsolete';stale.sop.push(fragment);
  const other=auditVision({model:new SymbolicModel({packs:[stale]})});
  assert.ok(other.expressionMigration.obsoleteFragments.includes(fragment.id));
  assert.equal(other.requirements.find(r=>r.id==='single-execution-language').achieved,false);
});

test('chart composition preserves values that later circuits can distinguish', () => {
  const runtime=expressionRuntime();
  const first={schema:'sxlm.circuit.v1',id:'first',inputs:{children:'array',scope:'string'},nodes:[{id:'v',op:'data.get',args:{value:{ref:'$children'},path:[0]}}],output:{ref:'v'}};
  runtime.compile(first);
  runtime.compile({...first,id:'serialize',nodes:[...first.nodes,{id:'out',op:'kernel.value.serialize',args:{value:{ref:'v'}}}],output:{ref:'out'}});
  const grammar=(values,action)=>new Grammar({schema:'sxlm.grammar.v1',start:'S',classes:{},lexicon:values.map(value=>({surface:'λ',category:'entry',value})),productions:[{id:'outer|0',lhs:'S',rhs:['A'],action},{id:'inner',lhs:'A',rhs:[{lex:'entry'}],action:'first'}]},runtime,{policy:installLexical(runtime)});
  for(const cache of [false,true,true])for(const values of [[{a:1,b:2},{b:2,a:1}],[{b:2,a:1},{a:1,b:2}]]){
    const result=grammar(values,'serialize').parse('λ',{cache});
    assert.equal(result.status,'ambiguous');assert.equal(result.alternativeCount,2);
    assert.deepEqual(new Set(result.alternatives),new Set([encodeSOP({a:1,b:2}),encodeSOP({b:2,a:1})]));
  }
  const signed=grammar([0,-0],'first').parse('λ');
  assert.equal(signed.alternativeCount,2);assert.ok(signed.alternatives.some(v=>Object.is(v,-0)));assert.ok(signed.alternatives.some(v=>Object.is(v,0)));
  assert.equal(grammar([{a:1},{a:1}],'first').parse('λ').alternativeCount,1);
});
