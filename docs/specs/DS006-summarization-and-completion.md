---
title: DS006-summarization-and-completion
summary: Defines extractive source fidelity, attested continuation, finite-context generation and their limits.
---

## Introduction

Summarization helps readers shorten supplied documents while preserving selected wording. Completion helps callers continue supplied or learned text. These tasks must expose their source relationship and must not borrow the proof guarantees of formal reasoning.

## Core Content

### Extractive selection

`SymbolicModel.summarize(text, options)` must invoke the installed [SOP](../wiki.html#definition-sop) summary entrypoint. The CLI must expose `summarize`, `--file`, `--sentences` and `--focus`. The workbench and `/api/run` task `summarize` must invoke the same model operation.

Summary policy must score and select original sentence spans using the supplied text configuration, focus, lead, centrality and redundancy calculations. Returned text must equal the selected original spans, with source witnesses. Selection must retain the source wording, including negation and qualifications inside selected sentences. A summary must not silently paraphrase those sentences or label unsupported content as a proved conclusion.

Exact [extraction](../wiki.html#definition-extraction) does not establish that all important information was selected, that omitted qualifications are irrelevant, that references are resolved or that the source is true. Human-rated summary quality and abstractive synthesis are outside this contract. The numeric scorer is induced from disclosed numeric annotations; the surrounding 13 selection policies are authored. Full-rank observations and exact reproduction are required for the scorer's derivation claim.

### Completion and grounding

`SymbolicModel.complete(prefix, options)` must invoke the installed [SOP](../wiki.html#definition-sop) completion entrypoint. Options may supply `context` and a token bound. The CLI must expose `complete`, `--context-file` and `--max-tokens`. HTTP uses task `complete` and places the prefix in `text`.

Completion must seek attested source continuation before falling back to deterministic finite-[context](../wiki.html#definition-context) frequencies. It must distinguish attested text, distributional output and insufficient [coverage](../wiki.html#definition-coverage). A generated sequence must not be labeled a formal proof or a true statement merely because it has high observed frequency. With no useful [context](../wiki.html#definition-context), the task must abstain according to its declared result contract.

Observed frequency [providers](../wiki.html#definition-provider) must compose through typed static [linkage](../wiki.html#definition-linkage). Offline [sequence learning](../wiki.html#definition-sequence-learning) must compile counts, source memory and supplied [context](../wiki.html#definition-context) bounds into [SOP](../wiki.html#definition-sop) constructors. Model construction must not read a raw corpus field or retrain a count model. Removing [provider](../wiki.html#definition-provider) wiring must remove the corresponding contribution; removing training evidence alone must remove audit credit, not secretly change execution.

### Provenance and scale

Both tasks must use the segmentation contract in DS004. Completion prefix matching and source scanning must call the shared [SOP](../wiki.html#definition-sop) tokenizer. Its compiled identity must agree with the [sequence learning](../wiki.html#definition-sequence-learning) evidence as specified in DS008.

The completion strategy consists of authored policy. Observed counts are induced; source observations and [context](../wiki.html#definition-context) parameters are remembered or supplied. Compiler fragments must not be counted as independent language skills. Adding corpus volume may extend finite-[context](../wiki.html#definition-context) [coverage](../wiki.html#definition-coverage), but it does not by itself induce semantic reasoning or a general [grammar](../wiki.html#definition-grammar).

Finite lookup pages must bound construction work for a requested frequency [context](../wiki.html#definition-context). Attested continuation still scans supplied source observations. The contract does not claim indexed large-corpus retrieval or unbounded [provider](../wiki.html#definition-provider) counts. Native token boundaries and word [extraction](../wiki.html#definition-extraction) remain architectural limitations under DS000 and DS004.

### Failure and validation

Both operations must report model identity and measured execution cost on success. They must honor caller limits. Their JavaScript API propagates errors, including resource exhaustion; it does not use the reasoning [session](../wiki.html#definition-session)'s failure envelope. HTTP must encode an error through the normal [SOP](../wiki.html#definition-sop) response path. These tasks do not commit conversational facts.

`test/sop.test.mjs` and `test/completion.test.mjs` check source fidelity, scoring transfer, historical behavior, source offsets, frequency addition, [provider](../wiki.html#definition-provider) [ablation](../wiki.html#definition-ablation) and strict [budgets](../wiki.html#definition-budget). Capability evaluation must report source fidelity and selected content separately from broad summary quality, and [grounding](../wiki.html#definition-grounding) separately from open-ended writing ability.

<!-- chapter:text-tasks -->
### Source-based summaries and completion

[SXLM](../wiki.html#definition-sxlm) provides two ways to work with supplied text without requiring every sentence to fit its reasoning [grammar](../wiki.html#definition-grammar). Summarization selects original sentences. Completion continues attested text or uses observed finite-[context](../wiki.html#definition-context) frequencies. Their output carries a source relationship, not the entailment guarantee of a reasoning [certificate](../wiki.html#definition-certificate).

#### Shared segmentation

[Document interpretation](../wiki.html#definition-document-interpretation), summaries, completion and offline [sequence learning](../wiki.html#definition-sequence-learning) use the [SOP](../wiki.html#definition-sop) `text.segment` program. Six authored modules select boundaries, preserve requested delimiters and construct [source spans](../wiki.html#definition-source-span). The policy accepts explicit `boundaries` and `keep` arrays and uses `lexical.tokenize` for token values and offsets. A final token closes the last segment even without a delimiter.

A segment's `start` skips leading whitespace. Its `text` omits surrounding whitespace and any discarded delimiter, while `end` identifies the end of the consumed final token, including a discarded delimiter. For example, `  alpha  . beta?` with boundaries `.` and `?`, retaining only `?`, produces `alpha` at `[2, 10)` and `beta?` at `[11, 16)`. The first segment's complete consumed source slice includes the spaces and period. Token records have the stricter exact-slice contract documented in the lexical chapter.

The general host operation `kernel.text.trimStart` removes an ECMAScript whitespace prefix. It does not select sentence boundaries. There is no native segmentation operation. The six policy modules have authored provenance; reference agreement is evidence of preserved behavior, not a learning derivation. `test/text-policy.test.mjs` checks 736 boundary/retention combinations against the frozen historical implementation, including Unicode and consecutive delimiters.

#### Extractive summaries

The summary [circuit](../wiki.html#definition-circuit) segments the source, computes sentence features, scores candidates and applies focus and redundancy policy. Selection returns exact [source spans](../wiki.html#definition-source-span) in source order. Because the output copies selected text, words such as `not` remain intact within that sentence. This is useful when wording and attribution matter.

```text
The launch was not approved. The sensor failed during the test. The engineers requested another inspection.
```

With two sentences and focus `launch approved sensor failed`, the reference evaluation checks retention of `not approved` and `sensor failed` and verifies the exact cited source slices. That establishes [extraction](../wiki.html#definition-extraction) fidelity for the example. It does not establish that a different requested length preserves every important qualification or that the source itself is accurate.

Thirteen authored [SOP](../wiki.html#definition-sop) policies implement selection and evidence construction. A separately induced affine scorer reproduces numeric annotations derived from the historical score function. Its evidence is limited supervised distillation. It does not show that the complete summary strategy was discovered from documents or that summary quality equals abstractive language generation.

#### Attested and distributional continuation

Completion first looks for source text compatible with the supplied prefix. For the source `The cobalt robot inspects the reactor.`, the prefix `The cobalt robot` has an attested continuation. The result identifies that [grounding](../wiki.html#definition-grounding). If no source continuation applies, [SOP](../wiki.html#definition-sop) policy backs off over frequencies induced from the training observations. If no useful [context](../wiki.html#definition-context) is available, it reports insufficient [coverage](../wiki.html#definition-coverage).

Twenty-seven authored policy modules coordinate source matching, frequency lookup, bounded generation and result construction. Offline learning compiles counts and source observations into [SOP](../wiki.html#definition-sop) constructors. Relevant frequency pages construct only the needed lookup values; the original corpus is not read or counted by model installation. Multiple [packs](../wiki.html#definition-pack) contribute through ordered [provider](../wiki.html#definition-provider) [linkage](../wiki.html#definition-linkage).

The [bootstrap](../wiki.html#definition-bootstrap) sequence compiler emits 81 learned or memorized fragments. The count measures representation. Observed frequencies, source memory and the teacher-supplied [context](../wiki.html#definition-context) bound have different provenance. Adding more text can extend continuation [coverage](../wiki.html#definition-coverage), but frequency does not become formal support for a claim, and a new sequence is not a learned reasoning method.

#### Extension and operational limits

Use `train sequence` with `examples/learn-sequence.sop` to produce a candidate and `examples/sequence-gates.sop` to exercise the public demonstration loop. Production evaluation needs independently sourced prefixes, new compositions and counterexamples. Removing [provider](../wiki.html#definition-provider) wiring removes the contribution; removing a [receipt](../wiki.html#definition-receipt) invalidates derivation credit without changing [circuit](../wiki.html#definition-circuit) execution.

Source-continuation matching scans supplied observations, and one flat [linkage](../wiki.html#definition-linkage) is bounded to 127 [providers](../wiki.html#definition-provider). Native token boundaries and word [extraction](../wiki.html#definition-extraction) are unreviewed architectural paths. These facts matter before corpus scaling. Measure lookup work, memory size and useful [coverage](../wiki.html#definition-coverage) separately from formal reasoning correctness.

The JavaScript summary and completion APIs throw on resource exhaustion and do not commit [session](../wiki.html#definition-session) facts. The HTTP interface returns such failures through the [SOP](../wiki.html#definition-sop) error path. [DS006](../specsLoader.html?spec=DS006-summarization-and-completion.md) is the normative contract; [Training](../training.html) documents reproducible [sequence learning](../wiki.html#definition-sequence-learning).
<!-- /chapter:text-tasks -->
