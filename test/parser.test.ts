import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseSysmlXml } from '../src/parser.js';
import { serializeParsedModelModule } from '../src/exporter.js';

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
  assert.ok(result.indexes?.externalReferences.some(x => x.id === 'e1'));
});

test('normalizes MagicDraw embedded SysML diagram types for validator dispatch', () => {
  const result = parseSysmlXml('<xmi:XMI><ownedDiagram xmi:id="d" xmi:type="uml:Diagram"><diagramRepresentation><diagram:DiagramRepresentationObject xmi:id="representation" type="SysML Internal Block Diagram"/></diagramRepresentation></ownedDiagram></xmi:XMI>');
  assert.equal(result.diagrams[0].type, 'Internal Block Diagram');
});

test('retains all metaclasses and relations required by the validator whitelist', () => {
  const result = parseSysmlXml('<xmi:XMI><packagedElement xmi:id="block" xmi:type="sysml:Block" name="B"/><packagedElement xmi:id="initial" xmi:type="uml:InitialNode" name="Start"/><packagedElement xmi:id="final" xmi:type="uml:ActivityFinalNode" name="End"/><packagedElement xmi:id="pseudo" xmi:type="uml:Pseudostate" kind="initial"/><packagedElement xmi:id="message" xmi:type="uml:Message" name="req_go" sendEvent="block" receiveEvent="final"/><packagedElement xmi:id="flow" xmi:type="uml:ControlFlow" source="initial" target="final"/></xmi:XMI>');
  assert.equal(result.issues.filter(x => x.code === 'UNKNOWN_METACLASS').length, 0);
  assert.ok(result.relations.some(x => x.kind === 'uml:Message'));
  assert.ok(result.relations.some(x => x.kind === 'uml:ControlFlow'));
  assert.deepEqual(result.elements.filter(x => ['uml:InitialNode', 'uml:ActivityFinalNode', 'uml:Pseudostate'].includes(x.metaClass)).map(x => x.id), ['initial', 'final', 'pseudo']);
});

test('labels view targets and presentation records explicitly', () => {
  const result = parseSysmlXml('<xmi:XMI><packagedElement xmi:id="a" xmi:type="uml:Class" name="A"/><diagram xmi:id="d"><DiagramFrame xmi:id="frame" modelElement="d"/><shape xmi:id="node" modelElement="a"/></diagram></xmi:XMI>');
  assert.equal(result.views.find(x => x.id === 'frame')?.modelElementScope, 'diagram');
  assert.equal(result.views.find(x => x.id === 'frame')?.presentationKind, 'diagram-structure');
  assert.equal(result.views.find(x => x.id === 'node')?.modelElementScope, 'element');
  assert.equal(result.views.find(x => x.id === 'node')?.presentationKind, 'graphic');
});

test('labels views targeting indexed external references explicitly', () => {
  const result = parseSysmlXml('<xmi:XMI><diagram xmi:id="d"><shape xmi:id="v" modelElement="library.uml#stereotype"/><importedElement href="library.uml#stereotype"/></diagram></xmi:XMI>');
  assert.equal(result.views.find(x => x.id === 'v')?.modelElementScope, 'external');
});

test('does not expose generated XML wrappers as semantic owners', () => {
  const result = parseSysmlXml('<xmi:XMI><xmi:Extension><modelExtension><upperValue xmi:id="upper" xmi:type="uml:LiteralUnlimitedNatural" value="1"/></modelExtension></xmi:Extension></xmi:XMI>');
  assert.equal(result.elements.find(x => x.id === 'upper')?.ownerId, undefined);
});

test('resolves semantic owners through MagicDraw extension wrappers', () => {
  const result = parseSysmlXml('<xmi:XMI><ownedEnd xmi:id="end" xmi:type="uml:Property" name="p"><xmi:Extension><modelExtension><upperValue xmi:id="upper" xmi:type="uml:LiteralUnlimitedNatural" value="1"/></modelExtension></xmi:Extension></ownedEnd></xmi:XMI>');
  const upper = result.elements.find(x => x.id === 'upper');
  const end = result.elements.find(x => x.id === 'end');
  assert.equal(upper?.ownerId, 'end');
  assert.ok(end?.childrenIds.includes('upper'));
});

test('normalizes relation endpoint aliases and external references', () => {
  const result = parseSysmlXml('<xmi:XMI><packagedElement xmi:id="parent" xmi:type="uml:Class" name="Parent"/><packagedElement xmi:id="child" xmi:type="uml:Class" name="Child"/><packagedElement xmi:id="g" xmi:type="uml:Generalization" general="shared.uml#parent" specific="child"/></xmi:XMI>');
  const relation = result.relations.find(x => x.id === 'g');
  assert.equal(relation?.targetId, 'parent');
});

test('collects relation endpoints from nested reference nodes', () => {
  const result = parseSysmlXml('<xmi:XMI><packagedElement xmi:id="a" xmi:type="uml:Class" name="A"/><packagedElement xmi:id="b" xmi:type="uml:Class" name="B"/><packagedElement xmi:id="r" xmi:type="uml:Dependency"><client><ref xmi:idref="a"/></client><supplier><ref href="#b"/></supplier></packagedElement></xmi:XMI>');
  const relation = result.relations.find(x => x.id === 'r');
  assert.deepEqual(relation?.sourceIds, ['a']);
  assert.deepEqual(relation?.targetIds, ['b']);
  assert.equal(result.statistics.danglingReferences, 0);
});

test('reports unresolved endpoints beyond the legacy source and target fields', () => {
  const result = parseSysmlXml('<xmi:XMI><packagedElement xmi:id="a" xmi:type="uml:Class" name="A"/><packagedElement xmi:id="r" xmi:type="uml:Dependency" client="a missing" supplier="a"/></xmi:XMI>');
  assert.equal(result.issues.filter(x => x.code === 'DANGLING_REFERENCE' && x.referenceId === 'missing').length, 1);
});

test('reports invalid diagram roots and edge endpoints', () => {
  const result = parseSysmlXml('<xmi:XMI><diagram xmi:id="d" rootViewId="missing"><edge xmi:id="e" sourceView="also-missing"/></diagram></xmi:XMI>');
  assert.equal(result.issues.filter(x => x.code === 'INVALID_VIEW').length, 2);
});

test('validates Edge endpoints stored in nested wrapper nodes', () => {
  const result = parseSysmlXml('<xmi:XMI><diagram xmi:id="d"><shape xmi:id="a"/><edge xmi:id="e"><endpoint><sourceView xmi:idref="a"/></endpoint><endpoint><targetView xmi:idref="missing"/></endpoint></edge></diagram></xmi:XMI>');
  const invalid = result.issues.filter(x => x.code === 'INVALID_VIEW');
  assert.equal(invalid.length, 1);
  assert.equal(invalid[0].referenceId, 'missing');
});

test('keeps duplicate diagram and view IDs without overwriting the first object', () => {
  const result = parseSysmlXml('<xmi:XMI><diagram xmi:id="d"><shape xmi:id="v"/></diagram><diagram xmi:id="d"><shape xmi:id="v"/></diagram></xmi:XMI>');
  assert.equal(result.diagrams.length, 2);
  assert.equal(result.views.length, 2);
  assert.ok(result.diagrams.some(x => x.id === 'd#duplicate-2'));
  assert.ok(result.views.some(x => x.id === 'v#duplicate-2'));
});

test('preserves unknown extension nodes for downstream diagnostics', () => {
  const result = parseSysmlXml('<xmi:XMI><vendor:CustomNode xmi:id="custom-1" xmi:type="vendor:CustomNode" flag="x"/></xmi:XMI>');
  assert.deepEqual(result.extensions?.[0], { id: 'custom-1', tag: 'vendor:CustomNode', metaClass: 'vendor:CustomNode', attributes: { 'xmi:id': 'custom-1', 'xmi:type': 'vendor:CustomNode', flag: 'x' }, sourceXPath: '/xmi:XMI/vendor:CustomNode' });
});

test('does not assign a generated XML wrapper as the root Model owner', () => {
  const result = parseSysmlXml('<xmi:XMI><uml:Model xmi:id="model" name="M"/></xmi:XMI>');
  assert.equal(result.elements[0].ownerId, undefined);
});

test('serializes ParsedModel as an importable ES module', () => {
  const model = parseSysmlXml('<xmi:XMI><packagedElement xmi:id="class-1" xmi:type="uml:Class" name="C"/></xmi:XMI>');
  const source = serializeParsedModelModule(model);
  assert.match(source, /^\/\/ Generated by sysml-parser/);
  assert.match(source, /export const parsedModel = /);
  assert.match(source, /export default parsedModel;/);
  assert.match(source, /"schemaVersion": "1.1.0"/);
});
