import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseSysmlXml } from '../src/parser.js';

test('parses elements, relations, diagrams and views', async () => {
  const xml = await readFile(new URL('../examples/sample.sysml.xml', import.meta.url), 'utf8');
  const result = parseSysmlXml(xml, 'sample.sysml.xml');
  assert.equal(result.statistics.elements, 4);
  assert.equal(result.statistics.relations, 1);
  assert.equal(result.statistics.diagrams, 1);
  assert.equal(result.statistics.views, 1);
  assert.equal(result.relations[0].sourceId, 'port-1');
  assert.equal(result.diagrams[0].viewIds[0], 'view-1');
  assert.equal(result.issues.filter(x => x.code === 'DANGLING_REFERENCE').length, 0);
});

test('reports unresolved references', () => {
  const result = parseSysmlXml('<xmi:XMI><node xmi:id="a" xmi:type="Connector" source="missing" /></xmi:XMI>');
  assert.equal(result.statistics.danglingReferences, 1);
});

test('reports unnamed model classifiers but not valid anonymous values', () => {
  const result = parseSysmlXml('<xmi:XMI><packagedElement xmi:id="class-1" xmi:type="uml:Class" /><ownedAttribute xmi:id="value-1" xmi:type="uml:LiteralString" value="42" /></xmi:XMI>');
  assert.deepEqual(result.issues.filter(x => x.code === 'MISSING_NAME').map(x => x.elementId), ['class-1']);
});

test('normalizes view and mdElement external references', () => {
  const result = parseSysmlXml('<xmi:XMI><packagedElement xmi:id="e1" xmi:type="uml:Class" name="E"/><diagram xmi:id="d1"><shape xmi:id="v1" modelElement="other.xmi#e1"/><mdElement xmi:id="v2"><elementID href="PROJECT-x?resource=r#e1"/></mdElement></diagram></xmi:XMI>');
  assert.equal(result.views.find(x => x.id === 'v1')?.modelElementId, 'e1');
});
