import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';
import { check, digest, executionDigest } from '../src/kernel/data.mjs';
import { validateAtom } from '../src/semantics/logic.mjs';
import { compileKnowledge, compileTheoryKnowledge } from '../src/learning/knowledge.mjs';
import { compileGrammarKnowledge } from '../src/learning/grammar.mjs';
import { bootstrapURL, readPack, validatePack } from '../src/learning/packs.mjs';

const trainingURL = new URL('../training/elementary-knowledge.sop', import.meta.url);
const packURL = new URL('../packs/elementary-knowledge.sop', import.meta.url);

/** Preserve source-supervised claims as SOP. This compiler does not discover knowledge. */
export function buildElementary({ input = decodeSOP(readFileSync(trainingURL)), parent = readPack(bootstrapURL) } = {}) {
  check(input.schema === 'sxlm.elementary-teaching.v1', 'Unsupported elementary teaching schema');
  const sourceIndex = new Map(input.sources.map(source => [source.id, source]));
  check(sourceIndex.size === input.sources.length, 'Duplicate teaching source');
  const declarations = [...input.facts, ...input.rules];
  check(new Set(declarations.map(item => item.id)).size === declarations.length, 'Duplicate teaching declaration');
  const provenance = { ...input.origin, source: 'training/elementary-knowledge.sop', sourceHash: digest(input) };
  const teaching = item => {
    check(typeof item.statement === 'string' && item.statement.length > 0, 'Missing claim statement');
    check(Array.isArray(item.citations) && item.citations.length > 0, 'Missing source citation');
    const citations = item.citations.map(id => {
      check(sourceIndex.has(id), 'Unresolved teaching citation: ' + id);
      return sourceIndex.get(id);
    });
    return { id: item.id, statement: item.statement, citations };
  };
  const facts = input.facts.map(item => {
    validateAtom(item.atom, { ground: true });
    const declaration = { atom: item.atom, teaching: teaching(item) };
    const text = encodeSOP(declaration, { canonical: true });
    const source = { id: digest(text), text, pack: input.id };
    return { atom: item.atom, evidence: { source: source.id, start: 0, end: text.length }, source };
  });
  const memory = compileKnowledge(facts, { id: 'memory.elementary-facts', origin: provenance });
  const theory = compileTheoryKnowledge(input.rules.map(item => ({ ...item.rule, teaching: teaching(item) })), {
    id: 'memory.elementary-theory', origin: provenance, sourceName: input.id
  });
  const grammar = compileGrammarKnowledge(input.grammar, { id: 'memory.elementary-grammar', origin: provenance });
  const concepts = compileKnowledge(input.concepts ?? [], { id: 'memory.elementary-concepts', origin: provenance });
  const policies = input.policies.map(module => ({ ...module, provenance: {
    kind: 'agent-authored-sop-policy', origin: provenance,
    qualification: 'Authored compositional language and initialization policies, not induced programs.'
  } }));
  const pack = {
    schema: 'sxlm.pack.v1', id: input.id, version: input.version, provenance,
    dependencies: [{ id: parent.id, hash: validatePack(parent).hash }],
    sop: [...memory.sop, ...theory.sop, ...grammar.sop, ...concepts.sop, ...policies].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    providers: { ...theory.providers, ...grammar.providers, 'fact-fragments': ['memory.elementary-facts'],
      'concept-fragments': ['memory.elementary-concepts'] },
    training: { schema: 'sxlm.training.v1', algorithm: 'source-knowledge-compilation-v1', specification: input }
  };
  validatePack(pack);
  return { pack, receipt: {
    schema: 'sxlm.elementary-compilation.v1', sourceHash: digest(input), packHash: validatePack(pack).hash,
    facts: facts.length, rules: input.rules.length, lexicalForms: input.grammar.lexicon.length,
    productions: input.grammar.productions.length, policies: policies.length, modules: pack.sop.length,
    sources: input.sources.length, domains: input.domains,
    qualification: 'Authored source supervision compiled to SOP. No induction or unrestricted child-level conversation claimed.'
  } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { pack, receipt } = buildElementary();
  if (process.argv.includes('--check')) {
    check(executionDigest(pack) === executionDigest(readPack(packURL)), 'Elementary pack differs from its teaching source');
    console.log('Elementary compilation replay passed.');
  } else {
    writeFileSync(packURL, encodeSOP(pack) + '\n');
    console.log(`Built optional elementary pack: ${receipt.facts} facts, ${receipt.rules} rules, ${receipt.modules} modules.`);
  }
}
