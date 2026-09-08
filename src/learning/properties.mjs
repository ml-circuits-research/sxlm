import { check, digest } from '../kernel/data.mjs';
import { validateAtom } from '../semantics/logic.mjs';
import { compileKnowledge, compileTheoryKnowledge } from './knowledge.mjs';

/** Source-supervised concept properties with explicit inheritance and qualification. */
export function compileConceptProperties(specification, { id, origin }) {
  check(typeof id === 'string' && /^[a-z0-9][a-z0-9._-]*$/u.test(id), 'Invalid property module identity');
  const { properties } = specification;
  check(Array.isArray(properties) && properties.length <= 1000, 'Supply at most 1000 concept properties');
  const atom = (predicate, terms, negative = false) => ({ predicate, terms, negative, context: 'world' });
  const facts = [], rules = [], bridges = new Map();
  let categoryProjection = null;
  for (const property of properties) {
    const { concept, relation, values, mode, source, evidence } = property;
    check(typeof concept === 'string' && concept.length > 0 && !concept.startsWith('?'), 'Invalid property concept');
    check(typeof relation === 'string' && relation.length > 0 && relation.length < 100 && !relation.startsWith('?'), 'Invalid property relation');
    check(Array.isArray(values) && values.length <= 5 && values.every(value =>
      typeof value === 'string' && !value.startsWith('?')), 'Property arguments must be ground strings');
    check(['definition', 'all-instances', 'typical'].includes(mode), 'Declare the property qualification');
    check(typeof property.negative === 'boolean' && (property.context ?? 'world') === 'world',
      'Properties require explicit polarity and world-scoped supervision');
    check(source && typeof source.text === 'string' && digest(source.text) === source.id, 'Invalid property source');
    check(evidence?.source === source.id && Number.isInteger(evidence.start) && Number.isInteger(evidence.end) &&
      evidence.start >= 0 && evidence.end > evidence.start && evidence.end <= source.text.length, 'Invalid property evidence');
    const predicate = mode === 'typical' ? 'typical_property' : 'property';
    const declaration = atom(predicate, ['concept', concept, relation, ...values], property.negative);
    validateAtom(declaration, { ground: true }); facts.push({ atom: declaration, source, evidence });
    const teaching = { source, evidence, qualification: mode };
    if (mode === 'all-instances') {
      categoryProjection ??= { body: [atom('declared_category', ['?subtype']),
        atom('kind', ['?subtype', '?supertype'])], head: atom('category_kind', ['?subtype', '?supertype']),
      teaching: { ...teaching, interpretation: 'Only an explicitly declared category can be the subtype of a category inclusion.' } };
      rules.push({ body: [atom(concept, ['?instance'])],
        head: atom(relation, ['?instance', ...values], property.negative), teaching });
      rules.push({ body: [atom('category_kind', ['?subtype', concept])],
        head: atom('property', ['concept', '?subtype', relation, ...values], property.negative), teaching });
    }
    // Ordinary observations remain usable by the same property question, without turning a type into an instance.
    const signature = digest([relation, values.length, property.negative]);
    if (!bridges.has(signature)) {
      const terms = values.map((_, index) => '?argument' + index);
      bridges.set(signature, { body: [atom(relation, ['?instance', ...terms], property.negative)],
        head: atom('property', ['instance', '?instance', relation, ...terms], property.negative),
        teaching: { ...teaching, interpretation: 'Reification of a supplied relation preserves instance identity and sign.' } });
    }
  }
  const memory = compileKnowledge(facts, { id: id + '.facts', origin });
  const theory = compileTheoryKnowledge([...(categoryProjection ? [categoryProjection] : []), ...rules,
    ...bridges.values()], { id: id + '.theory', origin });
  return { sop: [...memory.sop, ...theory.sop], providers: { ...theory.providers, 'fact-fragments': [id + '.facts'] },
    receipt: { schema: 'sxlm.property-compilation.v1', specificationHash: digest(specification),
      properties: properties.length, rules: rules.length + bridges.size + Number(Boolean(categoryProjection)),
      qualification: 'Source-supervised properties. Typical properties never become unqualified instance conclusions. Definitions do not create instances. Functional classifications describe intended roles, not demonstrated ability or actual use.' } };
}
