import { encodeSOP } from '../src/kernel/sop-data.mjs';
// Optional real-browser test of this repository's application. No browser package is required.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const chrome = process.env.SXLM_CHROMIUM ?? ['/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome'].find(existsSync);
assert.ok(chrome, 'Set SXLM_CHROMIUM to an installed Chromium executable');
const profile = mkdtempSync(join(tmpdir(),'sxlm-chat-browser-')), url = 'http://127.0.0.1:3210';
const live = process.argv.includes('--live');
const existing = process.argv.find(argument => argument.startsWith('--chat='))?.slice(7);
assert.ok(!existing || !live, 'Inspect an existing chat or start a live upload, not both');
const reportPrefix = existing ? 'chat-layout' : 'chat';
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
  assert.equal(await evaluate('document.body.classList.contains("chat-mode")'),true);
  const checks=['simple default chat'];
  if (existing) {
    await evaluate(`document.querySelector('#chat-select').value=${JSON.stringify(existing)}; document.querySelector('#chat-select').dispatchEvent(new Event('change'))`);
    await wait(`document.querySelector('#chat-select').value === ${JSON.stringify(existing)} && document.querySelectorAll('.chat-turn').length > 0`);
    await wait(`document.querySelector('#chat-attachment-status').textContent.includes('Ready —')`);
    checks.push('restored document conversation');
  } else {
  await click('#chat-new');
  await wait('document.querySelector("#chat-messages .chat-empty")');
  await evaluate('document.querySelector("#chat-message").value="Is Rowan careful?"');
  await click('#chat-send'); await wait('document.querySelectorAll(".chat-turn").length === 1');
  assert.match(await evaluate('document.querySelector(".chat-answer").textContent'),/cannot determine/i);
  checks.push('unknown before document');
  if(live){
    await send('DOM.enable',{},sid);
    const tree=await send('DOM.getDocument',{},sid);
    const input=await send('DOM.querySelector',{nodeId:tree.root.nodeId,selector:'#chat-file'},sid);
    await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[fileURLToPath(new URL('../reports/chat-field-notes.docx',import.meta.url))]},sid);
    await wait('!document.querySelector("#chat-attachment-status").hidden');
    const start=Date.now();
    while(true){
      const state=await evaluate('({status:document.querySelector("#chat-attachment-status").textContent,error:document.querySelector("#error").textContent,send:document.querySelector("#chat-send").disabled})');
      if(state.status.includes('Ready —'))break;
      if(state.error||state.status.includes('Retry'))throw new Error(state.error||state.status);
      if(Date.now()-start>22*60*1000)throw new Error('Document processing timed out');
      await new Promise(resolve=>setTimeout(resolve,2000));
    }
    await evaluate('document.querySelector("#chat-message").value="Is Rowan careful?"');
    await click('#chat-send');await wait('document.querySelectorAll(".chat-turn").length === 2');
    assert.equal(await evaluate('[...document.querySelectorAll(".chat-answer")].at(-1).textContent'),'Yes. Rowan is careful.');
    checks.push('DOCX attachment','real Codex job','automatic activation','document-grounded answer');
  }
  }
  for(const [label,width,height]of [['desktop',1440,1050],['mobile',390,1000]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:label==='mobile'},sid);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,label+' horizontal overflow');
    assert.equal(await evaluate(`['#chat-attach','#chat-message','#chat-send'].every(selector => {
      const bounds=document.querySelector(selector).getBoundingClientRect();
      return bounds.top >= 0 && bounds.bottom <= innerHeight && bounds.left >= 0 && bounds.right <= innerWidth;
    })`),true,label+' composer visible');
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sid);
    writeFileSync(new URL('../reports/'+reportPrefix+'-'+label+'.png',import.meta.url),Buffer.from(shot.data,'base64'));
    checks.push(label+' layout');
  }
  assert.equal(errors.length,0,JSON.stringify(errors));
  const chat=await evaluate('document.querySelector("#chat-select").value');
  if (existing) {
    await evaluate(`(async () => {
      const { mountChat } = await import('./chat.js');
      const turns = Array.from({length:45},(_,index)=>({index,text:'Message '+index,result:{text:'Answer '+index}}));
      const fixture = {id:'pagination-fixture',title:'Pagination fixture',activeJobs:[]};
      const api = async path => {
        if (path === '/api/chat') return {chats:[fixture]};
        const query = new URL(path,location.origin).searchParams;
        const offset = query.has('tail') ? 25 : Number(query.get('offset'));
        return {chat:fixture,total:45,offset,turns:turns.slice(offset,offset+20),documents:[],jobs:[]};
      };
      await mountChat(api, message => { if(message) throw new Error(message); }).refresh();
    })()`);
    await click('#chat-messages > button');
    await wait('document.querySelectorAll(".chat-turn").length === 40');
    await click('#chat-messages > button');
    await wait('!document.querySelector("#chat-messages > button")');
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".chat-user")].map(item=>item.textContent)'),
      Array.from({length:45},(_,index)=>'Message '+index));
    checks.push('earlier messages preserve exact order without duplicates');
  }
  writeFileSync(new URL('../reports/'+reportPrefix+'-browser.sop',import.meta.url),encodeSOP({schema:'sxlm.chat-browser.v1',passed:true,liveCodex:live,chat,checks,screenshots:[reportPrefix+'-desktop.png',reportPrefix+'-mobile.png']}));
  console.log('Chat browser verification passed: '+checks.join(', '));
} finally {socket?.close();child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null)resolve();else{child.once('exit',resolve);setTimeout(resolve,3000);}});rmSync(profile,{recursive:true,force:true});}
