// Shared, portable lexical syntax for executable SOP and inert SOP documents.
export const ensure = (condition, message) => { if (!condition) throw new Error(message); };
export const scalarText = value => Object.is(value, -0) ? '-0' : JSON.stringify(value);
export function declarations(source, maximum = 200000) {
  ensure(typeof source === 'string' && source.length <= maximum, 'SOP source size limit');
  const result = []; let offset = 0;
  while (offset < source.length) {
    if (/\s/u.test(source[offset])) { offset++; continue; }
    if (source[offset] === '#') { while (offset < source.length && source[offset] !== '\n') offset++; continue; }
    const start = offset; let token;
    if (source[offset] === '"') {
      offset++; let escaped = false, closed = false;
      while (offset < source.length) { const c = source[offset++]; if (c === '"' && !escaped) { closed = true; break; } escaped = c === '\\' ? !escaped : false; }
      ensure(closed, 'Unclosed SOP string'); token = { literal: JSON.parse(source.slice(start, offset)), start, end: offset };
    } else {
      while (offset < source.length && !/[\s#]/u.test(source[offset])) offset++;
      token = { word: source.slice(start, offset), start, end: offset };
    }
    if (token.word?.startsWith('@')) result.push([token]);
    else { ensure(result.length, 'SOP content needs a declaration'); result.at(-1).push(token); }
  }
  return result;
}
export function scalarValue(token) {
  if (Object.hasOwn(token ?? {}, 'literal')) return token.literal;
  const word = token?.word;
  if (word === 'true') return true;
  if (word === 'false') return false;
  if (word === 'null') return null;
  if (/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/iu.test(word)) { const n = Number(word); ensure(Number.isFinite(n), 'Non-finite SOP scalar'); return n; }
  throw new Error(`Expected an inert scalar, got ${word}`);
}
