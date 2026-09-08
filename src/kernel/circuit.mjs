import { assertData, check, copy, immutableCopy, deepFreeze, executionDigest, canonical, Budget, LimitError } from './data.mjs';

const types = new Map([
  ['any', () => true], ['string', v => typeof v === 'string'], ['number', v => typeof v === 'number'],
  ['boolean', v => typeof v === 'boolean'], ['array', Array.isArray], ['object', v => v !== null && !Array.isArray(v) && typeof v === 'object'],
]);
export const ref = name => ({ ref: name });
const isRef = value => value && typeof value === 'object' && Object.keys(value).length === 1 && typeof value.ref === 'string';
const compatible = (actual, expected) => expected === 'any' || actual === expected;
function callees(node) {
  if (node.iterate) return [node.iterate, node.guard];
  if (node.choose) return [...new Set([...Object.values(node.choose.cases ?? {}), node.choose.otherwise])];
  return node.call || node.map || node.fold || node.attempt ? [node.call ?? node.map ?? node.fold ?? node.attempt] : [];
}

/** A small typed SOP/dataflow VM. Packs may compose installed primitives; they cannot install code. */
export class CircuitRuntime {
  #types; #primitives; #programs; #cache; #sealed = false; #identity;
  get identity(){return this.#identity;}
  get sealed(){return this.#sealed;}
  seal(){this.#sealed=true;Object.freeze(this);return this;}
  get types(){return new Map(this.#types);}
  get primitives(){return new Map(this.#primitives);}
  get programs(){return new Map(this.#programs);}
  get cache(){return new Map(this.#cache);}
  constructor({ cacheSize = 128, identity = 'unversioned-host' } = {}) { check(typeof identity==='string','Invalid runtime identity');this.#identity=identity;this.#types = new Map(types); this.#primitives = new Map(); this.#programs = new Map(); this.#cache = new Map(); this.cacheSize = cacheSize; }
  type(name, validate) { check(!this.#sealed,'Runtime is sealed');check(!this.#types.has(name), `Type already defined: ${name}`); this.#types.set(name, validate); return this; }
  primitive(name, { inputs, output, version = '1', pure = true, run }) {
    check(!this.#sealed,'Runtime is sealed');
    check(!this.#primitives.has(name), `Primitive already installed: ${name}`);
    check(this.#types.has(output) && Object.values(inputs).every(t => this.#types.has(t)), `Unknown primitive type: ${name}`);
    this.#primitives.set(name, Object.freeze({ inputs:deepFreeze(copy(inputs)), output, version, pure, run })); return this;
  }
  dependenciesReady(program) {
    return program.nodes.every(node => node.op ? this.#primitives.has(node.op) : callees(node).length > 0 && callees(node).every(id => this.#programs.has(id)));
  }
  compile(program) {
    check(!this.#sealed,'Runtime is sealed');
    assertData(program);
    check(program.schema === 'sxlm.circuit.v1' && typeof program.id === 'string', 'Invalid circuit schema');
    check(program.inputs && Array.isArray(program.nodes) && program.nodes.length <= 256, 'Invalid circuit structure');
    const known = new Map(Object.entries(program.inputs).map(([k, t]) => [`$${k}`, t]));
    for (const t of known.values()) check(this.#types.has(t), `Unknown input type: ${t}`);
    const dependencies = [];
    let pure = true;
    for (const node of program.nodes) {
      check(typeof node.id === 'string' && !node.id.startsWith('$') && !known.has(node.id), `Invalid/duplicate node: ${node.id}`);
      check(['op','call','map','fold','choose','attempt','iterate'].filter(k => Object.hasOwn(node, k)).length === 1, 'A node needs exactly one op, call, map, fold, choose, attempt or iterate');
      const targets = node.op ? [this.#primitives.get(node.op)] : callees(node).map(id => this.#programs.get(id));
      check(targets.length > 0 && targets.every(Boolean), `Unknown operation/circuit: ${node.op ?? node.call ?? node.map ?? canonical(node.choose??node.fold??node.attempt??null)}`);
      const target = targets[0];
      check(target, `Unknown operation/circuit: ${node.op ?? node.call}`);
      check(targets.every(t => canonical(t.inputs) === canonical(target.inputs)) && (node.iterate ? targets[1].output === 'boolean' : targets.every(t => t.output === target.output)), 'Branch/iteration circuit contracts must agree');
      const inputs = { ...target.inputs };
      if (node.iterate) {
        check(typeof node.accumulator === 'string' && Object.hasOwn(inputs, node.accumulator), 'Iteration needs a declared state input');
        const expected = inputs[node.accumulator]; delete inputs[node.accumulator];
        check(compatible(target.output, expected), 'Iteration output must satisfy its state contract');
        if (isRef(node.initial)) check(known.has(node.initial.ref) && compatible(known.get(node.initial.ref), expected) && compatible(known.get(node.initial.ref), target.output), 'Invalid iteration initial reference');
        else check(this.#types.get(expected)(node.initial) && this.#types.get(target.output)(node.initial), 'Invalid iteration initial value');
        if (isRef(node.limit)) check(known.has(node.limit.ref) && known.get(node.limit.ref) === 'number', 'Iteration limit requires a number reference');
        else check(Number.isSafeInteger(node.limit) && node.limit >= 0, 'Invalid iteration limit');
      }
      if (node.map || node.fold) {
        check(typeof node.item === 'string' && Object.hasOwn(inputs, node.item), 'Map must bind one declared callback input');
        delete inputs[node.item];
        if (isRef(node.items)) check(known.has(node.items.ref) && ['array','any'].includes(known.get(node.items.ref)), 'Map requires a sequence reference');
        else check(Array.isArray(node.items), 'Map requires a sequence');
      }
      if (node.fold) {
        check(typeof node.accumulator === 'string' && node.accumulator !== node.item && Object.hasOwn(inputs, node.accumulator), 'Fold must bind a distinct accumulator input');
        const expected = inputs[node.accumulator]; delete inputs[node.accumulator];
        check(compatible(target.output, expected), 'Fold output must satisfy its accumulator contract');
        if (isRef(node.initial)) check(known.has(node.initial.ref) && compatible(known.get(node.initial.ref), expected) && compatible(known.get(node.initial.ref), target.output), 'Invalid fold initial reference');
        else check(this.#types.get(expected)(node.initial) && this.#types.get(target.output)(node.initial), 'Invalid fold initial value');
      }
      if (node.choose) {
        check(node.choose.cases && typeof node.choose.otherwise === 'string', 'A choice needs cases and an explicit fallback');
        if (isRef(node.choose.selector)) check(known.has(node.choose.selector.ref) && ['string','any'].includes(known.get(node.choose.selector.ref)), 'Choice requires a selector reference');
        else check(typeof node.choose.selector === 'string', 'Choice requires a string selector');
      }
      check(node.args && Object.keys(node.args).length === Object.keys(inputs).length, `Argument arity at ${node.id}`);
      for (const [name, expected] of Object.entries(inputs)) {
        check(Object.hasOwn(node.args, name), `Missing argument ${node.id}.${name}`);
        const value = node.args[name];
        if (isRef(value)) check(known.has(value.ref) && compatible(known.get(value.ref), expected), `Invalid/ill-typed reference ${value.ref} at ${program.id}.${node.id}.${name}`);
        else check(this.#types.get(expected)(value), `Wrong literal type at ${node.id}.${name}`);
      }
      known.set(node.id, node.map ? 'array' : node.attempt ? 'object' : target.output);
      pure &&= targets.every(t => t.pure);
      dependencies.push(...(node.op ? [`${node.op}@${target.version}`] : targets.map(t => t.hash)));
    }
    check(isRef(program.output) && known.has(program.output.ref), 'Invalid circuit output');
    const compiled = deepFreeze({ program: copy(program), inputs: copy(program.inputs), output: known.get(program.output.ref), pure, hash: executionDigest({ runtime: this.#identity, program, dependencies }) });
    const existing = this.#programs.get(program.id);
    check(!existing || existing.hash === compiled.hash, `Circuit ID already has a different definition: ${program.id}`);
    this.#programs.set(program.id, compiled);
    return compiled;
  }
  execute(id, inputs, { budget = new Budget(), cache = true, trace = [] } = {}) {
    assertData(inputs);
    return copy(this.#execute(id,immutableCopy(inputs),{budget,cache,trace}));
  }
  #execute(id, inputs, { budget, cache, trace }) {
    const compiled = this.#programs.get(id); check(compiled, `Unknown circuit: ${id}`);
    check(Object.keys(inputs).length === Object.keys(compiled.inputs).length, `Wrong circuit input arity: ${id}`);
    for (const [key, type] of Object.entries(compiled.inputs)) check(Object.hasOwn(inputs, key) && this.#types.get(type)(inputs[key]), `Wrong circuit input: ${key}`);
    const values = new Map(Object.entries(inputs).map(([k, v]) => [`$${k}`, v]));
    for (const node of compiled.program.nodes) {
      budget.tick('nodes');
      const resolve = value => isRef(value) ? values.get(value.ref) : value;
      const args = Object.fromEntries(Object.entries(node.args).map(([k, v]) => [k, resolve(v)]));
      const selector = node.choose ? resolve(node.choose.selector) : null;
      if (node.choose) check(typeof selector === 'string', 'Choice selector must evaluate to a string');
      const callee = node.choose ? (Object.hasOwn(node.choose.cases, selector) ? node.choose.cases[selector] : node.choose.otherwise) : node.call ?? node.map ?? node.fold ?? node.attempt ?? node.iterate;
      const target = callee ? this.#programs.get(callee) : this.#primitives.get(node.op);
      const items = node.map || node.fold ? resolve(node.items) : null, initial = node.fold || node.iterate ? resolve(node.initial) : null;
      const limit = node.iterate ? resolve(node.limit) : null;
      if (node.iterate) check(Number.isSafeInteger(limit) && limit >= 0, 'Invalid iteration limit');
      if (node.map || node.fold) check(Array.isArray(items), 'Iteration input must evaluate to an array');
      // The complete program content (including constants and nested definitions) participates in cache identity.
      const cacheable = target.pure && (!node.iterate || this.#programs.get(node.guard).pure);
      const key = cache && cacheable ? executionDigest({ program: compiled.hash, node: node.id, args, selector, items, initial, limit }) : null;
      const hit = key !== null && this.#cache.has(key);
      let result;
      if (hit) result = this.#cache.get(key);
      else {
        if (node.iterate) {
          result = initial; let iterations = 0;
          while (this.#execute(node.guard, { ...args, [node.accumulator]: result }, { budget, cache, trace })) {
            if (iterations >= limit) throw new LimitError('iterations', iterations + 1, limit);
            budget.tick('iterations'); budget.tick(); iterations++;
            result = this.#execute(callee, { ...args, [node.accumulator]: result }, { budget, cache, trace });
          }
        }
        else if (node.map) result = items.map(item => { budget.tick(); return this.#execute(callee, { ...args, [node.item]: item }, { budget, cache, trace }); });
        else if (node.fold) result = items.reduce((accumulator, item) => { budget.tick(); return this.#execute(callee, { ...args, [node.item]: item, [node.accumulator]: accumulator }, { budget, cache, trace }); }, initial);
        else if(node.attempt){
          try{result={ok:true,value:this.#execute(callee,args,{budget,cache,trace})};}
          catch(error){if(error instanceof LimitError)throw error;result={ok:false,error:{name:error?.name??'Error',message:error?.message??String(error)}};}
        }
        else result = callee ? this.#execute(callee, args, { budget, cache, trace }) : target.run(deepFreeze(args), { budget, cache, trace });
        assertData(result); check(this.#types.get(node.map ? 'array' : node.attempt ? 'object' : target.output)(result), `Invalid primitive result at ${node.id}`);
        result = immutableCopy(result);
        if (key !== null && this.cacheSize > 0) {
          this.#cache.set(key, result);
          if (this.#cache.size > this.cacheSize) this.#cache.delete(this.#cache.keys().next().value);
        }
      }
      values.set(node.id, result); trace.push({ circuit: id, node: node.id, operation: node.op ?? callee, mode: node.iterate ? 'iterate' : node.map ? 'map' : node.fold ? 'fold' : node.choose ? 'choose' : node.attempt ? 'attempt' : 'call', cached: hit });
    }
    return values.get(compiled.program.output.ref);
  }
  clearCache() { this.#cache.clear(); }
}
