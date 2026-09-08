// Evaluator-owned literal pairs; not provided to synthesis. Same project author.
// Expected strings are explicit, including compatibility and context-sensitive case.
export function normalizationGates(circuit='learned.lexical.normalize') {
  const pairs=[['',''],['ℌＥＬＬＯ','hello'],['𝐀𝐁𝐂','abc'],['Ａ＋Ｂ','a+b'],['①②','12'],['ﬂOWER','flower'],['A\u030a','å'],['ÅNGSTRÖM','ångström'],['ΣΟΣ','σος'],['ΟΣΑ','οσα'],['ǅ','dž'],['ẞ','ß'],['Å','å'],['🧪 Ｘ-２','🧪 x-2'],['İSTANBUL','i̇stanbul'],['𝐑ＯＬＥ ≠ ROLE','role ≠ role']];
  return pairs.map(([text,value],index)=>({id:'normalization-transfer-'+index,task:'circuit',circuit,input:{text},expect:{value}}));
}
