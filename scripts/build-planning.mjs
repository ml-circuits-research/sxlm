import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CircuitRuntime } from '../src/kernel/circuit.mjs';
import { installTermPrimitives } from '../src/kernel/terms.mjs';
import { installCollectionPrimitives } from '../src/kernel/collections.mjs';
import { installValuePrimitives } from '../src/kernel/values.mjs';
import { runtimeIdentity } from '../src/runtime-identity.mjs';
import { synthesizeProgram } from '../src/learning/search.mjs';
import { graphsFromModules } from '../src/learning/sop-output.mjs';
import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';
import { check, executionDigest } from '../src/kernel/data.mjs';

export function synthesizePlanning() {
  const directory = new URL('../sop/planning/', import.meta.url);
  const policies = readdirSync(directory).filter(name => name.endsWith('.sop')).sort().map(name => ({
    id: 'planning.' + name.slice(0, -4), source: readFileSync(new URL(name, directory), 'utf8'),
    provenance: { kind: 'agent-authored-sop-policy', source: 'sop/planning/' + name, qualification: 'Planning strategy migration; compilation is not induction.' }
  }));
  const specification = decodeSOP(readFileSync(new URL('../training/set-coverage.sop', import.meta.url)));
  const runtime = installValuePrimitives(installCollectionPrimitives(installTermPrimitives(new CircuitRuntime({ identity: runtimeIdentity.hash }))));
  const result = synthesizeProgram(runtime, specification);
  check(result.status === 'synthesized', 'Coverage method synthesis failed: ' + result.status);
  const modules = [...policies, ...result.modules], evidence = { algorithm: result.receipt.algorithm, scope: 'primitive-library', specification };
  return { modules, policies, learned: result.modules, circuits: graphsFromModules(modules), evidence, receipt: {
    schema: 'sxlm.planning-migration.v1', runtime: runtimeIdentity.hash, authoredPolicies: policies.length,
    method: result.receipt, trainingHash: executionDigest(specification),
    qualification: 'Search and action policy execute in SOP. Set coverage is induced from typed examples and reused in goals/preconditions. Policy bodies remain authored; witness verification does not prove cost optimality.'
  } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = synthesizePlanning(), path = new URL('../packs/english-bootstrap.sop', import.meta.url), pack = decodeSOP(readFileSync(path));
  if (process.argv.includes('--check')) {
    check(result.modules.every(module => executionDigest(pack.sop.find(m => m.id === module.id) ?? null) === executionDigest(module)), 'Planning sources or learned method differ from their derivation');
    check(executionDigest(pack.training?.components?.setCoverage ?? null) === executionDigest(result.evidence), 'Missing planning method derivation');
    check(pack.entrypoints.plan === 'planning.run', 'Planning entrypoint differs from its source');
    const ids = new Set(result.modules.map(m => m.id));
    check(!pack.sop.some(m => m.id.startsWith('planning.') && !ids.has(m.id)), 'Obsolete planning module');
    console.log(`Planning replay passed: ${result.policies.length} authored SOP policies and ${result.learned.length} synthesized reusable method.`);
  } else {
    const ids = new Set(result.modules.map(m => m.id));
    pack.sop = [...pack.sop.filter(m => !m.id.startsWith('planning.') && !ids.has(m.id)), ...result.modules].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    pack.entrypoints.plan = 'planning.run';
    pack.training = { ...pack.training, components: { ...pack.training?.components, setCoverage: result.evidence } };
    pack.provenance.planningMigration = result.receipt;
    writeFileSync(path, encodeSOP(pack));
    writeFileSync(new URL('../reports/planning-migration.sop', import.meta.url), encodeSOP(result.receipt));
    console.log(`Installed ${result.modules.length} SOP modules for planning and reusable set coverage.`);
  }
}
