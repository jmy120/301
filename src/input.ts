import { parseSysmlXml } from './parser.js';
import { decodeXmlBody } from './encoding.js';
import { extractMagicDrawModel, isMagicDrawArchive } from './archive.js';
import type { ParsedModel } from './types.js';

export function parseModelInput(data: Buffer, fileName = 'model.xml'): ParsedModel {
  if (!isMagicDrawArchive(fileName, data)) return parseSysmlXml(decodeXmlBody(data), fileName);
  const archive = extractMagicDrawModel(data);
  return parseSysmlXml(archive.xml, fileName);
}
