---
title: DS001-coding-style
summary: Defines English-only source conventions, module boundaries, meaningful tests and documentation maintenance.
---

## Introduction

These rules let coding agents extend [SXLM](../wiki.html#definition-sxlm) without hiding task policy in the host or losing the evidence that supports existing behavior. This specification is the canonical source for coding style, source layout and test organization.

## Core Content

### Source and module boundaries

Product text, comments, documentation, datasets and language resources must be English. JavaScript must use repository-local ES modules with the `.mjs` extension and Node built-ins. Browser modules may use `.js`. Code must name the actual data or operation, keep public contracts explicit and avoid unnecessary dependencies.

`src/kernel/` owns general immutable-data, term, arithmetic and [circuit](../wiki.html#definition-circuit) mechanisms. It must not contain natural-language vocabulary, sentence templates, answer tables, language-specific substitutions or benchmark branches. `src/semantics/` owns declared formal contracts and witness checking. It must not recognize input phrases. `src/language/` must preserve a clear boundary between general recognition and policy supplied by [circuits](../wiki.html#definition-circuit). All privileged imports count toward the [native closure](../wiki.html#definition-native-closure) regardless of directory.

`sop/` contains authored executable policy sources. `packs/` contains installable [SOP](../wiki.html#definition-sop) artifacts. `training/` contains teacher inputs, archived migration inputs and derivation evidence. `src/learning/` contains offline learning and compilation. New policy must use [SOP](../wiki.html#definition-sop); the retired expression compiler exists only to reproduce historical inputs. A compiler family must install all emitted modules, never a privileged expression evaluator.

Static local imports in the sealed model closure must follow the supported single-line import profile. Dynamic imports, dependency symlinks and hot reloading are outside that profile. A native source edit requires restarting a process that loaded the old source. Agents must not edit native source during a live evaluation and then relabel that process as the new runtime.

### Readable changes

Functions should have one clear responsibility and expose consequential errors. Reusable behavior belongs in parameterized operations or [circuit](../wiki.html#definition-circuit) composition. A new phrase, category or task must not justify a new host special case. Constants that express learned or authored knowledge must have explicit provenance in the model artifact.

Prefer focused modules. `fileSizesCheck.sh` reports files above 500 lines, highlights files above 800 lines and reports unusually long source lines. These are review thresholds, not evidence of a small kernel. Generated [SOP](../wiki.html#definition-sop) and documentation paragraphs may be long for structural reasons. Agents must not compress code or hard-wrap prose merely to change the report. Code should usually fit within 120 characters when the expression remains clearer that way; correct identifiers and coherent expressions take precedence.

### Test organization

Tests belong in topic-specific `test/*.test.mjs` modules. `test/support/` contains shared setup; `test/reference/` contains historical or independently written comparison implementations that must remain outside the inference import closure. `eval/` owns capability suites, structural transfer cases and visible open challenges. Teacher files must not include evaluator-owned gate contents.

Substantive changes require `npm test` and `npm run eval`. Tests must check observable contracts, counterexamples and failures. Relevant checks include source-span fidelity, binding and [context](../wiki.html#definition-context) isolation, cache equivalence, typed [SSA](../wiki.html#definition-ssa) rejection, resource rollback and exact reproduction. Learning changes require held-out composition and [ablation](../wiki.html#definition-ablation) evidence. Renaming-only probes cannot replace structural transfer.

`npm test` executes test files sequentially to avoid artificial CPU contention with cooperative request deadlines. Whole-suite process timeouts are distinct from per-request [budgets](../wiki.html#definition-budget). A failing behavior must be investigated before changing a limit. Any justified limit change must disclose the measured cost and preserve explicit tighter-limit failures.

### Documentation maintenance

The DS set is the sole authored source of full project documentation. HTML chapters must be generated from designated sections of the DS files; separate explanatory Markdown chapter files and a duplicate root theory document are prohibited. README and AGENTS retain onboarding and contributor guidance. The generated specification matrix is the only non-DS Markdown file under docs.

The DS set is the normative documentation. Behavior, interface or architecture changes must update both the affected specification and HTML explanation. DS numbering must remain contiguous. DS003 must contain only evidence-supported defining behaviors; agents must reassess that accepted set when the project's main outcomes or execution paths change.

Every DS must have exactly `title` and `summary` frontmatter, with the filename stem as its title, and only `Introduction` and `Core Content` as top-level sections. Rationale, assumptions and limitations belong in declarative prose under `Core Content`. Documentation paragraphs must occupy one logical source line and wrap naturally in the browser. Project-specific terminology must link to the canonical wiki entry. HTML must preserve the shared submenu navigation, Documentation Map, accessible keyboard behavior and full-width reading panel. Imported agent tooling must not become a product page or DS subject.

### Validation and provenance

`npm run check:learning` and `npm run test:rebuild` must reproduce installed knowledge after changes to builders or learning inputs. Native changes require `npm run build:model` before verification. The ordered build must synthesize lexical methods before sequence memory and preserve [linkage](../wiki.html#definition-linkage) order. Sequence derivations bind the runtime as well as the captured text programs. `npm run audit:vision` must remain a truthful completion check; its deliberate nonzero result must not be suppressed or redefined as success.

The standalone and browser checks must accompany changes to packaging or public workflows. Agents must preserve user files, avoid sibling code and report limitations with evidence. A green test report applies to the source and model revision that actually ran.
