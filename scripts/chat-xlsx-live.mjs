import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';

assert.ok(process.argv.includes('--live'), 'Pass --live to run a real coding agent on the local workbench');
const origin = 'http://127.0.0.1:3210';
async function api(path, body, binary = false) {
  const response = await fetch(origin + path, body === undefined ? { headers: { Connection: 'close' } } : { method: 'POST',
    headers: { Connection: 'close', 'Content-Type': binary ? 'application/octet-stream' : 'application/sop' },
    body: binary ? body : encodeSOP(body) });
  const value = decodeSOP(await response.text());
  assert.ok(response.ok, value.error); return value;
}

const existing = process.argv.find(argument => argument.startsWith('--chat='))?.slice(7);
const saved = existing ? await api('/api/chat/' + existing) : null;
const chat = saved?.chat ?? await api('/api/chat', {}), base = '/api/chat/' + chat.id;
const bytes = readFileSync(new URL('../reports/chat-crew.xlsx', import.meta.url));
let before, document, launched;
if (saved) {
  before = await api(base + '/turns/0'); assert.equal(before.text, 'Is Harper careful?');
  const job = saved.jobs.at(-1); document = saved.documents.find(item => item.id === job.document);
  assert.equal(document.hash, createHash('sha256').update(bytes).digest('hex'));
  launched = { job };
} else {
  before = await api(base + '/message', { text: 'Is Harper careful?' });
  document = await api(base + '/documents', { name: 'Crew.xlsx' });
  for (let offset = 0; offset < bytes.length; offset += 65536)
    await api(`${base}/documents/${document.id}/chunks/${offset / 65536}`, bytes.subarray(offset, offset + 65536), true);
  launched = await api(`${base}/documents/${document.id}/finish`, {});
}
assert.equal(before.result.truth, 'unknown');
console.log(`XLSX processing job: ${launched.job.id} (${launched.job.engine}); conversation: ${chat.id}`);
const start = Date.now(); let job, last = '';
do {
  try { job = await api(`${base}/jobs/${launched.job.id}`); }
  catch (error) {
    if (Date.now() - start >= 22 * 60 * 1000) throw error;
    console.log('Retrying the status read after a connection interruption.');
    await new Promise(resolve => setTimeout(resolve, 2000)); continue;
  }
  const state = `${job.status} (attempt ${job.attempt ?? 1})`;
  if (state !== last) { console.log(state); last = state; }
  if (!['queued', 'preparing', 'running', 'validating'].includes(job.status)) break;
  assert.ok(Date.now() - start < 22 * 60 * 1000, 'Live document check timed out');
  await new Promise(resolve => setTimeout(resolve, 2000));
} while (true);

const results = [], probes = [
  { text: 'Is Harper careful?', truth: 'true' },
  { text: 'Is Ellis a pilot?', truth: 'false' },
  { text: 'Who is a pilot?', values: ['harper'] },
  { text: 'Who is a medic?', values: ['ellis'] },
  { text: 'Is Harper a medic?', truth: 'unknown' },
  { text: 'Where is Harper?', values: ['north station'] },
  { text: 'Where is Ellis?', values: ['south station'] },
  { text: 'Is Harper in South station?', truth: 'unknown' }
];
if (job.status === 'ready') for (const probe of probes) {
  const { result } = await api(base + '/message', { text: probe.text });
  const failures = [];
  try {
    if (probe.truth) assert.equal(result.truth, probe.truth);
    if (probe.values) assert.deepEqual(result.values, probe.values);
    assert.equal(result.document.coverage.gaps, 0);
    if (probe.truth !== 'unknown') {
      assert.equal(result.verification.valid, true); assert.ok(result.verification.checkedNodes > 0);
    }
  } catch (error) { failures.push(error.message); }
  results.push({ ...probe, passed: failures.length === 0, failures, actual: result });
  console.log(`${failures.length ? 'FAIL' : 'PASS'} ${probe.text}`);
}
const report = { schema: 'sxlm.chat-xlsx-live.v1', generated: new Date().toISOString(), liveCodex: true,
  chat: chat.id, document: document.id, job: job.id, parentModel: chat.baseModel,
  engine: job.engine, revalidationOf: job.revalidationOf ?? null,
  model: job.receipt?.model ?? null, candidate: job.candidate ?? null,
  status: job.status, error: job.error ?? null, attempts: job.attempts ?? [],
  extraction: job.extraction, before: before.result.truth, total: probes.length,
  passed: job.status === 'ready' && results.length === probes.length && results.every(row => row.passed),
  correct: results.filter(row => row.passed).length, results,
  qualification: 'An actual installed Codex process interpreted a synthetic two-sheet workbook. Revalidation, when recorded, checks that archived coding artifact in a fresh host process and does not rerun Codex. Queries were outside its copied task packet, but fixture, expectations and host share project authorship. Finite format/composition evidence does not establish general spreadsheet understanding.' };
writeFileSync(new URL('../reports/chat-xlsx-live.sop', import.meta.url), encodeSOP(report));
if (!report.passed) process.exitCode = 1;
