import { check, digest, canonical, executionDigest, Budget, copy, deepFreeze } from '../../src/kernel/data.mjs';

/** Unicode tokenization is structural; vocabulary and token classes come from the installed grammar. */
export function tokenize(text) {
  const tokens = [];
  const pattern = /[\p{L}\p{N}_]+(?:['’.-][\p{L}\p{N}_]+)*|[^\s]/gu;
  for (const match of text.matchAll(pattern)) tokens.push({ text: match[0], value: match[0].normalize('NFKC').toLowerCase(), start: match.index, end: match.index + match[0].length });
  return tokens;
}
function safePattern(pattern) {
  // Packs may define single-token character classes, never arbitrary executable regexes.
  check(typeof pattern === 'string' && pattern.length <= 200, 'Unsafe lexical pattern');
  const groups = pattern.match(/\[(?:\\.|[^\]\\])+\][*+?]?/g) ?? [];
  check(groups.join('') === pattern && groups.length > 0 && groups.length <= 4, 'Lexical patterns require 1–4 character classes');
  check(groups.filter(g => /[+*?]$/.test(g)).length <= 1, 'Only one variable repetition is allowed in a lexical pattern');
  return new RegExp(`^(?:${pattern})$`, 'u');
}
export function validateGrammar(grammar, runtime) {
  check(grammar.schema === 'sxlm.grammar.v1' && typeof grammar.start === 'string', 'Invalid grammar schema');
  check(Array.isArray(grammar.productions) && grammar.productions.length > 0 && grammar.productions.length <= 2000, 'Invalid grammar size');
  const ids = new Set(), categories = new Set(grammar.productions.map(p => p.lhs));
  for (const production of grammar.productions) {
    check(typeof production.id === 'string' && !ids.has(production.id), 'Duplicate grammar production'); ids.add(production.id);
    check(Array.isArray(production.rhs) && production.rhs.length > 0 && production.rhs.length <= 16, 'Empty/oversized productions are not supported');
    check(runtime.programs.has(production.action), `Missing semantic circuit: ${production.action}`);
    for (const symbol of production.rhs) {
      if (typeof symbol === 'string') check(categories.has(symbol), `Unknown grammar category: ${symbol}`);
      else check(symbol && ['literal', 'lex', 'class'].filter(k => Object.hasOwn(symbol, k)).length === 1, 'Invalid grammar terminal');
    }
  }
  check(categories.has(grammar.start), 'Missing start category');
  for (const cls of Object.values(grammar.classes ?? {})) safePattern(cls.pattern);
  for (const lexeme of grammar.lexicon ?? []) check(typeof lexeme.surface === 'string' && typeof lexeme.category === 'string' && lexeme.value !== undefined, 'Invalid lexeme');
}

/** General Earley recognizer with bounded semantic alternatives and circuit-based composition. */
export class Grammar {
  #productions = new Map(); #lexicon = new Map(); #classes;
  get productions(){return new Map(this.#productions);}
  get lexicon(){return new Map(this.#lexicon);}
  constructor(data, runtime) {
    validateGrammar(data, runtime); this.data = deepFreeze(copy(data)); data=this.data; this.runtime = runtime;
    this.#productions = new Map(); this.#lexicon = new Map();
    this.#classes = new Map(Object.entries(data.classes ?? {}).map(([k, v]) => [k, { ...v, regexp: safePattern(v.pattern) }]));
    for (const p of data.productions) { if (!this.#productions.has(p.lhs)) this.#productions.set(p.lhs, []); this.#productions.get(p.lhs).push(p); }
    for (const item of data.lexicon ?? []) {
      const key = canonical([item.category,item.surface.normalize('NFKC').toLowerCase()]);
      if (!this.#lexicon.has(key)) this.#lexicon.set(key, []); this.#lexicon.get(key).push(item.value);
    }
    for(const values of [...this.#productions.values(),...this.#lexicon.values()])deepFreeze(values);
    Object.freeze(this);
  }
  terminal(symbol, token) {
    if ('literal' in symbol) return token.value === symbol.literal.normalize('NFKC').toLowerCase() ? [token.value] : [];
    if ('lex' in symbol) return this.#lexicon.get(canonical([symbol.lex,token.value])) ?? [];
    const cls = this.#classes.get(symbol.class); check(cls, `Unknown lexical class: ${symbol.class}`);
    if (!cls.regexp.test(cls.caseSensitive ? token.text : token.value)) return [];
    if (cls.excludeCategories?.some(c => this.#lexicon.has(canonical([c,token.value])))) return [];
    return [cls.preserveCase ? token.text : token.value];
  }
  parse(text, { budget = new Budget(), start = this.data.start, maxAlternatives = 8, cache = true, scope: parentScope = '' } = {}) {
    check(typeof start==='string'&&Number.isInteger(maxAlternatives)&&maxAlternatives>=1&&maxAlternatives<=128,'Invalid grammar parse options');
    const tokens = tokenize(text); budget.tick('tokens', tokens.length);
    check(tokens.length <= 512, 'A grammar segment is limited to 512 tokens');
    const chart = Array.from({ length: tokens.length + 1 }, () => ({ items: [], seen: new Set(), completed: [] }));
    const add = (position, item) => {
      // Children are executable semantic values: later circuits can observe order and -0.
      const key = executionDigest({production:item.production.id,dot:item.dot,origin:item.origin,children:item.children});
      if (!chart[position].seen.has(key)) { budget.tick('steps'); chart[position].seen.add(key); chart[position].items.push(item); }
    };
    for (const p of this.#productions.get(start) ?? []) add(0, { production: p, dot: 0, origin: 0, children: [] });
    for (let position = 0; position < chart.length; position++) {
      for (let cursor = 0; cursor < chart[position].items.length; cursor++) {
        budget.tick(); const item = chart[position].items[cursor], next = item.production.rhs[item.dot];
        if (next === undefined) {
          const scope = digest({ parentScope, text, start: item.origin, end: position, production: item.production.id });
          let value;
          try { value = this.runtime.execute(item.production.action, { children: item.children, scope }, { budget, cache }); }
          catch (error) { if (error.name === 'LimitError') throw error; throw new Error(`Semantic circuit ${item.production.action}: ${error.message}`); }
          chart[position].completed.push({ lhs: item.production.lhs, origin: item.origin, value, production: item.production.id });
          for (const parent of chart[item.origin].items) if (parent.production.rhs[parent.dot] === item.production.lhs) {
            add(position, { ...parent, dot: parent.dot + 1, children: [...parent.children, value] });
          }
        } else if (typeof next === 'string') {
          for (const production of this.#productions.get(next) ?? []) add(position, { production, dot: 0, origin: position, children: [] });
          // Supports completion observed before its parent without nullable productions.
          for (const done of chart[position].completed) if (done.origin === position && done.lhs === next) add(position, { ...item, dot: item.dot + 1, children: [...item.children, done.value] });
        } else if (tokens[position]) for (const value of this.terminal(next, tokens[position])) add(position + 1, { ...item, dot: item.dot + 1, children: [...item.children, value] });
      }
    }
    const alternatives = new Map();
    for (const done of chart.at(-1).completed) if (done.origin === 0 && done.lhs === start) alternatives.set(executionDigest(done.value), done);
    const all = [...alternatives.values()];
    return { status: all.length === 0 ? 'unparsed' : all.length === 1 ? 'parsed' : 'ambiguous', alternatives: all.slice(0, maxAlternatives).map(v => v.value), derivations: all.slice(0, maxAlternatives).map(v => v.production), alternativeCount: all.length, tokens: tokens.length, states: chart.reduce((n, c) => n + c.items.length, 0) };
  }
}
