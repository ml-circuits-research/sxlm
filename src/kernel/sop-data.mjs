import { declarations, scalarValue, scalarText, ensure } from './sop-syntax.mjs';

// The constructor-only profile of SOP. It cannot invoke programs or host services.
// It is shared by browser, file and HTTP boundaries. Source quotations stay inert.
const safeKey = key => !['__proto__', 'prototype', 'constructor'].includes(key);
export function encodeSOP(value, { sources = true, canonical = false, maxValues = 2000000, tick = () => {} } = {}) {
  const lines = [], modules = [], quoted = new Map(); let serial = 0, visited = 0;
  function emit(item, depth = 0, field = '') {
    tick(); ensure(++visited <= maxValues, 'SOP expanded value budget');
    ensure(depth <= 80, 'Data nesting limit exceeded');
    if (item === null || ['string', 'number', 'boolean'].includes(typeof item)) {
      ensure(typeof item !== 'number' || Number.isFinite(item), 'Expected a finite scalar');
      if (sources && field === 'source' && typeof item === 'string' && /^\s*(?:#|@)/u.test(item)) {
        // Arbitrary observations named "source" are still ordinary text, even
        // when they contain malformed program syntax or an unmatched quote.
        try { declarations(item); } catch { return scalarText(item); }
        if (!quoted.has(item)) { const id = 'source' + quoted.size; quoted.set(item, id); modules.push(`@module ${id} chars ${item.length}\n${item}\n@end\n`); }
        return '&' + quoted.get(item);
      }
      return scalarText(canonical && Object.is(item, -0) ? 0 : item);
    }
    const array = Array.isArray(item);
    ensure(item && Object.getPrototypeOf(item) === (array ? Array.prototype : Object.prototype), 'Only inert plain data is accepted');
    const keys = Reflect.ownKeys(item);
    ensure(array ? keys.length === item.length + 1 && keys.every(k => k === 'length' || typeof k === 'string' && /^(?:0|[1-9][0-9]*)$/u.test(k) && Number(k) < item.length) : keys.every(k => typeof k === 'string' && safeKey(k)), 'Invalid data keys');
    const args = [];
    for (const key of array ? Array.from({ length: item.length }, (_, i) => String(i)) : canonical ? keys.sort() : keys) {
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      ensure(descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable, 'Accessors and hidden values are forbidden');
      args.push(array ? 'item' : scalarText(key), emit(descriptor.value, depth + 1, array ? '' : key));
    }
    const name = 'v' + serial++;
    lines.push(`@${name} ${array ? 'kernel.seq.make' : 'kernel.value.record'}${args.length ? ' ' + args.join(' ') : ''}`);
    return '$' + name;
  }
  let output = emit(value);
  if (!output.startsWith('$')) { lines.push('@result kernel.value.literal value ' + output); output = '$result'; }
  return modules.join('\n') + lines.join('\n') + '\n@output result ' + output + '\n';
}

export function decodeSOP(source, { maxCharacters = 32 * 1024 * 1024, maxNodes = 500000, maxValues = 2000000, maxDepth = 80, tick = () => {} } = {}) {
  if (typeof source !== 'string' && source?.toString) source = source.toString('utf8');
  const rows = declarations(source, maxCharacters), modules = new Map(), graph = new Map(); let output;
  for (let i = 0; i < rows.length; i++) {
    tick();
    const [head, ...rest] = rows[i], id = head.word.slice(1);
    if (id === 'module') {
      ensure(rest.length === 3 && /^[A-Za-z][\w-]*$/u.test(rest[0].word) && rest[1].word === 'chars' && /^(?:0|[1-9][0-9]*)$/u.test(rest[2].word) && !modules.has(rest[0].word), 'Invalid/duplicate SOP module quotation');
      const start = rest[2].end + 1, end = start + Number(rest[2].word);
      ensure(source[start - 1] === '\n' && end < source.length && source.slice(end, end + 6) === '\n@end\n', 'Unclosed SOP module quotation');
      modules.set(rest[0].word, source.slice(start, end));
      while (++i < rows.length && rows[i][0].start < end + 1) {}
      ensure(i < rows.length && rows[i][0].start === end + 1 && rows[i][0].word === '@end' && rows[i].length === 1, 'Invalid module quotation boundary'); continue;
    }
    if (id === 'output') { ensure(output === undefined && rest.length === 2 && rest[0].word === 'result' && rest[1].word?.startsWith('$'), 'Invalid/duplicate SOP output'); output = rest[1].word.slice(1); continue; }
    ensure(/^[A-Za-z][\w-]*$/u.test(id) && !graph.has(id) && graph.size < maxNodes, 'Invalid/duplicate SOP producer or node budget');
    const command = rest.shift()?.word;
    ensure(['kernel.value.record', 'kernel.seq.make', 'kernel.value.literal'].includes(command) && rest.length % 2 === 0, 'Only SOP data constructors are allowed at the data boundary');
    const args = [], fields = new Set();
    for (let j = 0; j < rest.length; j += 2) {
      const key = rest[j].word ?? rest[j].literal;
      ensure(typeof key === 'string' && (command === 'kernel.seq.make' ? key === 'item' : command === 'kernel.value.literal' ? key === 'value' : safeKey(key)), 'Invalid SOP constructor field');
      ensure(command === 'kernel.seq.make' || !fields.has(key), 'Duplicate SOP record field'); fields.add(key); args.push([key, rest[j + 1]]);
    }
    ensure(command !== 'kernel.value.literal' || args.length === 1, 'Scalar constructor needs exactly one value');
    ensure(command !== 'kernel.value.literal' || !args[0][1].word?.startsWith('$'), 'Literal constructor requires a scalar literal');
    graph.set(id, { command, args });
  }
  ensure(typeof output === 'string' && graph.has(output), 'Unbound SOP output');
  const done = new Map(), visiting = new Set();
  function visit(id, chain = 0) {
    tick();
    ensure(chain <= maxDepth, 'SOP dependency depth limit');
    if (done.has(id)) return done.get(id);
    ensure(graph.has(id) && !visiting.has(id), 'Unbound or cyclic SOP reference'); visiting.add(id);
    const { command, args } = graph.get(id); let size = 1, height = 0;
    const items = args.map(([key, token]) => {
      tick();
      let item;
      if (token.word?.startsWith('$')) item = visit(token.word.slice(1), chain + 1);
      else if (token.word?.startsWith('&')) { ensure(modules.has(token.word.slice(1)), 'Unbound SOP source quotation'); item = { value: modules.get(token.word.slice(1)), size: 1, height: 0 }; }
      else item = { value: scalarValue(token), size: 1, height: 0 };
      size += item.size; height = Math.max(height, item.height + 1); ensure(size <= maxValues && height <= maxDepth, 'SOP expanded value budget');
      return [key, item.value];
    });
    const value = command === 'kernel.value.literal' ? items[0][1] : command === 'kernel.seq.make' ? items.map(([, value]) => value) : Object.fromEntries(items);
    ensure(command !== 'kernel.value.literal' || value === null || typeof value !== 'object', 'Literal constructor requires a scalar');
    const result = { value, size, height }; done.set(id, result); visiting.delete(id); return result;
  }
  // Validate unused producers too; a malformed dead node cannot hide in an artifact.
  for (const id of graph.keys()) visit(id);
  return visit(output).value;
}
