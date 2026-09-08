/** Offline agent-authored proposals. This file is never imported by inference. */
const R = ref => ({ ref });
const G = (...path) => ({ $get: path });
const P = (value, path, fallback = null) => ({ $path: { value, path, fallback } });
const I = (test, yes, no) => ({ $if: { test, then: yes, else: no } });
const E = (a, b) => ({ $eq: [a, b] });
const N = x => ({ $not: x });
const A = (...xs) => ({ $and: xs });
const L = value => ({ $length: value });
const M = (...xs) => ({ $merge: xs });
const C = (...xs) => ({ $concat: xs });
const Has = (values, value) => ({ $contains: [values, value] });
const Num = (a, operation, b) => ({ $number: { left: a, operation, right: b } });
const Rat = (a, operation = 'normalize', b = '0') => ({ $rational: { left: a, operation, right: b } });
const Map = (items, template) => ({ $map: { items, template } });
const Let = (bindings, body) => ({ $let: { bindings, body } });
const Assert = (test, message, value) => ({ $assert: { test, message, value } });
const put = (record, key, value) => M(record, { $record: [[key, value]] });
const key = (owner, item, context) => ({ $encode: [context, owner, item] });
const emptyRecord = { value: null, delta: '0', evidence: [], tainted: [] };
const emptyState = { schema: 'sxlm.world.v1', revision: 0, sources: [], facts: [], rules: [], quantities: {}, events: [], gaps: [], labels: {} };
class Proposal {
  constructor(id, inputs = { value: 'object' }) {
    this.program = { schema: 'sxlm.circuit.v1', id, inputs, nodes: [], output: null, provenance: { kind: 'agent-authored-semantic-policy', source: 'training/semantics-candidates.mjs', qualification: 'An executable migration proposal; compilation and differential replay alone are not a learning derivation.' } };
    this.env = R('$value');
    if (Object.keys(inputs).length > 1) {
      const keys = Object.keys(inputs); this.raw('environment', 'data.wrap', { key: keys[0], value: R('$'+keys[0]) }); this.env=R('environment');
      for (const k of keys.slice(1)) { this.raw('environment.'+k, 'data.attach', { record:this.env, key:k, value:R('$'+k) }); this.env=R('environment.'+k); }
    }
  }
  raw(id, op, args) { this.program.nodes.push({ id, op, args }); return R(id); }
  keep(id, value) { const next=this.raw(id+'.bind', 'data.attach', {record:this.env,key:id,value}); this.env=next; return value; }
  expression(id, template, type='any', keep=true) {
    let out=this.raw(id+'.term','data.template',{template,environment:this.env,scope:''});
    if(type!=='any') out=this.raw(id,'data.'+type,{value:out});
    return keep?this.keep(id,out):out;
  }
  op(id,op,args) { return this.keep(id,this.raw(id,op,args)); }
  call(id,call,value) { const input=this.expression(id+'.input',value,'object',false);this.program.nodes.push({id,call,args:{value:input}});return this.keep(id,R(id)); }
  choose(id,selector,cases,otherwise,value) { const input=this.expression(id+'.input',value,'object',false);this.program.nodes.push({id,choose:{selector,cases,otherwise},args:{value:input}});return this.keep(id,R(id)); }
  finish(template,type='object') {this.program.output=this.expression('result',template,type,false);return this.program;}
}
export function semanticProposals() {
  const circuits=[]; let c;
  c=new Proposal('state.fact-key');const atom=c.expression('atom',G('atom'),'object');c.op('key','relation.key',{atom});circuits.push(c.finish(G('key'),'string'));
  const common=()=>({state:G('state'),document:G('document'),entry:G('entry'),evidence:G('evidence')});
  c=new Proposal('state.entry.fact');
  c.op('atom','relation.validateAtom',{atom:c.expression('inputAtom',G('entry','atom'),'object'),ground:true});
  const facts=c.expression('facts',G('state','facts'),'array');c.program.nodes.push({id:'keys',map:'state.fact-key',item:'value',items:facts,args:{}});c.keep('keys',R('keys'));
  c.op('key','relation.key',{atom:R('atom')});
  circuits.push(c.finish(M(G('state'),{facts:I(Has(G('keys'),G('key')),G('state','facts'),C(G('state','facts'),[{atom:G('atom'),evidence:G('evidence')}]))})));
  c=new Proposal('state.entry.rule');c.op('rule','kernel.relation.validateRule',{rule:c.expression('inputRule',G('entry','rule'),'object')});
  circuits.push(c.finish(Let({id:{$slice:{value:{$hash:{body:G('rule','body'),head:G('rule','head')}},start:0,end:24}}},M(G('state'),{rules:I(Has(Map(G('state','rules'),G('item','id')),G('id')),G('state','rules'),C(G('state','rules'),[M(G('rule'),{id:G('id'),evidence:G('evidence')})]))}))));
  c=new Proposal('state.entry.gap');
  circuits.push(c.finish(Let({gap:{text:G('entry','text'),reason:G('entry','reason'),evidence:G('evidence'),affected:P(G('entry'),['affected'],[])}},M(G('state'),{
    gaps:C(G('state','gaps'),[G('gap')]), quantities:{$record:Map({$entries:G('state','quantities')},Let({owner:{$at:{value:{$decode:{$at:{value:G('item'),index:0}}},index:1}},record:{$at:{value:G('item'),index:1}}},[{$at:{value:G('item'),index:0}},M(G('record'),{tainted:I(Has(G('gap','affected'),G('owner')),C(G('record','tainted'),[G('gap')]),G('record','tainted'))})]))}
  }))));
  c=new Proposal('state.entry.ignore');circuits.push(c.finish(G('state')));
  c=new Proposal('state.entry.invalid');circuits.push(c.finish(Assert(false,'Unknown document entry',G('state'))));
  // The event operators and dependency/taint rules are explicit circuit policy.
  const update=(record,operation)=>({value:I(E(P(record,['value']),null),null,Rat(P(record,['value']),operation,G('amount'))),delta:Rat(P(record,['delta']),operation,G('amount')),evidence:C(P(record,['evidence']),[G('evidence')]),tainted:P(record,['tainted'])});
  for(const [name,op] of [['set',null],['increment','+'],['decrement','-'],['transfer','-']]) {
    c=new Proposal('state.event.'+name);
    let quantities=put(G('state','quantities'),G('key'),op?update(G('old'),op):{value:G('amount'),delta:'0',evidence:[G('evidence')],tainted:[]});
    if(name==='transfer') quantities=Assert(A(N(E(P(G('event'),['recipient']),null)),N(E(G('event','recipient'),'')),N(E(G('event','recipient'),G('event','owner')))),'Transfer requires a distinct recipient',Let({other:key(G('event','recipient'),G('event','item'),G('context')),quantities},put(G('quantities'),G('other'),update(P(G('quantities'),[G('other')],emptyRecord),'+'))));
    circuits.push(c.finish(M(G('state'),{quantities})));
  }
  c=new Proposal('state.event.invalid');circuits.push(c.finish(Assert(false,'Invalid quantity event',G('state'))));
  c=new Proposal('state.entry.quantity');
  // Keep the parameter environment explicit: no closure over a native mutable world.
  c.expression('event',M(G('entry','event'),{evidence:G('evidence')}),'object');
  c.expression('context',P(G('event'),['context'],'world'),'string');c.expression('amount',Let({normalized:Rat(G('event','amount'))},Assert(N(E(Rat(G('normalized'),'compare','0'),-1)),'Quantity events need nonnegative amounts',G('normalized'))),'string');
  c.expression('key',key(G('event','owner'),G('event','item'),G('context')),'string');c.expression('old',P(G('state','quantities'),[G('key')],emptyRecord),'object');
  c.call('dispatch','learned.semantic.event',{input:{operation:G('event','operation')}});
  c.choose('updated',R('dispatch'),Object.fromEntries(['set','increment','decrement','transfer'].map(n=>[n,'state.event.'+n])),'state.event.invalid',M(common(),{event:G('event'),context:G('context'),amount:G('amount'),key:G('key'),old:G('old')}));
  circuits.push(c.finish(Let({quantities:G('updated','quantities'),after:P(G('updated','quantities'),[G('key')]),inconsistency:M(G('evidence'),{reason:'negative-inventory'})},Let({invalid:A(N(E(G('after','value'),null)),E(Rat(G('after','value'),'compare','0'),-1))},M(G('updated'),{
    quantities:I(G('invalid'),Let({marked:put(G('quantities'),G('key'),M(G('after'),{tainted:C(G('after','tainted'),[G('inconsistency')])}))},I(A(E(G('dispatch'),'transfer'),E(L(G('old','tainted')),0)),Let({other:key(G('event','recipient'),G('event','item'),G('context')),recipient:P(G('marked'),[G('other')])},put(G('marked'),G('other'),M(G('recipient'),{tainted:C(G('recipient','tainted'),[G('inconsistency')])}))),G('marked'))),G('quantities')),
    events:C(G('state','events'),[G('event')])
  })))));
  c=new Proposal('state.apply-entry');
  c.expression('evidence',Assert(A(N(E({$compare:[G('entry','span','start'),0]},-1)),N(E({$compare:[G('entry','span','end'),L(G('document','source','text'))]},1)),E({$compare:[G('entry','span','start'),G('entry','span','end')]},-1)),'Invalid evidence span',{source:G('document','source','id'),start:G('entry','span','start'),end:G('entry','span','end')}),'object');
  c.call('dispatch','learned.semantic.entry',{input:{kind:G('entry','kind')}});
  c.choose('applied',R('dispatch'),Object.fromEntries(['fact','rule','quantity','gap','ignore'].map(n=>[n,'state.entry.'+n])),'state.entry.invalid',common());circuits.push(c.finish(G('applied')));
  c=new Proposal('state.apply-step',{value:'object',entry:'object'});
  c.call('applied','state.apply-entry',{state:G('value','state'),document:G('value','document'),entry:G('entry')});circuits.push(c.finish(M(G('value'),{state:G('applied')})));
  c=new Proposal('state.apply');
  c.expression('initial',Assert(A(E(G('state','schema'),'sxlm.world.v1'),E(G('document','schema'),'sxlm.document.v1')),'Invalid world/document schema',{state:M(G('state'),{sources:I(Has(Map(G('state','sources'),G('item','id')),G('document','source','id')),G('state','sources'),C(G('state','sources'),[G('document','source')])),labels:M(G('state','labels'),G('document','labels'))}),document:G('document')}),'object');
  const entries=c.expression('entries',G('document','entries'),'array');c.program.nodes.push({id:'folded',fold:'state.apply-step',item:'entry',accumulator:'value',initial:R('initial'),items:entries,args:{}});c.keep('folded',R('folded'));
  circuits.push(c.finish(M(G('folded','state'),{revision:Num(G('state','revision'),'+',1)})));
  c=new Proposal('state.quantity');
  circuits.push(c.finish(Let({record:P(G('state','quantities'),[key(G('owner'),G('item'),P(G('task'),['context'],'world'))])},I(E(P(G('record'),['value']),null),{known:false,reason:'missing-initial-value',delta:P(G('record'),['delta'],'0'),evidence:P(G('record'),['evidence'],[])},I(N(E(L(G('record','tainted')),0)),{known:false,reason:'uninterpreted-or-inconsistent-event',lastKnownValue:G('record','value'),gaps:G('record','tainted'),evidence:G('record','evidence')},{known:true,value:G('record','value'),evidence:G('record','evidence')})))));
  c=new Proposal('solve.quantity');c.call('answer','state.quantity',{state:G('state'),owner:G('task','owner'),item:G('task','item'),task:G('task')});
  circuits.push(c.finish(M({kind:'quantity',status:I(G('answer','known'),'answered','unknown')},G('answer'),{task:G('task'),completeness:I(G('answer','known'),'query-dependencies-resolved','incomplete')})));
  c=new Proposal('solve.arithmetic');c.op('answer','math.expression',{text:c.expression('expression',G('task','expression'),'string')});
  circuits.push(c.finish(I(G('answer','ok'),{kind:'arithmetic',status:'answered',value:G('answer','value'),task:G('task'),method:'exact-rational-arithmetic'},{kind:'arithmetic',status:'unsupported',reason:G('answer','error'),task:G('task')})));
  c=new Proposal('solve.unsupported');circuits.push(c.finish(Assert(false,'No solver for task type',G('task'))));
  c=new Proposal('solve.logic');
  c.op('closure','relation.close',{state:c.expression('state',G('state'),'object')});
  c.op('answer','relation.query',{closure:R('closure'),patterns:c.expression('patterns',G('task','patterns'),'array')});
  c.expression('roots',{$flatten:Map(C(G('answer','rows'),G('answer','counterevidence')),G('item','premises'))},'array');
  c.op('proofs','relation.tree',{closure:R('closure'),roots:R('roots'),depth:6});c.op('certificate','relation.certificate',{closure:R('closure'),roots:R('roots')});
  circuits.push(c.finish(Let({base:{task:G('task'),proofs:G('proofs'),certificate:G('certificate'),completeness:'open-world',inferenceComplete:G('closure','complete')}},I(E(G('task','kind'),'truth'),M(G('base'),{kind:'truth',status:I(E(G('answer','truth'),'unknown'),'unknown','answered'),truth:G('answer','truth'),witness:P(G('answer'),['rows',0,'bindings'],{})}),Let({values:{$sort:{$unique:{$filter:{items:Map(G('answer','rows'),P(G('item','bindings'),[G('task','variable')])),test:A(N(E(G('item'),null)),N(E(G('item'),'')))}}}}},M(G('base'),{kind:'select',status:I(E(L(G('values')),0),'unknown','answered'),values:G('values'),bindings:G('answer','rows')}))))));
  c=new Proposal('solve.task');c.call('dispatch','learned.semantic.solver',{input:{kind:G('task','kind')}});c.choose('answer',R('dispatch'),Object.fromEntries(['logic','quantity','arithmetic'].map(n=>[n,'solve.'+n])),'solve.unsupported',{state:G('state'),task:G('task')});circuits.push(c.finish(G('answer')));
  c=new Proposal('interpret.apply');
  c.call('applied','state.apply',{state:G('value','state'),document:M(G('value','document'),{entries:[G('entry')]})});circuits.push(c.finish(M(G('value'),{state:G('applied'),changed:true})));
  c=new Proposal('interpret.query');
  c.call('answer','solve.task',{state:G('value','state'),task:G('entry','query')});circuits.push(c.finish(M(G('value'),{answers:C(G('value','answers'),[M(G('answer'),{querySpan:G('entry','span'),coverage:G('value','document','coverage'),gaps:G('value','state','gaps')})])})));
  c=new Proposal('interpret.unsupported');circuits.push(c.finish(M(G('value'),{answers:C(G('value','answers'),[{kind:'acknowledgement',status:'unsupported',coverage:G('value','document','coverage'),gaps:[G('entry')],querySpan:G('entry','span')}])})));
  c=new Proposal('interpret.step',{value:'object',entry:'object'});c.call('dispatch','learned.semantic.instruction',{input:{kind:G('entry','kind'),intent:P(G('entry'),['intent'],'')}});c.choose('resultValue',R('dispatch'),{'query':'interpret.query','unsupported':'interpret.unsupported'},'interpret.apply',{value:G('value'),entry:G('entry')});circuits.push(c.finish(G('resultValue')));
  c=new Proposal('world.interpret');
  c.expression('initial',{state:G('state'),document:G('document'),answers:[],changed:false},'object');c.expression('entries',G('document','entries'),'array');
  c.program.nodes.push({id:'folded',fold:'interpret.step',item:'entry',accumulator:'value',initial:R('initial'),items:R('entries'),args:{}});c.keep('folded',R('folded'));
  circuits.push(c.finish({state:M(G('folded','state'),{revision:Num(G('state','revision'),'+',I(G('folded','changed'),1,0))}),answers:I(E(L(G('folded','answers')),0),[{kind:'acknowledgement',status:I(E(G('document','coverage','gaps'),0),'acknowledged','unsupported'),facts:Num(L(G('folded','state','facts')),'-',L(G('state','facts'))),rules:Num(L(G('folded','state','rules')),'-',L(G('state','rules'))),events:Num(L(G('folded','state','events')),'-',L(G('state','events'))),coverage:G('document','coverage'),gaps:G('folded','state','gaps')}],G('folded','answers')),document:G('document'),committedChanges:G('folded','changed')}));
  c=new Proposal('state.initial');circuits.push(c.finish(emptyState));
  // Semantic lowering is also executable policy, including binding and scope choices.
  c=new Proposal('lower.bindings');
  circuits.push(c.finish(Let({symbols:{$unique:{$filter:{items:{$leaves:G('terms')},test:I(E({$type:G('item')},'string'),{$startsWith:[G('item'),'_:']},false)}}}},{$record:Map(G('symbols'),[G('item'),{$format:{pattern:'?e{index}',values:{index:G('index')}}}])})));
  c=new Proposal('lower.atom');
  c.op('validated','relation.validateAtom',{atom:R('$value'),ground:true});
  circuits.push(c.finish(Assert(N(A(P(G('validated'),['negative'],false),N(E(L({$filter:{items:G('validated','terms'),test:{$startsWith:[G('item'),'_:']}}}),0)))),'Negative existential assertions require universal scope',{kind:'fact',atom:G('validated')})));
  c=new Proposal('lower.pattern');c.op('validated','relation.validateAtom',{atom:R('$value'),ground:false});circuits.push(c.finish(G('validated')));
  c=new Proposal('lower.assert');
  c.expression('atoms',Assert(N(E(L(G('atoms')),0)),'Assertion needs atoms',G('atoms')),'array');
  c.program.nodes.push({id:'instructions',map:'lower.atom',item:'value',items:R('atoms'),args:{}});c.program.output=R('instructions');circuits.push(c.program);
  c=new Proposal('lower.rule-head');
  c.expression('rule',Assert(E(L({$filter:{items:G('head','terms'),test:{$startsWith:[G('item'),'_:']}}}),0),'Existential rule conclusions are not supported by finite Datalog',{body:G('body'),head:G('head')}),'object');
  c.op('validated','kernel.relation.validateRule',{rule:R('rule')});circuits.push(c.finish({kind:'rule',rule:G('validated')}));
  c=new Proposal('lower.rule');c.call('bindings','lower.bindings',{terms:G('body')});
  c.expression('body',{$substitute:{value:G('body'),bindings:G('bindings')}},'array');
  c.expression('heads',Assert(N(E(L(G('heads')),0)),'Rule needs a conclusion',Map({$substitute:{value:G('heads'),bindings:G('bindings')}},{body:G('body'),head:G('item')})),'array');
  c.program.nodes.push({id:'instructions',map:'lower.rule-head',item:'value',items:R('heads'),args:{}});c.program.output=R('instructions');circuits.push(c.program);
  c=new Proposal('lower.query');c.call('bindings','lower.bindings',{terms:G('query')});c.expression('query',{$substitute:{value:G('query'),bindings:G('bindings')}},'object');
  c.expression('patterns',P(G('query'),['patterns'],[]),'array');c.program.nodes.push({id:'validated',map:'lower.pattern',item:'value',items:R('patterns'),args:{}});
  circuits.push(c.finish([{kind:'query',query:G('query')}],'array'));
  c=new Proposal('lower.quantity');circuits.push(c.finish([{kind:'quantity',event:G('event')}],'array'));
  c=new Proposal('lower.invalid');circuits.push(c.finish(Assert(false,'Unknown semantic instruction',[]),'array'));
  c=new Proposal('document.lower');c.call('dispatch','learned.semantic.lowering',{input:{kind:G('kind')}});
  // Choice takes the original semantic value, not the classifier result.
  c.program.nodes.push({id:'instructions',choose:{selector:R('dispatch'),cases:Object.fromEntries(['assert','rule','query','quantity'].map(n=>[n,'lower.'+n])),otherwise:'lower.invalid'},args:{value:R('$value')}});
  c.program.output=R('instructions');circuits.push(c.program);
  return circuits;
}
