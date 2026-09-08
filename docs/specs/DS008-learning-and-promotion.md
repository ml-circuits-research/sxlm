---
title: DS008-learning-and-promotion
summary: Defines offline teaching, typed synthesis, construction and sequence learning, evaluator gates and activation requirements.
---

## Introduction

Learning lets a coding agent propose reusable behavior without editing the inference host. The evaluator must determine whether the proposal improves the actual installed model before activation. A candidate artifact is data, not permission to execute agent-written JavaScript.

## Core Content

### Teaching and hypothesis classes

`train prepare` must create an empty-directory packet containing `AGENT-TASK.md`, `specification.sop` and `parent-model.sop`. The packet must identify the parent model, native contracts, [circuit](../wiki.html#definition-circuit) contracts and available [grammar](../wiki.html#definition-grammar) categories. It must not bundle [promotion](../wiki.html#definition-promotion) gate texts. Public repository examples and gates share project authorship; file separation must not be described as evaluator secrecy.

[Construction induction](../wiki.html#definition-construction-induction) must anti-unify annotated examples, identify varying surface slots, parse them under teacher-supplied categories and align changing semantic leaves. Identical examples, ambiguous alignment, unexplained variation and incompatible semantic shapes must be refused. The result must be a reusable category production and semantic [circuit](../wiki.html#definition-circuit), with a derivation. The hypothesis class is aligned, supervised constructions, not arbitrary [grammar](../wiki.html#definition-grammar) discovery from raw text.

[Program synthesis](../wiki.html#definition-program-synthesis) must search bounded straight-line compositions of teacher-supplied pure operations and installed [circuits](../wiki.html#definition-circuit). Types, constants, library choice and demonstrations are supervision. Observational pruning may retain one representative for an observed output vector and type; this makes search incomplete over possible programs. A bound exhaustion must not imply impossibility. A constant-output hypothesis must be labeled memory. Generated [SOP](../wiki.html#definition-sop) must be recompiled and replayed against training inputs.

[Sequence learning](../wiki.html#definition-sequence-learning) must consume source text offline and emit [SOP](../wiki.html#definition-sop) for observed frequencies, source memory and supplied [context](../wiki.html#definition-context) bounds. Expression, dispatch and affine learners must retain their separate annotations and transformation provenance. Compiler output must not relabel authored semantic adapters or task strategies as induced.

Finite-function observation compilation must accept repeated identical observations for a key and reject conflicting values. Equality must preserve execution-observable distinctions, including record order and signed zero. Repeated evidence must not become a conflict merely because one operand was encoded differently by the compiler.

### Text policy and training identity

[Sequence learning](../wiki.html#definition-sequence-learning) must execute an explicit captured [text policy](../wiki.html#definition-text-policy) containing the tokenizer, segmentation entrypoint and exactly their transitive [SOP](../wiki.html#definition-sop) dependencies. `createTextProcessor` must reject missing dependencies, cycles, extra modules and incompatible or impure entrypoints. It must compile the family into a sealed offline [VM](../wiki.html#definition-vm) using ordinary execution [budgets](../wiki.html#definition-budget). It must not use a native tokenizer or segmenter as an implicit fallback. Input-size acceptance must not imply that every input fits the execution [budget](../wiki.html#definition-budget).

`learnSequencePack` must retain the captured family under `training.specification.textPolicy`. The family uses schema `sxlm.text-policy.v1`, named entrypoints and quoted [SOP](../wiki.html#definition-sop) modules in dependency order. These sources are inert evidence; only separately installed model modules execute at inference. The emitted frequency, source-memory and parameter-memory derivations must bind the compiled policy identity, including native runtime and nested dependencies.

`train sequence` must capture the active model's policy. A library caller extending a custom model should supply `textPolicy: textPolicyForModel(model)` and `parentModel: model.resources.hash`. Omitting the policy selects the shipped [bootstrap](../wiki.html#definition-bootstrap) policy. Audit credit must require exact generated content, [provider](../wiki.html#definition-provider) wiring and agreement with the deployed policy. Matching frequencies alone must not certify a derivation produced under different text semantics.

[Construction induction](../wiki.html#definition-construction-induction) must align examples using `model.grammar.tokenize`, including its span checks, and record the compiled tokenizer identity. Changed [SOP](../wiki.html#definition-sop) normalization or ignored-surface policy must affect learning without a native source change. These requirements establish consistency for declared programs; they do not make the authored surrounding [text policy](../wiki.html#definition-text-policy) learned or establish broad language understanding.

### Candidate boundaries

A candidate must satisfy the `sxlm.pack.v1` structural contract and explicit dependency hashes. It may add modules and [providers](../wiki.html#definition-provider) but must not redefine an installed [circuit](../wiki.html#definition-circuit) ID, replace an existing task entrypoint or install active raw [grammar](../wiki.html#definition-grammar), theory, text or corpus fields. A semantic or [grammar](../wiki.html#definition-grammar) proposal must compile into the full [SOP](../wiki.html#definition-sop) family before installation.

An agent may propose ordinary host development when a missing operation is genuinely general. That work must follow DS000 and DS001 and must not pass through data-[pack](../wiki.html#definition-pack) [promotion](../wiki.html#definition-promotion). A new phrase or held-out answer is not a reason to enlarge the native kernel.

### Evaluator-owned validation

`train validate` and [promotion](../wiki.html#definition-promotion) must require nonempty separately supplied gates. Validation must construct the actual candidate model, evaluate before and after results, require every gate to pass, require an actual improvement and reject newly introduced failures among prior passing regressions. Exact gate-text or formal-input inclusion in a candidate must be rejected. This leakage check catches literal overlap; it is not a proof against overfitting.

The teacher must not edit evaluator cases to improve the candidate's score. New capability claims require structural transfer, wrong-binding or wrong-scope counterexamples and [ablation](../wiki.html#definition-ablation)/restoration. Training fit alone must not count as generalization. A candidate consistent with weak supervision may still be rejected by transfer gates.

### Promotion and rollback

`train promote` must load the registry's actual parent and rerun validation while holding the registry writer lock. A declared `provenance.parentModel` must match that parent. A saved [receipt](../wiki.html#definition-receipt) must not function as a bearer authorization to bypass revalidation. Content-addressed candidate files, a validation [receipt](../wiki.html#definition-receipt) and prior lineage state must be retained before atomic activation.

`train rollback` must use the same writer lock and restore the previous active lineage, or the [bootstrap](../wiki.html#definition-bootstrap) when no earlier extension exists. Incompatible source or model identities require explicit revalidation. Registry and snapshot contracts are in DS009.

Browser construction learning must validate a proposal against the active process model. `/api/activate` must reject missing or stale proposals, install the validated candidate and clear incompatible [sessions](../wiki.html#definition-session) and proposals. Browser activation is process-local; it must not be described as a durable CLI registry [promotion](../wiki.html#definition-promotion). Supplied browser gates are a demonstration interface, not an independently curated benchmark.

### Reproduction and evidence

`npm run check:learning` must reproduce installed content and exact derivation evidence. `npm run build:model` must rebuild the [bootstrap](../wiki.html#definition-bootstrap) through the shared ordered list of eleven stages. Lexical synthesis must precede sequence memory; the build must preserve [linkage](../wiki.html#definition-linkage) order. `npm run test:rebuild` must execute that same list in an isolated copy. Missing [receipts](../wiki.html#definition-receipt), altered deployed modules and disconnected [providers](../wiki.html#definition-provider) must invalidate the corresponding claims. The audit must count compiler fragments separately from learned skills and preserve the origin shared by migration annotations and historical authored policies.

Evidence includes `test/workflow.test.mjs`, `test/learned-programs.test.mjs`, `test/program-learning.test.mjs`, `test/completion.test.mjs`, `test/lexical.test.mjs` and the evaluator-owned suites. The demonstrated construction improves from 0/5 to 5/5 transfer cases; procedure and normalization experiments have separate evidence boundaries under DS011.

<!-- chapter:training -->
### Training with coding agents

#### Artifact contract

A coding agent is an offline model author. It produces a `sxlm.pack.v1` [SOP](../wiki.html#definition-sop) artifact, not code executed inside the runtime. A [pack](../wiki.html#definition-pack) identifies its version, provenance, exact parent dependencies, semantic [circuits](../wiki.html#definition-circuit), [circuit](../wiki.html#definition-circuit)-compiled [grammar](../wiki.html#definition-grammar) additions and lexical mappings, [circuit](../wiki.html#definition-circuit)-compiled theories and/or learned [SOP](../wiki.html#definition-sop) memory. Raw corpus text is training input and is rejected as an active [pack](../wiki.html#definition-pack) field. Its content digest is part of the model identity.

An agent may propose normal source changes when a genuinely general primitive is missing. Such changes are software development and require kernel review and property tests; they are not automatically promoted by the data-[pack](../wiki.html#definition-pack) training path.

Incremental [packs](../wiki.html#definition-pack) cannot replace an existing task entrypoint or redefine an installed [circuit](../wiki.html#definition-circuit) ID. This prevents a candidate from replacing the evaluator-facing reasoning path to manufacture answer objects. New task entrypoints may be added; changes to an existing task pipeline require an explicit base-model revision and review. Verification metadata is always computed by the host, not trusted from a [pack](../wiki.html#definition-pack).

#### Learning paths

1. **[Construction induction](../wiki.html#definition-construction-induction).** `train induce` anti-unifies annotated examples. It identifies varying token columns, parses them as teacher-specified semantic categories, aligns changing semantic leaves with those slots, and emits a reusable category production plus a semantic [circuit](../wiki.html#definition-circuit). It rejects identical examples, ambiguous alignments, unbound surface variation, and incompatible semantic shapes.
2. **Agent-authored abstraction.** The agent can author larger [grammar](../wiki.html#definition-grammar) or [circuit](../wiki.html#definition-circuit) compositions using the same primitive contracts. This supports structures outside the automatic inducer's current token-alignment restriction. These are recorded as agent-authored candidates, not autonomous discoveries.
3. **[Sequence learning](../wiki.html#definition-sequence-learning).** `train sequence` / `learnSequencePack(texts, options)` consumes text offline and emits executable [SOP](../wiki.html#definition-sop) for observed frequencies, remembered [source spans](../wiki.html#definition-source-span) and the supplied [context](../wiki.html#definition-context) bound. Inference does not retrain or read a raw corpus field. The generated pages construct their values through general [circuit](../wiki.html#definition-circuit) operations; only relevant frequency pages execute. `trainSequence` is an alias for this [pack](../wiki.html#definition-pack)-producing API, replacing the old native-count-model API. This adds finite-[context](../wiki.html#definition-context) completion behavior, not semantic facts or general reasoning skills.

The inducer is intentionally conservative. It does not infer arbitrary grammars from raw text, invent a semantic ontology without supervision, or implement library compression across unrelated programs. Such claims need separate algorithms and evaluations.

The realization migration additionally uses two general learners in `src/learning/programs.mjs`: expression alignment induces variable output slots from annotated strings, and categorical decision-tree induction learns dispatch conditions from supplied feature records. `npm run learn:realization` rebuilds those [circuits](../wiki.html#definition-circuit); `npm run check:learning` verifies exact reproduction. Migration annotations preserve the prior renderer and are not independent external evidence. Fixed output memory, slot induction and the five still-authored semantic adapters are explicitly distinguished. See `docs/specs/DS000-vision.md` for the remaining requirement that all deployed competence have a learning derivation.

The older expression/dispatch learners retain transient compiler graphs as `result.circuits`; `result.circuit` names the root. Convert the complete family with `modulesFromGraphs(result.circuits)` and install it under `pack.sop`. Raw graph installation is rejected. Construction, sequence and program [pack](../wiki.html#definition-pack) learners already emit [SOP](../wiki.html#definition-sop) modules. The expression compiler runs offline only, and active [packs](../wiki.html#definition-pack) cannot install a `data.template` node. [The lowering contract](DS002-sop-runtime.md) explains representation, identity and reproduction. `npm run test:rebuild` verifies the complete eleven-stage build in an isolated checkout; a provenance label without exact executable reproduction does not pass.

`npm run build:planning` installs authored [SOP](../wiki.html#definition-sop) search policies and synthesizes the reusable set-[coverage method](../wiki.html#definition-coverage-method) from `training/set-coverage.sop`. The [bootstrap](../wiki.html#definition-bootstrap)'s `training.components.setCoverage` holds that primitive-library derivation separately from sequence training. The audit reproduces both, checks installed content, and credits only the induced method as learned. The [planning contract](DS007-formal-planning.md) states the independent replay, transfer, [ablation](../wiki.html#definition-ablation) and optimization checks.

#### Rebuilding the base model

`npm run build:model` executes the eleven source stages in their declared order. The same stage list drives `test:rebuild`, which rebuilds an isolated copy and checks exact artifact identity. Lexical synthesis must precede [sequence learning](../wiki.html#definition-sequence-learning) because the captured normalization program and runtime enter the sequence derivation. The pipeline also preserves [provider](../wiki.html#definition-provider)-[linkage](../wiki.html#definition-linkage) order. Running isolated builders in an arbitrary order can change the [pack](../wiki.html#definition-pack) identity even when local task examples still pass.

Stop model processes before changing native source. Rebuild the base model, run the verification suite, and restart with the resulting artifact. The build command rewrites the [bootstrap](../wiki.html#definition-bootstrap) [pack](../wiki.html#definition-pack); candidate [promotion](../wiki.html#definition-promotion) remains the separate evidence-governed workflow below.

#### Reproducible loop

```sh
node bin/sxlm.mjs train prepare examples/learn-construction.sop --out scratch/sxlm-teacher
# A coding agent reads scratch/sxlm-teacher/AGENT-TASK.md.

node bin/sxlm.mjs train induce examples/learn-construction.sop --out scratch/candidate.sop
node bin/sxlm.mjs train validate scratch/candidate.sop --gates examples/learning-gates.sop --out scratch/receipt.sop
node bin/sxlm.mjs train promote scratch/candidate.sop --gates examples/learning-gates.sop
node bin/sxlm.mjs train rollback
```

Use `--registry /path/to/registry` to maintain separate model lineages. A prepared packet includes the teacher specification, primitive contracts, available [grammar](../wiki.html#definition-grammar) categories and parent hashes. It does not bundle [promotion](../wiki.html#definition-promotion) gate texts. The reference examples and gates are public repository fixtures, so this separation is workflow discipline, not a claim of evaluator secrecy.

Validation constructs a fresh candidate model, checks every independent gate, compares prior passing regression cases, requires an actual improvement, and rejects verbatim inclusion of gate questions in the artifact. This last check catches obvious leakage; it is not a proof that a candidate cannot overfit. Counterexamples and new structural splits remain essential.

[Promotion](../wiki.html#definition-promotion) reruns these checks against the registry parent. A candidate that declares `provenance.parentModel` must match that parent; a stale declaration is rejected rather than silently rebased. A saved [receipt](../wiki.html#definition-receipt) is not a bearer authorization token. Candidate files are copied under SHA-256 content addresses, the [receipt](../wiki.html#definition-receipt) is retained, and the active manifest is atomically replaced. Previously active manifests support rollback. Model-bound [session](../wiki.html#definition-session) snapshots cannot silently cross a model revision.

A registry writer lock serializes [promotion](../wiki.html#definition-promotion) and rollback across coding-agent processes. After a crashed writer, inspect the recorded PID in `write.lock` before removing a stale lock. Normal successful or rejected promotions release it automatically.

#### Example: learn a construction, not two answers

Teacher examples:

```text
is certified as a pilot → pilot(?subject)
is certified as a medic → medic(?subject)
```

The inferred production is structurally equivalent to:

```text
VP → "is" "certified" "as" "a" N
meaning → atom(predicate = N.meaning, terms = [?subject])
```

The noun category is supplied by the teacher; its semantic value is learned as the variable part of the result. `pilot` and `medic` are not baked into the resulting [circuit](../wiki.html#definition-circuit). The category composes with ordinary noun phrases, quantified rules, relative restrictions and belief attribution.

The gates ask about a `navigator`, use the construction in several structural positions, and include a wrong-subject counterexample. A successful model must improve from zero to five passing gates while preserving the base regression cases. Replaying the two teaching phrases alone is insufficient.

#### Suggested agent task

> Extend a reusable category or operation composition for the given failure family. Identify the smallest abstraction that explains all training examples. Include semantic assumptions and counterexamples. Keep lexical and grammatical knowledge in [packs](../wiki.html#definition-pack). Do not modify the kernel for specific words or questions. Do not edit evaluation gates. Submit one candidate with accurate provenance and a rationale describing which new compositions it should support.

#### Choosing the next training batch

Prefer construction families with reuse across domains: event argument roles, anaphoric reference with explicit ambiguity, passive/active equivalence, temporal state updates, and quantified queries. For each family, vary entity names separately from structure. Reserve new compositions, predicates, contexts and counterexamples for the evaluator. Log parse [coverage](../wiki.html#definition-coverage), semantic correctness, formal [certificate](../wiki.html#definition-certificate) validity, regressions, artifact size and inference cost independently.

A high answer rate caused by silently discarding unsupported clauses is a regression, even if the final answer happens to match a fixture.

The generic affine learner in `src/learning/affine.mjs` emits [SOP](../wiki.html#definition-sop) from numeric supervision. It requires a full-rank feature matrix and rejects observations outside its hypothesis class. The installed summary scorer reproduces `training/summary-scores.sop`; new numeric bindings and focused source selection are tested separately. The annotations share the historical implementation origin, and the other 13 summary policy modules remain authored.

#### Binding text policy to learning

A coding agent must train with the [text policy](../wiki.html#definition-text-policy) of the model it intends to extend. `train sequence` captures the active parent's tokenization and segmentation programs. The library API accepts the same captured policy explicitly:

```js
const candidate = learnSequencePack(texts, {
  id: 'new-observations',
  parentModel: model.resources.hash,
  textPolicy: textPolicyForModel(model),
  boundaries: ['.', '?', '!']
});
```

Both functions are exported by `src/index.mjs`. Omitting `textPolicy` selects the shipped [bootstrap](../wiki.html#definition-bootstrap) policy, not the state of a custom model. `createTextProcessor` compiles exactly the captured transitive [SOP](../wiki.html#definition-sop) dependency closure into a sealed offline [VM](../wiki.html#definition-vm). Its tokenization and segmentation programs must be pure and satisfy their declared types. The processor uses ordinary execution [budgets](../wiki.html#definition-budget) and rejects missing, cyclic, extra or incompatible modules. Long training inputs can exhaust those execution [budgets](../wiki.html#definition-budget) even when they satisfy the input-size limit.

The sequence specification retains that closure as quoted [SOP](../wiki.html#definition-sop) modules in `training.specification.textPolicy`. These quotations are inert learning evidence. The installed frequency constructors carry the compiled policy identity, including the runtime and nested dependencies. The audit requires both exact memory reproduction and agreement with the deployed policy. Replaying the same counts under a different normalization program does not earn derivation credit. [Construction induction](../wiki.html#definition-construction-induction) similarly uses `model.grammar.tokenize` and records its compiled identity with the parent model.

The shared deployed roots are `lexical.tokenize` and `text.segment`. Native token boundaries and summary word [extraction](../wiki.html#definition-extraction) remain outside this policy-learning claim. The default [text policy](../wiki.html#definition-text-policy) contains authored segmentation and lexical programs plus an induced [normalization method](../wiki.html#definition-normalization-method); capturing it does not turn its authored parts into learned programs.

#### Offline sequence example

```sh
node bin/sxlm.mjs train sequence examples/learn-sequence.sop --out scratch/sequence-candidate.sop
node bin/sxlm.mjs train validate scratch/sequence-candidate.sop --gates examples/sequence-gates.sop
node bin/sxlm.mjs train promote scratch/sequence-candidate.sop --gates examples/sequence-gates.sop
node bin/sxlm.mjs complete "Opaque tessera" --max-tokens 4
node bin/sxlm.mjs train rollback
```

The new prefix was not in the source sentence. Its continuation demonstrates suffix-frequency reuse, not a new [grammar](../wiki.html#definition-grammar) or reasoning method. These public teaching and gate fixtures have a common author and are workflow demonstrations. Evaluator-owned production gates need separately sourced structural challenges.

The `training` field retains reconstruction evidence (`packId`, algorithm and specification). Runtime behavior comes from installed [circuits](../wiki.html#definition-circuit) and explicit [provider](../wiki.html#definition-provider) wiring; removing the evidence does not remove the learned behavior, but the architecture audit then refuses to certify its derivation. Removing [provider](../wiki.html#definition-provider) wiring loses the corresponding behavior. Each sequence [pack](../wiki.html#definition-pack) contributes three components: a frequency model, source observation memory and a supplied parameter. Compiler fragment count must not be reported as skill count.

#### Grammar proposals

An active [pack](../wiki.html#definition-pack) may no longer contain a `grammar` field. `compileGrammarKnowledge(fragment, {id, origin})` is an offline compiler that returns constructor [SOP](../wiki.html#definition-sop) and a `grammar-fragments` [provider](../wiki.html#definition-provider). It accepts the same production/[lexicon](../wiki.html#definition-lexicon)/class proposal structure as the prior [pack](../wiki.html#definition-pack) field. It does not induce that proposal and marks its output as compiled rather than learned. `induceConstruction` uses this compiler after anti-unifying the teaching examples; its `training.grammarProposal` is explanatory evidence, not the runtime [grammar](../wiki.html#definition-grammar).

`grammar.merge` composes the [circuit](../wiki.html#definition-circuit)-produced fragments and preserves collision rules: incremental extensions cannot replace the start category or segmentation, or redefine a lexical class incompatibly. A new lexeme can change behavior through its [provider](../wiki.html#definition-provider); removing that connection removes the extension's behavior. The [bootstrap](../wiki.html#definition-bootstrap) source is archived in `training/grammar-bootstrap.sop` with explicit authored provenance.

#### Theory and constant knowledge

Use `compileTheoryKnowledge(rules, {id, origin, sourceName})` offline to produce [SOP](../wiki.html#definition-sop) constructors and `theory-fragments` [providers](../wiki.html#definition-provider). Merge both `sop` and `providers` into a candidate [pack](../wiki.html#definition-pack). Rules must satisfy the existing signed relational contract; constructor proposals are also checked when the model installs them. `compileKnowledge(value, {id, origin})` creates ordinary constant-construction [circuits](../wiki.html#definition-circuit) for other supplied knowledge. Neither API claims induction.

Raw `theory` and `text` [pack](../wiki.html#definition-pack) fields are no longer accepted. Text configuration is provided by the declared `text` entrypoint, and the [bootstrap](../wiki.html#definition-bootstrap) tasks call that [circuit](../wiki.html#definition-circuit). Replacing an installed task/configuration requires an explicit new base model; incremental extensions cannot silently replace existing entrypoints or [circuit](../wiki.html#definition-circuit) IDs.

Use `validatePack(pack).hash` for executable [pack](../wiki.html#definition-pack) addresses. It preserves property order and signed zero, unlike the structural `digest` used for ordinary evidence. Model identity additionally binds the static runtime and Node component versions. A prepared teacher packet records that runtime identity. Prior registries and [session](../wiki.html#definition-session) snapshots cannot be silently reused after a host or identity-contract change.

#### Typed program synthesis

```sh
node bin/sxlm.mjs train program examples/learn-coverage.sop --out scratch/coverage.sop
node bin/sxlm.mjs train prepare examples/learn-coverage.sop --out scratch/method-teacher
```

`learnProgramPack(model, specification)` searches compositions of a teacher-supplied pure typed library. The specification supplies `inputs`, `output`, operation/[circuit](../wiki.html#definition-circuit) entries in `library`, optional bound arguments and constants, demonstrations, and explicit search bounds. It may reuse previously learned [circuits](../wiki.html#definition-circuit) without changing native code. It emits a [SOP](../wiki.html#definition-sop) [pack](../wiki.html#definition-pack) with parent dependencies and a reproducible synthesis [receipt](../wiki.html#definition-receipt). The search does not execute generated JavaScript.

The hypothesis class is bounded straight-line composition. Observational pruning retains one representative per type and training-output vector; this is incomplete over possible programs. A bound exhaustion is not impossibility. Constants, library selection and type contracts are supervision. A constant-output hypothesis is labeled memory.

`eval/program-cases.mjs` owns transfer cases for finite-set [coverage](../wiki.html#definition-coverage), separately from the eight teaching examples. A second synthesis experiment reuses that method. Insufficient supervision fits a wrong argument-role binding and fails those gates; additional teacher examples disambiguate the role while the evaluator cases stay unchanged. These are public, same-project demonstrations, not an external language benchmark.

Evaluator cases may use `task: 'circuit'`, a [circuit](../wiki.html#definition-circuit) ID, typed `input`, and `expect.value`. [Promotion](../wiki.html#definition-promotion) evaluates the actual installed [SOP](../wiki.html#definition-sop) through the [VM](../wiki.html#definition-vm). It requires independent gain and no regressions, checks exact teacher/gate overlap, binds the parent, and persists [SOP](../wiki.html#definition-sop) [receipts](../wiki.html#definition-receipt) with atomic activation.

`npm run build:lexical` installs 17 authored policies and reproduces the two-operation [normalization method](../wiki.html#definition-normalization-method) from `training/lexical-normalization.sop`. Its evidence is stored in `training.components.lexicalNormalization`; the Unicode library and eight annotations are teacher choices, and 16 transfer cases are kept outside that packet. Parsing [ablation](../wiki.html#definition-ablation)/restoration tests show actual reuse. Native token boundaries are not learned by this process.
<!-- /chapter:training -->
