import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';
import { canonical } from '../src/kernel/data.mjs';
import { replaceLinkages } from './support/linkages.mjs';

export function buildConcepts() {
  const directory = new URL('../sop/concept/', import.meta.url);
  const modules = readdirSync(directory).filter(name => name.endsWith('.sop')).sort().map(name => ({
    id: 'concept.' + name.slice(0, -4), source: readFileSync(new URL(name, directory), 'utf8'),
    provenance: { kind: 'agent-authored-sop-policy', source: 'sop/concept/' + name,
      qualification: 'Reusable category semantics and realization. Authored, not induced.' }
  }));
  const linkage = { id: 'knowledge.concepts', slot: 'concept-fragments', seed: 'theory.empty', reducer: 'theory.concat' };
  return { modules, linkage };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = new URL('../packs/english-bootstrap.sop', import.meta.url);
  const pack = decodeSOP(readFileSync(path)), { modules, linkage } = buildConcepts();
  if (process.argv.includes('--check')) {
    if (modules.some(module => canonical(pack.sop.find(item => item.id === module.id) ?? null) !== canonical(module)) ||
      canonical(pack.linkages.find(item => item.id === linkage.id) ?? null) !== canonical(linkage)) {
      throw new Error('Concept sources or linkage differ from their installed artifacts');
    }
    console.log('Concept policy source replay passed.');
  } else {
    pack.sop = [...pack.sop.filter(module => !module.id.startsWith('concept.')), ...modules]
      .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    pack.linkages = replaceLinkages(pack.linkages, [linkage]);
    writeFileSync(path, encodeSOP(pack) + '\n');
    console.log(`Installed ${modules.length} authored concept policies.`);
  }
}
