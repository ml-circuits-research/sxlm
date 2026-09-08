import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SymbolicModel,learnSequencePack,validatePack,Budget,digest} from '../src/index.mjs';
import {CircuitRuntime} from '../src/kernel/circuit.mjs';
import {compileSOP} from '../src/kernel/sop.mjs';
import {installTermPrimitives} from '../src/kernel/terms.mjs';
import {installCollectionPrimitives} from '../src/kernel/collections.mjs';
import {memoryModules,lookupModules} from '../src/learning/memory.mjs';
import {linkProviders} from '../src/kernel/link.mjs';
import {complete as reference,trainSequence as oldTrainer} from './reference/text-v1.mjs';

const model=new SymbolicModel(),specification=decodeSOP(readFileSync(new URL('../training/sequence.sop',import.meta.url)));
const config=model.runtime.execute(model.resources.entrypoints.text,{with:{}}),previous=oldTrainer(specification.texts,specification);
const run=(m,prefix,options={},trace=[])=>m.runtime.execute('completion.run',{prefix,config:m.runtime.execute(m.resources.entrypoints.text,{with:{}}),options},{cache:false,trace});
const compile=modules=>{const vm=installCollectionPrimitives(installTermPrimitives(new CircuitRuntime()));for(const m of modules)vm.compile(compileSOP(m.id,m.source));return vm;};
const learning={kind:'test-observation',trainingHash:digest('generated independent test observations')};

test('completion executes SOP and preserves the historical source and frequency contracts',()=>{
  const prefixes=['','The robot','THE robot','The robot ','A symbolic model','x the','x sensor','unattested vocabulary'];
  for(const prefix of prefixes)for(const maxTokens of [1,3,8])for(const context of ['', 'The robot studied quartz. The robot studied copper.']){
    const options={maxTokens,context};assert.deepEqual(run(model,prefix,options),reference(prefix,previous,config,options));
  }
  const trace=[];run(model,'x sensor',{maxTokens:2},trace);
  assert.ok(trace.some(t=>t.circuit.startsWith('memory.bootstrap-sequence.distribution.page')));
  assert.ok(trace.some(t=>t.circuit==='completion.lookup'));
  assert.equal(model.runtime.primitives.has('sequence.complete'),false);
  assert.equal(Object.hasOwn(model,'sequence'),false);assert.equal(Object.hasOwn(model.resources,'corpus'),false);
  for(const maxTokens of [0,1.5,201])assert.throws(()=>run(model,'x',{maxTokens}),/Invalid completion/);
  assert.throws(()=>run(model,'x'.repeat(10001)),/Invalid completion/);
});

test('source evidence preserves UTF-16 offsets, ties and alternative order',()=>{
  const texts=['A 🛰️ sensor records motion.','Quartz glows. Quartz hums! Quartz glows.','Quartz rings. Quartz bends. Quartz shakes. Quartz turns. Quartz moves.'];
  const extension=learnSequencePack(texts,{id:'source-probes',boundaries:specification.boundaries}),extended=new SymbolicModel({packs:[...model.packs,extension]});
  const historical=oldTrainer([...specification.texts,...texts],specification);
  for(const prefix of ['A 🛰️','Quartz','QUARTZ '])for(const maxTokens of [1,8]){
    const result=run(extended,prefix,{maxTokens});assert.deepEqual(result,reference(prefix,historical,config,{maxTokens}));
    for(const evidence of result.evidence){assert.equal(evidence.source,digest(result.source.text));assert.ok(result.source.text.slice(evidence.start,evidence.end).length>0);}
  }
});

test('independent sequence providers add observed counts without native retraining',()=>{
  const left=['A prism rotates slowly.','A prism rotates slowly.'],right=['A prism moves rapidly.'];
  const a=learnSequencePack(left,{id:'left',order:3,boundaries:['.']}),b=learnSequencePack(right,{id:'right',order:3,boundaries:['.']});
  const bootstrap=structuredClone(model.packs[0]);bootstrap.providers=Object.fromEntries(Object.entries(bootstrap.providers).filter(([slot])=>!slot.startsWith('completion-')));
  const extended=new SymbolicModel({packs:[bootstrap,a,b]});
  assert.deepEqual(run(extended,'Unknown prism',{maxTokens:4}),reference('Unknown prism',oldTrainer([...left,...right],{order:3,boundaries:['.']}),config,{maxTokens:4}));
  const distribution=extended.runtime.execute('completion.distribution',{with:{key:encodeSOP(['prism'])}});
  assert.deepEqual(distribution,[{token:'rotates',count:2},{token:'moves',count:1}]);
});

test('learned circuits alone carry source and sequence competence; ablation removes both',()=>{
  const pack=learnSequencePack(['Bright tessera rotates smoothly.'],{id:'tessera-learning',boundaries:['.'],parentModel:model.resources.hash});
  const trained=new SymbolicModel({packs:[...model.packs,pack]});
  assert.equal(run(model,'Odd tessera',{maxTokens:4}).status,'unknown');
  assert.equal(run(trained,'Odd tessera',{maxTokens:4}).text,'Odd tessera rotates smoothly.');
  assert.equal(run(trained,'Bright tessera').grounding,'attested-text');
  const ablated=structuredClone(pack);ablated.providers={};
  assert.equal(run(new SymbolicModel({packs:[...model.packs,ablated]}),'Odd tessera',{maxTokens:4}).status,'unknown');
  const evidenceRemoved=structuredClone(pack);delete evidenceRemoved.training;
  assert.deepEqual(run(new SymbolicModel({packs:[...model.packs,evidenceRemoved]}),'Odd tessera',{maxTokens:4}),run(trained,'Odd tessera',{maxTokens:4}));
  // The native chart parser still captures its model resources and binds its version to
  // their hash. This is known migration debt, not a changed host implementation.
  const identity=m=>digest([...m.runtime.primitives].map(([id,p])=>({id,inputs:p.inputs,output:p.output,implementation:p.run.toString()})));
  assert.equal(identity(model),identity(trained));
  assert.throws(()=>validatePack({schema:'sxlm.pack.v1',id:'raw',version:'1',provenance:{kind:'test'},corpus:['a source']}),/Raw corpus is training input/);
});

test('compiled observation pages support unrelated nested values and arbitrary safe field names',()=>{
  const value={rows:Array.from({length:300},(_,i)=>({'field name':i,nested:[true,null,{x:'λ'+i}]})),empty:[],record:{},negative:-2};
  const modules=memoryModules('observations',value,learning),vm=compile(modules);
  assert.deepEqual(vm.execute('observations',{with:{ignored:'query'}},{cache:false}),value);
  assert.ok([...vm.programs.values()].every(p=>p.program.nodes.length<=128));
  assert.ok(modules.length<value.rows.length/4,'Several observations share each bounded constructor graph');
  assert.throws(()=>vm.execute('observations',{with:{}},{budget:new Budget({nodes:3}),cache:false}),/Budget exceeded/);
});

test('finite-function learning rejects conflicts and lazily retrieves exact observed values',()=>{
  const entries=Array.from({length:512},(_,i)=>['symbol-'+i,{value:i,flags:[i%2===0,null]}]);
  entries.push(['__proto__',{value:-1,flags:[]}],['constructor',{value:-2,flags:[]}]);
  const fallback={value:null,flags:[]},modules=lookupModules('learned.function',entries,{fallback,learning}),vm=compile(modules);
  assert.ok(modules.length<entries.length/2);
  for(const key of ['symbol-0','symbol-127','symbol-511','__proto__','constructor','missing']){
    const trace=[],result=vm.execute('learned.function',{with:{key}},{cache:false,trace});
    assert.deepEqual(result,new Map(entries).get(key)??fallback);
    assert.ok(trace.filter(t=>t.operation==='data.attach').length<200,'Only a selected constructor page may execute');
  }
  assert.throws(()=>vm.execute('learned.function',{with:{key:3}}),/Expected string/);
  assert.throws(()=>lookupModules('bad',[['x',[1]],['x',[2]]],{learning}),/Conflicting/);
  assert.deepEqual(lookupModules('same',[['x',[{a:1,b:-0}]],['x',[{a:1,b:-0}]]],{learning}),
    lookupModules('same',[['x',[{a:1,b:-0}]]],{learning}));
  assert.throws(()=>lookupModules('bad',[['x',[-0]],['x',[0]]],{learning}),/Conflicting/);
  assert.throws(()=>lookupModules('bad',[['x',[{a:1,b:2}]],['x',[{b:2,a:1}]]],{learning}),/Conflicting/);
  assert.throws(()=>lookupModules('bad',[['x',1]],{learning}),/common output type/);
});

test('provider linking preserves order, hashes dependencies and checks contracts and size',()=>{
  const modules=[{id:'seed',source:'@input with object\n@out kernel.seq.empty\n@output result $out'},...['left','right'].map(id=>({id,source:'@input with object\n@out kernel.seq.make item '+JSON.stringify(id)+'\n@output result $out'})),{id:'append',source:'@input state array\n@input item array\n@input with object\n@out kernel.seq.concat left $state right $item\n@output result $out'}];
  const vm=compile(modules),spec={id:'joined',slot:'arbitrary-slot',seed:'seed',reducer:'append'};
  const forward=vm.compile(linkProviders(spec,['left','right']));
  assert.deepEqual(vm.execute('joined',{with:{}}),['left','right']);
  const other=compile(modules),reverse=other.compile(linkProviders(spec,['right','left']));assert.notEqual(forward.hash,reverse.hash);
  assert.throws(()=>vm.compile(linkProviders({...spec,id:'bad'},['missing'])),/Unknown/);
  assert.throws(()=>vm.compile(linkProviders({...spec,id:'bad',reducer:'left'},['right'])),/arity/);
  assert.throws(()=>linkProviders(spec,Array(128).fill('left')),/256-node/);
});

test('sequence find preserves a matching null value instead of replacing it with a fallback',()=>{
  const vm=compile([{id:'find-null',source:'@items kernel.seq.make item null\n@result kernel.seq.find items $items key "x" value null fallback "missing"\n@output result $result'}]);
  assert.equal(vm.execute('find-null',{}),null);
});

test('a sequence learning tag cannot certify changed SOP, wiring or missing training evidence',async()=>{
  const {auditVision}=await import('../scripts/audit-vision.mjs');
  const candidate=learnSequencePack(['Ceramic pivots oscillate.'],{id:'audit-sequence',boundaries:['.']});
  const audit=pack=>auditVision({model:new SymbolicModel({packs:[...model.packs,pack]})});
  const good=audit(candidate);assert.equal(good.demonstratedMigration.sequenceReplays.at(-1).reproduced,true);
  const changed=structuredClone(candidate),body=changed.sop.find(m=>m.source.includes('Ceramic pivots oscillate.'));
  body.source=body.source.replace('Ceramic pivots oscillate.','Ceramic pivots freeze.');
  const rejected=audit(changed);assert.equal(rejected.demonstratedMigration.sequenceReplays.at(-1).reproduced,false);
  assert.ok(rejected.requirements.find(r=>r.id==='all-competence-learned').evidence.withoutVerifiedDerivation.some(c=>c.id===body.id));
  const unwired=structuredClone(candidate);unwired.providers={};assert.equal(audit(unwired).demonstratedMigration.sequenceReplays.at(-1).reproduced,false);
  const undocumented=structuredClone(candidate);delete undocumented.training;
  assert.ok(audit(undocumented).requirements.find(r=>r.id==='all-competence-learned').evidence.withoutVerifiedDerivation.some(c=>c.id.startsWith('memory.audit-sequence.')));
});

test('sequence candidates pass the offline CLI learning and promotion loop with parent checks',async()=>{
  const {mkdtempSync,rmSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{spawnSync}=await import('node:child_process');
  const {validateCandidate}=await import('../src/learning/workflow.mjs');
  const root=new URL('../',import.meta.url),directory=mkdtempSync(join(tmpdir(),'sxlm-sequence-cli-')),candidate=join(directory,'candidate.sop'),registry=join(directory,'registry');
  // Validation runs the full regression suite; this is a harness timeout, not
  // a per-request latency contract. SOP lexical execution increases that work.
  const cli=args=>{const p=spawnSync(process.execPath,['bin/sxlm.mjs',...args,'--registry',registry],{cwd:root,encoding:'utf8',timeout:90000,maxBuffer:8*1024*1024});assert.equal(p.status,0,p.error?.message??p.stderr);return p.stdout.trim();};
  try{
    cli(['train','sequence','examples/learn-sequence.sop','--out',candidate]);
    const pack=decodeSOP(readFileSync(candidate,'utf8'));
    assert.equal(pack.provenance.parentModel,model.resources.hash);
    const gates=decodeSOP(readFileSync(new URL('../examples/sequence-gates.sop',import.meta.url)));
    const wrongParent=structuredClone(pack);wrongParent.provenance.parentModel='0'.repeat(64);
    assert.throws(()=>validateCandidate(model,wrongParent,{gates}),/parent model differs/);
    const receipt=decodeSOP(cli(['train','validate',candidate,'--gates','examples/sequence-gates.sop']));assert.equal(receipt.accepted,true);
    cli(['train','promote',candidate,'--gates','examples/sequence-gates.sop']);
    assert.equal(cli(['complete','Opaque tessera','--max-tokens','4']),'Opaque tessera rotates smoothly.');
    cli(['train','rollback']);
    assert.equal(decodeSOP(cli(['complete','Opaque tessera','--max-tokens','4','--sop'])).status,'unknown');
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test('generic collection contracts validate singleton collation and explicit slice bounds',()=>{
  const vm=compile([
    {id:'order',source:'@input items array\n@out kernel.seq.collate items $items key "label" locale "en"\n@output result $out'},
    {id:'slice',source:'@input items array\n@input start number\n@out kernel.seq.slice items $items start $start end 3\n@output result $out'},
  ]);
  assert.deepEqual(vm.execute('order',{items:[{label:'b'},{label:'a'}]}),[{label:'a'},{label:'b'}]);
  assert.throws(()=>vm.execute('order',{items:[{label:3}]}),/string fields/);
  assert.deepEqual(vm.execute('slice',{items:[0,1,2,3],start:-2}),[2]);
  assert.throws(()=>vm.execute('slice',{items:[],start:0.5}),/integer bounds/);
});
