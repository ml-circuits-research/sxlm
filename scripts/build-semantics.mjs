import { modulesFromGraphs, graphsFromModules, normalizedGraphs, installGraphs } from '../src/learning/sop-output.mjs';
import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { semanticProposals } from '../training/semantics-candidates.mjs';
import { learnDispatch } from '../src/learning/programs.mjs';
import { executionDigest, digest } from '../src/kernel/data.mjs';
import { lowerPrograms } from '../src/learning/expressions.mjs';

export function buildSemantics(curriculum) {
  const learned = Object.entries(curriculum.components).flatMap(([name, component]) => {
    const { circuits } = learnDispatch('learned.semantic.' + name, component.examples, { fallback: component.fallback });
    for(const circuit of circuits)circuit.learning.curriculum = { hash: digest(curriculum), component: name, origin: curriculum.origin };
    return circuits;
  });
  return { circuits: [...learned, ...lowerPrograms(semanticProposals())], receipt: {
    schema: 'sxlm.semantics-migration.v1', curriculumHash: digest(curriculum),
    proposalHash: digest(readFileSync(new URL('../training/semantics-candidates.mjs', import.meta.url), 'utf8')),
    inducedDispatchCircuits: Object.keys(curriculum.components).length, compiledLearnedFragments:learned.length, authoredPolicyCircuits: semanticProposals().length,
    qualification: 'Dispatch is induced from annotated cases. The policy bodies are agent-authored executable proposals, not learned solely because they compile or reproduce the historical interpreter.'
  } };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const curriculum = decodeSOP(readFileSync(new URL('../training/semantics-dispatch.sop', import.meta.url)));
  const result = buildSemantics(curriculum), path = new URL('../packs/english-bootstrap.sop', import.meta.url), pack = decodeSOP(readFileSync(path));
  if (process.argv.includes('--check')) {
    const installedGraphs=graphsFromModules(pack.sop);
    if (result.circuits.some(c => { const old = installedGraphs.find(p => p.id === c.id); return !old || executionDigest(old) !== executionDigest(normalizedGraphs([c])[0]); })) throw new Error('Installed semantic circuits differ from their sources');
    console.log(`Semantic replay: ${result.receipt.inducedDispatchCircuits} induced dispatch circuits and ${result.receipt.authoredPolicyCircuits} authored policies.`);
  } else {
    const ids = new Set(result.circuits.map(c => c.id));
    const roots = new Set(result.circuits.map(c=>c.compilation?.root??c.id));
    installGraphs(pack,result.circuits);
    pack.provenance.semanticMigration = result.receipt;
    pack.sop.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    writeFileSync(path, encodeSOP(pack)+'\n');
    writeFileSync(new URL('../reports/semantics-migration.sop', import.meta.url), encodeSOP(result.receipt)+'\n');
    console.log(`Installed ${result.circuits.length} semantic circuits. Policy provenance remains explicit.`);
  }
}
