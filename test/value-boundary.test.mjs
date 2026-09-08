import test from 'node:test';
import assert from 'node:assert/strict';
import { CircuitRuntime, ref } from '../src/kernel/circuit.mjs';
import { assertData, canonical, deepFreeze, immutableCopy, executionDigest } from '../src/kernel/data.mjs';

test('the JSON boundary rejects accessors and hidden or extra properties without invoking them', () => {
  let reads=0;
  const getter=()=>{reads++;return 1;};
  const record=Object.defineProperty({},'x',{enumerable:true,get:getter});
  const array=Object.defineProperty([1],'0',{enumerable:true,get:getter});
  const hidden=Object.defineProperty({},'x',{value:1});
  const extra=Object.assign([1],{annotation:2});
  const symbol={x:1,[Symbol('hidden')]:2};
  for(const value of [record,array,hidden,extra,symbol,Array(1),new Date(),Object.create({x:1})])assert.throws(()=>assertData(value));
  assert.equal(reads,0);
  assertData({rows:[null,false,0,'',{}]});
});

test('the VM owns its input snapshot and never freezes a caller or an external native result', () => {
  const external={rows:[{value:7}]},vm=new CircuitRuntime();let nativeInput;
  vm.primitive('native',{inputs:{value:'object'},output:'object',pure:false,run:({value})=>{
    nativeInput=value;assert.ok(Object.isFrozen(value)&&Object.isFrozen(value.rows[0]));return external;
  }});
  vm.compile({schema:'sxlm.circuit.v1',id:'run',inputs:{value:'object'},nodes:[{id:'out',op:'native',args:{value:ref('$value')}}],output:ref('out')});
  const caller={rows:[{value:1}]},result=vm.execute('run',{value:caller});
  assert.notEqual(nativeInput,caller);assert.equal(Object.isFrozen(caller),false);
  assert.equal(Object.isFrozen(external),false);assert.equal(Object.isFrozen(external.rows[0]),false);
  caller.rows[0].value=2;result.rows[0].value=99;
  assert.equal(nativeInput.rows[0].value,1);assert.equal(external.rows[0].value,7);
  external.rows[0].value=8;assert.equal(vm.execute('run',{value:caller}).rows[0].value,8);
});

test('returned values and cache inspection cannot mutate cached results', () => {
  let calls=0;const vm=new CircuitRuntime();
  vm.primitive('construct',{inputs:{},output:'object',run:()=>{calls++;return{rows:[{value:3}]};}});
  vm.compile({schema:'sxlm.circuit.v1',id:'run',inputs:{},nodes:[{id:'out',op:'construct',args:{}}],output:ref('out')});
  const first=vm.execute('run',{});first.rows[0].value=42;
  assert.throws(()=>{[...vm.cache.values()][0].rows[0].value=99;},TypeError);
  const second=vm.execute('run',{});assert.equal(second.rows[0].value,3);assert.equal(calls,1);
  second.rows.push({value:4});assert.deepEqual(vm.execute('run',{}),{rows:[{value:3}]});
});

test('immutable sharing and hash memoization trust only recursively owned values', () => {
  const child={value:1},shallow=Object.freeze({child});
  const before=executionDigest(shallow),snapshot=immutableCopy(shallow);
  child.value=2;assert.notEqual(executionDigest(shallow),before);assert.equal(snapshot.child.value,1);
  assert.notEqual(snapshot,shallow);
  const owned=deepFreeze({child:{value:3}}),shared=immutableCopy({owned});
  assert.equal(shared.owned,owned);assert.equal(immutableCopy(shared),shared);
  assert.equal(executionDigest(shared),executionDigest(structuredClone(shared)));
  const values=[null,false,true,0,-0,'0',[],{},['x'],{x:[]},{a:1,b:2},{b:2,a:1}];
  assert.equal(new Set(values.map(executionDigest)).size,values.length);
  assert.equal(canonical({a:1,b:2}),canonical({b:2,a:1}));
});

test('cached subtree heights cannot bypass the nesting limit when shared deeper', () => {
  let value=0;for(let i=0;i<80;i++)value={child:value};
  const owned=deepFreeze(value);assertData(owned);executionDigest(owned);
  assertData(owned);assert.throws(()=>assertData({child:owned}),/nesting limit/);
  assert.throws(()=>executionDigest({child:owned}),/nesting limit/);
});
