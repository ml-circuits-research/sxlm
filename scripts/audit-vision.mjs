import { normalizedGraphs, graphsFromModules } from '../src/learning/sop-output.mjs';
import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SymbolicModel } from '../src/model.mjs';
import { digest, executionDigest } from '../src/kernel/data.mjs';
import { synthesizeRealization } from './learn-realization.mjs';
import { buildSemantics } from './build-semantics.mjs';
import { synthesizeSOP } from './build-sop.mjs';
import { synthesizeCompletion } from './build-completion.mjs';
import { learnSequencePack } from '../src/learning/sequence.mjs';
import { compileSOP } from '../src/kernel/sop.mjs';
import { synthesizeDocument } from './build-document.mjs';
import { synthesizeKnowledge } from './build-knowledge.mjs';
import { synthesizeExpressions } from './build-expressions.mjs';
import { synthesizePlanning } from './build-planning.mjs';
import { synthesizeText } from './build-text.mjs';
import { textPolicyForModel, textPolicyIdentity } from '../src/learning/text-policy.mjs';
import { synthesizeLexical } from './build-lexical.mjs';
import { learnProgramPack } from '../src/learning/search.mjs';
import { captureRuntime, modelIdentity } from '../src/runtime-identity.mjs';
import { replayConstructions } from './support/construction-replay.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
function read(path) { return readFileSync(resolve(root, path), 'utf8'); }
export function auditVision({ model = new SymbolicModel() } = {}) {
  const contracts = decodeSOP(read('docs/native-contracts.sop'));
  const currentRuntime = captureRuntime(), sourceFiles = currentRuntime.sourceFiles;
  const identityBound = currentRuntime.hash === model.resources.runtime.hash && modelIdentity(model.resources.knowledgeHash) === model.resources.hash && model.runtime.identity === currentRuntime.hash && model.runtime.sealed && Object.isFrozen(model) && Object.isFrozen(model.runtime);
  const primitives = [...model.runtime.primitives].map(([name, primitive]) => ({ name, inputs: primitive.inputs, output: primitive.output, review: contracts.primitives[name] ?? { class: 'unreviewed' } }));
  const nativeGaps = primitives.filter(p => p.review.class !== 'general-mechanism');
  const origins = new Map(model.packs.flatMap(pack => [...(pack.circuits??[]), ...(pack.sop??[])].map(c=>[c.id,c.provenance??pack.provenance])));
  const circuits = model.resources.circuits.map(c => ({id:c.id,derivation:c.learning??null,origin:origins.get(c.id)??{kind:'unrecorded'}}));
  const parallelKnowledge = model.packs.flatMap(pack => ['grammar','theory','text','corpus','realization'].filter(field => Object.hasOwn(pack, field)).map(field => ({ pack: pack.id, field, hash: digest(pack[field]) })));
  const curriculum = decodeSOP(read('training/realization.sop')), adapters = decodeSOP(read('training/realization-adapters.sop'));
  const rebuilt = synthesizeRealization(curriculum, adapters); rebuilt.circuits=normalizedGraphs(rebuilt.circuits);
  const semantics = buildSemantics(decodeSOP(read('training/semantics-dispatch.sop'))), sop = synthesizeSOP(); semantics.circuits=normalizedGraphs(semantics.circuits);
  const realizationReplay = rebuilt.circuits.every(c => { const installed = model.resources.circuits.find(p => p.id === c.id); return installed && executionDigest(installed) === executionDigest(c); });
  const completion=synthesizeCompletion(),document=synthesizeDocument(),knowledge=synthesizeKnowledge(),sequenceReplays=[],sequenceCircuits=[];
  for(const pack of model.packs)if(pack.training?.algorithm==='sequence-pack-v1'){
    try{
      const {texts,...options}=pack.training.specification;
      if(typeof pack.training.packId!=='string')throw Error('Missing training pack identity');
      const replay=learnSequencePack(texts,{...options,id:pack.training.packId});
      const generated=replay.sop.map(m=>compileSOP(m.id,m.source,{provenance:m.provenance,learning:m.learning}));
      const expected=new Set(generated.map(c=>c.id));
      const prefix='memory.'+pack.training.packId+'.';
      const unexpected=(pack.sop??[]).filter(m=>m.id.startsWith(prefix)&&!expected.has(m.id));
      const contentsMatch=generated.every(c=>executionDigest(model.resources.circuits.find(p=>p.id===c.id)??null)===executionDigest(c));
      const providersMatch=Object.entries(replay.providers).every(([slot,ids])=>ids.every(id=>(pack.providers?.[slot]??[]).includes(id)));
      const activePolicy=textPolicyForModel(model);
      const textPolicyMatches=executionDigest(activePolicy)===executionDigest(replay.training.specification.textPolicy)&&replay.provenance.textPolicy===textPolicyIdentity(model.runtime,activePolicy.entrypoints);
      const matches=contentsMatch&&providersMatch&&unexpected.length===0&&textPolicyMatches;
      if(matches)sequenceCircuits.push(...generated);
      sequenceReplays.push({pack:pack.id,trainingHash:replay.provenance.trainingHash,modules:generated.length,components:3,contentsMatch,providersMatch,textPolicyMatches,unexpected:unexpected.map(c=>c.id),reproduced:matches});
    }catch(error){sequenceReplays.push({pack:pack.id,reproduced:false,error:error.message});}
  }
  const programReplays=[],learnedPrograms=[];
  for(const[index,pack]of model.packs.entries())if(pack.training?.algorithm==='typed-observational-search-v1'){
    try{
      const parent=new SymbolicModel({packs:model.packs.slice(0,index)});
      const replay=learnProgramPack(parent,pack.training.specification);
      const matches=executionDigest(replay)===executionDigest(pack);
      if(matches)learnedPrograms.push(...graphsFromModules(replay.sop));
      programReplays.push({pack:pack.id,parentModel:parent.resources.hash,reproduced:matches,circuit:replay.sop[0].id,applicationCost:replay.sop[0].learning.applicationCost,qualification:'Exact synthesis replay; separate held-out evaluation is still required.'});
    }catch(error){programReplays.push({pack:pack.id,reproduced:false,error:error.message});}
  }
  const planning=synthesizePlanning(), planningIDs=new Set(planning.modules.map(m=>m.id));
  const planningPolicyReplay=graphsFromModules(planning.policies).every(c=>executionDigest(model.resources.circuits.find(p=>p.id===c.id)??null)===executionDigest(c));
  const planningMethodReplay=planning.learned.every(module=>model.packs.some(pack=>
    executionDigest(pack.training?.components?.setCoverage??null)===executionDigest(planning.evidence)&&
    executionDigest(pack.sop?.find(m=>m.id===module.id)??null)===executionDigest(module)))&&
    graphsFromModules(planning.learned).every(c=>executionDigest(model.resources.circuits.find(p=>p.id===c.id)??null)===executionDigest(c));
  const planningMigration={...planning.receipt,policyReplay:planningPolicyReplay,methodReplay:planningMethodReplay,
    nativePlanningRemoved:!model.runtime.primitives.has('planning.search')&&model.resources.entrypoints.plan==='planning.run',
    compilerOutsideRuntime:!sourceFiles.some(f=>['src/tasks/planner.mjs','src/learning/search.mjs','scripts/build-planning.mjs','test/reference/planner-v1.mjs'].includes(f.path)),
    obsoleteModules:model.resources.circuits.filter(c=>c.id.startsWith('planning.')&&!planningIDs.has(c.id)).map(c=>c.id)};
  const lexical=synthesizeLexical(),lexicalIDs=new Set(lexical.modules.map(m=>m.id));
  const lexicalMethodReplay=lexical.learned.every(module=>model.packs.some(pack=>executionDigest(pack.training?.components?.lexicalNormalization??null)===executionDigest(lexical.evidence)&&executionDigest(pack.sop?.find(m=>m.id===module.id)??null)===executionDigest(module)))&&graphsFromModules(lexical.learned).every(c=>executionDigest(model.resources.circuits.find(p=>p.id===c.id)??null)===executionDigest(c));
  const lexicalMigration={...lexical.receipt,
    policyReplay:graphsFromModules(lexical.policies).every(c=>executionDigest(model.resources.circuits.find(p=>p.id===c.id)??null)===executionDigest(c)),methodReplay:lexicalMethodReplay,
    entrypointBindings:Object.entries(lexical.entrypoints).every(([key,id])=>model.resources.entrypoints[key]===id),
    compilerOutsideRuntime:!sourceFiles.some(f=>['scripts/build-lexical.mjs','src/learning/search.mjs','test/reference/grammar-v1.mjs'].includes(f.path)),
    nativeTokenBoundariesRemain:true,nativeChartSchedulingRemains:model.runtime.primitives.has('kernel.chart.parse'),
    obsoleteModules:model.resources.circuits.filter(c=>c.id.startsWith('lexical.')&&!lexicalIDs.has(c.id)).map(c=>c.id)};
  const text=synthesizeText();
  const textMigration={...text.receipt,nativeSegmentationRemoved:!model.runtime.primitives.has('kernel.text.segment'),policyReplay:text.circuits.every(c=>executionDigest(model.resources.circuits.find(p=>p.id===c.id)??null)===executionDigest(c)),compilerOutsideRuntime:!sourceFiles.some(f=>['src/language/document.mjs','src/learning/text-policy.mjs','test/reference/document-v1.mjs'].includes(f.path))};
  const constructionReplays = replayConstructions(model);
  const reproduced = new Map([...rebuilt.circuits,...semantics.circuits,...sop.circuits,...sequenceCircuits,...learnedPrograms,...constructionReplays.circuits,...(planningMethodReplay?graphsFromModules(planning.learned):[]),...(lexicalMethodReplay?graphsFromModules(lexical.learned):[])].filter(c=>c.learning).map(c=>[c.id, executionDigest(c)]));
  const withoutVerifiedDerivation = circuits.filter(c => !c.derivation || !reproduced.has(c.id) || executionDigest(model.resources.circuits.find(installed=>installed.id===c.id)) !== reproduced.get(c.id));
  const expressions=synthesizeExpressions(); expressions.circuits=normalizedGraphs(expressions.circuits); const expressionIDs=new Set(expressions.circuits.map(c=>c.id));
  const expressionRoots=new Set(expressions.circuits.map(c=>c.compilation?.root??c.id));
  const expressionMigration={...expressions.receipt,
    nativeInterpreterRemoved:!model.runtime.primitives.has('data.template'),
    compilerOutsideRuntime:!sourceFiles.some(f=>f.path==='src/learning/expressions.mjs'||f.path==='test/reference/template-v1.mjs'),
    activeInterpreterNodes:model.resources.circuits.flatMap(c=>c.nodes).filter(n=>n.op==='data.template').length,
    replay:expressions.circuits.every(c=>executionDigest(model.resources.circuits.find(p=>p.id===c.id)??null)===executionDigest(c)),
    obsoleteFragments:model.resources.circuits.filter(c=>expressionRoots.has(c.compilation?.root)&&!expressionIDs.has(c.id)).map(c=>c.id)};
  const closureApproved = contracts.closureReview?.status === 'approved' && contracts.closureReview.sourceClosureHash === digest(sourceFiles);
  const vision = read('docs/specs/DS000-vision.md'), invariantIDs = [...vision.matchAll(/^\| ([KCLSE]\d+) \|/gm)].map(m => m[1]);
  const requiredIDs = ['K1','K2','K3','C1','C2','C3','C4','L1','L2','L3','L4','S1','S2','S3','S4','S5','E1','E2','E3'];
  const requirements = [
    { id:'single-execution-language', achieved:expressionMigration.nativeInterpreterRemoved&&expressionMigration.compilerOutsideRuntime&&expressionMigration.activeInterpreterNodes===0&&expressionMigration.replay&&expressionMigration.obsoleteFragments.length===0, evidence:expressionMigration, remaining:'Only the typed graph VM may execute installed policy; offline lowering must reproduce its full active graph families.' },
    { id: 'execution-identity', achieved: identityBound, evidence: { runtime:currentRuntime.hash, knowledge:model.resources.knowledgeHash, model:model.resources.hash, sealed:model.runtime.sealed, qualification:currentRuntime.qualification }, remaining:'The model must bind its static host source closure, environment and order-sensitive executable knowledge. This structural check is complemented by identity regression tests; it is not hostile-host attestation.' },
    { id: 'small-general-kernel', achieved: nativeGaps.length === 0 && closureApproved, evidence: { privilegedSourceFiles: sourceFiles.length, privilegedSourceBytes: sourceFiles.reduce((n,f) => n + f.bytes, 0), unresolvedNativeOperations: nativeGaps.map(p => p.name), closureReview: contracts.closureReview, closureApproved }, remaining: 'The whole privileged runtime still contains native task policies; a small dataflow interpreter alone does not prove a small general kernel.' },
    { id: 'knowledge-only-in-circuits', achieved: parallelKnowledge.length === 0 && nativeGaps.length === 0, evidence: { parallelKnowledge }, remaining: 'Remove active policy tables and native task strategies; preserve their behavior through circuit execution.' },
    { id: 'all-competence-learned', achieved: withoutVerifiedDerivation.length === 0 && parallelKnowledge.length === 0, evidence: { totalCircuits: circuits.length, circuitsWithVerifiedDerivation: circuits.length - withoutVerifiedDerivation.length, withoutVerifiedDerivation: withoutVerifiedDerivation.map(c => ({ id:c.id, kind:c.origin.kind, claimedLearning:c.derivation?.kind??null })) }, remaining: 'A provenance tag is insufficient; migrate authored components through actual synthesis/learning and independent validation.' },
    { id: 'vision-and-invariants', achieved: executionDigest(invariantIDs) === executionDigest(requiredIDs) && /^### Computational theory$/m.test(vision) && /^### Completion rule$/m.test(vision), evidence: { artifact:'docs/specs/DS000-vision.md', hash:digest(vision), invariantIDs } },
  ];
  const knowledgeMigration = { theorySideTableRemoved:!parallelKnowledge.some(p=>p.field==='theory'), textSideTableRemoved:!parallelKnowledge.some(p=>p.field==='text'), nativeTheoryInjectionRemoved:model.resources.entrypoints.initial==='theory.bootstrap' && !Object.hasOwn(model.resources,'theory'), knowledgePolicyReplay:knowledge.circuits.every(c=>executionDigest(model.resources.circuits.find(p=>p.id===c.id)??null)===executionDigest(c)), knowledgeModules:knowledge.modules.length, qualification:knowledge.receipt.qualification };
  return { schema:'sxlm.vision-audit.v1', model:model.resources.hash, runtime:currentRuntime.hash, sourceClosureHash:digest(sourceFiles), complete:requirements.every(r=>r.achieved), requirements, sourceFiles, primitives, knowledgeMigration, expressionMigration, planningMigration, lexicalMigration, textMigration, programReplays, constructionReplays: constructionReplays.receipts,
    demonstratedMigration: { nativeDocumentPolicyRemoved:!model.runtime.primitives.has('language.parse'), grammarSideTableRemoved:!parallelKnowledge.some(p=>p.field==='grammar'), grammarReconstructed:executionDigest(model.resources.grammar)===executionDigest(model.runtime.execute(model.resources.entrypoints.grammar,{with:{}})), documentPolicyReplay:document.circuits.every(c=>executionDigest(model.resources.circuits.find(p=>p.id===c.id)??null)===executionDigest(c)), documentModules:document.modules.length, grammarQualification:'Grammar constructors preserve authored proposals. The chart parser remains an unverified native accelerator.', nativeRendererRemoved: !model.runtime.primitives.has('language.realize'), nativeInterpreterRemoved:!model.runtime.primitives.has('world.interpret'), nativeSummaryRemoved:!model.runtime.primitives.has('text.summarize'), nativeCompletionRemoved:!model.runtime.primitives.has('sequence.complete'), activeCorpusRemoved:!parallelKnowledge.some(p=>p.field==='corpus'), completionPolicyReplay:completion.circuits.filter(c=>!c.learning).every(c=>executionDigest(model.resources.circuits.find(p=>p.id===c.id)??null)===executionDigest(c)), sequenceReplays, sequenceQualification:'Module counts are compiler fragments: each sequence pack supplies one frequency model, source memory and a supplied context bound. Replay is not independent generalization evidence.', semanticPolicyReplay:semantics.circuits.every(c=>{const installed=model.resources.circuits.find(p=>p.id===c.id);return installed&&executionDigest(installed)===executionDigest(c);}), sopReplay:sop.circuits.every(c=>{const installed=model.resources.circuits.find(p=>p.id===c.id);return installed&&executionDigest(installed)===executionDigest(c);}), sopModules:sop.modules.length, inducedSemanticDispatch:semantics.receipt.inducedDispatchCircuits, inducedSummaryScores:1, realizationSideTableRemoved: !parallelKnowledge.some(p=>p.field==='realization'), realizationReplay, inducedCircuits:rebuilt.receipt.inducedCircuits, authoredAdapters:rebuilt.receipt.authoredAdapters },
    qualification:'This is a structural completion audit. It reports unresolved requirements and does not replace behavioral tests, external language evaluation, or scrutiny of learning data independence.' };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const audit = auditVision(); mkdirSync(new URL('../reports/', import.meta.url), {recursive:true});
  writeFileSync(new URL('../reports/vision-audit.sop', import.meta.url), encodeSOP(audit)+'\n');
  for (const requirement of audit.requirements) console.log(`${requirement.achieved ? 'VERIFIED' : 'INCOMPLETE'} ${requirement.id}`);
  console.log(`Renderer migration: ${audit.demonstratedMigration.inducedCircuits} induced circuits; ${audit.demonstratedMigration.authoredAdapters} authored adapters remain. Reproduction: ${audit.demonstratedMigration.realizationReplay ? 'PASS' : 'FAIL'}`);
  if (!audit.complete) process.exitCode=1;
}
