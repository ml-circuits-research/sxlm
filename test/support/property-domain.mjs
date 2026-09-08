import { compileConceptKnowledge } from '../../src/learning/concepts.mjs';
import { compileConceptProperties } from '../../src/learning/properties.mjs';
import { compileGrammarKnowledge } from '../../src/learning/grammar.mjs';
import { digest } from '../../src/kernel/data.mjs';

export function propertyDomain(base) {
  const text = 'In this fictional domain, every crystal beacon is a signal device. ' +
    'Signal devices are intended to transmit. Every crystal beacon emits pulses. ' +
    'Crystal beacons typically need shade.';
  const source = { id: digest(text), text };
  const evidence = { source: source.id, start: 0, end: text.length };
  const origin = { kind: 'evaluator-authored-fictional-domain' };
  const concepts = compileConceptKnowledge({ concepts: [
    { id: 'crystal_beacon', singular: 'crystal beacon', plural: 'crystal beacons' },
    { id: 'signal_device', singular: 'signal device', plural: 'signal devices' }
  ], inclusions: [{ subtype: 'crystal_beacon', supertype: 'signal_device', negative: false, source, evidence }] },
  { id: 'memory.eval-property.concepts', origin, tokenize: text => base.grammar.tokenize(text) });
  const properties = compileConceptProperties({ properties: [
    { concept: 'signal_device', relation: 'function', values: ['transmit'], mode: 'all-instances' },
    { concept: 'crystal_beacon', relation: 'emit', values: ['pulses'], mode: 'all-instances' },
    { concept: 'crystal_beacon', relation: 'need', values: ['shade'], mode: 'typical' }
  ].map(item => ({ ...item, negative: false, source, evidence })) }, { id: 'memory.eval-property.facts', origin });
  const language = compileGrammarKnowledge({ productions: [], classes: {}, lexicon: [
    { category: 'V', surface: 'emit', value: 'emit' }, { category: 'V', surface: 'emits', value: 'emit' },
    { category: 'MASS_NOUN', surface: 'shade', value: 'shade' }
  ] }, { id: 'memory.eval-property.language', origin });
  const providers = {};
  for (const part of [concepts, properties, language]) for (const [slot, ids] of Object.entries(part.providers)) {
    providers[slot] = [...(providers[slot] ?? []), ...ids];
  }
  return { schema: 'sxlm.pack.v1', id: 'eval-properties', version: '1.0.0', provenance: origin,
    sop: [...concepts.sop, ...properties.sop, ...language.sop], providers };
}
