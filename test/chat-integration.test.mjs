import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { SymbolicModel } from '../src/model.mjs';
import { ChatController } from '../src/chat/controller.mjs';
import { compileKnowledge } from '../src/learning/knowledge.mjs';
import { digest } from '../src/kernel/data.mjs';
import { readPack, validatePack } from '../src/learning/packs.mjs';
import { validateDocumentCandidate } from '../src/chat/jobs.mjs';

const parent = new SymbolicModel();

test('document circuits change a durable conversation while preserving prior observations and source evidence', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sxlm-chat-'));
  const controller = new ChatController({ current: () => parent, directory, elementary: false });
  try {
    const earlier = controller.create();
    const store = controller.store, chat = store.create(parent.resources.hash), document = store.createDocument(chat.id, 'Flight notes');
    assert.equal(controller.ask(chat.id, 'Is Aster a pilot?').result.truth, 'unknown');
    controller.ask(chat.id, 'Bryn is a bird.');
    const text = 'Aster is a pilot.';
    store.appendChunk(chat.id, document.id, 0, Buffer.from(text));
    const ready = store.finishDocument(chat.id, document.id), source = { id: digest(text), text, pack: document.name };
    const fact = { atom: { predicate: 'pilot', terms: ['aster'], negative: false, context: 'world' },
      source, evidence: { source: source.id, start: 0, end: text.length } };
    const provenance = { kind: 'agent-authored-document-interpretation', parentModel: parent.resources.hash, documentHash: ready.hash };
    const memory = compileKnowledge([fact], { id: 'document.test.facts', origin: provenance });
    const pack = { schema: 'sxlm.pack.v1', id: 'document.test', version: '1', provenance, sop: memory.sop, providers: { 'fact-fragments': ['document.test.facts'] } };
    const receipt = validateDocumentCandidate(parent, pack, ready, store);
    assert.equal(receipt.facts, 1);
    const badSource = structuredClone(fact); badSource.source.text = 'A different source';
    const bad = { ...pack, sop: compileKnowledge([badSource], { id: 'document.test.facts', origin: provenance }).sop };
    assert.throws(() => validateDocumentCandidate(parent, bad, ready, store), /uploaded source/);
    assert.throws(() => validateDocumentCandidate(parent, { ...pack, entrypoints: { reason: 'unused' } }, ready, store), /entrypoints/);
    const job = randomUUID(); mkdirSync(store.jobPath(chat.id, job));
    store.write(store.jobPath(chat.id, job, 'candidate.sop'), pack);
    controller.jobs.save(chat.id, { id: job, status: 'ready', parentModel: parent.resources.hash, candidate: validatePack(pack).hash, receipt });
    controller.activate(chat.id, job);
    const answer = controller.ask(chat.id, 'Is Aster a pilot?').result;
    assert.equal(answer.truth, 'true'); assert.equal(answer.verification.valid, true);
    assert.ok(answer.sources.some(item => item.id === source.id && item.text === text));
    assert.equal(controller.ask(chat.id, 'Is Bryn a bird?').result.truth, 'true');
    const updatedBase = new SymbolicModel({ packs: [...parent.packs, pack] });
    const restored = new ChatController({ current: () => updatedBase, directory, elementary: false });
    assert.equal(restored.ask(chat.id, 'Is Aster a pilot?').result.truth, 'true');
    assert.equal(restored.ask(earlier.id, 'Is Aster a pilot?').result.truth, 'unknown');
    const newer = restored.create();
    assert.equal(newer.baseModel, updatedBase.resources.hash);
    assert.equal(restored.ask(newer.id, 'Is Aster a pilot?').result.truth, 'true');
    assert.equal(restored.store.info(earlier.id).baseModel, parent.resources.hash);
    restored.close();
    assert.throws(() => controller.activate(chat.id, job), /stale parent/);
    const damaged = { ...controller.jobs.get(chat.id, job), interpretationLimitations: null };
    controller.jobs.save(chat.id, damaged);
    writeFileSync(store.jobPath(chat.id, job, 'candidate.sop'), 'Damaged artifact');
    const recovering = new ChatController({ current: () => parent, directory, elementary: false });
    assert.match(recovering.jobs.get(chat.id, job).detailsError, /unavailable/);
    assert.throws(() => recovering.ask(chat.id, 'Is Aster a pilot?'));
    const separate = recovering.store.create(parent.resources.hash);
    assert.equal(recovering.ask(separate.id, 'Is Aster a pilot?').result.truth, 'unknown'); recovering.close();
  } finally { controller.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('document jobs queue, cancel before launch and persist executable failures without activation', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'sxlm-chat-'));
  const controller = new ChatController({ current: () => parent, directory, elementary: false, agent: { command: join(directory, 'missing-codex') } });
  try {
    const pending = Array.from({ length: 4 }, () => {
      const chat = controller.store.create(parent.resources.hash), doc = controller.store.createDocument(chat.id, 'Source');
      controller.store.appendChunk(chat.id, doc.id, 0, Buffer.from('Aster is a pilot.'));
      controller.store.finishDocument(chat.id, doc.id);
      return { chat, job: controller.jobs.start(chat.id, doc.id, parent) };
    });
    assert.deepEqual(pending.map(item => item.job.status), ['preparing', 'preparing', 'queued', 'queued']);
    const cancelled = pending.pop();
    assert.equal(controller.jobs.cancel(cancelled.chat.id, cancelled.job.id).status, 'cancelled');
    for (let attempt = 0; attempt < 120 && pending.some(({ chat, job }) =>
      ['queued', 'preparing', 'running'].includes(controller.jobs.get(chat.id, job.id).status)); attempt++)
      await new Promise(resolve => setTimeout(resolve, 50));
    for (const { chat, job } of pending) {
      const failed = controller.jobs.get(chat.id, job.id);
      assert.equal(failed.status, 'failed'); assert.match(failed.error, /ENOENT/);
      assert.equal(controller.store.info(chat.id).activeJobs, undefined);
    }
    assert.equal(controller.jobs.get(cancelled.chat.id, cancelled.job.id).status, 'cancelled');
    const workspace = controller.store.jobPath(pending[0].chat.id, pending[0].job.id);
    writeFileSync(join(workspace, 'build.mjs'), `import { compileDocument } from './sdk.mjs';
compileDocument({facts:[{atom:{predicate:'pilot',terms:['aster'],negative:false,context:'world'},chunk:0,start:0,end:17}],
  phrases:[{category:'N',surface:'flight specialist',value:'pilot'}],
  grammar:{productions:[],lexicon:[]},limitations:['Synthetic compiler integration fixture.']});\n`);
    execFileSync(process.execPath, ['build.mjs'], { cwd: workspace, stdio: 'pipe' });
    const compiled = readPack(join(workspace, 'candidate.sop'));
    assert.equal(compiled.providers['grammar-fragments'].length, 2);
    const interpreted = new SymbolicModel({ packs: [...parent.packs, compiled] });
    const answer = interpreted.createSession().ask('Is Aster a flight specialist?');
    assert.equal(answer.truth, 'true'); assert.equal(answer.verification.valid, true);
  } finally { controller.close(); rmSync(directory, { recursive: true, force: true }); }
});
