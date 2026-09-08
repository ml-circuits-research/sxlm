import { normalizedGraphs, installGraphs } from '../src/learning/sop-output.mjs';
import { decodeSOP } from '../src/kernel/sop-data.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SymbolicModel } from '../src/model.mjs';
import { CircuitRuntime, ref } from '../src/kernel/circuit.mjs';
import { expressionRuntime, executeExpression as instantiate, lowerProgram } from '../src/learning/expressions.mjs';
import { Budget, canonical } from '../src/kernel/data.mjs';
import { learnDispatch } from '../src/learning/programs.mjs';
import { interpret as referenceInterpret } from './reference/reason-v1.mjs';
import { emptyWorld } from './reference/world-v1.mjs';
import { buildSemantics } from '../scripts/build-semantics.mjs';

const model = new SymbolicModel();
const get = (...path) => ({ $get: path });
const doc = entries => ({schema:'sxlm.document.v1',source:{id:'observation',text:'x'.repeat(300)},entries:entries.map((e,i)=>({...e,span:{start:i,end:i+1}})),labels:{},coverage:{sentences:entries.length,parsed:entries.filter(e=>e.kind!=='gap').length,gaps:entries.filter(e=>e.kind==='gap').length}});
const event = (operation, owner, amount, recipient, context='world') => ({kind:'quantity',event:{operation,owner,item:'resource',amount:String(amount),context,...(recipient?{recipient}:{})}});
const quantity = (owner,context='world') => ({kind:'query',query:{kind:'quantity',owner,item:'resource',context}});
const execute = (document,state=emptyWorld(),options={}) => model.runtime.execute('world.interpret',{value:{state,document}},{cache:false,...options});

test('semantic policies execute as circuits and reproduce their declared sources', () => {
  assert.equal(model.runtime.primitives.has('world.interpret'),false);
  assert.ok(model.runtime.programs.has('world.interpret'));
  const curriculum=decodeSOP(readFileSync(new URL('../training/semantics-dispatch.sop',import.meta.url)));
  for(const circuit of normalizedGraphs(buildSemantics(curriculum).circuits)) assert.equal(canonical(model.runtime.programs.get(circuit.id).program),canonical(circuit));
  const trace=[];execute(doc([event('set','alpha',10),quantity('alpha')]),emptyWorld(),{trace});
  assert.ok(trace.some(t=>t.mode==='fold'&&t.operation==='interpret.step'));
  assert.ok(trace.some(t=>t.circuit==='state.event.set'));
  assert.ok(trace.some(t=>t.circuit==='learned.semantic.solver'));
});

test('migration preserves the previous interpreter over temporal, partial and inconsistent event histories', () => {
  const sequences=[];
  for (const context of ['world','scenario:separate']) for (const initial of ['0','3/2','17']) for (const amount of ['0','1/2','20']) {
    sequences.push([event('set','alpha',initial,null,context),quantity('alpha',context),event('transfer','alpha',amount,'beta',context),quantity('beta',context),quantity('alpha',context)]);
    sequences.push([event('set','beta','7',null,context),event('add','alpha',amount,null,context),event('transfer','alpha',amount,'beta',context),quantity('beta',context),quantity('alpha',context)]);
    sequences.push([event('set','alpha',initial,null,context),{kind:'gap',intent:'statement',text:'uninterpreted',reason:'unparsed',affected:['alpha']},quantity('alpha',context),event('set','alpha',amount,null,context),quantity('alpha',context)]);
  }
  sequences.push([{kind:'gap',intent:'query',text:'uninterpreted',reason:'unparsed',affected:[]},event('set','alpha','2'),quantity('alpha')]);
  sequences.push([]);
  for(const entries of sequences){const document=doc(entries);assert.deepEqual(execute(document),referenceInterpret(emptyWorld(),document));}
});

test('independent conservation and context checks cover unseen numeric bindings', () => {
  // This arithmetic oracle uses scaled integers, not the migration reference or rational helper.
  for (let k=1;k<=12;k++) {
    const a=41+k*13,b=29+k*7,moved=3+k;
    const r=execute(doc([event('set','sender',`${a}/10`),event('set','receiver',`${b}/10`),event('transfer','sender',`${moved}/10`,'receiver'),quantity('sender'),quantity('receiver'),quantity('sender','other')]));
    const asNumber=value=>{const[n,d='1']=value.split('/');return Number(n)/Number(d);};
    assert.equal(asNumber(r.answers[0].value),(a-moved)/10);
    assert.equal(asNumber(r.answers[1].value),(b+moved)/10);
    assert.ok(Math.abs(asNumber(r.answers[0].value)+asNumber(r.answers[1].value)-(a+b)/10)<1e-12);
    assert.equal(r.answers[2].known,false);assert.equal(r.state.revision,1);
  }
});

test('learning a new event label changes reusable state behavior without native edits', () => {
  const pack=structuredClone(model.packs[0]);
  const curriculum=decodeSOP(readFileSync(new URL('../training/semantics-dispatch.sop',import.meta.url)));
  const examples=[...curriculum.components.event.examples,{input:{operation:'donate'},output:'transfer'}];
  const {circuit,circuits}=learnDispatch('learned.semantic.event',examples,{fallback:'invalid'});
  installGraphs(pack,circuits);
  const trained=new SymbolicModel({packs:[pack]});
  assert.deepEqual([...trained.runtime.primitives.keys()],[...model.runtime.primitives.keys()]);
  const document=doc([event('set','supplier',23),event('set','collector',4),event('donate','supplier',7,'collector'),quantity('supplier'),quantity('collector')]);
  assert.throws(()=>execute(document),/Invalid quantity event/);
  const result=trained.runtime.execute('world.interpret',{value:{state:emptyWorld(),document}},{cache:false});
  assert.deepEqual(result.answers.map(a=>a.value),['16','11']);
  // Learned class preserves the transfer's counterexample behavior as well.
  const invalid=doc([event('set','supplier',1),event('set','collector',4),event('donate','supplier',7,'collector'),quantity('collector')]);
  assert.equal(trained.runtime.execute('world.interpret',{value:{state:emptyWorld(),document:invalid}},{cache:false}).answers[0].known,false);
});

test('fold is ordered, empty-safe, cache-correct, typed and bounded across unrelated domains', () => {
  const runtime=expressionRuntime();
  for(const program of lowerProgram({schema:'sxlm.circuit.v1',id:'append',inputs:{acc:'string',item:'string'},nodes:[{id:'env',op:'data.wrap',args:{key:'acc',value:ref('$acc')}},{id:'both',op:'data.attach',args:{record:ref('env'),key:'item',value:ref('$item')}},{id:'term',op:'data.template',args:{template:{$join:{values:[get('acc'),get('item')],separator:''}},environment:ref('both'),scope:''}},{id:'string',op:'data.string',args:{value:ref('term')}}],output:ref('string')}))runtime.compile(program);
  const program={schema:'sxlm.circuit.v1',id:'fold',inputs:{seed:'string',items:'array'},nodes:[{id:'reduce',fold:'append',item:'item',accumulator:'acc',initial:ref('$seed'),items:ref('$items'),args:{}}],output:ref('reduce')};runtime.compile(program);
  for(const seed of ['α','β']) for(const items of [[],['x','y'],['y','x']]) assert.equal(runtime.execute('fold',{seed,items}),seed+items.join(''));
  assert.throws(()=>runtime.execute('fold',{seed:'a',items:['x','y']},{cache:false,budget:new Budget({nodes:3})}),/Budget exceeded/);
  assert.throws(()=>runtime.compile({...program,id:'bad',nodes:[{...program.nodes[0],initial:4}]}),/initial/);
  runtime.compile({schema:'sxlm.circuit.v1',id:'narrow',inputs:{acc:'any',item:'string'},nodes:[{id:'out',op:'data.object',args:{value:{}}}],output:ref('out')});
  assert.throws(()=>runtime.compile({...program,id:'bad-empty',nodes:[{...program.nodes[0],fold:'narrow',initial:'untyped'}]}),/initial/);
});

test('general term operations reject unsafe records and preserve exact arithmetic and lazy scope', () => {
  assert.equal(instantiate({$let:{bindings:{left:'1/3',right:'1/6',sum:{$rational:{left:get('left'),operation:'+',right:get('right')}}},body:get('sum')}},{}),'1/2');
  assert.equal(instantiate({$if:{test:false,then:{$decode:'invalid'},else:42}},{}),42);
  assert.throws(()=>instantiate({$record:[['__proto__',{}]]},{}),/Unsafe/);
  assert.throws(()=>instantiate({$decode:'@a kernel.value.record "constructor" 0\n@output result $a'},{}),/Invalid SOP constructor field/);
  assert.throws(()=>instantiate({$number:{left:1,operation:'/',right:0}},{}),/Non-finite numeric/);
});
