import { readFileSync, writeFileSync } from 'node:fs';
import { SymbolicModel } from '../../src/model.mjs';
import { encodeSOP, decodeSOP } from '../../src/kernel/sop-data.mjs';
import { check, digest } from '../../src/kernel/data.mjs';

const dataset = decodeSOP(readFileSync(new URL('./circuitlm-summary.sop', import.meta.url)));
check(new Set(dataset.cases.map(item => item.id)).size === dataset.cases.length, 'Duplicate summary fixture');
const model = new SymbolicModel(), results = [];
for (const item of dataset.cases) {
  const text = item.sentences.join(' '), failures = [];
  let answer = null, selected = [], exactSource = false;
  try {
    check(item.gold.every(index => Number.isInteger(index) && index >= 0 && index < item.sentences.length), 'Invalid gold sentence index');
    answer = model.summarize(text, { sentences: item.limit, focus: item.query });
    selected = answer.selected ?? [];
    check(selected.every(index => Number.isInteger(index) && index >= 0 && index < item.sentences.length) &&
      new Set(selected).size === selected.length, 'Invalid selected sentence index');
    exactSource = answer.source?.id === digest(text) && answer.source.text === text &&
      answer.evidence.length === selected.length && answer.evidence.every((span, index) =>
        span.source === answer.source.id && Number.isInteger(span.start) && Number.isInteger(span.end) &&
        span.start >= 0 && span.end <= text.length && span.end > span.start &&
        text.slice(span.start, span.end) === item.sentences[selected[index]]) &&
      answer.text === selected.map(index => item.sentences[index]).join(' ');
    if (!exactSource) failures.push('Selected output or evidence differs from the original sentence spans');
    if (answer.status !== 'answered' || answer.totalSentences !== item.sentences.length)
      failures.push('Summary failed or original sentence segmentation changed');
    if (selected.length !== item.gold.length || item.gold.some(index => !selected.includes(index)))
      failures.push('Selection differs from the source gold sentence set');
    if (selected.length > item.limit) failures.push('Requested sentence limit exceeded');
  } catch (error) { failures.push(error.message); }
  const matched = item.gold.filter(index => selected.includes(index)).length;
  const lead = Array.from({ length: item.limit }, (_, index) => index);
  results.push({ id: item.id, split: item.split, adaptation: item.adaptation, sourceLocale: item.sourceLocale,
    passed: failures.length === 0, failures, gold: item.gold, selected,
    recall: matched / item.gold.length, precision: matched / (selected.length || 1),
    leadRecall: item.gold.filter(index => lead.includes(index)).length / item.gold.length,
    exactSource, output: answer?.text ?? null, metrics: answer?.metrics ?? null });
}
const average = (rows, field) => rows.reduce((sum, row) => sum + row[field], 0) / (rows.length || 1);
const summary = rows => ({ total: rows.length, passed: rows.filter(row => row.passed).length,
  recall: average(rows, 'recall'), precision: average(rows, 'precision'), leadRecall: average(rows, 'leadRecall'),
  sourceFaithful: rows.filter(row => row.exactSource).length });
const report = { schema: 'sxlm.compatibility-summary-evaluation.v1', generated: new Date().toISOString(),
  model: model.resources.hash, source: dataset.source, casesHash: digest(dataset.cases),
  ...summary(results), groups: Object.fromEntries([...new Set(results.map(row => row.adaptation))]
    .map(group => [group, summary(results.filter(row => row.adaptation === group))])),
  results, qualifications: dataset.qualifications };
writeFileSync(new URL('../../reports/compatibility-circuitlm-summary.sop', import.meta.url), encodeSOP(report));
for (const [group, row] of Object.entries(report.groups))
  console.log(`${group}: ${row.passed}/${row.total} exact; recall ${row.recall.toFixed(3)}; lead ${row.leadRecall.toFixed(3)}; faithful ${row.sourceFaithful}/${row.total}`);
if (report.passed !== report.total) process.exitCode = 1;
