import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {compileSOP} from '../src/kernel/sop.mjs';
import {compileGrammarKnowledge} from '../src/learning/grammar.mjs';
import {canonical,digest} from '../src/kernel/data.mjs';
import { replaceLinkages } from './support/linkages.mjs';

export function synthesizeDocument(){
  const modules=[];
  for(const folder of ['document','grammar']){
    const root=new URL('../sop/'+folder+'/',import.meta.url);
    for(const name of readdirSync(root).filter(n=>n.endsWith('.sop')).sort())modules.push({id:folder+'.'+name.slice(0,-4),source:readFileSync(new URL(name,root),'utf8'),provenance:{kind:'agent-authored-sop-policy',source:'sop/'+folder+'/'+name,qualification:'Document interpretation and grammar composition are authored proposals, not learned by compilation.'}});
  }
  const specification=decodeSOP(readFileSync(new URL('../training/grammar-bootstrap.sop',import.meta.url)));
  const knowledge=compileGrammarKnowledge(specification.grammar,{id:'memory.bootstrap-grammar',origin:specification.origin});modules.push(...knowledge.sop);
  const linkage={id:'language.grammar',slot:'grammar-fragments',seed:'grammar.empty',reducer:'grammar.merge'};
  return{modules,knowledge,linkage,circuits:modules.map(m=>compileSOP(m.id,m.source,{provenance:m.provenance})),receipt:{schema:'sxlm.document-migration.v1',grammarHash:knowledge.knowledgeHash,sourceHash:digest(modules),authoredPolicies:modules.length-knowledge.sop.length,compiledKnowledgeModules:knowledge.sop.length,qualification:'Grammar knowledge is reconstructed by circuits. The Earley mechanism remains native and requires further review; source compilation is not a learning derivation.'}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const result=synthesizeDocument(),path=new URL('../packs/english-bootstrap.sop',import.meta.url),pack=decodeSOP(readFileSync(path));
  if(process.argv.includes('--check')){
    if(result.modules.some(m=>canonical(pack.sop.find(p=>p.id===m.id)??null)!==canonical(m)))throw Error('Document/grammar modules differ from their source');
    if(Object.hasOwn(pack,'grammar'))throw Error('Raw grammar is still installed');
    if(canonical(pack.providers['grammar-fragments'])!==canonical(result.knowledge.providers['grammar-fragments'])||canonical(pack.linkages.find(l=>l.id===result.linkage.id))!==canonical(result.linkage))throw Error('Grammar linkage differs from its source');
    console.log(`Document replay: ${result.receipt.authoredPolicies} authored policies, ${result.receipt.compiledKnowledgeModules} compiled grammar modules. No grammar learning claim.`);
  }else{
    pack.sop=[...pack.sop.filter(m=>m.compilation?.printer||!['document.','grammar.','memory.bootstrap-grammar'].some(prefix=>m.id.startsWith(prefix))),...result.modules];
    pack.providers={...pack.providers,...result.knowledge.providers};pack.linkages=replaceLinkages(pack.linkages,[result.linkage]);
    delete pack.grammar;pack.entrypoints.grammar='language.grammar';pack.entrypoints.document='document.parse';
    pack.provenance.documentMigration=result.receipt;
    pack.sop.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    writeFileSync(path,encodeSOP(pack)+'\n');writeFileSync(new URL('../reports/document-migration.sop',import.meta.url),encodeSOP(result.receipt)+'\n');
    console.log(`Installed ${result.modules.length} document/grammar SOP modules.`);
  }
}
