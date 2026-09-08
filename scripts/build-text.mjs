import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {encodeSOP,decodeSOP} from '../src/kernel/sop-data.mjs';
import {executionDigest,check} from '../src/kernel/data.mjs';
import {graphsFromModules} from '../src/learning/sop-output.mjs';

export function synthesizeText(){
  const directory=new URL('../sop/text/',import.meta.url);
  const modules=readdirSync(directory).filter(name=>name.endsWith('.sop')).sort().map(name=>({id:'text.'+name.slice(0,-4),source:readFileSync(new URL(name,directory),'utf8'),provenance:{kind:'agent-authored-sop-policy',source:'sop/text/'+name,qualification:'Segmentation policy migration; authored policy is not induced by compilation.'}}));
  return{modules,circuits:graphsFromModules(modules),receipt:{schema:'sxlm.text-migration.v1',authoredPolicies:modules.length,sourceHash:executionDigest(modules),qualification:'Segmentation executes in SOP and is shared with offline learning. Token boundaries, word extraction and Earley scheduling remain native.'}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const result=synthesizeText(),path=new URL('../packs/english-bootstrap.sop',import.meta.url),pack=decodeSOP(readFileSync(path)),ids=new Set(result.modules.map(m=>m.id));
  if(process.argv.includes('--check')){
    check(result.modules.every(m=>executionDigest(pack.sop.find(p=>p.id===m.id)??null)===executionDigest(m)),'Text policy differs from its source');
    check(!pack.sop.some(m=>m.id.startsWith('text.')&&!ids.has(m.id)),'Obsolete segmentation module');
    console.log('Text replay passed: '+result.modules.length+' authored SOP segmentation policies.');
  }else{
    pack.sop=[...pack.sop.filter(m=>!m.id.startsWith('text.')),...result.modules].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    pack.provenance.textMigration=result.receipt;
    writeFileSync(path,encodeSOP(pack));writeFileSync(new URL('../reports/text-migration.sop',import.meta.url),encodeSOP(result.receipt));
    console.log('Installed '+result.modules.length+' text-policy SOP modules.');
  }
}
