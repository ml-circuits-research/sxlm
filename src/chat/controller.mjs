import { readFileSync, existsSync, openSync, closeSync, readSync, statSync } from 'node:fs';
import { SymbolicModel } from '../model.mjs';
import { readPack, validatePack } from '../learning/packs.mjs';
import { check } from '../kernel/data.mjs';
import { ChatStore } from './store.mjs';
import { DocumentJobs } from './jobs.mjs';
import { ChatModels } from './models.mjs';

export class ChatController {
  constructor({ current, directory, elementary = true, agent = {} }) {
    this.current = current; this.store = new ChatStore(directory);
    this.jobs = new DocumentJobs(this.store, { ...agent,
      onReady: (chat, job, checkActive) => this.activate(chat, job, checkActive) });
    this.elementary = elementary ? readPack(new URL('../../packs/elementary-knowledge.sop', import.meta.url)) : null;
    this.constructions = elementary ? readPack(new URL('../../packs/english-constructions.sop', import.meta.url)) : null;
    this.everyday = elementary ? readPack(new URL('../../packs/everyday-knowledge.sop', import.meta.url)) : null;
    this.models = new Map();
    this.archives = new ChatModels(this.store);
    for (const chat of this.store.list()) if (!chat.baseModel) {
      try { this.conversationBase(chat.id); }
      catch (error) { this.store.update(chat.id, { baseRecoveryError: error.message }); }
    }
  }
  base() {
    const current = this.current();
    const additions = [this.constructions, this.elementary, this.everyday]
      .filter(pack => pack && !current.packs.some(installed => installed.id === pack.id));
    if (!additions.length) return current;
    const key = current.resources.hash;
    if (!this.models.has(key)) this.models.set(key, new SymbolicModel({ packs: [...current.packs, ...additions] }));
    return this.models.get(key);
  }
  create() {
    const base = this.base(), identity = this.archives.save(base);
    const chat = this.store.create(identity);
    return this.store.update(chat.id, { baseModel: identity });
  }
  conversationBase(id) {
    const chat = this.store.info(id);
    if (!chat.baseModel) {
      const expected = chat.activeJobs?.length ? this.jobs.get(id, chat.activeJobs[0]).parentModel : chat.model;
      const current = this.base(), base = current.resources.hash === expected ? current : this.archives.recover(id, expected);
      this.archives.save(base);
      this.store.update(id, { baseModel: expected, baseRecoveryError: null });
      this.models.set('base:' + expected, base);
      return base;
    }
    const key = 'base:' + chat.baseModel;
    if (!this.models.has(key)) this.models.set(key, this.archives.load(chat.baseModel));
    return this.models.get(key);
  }
  model(id, extra) {
    const base = this.conversationBase(id), record = this.store.info(id), jobs = [...(record.activeJobs ?? []), ...(extra ? [extra] : [])];
    const key = base.resources.hash + ':' + jobs.join(':');
    if (!this.models.has(key)) {
      const packs = jobs.map(job => {
        const receipt = this.jobs.get(id, job), candidate = readPack(this.store.jobPath(id, job, 'candidate.sop'));
        check(receipt.status === 'ready' && receipt.candidate === validatePack(candidate).hash, 'Document artifact differs from its validated candidate');
        return candidate;
      });
      this.models.set(key, packs.length ? new SymbolicModel({ packs: [...base.packs, ...packs] }) : base);
      if (this.models.size > 20) this.models.delete(this.models.keys().next().value);
    }
    return this.models.get(key);
  }
  session(id, model = this.model(id)) {
    const snapshot = this.store.snapshot(id);
    if (snapshot?.model === model.resources.hash) return model.createSession(snapshot);
    const session = model.createSession(), count = this.store.info(id).turns;
    // An added document changes model identity. Reinterpret retained observations under that model.
    for (let offset = 0; offset < count; offset += 20) for (const turn of this.store.turns(id, offset).turns) {
      const result = session.ask(turn.text);
      check(result.status !== 'budget-exceeded', 'Conversation replay exceeded its model budget; retain the old context or start another conversation');
    }
    return session;
  }
  ask(id, text) {
    check(typeof text === 'string' && text.trim().length > 0, 'A message is required');
    const session = this.session(id), result = session.ask(text);
    const { trace, ...retained } = result;
    const turn = this.store.appendTurn(id, text, retained, session.snapshot());
    return { index: turn.index, text: turn.text, result: turn.result };
  }
  activate(id, job, checkActive = () => {}) {
    const receipt = this.jobs.get(id, job), current = this.model(id);
    check(receipt.status === 'ready' && receipt.parentModel === current.resources.hash, 'Document job is unavailable or has a stale parent');
    const model = this.model(id, job);
    this.session(id, model);
    checkActive();
    this.store.update(id, { activeJobs: [...(this.store.info(id).activeJobs ?? []), job], model: model.resources.hash });
    return { model: model.resources.hash, receipt: receipt.receipt };
  }
  async route(request, url, send, readSOP) {
    if (!url.pathname.startsWith('/api/chat')) return false;
    const parts = url.pathname.split('/').filter(Boolean).slice(2), [id, action, item, operation, index] = parts;
    const get = request.method === 'GET', post = request.method === 'POST';
    if (!id && get) { send({ chats: this.store.list(), engine: 'codex-exec', elementary: this.elementary?.id ?? null }); return true; }
    if (!id && post) { await readSOP(request); send(this.create()); return true; }
    if (!action && get) {
      const total = this.store.info(id).turns;
      const offset = url.searchParams.has('tail') ? Math.max(0, total - 20) : Number(url.searchParams.get('offset') ?? 0);
      const page = this.store.turns(id, offset);
      send({ chat: this.store.info(id), ...page,
        offset, turns: page.turns.map(({ index, text, result }) => ({ index, text, result: { text: result.text, status: result.status, truth: result.truth ?? null, model: result.model ?? null } })),
        documents: this.store.documents(id), jobs: this.store.jobs(id) }); return true;
    }
    if (action === 'turns' && get) {
      const turn = this.store.turns(id, Number(item), 1).turns[0];
      check(turn, 'Message does not exist'); send({ index: turn.index, text: turn.text, result: turn.result }); return true;
    }
    if (action === 'message' && post) { const body = await readSOP(request); send(this.ask(id, body.text)); return true; }
    if (action === 'documents' && !item && post) {
      const body = await readSOP(request); send(this.store.createDocument(id, body.name)); return true;
    }
    if (action === 'documents' && operation === 'chunks' && post) {
      check((request.headers['content-type'] ?? '').split(';')[0] === ((this.store.document(id, item).format ?? 'text') === 'text' ? 'text/plain' : 'application/octet-stream'), 'Unexpected document chunk content type');
      let size = 0; const chunks = [];
      for await (const chunk of request) { size += chunk.length; check(size <= 65536, 'Document chunk exceeds 64 KiB'); chunks.push(chunk); }
      send(this.store.appendChunk(id, item, Number(index), Buffer.concat(chunks))); return true;
    }
    if (action === 'documents' && operation === 'finish' && post) {
      const body = await readSOP(request), document = this.store.finishDocument(id, item);
      if (body.train === false) { send(document); return true; }
      const prior = this.store.jobs(id).find(job => job.document === item && ['queued', 'preparing', 'running', 'validating', 'ready'].includes(job.status));
      const job = prior ?? this.jobs.start(id, item, this.model(id));
      send({ document, job }); return true;
    }
    if (action === 'jobs' && !item && post) {
      const body = await readSOP(request); send(this.jobs.start(id, body.document, this.model(id))); return true;
    }
    if (action === 'jobs' && item && !operation && get) { send(this.jobs.get(id, item)); return true; }
    if (action === 'jobs' && operation === 'cancel' && post) { await readSOP(request); send(this.jobs.cancel(id, item)); return true; }
    if (action === 'jobs' && operation === 'recheck' && post) {
      await readSOP(request); send(this.jobs.recheck(id, item, this.model(id))); return true;
    }
    if (action === 'jobs' && operation === 'activate' && post) { await readSOP(request); send(this.activate(id, item)); return true; }
    if (action === 'jobs' && operation === 'log' && get) {
      this.jobs.get(id, item);
      const path = this.store.jobPath(id, item, 'agent.log');
      if (!existsSync(path)) { send({ text: '' }); return true; }
      const length = statSync(path).size, buffer = Buffer.alloc(Math.min(length, 65536)), fd = openSync(path, 'r');
      try { readSync(fd, buffer, 0, buffer.length, Math.max(0, length - buffer.length)); }
      finally { closeSync(fd); }
      send({ text: buffer.toString('utf8'), truncated: length > buffer.length }); return true;
    }
    send({ error: 'Chat route not found' }, 404); return true;
  }
  close() { this.jobs.close(); }
}
