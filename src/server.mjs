import { encodeSOP, decodeSOP } from './kernel/sop-data.mjs';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { SymbolicModel } from './model.mjs';
import { induceConstruction } from './learning/induce.mjs';
import { validateCandidate } from './learning/workflow.mjs';
import { check } from './kernel/data.mjs';
import { validatePack } from './learning/packs.mjs';
import { conformance, composition, learningGates } from '../eval/cases.mjs';
import { runEvaluation } from '../eval/run.mjs';
import { auditVision } from '../scripts/audit-vision.mjs';
import { ChatController } from './chat/controller.mjs';

const assets = new Map([
  ['/', ['../web/index.html', 'text/html; charset=utf-8']],
  ['/sop-data.mjs', ['../src/kernel/sop-data.mjs', 'text/javascript; charset=utf-8']],
  ['/sop-syntax.mjs', ['../src/kernel/sop-syntax.mjs', 'text/javascript; charset=utf-8']],
  ['/app.js', ['../web/app.js', 'text/javascript; charset=utf-8']],
  ['/chat.js', ['../web/chat.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['../web/styles.css', 'text/css; charset=utf-8']],
  ['/vision.md', ['../docs/specs/DS000-vision.md', 'text/plain; charset=utf-8']],
]);
async function readSOP(request) {
  let size = 0; const chunks = [];
  for await (const chunk of request) { size += chunk.length; check(size <= 524288, 'Request body exceeds 512 KiB'); chunks.push(chunk); }
  check((request.headers['content-type'] ?? '').split(';')[0] === 'application/sop', 'Request requires application/sop');
  return decodeSOP(Buffer.concat(chunks).toString('utf8'),{maxCharacters:524288,maxNodes:20000,maxValues:100000});
}
export function createWorkbench({ model = new SymbolicModel(), chatDirectory, elementary = true, agent } = {}) {
  let current = model; const sessions = new Map(), proposals = new Map();
  const chat = new ChatController({ current: () => current, directory: chatDirectory, elementary, agent });
  const examples = decodeSOP(readFileSync(new URL('../examples/demo.sop', import.meta.url)));
  const specification = decodeSOP(readFileSync(new URL('../examples/learn-construction.sop', import.meta.url)));
  const server = createServer(async (request, response) => {
    const sop = (value, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/sop; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(encodeSOP(value)); };
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
    try {
      const url = new URL(request.url, 'http://localhost');
      if (request.headers.origin) check(request.headers.origin === `http://${request.headers.host}`, 'Cross-origin requests are not accepted');
      if (request.method === 'GET' && assets.has(url.pathname)) {
        const [path, type] = assets.get(url.pathname); response.writeHead(200, { 'Content-Type': type }); response.end(readFileSync(new URL(path, import.meta.url))); return;
      }
      if (await chat.route(request, url, sop, readSOP)) return;
      if (request.method === 'GET' && url.pathname === '/api/info') {
        const audit = auditVision({ model: current });
        sop({ name: 'SXLM', model: current.resources.hash, manifests: current.resources.manifests, grammar: { productions: current.resources.grammar.productions.length, circuits: current.resources.circuits.length, lexemes: current.resources.grammar.lexicon.length }, architecture: { complete: audit.complete, requirements: audit.requirements.map(r => ({ id:r.id, achieved:r.achieved })), migration: audit.demonstratedMigration }, examples, specification, learningGates }); return;
      }
      if (request.method === 'POST' && url.pathname === '/api/run') {
        const body = await readSOP(request); check(typeof body.text === 'string', 'Text is required'); const options = body.options ?? {};
        if (body.task === 'summarize') { sop(current.summarize(body.text, options)); return; }
        if (body.task === 'complete') { sop(current.complete(body.text, options)); return; }
        check(body.task === 'reason', 'Unknown task');
        let id = body.session, session = id ? sessions.get(id) : null;
        if (!session || session.model !== current) { id = randomUUID(); session = current.createSession(); sessions.set(id, session); }
        if (sessions.size > 100) sessions.delete(sessions.keys().next().value);
        sop({ ...session.ask(body.text, options), session: id }); return;
      }
      if (request.method === 'POST' && url.pathname === '/api/learn') {
        const body = await readSOP(request), candidate = induceConstruction(current, body.specification), gates = body.gates;
        const receipt = validateCandidate(current, candidate, { gates, regressions: [...conformance, ...composition] });
        const id = validatePack(candidate).hash;
        if (receipt.accepted) proposals.set(id, { parent: current.resources.hash, candidate });
        if (proposals.size > 20) proposals.delete(proposals.keys().next().value);
        sop({ id, candidate, receipt }); return;
      }
      if (request.method === 'POST' && url.pathname === '/api/activate') {
        const { id } = await readSOP(request), proposal = proposals.get(id); check(proposal && proposal.parent === current.resources.hash, 'Validated proposal is missing or stale');
        current = new SymbolicModel({ packs: [...current.packs, proposal.candidate] }); proposals.clear(); sessions.clear();
        sop({ model: current.resources.hash, manifests: current.resources.manifests }); return;
      }
      if (request.method === 'POST' && url.pathname === '/api/evaluate') { await readSOP(request); sop(runEvaluation()); return; }
      sop({ error: 'Route not found' }, 404);
    } catch (error) { sop({ error: error.message }, 400); }
  });
  server.once('close', () => chat.close());
  return server;
}
export async function serve({ port = 3210, host = '127.0.0.1', model, chatDirectory, elementary, agent } = {}) {
  const server = createWorkbench({ model, chatDirectory, elementary, agent });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  return server;
}
