import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {lookupModules} from '../src/learning/memory.mjs';
import {learnSequencePack} from '../src/learning/sequence.mjs';
import {CircuitRuntime} from '../src/kernel/circuit.mjs';
import {installTermPrimitives} from '../src/kernel/terms.mjs';
import {installCollectionPrimitives} from '../src/kernel/collections.mjs';
import {compileSOP} from '../src/kernel/sop.mjs';
import {Budget,digest,canonical} from '../src/kernel/data.mjs';
import assert from 'node:assert/strict';

const rows=[];
for(const count of [100,1000,10000]){
  const entries=Array.from({length:count},(_,i)=>['symbol-'+String(i).padStart(5,'0'),[{token:'value-'+i,count:1}]]);
  const learning={kind:'benchmark-observation-memory',trainingHash:digest(entries)};
  const started=performance.now(),modules=lookupModules('observed.function',entries,{learning});
  const generated=performance.now(),vm=installCollectionPrimitives(installTermPrimitives(new CircuitRuntime({cacheSize:256})));
  for(const m of modules)vm.compile(compileSOP(m.id,m.source));
  const compiled=performance.now(),budget=new Budget({milliseconds:10000}),trace=[];
  const key=entries[Math.floor(count/2)][0],expected=entries[Math.floor(count/2)][1];
  const value=vm.execute('observed.function',{with:{key}},{budget,cache:false,trace});assert.deepEqual(value,expected);
  const cold=performance.now();vm.execute('observed.function',{with:{key}});const warmStart=performance.now();
  for(let i=0;i<20;i++)assert.deepEqual(vm.execute('observed.function',{with:{key}}),expected);
  rows.push({observations:count,modules:modules.length,sopBytes:Buffer.byteLength(modules.map(m=>m.source).join('')),artifactBytes:Buffer.byteLength(canonical(modules)),generationMs:generated-started,compilationMs:compiled-generated,coldLookupMs:cold-compiled,coldNodes:budget.report().nodes,executedModules:new Set(trace.map(t=>t.circuit)).size,warmMeanMs:(performance.now()-warmStart)/20});
}
const specification=decodeSOP(readFileSync(new URL('../training/sequence.sop',import.meta.url))),{texts,...options}=specification,learned=learnSequencePack(texts,options);
const report={schema:'sxlm.sequence-representation.v1',node:process.version,icu:process.versions.icu,trainingHash:learned.provenance.trainingHash,bootstrap:{trainingTexts:texts.length,modules:learned.sop.length,sequencePackBytes:Buffer.byteLength(encodeSOP(learned)),installedBootstrapBytes:Buffer.byteLength(readFileSync(new URL('../packs/english-bootstrap.sop',import.meta.url)))},lookupScaling:rows,qualification:'Synthetic finite-function lookup, not language generalization or end-to-end large-corpus completion. Source-continuation search still scans its supplied sources. Warm numbers include assertion overhead and are not performance guarantees.'};
writeFileSync(new URL('../reports/sequence-representation.sop',import.meta.url),encodeSOP(report)+'\n');
console.log(encodeSOP(report));
