import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, deepFreeze, digest, executionDigest } from './kernel/data.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

/** This host profile permits single-line static imports of local files or node: builtins. */
export function captureRuntime() {
  const found = new Map(), builtins = new Set();
  function visit(file) {
    file = resolve(file);
    check(file.startsWith(root + (root.endsWith(sep) ? '' : sep)), 'Runtime dependency escapes the project');
    if (found.has(file)) return;
    check(lstatSync(file).isFile(), 'Runtime dependencies must be regular source files');
    check(realpathSync(file) === file, 'Symlinked runtime dependencies are outside the sealed profile');
    const source = readFileSync(file, 'utf8');
    found.set(file, { path: relative(root, file), bytes: Buffer.byteLength(source), hash: digest(source) });
    check(!/\b(?:import|require)\s*\(/u.test(source), 'Dynamic host loading is outside the sealed runtime profile');
    for (const line of source.split('\n')) {
      if (!/^\s*import\b(?!\.)/u.test(line) && !/^\s*export\b.*\bfrom\s*['"]/u.test(line)) continue;
      const match = line.match(/^\s*(?:import\s+(?:[^'";]+\s+from\s+)?|export\s+[^'";]+\s+from\s+)['"]([^'"]+)['"]\s*;\s*$/u);
      check(match, 'Runtime imports must be single-line static declarations');
      const specifier = match[1];
      if (specifier.startsWith('node:')) builtins.add(specifier);
      else {
        check(specifier.startsWith('.') && specifier.endsWith('.mjs'), 'External host module is outside the runtime profile');
        visit(resolve(dirname(file), specifier));
      }
    }
  }
  visit(resolve(root, 'src/model.mjs'));
  const descriptor = {
    schema: 'sxlm.runtime-identity.v1',
    sourceFiles: [...found.values()].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0),
    builtins: [...builtins].sort(),
    host: { versions: { ...process.versions }, platform: process.platform, arch: process.arch },
    qualification: 'Static local source closure and Node component versions; trusted process, no hot reload or hostile-host attestation.'
  };
  return deepFreeze({ ...descriptor, hash: executionDigest(descriptor) });
}

// Capture once while this module is loaded. Never relabel cached code after an on-disk edit.
export const runtimeIdentity = captureRuntime();
export function assertRuntimeUnchanged() {
  check(captureRuntime().hash === runtimeIdentity.hash, 'Runtime source changed after loading; restart before constructing a model');
}
export const modelIdentity = knowledgeHash => executionDigest({ schema: 'sxlm.model-identity.v2', runtime: runtimeIdentity.hash, knowledge: knowledgeHash });
