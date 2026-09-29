import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decodeXmlBody } from './encoding.js';
import { serializeParsedModelModule } from './exporter.js';
import { parseSysmlXml } from './parser.js';

function usage(): never {
  console.error('Usage: npm run parse -- <input.xml> <output.parsed.js>');
  process.exit(1);
}

const [input, output] = process.argv.slice(2);
if (!input || !output) usage();

const inputPath = resolve(input);
const outputPath = resolve(output);
const xml = decodeXmlBody(await readFile(inputPath));
const model = parseSysmlXml(xml, inputPath);
await writeFile(outputPath, serializeParsedModelModule(model), 'utf8');
console.log(`Parsed ${model.statistics.elements} elements, ${model.statistics.relations} relations, ${model.statistics.diagrams} diagrams, and ${model.statistics.views} views to ${outputPath}`);
