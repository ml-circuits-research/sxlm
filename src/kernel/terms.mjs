import { check, copy } from './data.mjs';

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
export function installTermPrimitives(runtime) {
  for (const [type, valid] of Object.entries({ array: Array.isArray, string: v => typeof v === 'string', number: v => typeof v === 'number', boolean: v => typeof v === 'boolean' })) runtime.primitive(`data.${type}`, { inputs: { value: 'any' }, output: type, run: ({ value }) => { check(valid(value), `Expected ${type}`); return value; } });
  runtime.primitive('data.object', { inputs: { value: 'any' }, output: 'object', run: ({ value }) => { check(value !== null && typeof value === 'object' && !Array.isArray(value), 'Expected an object'); return value; } });
  runtime.primitive('data.attach', { inputs: { record: 'object', key: 'string', value: 'any' }, output: 'object', run: ({ record, key, value }) => { check(!['__proto__','constructor','prototype'].includes(key), 'Unsafe key'); return { ...record, [key]: value }; } });
  runtime.primitive('data.wrap', { inputs: { key: 'string', value: 'any' }, output: 'object', run: ({ key, value }) => { check(!['__proto__', 'constructor', 'prototype'].includes(key), 'Unsafe key'); return { [key]: value }; } });
  runtime.primitive('data.get', { inputs: { value: 'any', path: 'array' }, output: 'any', run: ({ value, path }) => getPath(value, path) });
  runtime.primitive('data.concat', { inputs: { arrays: 'array' }, output: 'array', run: ({ arrays }) => { check(arrays.every(Array.isArray), 'Expected arrays'); return arrays.flat(); } });
  runtime.primitive('data.substitute', { inputs: { value: 'any', bindings: 'object' }, output: 'any', run: ({ value, bindings }) => substitute(value, bindings) });
  return runtime;
}
