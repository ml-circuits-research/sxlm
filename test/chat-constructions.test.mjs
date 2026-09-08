import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SymbolicModel } from '../src/model.mjs';
import { ChatController } from '../src/chat/controller.mjs';

test('new school chats combine concept knowledge and induced constructions while archived bases stay pinned', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sxlm-chat-constructions-')), base = new SymbolicModel();
  try {
    const earlier = new ChatController({ current: () => base, directory, elementary: false });
    const old = earlier.create();
    earlier.ask(old.id, 'Mira is a pilot.');
    const controller = new ChatController({ current: () => base, directory });
    assert.equal(controller.model(old.id).resources.hash, base.resources.hash);
    assert.equal(controller.ask(old.id, 'Is Mira a pilot?').result.truth, 'true');
    const fresh = controller.create();
    assert.ok(controller.model(fresh.id).packs.some(pack => pack.id === 'english-constructions'));
    const passive = controller.ask(fresh.id, 'Pico is owned by Mira. Does Mira own Pico?').result;
    assert.equal(passive.truth, 'true');
    assert.equal(passive.verification.valid, true);
    const reversedForm = controller.ask(fresh.id, 'Is Pico owned by Mira?').result;
    assert.equal(reversedForm.truth, 'true');
    const definition = controller.ask(fresh.id, 'What is a cat?').result;
    assert.equal(definition.status, 'answered');
    assert.ok(definition.text.includes('Cats are mammals.'));
    assert.ok(controller.model(fresh.id).packs.some(pack => pack.id === 'everyday-knowledge'));
    const use = controller.ask(fresh.id, 'What is a pencil used for?').result;
    assert.deepEqual(use.values, ['write']);
    assert.equal(use.verification.valid, true);
    assert.equal(controller.store.info(old.id).baseModel, base.resources.hash);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
