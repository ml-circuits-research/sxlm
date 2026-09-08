---
title: DS010-interfaces-and-operations
summary: Defines CLI, JavaScript and local HTTP interfaces, runtime defaults, errors and operational boundaries.
---

## Introduction

[SXLM](../wiki.html#definition-sxlm) exposes a command-line application, a JavaScript library and a local browser workbench. Each interface must use the same installed model contracts. Inference and training require Node.js 22 or later and repository-owned files; they have no npm runtime dependencies or external model service.

## Core Content

### CLI and library

`node bin/sxlm.mjs` must expose `ask`, `summarize`, `complete`, `chat`, `serve`, `demo`, `evaluate`, `inspect` and the declared `train` actions. Text-producing commands must print plain English by default and structured [SOP](../wiki.html#definition-sop) with `--sop`. `--file` supplies text input, `--registry` selects a lineage directory and `--packs` appends comma-separated extension [pack](../wiki.html#definition-pack) paths to the registry and its automatically loaded [bootstrap](../wiki.html#definition-bootstrap). The JavaScript constructor instead accepts the complete ordered [pack](../wiki.html#definition-pack) set. Without explicit text in a noninteractive invocation, text input may come from standard input.

`chat` must maintain one [session](../wiki.html#definition-session) until `/exit`; `/reset` must clear its state. CLI failures must report an error and nonzero exit code. Candidate validation must fail its process when the [receipt](../wiki.html#definition-receipt) is rejected. [Promotion](../wiki.html#definition-promotion) must require `--gates` and rerun the declared checks.

The public library exports `SymbolicModel`, `Session`, [circuit](../wiki.html#definition-circuit) and [budget](../wiki.html#definition-budget) tools, [SOP](../wiki.html#definition-sop) encoding/decoding, [pack](../wiki.html#definition-pack) validation, learning APIs, knowledge compilers and formal witness checkers through `src/index.mjs`. `SymbolicModel.ask` creates a fresh [session](../wiki.html#definition-session). The explicit [session](../wiki.html#definition-session) API provides persistence. Summary and completion return English text with task metadata. Planning accepts formal data. DS002, DS005–DS009 define the deeper contracts.

The offline library exports `createTextProcessor`, `textPolicyFromModules` and `textPolicyForModel`. These APIs capture and execute typed [SOP](../wiki.html#definition-sop) text programs under DS008. `Grammar.tokenize` uses the parser's installed policy under DS004. The legacy global `tokenize` helper exposes native boundaries and must not be used to assume compatibility with a custom model's token policy.

### HTTP workbench

`serve` defaults to `127.0.0.1:3210`. `--host` and `--port` configure its binding. The workbench exposes Reason, Summarize, Complete, Learning lab and Evaluation views. It must show answer text, interpretation [coverage](../wiki.html#definition-coverage), source evidence, proof information and execution records where applicable.

| Interface | Contract |
| --- | --- |
| `GET /api/info` | Returns the active process model, [grammar](../wiki.html#definition-grammar)/library inventory, architecture audit, examples and demonstration teacher/gates. |
| `POST /api/run` | Accepts `task`, `text`, optional `options` and optional reasoning `session`; returns a task result and reasoning [session](../wiki.html#definition-session) identifier. |
| `POST /api/learn` | Accepts a construction `specification` and `gates`; returns the candidate and validation [receipt](../wiki.html#definition-receipt). |
| `POST /api/activate` | Accepts a validated proposal `id`; rejects stale proposals and clears [sessions](../wiki.html#definition-session) on activation. |
| `POST /api/evaluate` | Runs the repository [bootstrap](../wiki.html#definition-bootstrap)/reference-induction benchmark, not a custom active-model benchmark. |

Every POST must require `Content-Type: application/sop`. Structured responses and errors must use `application/sop; charset=utf-8` and `Cache-Control: no-store`. JSON requests must be rejected. Request bodies are limited to 512 KiB. The boundary reader also limits characters, producers and expanded values. A supplied Origin must match the HTTP host origin; cross-origin requests must fail. The response must set the declared content security policy and disable MIME sniffing.

The server retains at most 100 [sessions](../wiki.html#definition-session) and 20 proposals in process memory. An unknown or incompatible [session](../wiki.html#definition-session) identifier creates a new [session](../wiki.html#definition-session). Browser activation is volatile and independent of the durable CLI registry. The server has no account authentication or durable browser [session](../wiki.html#definition-session) service. The default deployment is a local workbench, not a multi-tenant public endpoint. Its request processing is synchronous and may occupy the Node event loop during an evaluation.

### Budgets and errors

Ordinary model requests default to 100,000 [circuit](../wiki.html#definition-circuit) nodes and a cooperative three-second deadline, together with the bounds in DS002. [Grammar](../wiki.html#definition-grammar) recognition has a 512-token per-segment cap. [Pack](../wiki.html#definition-pack) files are limited to 8 MiB and source modules to 200,000 UTF-16 code units. Installation executes its own bounded [circuit](../wiki.html#definition-circuit) work and exposes metrics.

A reasoning [budget](../wiki.html#definition-budget) failure must return `status: budget-exceeded`, the exhausted resource, unchanged revision, `committed: false`, text and diagnostic trace. The failure text uses at most 30 housekeeping nodes, 2,000 steps and 1,000 milliseconds. Ordinary errors may throw. Summary, completion and planning propagate failures from their JavaScript API; HTTP encodes errors with status 400. An unknown route returns 404.

Whole-suite CLI and browser timeouts must not be described as per-request latency guarantees. Structured traces can be large. Callers must distinguish the status strings in `truth` from JavaScript booleans and must inspect [coverage](../wiki.html#definition-coverage) and verification independently.

### Operational checks

`npm test`, `npm run eval`, `npm run check:learning`, `npm run test:rebuild`, `npm run test:standalone` and `npm run audit:vision` must remain documented and executable. `npm run test:browser` requires an installed Chromium binary; `SXLM_CHROMIUM` may specify its location. Native source changes require stopping the model process, running `npm run build:model` and the verification suite, and restarting with the rebuilt artifact. Existing registries require explicit revalidation after incompatible identity changes.

The HTML documentation is a static site with relative links, a shared header and a specification loader. It must remain separate from model knowledge and use no privileged inference path. Documentation and workbench commands must be verified against their actual entrypoints.

### Persistent chat API

`GET /api/chat` lists conversations; `POST /api/chat` creates one. `GET /api/chat/:id` returns paged transcript summaries, documents and jobs. `?tail=1` requests the last page and `?offset=N` requests an explicit page. `GET /api/chat/:id/turns/:index` returns one turn with evidence. `POST /api/chat/:id/message` accepts a [SOP](../wiki.html#definition-sop) record containing `text` and returns the local model reply.

`POST /api/chat/:id/documents` accepts a document `name`. Numbered `POST /api/chat/:id/documents/:document/chunks/:index` requests send raw UTF-8 `text/plain` fragments or binary `application/octet-stream` fragments. `POST /api/chat/:id/documents/:document/finish` completes the source identity and starts processing automatically; an explicit [SOP](../wiki.html#definition-sop) `{train:false}` option only stores the attachment. The simple UI uses the automatic path.

`POST /api/chat/:id/jobs` retries a stored document. `GET /api/chat/:id/jobs/:job` reads job metadata; `/log` reads a bounded tail of processing output. POST `/cancel` cancels an owned active job. POST `/activate` retains an explicit integration surface, while ordinary successful jobs activate automatically. Structured request and response records use [SOP](../wiki.html#definition-sop). DS013 governs [extraction](../wiki.html#definition-extraction), coding isolation, local activation and limits.

The ordinary Reason view retains process-local [session](../wiki.html#definition-session) identifiers. Persistent Chat is a separate lifecycle under `.sxlm/chat`. Programmatic `serve` and `createWorkbench` accept `chatDirectory`, the optional elementary-[pack](../wiki.html#definition-pack) toggle and an offline agent configuration; HTTP input cannot choose a command to execute. The default symbolic model remains [bootstrap](../wiki.html#definition-bootstrap)-only, while Chat additionally loads the optional introductory [pack](../wiki.html#definition-pack).

<!-- chapter:usage -->
### Run and inspect language tasks

[SXLM](../wiki.html#definition-sxlm) runs locally for developers who want answers with inspectable assumptions and evidence. Use the workbench for interactive experiments, the CLI for text files and the JavaScript API for persistent [sessions](../wiki.html#definition-session) or integration. All examples below are English and use the shipped [bootstrap](../wiki.html#definition-bootstrap).

#### Start the workbench

Install Node.js 22 or later, place this repository in its own directory and run the following commands from its root. There are no runtime packages to download and no API keys to configure.

```sh
node --version
npm start
```

Open `http://127.0.0.1:3210`. Reason accepts statements followed by a question. Summarize selects original source sentences. Complete accepts a prefix and optional source [context](../wiki.html#definition-context). Learning lab demonstrates [construction induction](../wiki.html#definition-construction-induction), validation and process-local activation. Evaluation runs the [bootstrap](../wiki.html#definition-bootstrap)/reference-induction suite. Its result does not measure an arbitrary browser-activated model.

The server can bind a chosen port using `node bin/sxlm.mjs serve --port 3210`. The default host is loopback. The workbench is a local development service without accounts or durable browser [sessions](../wiki.html#definition-session). Persistent learning uses the CLI registry workflow described in [Training](../training.html).

#### Ask supported questions

```sh
node bin/sxlm.mjs ask "Every pilot who owns a bird is careful. Mira is a pilot. Mira owns a bird. Is Mira careful?"
node bin/sxlm.mjs ask "Mira has 8 apples. Mira gives 3 apples to Theo. How many apples does Mira have?"
```

The respective answers are `Yes. Mira is careful.` and `Mira has 5 apples.`. The first composes a relative restriction with an existential possession fact. The second follows an ordered transfer. These are examples of reusable constructions in the installed [grammar](../wiki.html#definition-grammar), not a general promise for all English paraphrases.

Add `--sop` to inspect the structured result. Check `truth`, `document.coverage`, interpretation gaps and `verification` independently. `truth` is a symbolic string such as `true` or `unknown`, not a JavaScript boolean. A proof certifies the conclusion under the interpretation; partial language [coverage](../wiki.html#definition-coverage) remains a separate limitation. Source references use exact UTF-16 offsets.

```sh
node bin/sxlm.mjs ask --sop "Mira is a human. Is Mira mortal?"
node bin/sxlm.mjs chat
```

`ask` starts a fresh [session](../wiki.html#definition-session) each time. `chat` keeps [context](../wiki.html#definition-context) until `/reset` or `/exit`. In the workbench, enable [context](../wiki.html#definition-context) retention for conversational state. A question that cannot be interpreted stays an explicit gap. A resource failure returns without committing the attempted turn.

#### Summarize and complete

```sh
node bin/sxlm.mjs summarize "The launch was not approved. The sensor failed during the test. The engineers requested another inspection." --sentences 2 --focus "launch approved sensor failed"
node bin/sxlm.mjs complete "A symbolic model" --max-tokens 12
```

For files, use `summarize --file incident.txt --sentences 3`. Completion accepts `--context-file observations.txt`. A supplied [context](../wiki.html#definition-context) such as `The cobalt robot inspects the reactor.` supports the prefix `The cobalt robot` with an attested continuation. Without an attested match, the task may use finite-[context](../wiki.html#definition-context) observations or report insufficient [coverage](../wiki.html#definition-coverage). The [text-task contract](../text-tasks.html) explains the [grounding](../wiki.html#definition-grounding) labels and limits.

#### Keep a JavaScript session

```js
import { SymbolicModel } from './src/index.mjs';

const model = new SymbolicModel();
const session = model.createSession();
session.ask('Every human is mortal. Mira is a human.');
const answer = session.ask('Is Mira mortal?');
console.log(answer.text);
console.log(answer.verification.valid);
const restored = model.createSession(session.snapshot());
```

The answer is `Yes. Mira is mortal.`. A snapshot is bound to the exact model identity. After an incompatible host or [pack](../wiki.html#definition-pack) change, restoration must fail and the caller must explicitly revalidate or rebuild its state. Summary and completion do not add conversational facts. Formal planning is available through `model.plan(problem)` and accepts explicit action data; see [Planning](../formal-planning.html).

#### Verify and diagnose

```sh
npm test
npm run eval
npm run check:learning
npm run test:rebuild
npm run test:standalone
npm run audit:vision
```

The audit deliberately returns a nonzero result while mandatory architectural requirements remain unmet. It must not be interpreted as a broken installation merely because capability acceptance passes. Read the specific requirement and evidence in its [SOP](../wiki.html#definition-sop) report. `npm run test:browser` needs an installed Chromium; set `SXLM_CHROMIUM` if its path is outside the standard locations.

A changed-source error means the process loaded an older native revision. Restart that process and reproduce runtime-bound learned methods before constructing a new model. A registry mismatch requires explicit revalidation; deleting evidence or relabeling the model hash is not a migration. A [budget](../wiki.html#definition-budget) result requires inspecting the exhausted resource and input scope. The default three-second deadline is cooperative, and full evaluation performs many separately bounded requests.

Run `npm run docs` and open `http://127.0.0.1:3211/docs/` for the HTML documentation and specification viewer. The Markdown specifications require HTTP fetching. Ordinary chapter text is pre-rendered; diagrams use the declared browser renderer. No documentation script participates in model inference.
<!-- /chapter:usage -->

<!-- chapter:interfaces -->
### Integrate the model

Applications can import the JavaScript API or exchange [SOP](../wiki.html#definition-sop) documents with the local workbench. Both paths use the same model and task contracts. The CLI is convenient for experiments and durable learning; the HTTP workbench keeps [sessions](../wiki.html#definition-session) and proposals only in its process.

#### JavaScript entrypoints

Import public APIs from `src/index.mjs`. `new SymbolicModel()` loads the English [bootstrap](../wiki.html#definition-bootstrap). Explicit `packs` select a complete ordered [pack](../wiki.html#definition-pack) set; include the base model when adding an extension. `cacheSize` controls the model cache and `limits` supplies request defaults. Installed programs and resources are sealed.

| Operation | Input and observable behavior |
| --- | --- |
| `model.ask(text, options)` | Runs a fresh reasoning [session](../wiki.html#definition-session) and returns English plus structured evidence. |
| `model.createSession(snapshot)` | Starts or restores model-bound state; `session.ask`, `snapshot` and `reset` control its lifecycle. |
| `model.summarize(text, options)` | Returns selected [source spans](../wiki.html#definition-source-span); options include `sentences` and `focus`. |
| `model.complete(prefix, options)` | Returns qualified continuation; options include `context` and `maxTokens`. |
| `model.plan(problem, options)` | Searches supplied formal actions; solved witnesses are independently checked. |
| `encodeSOP(value)` / `decodeSOP(source)` | Write and read inert constructor documents; decoding cannot execute quoted modules. |
| `readPack(path)` / `validatePack(pack)` | Load and structurally check [SOP](../wiki.html#definition-sop) artifacts and obtain executable [pack](../wiki.html#definition-pack) identity. |

`createTextProcessor(textPolicyForModel(model))` provides an offline processor bound to the captured [SOP](../wiki.html#definition-sop) tokenization and segmentation programs. `Grammar.tokenize` executes and validates the parser's installed token policy. The exported global `tokenize` helper is the legacy native boundary mechanism and is not a substitute for a model-bound policy.

`induceConstruction`, `learnProgramPack` and `learnSequencePack` produce candidate [packs](../wiki.html#definition-pack) offline. `compileGrammarKnowledge`, `compileTheoryKnowledge` and `compileKnowledge` compile supplied knowledge without claiming induction. `verifyCertificate` and `verifyPlan` replay formal evidence. The lower-level `CircuitRuntime` and `Grammar` APIs require their own explicit contracts; `Grammar` requires pure lexical callbacks, and an unversioned standalone [VM](../wiki.html#definition-vm) is not a model-bound runtime.

#### SOP over HTTP

The server defaults to `http://127.0.0.1:3210`. Every POST body must be an inert [SOP](../wiki.html#definition-sop) document with `Content-Type: application/sop`. Responses and errors use `application/sop; charset=utf-8`, with no-store caching. The workbench rejects JSON bodies and cross-origin browser requests.

```js
import { encodeSOP, decodeSOP } from './src/index.mjs';

const response = await fetch('http://127.0.0.1:3210/api/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/sop' },
  body: encodeSOP({
    task: 'reason',
    text: 'Every human is mortal. Mira is a human. Is Mira mortal?'
  })
});
const result = decodeSOP(await response.text());
console.log(response.status, result.text);
```

The JavaScript record in this example is an in-memory value. `encodeSOP` writes the constructor graph sent over the boundary. Adjacent [circuit](../wiki.html#definition-circuit) nodes pass immutable values directly; they do not serialize and parse JSON intermediates.

| Route | Request and response |
| --- | --- |
| `GET /api/info` | Active process model, manifests, [grammar](../wiki.html#definition-grammar)/module counts, architecture audit and public demonstration fixtures. |
| `POST /api/run` | `task` is `reason`, `summarize` or `complete`; `text` is required; `options` is optional. Reasoning accepts and returns `session`. |
| `POST /api/learn` | A construction `specification` and `gates`; returns candidate, [receipt](../wiki.html#definition-receipt) and proposal `id`. |
| `POST /api/activate` | Validated proposal `id`; installs it in memory and clears incompatible [sessions](../wiki.html#definition-session)/proposals. |
| `POST /api/evaluate` | An inert [SOP](../wiki.html#definition-sop) body, such as an empty record; returns the [bootstrap](../wiki.html#definition-bootstrap)/reference-induction evaluation. |

Reuse the returned reasoning [session](../wiki.html#definition-session) identifier to preserve state. An unknown identifier or one belonging to another model starts a new [session](../wiki.html#definition-session). The server retains at most 100 [sessions](../wiki.html#definition-session) and 20 proposals. It has no account authentication or durable browser state. Persistent [promotion](../wiki.html#definition-promotion) and rollback use the CLI registry.

#### Results, limits and errors

Reasoning results include `text`, individual `answers`, `document`, source records, revision, commit information, execution metrics, trace and model identity. Logical answers distinguish `true`, `false`, `both` and `unknown`. Inspect `verification.valid` only alongside the interpretation [coverage](../wiki.html#definition-coverage) and the question's supported formal contract. A successful source summary and an attested continuation have different evidence from a logical proof.

Default [budgets](../wiki.html#definition-budget) bound 100,000 nodes, 200,000 steps, 12,000 facts, 100,000 matches, 12,000 tokens and 3,000 milliseconds. Limits are cooperative. Installation has its own reported bounded work; the [bootstrap](../wiki.html#definition-bootstrap) executes 5,667 installation nodes. [Grammar](../wiki.html#definition-grammar) recognition limits each segment to 512 tokens. HTTP bodies are bounded at 512 KiB, [pack](../wiki.html#definition-pack) files at 8 MiB and individual source modules at 200,000 UTF-16 code units.

A reasoning [budget](../wiki.html#definition-budget) failure returns `status: budget-exceeded`, `resource`, the unchanged revision, `committed: false`, wording and the diagnostic trace. Ordinary reasoning errors can throw. Summary, completion and planning propagate JavaScript failures. HTTP catches failures and returns an [SOP](../wiki.html#definition-sop) error with status 400; unknown routes return 404. Large traces can produce substantial structured responses even for short text.

The CLI's `--packs` flag appends extension artifacts to the automatically loaded [bootstrap](../wiki.html#definition-bootstrap) and registry. The JavaScript constructor's `packs` option accepts a complete ordered set, including its base model.

#### Durable model changes

`--registry DIR` chooses the CLI lineage directory; its default is `.sxlm`. `train promote` reruns transfer and regression checks against the actual parent under a writer lock. It stores content-addressed [SOP](../wiki.html#definition-sop) [packs](../wiki.html#definition-pack) and [receipts](../wiki.html#definition-receipt) and atomically replaces `active.sop`. `train rollback` restores the previous lineage. A [receipt](../wiki.html#definition-receipt) cannot bypass parent checks or revalidation.

Source and Node component versions participate in model identity. A fresh native revision invalidates old model-bound snapshots and may invalidate registry identity. Stop model processes before editing native source, run `npm run build:model` and the verification suite, then restart. The contract is reproducibility inside a trusted process, not attestation against hostile host modifications. [DS009](../specsLoader.html?spec=DS009-identity-and-persistence.md) defines the exact persistence boundary.
<!-- /chapter:interfaces -->
