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

test('normalizes relation endpoint aliases and external references', () => {
  const result = parseSysmlXml('<xmi:XMI><packagedElement xmi:id="parent" xmi:type="uml:Class" name="Parent"/><packagedElement xmi:id="child" xmi:type="uml:Class" name="Child"/><packagedElement xmi:id="g" xmi:type="uml:Generalization" general="shared.uml#parent" specific="child"/></xmi:XMI>');
  const relation = result.relations.find(x => x.id === 'g');
  assert.equal(relation?.targetId, 'parent');
});

test('reports invalid diagram roots and edge endpoints', () => {
  const result = parseSysmlXml('<xmi:XMI><diagram xmi:id="d" rootViewId="missing"><edge xmi:id="e" sourceView="also-missing"/></diagram></xmi:XMI>');
  assert.equal(result.issues.filter(x => x.code === 'INVALID_VIEW').length, 2);
});

test('preserves unknown extension nodes for downstream diagnostics', () => {
  const result = parseSysmlXml('<xmi:XMI><vendor:CustomNode xmi:id="custom-1" xmi:type="vendor:CustomNode" flag="x"/></xmi:XMI>');
  assert.deepEqual(result.extensions?.[0], { id: 'custom-1', tag: 'vendor:CustomNode', metaClass: 'vendor:CustomNode', attributes: { 'xmi:id': 'custom-1', 'xmi:type': 'vendor:CustomNode', flag: 'x' }, sourceXPath: '/xmi:XMI/vendor:CustomNode' });
});

test('does not assign a generated XML wrapper as the root Model owner', () => {
  const result = parseSysmlXml('<xmi:XMI><uml:Model xmi:id="model" name="M"/></xmi:XMI>');
  assert.equal(result.elements[0].ownerId, undefined);
});
