import { encodeSOP } from '../src/kernel/sop-data.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CircuitRuntime, ref } from '../src/kernel/circuit.mjs';
import { installValuePrimitives } from '../src/kernel/values.mjs';
import { Budget, LimitError } from '../src/kernel/data.mjs';

const vm=installValuePrimitives(new CircuitRuntime());
for(const [name,p] of vm.primitives)vm.compile({schema:'sxlm.circuit.v1',id:name,inputs:p.inputs,nodes:[{id:'out',op:name,args:Object.fromEntries(Object.keys(p.inputs).map(k=>[k,ref('$'+k)]))}],output:ref('out')});
const run=(name,input,options)=>vm.execute('kernel.'+name,input,options);

test('structural probes preserve falsy values, discriminate absence and ignore inherited keys', () => {
  for(const value of [null,false,0,''])assert.deepEqual(run('value.probe',{value:{x:value},path:['x']}),{found:true,value});
  assert.deepEqual(run('value.probe',{value:{},path:['constructor']}),{found:false});
  assert.deepEqual(run('value.probe',{value:[{x:7}],path:[0,'x']}),{found:true,value:7});
  assert.deepEqual(run('seq.probe',{items:[1,null],index:-1}),{found:true,value:null});
  assert.deepEqual(run('seq.probe',{items:[1,null],index:-3}),{found:false});
  for(const path of [[{}],[1.5],Array(64).fill('x')])assert.throws(()=>run('value.probe',{value:{},path}));
  assert.throws(()=>run('seq.probe',{items:[1],index:0.5}),/integer/);
});

test('record and SOP conversions retain ordinary data and observable property order', () => {
  const value={z:[1,{flag:false}],a:null};
  assert.deepEqual(run('value.leaves',{value}),[1,false,null]);
  assert.deepEqual(run('value.pairs',{value}),[['z',[1,{flag:false}]],['a',null]]);
  assert.equal(run('value.serialize',{value}),encodeSOP(value));
  assert.deepEqual(run('value.parse',{text:encodeSOP({$get:['not executable']})}),{$get:['not executable']});
  assert.deepEqual(run('value.fromPairs',{items:[['x',1],['y',2],['x',3]]}),{x:3,y:2});
  for(const text of ['invalid','1e999','{"__proto__":{}}'])assert.throws(()=>run('value.parse',{text}));
  for(const items of [[['prototype',1]],[['x']],[['x',1,2]],[[3,4]]])assert.throws(()=>run('value.fromPairs',{items}));
  for(const [value,type]of [[null,'null'],[[],'array'],[{},'object'],[true,'boolean'],[7,'number'],['x','string']])assert.equal(run('value.type',{value}),type);
});

test('text operations are literal mechanisms with no regex or executable formatting', () => {
  assert.equal(run('text.replace',{text:'a.b.a',from:'.',to:'$&'}),'a$&b$&a');
  assert.equal(run('text.startsWith',{text:'Alpha',prefix:'alpha'}),false);
  assert.equal(run('text.startsWith',{text:'Alpha',prefix:''}),true);
  assert.deepEqual(run('text.sort',{items:['β','A','a','A']}),['A','A','a','β']);
  assert.equal(run('value.slice',{value:'abcde',start:-3,end:-1}),'cd');
  assert.deepEqual(run('value.slice',{value:[1,2,3],start:1,end:9}),[2,3]);
  for(const value of [false,17,'literal'])assert.equal(run('value.scalarText',{value}),String(value));
  assert.equal(run('boolean.not',{value:false}),true);
  assert.throws(()=>run('text.replace',{text:'x',from:'',to:'z'}),/nonempty/);
  assert.throws(()=>run('value.scalarText',{value:{}}),/scalar/);
  assert.throws(()=>run('text.sort',{items:[1]}),/strings/);
});

test('scoped names are deterministic and rational arithmetic rejects coercion and undefined operations', () => {
  const names=[['a','x'],['a','y'],['b','x']].map(([scope,name])=>run('value.fresh',{scope,name}));
  assert.equal(new Set(names).size,3);assert.equal(names[0],run('value.fresh',{scope:'a',name:'x'}));
  assert.equal(run('rational.calculate',{left:'-2/6',operation:'normalize',right:null}),'-1/3');
  assert.equal(run('rational.calculate',{left:'0.1',operation:'+',right:'0.2'}),'3/10');
  assert.equal(run('rational.calculate',{left:'1/3',operation:'compare',right:'2/6'}),0);
  assert.equal(run('rational.calculate',{left:'-1/3',operation:'compare',right:'-1/4'}),-1);
  for(const left of [[1],{},null,true,'NaN'])assert.throws(()=>run('rational.calculate',{left,operation:'normalize',right:null}));
  assert.throws(()=>run('rational.calculate',{left:1,operation:'/',right:0}),/zero/);
  assert.throws(()=>run('rational.calculate',{left:1,operation:'mystery',right:2}),/Unknown/);
});

test('structural traversal consumes caller work budgets', () => {
  for(const [name,input]of [['value.leaves',{value:{rows:[1,2,3]}}],['value.pairs',{value:{a:1,b:2}}],['value.fromPairs',{items:[['a',1],['b',2]]}],['text.sort',{items:['b','a']}],['value.probe',{value:{x:1},path:['x']}]] ){
    assert.throws(()=>run(name,input,{cache:false,budget:new Budget({steps:0})}),LimitError);
  }
});

test('SOP serialization and reconstruction consume the caller budget',()=>{
  const value=Array(80).fill('item');
  assert.throws(()=>run('value.serialize',{value},{budget:new Budget({steps:20})}),LimitError);
  assert.throws(()=>run('value.parse',{text:encodeSOP(value)},{budget:new Budget({steps:20})}),LimitError);
});
