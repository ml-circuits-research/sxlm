import { encodeSOP, decodeSOP } from '../kernel/sop-data.mjs';
import {check,digest} from '../kernel/data.mjs';
import {createTextProcessor} from './text-policy.mjs';
import {lookupModules,memoryModules} from './memory.mjs';

/** Offline sequence learning. The deployed artifact contains executable SOP, never runtime count tables. */
export function learnSequencePack(texts,{order=4,boundaries=[],id,parentModel=null,textPolicy,origin={kind:'provided-training-text'}}={}) {
  check(Number.isInteger(order)&&order>=1&&order<=8,'Sequence order must be 1–8');
  check(Array.isArray(texts)&&texts.length<=1000&&texts.every(text=>typeof text==='string'&&text.length<=200000),'Invalid training texts');
  check(Array.isArray(boundaries)&&boundaries.every(x=>typeof x==='string'),'Invalid training boundaries');
  const processor=createTextProcessor(textPolicy);
  const specification={texts,order,boundaries,parentModel,origin,textPolicy:processor.policy},trainingHash=digest(specification),name=id??'sequence-'+trainingHash.slice(0,16),counts=new Map();
  check(/^[a-z0-9][a-z0-9._-]{0,80}$/.test(name),'Invalid learned pack identity');
  for(const text of texts)for(const span of processor.segment(text,{boundaries,keep:boundaries})){
    const tokens=processor.tokenize(span.text).map(t=>t.value);
    for(let i=0;i<tokens.length;i++)for(let size=0;size<=Math.min(order-1,i);size++){
      const key=encodeSOP(tokens.slice(i-size,i),{sources:false}),row=counts.get(key)??new Map();
      row.set(tokens[i],(row.get(tokens[i])??0)+1);counts.set(key,row);
    }
  }
  const learning={schema:'sxlm.derivation.v1',kind:'sequence-frequency-induction',algorithm:'count-and-paged-lookup-v2',trainingHash,trainingCount:texts.length,textPolicy:processor.identity,contexts:counts.size,order,parentModel,origin};
  const sourceLearning={...learning,kind:'source-observation-memory',qualification:'Remembered source observations; not an induced reasoning rule.'};
  const prefix='memory.'+name;
  const sop=[
    ...lookupModules(prefix+'.distribution',[...counts].map(([key,row])=>[key,[...row].map(([token,count])=>({token,count}))]),{fallback:[],learning}),
    ...memoryModules(prefix+'.sources',texts.map(text=>({id:digest(text),text})),sourceLearning),
    ...memoryModules(prefix+'.limit',order-1,{...learning,kind:'training-parameter-memory',qualification:'The context bound is a supplied training parameter.'}),
  ];
  return{schema:'sxlm.pack.v1',id:name,version:'1',provenance:{kind:'sequence-frequency-induction',trainingHash,parentModel,origin,textPolicy:processor.identity},sop,providers:{'completion-distributions':[prefix+'.distribution'],'completion-sources':[prefix+'.sources'],'completion-context-limit':[prefix+'.limit']},training:{schema:'sxlm.training.v1',algorithm:'sequence-pack-v1',packId:name,specification}};
}
export const trainSequence=learnSequencePack;
