# SXLM handoff

Saved on 2026-09-08, approximately 21:04 Europe/Rome, at the user's explicit request to save the work and close the session. Development is paused. Do not resume automatically, mark the overall objective complete, or deploy the unfinished extension.

## Read this first

The running workbench and the working tree are different revisions. Port **3210** is still serving an earlier verified model. The working tree includes an **unfinished everyday-property extension that exhausts the default inference matching budget**, even on `What is a cat?` in the expanded model. **Do not restart the workbench onto this revision before fixing and validating it.**

No implementation tests, builds or diagnostic Node processes remained running at handoff. The workbench process was PID **4133011**, command `node bin/sxlm.mjs serve --port 3210`. It was deliberately left running. A read-only HTTP check found **8 retained conversations and no queued, preparing, running or validating document jobs**. Recheck actual processes and job states before any later restart; PIDs can change.

The repository is `/home/salboaie/work/sllm/sxlm`; its parent workspace contains the earlier experiments. `git HEAD` at inspection was `3b130617f1b7eb26cbfc53e19b2d5b3db6068a27` (`new version`). Git changed during this session: most accumulated work is already in that HEAD. Do not assume that all recent work is uncommitted or attribute that commit to this assistant. Before adding this handoff, the only reported modified paths were `docs/specs/DS008-learning-and-promotion.md`, `src/learning/properties.mjs`, and `test/properties.test.mjs`. Recheck status before editing and preserve other work.

At the final status check after writing this file, only `?? todo.md` remained; the three tracked modifications were no longer reported. Repository state is changing outside these save operations. Inspect the latest Git log and status on resumption instead of relying on the earlier HEAD snapshot. No commit was issued as part of this handoff.

## User objective and constraints

- Deliver a standalone symbolic language environment using SOP Lang circuits, with natural-language input and output, reasoning, useful summarization/completion, a demonstration UI and honest evaluation.
- Ordinary inference must be symbolic. Coding agents teach or synthesize SOP offline; they must not answer each chat message through an external LLM.
- Chat should be simple: attach a document, wait, discuss it. Different file formats require a useful coding-agent packet, exact source context and reliable validation.
- Build elementary general knowledge and conversational competence, and measure compatibility with the earlier experiments, including CircuitLM. Passing narrow examples is insufficient.
- No natural-language vocabulary, answer cases, Romanian translation rules or benchmark-specific branches in the kernel. Product code, datasets and documentation are English; user-facing conversation may be Romanian.
- SOP is the persistent executable and structured interchange format. Derived in-memory JS values and infrastructure files such as `package.json` are not a second model language.
- Do not import, execute, symlink or vendor sibling implementations. Evaluation may use disclosed, copied case data without executing sibling code.
- Documentation sources belong in the DS files, with HTML generated from them. This `todo.md` is an explicitly requested session handoff, not another normative specification or parallel documentation chapter.
- Preserve default budgets: 100,000 nodes, 100,000 matches and 3,000 cooperative milliseconds per ordinary request, plus other DS002 limits. Do not increase them to turn failures green.
- Preserve source evidence, bindings, explicit negation, attributed contexts, uncertainty and archived conversation identities. Do not present authored knowledge compilation as induced learning.

Read `AGENTS.md`, DS000, DS001, DS002 and the affected specialized DS contracts before further implementation. Documentation work has used the local `.agents/skills/gamp-specs`, `review-specs`, `detect-main-behaviors` and `unslop` instructions. DS003's six main behaviors remain applicable; the property extension is a refinement of existing language/learning behavior. Do not create extra DS files or redesign navigation for this extension.

## Last fully verified milestone — historical evidence

The previous completed milestone added variable-width construction induction and a learned passive predicate in the existing `Comp` category. It also made new chats load bootstrap, elementary knowledge and `english-constructions`.

- `reports/construction-iteration.sop` and `reports/construction-checks.sop`: **222/222 implementation tests**, the standard evaluation gate, learning replay, a 13-stage exact rebuild, standalone checks, browser checks and documentation checks passed for that revision.
- `reports/construction-transfer.sop`: **16/16** passive construction transfer probes, preserved 40 conformance/composition cases, ablation and cache-disabled checks. Participle vocabulary remains authored.
- The unchanged school suite scored **56/88**, with **no improvement over the previous elementary profile** at that milestone. This was not general child-level conversation.
- Bootstrap open-language challenges remained **0/8**; the optional construction profile solved **1/8**.
- `audit:vision` intentionally failed three architectural requirements. Passing engineering tests did not establish the full symbolic-LLM objective.
- Live verification is in `reports/chat-constructions-live.sop`. Existing conversation bases and documents were preserved.

**These results do not validate the current property changes.** `reports/current-tests.tap`, `reports/latest-evaluation.sop`, `reports/rebuild.sop`, `reports/vision-audit.sop` and generated HTML may still describe that earlier milestone.

## What the cat question revealed

The original query-only conversation `e4e5cebb-1e2c-4016-9e0f-75d99eb00c65` retains its two original unknown answers and a later successful answer after a recorded query-only migration. The verified answer was `Vertebrates are animals. Mammals are vertebrates. Cats are mammals.` It is a supported classification, not a rich description or evidence of open conversation.

Its archived base is `6162e3b9d1e463836ecbb3246b7475b8fba379c2a16c1b94071be12975504ca9`. Migration evidence is in `reports/chat-query-migration.sop` and the conversation's `migration-*.sop` receipt. Do not rewrite the original turn files.

The older PDF conversation `46b18bd7-70e3-4d84-a016-0974ac9205da` still contains an unknown answer to the cat question because it retains an older document/model base. Do not silently migrate a document conversation. Its document model is `fded7a58f1df5f7cc54a42453a3234634ba18fb40d3e9e8ddf55e45025da5bdd`.

The last verified fresh-chat model was `c69d0ee1ff404099328f2056583b669d0f073442d494bfa5673f23e7e6278c9f`; native identity was `5824ceb2ce265f7623ae66486d37e3f0ee8a3c2e0156b1ec786f6bfbb7394ded`. No native inference source was changed during the unfinished property iteration. Native changes would require a separate compatibility strategy for these archives, not just a server restart.

## Unfinished implementation on disk

### Construction induction

`src/learning/construction-spans.mjs` and `src/learning/induce-spans.mjs` now accept `semantic: false` on a typed slot. Such a slot contributes syntax only and cannot supply semantic projections. At least one semantic slot is required. The learner still emits typed SOP directly, with bounded structural field projection and sequence composition. The changed learner identity required rebuilding the passive pack.

`training/everyday-language.sop` supplies two induced `Question` constructions: eight annotated property-tail questions and four plural-category/verb questions. These are not autonomous discovery from raw text. Reference policies, lexical tails, mass nouns and meanings remain authored.

An earlier attempt allowed `need` and `made of` in the general property tail. It created competing interpretations for existing individual questions. Those overlapping tails were removed. The general tails are now `used for`, `help us do` and `usually need`; a separate plural-category/verb construction supports questions such as `What do plants need?`. Existing individual verb and preposition questions retain their original semantics. The grammar still lacks general agreement, morphology and unrestricted paraphrase handling.

### Source-qualified properties

`src/learning/properties.mjs` exports `compileConceptProperties`. It compiles source-attributed category properties with `definition`, `all-instances` and `typical` modes. Reified `property` facts distinguish concept and instance domains. `typical_property` does not produce universal or individual conclusions. Functional classification means intended use, not actual use or demonstrated ability. The compiler permits at most five value arguments because reified atoms have an eight-term bound.

The latest compiler creates a shared `category_kind` projection from `declared_category` and `kind`, followed by property-inheritance rules. This was intended to avoid treating a named individual's `kind` classification as a category inclusion. **Its current execution cost is unacceptable; see the blocker below.**

`src/learning/concepts.mjs` now validates standalone concept evidence and emits explicit `declared_category` facts. `scripts/build-elementary.mjs` also emits 65 such declarations. The elementary artifact therefore has 179 asserted facts in total: 114 previous domain facts plus 65 declarations, with 129 rules and 254 raw SOP modules.

`training/everyday-knowledge.sop` contains nine new category declarations and eleven selected properties: senses, tool functions, universal plant water need and qualified typical plant light need. Sources and caveats are embedded in the teaching data. These are authored paraphrases with references and spans, not scraped comprehensive knowledge or a learned ontology. Do not convert typical light requirements, material properties, rain/shelter assumptions or other benchmark simplifications into false universal rules.

### Packs, rendering, SDK and profile wiring

- `scripts/build-everyday.mjs` builds `packs/everyday-knowledge.sop` against bootstrap + constructions + elementary. Its training algorithm is `source-property-construction-family-v1`.
- `sop/everyday/` contains four authored reference helpers. `sop/concept/render-property*.sop` renders supported property selections using supplied forms and clauses. `render-proof.sop` reverses certificate display order so a classification description begins nearer the queried type. No extra descriptive cat facts were invented.
- `src/chat/agent-sdk.txt` accepts `properties` with exact attachment spans. `src/chat/agent-task.txt` explains modes, intended function, lexical supervision and limitations. This uses the ordinary document validator; it has not received a fresh real-Codex demonstration in this iteration.
- `src/chat/controller.mjs` is already wired to add the everyday pack to **new** conversations. `elementary: false` disables all three optional packs. This wiring is on disk, not deployed in the already running workbench. It is the reason a restart must wait for validation.
- `scripts/build-model.mjs` has 14 stages. `check:learning`, `scripts/check-rebuild.mjs`, the construction replay helper and the chat-profile school runner include the everyday extension.
- `scripts/support/construction-replay.mjs` reproduces the full everyday artifact and credits only its induced procedure modules, not authored knowledge or constructors.

Artifact observations at handoff (raw `sop` module counts are not audit skill counts):

| Pack | Raw modules | `executionDigest(pack)` |
| --- | ---: | --- |
| english-bootstrap | 873 | `d2f6a2b2600fc21b89c2b736e21e0205b79ce12e78b7c89f3e8cb9e7cceb1db6` |
| english-constructions | 5 | `f1ef1e53c6b14da5e1edc1c3ae24334dc68fc454cc1b932e7138c5e2c20f57e1` |
| elementary-knowledge | 254 | `56e63381c6c86933963d0ecbcb23a9ee851c8b516027655d10f129e4cd93d1b5` |
| everyday-knowledge | 87 | `763c2b589194a5254c9d393679acfa070a4ead770e1b0dc0a52f7836c2a1bf14` |

These are observations of unfinished artifacts, not release identities. The last complete build log mentions 85 everyday modules; a later everyday-only build produced 87. Reproduce all stages after finalizing the implementation.

## Immediate blocker: expensive category joins

Before adding the category guard, targeted probes successfully answered eye/tool functions, plant needs, typical needs, named tool uses and existing `need`/`made of` questions. That earlier intermediate variant was not fully verified and had an ontology problem: `kind(individual, category)` could incorrectly feed category-property inheritance.

Adding `declared_category` to each inheritance rule exhausted the matching budget. Reordering premises did not fix it. Factoring the guard into a shared `category_kind` rule **also did not fix it**; the most recent three probes all failed with **`resource: matches`, `matches: 100001`**:

- `What do crystal beacons emit?`
- `Rhea is a crystal beacon. Does Rhea need shade?`
- `What is a cat?`

The last variant used 87 everyday modules plus the evaluator's fictional property domain. It failed well below 100,000 execution nodes and 3,000 milliseconds, so this is not evidence that either of those limits needs raising.

Inspect `src/semantics/logic.mjs`: `indexFacts` indexes by context, polarity, predicate and arity only. `join` orders premises by signature bucket length, then scans the entire matching bucket for each row. It does not index bound argument positions. `close` reevaluates joins over each round's full snapshot before filtering for delta premises. Category membership guards therefore create many repeated candidate matches. Separate property compilations can also install equivalent projection rules with different source provenance; inspect actual rule identities before claiming they are deduplicated.

The final completed diagnostic of **bootstrap + constructions + elementary only** found 119 `kind` facts, 280 closure facts, three closure rounds, **28,814 matches**, and approximately 54 ms in direct formal closure. That narrower profile still answered the cat question. This helps isolate the regression to the added property/type projection path rather than the whole preexisting model.

Possible next investigations, **not implemented or validated decisions**:

1. Represent category-inclusion edges distinctly from instance descriptions at their source, avoiding the repeated broad membership join. Preserve source-backed inheritance and existing classification answers. Do not simply remove the type distinction to make tests pass.
2. Factor shared semantic theory at a model-level provider rather than duplicating it per knowledge compiler, then measure the actual matches saved. The per-compilation factoring already attempted was insufficient.
3. Consider a general bound-argument index or improved finite-join mechanism only with differential/reference tests, honest budget accounting and a deliberate native-identity/archive compatibility plan. Native edits would invalidate the straightforward loading of current archived conversations; do not casually take this route during a live service session.

No choice among these investigations was finalized. Avoid another long chain of grammar patches before resolving this measured cost and representation problem.

## Tests and evidence still required

- `test/properties.test.mjs` adds three tests; `eval/property-cases.mjs` has twelve same-author transfer/counterexample gates; `test/support/property-domain.mjs` supplies a separate fictional ontology and a new `emit` relation. The teacher file does not contain these gate texts.
- The last saved focused run, `reports/current-property-tests.tap`, is **2 passed / 1 failed**. The failure was transfer evaluation under matching-budget exhaustion. Subsequent compiler factoring and extra assertions were not followed by a passing run. The newest direct probes still failed.
- An earlier fixture omission for the mass noun `shade` was fixed in the evaluator's supplied lexicon. An optional-chain error in a test was fixed. Neither fixes the current matching-budget failure.
- New assertions cover positive/negative property conclusions, category guards, syntax-only slot inertness and replay tampering. They need execution after the final fix.
- `test/concept-document.test.mjs` now exercises the actual copied SDK with concept declarations and an intended-function property. Its expected counts are four new facts and seven rules under the present compiler. Reassess those counts if representation changes; preserve the observable source validation and novel-query assertions.
- `test/chat-constructions.test.mjs` now checks that a fresh chat includes the everyday pack and can answer the pencil-use query. This must pass before deployment.

Recommended verification order after a concrete fix:

```sh
npm run build:model
node --test --test-concurrency=1 --test-reporter=tap test/properties.test.mjs test/concept-document.test.mjs test/chat-constructions.test.mjs
node eval/compatibility/run-early-school.mjs --chat-profile
npm test
npm run eval
npm run check:learning
npm run test:rebuild
npm run test:standalone
npm run audit:vision
npm run test:browser
```

Run sequentially, inspect each result, and stop to diagnose failures. `audit:vision` is expected to remain nonzero while architectural requirements are unmet. Do not weaken it. The school runner also exits nonzero until all 88 cases pass; preserve that result honestly and compare individual cases with the historical 56/88 profile. No current school improvement has been measured for this extension; eight tool/sense gains were a hypothesis, not a result.

Do not run the old `scripts/write-verification.mjs` blindly: its prerequisites were tied to previous profiles. Write a new identity-bound iteration receipt only from completed checks. Keep historical evidence distinct from current test results.

## Documentation pending

DS004, DS005, DS008 and DS013 have draft updates for property language, qualifications, type guards, syntax-only slots, SDK support and new-chat composition. DS008 describes the most recent `category_kind` factoring, but this is not a validated release. Reconcile these contracts with the actual final implementation.

Generated HTML has **not** been rebuilt for these changes. DS000, DS011, README and other measured counts still need refreshing from actual evidence. Do not replace 222/222 or 56/88 with guesses. In particular, raw pack module counts differ from installed audit counts.

After the code is verified, finish the DS-only source updates, preserve the existing documentation map/wiki/navigation, and run:

```sh
npm run docs:build
npm run docs:check
node scripts/docs-browser-smoke.mjs
```

## Safe live deployment and retained documents

Before restarting port 3210, capture each conversation's complete metadata, document list, model/base identities and active-job states in SOP. Avoid building records with `undefined` fields, which the SOP writer rejects. Require no active document jobs, verify the actual process command/cwd, stop only the intended workbench and confirm it exits before starting its replacement. Do not start a second server and ignore `EADDRINUSE`.

After a validated restart, verify a fresh conversation through actual HTTP: cat classification, a property query, typical-vs-universal distinction, passive role ordering and an unsupported counterexample. Verify that archived conversation/document identities remain unchanged. Do not automatically rewrite older document bases or regenerate their interpretations.

Useful retained document conversations:

- Real Codex DOCX probe: chat `82343310-f3d8-498d-92cf-c296e2278c8a`, job `62982e63-6f68-481c-a58e-d53fcbe2c01d`, document model `f2a2634e43408789dee0161c817f81e4d083c0101689168949f0ba0971831d0a`. `Is Rowan careful?` was verified with a valid proof after the previous restart.
- User PDF: chat `46b18bd7-70e3-4d84-a016-0974ac9205da`, job `0d928fed-97c9-463d-b6b1-958f9670927a`. The 148-page source has only a partial symbolic interpretation; do not claim comprehensive document understanding.
- Excel probe: chat `87731dc0-bf47-4186-bdb0-486bfa2fbf40`, model `3054cfd1e0da041f20ebfa14aaabcb40b078bdf424b9a709f8e51c642f1b6fda`. Recheck job `203e85ac-0193-431c-a287-613d8be99d6a` successfully validated a retained real-Codex artifact with eight probes. Do not rerun an expensive coding job merely to repeat that evidence.
- Chat `cafe2f76-4f84-4d83-9f16-f067b6d5ff9e` retains a ready TXT interpretation and a failed user DOCX job `c6849a10-86c6-4fc0-9f02-dcff5d573b31`. That old failed job lacks protected attempt snapshots and cannot use the later recheck path; a retry would require a new coding job.

No real coding-agent document job was launched during the unfinished property iteration.

## Larger work remains

The model is still a finite authored-and-induced symbolic language workbench. General dialogue, reference resolution, broader event/time semantics, robust causality/defaults, natural numeric comparisons and unrestricted summarization/completion remain unproven or unsupported. Increasing vocabulary alone has not established that this architecture scales to a useful symbolic LLM.

The remaining school failures include missing knowledge, unsupported grammar, temporal state changes, qualified/default reasoning and formal comparison contracts. One epistemic case contains a `Socrate`/`Scorate` spelling mismatch; do not silently identify those names to pass it. Some material and plant expectations are typical rather than universal. Preserve the imported cases and describe assumption disagreements separately.

Compatibility with all earlier experiments, including the wider CircuitLM insights, remains unfinished. The next session should first restore a correct, measurable property extension within existing budgets, then use held-out compositions and actual document chat to decide whether its generality justifies further investment. Do not present local transfer or a larger circuit count as completion of the user's objective.
