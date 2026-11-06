import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { serializeParsedModelModule } from './exporter.js';
import { parseModelInput } from './input.js';

function usage(): never {
  console.error('Usage: npm run parse -- <input.xml|input.xmi|input.mdzip> <output.parsed.js>');
  process.exit(1);
}

const [input, output] = process.argv.slice(2);
if (!input || !output) usage();

const inputPath = resolve(input);
const outputPath = resolve(output);
const model = parseModelInput(await readFile(inputPath), inputPath);
await writeFile(outputPath, serializeParsedModelModule(model), 'utf8');
console.log(`Parsed ${model.statistics.elements} elements, ${model.statistics.relations} relations, ${model.statistics.diagrams} diagrams, and ${model.statistics.views} views to ${outputPath}`);
