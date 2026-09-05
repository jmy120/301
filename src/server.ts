import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { parseSysmlXml } from './parser.js';
import { modelStore } from './store.js';

function send(res: ServerResponse, code: number, body: unknown): void { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
async function sendStatic(res: ServerResponse, path: string): Promise<void> {
  const file = await readFile(join(process.cwd(), 'public', path));
  const type = extname(path) === '.js' ? 'text/javascript' : 'text/html';
  res.writeHead(200, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' });
  res.end(file);
}
const MAX_BODY = 100 * 1024 * 1024;
function utf16Be(data: Buffer, offset = 0): string {
  const swapped = Buffer.alloc(data.length - offset);
  for (let i = offset; i + 1 < data.length; i += 2) { swapped[i - offset] = data[i + 1]; swapped[i - offset + 1] = data[i]; }
  return swapped.toString('utf16le');
}
function likelyUtf16(data: Buffer): 'le' | 'be' | undefined {
  const length = Math.min(data.length - (data.length % 2), 256); if (length < 8) return undefined;
  let evenNuls = 0; let oddNuls = 0;
  for (let i = 0; i < length; i += 2) { if (data[i] === 0) evenNuls++; if (data[i + 1] === 0) oddNuls++; }
  const pairs = length / 2;
  if (oddNuls / pairs > 0.4) return 'le';
  if (evenNuls / pairs > 0.4) return 'be';
}
async function body(req: IncomingMessage): Promise<string> {
  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > MAX_BODY) throw new Error('REQUEST_TOO_LARGE');
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) { const part = Buffer.from(chunk); size += part.length; if (size > MAX_BODY) { req.destroy(); throw new Error('REQUEST_TOO_LARGE'); } chunks.push(part); }
  const data = Buffer.concat(chunks);
  // Respect UTF-16 BOM; otherwise XML declaration and UTF-8 are handled normally.
  if (data[0] === 0xff && data[1] === 0xfe) return data.subarray(2).toString('utf16le');
  if (data[0] === 0xfe && data[1] === 0xff) return utf16Be(data, 2);
  const encoding = likelyUtf16(data);
  if (encoding === 'le') return data.toString('utf16le');
  if (encoding === 'be') return utf16Be(data);
  return data.toString('utf8');
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`); const parts = url.pathname.split('/').filter(Boolean);
  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) return sendStatic(res, 'index.html');
    if (req.method === 'GET' && (url.pathname === '/app.js' || url.pathname === '/app-enhanced.js' || url.pathname === '/diagram-renderer.js')) return sendStatic(res, url.pathname.slice(1));
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { status: 'ok' });
    if (req.method === 'POST' && url.pathname === '/api/models/import') { const xml = await body(req); const model = modelStore.put(parseSysmlXml(xml, req.headers['x-file-name']?.toString() ?? 'model.xml')); return send(res, 201, model); }
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'models' && parts[3] === 'tree') { const model = modelStore.get(parts[2]); if (!model) return send(res, 404, { message: 'Model not found' }); const all = [...model.elements, ...model.relations, ...model.diagrams]; const byOwner = new Map<string, any[]>(); for (const item of all) if (item.ownerId) (byOwner.get(item.ownerId) ?? byOwner.set(item.ownerId, []).get(item.ownerId)!).push(item); const roots = all.filter(x => !x.ownerId || !all.some(e => e.id === x.ownerId)); const tree = (x: any, path = new Set<string>()): any => { if (path.has(x.id)) return { ...x, children: [], cycle: true }; const next = new Set(path).add(x.id); return { ...x, children: (byOwner.get(x.id) ?? []).map((child: any) => tree(child, next)) }; }; return send(res, 200, roots.map((root: any) => tree(root))); }
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'diagrams') { const diagram = modelStore.diagram(parts[2], url.searchParams.get('modelId') ?? undefined); return diagram ? send(res, 200, diagram) : send(res, 404, { message: 'Diagram not found' }); }
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'elements') { const element = modelStore.element(parts[2], url.searchParams.get('modelId') ?? undefined); return element ? send(res, 200, element) : send(res, 404, { message: 'Element not found' }); }
    return send(res, 404, { message: 'Route not found' });
  } catch (error) { return send(res, 400, { message: error instanceof Error ? error.message : 'Import failed' }); }
});
server.listen(3000, () => console.log('SysML parser listening on http://localhost:3000'));
