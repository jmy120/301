import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseSysmlXml } from '../src/parser.js';

const xml = await readFile(new URL('../examples/nine-diagrams.sysml.xml', import.meta.url), 'utf8');
const model = parseSysmlXml(xml, 'nine-diagrams.sysml.xml');

test('canonicalizes direct diagram types for all nine SysML diagrams', () => {
  assert.deepEqual(model.diagrams.map(d => d.type), [
    'Block Definition Diagram', 'Internal Block Diagram', 'Requirement Diagram',
    'Parametric Diagram', 'Use Case Diagram', 'Activity Diagram',
    'Sequence Diagram', 'State Machine Diagram', 'Package Diagram'
  ]);
  assert.deepEqual(model.issues, []);
});

test('BDD preserves implicit Property and Generalization types and classifier references', () => {
  const speed = model.elements.find(e => e.id === 'speed')!;
  assert.equal(speed.metaClass, 'uml:Property');
  assert.equal(speed.attributes.type, 'real');
  assert.equal(speed.ownerId, 'motor');
  const generalization = model.relations.find(r => r.id === 'inherits-motor')!;
  assert.equal(generalization.sourceId, 'drive');
  assert.equal(generalization.targetId, 'motor');
  const association = model.relations.find(r => r.id === 'association')!;
  assert.deepEqual(association.endIds, ['association-a', 'association-b']);
  assert.ok(association.endIds.every(id => model.elements.some(e => e.id === id && e.metaClass === 'uml:Property')));
});

test('IBD retains ConnectorEnd definitions and attribute-based role/partWithPort references', () => {
  const wire = model.relations.find(r => r.id === 'power-wire')!;
  assert.equal(wire.kind, 'uml:Connector');
  assert.deepEqual(wire.endIds, ['power-source', 'power-target']);
  assert.deepEqual(wire.roleIds, ['controller-port', 'controller-part', 'motor-port', 'motor-part']);
  assert.ok(wire.endIds.every(id => model.elements.some(e => e.id === id && e.metaClass === 'uml:ConnectorEnd' && e.ownerId === wire.id)));
});

test('requirement stereotypes accept namespace aliases and preserve Id/Text payloads', () => {
  assert.deepEqual(model.elements.find(e => e.id === 'speed-requirement')?.stereotypes, ['Requirement']);
  assert.deepEqual(model.relations.find(r => r.id === 'satisfy-speed')?.stereotypes, ['Satisfy']);
  const application = model.extensions?.find(e => e.id === 'requirement-application')!;
  assert.equal(application.attributes.Id, 'REQ-001');
  assert.equal(application.attributes.Text, 'Speed shall be limited.');
  assert.equal(application.attributes.base_Class, 'speed-requirement');
  assert.ok(!model.relations.some(r => r.id === 'satisfy-application'));
});

test('parametric diagram retains ConstraintBlock and BindingConnector semantics', () => {
  assert.deepEqual(model.elements.find(e => e.id === 'speed-constraint')?.stereotypes, ['ConstraintBlock']);
  const binding = model.relations.find(r => r.id === 'speed-binding')!;
  assert.deepEqual(binding.stereotypes, ['BindingConnector']);
  assert.deepEqual(binding.roleIds, ['speed', 'constraint-input', 'constraint-property']);
});

test('use case Include/Extend infer fixed types and preserve endpoint direction', () => {
  for (const [id, kind, target] of [['include-check', 'uml:Include', 'check'], ['extend-stop', 'uml:Extend', 'stop']]) {
    const relation = model.relations.find(r => r.id === id)!;
    assert.equal(relation.kind, kind);
    assert.equal(relation.sourceId, 'start');
    assert.equal(relation.targetId, target);
  }
});

test('activity control nodes and state-machine transition/guard remain semantic objects', () => {
  for (const [id, type] of [['decision', 'DecisionNode'], ['merge', 'MergeNode'], ['join', 'JoinNode']]) {
    assert.equal(model.elements.find(e => e.id === id)?.metaClass, `uml:${type}`);
  }
  const flow = model.relations.find(r => r.id === 'control-flow')!;
  assert.equal(flow.sourceId, 'initial');
  assert.equal(flow.targetId, 'decision');
  const transition = model.relations.find(r => r.id === 'start-transition')!;
  assert.equal(transition.sourceId, 'idle');
  assert.equal(transition.targetId, 'running');
  assert.equal(model.elements.find(e => e.id === 'start-guard')?.ownerId, transition.id);
  assert.equal(model.elements.find(e => e.id === 'start-guard')?.metaClass, 'uml:Constraint');
});

test('sequence messages and lifelines without xmi:type still resolve event-to-lifeline mappings', () => {
  const message = model.relations.find(r => r.id === 'start-message')!;
  assert.equal(message.sourceId, 'send');
  assert.equal(message.targetId, 'receive');
  assert.deepEqual(message.sourceLifelineIds, ['operator-line']);
  assert.deepEqual(message.targetLifelineIds, ['controller-line']);
});

test('package imports and merges resolve nested/attribute targets and implicit owner sources', () => {
  for (const [id, target] of [['import-library', 'library'], ['merge-base', 'base']]) {
    const relation = model.relations.find(r => r.id === id)!;
    assert.equal(relation.sourceId, 'system');
    assert.equal(relation.targetId, target);
  }
  const broken = parseSysmlXml('<xmi:XMI><packagedElement xmi:type="uml:Package" xmi:id="p" name="P"><packageImport xmi:id="i" importedPackage="missing"/><packageMerge xmi:id="m" mergedPackage="lib.uml#external"/></packagedElement></xmi:XMI>');
  assert.deepEqual(broken.issues.filter(i => i.code === 'DANGLING_REFERENCE').map(i => i.referenceId), ['missing']);
  assert.ok(broken.indexes?.externalReferences.some(r => r.href === 'lib.uml#external'));
});

test('generic edges export attribute and nested view endpoints without synthesizing semantic relations', () => {
  const edge = model.views.find(v => v.id === 'wire-view')!;
  assert.equal(edge.sourceViewId, 'controller-view');
  assert.equal(edge.targetViewId, 'motor-view');
  assert.equal(edge.modelElementId, 'power-wire');
  assert.equal(edge.modelElementScope, 'relation');
  assert.ok(model.relations.every(r => r.relationOrigin === 'semantic'));
});

test('stereotype binding deduplicates local bases and skips external and filePart applications', () => {
  const parsed = parseSysmlXml(`<xmi:XMI xmlns:alias="urn:sysml">
    <packagedElement xmi:type="uml:Class" xmi:id="a" name="A" stereotype="Block"/>
    <alias:Block xmi:id="s" base_Class="#a" base_Element="a"/>
    <alias:Requirement xmi:id="external" base_Class="library.uml#a"/>
    <filePart name="library"><alias:ConstraintBlock xmi:id="library-stereo" base_Class="a"/></filePart>
  </xmi:XMI>`);
  assert.deepEqual(parsed.elements[0].stereotypes, ['Block']);
  assert.equal(parsed.extensions?.filter(e => e.id === 's').length, 1);
  assert.ok(!parsed.extensions?.some(e => e.id === 'library-stereo'));
});

test('generic edge endpoints resolve within each diagram and diagnose conflicting sources', () => {
  const parsed = parseSysmlXml(`<xmi:XMI>
    <diagram xmi:id="d1"><shape xmi:id="v"/><edge xmi:id="e1" source="v" target="v"/></diagram>
    <diagram xmi:id="d2"><shape xmi:id="v"/><shape xmi:id="w"/>
      <edge xmi:id="e2" source="v" target="v"/>
      <edge xmi:id="ambiguous" source="v" sourceView="w"/>
    </diagram></xmi:XMI>`);
  assert.equal(parsed.views.find(v => v.id === 'e2')?.sourceViewId, 'v#duplicate-2');
  assert.equal(parsed.views.find(v => v.id === 'e2')?.targetViewId, 'v#duplicate-2');
  assert.equal(parsed.views.find(v => v.id === 'ambiguous')?.sourceViewId, undefined);
  assert.ok(parsed.issues.some(i => i.code === 'INVALID_VIEW' && i.viewId === 'ambiguous'));
});

test('canonical diagram aliases also classify diagram representation records', () => {
  const parsed = parseSysmlXml(`<xmi:XMI><diagram xmi:id="d" diagramType=" SysML  Internal Block Diagram ">
    <diagramRepresentation xmi:id="representation" type="SysML Internal Block Diagram"/>
  </diagram></xmi:XMI>`);
  assert.equal(parsed.diagrams[0].type, 'Internal Block Diagram');
  assert.equal(parsed.views[0].kind, 'SysML Internal Block Diagram');
  assert.equal(parsed.views[0].presentationKind, 'diagram-structure');
});
