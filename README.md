# SXLM

[SXLM](docs/wiki.html#definition-sxlm) is an independent symbolic language workbench for developers and coding agents. It accepts English, returns English with inspectable evidence, and supports reusable extensions through typed [SOP](docs/wiki.html#definition-sop) [circuits](docs/wiki.html#definition-circuit), supervised learning and validated model [promotion](docs/wiki.html#definition-promotion).

A finite English [grammar](docs/wiki.html#definition-grammar) connects statements to signed relational reasoning and ordered quantity state. Summaries select original [source spans](docs/wiki.html#definition-source-span). Completion uses attested sources or learned finite-[context](docs/wiki.html#definition-context) observations. An offline coding agent can teach constructions, synthesize procedures or propose [circuit](docs/wiki.html#definition-circuit) knowledge and evaluate the resulting model.

The binding theory and normative contracts begin at [DS000](docs/specs/DS000-vision.md). The delivered model mixes authored and induced knowledge. Native text/chart policies and missing learning derivations keep the architecture audit incomplete. Local capability acceptance does not establish unrestricted LLM language understanding or a fully learned model.

## Start

Use Node.js 22 or later. The verified environment uses Node 24.9.0. There are no npm runtime dependencies, API keys, model downloads or sibling-project dependencies.

```sh
npm start
```

Open **http://127.0.0.1:3210**. The workbench provides Reason, Summarize, Complete, Learning lab and Evaluation views, with [coverage](docs/wiki.html#definition-coverage) gaps, source evidence, [certificates](docs/wiki.html#definition-certificate) and execution traces. `node bin/sxlm.mjs serve --port 3210` selects a port; the default host is `127.0.0.1`. Browser activation and [sessions](docs/wiki.html#definition-session) live only in that process. The local service has no account authentication.

For the full HTML documentation and specification viewer:

```sh
npm run docs
```

The Chat view at **http://127.0.0.1:3210** accepts attachments and runs [Codex](docs/wiki.html#definition-codex) to prepare their conversation-local interpretation. See [Chat](docs/chat.html) for supported formats, setup and limits.

Open **http://127.0.0.1:3211/docs/**, or start with [the HTML entry point](docs/index.html). The site includes usage, interfaces, architecture, [SOP](docs/wiki.html#definition-sop) authoring, lexical and formal contracts, training, evaluation, design decisions, a canonical wiki and 14 specifications. The specification viewer fetches Markdown over HTTP. Ordinary chapters are pre-rendered; diagrams use a browser renderer loaded from the declared CDN. Documentation scripts do not participate in inference.

## Basic use

```sh
node bin/sxlm.mjs ask "Every pilot who owns a bird is careful. Mira is a pilot. Mira owns a bird. Is Mira careful?"
# Yes. Mira is careful.

node bin/sxlm.mjs ask "Mira has 8 apples. Mira gives 3 apples to Theo. How many apples does Mira have?"
# Mira has 5 apples.

node bin/sxlm.mjs summarize --file incident.txt --sentences 3 --focus "failure recovery"
node bin/sxlm.mjs complete "A symbolic model" --max-tokens 12
node bin/sxlm.mjs chat
```

`--file` reads your source file; completion also accepts `--context-file`. `ask` starts fresh, while `chat` retains a [session](docs/wiki.html#definition-session) until `/reset` or `/exit`. Add `--sop` for structured output. [Packs](docs/wiki.html#definition-pack), teacher packets, candidates, gates, [receipts](docs/wiki.html#definition-receipt), snapshots and HTTP messages use [SOP](docs/wiki.html#definition-sop). JavaScript records and arrays are transient values on wires, not serialized intermediates. Node and separately installed agent-manager manifests are infrastructure metadata.

## JavaScript integration

```js
import { SymbolicModel } from './src/index.mjs';

const model = new SymbolicModel();
const session = model.createSession();
session.ask('Every human is mortal. Mira is a human.');
const answer = session.ask('Is Mira mortal?');
console.log(answer.text);                 // Yes. Mira is mortal.
console.log(answer.truth);                // 'true', a symbolic status string
console.log(answer.verification.valid);   // formal certificate replay
console.log(answer.document.coverage);    // interpretation coverage
const restored = model.createSession(session.snapshot());
```

`model.summarize(text, options)` and `model.complete(prefix, options)` expose the text tasks. `model.plan(problem, options)` accepts formal signed actions and checks solved witnesses. Reasoning resource failures leave prior state unchanged. Snapshot restoration requires the same model identity. [Interfaces](docs/interfaces.html) documents the API, `application/sop` HTTP routes, defaults and errors.

## Learn and validate

```sh
node bin/sxlm.mjs train prepare examples/learn-construction.sop --out scratch/sxlm-packet
node bin/sxlm.mjs train induce examples/learn-construction.sop --out scratch/sxlm-candidate.sop
node bin/sxlm.mjs train validate scratch/sxlm-candidate.sop --gates examples/learning-gates.sop
node bin/sxlm.mjs train promote scratch/sxlm-candidate.sop --gates examples/learning-gates.sop
node bin/sxlm.mjs train rollback
```

The packet directory must be empty. `--registry DIR` selects a lineage directory; the default is `.sxlm`. [Promotion](docs/wiki.html#definition-promotion) reruns transfer and regression checks against the actual parent under a writer lock. A candidate cannot replace an installed task entrypoint or [circuit](docs/wiki.html#definition-circuit) ID. Browser learning demonstrates [construction induction](docs/wiki.html#definition-construction-induction) and temporary activation; durable [promotion](docs/wiki.html#definition-promotion) uses the CLI.

`train program examples/learn-coverage.sop --out scratch/coverage.sop` synthesizes a reusable finite-set procedure. `train sequence examples/learn-sequence.sop --out scratch/sequences.sop` learns executable completion memory. [Training](docs/training.html) explains the full workflows, explicit supervision, scoped hypothesis classes, [provider](docs/wiki.html#definition-provider) wiring, [ablation](docs/wiki.html#definition-ablation) and provenance. Authored knowledge remains authored after compilation.

## Verify the contracts

```sh
npm test
npm run eval
npm run demo
npm run check:learning
npm run test:rebuild
npm run test:standalone
npm run audit:vision
```

The verified revision passes 222 implementation tests, 28/28 conformance, 12/12 composition, 60/60 renaming probes, 64/64 formal planning and 16/16 normalization transfers. Construction learning improves from 0/5 to 5/5 with no introduced regression. The [bootstrap](docs/wiki.html#definition-bootstrap)-only open-language challenges remain 0/8; the optional construction profile scores 1/8 on the unchanged set. These are public same-project tests, not a blind external benchmark or an LLM accuracy score. See [evaluation](docs/evaluation.html) and [reports/latest-evaluation.sop](reports/latest-evaluation.sop).

`npm run build:model` rebuilds all model sources in dependency order. Run it after native changes, then execute the verification commands. Lexical normalization must be rebuilt before the sequence memory that records its policy identity.

`audit:vision` deliberately exits nonzero while the full architectural requirements remain unmet. It inventories the complete [native closure](docs/wiki.html#definition-native-closure) and reproduces learning evidence. `test:rebuild` checks all ten source-to-[pack](docs/wiki.html#definition-pack) stages. `test:standalone` runs an isolated copy without sibling directories. `test:browser` checks the workbench in an installed Chromium; set `SXLM_CHROMIUM` for a nonstandard executable location.

Read [DS001](docs/specs/DS001-coding-style.md) before changing source. Native edits require restarting loaded processes and reproducing runtime-bound methods. The [design decisions](docs/next.html) describe the evidence needed for stronger event semantics, abstraction learning and scaling. MIT license.
