import { encodeSOP } from '../src/kernel/sop-data.mjs';
// Optional real-browser test of this repository's application. No browser package is required.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serveDocs } from './serve-docs.mjs';
import { groups, sources } from './docs/catalog.mjs';
import { readChapter } from './docs/chapters.mjs';

const chrome = process.env.SXLM_CHROMIUM ?? ['/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome'].find(existsSync);
assert.ok(chrome, 'Set SXLM_CHROMIUM to an installed Chromium executable');
const profile = mkdtempSync(join(tmpdir(),'sxlm-browser-')), server = await serveDocs(0), url = `http://127.0.0.1:${server.address().port}/docs/`;
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
  await wait('document.querySelectorAll(".nav-menu").length === 4');
  const checks = [], expected = groups.map(([label,pages]) => ({label, links:pages.map(([label,href])=>({label,href}))}));
  const shell = `({title:document.title,menus:[...document.querySelectorAll('.nav-menu')].map(menu=>({label:menu.querySelector('button').textContent.replace('▾','').trim(),links:[...menu.querySelectorAll('a')].map(a=>({label:a.textContent,href:a.getAttribute('href')}))})),width:document.documentElement.scrollWidth,viewport:innerWidth})`;
  for (const entry of sources) {
    const [,page] = entry;
    const heading = readChapter(entry).split('\n')[0].slice(2);
    await send('Page.navigate',{url:url+page+'.html'},sid);
    await wait(`document.documentElement.dataset.navigationReady === 'true' && document.querySelector('main h1')?.textContent === ${JSON.stringify(heading)}`);
    const state=await evaluate(shell);
    assert.equal(state.title,'SXLM Documentation'); assert.deepEqual(state.menus,expected);
    assert.ok(state.width<=state.viewport,`Page overflow: ${page}`);
    checks.push(`chapter ${page}`);
  }
  await send('Page.navigate',{url},sid);
  await wait('document.documentElement.dataset.navigationReady === "true" && document.querySelector(".documentation-map")');
  const projection=await evaluate(`(()=>{const table=document.querySelector('.documentation-map');const heads=[...table.querySelectorAll('th')];const rows=[...table.querySelectorAll('tbody tr')];return heads.map((h,i)=>({label:h.textContent,links:rows.map(r=>r.children[i]).filter(c=>c.querySelector('a')).map(c=>({label:c.querySelector('a').textContent,href:c.querySelector('a').getAttribute('href'),description:c.querySelector('p')?.textContent}))}));})()`);
  assert.deepEqual(projection.map(({label,links})=>({label,links:links.map(({label,href})=>({label,href}))})),expected);
  assert.ok(projection.every(g=>g.links.every(l=>l.description?.length>15)));checks.push('navigation map');
  await click('.nav-menu button');
  assert.equal(await evaluate('document.querySelector(".nav-menu button").getAttribute("aria-expanded")'),'true');
  await click('main h1');
  assert.equal(await evaluate('document.querySelector(".nav-menu button").getAttribute("aria-expanded")'),'false');checks.push('outside click');
  await evaluate('document.querySelector(".nav-menu button").focus()');
  await click('.nav-menu button');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},sid);
  assert.equal(await evaluate('document.activeElement === document.querySelector(".nav-menu button")'),true);
  assert.equal(await evaluate('document.querySelector(".nav-menu button").getAttribute("aria-expanded")'),'false');checks.push('Escape focus');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40},sid);
  assert.equal(await evaluate('document.activeElement === document.querySelector(".submenu a")'),true);checks.push('keyboard menu');
  for (const [label,width,height] of [['desktop',1440,1050],['mobile',390,1000]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:label==='mobile'},sid);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
    await click('main h1');
    const shot=await send('Page.captureScreenshot',{format:'png'},sid);
    writeFileSync(new URL(`../reports/docs-${label}.png`,import.meta.url),Buffer.from(shot.data,'base64'));
    checks.push(`${label} layout`);
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false},sid);
  await send('Page.navigate',{url:url+'specsLoader.html?spec=matrix.md'},sid);
  await wait('document.querySelectorAll("#content table tbody tr").length === 14');
  assert.equal(await evaluate('document.querySelector("#content a").getAttribute("href")'),'specsLoader.html?spec=DS000-vision.md');checks.push('specification matrix');
  await send('Page.navigate',{url:url+'specsLoader.html?spec=DS003-main-behavior.md'},sid);
  await wait('document.querySelector("#content h2") && document.querySelector("#spec-title").textContent === "DS003-main-behavior"');
  const sections=await evaluate('[...document.querySelectorAll("#content h3")].map(h=>h.textContent)');
  assert.equal(sections.length,7);
  const wiki=await evaluate('[...document.querySelectorAll("#content a")].find(a=>a.href.includes("wiki.html#")).href');
  assert.ok(wiki.startsWith(url+'wiki.html#'));
  assert.ok(await evaluate('document.querySelector("#content").getBoundingClientRect().width > innerWidth-100'));checks.push('DS contract and relative wiki links');
  const specShot=await send('Page.captureScreenshot',{format:'png'},sid);
  writeFileSync(new URL('../reports/docs-specification.png',import.meta.url),Buffer.from(specShot.data,'base64'));
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true},sid);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);checks.push('mobile specification width');
  await send('Page.navigate',{url:url+'architecture.html'},sid);
  await wait('document.querySelector(".mermaid svg")',30000);checks.push('rendered architecture diagram');
  assert.equal(errors.length,0,JSON.stringify(errors));checks.push('no JavaScript exceptions');
  writeFileSync(new URL('../reports/docs-browser.sop',import.meta.url),encodeSOP({schema:'sxlm.docs-browser.v1',passed:true,checks,screenshots:['docs-desktop.png','docs-mobile.png','docs-specification.png']}));
  console.log(`Documentation browser verification passed: ${checks.length} checks.`);
} finally {socket?.close();child.kill('SIGTERM');await new Promise(resolve=>server.close(resolve));await new Promise(resolve=>{if(child.exitCode!==null)resolve();else{child.once('exit',resolve);setTimeout(resolve,3000);}});rmSync(profile,{recursive:true,force:true});}
