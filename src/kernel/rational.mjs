import { check } from './data.mjs';
const gcd = (a, b) => b ? gcd(b, a % b) : a < 0n ? -a : a;
const normal = (n, d) => { check(d !== 0n, 'Division by zero'); const g = gcd(n, d); return [n / g * (d < 0n ? -1n : 1n), d / g * (d < 0n ? -1n : 1n)]; };
export function rational(value) {
  const s = String(value); check(s.length < 200 && /^-?\d+(?:\.\d+|\/\d+)?$/.test(s), `Invalid number: ${s}`);
  if (s.includes('/')) { const [n, d] = s.split('/'); return normal(BigInt(n), BigInt(d)); }
  const [whole, fraction = ''] = s.split('.');
  return normal(BigInt(whole + fraction), 10n ** BigInt(fraction.length));
}
export function format([n, d]) { [n, d] = normal(n, d); return d === 1n ? String(n) : `${n}/${d}`; }
export function calculate(a, op, b) {
  const [n, d] = rational(a), [m, e] = rational(b);
  if (op === '+') return format([n * e + m * d, d * e]);
  if (op === '-') return format([n * e - m * d, d * e]);
  if (op === '*') return format([n * m, d * e]);
  if (op === '/') return format([n * e, d * m]);
  throw new Error(`Unknown arithmetic operation: ${op}`);
}
/** Bounded precedence parser; no eval/Function, exact decimal arithmetic. */
export function expression(text) {
  const tokens = text.match(/\d+(?:\.\d+)?|[()+*/-]/g) ?? [];
  check(tokens.join('') === text.replace(/\s/g, '') && tokens.length <= 100, 'Unsupported arithmetic expression');
  let pos = 0;
  function atom() {
    if (tokens[pos] === '-') { pos++; return calculate('0', '-', atom()); }
    if (tokens[pos] === '(') { pos++; const v = sum(); check(tokens[pos++] === ')', 'Expected closing parenthesis'); return v; }
    const t = tokens[pos++]; check(/^\d+(?:\.\d+)?$/.test(t ?? ''), 'Expected a number'); return format(rational(t));
  }
  function product() { let v = atom(); while (['*', '/'].includes(tokens[pos])) { const op = tokens[pos++]; v = calculate(v, op, atom()); } return v; }
  function sum() { let v = product(); while (['+', '-'].includes(tokens[pos])) { const op = tokens[pos++]; v = calculate(v, op, product()); } return v; }
  const value = sum(); check(pos === tokens.length, 'Unexpected arithmetic token'); return value;
}
