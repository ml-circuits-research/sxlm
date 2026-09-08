import { modulesFromGraphs } from './sop-output.mjs';
import { canonical, check, digest, Budget } from '../kernel/data.mjs';
import { compileGrammarKnowledge } from './grammar.mjs';
import { lowerPrograms } from './expressions.mjs';

/** Supervised structural anti-unification. Learns reusable category productions, not answer lookups. */
export function induceConstruction(model, specification) {
  const { id, category, examples, slotCategories = {} } = specification;
  check(/^[a-z][a-z0-9._-]+$/.test(id ?? ''), 'Invalid learned construction ID');
  check(model.grammar.productions.has(category), 'The target must be an existing compositional category');
  check(Array.isArray(examples) && examples.length >= 2 && examples.length <= 50, 'Induction needs 2–50 examples');
  const rows = examples.map(e => model.grammar.tokenize(e.text));
  check(rows.every(r => r.length === rows[0].length), 'This inducer requires token-aligned examples; author a grammar circuit for variable-width alignment');
  const varying = rows[0].map((_, index) => index).filter(i => new Set(rows.map(r => r[i].value)).size > 1);
  check(varying.length > 0, 'Identical surfaces do not identify a reusable abstraction');
  const slots = new Map();
  for (const column of varying) {
    const slotCategory = slotCategories[column];
    check(typeof slotCategory === 'string' && model.grammar.productions.has(slotCategory), `Specify the semantic category of varying token column ${column}`);
    const values = examples.map((_, i) => {
      const parsed = model.grammar.parse(rows[i][column].text, { start: slotCategory, budget: new Budget() });
      check(parsed.status === 'parsed', `Slot ${column} is not unambiguous in category ${slotCategory}`);
      return parsed.alternatives[0];
    });
    slots.set(column, { category: slotCategory, values });
  }
  const used = new Set();
  function generalize(values) {
    if (new Set(values.map(canonical)).size === 1) return { $literal: values[0] };
    const matching = [...slots.entries()].filter(([, slot]) => slot.values.every((v, i) => canonical(v) === canonical(values[i])));
    check(matching.length <= 1, 'Ambiguous surface-to-semantics alignment');
    if (matching.length === 1) { used.add(matching[0][0]); return { $get: ['children', matching[0][0]] }; }
    if (values.every(Array.isArray) && values.every(v => v.length === values[0].length)) return values[0].map((_, i) => generalize(values.map(v => v[i])));
    if (values.every(v => v && typeof v === 'object' && !Array.isArray(v))) {
      const keys = Object.keys(values[0]).sort();
      check(values.every(v => canonical(Object.keys(v).sort()) === canonical(keys)), 'Semantic shapes differ; no safe structural abstraction');
      return Object.fromEntries(keys.map(k => [k, generalize(values.map(v => v[k]))]));
    }
    throw new Error('A changing semantic value has no uniquely aligned surface slot');
  }
  const template = generalize(examples.map(e => e.meaning));
  check(varying.every(v => used.has(v)), 'A varying surface slot has no demonstrated semantic contribution');
  const action = `${id}.compose`;
  const grammarProposal={productions:[{id:`${id}.production`,lhs:category,rhs:rows[0].map((token,i)=>slots.has(i)?slots.get(i).category:{literal:token.value}),action}],lexicon:[],classes:{}};
  const knowledge=compileGrammarKnowledge(grammarProposal,{id:`memory.${id}.grammar`,origin:{kind:'supervised-structural-induction',examplesHash:digest(examples),parentModel:model.resources.hash}});
  return {
    schema: 'sxlm.pack.v1', id, version: '1.0.0',
    provenance: { kind: 'supervised-structural-induction', examples: examples.length, examplesHash: digest(examples), parentModel: model.resources.hash, tokenPolicy:model.runtime.programs.get(model.resources.entrypoints.tokenize).hash, algorithm: 'aligned-anti-unification-v1', limitations: ['token-aligned examples', 'fixed semantic shape', 'typed slots supplied by the teacher'] },
    dependencies: model.resources.manifests.map(({ id, hash }) => ({ id, hash })),
    sop: [...modulesFromGraphs(lowerPrograms([{ schema: 'sxlm.circuit.v1', id: action, inputs: { children: 'array', scope: 'string' }, nodes: [
      { id: 'env', op: 'data.wrap', args: { key: 'children', value: { ref: '$children' } } },
      { id: 'compose', op: 'data.template', args: { template, environment: { ref: 'env' }, scope: { ref: '$scope' } } },
    ], output: { ref: 'compose' } }])), ...knowledge.sop], providers:knowledge.providers,
    training:{schema:'sxlm.training.v1',algorithm:'aligned-anti-unification-v1',specification,grammarProposal},
  };
}
