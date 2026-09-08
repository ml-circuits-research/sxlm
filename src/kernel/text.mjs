import { check } from './data.mjs';

// A restricted regular-language membership mechanism: concatenated character
// classes, with at most one optional/repeated class. No task or vocabulary rules.
export function characterPattern(pattern) {
  check(typeof pattern === 'string' && pattern.length <= 200, 'Unsafe character pattern');
  const groups = pattern.match(/\[(?:\\.|[^\]\\])+\][*+?]?/g) ?? [];
  check(groups.join('') === pattern && groups.length > 0 && groups.length <= 4, 'Character patterns require 1–4 character classes');
  check(groups.filter(group => /[+*?]$/.test(group)).length <= 1, 'Only one variable repetition is allowed in a character pattern');
  return new RegExp(`^(?:${pattern})$`, 'u');
}

export function installTextPrimitives(runtime) {
  runtime.primitive('kernel.text.normalize', { inputs: { text: 'string', form: 'string' }, output: 'string', run: ({ text, form }, { budget }) => {
    check(['NFC', 'NFD', 'NFKC', 'NFKD'].includes(form), 'Unknown Unicode normalization form');
    budget.tick('steps', text.length); return text.normalize(form);
  } });
  runtime.primitive('kernel.text.case', { inputs: { text: 'string', mode: 'string' }, output: 'string', run: ({ text, mode }, { budget }) => {
    check(['lower', 'upper'].includes(mode), 'Unknown Unicode case operation');
    budget.tick('steps', text.length); return mode === 'lower' ? text.toLowerCase() : text.toUpperCase();
  } });
  runtime.primitive('kernel.text.matchClass', { inputs: { text: 'string', pattern: 'string' }, output: 'boolean', run: ({ text, pattern }, { budget }) => {
    budget.tick('steps', text.length + pattern.length); return characterPattern(pattern).exec(text)?.[0] === text;
  } });
  return runtime;
}
