import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SymbolicModel } from '../src/model.mjs';
import { compileGrammarKnowledge } from '../src/learning/grammar.mjs';
import { induceConstruction } from '../src/learning/induce.mjs';
import { executionDigest, check } from '../src/kernel/data.mjs';
import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';

/** Reproduce supervised construction learning; the lexical meanings remain explicitly authored. */
export function buildConstructions(base = new SymbolicModel(), teaching) {
  const vocabulary = teaching?.vocabulary ?? decodeSOP(readFileSync(new URL('../training/passive-vocabulary.sop', import.meta.url)));
  const specification = teaching?.specification ?? decodeSOP(readFileSync(new URL('../training/passive-construction.sop', import.meta.url)));
  const compiled = compileGrammarKnowledge(vocabulary.grammar, { id: 'memory.passive-vocabulary.grammar',
    origin: { kind: 'authored-lexical-supervision', source: 'training/passive-vocabulary.sop' } });
  const lexicalPack = { schema: 'sxlm.pack.v1', id: 'passive-vocabulary', version: '1.0.0',
    provenance: { kind: 'authored-lexical-supervision' }, sop: [...vocabulary.sop, ...compiled.sop],
    providers: compiled.providers };
  const parent = new SymbolicModel({ packs: [...base.packs, lexicalPack] });
  const learned = induceConstruction(parent, specification);
  return { schema: 'sxlm.pack.v1', id: 'english-constructions', version: '1.0.0',
    provenance: { kind: 'authored-vocabulary-and-induced-construction', parentModel: base.resources.hash,
      qualification: 'Lexical categories and annotated phrase meanings are supervision. Span alignment and semantic composition are induced; no unlabelled grammar discovery is claimed.' },
    dependencies: base.resources.manifests.map(({ id, hash }) => ({ id, hash })),
    sop: [...lexicalPack.sop, ...learned.sop],
    providers: { 'grammar-fragments': [...lexicalPack.providers['grammar-fragments'], ...learned.providers['grammar-fragments']] },
    training: { schema: 'sxlm.training.v1', algorithm: 'typed-span-composition-v1', specification,
      vocabulary, baseModel: base.resources.hash, teacherParent: parent.resources.hash,
      derivation: learned.provenance, grammarProposal: learned.training.grammarProposal } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pack = buildConstructions(), path = new URL('../packs/english-constructions.sop', import.meta.url);
  if (process.argv.includes('--check')) {
    check(executionDigest(decodeSOP(readFileSync(path))) === executionDigest(pack), 'Construction reproduction differs');
    console.log('Typed span construction and lexical supervision reproduced.');
  } else {
    writeFileSync(path, encodeSOP(pack) + '\n');
    console.log(`Built ${pack.sop.length} construction/vocabulary modules.`);
  }
}
