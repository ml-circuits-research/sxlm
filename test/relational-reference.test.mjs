import test from 'node:test';
import assert from 'node:assert/strict';
import { close, query } from '../src/semantics/logic.mjs';

// Exhaustive ground instantiation is intentionally unlike the indexed join implementation.
const key = a => JSON.stringify([a.context??'world',a.negative??false,a.predicate,a.terms]);
const variable = s => s.startsWith('?');
const assign = (names, values) => names.reduce((rows,name)=>rows.flatMap(row=>values.map(value=>({...row,[name]:value}))),[{}]);
const instantiate = (atom,binding) => ({...atom,terms:atom.terms.map(t=>binding[t]??t)});
function exhaustive(state) {
  const all=[...state.facts.map(f=>f.atom),...state.rules.flatMap(r=>[...r.body,r.head])];
  const domain=[...new Set(all.flatMap(a=>a.terms).filter(t=>!variable(t)))];
  const facts=new Map(state.facts.map(f=>[key(f.atom),f.atom]));
  let changed=true;
  while(changed){changed=false;for(const rule of state.rules){const names=[...new Set(rule.body.flatMap(a=>a.terms).filter(variable))];for(const binding of assign(names,domain))if(rule.body.every(a=>facts.has(key(instantiate(a,binding))))){const a=instantiate(rule.head,binding),id=key(a);if(!facts.has(id)){facts.set(id,a);changed=true;}}}}
  return facts;
}
const atom=(predicate,terms,negative=false,context='world')=>({predicate,terms,negative,context});

test('indexed relational closure agrees with exhaustive grounding on recursive and contextual theories', () => {
  for(let seed=0;seed<32;seed++){
    const context=seed%2?'hypothesis|x':'world';
    const facts=[['a','b'],['b','c'],['c','a']].filter((_,i)=>seed&(1<<i)).map(terms=>({atom:atom('edge',terms,false,context),evidence:{}}));
    if(seed&8)facts.push({atom:atom('edge',['a','b'],true,context),evidence:{}});
    if(seed&16)facts.push({atom:atom('edge',['a','b'],false,'other'),evidence:{}});
    const rules=[
      {id:'lift',body:[atom('edge',['?x','?y'],false,context)],head:atom('reach',['?x','?y'],false,context),evidence:{}},
      {id:'compose',body:[atom('reach',['?x','?y'],false,context),atom('edge',['?y','?z'],false,context)],head:atom('reach',['?x','?z'],false,context),evidence:{}},
      {id:'negative',body:[atom('edge',['?x','?y'],true,context)],head:atom('blocked',['?x','?y'],false,context),evidence:{}}
    ];
    const state={facts,rules},expected=exhaustive(state),actual=close(state);
    assert.deepEqual(actual.facts.map(f=>key(f.atom)).sort(),[...expected.keys()].sort());
    for(const x of ['a','b','c','unseen'])for(const y of ['a','b','c']){
      const positive=atom('edge',[x,y],false,context),negative=atom('edge',[x,y],true,context);
      const yes=expected.has(key(positive)),no=expected.has(key(negative));
      assert.equal(query(actual,[positive]).truth,yes?(no?'both':'true'):(no?'false':'unknown'));
    }
  }
});

test('relational index identity cannot alias user-supplied predicate and context delimiters', () => {
  const asserted=atom('q',['entity'],false,'r|false|p');
  const other=atom('p|false|q',['entity'],false,'r');
  const closure=close({facts:[{atom:asserted,evidence:{}}],rules:[]});
  assert.equal(query(closure,[asserted]).truth,'true');
  assert.equal(query(closure,[other]).truth,'unknown');
});
