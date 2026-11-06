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
  assert.equal(result.statistics.danglingReferences, 0);
});

test('keeps local missing references distinct from external references with the same fragment', () => {
  const result = parseSysmlXml(`<xmi:XMI>
    <diagram xmi:id="d"><shape xmi:id="external" modelElement="library.uml#missing"/>
      <shape xmi:id="local" modelElement="#missing"/></diagram>
    <packagedElement xmi:id="r" xmi:type="uml:Dependency" client="library.uml#missing" supplier="#missing"/>
    <ref href="#missing"/>
  </xmi:XMI>`);
  assert.equal(result.views.find(x => x.id === 'external')?.modelElementScope, 'external');
  assert.equal(result.views.find(x => x.id === 'local')?.modelElementScope, 'unresolved');
  assert.deepEqual(result.issues.filter(x => x.code === 'DANGLING_REFERENCE').map(x => x.elementId).sort(), ['local', 'r']);
  assert.ok(result.indexes?.externalReferences.every(x => x.file && x.href !== '#missing'));
});

test('does not bind explicit external view URIs to local objects with the same ID', () => {
  const result = parseSysmlXml('<xmi:XMI><packagedElement xmi:id="a" xmi:type="uml:Class"/><diagram xmi:id="d"><shape xmi:id="v" modelElement="library.uml#a"/></diagram></xmi:XMI>');
  assert.equal(result.views[0].modelElementScope, 'external');
  assert.equal(result.statistics.danglingReferences, 0);
});

test('diagnoses missing model references in MagicDraw drawing fileParts', () => {
  const result = parseSysmlXml(`<xmi:XMI><ownedDiagram xmi:id="d" xmi:type="uml:Diagram">
    <binaryObject streamContentID="drawing"/></ownedDiagram>
    <filePart name="drawing"><mdOwnedViews><mdElement xmi:id="v" elementClass="Class">
    <elementID xmi:idref="missing"/></mdElement></mdOwnedViews></filePart></xmi:XMI>`);
  assert.equal(result.views[0].modelElementScope, 'unresolved');
  assert.ok(result.issues.some(x => x.code === 'DANGLING_REFERENCE' && x.viewId === 'v'));
});

test('extracts typed relationship endpoints from attributes, nested references and owners', () => {
  const result = parseSysmlXml(`<xmi:XMI>
    <packagedElement xmi:id="child" xmi:type="uml:Class">
      <generalization xmi:id="g" xmi:type="uml:Generalization" general="library.uml#parent"/>
    </packagedElement>
    <packagedElement xmi:id="use" xmi:type="uml:UseCase">
      <include xmi:id="i" xmi:type="uml:Include"><addition><ref href="library.uml#included"/></addition></include>
      <extend xmi:id="e" xmi:type="uml:Extend" extendedCase="library.uml#base"/>
    </packagedElement>
    <packagedElement xmi:id="g2" xmi:type="uml:Generalization" specific="child" general="child"/>
    <packagedElement xmi:id="s" xmi:type="uml:MessageOccurrenceSpecification" covered="lineA"/>
    <packagedElement xmi:id="r" xmi:type="uml:MessageOccurrenceSpecification" covered="lineB"/>
    <packagedElement xmi:id="lineA" xmi:type="uml:Lifeline"/>
    <packagedElement xmi:id="lineB" xmi:type="uml:Lifeline"/>
    <message xmi:id="m" xmi:type="uml:Message" sendEvent="s"><receiveEvent xmi:idref="r"/></message>
  </xmi:XMI>`);
  const endpoints = Object.fromEntries(result.relations.map(x => [x.id, [x.sourceId, x.targetId]]));
  assert.deepEqual(endpoints, { g: ['child', 'parent'], i: ['use', 'included'], e: ['use', 'base'], g2: ['child', 'child'], m: ['s', 'r'] });
  assert.equal(result.statistics.danglingReferences, 0);
});

test('checks every nested endpoint and deduplicates repeated references', () => {
  const result = parseSysmlXml('<xmi:XMI><packagedElement xmi:id="a" xmi:type="uml:Class"/><packagedElement xmi:id="r" xmi:type="uml:Dependency" client="a"><client>a missing</client><supplier href="lib#missing"/></packagedElement></xmi:XMI>');
  assert.deepEqual(result.relations[0].sourceIds, ['a', 'missing']);
  assert.equal(result.statistics.danglingReferences, 1);
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
  assert.equal(result.views.find(x => x.id === 'v#duplicate-2')?.diagramId, 'd#duplicate-2');
});

test('keeps duplicate relationships attached to their own nested endpoint nodes', () => {
  const result = parseSysmlXml('<xmi:XMI><packagedElement xmi:id="a" xmi:type="uml:Class"/><packagedElement xmi:id="b" xmi:type="uml:Class"/><packagedElement xmi:id="r" xmi:type="uml:Dependency"><client xmi:idref="a"/></packagedElement><packagedElement xmi:id="r" xmi:type="uml:Dependency"><client xmi:idref="b"/></packagedElement></xmi:XMI>');
  assert.deepEqual(result.relations.map(r => r.sourceIds), [['a'], ['b']]);
});

test('resolves duplicate drawing IDs within their own diagram and preserves semantic edges', () => {
  const drawing = (stream: string, target: string) => `<filePart name="${stream}"><mdOwnedViews>
    <mdElement xmi:id="v" elementClass="Class"><elementID xmi:idref="${target}"/></mdElement>
    <mdElement xmi:id="edge" elementClass="Dependency"><elementID xmi:idref="r"/><linkFirstEndID xmi:idref="v"/><linkSecondEndID xmi:idref="v"/></mdElement>
    <mdElement xmi:id="link" elementClass="ContainmentLink"><linkFirstEndID xmi:idref="v"/><linkSecondEndID xmi:idref="v"/></mdElement>
    </mdOwnedViews></filePart>`;
  const result = parseSysmlXml(`<xmi:XMI><packagedElement xmi:id="a" xmi:type="uml:Class"/><packagedElement xmi:id="b" xmi:type="uml:Class"/>
    <packagedElement xmi:id="r" xmi:type="uml:Dependency" client="a" supplier="b"/>
    <ownedDiagram xmi:id="d" xmi:type="uml:Diagram"><binaryObject streamContentID="one"/></ownedDiagram>
    <ownedDiagram xmi:id="d" xmi:type="uml:Diagram"><binaryObject streamContentID="two"/></ownedDiagram>
    ${drawing('one', 'a')}${drawing('two', 'b')}</xmi:XMI>`);
  assert.equal(result.views.length, 6);
  const secondEdge = result.views.find(v => v.id === 'edge#duplicate-2')!;
  assert.equal(secondEdge.diagramId, 'd#duplicate-2');
  assert.equal(secondEdge.sourceViewId, 'v#duplicate-2');
  assert.equal(secondEdge.modelElementId, 'r');
  assert.equal(secondEdge.modelElementScope, 'relation');
  assert.deepEqual(result.relations.filter(r => r.relationOrigin === 'diagram').map(r => r.sourceId), ['a', 'b']);
  assert.equal(result.issues.filter(i => i.code === 'INVALID_VIEW').length, 0);
});

test('does not replace a broken semantic edge binding with a generated relation', () => {
  const result = parseSysmlXml(`<xmi:XMI><packagedElement xmi:id="a" xmi:type="uml:Class"/>
    <ownedDiagram xmi:id="d" xmi:type="uml:Diagram"><binaryObject streamContentID="s"/></ownedDiagram>
    <filePart name="s"><mdElement xmi:id="v"><elementID xmi:idref="a"/></mdElement>
    <mdElement xmi:id="e" elementClass="Transition"><elementID xmi:idref="missing"/>
    <linkFirstEndID xmi:idref="v"/><linkSecondEndID xmi:idref="v"/></mdElement></filePart></xmi:XMI>`);
  assert.equal(result.relations.length, 0);
  assert.equal(result.views.find(v => v.id === 'e')?.modelElementId, 'missing');
  assert.ok(result.issues.some(i => i.code === 'DANGLING_REFERENCE' && i.viewId === 'e'));
});

test('maps message occurrences to lifelines without changing event endpoints', () => {
  const result = parseSysmlXml(`<xmi:XMI>
    <packagedElement xmi:id="a" xmi:type="uml:Lifeline"/><packagedElement xmi:id="b" xmi:type="uml:Lifeline"/>
    <packagedElement xmi:id="s" xmi:type="uml:MessageOccurrenceSpecification" covered="a a"/>
    <packagedElement xmi:id="t" xmi:type="uml:MessageOccurrenceSpecification"><covered><ref xmi:idref="b"/></covered></packagedElement>
    <packagedElement xmi:id="gate" xmi:type="uml:Gate"/>
    <message xmi:id="m" xmi:type="uml:Message" sendEvent="s" receiveEvent="t"/>
    <message xmi:id="g" xmi:type="uml:Message" sendEvent="gate" receiveEvent="library#t"/>
  </xmi:XMI>`);
  const message = result.relations.find(r => r.id === 'm')!;
  assert.equal(message.sourceId, 's');
  assert.equal(message.targetId, 't');
  assert.deepEqual(message.sourceLifelineIds, ['a']);
  assert.deepEqual(message.targetLifelineIds, ['b']);
  assert.deepEqual(result.relations.find(r => r.id === 'g')?.sourceLifelineIds, []);
  assert.deepEqual(result.relations.find(r => r.id === 'g')?.targetLifelineIds, []);
});

test('retains Connector end IDs separately from referenced role IDs', () => {
  const result = parseSysmlXml(`<xmi:XMI>
    <packagedElement xmi:id="p1" xmi:type="uml:Property"/><packagedElement xmi:id="p2" xmi:type="uml:Property"/>
    <packagedElement xmi:id="c" xmi:type="uml:Connector"><end xmi:id="e1"><role href="#p1"/></end><end xmi:id="e2"><role xmi:idref="p2"/></end></packagedElement>
  </xmi:XMI>`);
  const connector = result.relations.find(r => r.id === 'c')!;
  assert.deepEqual(connector.endIds, ['e1', 'e2']);
  assert.deepEqual(connector.roleIds, ['p1', 'p2']);
  assert.equal(result.statistics.danglingReferences, 0);
  assert.equal(result.elements.find(e => e.id === 'e1')?.metaClass, 'uml:ConnectorEnd');
});

test('recognizes MagicDraw extension metaclasses and legal anonymous nodes', () => {
  const result = parseSysmlXml(`<xmi:XMI>
    <packagedElement xmi:id="flow-port" xmi:type="sysml:FlowPort"/>
    <packagedElement xmi:id="partition" xmi:type="uml:ActivityPartition"/>
    <packagedElement xmi:id="fork" xmi:type="uml:ForkNode"/>
    <packagedElement xmi:id="opaque" xmi:type="uml:OpaqueBehavior"/>
    <packagedElement xmi:id="matrix" xmi:type="DependencyMatrix"/>
  </xmi:XMI>`);
  assert.equal(result.issues.filter(x => x.code === 'UNKNOWN_METACLASS').length, 0);
  assert.equal(result.issues.filter(x => x.code === 'MISSING_NAME').length, 0);
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
  assert.match(source, /"schemaVersion": "1.2.0"/);
});
