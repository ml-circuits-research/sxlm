import { CircuitRuntime } from '../kernel/circuit.mjs';
import { installTermPrimitives } from '../kernel/terms.mjs';
import { installCollectionPrimitives } from '../kernel/collections.mjs';
import { installValuePrimitives } from '../kernel/values.mjs';
import { check, canonical, executionDigest, immutableCopy } from '../kernel/data.mjs';
import { runtimeIdentity } from '../runtime-identity.mjs';
import { compileModule } from './sop-output.mjs';
import { readPack, bootstrapURL } from './packs.mjs';

const defaults = { tokenize:'lexical.tokenize', segment:'text.segment' };
const dependencies = node => node.iterate ? [node.iterate,node.guard] : node.choose ? [...Object.values(node.choose.cases),node.choose.otherwise] : node.op ? [] : [node.call??node.map??node.fold??node.attempt];

/** Capture the exact transitive SOP policy used by offline text learning. */
export function textPolicyFromModules(modules, entrypoints=defaults) {
  const byId=new Map();
  for(const module of modules){check(!byId.has(module.id),'Duplicate text-policy module: '+module.id);byId.set(module.id,module);}
  const selected=new Map(),visiting=new Set();
  function visit(id){
    if(selected.has(id))return;
    check(!visiting.has(id),'Cyclic text policy: '+id);visiting.add(id);
    const module=byId.get(id);check(module,'Missing text-policy dependency: '+id);
    for(const node of compileModule(module).nodes)for(const target of dependencies(node))visit(target);
    visiting.delete(id);selected.set(id,module);
  }
  check(canonical(Object.keys(entrypoints).sort())===canonical(['segment','tokenize'])&&Object.values(entrypoints).every(id=>typeof id==='string'),'Invalid text-policy entrypoints');
  for(const id of Object.values(entrypoints))visit(id);
  return immutableCopy({schema:'sxlm.text-policy.v1',entrypoints,sop:[...selected.values()]});
}

export function textPolicyForModel(model) {
  return textPolicyFromModules(model.packs.flatMap(pack=>pack.sop??[]),{tokenize:model.resources.entrypoints.tokenize,segment:'text.segment'});
}

export function textPolicyIdentity(runtime,entrypoints) {
  return executionDigest({runtime:runtime.identity,entrypoints:Object.fromEntries(Object.entries(entrypoints).map(([name,id])=>{
    const program=runtime.programs.get(id);check(program,'Missing text policy: '+id);return[name,{id,hash:program.hash}];
  }))});
}

/** No host tokenizer fallback: the default is the shipped, explicitly captured SOP policy. */
export function createTextProcessor(policy=textPolicyFromModules(readPack(bootstrapURL).sop)) {
  check(policy?.schema==='sxlm.text-policy.v1','Invalid text-policy schema');
  const captured=textPolicyFromModules(policy.sop,policy.entrypoints);
  check(executionDigest(captured)===executionDigest(policy),'Text policy must contain exactly its dependency closure in dependency order');
  const runtime=installValuePrimitives(installCollectionPrimitives(installTermPrimitives(new CircuitRuntime({identity:runtimeIdentity.hash,cacheSize:256}))));
  for(const module of captured.sop)runtime.compile(compileModule(module));
  for(const [name,inputs]of Object.entries({tokenize:{text:'string'},segment:{text:'string',boundaries:'array',keep:'array'}})){
    const program=runtime.programs.get(captured.entrypoints[name]);
    check(program.pure&&program.output==='array'&&canonical(program.inputs)===canonical(inputs),'Invalid text-policy contract: '+name);
  }
  runtime.seal();
  return Object.freeze({policy:captured,identity:textPolicyIdentity(runtime,captured.entrypoints),
    tokenize:(text,options)=>runtime.execute(captured.entrypoints.tokenize,{text},options),
    segment:(text,{boundaries=[],keep=[]}={},options)=>runtime.execute(captured.entrypoints.segment,{text,boundaries,keep},options)});
}
