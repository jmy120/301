import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseSysmlXml } from '../src/parser.js';

const xml = await readFile(new URL('../examples/semantic-details.sysml.xml', import.meta.url), 'utf8');
const model = parseSysmlXml(xml, 'semantic-details.sysml.xml');
const element = (id: string) => {
  const value = model.elements.find(e => e.id === id);
  assert.ok(value, `Missing element ${id}`);
  return value;
};
const relation = (id: string) => {
  const value = model.relations.find(e => e.id === id);
  assert.ok(value, `Missing relation ${id}`);
  return value;
};

test('parses the semantic detail sample without parse diagnostics', () => {
  assert.deepEqual(model.issues, []);
});

test('BDD exports direct UML class tags, nested classifier references and multiplicities', () => {
  assert.equal(element('motor').metaClass, 'uml:Class');
  const property = element('motors');
  assert.deepEqual(property.references?.type, ['motor']);
  assert.deepEqual(property.references?.lowerValue, ['lower']);
  assert.deepEqual(property.references?.upperValue, ['upper']);
  assert.equal(property.attributes.type, undefined);
  assert.deepEqual(element('lower').textValues?.value, ['0']);
  assert.deepEqual(element('upper').textValues?.value, ['*']);
});

test('association ends do not absorb the nested classifier IDs as extra ends', () => {
  assert.deepEqual(relation('association').endIds, ['assoc-a', 'assoc-b']);
  assert.deepEqual(element('assoc-a').references?.type, ['motor']);
  assert.deepEqual(element('assoc-b').references?.type, ['types.uml#ExternalType']);
  assert.ok(model.indexes?.externalReferences.some(r => r.file === 'types.uml' && r.id === 'ExternalType'));
});

test('IBD keeps each ConnectorEnd role and partWithPort pairing', () => {
  assert.deepEqual(element('end-a').references?.role, ['motors']);
  assert.deepEqual(element('end-b').references?.role, ['motors']);
  assert.deepEqual(element('end-b').references?.partWithPort, ['motors']);
  assert.deepEqual(relation('binding').endIds, ['end-a', 'end-b']);
});

test('REQ attaches nested base_Class and preserves lexical child Id/Text values', () => {
  assert.deepEqual(element('requirement').stereotypes, ['Requirement']);
  const application = model.extensions?.find(e => e.id === 'requirement-app');
  assert.ok(application);
  assert.deepEqual(application.references?.base_Class, ['requirement']);
  assert.deepEqual(application.textValues?.Id, ['0007']);
  assert.deepEqual(application.textValues?.Text, ['  At most five motors.  ']);
  assert.equal(application.attributes.Id, undefined);
});

test('PAR preserves ordered expression bodies/languages and CDATA without numeric coercion', () => {
  assert.deepEqual(element('formula').references?.constrainedElement, ['motors']);
  assert.deepEqual(element('formula').references?.specification, ['expression']);
  assert.deepEqual(element('expression').textValues, {
    body: ['001', 'count < 5 && enabled'], language: ['Text', 'OCL']
  });
  assert.equal(element('formula').textValues, undefined);
});

test('ACT guard and expression references remain owned by their semantic objects', () => {
  assert.deepEqual(relation('flow').references?.guard, ['flow-guard']);
  assert.deepEqual(element('flow-guard').references?.specification, ['flow-expression']);
  assert.deepEqual(element('flow-expression').textValues?.body, ['true']);
  assert.equal(relation('flow').textValues, undefined);
});

test('STM preserves trigger/event and effect body without merging these into endpoints', () => {
  assert.deepEqual(relation('transition').references?.trigger, ['trigger']);
  assert.deepEqual(relation('transition').references?.effect, ['effect']);
  assert.deepEqual(element('trigger').references?.event, ['events.uml#StartEvent']);
  assert.deepEqual(element('effect').textValues?.body, ['stopMotor()']);
  assert.equal(element('done').metaClass, 'uml:FinalState');
});

test('UC retains extensionLocation separately from the target UseCase', () => {
  assert.deepEqual(relation('extend').references?.extensionLocation, ['point']);
  assert.equal(element('point').metaClass, 'uml:ExtensionPoint');
  assert.equal(relation('extend').sourceId, 'extension-case');
  assert.equal(relation('extend').targetId, 'base-case');
});

test('SEQ preserves represented property, execution interval and operand guard structure', () => {
  assert.deepEqual(element('line').references?.represents, ['motors']);
  assert.deepEqual(element('execution').references, { covered: ['line'], start: ['start'], finish: ['finish'] });
  assert.deepEqual(element('alt').references?.operand, ['operand']);
  assert.equal(element('operand').metaClass, 'uml:InteractionOperand');
  assert.deepEqual(element('operand').references?.guard, ['interaction-guard']);
  assert.deepEqual(element('interaction-guard').references?.specification, ['interaction-expression']);
});

test('PKG retains full external package URI and the normalized legacy target ID', () => {
  assert.deepEqual(relation('package-import').references?.importedPackage, ['library.uml#Library']);
  assert.equal(relation('package-import').targetId, 'Library');
});

test('anonymous inline value specifications preserve relative feature paths', () => {
  const parsed = parseSysmlXml(`<xmi:XMI><ownedRule xmi:id="c">
    <specification xmi:type="uml:OpaqueExpression"><body>001</body><language>Text</language></specification>
  </ownedRule></xmi:XMI>`);
  assert.deepEqual(parsed.elements[0].textValues, { 'specification.body': ['001'], 'specification.language': ['Text'] });
  assert.equal(parsed.elements[0].references, undefined);
});

test('expression empty bodies and repeated languages retain their original positions', () => {
  const parsed = parseSysmlXml(`<xmi:XMI><specification xmi:type="uml:OpaqueExpression" xmi:id="expr">
    <body/><language>OCL</language><body>002</body><language>OCL</language>
  </specification></xmi:XMI>`);
  assert.deepEqual(parsed.elements[0].textValues, { body: ['', '002'], language: ['OCL', 'OCL'] });
});

test('nested stereotype base attributes also accept namespace qualification', () => {
  const parsed = parseSysmlXml(`<xmi:XMI><uml:Class xmi:id="c" name="C"/>
    <Alias:Block xmi:id="s" Alias:base_Class="#c"/>
  </xmi:XMI>`);
  assert.deepEqual(parsed.elements[0].stereotypes, ['Block']);
  assert.deepEqual(parsed.extensions?.find(e => e.id === 's')?.references?.base_Class, ['c']);
});

test('relationship endpoint traversal excludes nested guards and owned-end value specifications', () => {
  const parsed = parseSysmlXml(`<xmi:XMI>
    <packagedElement xmi:type="uml:Class" xmi:id="a" name="A"/>
    <packagedElement xmi:type="uml:Class" xmi:id="b" name="B"/>
    <packagedElement xmi:type="uml:Association" xmi:id="r">
      <ownedEnd xmi:id="end"><type href="#a"/>
        <defaultValue xmi:type="uml:OpaqueExpression" xmi:id="value">
          <source xmi:idref="not-an-endpoint"/>
        </defaultValue>
        <defaultValue xmi:type="uml:OpaqueExpression"><source xmi:idref="anonymous-not-an-endpoint"/></defaultValue>
      </ownedEnd>
    </packagedElement>
    <transition xmi:id="t" source="a" target="b">
      <guard xmi:id="guard"><specification xmi:type="uml:OpaqueExpression" xmi:id="expr">
        <target xmi:idref="also-not-an-endpoint"/>
      </specification></guard>
      <guard><specification xmi:type="uml:OpaqueExpression"><source xmi:idref="anonymous-guard-reference"/></specification></guard>
    </transition>
  </xmi:XMI>`);
  assert.deepEqual(parsed.relations.find(r => r.id === 'r')?.endIds, ['end']);
  assert.deepEqual(parsed.relations.find(r => r.id === 'r')?.sourceIds, []);
  assert.deepEqual(parsed.relations.find(r => r.id === 't')?.targetIds, ['b']);
  assert.equal(parsed.statistics.danglingReferences, 0);
});

test('feature references preserve distinct local/external IDs and tokenize external indexes correctly', () => {
  const parsed = parseSysmlXml(`<xmi:XMI>
    <ownedAttribute xmi:id="p" name="P" type="#a"><type href="lib.uml#a"/><type href="other.uml#b"/></ownedAttribute>
    <Requirements:Requirement xmi:id="s"><base_Class href="lib.uml#a"/><Id>0001</Id></Requirements:Requirement>
    <packagedElement xmi:type="uml:Class" xmi:id="a" name="A"/>
    <packagedElement xmi:type="uml:Dependency" xmi:id="d" client="lib.uml#a other.uml#b"/>
  </xmi:XMI>`);
  assert.deepEqual(parsed.elements.find(e => e.id === 'p')?.references?.type, ['a', 'lib.uml#a', 'other.uml#b']);
  assert.deepEqual(parsed.elements.find(e => e.id === 'a')?.stereotypes, []);
  assert.ok(parsed.indexes?.externalReferences.every(r => !/\s/.test(r.href)));
  assert.ok(parsed.indexes?.externalReferences.some(r => r.file === 'lib.uml' && r.id === 'a'));
  assert.ok(parsed.indexes?.externalReferences.some(r => r.file === 'other.uml' && r.id === 'b'));
});
