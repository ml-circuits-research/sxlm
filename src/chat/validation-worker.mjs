import { readFileSync, writeFileSync } from 'node:fs';
import { encodeSOP, decodeSOP } from '../kernel/sop-data.mjs';
import { check } from '../kernel/data.mjs';
import { SymbolicModel } from '../model.mjs';
import { readPack } from '../learning/packs.mjs';
import { ChatStore } from './store.mjs';
import { validateDocumentCandidate } from './jobs.mjs';

// Fixed host program. The candidate and parent are inert, protected SOP inputs.
const [requestPath, responsePath] = process.argv.slice(2);
const request = decodeSOP(readFileSync(requestPath));
check(request.schema === 'sxlm.document-validation-request.v1', 'Invalid validation request');
const parent = new SymbolicModel({ packs: request.packs });
check(parent.resources.hash === request.parentModel, 'Validation parent identity differs');
let result;
try {
  const candidate = readPack(request.candidate);
  const receipt = validateDocumentCandidate(parent, candidate, request.document,
    new ChatStore(request.store), request.extraction);
  result = { accepted: true, receipt };
} catch (error) {
  result = { accepted: false, error: error.message, diagnostic: error.documentValidation ?? null };
}
writeFileSync(responsePath, encodeSOP({ schema: 'sxlm.document-validation-response.v1',
  parentModel: request.parentModel, ...result }), { mode: 0o600 });
