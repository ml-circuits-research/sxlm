import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { encodeSOP, decodeSOP } from '../kernel/sop-data.mjs';
import { check } from '../kernel/data.mjs';
import { readPack, validatePack } from '../learning/packs.mjs';

const worker = fileURLToPath(new URL('./validation-worker.mjs', import.meta.url));
export async function validateDocumentIsolated({ directory, parent, document, store, extraction, run }) {
  const input = join(directory, 'request.sop'), output = join(directory, 'response.sop');
  const candidatePath = join(directory, 'candidate.sop');
  writeFileSync(input, encodeSOP({ schema: 'sxlm.document-validation-request.v1',
    parentModel: parent.resources.hash, packs: parent.packs, candidate: candidatePath,
    document, store: store.directory, extraction }), { mode: 0o600 });
  let result, candidate;
  try {
    await run(process.execPath, [worker, input, output]);
    result = decodeSOP(readFileSync(output));
    check(result.schema === 'sxlm.document-validation-response.v1' &&
      result.parentModel === parent.resources.hash && typeof result.accepted === 'boolean',
    'Invalid validation worker response');
    if (result.accepted) {
      candidate = readPack(candidatePath);
      check(validatePack(candidate).hash === result.receipt.candidate &&
        result.receipt.parent === parent.resources.hash, 'Validated artifact identity differs');
    }
  } catch (error) { error.repairable = false; throw error; }
  if (!result.accepted) {
    const error = new Error(result.error); error.documentValidation = result.diagnostic; throw error;
  }
  return { candidate, receipt: { ...result.receipt, execution: 'isolated-host-process' } };
}
