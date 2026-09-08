import { encodeSOP } from '../src/kernel/sop-data.mjs';
// Optional real-browser test of this repository's application. No browser package is required.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from '../src/server.mjs';

const chrome = process.env.SXLM_CHROMIUM ?? ['/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome'].find(existsSync);
assert.ok(chrome, 'Set SXLM_CHROMIUM to an installed Chromium executable');
const profile = mkdtempSync(join(tmpdir(),'sxlm-browser-')), server = await serve({port:0,chatDirectory:join(profile,'chats')}), url = `http://127.0.0.1:${server.address().port}`;
const child = spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let socket;
try {
  const endpoint = await new Promise((resolve,reject)=>{
    let log='';const timeout=setTimeout(()=>reject(new Error('Chromium startup timed out')),15000);
    child.stderr.on('data',chunk=>{log+=chunk;const match=/DevTools listening on (ws:\/\/\S+)/.exec(log);if(match){clearTimeout(timeout);resolve(match[1]);}});
    child.once('error',reject);child.once('exit',code=>{if(code)reject(new Error(`Chromium exited: ${code}`));});
  });
  socket=new WebSocket(endpoint);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let serial=0;const pending=new Map(),errors=[];
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const promise=pending.get(message.id);pending.delete(message.id);if(message.error)promise.reject(new Error(message.error.message));else promise.resolve(message.result);}else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);});
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
  const target=await send('Target.createTarget',{url}),attached=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true}),sid=attached.sessionId;
  await send('Runtime.enable',{},sid);await send('Page.enable',{},sid);
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sid);if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
  const wait=async (expression,timeout=20000)=>{const started=Date.now();while(!(await evaluate(expression))){if(Date.now()-started>timeout)throw new Error(`Browser condition timed out: ${expression}`);await new Promise(resolve=>setTimeout(resolve,80));}};
  const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  await wait('document.querySelector("#chat-select")?.options.length > 0');
  await click('[data-task="reason"]');
  await wait('document.querySelector("#prompt")?.value.length > 0');
  const architectureComplete=await evaluate('(async()=> { const {decodeSOP}=await import("./sop-data.mjs"); return decodeSOP(await (await fetch("/api/info")).text()).architecture.complete; })()');
  assert.equal(await evaluate('document.querySelector("#architecture-status").hidden'),architectureComplete);
  await click('#run');await wait('document.querySelector("#run-state").textContent === "TRUE"');
  assert.match(await evaluate('document.querySelector("#answer").textContent'),/Mira is careful/);
  await click('[data-task="summarize"]');await click('#run');await wait('!document.querySelector("#run").disabled');
  assert.match(await evaluate('document.querySelector("#answer").textContent'),/Production has not resumed/);
  await click('[data-task="complete"]');await evaluate('document.querySelector("#examples").value="1";document.querySelector("#examples").dispatchEvent(new Event("change"))');await click('#run');await wait('!document.querySelector("#run").disabled');
  assert.equal(await evaluate('document.querySelector("#answer").textContent'),'The cobalt robot inspects the reactor.');
  // This runs full before/after regressions, including SOP lexical policy.
  // The functional harness wait is separate from the model request budget.
  await click('[data-task="learn"]');await click('#learn-run');await wait('!document.querySelector("#learn-run").disabled',120000);
  assert.equal(await evaluate('document.querySelector("#learning-state").textContent'),'VALIDATED');await click('#activate');await wait('document.querySelector("#learning-state").textContent === "ACTIVE"');
  await click('[data-task="reason"]');await evaluate('document.querySelector("#prompt").value="Every robot who is certified as a navigator is trusted. Nara is a robot. Nara is certified as a navigator. Is Nara trusted?"');await click('#run');await wait('!document.querySelector("#run").disabled');
  assert.equal(await evaluate('document.querySelector("#answer").textContent'),'Yes. Nara is trusted.');
  mkdirSync(new URL('../reports/',import.meta.url),{recursive:true});
  for(const [label,width,height]of [['desktop',1440,1050],['mobile',390,1000]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:label==='mobile'},sid);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'),true,`${label} horizontal overflow`);
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sid);writeFileSync(new URL(`../reports/ui-${label}.png`,import.meta.url),Buffer.from(shot.data,'base64'));
  }
  // This button runs all capability suites and before/after learning regressions.
  await click('[data-task="evaluate"]');await click('#eval-run');await wait('!document.querySelector("#eval-run").disabled',180000);
  assert.match(await evaluate('document.querySelector("#eval-result").textContent'),/Acceptance passed/);assert.equal(errors.length,0,JSON.stringify(errors));
  const report={schema:'sxlm.browser-smoke.v1',passed:true,checks:['architecture completion status','reasoning','extractive summary','context completion','construction induction','validated activation','learned composition','evaluation view','desktop overflow','mobile overflow','no JavaScript exceptions'],screenshots:['ui-desktop.png','ui-mobile.png']};
  writeFileSync(new URL('../reports/browser-smoke.sop',import.meta.url),encodeSOP(report)+'\n');console.log(`Browser smoke: all ${report.checks.length} checks passed. Screenshots: reports/ui-desktop.png, reports/ui-mobile.png`);
} finally {socket?.close();child.kill('SIGTERM');await new Promise(resolve=>server.close(resolve));await new Promise(resolve=>{if(child.exitCode!==null)resolve();else{child.once('exit',resolve);setTimeout(resolve,3000);}});rmSync(profile,{recursive:true,force:true});}
