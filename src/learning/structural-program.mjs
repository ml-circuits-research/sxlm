import { check, executionDigest, Budget } from '../kernel/data.mjs';
import { scalarText } from '../kernel/sop-syntax.mjs';
import { compileModule } from './sop-output.mjs';

const equal = (left, right) => executionDigest(left) === executionDigest(right);
const constant = values => values.every(value => equal(value, values[0]));

/** Bounded structural search: constants, common field projections, records and sequence splicing. */
export function inferStructuralProgram(slots, outputs) {
  const budget = new Budget({ milliseconds: 10000, candidates: 10000 });
  const projections = [];
  function visit(slot, path, values) {
    budget.tick('candidates');
    if (!constant(values)) projections.push({ kind: 'projection', slot: slot.name, path: [slot.index, ...path], values });
    if (path.length >= 12 || !values.every(value => value !== null && typeof value === 'object')) return;
    for (const key of Object.keys(values[0])) {
      if (values.every(value => Object.hasOwn(value, key))) {
        visit(slot, [...path, Array.isArray(values[0]) ? Number(key) : key], values.map(value => value[key]));
      }
    }
  }
  for (const slot of slots) visit(slot, [], slot.values);
  const memo = new Map();
  function infer(values) {
    budget.tick('candidates');
    const key = executionDigest(values);
    if (memo.has(key)) return memo.get(key);
    if (constant(values)) return { kind: 'literal', value: values[0] };
    const matches = projections.filter(projection => equal(projection.values, values));
    check(matches.length <= 1, 'Ambiguous semantic projection; provide discriminating examples');
    let result = matches[0] ? { kind: 'projection', slot: matches[0].slot, path: matches[0].path } : null;
    if (!result && values.every(value => value && typeof value === 'object' && !Array.isArray(value))) {
      const keys = Object.keys(values[0]);
      if (values.every(value => equal(Object.keys(value), keys))) {
        const fields = keys.map(name => [name, infer(values.map(value => value[name]))]);
        if (fields.every(([, value]) => value !== null)) result = { kind: 'record', fields };
      }
    }
    if (!result && values.every(Array.isArray)) result = sequence(values);
    memo.set(key, result); return result;
  }
  function sequence(values) {
    const states = new Map(), arrays = projections.filter(projection => projection.values.every(Array.isArray));
    function suffix(positions) {
      budget.tick('candidates');
      const key = positions.join(',');
      if (states.has(key)) return states.get(key);
      if (positions.every((position, row) => position === values[row].length)) return [];
      const solutions = [];
      for (const projection of arrays) {
        if (!projection.values.some(value => value.length > 0)) continue;
        if (!projection.values.every((value, row) => equal(value,
          values[row].slice(positions[row], positions[row] + value.length)))) continue;
        const rest = suffix(positions.map((position, row) => position + projection.values[row].length));
        if (rest !== null) solutions.push([{ splice: { kind: 'projection', slot: projection.slot, path: projection.path } }, ...rest]);
      }
      // Prefer the supplied sequence field over reconstructing its observed elements.
      // Multiple matching field paths remain ambiguous, even if their training outputs agree.
      check(solutions.length <= 1, 'Ambiguous sequence alignment; provide discriminating examples');
      if (!solutions.length && positions.every((position, row) => position < values[row].length)) {
        const item = infer(values.map((value, row) => value[positions[row]]));
        if (item !== null) {
          const rest = suffix(positions.map(position => position + 1));
          if (rest !== null) solutions.push([{ item }, ...rest]);
        }
      }
      const result = solutions[0] ?? null; states.set(key, result); return result;
    }
    const parts = suffix(values.map(() => 0));
    return parts === null ? null : { kind: 'sequence', parts };
  }
  const program = infer(outputs);
  check(program !== null, 'Changing semantics cannot be expressed by slot projections and sequence composition');
  const used = new Set();
  function scan(value) {
    if (!value || typeof value !== 'object' || value.kind === 'literal') return;
    if (value.kind === 'projection') used.add(value.slot);
    else Object.values(value).forEach(scan);
  }
  scan(program);
  check(slots.every(slot => used.has(slot.name)), 'A varying surface slot has no demonstrated semantic contribution');
  return { program, search: budget.report() };
}

/** Print the induced procedure directly as typed SOP; data values are never interpreted as expressions. */
export function structuralModule(id, program, learning) {
  const lines = ['@input children array', '@input scope string']; let serial = 0;
  const emit = expression => { const name = 'n' + serial++; lines.push(`@${name} ${expression}`); return '$' + name; };
  function literal(value) {
    if (value === null || typeof value !== 'object') return scalarText(value);
    return Array.isArray(value) ? emit('kernel.seq.make ' + value.map(item => 'item ' + literal(item)).join(' ')) :
      emit('kernel.value.record ' + Object.entries(value).map(([key, item]) => scalarText(key) + ' ' + literal(item)).join(' '));
  }
  const projected = new Map();
  function print(node) {
    if (node.kind === 'literal') return literal(node.value);
    if (node.kind === 'projection') {
      const key = executionDigest(node.path);
      if (!projected.has(key)) projected.set(key, emit(`data.get value $children path ${literal(node.path)}`));
      return projected.get(key);
    }
    if (node.kind === 'record') return emit('kernel.value.record ' + node.fields.map(([key, value]) =>
      scalarText(key) + ' ' + print(value)).join(' '));
    let sequence = emit('kernel.seq.empty');
    for (const part of node.parts) sequence = part.splice ?
      emit(`kernel.seq.concat left ${sequence} right ${print(part.splice)}`) :
      emit(`kernel.seq.append items ${sequence} value ${print(part.item)}`);
    return sequence;
  }
  const result = print(program);
  // A root literal needs a producer as the SOP output must reference a node.
  const output = result.startsWith('$') ? result : emit('kernel.value.literal value ' + result);
  lines.push('@output result ' + output);
  const module = { id, source: lines.join('\n') + '\n', learning,
    provenance: { kind: 'supervised-structural-induction' } };
  compileModule(module); return module;
}
