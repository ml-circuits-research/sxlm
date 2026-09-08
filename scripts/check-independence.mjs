import { encodeSOP } from '../src/kernel/sop-data.mjs';
import { cpSync, mkdtempSync, readdirSync, readFileSync, lstatSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url)), excluded = new Set(['.git','.sxlm','node_modules','reports','.agents','.claude','ploinky-skills-manifest.json']);
const modules = [];
function walk(directory) {
  for (const name of readdirSync(directory)) {
    if (excluded.has(name)) continue;
    const path = join(directory,name), info=lstatSync(path);assert.equal(info.isSymbolicLink(),false,`Symlink: ${path}`);
    if(info.isDirectory())walk(path);else if(/\.(?:mjs|js)$/.test(name))modules.push(path);
  }
}
walk(root);
let references=0;
for(const file of modules){
  const source=readFileSync(file,'utf8');
  for(const match of source.matchAll(/(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g)){
    const specifier=match[1];if(specifier.startsWith('node:'))continue;
    assert.ok(specifier.startsWith('.'),`External module/resource reference in ${relative(root,file)}: ${specifier}`);
    const target=resolve(dirname(file),specifier);assert.ok(target.startsWith(resolve(root)+sep),`Escapes the repository: ${target}`);references++;
  }
  for(const match of source.matchAll(/new URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url/g)){
    const target=resolve(dirname(file),match[1]);assert.ok(target.startsWith(resolve(root)+sep)||target===resolve(root),`Resource escapes the repository: ${target}`);references++;
  }
}
const manifest=JSON.parse(readFileSync(join(root,'package.json')));assert.equal(Object.keys(manifest.dependencies??{}).length,0);
const temporary=mkdtempSync(join(tmpdir(),'sxlm-standalone-')), checkout=join(temporary,'isolated');
try{
  cpSync(root,checkout,{recursive:true,filter:source=>!relative(root,source).split(sep).some(part=>excluded.has(part))});
  const run=args=>execFileSync(process.execPath,args,{cwd:checkout,encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});
  const answer=run(['bin/sxlm.mjs','ask','Every pilot who owns a bird is careful. Mira is a pilot. Mira owns a bird. Is Mira careful?']).trim();assert.equal(answer,'Yes. Mira is careful.');
  const demo=run(['bin/sxlm.mjs','demo']);assert.ok(demo.includes('After: Yes. Nara is trusted.'));
  const evaluation=run(['eval/run.mjs']);assert.ok(evaluation.includes('Acceptance: PASS'));
  const report={schema:'sxlm.independence.v1',passed:true,moduleFiles:modules.length,localReferences:references,externalRuntimeDependencies:0,symlinks:0,isolatedCommands:['ask','demo including induction','full capability evaluation'],answer,evaluation:evaluation.trim().split('\n'),note:'Executed from a temporary copy with no sibling project directories. The copy was removed after verification.'};
  writeFileSync(join(root,'reports/independence.sop'),encodeSOP(report)+'\n');console.log(`Standalone verification passed: ${modules.length} modules, ${references} local references, no external runtime dependencies. Isolated ask/demo/evaluation passed.`);
}finally{rmSync(temporary,{recursive:true,force:true});}
