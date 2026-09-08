import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CircuitRuntime } from '../src/kernel/circuit.mjs';
import { installTermPrimitives } from '../src/kernel/terms.mjs';
import { installCollectionPrimitives } from '../src/kernel/collections.mjs';
import { installValuePrimitives } from '../src/kernel/values.mjs';
import { runtimeIdentity } from '../src/runtime-identity.mjs';
import { synthesizeProgram } from '../src/learning/search.mjs';
import { graphsFromModules } from '../src/learning/sop-output.mjs';
import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';
import { check, executionDigest } from '../src/kernel/data.mjs';

export const lexicalEntrypoints = { lexical:'lexical.prepare',tokenize:'lexical.tokenize',terminal:'lexical.match' };
export function synthesizeLexical() {
  const directory=new URL('../sop/lexical/',import.meta.url);
  const policies=readdirSync(directory).filter(name=>name.endsWith('.sop')).sort().map(name=>({id:'lexical.'+name.slice(0,-4),source:readFileSync(new URL(name,directory),'utf8'),provenance:{kind:'agent-authored-sop-policy',source:'sop/lexical/'+name,qualification:'Lexical policy migration; compilation is not induction.'}}));
  const specification=decodeSOP(readFileSync(new URL('../training/lexical-normalization.sop',import.meta.url)));
  const runtime=installValuePrimitives(installCollectionPrimitives(installTermPrimitives(new CircuitRuntime({identity:runtimeIdentity.hash}))));
  const result=synthesizeProgram(runtime,specification);check(result.status==='synthesized','Lexical normalization synthesis failed: '+result.status);
  const modules=[...policies,...result.modules],evidence={algorithm:result.receipt.algorithm,scope:'primitive-library',specification};
  return {modules,policies,learned:result.modules,circuits:graphsFromModules(modules),evidence,entrypoints:lexicalEntrypoints,receipt:{schema:'sxlm.lexical-migration.v1',runtime:runtimeIdentity.hash,authoredPolicies:policies.length,method:result.receipt,trainingHash:executionDigest(specification),qualification:'Terminal selection, lexicon indexing, class exclusions and case policy execute in SOP. Normalization composition is synthesized. Native token boundaries and Earley scheduling remain; authored lexical policy is not relabeled as learned.'}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const result=synthesizeLexical(),path=new URL('../packs/english-bootstrap.sop',import.meta.url),pack=decodeSOP(readFileSync(path));
  if(process.argv.includes('--check')){
    check(result.modules.every(module=>executionDigest(pack.sop.find(m=>m.id===module.id)??null)===executionDigest(module)),'Lexical sources or learned normalization differ from their derivation');
    check(executionDigest(pack.training?.components?.lexicalNormalization??null)===executionDigest(result.evidence),'Missing lexical method derivation');
    check(Object.entries(result.entrypoints).every(([key,id])=>pack.entrypoints[key]===id),'Lexical entrypoint differs from its source');
    const ids=new Set(result.modules.map(m=>m.id));check(!pack.sop.some(m=>m.id.startsWith('lexical.')&&!ids.has(m.id)),'Obsolete lexical module');
    console.log(`Lexical replay passed: ${result.policies.length} authored SOP policies and ${result.learned.length} synthesized normalization method.`);
  }else{
    const ids=new Set(result.modules.map(m=>m.id));
    pack.sop=[...pack.sop.filter(m=>!m.id.startsWith('lexical.')&&!ids.has(m.id)),...result.modules].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    pack.entrypoints={...pack.entrypoints,...result.entrypoints};
    pack.training={...pack.training,components:{...pack.training?.components,lexicalNormalization:result.evidence}};
    pack.provenance.lexicalMigration=result.receipt;
    writeFileSync(path,encodeSOP(pack));writeFileSync(new URL('../reports/lexical-migration.sop',import.meta.url),encodeSOP(result.receipt));
    console.log(`Installed ${result.modules.length} lexical SOP modules.`);
  }
}
