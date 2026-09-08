import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ChatStore } from '../src/chat/store.mjs';

test('document uploads preserve UTF-8 bytes beyond the structured request limit and resume idempotently', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sxlm-chat-'));
  try {
    const store = new ChatStore(directory), chat = store.create('model');
    const doc = store.createDocument(chat.id, 'A long source');
    const chunk = Buffer.from('A😀e\u0301. '.repeat(5000));
    const hash = createHash('sha256');
    for (let index = 0; index < 20; index++) {
      store.appendChunk(chat.id, doc.id, index, chunk); hash.update(chunk);
    }
    assert.equal(store.appendChunk(chat.id, doc.id, 19, chunk).chunks, 20);
    assert.throws(() => store.appendChunk(chat.id, doc.id, 19, Buffer.from('changed')), /identical/);
    assert.throws(() => store.appendChunk(chat.id, doc.id, 21, chunk), /index/);
    assert.throws(() => store.appendChunk(chat.id, doc.id, 20, Buffer.from([0xf0, 0x9f])), /encoded data/);
    const reopened = new ChatStore(directory), result = reopened.finishDocument(chat.id, doc.id);
    assert.ok(result.bytes > 524288);
    assert.equal(result.hash, hash.digest('hex'));
    assert.deepEqual(reopened.finishDocument(chat.id, doc.id), result);
    assert.throws(() => reopened.appendChunk(chat.id, doc.id, 20, chunk), /closed/);
    assert.throws(() => reopened.info('../outside'), /identity/);
    assert.throws(() => reopened.document(chat.id, '../outside'), /identity/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('conversation transcripts persist their model-bound snapshots with ordered pagination', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sxlm-chat-'));
  try {
    const store = new ChatStore(directory), chat = store.create('m1');
    for (let index = 0; index < 3; index++) store.appendTurn(chat.id, 'message ' + index, { text: 'reply ' + index }, { model: 'm1', index });
    const reopened = new ChatStore(directory);
    assert.equal(reopened.list()[0].turns, 3);
    assert.deepEqual(reopened.turns(chat.id, 1, 1).turns.map(turn => turn.index), [1]);
    assert.deepEqual(reopened.snapshot(chat.id), { model: 'm1', index: 2 });
    assert.throws(() => reopened.turns(chat.id, -1), /page/);
    const early = 'ffffffff-ffff-ffff-ffff-ffffffffffff', late = '00000000-0000-0000-0000-000000000000';
    for (const [id, created] of [[early, '2026-01-01'], [late, '2026-02-01']]) {
      mkdirSync(reopened.jobPath(chat.id, id));
      reopened.write(reopened.jobPath(chat.id, id, 'job.sop'), { id, created });
    }
    assert.deepEqual(reopened.jobs(chat.id).map(job => job.id), [early, late]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
