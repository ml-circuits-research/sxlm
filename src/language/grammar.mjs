import { check, digest, canonical, executionDigest, Budget, copy, deepFreeze } from '../kernel/data.mjs';

/** Unicode tokenization is structural; vocabulary and token classes come from the installed grammar. */
export function tokenize(text) {
  const tokens = [];
  const pattern = /[\p{L}\p{N}_]+(?:['’.-][\p{L}\p{N}_]+)*|[^\s]/gu;
  for (const match of text.matchAll(pattern)) tokens.push({ text: match[0], value: match[0].normalize('NFKC').toLowerCase(), start: match.index, end: match.index + match[0].length });
  return tokens;
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
  for (const lexeme of grammar.lexicon ?? []) check(typeof lexeme.surface === 'string' && typeof lexeme.category === 'string' && lexeme.value !== undefined, 'Invalid lexeme');
}

/** General Earley recognizer with bounded semantic alternatives and circuit-based composition. */
export class Grammar {
  #productions = new Map(); #lexicon = new Map(); #lexical; #policy;
  get productions(){return new Map(this.#productions);}
  get lexicon(){return new Map(this.#lexicon);}
  constructor(data, runtime, { policy, budget = new Budget() } = {}) {
    validateGrammar(data, runtime);
    check(policy && ['prepare','tokenize','terminal'].every(key=>typeof policy[key]==='string'), 'Grammar requires explicit lexical circuit entrypoints');
    const contracts = { prepare:{with:'object'}, tokenize:{text:'string'}, terminal:{symbol:'object',token:'object',knowledge:'object'} };
    for(const [key,inputs] of Object.entries(contracts)) {
      const program=runtime.programs.get(policy[key]);
      check(program && canonical(program.inputs)===canonical(inputs) && program.output===(key==='prepare'?'object':'array') && program.pure, 'Invalid lexical circuit contract: '+key);
    }
    this.data = deepFreeze(copy(data)); data=this.data; this.runtime = runtime; this.#policy=deepFreeze(copy(policy));
    this.#lexical=deepFreeze(runtime.execute(policy.prepare,{with:data},{budget}));
    check(this.#lexical.lexicon && typeof this.#lexical.lexicon==='object', 'Lexical preparation requires an index');
    this.#lexicon = new Map(Object.entries(this.#lexical.lexicon));
    for (const p of data.productions) { if (!this.#productions.has(p.lhs)) this.#productions.set(p.lhs, []); this.#productions.get(p.lhs).push(p); }
    for(const values of this.#productions.values())deepFreeze(values);
    Object.freeze(this);
  }
  terminal(symbol, token, { budget = new Budget(), cache = true, trace = [] } = {}) {
    return this.runtime.execute(this.#policy.terminal,{symbol,token,knowledge:this.#lexical},{budget,cache,trace});
  }
  tokenize(text, {budget=new Budget(),cache=true,trace=[]}={}) {
    const tokens = this.runtime.execute(this.#policy.tokenize,{text},{budget,cache,trace});
    check(tokens.every((token,index)=>token && typeof token.text==='string' && typeof token.value==='string' && Number.isInteger(token.start) && Number.isInteger(token.end) && token.start>=(index?tokens[index-1].end:0) && token.end>token.start && token.end<=text.length && text.slice(token.start,token.end)===token.text),'Invalid lexical token spans');
    return tokens;
  }
  parse(text, { budget = new Budget(), start = this.data.start, maxAlternatives = 8, cache = true, trace = [], scope: parentScope = '' } = {}) {
    check(typeof start==='string'&&Number.isInteger(maxAlternatives)&&maxAlternatives>=1&&maxAlternatives<=128,'Invalid grammar parse options');
    const tokens = this.tokenize(text,{budget,cache,trace});
    check(tokens.length <= 512, 'A grammar segment is limited to 512 tokens');
    const terminalResults = new Map();
    const matchTerminal = (symbol, token) => {
      // The installed lexical contract is pure. Cache all observable inputs,
      // including token offsets and symbol property order, within this parse.
      const key = cache ? executionDigest({ symbol, token }) : null;
      if (key !== null && terminalResults.has(key)) { budget.tick('terminalCacheHits'); return terminalResults.get(key); }
      const values = this.terminal(symbol, token, { budget, cache, trace });
      if (key !== null) terminalResults.set(key, deepFreeze(values));
      return values;
    };
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
          try { value = this.runtime.execute(item.production.action, { children: item.children, scope }, { budget, cache, trace }); }
          catch (error) { if (error.name === 'LimitError') throw error; throw new Error(`Semantic circuit ${item.production.action}: ${error.message}`); }
          chart[position].completed.push({ lhs: item.production.lhs, origin: item.origin, value, production: item.production.id });
          for (const parent of chart[item.origin].items) if (parent.production.rhs[parent.dot] === item.production.lhs) {
            add(position, { ...parent, dot: parent.dot + 1, children: [...parent.children, value] });
          }
        } else if (typeof next === 'string') {
          for (const production of this.#productions.get(next) ?? []) add(position, { production, dot: 0, origin: position, children: [] });
          // Supports completion observed before its parent without nullable productions.
          for (const done of chart[position].completed) if (done.origin === position && done.lhs === next) add(position, { ...item, dot: item.dot + 1, children: [...item.children, done.value] });
        } else if (tokens[position]) for (const value of matchTerminal(next, tokens[position])) add(position + 1, { ...item, dot: item.dot + 1, children: [...item.children, value] });
      }
    }
    const alternatives = new Map();
    for (const done of chart.at(-1).completed) if (done.origin === 0 && done.lhs === start) alternatives.set(executionDigest(done.value), done);
    const all = [...alternatives.values()];
    return { status: all.length === 0 ? 'unparsed' : all.length === 1 ? 'parsed' : 'ambiguous', alternatives: all.slice(0, maxAlternatives).map(v => v.value), derivations: all.slice(0, maxAlternatives).map(v => v.production), alternativeCount: all.length, tokens: tokens.length, states: chart.reduce((n, c) => n + c.items.length, 0) };
  }
}
