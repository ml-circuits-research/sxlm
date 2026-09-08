import { decodeSOP } from '../kernel/sop-data.mjs';
import { readFileSync } from 'node:fs';
import { assertData, canonical, check, copy, executionDigest } from '../kernel/data.mjs';
import { compileSOP } from '../kernel/sop.mjs';
import { linkProviders } from '../kernel/link.mjs';

export const bootstrapURL = new URL('../../packs/english-bootstrap.sop', import.meta.url);
export function readPack(path) {
  const text = readFileSync(path, 'utf8'); check(Buffer.byteLength(text) <= 8 * 1024 * 1024, 'Pack size limit');
  const pack = decodeSOP(text); validatePack(pack); return pack;
}
export function validatePack(pack) {
  assertData(pack);
  check(pack.schema === 'sxlm.pack.v1' && /^[a-z0-9][a-z0-9._-]{0,80}$/.test(pack.id ?? ''), 'Invalid pack identity');
  check(typeof pack.version === 'string' && pack.provenance && typeof pack.provenance.kind === 'string', 'Pack requires version and provenance');
  check(!Object.hasOwn(pack,'corpus'), 'Raw corpus is training input: call learnSequencePack before installing it');
  check(!Object.hasOwn(pack,'grammar'), 'Grammar proposals must be compiled into circuits before installation');
  check(!Object.hasOwn(pack,'theory') && !Object.hasOwn(pack,'text'), 'Theory and text knowledge must be compiled into circuits before installation');
  const allowed = new Set(['schema','id','version','provenance','sop','evaluations','dependencies','entrypoints','providers','linkages','training']);
  check(Object.keys(pack).every(k => allowed.has(k)), 'Unknown pack field');
  check(!Object.hasOwn(pack,'circuits'), 'Graph objects must be compiled offline to SOP source before installation');
  check(Array.isArray(pack.sop ?? []) && (pack.sop ?? []).length <= 10000, 'Invalid SOP collection');
  check(new Set((pack.sop??[]).map(module=>module.id)).size===(pack.sop??[]).length, 'Duplicate SOP module identity');
  for (const module of pack.sop ?? []) check(typeof module.id === 'string' && typeof module.source === 'string' && module.source.length <= 200000, 'Invalid SOP module');
  for(const providers of Object.values(pack.providers??{})) check(Array.isArray(providers)&&providers.every(p=>typeof p==='string'),'Invalid provider collection');
  check(Array.isArray(pack.linkages??[]),'Invalid linkages');
  return { hash: executionDigest(pack), bytes: Buffer.byteLength(canonical(pack)) };
}
export function combinePacks(packs) {
  check(packs.length > 0, 'At least one language pack is required');
  const ids = new Set(), result = { circuits: [], manifests: [], entrypoints: {}, providers:{} }, linkages=new Map();
  for (const pack of packs) {
    const { hash } = validatePack(pack); check(!ids.has(pack.id), `Duplicate pack: ${pack.id}`); ids.add(pack.id);
    for (const dependency of pack.dependencies ?? []) check(result.manifests.some(p => p.id === dependency.id && p.hash === dependency.hash), `Unsatisfied pack dependency: ${dependency.id}`);
    result.manifests.push({ id: pack.id, version: pack.version, hash, provenance: pack.provenance });
    for(const[slot,providers]of Object.entries(pack.providers??{}))result.providers[slot]=[...(result.providers[slot]??[]),...providers];
    for(const linkage of pack.linkages??[]){check(!linkages.has(linkage.id),'Duplicate provider linkage');linkages.set(linkage.id,copy(linkage));}
    check(new Set((pack.sop??[]).map(module=>module.id)).size===(pack.sop??[]).length, 'Duplicate SOP module identity');
  for (const module of pack.sop ?? []) result.circuits.push(compileSOP(module.id, module.source, { provenance: module.provenance ?? pack.provenance, ...(module.learning ? { learning: module.learning } : {}), ...(module.compilation ? { compilation: module.compilation } : {}) }));
    for (const [task, circuit] of Object.entries(pack.entrypoints ?? {})) {
      check(!result.entrypoints[task] || result.entrypoints[task] === circuit, `An extension cannot replace an existing task entrypoint: ${task}`);
      result.entrypoints[task] = circuit;
    }
  }
  check(result.entrypoints.grammar, 'Missing required language resources');
  for(const linkage of linkages.values())result.circuits.push(linkProviders(linkage,result.providers[linkage.slot]??[]));
  result.hash = executionDigest(result.manifests); return result;
}
