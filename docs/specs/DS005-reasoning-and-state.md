---
title: DS005-reasoning-and-state
summary: Defines signed finite inference, four truth values, source-backed proof replay and transactional quantity state.
---

## Introduction

Reasoning lets a caller derive supported conclusions from interpreted statements while retaining their assumptions and sources. [SXLM](../wiki.html#definition-sxlm) must preserve explicit uncertainty and contradiction, and a [session](../wiki.html#definition-session) must commit only after its required checks succeed.

## Core Content

### Formal relational profile

An [atom](../wiki.html#definition-atom) must have a predicate, ordered string terms, explicit polarity and a [context](../wiki.html#definition-context). Terms beginning with `?` are variables in the declared profile. Predicate names and constants are input data, not native vocabulary. [Atom](../wiki.html#definition-atom) and index identity must preserve arity, order, sign and [context](../wiki.html#definition-context) without delimiter collisions.

A rule must contain a nonempty conjunction and one head, with every head variable bound in the body. Rules must be range restricted and [context](../wiki.html#definition-context) confined. The finite closure must compute the least fixed point of rule application over the supplied active domain. It must not invent function terms or fresh head values. Recursive rules may run until the fixed point or a resource limit.

Positive and negative [atoms](../wiki.html#definition-atom) are separate supported facts. Contradiction must not derive unrelated conclusions. Absence of support must not become explicit negation, contraposition or a closed-world default. A ground atomic query must distinguish `true`, `false`, `both` and `unknown`. Existential conjunctions must preserve shared witness bindings; a negative instance alone must not refute the existential. Selection returns supported values, without a claim of real-world exhaustiveness.

### Category and instance knowledge

A source-supervised category declaration may supply both a `kind(subtype, supertype)` fact and the corresponding unary instance rule. The concept compiler must keep their explicit polarity and source attribution aligned. Positive category inheritance uses the existing transitive relation; it does not create an instance of any class. An explicit disjointness declaration permits a negative instance conclusion. Lack of a category edge does not permit either a negative classification or a negative instance conclusion.

Descriptions and generic classifications must query that shared relation. The proof [certificate](../wiki.html#definition-certificate) verifies the resulting formal interpretation and its [source spans](../wiki.html#definition-source-span); it does not independently establish that the teacher correctly interpreted the original source. Teachers must preserve category and instance naming distinctions within the shared term representation. This contract does not establish a complete higher-order type logic, default reasoning or automatic projection of every newly asserted English rule into category knowledge.

Category property facts must distinguish `property(concept, category, relation, values...)` from `property(instance, individual, relation, values...)`. `typical_property` retains qualified category information and must not be flattened into either a universal rule or an individual conclusion. Universal inheritance requires both a declared category and its positive inclusion edge; a named individual's classification must not turn that individual into a category. Missing properties remain unknown. Definitions, intended functions, typical features and observations are different supervision contracts under DS008.

### Context and interpretation

Belief-attributed facts must not become world facts implicitly. Rule joins must preserve argument roles and [context](../wiki.html#definition-context) across each premise. Source-scoped existential witnesses must remain distinct unless the representation explicitly identifies them. Existential rule conclusions and negative existential assertions outside the supported formal profile must be refused.

The [bootstrap](../wiki.html#definition-bootstrap)'s spatial and kinship rules are explicit model knowledge. Their presence must not be described as a complete physical or commonsense solver. Formal support is conditional on the interpreted facts and supplied theories. DS004 governs the separate interpretation boundary.

### Certificates and source evidence

Every derived [atom](../wiki.html#definition-atom) must retain its rule, binding and premise evidence. Logical answers must include the complete reachable proof [certificate](../wiki.html#definition-certificate) even if the display tree is truncated. The independent checker must replay rule application against asserted facts, rules, source hashes and exact [source spans](../wiki.html#definition-source-span). The host must compute verification metadata, ignoring a candidate's self-declared verification result.

A valid proof establishes the formal conclusion under those premises. It must not certify source truth, missing language [coverage](../wiki.html#definition-coverage) or arbitrary parser correctness. One retained witness per generated [atom](../wiki.html#definition-atom) does not establish complete alternative-derivation tracking or truth maintenance under retraction. Those capabilities require additional contracts and evidence.

### Optional relational teaching profile

Elementary version 3 supplies authored relational axioms through [SOP](../wiki.html#definition-sop) theory [providers](../wiki.html#definition-provider). Mother and father specialize parent; brother and sister specialize sibling. Sibling is symmetric, but it is not treated as transitive, and shared parenthood alone does not create a sibling edge. Grandparent composes exactly two known parent links, grandchild reverses grandparent, and ancestor retains transitive ancestry. A stated grandparent relation must not invent missing intermediate people. These are explicit kinship interpretations, not a complete family ontology.

Qualitative height, weight, size, left/right position and temporal order use separate predicates. Each declared ordering supplies inverse directions, transitivity and asymmetry within one fixed reference frame and comparison dimension. A conclusion in one dimension must not imply another dimension. Incompatible supplied orders may produce both positive and negative support; they must not cause unrelated conclusions. Temporal before/after is distinct from the adjacent named calendar cycle, which may wrap around.

The profile interprets `in` as literal spatial containment in one state and supplies containment transitivity. This axiom does not model metaphorical uses of the preposition, movement, changing locations, event time or retraction. Those capabilities need separate interpretation and state-transition contracts. The W3C [OWL primer](https://www.w3.org/TR/owl2-primer/) supplies the formal relation patterns; their application to these predicate names is authored supervision. Temporal ordering also follows the declared sense in the [Time Ontology](https://www.w3.org/TR/owl-time/).

`eval/relational-cases.mjs` provides 29 public probes, including multi-generation depth, wrong-role joins, belief isolation, negative subtype counterexamples, nontransitive siblings, relative restrictions, selection, contradictions and separate dimensions. `test/relational-language.test.mjs` additionally checks a new lexical relation, theory [ablation](../wiki.html#definition-ablation) and transactional resource failure. These checks do not imply that other relation families are automatically discovered.

### Ordered quantities and transactions

Quantity state must follow narrative order and exact rational arithmetic. Questions within a turn must observe the state at their position. Assignment, addition, subtraction and transfer must preserve explicit evidence and dependencies. A known transfer out of one inventory must not require a known recipient initial total; the recipient may retain an unknown total with a known delta.

Unsupported statements that depend on an owner may taint that owner's quantities while preserving unrelated exact totals. An explicit assignment resets the affected history. Negative inventory must be reported as inconsistent. The event contract does not supply general tense, time intervals or discourse reference.

A turn must execute on candidate state. Required proof replay must succeed before the [session](../wiki.html#definition-session) commits. Resource exhaustion or thrown failure must leave the earlier state intact. Successfully interpreted statements and visible unsupported gaps may coexist in a processed turn. A question with no supported interpretation must not become a state-changing event. The failure wording [circuit](../wiki.html#definition-circuit) uses a separate small [budget](../wiki.html#definition-budget); a long diagnostic trace must be attached afterwards without being discarded.

### Evidence

`test/relational-reference.test.mjs` compares closure with exhaustive ground substitution. `test/model.test.mjs`, `test/semantic-circuits.test.mjs` and `test/interfaces.test.mjs` check contradictions, witnesses, attributed scope, quantity dependencies and rollback. The long-proof regression must preserve its 19-node [certificate](../wiki.html#definition-certificate) under the ordinary [budget](../wiki.html#definition-budget) and stop without committing under a strict caller [budget](../wiki.html#definition-budget). Proof nodes and execution nodes are different measurements.

### Initial fact providers

The `fact-fragments` [provider](../wiki.html#definition-provider) slot must reconstruct source-backed ground facts through [SOP](../wiki.html#definition-sop). `knowledge.facts` links its ordered [providers](../wiki.html#definition-provider), and `theory.bootstrap` installs the resulting facts through `theory.install-fact` after installing theory rules. This path must serve introductory knowledge and document interpretations without native fact injection or a special per-[pack](../wiki.html#definition-pack) [session](../wiki.html#definition-session) initializer. New facts retain source evidence; logical [certificates](../wiki.html#definition-certificate) remain independently checked before a turn commits. Authored factual supervision remains compiled knowledge rather than an induced reasoning method.

<!-- chapter:formal-relations -->
### Privileged relational mechanism contract

The relational operations implement a finite, signed Horn profile. Predicate names and constants are arbitrary input data. No operation recognizes a natural-language phrase, selects a task, mutates a quantity, or chooses a summary.

The optional elementary theory adds kinship chains, qualitative comparison and containment through [SOP](../wiki.html#definition-sop). Its rules state their assumptions: one reference frame and comparison dimension, a spatial containment interpretation for `in`, and distinct temporal ordering and calendar adjacency relations. Siblings are symmetric but not transitive; a grandparent chain has exactly two parent links. New relation nouns reuse the same language construction. The [reasoning contract](../specsLoader.html?spec=DS005-reasoning-and-state.md) defines the counterexamples and the boundary with movement, defaults and changing state.

An [atom](../wiki.html#definition-atom) has a predicate, an ordered sequence of string terms, an explicit sign, and a [context](../wiki.html#definition-context) identifier. Terms beginning with `?` are variables in this profile. Missing sign means positive; missing [context](../wiki.html#definition-context) denotes the profile's default [context](../wiki.html#definition-context). Canonical [atom](../wiki.html#definition-atom) identity includes all four components. Index identities serialize a tuple, so delimiters occurring in an input name cannot merge distinct predicates or contexts.

A rule is a nonempty conjunction of [atoms](../wiki.html#definition-atom) and one head. Every variable in the head must occur in the body. Each rule belongs to one explicit [context](../wiki.html#definition-context); cross-[context](../wiki.html#definition-context) transfer requires an explicit model program. There are no function symbols or fresh head constants generated during closure.

For initial ground [atom](../wiki.html#definition-atom) set F and rule set R, let T(F) be F union every head obtained from a ground substitution whose instantiated body [atoms](../wiki.html#definition-atom) all belong to F. `relation.close` computes the least fixed point of T by a finite, monotone iteration. Positive and negative [atoms](../wiki.html#definition-atom) are distinct members of the set. A conflict does not license unrelated conclusions. Termination follows from the finite predicates, constants, arities and contexts in the inputs; resource exhaustion throws instead of returning a completed negative result.

`relation.query` joins a conjunction using shared variable bindings. For a single ground [atom](../wiki.html#definition-atom), positive support and support for its explicit complement determine four values: true, false, both, unknown. An existential conjunction is answered by its witnesses; a negative instance alone does not refute the existential. This is an explicit restricted query contract, not an unrestricted first-order negation procedure.

The closure retains a witness per generated [atom](../wiki.html#definition-atom). `relation.certificate` exports the transitive evidence closure of requested roots. The independent [certificate](../wiki.html#definition-certificate) checker validates rule application, bindings and source intervals. `relation.tree` is a bounded display projection; its truncation never replaces the full [certificate](../wiki.html#definition-certificate). Multiple alternative derivations and truth maintenance remain an outstanding requirement for learned policies that retract assumptions.

Validation evidence:

- `test/relational-reference.test.mjs` compares the indexed implementation with exhaustive ground substitution on recursive, signed and contextual theories, and checks hostile delimiter identities.
- `test/kernel.test.mjs` covers scope/range restrictions, cyclic closure, open-world behavior and contradictions.
- `test/model.test.mjs` rejects forged conclusions and source evidence through the separate checker.

The wrappers in `src/semantics/primitives.mjs` contain no document dispatch. Their entire implementation and imports count toward the privileged source inventory. Acceptance of this mathematical mechanism does not clear the unresolved text/chart policies, missing learning derivations or whole-kernel review requirements.
<!-- /chapter:formal-relations -->
