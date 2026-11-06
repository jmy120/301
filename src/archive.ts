import { inflateRawSync } from 'node:zlib';
import { decodeXmlBody } from './encoding.js';

export interface ArchiveModelXml {
  xml: string;
  entryName: string;
  entryCount: number;
}

function u16(data: Buffer, offset: number): number { return data.readUInt16LE(offset); }
function u32(data: Buffer, offset: number): number { return data.readUInt32LE(offset); }

/** Read the small ZIP subset used by MagicDraw mdzip archives. */
export function extractMagicDrawModel(data: Buffer): ArchiveModelXml {
  const start = Math.max(0, data.length - 0xffff - 22);
  let eocd = -1;
  for (let i = data.length - 22; i >= start; i--) {
    if (u32(data, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('INVALID_MDZIP: ZIP end record not found');
  const count = u16(data, eocd + 10);
  const centralSize = u32(data, eocd + 12);
  const centralOffset = u32(data, eocd + 16);
  const entries: Array<{ name: string; method: number; compressed: number; localOffset: number }> = [];
  let p = centralOffset;
  for (let i = 0; i < count; i++) {
    if (u32(data, p) !== 0x02014b50) throw new Error('INVALID_MDZIP: invalid central directory');
    const method = u16(data, p + 10);
    const compressed = u32(data, p + 20);
    const nameLength = u16(data, p + 28);
    const extraLength = u16(data, p + 30);
    const commentLength = u16(data, p + 32);
    const localOffset = u32(data, p + 42);
    const name = data.subarray(p + 46, p + 46 + nameLength).toString('utf8');
    entries.push({ name, method, compressed, localOffset });
    p += 46 + nameLength + extraLength + commentLength;
  }
  if (p > centralOffset + centralSize) throw new Error('INVALID_MDZIP: central directory overflow');
  const preferred = entries.find(e => e.name === 'com.nomagic.magicdraw.uml_model.model')
    ?? entries.find(e => /(?:^|[\\/])uml_model\.model$/i.test(e.name));
  const entry = preferred ?? entries.find(e => /\.xml$/i.test(e.name));
  if (!entry) throw new Error('INVALID_MDZIP: main MagicDraw model XML not found');
  if (u32(data, entry.localOffset) !== 0x04034b50) throw new Error('INVALID_MDZIP: invalid local entry');
  const nameLength = u16(data, entry.localOffset + 26);
  const extraLength = u16(data, entry.localOffset + 28);
  const bodyStart = entry.localOffset + 30 + nameLength + extraLength;
  const compressed = data.subarray(bodyStart, bodyStart + entry.compressed);
  let body: Buffer;
  if (entry.method === 0) body = compressed;
  else if (entry.method === 8) body = inflateRawSync(compressed);
  else throw new Error(`INVALID_MDZIP: unsupported compression method ${entry.method}`);
  const modelXml = decodeXmlBody(body);
  // MagicDraw stores diagram presentations in separate BINARY-* XML parts.
  // They are fragments (mdOwnedViews), so attach their children to the main
  // XMI document and let the normal parser resolve modelElement references.
  if (entry.name === 'com.nomagic.magicdraw.uml_model.model') {
    const fragments: string[] = [];
    for (const part of entries.filter(e => e.name.startsWith('BINARY-'))) {
      const raw = readEntry(data, part);
      if (part.method !== 0 && part.method !== 8) continue;
      let fragment: Buffer;
      try { fragment = part.method === 0 ? raw : inflateRawSync(raw); } catch { continue; }
      const text = decodeXmlBody(fragment).replace(/^\s*<\?xml[^>]*\?>\s*/i, '');
      const match = /^<mdOwnedViews(?:\s[^>]*)?>([\s\S]*)<\/mdOwnedViews>\s*$/i.exec(text);
      if (match && match[1].trim()) fragments.push(`<filePart name="${part.name}">${match[1]}</filePart>`);
    }
    if (fragments.length) {
      const close = modelXml.lastIndexOf('</xmi:XMI>');
      if (close >= 0) return { xml: `${modelXml.slice(0, close)}${fragments.join('')}\n</xmi:XMI>`, entryName: entry.name, entryCount: entries.length };
    }
  }
  return { xml: modelXml, entryName: entry.name, entryCount: entries.length };
}

function readEntry(data: Buffer, entry: { method: number; compressed: number; localOffset: number }): Buffer {
  const nameLength = u16(data, entry.localOffset + 26);
  const extraLength = u16(data, entry.localOffset + 28);
  const bodyStart = entry.localOffset + 30 + nameLength + extraLength;
  return data.subarray(bodyStart, bodyStart + entry.compressed);
}

export function isMagicDrawArchive(fileName: string, data: Buffer): boolean {
  return /\.mdzip$/i.test(fileName) || data.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
}
