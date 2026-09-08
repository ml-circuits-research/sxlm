import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {canonical,digest} from '../src/kernel/data.mjs';
import {compileSOP} from '../src/kernel/sop.mjs';
import {learnAffineSOP} from '../src/learning/affine.mjs';

export function synthesizeSOP() {
  const root=new URL('../sop/summary/',import.meta.url);
  const modules=readdirSync(root).filter(n=>n.endsWith('.sop')).sort().map(name=>({id:'summary.'+name.slice(0,-4),source:readFileSync(new URL(name,root),'utf8'),provenance:{kind:'agent-authored-sop-migration',source:'sop/summary/'+name,qualification:'Executable strategy; not an induced policy or a learning derivation.'}}));
  const curriculum=decodeSOP(readFileSync(new URL('../training/summary-scores.sop',import.meta.url)));
  const learned=learnAffineSOP('learned.summary.score',curriculum.examples);
  learned.module.learning.curriculum={hash:digest(curriculum),origin:curriculum.origin};modules.push(learned.module);
  const circuits=modules.map(m=>compileSOP(m.id,m.source,{provenance:m.provenance,...(m.learning?{learning:m.learning}:{})}));
  return {modules,circuits,receipt:{schema:'sxlm.sop-migration.v1',modules:modules.map(m=>({id:m.id,sourceHash:digest(m.source)})),nativeSummaryRemoved:true,learnedScoring:learned.receipt,qualification:'Selection policies remain authored; the numeric score is induced from annotated observations. Its teacher shares the original implementation origin; independent quality evidence is still required.'}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const {modules,receipt}=synthesizeSOP(),path=new URL('../packs/english-bootstrap.sop',import.meta.url),pack=decodeSOP(readFileSync(path));
  if(process.argv.includes('--check')){
    if(modules.some(m=>{const old=(pack.sop??[]).find(x=>x.id===m.id);return !old||canonical(old)!==canonical(m);}))throw Error('SOP installed sources differ from worktree sources');
    console.log(`SOP source replay passed: ${modules.length} modules, including the induced score.`);
  }else{
    const ids=new Set(modules.map(m=>m.id));pack.sop=[...(pack.sop??[]).filter(m=>!ids.has(m.id)),...modules];
    pack.sop.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    writeFileSync(path,encodeSOP(pack)+'\n');
    writeFileSync(new URL('../reports/sop-migration.sop',import.meta.url),encodeSOP(receipt)+'\n');
    console.log(`Installed ${modules.length} SOP modules; summary strategy is now executed as circuits.`);
  }
}
