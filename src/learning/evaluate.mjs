import { encodeSOP } from '../kernel/sop-data.mjs';
import { canonical, check, digest, executionDigest, Budget } from '../kernel/data.mjs';

export function evaluateCase(model, item) {
  try {
    let result;
    if(item.task==='circuit'){
      check(typeof item.circuit==='string'&&item.input,'Circuit evaluation requires an explicit circuit and input');
      const budget=new Budget(item.options?.limits);
      result={status:'evaluated',text:'',value:model.runtime.execute(item.circuit,item.input,{budget,cache:item.options?.cache??true}),metrics:budget.report()};
    }else if(item.task==='plan') result={...model.plan(item.problem,item.options),text:''};
    else result = item.task === 'summarize' ? model.summarize(item.text, item.options) : item.task === 'complete' ? model.complete(item.text, item.options) : model.ask(item.text, item.options);
    const failures = [];
    for (const [key, expected] of Object.entries(item.expect)) {
      if (key === 'contains') { for (const phrase of expected) if (!result.text.includes(phrase)) failures.push(`Missing phrase: ${phrase}`); }
      else if (key === 'sourceFaithful') {
        const spans = result.evidence?.map(e => result.source.text.slice(e.start, e.end)) ?? [];
        if (!spans.length || spans.join(' ') !== result.text) failures.push('Output does not equal its cited source spans');
      } else if (key === 'proof') { if (!result.verification?.valid || !result.verification.checkedNodes) failures.push('Missing/invalid formal proof'); }
      else if (key === 'planWitness') { if (result.verification?.valid !== expected) failures.push('Missing/invalid transition witness'); }
      else if (key === 'gaps') { if (result.document?.coverage.gaps !== expected) failures.push(`Coverage gaps: ${result.document?.coverage.gaps}, expected ${expected}`); }
      else if (item.task==='circuit'&&key==='value' ? executionDigest(result.value)!==executionDigest(expected) : canonical(result[key] ?? null) !== canonical(expected)) failures.push(`${key}: ${encodeSOP(result[key] ?? null)}, expected ${encodeSOP(expected)}`);
    }
    return { id: item.id, pass: !failures.length, failures, actual: { status: result.status, truth: result.truth ?? null, value: result.value ?? null, values: result.values ?? null, gaps: result.document?.coverage.gaps ?? null, text: result.text, verification: result.verification ?? null, ...(item.task==='plan'?{steps:result.steps,cost:result.cost??null}:{}) }, milliseconds: result.metrics.milliseconds };
  } catch (error) { return { id: item.id, pass: false, failures: [error.message], actual: null, milliseconds: 0 }; }
}
export function evaluate(model, cases) {
  check(new Set(cases.map(c => c.id)).size === cases.length, 'Duplicate evaluation case IDs');
  const results = cases.map(c => evaluateCase(model, c));
  return { schema: 'sxlm.evaluation.v1', model: model.resources.hash, casesHash: digest(cases), total: results.length, passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, results };
}
