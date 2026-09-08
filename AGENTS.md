# SXLM development contract

## Scope

The project is standalone. Do not import, symlink, execute or vendor sibling repositories. All product text, documentation, specifications, comments, datasets and language resources must be English. Preserve the user's work and do not claim general language competence from local examples.

## Mandatory Reading Order

Read `docs/specs/DS000-vision.md`, `docs/specs/DS001-coding-style.md`, `docs/specs/DS002-sop-runtime.md` and the relevant specialized contracts before implementation work. The DS specifications are the source of truth for documented behavior; DS000 contains the binding theory, completion requirements and invariant identifiers.

For documentation changes, read `docs/index.html`, the canonical `docs/wiki.html`, the relevant HTML chapter and affected DS files. Follow the documentation rules in `DS001-coding-style.md`. Reassess the evidence-supported main behavior set before creating or changing DS003 when product purpose, user outcomes, essential interfaces, hidden functional consequences or architectural paths change.

## Current Skill Catalog

[SXLM](docs/wiki.html#definition-sxlm) does not implement or distribute product skills. Imported agent tooling is outside the model runtime and the product documentation set. A changed product skill catalog must be reflected here and in the relevant product documentation. Downstream consumers must keep imported-tool instructions in their local tooling folders; imported skills must not acquire host-project HTML pages or DS files merely because agents use them.

## Repository Rules

`src/kernel/` contains general data, term, arithmetic and [circuit](docs/wiki.html#definition-circuit) mechanisms. No natural-language vocabulary, sentence templates, answer tables, language-specific regexes or benchmark entities belong there. Audit the complete privileged import closure, including code outside that directory. A small interpreter file alone does not prove a small general kernel.

`src/language/` implements recognition, segmentation, lowering and realization contracts with explicit policy boundaries. [Grammar](docs/wiki.html#definition-grammar) productions, lexical forms, punctuation policy, semantic composition, response templates and task entrypoints belong in versioned [circuit](docs/wiki.html#definition-circuit) [packs](docs/wiki.html#definition-pack). `src/semantics/` implements formal contracts and must not recognize input phrases. Truth, interpretation [coverage](docs/wiki.html#definition-coverage), inference completeness, [context](docs/wiki.html#definition-context) and evidence must remain separate.

Language/domain knowledge belongs in inert `sxlm.pack.v1` [SOP](docs/wiki.html#definition-sop) artifacts. New task policy must use typed [SOP](docs/wiki.html#definition-sop). Do not expand the retired expression notation for new tasks. Its compiler is offline only; install the complete generated graph family and never an expression-interpreter node. Do not disguise handwritten or compiled resources as learned resources. A new semantic construction should compose in an existing category instead of creating a new end-to-end sentence case.

Candidate [packs](docs/wiki.html#definition-pack) may compose trusted operations. They may not execute JavaScript, shell commands, imports or external services. Preserve [source spans](docs/wiki.html#definition-source-span), variable binding, [context](docs/wiki.html#definition-context) isolation and explicit negation. New capabilities require structural transfer and counterexample checks, not only training replay or renamed constants. Keep evaluator-owned gates separate from teacher packets and never edit them merely to make a candidate pass.

[Promotion](docs/wiki.html#definition-promotion) must validate against the actual parent model, reject introduced regressions and retain content identities. Preserve real derivations and distinguish authored adapters, compiled knowledge, memory and induced programs. Do not report unknown answers or unsupported parses as solved reasoning challenges.

Run `npm test` and `npm run eval` after substantive changes. Run `npm run check:learning` for knowledge/learning changes, `npm run test:rebuild` for build reproducibility, and relevant standalone/browser checks for public workflows. Run `npm run audit:vision` when assessing completion. Its intentional nonzero result means architectural requirements remain unmet; do not weaken the gate to manufacture completion.

When code changes behavior, interfaces, architecture, workflows or constraints, update both HTML documentation and the DS specifications. DS numbering must remain contiguous. DS rationale, assumptions, alternatives, limitations and contract boundaries use declarative prose under `Core Content` and do not depend on a separate decision log. Maintain the canonical wiki, shared navigation, Documentation Map and working specification loader. Ordinary documentation must explain delivered behavior and its actual limits.

## Runtime Defaults

Node.js 22 or later runs the dependency-free model. The workbench defaults to `127.0.0.1:3210`; the CLI registry defaults to `.sxlm`. Structured model transport is `application/sop`. Request [budgets](docs/wiki.html#definition-budget) default to 100,000 nodes and 3,000 cooperative milliseconds, with additional formal and text bounds specified in DS002 and DS010.

Loaded native sources are identity-bound. Do not edit native source while tests or model processes are running and then construct models in those stale processes. Restart after native edits. After native changes, run `npm run build:model` before verification. It rebuilds lexical methods before sequence memory and preserves the declared [linkage](docs/wiki.html#definition-linkage) order; sequence derivations also bind the runtime. Tests run sequentially so worker contention does not manufacture request deadline failures.

## Key Paths

`docs/index.html` is the HTML entry point, `docs/wiki.html` defines terminology, and `docs/specs/` holds the normative contracts. `docs/specsLoader.html?spec=matrix.md` opens the specification matrix. `DS001-coding-style.md` defines source layout, modular tests, file-size guidance and `fileSizesCheck.sh` usage.

`src/` implements the host and offline tools; `sop/` contains policy source; `packs/` contains installable [SOP](docs/wiki.html#definition-sop); `training/` contains teaching and reproduction evidence; `eval/` owns capability cases; `test/` owns implementation and reference checks; `reports/` contains measured evidence. `web/` contains the workbench. `npm run docs` serves documentation locally, and `npm run docs:build` generates HTML and the specification matrix from the DS sources. Do not add parallel Markdown chapter files or a separate vision document.
