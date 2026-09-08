import { modulesFromGraphs, graphsFromModules } from './sop-output.mjs';
import { readFileSync } from 'node:fs';
import { CircuitRuntime, ref } from '../kernel/circuit.mjs';
import { assertData, check, copy, executionDigest, Budget, LimitError } from '../kernel/data.mjs';

const sourceHash=executionDigest(readFileSync(new URL(import.meta.url),'utf8'));
const compatible=(actual,expected)=>expected==='any'||actual===expected;
const valueType=value=>value===null?'any':Array.isArray(value)?'array':typeof value;
const isRef=value=>value&&typeof value==='object'&&Object.keys(value).length===1&&typeof value.ref==='string';
const identifier=value=>typeof value==='string'&&/^[A-Za-z][A-Za-z0-9._-]*$/.test(value);

/** An offline evaluator of the same typed graph semantics, never a source interpreter. */
function evaluator(runtime){
  const vm=new CircuitRuntime({identity:runtime.identity,cacheSize:0});
  for(const[name,validate]of runtime.types)if(!vm.types.has(name))vm.type(name,validate);
  for(const[name,primitive]of runtime.primitives)vm.primitive(name,primitive);
  for(const compiled of runtime.programs.values())vm.compile(compiled.program);
  return vm;
}

function graph(id,inputs,term,library){
  const nodes=[],emitted=new Map(),quoted=new Map();
  function literal(value,expected='any'){
    if(!isRef(value))return copy(value);
    const key=executionDigest({value,expected});if(quoted.has(key))return quoted.get(key);
    const get='n'+nodes.length;nodes.push({id:get,op:'data.get',args:{value:{quoted:copy(value)},path:['quoted']}});
    let result=ref(get);
    if(expected!=='any'){const cast='n'+nodes.length;nodes.push({id:cast,op:'data.'+expected,args:{value:result}});result=ref(cast);}
    quoted.set(key,result);return result;
  }
  function emit(t){
    if(t.kind==='input')return ref('$'+t.name);
    if(t.kind==='constant')return literal(t.value,t.type);
    if(emitted.has(t.key))return emitted.get(t.key);
    const entry=library[t.operator],args={};
    for(const[name,type]of Object.entries(entry.inputs))args[name]=Object.hasOwn(entry.bind,name)?literal(entry.bind[name],type):emit(t.args[name]);
    const name='n'+nodes.length;nodes.push({id:name,[entry.kind]:entry.name,args});const result=ref(name);emitted.set(t.key,result);return result;
  }
  let output=emit(term);
  if(!isRef(output)){
    const name='n'+nodes.length;nodes.push({id:name,op:'data.get',args:{value:{quoted:output},path:['quoted']}});output=ref(name);
    if(term.type!=='any'){const cast='n'+nodes.length;nodes.push({id:cast,op:'data.'+term.type,args:{value:output}});output=ref(cast);}
  }
  return{schema:'sxlm.circuit.v1',id,inputs:copy(inputs),nodes,output};
}

/** Bounded bottom-up synthesis over a teacher-supplied library of pure typed operations. */
export function synthesizeProgram(runtime,specification){
  assertData(specification);
  check(runtime.identity!=='unversioned-host','Synthesis requires an explicitly versioned runtime');
  const {id,inputs,output,examples,library:proposals,constants=[]}=specification;
  check(identifier(id)&&!runtime.programs.has(id),'Synthesis needs a new circuit identity');
  check(inputs&&typeof inputs==='object'&&!Array.isArray(inputs)&&Object.keys(inputs).length>0&&Object.keys(inputs).every(identifier),'Invalid synthesis inputs');
  const types=runtime.types;
  check(types.has(output)&&Object.values(inputs).every(t=>types.has(t)),'Unknown synthesis type');
  check(Array.isArray(examples)&&examples.length>=2&&examples.length<=64,'Synthesis requires 2–64 examples');
  check(Array.isArray(constants)&&constants.length<=16,'Invalid synthesis constants');
  const seenInputs=new Map();
  for(const example of examples){
    check(example.input&&Object.keys(example.input).length===Object.keys(inputs).length&&Object.entries(inputs).every(([name,type])=>Object.hasOwn(example.input,name)&&types.get(type)(example.input[name])),'Invalid training input');
    check(types.get(output)(example.output),'Invalid training output');
    const key=executionDigest(example.input),value=executionDigest(example.output);
    check(!seenInputs.has(key)||seenInputs.get(key)===value,'Conflicting training outputs');seenInputs.set(key,value);
  }
  check(seenInputs.size>=2,'At least two distinct training inputs are required');
  check(Array.isArray(proposals)&&proposals.length>0&&proposals.length<=32,'Supply 1–32 library operations');
  const primitives=runtime.primitives,programs=runtime.programs;
  const library=proposals.map(entry=>{
    const keys=['op','call'].filter(k=>Object.hasOwn(entry,k));check(keys.length===1,'Library entries require one op or call');
    const kind=keys[0],name=entry[kind],target=(kind==='op'?primitives:programs).get(name);
    check(target?.pure,'Synthesis only accepts installed pure operations');
    const bind=entry.bind??{};check(bind&&typeof bind==='object'&&!Array.isArray(bind),'Invalid bound arguments');
    for(const[key,value]of Object.entries(bind))check(Object.hasOwn(target.inputs,key)&&types.get(target.inputs[key])(value),'Invalid bound library argument');
    const identity=kind==='call'?target.hash:executionDigest({runtime:runtime.identity,name,inputs:target.inputs,output:target.output,version:target.version,pure:target.pure});
    return{kind,name,inputs:target.inputs,output:target.output,bind:copy(bind),identity};
  });
  const limits={applications:4,candidates:10000,representatives:1500,milliseconds:10000,...specification.limits};
  check(Object.keys(limits).every(k=>['applications','candidates','representatives','milliseconds'].includes(k)),'Unknown synthesis limit');
  check(Object.values(limits).every(v=>Number.isInteger(v)&&v>0)&&limits.applications<=8&&limits.candidates<=100000&&limits.representatives<=10000&&limits.milliseconds<=60000,'Invalid synthesis limits');
  const budget=new Budget({candidates:limits.candidates,representatives:limits.representatives,milliseconds:limits.milliseconds});
  const vm=evaluator(runtime),specificationHash=executionDigest(specification);
  library.forEach((entry,index)=>{
    const args=Object.fromEntries(Object.entries(entry.inputs).filter(([name])=>!Object.hasOwn(entry.bind,name)).map(([name,type])=>[name,{kind:'input',name,type}]));
    const term={kind:'application',operator:index,args,type:entry.output,key:'operator'+index};
    const wrapper=graph('synthesis.'+specificationHash+'.'+index,Object.fromEntries(Object.entries(entry.inputs).filter(([name])=>!Object.hasOwn(entry.bind,name))),term,library);
    vm.compile(wrapper);entry.wrapper=wrapper.id;
  });
  const pools=Array.from({length:limits.applications+1},()=>[]),observations=new Map();let evaluated=0,rejected=0,pruned=0;
  const expected=executionDigest(examples.map(e=>e.output));
  const receipt=()=>({schema:'sxlm.derivation.v1',kind:'supervised-program-synthesis',algorithm:'typed-observational-search-v1',learnerHash:sourceHash,runtime:runtime.identity,specificationHash,trainingHash:executionDigest(examples),trainingCount:examples.length,uniqueTrainingInputs:seenInputs.size,library:library.map(({wrapper,...entry})=>entry),limits:copy(limits),evaluated,rejected,pruned,retained:observations.size,
    hypothesisClass:'Straight-line typed compositions over supplied pure operations and constants, with observational pruning. Equivalent observed values share a representative; search is not complete over all programs and does not establish a unique or universally correct solution.'});
  let winner;
  function retain(term){
    if(compatible(term.type,output)&&executionDigest(term.values)===expected){winner=term;return true;}
    const key=executionDigest({type:term.type,values:term.values});
    if(observations.has(key)){pruned++;return false;}
    budget.tick('representatives');observations.set(key,term);pools[term.cost].push(term);return false;
  }
  function applications(entry,index,cost){
    const names=Object.keys(entry.inputs).filter(name=>!Object.hasOwn(entry.bind,name)),args={};
    function choose(position,remaining){
      if(winner)return;
      if(position===names.length){
        if(remaining!==0)return;
        budget.tick('candidates');evaluated++;
        const values=[];
        try{
          for(let row=0;row<examples.length;row++){
            budget.tick();const input=Object.fromEntries(names.map(name=>[name,args[name].values[row]]));
            values.push(vm.execute(entry.wrapper,input,{cache:false,budget}));
          }
        }catch(error){if(error instanceof LimitError)throw error;rejected++;return;}
        const term={kind:'application',operator:index,args:{...args},type:entry.output,cost,values,key:executionDigest({operator:index,args:Object.fromEntries(names.map(name=>[name,args[name].key]))})};
        retain(term);return;
      }
      const name=names[position];
      for(let size=0;size<=remaining;size++)for(const term of pools[size])if(compatible(term.type,entry.inputs[name])){
        args[name]=term;choose(position+1,remaining-size);if(winner)return;
      }
    }
    choose(0,cost-1);
  }
  try{
    for(const[name,type]of Object.entries(inputs))if(retain({kind:'input',name,type,cost:0,values:examples.map(e=>copy(e.input[name])),key:executionDigest({input:name})}))break;
    if(!winner)for(const value of constants)if(retain({kind:'constant',value:copy(value),type:valueType(value),cost:0,values:examples.map(()=>copy(value)),key:executionDigest({constant:value})}))break;
    for(let cost=1;cost<=limits.applications&&!winner;cost++)for(const[ index,entry]of library.entries()){applications(entry,index,cost);if(winner)break;}
  }catch(error){if(!(error instanceof LimitError))throw error;return{status:'budget-exceeded',resource:error.resource,receipt:receipt()};}
  if(!winner)return{status:'not-found-within-bounds',receipt:receipt()};
  const circuit=graph(id,inputs,winner,library),compiled=vm.compile(circuit);
  check(compatible(compiled.output,output),'Synthesized result violates its declared output type');
  check(examples.every(e=>executionDigest(vm.execute(id,e.input,{cache:false,budget:new Budget()}))===executionDigest(e.output)),'Generated graph failed training replay');
  const learning={...receipt(),mode:winner.kind==='constant'?'constant-output-memory':winner.kind==='input'?'input-projection':'compositional-program',applicationCost:winner.cost,graphNodes:circuit.nodes.length,circuitHash:executionDigest(circuit),fit:examples.length};
  const modules=modulesFromGraphs([{...circuit,learning,provenance:{kind:'supervised-program-synthesis'}}]);
  const sourceVM=evaluator(runtime); for(const program of graphsFromModules(modules))sourceVM.compile(program);
  check(examples.every(e=>executionDigest(sourceVM.execute(id,e.input,{cache:false}))===executionDigest(e.output)),'SOP source failed training replay');
  return{status:'synthesized',modules,receipt:learning};
}

export function learnProgramPack(model,specification){
  const result=synthesizeProgram(model.runtime,specification);
  check(result.status==='synthesized',`Program synthesis ${result.status}${result.resource?': '+result.resource:''}`);
  return{schema:'sxlm.pack.v1',id:specification.id,version:'1.0.0',provenance:{kind:'supervised-program-synthesis',parentModel:model.resources.hash,algorithm:result.receipt.algorithm,specificationHash:result.receipt.specificationHash},
    dependencies:model.resources.manifests.map(({id,hash})=>({id,hash})),sop:result.modules,
    training:{schema:'sxlm.training.v1',algorithm:result.receipt.algorithm,specification:copy(specification)},evaluations:[]};
}
