import { graphsFromModules } from '../src/learning/sop-output.mjs';
import { decodeSOP } from '../src/kernel/sop-data.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {SymbolicModel} from '../src/model.mjs';
import {synthesizeProgram,learnProgramPack} from '../src/learning/search.mjs';
import {executionDigest,canonical} from '../src/kernel/data.mjs';
import {evaluate} from '../src/learning/evaluate.mjs';
import {validateCandidate,promote,rollback,loadRegistry,preparePacket} from '../src/learning/workflow.mjs';
import {coverageGates} from '../eval/program-cases.mjs';

const model=new SymbolicModel(),spec=decodeSOP(readFileSync(new URL('../examples/learn-coverage.sop',import.meta.url),'utf8'));
const pack=learnProgramPack(model,spec),trained=new SymbolicModel({packs:[...model.packs,pack]});

test('typed program synthesis finds a reusable composition and reproduces it exactly',()=>{
  assert.equal(pack.sop[0].learning.applicationCost,3);
  assert.ok(graphsFromModules(pack.sop)[0].nodes.length>=2);
  assert.equal(executionDigest(learnProgramPack(model,spec)),executionDigest(pack));
  assert.equal(trained.resources.runtime.hash,model.resources.runtime.hash);
  assert.equal(trained.runtime.primitives.size,model.runtime.primitives.size);
  assert.ok(!model.resources.runtime.sourceFiles.some(f=>f.path.includes('learning/search')));
  const gates=coverageGates();assert.equal(evaluate(model,gates).passed,0);
  assert.equal(evaluate(trained,gates).passed,gates.length);
  assert.equal(evaluate(new SymbolicModel({packs:[...model.packs,{...pack,sop:[]}]}),gates).passed,0);
  const evidenceRemoved=structuredClone(pack);delete evidenceRemoved.training;
  assert.equal(evaluate(new SymbolicModel({packs:[...model.packs,evidenceRemoved]}),gates).passed,gates.length);
});

test('a learned procedure can be a typed library member in a separately synthesized procedure',()=>{
  const next={id:'learned.incomplete',inputs:spec.inputs,output:'boolean',library:[{call:spec.id},{op:'kernel.boolean.not'}],examples:spec.examples.map(e=>({input:e.input,output:!e.output})),limits:{applications:2}};
  const underconstrained=learnProgramPack(trained,{...next,id:'learned.incomplete-weak',examples:next.examples.slice(0,4)});
  const weakModel=new SymbolicModel({packs:[...trained.packs,underconstrained]});
  assert.ok(evaluate(weakModel,coverageGates('learned.incomplete-weak').map(g=>({...g,expect:{value:!g.expect.value}}))).failed>0,'Reusing a method still requires role-disambiguating examples');
  const extension=learnProgramPack(trained,next),combined=new SymbolicModel({packs:[...trained.packs,extension]});
  assert.ok(graphsFromModules(extension.sop)[0].nodes.some(n=>n.call===spec.id));
  const gates=coverageGates(next.id).map(g=>({...g,expect:{value:!g.expect.value}}));
  assert.equal(evaluate(combined,gates).passed,gates.length);
  assert.equal(combined.resources.runtime.hash,model.resources.runtime.hash);
  const stale=structuredClone(extension);stale.dependencies[1].hash='0'.repeat(64);
  assert.throws(()=>new SymbolicModel({packs:[...trained.packs,stale]}),/Unsatisfied pack dependency/);
});

test('the same learner discovers numeric and text compositions from other typed libraries',()=>{
  const numeric={id:'learned.arithmetic-method',inputs:{x:'number',y:'number'},output:'number',constants:[2],library:[{op:'kernel.number.binary',bind:{operation:'add'}},{op:'kernel.number.binary',bind:{operation:'multiply'}}],examples:[{input:{x:1,y:3},output:5},{input:{x:2,y:5},output:9},{input:{x:-1,y:4},output:2}],limits:{applications:2}};
  const text={id:'learned.text-method',inputs:{text:'string'},output:'string',library:[{op:'kernel.text.trim'},{op:'kernel.text.replace',bind:{from:'.',to:'!'}}],examples:[{input:{text:' first. '},output:'first!'},{input:{text:'second.\n'},output:'second!'}],limits:{applications:2}};
  for(const [s,input,expected]of [[numeric,{x:7,y:-9},5],[text,{text:'\tα. β.  '},'α! β!']]){
    const candidate=learnProgramPack(model,s),m=new SymbolicModel({packs:[...model.packs,candidate]});
    assert.deepEqual(m.runtime.execute(s.id,input),expected);assert.equal(m.resources.runtime.hash,model.resources.runtime.hash);
  }
});

test('training fit is insufficient: independent gates reject an underspecified hypothesis',()=>{
  const weak={...spec,id:'learned.weak',examples:[{input:{required:['a'],available:['a']},output:true},{input:{required:['b'],available:[]},output:false}]};
  const candidate=learnProgramPack(model,weak),m=new SymbolicModel({packs:[...model.packs,candidate]});
  assert.equal(candidate.sop[0].learning.fit,2);
  const gates=coverageGates(weak.id);assert.ok(evaluate(m,gates).failed>0);
  assert.equal(validateCandidate(model,candidate,{gates,regressions:[]}).accepted,false);
});

test('failed or bounded searches produce no executable candidate and never imply impossibility',()=>{
  assert.equal(synthesizeProgram(model.runtime,{...spec,limits:{applications:1}}).status,'not-found-within-bounds');
  assert.equal(synthesizeProgram(model.runtime,{...spec,limits:{candidates:1}}).status,'budget-exceeded');
  assert.throws(()=>learnProgramPack(model,{...spec,limits:{candidates:1}}),/budget-exceeded/);
  assert.throws(()=>synthesizeProgram(model.runtime,{...spec,library:[{op:'not-installed'}]}),/pure/);
  assert.throws(()=>synthesizeProgram(model.runtime,{...spec,examples:[spec.examples[0],{...spec.examples[0],output:false}]}),/Conflicting/);
  assert.throws(()=>synthesizeProgram(model.runtime,{...spec,library:[{op:'kernel.seq.count',bind:{unknown:1}}]}),/bound/);
  assert.equal(synthesizeProgram(model.runtime,{...spec,constants:[-0]}).status,'synthesized');
});

test('constant memory is labeled and reference-shaped records cannot become executable wires',()=>{
  const memory={id:'learned.record-memory',inputs:{x:'number'},output:'object',constants:[{ref:'ordinary data'}],library:[{op:'data.object'}],examples:[{input:{x:1},output:{ref:'ordinary data'}},{input:{x:2},output:{ref:'ordinary data'}}]};
  const candidate=learnProgramPack(model,memory),m=new SymbolicModel({packs:[...model.packs,candidate]});
  assert.equal(candidate.sop[0].learning.mode,'constant-output-memory');
  assert.deepEqual(m.runtime.execute(memory.id,{x:7}),{ref:'ordinary data'});
});

test('program learning uses guarded promotion, detects repeated gate inputs, reloads and rolls back',()=>{
  const directory=mkdtempSync(join(tmpdir(),'sxlm-program-registry-'));
  try{
    const gates=coverageGates();assert.equal(validateCandidate(model,pack,{gates,regressions:[]}).accepted,true);
    const leaked={id:'training-replay',task:'circuit',circuit:spec.id,input:spec.examples[0].input,expect:{value:spec.examples[0].output}};
    assert.deepEqual(validateCandidate(model,pack,{gates:[leaked],regressions:[]}).leakedCases,['training-replay']);
    const receipt=promote(directory,pack,{gates,regressions:[]});assert.equal(receipt.receipt.accepted,true);canonical(receipt);
    const loaded=new SymbolicModel({packs:loadRegistry(directory).packs});assert.equal(evaluate(loaded,gates).passed,gates.length);
    rollback(directory);assert.equal(evaluate(new SymbolicModel({packs:loadRegistry(directory).packs}),gates).passed,0);
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test('the CLI can synthesize a self-contained method pack without changing the active registry',()=>{
  const directory=mkdtempSync(join(tmpdir(),'sxlm-program-cli-'));
  try{
    const target=join(directory,'candidate.sop');
    execFileSync(process.execPath,['bin/sxlm.mjs','train','program','examples/learn-coverage.sop','--out',target,'--registry',join(directory,'registry')],{cwd:new URL('../',import.meta.url),encoding:'utf8',timeout:15000});
    const candidate=decodeSOP(readFileSync(target,'utf8'));
    assert.equal(executionDigest(candidate),executionDigest(pack));
    assert.equal(loadRegistry(join(directory,'registry')).active,null);
    const packet=join(directory,'packet');preparePacket(model,spec,packet);
    assert.ok(readFileSync(join(packet,'AGENT-TASK.md'),'utf8').includes('train program'));
    assert.ok(decodeSOP(readFileSync(join(packet,'parent-model.sop'),'utf8')).circuitContracts.some(c=>c.name==='world.interpret'));
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test('the learning audit reproduces method provenance and rejects changed programs or missing derivations',async()=>{
  const {auditVision}=await import('../scripts/audit-vision.mjs');
  const good=auditVision({model:trained});assert.equal(good.programReplays[0].reproduced,true);
  assert.ok(!good.requirements.find(r=>r.id==='all-competence-learned').evidence.withoutVerifiedDerivation.some(c=>c.id===spec.id));
  const modified=structuredClone(pack);modified.sop[0].source=modified.sop[0].source.replace('kernel.seq.difference','kernel.seq.intersection');
  const bad=auditVision({model:new SymbolicModel({packs:[...model.packs,modified]})});assert.equal(bad.programReplays[0].reproduced,false);
  const absent=structuredClone(pack);delete absent.training;
  const missing=auditVision({model:new SymbolicModel({packs:[...model.packs,absent]})});
  assert.ok(missing.requirements.find(r=>r.id==='all-competence-learned').evidence.withoutVerifiedDerivation.some(c=>c.id===spec.id));
});
