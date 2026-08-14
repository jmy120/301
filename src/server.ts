import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { parseSysmlXml } from './parser.js';
import { modelStore } from './store.js';

function send(res: ServerResponse, code: number, body: unknown): void { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
async function body(req: IncomingMessage): Promise<string> { const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk)); return Buffer.concat(chunks).toString('utf8'); }
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`); const parts = url.pathname.split('/').filter(Boolean);
  try {
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { status: 'ok' });
    if (req.method === 'POST' && url.pathname === '/api/models/import') { const xml = await body(req); const model = modelStore.put(parseSysmlXml(xml, req.headers['x-file-name']?.toString() ?? 'model.xml')); return send(res, 201, model); }
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'models' && parts[3] === 'tree') { const model = modelStore.get(parts[2]); return model ? send(res, 200, model.elements.filter(x => !x.ownerId || !model.elements.some(e => e.id === x.ownerId))) : send(res, 404, { message: 'Model not found' }); }
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'diagrams') { const diagram = modelStore.diagram(parts[2]); return diagram ? send(res, 200, diagram) : send(res, 404, { message: 'Diagram not found' }); }
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'elements') { const element = modelStore.element(parts[2]); return element ? send(res, 200, element) : send(res, 404, { message: 'Element not found' }); }
    return send(res, 404, { message: 'Route not found' });
  } catch (error) { return send(res, 400, { message: error instanceof Error ? error.message : 'Import failed' }); }
});
server.listen(3000, () => console.log('SysML parser listening on http://localhost:3000'));
