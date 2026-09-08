import { assertData, check, copy, executionDigest, Budget } from '../kernel/data.mjs';

const equal = (left, right) => executionDigest(left) === executionDigest(right);

/** Teacher-annotated character spans; delimiters and semantic children come from the parent grammar. */
export function alignConstructionSpans(model, specification) {
  const { slots, examples } = specification;
  check(Array.isArray(slots) && slots.length > 0 && slots.length <= 8, 'Supply 1–8 typed slots');
  check(new Set(slots.map(slot => slot.name)).size === slots.length, 'Duplicate slot name');
  for (const slot of slots) {
    check(typeof slot.name === 'string' && /^[a-z][a-z0-9_-]*$/u.test(slot.name), 'Invalid slot name');
    check(model.grammar.productions.has(slot.category), 'Specify an existing semantic category for each slot');
    check(slot.semantic === undefined || typeof slot.semantic === 'boolean', 'Slot semantic annotation must be boolean');
  }
  check(slots.some(slot => slot.semantic !== false), 'A construction needs at least one semantic slot');
  const rows = examples.map(example => {
    assertData(example);
    check(typeof example.text === 'string' && example.text.length <= 20000, 'Invalid teaching text');
    const budget = new Budget(), tokens = model.grammar.tokenize(example.text, { budget });
    check(tokens.length > 0 && tokens.length <= 512, 'Invalid teaching token count');
    check(example.spans && equal(Object.keys(example.spans).sort(), slots.map(slot => slot.name).sort()),
      'Every example must annotate exactly the declared slots');
    const rhs = [], children = [], values = [];
    let cursor = 0;
    for (const slot of slots) {
      const span = example.spans[slot.name];
      check(span && Number.isInteger(span.start) && Number.isInteger(span.end) && span.end > span.start,
        'Invalid slot span');
      const begin = tokens.findIndex(token => token.start === span.start);
      const end = tokens.findIndex(token => token.end === span.end);
      check(begin >= cursor && end >= begin, 'Slot spans must be ordered, disjoint and token-aligned');
      for (const token of tokens.slice(cursor, begin)) {
        rhs.push({ literal: token.value }); children.push(token.value);
      }
      const surface = example.text.slice(span.start, span.end);
      const parsed = model.grammar.parse(surface, { start: slot.category, budget });
      check(parsed.status === 'parsed', `Slot ${slot.name} is not unambiguous in category ${slot.category}`);
      values.push({ index: rhs.length, value: parsed.alternatives[0] });
      rhs.push(slot.category); children.push(parsed.alternatives[0]); cursor = end + 1;
    }
    for (const token of tokens.slice(cursor)) { rhs.push({ literal: token.value }); children.push(token.value); }
    check(rhs.length <= 16, 'Construction exceeds the grammar production bound');
    return { rhs, children, values };
  });
  check(rows.every(row => equal(row.rhs, rows[0].rhs)), 'Unannotated delimiters differ between examples');
  check(new Set(examples.map(example => example.text)).size >= 2, 'Identical surfaces do not identify an abstraction');
  const aligned = slots.map((slot, index) => ({ ...slot, index: rows[0].values[index].index,
    values: rows.map(row => row.values[index].value) }));
  check(aligned.filter(slot => slot.semantic !== false).every(slot => new Set(slot.values.map(executionDigest)).size > 1),
    'Every declared slot needs demonstrated semantic variation');
  return { rhs: rows[0].rhs, rows: rows.map(row => copy(row.children)), slots: aligned };
}
