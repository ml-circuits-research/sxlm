// Evaluator-owned cases. The learner receives only its teacher specification.
// The same project authors both sets; these are structural checks, not blind external evidence.
export function structuralEqual(a,b){
  if(a===b)return true;
  if(a===null||b===null||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const left=Object.keys(a),right=Object.keys(b);
  return left.length===right.length&&left.every(key=>Object.hasOwn(b,key)&&structuralEqual(a[key],b[key]));
}
export const referenceCoverage=({required,available})=>required.every(need=>available.some(observation=>structuralEqual(need,observation)));

export function coverageGates(circuit='learned.coverage'){
  const atoms=['quartz','copper','neon'],sets=Array.from({length:8},(_,mask)=>atoms.filter((_,i)=>mask&(1<<i)));
  const cases=[];
  for(const required of sets)for(const available of sets)cases.push({id:'coverage-'+cases.length,task:'circuit',circuit,input:{required,available},expect:{value:referenceCoverage({required,available})}});
  for(const input of [
    {required:['λ','λ','μ'],available:['μ','λ','irrelevant']},
    {required:['λ','λ','μ'],available:['λ','irrelevant']},
    {required:[{kind:'role',slots:['α',1]}],available:[{slots:['α',1],kind:'role'}]},
    {required:[{kind:'role',slots:['α',1]}],available:[{kind:'role',slots:[1,'α']}]},
    {required:[null,false,0,''],available:['',0,false,null]},
    {required:Array.from({length:32},(_,i)=>'feature-'+i),available:Array.from({length:64},(_,i)=>'feature-'+i)},
    {required:Array.from({length:32},(_,i)=>'feature-'+i),available:Array.from({length:31},(_,i)=>'feature-'+i)},
  ])cases.push({id:'coverage-transfer-'+cases.length,task:'circuit',circuit,input,expect:{value:referenceCoverage(input)}});
  return cases;
}
