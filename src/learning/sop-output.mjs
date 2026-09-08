import { assertData, check, executionDigest } from '../kernel/data.mjs';
import { scalarText } from '../kernel/sop-syntax.mjs';
import { compileSOP } from '../kernel/sop.mjs';

const reference = value => value && typeof value === 'object' && Object.keys(value).length === 1 && typeof value.ref === 'string';

/** Offline graph printer. Literals become producers; no graph is hidden in a string. */
export function graphToSOP(program) {
  assertData(program);
  const lines = [], names = new Map(), literals = new Map(); let serial = 0;
  for (const [key, type] of Object.entries(program.inputs)) { check(/^[A-Za-z][\w-]*$/u.test(key), 'Invalid SOP input name'); names.set('$' + key, key); lines.push(`@input ${key} ${type}`); }
  const fresh = () => { let id; do { id = 'n' + serial++; } while ([...names.values()].includes(id)); return id; };
  for (const node of program.nodes) { check(!names.has(node.id), 'Duplicate graph producer'); names.set(node.id, fresh()); }
  function constant(item) {
    if (item === null || typeof item !== 'object') return scalarText(item);
    const key = executionDigest(item); if (literals.has(key)) return literals.get(key);
    const array = Array.isArray(item), parts = Object.entries(item).flatMap(([key, value]) => [array ? 'item' : scalarText(key), constant(value)]), id = fresh();
    lines.push(`@${id} ${array ? 'kernel.seq.make' : 'kernel.value.record'}${parts.length ? ' ' + parts.join(' ') : ''}`);
    literals.set(key, '$' + id); return '$' + id;
  }
  const value = item => { if (!reference(item)) return constant(item); check(names.has(item.ref), 'Unbound graph reference'); return '$' + names.get(item.ref); };
  for (const node of program.nodes) {
    const args = Object.entries(node.args).flatMap(([key, item]) => [key, value(item)]).join(' '); let expression;
    if (node.iterate) expression = `iterate ${scalarText(node.iterate)} while ${scalarText(node.guard)} state ${scalarText(node.accumulator)} seed ${value(node.initial)} limit ${value(node.limit)}`;
    else if (node.choose) expression = `choose selector ${value(node.choose.selector)} otherwise ${scalarText(node.choose.otherwise)}` + Object.entries(node.choose.cases).map(([key, target]) => ` case ${scalarText(key)} ${scalarText(target)}`).join('');
    else if (node.map || node.fold) expression = `${node.map ? 'map' : 'fold'} ${scalarText(node.map ?? node.fold)} items ${value(node.items)} item ${scalarText(node.item)}` + (node.fold ? ` state ${scalarText(node.accumulator)} seed ${value(node.initial)}` : '');
    else expression = `${node.op ? 'primitive' : node.attempt ? 'attempt' : 'call'} ${scalarText(node.op ?? node.attempt ?? node.call)}`;
    lines.push(`@${names.get(node.id)} ${expression} bind${args ? ' ' + args : ''}`);
  }
  lines.push('@output result ' + value(program.output));
  const metadata = Object.fromEntries(['learning', 'provenance', 'compilation'].filter(key => Object.hasOwn(program, key)).map(key => [key, program[key]]));
  // A prior frontend hash describes the prior source. Keep only its provenance fields.
  if (metadata.compilation) { metadata.compilation = { ...metadata.compilation }; for (const key of ['language', 'sourceHash', 'compiler']) delete metadata.compilation[key]; }
  const module = { id: program.id, source: lines.join('\n') + '\n', provenance: { kind: program.learning?.kind ?? 'authored-graph-compilation' }, ...metadata };
  module.compilation={...module.compilation,printer:'typed-graph-to-sop-v1'};
  compileModule(module); return module;
}
export const compileModule = module => compileSOP(module.id, module.source, Object.fromEntries(['learning', 'provenance', 'compilation'].filter(key => Object.hasOwn(module, key)).map(key => [key, module[key]])));
export const modulesFromGraphs = programs => programs.map(graphToSOP);
export const graphsFromModules = modules => modules.map(compileModule);
export const normalizedGraphs = programs => graphsFromModules(modulesFromGraphs(programs));
export function installGraphs(pack, programs) {
  const modules = modulesFromGraphs(programs), ids = new Set(modules.map(m => m.id)), roots = new Set(programs.map(c => c.compilation?.root ?? c.id));
  pack.sop = [...(pack.sop ?? []).filter(m => !ids.has(m.id) && !roots.has(m.compilation?.root)), ...modules];
  return modules;
}
