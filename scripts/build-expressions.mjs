import { modulesFromGraphs, graphsFromModules, normalizedGraphs, installGraphs } from '../src/learning/sop-output.mjs';
import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lowerPrograms } from '../src/learning/expressions.mjs';
import { executionDigest } from '../src/kernel/data.mjs';
import { synthesizeRealization } from './learn-realization.mjs';
import { buildSemantics } from './build-semantics.mjs';

export function synthesizeExpressions(){
  const archive=decodeSOP(readFileSync(new URL('../training/legacy-circuits.sop',import.meta.url)));
  const read=name=>decodeSOP(readFileSync(new URL('../training/'+name,import.meta.url)));
  const realization=synthesizeRealization(read('realization.sop'),read('realization-adapters.sop'));
  const semantics=buildSemantics(read('semantics-dispatch.sop'));
  const replaced=new Set([...realization.circuits,...semantics.circuits].map(c=>c.id));
  const authored=lowerPrograms(archive.circuits.filter(c=>!replaced.has(c.id)));
  const circuits=[...authored,...realization.circuits,...semantics.circuits];
  return{circuits,receipt:{schema:'sxlm.expression-migration.v1',sourceHash:executionDigest(archive),roots:archive.circuits.length,templateCalls:archive.circuits.reduce((n,c)=>n+c.nodes.filter(n=>n.op==='data.template').length,0),compiledModules:circuits.length,maxNodes:Math.max(...circuits.map(c=>c.nodes.length)),qualification:'Offline compilation removes the runtime expression interpreter. Authored input remains authored; generated fragments are not new skills.'}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const result=synthesizeExpressions(),path=new URL('../packs/english-bootstrap.sop',import.meta.url),pack=decodeSOP(readFileSync(path));
  if(process.argv.includes('--check')){
    const installedGraphs=graphsFromModules(pack.sop);
    for(const circuit of result.circuits)if(executionDigest(installedGraphs.find(c=>c.id===circuit.id)??null)!==executionDigest(normalizedGraphs([circuit])[0]))throw Error('Compiled circuit differs from its source: '+circuit.id);
    const roots=new Set(result.circuits.map(c=>c.compilation?.root??c.id)),ids=new Set(result.circuits.map(c=>c.id));
    if(installedGraphs.some(c=>roots.has(c.compilation?.root)&&!ids.has(c.id)))throw Error('Obsolete expression fragments remain');
    if(installedGraphs.some(c=>c.nodes.some(n=>n.op==='data.template')))throw Error('Runtime template instructions remain');
    console.log(`Expression replay passed: ${result.receipt.templateCalls} retired calls, ${result.receipt.compiledModules} graph modules; no runtime expression evaluation.`);
  }else{
    const ids=new Set(result.circuits.map(c=>c.id));
    const roots=new Set(decodeSOP(readFileSync(new URL('../training/legacy-circuits.sop',import.meta.url))).circuits.map(c=>c.id));
    installGraphs(pack,result.circuits);
    pack.provenance.expressionMigration=result.receipt;
    pack.sop.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    writeFileSync(path,encodeSOP(pack)+'\n');
    writeFileSync(new URL('../reports/expression-migration.sop',import.meta.url),encodeSOP(result.receipt)+'\n');
    console.log('Installed offline-compiled expression graphs. Compilation is not a learning claim.');
  }
}
