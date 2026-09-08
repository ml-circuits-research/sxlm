import { modulesFromGraphs } from '../src/learning/sop-output.mjs';
import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { SymbolicModel } from '../src/model.mjs';
import { CircuitRuntime, ref } from '../src/kernel/circuit.mjs';
import { installTermPrimitives } from '../src/kernel/terms.mjs';
import { expressionRuntime, lowerProgram } from '../src/learning/expressions.mjs';
import { installCollectionPrimitives } from '../src/kernel/collections.mjs';
import { canonical, executionDigest } from '../src/kernel/data.mjs';
import { validatePack } from '../src/learning/packs.mjs';

test('execution identity preserves observable property order and signed zero', () => {
  const a={left:1,right:2},b={right:2,left:1};
  assert.equal(canonical(a),canonical(b));assert.notEqual(executionDigest(a),executionDigest(b));
  assert.notEqual(executionDigest(0),executionDigest(-0));assert.notEqual(executionDigest(1),executionDigest('1'));
  const runtime=expressionRuntime();
  for(const program of lowerProgram({schema:'sxlm.circuit.v1',id:'entries',inputs:{value:'object'},nodes:[{id:'out',op:'data.template',args:{template:{$entries:{$get:['value']}},environment:ref('$value'),scope:''}}],output:ref('out')}))runtime.compile(program);
  // The environment is itself the supplied record: use a nested field for the observer.
  const first={value:a},second={value:b};
  assert.deepEqual(runtime.execute('entries',{value:first}),Object.entries(a));
  assert.deepEqual(runtime.execute('entries',{value:second}),Object.entries(b));
  assert.deepEqual(runtime.execute('entries',{value:second},{cache:false}),Object.entries(b));
  const sign=new CircuitRuntime().primitive('sign',{inputs:{x:'number'},output:'boolean',run:({x})=>Object.is(x,-0)});
  sign.compile({schema:'sxlm.circuit.v1',id:'sign',inputs:{x:'number'},nodes:[{id:'out',op:'sign',args:{x:ref('$x')}}],output:ref('out')});
  assert.equal(sign.execute('sign',{x:0}),false);assert.equal(sign.execute('sign',{x:-0}),true);
});

test('literal execution order changes program and pack identities', () => {
  const program=value=>({schema:'sxlm.circuit.v1',id:'literal',inputs:{},nodes:[{id:'out',op:'data.template',args:{template:{$entries:{$literal:value}},environment:{},scope:''}}],output:ref('out')});
  const first=program({a:1,b:2}),second=program({b:2,a:1});
  const runtime=expressionRuntime();for(const program of lowerProgram(first))runtime.compile(program);
  assert.throws(()=>{for(const program of lowerProgram(second))runtime.compile(program);},/different definition/);
  const pack=circuits=>({schema:'sxlm.pack.v1',id:'ordering',version:'1',provenance:{kind:'test'},sop:modulesFromGraphs(circuits)});
  assert.notEqual(validatePack(pack(lowerProgram(first))).hash,validatePack(pack(lowerProgram(second))).hash);
});

test('canonical circuit encoding is stable across equivalent record orders', () => {
  const runtime=installCollectionPrimitives(installTermPrimitives(new CircuitRuntime()));
  runtime.compile({schema:'sxlm.circuit.v1',id:'encode',inputs:{value:'any'},nodes:[{id:'out',op:'kernel.value.encode',args:{value:ref('$value')}}],output:ref('out')});
  for(const cache of [false,true]) for(const value of [{a:1,b:2},{b:2,a:1}]) assert.equal(runtime.execute('encode',{value},{cache}),encodeSOP({a:1,b:2},{canonical:true}));
});

test('installed model and executable registries cannot change under their identities', () => {
  const model=new SymbolicModel();
  assert.equal(model.runtime.identity,model.resources.runtime.hash);assert.equal(model.runtime.sealed,true);
  assert.throws(()=>{model.resources={hash:'forged'};},TypeError);
  assert.throws(()=>{model.runtime.execute=()=>({});},TypeError);
  assert.throws(()=>model.runtime.primitive('new',{inputs:{},output:'number',run:()=>1}),/sealed/);
  assert.throws(()=>model.runtime.type('new',()=>true),/sealed/);
  assert.throws(()=>model.runtime.compile({}),/sealed/);
  const snapshot=model.createSession().snapshot();snapshot.model='0'.repeat(64);
  assert.throws(()=>model.createSession(snapshot),/different model/);
});

const root=fileURLToPath(new URL('../',import.meta.url));
function isolated(operation){
  const directory=mkdtempSync(join(tmpdir(),'sxlm-identity-'));
  try{for(const name of ['src','packs'])cpSync(join(root,name),join(directory,name),{recursive:true});return operation(directory);}
  finally{rmSync(directory,{recursive:true,force:true});}
}
const probe=`import {SymbolicModel} from './src/model.mjs';
import {encodeSOP,decodeSOP} from './src/kernel/sop-data.mjs';
import {readPack,bootstrapURL} from './src/learning/packs.mjs';
import {readFileSync} from 'node:fs';
const extra={schema:'sxlm.pack.v1',id:'identity-test',version:'1',provenance:{kind:'test'},sop:[{id:'identity.add',source:'@input with object\\n@sum kernel.number.binary operation "add" left 2 right 3\\n@output result $sum\\n'}]};
const m=new SymbolicModel({packs:[readPack(bootstrapURL),extra]});
let rejected=null;try{m.createSession(decodeSOP(readFileSync('prior.sop')));rejected=false;}catch(e){if(e.code!=='ENOENT')rejected=/different model/.test(e.message);}
console.log(encodeSOP({model:m.resources.hash,runtime:m.resources.runtime.hash,program:m.runtime.programs.get('identity.add').hash,result:m.runtime.execute('identity.add',{with:{}}),snapshot:m.createSession().snapshot(),rejected}));`;
const run=(directory,source)=>decodeSOP(execFileSync(process.execPath,['--input-type=module','-e',"import {encodeSOP as printSOP} from './src/kernel/sop-data.mjs';\n"+source.replaceAll('console.log(encodeSOP(', 'console.log(printSOP(')],{cwd:directory,encoding:'utf8',timeout:20000}));

test('fresh processes bind actual native code and reject snapshots after a host revision', () => isolated(directory=>{
  const before=run(directory,probe);assert.equal(before.result,5);
  assert.equal(before.runtime,new SymbolicModel().resources.runtime.hash);
  writeFileSync(join(directory,'prior.sop'),encodeSOP(before.snapshot));
  assert.equal(run(directory,probe).model,before.model);
  const file=join(directory,'src/kernel/collections.mjs'),source=readFileSync(file,'utf8');
  assert.ok(source.includes("case 'add':value=left+right;"));
  writeFileSync(file,source.replace("case 'add':value=left+right;","case 'add':value=left+right+1;"));
  const after=run(directory,probe);assert.equal(after.result,6);assert.equal(after.rejected,true);
  assert.notEqual(after.runtime,before.runtime);assert.notEqual(after.model,before.model);assert.notEqual(after.program,before.program);
}));

test('a source edit cannot relabel already loaded modules as a fresh model', () => isolated(directory=>{
  const result=run(directory,`import {SymbolicModel} from './src/model.mjs';import {readFileSync,writeFileSync} from 'node:fs';
const first=new SymbolicModel(),file='src/kernel/collections.mjs',source=readFileSync(file,'utf8');writeFileSync(file,source+'\\n// changed after module load\\n');
let rejected=false;try{new SymbolicModel();}catch(e){rejected=/restart/.test(e.message);}writeFileSync(file,source);
console.log(encodeSOP({rejected,restored:new SymbolicModel().resources.hash===first.resources.hash}));`);
  assert.deepEqual(result,{rejected:true,restored:true});
}));

test('the sealed loader profile rejects new dynamic or multiline imports', () => isolated(directory=>{
  const file=join(directory,'src/model.mjs'),source=readFileSync(file,'utf8');
  const check=()=>run(directory,`try{await import('./src/model.mjs');console.log(encodeSOP({rejected:false}));}catch(e){console.log(encodeSOP({rejected:/sealed runtime profile|single-line/.test(e.message)}));}`);
  writeFileSync(join(directory,'src/extra.mjs'),'export const value=1;');
  writeFileSync(file,source+"\nconst extra = import('./extra.mjs');\n");assert.equal(check().rejected,true);
  writeFileSync(file,source.replace("import { CircuitRuntime } from", "import {\n CircuitRuntime } from"));assert.equal(check().rejected,true);
}));
