import {check,copy,digest} from './data.mjs';

/** Statically bind an ordered provider set through an explicitly supplied reducer. */
export function linkProviders(specification, providers) {
  const {id,slot,seed,reducer}=specification;
  check([id,slot,seed,reducer].every(s=>typeof s==='string'&&s.length>0),'Invalid provider linkage');
  check(Array.isArray(providers)&&providers.every(p=>typeof p==='string'),'Invalid provider list');
  check(providers.length<=127,'Provider linkage exceeds the 256-node circuit bound');
  const nodes=[{id:'seed',call:seed,args:{with:{ref:'$with'}}}];let previous='seed';
  providers.forEach((provider,i)=>{nodes.push({id:'provider'+i,call:provider,args:{with:{ref:'$with'}}},{id:'reduce'+i,call:reducer,args:{state:{ref:previous},item:{ref:'provider'+i},with:{ref:'$with'}}});previous='reduce'+i;});
  return{schema:'sxlm.circuit.v1',id,inputs:{with:'object'},nodes,output:{ref:previous},provenance:{kind:'compiled-provider-linkage',specification:copy(specification),providers:[...providers]},compilation:{algorithm:'static-provider-fold-v1',inputHash:digest({specification,providers})}};
}
