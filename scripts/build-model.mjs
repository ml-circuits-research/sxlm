import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Lexical synthesis precedes sequence memory because its compiled policy
// identity enters the frequency derivation. Linkage order is also observable.
export const stages=Object.freeze(['learn-realization','build-semantics','build-sop','build-lexical','build-text','build-completion','build-document','build-knowledge','build-expressions','build-planning','build-elementary']);

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const root=fileURLToPath(new URL('../',import.meta.url));
  for(const stage of stages)execFileSync(process.execPath,['scripts/'+stage+'.mjs'],{cwd:root,stdio:'inherit'});
  console.log('Model build completed: '+stages.length+' ordered source stages.');
}
