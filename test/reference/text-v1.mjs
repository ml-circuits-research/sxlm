import { encodeSOP, decodeSOP } from '../../src/kernel/sop-data.mjs';
// Historical task oracle; test-only, never imported by inference.
import { Budget, check, digest } from '../../src/kernel/data.mjs';
import { tokenize } from './grammar-v1.mjs';
import { segment } from './document-v1.mjs';

const terms = text => tokenize(text).filter(t => /[\p{L}\p{N}]/u.test(t.text)).map(t => t.value);
const overlap = (a, b) => { const set = new Set(b); return [...new Set(a)].filter(t => set.has(t)).length / Math.max(1, new Set([...a, ...b]).size); };

/** Source-faithful extractive selection. All linguistic choices and scoring weights are external data. */
export function summarize(text, config, { sentences = 3, focus = '', budget = new Budget() } = {}) {
  check(typeof text === 'string' && text.length <= 200000, 'Summary input is too large');
  check(Number.isInteger(sentences) && sentences >= 1 && sentences <= 30, 'Summary length must be 1–30 sentences');
  const chunks = segment(text, { ...config.segmentation, keep: config.segmentation.boundaries });
  const stopwords = new Set(config.stopwords ?? []), focusTerms = terms(focus).filter(t => !stopwords.has(t));
  const content = chunks.map(s => terms(s.text).filter(t => !stopwords.has(t))), frequencies = new Map();
  for (const sentence of content) for (const term of new Set(sentence)) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
  const scored = chunks.map((span, index) => {
    budget.tick('tokens', content[index].length);
    const centrality = content[index].reduce((n, t) => n + Math.log(1 + (frequencies.get(t) ?? 0)), 0) / Math.max(1, Math.sqrt(content[index].length));
    return { index, span, score: centrality * config.weights.centrality + (index === 0 ? config.weights.lead : 0) + overlap(content[index], focusTerms) * config.weights.focus };
  });
  const selected = [];
  while (selected.length < Math.min(sentences, scored.length)) {
    budget.tick();
    const remaining = scored.filter(c => !selected.includes(c));
    remaining.sort((a, b) => {
      const score = x => x.score - config.weights.redundancy * Math.max(0, ...selected.map(y => overlap(content[x.index], content[y.index])));
      return score(b) - score(a) || a.index - b.index;
    });
    selected.push(remaining[0]);
  }
  selected.sort((a, b) => a.index - b.index);
  const source = { id: digest(text), text };
  return { kind: 'summary', status: 'answered', method: 'extractive', text: selected.map(s => s.span.text).join(' '), evidence: selected.map(s => ({ source: source.id, start: s.span.start, end: s.span.end })), source, selected: selected.map(s => s.index), totalSentences: chunks.length, coverage: 'selected-source-spans', guarantees: ['verbatim-source-spans'] };
}

/** Count-based sequence induction, independent of language and vocabulary. */
export function trainSequence(texts, { order = 4, boundaries = [] } = {}) {
  check(Number.isInteger(order) && order >= 1 && order <= 8, 'Sequence order must be 1–8');
  const counts = {}, sources = [];
  for (const text of texts) {
    check(typeof text === 'string' && text.length <= 200000, 'Invalid training text');
    const id = digest(text); sources.push({ id, text });
    for (const chunk of segment(text, { boundaries, keep: boundaries })) {
      const tokens = tokenize(chunk.text).map(t => t.value);
      for (let i = 0; i < tokens.length; i++) for (let size = 0; size <= Math.min(order - 1, i); size++) {
        const key = encodeSOP(tokens.slice(i - size, i)); counts[key] ??= {};
        counts[key][tokens[i]] = (counts[key][tokens[i]] ?? 0) + 1;
      }
    }
  }
  return { schema: 'sxlm.sequence.v1', order, counts, sources };
}
export function complete(prefix, model, config, { maxTokens = 30, budget = new Budget(), context = '' } = {}) {
  check(typeof prefix === 'string' && prefix.length <= 10000 && Number.isInteger(maxTokens) && maxTokens > 0 && maxTokens <= 200, 'Invalid completion request');
  const prefixTokens = tokenize(prefix).map(t => t.value), candidates = [], sources = [...(context ? [{ id: digest(context), text: context }] : []), ...model.sources];
  // Exact continuations retain an inspectable source witness. No claim of truth is attached to a phrase model.
  for (const source of sources) for (const span of segment(source.text, { boundaries: config.segmentation.boundaries, keep: config.segmentation.boundaries })) {
    budget.tick(); const tokens = tokenize(span.text);
    if (prefixTokens.length && prefixTokens.every((t, i) => tokens[i]?.value === t) && tokens.length > prefixTokens.length) {
      const endToken = tokens[Math.min(tokens.length - 1, prefixTokens.length + maxTokens - 1)];
      const continuation = span.text.slice(tokens[prefixTokens.length - 1].end, endToken.end);
      candidates.push({ continuation, evidence: { source: source.id, start: span.start, end: span.start + endToken.end }, source });
    }
  }
  if (candidates.length) {
    const unique = [...new Map(candidates.map(c => [c.continuation, c])).values()];
    return { kind: 'completion', status: 'answered', method: 'source-continuation', text: prefix + unique[0].continuation, continuation: unique[0].continuation, alternatives: unique.slice(1, 5).map(c => prefix + c.continuation), evidence: [unique[0].evidence], source: unique[0].source, grounding: 'attested-text', truth: 'not-evaluated' };
  }
  const generated = [], decisions = [], endings = new Set(config.segmentation.boundaries);
  for (let step = 0; step < maxTokens; step++) {
    budget.tick(); const contextTokens = [...prefixTokens, ...generated]; let distribution, size;
    for (size = Math.min(model.order - 1, contextTokens.length); size >= config.minimumContext; size--) {
      distribution = model.counts[encodeSOP(contextTokens.slice(contextTokens.length - size))]; if (distribution) break;
    }
    if (!distribution) break;
    const ranked = Object.entries(distribution).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const [token, count] = ranked[0], total = ranked.reduce((n, [, c]) => n + c, 0);
    generated.push(token); decisions.push({ contextLength: size, token, count, total });
    if (endings.has(token)) break;
  }
  let continuation = '';
  for (const token of generated) continuation += (config.attachLeft.includes(token) ? '' : ' ') + token;
  return { kind: 'completion', status: generated.length ? 'answered' : 'unknown', method: 'sequence-model', text: prefix + continuation, continuation, decisions, evidence: [], grounding: 'distributional-pattern', truth: 'not-evaluated' };
}
