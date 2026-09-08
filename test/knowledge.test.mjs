import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SymbolicModel } from '../src/model.mjs';
import { compileKnowledge, compileTheoryKnowledge } from '../src/learning/knowledge.mjs';
import { validatePack } from '../src/learning/packs.mjs';
import { canonical, digest } from '../src/kernel/data.mjs';
import { synthesizeKnowledge } from '../scripts/build-knowledge.mjs';

const archived = decodeSOP(readFileSync(new URL('../training/knowledge-bootstrap.sop', import.meta.url)));
const atom = (predicate, terms) => ({ predicate, terms, negative: false, context: 'world' });
const proposal = (id, knowledge) => ({ schema:'sxlm.pack.v1', id, version:'1', provenance:{kind:'test-authored-proposal'}, sop:knowledge.sop, ...(knowledge.providers ? {providers:knowledge.providers} : {}) });

test('persistent theory and text have one circuit authority with explicit authored provenance', () => {
  const model = new SymbolicModel(), trace = [];
  assert.equal(Object.hasOwn(model.resources, 'text'), false);
  assert.equal(Object.hasOwn(model.resources, 'theory'), false);
  for (const field of ['text','theory']) {
    assert.equal(Object.hasOwn(model.packs[0],field),false);
    assert.throws(()=>validatePack({...proposal('raw',{sop:[]}),[field]:archived[field]}),/compiled into circuits/);
  }
  assert.deepEqual(model.runtime.execute(model.resources.entrypoints.text,{with:{}}),archived.text);
  const state=model.runtime.execute(model.resources.entrypoints.initial,{value:{}},{cache:false,trace});
  assert.deepEqual(state.rules.map(({id,evidence,...rule})=>rule),archived.theory);
  assert.ok(trace.some(n=>n.circuit==='theory.install'));
  for(const rule of state.rules){
    const source=state.sources.find(s=>s.id===rule.evidence.source);
    const {id,evidence,...declaration}=rule;
    assert.equal(source.text,encodeSOP(declaration,{canonical:true}));assert.equal(source.id,digest(source.text));
    assert.deepEqual(decodeSOP(source.text),declaration);
    assert.equal(source.pack,archived.pack);assert.equal(rule.evidence.end,source.text.length);
  }
  const replay=synthesizeKnowledge();
  assert.ok(replay.modules.every(m=>!m.learning));
  assert.ok(replay.modules.filter(m=>m.id.startsWith('memory.')).every(m=>m.provenance.kind==='compiled-theory-proposal'));
});

test('theory ablation removes entailment and reinstalling restores it without host changes', () => {
  const base=new SymbolicModel(),pack=structuredClone(base.packs[0]);
  pack.providers['theory-fragments']=[];
  const ablated=new SymbolicModel({packs:[pack]});
  const input='Mira is north of Theo. Is Theo south of Mira?';
  assert.equal(base.ask(input).truth,'true');assert.equal(ablated.ask(input).truth,'unknown');
  assert.equal(new SymbolicModel({packs:base.packs}).ask(input).truth,'true');
  assert.equal(ablated.resources.runtime.hash,base.resources.runtime.hash);
  assert.notEqual(ablated.resources.hash,base.resources.hash);
  assert.notEqual(ablated.runtime.programs.get('theory.bootstrap').hash,base.runtime.programs.get('theory.bootstrap').hash);
});

test('compiled theory transfers across bindings and supplied rule chains with checked evidence', () => {
  const base=new SymbolicModel();
  const rule={body:[atom('pilot',['?x'])],head:atom('careful',['?x'])};
  const knowledge=compileTheoryKnowledge([rule],{id:'memory.careful-pilots',origin:{kind:'test-declaration'},sourceName:'pilot-policy'});
  const trained=new SymbolicModel({packs:[...base.packs,proposal('careful-pilots',knowledge)]});
  for(const name of ['Nara','Ivo']){
    const text=`Every human is a pilot. ${name} is a human. Is ${name} careful?`;
    assert.equal(base.ask(text).truth,'unknown');
    const answer=trained.ask(text);assert.equal(answer.truth,'true');assert.equal(answer.verification.valid,true);
  }
  assert.equal(trained.ask('Nara is a pilot. Ivo is a human. Is Ivo careful?').truth,'unknown');
  assert.equal(trained.resources.runtime.hash,base.resources.runtime.hash);
});

test('theory validates at both compilation and execution, including raw constructor proposals', () => {
  const bad={body:[atom('pilot',['?x'])],head:atom('careful',['?y'])};
  assert.throws(()=>compileTheoryKnowledge([bad],{id:'memory.invalid',origin:{kind:'test'}}),/unbound/);
  const memory=compileKnowledge([{rule:bad,pack:'invalid'}],{id:'memory.invalid',origin:{kind:'test'}});
  const pack=proposal('invalid',memory);pack.providers={'theory-fragments':['memory.invalid']};
  const base=new SymbolicModel();
  assert.throws(()=>new SymbolicModel({packs:[...base.packs,pack]}),/unbound/);
});

test('text configuration is reused by tasks and changes through circuit replacement', () => {
  const base=new SymbolicModel(),pack=structuredClone(base.packs[0]);
  const changed={...archived.text,minimumContext:100};
  const config=compileKnowledge(changed,{id:'language.text-config',origin:{kind:'test-ablation'}});
  pack.sop=[...pack.sop.filter(m=>!m.id.startsWith('language.text-config')), ...config.sop];
  const model=new SymbolicModel({packs:[pack]});
  assert.notEqual(model.resources.hash,base.resources.hash);
  assert.equal(model.resources.runtime.hash,base.resources.runtime.hash);
  assert.equal(model.runtime.execute(model.resources.entrypoints.text,{with:{}}).minimumContext,100);
  for(const task of ['summarize','complete']){
    const trace=[];
    const inputs=task==='summarize'?{text:'Particles drift. Sensors detect motion.',options:{}}:{prefix:'x the',options:{maxTokens:3}};
    model.runtime.execute(model.resources.entrypoints[task],inputs,{trace,cache:false});
    assert.ok(trace.some(n=>n.circuit==='language.text-config'));
  }
  assert.notEqual(model.complete('x the',{maxTokens:3}).text,base.complete('x the',{maxTokens:3}).text);
});
