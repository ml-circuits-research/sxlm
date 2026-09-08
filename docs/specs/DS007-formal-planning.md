---
title: DS007-formal-planning
summary: Defines finite signed action search in SOP, learned coverage reuse and independent witness replay.
---

## Introduction

Finite planning lets an integrator search an explicitly supplied transition system. It operates on formal data through `SymbolicModel.plan`; it is not a natural-language planning interpreter.

## Core Content

### Problem and transition semantics

A problem must supply arrays of ground [atoms](../wiki.html#definition-atom) in `initial` and `goals`. Every action must have a unique string `id`, arrays `requires`, `remove` and `add`, and an optional finite nonnegative numeric cost with default 1. [Atom](../wiki.html#definition-atom) identity must preserve predicate, argument order, polarity and [context](../wiki.html#definition-context) under DS005.

The initial state must be a set. An action is applicable exactly when every precondition is present. Delete effects must run before add effects; overlap leaves the [atom](../wiki.html#definition-atom) present. Negative [atoms](../wiki.html#definition-atom) are independent explicit facts and must not be inferred from absence. Path cost must sum finite JavaScript numbers and reject overflow. Exact rational quantity semantics must not be claimed for planning cost.

### Search policy

`planning.run` must express search policy through [SOP](../wiki.html#definition-sop). It must order the frontier by accumulated cost and then path length, preserving insertion order for remaining ties. It must retain the least expanded cost per state, discard dominated entries and terminate on an expanded goal state. Under the declared finite-state, nonnegative-cost conditions, this is uniform-cost search.

The authored policy accepts at most 1,000 actions and defaults to 10,000 transitions. `maxIterations` may provide an explicit bound, and request [budgets](../wiki.html#definition-budget) may stop earlier. Frontier exhaustion returns `unreachable-in-model`, conditional on the supplied action model. Resource exhaustion must throw and must not be described as unreachability.

### Learned method and control

Goals and action preconditions must reuse `learned.set.coverage`. Its derivation must be reproduced from the eight teacher observations and pure typed library in `training/set-coverage.sop`. The 17 search policies remain authored. A [receipt](../wiki.html#definition-receipt) for the [coverage method](../wiki.html#definition-coverage-method) must not be extended into a claim that the entire planning strategy was learned.

The static typed `iterate` form must carry search state through immutable transitions, under DS002. Host code may invoke the entrypoint and validate results, but must not contain a parallel action-search shortcut. Changing search priority or action policy must change the [circuit](../wiki.html#definition-circuit) library.

### Witness verification

Every solved result must pass `verifyPlan`. The checker must independently validate declarations, replay applicability and effects, recompute accumulated cost and confirm final goals. It must not choose actions. It must not certify minimum cost or unreachable results. A solved result that fails replay must be rejected by `SymbolicModel.plan`.

### Evidence and limitations

The 64 evaluator-owned finite systems must compare solved costs with an independent exhaustive state oracle. The oracle uses synchronous relaxation over bit-mask states and must not call the [SOP](../wiki.html#definition-sop) strategy or its learned method. Tests must cover [context](../wiki.html#definition-context), sign, deletion, conjunction, ties, zero-cost cycles, action order, malformed witnesses and resource bounds.

Separate 71-case procedure transfer, method reuse and planner [ablation](../wiki.html#definition-ablation)/restoration must demonstrate that the learned [coverage method](../wiki.html#definition-coverage-method) affects behavior with an unchanged host. These public same-project tests establish bounded formal behavior; they do not establish blind language generalization, arbitrary optimal planning or strategy induction. `test/planning.test.mjs`, `eval/planning-cases.mjs` and `scripts/evaluate-program-learning.mjs` hold the evidence.

<!-- chapter:formal-planning -->
### Finite signed planning contract

`model.plan(problem, options)` executes `planning.run` through the same [SOP](../wiki.html#definition-sop) [VM](../wiki.html#definition-vm) as other model programs. There is no `planning.search` native operation. The input is formal data: `initial` and `goals` are arrays of ground [atoms](../wiki.html#definition-atom); each action declares a unique string `id`, `requires`, `remove`, `add`, and optional finite nonnegative numeric `cost` (default 1). [Atoms](../wiki.html#definition-atom) follow [the finite relational contract](DS005-reasoning-and-state.md); predicate, ordered terms, [context](../wiki.html#definition-context) and explicit polarity determine identity. A negative [atom](../wiki.html#definition-atom) is an independent fact, never inferred from absence.

The initial state is a set. An action is applicable exactly when all its preconditions are present. Delete effects run before add effects; overlap therefore leaves an [atom](../wiki.html#definition-atom) present. The path cost is the sum of action costs. Arithmetic follows the [VM](../wiki.html#definition-vm)'s finite JavaScript-number contract; overflowing sums fail. This is not exact rational optimization. The authored [SOP](../wiki.html#definition-sop) policy accepts at most 1,000 actions and defaults to 10,000 search transitions. Callers may supply `maxIterations` and the usual `limits`; global [budgets](../wiki.html#definition-budget) can stop earlier.

The [SOP](../wiki.html#definition-sop) strategy sorts the frontier by cost, then path length, preserving insertion order for ties. It tracks the least expanded cost for each state, discards dominated entries, and stops at the first expanded goal state. With finite states and nonnegative costs this implements uniform-cost search. Exhausting the frontier returns `unreachable-in-model`, conditional on the supplied complete action model. Reaching a resource bound raises an error, not an unreachability claim. There is no natural-language planner frontend in this contract.

Seventeen [SOP](../wiki.html#definition-sop) policy modules contain normalization, action application, priority and dominance decisions, stopping conditions and result wording. These are **authored policies**. `training/set-coverage.sop` separately supplies eight typed examples and a pure primitive library. Bounded [program synthesis](../wiki.html#definition-program-synthesis) induces `learned.set.coverage`; goals and action preconditions both call that module. `scripts/build-planning.mjs` reproduces its source and runtime-bound learning [receipt](../wiki.html#definition-receipt), together with the authored policies. The [bootstrap](../wiki.html#definition-bootstrap) stores the component's derivation in `training.components.setCoverage`, alongside the sequence learner's distinct evidence.

The privileged `verifyPlan` function independently replays a proposed solved witness. It validates action declarations, applicability, effects, accumulated cost and final goals under the caller's [budget](../wiki.html#definition-budget). It makes no search decisions and does not certify minimum cost or unreachable results. `model.plan` rejects solved results that fail replay. Source identity includes this checker; it is not an uncounted trusted shortcut.

`eval/planning-cases.mjs` generates 64 finite systems with two to four [atoms](../wiki.html#definition-atom) and independently computes minimum costs using bit masks and synchronous Bellman-Ford relaxation over all states. This oracle does not call the runtime's [atom](../wiki.html#definition-atom) keys, set operations, search or learned method. The cases are kept outside the teacher specification. `test/planning.test.mjs` checks exact agreement with the historical planner, independent costs, action-order invariance, explicit polarity/[context](../wiki.html#definition-context), deletion, conjunction, ties, zero-cost cycles, malformed witnesses and bounds. These are authored public structural tests, not an external blind benchmark or a proof for every input.

The learned [coverage method](../wiki.html#definition-coverage-method) also passes 71 separate structural cases. [Ablation](../wiki.html#definition-ablation) breaks a multi-step planning task; restoration recovers it without host changes. Altering the module or removing its training evidence prevents the audit from crediting its derivation. These checks establish a reusable learned subprocedure inside an authored strategy. They do not establish that the planner learned its complete strategy or that the language model is general.
<!-- /chapter:formal-planning -->
