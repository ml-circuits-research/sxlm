import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';
// Rebuild every active training/migration source in an isolated checkout.
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { executionDigest } from '../src/kernel/data.mjs';
import { stages } from './build-model.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),temporary=mkdtempSync(join(tmpdir(),'sxlm-rebuild-')),checkout=join(temporary,'isolated');
const excluded=new Set(['.git','.sxlm','node_modules','reports','.agents','.claude','ploinky-skills-manifest.json']);
try{
  cpSync(root,checkout,{recursive:true,filter:file=>!relative(root,file).split(sep).some(part=>excluded.has(part))});
  mkdirSync(join(checkout,'reports'));
  const load=where=>decodeSOP(readFileSync(join(where,'packs/english-bootstrap.sop'),'utf8'));
  const original=executionDigest(load(root)),outputs=[];
  for(const stage of stages)outputs.push({stage,output:execFileSync(process.execPath,['scripts/'+stage+'.mjs'],{cwd:checkout,encoding:'utf8',timeout:60000,maxBuffer:1024*1024}).trim()});
  const rebuilt=executionDigest(load(checkout));
  if(rebuilt!==original){
    const before=load(root),after=load(checkout);
    const fields=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(key=>executionDigest(before[key]??null)!==executionDigest(after[key]??null));
    writeFileSync(join(root,'reports/rebuild-mismatch.sop'),encodeSOP({passed:false,original,rebuilt,fields,stages:outputs})+'\n');
  }
  assert.equal(rebuilt,original,'The active pack does not equal a complete rebuild from current sources');
  for(const stage of stages)execFileSync(process.execPath,['scripts/'+stage+'.mjs','--check'],{cwd:checkout,encoding:'utf8',timeout:60000});
  const elementary = executionDigest(decodeSOP(readFileSync(join(root,'packs/elementary-knowledge.sop'),'utf8')));
  assert.equal(executionDigest(decodeSOP(readFileSync(join(checkout,'packs/elementary-knowledge.sop'),'utf8'))),elementary,'Elementary pack rebuild differs');
  const constructions = executionDigest(decodeSOP(readFileSync(join(root,'packs/english-constructions.sop'),'utf8')));
  assert.equal(executionDigest(decodeSOP(readFileSync(join(checkout,'packs/english-constructions.sop'),'utf8'))),constructions,'Construction pack rebuild differs');
  const everyday = executionDigest(decodeSOP(readFileSync(join(root,'packs/everyday-knowledge.sop'),'utf8')));
  assert.equal(executionDigest(decodeSOP(readFileSync(join(checkout,'packs/everyday-knowledge.sop'),'utf8'))),everyday,'Everyday pack rebuild differs');
  const report={everydayPackHash:everyday,constructionPackHash:constructions,elementaryPackHash:elementary,schema:'sxlm.rebuild.v1',passed:true,packHash:original,stages:outputs,qualification:'Exact order-sensitive pack reproduction in an isolated copy. Compilation provenance and authored policy remain explicit; this does not establish independent learning quality.'};
  writeFileSync(join(root,'reports/rebuild.sop'),encodeSOP(report)+'\n');
  console.log('Isolated rebuild passed: '+stages.length+' build stages and their replay checks.');
}finally{rmSync(temporary,{recursive:true,force:true});}
