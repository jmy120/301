import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { parseSysmlXml } from './parser.js';
import { modelStore } from './store.js';
import { buildModelTree } from './model-tree.js';
import { decodeXmlBody } from './encoding.js';
import { serializeParsedModelModule } from './exporter.js';

function send(res: ServerResponse, code: number, body: unknown): void { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
function sendModule(res: ServerResponse, model: ReturnType<typeof modelStore.get>): void {
  if (!model) return send(res, 404, { message: 'Model not found' });
  const originalName = basename(model.source.fileName).replace(/[^A-Za-z0-9._-]/g, '_');
  const fileName = `${originalName.replace(/\.(xml|xmi)$/i, '') || 'model'}.parsed.js`;
  res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'content-disposition': `attachment; filename="${fileName}"`, 'cache-control': 'no-store' });
  res.end(serializeParsedModelModule(model));
}
async function sendStatic(res: ServerResponse, path: string): Promise<void> {
  const file = await readFile(join(process.cwd(), 'public', path));
  const type = extname(path) === '.js' ? 'text/javascript' : 'text/html';
  res.writeHead(200, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' });
  res.end(file);
}
const MAX_BODY = 100 * 1024 * 1024;
async function body(req: IncomingMessage): Promise<string> {
  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > MAX_BODY) throw new Error('REQUEST_TOO_LARGE');
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) { const part = Buffer.from(chunk); size += part.length; if (size > MAX_BODY) { req.destroy(); throw new Error('REQUEST_TOO_LARGE'); } chunks.push(part); }
  return decodeXmlBody(Buffer.concat(chunks));
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`); const parts = url.pathname.split('/').filter(Boolean);
  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) return sendStatic(res, 'index.html');
    if (req.method === 'GET' && (url.pathname === '/app.js' || url.pathname === '/app-enhanced.js' || url.pathname === '/diagram-renderer.js')) return sendStatic(res, url.pathname.slice(1));
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { status: 'ok' });
    if (req.method === 'POST' && url.pathname === '/api/models/import') { const xml = await body(req); const model = modelStore.put(parseSysmlXml(xml, req.headers['x-file-name']?.toString() ?? 'model.xml')); return send(res, 201, model); }
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'models' && parts[3] === 'export.js') return sendModule(res, modelStore.get(parts[2]));
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'models' && parts[3] === 'tree') { const model = modelStore.get(parts[2]); if (!model) return send(res, 404, { message: 'Model not found' }); return send(res, 200, buildModelTree([...model.elements, ...model.relations, ...model.diagrams])); }
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'diagrams') { const diagram = modelStore.diagram(parts[2], url.searchParams.get('modelId') ?? undefined); return diagram ? send(res, 200, diagram) : send(res, 404, { message: 'Diagram not found' }); }
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'elements') { const element = modelStore.element(parts[2], url.searchParams.get('modelId') ?? undefined); return element ? send(res, 200, element) : send(res, 404, { message: 'Element not found' }); }
    return send(res, 404, { message: 'Route not found' });
  } catch (error) { return send(res, 400, { message: error instanceof Error ? error.message : 'Import failed' }); }
});
server.listen(3000, () => console.log('SysML parser listening on http://localhost:3000'));
