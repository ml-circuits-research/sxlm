import { SymbolicModel } from '../../src/model.mjs';
import { executionDigest } from '../../src/kernel/data.mjs';
import { validatePack } from '../../src/learning/packs.mjs';
import { induceConstruction } from '../../src/learning/induce.mjs';
import { graphsFromModules } from '../../src/learning/sop-output.mjs';
import { buildConstructions } from '../build-constructions.mjs';
import { buildEveryday } from '../build-everyday.mjs';

/** Exact learning replay against the declared dependency prefix; labels alone earn no credit. */
export function replayConstructions(model) {
  const receipts = [], circuits = [];
  for (const [index, pack] of model.packs.entries()) if (['typed-span-composition-v1',
    'source-property-construction-family-v1'].includes(pack.training?.algorithm)) {
    try {
      const dependencies = new Map((pack.dependencies ?? []).map(item => [item.id, item.hash]));
      const parents = model.packs.slice(0, index).filter(parent => dependencies.get(parent.id) === validatePack(parent).hash);
      if (parents.length !== dependencies.size || parents.length === 0) throw new Error('Unavailable construction parent');
      const parent = new SymbolicModel({ packs: parents });
      const replay = pack.training.algorithm === 'source-property-construction-family-v1'
        ? buildEveryday({ base: parent, input: pack.training.input, language: pack.training.language })
        : pack.training.vocabulary ? buildConstructions(parent, pack.training)
          : induceConstruction(parent, pack.training.specification);
      const reproduced = executionDigest(replay) === executionDigest(pack);
      const derived = graphsFromModules(replay.sop).filter(module => module.learning);
      if (reproduced) circuits.push(...derived);
      receipts.push({ pack: pack.id, parentModel: parent.resources.hash, reproduced,
        inducedModules: derived.map(module => module.id),
        qualification: 'Exact supervised construction replay. Authored vocabulary and compiled grammar constructors do not receive induced-program credit.' });
    } catch (error) { receipts.push({ pack: pack.id, reproduced: false, error: error.message }); }
  }
  return { receipts, circuits };
}
