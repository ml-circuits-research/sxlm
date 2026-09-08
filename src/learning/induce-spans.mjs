import { readFileSync } from 'node:fs';
import { check, copy, executionDigest } from '../kernel/data.mjs';
import { CircuitRuntime } from '../kernel/circuit.mjs';
import { compileModule } from './sop-output.mjs';
import { compileGrammarKnowledge } from './grammar.mjs';
import { alignConstructionSpans } from './construction-spans.mjs';
import { inferStructuralProgram, structuralModule } from './structural-program.mjs';

const algorithm = 'typed-span-composition-v1';
const learnerHash = executionDigest(['induce-spans.mjs', 'construction-spans.mjs', 'structural-program.mjs']
  .map(path => ({ path, source: readFileSync(new URL(path, import.meta.url), 'utf8') })));

export function induceSpanConstruction(model, specification) {
  const { id, category, examples } = specification;
  const alignment = alignConstructionSpans(model, specification);
  const { program } = inferStructuralProgram(alignment.slots.filter(slot => slot.semantic !== false),
    examples.map(example => example.meaning));
  const action = id + '.compose';
  const learning = { schema: 'sxlm.derivation.v1', kind: 'supervised-structural-induction', algorithm,
    learnerHash, parentModel: model.resources.hash, runtime: model.resources.runtime.hash,
    specificationHash: executionDigest(specification), trainingCount: examples.length,
    tokenPolicy: model.runtime.programs.get(model.resources.entrypoints.tokenize).hash,
    hypothesisClass: 'Teacher-supplied typed spans, inferred common delimiters, nested field projections, constants, records and sequence concatenation. Explicit semantic:false slots contribute syntax only and cannot supply semantic projections. Sequence fields take priority over reconstructing observed elements. No unique or universal solution is claimed.' };
  const module = structuralModule(action, program, learning);
  const vm = new CircuitRuntime({ identity: model.runtime.identity, cacheSize: 0 });
  for (const [name, validate] of model.runtime.types) if (!vm.types.has(name)) vm.type(name, validate);
  for (const [name, primitive] of model.runtime.primitives) vm.primitive(name, primitive);
  vm.compile(compileModule(module));
  for (const [index, children] of alignment.rows.entries()) {
    check(executionDigest(vm.execute(action, { children, scope: '' }, { cache: false })) ===
      executionDigest(examples[index].meaning), 'Generated SOP failed semantic training replay');
  }
  const grammarProposal = { productions: [{ id: id + '.production', lhs: category, rhs: alignment.rhs, action }],
    lexicon: [], classes: {} };
  const grammar = compileGrammarKnowledge(grammarProposal, { id: 'memory.' + id + '.grammar', origin: learning });
  return { schema: 'sxlm.pack.v1', id, version: '1.0.0', provenance: { ...learning, examples: examples.length },
    dependencies: model.resources.manifests.map(({ id, hash }) => ({ id, hash })),
    sop: [module, ...grammar.sop], providers: grammar.providers,
    training: { schema: 'sxlm.training.v1', algorithm, specification: copy(specification), grammarProposal } };
}
