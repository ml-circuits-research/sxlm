import { encodeSOP, decodeSOP } from './sop-data.mjs';
import { check, canonical, digest } from './data.mjs';
import { tokenize } from '../language/grammar.mjs';
import { installTextPrimitives } from './text.mjs';

const array = value => { check(Array.isArray(value),'Expected a sequence'); return value; };
const numbers = value => { const values=array(value);check(values.every(v=>typeof v==='number'&&Number.isFinite(v)),'Expected finite numbers');return values; };
const field = (value,key,fallback=null) => { check(typeof key==='string'||Number.isInteger(key),'Invalid field key');check(!['__proto__','prototype','constructor'].includes(String(key)),'Unsafe field');return value!==null&&typeof value==='object'&&Object.hasOwn(value,key)?value[key]:fallback; };

/** Domain-independent collection/scalar mechanisms. Strategies compose them in SOP. */
export function installCollectionPrimitives(runtime) {
  installTextPrimitives(runtime);
  const add=(name,inputs,output,run)=>runtime.primitive('kernel.'+name,{inputs,output,run});
  add('value.empty',{},'object',()=>({}));
  add('value.keyAllowed',{key:'string'},'boolean',({key})=>!['__proto__','prototype','constructor'].includes(key));
  add('value.entries',{value:'object'},'array',({value},{budget})=>Object.entries(value).map(([key,value])=>{budget.tick();return{key,value};}));
  add('value.merge',{left:'object',right:'object'},'object',({left,right})=>({...left,...right}));
  add('value.encode',{value:'any'},'string',({value},{budget})=>encodeSOP(value,{canonical:true,sources:false,tick:()=>budget.tick()}));
  add('value.compare',{left:'any',right:'any'},'number',({left,right})=>{check(typeof left===typeof right&&['string','number'].includes(typeof left),'Comparison requires like scalar values');return left<right?-1:left>right?1:0;});
  add('boolean.and',{left:'boolean',right:'boolean'},'boolean',({left,right})=>left&&right);
  add('value.get',{value:'any',key:'any',fallback:'any'},'any',({value,key,fallback})=>field(value,key,fallback));
  add('value.equal',{left:'any',right:'any'},'boolean',({left,right})=>canonical(left)===canonical(right));
  add('value.booleanLabel',{value:'boolean'},'string',({value})=>String(value));
  add('value.hash',{value:'any'},'string',({value})=>digest(value));
  add('value.require',{condition:'boolean',message:'string',value:'any'},'any',({condition,message,value})=>{check(condition,message);return value;});
  add('number.binary',{operation:'string',left:'number',right:'number'},'number',({operation,left,right})=>{
    let value; switch(operation){case 'add':value=left+right;break;case 'subtract':value=left-right;break;case 'multiply':value=left*right;break;case 'divide':value=left/right;break;case 'max':value=Math.max(left,right);break;case 'min':value=Math.min(left,right);break;default:throw Error('Unknown numeric operation');}check(Number.isFinite(value),'Non-finite numeric result');return value;
  });
  add('number.unary',{operation:'string',value:'number'},'number',({operation,value})=>{const result=operation==='sqrt'?Math.sqrt(value):operation==='log1p'?Math.log1p(value):NaN;check(Number.isFinite(result),'Invalid unary operation');return result;});
  add('number.between',{value:'any',minimum:'number',maximum:'number',integer:'boolean'},'boolean',({value,minimum,maximum,integer})=>typeof value==='number'&&Number.isFinite(value)&&value>=minimum&&value<=maximum&&(!integer||Number.isInteger(value)));
  add('seq.empty',{},'array',()=>[]);
  add('seq.append',{items:'array',value:'any'},'array',({items,value})=>[...items,value]);
  add('seq.count',{items:'any'},'number',({items})=>{check(Array.isArray(items)||typeof items==='string','Expected a sequence');return items.length;});
  add('seq.unique',{items:'any'},'array',({items},{budget})=>[...new Map(array(items).map(value=>{budget.tick();return[canonical(value),value];})).values()]);
  add('seq.flat',{items:'any'},'array',({items},{budget})=>{const values=array(items);values.forEach(item=>{budget.tick();array(item);});return values.flat();});
  add('seq.pluck',{items:'any',key:'any'},'array',({items,key},{budget})=>array(items).map(value=>{budget.tick();return field(value,key);}));
  add('seq.index',{items:'any'},'array',({items},{budget})=>array(items).map((value,index)=>{budget.tick();return{index,value};}));
  add('seq.difference',{left:'any',right:'any'},'array',({left,right},{budget})=>{const exclude=new Set(array(right).map(canonical));return array(left).filter(value=>{budget.tick();return!exclude.has(canonical(value));});});
  add('seq.intersection',{left:'any',right:'any'},'array',({left,right},{budget})=>{const include=new Set(array(right).map(canonical));return[...new Map(array(left).filter(value=>{budget.tick();return include.has(canonical(value));}).map(v=>[canonical(v),v])).values()];});
  add('seq.concat',{left:'any',right:'any'},'array',({left,right})=>[...array(left),...array(right)]);
  add('seq.histogram',{items:'any'},'array',({items},{budget})=>{const counts=new Map();for(const value of array(items)){budget.tick();const key=canonical(value),record=counts.get(key)??{value,count:0};record.count++;counts.set(key,record);}return[...counts.values()];});
  add('seq.find',{items:'any',key:'any',value:'any',fallback:'any'},'any',({items,key,value,fallback},{budget})=>{const values=array(items),index=values.findIndex(item=>{budget.tick();return canonical(field(item,key))===canonical(value);});return index<0?fallback:values[index];});
  add('seq.includes',{items:'any',value:'any'},'boolean',({items,value},{budget})=>array(items).some(item=>{budget.tick();return canonical(item)===canonical(value);}));
  add('seq.slice',{items:'any',start:'number',end:'number'},'array',({items,start,end})=>{check(Number.isInteger(start)&&Number.isInteger(end),'Slice requires integer bounds');return array(items).slice(start,end);});
  add('seq.reverse',{items:'any'},'array',({items})=>[...array(items)].reverse());
  add('seq.uniqueBy',{items:'any',key:'any'},'array',({items,key},{budget})=>[...new Map(array(items).map(item=>{budget.tick();return[canonical(field(item,key)),item];})).values()]);
  add('seq.group',{items:'any',key:'any'},'array',({items,key},{budget})=>{const groups=new Map();for(const item of array(items)){budget.tick();const value=field(item,key),id=canonical(value),group=groups.get(id)??{key:value,items:[]};group.items.push(item);groups.set(id,group);}return[...groups.values()];});
  add('seq.collate',{items:'any',key:'any',locale:'string'},'array',({items,key,locale},{budget})=>{const compare=new Intl.Collator(locale).compare,values=array(items);for(const item of values){budget.tick();check(typeof field(item,key)==='string','Collation requires string fields');}return[...values].sort((a,b)=>{budget.tick();return compare(field(a,key),field(b,key));});});
  add('seq.without',{items:'any',key:'any',value:'any'},'array',({items,key,value},{budget})=>array(items).filter(item=>{budget.tick();return canonical(field(item,key))!==canonical(value);}));
  add('seq.sum',{items:'any'},'number',({items},{budget})=>{const result=numbers(items).reduce((sum,n)=>{budget.tick();return sum+n;},0);check(Number.isFinite(result),'Non-finite sum');return result;});
  add('seq.max',{items:'any',initial:'number'},'number',({items,initial},{budget})=>numbers(items).reduce((maximum,n)=>{budget.tick();return Math.max(maximum,n);},initial));
  add('seq.sort',{items:'any',key:'any',descending:'boolean'},'array',({items,key,descending},{budget})=>[...array(items)].sort((a,b)=>{budget.tick();const x=field(a,key),y=field(b,key);check(typeof x===typeof y&&['string','number'].includes(typeof x),'Sort requires comparable fields');return(x<y?-1:x>y?1:0)*(descending?-1:1);}));
  add('seq.range',{count:'number'},'array',({count},{budget})=>{check(Number.isInteger(count)&&count>=0&&count<=12000,'Invalid sequence bound');budget.tick('steps',count);return Array.from({length:count},(_,i)=>i);});
  add('text.words',{text:'string'},'array',({text},{budget})=>{const tokens=tokenize(text);budget.tick('tokens',tokens.length);return tokens.filter(t=>/[\p{L}\p{N}]/u.test(t.text)).map(t=>t.value);});
  add('text.tokens',{text:'string'},'array',({text},{budget})=>{const tokens=tokenize(text);budget.tick('tokens',tokens.length);return tokens;});
  add('text.slice',{text:'string',start:'number',end:'number'},'string',({text,start,end})=>{check(Number.isInteger(start)&&Number.isInteger(end),'Slice requires integer bounds');return text.slice(start,end);});
  add('text.concat',{left:'string',right:'string'},'string',({left,right})=>left+right);
  add('text.trimStart',{text:'string'},'string',({text},{budget})=>{budget.tick('steps',text.length);return text.trimStart();});
  add('text.trim',{text:'string'},'string',({text})=>text.trim());
  add('text.join',{items:'any',separator:'string'},'string',({items,separator})=>{const values=array(items);check(values.every(v=>typeof v==='string'),'Join requires strings');return values.join(separator);});
  return runtime;
}
