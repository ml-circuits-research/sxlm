import { writeFileSync } from 'node:fs';
import { SymbolicModel } from '../src/model.mjs';
import { encodeSOP } from '../src/kernel/sop-data.mjs';
import { check } from '../src/kernel/data.mjs';
import { evaluate } from '../src/learning/evaluate.mjs';
import { normalizationGates } from '../eval/lexical-cases.mjs';
import { synthesizeLexical } from './build-lexical.mjs';

const model=new SymbolicModel(),pack=structuredClone(model.packs[0]),module=pack.sop.find(m=>m.id==='learned.lexical.normalize'),source=module.source;
module.source='@input text string\n@output result $text';
const ablated=new SymbolicModel({packs:[pack]}),gates=normalizationGates(),before=evaluate(ablated,gates),after=evaluate(model,gates);
module.source=source;const restored=new SymbolicModel({packs:[pack]}),recovery=evaluate(restored,gates);
const terminal={literal:'ALPHA'},token={text:'alpha',value:'alpha',start:0,end:5};
const composition={before:ablated.grammar.terminal(terminal,token),after:model.grammar.terminal(terminal,token),restored:restored.grammar.terminal(terminal,token)};
const report={schema:'sxlm.lexical-learning-evaluation.v1',generated:new Date().toISOString(),model:model.resources.hash,runtime:model.resources.runtime.hash,before,after,recovery,composition,unchangedRuntime:ablated.resources.runtime.hash===model.resources.runtime.hash&&restored.resources.runtime.hash===model.resources.runtime.hash,derivation:synthesizeLexical().receipt,qualification:'A two-operation normalization method is synthesized from teacher-supplied Unicode observations and reused in parser policy. These public same-project cases are separate from teacher examples; they are not external blind language evaluation. The surrounding lexical policy remains authored.'};
check(before.failed>0&&after.failed===0&&recovery.failed===0&&report.unchangedRuntime&&composition.before.length===0&&composition.after[0]==='alpha'&&composition.restored[0]==='alpha','Lexical learning evaluation failed');
writeFileSync(new URL('../reports/lexical-learning.sop',import.meta.url),encodeSOP(report));
console.log(`Normalization transfer: ${before.passed} -> ${after.passed}/${after.total}; recovery ${recovery.passed}/${recovery.total}; parser-terminal reuse verified with unchanged host.`);
