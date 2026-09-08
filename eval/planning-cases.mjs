// Evaluator-owned finite transition systems, never supplied to the learner.
// Same project author; these are exhaustive small-state checks, not blind language data.
// The oracle uses bit masks and synchronous Bellman-Ford relaxation, independently
// of runtime atom hashing, learned coverage and the SOP priority queue policy.
export function minimumCost({ bits, initial, goals, actions }) {
  const size = 2 ** bits;
  let distance = Array(size).fill(Infinity); distance[initial] = 0;
  for (let pass = 0; pass < size - 1; pass++) {
    const next = [...distance];
    for (let state = 0; state < size; state++) for (const action of actions) {
      if ((state & action.requires) !== action.requires) continue;
      const successor = (state & ~action.remove) | action.add;
      next[successor] = Math.min(next[successor], distance[state] + (action.cost ?? 1));
    }
    if (next.every((value, index) => value === distance[index])) break;
    distance = next;
  }
  return Math.min(...distance.filter((_, state) => (state & goals) === goals));
}

export function planningGates() {
  let seed = 0x32ac91;
  const random = size => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return Math.floor(seed / 4294967296 * size); };
  return Array.from({ length: 64 }, (_, index) => {
    const bits = 2 + index % 3, size = 2 ** bits;
    const system = { bits, initial: random(size), goals: random(size), actions: Array.from({ length: 2 + index % 5 }, (_, action) => ({ id: 'transition-' + action, requires: random(size), add: random(size), remove: random(size), cost: random(4) })) };
    const atoms = Array.from({ length: bits }, (_, bit) => ({ predicate: 'feature-' + index, terms: ['slot-' + bit], context: bit % 2 ? 'scope-a' : 'scope-b', negative: bit % 3 === 0 }));
    const decode = mask => atoms.filter((_, bit) => mask & (1 << bit));
    const problem = { initial: decode(system.initial), goals: decode(system.goals), actions: system.actions.map(action => ({ ...action, requires: decode(action.requires), add: decode(action.add), remove: decode(action.remove) })) };
    const cost = minimumCost(system);
    return { id: 'planning-transfer-' + index, task: 'plan', problem, expect: Number.isFinite(cost) ? { status: 'solved', cost, planWitness: true } : { status: 'unreachable-in-model' } };
  });
}
