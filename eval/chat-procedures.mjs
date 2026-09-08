import { writeFileSync } from 'node:fs';
import { SymbolicModel } from '../src/model.mjs';
import { readPack } from '../src/learning/packs.mjs';
import { compilePhraseKnowledge } from '../src/learning/phrases.mjs';
import { encodeSOP } from '../src/kernel/sop-data.mjs';
import { evaluate } from '../src/learning/evaluate.mjs';
import { conformance, composition } from './cases.mjs';

const base = new SymbolicModel(), elementary = readPack(new URL('../packs/elementary-knowledge.sop', import.meta.url));
// Source knowledge may change answers legitimately. Isolate procedure inheritance,
// exactly as document promotion does, by removing only the optional seed observations.
const procedural = { ...elementary, providers: { ...elementary.providers,
  'fact-fragments': [], 'theory-fragments': [] } };
const extended = new SymbolicModel({ packs: [...base.packs, procedural] });
const origin = { kind: 'evaluator-authored-vocabulary-stress', parentModel: extended.resources.hash };
const phrases = compilePhraseKnowledge(Array.from({ length: 320 }, (_, index) => ({
  category: 'N', surface: `probe device ${index}`, value: `probe_device_${index}`
})), { id: 'evaluation.phrases', origin, tokenize: text => extended.grammar.tokenize(text) });
const stressed = new SymbolicModel({ packs: [...extended.packs, {
  schema: 'sxlm.pack.v1', id: 'evaluation-phrases', version: '1', provenance: origin,
  sop: phrases.sop, providers: phrases.providers
}] });
const cases = [...conformance, ...composition];
const profiles = [base, extended, stressed].map(model => evaluate(model, cases));
const regressions = profiles.slice(1).map(profile => profile.results
  .filter((result, index) => profiles[0].results[index].pass && !result.pass).map(result => result.id));
const report = { schema: 'sxlm.chat-procedure-evaluation.v1', generated: new Date().toISOString(),
  passed: profiles[0].failed === 0 && regressions.every(items => items.length === 0),
  profiles: Object.fromEntries(['bootstrap', 'elementary-language', 'elementary-plus-320-terms']
    .map((name, index) => [name, profiles[index]])), regressions, phraseCompilation: phrases.receipt,
  qualification: 'Public procedure inheritance and bounded lexical stress, with optional facts and rules ablated. This does not evaluate semantic fidelity, arbitrary document scale or unrestricted language.' };
writeFileSync(new URL('../reports/chat-procedures.sop', import.meta.url), encodeSOP(report));
for (const [name, profile] of Object.entries(report.profiles)) console.log(`${name}: ${profile.passed}/${profile.total}`);
if (!report.passed) process.exitCode = 1;
