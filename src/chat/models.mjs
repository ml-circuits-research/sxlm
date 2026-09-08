import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { SymbolicModel } from '../model.mjs';
import { readPack, validatePack } from '../learning/packs.mjs';
import { check } from '../kernel/data.mjs';

/** Content-addressed conversation bases; model growth must not rewrite an older conversation. */
export class ChatModels {
  constructor(store) { this.store = store; }
  path(identity, ...parts) {
    check(typeof identity === 'string' && /^[a-f0-9]{64}$/.test(identity), 'Invalid archived model identity');
    return join(this.store.directory, 'models', identity, ...parts);
  }
  save(model) {
    const identity = model.resources.hash, directory = this.path(identity);
    if (existsSync(join(directory, 'model.sop'))) return identity;
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const packs = model.packs.map((pack, index) => {
      const file = `pack-${index}.sop`, manifest = validatePack(pack);
      this.store.write(join(directory, file), pack);
      return { id: pack.id, hash: manifest.hash, file };
    });
    // The index becomes visible only after all immutable pack artifacts have been written.
    this.store.write(join(directory, 'model.sop'), { schema: 'sxlm.chat-model.v1',
      model: identity, runtime: model.resources.runtime.hash, packs });
    return identity;
  }
  load(identity) {
    const record = this.store.read(this.path(identity, 'model.sop'));
    check(record.schema === 'sxlm.chat-model.v1' && record.model === identity, 'Archived model identity differs');
    const packs = record.packs.map((item, index) => {
      check(item.file === `pack-${index}.sop`, 'Invalid archived pack path');
      const pack = readPack(this.path(identity, item.file)), manifest = validatePack(pack);
      check(pack.id === item.id && manifest.hash === item.hash, 'Archived model pack has changed');
      return pack;
    });
    const model = new SymbolicModel({ packs });
    check(model.resources.runtime.hash === record.runtime && model.resources.hash === identity,
      'This conversation requires its original runtime; revalidate its knowledge before migration');
    return model;
  }
  recover(chat, expected) {
    if (existsSync(this.path(expected, 'model.sop'))) return this.load(expected);
    // Older document jobs already retained their exact parent packs. They are usable only
    // after checking the packet and reconstructing the same content-bound parent identity.
    const job = this.store.jobs(chat).find(job => job.parentModel === expected &&
      existsSync(this.store.jobPath(chat, job.id, 'packet.sop')));
    check(job, 'The original conversation model is unavailable; explicit migration is required');
    const packet = this.store.read(this.store.jobPath(chat, job.id, 'packet.sop'));
    check(packet.parentModel === expected, 'Teaching packet has a different parent model');
    const packs = packet.manifests.map((manifest, index) => {
      const name = index === 0 ? 'english-bootstrap.sop' : `extension-${index}.sop`;
      const pack = readPack(this.store.jobPath(chat, job.id, 'reference', 'packs', name));
      check(validatePack(pack).hash === manifest.hash, 'Teaching reference pack has changed');
      return pack;
    });
    const model = new SymbolicModel({ packs });
    check(model.resources.hash === expected, 'Teaching reference no longer reproduces the original model');
    return model;
  }
}
