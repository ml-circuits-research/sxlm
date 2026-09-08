import { encodeSOP, decodeSOP } from '../src/kernel/sop-data.mjs';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {canonical,digest} from '../src/kernel/data.mjs';
import {compileSOP} from '../src/kernel/sop.mjs';
import {learnSequencePack} from '../src/learning/sequence.mjs';

export function synthesizeCompletion() {
  const modules=[];
  for(const folder of ['completion','sequence']){
    const root=new URL('../sop/'+folder+'/',import.meta.url);
    for(const name of readdirSync(root).filter(n=>n.endsWith('.sop')).sort())modules.push({id:folder+'.'+name.slice(0,-4),source:readFileSync(new URL(name,root),'utf8'),provenance:{kind:'agent-authored-sop-policy',source:'sop/'+folder+'/'+name,qualification:'Authored migration strategy, distinct from learned sequence frequencies.'}});
  }
  const specification=decodeSOP(readFileSync(new URL('../training/sequence.sop',import.meta.url)));
  const {texts,...options}=specification,learned=learnSequencePack(texts,options);modules.push(...learned.sop);
  const linkages=[
    {id:'completion.distribution',slot:'completion-distributions',seed:'sequence.empty',reducer:'sequence.merge'},
    {id:'completion.sources',slot:'completion-sources',seed:'sequence.empty',reducer:'sequence.concat'},
    {id:'completion.context-limit',slot:'completion-context-limit',seed:'sequence.zero',reducer:'sequence.max'},
  ];
  return{modules,learned,linkages,circuits:modules.map(m=>compileSOP(m.id,m.source,{provenance:m.provenance,...(m.learning?{learning:m.learning}:{})})),receipt:{schema:'sxlm.completion-migration.v1',sourceHash:digest(specification),authoredPolicies:modules.length-learned.sop.length,learnedModules:learned.sop.length,training:learned.training,qualification:'Frequencies are induced, sources and parameters are remembered, and the strategy remains authored. All three provenance classes execute through SOP.'}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const result=synthesizeCompletion(),path=new URL('../packs/english-bootstrap.sop',import.meta.url),pack=decodeSOP(readFileSync(path));
  if(process.argv.includes('--check')){
    if(result.modules.some(m=>{const old=(pack.sop??[]).find(c=>c.id===m.id);return!old||canonical(old)!==canonical(m);}))throw Error('Installed completion modules differ from their derivation');
    if(Object.hasOwn(pack,'corpus'))throw Error('A raw corpus is still active');
    const providerMatch=Object.entries(result.learned.providers).every(([slot,ids])=>canonical(pack.providers?.[slot]??null)===canonical(ids));
    const linkageMatch=result.linkages.every(link=>canonical(pack.linkages.find(l=>l.id===link.id)??null)===canonical(link));
    if(!providerMatch||!linkageMatch||canonical(Object.fromEntries(Object.entries(pack.training).filter(([key])=>key!=='components')))!==canonical(result.learned.training))throw Error('Completion linkage or training evidence differs from its derivation');
    const expected=new Set(result.modules.map(m=>m.id));
    if(pack.sop.some(m=>['completion.','sequence.','memory.bootstrap-sequence.'].some(prefix=>m.id.startsWith(prefix))&&!expected.has(m.id)))throw Error('Unexpected completion module outside its derivation');
    console.log(`Completion replay passed: ${result.receipt.learnedModules} learned/memorized SOP modules, ${result.receipt.authoredPolicies} authored policies.`);
  }else{
    pack.sop=[...(pack.sop??[]).filter(m=>m.compilation?.printer||!['completion.','sequence.','memory.bootstrap-sequence.'].some(prefix=>m.id.startsWith(prefix))),...result.modules];
    pack.providers={...(pack.providers??{}),...result.learned.providers};pack.linkages=[...(pack.linkages??[]).filter(l=>!result.linkages.some(expected=>expected.id===l.id)),...result.linkages];pack.training={...result.learned.training,...(pack.training?.components?{components:pack.training.components}:{})};
    delete pack.corpus;
    pack.provenance.completionLearning={trainingHash:result.learned.provenance.trainingHash,learner:'sequence-pack-v1'};
    pack.sop.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    writeFileSync(path,encodeSOP(pack)+'\n');
    writeFileSync(new URL('../reports/completion-migration.sop',import.meta.url),encodeSOP(result.receipt)+'\n');
    console.log(`Installed ${result.modules.length} completion/memory SOP modules. Raw corpus and native completion are removed from the active path.`);
  }
}
