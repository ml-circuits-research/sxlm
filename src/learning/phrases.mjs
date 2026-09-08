import { assertData, check, digest, executionDigest } from '../kernel/data.mjs';
import { compileGrammarKnowledge } from './grammar.mjs';

/** Offline prefix sharing for explicitly supplied, constant-valued lexical phrases. */
export function compilePhraseKnowledge(entries, { id, origin, tokenize }) {
  check(typeof id === 'string' && /^[a-z0-9][a-z0-9._-]*$/.test(id), 'Invalid phrase namespace');
  check(origin && typeof origin.kind === 'string', 'Phrases require source provenance');
  check(typeof tokenize === 'function', 'Phrases require the parent token policy');
  check(Array.isArray(entries) && entries.length <= 10000, 'Invalid phrase observations');
  const roots = new Map(), observations = [], duplicates = new Set();
  const node = () => ({ children: new Map(), values: [] });
  for (const entry of entries) {
    check(entry && typeof entry.category === 'string' && entry.category.length > 0 &&
      typeof entry.surface === 'string', 'Invalid phrase observation');
    assertData(entry.value);
    const tokens = tokenize(entry.surface);
    check(Array.isArray(tokens) && tokens.length > 0 && tokens.length <= 512 &&
      tokens.every(token => typeof token.text === 'string' && token.text.length > 0), 'Invalid phrase tokens');
    // Preserve original spellings. Lexical SOP applies its normalization exactly
    // once; compiling already-normalized tokens would assume idempotence.
    const symbols = tokens.map(token => token.text);
    const observation = { category: entry.category, symbols, value: entry.value };
    const key = executionDigest(observation);
    if (duplicates.has(key)) continue;
    duplicates.add(key); observations.push(observation);
    if (!roots.has(entry.category)) roots.set(entry.category, node());
    let current = roots.get(entry.category);
    for (const symbol of symbols) {
      if (!current.children.has(symbol)) current.children.set(symbol, node());
      current = current.children.get(symbol);
    }
    current.values.push(entry.value);
  }
  const grammar = { productions: [], lexicon: [] };
  const provenance = { kind: 'compiled-phrase-proposal', origin, knowledgeHash: digest(observations),
    qualification: 'Explicit constant lexical meanings compiled with shared prefixes, not induced language.' };
  const action = (suffix, index) => ({ id: `${id}.${suffix}`, provenance,
    source: `@input children array\n@input scope string\n@value kernel.value.get value $children key ${index} fallback null\n@output result $value\n` });
  const sop = [action('first', 0), action('second', 1)];
  let serial = 0;
  const production = (lhs, rhs, action) => {
    grammar.productions.push({ id: `${id}.production${grammar.productions.length}`, lhs, rhs, action });
    check(grammar.productions.length <= 2000, 'Phrase grammar exceeds the production bound');
  };
  function emit(current) {
    const category = `${id}.prefix${serial++}`, lexical = `${category}.leaf`;
    let leaves = false;
    for (const [symbol, child] of current.children) {
      for (const value of child.values) {
        grammar.lexicon.push({ surface: symbol, category: lexical, value }); leaves = true;
      }
      if (child.children.size) production(category, [{ literal: symbol }, emit(child)], `${id}.second`);
    }
    if (leaves) production(category, [{ lex: lexical }], `${id}.first`);
    return category;
  }
  for (const [category, root] of roots) production(category, [emit(root)], `${id}.first`);
  const compiled = compileGrammarKnowledge(grammar, { id: `${id}.grammar`, origin: provenance });
  return { ...compiled, sop: [...sop, ...compiled.sop], grammar,
    receipt: { schema: 'sxlm.phrase-compilation.v1', knowledgeHash: provenance.knowledgeHash,
      observations: observations.length, productions: grammar.productions.length,
      lexicalEntries: grammar.lexicon.length, categories: [...roots.keys()],
      qualification: provenance.qualification } };
}
