import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileKnowledge, compileTheoryKnowledge } from '../src/learning/knowledge.mjs';
import { compileSOP } from '../src/kernel/sop.mjs';
import { canonical, digest } from '../src/kernel/data.mjs';
import { replaceLinkages } from './support/linkages.mjs';

export function synthesizeKnowledge() {
  const input = decodeSOP(readFileSync(new URL('../training/knowledge-bootstrap.sop', import.meta.url)));
  const modules = [], directory = new URL('../sop/theory/', import.meta.url);
  for (const name of readdirSync(directory).filter(n => n.endsWith('.sop')).sort()) modules.push({
    id: 'theory.' + name.slice(0, -4), source: readFileSync(new URL(name, directory), 'utf8'),
    provenance: { kind: 'agent-authored-sop-policy', source: 'sop/theory/' + name, qualification: 'Authored theory installation policy, not induced competence.' }
  });
  const theory = compileTheoryKnowledge(input.theory, { id: 'memory.bootstrap-theory', origin: input.origin, sourceName: input.pack });
  const text = compileKnowledge(input.text, { id: 'language.text-config', origin: input.origin });
  modules.push(...theory.sop, ...text.sop);
  const linkage = { id: 'knowledge.theory', slot: 'theory-fragments', seed: 'theory.empty', reducer: 'theory.concat' };
  const factLinkage = { id: 'knowledge.facts', slot: 'fact-fragments', seed: 'theory.empty', reducer: 'theory.concat' };
  return { modules, theory, text, linkage, factLinkage, circuits: modules.map(m => compileSOP(m.id, m.source, { provenance: m.provenance })), receipt: {
    schema: 'sxlm.knowledge-migration.v1', sourceHash: digest(input), modules: modules.length,
    authoredPolicies: modules.length - theory.sop.length - text.sop.length,
    theoryModules: theory.sop.length, textModules: text.sop.length,
    qualification: 'Supplied rules/configuration are compiled, not induced. Theory installation now executes through SOP.'
  } };
}

export function installKnowledge(pack, result = synthesizeKnowledge()) {
  const ids = new Set(result.modules.map(m => m.id));
  pack.sop = [...(pack.sop ?? []).filter(m => !ids.has(m.id)), ...result.modules];
  pack.providers = { ...(pack.providers ?? {}), ...result.theory.providers };
  pack.linkages = replaceLinkages(pack.linkages ?? [], [result.linkage, result.factLinkage]);
  pack.entrypoints.initial = 'theory.bootstrap';
  pack.entrypoints.theory = result.linkage.id;
  pack.entrypoints.text = 'language.text-config';

  delete pack.theory; delete pack.text;
  pack.provenance.knowledgeMigration = result.receipt;
  pack.sop.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  return pack;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = synthesizeKnowledge(), file = new URL('../packs/english-bootstrap.sop', import.meta.url), pack = decodeSOP(readFileSync(file));
  if (process.argv.includes('--check')) {
    if (canonical(installKnowledge(structuredClone(pack), result)) !== canonical(pack)) throw Error('Installed knowledge or wiring differs from its sources');
    console.log(`Knowledge replay passed: ${result.receipt.authoredPolicies} authored policies, ${result.receipt.theoryModules} theory constructors, ${result.receipt.textModules} text constructors. No induction claimed.`);
  } else {
    writeFileSync(file, encodeSOP(installKnowledge(pack, result)) + '\n');
    writeFileSync(new URL('../reports/knowledge-migration.sop', import.meta.url), encodeSOP(result.receipt) + '\n');
    console.log('Installed knowledge circuits; removed raw theory/text and native initial-theory injection.');
  }
}
