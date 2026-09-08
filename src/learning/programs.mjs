import { canonical, check, digest } from '../kernel/data.mjs';
import { lowerProgram, expressionRuntime } from './expressions.mjs';

const get = (...path) => ({ $get: path });
function program(id, expression, evidence) {
  return lowerProgram({
    schema: 'sxlm.circuit.v1', id, inputs: { value: 'object' },
    nodes: [{ id: 'evaluate', op: 'data.template', args: { template: expression, environment: { ref: '$value' }, scope: '' } }],
    output: { ref: 'evaluate' }, learning: evidence,
  });
}
function receipt(kind, examples, extra = {}) {
  return { schema: 'sxlm.derivation.v1', kind, algorithm: `${kind}-v1`, trainingHash: digest(examples), trainingCount: examples.length, ...extra };
}

/** Infer an expression by aligning changing bindings with annotated output strings. */
export function learnExpression(id, examples) {
  check(Array.isArray(examples) && examples.length >= 2 && examples.length <= 100, 'Expression induction requires 2–100 examples');
  for (const example of examples) {
    check(example.values && typeof example.values === 'object' && typeof example.text === 'string' && example.text.length <= 2000, 'Invalid expression example');
    check(Object.values(example.values).every(v => ['string','number','boolean'].includes(typeof v)), 'Expression bindings must be scalar');
  }
  const keys = Object.keys(examples[0].values).filter(key => examples.every(e => Object.hasOwn(e.values, key)) && new Set(examples.map(e => String(e.values[key]))).size > 1);
  const first = examples[0], valid = new Map(); let explored = 0;
  function append(segments, value) {
    const next = [...segments];
    if (typeof value === 'string' && typeof next.at(-1) === 'string') next[next.length - 1] += value;
    else next.push(value);
    return next;
  }
  function search(offset, segments) {
    check(++explored <= 200000, 'Expression hypothesis budget exceeded');
    if (offset === first.text.length) {
      const expression = { $join: { values: segments, separator: '' } };
      const render=example=>segments.map(segment=>typeof segment==='string'?segment:String(example.values[segment.$format.values.x.$get[1]])).join('');
      if (examples.every(e => render(e) === e.text)) valid.set(canonical(expression), expression);
      return;
    }
    for (const key of keys) {
      const value = String(first.values[key]);
      if (value && first.text.startsWith(value, offset)) search(offset + value.length, append(segments, { $format: { pattern: '{x}', values: { x: get('values', key) } } }));
    }
    search(offset + 1, append(segments, first.text[offset]));
  }
  search(0, []);
  check(valid.size === 1, valid.size ? 'Expression alignment is ambiguous; add disambiguating examples' : 'No consistent expression was induced');
  const expression = [...valid.values()][0], evidence = receipt('supervised-expression-induction', examples, { explored, fit: examples.length, uniqueTrainingExamples: new Set(examples.map(canonical)).size, mode: keys.length ? 'slot-induction' : 'constant-output-memory' });
  const circuits=program(id,expression,evidence);
  return { circuit: circuits.at(-1), circuits, receipt: evidence };
}

function flatten(value, prefix = [], result = new Map()) {
  if (value === null || typeof value !== 'object') result.set(canonical(prefix), { path: prefix, value });
  else for (const [key, item] of Object.entries(value)) flatten(item, [...prefix, key], result);
  return result;
}
const entropy = labels => {
  const counts = new Map(); for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts.values()].reduce((h, count) => { const p = count / labels.length; return h - p * Math.log2(p); }, 0);
};

/** Categorical decision-tree induction. Feature names and class labels are supplied data. */
export function learnDispatch(id, examples, { fallback } = {}) {
  check(Array.isArray(examples) && examples.length >= 2 && examples.length <= 2000 && typeof fallback === 'string', 'Dispatch induction requires examples and an explicit fallback');
  examples.forEach(e => check(e.input && typeof e.input === 'object' && typeof e.output === 'string', 'Invalid dispatch example'));
  const rows = examples.map(e => ({ ...e, features: flatten(e.input) })), paths = new Map();
  rows.forEach(row => row.features.forEach((entry, key) => paths.set(key, entry.path)));
  const features = [...paths.keys()].filter(key => rows.every(row => row.features.has(key))).sort();
  function induce(subset, remaining, depth = 0) {
    check(depth < 32, 'Decision-tree depth exceeded');
    const labels = new Set(subset.map(row => row.output)); if (labels.size === 1) return [...labels][0];
    let best = null;
    for (const key of remaining) {
      const groups = new Map();
      for (const row of subset) { const value = canonical(row.features.get(key).value); if (!groups.has(value)) groups.set(value, []); groups.get(value).push(row); }
      if (groups.size < 2) continue;
      const uncertainty = [...groups.values()].reduce((sum, group) => sum + group.length / subset.length * entropy(group.map(r => r.output)), 0);
      const score = uncertainty + groups.size * 1e-6;
      if (!best || score < best.score) best = { key, groups, score };
    }
    check(best, 'Examples assign different outputs to indistinguishable inputs');
    let tree = fallback;
    for (const [encoded, group] of [...best.groups.entries()].sort().reverse()) {
      tree = { $if: { test: { $eq: [{ $path: { value: get('input'), path: paths.get(best.key), fallback: { absent: true } } }, { $literal: group[0].features.get(best.key).value }] }, then: induce(group, remaining.filter(k => k !== best.key), depth + 1), else: tree } };
    }
    return tree;
  }
  const expression = induce(rows, features), evidence = receipt('supervised-dispatch-induction', examples, { features: [...paths.values()], fallback, fit: examples.length });
  const circuits=program(id,expression,evidence),runtime=expressionRuntime();
  for(const circuit of circuits)runtime.compile(circuit);
  check(examples.every(e => runtime.execute(id,{value:{input:e.input}}) === e.output), 'Induced dispatch failed training replay');
  return { circuit: circuits.at(-1), circuits, receipt: evidence };
}
