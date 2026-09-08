---
title: DS000-vision
summary: Defines the symbolic-language objective, learning evidence, composition invariants and the binding completion rule.
---

## Introduction

[SXLM](../wiki.html#definition-sxlm) gives developers and coding agents an inspectable way to connect English input, symbolic reasoning and English output. Its architectural objective is a learned library of reusable [SOP](../wiki.html#definition-sop) [circuits](../wiki.html#definition-circuit) executed by a small, language-independent JavaScript kernel. The objective includes useful reasoning, summarization and completion. A collection of isolated question patterns cannot satisfy it.

## Core Content

### Computation and knowledge

Inference must compute an answer, interpretation, evidence, outcome and measured cost from a fixed execution semantics, a versioned [circuit](../wiki.html#definition-circuit) library, supplied observations and an explicit [budget](../wiki.html#definition-budget). Observations may become [session](../wiki.html#definition-session) facts under the declared interpretation contract. They must not silently become a promoted model update.

The [native closure](../wiki.html#definition-native-closure) must contain only explicit computational and mathematical mechanisms. Vocabulary, language constructions, task choices, scoring policy, domain rules and realization wording must be represented by [circuits](../wiki.html#definition-circuit). Moving a task-sized native function into another JavaScript directory does not change its privileged role. Native accelerators require an explicit domain-independent contract, equivalent reference behavior, differential evidence and a complete source inventory.

[SOP](../wiki.html#definition-sop) must be the sole persistent executable model language and the sole structured model interchange. In-memory arrays, records and typed compiler graphs are permitted as derived values. They must not introduce a second persistent policy representation. DS002 defines the executable and inert profiles.

### Learning and composition

Learning must select a [circuit](../wiki.html#definition-circuit) change using observations and disclosed supervision. An authored artifact, its compilation, memorized data and an induced procedure must retain different provenance. A source compiler cannot manufacture a learning derivation. A coding agent may synthesize hypotheses offline, but its code must not run inside a candidate [pack](../wiki.html#definition-pack).

The unit of growth must be a reusable construction, method or abstraction. A construction must compose in an existing semantic category. A method must accept declared semantic values. Composition must preserve argument roles, variable identity, explicit polarity, attributed [context](../wiki.html#definition-context), evidence and uncertainty. Renaming entities measures invariance within a structure; it does not establish a new compositional skill.

A learning claim must bind its teacher inputs, learner or synthesizer identity, parent dependencies, emitted [SOP](../wiki.html#definition-sop) and reproducible [receipt](../wiki.html#definition-receipt). [Promotion](../wiki.html#definition-promotion) must require transfer beyond teaching examples, counterexamples, improvement and preservation of prior passing behavior. [Ablation](../wiki.html#definition-ablation) and restoration must demonstrate that the learned component causes the claimed behavior. Same-author teaching and evaluation must be disclosed. DS008 governs activation; DS011 governs evidence.

### Binding invariants

The invariant identifiers K1–K3, C1–C4, L1–L4, S1–S5 and E1–E3 in [vision contract](DS000-vision.md) remain binding. They cover the complete [native closure](../wiki.html#definition-native-closure), [circuit](../wiki.html#definition-circuit)-only competence, typed composition, cache dependencies, immutable state, learning derivations, contextual semantics, honest evidence and independence. This specification formalizes their product obligations; it does not weaken the theory contract.

Formal validity, interpretation [coverage](../wiki.html#definition-coverage) and inference completeness must remain separate. A valid [certificate](../wiki.html#definition-certificate) establishes entailment from an interpretation. It does not establish that an ambiguous English sentence has been interpreted correctly. Unknown, explicit falsehood and conflicting support must remain different outcomes. Resource exhaustion must never become a negative logical conclusion.

### Completion boundary

Completion requires every active knowledge path to execute through [circuits](../wiki.html#definition-circuit), every learned component to have a reproduced derivation, the entire privileged runtime to satisfy the general-mechanism contract, preserved language tasks and evidence connecting each invariant to the delivered model. `npm run audit:vision` must return a failing result while any mandatory architectural requirement remains unmet. A passing capability suite must not override it.

The delivered [bootstrap](../wiki.html#definition-bootstrap) is an authored-and-induced model. Its audit inventories 851 modules, with 288 reproduced fragments and 563 without verified learning derivations. Fragment counts are representation counts, not skill counts. Native token boundaries, word [extraction](../wiki.html#definition-extraction) and chart scheduling are unreviewed policies. These facts exclude a claim that the complete architecture is learned or that the host is fully general. The language evaluation contains eight unsolved open challenges. No unrestricted pretrained-LLM capability is part of the demonstrated contract.

### Independence

[SXLM](../wiki.html#definition-sxlm) must run using repository-owned source and Node built-ins, without importing, copying, executing or linking sibling experiments. Installed agent tooling is outside the product runtime. Isolated execution must test real requests, demonstration learning and capability evaluation without sibling directories. Documentation assets may use a browser diagram renderer; that dependency must not enter inference or training.

<!-- chapter:index -->
### An inspectable symbolic language workbench

[SXLM](../wiki.html#definition-sxlm) lets developers run English reasoning tasks, shorten source documents and continue text while inspecting the representation and evidence behind each result. Coding agents work offline as teachers and program authors. They submit versioned [SOP](../wiki.html#definition-sop) [packs](../wiki.html#definition-pack) that the evaluator can test, activate and roll back.

The same [circuit](../wiki.html#definition-circuit) library connects language interpretation, formal reasoning, state updates and answer wording. The delivered English [grammar](../wiki.html#definition-grammar) is finite. Summaries copy selected [source spans](../wiki.html#definition-source-span), and completion uses supplied sources or learned finite-[context](../wiki.html#definition-context) observations. These contracts support a useful experimental workbench; they do not establish unrestricted LLM language understanding.

<!-- documentation-map -->

#### How the system fits together

A model installs typed [SOP](../wiki.html#definition-sop) programs, reconstructs its [grammar](../wiki.html#definition-grammar) and initial theory, and seals the resulting resources. A reasoning [session](../wiki.html#definition-session) interprets each statement, applies explicit semantic rules and checks logical [certificates](../wiki.html#definition-certificate) before committing state. It returns answer text alongside [coverage](../wiki.html#definition-coverage) gaps, source references and execution cost. Summary and completion have their own installed task entrypoints and [grounding](../wiki.html#definition-grounding) contracts.

Learning changes the [circuit](../wiki.html#definition-circuit) library. [Construction induction](../wiki.html#definition-construction-induction) extracts a reusable category from annotated examples; [program synthesis](../wiki.html#definition-program-synthesis) searches a teacher-supplied typed library; [sequence learning](../wiki.html#definition-sequence-learning) compiles observations into executable memory. Explicitly authored proposals remain useful, but compilation does not turn them into learned knowledge. [Promotion](../wiki.html#definition-promotion) evaluates the actual candidate model on separate gates and preserved regressions.

The architectural objective requires a small general host and learned competence represented entirely by [circuits](../wiki.html#definition-circuit). The audit exposes the delivered boundary: native text/chart policies remain unreviewed, and 563 of 851 installed modules lack reproduced learning derivations. The other 288 are compiler or learner fragments, not 288 independent skills. [The vision contract](../specsLoader.html?spec=DS000-vision.md) defines the completion rule.

#### Repository and runtime

`src/` contains the JavaScript implementation, `sop/` contains policy source, `packs/` contains installable model artifacts and `training/` contains observations and derivation evidence. `test/` checks implementation contracts, while `eval/` separates capability suites, structural transfer and open-language challenges. The historical comparison implementations in `test/reference/` are outside inference.

Node.js 22 or later runs the CLI and workbench with no npm runtime dependencies. The workbench binds to `127.0.0.1:3210`; requests have explicit node, inference and cooperative time [budgets](../wiki.html#definition-budget). The CLI registry defaults to `.sxlm`. Imported agent tooling has no role in model execution and is excluded from the standalone runtime copy. [SXLM](../wiki.html#definition-sxlm) does not distribute product skills or depend on sibling experiments.

[DS001-coding-style](../specsLoader.html?spec=DS001-coding-style.md) is the coding-style and test-organization authority. The specifications are normative. HTML pages explain their use and limits, and the Wiki is the single canonical terminology reference. Changes to behavior require both the affected DS and HTML explanation to stay aligned.

#### What the evidence establishes

The verified revision passes 211 implementation tests, 28 conformance cases, 12 composition cases, 60 renaming probes, 64 formal planning cases and 16 normalization transfers. A construction extension improves from zero to five transfer cases with no introduced regression. The eight open-language challenges remain unsolved. These public tests share project authorship and must not be interpreted as a blind external language benchmark.

The complete source-to-[pack](../wiki.html#definition-pack) build reproduces eleven stages. An isolated copy runs a request, learning demonstration and full evaluation. Browser checks cover the task views, validated activation, learned composition and desktop/mobile behavior. The [evaluation methodology](../evaluation.html) explains the scope of each result and why a passing acceptance gate does not override the architectural audit.
<!-- /chapter:index -->

<!-- chapter:next -->
### Architecture decisions and scaling

[SXLM](../wiki.html#definition-sxlm)'s useful foundation is a common executable [circuit](../wiki.html#definition-circuit) library connecting language, methods, evidence and realization. The adoption of [SOP](../wiki.html#definition-sop) preserves inspectable dependencies and a single typed execution semantics. Derived rule arrays and lexical indexes are legitimate values reconstructed by programs; an independently authored native dispatch table would be another knowledge authority. The distinction matters more than a filename or module count.

The strongest extension evidence is a reusable construction and reusable synthesized procedures with transfer, counterexamples and [ablation](../wiki.html#definition-ablation). Scaling whole-sentence templates would not extend those results into general composition. [DS000](../specsLoader.html?spec=DS000-vision.md) requires knowledge changes through learned [circuits](../wiki.html#definition-circuit) and a reviewed [native closure](../wiki.html#definition-native-closure); [DS011](../specsLoader.html?spec=DS011-evaluation-and-evidence.md) defines the measurements that support a capability claim.

#### Complete the semantic boundary before multiplying examples

Token boundaries, word [extraction](../wiki.html#definition-extraction) and chart scheduling are native policies under review. Their contracts need explicit policy inputs or equivalent [circuit](../wiki.html#definition-circuit) semantics, shared cost accounting and differential evidence. A new generic accelerator must prove its behavior against that contract, preserve [source spans](../wiki.html#definition-source-span) and identity, and count its complete implementation in the [native closure](../wiki.html#definition-native-closure). Moving another policy into [SOP](../wiki.html#definition-sop) may increase visible execution cost, as the lexical migration demonstrates.

Authored [grammar](../wiki.html#definition-grammar), theory and task programs need real derivations if the deployed model is to satisfy the learning objective. Compilation is useful for uniform execution but cannot supply those derivations. A teacher curriculum must disclose the supervision it supplies and reserve genuinely new structures for evaluation. The 563 modules without reproduced derivations are a concrete boundary, not a reason to lower the audit's requirement.

#### Use explicit event and reference semantics

The [atom](../wiki.html#definition-atom) and quantity contracts cover finite relations and ordered inventories. General event roles, intervals, tense and discourse reference require a coherent semantic representation. An extension should represent participants, time and attribution as reusable typed values, with shared projections into reasoning tasks. English constructions should map into that representation through [circuits](../wiki.html#definition-circuit).

Reference resolution must preserve a set of plausible referents and expose ambiguity when evidence cannot choose one. Selecting the entity that makes a desired answer provable would invalidate interpretation. A useful experiment compares active/passive and reference variants on independently annotated events, checks equivalent semantics when unambiguous and requires unresolved output for ambiguous cases. These obligations belong to the affected language and reasoning contracts before deployment.

#### Broaden learning through abstraction

Aligned [construction induction](../wiki.html#definition-construction-induction) and bounded straight-line synthesis have explicit, narrow hypothesis classes. Broader learning needs span alignment over semantic categories, composition over larger parse fragments and reusable abstractions factored across programs. Each accepted abstraction should record the programs it replaces, preserved semantics, reuse cases and cost or size benefit.

The decisive experiment combines a newly learned construction and a newly learned method on held-out tasks with a frozen host. It must preserve existing competence, fail under component [ablation](../wiki.html#definition-ablation) and recover under restoration. New entity names and training replay alone cannot establish that result. Coding agents should propose library programs, examples and assumptions through the same [SOP](../wiki.html#definition-sop) and [promotion](../wiki.html#definition-promotion) contract.

#### Keep methods and evidence separate

Finite signed reasoning and finite planning have different problem representations and witnesses. Additional constraint, temporal or disjunctive methods should expose explicit inputs, bounded outcomes and independent witness or countermodel checks. Their strategies should compose through [circuits](../wiki.html#definition-circuit). A new problem family must not create a phrase recognizer in the host.

Witness replay verifies a supplied result. It does not automatically establish optimality, unreachability or natural-language interpretation. Evaluation must name those separate claims. The planning experiment demonstrates this separation through authored [SOP](../wiki.html#definition-sop) search, a synthesized [coverage method](../wiki.html#definition-coverage-method) and an independent finite-state cost oracle.

#### Scale against useful coverage and measured cost

The lexical revision's 19-node proof takes about 88,000 execution nodes. This reflects explicit computation previously hidden in native calls. It is a warning to measure graph construction, hashing, caching and parser ambiguity before multiplying [grammar](../wiki.html#definition-grammar) size. Larger corpora also affect source scans, [provider](../wiki.html#definition-provider) limits and artifact size. No broad latency guarantee follows from short reference examples.

A scaling study should measure independent language [coverage](../wiki.html#definition-coverage), conditional answer correctness, unsupported clauses accepted as facts, witness validity, extension gain, regressions, artifact bytes and execution cost separately. Summary quality needs human-reviewed content selection; completion usefulness needs evaluation distinct from truth. Corpus growth can improve finite-[context](../wiki.html#definition-context) continuation, but there is no evidence that scaling this [bootstrap](../wiki.html#definition-bootstrap) alone produces a general LLM.

The architectural recommendation is to preserve one [SOP](../wiki.html#definition-sop) execution contract, improve reusable event/reference semantics and abstraction learning, and use independently curated evaluation to choose each extension. Native optimization is justified by equivalent semantics and measured cost. Model size is a consequence to measure, not a substitute for those contracts.
<!-- /chapter:next -->

<!-- theory-contract -->
### Theory, principles and invariants

### Objective

[SXLM](../wiki.html#definition-sxlm) is a symbolic language model whose persistent competence is a learned library of composable [circuits](../wiki.html#definition-circuit), executed by a small, language-independent JavaScript kernel. Coding agents are teachers and program synthesizers in an offline learning loop. At inference time, the system consumes natural language and produces natural language together with inspectable semantic state, evidence and execution records.

Moving an English regular expression into JSON does not establish this architecture. Wrapping a large task-specific JavaScript function in a [circuit](../wiki.html#definition-circuit) node does not establish it either. The architectural claim concerns the whole executed dependency graph, not the name of a directory or the extension of a file.

The completion requirements below are mandatory. Passing finite capability tests does not establish compliance with the complete architectural contract.

### Computational theory

Let **K** be the fixed execution semantics, **C** the versioned [circuit](../wiki.html#definition-circuit) library, **O** the observations supplied in the current interaction, and **B** an explicit resource [budget](../wiki.html#definition-budget). Inference is:

```text
execute_K(C, O, B) -> (answer, interpretation, evidence, status, cost)
```

K defines how to manipulate values and execute programs. C defines what the model knows and how it uses that knowledge. O supplies contingent observations; it must not be confused with established world truth or with a promoted model update. A [budget](../wiki.html#definition-budget)-limited computation may return a bounded/unknown status; it must not turn absence of a completed search into a negative answer.

K may contain fixed mathematical and computational mechanisms: value construction, exact arithmetic, structural matching, variable binding, bounded iteration, content addressing, deterministic execution and explicit failure. These are the machine's semantics. K must not contain vocabulary, domain predicates, prompt recognizers, preferred answers, task-selection rules, learned scoring constants or sentence-specific transformations. The criterion is semantic: changing a language, domain or learned strategy must change C, not K.

Specialized native accelerators are not an escape from this rule. A proposed accelerator needs a domain-independent contract and a [circuit](../wiki.html#definition-circuit)-level reference semantics or equivalent explicit specification with differential tests. Its entire privileged implementation counts toward the runtime audit. Task-sized primitives cannot be assumed to pass this test merely because their callers are declarative. The earlier native `language.realize`, `world.interpret`, `text.summarize` and `sequence.complete` operations have been removed. The earlier `language.parse` document policy has also been removed. A native chart parser still schedules recognition and semantic actions over a [grammar](../wiki.html#definition-grammar) reconstructed by [circuits](../wiki.html#definition-circuit); it remains an unverified accelerator. The finite signed relational mechanism has an explicit contract and exhaustive reference checks in `docs/specs/DS005-reasoning-and-state.md`.

Persistent model knowledge is executable [circuit](../wiki.html#definition-circuit) structure, including learned constants, branch conditions, lexical choices, relational rules and reusable program abstractions. Raw sources, examples, labels and evaluation [receipts](../wiki.html#definition-receipt) are evidence about learning; they are not an alternative active policy engine. A table may be an input to training. Installing that table as a parallel runtime dispatch mechanism is not the same as learning a [circuit](../wiki.html#definition-circuit).

### Theory of learning

Learning is a change to C selected by evidence. It may be induced by an algorithm or synthesized by a coding agent. It is not restricted to gradient descent, but it is also not a provenance string attached to a handwritten artifact.

```text
observations + teacher annotations + current library
    -> proposed programs
    -> structural checking and training fit
    -> independent transfer and counterexample evaluation
    -> accepted abstraction + provenance + reproducible receipt
    -> new circuit library
```

Teacher annotations can specify desired semantics, reference bindings, output expressions or task contracts. They are explicitly supplied supervision. The learner must not receive the evaluator's desired answers as an inference-time resource. Agent-generated examples and hypotheses must record their common origin; that relationship must not be presented as independent validation.

Different learning claims require different evidence:

| Claim | Required evidence |
| --- | --- |
| Remembered an observation | Source identity and an exact reproduction/matching contract |
| Learned a lexical choice | Supervised observations, [circuit](../wiki.html#definition-circuit) representation and missing-entry behavior |
| Learned an expression | Multiple annotated bindings, inferred variable slots and transfer to new bindings |
| Learned a construction | A reusable semantic category and tests in new surrounding constructions |
| Learned a reasoning method | A parameterized [circuit](../wiki.html#definition-circuit) and independently checked witnesses/counterexamples |
| Learned an abstraction | Reuse across distinct programs with measured cost/size benefit and preserved behavior |
| Improved the language model | Independent capability gain without hiding regressions or unsupported interpretation |

A fixed phrase learned for an output status is a lexical realization rule. It is not evidence that the system learned the reasoning behind that status. Renaming entities is an invariance test. It is not sufficient evidence for a new compositional skill. An authored [bootstrap](../wiki.html#definition-bootstrap) can help generate a curriculum, but remains authored until its deployed replacement has an actual learning derivation and validation evidence. That history must remain visible.

### Composition before coverage

The unit of growth is a reusable [circuit](../wiki.html#definition-circuit), not a solved example. A construction should bind into shared semantic structure; a reasoning method should consume and produce declared semantic values; realization should express those values without selecting a more convenient interpretation.

[Circuit](../wiki.html#definition-circuit) composition must preserve variable identity, argument roles, polarity, attribution, evidence and explicit uncertainty. These properties must survive nesting. The architecture must support new constructions and methods without adding another sentence/task branch to JavaScript.

The language boundary and the formal reasoning boundary are separate. A valid proof establishes entailment from an interpretation. It does not prove that an ambiguous or partially understood sentence was interpreted correctly. The result must expose both facts.

### Invariants

These invariants are binding implementation requirements. An audit must report missing evidence as missing; it must not turn a narrow passing test into a global guarantee.

| ID | Invariant | Evidence required |
| --- | --- | --- |
| K1 | No language/domain/task knowledge in executable host branches | Audit every registered primitive and its transitive implementation, including code outside `src/kernel` |
| K2 | A small, fixed and explicit kernel | Inventory of privileged operations, source bytes and dependency closure; review of each operation's general contract |
| K3 | Knowledge changes do not require kernel edits | Add a construction, lexical family and task policy using only learned [circuits](../wiki.html#definition-circuit); compare kernel content hashes |
| C1 | [Circuits](../wiki.html#definition-circuit) are the sole active representation of persistent competence | Trace active [grammar](../wiki.html#definition-grammar), lexical choices, theories, task policies, scoring and realization to [circuit](../wiki.html#definition-circuit) execution; reject parallel policy tables |
| C2 | Composition is structurally checked | Typed inputs/outputs, explicit dependencies, bounded control flow and rejection of undefined references |
| C3 | Cache identity includes all semantic dependencies | Cold/warm/disabled equivalence, specialization constants, branch choice, mapped values and nested-[circuit](../wiki.html#definition-circuit) content tests |
| C4 | Model and committed state cannot mutate under their identities | Immutable resources, copied snapshots, atomic commits and model-bound restoration tests |
| L1 | Every deployed learned component has a derivation | Content-bound training inputs, learner/synthesizer identity, parent model, generated [circuit](../wiki.html#definition-circuit) and reproducible [receipt](../wiki.html#definition-receipt) |
| L2 | Authored, compiled, memorized and induced artifacts are distinguishable | Provenance follows transformations; no relabeling of [bootstrap](../wiki.html#definition-bootstrap) tables as learning |
| L3 | [Promotion](../wiki.html#definition-promotion) depends on evidence outside training replay | Structural transfer, wrong-binding/scope counterexamples, regression checks and leakage audit |
| L4 | Learning can change reusable behavior | Ablate the learned component, observe lost capability, reinstall it, observe recovery on new compositions |
| S1 | Unknown, false and conflicting evidence remain different | Open-world, explicit-negative, contradiction and non-explosion tests; alternative-derivation preservation and rule-order invariance before claiming truth maintenance |
| S2 | [Context](../wiki.html#definition-context) and variable bindings survive composition | Attribution isolation, existential witness identity, role reversal and shared-variable counterexamples |
| S3 | Interpretation [coverage](../wiki.html#definition-coverage) and formal validity remain separate | Original spans, explicit parse gaps/ambiguity, evidence DAG replay and conditional answers |
| S4 | State answers use their actual dependencies and temporal position | Intermediate queries, transfers with unknown initial totals, invalid-event taint and rollback tests |
| S5 | Output realization does not invent support | Answer bindings come from the computed result; wording is a [circuit](../wiki.html#definition-circuit)-level transformation; source/sequence completion has an explicit [grounding](../wiki.html#definition-grounding) contract |
| E1 | Broad failures remain visible | Separate conformance, structural transfer, lexical renaming and open-language challenges |
| E2 | The project is independent | Isolated execution without sibling directories, no external runtime imports or required network service |
| E3 | A green audit means the stated requirement was tested | Each invariant names its evidence and remaining gaps; no success by absence of a grep match |

### Small-kernel discipline

Kernel size is measured by its privileged dependency closure and complexity, not compressed line counts. Moving a solver into a differently named JavaScript directory does not reduce that kernel. Training tools, source data, an HTTP server and the workbench are outside inference semantics only when they cannot secretly select answers or interpret domain knowledge on the model's behalf.

General collection operations, structural term operations and explicit bounded control flow are preferable to task-sized native operations. Common [circuit](../wiki.html#definition-circuit) fragments should be shared. Native optimization follows a demonstrated equivalent semantics and measured need; it must preserve cache identity, proof contracts and observable failure behavior.

Kernel additions require a reason that applies across unrelated domains, a precise contract, adversarial/negative tests and a demonstration that the operation is a mechanism rather than a missing piece of model knowledge. An output opcode named after a benchmark, surface phrase or specific task family is a warning sign, not a new learned skill.

### Architectural decision after reviewing CircuitLM

The CircuitLM experiment changed the implementation direction. Its useful distinction is between a persistent [circuit](../wiki.html#definition-circuit) library and values reconstructed by executing that library. An array of rules or an index in memory is permissible as a derived value. A separately authored table interpreted by a native task engine is a parallel knowledge path. Changing a file extension proves neither generality nor learning.

[SXLM](../wiki.html#definition-sxlm) will converge on one typed [circuit](../wiki.html#definition-circuit) graph semantics with an English-only [SOP](../wiki.html#definition-sop) authoring surface. Records, sequence operations, mathematical operations, matching and bounded control are machine mechanisms. Parsing policy, inference strategy, scoring, realization and knowledge reconstruction are [circuit](../wiki.html#definition-circuit) programs. The retired nested JSON expression notation is now an offline migration/compiler input. Installed programs execute only through the typed graph [VM](../wiki.html#definition-vm); the model runtime cannot interpret expression objects. [SOP](../wiki.html#definition-sop) compilation must expose ordinary graph dependencies; it may not install another task interpreter or evaluate source strings as JavaScript.

The implementation remains independent: no runtime imports or vendored code from CircuitLM. We retain [SXLM](../wiki.html#definition-sxlm)'s content identity across dependencies, exact arithmetic, explicit contexts, atomic state changes and evidence-based [promotion](../wiki.html#definition-promotion). The review also showed why a term needs a set of derivations rather than one permanently selected parent chain, and why a quoted program's identity must include its callees. These are requirements for future persistent learning, not reasons to weaken current guarantees.

Authoring a [SOP](../wiki.html#definition-sop) program, compiling it and learning it are distinct events. Imported architectural ideas do not manufacture learning evidence. The next decisive capability test is learning a construction and a reusable method, combining them on a held-out task, and measuring that the host source hash did not change. Existing competence and its failure cases must survive the migration.

### Current completion ledger

This ledger starts from a direct worktree audit. Its entries must be updated with implementation evidence as migration proceeds. Module counts below describe the [bootstrap](../wiki.html#definition-bootstrap), not separately proposed method [packs](../wiki.html#definition-pack).

| Requirement | Current evidence | Status |
| --- | --- | --- |
| Small generic dataflow runtime | Typed DAGs, immutable values, content hashes, [budgets](../wiki.html#definition-budget) and kernel tests exist | Partial: the privileged runtime still includes task-sized JavaScript mechanisms |
| English-only knowledge outside host phrase rules | The earlier Romanian replacement code is absent | Necessary but insufficient for K1/C1 |
| Knowledge represented only in [circuits](../wiki.html#definition-circuit) | Semantic actions, lowering, state dynamics, task dispatch and answer realization execute as [circuits](../wiki.html#definition-circuit); summary and completion strategies execute in [SOP](../wiki.html#definition-sop); realization, raw-corpus and [grammar](../wiki.html#definition-grammar) side paths were removed; [grammar](../wiki.html#definition-grammar)/lexical resources, theory and text configuration are reconstructed by [circuits](../wiki.html#definition-circuit); initial-theory installation is [SOP](../wiki.html#definition-sop) | Incomplete: native token boundaries, summary word [extraction](../wiki.html#definition-extraction) and chart scheduling remain unverified; authored policies still need learning derivations |
| Everything deployed as learned competence | Construction anti-unification, 29 induced realization [circuits](../wiki.html#definition-circuit), five induced semantic dispatchers, one induced [SOP](../wiki.html#definition-sop) score, 81 sequence/memory compiler fragments and synthesized set-[coverage](../wiki.html#definition-coverage)/normalization methods have derivations | Incomplete: 563 modules, including [linkage](../wiki.html#definition-linkage), compiled authored [grammar](../wiki.html#definition-grammar)/theory/text and task policies, lack verified learning derivations; 288/851 reproduced fragments do not represent 288 learned skills |
| Language policy extensible through learning | One construction transfers into new contexts with unchanged kernel | Partial: does not establish that all existing competence is learned |
| Clear theory and invariants | This document defines mechanisms, knowledge, learning claims and proof obligations | Specified; each implementation invariant still needs evidence |
| Reasoning, summaries, completion and demo | Working baseline with local evaluations and browser tests | Preserve during migration; do not redefine the task as a smaller parser demo |
| Independent project | An isolated copy executes without sibling repositories | Verified by `scripts/check-independence.mjs` for the audited revision |

### Completion rule

The objective is complete only when the active model has no unexplained knowledge path outside [circuits](../wiki.html#definition-circuit), each learned component has a real derivation and appropriate validation, the entire privileged JavaScript runtime satisfies the general-mechanism boundary, the preserved language tasks remain testable, and the invariant audit connects every claim to current evidence. The present authored-[bootstrap](../wiki.html#definition-bootstrap) system does not satisfy that completion rule.

The next architectural changes must remove those contradictions, not merely add more examples that the current architecture can pass.

### Current executable audit

`npm run audit:vision` writes `reports/vision-audit.sop` and returns a nonzero exit status while these architectural requirements remain incomplete. It inventories registered native operations and the entire static import closure of the model runtime, checks active parallel knowledge resources, counts missing [circuit](../wiki.html#definition-circuit) derivations, checks complete offline expression lowering and reproduces the learned realization, semantic dispatch, numeric scoring and sequence/memory components. Sequence [receipts](../wiki.html#definition-receipt) must reproduce installed [circuit](../wiki.html#definition-circuit) content and [provider](../wiki.html#definition-provider) wiring; altered programs or missing evidence remain unverified. The native-operation classifications are explicit reviews in `docs/native-contracts.sop`, not automatic semantic proofs.

`npm run check:learning` reproduces the 29 expression/dispatch [circuits](../wiki.html#definition-circuit) from `training/realization.sop` and checks their installed content. Their annotations were generated during migration from the prior authored renderer; that shared origin is recorded. New-binding and role-order tests in `test/learned-programs.test.mjs` are separate from those annotations. Constant output memory is distinguished from slot induction. The five projection/composition adapters in `training/realization-adapters.sop` are explicitly marked as authored and still lack learning derivations.

The state interpreter and instruction lowering now execute 37 explicit policy [circuits](../wiki.html#definition-circuit) with five induced dispatchers. Their bodies remain authored proposals; differential event-history tests and independent conservation checks preserve the earlier semantics. The native summary has been replaced with 13 authored [SOP](../wiki.html#definition-sop) modules and one supervised affine scoring module. This narrows the native policy boundary without claiming that policy migration is itself learning.

Completion now executes 27 authored [SOP](../wiki.html#definition-sop) policy modules plus learned frequency/memory constructors. Offline sequence training emits 81 constructor/routing fragments for the [bootstrap](../wiki.html#definition-bootstrap) observations, reduced from 1,103 without new native primitives. Counts, source observations and the supplied [context](../wiki.html#definition-context) bound have distinct provenance. This is a finite-[context](../wiki.html#definition-context) model and source memory, not an induced general reasoning method. The compiler routes a lookup to a small constructor page; the record produced by that page is a disposable derived value, not a parallel stored semantic table. `test/completion.test.mjs` checks historical behavior, frequency addition, source offsets, [ablation](../wiki.html#definition-ablation), transfer to new prefixes, tampered [receipts](../wiki.html#definition-receipt) and the CLI [promotion](../wiki.html#definition-promotion) loop. `reports/sequence-representation.sop` records representation size and synthetic lookup cost; it does not measure general language understanding.

The native registry has 83 operations. The current source-file and byte inventory is recorded in `reports/vision-audit.sop`, including the [SOP](../wiki.html#definition-sop) compiler and data reader. This is an inventory, not approval of minimality. `kernel.chart.parse` still captures a [circuit](../wiki.html#definition-circuit)-produced [grammar](../wiki.html#definition-grammar) snapshot and binds its version to the complete model hash; this remains a privileged parsing mechanism requiring review. Model identity now incorporates the static host implementation and Node component versions, under the sealed profile described below. This does not certify the chart mechanism or arbitrary host modifications. Source-continuation matching also still scans all supplied source observations.

[Document interpretation](../wiki.html#definition-document-interpretation) and [grammar](../wiki.html#definition-grammar) merging now execute 19 authored [SOP](../wiki.html#definition-sop) policies. Forty constructor modules preserve the authored [bootstrap](../wiki.html#definition-bootstrap) [grammar](../wiki.html#definition-grammar); compilation has not converted it into learned competence. `test/document.test.mjs` compares document results with the historical policy, exercises ambiguity and invalid meanings, tests [grammar](../wiki.html#definition-grammar) extension/[ablation](../wiki.html#definition-ablation) and verifies protected [VM](../wiki.html#definition-vm)/[grammar](../wiki.html#definition-grammar) registries. The `attempt` graph form returns ordinary failures as values while propagating resource exhaustion; the document [circuits](../wiki.html#definition-circuit) decide how to report semantic gaps. Optional path access never reads inherited values; absent own fields use their explicit fallback. Unsafe record keys cannot be stored in label records, while the original source text remains intact.

The long-proof regression executes under the normal 100,000-node [budget](../wiki.html#definition-budget). Explicit [SOP](../wiki.html#definition-sop) constructors expose additional node costs. A separate cold run at 3,000 nodes must stop without committing. The expected [certificate](../wiki.html#definition-certificate) still contains 19 proof nodes.

The remaining native strategy migrations concern token boundaries, summary word [extraction](../wiki.html#definition-extraction) and chart scheduling. Terminal interpretation now executes in [SOP](../wiki.html#definition-sop). Finite planning now executes authored [SOP](../wiki.html#definition-sop) policies and a synthesized set-[coverage method](../wiki.html#definition-coverage-method), with a separate formal witness checker. The legacy expression interpreter has been removed from inference; its offline compiler emits [SOP](../wiki.html#definition-sop). Theory/text authority and cross-process source identity have the scoped evidence below. Complete learning derivations and independent competence checks remain necessary. Preserve the working reasoning, summarization, completion and demonstration environment throughout that migration.

### Executable identity and knowledge authority

`runtime-identity.mjs` captures the local static import closure at module loading, including the compiler, [VM](../wiki.html#definition-vm), model orchestration and native implementations. The runtime identity also includes Node component versions, platform and architecture. `modelIdentity` binds that identity and the ordered [pack](../wiki.html#definition-pack) manifests. Primitive-dependent [circuit](../wiki.html#definition-circuit) hashes include the runtime identity; the chart operation additionally binds the complete model, including its [grammar](../wiki.html#definition-grammar) and semantic actions.

This profile permits single-line static local `.mjs` imports and `node:` built-ins. Dynamic loading and symlinked dependencies are rejected by the profile checks. A source edit after loading causes subsequent model construction to require a process restart; cached modules cannot be relabeled using new on-disk bytes. This is a trusted-process deployment contract, not a JavaScript sandbox, general JavaScript dependency parser or attestation against hostile host monkey-patching. Raw `CircuitRuntime` users outside `SymbolicModel` must supply and maintain their own implementation identity; the default is explicitly unversioned.

Executable identities use `executionDigest`, which preserves record insertion order and signed zero. Ordered record enumeration and serialization can observe record order, so using unordered record equality for program, cache or reproduction identity is unsound. [Execution identity](../wiki.html#definition-execution-identity) uses domain-separated Merkle hashing (`sxlm.execution.v3`); hash and subtree-height memoization share only recursively frozen values owned by the data module. [Structural equality](../wiki.html#definition-structural-equality) and ordinary evidence hashing still use `canonical`/`digest`; `kernel.value.encode` now deliberately produces canonical [SOP](../wiki.html#definition-sop). The two contracts must not be confused. Tests cover cold/warm equivalence for order-sensitive expressions, reordered executable literals, signed zero and source changes that actually alter a native result.

Deduplicating intermediate interpretations must also preserve distinctions observable by subsequent [circuits](../wiki.html#definition-circuit). The chart now uses executable identity for semantic children and final alternatives. Structural record equality alone previously discarded a valid alternative before a later serialization [circuit](../wiki.html#definition-circuit) could consume it; a lexical-order and signed-zero regression preserves that counterexample. This is scoped evidence for C2/C3, not approval of the complete chart accelerator.

Installed models and runtime registries are sealed. `test/identity.test.mjs` verifies relocation to an isolated directory, fresh-process identity stability, changed native semantics, changed [circuit](../wiki.html#definition-circuit) identity, rejection of old [session](../wiki.html#definition-session) snapshots and refusal to relabel already loaded code. Existing registries and snapshots from older identity schemes are rejected; they require explicit revalidation, not silent migration.

`compileTheoryKnowledge` and `compileKnowledge` are offline constructors with explicit compiled provenance. The active [pack](../wiki.html#definition-pack) no longer accepts raw `theory` or `text` fields. Six authored [SOP](../wiki.html#definition-sop) policies install [circuit](../wiki.html#definition-circuit)-produced rules, validate their formal shape and generate source-backed declaration evidence. Ten theory constructors and two text constructors preserve the earlier authored knowledge; none is labeled induced. Summary and completion share the same text-configuration [circuit](../wiki.html#definition-circuit). Tests demonstrate theory [ablation](../wiki.html#definition-ablation)/reinstallation, transfer across bindings and supplied rule chains, rejection of invalid rule constructors and configuration changes without host edits.

The initial state is a frozen projection computed by the initial-state [circuit](../wiki.html#definition-circuit) once during model installation. [Sessions](../wiki.html#definition-session) receive copies. Installation [circuit](../wiki.html#definition-circuit) execution has a separate bounded [budget](../wiki.html#definition-budget) and is reported in `model.installation.circuitExecution`; it is not repeated as unreported work before every request. The current [bootstrap](../wiki.html#definition-bootstrap) executes 5667 installation nodes, including lexical index preparation. This is a construction-cost observation, not a language-quality metric.

The current library has 851 modules, of which 288 fragments have reproduced derivations and 563 do not. Offline lowering accounts for much of the growth: 131 root programs containing 188 legacy calls produce 603 graph modules. These are representation counts. The remaining native mechanisms, independent learning evidence and open-language failures still prevent declaring the complete objective achieved. Removing parallel knowledge paths is necessary progress, not proof that the authored [bootstrap](../wiki.html#definition-bootstrap) was learned.

### SOP as the sole model interchange

Executable [pack](../wiki.html#definition-pack) members are [SOP](../wiki.html#definition-sop) source modules. The [pack](../wiki.html#definition-pack) loader rejects a `circuits` field; there is no object-graph installation fallback. Typed compilation resolves all dependencies, rejects duplicate producers, undefined references and cycles, and the [VM](../wiki.html#definition-vm) checks every call contract. Compilation metadata cannot replace inputs, nodes or outputs. Static single assignment follows from these checks, not from the filename.

[Packs](../wiki.html#definition-pack), training observations, evaluation cases, [receipts](../wiki.html#definition-receipt), registry manifests, snapshots and structured HTTP/CLI results use [SOP](../wiki.html#definition-sop) constructor documents. Constructor documents have only records, sequences, scalar literals and references to immutable source quotations. The boundary reader cannot invoke a [circuit](../wiki.html#definition-circuit), install an operation, access a file, or run code. It checks all producers, including unused ones, and bounds source size, dependency depth and expanded values. Executable source quotations are compiled separately when a [pack](../wiki.html#definition-pack) is installed.

In-memory records and arrays remain values on wires. They are not serialized between adjacent nodes. The [VM](../wiki.html#definition-vm)'s transient typed graph is a compiler product, never a second persistent model language. Internal hash preimages are length-delimited identity material; they are not transported representations or model programs.

The offline typed program search selects a composition from teacher-supplied pure operations, constants and typed examples, emits [SOP](../wiki.html#definition-sop), recompiles it and replays its training outputs. Held-out gates must still reject underdetermined procedures; successful training fit alone is not learning evidence for general language understanding. Source and runtime identities, derivations and [promotion](../wiki.html#definition-promotion) checks follow the generated module.


### Planning migration and structured iteration

Finite planning now executes 17 authored [SOP](../wiki.html#definition-sop) modules and `learned.set.coverage`, a three-application procedure induced from eight typed examples. The native search operation and direct `model.plan` bypass are removed. The goal and precondition checks reuse the same learned procedure. The component's source, runtime, primitive library and teacher specification are reproducible through `build:planning`; removing its evidence or modifying its deployed module removes audit credit. The policy bodies remain authored. Generalized planning strategy induction is still outstanding.

The [VM](../wiki.html#definition-vm) now supports typed bounded `iterate` with a static body and boolean guard. Its enclosing graph remains [SSA](../wiki.html#definition-ssa) and acyclic; iteration produces successive immutable state values rather than mutable or backward wires. Seed and body satisfy the state contract even when zero iterations execute. The guard is checked before every transition; a true guard at the explicit bound raises resource exhaustion. Both target definitions and all control inputs participate in identity. An impure guard disables aggregate caching. Numeric, string and record-state tests establish reuse beyond planning; this is a machine mechanism, not an action-search opcode.

The formal witness checker replays supplied transitions and validates goals/cost without selecting actions. It does not prove optimality or unreachability. Independent finite-state Bellman-Ford checks cover 64 evaluator-owned systems; additional tests cover polarity, scope, precondition conjunctions, deletion, zero cycles, bounds and forged witnesses. Seventy-one [coverage](../wiki.html#definition-coverage) checks plus planner [ablation](../wiki.html#definition-ablation)/restoration demonstrate reuse of the induced procedure with an unchanged host. These tests have the same project author and do not establish blind generalization or natural-language planning interpretation. See `docs/specs/DS007-formal-planning.md`.

At the planning migration, the audited [native closure](../wiki.html#definition-native-closure) was 19 files and 91,284 bytes. Replacing a task strategy with explicit [SOP](../wiki.html#definition-sop) plus a general control form improves the semantic boundary, but did not reduce this byte inventory. The whole closure still lacks approval, and the native chart parser remains unresolved. Green planning tests do not change that completion status.


### Lexical policy migration and scoped learning

Seventeen [SOP](../wiki.html#definition-sop) policies now prepare the lexical index and interpret terminals. Literal/[lexicon](../wiki.html#definition-lexicon) normalization, category exclusion, case sensitivity and output preservation have explicit [circuit](../wiki.html#definition-circuit) dependencies. `Grammar` requires pure typed preparation, tokenization and terminal entrypoints; there is no native terminal fallback. Model installation charges lexical preparation, and parser callback traces now expose both lexical and semantic [circuit](../wiki.html#definition-circuit) work.

A two-operation normalization program is synthesized from eight Unicode observations and a teacher-chosen library. It is reused for literal spellings, lexical entries and parser token values. Sixteen held-out literal pairs plus parser [ablation](../wiki.html#definition-ablation)/restoration show scoped transfer with an unchanged host. Exact source and training-component replay are required for derivation credit. The surrounding policy is authored. These checks are public and have the same project author; they do not prove independent language discovery or token-boundary learning.

The native Unicode normalization/case operations take their modes explicitly. Restricted character membership is a general finite regular-language operation with full-string semantics and independently coded finite checks. Native token boundaries, the summary/completion token normalization path and Earley scheduling remain unapproved. In particular, the parser's [SOP](../wiki.html#definition-sop) tokenizer currently starts from the native token spans and replaces token values through the induced normalizer. That is a partial migration, not removal of the native tokenizer.

The 19-node proof with lexical and segmentation policy costs approximately 91,734 execution nodes with caching and 92,800 without. Its semantic result is unchanged. The default node [budget](../wiki.html#definition-budget) is 100,000 to preserve that existing capability after previously native work became explicit; strict caller limits still stop without committing. More complete traces also increase structured output size. These are disclosed costs, not capability improvements. See `docs/specs/DS004-language-interpretation.md` for source-span validation, callbacks, caching and tests.

The segmentation revision inventories 19 privileged source files and 92,421 bytes. The current exact inventory remains in `reports/vision-audit.sop`. The closure is still unapproved. Error traces are returned as diagnostics after failure wording is computed, so a large trace does not become an input to the small failure-realization [circuit](../wiki.html#definition-circuit). Full tests run sequentially to avoid manufacturing deadline failures through test-worker contention; model request deadlines remain enforced.

### Shared segmentation and learning policy

Segmentation policy executes through six authored [SOP](../wiki.html#definition-sop) modules in `sop/text/`. [Document interpretation](../wiki.html#definition-document-interpretation), summaries, completion and offline [sequence learning](../wiki.html#definition-sequence-learning) use `text.segment`. Native `kernel.text.segment` and the privileged import of `src/language/document.mjs` have been removed. The replacement host operation, `kernel.text.trimStart`, is a general leading-whitespace operation. The native inventory is 83 operations in 19 files and 92,421 bytes. Native token boundaries, summary word [extraction](../wiki.html#definition-extraction) and chart scheduling remain unverified.

Offline [sequence learning](../wiki.html#definition-sequence-learning) captures exactly the transitive [SOP](../wiki.html#definition-sop) dependency closure for its text entrypoints. Its specification stores quoted modules, and emitted derivations bind the compiled policy identity. Replay must match both generated memory and the actual installed policy; a normalization mismatch cannot retain audit credit. The CLI captures its active parent, while the library's omitted policy selects the shipped [bootstrap](../wiki.html#definition-bootstrap). [Construction induction](../wiki.html#definition-construction-induction) executes and validates the parent's token policy through `Grammar.tokenize` and records that program's identity.

The segmentation evidence includes 736 boundary/retention combinations against a frozen historical reference, Unicode offsets, empty spans, [budget](../wiki.html#definition-budget) failures and policy-change checks. A sequence trained under changed [SOP](../wiki.html#definition-sop) normalization uses different frequency keys; a construction trained with a [circuit](../wiki.html#definition-circuit)-defined ignored symbol preserves alignment. These checks establish consistent execution, not induction of the six segmentation modules. The library contains 851 installed modules: 288 reproduced learner/compiler fragments and 563 without verified learning derivations.
<!-- /theory-contract -->
