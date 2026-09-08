import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { serve } from '../src/server.mjs';
import { SymbolicModel } from '../src/model.mjs';

test('HTTP workbench serves the module UI and executes all natural-language tasks', async () => {
  const server=await serve({port:0});const base=`http://127.0.0.1:${server.address().port}`;
  try {
    const html=await (await fetch(base)).text();assert.ok(html.includes('type="module"'));assert.ok(html.includes('lang="en"'));
    const info=decodeSOP(await (await fetch(`${base}/api/info`)).text());assert.ok(info.grammar.circuits>0);assert.equal(info.architecture.complete,false);
    const run=async body=>{const response=await fetch(`${base}/api/run`,{method:'POST',headers:{'Content-Type':'application/sop'},body:encodeSOP(body)});assert.equal(response.status,200);return decodeSOP(await response.text());};
    const first=await run({task:'reason',text:'Mira is a pilot.'});const second=await run({task:'reason',text:'Is Mira a pilot?',session:first.session});assert.equal(second.truth,'true');
    const fresh=await run({task:'reason',text:'Is Mira a pilot?'});assert.equal(fresh.truth,'unknown');
    assert.equal((await run({task:'summarize',text:'The sensor failed. The engineer replaced it.',options:{sentences:1}})).method,'extractive');
    assert.equal((await run({task:'complete',text:'A symbolic model'})).grounding,'attested-text');
    const invalid=await fetch(`${base}/api/run`,{method:'POST',body:'{"task":"reason","text":""}'});assert.equal(invalid.status,400);
    const cross=await fetch(`${base}/api/run`,{method:'POST',headers:{Origin:'http://unrelated.test'},body:'{}'});assert.equal(cross.status,400);
    assert.equal((await fetch(`${base}/missing`)).status,404);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
test('CLI text, SOP, summary and completion flags behave correctly', () => {
  const cli=new URL('../bin/sxlm.mjs',import.meta.url).pathname;
  const run=args=>execFileSync(process.execPath,[cli,...args],{encoding:'utf8',cwd:new URL('../',import.meta.url),maxBuffer:8*1024*1024}).trim();
  assert.match(run(['ask','Mira is a pilot. Is Mira a pilot?']),/^Yes\./);
  assert.equal(decodeSOP(run(['ask','Is Vela a pilot?','--sop'])).truth,'unknown');
  assert.equal(run(['complete','A symbolic model','--max-tokens','2']),'A symbolic model represents knowledge');
  assert.equal(run(['summarize','The sensor failed. The engineer repaired it.','--sentences','1']),'The sensor failed.');
});
test('unparsed questions do not taint persistent state or hide behind an earlier answer', () => {
  const session=new SymbolicModel().createSession();session.ask('Mira has 8 apples.');
  const revision=session.state.revision;const bad=session.ask('Why did Mira do that?');assert.equal(bad.status,'unsupported');assert.equal(session.state.revision,revision);
  assert.equal(session.ask('How many apples does Mira have?').value,'8');
  assert.equal(session.ask('How many apples does Mira have? What happened next?').answers.at(-1).status,'unsupported');
});
test('long derivations verify through a DAG even when the display tree is truncated', () => {
  const statements=Array.from({length:18},(_,i)=>`Every trait${i} is trait${i+1}.`);
  const model=new SymbolicModel(),text=`Nara is trait0. ${statements.join(' ')} Is Nara trait18?`;
  // Lexical and segmentation SOP policies use about 92,800 nodes without caching.
  // Verify the proof under the normal budget and retain a strict limit check.
  const r=model.ask(text);
  assert.equal(r.truth,'true');assert.equal(r.verification.valid,true);assert.equal(r.verification.checkedNodes,19);
  const limited=model.ask(text,{cache:false,limits:{nodes:3000}});assert.equal(limited.status,'budget-exceeded');assert.equal(limited.resource,'nodes');assert.equal(limited.committed,false);
  // Large diagnostic traces remain available to callers, but are not inputs
  // to the small circuit that formulates a resource-failure message.
  const partial=model.ask(text,{cache:false,limits:{nodes:50000}});
  assert.equal(partial.status,'budget-exceeded');assert.equal(partial.committed,false);
  assert.ok(partial.trace.length>20000);assert.equal(typeof partial.text,'string');
});
