import { decodeSOP } from '../src/kernel/sop-data.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SymbolicModel, induceConstruction } from '../src/index.mjs';
import { validateCandidate, promote, loadRegistry, rollback, preparePacket } from '../src/learning/workflow.mjs';
import { conformance, learningGates } from '../eval/cases.mjs';

test('candidate validation, atomic promotion, reload and rollback work without sibling code', () => {
  const directory=mkdtempSync(join(tmpdir(),'sxlm-registry-'));
  try {
    const model=new SymbolicModel(),spec=decodeSOP(readFileSync(new URL('../examples/learn-construction.sop',import.meta.url))),candidate=induceConstruction(model,spec);
    const receipt=validateCandidate(model,candidate,{gates:learningGates,regressions:conformance});assert.equal(receipt.accepted,true);
    promote(directory,candidate,{gates:learningGates,regressions:conformance});const loaded=new SymbolicModel({packs:loadRegistry(directory).packs});
    assert.equal(loaded.ask(learningGates[0].text).truth,'true');rollback(directory);assert.equal(new SymbolicModel({packs:loadRegistry(directory).packs}).ask(learningGates[0].text).truth,'unknown');
  } finally { rmSync(directory,{recursive:true,force:true}); }
});
test('promotion rejects no-op candidates and verbatim evaluation leakage', () => {
  const model=new SymbolicModel();const candidate={schema:'sxlm.pack.v1',id:'noop',version:'1',provenance:{kind:'test'},sop:[]};
  assert.equal(validateCandidate(model,candidate,{gates:[conformance[0]],regressions:[]}).accepted,false);
  candidate.sop=[{id:'leaked-observation',source:'@input with object\n@value data.string value '+JSON.stringify(conformance[0].text)+'\n@output result $value'}];assert.deepEqual(validateCandidate(model,candidate,{gates:[conformance[0]],regressions:[]}).leakedCases,[conformance[0].id]);
});
test('agent packet contains teacher examples and contracts, not promotion gate texts', () => {
  const directory=mkdtempSync(join(tmpdir(),'sxlm-packet-'));
  try { const model=new SymbolicModel();preparePacket(model,{category:'VP',examples:[]},directory);const prompt=readFileSync(join(directory,'AGENT-TASK.md'),'utf8');assert.ok(prompt.includes('inert'));assert.ok(!prompt.includes(learningGates[0].text)); }
  finally { rmSync(directory,{recursive:true,force:true}); }
});
test('registry writers cannot overwrite a concurrent promotion', () => {
  const directory=mkdtempSync(join(tmpdir(),'sxlm-locked-'));
  try { writeFileSync(join(directory,'write.lock'),'owned by another writer');assert.throws(()=>rollback(directory),/locked by another writer/);assert.equal(readFileSync(join(directory,'write.lock'),'utf8'),'owned by another writer'); }
  finally {rmSync(directory,{recursive:true,force:true});}
});
test('a candidate cannot replace the trusted task entrypoint to manufacture passing answers', () => {
  const model=new SymbolicModel();
  const candidate={schema:'sxlm.pack.v1',id:'fake-pipeline',version:'1',provenance:{kind:'test'},entrypoints:{reason:'fake.reason'}};
  assert.throws(()=>validateCandidate(model,candidate,{gates:learningGates,regressions:[]}),/cannot replace an existing task entrypoint/);
});
