import { scalarText } from '../kernel/sop-syntax.mjs';
import {check,digest} from '../kernel/data.mjs';

/** Identify a full-rank affine hypothesis from numeric supervision; names carry no task semantics. */
export function learnAffineSOP(id, examples) {
  check(Array.isArray(examples)&&examples.length>=3&&examples.length<=1000,'Affine learning needs 3–1000 observations');
  const features=Object.keys(examples[0].input??{}).sort();
  check(features.length>0&&features.length<=16&&features.every(k=>/^[A-Za-z][\w-]*$/.test(k)&&!['constructor','prototype','__proto__'].includes(k)),'Invalid numeric features');
  check(examples.length>=features.length+1,'Insufficient observations');
  for(const e of examples)check(e.input&&Object.keys(e.input).sort().join()===features.join()&&[e.output,...features.map(k=>e.input[k])].every(Number.isFinite),'Invalid numeric observation');
  const width=features.length+1,rows=examples.map(e=>[1,...features.map(k=>e.input[k])]);
  const matrix=Array.from({length:width},(_,i)=>Array.from({length:width+1},(_,j)=>rows.reduce((sum,row,k)=>sum+row[i]*(j===width?examples[k].output:row[j]),0)));
  for(let column=0;column<width;column++){
    let pivot=column;for(let row=column+1;row<width;row++)if(Math.abs(matrix[row][column])>Math.abs(matrix[pivot][column]))pivot=row;
    check(Math.abs(matrix[pivot][column])>1e-10,'Ambiguous affine hypothesis: feature matrix is rank-deficient');
    [matrix[column],matrix[pivot]]=[matrix[pivot],matrix[column]];
    const scale=matrix[column][column];for(let j=column;j<=width;j++)matrix[column][j]/=scale;
    for(let row=0;row<width;row++)if(row!==column){const multiplier=matrix[row][column];for(let j=column;j<=width;j++)matrix[row][j]-=multiplier*matrix[column][j];}
  }
  const coefficients=matrix.map(row=>Number(row[width].toPrecision(12)));
  const residual=Math.max(...examples.map(e=>Math.abs(coefficients[0]+features.reduce((sum,key,i)=>sum+coefficients[i+1]*e.input[key],0)-e.output)));
  check(residual<=1e-9*Math.max(1,...examples.map(e=>Math.abs(e.output))),'Observations do not support an affine hypothesis');
  const lines=['@input with object',`@bias kernel.number.binary operation "add" left ${coefficients[0]} right 0`];
  let prior='bias';
  features.forEach((name,index)=>{lines.push(`@raw${index} kernel.value.get value $with key ${scalarText(name)} fallback null`,`@x${index} data.number value $raw${index}`,`@product${index} kernel.number.binary operation "multiply" left $x${index} right ${coefficients[index+1]}`,`@sum${index} kernel.number.binary operation "add" left $${prior} right $product${index}`);prior='sum'+index;});
  lines.push(`@output result $${prior}`);
  const learning={schema:'sxlm.derivation.v1',kind:'supervised-affine-induction',algorithm:'full-rank-affine-v1',trainingHash:digest(examples),trainingCount:examples.length,features,coefficients,maxResidual:residual,hypothesisClass:'affine functions over the supplied scalar features'};
  return {module:{id,source:lines.join('\n')+'\n',learning,provenance:{kind:'supervised-affine-induction'}},receipt:learning};
}
