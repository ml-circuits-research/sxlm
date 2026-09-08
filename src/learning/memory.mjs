import { scalarText } from '../kernel/sop-syntax.mjs';
import { encodeSOP, decodeSOP } from '../kernel/sop-data.mjs';
import {assertData,check,digest,executionDigest} from '../kernel/data.mjs';

const scalar = value => value === null || typeof value !== 'object';
const kind = value => value === null ? 'any' : Array.isArray(value) ? 'array' : typeof value;

/** Compile observations to bounded constructor DAGs. Constants ignore request bindings. */
export function memoryModules(id, value, learning) {
  assertData(value);
  const modules=[],shared=new Map(),costs=new Map();let serial=0;
  const cost = item => {
    if(scalar(item))return 0;
    const key=executionDigest(item);if(costs.has(key))return costs.get(key);
    const result=1+Object.values(item).reduce((n,v)=>n+1+cost(v),0);costs.set(key,result);return result;
  };
  function emit(item) {
    const key=executionDigest(item);if(shared.has(key))return shared.get(key);
    const name=id+'.constant'+serial++;shared.set(key,name);
    const lines=[],local=new Map();let wire=0;
    const node=expression=>{const label='v'+wire++;lines.push('@'+label+' '+expression);return '$'+label;};
    function construct(value,root=false) {
      if(scalar(value))return scalarText(value);
      const identity=executionDigest(value);if(local.has(identity))return local.get(identity);
      if(!root&&cost(value)>128){const result=node(emit(value));local.set(identity,result);return result;}
      const entries=Object.entries(value),sequence=Array.isArray(value);
      // Partition constructor graphs, not the meaning of their values.
      if(cost(value)>128&&entries.length>1){
        const middle=Math.ceil(entries.length/2),parts=sequence?[value.slice(0,middle),value.slice(middle)]:[Object.fromEntries(entries.slice(0,middle)),Object.fromEntries(entries.slice(middle))];
        const left=node(emit(parts[0])),right=node(emit(parts[1]));
        const result=node(`kernel.${sequence?'seq.concat':'value.merge'} left ${left} right ${right}`);local.set(identity,result);return result;
      }
      let result=node(sequence?'kernel.seq.empty':'kernel.value.empty');
      for(const [field,child] of entries){const argument=construct(child);result=node(sequence?`kernel.seq.append items ${result} value ${argument}`:`data.attach record ${result} key ${scalarText(field)} value ${argument}`);}
      local.set(identity,result);return result;
    }
    let output=construct(item,true);
    if(scalar(item))output=node(item===null?'kernel.value.get value null key 0 fallback null':`data.${kind(item)} value ${output}`);
    lines.push('@output result '+output);
    modules.push({id:name,source:lines.join('\n')+'\n',learning:{...learning,componentHash:digest(item)},provenance:{kind:learning.kind}});return name;
  }
  const root=emit(value);
  modules.push({id,source:`@input with object\n@result ${root}\n@output result $result\n`,learning,provenance:{kind:learning.kind}});
  return modules;
}

/** An observed finite function: lazy range routing, then an executed constructor page. */
export function lookupModules(id, entries, {fallback=[],learning}) {
  check(Array.isArray(entries)&&entries.length<=20000&&entries.every(row=>Array.isArray(row)&&row.length===2&&typeof row[0]==='string'),'Invalid lookup supervision');
  assertData(fallback);const output=kind(fallback),unique=new Map();
  for(const[key,value]of entries){assertData(value);check(kind(value)===output,'Lookup observations and fallback require a common output type');check(!unique.has(key)||executionDigest(unique.get(key))===executionDigest(value),'Conflicting lookup observations');unique.set(key,value);}
  const modules=memoryModules(id+'.missing',fallback,learning),ordered=[...unique].sort(([a],[b])=>a<b?-1:a>b?1:0);let serial=0;
  const add=(name,source)=>modules.push({id:name,source,learning,provenance:{kind:learning.kind}});
  function build(rows) {
    if(!rows.length)return id+'.missing';
    const name=id+'.page'+serial++;
    if(rows.length<=16){
      // Encode keys uniformly, including prototype-like user strings. The record
      // is reconstructed by ordinary circuit nodes; there is no native KB reader.
      const values=Object.fromEntries(rows.map(([key,value])=>[encodeSOP(key,{canonical:true,sources:false}),value]));
      modules.push(...memoryModules(name+'.values',values,learning));
      add(name,`@input with object\n@empty kernel.value.record\n@values ${name}.values with $empty\n@key kernel.value.get value $with key "key" fallback null\n@encoded kernel.value.encode value $key\n@fallback ${id}.missing with $empty\n@found kernel.value.get value $values key $encoded fallback $fallback\n${output==='any'?'':`@typed data.${output} value $found\n`}@output result $${output==='any'?'found':'typed'}\n`);
    }else{
      const middle=Math.floor(rows.length/2),left=build(rows.slice(0,middle)),right=build(rows.slice(middle));
      add(name,`@input with object\n@key kernel.value.get value $with key "key" fallback null\n@order kernel.value.compare left $key right ${scalarText(rows[middle][0])}\n@less kernel.value.equal left $order right -1\n@result kernel.flow.choose condition $less then "${left}" else "${right}" with $with\n@output result $result\n`);
    }
    return name;
  }
  const root=build(ordered);add(id,`@input with object\n@key kernel.value.get value $with key "key" fallback null\n@checked data.string value $key\n@args kernel.value.record key $checked\n@result ${root} with $args\n@output result $result\n`);return modules;
}
