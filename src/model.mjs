import { CircuitRuntime } from './kernel/circuit.mjs';
import { installTermPrimitives } from './kernel/terms.mjs';
import { installCollectionPrimitives } from './kernel/collections.mjs';
import { installValuePrimitives } from './kernel/values.mjs';
import { Budget, LimitError, copy, check, deepFreeze } from './kernel/data.mjs';
import { Grammar } from './language/grammar.mjs';
import { installFormalPrimitives } from './semantics/primitives.mjs';
import { verifyCertificate } from './semantics/verify.mjs';
import { verifyPlan } from './semantics/verify-plan.mjs';
import { bootstrapURL, combinePacks, readPack } from './learning/packs.mjs';
import { runtimeIdentity, assertRuntimeUnchanged, modelIdentity } from './runtime-identity.mjs';

export class SymbolicModel {
  #initial;
  constructor({ packs = [readPack(bootstrapURL)], cacheSize = 256, limits = {} } = {}) {
    assertRuntimeUnchanged();
    this.packs = deepFreeze(copy(packs));
    const combined = combinePacks(this.packs);
    this.resources = { ...combined, knowledgeHash: combined.hash, runtime: runtimeIdentity, hash: modelIdentity(combined.hash) };
    this.limits = deepFreeze(copy(limits));
    this.runtime = installValuePrimitives(installCollectionPrimitives(installFormalPrimitives(installTermPrimitives(new CircuitRuntime({ cacheSize, identity: runtimeIdentity.hash })))));
    let pending = [...this.resources.circuits];
    const compileAvailable = () => {
      let changed = true;
      while (changed) {
        changed = false;
        pending = pending.filter(circuit => {
          if (!this.runtime.dependenciesReady(circuit)) return true;
          this.runtime.compile(circuit); changed = true; return false;
        });
      }
    };
    compileAvailable();
    const installationBudget = new Budget();
    const grammar=this.runtime.execute(this.resources.entrypoints.grammar,{with:{}},{budget:installationBudget});
    this.resources=deepFreeze({...this.resources,grammar});
    this.grammar = new Grammar(this.resources.grammar, this.runtime, {policy:{prepare:this.resources.entrypoints.lexical,tokenize:this.resources.entrypoints.tokenize,terminal:this.resources.entrypoints.terminal},budget:installationBudget});
    const version = this.resources.hash;
    this.runtime.primitive('kernel.chart.parse', { inputs: { text:'string', scope:'string', start:'string', maxAlternatives:'number' }, output:'object', version, run: (args,{budget,cache,trace}) => this.grammar.parse(args.text,{...args,budget,cache,trace}) });
    compileAvailable(); check(pending.length === 0, `Unresolvable circuit dependencies: ${pending.map(c => c.id).join(', ')}`);
    for (const task of ['reason','summarize','complete','plan','lexical','tokenize','terminal','failure','initial','lower','document','grammar','theory','text']) check(this.runtime.programs.has(this.resources.entrypoints[task]), `Missing task entrypoint: ${task}`);
    this.#initial = deepFreeze(this.runtime.execute(this.resources.entrypoints.initial,{value:{}},{budget:installationBudget}));
    this.installation = deepFreeze({ circuitExecution:installationBudget.report() });
    this.runtime.seal(); Object.freeze(this);
  }
  createSession(snapshot) { return new Session(this, snapshot); }
  ask(text, options = {}) { return this.createSession().ask(text, options); }
  summarize(text, options = {}) {
    const budget = new Budget({ ...this.limits, ...options.limits });
    const result = this.runtime.execute(this.resources.entrypoints.summarize, { text, options }, { budget }); return { ...result, metrics: budget.report(), model: this.resources.hash };
  }
  complete(prefix, options = {}) {
    const budget = new Budget({ ...this.limits, ...options.limits });
    const result = this.runtime.execute(this.resources.entrypoints.complete, { prefix, options }, { budget });
    return { ...result, metrics: budget.report(), model: this.resources.hash };
  }
  plan(problem, options = {}) {
    const { budget = new Budget({ ...this.limits, ...options.limits }), cache = true, ...parameters } = options, trace = [];
    const result = this.runtime.execute(this.resources.entrypoints.plan, { problem, options: parameters }, { budget, cache, trace });
    const verification = result.status === 'solved' ? verifyPlan(problem, result, { budget }) : null;
    check(verification === null || verification.valid, 'Plan witness verification failed');
    return { ...result, verification, metrics: budget.report(), trace, model: this.resources.hash };
  }
  initialState() {
    return copy(this.#initial);
  }
}
export class Session {
  constructor(model, snapshot) {
    this.model = model;
    if (snapshot) {
      check(snapshot.schema === 'sxlm.session.v1' && snapshot.model === model.resources.hash, 'Session snapshot belongs to a different model');
      check(snapshot.state.schema === 'sxlm.world.v1', 'Invalid session state'); this.state = deepFreeze(copy(snapshot.state));
    } else this.state = deepFreeze(model.initialState());
  }
  ask(text, { cache = true, limits = {} } = {}) {
    const budget = new Budget({ ...this.model.limits, ...limits }), trace = [];
    try {
      const result = this.model.runtime.execute(this.model.resources.entrypoints.reason, { text, revision: this.state.revision, state: this.state }, { budget, cache, trace });
      for (const answer of result.answers) {
        delete answer.verification;
        if (['truth','select'].includes(answer.kind)) check(answer.certificate, 'A logical answer requires a formal certificate');
        if (answer.certificate) {
          answer.verification = verifyCertificate(answer.certificate, result.state, { budget });
          check(answer.verification.valid, 'Formal certificate verification failed; request not committed');
        }
      }
      this.state = deepFreeze(result.state);
      return { ...result.answers.at(-1), text: result.text, answers: result.answers, document: result.document, sources: [...new Map([...result.state.sources, result.document.source].map(s => [s.id, s])).values()], revision: this.state.revision, committed: result.committedChanges, metrics: budget.report(), trace, model: this.model.resources.hash };
    } catch (error) {
      if (!(error instanceof LimitError)) throw error;
      const failure = { kind: 'failure', status: 'budget-exceeded', resource: error.resource, revision: this.state.revision, committed: false, metrics: budget.report() };
      // Failure wording uses a separate bounded housekeeping budget; it cannot commit state.
      const text = this.model.runtime.execute(this.model.resources.entrypoints.failure, { value: failure }, { budget: new Budget({ nodes: 30, steps: 2000, milliseconds: 1000 }) });
      return { ...failure, text, trace };
    }
  }
  snapshot() { return { schema: 'sxlm.session.v1', model: this.model.resources.hash, state: copy(this.state) }; }
  reset() { this.state = deepFreeze(this.model.initialState()); }
}
