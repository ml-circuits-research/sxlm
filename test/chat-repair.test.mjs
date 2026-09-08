import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ChatController } from '../src/chat/controller.mjs';
import { prepareCandidate } from '../src/chat/attempts.mjs';
import { SymbolicModel } from '../src/model.mjs';
import { decodeSOP } from '../src/kernel/sop-data.mjs';
import { compileGrammarKnowledge } from '../src/learning/grammar.mjs';
import { validateDocumentCandidate } from '../src/chat/jobs.mjs';

test('a rejected document receives bounded repair feedback before ordinary source validation and activation', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'sxlm-chat-repair-'));
  const command = join(directory, 'synthetic-agent.mjs');
  // This controlled child process exercises orchestration; it is not evidence of a real coding agent.
  writeFileSync(command, `#!${process.execPath}
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const { compileDocument } = await import(process.cwd() + '/sdk.mjs');
const { decodeSOP, encodeSOP } = await import(process.cwd() + '/reference/src/kernel/sop-data.mjs');
let prompt = ''; for await (const chunk of process.stdin) prompt += chunk;
const retry = existsSync('validation.sop');
assert.ok(process.argv.includes('workspace-write'));
if (retry) {
  const feedback = decodeSOP(readFileSync('validation.sop'));
  assert.equal(feedback.accepted, false); assert.equal(feedback.attempt, 1);
  assert.match(feedback.error, /source identity differs/); assert.match(prompt, /final automatic/);
  assert.equal(feedback.artifacts.find(item => item.file === 'candidate.sop').hash.length, 64);
} else assert.match(prompt, /compositional SOP interpretation/);
compileDocument({facts:[{atom:{predicate:'pilot',terms:['aster'],negative:false,context:'world'},
  chunk:0,start:0,end:17}],limitations:['Synthetic child-process integration fixture.']});
if (!retry) {
  const pack = decodeSOP(readFileSync('candidate.sop'));
  pack.provenance.documentHash = 'incorrect-source-identity';
  writeFileSync('candidate.sop', encodeSOP(pack));
}
writeFileSync(process.argv[process.argv.indexOf('-o') + 1], retry ? 'Repaired source identity.' : 'First candidate.');
`, { mode: 0o700 });
  const parent = new SymbolicModel();
  const controller = new ChatController({ current: () => parent, directory: join(directory, 'chats'),
    elementary: false, agent: { command } });
  try {
    const chat = controller.create(), untouched = controller.create();
    const document = controller.store.createDocument(chat.id, 'Notes.txt');
    controller.store.appendChunk(chat.id, document.id, 0, Buffer.from('Aster is a pilot.'));
    controller.store.finishDocument(chat.id, document.id);
    const started = controller.jobs.start(chat.id, document.id, parent);
    const until = Date.now() + 90000;
    let validationPolls = 0;
    while (controller.jobs.running.has(started.id) && Date.now() < until) {
      if (controller.jobs.get(chat.id, started.id).status === 'validating') validationPolls++;
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    const job = controller.jobs.get(chat.id, started.id);
    assert.equal(job.status, 'ready', job.error);
    assert.equal(job.attempt, 2);
    assert.equal(job.receipt.execution, 'isolated-host-process');
    assert.ok(validationPolls > 3, 'Host status reads must remain responsive during validation');
    assert.deepEqual(job.attempts.map(attempt => attempt.accepted), [false, true]);
    assert.ok(job.attempts[1].remainingMilliseconds < job.attempts[0].remainingMilliseconds);
    assert.equal(job.attempts[1].candidate, job.candidate);
    const archive = controller.store.path(chat.id, 'attempts-' + started.id);
    const rejected = decodeSOP(readFileSync(join(archive, '1/candidate.sop')));
    assert.equal(rejected.provenance.documentHash, 'incorrect-source-identity');
    assert.equal(decodeSOP(readFileSync(join(archive, '2/validation.sop'))).accepted, true);
    assert.deepEqual(controller.store.info(chat.id).activeJobs, [started.id]);
    const answer = controller.ask(chat.id, 'Is Aster a pilot?').result;
    assert.equal(answer.truth, 'true'); assert.equal(answer.verification.valid, true);
    assert.equal(controller.ask(untouched.id, 'Is Aster a pilot?').result.truth, 'unknown');
    const candidate = decodeSOP(readFileSync(join(archive, '2/candidate.sop')));
    const language = compileGrammarKnowledge({ productions: [],
      lexicon: [{ category: 'N', surface: 'bird', value: 'conflicting_meaning' }] },
    { id: 'test.conflicting-language', origin: { kind: 'evaluator-authored-conflict' } });
    const conflicting = { ...candidate, sop: [...candidate.sop, ...language.sop], providers: {
      ...candidate.providers, 'grammar-fragments': language.providers['grammar-fragments'] } };
    assert.throws(() => validateDocumentCandidate(parent, conflicting,
      controller.store.document(chat.id, document.id), controller.store, job.extraction), error => {
      assert.match(error.message, /introduced regressions/);
      assert.equal(error.documentValidation.stage, 'procedure-regression');
      assert.ok(error.documentValidation.regressions.length > 0);
      assert.ok(error.documentValidation.regressions.every(row =>
        Object.keys(row).every(key => ['id', 'status', 'gaps', 'milliseconds'].includes(key))));
      return true;
    });
  } finally { controller.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('repair stops after two invalid candidates and preserves rejected bytes outside the writable workspace', async () => {
  const root = mkdtempSync(join(tmpdir(), 'sxlm-attempts-'));
  const directory = join(root, 'workspace'), archive = join(root, 'host-archive');
  mkdirSync(directory);
  let launches = 0, state;
  try {
    await assert.rejects(prepareCandidate({ directory, archive, prompt: 'Task',
      checkActive() {}, remaining: () => 10000,
      update: value => { state = value; },
      run: async (_, attempt) => {
        launches++; writeFileSync(join(directory, 'candidate.sop'), 'Rejected ' + attempt);
        if (attempt === 2) writeFileSync(join(directory, 'validation.sop'), 'Agent replaced its feedback copy.');
      },
      validate() { throw new Error('Invalid source attribution'); }
    }), /Invalid source attribution/);
    assert.equal(launches, 2); assert.equal(state.attempts.length, 2);
    assert.equal(readFileSync(join(archive, '1/candidate.sop'), 'utf8'), 'Rejected 1');
    assert.equal(decodeSOP(readFileSync(join(archive, '1/validation.sop'))).accepted, false);
    assert.notEqual(state.attempts[0].artifacts[0].hash, state.attempts[1].artifacts[0].hash);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a cancellation or deadline observed during validation prevents candidate acceptance', async () => {
  const root = mkdtempSync(join(tmpdir(), 'sxlm-attempt-deadline-'));
  try {
    for (const reason of ['Document processing cancelled', 'Document job exceeded its time limit']) {
      const directory = join(root, String(reason.length)); mkdirSync(directory);
      let stopped = false, launches = 0;
      await assert.rejects(prepareCandidate({ directory, archive: join(directory, 'archive'), prompt: 'Task',
        update() {}, remaining: () => stopped ? 0 : 5000,
        checkActive() { if (stopped) throw new Error(reason); },
        async run() { launches++; },
        validate() { stopped = true; return { candidate: {}, receipt: { candidate: 'identity' } }; }
      }), { message: reason });
      assert.equal(launches, 1);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
