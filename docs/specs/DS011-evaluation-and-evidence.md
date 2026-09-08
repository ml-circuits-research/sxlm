---
title: DS011-evaluation-and-evidence
summary: Defines separated capability measurements, reproducible audits, learning causality and honest failure reporting.
---

## Introduction

Evaluation must tell a developer what [SXLM](../wiki.html#definition-sxlm) can do, under which assumptions, and what remains unsupported. A green engineering suite must not be presented as general language-model success.

## Core Content

### Separate claims

Implementation tests must validate runtime, language, reasoning, learning and interface contracts. Capability evaluation must keep conformance, structural composition, renaming probes, formal planning, normalization transfer, construction transfer and open-language challenges separate. These categories must not be combined into a headline LLM accuracy score.

The reference measurements are 222 passing implementation tests, 28/28 conformance cases, 12/12 composition cases, 60/60 renaming probes, 64/64 finite planning cases and 16/16 normalization transfers. Construction transfer improves from 0/5 to 5/5 with no newly introduced regressions. The [bootstrap](../wiki.html#definition-bootstrap)-only open-language challenges remain 0/8; the optional construction profile scores 1/8 on the unchanged set. These numbers describe the verified [bootstrap](../wiki.html#definition-bootstrap) revision and must be refreshed when the measured model changes.

The acceptance gate includes conformance, composition, renaming, formal planning, normalization and validated construction learning. Open challenges are exploratory and excluded from that gate, but their failures must remain in the report. Acceptance therefore does not establish the full objective in DS000.

### Meaning of success

A reasoning case must check the expected formal truth, selected values or rational quantity, relevant gaps and independently replayed evidence. `unknown` must not count as a correct negative answer. A returned object or well-formed sentence is not evidence of successful reasoning.

Summary checks must distinguish exact source-span fidelity and selected content from human-rated summary quality. Completion checks must distinguish attested continuation, distributional generation and absent [coverage](../wiki.html#definition-coverage). Planning checks must compare formal witnesses and costs with the independent state oracle and must not claim natural-language interpretation.

Learning cases must be outside the teacher packet and test new compositions and counterexamples. Renaming alone is insufficient. Exact reproduction must bind deployed content; an annotation or provenance label alone is insufficient. [Ablation](../wiki.html#definition-ablation) must remove the claimed behavior, and restoration must recover it with an unchanged host. A weak training-consistent procedure must remain rejectable by transfer gates.

### Scoped learning evidence

The finite-set procedure experiment must preserve its 0→71/71 gain, 71/71 reuse, [ablation](../wiki.html#definition-ablation) and weak-supervision rejection as distinct observations. The normalization experiment must preserve its 1/16 identity-[ablation](../wiki.html#definition-ablation) baseline, 16/16 learned output, 16/16 restoration and parser-terminal reuse. These public same-project cases are separate from teacher examples but not blind external evaluation.

Realization, dispatch, numeric score and sequence [receipts](../wiki.html#definition-receipt) must retain their common origin with authored migration data where applicable. The 288 reproduced fragments in the 878-module [bootstrap](../wiki.html#definition-bootstrap) must not be described as 288 learned skills. The 590 modules without reproduced derivations and the three unreviewed native text/chart operations remain architectural failures even when behavioral suites pass.

### Text policy evidence

The segmentation comparison must preserve a frozen reference implementation outside the [native closure](../wiki.html#definition-native-closure). Its 736 finite combinations exercise empty input, consecutive delimiters, retained delimiters, whitespace and UTF-16 offsets. Changing normalization must change learned frequency keys, and replaying those keys under an incompatible installed [text policy](../wiki.html#definition-text-policy) must lose audit credit. Construction alignment must respect a [circuit](../wiki.html#definition-circuit)-defined ignored symbol without editing native code. These checks establish explicit policy use and historical agreement, not induction of segmentation rules.

### Reproduction, portability and browser behavior

`npm run check:learning` must replay all installed learned and compiled families with accurate provenance. `npm run test:rebuild` must execute thirteen source-to-[pack](../wiki.html#definition-pack) stages in an isolated copy. `npm run test:standalone` must check local dependencies and run an actual request, learning demonstration and full capability evaluation without sibling repositories. Agent-manager infrastructure is excluded from that delivered runtime copy.

The browser suite must check reasoning, summary, completion, learning validation, activation, learned composition, evaluation, visible architecture boundaries, desktop/mobile overflow and JavaScript errors. Screenshots support visual review but do not replace semantic assertions. Documentation checks must cover local links, canonical wiki anchors, contiguous DS numbering, navigation-map agreement, loader behavior and responsive reading width.

### Reports and failure visibility

Structured reports must use [SOP](../wiki.html#definition-sop) and identify the model or source revision to which their claims apply. Evidence must distinguish a passed test, a declared requirement, a historical comparison and an unverified architectural interpretation. A report must not inherit a newer model hash without rerunning its relevant checks.

`node eval/chat-procedures.mjs` must compare the 40 conformance and composition cases across the [bootstrap](../wiki.html#definition-bootstrap), the elementary language extension and that extension with 320 supplied multiword noun terms. Optional facts and rules are ablated so legitimate new observations cannot alter the procedure expectations. Each profile retains its model identity, unchanged request [budgets](../wiki.html#definition-budget) and individual failures in `reports/chat-procedures.sop`. This is bounded procedure inheritance and lexical stress, not semantic evaluation of an arbitrary document.

`npm run audit:vision` must preserve its deliberate nonzero result until the whole completion contract is satisfied. It inventories the entire privileged import closure, registered operations, [circuit](../wiki.html#definition-circuit)-only knowledge authority and reproduced learning. Audit classifications are explicit reviews, not automated semantic proofs. Missing or conflicting evidence must remain visible.

The challenge set includes pronoun resolution, passive voice, implicit comparison, temporal location, disjunctive elimination, universal queries, causal paraphrase and commonsense. These failures must remain until an implemented capability and appropriate evaluation justify a different result. Scaling claims require independently annotated English episodes and separate measurements of interpretation, answer correctness, evidence, artifact size and runtime cost.

### Cross-experiment compatibility

The compatibility inventory in `reports/compatibility-inventory.sop` identifies 234 evaluation and contract source files across six sibling experiments. `eval/compatibility/sdlm-early-school.sop` preserves 88 English school-level cases, and `eval/compatibility/eslm-everyday.sop` preserves 1,000 English everyday cases. These artifacts are read-only conversions of user-owned evaluation data; no sibling implementation is imported or executed. Case identities, original expectations, constraints and source hashes must remain available.

Inventory or conversion does not establish reproduced [coverage](../wiki.html#definition-coverage). Every behavioral family requires an explicit [SXLM](../wiki.html#definition-sxlm) adapter preserving the original oracle's meaning, source [context](../wiki.html#definition-context), calibration cases and unresolved results. Internal implementation tests require equivalent invariant checks rather than identical private APIs. Human semantic-review cases must not acquire an automatic pass from keyword overlap alone. All converted cases are development-visible and cannot establish a blind generalization claim. Complete support for the earlier experiments remains an unfulfilled contract.

`node eval/compatibility/run-early-school.mjs` evaluates the 88 imported school cases against the [bootstrap](../wiki.html#definition-bootstrap) plus elementary [pack](../wiki.html#definition-pack). It preserves sequential [context](../wiki.html#definition-context) statements, requires exact typed answer agreement and rejects interpretation gaps, resource failures and missing logical [certificates](../wiki.html#definition-certificate). Numeric formatting is compared by exact rational value. Elementary version 3 records 56 passing cases, with 57 answer-contract matches before the stricter interpretation requirement; versions 1 and 2 recorded 18/19 and 38/39 respectively. These development-visible cases do not establish general school-level competence. The runner exits unsuccessfully while any imported case fails and writes `reports/compatibility-early-school.sop` with every result and domain subtotal.

The CircuitLM summary conversion contains 18 sentence-index fixtures. Four Romanian originals are represented by explicitly authored English translations under the project language contract; their source identities, sentence counts and gold positions remain recorded. The other 14 English inputs are unchanged. `node eval/compatibility/run-circuitlm-summary.mjs` must preserve the source recall, precision and lead-recall measures, report the two adaptation groups separately, and verify exact [source spans](../wiki.html#definition-source-span) and requested length. Its stricter passing condition requires the exact gold sentence set and source-faithful output. Original development/holdout labels are provenance rather than evidence of a blind [SXLM](../wiki.html#definition-sxlm) evaluation. No sibling implementation may execute to obtain these results.

The 15 unchanged English cases in `eval/compatibility/circuitlm-expansion.sop` preserve CircuitLM's `developmentCompletions` fixtures, which call `text.expand` and compare selected inferred predicates. That oracle measures logical consequence selection with explicit negative, modal, attributed, quoted, conditional and contradictory inputs. It is different from [SXLM](../wiki.html#definition-sxlm)'s attested or frequency-based prefix continuation. A compatible adapter must preserve those inference and abstention conditions; calling `model.complete` and comparing prose would measure a different task. Empty output caused by an unsupported interpretation must remain distinct from correctly withholding a conclusion.

The imported summary evaluation records 9/18 exact gold-set selections and 18/18 source-faithful outputs. The unchanged English group scores 6/14 exact with mean recall 0.798 against lead recall 0.381; the translated group scores 3/4 exact with recall 0.917 against 0.583. Mean recall over all 18 cases is 0.824 against the lead baseline 0.426. These numbers measure the supplied sentence annotations and must not be presented as human-rated summary quality.

### Construction transfer evidence

The variable-width construction experiment must retain evaluator-owned cases in `eval/construction-cases.mjs`, separately from the six teaching phrases. Its report must include the baseline, candidate, removal of the learned [grammar](../wiki.html#definition-grammar) [provider](../wiki.html#definition-provider), disabled-cache execution, prior conformance/composition cases and the unchanged eight open challenges. New relation meanings, swapped arguments, explicit negative evidence, attributed beliefs and preservation of variable-length constraint sequences must be distinguished from simple entity renaming. Exact source replay must not award induction credit to the surrounding authored vocabulary or [grammar](../wiki.html#definition-grammar) constructors.

### Concept transfer evidence

`test/concepts.test.mjs` and `reports/concept-transfer.sop` cover sixteen same-author structural and counterexample probes over a fictional multiword taxonomy. Supervision contains category declarations and source-attributed relations, without evaluation questions or responses. The report must bind model and source identities, preserve each result and cost, and disclose authored semantics. Knowledge [ablation](../wiki.html#definition-ablation) and restoration must preserve native identity. Passing these cases does not establish autonomous concept induction or unrestricted conversation.

<!-- chapter:evaluation -->
### Evaluation methodology

Run `npm test` for implementation contracts and `npm run eval` for a machine-readable capability report. Both run offline. The workbench's Evaluation view runs the same repository benchmark and labels its [bootstrap](../wiki.html#definition-bootstrap)/reference-induction scope explicitly.

Run `node eval/compatibility/run-early-school.mjs` for the imported school-level compatibility suite. Its 56/88 result is separate from the reference acceptance gate. Cases use unchanged English contexts and questions; a correct-looking answer with an interpretation gap fails. The 1,000 imported everyday cases require semantic review, and the wider six-experiment inventory does not constitute demonstrated compatibility.

| Imported school domain | Passing cases |
| --- | --- |
| Animals | 6/8 |
| Plants and materials | 2/8 |
| Senses and tools | 0/8 |
| Arithmetic | 8/8 |
| Quantities | 8/8 |
| Space | 6/8 |
| Order and calendar | 8/8 |
| Family | 8/8 |
| Causal reasoning | 0/8 |
| Comparisons | 3/8 |
| Epistemic cases | 7/8 |

These results separate elementary version 3 from the narrower [bootstrap](../wiki.html#definition-bootstrap) acceptance suite. Missing domain knowledge, unsupported language constructions and inadequate formal assumptions require different remedies. A simplified benchmark expectation must not justify a false universal rule or a closed-world answer where the represented evidence is incomplete.

#### Separate measurements

| Suite | Purpose | Initial reference result |
| --- | --- | --- |
| Conformance | Declared logic, state, evidence, summary and completion contracts | 28 / 28 |
| Structural composition | Joins, recursive chains, relative clauses, [context](../wiki.html#definition-context) and resource dependencies | 12 / 12 |
| Metamorphic renaming | Vocabulary/identifier invariance within existing structures | 60 / 60 |
| Finite planning | Signed transition witnesses and minimum cost against an independent exhaustive state oracle | 64 / 64 |
| Normalization transfer | A synthesized Unicode composition on held-out literal pairs | 16 / 16 |
| Learning transfer | New construction outside its two annotated teaching phrases | 0 / 5 before; 5 / 5 after |
| Aspirational challenges | Pronouns, passive voice, comparison, temporal motion, disjunction, universal queries, causality and commonsense | 0 / 8 |

The acceptance gate covers conformance, structural composition, renaming probes, finite planning, normalization transfer and validated learning. Aspirational failures remain in the report but do not change that explicit engineering gate. **Passing acceptance does not mean the broad language objective is solved.**

These are authored local tests, not a blind external benchmark. Structural learning gates were excluded from the induction examples but were visible to the implementation author. Renaming probes are correlated and are not counted as distinct discovered skills. Do not combine all rows into a headline “LLM accuracy” number.

#### What the assertions check

Reasoning cases compare formal truth status, selected values or exact rational quantities, interpretation gaps, and independently replayed evidence when a proof is expected. Unknown and false are distinct. Explicit contradictions must produce both rather than a preferred polarity. Existential joins must not borrow an unrelated entity's property.

Summary cases verify that the output exactly equals its cited original spans and that specified key content is retained. This measures source fidelity and limited content selection, not broad abstractive or human-rated summary quality. Completion cases distinguish exact attested continuation, distributional generation and lack of [coverage](../wiki.html#definition-coverage); they do not measure general creative writing.

Implementation tests also cover [circuit](../wiki.html#definition-circuit) identity collisions, type errors, nested composition, unsafe inert values, finite closure, independent plan replay, model isolation, serialization, rollback, cache equivalence, induction refusal, [promotion](../wiki.html#definition-promotion), [receipt](../wiki.html#definition-receipt)/registry behavior and HTTP interfaces.

#### Add a case

An evaluator-owned case is a [SOP](../wiki.html#definition-sop)-constructed record with `id`, `text`, optional `task`/`options`, and `expect`. Supported expectations include `truth`, `value`, `values`, `status`, `reason`, `gaps`, `proof`, `contains`, `sourceFaithful` and `grounding`. The expectation must test the actual capability; “returned an answer object” is not evidence of correct reasoning.

For formal procedure tests, `task: circuit` supplies `circuit` and `input`, and compares the order-sensitive `value`. For finite transitions, `task: plan` supplies `problem`; expectations may include `cost` and `planWitness`. Planning is measured separately from natural-language interpretation. Its 64 generated cases use synchronous relaxation over every small bit-mask state; the oracle never calls learned [coverage](../wiki.html#definition-coverage) or the [SOP](../wiki.html#definition-sop) search strategy. The teacher receives none of these cases. Same-project authorship is disclosed.

Keep teaching data separate. A proposed [grammar](../wiki.html#definition-grammar) extension should be tested in a factual statement, a rule antecedent/consequent when meaningful, a relative construction, a negative or wrong-binding counterexample, and an attributed [context](../wiki.html#definition-context). Include an unsupported variant to verify that the extension does not broaden scope unsafely.

#### Before scaling claims

Build independently annotated English episodes with source-preserving semantic interpretations and reasoning answers. Separate lexical novelty from novel compositions. Include ordinary prose, misleading surface overlap, distractors, ambiguous references, scope and temporal edits. Measure:

- interpretation [coverage](../wiki.html#definition-coverage) and correctness;
- answer correctness conditional on interpretation;
- unsupported clauses silently accepted as facts;
- [certificate](../wiki.html#definition-certificate) validity and evidence attribution;
- extension gain versus artifact size and new regression count;
- runtime cost versus facts, rule joins, [grammar](../wiki.html#definition-grammar) ambiguity and source length;
- summary quality judged separately from verbatim fidelity;
- completion usefulness judged separately from truthfulness.

Keep the eight present challenges until the corresponding capability is implemented and independently evaluated. Do not delete them to make a report look better.

Implementation files run sequentially under `npm test` so artificial worker contention does not invalidate the model's cooperative wall-time limit. Whole-suite CLI/browser harnesses allow time for many separately bounded requests. The per-request three-second [budget](../wiki.html#definition-budget) remains unchanged; whole-suite completion time is not an inference latency SLO.
Run `node eval/compatibility/run-circuitlm-summary.mjs` to measure the 18 imported summarization fixtures. The report separates 14 unchanged English cases from four English translations and preserves the original sentence-index recall baseline. Exact [source spans](../wiki.html#definition-source-span) establish faithful [extraction](../wiki.html#definition-extraction), while gold-set agreement measures the supplied salience annotations. The measured result is 9/18 exact selections with 18/18 source-faithful outputs. Mean gold-sentence recall is 0.824, compared with 0.426 when selecting the leading sentences. Unchanged English cases score 6/14 exact; translated cases score 3/4. The errors include selecting administrative details and omitting a measured outcome or consequence. All fixtures are development-visible, and the CircuitLM completion cases remain a separate contract.
#### Category dialogue and transfer

The concept evaluation supplies four fictional categories and three attributed relations, then checks sixteen requests across definitions, multiword plurals, conjunction, instance inference, relative rules, exclusions and scope. Removing the supplied knowledge removes the classification answer; restoration recovers it with the same native runtime. The compiler receives category supervision rather than question/answer pairs. This is development-visible structural transfer of authored semantics and compiled knowledge. Open pronoun, physical-change and causal-explanation questions remain separate requirements.
Use `node eval/compatibility/run-early-school.mjs --chat-profile` to evaluate the same 88 unchanged cases with the actual new-conversation profile: [bootstrap](../wiki.html#definition-bootstrap), induced constructions and elementary knowledge. This writes `reports/compatibility-early-school-chat.sop`, preserving the earlier two-[pack](../wiki.html#definition-pack) measurement under its original filename and model identity.

#### Variable-width construction transfer

`reports/construction-transfer.sop` records 0/16 before learning and 16/16 after learning from six annotated phrases. Removing the learned production returns to 0/16; disabling execution caches preserves all sixteen results. The extended model preserves 28 conformance and 12 composition cases and answers the existing passive-voice challenge, scoring 1/8 on the unchanged challenge set. The [bootstrap](../wiki.html#definition-bootstrap)-only evaluation remains a separate 0/8 measurement. A field-composition test preserves seventeen constraints with their original bindings and contexts, beyond the zero-or-one lengths in training. All cases are development-visible and share project authorship. This establishes bounded structural transfer of the learned procedure, not child-level conversation or automatic discovery of lexical meanings.
<!-- /chapter:evaluation -->
