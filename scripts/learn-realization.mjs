import { modulesFromGraphs, graphsFromModules, normalizedGraphs, installGraphs } from '../src/learning/sop-output.mjs';
import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { learnExpression, learnDispatch } from '../src/learning/programs.mjs';
import { digest, executionDigest } from '../src/kernel/data.mjs';
import { lowerPrograms } from '../src/learning/expressions.mjs';

export function synthesizeRealization(curriculum, adapters) {
  const learned = [], receipts = [];
  for (const [name, examples] of Object.entries(curriculum.expressions)) {
    const result = learnExpression(`learned.expression.${name}`, examples);
    for(const circuit of result.circuits)circuit.learning.curriculum = { hash: digest(curriculum), component: ['expressions', name], origin: curriculum.origin };
    learned.push(...result.circuits); receipts.push({ circuit: result.circuit.id, ...result.receipt });
  }
  for (const [name, component, fallback] of [
    ['answer','answerDispatch','message.unsupported'], ['atom','atomDispatch','atom.unknown'],
    ['lexical','lexicalDispatch',''], ['quantity','quantityDispatch',''], ['reason','reasonDispatch',''],
  ]) {
    const result = learnDispatch(`learned.dispatch.${name}`, curriculum[component], { fallback });
    for(const circuit of result.circuits)circuit.learning.curriculum = { hash: digest(curriculum), component: [component], origin: curriculum.origin };
    learned.push(...result.circuits); receipts.push({ circuit: result.circuit.id, ...result.receipt });
  }
  return { circuits: [...learned, ...lowerPrograms(adapters.circuits)], receipt: {
    schema: 'sxlm.realization-learning.v1', curriculumHash: digest(curriculum), adapterProposalHash: digest(adapters),
    inducedCircuits: receipts.length, compiledLearnedFragments:learned.length, authoredAdapters: adapters.circuits.length,
    receipts, qualification: 'Expressions and dispatch policies are induced from migration annotations; semantic adapters remain explicitly authored. This is not a complete learning derivation for the model.',
  } };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const curriculum = decodeSOP(readFileSync(new URL('../training/realization.sop', import.meta.url)));
  const adapters = decodeSOP(readFileSync(new URL('../training/realization-adapters.sop', import.meta.url)));
  const result = synthesizeRealization(curriculum, adapters), path = new URL('../packs/english-bootstrap.sop', import.meta.url), pack = decodeSOP(readFileSync(path));
  if (process.argv.includes('--check')) {
    const installedGraphs=graphsFromModules(pack.sop);
    const installed = result.circuits.map(c => installedGraphs.find(p => p.id === c.id));
    if (executionDigest(installed) !== executionDigest(normalizedGraphs(result.circuits))) throw new Error('Installed realization circuits differ from their reproducible derivation');
    console.log(`Realization replay passed: ${result.receipt.inducedCircuits} induced circuits, ${result.receipt.authoredAdapters} explicitly authored adapters.`);
  } else {
    const ids = new Set(result.circuits.map(c => c.id));
    const roots = new Set(result.circuits.map(c=>c.compilation?.root??c.id));
    installGraphs(pack,result.circuits);
    pack.provenance.realizationLearning = { curriculumHash: result.receipt.curriculumHash, inducedCircuits: result.receipt.inducedCircuits, authoredAdapters: result.receipt.authoredAdapters };
    delete pack.realization;
    pack.sop.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    writeFileSync(path, encodeSOP(pack) + '\n');
    mkdirSync(new URL('../reports/', import.meta.url), { recursive: true });
    writeFileSync(new URL('../reports/realization-learning.sop', import.meta.url), encodeSOP(result.receipt) + '\n');
    console.log(`Installed ${result.receipt.inducedCircuits} induced realization circuits; ${result.receipt.authoredAdapters} adapters remain authored.`);
  }
}
