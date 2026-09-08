import { mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { encodeSOP, decodeSOP } from '../kernel/sop-data.mjs';
import { check } from '../kernel/data.mjs';
import { documentFormat } from './extract.mjs';

const identifier = value => {
  check(typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value), 'Invalid chat artifact identity');
  return value;
};
export class ChatStore {
  constructor(directory = '.sxlm/chat') {
    this.directory = resolve(directory);
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
  }
  path(chat, ...parts) { return join(this.directory, identifier(chat), ...parts); }
  read(path) { return decodeSOP(readFileSync(path, 'utf8')); }
  write(path, value) {
    const temporary = path + '.' + randomUUID() + '.tmp';
    writeFileSync(temporary, encodeSOP(value), { mode: 0o600 });
    renameSync(temporary, path);
  }
  list() {
    return readdirSync(this.directory).filter(id => /^[a-f0-9-]{36}$/.test(id))
      .map(id => this.info(id)).sort((a, b) => b.updated.localeCompare(a.updated));
  }
  create(model) {
    const id = randomUUID(), now = new Date().toISOString();
    mkdirSync(this.path(id), { mode: 0o700 });
    const record = { schema: 'sxlm.chat.v1', id, model, title: 'New conversation', created: now, updated: now, turns: 0 };
    this.write(this.path(id, 'chat.sop'), record);
    return record;
  }
  info(id) { return this.read(this.path(id, 'chat.sop')); }
  update(id, fields) {
    const record = { ...this.info(id), ...fields, updated: new Date().toISOString() };
    this.write(this.path(id, 'chat.sop'), record);
    return record;
  }
  turns(id, offset = 0, limit = 20) {
    const total = this.info(id).turns;
    check(Number.isSafeInteger(offset) && offset >= 0 && Number.isSafeInteger(limit) && limit > 0 && limit <= 50, 'Invalid turn page');
    const turns = [];
    for (let i = offset; i < Math.min(total, offset + limit); i++) turns.push(this.read(this.path(id, `turn-${i}.sop`)));
    return { turns, total, next: Math.min(total, offset + limit) };
  }
  appendTurn(id, text, result, snapshot) {
    const record = this.info(id);
    // Commit transcript and state together in one atomic artifact. The index is recoverable.
    const turn = { schema: 'sxlm.chat-turn.v1', index: record.turns, text, result, snapshot, created: new Date().toISOString() };
    this.write(this.path(id, `turn-${record.turns}.sop`), turn);
    this.update(id, { turns: record.turns + 1, model: snapshot.model, title: record.turns ? record.title : text.slice(0, 80) });
    return turn;
  }
  snapshot(id) {
    const info = this.info(id);
    return info.turns ? this.read(this.path(id, `turn-${info.turns - 1}.sop`)).snapshot : null;
  }
  documents(id) {
    this.info(id);
    return readdirSync(this.path(id)).filter(name => name.startsWith('document-'))
      .map(name => this.read(this.path(id, name, 'document.sop')));
  }
  documentPath(id, document, ...parts) { return this.path(id, 'document-' + identifier(document), ...parts); }
  document(id, document) { return this.read(this.documentPath(id, document, 'document.sop')); }
  createDocument(id, name) {
    this.info(id);
    check(typeof name === 'string' && name.trim().length > 0 && name.length <= 200, 'Document name must contain 1–200 characters');
    const format = documentFormat(name);
    check(format !== 'unsupported', 'Supported attachments: PDF, DOCX, PPTX, XLSX, text, HTML, CSV, and images.');
    const document = randomUUID();
    mkdirSync(this.documentPath(id, document), { mode: 0o700 });
    const record = { schema: 'sxlm.chat-document.v1', id: document, chat: id, name, format, chunks: 0, bytes: 0, status: 'uploading' };
    this.write(this.documentPath(id, document, 'document.sop'), record);
    return record;
  }
  appendChunk(id, document, index, bytes) {
    const record = this.document(id, document);
    check(record.status === 'uploading', 'Document upload is closed');
    check(Number.isSafeInteger(index) && index >= 0 && index <= record.chunks, 'Unexpected document chunk index');
    check(bytes.length > 0 && bytes.length <= 65536, 'A document chunk must contain 1–65536 bytes');
    const path = this.documentPath(id, document, `chunk-${index}.txt`);
    // Chunks are independently valid UTF-8 so agent source spans cannot straddle a broken code point.
    if ((record.format ?? 'text') === 'text') new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (index < record.chunks) {
      check(readFileSync(path).equals(bytes), 'A repeated chunk must have identical content');
      return record;
    }
    writeFileSync(path, bytes, { mode: 0o600 });
    const next = { ...record, chunks: index + 1, bytes: record.bytes + bytes.length };
    this.write(this.documentPath(id, document, 'document.sop'), next);
    return next;
  }
  finishDocument(id, document) {
    const record = this.document(id, document);
    if (record.status === 'ready') return record;
    check(record.status === 'uploading' && record.chunks > 0, 'An empty or closed document cannot be completed');
    const digest = createHash('sha256');
    for (let i = 0; i < record.chunks; i++) digest.update(readFileSync(this.documentPath(id, document, `chunk-${i}.txt`)));
    const next = { ...record, status: 'ready', hash: digest.digest('hex') };
    this.write(this.documentPath(id, document, 'document.sop'), next);
    return next;
  }
  jobPath(id, job, ...parts) { return this.path(id, 'job-' + identifier(job), ...parts); }
  jobs(id) {
    this.info(id);
    return readdirSync(this.path(id)).filter(name => name.startsWith('job-'))
      .filter(name => existsSync(this.path(id, name, 'job.sop')))
      .map(name => this.read(this.path(id, name, 'job.sop')))
      .sort((left, right) => (left.created ?? '').localeCompare(right.created ?? ''));
  }
}
