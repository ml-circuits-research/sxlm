import { check, Budget } from '../kernel/data.mjs';
/** Public adapter: document policy lives in the installed SOP entrypoint. */
export function parseDocument(text, grammar, {budget=new Budget(),scope='',cache=true,entrypoint='document.run',...unsupported}={}) {
  check(Object.keys(unsupported).length===0,'Document lowering is bound by its installed circuit; unsupported adapter options');
  return grammar.runtime.execute(entrypoint,{text,scope,config:grammar.data.segmentation,start:grammar.data.start},{budget,cache});
}
