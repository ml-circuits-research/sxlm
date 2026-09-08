import { check, digest } from '../kernel/data.mjs';
import { compileKnowledge, compileTheoryKnowledge } from './knowledge.mjs';
import { compilePhraseKnowledge } from './phrases.mjs';

/** Compile explicitly taught categories once for classification, instances and language. */
export function compileConceptKnowledge(specification, { id, origin, tokenize }) {
  const { concepts, inclusions } = specification;
  check(Array.isArray(concepts) && concepts.length > 0 && concepts.length <= 500, 'Supply 1–500 concepts');
  const names = new Set(concepts.map(item => item.id));
  check(names.size === concepts.length, 'Duplicate concept identity');
  for (const item of concepts) {
    check(typeof item.id === 'string' && item.id.length > 0 && !item.id.startsWith('?'), 'Invalid concept identity');
    check(['singular', 'plural'].every(key => typeof item[key] === 'string' && item[key].trim().length > 0),
      'Concepts require explicit singular and plural forms');
  }
  check(Array.isArray(inclusions), 'Supply explicit class inclusions or exclusions');
  const atom = (predicate, terms, negative = false) => ({ predicate, terms, negative, context: 'world' });
  const facts = [], rules = [];
  for (const inclusion of inclusions) {
    const { subtype, supertype, source, evidence } = inclusion;
    check(names.has(subtype) && names.has(supertype), 'An inclusion names an undeclared concept');
    check(typeof inclusion.negative === 'boolean', 'An inclusion requires explicit polarity');
    check((inclusion.context ?? 'world') === 'world', 'Attributed concepts require an explicit contextual compiler');
    check(source && typeof source.text === 'string' && digest(source.text) === source.id,
      'Concept knowledge requires an intact source');
    check(evidence?.source === source.id && Number.isInteger(evidence.start) && Number.isInteger(evidence.end) &&
      evidence.start >= 0 && evidence.end > evidence.start && evidence.end <= source.text.length,
    'Invalid concept evidence span');
    facts.push({ atom: atom('kind', [subtype, supertype], inclusion.negative), source, evidence });
    rules.push({ body: [atom(subtype, ['?x'])], head: atom(supertype, ['?x'], inclusion.negative),
      teaching: { source, evidence, interpretation: 'Explicit class inclusion or disjointness, not a typical property.' } });
  }
  for (const name of names) {
    const declaration = concepts.find(item => item.id === name);
    const support = declaration.source ? declaration : inclusions.find(item =>
      item.subtype === name || item.supertype === name);
    check(support?.source && support.evidence, 'A concept requires source attribution');
    check(typeof support.source.text === 'string' && digest(support.source.text) === support.source.id &&
      support.evidence.source === support.source.id && Number.isSafeInteger(support.evidence.start) &&
      Number.isSafeInteger(support.evidence.end) && support.evidence.start >= 0 &&
      support.evidence.end > support.evidence.start && support.evidence.end <= support.source.text.length,
    'Invalid concept declaration source span');
    facts.push({ atom: atom('declared_category', [name]), source: support.source, evidence: support.evidence });
    rules.push({ body: [atom(name, ['?x'])], head: atom('kind', ['?x', name]),
      teaching: { source: support.source, evidence: support.evidence,
        interpretation: 'An instance can be described by its declared category.', concept: name } });
  }
  const registry = compileKnowledge(concepts, { id: id + '.concepts', origin });
  const memory = compileKnowledge(facts, { id: id + '.facts', origin });
  const theory = compileTheoryKnowledge(rules, { id: id + '.theory', origin });
  const grammar = compilePhraseKnowledge(concepts.flatMap(item => [
    { category: 'N', surface: item.singular, value: item.id },
    { category: 'N', surface: item.plural, value: item.id },
    { category: 'ConceptPlural', surface: item.plural, value: item.id }
  ]), { id: id + '.grammar', origin, tokenize });
  return { sop: [...registry.sop, ...memory.sop, ...theory.sop, ...grammar.sop],
    providers: { ...theory.providers, ...grammar.providers,
      'concept-fragments': [id + '.concepts'], 'fact-fragments': [id + '.facts'] },
    receipt: { schema: 'sxlm.concept-compilation.v1', specificationHash: digest(specification),
      concepts: concepts.length, inclusions: inclusions.length,
      qualification: 'Explicit source supervision compiled into reusable concept, instance and lexical knowledge. No autonomous concept or grammar induction.' }
  };
}
