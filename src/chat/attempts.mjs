import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { check } from '../kernel/data.mjs';
import { encodeSOP } from '../kernel/sop-data.mjs';

const repair = `The host rejected the previous document candidate. Read validation.sop for the diagnostic and
the remaining job time, then correct build.mjs and regenerate candidate.sop. TASK.txt, sdk.mjs and the
original parent/source contracts still apply. Preserve source coverage and disclose any necessary
reduction. Repair the reusable representation; do not add answers for evaluator case identifiers.
Do not edit reference/, packet.sop, source/ or the original attachment to make validation pass.
Run meaningful questions and counterexamples under the unchanged default request budgets. Record
the change and its measured effect in an SOP report. This is the final automatic correction attempt.`;

// Host orchestration only. Every attempt returns through the same candidate validator.
export async function prepareCandidate({ directory, archive, prompt, run, validate, update, remaining, checkActive }) {
  mkdirSync(archive, { recursive: true, mode: 0o700 });
  const attempts = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    checkActive();
    update({ status: 'running', attempt, attempts });
    await run(attempt === 1 ? prompt : repair, attempt);
    checkActive();
    update({ status: 'validating', attempt, attempts });
    const saved = join(archive, String(attempt));
    mkdirSync(saved, { mode: 0o700 });
    const artifacts = [];
    for (const file of ['candidate.sop', 'build.mjs', `agent-result-${attempt}.txt`]) {
      const path = join(directory, file);
      if (!existsSync(path)) continue;
      check(lstatSync(path).isFile(), 'Candidate and compiler artifacts must be regular files');
      const bytes = readFileSync(path);
      writeFileSync(join(saved, file), bytes, { mode: 0o600 });
      artifacts.push({ file, bytes: bytes.length, hash: createHash('sha256').update(bytes).digest('hex') });
    }
    let result, error;
    try { result = await validate(saved); } catch (rejected) { error = rejected; }
    const feedback = { schema: 'sxlm.document-attempt.v1', attempt,
      accepted: !error, artifacts, candidate: result?.receipt.candidate ?? null,
      error: error?.message ?? null, diagnostic: error?.documentValidation ?? null,
      remainingMilliseconds: Math.max(0, remaining()),
      qualification: 'Accepted means candidate validation passed; activation also requires a live job and valid conversation replay. Repeated validation supplies adaptive feedback, not blind evaluation.' };
    writeFileSync(join(saved, 'validation.sop'), encodeSOP(feedback), { mode: 0o600 });
    writeFileSync(join(directory, 'validation.sop'), encodeSOP(feedback), { mode: 0o600 });
    attempts.push(feedback);
    update({ status: 'validating', attempt, attempts });
    checkActive();
    if (!error) return result;
    if (attempt === 2 || error.repairable === false) throw error;
  }
}
