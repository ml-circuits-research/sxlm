import { CircuitRuntime } from '../../src/kernel/circuit.mjs';
import { installTermPrimitives } from '../../src/kernel/terms.mjs';
import { installCollectionPrimitives } from '../../src/kernel/collections.mjs';
import { installValuePrimitives } from '../../src/kernel/values.mjs';
import { compileModule } from '../../src/learning/sop-output.mjs';
import { readPack, bootstrapURL } from '../../src/learning/packs.mjs';

// Explicitly install the shipped SOP lexical policy for standalone parser tests.
// There is no corresponding native fallback in Grammar.
export function installLexical(runtime) {
  const reference=installValuePrimitives(installCollectionPrimitives(installTermPrimitives(new CircuitRuntime())));
  for(const [name,primitive]of reference.primitives)if(!runtime.primitives.has(name))runtime.primitive(name,primitive);
  let pending=readPack(bootstrapURL).sop.filter(m=>m.id.startsWith('lexical.')||m.id==='learned.lexical.normalize').map(compileModule);
  while(pending.length){
    const next=pending.filter(c=>{if(!runtime.dependenciesReady(c))return true;runtime.compile(c);return false;});
    if(next.length===pending.length)throw Error('Unresolvable lexical test policy');pending=next;
  }
  return{prepare:'lexical.prepare',tokenize:'lexical.tokenize',terminal:'lexical.match'};
}
