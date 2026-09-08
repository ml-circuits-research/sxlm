import { scalarText } from './sop-syntax.mjs';
import { createHash } from 'node:crypto';
const deeplyFrozen = new WeakSet(), heights = new WeakMap(), executionHashes = new WeakMap();

/** The interchange boundary is inert SOP data, never executable JavaScript or live handles. */
export function assertData(value, depth = 0) { dataHeight(value,depth); }
function dataHeight(value, depth) {
  if (depth > 80) throw new Error('Data nesting limit exceeded');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return 0;
  if(heights.has(value)){const height=heights.get(value);check(depth+height<=80,'Data nesting limit exceeded');return height;}
  let height=0;
  if (Array.isArray(value)) {
    check(Object.getPrototypeOf(value)===Array.prototype,'Only plain inert arrays are accepted');
    const names=Reflect.ownKeys(value);
    check(names.length===value.length+1&&names.every(key=>key==='length'||typeof key==='string'&&/^(?:0|[1-9][0-9]*)$/.test(key)&&Number(key)<value.length),'Arrays may only have indexed inert values');
    for(let i=0;i<value.length;i++){
      const descriptor=Object.getOwnPropertyDescriptor(value,String(i));
      check(descriptor&&Object.hasOwn(descriptor,'value')&&descriptor.enumerable,'inert arrays cannot contain accessors or hidden elements');
      height=Math.max(height,1+dataHeight(descriptor.value,depth+1));
    }
    if(deeplyFrozen.has(value))heights.set(value,height);return height;
  }
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) throw new Error('Only plain inert data is accepted');
  for (const key of Reflect.ownKeys(value)) {
    check(typeof key==='string','inert records cannot contain symbol keys');
    if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error(`Unsafe key: ${key}`);
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    check(Object.hasOwn(descriptor,'value')&&descriptor.enumerable,'inert records cannot contain accessors or hidden properties');
    height=Math.max(height,1+dataHeight(descriptor.value, depth + 1));
  }
  if(deeplyFrozen.has(value))heights.set(value,height);return height;
}
// Internal equality keys are length-delimited, not a second interchange language.
export function canonical(value) {
  assertData(value);
  if (value === null) return 'z';
  if (typeof value === 'string') return 's' + value.length + ':' + value;
  if (typeof value === 'number') return 'n' + String(value) + ';';
  if (typeof value === 'boolean') return value ? 't' : 'f';
  if (Array.isArray(value)) return 'a' + value.length + ':' + value.map(canonical).join('');
  const keys = Object.keys(value).sort();
  return 'o' + keys.length + ':' + keys.map(k => canonical(k) + canonical(value[k])).join('');
}
export const digest = value => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
/** Merkle identity preserves observable record order and signed zero. */
export function executionDigest(value) {
  assertData(value);
  const hash = item => {
    if(executionHashes.has(item))return executionHashes.get(item);
    const encoded=item===null?'null':typeof item!=='object'?typeof item+':'+(Object.is(item,-0)?'-0':scalarText(item)):Array.isArray(item)?'array:'+item.map(hash).join(''):'object:'+Object.entries(item).map(([key,child])=>key.length+':'+key+hash(child)).join('');
    const result=createHash('sha256').update('sxlm.execution.v3:'+encoded).digest('hex');
    if(deeplyFrozen.has(item))executionHashes.set(item,result);return result;
  };
  return hash(value);
}
export const copy = value => structuredClone(value);
/** Copy validated inert at a boundary, sharing only values frozen by this module. */
export function immutableCopy(value) {
  if(value===null||typeof value!=='object'||deeplyFrozen.has(value))return value;
  const result=Array.isArray(value)?value.map(immutableCopy):Object.fromEntries(Object.entries(value).map(([key,child])=>[key,immutableCopy(child)]));
  Object.freeze(result);deeplyFrozen.add(result);return result;
}
export function deepFreeze(value) {
  if (value && typeof value === 'object' && !deeplyFrozen.has(value)) { Object.freeze(value); deeplyFrozen.add(value); for (const item of Object.values(value)) deepFreeze(item); }
  return value;
}
export function check(condition, message) { if (!condition) throw new Error(message); }

export class LimitError extends Error {
  constructor(resource, used, limit) { super(`Budget exceeded: ${resource} (${used}/${limit})`); this.name = 'LimitError'; this.resource = resource; }
}
export class Budget {
  constructor(limits = {}) {
    this.limits = { steps: 200000, facts: 12000, matches: 100000, nodes: 100000, tokens: 12000, milliseconds: 3000, ...limits };
    for (const [key, value] of Object.entries(this.limits)) check(Number.isFinite(value) && value >= 0, `Invalid budget: ${key}`);
    this.used = {}; this.started = performance.now();
  }
  tick(resource = 'steps', count = 1) {
    this.used[resource] = (this.used[resource] ?? 0) + count;
    if (this.used[resource] > (this.limits[resource] ?? Infinity)) throw new LimitError(resource, this.used[resource], this.limits[resource]);
    if (performance.now() - this.started > this.limits.milliseconds) throw new LimitError('milliseconds', performance.now() - this.started, this.limits.milliseconds);
  }
  report() { return { ...this.used, milliseconds: Math.round((performance.now() - this.started) * 100) / 100 }; }
}
