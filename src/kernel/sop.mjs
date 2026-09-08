import { check, digest } from './data.mjs';
import { declarations, scalarValue } from './sop-syntax.mjs';

/** A source frontend for the same typed circuit IR. It never executes source code. */
export function compileSOP(id, source, metadata = {}) {
  const rows = declarations(source);
  const inputs = {}, nodes = [], identifiers = new Set(); let output = null;
  const identifier = /^[A-Za-z][\w-]*$/;
  const value = token => {
    if (Object.hasOwn(token ?? {}, 'literal')) return token.literal;
    const word = token?.word;
    if (/^\$[A-Za-z][\w-]*$/.test(word)) return { wire: word.slice(1) };
    return scalarValue(token);
  };
  const pairs = (rest, quoted = false) => {
    check(rest.length % 2 === 0, 'SOP arguments need name/value pairs'); const result = [];
    for (let i=0; i<rest.length; i+=2) { const name=rest[i].word ?? (quoted ? rest[i].literal : undefined); check(typeof name==='string' && (quoted || identifier.test(name)), 'Invalid SOP argument'); result.push([name,value(rest[i+1])]); }
    return result;
  };
  for (const [declaration, ...rest] of rows) {
    const name = declaration.word.slice(1); check(identifier.test(name), 'Invalid SOP declaration');
    if (name === 'input') {
      check(rest.length === 2 && typeof rest[0].word==='string' && identifier.test(rest[0].word), 'SOP input syntax: @input name type');
      const key=rest[0].word, type=rest[1].word??rest[1].literal;
      check(!identifiers.has(key) && ['any','array','object','number','string','boolean'].includes(type), 'Duplicate input or invalid type');
      identifiers.add(key); inputs[key]=type; continue;
    }
    if (name === 'output') { check(output===null && rest.length===2 && rest[0].word==='result','SOP output syntax: @output result $wire'); output=value(rest[1]); continue; }
    check(!identifiers.has(name), `Duplicate SOP producer: ${name}`); identifiers.add(name);
    const command=rest.shift()?.word; check(typeof command==='string' && /^[A-Za-z][\w.-]*$/.test(command),'Invalid SOP command');
    if (['primitive','call','map','fold','choose','attempt','iterate'].includes(command)) {
      const take = () => { check(rest.length, 'Incomplete SOP control declaration'); return rest.shift(); };
      const literal = () => { const item=value(take()); check(typeof item==='string','Static target/binding requires a string'); return item; };
      let node={id:name};
      if (command==='choose') {
        check(take().word==='selector','Choice needs selector'); const selector=value(take()),cases={};
        check(take().word==='otherwise','Choice needs fallback'); const otherwise=literal();
        while(rest[0]?.word==='case'){take();const label=literal(),target=literal();check(!Object.hasOwn(cases,label),'Duplicate choice case');Object.defineProperty(cases,label,{value:target,enumerable:true,configurable:true,writable:true});}
        node.choose={selector,cases,otherwise};
      } else {
        node[command==='primitive'?'op':command]=literal();
        if (command==='iterate') {
          check(take().word==='while','Iteration needs a static guard');node.guard=literal();
          check(take().word==='state','Iteration needs a state binding');node.accumulator=literal();
          check(take().word==='seed','Iteration needs a seed');node.initial=value(take());
          check(take().word==='limit','Iteration needs an explicit bound');node.limit=value(take());
        }
        if(command==='map'||command==='fold') {
          check(take().word==='items','Iteration needs items');node.items=value(take());
          check(take().word==='item','Iteration needs item binding');node.item=literal();
          if(command==='fold'){check(take().word==='state','Fold needs accumulator binding');node.accumulator=literal();check(take().word==='seed','Fold needs seed');node.initial=value(take());}
        }
      }
      check(take().word==='bind','Explicit circuit nodes require bind before arguments');
      const bindings=pairs(rest);check(new Set(bindings.map(([key])=>key)).size===bindings.length,'Duplicate SOP binding');
      node.args=Object.fromEntries(bindings);nodes.push(node);continue;
    }
    const entries=pairs(rest,command==='kernel.value.record'), args=Object.fromEntries(entries);
    if (command==='kernel.value.literal') {
      check(entries.length===1 && entries[0][0]==='value' && (args.value===null || typeof args.value!=='object'),'Literal requires one scalar');
      nodes.push(args.value===null?{id:name,op:'kernel.value.get',args:{value:null,key:0,fallback:null}}:{id:name,op:'data.'+typeof args.value,args:{value:args.value}});
    } else if (command==='kernel.value.record') {
      check(entries.length===Object.keys(args).length,'Duplicate record field');
      nodes.push({id:name+'.empty',op:'kernel.value.empty',args:{}});
      let previous={wire:name+'.empty'};
      entries.forEach(([key,item],i)=>{const producer=i===entries.length-1?name:name+'.field'+i;nodes.push({id:producer,op:'data.attach',args:{record:previous,key,value:item}});previous={wire:producer};});
      if(!entries.length)nodes.push({id:name,op:'data.object',args:{value:previous}});
    } else if (command==='kernel.seq.make') {
      check(entries.every(([key])=>key==='item'),'Sequence construction accepts item arguments');
      nodes.push({id:name+'.empty',op:'kernel.seq.empty',args:{}}); let previous={wire:name+'.empty'};
      entries.forEach(([,item],i)=>{const producer=i===entries.length-1?name:name+'.item'+i;nodes.push({id:producer,op:'kernel.seq.append',args:{items:previous,value:item}});previous={wire:producer};});
      if(!entries.length)nodes.push({id:name,op:'data.array',args:{value:previous}});
    } else {
      check(entries.length===Object.keys(args).length,'Repeated arguments require a sequence constructor');
      if(command==='kernel.flow.attempt') {
        check(typeof args.circuit==='string','Attempt requires a static circuit target');
        const {circuit,...bindings}=args;nodes.push({id:name,attempt:circuit,args:bindings});
      } else if(command==='kernel.flow.map' || command==='kernel.flow.fold') {
        const isFold=command.endsWith('fold');
        check(Object.keys(args).every(k=>(isFold?['items','circuit','with','seed']:['items','circuit','with']).includes(k)) && typeof args.circuit==='string' && Object.hasOwn(args,'items'),'Invalid SOP iteration');
        nodes.push({id:name,[isFold?'fold':'map']:args.circuit,item:'item',items:args.items,args:{with:args.with??{}},...(isFold?{accumulator:'state',initial:args.seed}:{})});
      } else if(command==='kernel.flow.choose') {
        check(Object.keys(args).sort().join(',')==='condition,else,then,with' && typeof args.then==='string' && typeof args.else==='string','Invalid SOP choice');
        nodes.push({id:name+'.label',op:'kernel.value.booleanLabel',args:{value:args.condition}});
        nodes.push({id:name,choose:{selector:{wire:name+'.label'},cases:{true:args.then},otherwise:args.else},args:{with:args.with}});
      } else nodes.push({id:name,[command.startsWith('kernel.')||command.startsWith('data.')?'op':'call']:command,args});
    }
  }
  check(output?.wire,'SOP output must name a wire');
  const known = new Map(nodes.map(n=>[n.id,n])); check(known.size===nodes.length && nodes.every(node=>!Object.hasOwn(inputs,node.id)),'Generated SOP producer collision');
  const ref = v => v && typeof v==='object' && Object.keys(v).length===1 && v.wire ? {ref:Object.hasOwn(inputs,v.wire)?'$'+v.wire:v.wire}:v;
  const ordered=[], visiting=new Set(), done=new Set();
  function visit(name) {
    if(Object.hasOwn(inputs,name)||done.has(name))return;
    check(known.has(name),`Unbound SOP wire: ${name}`);check(!visiting.has(name),'Cyclic SOP dependencies');visiting.add(name);
    const node=known.get(name), references=[...Object.values(node.args),node.items,node.initial,node.limit,node.choose?.selector];
    for(const reference of references)if(reference?.wire)visit(reference.wire);
    const converted={...node,args:Object.fromEntries(Object.entries(node.args).map(([k,v])=>[k,ref(v)]))};
    if(node.items!==undefined)converted.items=ref(node.items);
    if(node.initial!==undefined)converted.initial=ref(node.initial);
    if(node.limit!==undefined)converted.limit=ref(node.limit);
    if(node.choose)converted.choose={...node.choose,selector:ref(node.choose.selector)};
    ordered.push(converted);visiting.delete(name);done.add(name);
  }
  for(const node of nodes)visit(node.id);visit(output.wire);
  check(Object.keys(metadata).every(key=>['learning','provenance','compilation'].includes(key)), 'SOP metadata cannot override graph structure');
  return {schema:'sxlm.circuit.v1',id,inputs,nodes:ordered,output:ref(output),...(Object.hasOwn(metadata,'provenance')?{provenance:metadata.provenance}:{}),...(Object.hasOwn(metadata,'learning')?{learning:metadata.learning}:{}),compilation:{...metadata.compilation,language:'sxlm-sop.v1',sourceHash:digest(source),compiler:'typed-sop-v2'}};
}
