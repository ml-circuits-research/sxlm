import { encodeSOP, decodeSOP } from '../kernel/sop-data.mjs';
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, readdirSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SymbolicModel } from '../model.mjs';
import { readPack, bootstrapURL, validatePack, combinePacks } from './packs.mjs';
import { evaluate } from './evaluate.mjs';
import { canonical, check, digest } from '../kernel/data.mjs';
import { modelIdentity, runtimeIdentity } from '../runtime-identity.mjs';

export function validateCandidate(model, candidate, { gates, regressions = [] }) {
  validatePack(candidate); check(Array.isArray(gates) && gates.length > 0, 'Independent promotion gates are required');
  if(candidate.provenance.parentModel!=null)check(candidate.provenance.parentModel===model.resources.hash,'Candidate parent model differs from the current model; retrain or explicitly rebase');
  check(!model.packs.some(p => p.id === candidate.id), 'Use a new pack identity for an incremental extension');
  const trained = new SymbolicModel({ packs: [...model.packs, candidate], limits: model.limits });
  const baseline = evaluate(model, gates), proposal = evaluate(trained, gates);
  const before = evaluate(model, regressions), after = evaluate(trained, regressions);
  const regressionsIntroduced = before.results.filter((r, i) => r.pass && !after.results[i].pass).map(r => r.id);
  const improvements = baseline.results.filter((r, i) => !r.pass && proposal.results[i].pass).map(r => r.id);
  const candidateText = canonical(candidate);
  const leakedCases = gates.filter(g => typeof g.text==='string' ? candidateText.includes(g.text) : g.task==='circuit'&&g.input ? candidateText.includes(canonical(g.input)) : g.task==='plan'&&g.problem&&candidateText.includes(canonical(g.problem))).map(g => g.id);
  return {
    schema: 'sxlm.promotion.v1', candidate: { id: candidate.id, hash: validatePack(candidate).hash }, parentModel: model.resources.hash, proposedModel: trained.resources.hash,
    accepted: proposal.failed === 0 && regressionsIntroduced.length === 0 && improvements.length > 0 && leakedCases.length === 0,
    improvements, regressionsIntroduced, leakedCases, gates: { before: baseline, after: proposal }, regressions: { before, after },
    policy: { requiresAllGates: true, requiresImprovement: true, forbidsNewRegression: true, forbidsVerbatimGateText: true, forbidsVerbatimCircuitGateInputs:true, forbidsVerbatimPlanningGateInputs:true },
  };
}
export function atomicSOP(path, value) {
  const temporary = `${path}.${process.pid}.tmp`; writeFileSync(temporary, `${encodeSOP(value)}\n`, { flag: 'wx' }); renameSync(temporary, path);
}
export function loadRegistry(directory) {
  const base = readPack(bootstrapURL), path = join(directory, 'active.sop');
  if (!existsSync(path)) return { packs: [base], active: null };
  const active = decodeSOP(readFileSync(path, 'utf8'));
  check(active.schema === 'sxlm.registry.v1' && active.bootstrap === validatePack(base).hash, 'Registry bootstrap mismatch; migrate explicitly');
  const packs = [base];
  for (const hash of active.extensions) {
    check(/^[a-f0-9]{64}$/.test(hash), 'Invalid registry content address');
    const pack = readPack(join(directory, 'packs', `${hash}.sop`)); check(validatePack(pack).hash === hash, 'Registry pack content was modified'); packs.push(pack);
  }
  check(modelIdentity(combinePacks(packs).hash) === active.model, 'Registry model identity does not match its packs or runtime');
  return { packs, active };
}
function locked(directory, operation) {
  mkdirSync(directory, { recursive: true }); const path = join(directory, 'write.lock'); let fd;
  try { fd = openSync(path, 'wx', 0o600); } catch (error) { if (error.code === 'EEXIST') throw new Error('Registry is locked by another writer; inspect write.lock if a previous writer crashed'); throw error; }
  try { writeFileSync(fd, encodeSOP({ pid: process.pid, started: new Date().toISOString() })); return operation(); }
  finally { closeSync(fd); unlinkSync(path); }
}
export function promote(directory, candidate, options) { return locked(directory, () => promoteLocked(directory, candidate, options)); }
function promoteLocked(directory, candidate, { gates, regressions }) {
  const loaded = loadRegistry(directory), model = new SymbolicModel({ packs: loaded.packs });
  // Receipts are informational. Promotion always reruns validation against the currently active parent.
  const receipt = validateCandidate(model, candidate, { gates, regressions });
  check(receipt.accepted, `Promotion rejected: ${encodeSOP({ failedGates: receipt.gates.after.failed, regressions: receipt.regressionsIntroduced, improvements: receipt.improvements.length, leakedCases: receipt.leakedCases })}`);
  mkdirSync(join(directory, 'packs'), { recursive: true }); mkdirSync(join(directory, 'history'), { recursive: true });
  const hash = validatePack(candidate).hash, packPath = join(directory, 'packs', `${hash}.sop`);
  if (!existsSync(packPath)) atomicSOP(packPath, candidate);
  if (loaded.active) atomicSOP(join(directory, 'history', `${digest(loaded.active)}.sop`), loaded.active);
  const active = { schema: 'sxlm.registry.v1', bootstrap: validatePack(loaded.packs[0]).hash, extensions: [...(loaded.active?.extensions ?? []), hash], model: receipt.proposedModel, previous: loaded.active ? digest(loaded.active) : null, validation: digest(receipt) };
  atomicSOP(join(directory, `receipt-${hash}.sop`), receipt); atomicSOP(join(directory, 'active.sop'), active);
  return { active, receipt };
}
export function rollback(directory) { return locked(directory, () => rollbackLocked(directory)); }
function rollbackLocked(directory) {
  const { active } = loadRegistry(directory); check(active, 'No active extension registry');
  const prior = active.previous ? decodeSOP(readFileSync(join(directory, 'history', `${active.previous}.sop`), 'utf8')) : { ...active, extensions: [], previous: null, validation: null };
  const packs = [readPack(bootstrapURL), ...prior.extensions.map(h => readPack(join(directory, 'packs', `${h}.sop`)))];
  prior.model = new SymbolicModel({ packs }).resources.hash; atomicSOP(join(directory, 'active.sop'), prior); return prior;
}
export function preparePacket(model, specification, directory) {
  const action=Array.isArray(specification.library)?'program':'induce';
  mkdirSync(directory, { recursive: true });
  check(readdirSync(directory).length === 0, 'Training packet directory must be empty');
  atomicSOP(join(directory, 'specification.sop'), specification);
  atomicSOP(join(directory, 'parent-model.sop'), { hash: model.resources.hash, runtime: runtimeIdentity, manifests: model.resources.manifests, categories: [...model.grammar.productions.keys()], primitiveContracts: [...model.runtime.primitives.entries()].map(([name, p]) => ({ name, inputs: p.inputs, output: p.output, pure: p.pure })), circuitContracts:[...model.runtime.programs].map(([name,p])=>({name,inputs:p.inputs,output:p.output,pure:p.pure,hash:p.hash})) });
  const instructions = `# Coding-agent training packet\n\nProduce one inert sxlm.pack.v1 SOP candidate. All runtime behavior must remain independent of sibling repositories.\n\nUse the supplied examples to teach a reusable grammar category or circuit. The target category is ${specification.category ?? 'specified in specification.sop'}. Read docs/specs/DS008-learning-and-promotion.md and docs/specs/DS002-sop-runtime.md in the repository. Language knowledge belongs in packs, never in JavaScript token-specific branches.\n\nStart with: node bin/sxlm.mjs train ${action} ${resolve(directory, 'specification.sop')} --out ${resolve(directory, 'candidate.sop')}\n\nFor program synthesis, supply typed inputs/output, a bounded library of pure operations or existing circuit calls, constants and demonstrations. The search produces a training-consistent hypothesis, not a uniqueness or generalization guarantee. Keep evaluator cases outside this packet.\n\nFor variable-width constructions, declare ordered slots with a name and existing grammar category, and annotate each example.spans with token-aligned UTF-16 start/end offsets. Mark a slot semantic:false only when it contributes syntax without meaning; excluded slots cannot supply semantic projections and at least one semantic slot is required. Supply each complete expected meaning. Parse slots under the parent grammar to obtain their exact binding identities; do not guess fresh identifiers. Include both empty and nonempty constraint sequences, and vary roles and polarity independently when relevant. The span inducer can select nested fields and concatenate complete sequences; it does not infer arbitrary transformations or morphology. Legacy slotCategories still selects the fixed-column inducer.\n\nIf the inducer is insufficient, author a compositional grammar proposal and semantic circuit using the existing primitive contracts. Compile grammar proposals offline with compileGrammarKnowledge from src/index.mjs; active packs must not contain a raw grammar field. Preserve authored versus induced provenance. State assumptions and what the examples do not establish. Do not put exact answers, evaluation IDs, or held-out question texts into the candidate. Do not change evaluation fixtures.\n\nThe evaluator owns promotion gates separately. A proposal must improve those gates, preserve prior passing behavior, carry provenance, and pass structural validation. Do not promote your own proposal merely because its training examples replay.\n`;
  writeFileSync(join(directory, 'AGENT-TASK.md'), instructions);
  return { directory: resolve(directory), parentModel: model.resources.hash, files: ['AGENT-TASK.md', 'specification.sop', 'parent-model.sop'] };
}
