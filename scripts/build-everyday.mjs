import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SymbolicModel } from '../src/model.mjs';
import { readPack } from '../src/learning/packs.mjs';
import { compileGrammarKnowledge } from '../src/learning/grammar.mjs';
import { compileConceptKnowledge } from '../src/learning/concepts.mjs';
import { compileConceptProperties } from '../src/learning/properties.mjs';
import { compilePhraseKnowledge } from '../src/learning/phrases.mjs';
import { induceConstruction } from '../src/learning/induce.mjs';
import { executionDigest, check } from '../src/kernel/data.mjs';
import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';

export function everydayBase() {
  const base = new SymbolicModel();
  return new SymbolicModel({ packs: [...base.packs,
    readPack(new URL('../packs/english-constructions.sop', import.meta.url)),
    readPack(new URL('../packs/elementary-knowledge.sop', import.meta.url))] });
}

/** Compile the supplied knowledge and replay each annotated construction against its exact teaching parent. */
export function buildEveryday({ base = everydayBase(), input, language } = {}) {
  input ??= decodeSOP(readFileSync(new URL('../training/everyday-knowledge.sop', import.meta.url)));
  language ??= decodeSOP(readFileSync(new URL('../training/everyday-language.sop', import.meta.url)));
  const origin = { kind: 'authored-source-supervision', source: 'training/everyday-knowledge.sop',
    knowledgeHash: executionDigest(input), qualification: 'Selected source-backed knowledge, not an exhaustive ontology.' };
  const tokenize = text => base.grammar.tokenize(text);
  const grammar = compileGrammarKnowledge(language.grammar, { id: 'memory.everyday.grammar', origin });
  const phrases = compilePhraseKnowledge(language.phrases, { id: 'memory.everyday.phrases', origin, tokenize });
  const concepts = compileConceptKnowledge(input, { id: 'memory.everyday.concepts', origin, tokenize });
  const properties = compileConceptProperties(input, { id: 'memory.everyday.properties', origin });
  const modules = readdirSync(new URL('../sop/everyday/', import.meta.url)).filter(name => name.endsWith('.sop')).sort()
    .map(name => ({ id: 'everyday.' + name.slice(0, -4), source: readFileSync(new URL('../sop/everyday/' + name, import.meta.url), 'utf8'),
      provenance: { kind: 'authored-reference-semantics', source: 'sop/everyday/' + name } }));
  const providers = {};
  for (const compiled of [grammar, phrases, concepts, properties]) for (const [slot, ids] of Object.entries(compiled.providers)) {
    providers[slot] = [...(providers[slot] ?? []), ...ids];
  }
  const knowledge = { schema: 'sxlm.pack.v1', id: 'everyday-teaching-parent', version: '1.0.0', provenance: origin,
    sop: [...modules, ...grammar.sop, ...phrases.sop, ...concepts.sop, ...properties.sop], providers };
  let parent = new SymbolicModel({ packs: [...base.packs, knowledge] });
  const learned = [], derivations = [];
  for (const specification of language.constructions ?? []) {
    const candidate = induceConstruction(parent, specification);
    learned.push(...candidate.sop); derivations.push(candidate.provenance);
    for (const [slot, ids] of Object.entries(candidate.providers)) providers[slot] = [...(providers[slot] ?? []), ...ids];
    parent = new SymbolicModel({ packs: [...parent.packs, candidate] });
  }
  return { schema: 'sxlm.pack.v1', id: 'everyday-knowledge', version: '1.0.0',
    provenance: { kind: 'source-properties-and-induced-language', parentModel: base.resources.hash,
      qualification: 'Knowledge and reference policies are supplied; construction procedures are induced from annotated phrases.' },
    dependencies: base.resources.manifests.map(({ id, hash }) => ({ id, hash })),
    sop: [...knowledge.sop, ...learned], providers,
    training: { schema: 'sxlm.training.v1', algorithm: 'source-property-construction-family-v1', input, language,
      derivations, baseModel: base.resources.hash } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pack = buildEveryday(), path = new URL('../packs/everyday-knowledge.sop', import.meta.url);
  if (process.argv.includes('--check')) {
    check(executionDigest(readPack(path)) === executionDigest(pack), 'Everyday teaching reproduction differs');
    console.log('Everyday source knowledge and induced language reproduced.');
  } else {
    writeFileSync(path, encodeSOP(pack) + '\n');
    console.log(`Built ${pack.sop.length} everyday modules from ${pack.training.language.constructions.length} constructions.`);
  }
}
