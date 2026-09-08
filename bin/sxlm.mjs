#!/usr/bin/env node
import { textPolicyForModel } from '../src/learning/text-policy.mjs';
import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { SymbolicModel, induceConstruction, learnSequencePack, learnProgramPack, readPack } from '../src/index.mjs';
import { loadRegistry, preparePacket, validateCandidate, promote, rollback } from '../src/learning/workflow.mjs';
import { conformance, composition, learningGates } from '../eval/cases.mjs';
import { runEvaluation } from '../eval/run.mjs';
import { serve } from '../src/server.mjs';

const args = process.argv.slice(2), command = args.shift() ?? 'help';
function option(name, fallback) { const index = args.indexOf(`--${name}`); if (index < 0) return fallback; const value = args[index + 1]; if (!value || value.startsWith('--')) throw new Error(`--${name} needs a value`); args.splice(index, 2); return value; }
function flag(name) { const index = args.indexOf(`--${name}`); if (index < 0) return false; args.splice(index, 1); return true; }
const asSOP = flag('sop'), registry = option('registry', '.sxlm'), packFiles = option('packs', ''), inputFile = option('file', null);
const sopFile = path => decodeSOP(readFileSync(path, 'utf8'));
const output = (value, path) => { if (path) { mkdirSync(dirname(resolve(path)), { recursive: true }); writeFileSync(path, encodeSOP(value) + '\n'); console.log(resolve(path)); } else console.log(typeof value === 'string' ? value : encodeSOP(value)); };
function model() { return new SymbolicModel({ packs: [...loadRegistry(registry).packs, ...packFiles.split(',').filter(Boolean).map(readPack)] }); }
function input() { return inputFile ? readFileSync(inputFile, 'utf8') : args.join(' ') || (!stdin.isTTY ? readFileSync(0, 'utf8') : ''); }
try {
  if (command === 'ask') { const result = model().ask(input()); output(asSOP ? result : result.text); }
  else if (command === 'summarize') { const sentences = Number(option('sentences', '3')), focus = option('focus', ''); const result = model().summarize(input(), { sentences, focus }); output(asSOP ? result : result.text); }
  else if (command === 'complete') { const contextFile = option('context-file', null), context = contextFile ? readFileSync(contextFile, 'utf8') : '', maxTokens = Number(option('max-tokens', '30')); const result = model().complete(input(), { context, maxTokens }); output(asSOP ? result : result.text); }
  else if (command === 'chat') {
    const session = model().createSession(), terminal = createInterface({ input: stdin, output: stdout });
    console.log('SXLM session. /reset clears context; /exit closes the session.');
    for await (const line of terminal) { if (line === '/exit') break; if (line === '/reset') { session.reset(); console.log('Context cleared.'); continue; } if (line.trim()) console.log(session.ask(line).text); }
    terminal.close();
  } else if (command === 'serve') {
    const port = Number(option('port', '3210')), host = option('host', '127.0.0.1'); const server = await serve({ port, host, model: model() });
    console.log(`SXLM workbench: http://${host}:${server.address().port}`);
  } else if (command === 'demo') {
    const m = model(), demos = sopFile(new URL('../examples/demo.sop', import.meta.url));
    for (const example of demos.reason.slice(0, 5)) { const result = m.ask(example.text); console.log(`\n${example.title}\n${example.text}\n→ ${result.text}`); }
    const spec = sopFile(new URL('../examples/learn-construction.sop', import.meta.url)), candidate = induceConstruction(m, spec), trained = new SymbolicModel({ packs: [...m.packs, candidate] });
    console.log(`\nLearning transfer\n${learningGates[1].text}\nBefore: ${m.ask(learningGates[1].text).text}\nAfter: ${trained.ask(learningGates[1].text).text}`);
  } else if (command === 'evaluate') output(runEvaluation(), option('out', null));
  else if (command === 'train') {
    const action = args.shift(), out = option('out', null), gatesPath = option('gates', null);
    if (action === 'prepare') output(preparePacket(model(), sopFile(args[0]), out ?? 'training-packet'));
    else if (action === 'induce') output(induceConstruction(model(), sopFile(args[0])), out);
    else if (action === 'program') output(learnProgramPack(model(),sopFile(args[0])),out);
    else if (action === 'sequence') {
      const {texts,...specification}=sopFile(args[0]);
      const parent=model();
      output(learnSequencePack(texts,{...specification,parentModel:parent.resources.hash,textPolicy:textPolicyForModel(parent)}),out);
    }
    else if (action === 'validate' || action === 'promote') {
      if (!gatesPath) throw new Error('Provide --gates with an independently maintained SOP case array');
      const candidate = readPack(args[0]), options = { gates: sopFile(gatesPath), regressions: [...conformance, ...composition] };
      const result = action === 'promote' ? promote(registry, candidate, options) : validateCandidate(model(), candidate, options);
      output(result, out); if (action === 'validate' && !result.accepted) process.exitCode = 1;
    } else if (action === 'rollback') output(rollback(registry));
    else throw new Error('Unknown train action: prepare | induce | program | sequence | validate | promote | rollback');
  } else if (command === 'inspect') { const m = model(); output({ model: m.resources.hash, packs: m.resources.manifests, entrypoints: m.resources.entrypoints, primitives: [...m.runtime.primitives.keys()], productions: m.resources.grammar.productions.length }); }
  else {
    console.log(`SXLM — independent symbolic language workbench\n\n  node bin/sxlm.mjs ask "Every human is mortal. Mira is a human. Is Mira mortal?"\n  node bin/sxlm.mjs summarize --file report.txt --sentences 3\n  node bin/sxlm.mjs complete "A symbolic model"\n  node bin/sxlm.mjs chat\n  node bin/sxlm.mjs serve --port 3210\n  node bin/sxlm.mjs demo\n  node bin/sxlm.mjs evaluate --out reports/evaluation.sop\n  node bin/sxlm.mjs train prepare examples/learn-construction.sop --out /tmp/sxlm-packet\n  node bin/sxlm.mjs train induce examples/learn-construction.sop --out /tmp/candidate.sop\n  node bin/sxlm.mjs train validate /tmp/candidate.sop --gates examples/learning-gates.sop\n  node bin/sxlm.mjs train promote /tmp/candidate.sop --gates examples/learning-gates.sop\n  node bin/sxlm.mjs train program examples/learn-coverage.sop --out /tmp/coverage.sop\n  node bin/sxlm.mjs train sequence examples/learn-sequence.sop --out /tmp/sequences.sop\n  node bin/sxlm.mjs train rollback\n\nGlobal options: --sop, --file PATH, --registry DIR, --packs comma,separated,paths\nNo package installation, network API, or sibling repository is required.`);
    if (!['help','--help','-h'].includes(command)) process.exitCode = 1;
  }
} catch (error) { console.error(`SXLM: ${error.message}`); process.exitCode = 1; }
