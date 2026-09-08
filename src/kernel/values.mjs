import { encodeSOP, decodeSOP } from './sop-data.mjs';
import { check, copy, assertData, digest } from './data.mjs';
import { calculate, rational, format } from './rational.mjs';

/** Atomic value mechanisms. No expression AST, callback source or task policy is accepted. */
export function installValuePrimitives(runtime) {
  const add=(name,inputs,output,run)=>runtime.primitive('kernel.'+name,{inputs,output,run});
  add('value.type',{value:'any'},'string',({value})=>value===null?'null':Array.isArray(value)?'array':typeof value);
  add('value.leaves',{value:'any'},'array',({value},{budget})=>{
    const result=[];
    function visit(item){budget.tick();if(item&&typeof item==='object')Object.values(item).forEach(visit);else result.push(item);}
    visit(value);return result;
  });
  add('value.probe',{value:'any',path:'array'},'object',({value,path},{budget})=>{
    check(path.length<64,'Invalid data path');
    for(const key of path){
      budget.tick();
      check(typeof key==='string'||Number.isInteger(key),'Data path keys must be strings or integers');
      if(value===null||typeof value!=='object'||!Object.hasOwn(value,key))return{found:false};
      check(!['__proto__','prototype','constructor'].includes(String(key)),'Unsafe data path');value=value[key];
    }
    return{found:true,value:copy(value)};
  });
  add('value.pairs',{value:'object'},'array',({value},{budget})=>Object.entries(value).map(entry=>{budget.tick();return entry;}));
  add('value.fromPairs',{items:'array'},'object',({items},{budget})=>{
    for(const pair of items){budget.tick();check(Array.isArray(pair)&&pair.length===2&&typeof pair[0]==='string','Record requires key/value pairs');}
    const result=Object.fromEntries(items);assertData(result);return result;
  });
  add('value.serialize',{value:'any'},'string',({value},{budget})=>encodeSOP(value,{sources:false,tick:()=>budget.tick()}));
  add('value.parse',{text:'string'},'any',({text},{budget})=>{const value=decodeSOP(text,{maxCharacters:2000000,maxNodes:50000,maxValues:50000,tick:()=>budget.tick()});assertData(value);return value;});
  add('value.scalarText',{value:'any'},'string',({value})=>{check(['string','number','boolean'].includes(typeof value),'Expected a scalar formatting binding');return String(value);});
  add('value.fresh',{scope:'string',name:'any'},'string',({scope,name})=>'_:'+digest({scope,name}).slice(0,24));
  add('value.slice',{value:'any',start:'number',end:'number'},'any',({value,start,end})=>{check((Array.isArray(value)||typeof value==='string')&&Number.isInteger(start)&&Number.isInteger(end),'Slice requires a sequence and integer bounds');return value.slice(start,end);});
  add('boolean.not',{value:'boolean'},'boolean',({value})=>!value);
  add('seq.probe',{items:'array',index:'number'},'object',({items,index})=>{check(Number.isInteger(index),'Index requires an integer');const value=items.at(index);return value===undefined?{found:false}:{found:true,value:copy(value)};});
  add('text.startsWith',{text:'string',prefix:'string'},'boolean',({text,prefix})=>text.startsWith(prefix));
  add('text.replace',{text:'string',from:'string',to:'string'},'string',({text,from,to})=>{check(from.length>0,'Replacement requires a nonempty match');return text.split(from).join(to);});
  add('text.sort',{items:'array'},'array',({items},{budget})=>{for(const item of items){budget.tick();check(typeof item==='string','Sort requires strings');}return[...items].sort();});
  add('rational.calculate',{left:'any',operation:'string',right:'any'},'any',({left,operation,right})=>{
    check(typeof left==='string'||typeof left==='number','Rational input must be a scalar number representation');
    if(operation==='normalize')return format(rational(left));
    check(typeof right==='string'||typeof right==='number','Rational input must be a scalar number representation');
    if(operation==='compare'){const[n,d]=rational(left),[m,e]=rational(right),delta=n*e-m*d;return delta<0n?-1:delta>0n?1:0;}
    return calculate(left,operation,right);
  });
  return runtime;
}
