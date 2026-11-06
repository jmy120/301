import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseSysmlXml } from './dist/parser.js';
import { decodeXmlBody } from './dist/encoding.js';
import { serializeParsedModelModule } from './dist/exporter.js';
const out = process.argv[2] ?? 'E:/301/模型/解析检查_20261031';
await mkdir(out, { recursive: true });
const names = ['hybrid sport utility vehicle', 'InvertedPendulum', 'MultiMediaExample', 'WaterSupply', 'test1', 'test2', 'distiller model'];
const summary = [];
for (const name of names) {
  const input = `E:/301/模型/export/${name}.xml`;
  const model = parseSysmlXml(decodeXmlBody(await readFile(input)), input);
  await writeFile(`${out}/${name}.parsed.json`, JSON.stringify(model, null, 2));
  if (names.indexOf(name) < 4) await writeFile(`${out}/${name}.parsed.js`, serializeParsedModelModule(model));
  const count = xs => Object.fromEntries([...new Set(xs)].map(x => [x, xs.filter(y => y === x).length]));
  summary.push({ name, ...model.statistics, issues: count(model.issues.map(x => x.code)), unknown: count(model.issues.filter(x => x.code === 'UNKNOWN_METACLASS').map(x => x.message)), diagramTypes: count(model.diagrams.map(x => x.type)) });
}
await writeFile(`${out}/summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
