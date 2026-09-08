import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SymbolicModel } from '../src/model.mjs';
import { readPack } from '../src/learning/packs.mjs';
import { encodeSOP } from '../src/kernel/sop-data.mjs';
import { digest } from '../src/kernel/data.mjs';
import { ChatStore } from '../src/chat/store.mjs';
import { validateDocumentCandidate } from '../src/chat/jobs.mjs';
import { everydayBase } from '../scripts/build-everyday.mjs';

test('the actual document SDK compiles one attributed class declaration through the normal validator', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sxlm-concept-document-'));
  try {
    const base = everydayBase(), parent = new SymbolicModel({ packs: [...base.packs,
      readPack(new URL('../packs/everyday-knowledge.sop', import.meta.url))] });
    const store = new ChatStore(join(directory, 'chats')), chat = store.create(parent.resources.hash);
    const document = store.createDocument(chat.id, 'Classification.txt');
    const text = 'Every silver glider is a flight device. Silver gliders are intended to glide.';
    store.appendChunk(chat.id, document.id, 0, Buffer.from(text));
    const ready = store.finishDocument(chat.id, document.id), workspace = join(directory, 'workspace');
    mkdirSync(join(workspace, 'reference', 'packs'), { recursive: true });
    mkdirSync(join(workspace, 'source'));
    cpSync(new URL('../src/', import.meta.url), join(workspace, 'reference', 'src'), { recursive: true });
    for (let index = 0; index < parent.packs.length; index++) writeFileSync(join(workspace, 'reference', 'packs',
      (index === 0 ? 'english-bootstrap' : 'extension-' + index) + '.sop'), encodeSOP(parent.packs[index]));
    writeFileSync(join(workspace, 'sdk.mjs'), readFileSync(new URL('../src/chat/agent-sdk.txt', import.meta.url)));
    writeFileSync(join(workspace, 'source', 'chunk-0.txt'), text);
    writeFileSync(join(workspace, 'packet.sop'), encodeSOP({ job: 'concept-sdk-probe',
      parentModel: parent.resources.hash, manifests: parent.resources.manifests,
      document: ready, extraction: { textHash: digest(text) } }));
    writeFileSync(join(workspace, 'teaching.sop'), encodeSOP({ concepts: [
      { id: 'silver_glider', singular: 'silver glider', plural: 'silver gliders' },
      { id: 'flight_device', singular: 'flight device', plural: 'flight devices' }
    ], inclusions: [{ subtype: 'silver_glider', supertype: 'flight_device', negative: false,
      chunk: 0, start: 0, end: text.length }], properties: [
      { concept: 'silver_glider', relation: 'function', values: ['glide'], mode: 'all-instances',
        negative: false, chunk: 0, start: 0, end: text.length }
    ] }));
    writeFileSync(join(workspace, 'build.mjs'), "import {readFileSync} from 'node:fs';\n" +
      "import {decodeSOP} from './reference/src/kernel/sop-data.mjs';\n" +
      "import {compileDocument} from './sdk.mjs';\ncompileDocument(decodeSOP(readFileSync('teaching.sop')));\n");
    execFileSync(process.execPath, ['build.mjs'], { cwd: workspace, timeout: 30000, stdio: 'pipe' });
    const candidate = readPack(join(workspace, 'candidate.sop'));
    const receipt = validateDocumentCandidate(parent, candidate, ready, store);
    assert.equal(receipt.facts, 4);
    assert.equal(receipt.rules, 7);
    assert.equal(receipt.sourceSpansValid, true);
    assert.deepEqual(receipt.regressions, []);
    const model = new SymbolicModel({ packs: [...parent.packs, candidate] });
    const answer = model.ask('What are silver gliders?');
    assert.deepEqual(answer.values, ['flight_device']);
    assert.equal(answer.text, 'Silver gliders are flight devices.');
    assert.equal(answer.verification.valid, true);
    assert.equal(model.ask('Is some silver glider a flight device?').truth, 'unknown');
    const purpose = model.ask('What is a silver glider used for?');
    assert.deepEqual(purpose.values, ['glide']);
    assert.equal(purpose.verification.valid, true);
    const individual = model.ask('Sable is a silver glider. What is Sable used for?');
    assert.deepEqual(individual.values, ['glide']);
    assert.equal(individual.verification.valid, true);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
