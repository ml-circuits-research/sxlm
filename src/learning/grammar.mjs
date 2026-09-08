import {memoryModules} from './memory.mjs';
import {digest,check} from '../kernel/data.mjs';

/** Offline compilation of a supplied grammar proposal. This is not induction. */
export function compileGrammarKnowledge(fragment,{id,origin}){
  check(typeof id==='string'&&/^[a-z0-9][a-z0-9._-]*$/.test(id),'Invalid grammar module identity');
  const knowledgeHash=digest(fragment),provenance={kind:'compiled-grammar-proposal',knowledgeHash,origin,qualification:'Constructor compilation preserves the supplied grammar proposal. Its creation or learning must be established separately.'};
  const sop=memoryModules(id,fragment,{kind:'compiler-input',knowledgeHash}).map(({learning,...module})=>({...module,provenance}));
  return{sop,providers:{'grammar-fragments':[id]},knowledgeHash};
}
