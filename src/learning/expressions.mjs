import { encodeSOP, decodeSOP } from '../kernel/sop-data.mjs';
import { readFileSync } from 'node:fs';
import { assertData, check, copy, canonical, executionDigest, Budget } from '../kernel/data.mjs';
import { CircuitRuntime } from '../kernel/circuit.mjs';
import { installTermPrimitives } from '../kernel/terms.mjs';
import { installCollectionPrimitives } from '../kernel/collections.mjs';
import { installValuePrimitives } from '../kernel/values.mjs';

const compilerHash=executionDigest(readFileSync(new URL(import.meta.url),'utf8'));
const wire=id=>({ref:id});
const reference=value=>value&&typeof value==='object'&&Object.keys(value).length===1&&typeof value.ref==='string';
const type=value=>value===null?'any':Array.isArray(value)?'array':typeof value;
const tagged=(value,key)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===1&&Object.hasOwn(value,key);
const operators=new Set('$literal $get $fresh $let $if $path $at $and $or $assert $map $filter $format $join $eq $compare $contains $not $type $leaves $encode $decode $hash $entries $record $length $unique $sort $flatten $slice $startsWith $replace $rational $number $substitute $concat $merge'.split(' '));
const constant=value=>value===null||typeof value!=='object'||(!(Object.keys(value).length===1&&operators.has(Object.keys(value)[0]))&&Object.values(value).every(constant));

/** Offline lowering of the retired expression notation into ordinary typed graph nodes. */
export function lowerProgram(program) {
  assertData(program);
  if(!program.nodes.some(node=>node.op==='data.template'))return[copy(program)];
  const helpers=[],shared=new Map();let serial=0;
  const sourceHash=executionDigest({inputs:program.inputs,nodes:program.nodes,output:program.output});
  const metadata={...(program.learning?{learning:program.learning}:{}),provenance:program.provenance??{kind:'compiled-expression-fragment',source:program.id},compilation:{language:'typed-expression-lowering.v1',compilerHash,sourceHash,root:program.id}};

  function helper(expression,mode='expression') {
    const identity=executionDigest({expression,mode});
    if(shared.has(identity))return shared.get(identity);
    const id=program.id+'.graph'+serial++;shared.set(identity,id);
    const probing=mode.startsWith('probe-');
    const graph=new Graph(id,mode==='expression'?{environment:'object',scope:'string'}:probing?{environment:'object',scope:'string',probe:'object'}:{environment:'object',scope:'string',row:'object'});
    if(probing)graph.finish(mode==='probe-found'?graph.op('data.get',{value:wire('$probe'),path:['value']}):graph.expression(expression));
    else if(mode!=='expression'){
      const item=graph.op('data.get',{value:wire('$row'),path:['value']},'any');
      const index=graph.op('data.get',{value:wire('$row'),path:['index']},'any');
      graph.environment=graph.op('data.attach',{record:graph.environment,key:'item',value:item},'object');
      graph.environment=graph.op('data.attach',{record:graph.environment,key:'index',value:index},'object');
      const label=graph.op('kernel.value.scalarText',{value:index},'string');
      graph.scope=graph.op('kernel.text.concat',{left:graph.op('kernel.text.concat',{left:graph.scope,right:':'},'string'),right:label},'string');
      const result=graph.expression(expression);
      if(mode==='filter')graph.finish(graph.record({value:item,keep:graph.cast(result,'boolean')}));
      else graph.finish(result);
    }else graph.finish(graph.expression(expression));
    check(graph.nodes.length<=256,`Lowered expression exceeds the graph bound: ${id}`);
    helpers.push({...graph.program(),...metadata});return id;
  }

  class Graph {
    constructor(id,inputs){this.id=id;this.inputs=inputs;this.nodes=[];this.types=new Map(Object.entries(inputs).map(([k,v])=>['$'+k,v]));this.cache=new Map();this.environment=wire('$environment');this.scope=wire('$scope');}
    op(op,args,output='any'){
      const key=executionDigest({op,args});if(this.cache.has(key))return this.cache.get(key);
      const id='v'+this.nodes.length;this.nodes.push({id,op,args});const result=wire(id);this.types.set(id,output);this.cache.set(key,result);return result;
    }
    cast(value,expected){if(expected==='any'||(reference(value)?this.types.get(value.ref):type(value))===expected)return value;return this.op('data.'+expected,{value},expected);}
    literal(value){
      // A sole `ref` key is an ordinary record here, never an executable wire.
      if(reference(value))return this.op('data.wrap',{key:'ref',value:value.ref},'object');
      return copy(value);
    }
    record(fields){let result=this.op('kernel.value.empty',{},'object');for(const[key,value]of Object.entries(fields))result=this.op('data.attach',{record:result,key,value},'object');return result;}
    array(values){let result=this.op('kernel.seq.empty',{},'array');for(const value of values)result=this.op('kernel.seq.append',{items:result,value},'array');return result;}
    call(expression){const id='v'+this.nodes.length;this.nodes.push({id,call:helper(expression),args:{environment:this.environment,scope:this.scope}});this.types.set(id,'any');return wire(id);}
    choose(condition,yes,no){
      const selector=this.op('kernel.value.booleanLabel',{value:this.cast(condition,'boolean')},'string');
      return this.branch(selector,{true:helper(yes)},helper(no));
    }
    branch(selector,cases,otherwise,extra={}){const id='v'+this.nodes.length;this.nodes.push({id,choose:{selector,cases,otherwise},args:{environment:this.environment,scope:this.scope,...extra}});this.types.set(id,'any');return wire(id);}
    finish(value){this.output=this.op('data.get',{value,path:[]},'any');}
    program(){return{schema:'sxlm.circuit.v1',id:this.id,inputs:this.inputs,nodes:this.nodes,output:this.output};}
    bind(name,value){this.environment=this.op('data.attach',{record:this.environment,key:name,value},'object');}
    selectProbe(probe,fallback){
      const found=this.op('data.get',{value:probe,path:['found']},'any');
      const selector=this.op('kernel.value.booleanLabel',{value:this.cast(found,'boolean')},'string');
      return this.branch(selector,{true:helper(null,'probe-found')},helper(fallback,'probe-fallback'),{probe});
    }
    expression(value,depth=0){
      check(depth<64,'Expression compilation depth exceeded');
      const e=child=>this.expression(child,depth+1);
      if(value===null||typeof value!=='object')return value;
      if(constant(value))return this.literal(value);
      if(Array.isArray(value))return this.array(value.map(e));
      if(Object.keys(value).length===1){
        const key=Object.keys(value)[0],arg=value[key];
        if(key==='$literal')return this.literal(arg);
        if(key==='$get')return this.op('data.get',{value:this.environment,path:this.literal(arg)},'any');
        if(key==='$fresh')return this.op('kernel.value.fresh',{scope:this.scope,name:this.literal(arg)},'string');
        if(key==='$let'){
          check(arg.bindings&&typeof arg.bindings==='object'&&!Array.isArray(arg.bindings),'Let requires named bindings');
          const previous=this.environment;for(const[name,expression]of Object.entries(arg.bindings))this.bind(name,e(expression));
          const result=e(arg.body);this.environment=previous;return result;
        }
        if(key==='$if'){
          // Fuse equality cascades over the same feature into one static choice.
          const cases={};let tail=value,probe=null,count=0;
          while(tagged(tail,'$if')&&tagged(tail.$if.test,'$eq')){
            const pair=tail.$if.test.$eq;
            if(!Array.isArray(pair)||pair.length!==2||!tagged(pair[1],'$literal'))break;
            if(count>0&&executionDigest(probe)!==executionDigest(pair[0]))break;
            const category=encodeSOP(pair[1].$literal,{canonical:true,sources:false});
            if(Object.hasOwn(cases,category))break;
            probe=pair[0];cases[category]=tail.$if.then;tail=tail.$if.else;count++;
          }
          if(count>1){
            const selector=this.op('kernel.value.encode',{value:e(probe)},'string');
            return this.branch(selector,Object.fromEntries(Object.entries(cases).map(([k,v])=>[k,helper(v)])),helper(tail));
          }
          return this.choose(e(arg.test),arg.then,arg.else);
        }
        if(key==='$path')return this.selectProbe(this.op('kernel.value.probe',{value:e(arg.value),path:this.cast(e(arg.path),'array')},'object'),arg.fallback??null);
        if(key==='$at')return this.selectProbe(this.op('kernel.seq.probe',{items:this.cast(e(arg.value),'array'),index:this.cast(e(arg.index),'number')},'object'),arg.fallback??null);
        if(key==='$and'||key==='$or'){
          check(Array.isArray(arg),'Boolean composition requires an array');
          const conjunction=key==='$and';
          if(!arg.length)return conjunction;
          if(arg.length===1)return this.cast(e(arg[0]),'boolean');
          return this.choose(e(arg[0]),conjunction?{[key]:arg.slice(1)}:true,conjunction?false:{[key]:arg.slice(1)});
        }
        if(key==='$assert'){
          const condition=this.cast(e(arg.test),'boolean'),message=this.cast(e(arg.message),'string');
          this.op('kernel.value.require',{condition,message,value:null});return e(arg.value);
        }
        if(key==='$map'||key==='$filter'){
          const items=this.cast(e(arg.items),'array');
          const length=this.op('kernel.seq.count',{items},'number');
          const condition=this.op('kernel.number.between',{value:length,minimum:0,maximum:12000,integer:true},'boolean');
          const checked=this.cast(this.op('kernel.value.require',{condition,message:'Iteration requires a bounded array',value:items}),'array');
          const indexed=this.op('kernel.seq.index',{items:checked},'array'),id='v'+this.nodes.length;
          this.nodes.push({id,map:helper(key==='$map'?arg.template:arg.test,key==='$map'?'map':'filter'),item:'row',items:indexed,args:{environment:this.environment,scope:this.scope}});this.types.set(id,'array');
          if(key==='$map')return wire(id);
          const kept=this.op('kernel.seq.without',{items:wire(id),key:'keep',value:false},'array');
          return this.op('kernel.seq.pluck',{items:kept,key:'value'},'array');
        }
        if(key==='$format'){
          check(typeof arg.pattern==='string','Dynamic formatting templates require explicit circuit composition');
          const bindings=this.cast(e(arg.values),'object'),parts=[];let cursor=0;
          for(const match of arg.pattern.matchAll(/\{([a-zA-Z][\w]*)\}/g)){
            if(match.index>cursor)parts.push(arg.pattern.slice(cursor,match.index));
            const value=this.op('data.get',{value:bindings,path:[match[1]]});parts.push(this.op('kernel.value.scalarText',{value},'string'));cursor=match.index+match[0].length;
          }
          parts.push(arg.pattern.slice(cursor));return this.op('kernel.text.join',{items:this.array(parts),separator:''},'string');
        }
        if(key==='$join'){check(typeof(arg.separator??'')==='string','Join separator must be a literal string');return this.op('kernel.text.join',{items:e(arg.values),separator:arg.separator??''},'string');}
        if(key==='$eq'){check(Array.isArray(arg)&&arg.length===2,'Equality requires two values');return this.op('kernel.value.equal',{left:e(arg[0]),right:e(arg[1])},'boolean');}
        if(key==='$compare')return this.op('kernel.value.compare',{left:e(arg[0]),right:e(arg[1])},'number');
        if(key==='$contains')return this.op('kernel.seq.includes',{items:e(arg[0]),value:e(arg[1])},'boolean');
        if(key==='$not')return this.op('kernel.boolean.not',{value:this.cast(e(arg),'boolean')},'boolean');
        if(key==='$type')return this.op('kernel.value.type',{value:e(arg)},'string');
        if(key==='$leaves')return this.op('kernel.value.leaves',{value:e(arg)},'array');
        if(key==='$encode')return this.op('kernel.value.serialize',{value:e(arg)},'string');
        if(key==='$decode')return this.op('kernel.value.parse',{text:this.cast(e(arg),'string')});
        if(key==='$hash')return this.op('kernel.value.hash',{value:e(arg)},'string');
        if(key==='$entries')return this.op('kernel.value.pairs',{value:this.cast(e(arg),'object')},'array');
        if(key==='$record')return this.op('kernel.value.fromPairs',{items:this.cast(e(arg),'array')},'object');
        if(key==='$length')return this.op('kernel.seq.count',{items:e(arg)},'number');
        if(key==='$unique')return this.op('kernel.seq.unique',{items:e(arg)},'array');
        if(key==='$sort')return this.op('kernel.text.sort',{items:this.cast(e(arg),'array')},'array');
        if(key==='$flatten')return this.op('kernel.seq.flat',{items:e(arg)},'array');
        if(key==='$slice')return this.op('kernel.value.slice',{value:e(arg.value),start:this.cast(e(arg.start),'number'),end:this.cast(e(arg.end),'number')});
        if(key==='$startsWith')return this.op('kernel.text.startsWith',{text:this.cast(e(arg[0]),'string'),prefix:this.cast(e(arg[1]),'string')},'boolean');
        if(key==='$replace')return this.op('kernel.text.replace',{text:this.cast(e(arg.value),'string'),from:this.cast(e(arg.from),'string'),to:this.cast(e(arg.to),'string')},'string');
        if(key==='$rational')return this.op('kernel.rational.calculate',{left:e(arg.left),operation:this.cast(e(arg.operation??'normalize'),'string'),right:e(arg.right??'0')});
        if(key==='$number'){
          const left=this.cast(e(arg.left),'number'),right=this.cast(e(arg.right),'number');
          const operation=this.op('kernel.value.get',{value:{'+':'add','-':'subtract','*':'multiply','/':'divide'},key:e(arg.operation),fallback:'unsupported'});
          return this.op('kernel.number.binary',{operation:this.cast(operation,'string'),left,right},'number');
        }
        if(key==='$substitute')return this.op('data.substitute',{value:e(arg.value),bindings:this.cast(e(arg.bindings),'object')});
        if(key==='$concat')return this.op('kernel.seq.flat',{items:this.array(arg.map(e))},'array');
        if(key==='$merge'){let result=this.op('kernel.value.empty',{},'object');for(const child of arg)result=this.op('kernel.value.merge',{left:result,right:this.cast(e(child),'object')},'object');return result;}
      }
      return this.record(Object.fromEntries(Object.entries(value).map(([k,v])=>[k,e(v)])));
    }
  }
  const lowered=copy(program);
  for(const node of lowered.nodes)if(node.op==='data.template'){
    check(!reference(node.args.template),'Runtime expression programs must be compiled offline');
    const callee=helper(node.args.template);node.call=callee;delete node.op;
    node.args={environment:node.args.environment,scope:node.args.scope};
  }
  lowered.compilation={...metadata.compilation};
  return [...helpers,lowered];
}

export const lowerPrograms=programs=>programs.flatMap(lowerProgram);
export function expressionRuntime(){return installValuePrimitives(installCollectionPrimitives(installTermPrimitives(new CircuitRuntime())));}
export function compileExpression(expression,{id='expression',learning}={}){
  return lowerProgram({schema:'sxlm.circuit.v1',id,inputs:{value:'object',scope:'string'},nodes:[{id:'result',op:'data.template',args:{template:expression,environment:wire('$value'),scope:wire('$scope')}}],output:wire('result'),...(learning?{learning}:{})});
}
export function executeExpression(expression,value,{scope='',budget=new Budget()}={}){
  const runtime=expressionRuntime();for(const program of compileExpression(expression))runtime.compile(program);
  return runtime.execute('expression',{value,scope},{budget});
}
