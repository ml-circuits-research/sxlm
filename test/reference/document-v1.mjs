// Historical document-policy oracle; test-only.
import { digest, check, Budget } from '../../src/kernel/data.mjs';
import { tokenize } from './grammar-v1.mjs';

/** Segmentation punctuation is supplied by the language artifact. Spans retain original UTF-16 offsets. */
export function segment(text, { boundaries = [], keep = [] } = {}) {
  const endings = new Set(boundaries), retained = new Set(keep), tokens = tokenize(text), spans = [];
  let start = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (endings.has(tokens[i].text) || i === tokens.length - 1) {
      const boundary = endings.has(tokens[i].text);
      const end = boundary && !retained.has(tokens[i].text) ? tokens[i].start : tokens[i].end;
      let begin = start; while (begin < end && /\s/u.test(text[begin])) begin++;
      if (end > begin) spans.push({ text: text.slice(begin, end).trimEnd(), start: begin, end: tokens[i].end });
      start = tokens[i].end;
    }
  }
  return spans;
}
export function parseDocument(text, grammar, { budget = new Budget(), scope = '', cache = true, lowering } = {}) {
  check(typeof text === 'string' && text.trim().length > 0 && text.length <= 60000, 'Input must be a nonempty string of at most 60,000 characters');
  const source = { id: digest(text), text }, entries = [], spans = segment(text, grammar.data.segmentation), labels = {};
  for (const span of spans) {
    budget.tick();
    const parsed = grammar.parse(span.text, { budget, cache, scope: `${scope}:${source.id}:${span.start}` });
    let instructions, reason = parsed.status;
    if (parsed.status === 'parsed') {
      try {
        check(typeof lowering === 'string', 'A document lowering circuit is required');
        instructions = grammar.runtime.execute(lowering, { value: parsed.alternatives[0] }, { budget, cache });
      }
      catch (error) { if (error.name === 'LimitError') throw error; reason = `invalid-semantics: ${error.message}`; }
    }
    if (!instructions) {
      const queryMarker = grammar.data.segmentation.queryBoundaries?.includes(text[span.end - 1]);
      entries.push({ kind: 'gap', intent: queryMarker ? 'query' : 'statement', text: text.slice(span.start, span.end), reason, affected: tokenize(span.text).map(t => t.value), span: { start: span.start, end: span.end }, alternatives: parsed.alternativeCount });
    } else for (const instruction of instructions) entries.push({ ...instruction, span: { start: span.start, end: span.end }, derivations: parsed.derivations });
    for (const token of tokenize(span.text)) labels[token.value] ??= token.text;
  }
  return { schema: 'sxlm.document.v1', source, entries, labels, coverage: { sentences: spans.length, parsed: spans.length - entries.filter(e => e.kind === 'gap').length, gaps: entries.filter(e => e.kind === 'gap').length } };
}
