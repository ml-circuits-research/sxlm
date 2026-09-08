---
title: DS003-main-behavior
summary: Defines the six user and system behaviors that connect English tasks, formal planning, learning and validated SOP execution.
---

## Introduction

[SXLM](../wiki.html#definition-sxlm) lets a developer run inspectable English tasks and lets an offline coding agent extend the same model through validated [SOP](../wiki.html#definition-sop) artifacts. The following behaviors define the product. They preserve the distinction between delivered symbolic contracts and unrestricted language competence.

## Core Content

### Main Behavior Components

| Name | Explanation |
| --- | --- |
| Document teaching and persistent conversation | Readers attach a document, wait for checked coding and discuss its interpretation through a persistent local conversation. |
| Reasoning with evidence and [session](../wiki.html#definition-session) state | Callers receive supported English answers, visible interpretation gaps and model-bound conversational state. |
| Source-grounded summaries and completion | Readers receive selected source passages or continuations with an explicit [grounding](../wiki.html#definition-grounding) contract. |
| Finite planning with checked witnesses | Integrators receive action sequences replayed against their supplied formal transition model. |
| Learning, validation and model activation | Agents propose reusable behavior; evaluator checks govern activation and rollback. |
| Typed [SOP](../wiki.html#definition-sop) execution and reproducible model identity | [Pack](../wiki.html#definition-pack) authors and integrators rely on validated graphs and identities that bind executable dependencies. |

### Document teaching and persistent conversation

A reader must be able to attach a file in Chat at port 3210, wait for processing and ask English questions about the interpreted document. The attachment controls must automatically upload fragments, prepare source text, run an isolated `codex exec` job, validate a [SOP](../wiki.html#definition-sop) candidate and activate it only in the originating conversation. The observable outcome is a ready document and replies produced by local symbolic inference, with source attribution and ordinary proof/[coverage](../wiki.html#definition-coverage) contracts.

Persistent [SOP](../wiki.html#definition-sop) records under `.sxlm/chat` must retain conversations, model identities, attachment identities, [extraction](../wiki.html#definition-extraction) records and coding [receipts](../wiki.html#definition-receipt). A protected [extraction](../wiki.html#definition-extraction) copy outside the agent workspace prevents an edited working source from redefining evidence. Model changes must replay retained observations before activation. Authored [document interpretation](../wiki.html#definition-document-interpretation) remains distinct from globally promoted learned behavior; new source observations may change answers without changing the general inference procedure. DS013 defines supported formats, optional tools, job limits, failure handling and the explicitly ablated procedural regression profile. `src/chat/`, `web/chat.js` and the chat/[extraction](../wiki.html#definition-extraction) tests establish the path.

### Reasoning with evidence and session state

A caller must be able to submit supported English through `ask`, `chat`, `SymbolicModel.ask`, `Session.ask` or `POST /api/run` with task `reason`. [SXLM](../wiki.html#definition-sxlm) must interpret the input through installed [circuits](../wiki.html#definition-circuit), apply the declared finite reasoning and ordered quantity contracts, and return English text with interpretation [coverage](../wiki.html#definition-coverage), evidence and execution metrics.

`SymbolicModel.ask` must start a fresh [session](../wiki.html#definition-session). `Session.ask` and the workbench [session](../wiki.html#definition-session) identifier must preserve state across accepted turns. Questions within a document must observe their narrative position. Logical answers must carry [certificates](../wiki.html#definition-certificate) that the host independently replays before committing the turn. A resource failure must leave prior [session](../wiki.html#definition-session) state unchanged. Snapshot restoration must require the same model identity.

The defining rule is separation of formal support, language [coverage](../wiki.html#definition-coverage), inference completeness and attributed [context](../wiki.html#definition-context). A parse gap must stay visible; an unsupported question must not be disguised as an earlier answer. Formal replay verifies the interpreted representation, not arbitrary English fidelity. DS004, DS005 and DS009 define these boundaries. Source evidence is `src/model.mjs`, `src/semantics/verify.mjs`, `test/model.test.mjs` and `test/interfaces.test.mjs`.

### Source-grounded summaries and completion

A document reader must be able to call `summarize` with source text and selection options. The summary must consist of exact original sentence spans selected by [SOP](../wiki.html#definition-sop) policy. A completion caller must be able to supply a prefix and optional source [context](../wiki.html#definition-context) through `complete`. [SXLM](../wiki.html#definition-sxlm) must first seek attested continuation and otherwise use installed finite-[context](../wiki.html#definition-context) observations, with an explicit indication of [grounding](../wiki.html#definition-grounding) or lack of [coverage](../wiki.html#definition-coverage).

Source fidelity preserves the selected wording, including negation. It does not establish source truth or human-rated summary quality. Distributional continuation must never acquire proof status from frequency. DS006 defines the task contracts. `src/model.mjs`, `sop/summary/`, `sop/completion/` and the capability tests establish the path.

### Finite planning with checked witnesses

An integrator may call `SymbolicModel.plan` with a formal initial state, goals and action declarations. Authored [SOP](../wiki.html#definition-sop) policy must search within the supplied bounds and reuse the synthesized [coverage method](../wiki.html#definition-coverage-method) for preconditions and goals. A solved result must pass independent replay of action applicability, effects, cost and final goals.

The caller receives a valid action sequence, conditional unreachability in the supplied action model, or resource exhaustion. Witness checking must not claim to certify cost optimality. This interface does not interpret natural-language planning requests. DS007 defines the separate search and witness contracts, supported by `src/model.mjs`, `src/semantics/verify-plan.mjs` and `test/planning.test.mjs`.

### Learning, validation and model activation

An offline coding agent must be able to receive a parent-bound teacher packet using `train prepare` and produce a candidate using [construction induction](../wiki.html#definition-construction-induction), [program synthesis](../wiki.html#definition-program-synthesis), [sequence learning](../wiki.html#definition-sequence-learning) or explicit [circuit](../wiki.html#definition-circuit) authorship. `train validate` must evaluate actual installed candidate behavior on separately supplied gates and preserved regressions. `train promote` must rerun checks against the registry parent before atomically activating a content-addressed [pack](../wiki.html#definition-pack). `train rollback` must restore a previous lineage state.

Incremental candidates must not redefine installed [circuit](../wiki.html#definition-circuit) identities or replace an existing task entrypoint. This hidden restriction prevents a candidate from manufacturing evaluator-facing answer objects through a substituted pipeline. Authored proposals, compiled knowledge, memory and induced programs must retain distinct provenance. Browser `/api/learn` and `/api/activate` expose validated, process-local construction learning; persistent registry activation belongs to the CLI workflow. DS008 and DS009 govern this behavior. Evidence is `src/learning/workflow.mjs`, `src/learning/search.mjs`, `src/server.mjs` and `test/workflow.test.mjs`.

### Typed SOP execution and reproducible model identity

A [pack](../wiki.html#definition-pack) author must supply [SOP](../wiki.html#definition-sop) sources that compile into typed [SSA](../wiki.html#definition-ssa) graphs. The constructor-only reader must decode interchange artifacts without executing their quoted programs. `SymbolicModel` must compile dependencies, link [providers](../wiki.html#definition-provider), reconstruct knowledge through [circuits](../wiki.html#definition-circuit) and seal installed resources before inference.

The model identity must bind ordered executable knowledge, the static [native closure](../wiki.html#definition-native-closure) and Node component versions. Source changes require a fresh process; old snapshots and registries must not silently cross incompatible identities. Cache reuse must respect every observable executable dependency.

This common path governs all tasks and learning candidates. Active graph-object, raw [grammar](../wiki.html#definition-grammar), theory, text and corpus fields are prohibited. Derived JavaScript wire values remain permitted. Native token and chart policies and authored [bootstrap](../wiki.html#definition-bootstrap) knowledge remain explicit architectural limitations under DS000. DS002 and DS009 provide the detailed contracts. Evidence is `src/kernel/sop-data.mjs`, `src/kernel/sop.mjs`, `src/kernel/circuit.mjs`, `src/runtime-identity.mjs` and their tests.
