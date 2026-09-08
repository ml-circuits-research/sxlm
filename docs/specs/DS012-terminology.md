---
title: DS012-terminology
summary: Defines canonical terminology, stable reference anchors and the boundaries shared by language, execution and learning contracts.
---

## Introduction

This specification owns the project terminology published at [Wiki](../wiki.html). Other specifications must use these meanings and link to the corresponding definition when introducing a project concept.

## Core Content

<!-- chapter:wiki -->
### Project terminology

This is the canonical terminology reference for [SXLM](../wiki.html#definition-sxlm). Each entry explains the role and boundary of a project concept. The specifications define obligations; the task guides show how those obligations appear in use.

#### SXLM

[SXLM](../wiki.html#definition-sxlm) is an independent symbolic language workbench built around a versioned library of executable [circuits](../wiki.html#definition-circuit). Developers supply English text or explicit formal problems and inspect the answer, interpretation and evidence. Coding agents teach and propose programs offline. The delivered model supports a finite English [grammar](../wiki.html#definition-grammar), signed reasoning, extractive summaries and finite-[context](../wiki.html#definition-context) completion. Its architectural objective also requires a small fully general host and learned competence throughout the library. Passing local tasks does not establish that broader objective. The vision audit records the difference.

#### SOP

[SOP](../wiki.html#definition-sop) is [SXLM](../wiki.html#definition-sxlm)'s source language for typed [circuit](../wiki.html#definition-circuit) programs and its constructor-only interchange syntax for structured data. A source module declares inputs, producers and an output, while wire references express dependencies. [Packs](../wiki.html#definition-pack) quote executable sources and construct their metadata using the same scalar and wire syntax. The data reader cannot execute a quotation; installation separately compiles the executable profile. [SOP](../wiki.html#definition-sop) therefore provides one persistent model representation without serializing between adjacent runtime nodes. JavaScript arrays and records remain permitted as in-memory wire values. The `.sop` extension alone does not establish [SSA](../wiki.html#definition-ssa) safety; compilation and reader checks do.

#### SSA

Static single assignment means that each input or produced wire has one definition in its graph. [SXLM](../wiki.html#definition-sxlm) validates producer uniqueness, references and acyclic dependencies. It can topologically resolve forward references, but it rejects cycles and missing wires. Static calls and structured iteration preserve this rule: iteration repeatedly invokes a separate body with a new immutable state, without a backward wire in the enclosing graph. [SSA](../wiki.html#definition-ssa) checking protects composition structure. Type checks, inert-data validation and [budgets](../wiki.html#definition-budget) supply additional guarantees that single assignment alone cannot provide.

#### Circuit

A [circuit](../wiki.html#definition-circuit) is a typed program with declared inputs, an acyclic graph of producers and an output reference. Its nodes construct values, invoke native operations or call statically selected [circuit](../wiki.html#definition-circuit) programs. Structured control forms include mapping, folding, choices, attempts and [guarded iteration](../wiki.html#definition-guarded-iteration). A model author installs [SOP](../wiki.html#definition-sop) source; the compiler produces the transient typed graph executed by the [VM](../wiki.html#definition-vm). [Circuit](../wiki.html#definition-circuit) identity includes its observable executable dependencies. A module may be an authored policy, a learned program or a compiler fragment, so counting [circuits](../wiki.html#definition-circuit) does not measure learned skills.

#### VM

The [circuit](../wiki.html#definition-circuit) virtual machine validates contracts, owns immutable values, invokes declared operations and accounts for execution. It copies caller data into owned values and returns detached outputs. Static target dependencies and native versions participate in cache identity. The [VM](../wiki.html#definition-vm) provides general computation; it must not acquire vocabulary or task-specific answers. It runs within a trusted JavaScript process with cooperative limits. It is not an operating-system sandbox or a security boundary against code that controls that process.

#### Pack

A [pack](../wiki.html#definition-pack) is a versioned `sxlm.pack.v1` artifact that supplies [SOP](../wiki.html#definition-sop) modules, provenance, dependencies, entrypoints and optional [providers](../wiki.html#definition-provider), [linkages](../wiki.html#definition-linkage) and training evidence. A base [pack](../wiki.html#definition-pack) establishes task entrypoints; an incremental candidate may add compatible behavior but cannot redefine installed [circuit](../wiki.html#definition-circuit) identities or replace those entrypoints. The loader rejects active raw [grammar](../wiki.html#definition-grammar), theory, text, corpus and graph-object fields. [Pack](../wiki.html#definition-pack) identity preserves order-sensitive executable content. Offline input records may describe proposed knowledge, but deployment requires its [circuit](../wiki.html#definition-circuit) representation.

#### Bootstrap

The English [bootstrap](../wiki.html#definition-bootstrap) is the base [pack](../wiki.html#definition-pack) loaded by a default `SymbolicModel`. It establishes [grammar](../wiki.html#definition-grammar), formal theory, text configuration, task policy and initial learned or memorized components. Model installation reconstructs these resources through [circuits](../wiki.html#definition-circuit) and seals them. The [bootstrap](../wiki.html#definition-bootstrap) mixes authored and induced knowledge. Its 878 installed modules include compilation fragments and [provider](../wiki.html#definition-provider) [linkages](../wiki.html#definition-linkage); 288 reproduced fragments do not mean 288 discovered language skills. The remaining authored knowledge and native policies keep the full learning objective unfulfilled.

#### Grammar

The [grammar](../wiki.html#definition-grammar) describes categories, productions, lexical entries, terminal classes and segmentation metadata that govern supported language. A production combines child meanings by calling a semantic [circuit](../wiki.html#definition-circuit). [SXLM](../wiki.html#definition-sxlm) reconstructs [grammar](../wiki.html#definition-grammar) fragments through [providers](../wiki.html#definition-provider) and merges them under collision rules. The native chart recognizes the resulting productions, while [SOP](../wiki.html#definition-sop) callbacks prepare and match terminals. This supports compositional categories and recursion within explicit bounds. A successful formal proof does not establish that this finite [grammar](../wiki.html#definition-grammar) captures arbitrary English or resolves an ambiguous interpretation correctly.

#### Lexicon

The [lexicon](../wiki.html#definition-lexicon) associates category and surface spelling with semantic values. [SOP](../wiki.html#definition-sop) preparation normalizes entries and constructs an index with collision-safe category/spelling keys. Terminal policy can return multiple values, preserving insertion order and distinctions such as signed zero or record order when later computation can observe them. The index is a derived immutable value produced from [circuit](../wiki.html#definition-circuit) knowledge. It is not a separately authored runtime answer table. Lexical policy is authored; the reused normalization procedure has its own synthesis evidence.

#### Semantic instruction

A [semantic instruction](../wiki.html#definition-semantic-instruction) is a [circuit](../wiki.html#definition-circuit)-produced interpretation consumed by the state and task policies. The [bootstrap](../wiki.html#definition-bootstrap) uses assertions, rules, queries and ordered quantity instructions. Composition must preserve subject holes, existential referents, argument roles, polarity and [context](../wiki.html#definition-context) until lowering produces the formal values used by inference. This common representation lets several English constructions reuse the same formal behavior. It does not supply general event intervals, discourse reference or unrestricted first-order logic. Unsupported meanings remain explicit gaps.

#### Atom

An [atom](../wiki.html#definition-atom) is a signed relational statement with a predicate, ordered string terms and a [context](../wiki.html#definition-context). Ground [atoms](../wiki.html#definition-atom) describe explicit facts; terms beginning with `?` act as variables in the formal rule profile. Positive and negative [atoms](../wiki.html#definition-atom) are distinct pieces of support. Their identities include argument order, sign and [context](../wiki.html#definition-context), so related-looking strings cannot merge different facts through a delimiter collision. [Atoms](../wiki.html#definition-atom) are formal input values, not statements whose real-world truth the system independently establishes. Language interpretation and source evidence determine their provenance.

#### Signed Horn reasoning

[Signed Horn reasoning](../wiki.html#definition-signed-horn-reasoning) is [SXLM](../wiki.html#definition-sxlm)'s finite rule profile. A rule joins a nonempty conjunction of premises under one shared substitution and emits a head whose variables are already bound. Repeated application computes a least fixed point over a finite active domain. Positive and explicit negative support coexist without logical explosion. The profile has no negation by failure, automatic contraposition or unrestricted existential rule heads. It is useful for checkable relational inference; tasks outside that profile need another explicit representation and justified method.

#### Context

A [context](../wiki.html#definition-context) identifies the attribution scope of a formal fact or rule. For example, a person's stated belief belongs to a separate scope and must not silently become a world fact. [Context](../wiki.html#definition-context) identity participates in [atom](../wiki.html#definition-atom) matching, rule validation and evidence. Composition must preserve it across nested language constructions. A text-completion `context` option is supplied source text, a separate API use of the same ordinary word; it does not create an attributed logical theory. In finite-[context](../wiki.html#definition-context) completion, the [context](../wiki.html#definition-context) is also the bounded preceding token window used to select observed frequencies. These meanings are distinguished by the API and formal representation. None provides arbitrary discourse-reference resolution.

#### Coverage

Interpretation [coverage](../wiki.html#definition-coverage) records which source segments received supported meanings and which produced unparsed, ambiguous or invalid gaps. A caller uses it alongside answer truth and formal verification to understand the scope of the result. Supported statements may coexist with gaps in one turn, and relevant state dependencies can invalidate exact quantity answers. [Coverage](../wiki.html#definition-coverage) is not a language-quality score or a [certificate](../wiki.html#definition-certificate) of semantic fidelity. A formally valid result remains conditional on the interpretation used to derive it.

#### Certificate

A [certificate](../wiki.html#definition-certificate) is the complete reachable proof graph for a logical answer. It includes roots and the fact or rule evidence needed to replay them, with bindings and source references. The host checker reconstructs each formal step before [session](../wiki.html#definition-session) commit and computes verification metadata independently of candidate claims. A smaller display tree is only a presentation of that evidence. The [certificate](../wiki.html#definition-certificate) establishes entailment from the represented premises; it does not prove that the source is true or that the English parser omitted no nuance.

#### Source span

A [source span](../wiki.html#definition-source-span) is an exact half-open interval measured in UTF-16 code units of the original text. Evidence uses those offsets to recover the supporting substring. Parser token records must be ordered and non-overlapping, and their text must equal the original slice. Normalized token values may have a different length, so they cannot substitute for source offsets. Summary evidence also refers to original spans. Span validity proves the location of retained wording, not the correctness of an interpretation or the truth of that wording.

#### Session

A [session](../wiki.html#definition-session) owns conversational state for one exact model identity. `Session.ask` runs a turn on candidate state and commits after required checks; `SymbolicModel.ask` creates a new [session](../wiki.html#definition-session) for each call. Snapshots are detached values that can be restored only under the same model identity. Reset returns to a copy of the [circuit](../wiki.html#definition-circuit)-produced initial state. Browser [sessions](../wiki.html#definition-session) are process-local and may be evicted or cleared after activation. They are separate from the persistent model registry and do not train the model automatically.

#### Execution identity

[Execution identity](../wiki.html#definition-execution-identity) binds content whose differences can affect program behavior. [SXLM](../wiki.html#definition-sxlm) preserves record enumeration order and signed zero when hashing programs, [packs](../wiki.html#definition-pack) and cache inputs. Model identity additionally includes the ordered knowledge manifests, static native sources and Node component versions. Changed loaded source requires a fresh process. This makes reuse and restoration reproducible within the declared trusted-host profile. It is not attestation against a hostile process or a guarantee that two different programs have different mathematical behavior on every input.

#### Structural equality

[Structural equality](../wiki.html#definition-structural-equality) is the data comparison contract used for ordinary evidence and canonical lookup. It treats records independently of insertion order and normalizes signed zero. Canonical [SOP](../wiki.html#definition-sop) encoding follows that contract. [Execution identity](../wiki.html#definition-execution-identity) is stricter because record enumeration and serialization can observe those differences. A developer must choose the appropriate contract for the operation: canonical data equality cannot safely identify an executable program or a cached result when later nodes can distinguish the values.

#### Provider

A [provider](../wiki.html#definition-provider) is a named installed [circuit](../wiki.html#definition-circuit) contributing a value to a declared slot. [Grammar](../wiki.html#definition-grammar) fragments, theory fragments, frequency observations and source memory use [providers](../wiki.html#definition-provider) so [packs](../wiki.html#definition-pack) can add compatible knowledge. [Providers](../wiki.html#definition-provider) accept a shared typed input and return values that a [linkage](../wiki.html#definition-linkage) combines in a declared order. Removing a [provider](../wiki.html#definition-provider) connection removes its contribution to the model even if its module remains installed. A provenance [receipt](../wiki.html#definition-receipt) without the correct deployed [provider](../wiki.html#definition-provider) wiring is therefore insufficient to reproduce behavior.

#### Linkage

A [linkage](../wiki.html#definition-linkage) is a static module-composition declaration with an identifier, [provider](../wiki.html#definition-provider) slot, seed and reducer. Installation emits ordinary typed call nodes for the ordered [providers](../wiki.html#definition-provider) and reduction. The resulting program participates in the same dependency and cache identity rules as other [circuits](../wiki.html#definition-circuit). Incompatible contracts, unknown [providers](../wiki.html#definition-provider) and redefinitions fail. A single [linkage](../wiki.html#definition-linkage) supports at most 127 [providers](../wiki.html#definition-provider) within its graph bound. The contract is explicit finite composition, not dynamic dispatch to arbitrary JavaScript or unbounded plugin loading.

#### Construction induction

[Construction induction](../wiki.html#definition-construction-induction) learns a reusable production in an existing [grammar](../wiki.html#definition-grammar) category from annotated examples. The teacher supplies the target category and typed slots. The legacy form aligns varying token columns; the span form accepts variable-width expressions and learns nested field selection and sequence composition from their parsed meanings. The learner emits a production and typed [SOP](../wiki.html#definition-sop) [circuit](../wiki.html#definition-circuit), retaining supervision and replay evidence. Ambiguous field alignments and unexplained changes are rejected, but the bounded search and its preferences do not prove a unique hypothesis. Transfer into new nouns, predicates, structural positions and attributed contexts tests reuse beyond replay. This method does not discover arbitrary syntax or an ontology from unlabeled text.

#### Program synthesis

[Program synthesis](../wiki.html#definition-program-synthesis) searches compositions of a supplied pure typed library that match demonstrations. Inputs, output type, operation choices, constants and search bounds are teacher supervision. [SXLM](../wiki.html#definition-sxlm) emits [SOP](../wiki.html#definition-sop), compiles it and replays the observed outputs with a reproducible [receipt](../wiki.html#definition-receipt). It can reuse an already learned [circuit](../wiki.html#definition-circuit) as a library operation. The search is bounded and uses observational pruning, so it is neither complete over all programs nor a proof that the selected program is uniquely correct. Transfer and counterexamples remain necessary.

#### Sequence learning

[Sequence learning](../wiki.html#definition-sequence-learning) consumes source text offline and compiles finite-[context](../wiki.html#definition-context) observations into [circuit](../wiki.html#definition-circuit) memory. Frequencies are learned counts; source text is remembered evidence; the [context](../wiki.html#definition-context) bound is a supplied parameter. Inference reconstructs needed values through installed [providers](../wiki.html#definition-provider) rather than reading or counting a raw corpus field. This supports completion and attested continuation. It does not turn corpus frequency into a logical fact or add a semantic [grammar](../wiki.html#definition-grammar). Compiler pages are representation fragments, not independent language skills.

#### Promotion

[Promotion](../wiki.html#definition-promotion) activates a validated model extension in a CLI registry. It reruns transfer and regression evaluation against the actual parent under a writer lock, checks improvement and refuses stale dependencies or literal gate leakage. Candidate [packs](../wiki.html#definition-pack) and [receipts](../wiki.html#definition-receipt) receive content-addressed storage before the active manifest is atomically replaced. Rollback restores the earlier lineage. Browser activation is a separate process-local demonstration path. [Promotion](../wiki.html#definition-promotion) is evidence-governed model mutation, not execution of an agent's source code or acceptance based only on a saved [receipt](../wiki.html#definition-receipt).

#### Receipt

A [receipt](../wiki.html#definition-receipt) records evidence about a learning derivation, validation or transformation. Depending on its contract, it binds source observations, teacher choices, learner/runtime identity, emitted content, parent model and evaluation outcomes. Reproduction must check actual installed content, not merely the presence of the [receipt](../wiki.html#definition-receipt). Removing learning evidence can invalidate audit credit while leaving execution unchanged. A validation [receipt](../wiki.html#definition-receipt) cannot bypass fresh parent checks during [promotion](../wiki.html#definition-promotion), and a compilation [receipt](../wiki.html#definition-receipt) does not establish that authored knowledge was induced.

#### Ablation

[Ablation](../wiki.html#definition-ablation) removes or replaces a specific learned component and measures the resulting loss of behavior. [SXLM](../wiki.html#definition-sxlm)'s procedure and normalization checks then restore the component and test recovery with an unchanged native host. This supplies causal evidence that the deployed program is used, beyond a matching provenance label. The tested replacement and task scope must be explicit. Successful [ablation](../wiki.html#definition-ablation) on public finite cases does not establish broad or blind language generalization.

#### Budget

A [budget](../wiki.html#definition-budget) bounds cooperative execution work, including [circuit](../wiki.html#definition-circuit) nodes, inference steps, facts, matches, tokens and elapsed time. Each operation charges the relevant work, and resource exhaustion prevents an unfinished computation from being reported as a completed answer. A reasoning turn rolls back on exhaustion; other task APIs may throw. Installation and failure wording have separate bounded work. These limits are implementation accounting inside a trusted process, not operating-system isolation or a strict latency service-level guarantee. A full suite consists of many bounded requests.

#### Native closure

The [native closure](../wiki.html#definition-native-closure) is the complete static privileged implementation imported by the model, including code outside `src/kernel/`. It contains the [VM](../wiki.html#definition-vm), compiler and data reader, orchestration, formal operations and witness checkers. Its source bytes and environment enter identity. The audit inventories 83 registered operations in 19 files and 92,421 bytes. That inventory does not approve minimality or generality. Native token boundaries, word [extraction](../wiki.html#definition-extraction) and chart scheduling remain unreviewed policies.

#### Text policy

A [text policy](../wiki.html#definition-text-policy) is an explicit [SOP](../wiki.html#definition-sop) program family that determines token values and document segmentation. Model authors supply its programs; offline learners capture the transitive dependencies so teaching and deployed completion can be compared under the same interpretation. `textPolicyForModel` captures the model's tokenizer and the shared segmentation root. `createTextProcessor` validates and executes that family using a sealed [VM](../wiki.html#definition-vm), and sequence [receipts](../wiki.html#definition-receipt) bind its compiled identity. The persistent specification contains quoted [SOP](../wiki.html#definition-sop) source, not a second executable graph format. The [bootstrap](../wiki.html#definition-bootstrap) family uses authored segmentation and lexical policies and a synthesized [normalization method](../wiki.html#definition-normalization-method). Native token boundaries and summary word [extraction](../wiki.html#definition-extraction) are separate architectural limitations. A matching [text policy](../wiki.html#definition-text-policy) establishes interpretation consistency for the recorded programs; it does not establish general language understanding.

#### Normalization method

`learned.lexical.normalize` is a synthesized two-operation program that applies explicit Unicode compatibility normalization and lower casing in the selected order. Eight observations and a teacher-chosen library distinguish that composition from alternatives. Literal terminals, lexical entries and parser token values reuse it. Sixteen separate literal pairs and parser [ablation](../wiki.html#definition-ablation) test transfer. Its learning [receipt](../wiki.html#definition-receipt) does not cover the surrounding authored lexical policy, the native token boundary rule or general morphological understanding.

#### Coverage method

`learned.set.coverage` checks whether an available finite collection covers a required collection through a synthesized operation composition. Planning reuses it for both action preconditions and final goals. Its teacher packet contains eight examples and a pure typed library; a separate 71-case evaluation and further method reuse test its scope. It concerns set membership, not interpretation [coverage](../wiki.html#definition-coverage). The planning strategy around it remains authored, and the method's successful derivation does not establish learned search policy.

#### Extractive summary

An [extractive summary](../wiki.html#definition-extractive-summary) selects and copies original sentence spans under explicit scoring and redundancy policy. Its purpose is to shorten text while preserving the wording of the selected passages. [SXLM](../wiki.html#definition-sxlm) records source witnesses and checks exact slice equality. The scorer has limited numeric-learning evidence, while the selection strategy remains authored. [Extraction](../wiki.html#definition-extraction) cannot establish source truth, repair ambiguous references or guarantee that every important qualification survives a requested length. Abstractive rewriting has a different contract and is not implied by source fidelity.

#### Grounding

[Grounding](../wiki.html#definition-grounding) identifies the relationship between an output and its supporting material. In completion, attested text is an actual source continuation, while distributional text comes from observed finite-[context](../wiki.html#definition-context) frequencies. Summary [grounding](../wiki.html#definition-grounding) identifies exact selected [source spans](../wiki.html#definition-source-span). Logical evidence has a separate [certificate](../wiki.html#definition-certificate) contract. Callers must not treat these relationships as interchangeable: copied source text may be false, and a plausible generated continuation is not an entailment proof. Unknown [coverage](../wiki.html#definition-coverage) must remain visible when no useful support is available.

#### Guarded iteration

[Guarded iteration](../wiki.html#definition-guarded-iteration) is the [VM](../wiki.html#definition-vm)'s static `iterate` control form. It takes a seed state, body, boolean guard and explicit transition bound. At each state, a false guard returns that state; a true guard at the bound raises resource exhaustion; otherwise the body produces the next immutable state. Both target definitions and control inputs affect identity. It supports finite search and other numeric, string or record computations without making the enclosing [SSA](../wiki.html#definition-ssa) graph cyclic. It does not install recursively self-calling modules or permit arbitrary unbounded loops.

#### Four truth values

For a ground atomic query, positive and explicit negative support produce four symbolic results. Positive only is `true`, negative only is `false`, both is `both`, and neither is `unknown`. These are status strings, not JavaScript booleans. Contradiction does not imply unrelated conclusions, and missing evidence does not mean falsehood. Existential conjunctions have a separate witness-based query contract. A truth value must be read alongside [coverage](../wiki.html#definition-coverage), source assumptions and [certificate](../wiki.html#definition-certificate) validity.
#### Codex

[Codex](../wiki.html#definition-codex) is the external coding-agent executable used by document teaching. The workbench starts `codex exec` in a private workspace containing the attachment, [extraction](../wiki.html#definition-extraction), parent model contracts and offline compiler SDK. [Codex](../wiki.html#definition-codex) authors a [SOP](../wiki.html#definition-sop) candidate and local tests; host checks govern its use in a conversation. The installed CLI requires its own authentication and network access. It is absent from the symbolic inference path and cannot supply a remote answer fallback. Its authorship does not turn compiled source observations into induced knowledge.

#### Coding job

A [coding job](../wiki.html#definition-coding-job) is one persisted document-processing operation, including an initial candidate and at most one automatic correction after host validation rejects it. It binds the uploaded document and actual parent model, prepares an [extraction](../wiki.html#definition-extraction), supervises [Codex](../wiki.html#definition-codex), validates a candidate and records a terminal result. Only a successfully checked candidate can become active in its originating conversation. Cancellation, process interruption, a stale parent, invalid source evidence or failed regression checks prevent activation. The job's operational time and concurrency limits are separate from per-question model [budgets](../wiki.html#definition-budget).

#### Document interpretation

A [document interpretation](../wiki.html#definition-document-interpretation) is an authored symbolic account of the statements and rules extracted from an attachment. It is represented by conversation-local [SOP](../wiki.html#definition-sop) [providers](../wiki.html#definition-provider) with source evidence and explicit limitations. Existing language constructions and reasoning policies use that knowledge to answer questions. The interpretation can omit unsupported material or misread a source; exact attribution and valid inference do not establish semantic fidelity. Adding document observations can legitimately change a prior unknown or selection answer, which is why procedural regressions are checked separately from those observations.

#### Extraction

[Extraction](../wiki.html#definition-extraction) is the offline conversion of an attachment into text that a coding agent can inspect and cite. It preserves the original attachment identity, extracted text identity, method and known format limitations. Protected source fragments live outside the agent's writable workspace. PDF reading order, OCR, table geometry and cached spreadsheet values can limit fidelity; evidence offsets identify extracted UTF-16 text, not visual page rectangles. [Extraction](../wiki.html#definition-extraction) is document decoding outside the inference kernel and must not select answers on behalf of the symbolic model.
<!-- /chapter:wiki -->
