import { encodeSOP, decodeSOP } from './sop-data.mjs';
import { mountChat } from './chat.js';
const present = record => Object.fromEntries(Object.entries(record).filter(([,value])=>value!==undefined));
const $ = id => document.getElementById(id);
let info, task = 'reason', session = null, result = null, inspection = 'evidence', candidateID = null;
const descriptions = {
  chat: ['Talk with your knowledge.', 'Ask about introductory knowledge, retain a conversation, or use Codex to build circuits from your documents.', 'TEXT → CODING AGENT → SOP → CONVERSATION'],
  reason: ['Reason with what you know.', 'Supply facts, rules and a question. Inspect the interpretation and the proof behind the answer.', 'LANGUAGE → CIRCUITS → EVIDENCE', 'Facts, rules & question', 'Run reasoning'],
  summarize: ['Keep the important statements.', 'Select a shorter, source-faithful account. Every selected sentence remains linked to the original text.', 'SOURCE → SELECTION → SUMMARY', 'Source text', 'Create summary'],
  complete: ['Continue from learned patterns.', 'Use attested source continuations or the sequence circuits learned from training observations.', 'CONTEXT → LEARNED SEQUENCES → CONTINUATION', 'Text prefix', 'Complete text'],
  learn: ['Teach a reusable construction.', 'Induce a semantic circuit from examples, evaluate its transfer, and activate the validated extension.', 'EXAMPLES → ABSTRACTION → VERIFICATION'],
  evaluate: ['Measure what actually works.', 'Inspect capability checks, structural transfer, learning gains and the language challenges that remain.', 'CONTRACTS → TRANSFER → KNOWN LIMITS'],
};
async function api(path, body) {
  const response = await fetch(path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/sop' }, body: encodeSOP(body) });
  const value = decodeSOP(await response.text()); if (!response.ok) throw new Error(value.error || 'Request failed'); return value;
}
function error(message) { $('error').textContent = message; $('error').hidden = !message; }
function element(tag, text, className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
function metadata() {
  $('model-id').textContent = `model ${info.model.slice(0, 12)}`;
  $('circuit-count').textContent = info.grammar.circuits;
  $('pack-count').textContent = `${info.manifests.length} installed pack${info.manifests.length === 1 ? '' : 's'}`;
  const pending = info.architecture?.requirements.filter(r=>!r.achieved) ?? [];
  $('architecture-status').hidden = pending.length === 0;
  $('architecture-status').textContent = pending.length ? `Architecture migration in progress. ${info.architecture.migration.inducedCircuits} realization circuits, ${info.architecture.migration.inducedSemanticDispatch} semantic dispatchers and one SOP score have reproducible learning derivations. Document, summary, completion and state policies execute as circuits but still include authored components. Sequence frequencies and source memory are compiled offline. The full vision remains incomplete.` : '';
}
function setTask(next) {
  task = next; document.body.classList.toggle('chat-mode', task === 'chat'); error(''); const [title, description, eyebrow, label, button] = descriptions[task];
  document.querySelectorAll('[data-task]').forEach(b => b.classList.toggle('active', b.dataset.task === task));
  $('page-title').textContent = title; $('page-description').textContent = description; $('eyebrow').textContent = eyebrow;
  $('current-task').textContent = task === 'learn' ? 'Learning lab' : task[0].toUpperCase() + task.slice(1);
  $('task-workspace').hidden = ['learn','evaluate','chat'].includes(task); $('learn-workspace').hidden = task !== 'learn'; $('eval-workspace').hidden = task !== 'evaluate'; $('chat-workspace').hidden = task !== 'chat';
  if (task === 'chat') chat.refresh().catch(e => error(e.message));
  if (['reason','summarize','complete'].includes(task)) {
    $('prompt-label').textContent = label; $('run').replaceChildren(element('span', button), element('span', '↗'));
    $('summary-options').hidden = task !== 'summarize'; $('completion-options').hidden = task !== 'complete';
    $('session-control').hidden = task !== 'reason'; $('reset').hidden = task !== 'reason';
    $('examples').replaceChildren(...info.examples[task].map((e,i) => { const option = element('option', e.title); option.value = i; return option; }));
    loadExample();
  }
}
function loadExample() {
  const example = info.examples[task][Number($('examples').value)]; $('prompt').value = example.text;
  $('context').value = example.context ?? ''; $('focus').value = example.focus ?? ''; $('sentence-count').value = example.sentences ?? 3;
  session = null; result = null; $('answer').replaceChildren(element('p','A clear answer.\nA visible path to it.','placeholder')); $('answer-metadata').replaceChildren(); $('run-state').textContent = 'READY'; $('run-state').className = 'tag neutral'; $('download').disabled = true; renderInspection();
}
function sourceMap() { return new Map([...(result?.sources ?? []), ...(result?.source ? [result.source] : [])].map(s => [s.id,s])); }
function quote(evidence, sources) {
  const source = sources.get(evidence.source), block = element('div',undefined,'source-quote');
  block.append(element('small', `${source?.pack ?? 'SOURCE'} · ${evidence.start}:${evidence.end}`));
  block.append(element('div',source ? source.text.slice(evidence.start,evidence.end) : 'Source unavailable')); return block;
}
function proofNode(proof, sources) {
  const node = element('div',undefined,'proof-node');
  const atom = proof.atom; node.append(element('div',`${atom.negative ? '¬ ' : ''}${atom.predicate}(${atom.terms.join(', ')})`,'proof-label'));
  node.append(element('div',proof.kind === 'rule' ? `INFERRED · rule ${proof.rule.slice(0,10)}` : `ASSERTED · ${atom.context}`,'proof-note'));
  if (proof.evidence) node.append(quote(proof.evidence,sources));
  for (const child of proof.premises ?? []) node.append(proofNode(child,sources)); return node;
}
function renderInspection() {
  document.querySelectorAll('[data-inspect]').forEach(b => { b.classList.toggle('selected',b.dataset.inspect === inspection); b.setAttribute('aria-selected', String(b.dataset.inspect === inspection)); });
  $('inspection').replaceChildren();
  if (!result) { $('inspection').append(element('div','Run a task to inspect its evidence and execution.','empty-state')); return; }
  if (inspection === 'interpretation') { $('inspection').append(element('pre',encodeSOP(result.document ?? present({ method: result.method, decisions: result.decisions, selected: result.selected, alternatives: result.alternatives })))); return; }
  if (inspection === 'trace') { $('inspection').append(element('pre',encodeSOP(present({ metrics: result.metrics, trace: result.trace, verification: result.verification, model: result.model })))); return; }
  const sources = sourceMap(); let count = 0;
  for (const answer of result.answers ?? [result]) {
    for (const proof of answer.proofs ?? []) { $('inspection').append(proofNode(proof,sources)); count++; }
    for (const evidence of answer.evidence ?? []) { $('inspection').append(quote(evidence,sources)); count++; }
  }
  for (const gap of result.document?.entries.filter(e => e.kind === 'gap') ?? []) {
    const node = element('div',undefined,'source-quote'); node.append(element('small',`COVERAGE GAP · ${gap.reason}`),element('div',gap.text)); $('inspection').append(node); count++;
  }
  if (!count) $('inspection').append(element('div', result.kind === 'arithmetic' ? `Exact arithmetic: ${result.task.expression} = ${result.value}` : 'No supporting source proof is available for this result.','empty-state'));
}
async function run() {
  error(''); $('run').disabled = true; $('run-state').textContent = 'RUNNING';
  try {
    const options = task === 'summarize' ? { sentences: Number($('sentence-count').value), focus: $('focus').value } : task === 'complete' ? { context: $('context').value } : {};
    result = await api('/api/run',{ task, text: $('prompt').value, options, session: $('remember').checked ? session : null }); session = result.session ?? null;
    $('answer').textContent = result.text; $('run-state').textContent = result.truth?.toUpperCase() ?? result.status.toUpperCase(); $('run-state').className = `tag ${['unknown','unsupported','budget-exceeded'].includes(result.status) || result.truth === 'both' ? 'bad' : ''}`;
    const pills = [`${result.metrics.milliseconds} ms`];
    if (result.document) pills.push(`${result.document.coverage.parsed}/${result.document.coverage.sentences} sentences parsed`);
    if (result.verification?.checkedNodes) pills.push(`${result.verification.checkedNodes} proof nodes verified`);
    if (result.method) pills.push(result.method); if (result.grounding) pills.push(result.grounding);
    $('answer-metadata').replaceChildren(...pills.map(p => element('span',p))); $('download').disabled = false; renderInspection();
  } catch(e) { error(e.message); $('run-state').textContent = 'ERROR'; } finally { $('run').disabled = false; }
}
function metric(value,label) { const node=element('div');node.append(element('strong',value),element('span',label));return node; }
async function learn() {
  error(''); $('learn-run').disabled = true; $('learning-state').textContent = 'EVALUATING'; $('activate').hidden = true;
  try {
    const data = await api('/api/learn',{specification:decodeSOP($('training-spec').value),gates:decodeSOP($('training-gates').value)}), receipt=data.receipt; candidateID = data.id;
    $('candidate-sop').textContent=encodeSOP(data.candidate);$('learning-state').textContent=receipt.accepted?'VALIDATED':'REJECTED';$('learning-state').className=`tag ${receipt.accepted?'':'bad'}`;
    const box=$('learning-result');box.className='';box.replaceChildren();const metrics=element('div',undefined,'learning-metrics');metrics.append(metric(`${receipt.gates.before.passed} → ${receipt.gates.after.passed}`,'transfer checks passed'),metric(receipt.gates.after.total,'transfer checks'),metric(receipt.regressionsIntroduced.length,'new regressions'));box.append(metrics);
    for(const item of receipt.gates.after.results){const row=element('div',undefined,'case-row');row.append(element('span',item.pass?'PASS':'FAIL',item.pass?'pass':'fail'),element('span',item.id));box.append(row);}
    const production=data.candidate.training.grammarProposal.productions[0];box.append(element('p',`${production.lhs} → ${production.rhs.map(x=>typeof x==='string'?`〈${x}〉`:x.literal).join(' ')}`,'body-copy'));
    $('activate').hidden=!receipt.accepted;
  }catch(e){error(e.message);$('learning-state').textContent='ERROR';}finally{$('learn-run').disabled=false;}
}
async function activate() {
  try {await api('/api/activate',{id:candidateID});info=await api('/api/info');metadata();session=null;$('activate').hidden=true;$('learning-state').textContent='ACTIVE';$('learning-result').append(element('p','The validated pack is active. Return to Reason and use the new construction.','body-copy'));}catch(e){error(e.message);}
}
async function evaluate() {
  error('');$('eval-run').disabled=true;$('eval-result').replaceChildren(element('div','Running capability, transfer and learning checks…','notice wide'));
  try {
    const report=await api('/api/evaluate',{});$('eval-result').replaceChildren();
    const intro=element('div',undefined,'notice wide');intro.append(element('strong',`Acceptance ${report.acceptance?'passed':'failed'}. `),element('span',`Learning: ${report.learning.gates.before.passed} → ${report.learning.gates.after.passed}/${report.learning.gates.after.total} transfer checks. ${report.learning.regressionsIntroduced.length} regressions introduced. This run evaluates the repository bootstrap plus the reference induction experiment.`));$('eval-result').append(intro);
    const captions={conformance:'Declared behavior: logic, quantities, extraction and completion.',composition:'New combinations of supported constructions and bindings.',metamorphic:'Systematic symbol renaming. Counted separately from structural transfer.',challenges:'Aspirational language capabilities. Failures remain visible; these do not gate acceptance.'};
    for(const [name,suite]of Object.entries(report.suites)){
      const card=element('div',undefined,'panel');card.append(element('div',name.toUpperCase(),'eyebrow'),element('div',`${suite.passed} / ${suite.total}`,'eval-score'),element('p',captions[name],'eval-caption'));
      const details=element('details');details.append(element('summary','Inspect individual cases'));
      for(const item of suite.results){const row=element('div',undefined,'case-row');row.append(element('span',item.pass?'PASS':'FAIL',item.pass?'pass':'fail'),element('span',item.id));details.append(row);if(!item.pass)details.append(element('pre',item.failures.join('\n')));}
      card.append(details);$('eval-result').append(card);
    }
  }catch(e){error(e.message);$('eval-result').replaceChildren();}finally{$('eval-run').disabled=false;}
}
const chat = mountChat(api, error);
document.querySelectorAll('[data-task]').forEach(b=>b.addEventListener('click',()=>setTask(b.dataset.task)));
document.querySelectorAll('[data-inspect]').forEach(b=>b.addEventListener('click',()=>{inspection=b.dataset.inspect;renderInspection();}));
$('examples').addEventListener('change',loadExample);$('run').addEventListener('click',run);$('reset').addEventListener('click',()=>{session=null;$('answer-metadata').replaceChildren(element('span','Context cleared'));});
$('learn-run').addEventListener('click',learn);$('activate').addEventListener('click',activate);$('eval-run').addEventListener('click',evaluate);
$('download').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([encodeSOP(result)],{type:'application/sop'}));const a=element('a');a.href=url;a.download='sxlm-result.sop';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('prompt').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();run();}});
try {info=await api('/api/info');metadata();$('training-spec').value=encodeSOP(info.specification);$('training-gates').value=encodeSOP(info.learningGates);setTask('chat');}catch(e){error(e.message);}
