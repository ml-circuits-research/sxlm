import { encodeSOP, decodeSOP } from '../../src/kernel/sop-data.mjs';
// Historical evaluator: test oracle only, never installed in the model.
import { check, copy, digest, canonical, assertData } from '../../src/kernel/data.mjs';
import { calculate, rational, format } from '../../src/kernel/rational.mjs';

/** Generic inert term operations. There are no natural-language rules in this module. */
export function getPath(value, path) {
  check(Array.isArray(path) && path.length < 64, 'Invalid data path');
  for (const key of path) {
    check(!['__proto__', 'prototype', 'constructor'].includes(String(key)), 'Unsafe data path');
    check(value !== null && typeof value === 'object' && Object.hasOwn(value, key), `Missing data path: ${path.join('.')}`);
    value = value[key];
  }
  return value;
}
export function substitute(value, bindings) {
  if (typeof value === 'string' && Object.hasOwn(bindings, value)) return copy(bindings[value]);
  if (Array.isArray(value)) return value.map(v => substitute(v, bindings));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v, bindings)]));
  return value;
}
function pathOr(value, path, fallback) {
  check(Array.isArray(path) && path.length < 64, 'Invalid data path');
  for (const key of path) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) return fallback();
    check(!['__proto__', 'prototype', 'constructor'].includes(String(key)), 'Unsafe data path');
    value = value[key];
  }
  return copy(value);
}
/** An inert, bounded template algebra: paths, concatenation, exact substitution, fresh symbols, records. */
export function instantiate(template, environment, { budget, scope = '' } = {}, depth = 0) {
  check(depth < 64, 'Template nesting limit'); budget?.tick();
  const evaluate = t => instantiate(t, environment, { budget, scope }, depth + 1);
  if (Array.isArray(template)) return template.map(evaluate);
  if (!template || typeof template !== 'object') return template;
  if (Object.keys(template).length === 1) {
    if (Object.hasOwn(template, '$type')) { const value = evaluate(template.$type); return value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value; }
    if (Object.hasOwn(template, '$leaves')) {
      const result = [];
      const visit = value => { budget?.tick(); if (value && typeof value === 'object') Object.values(value).forEach(visit); else result.push(value); };
      visit(evaluate(template.$leaves)); return result;
    }
    if (Object.hasOwn(template, '$let')) {
      const { bindings, body } = template.$let, local = { ...environment };
      check(bindings && typeof bindings === 'object' && !Array.isArray(bindings), 'Let requires named bindings');
      for (const [key, expression] of Object.entries(bindings)) {
        check(!['__proto__','constructor','prototype'].includes(key), 'Unsafe binding');
        local[key] = instantiate(expression, local, { budget, scope }, depth + 1);
      }
      return instantiate(body, local, { budget, scope }, depth + 1);
    }
    if (Object.hasOwn(template, '$assert')) {
      const { test, message, value } = template.$assert, valid = evaluate(test);
      check(typeof valid === 'boolean', 'Assertion requires a boolean');
      check(valid, evaluate(message)); return evaluate(value);
    }
    if (Object.hasOwn(template, '$compare')) {
      const [a, b] = template.$compare.map(evaluate);
      check(typeof a === typeof b && ['string','number'].includes(typeof a), 'Comparison requires like scalar values');
      return a < b ? -1 : a > b ? 1 : 0;
    }
    if (Object.hasOwn(template, '$number')) {
      const { left, operation, right } = template.$number, a = evaluate(left), b = evaluate(right), op = evaluate(operation);
      check(typeof a === 'number' && typeof b === 'number', 'Numeric operation requires numbers');
      const result = op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : op === '/' ? a / b : NaN;
      check(Number.isFinite(result), 'Invalid numeric operation'); return result;
    }
    if (Object.hasOwn(template, '$rational')) {
      const { left, operation = 'normalize', right = '0' } = template.$rational, a = evaluate(left), b = evaluate(right), op = evaluate(operation);
      if (op === 'normalize') return format(rational(a));
      if (op === 'compare') { const [n, d] = rational(a), [m, e] = rational(b), delta = n * e - m * d; return delta < 0n ? -1 : delta > 0n ? 1 : 0; }
      return calculate(a, op, b);
    }
    if (Object.hasOwn(template, '$contains')) {
      const [sequence, value] = template.$contains.map(evaluate); check(Array.isArray(sequence), 'Membership requires an array');
      return sequence.some(item => { budget?.tick(); return canonical(item) === canonical(value); });
    }
    if (Object.hasOwn(template, '$encode')) return encodeSOP(evaluate(template.$encode));
    if (Object.hasOwn(template, '$decode')) { const value = decodeSOP(evaluate(template.$decode)); assertData(value); return value; }
    if (Object.hasOwn(template, '$hash')) return digest(evaluate(template.$hash));
    if (Object.hasOwn(template, '$slice')) {
      const { value, start, end } = template.$slice, sequence = evaluate(value), a = evaluate(start), b = evaluate(end);
      check((Array.isArray(sequence) || typeof sequence === 'string') && Number.isInteger(a) && Number.isInteger(b), 'Slice requires a sequence and integer bounds'); return sequence.slice(a, b);
    }
    if (Object.hasOwn(template, '$entries')) { const value = evaluate(template.$entries); check(value && typeof value === 'object' && !Array.isArray(value), 'Entries requires an object'); return Object.entries(value); }
    if (Object.hasOwn(template, '$record')) { const entries = evaluate(template.$record); check(Array.isArray(entries) && entries.every(e => Array.isArray(e) && e.length === 2 && typeof e[0] === 'string'), 'Record requires key/value pairs'); const result = Object.fromEntries(entries); assertData(result); return result; }
    if (Object.hasOwn(template, '$unique')) { const values = evaluate(template.$unique); check(Array.isArray(values), 'Unique requires an array'); return [...new Map(values.map(v => { budget?.tick(); return [canonical(v), v]; })).values()]; }
    if (Object.hasOwn(template, '$sort')) { const values = evaluate(template.$sort); check(Array.isArray(values) && values.every(v => typeof v === 'string'), 'Sort requires strings'); return [...values].sort(); }
    if (Object.hasOwn(template, '$flatten')) { const values = evaluate(template.$flatten); check(Array.isArray(values) && values.every(Array.isArray), 'Flatten requires arrays'); return values.flat(); }
    if (Object.hasOwn(template, '$get')) return copy(getPath(environment, template.$get));
    if (Object.hasOwn(template, '$literal')) return copy(template.$literal);
    if (Object.hasOwn(template, '$path')) {
      const { value, path, fallback = null } = template.$path;
      return pathOr(evaluate(value), evaluate(path), () => evaluate(fallback));
    }
    if (Object.hasOwn(template, '$if')) {
      const { test, then: yes, else: no } = template.$if, condition = evaluate(test);
      check(typeof condition === 'boolean', 'Conditional requires a boolean'); return evaluate(condition ? yes : no);
    }
    if (Object.hasOwn(template, '$eq')) {
      const values = template.$eq.map(evaluate); check(values.length === 2, 'Equality requires two values'); return canonical(values[0]) === canonical(values[1]);
    }
    if (Object.hasOwn(template, '$and') || Object.hasOwn(template, '$or')) {
      const conjunction = Object.hasOwn(template, '$and'), values = template[conjunction ? '$and' : '$or'];
      check(Array.isArray(values), 'Boolean composition requires an array');
      for (const value of values) { const b = evaluate(value); check(typeof b === 'boolean', 'Expected a boolean'); if (conjunction ? !b : b) return b; }
      return conjunction;
    }
    if (Object.hasOwn(template, '$length')) { const value = evaluate(template.$length); check(Array.isArray(value) || typeof value === 'string', 'Length requires a sequence'); return value.length; }
    if (Object.hasOwn(template, '$at')) {
      const { value, index, fallback = null } = template.$at, sequence = evaluate(value), i = evaluate(index);
      check(Array.isArray(sequence) && Number.isInteger(i), 'Indexing requires an array and an integer');
      return sequence.at(i) === undefined ? evaluate(fallback) : copy(sequence.at(i));
    }
    if (Object.hasOwn(template, '$startsWith')) {
      const values = template.$startsWith.map(evaluate); check(values.length === 2 && values.every(v => typeof v === 'string'), 'Prefix matching requires two strings'); return values[0].startsWith(values[1]);
    }
    if (Object.hasOwn(template, '$replace')) {
      const { value, from, to } = template.$replace, values = [value, from, to].map(evaluate);
      check(values.every(v => typeof v === 'string') && values[1].length > 0, 'Replacement requires strings and a nonempty match'); return values[0].split(values[1]).join(values[2]);
    }
    if (Object.hasOwn(template, '$format')) {
      const { pattern, values } = template.$format, text = evaluate(pattern), bindings = evaluate(values);
      check(typeof text === 'string' && bindings && typeof bindings === 'object', 'Formatting requires a pattern and bindings');
      return text.replace(/\{([a-zA-Z][\w]*)\}/g, (_, key) => { budget?.tick(); check(Object.hasOwn(bindings, key) && ['string','number','boolean'].includes(typeof bindings[key]), `Missing/invalid formatting binding: ${key}`); return String(bindings[key]); });
    }
    if (Object.hasOwn(template, '$concat')) {
      const arrays = template.$concat.map(evaluate); check(arrays.every(Array.isArray), 'Concatenation requires arrays'); return arrays.flat();
    }
    if (Object.hasOwn(template, '$merge')) {
      const objects = template.$merge.map(evaluate); check(objects.every(v => v && typeof v === 'object' && !Array.isArray(v)), 'Merge requires objects'); return Object.assign({}, ...objects);
    }
    if (Object.hasOwn(template, '$substitute')) {
      const { value, bindings } = template.$substitute; return substitute(evaluate(value), evaluate(bindings));
    }
    if (Object.hasOwn(template, '$fresh')) return `_:${digest({ scope, name: template.$fresh }).slice(0, 24)}`;
    if (Object.hasOwn(template, '$not')) { const value = evaluate(template.$not); check(typeof value === 'boolean', 'Negation requires a boolean'); return !value; }
    if (Object.hasOwn(template, '$map')) {
      const { items, template: body } = template.$map, values = evaluate(items);
      check(Array.isArray(values) && values.length <= 12000, 'Map requires a bounded array');
      return values.map((item, index) => instantiate(body, { ...environment, item, index }, { budget, scope: `${scope}:${index}` }, depth + 1));
    }
    if (Object.hasOwn(template, '$filter')) {
      const { items, test } = template.$filter, values = evaluate(items);
      check(Array.isArray(values) && values.length <= 12000, 'Filter requires a bounded array');
      return values.filter((item, index) => { const keep = instantiate(test, { ...environment, item, index }, { budget, scope: `${scope}:${index}` }, depth + 1); check(typeof keep === 'boolean', 'Filter test must return a boolean'); return keep; });
    }
    if (Object.hasOwn(template, '$join')) {
      const { values, separator = '' } = template.$join; const v = evaluate(values); check(Array.isArray(v) && v.every(x => typeof x === 'string'), 'Join requires strings'); return v.join(separator);
    }
  }
  return Object.fromEntries(Object.entries(template).map(([k, v]) => [k, evaluate(v)]));
}
