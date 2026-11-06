import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseSysmlXml } from '../src/parser.js';

const xml = await readFile(new URL('../examples/clean-xmi-semantics.sysml.xml', import.meta.url), 'utf8');
const model = parseSysmlXml(xml);
const object = (id: string) => {
  const value = [...model.elements, ...model.relations].find(o => o.id === id);
  assert.ok(value, `Missing semantic object ${id}`);
  return value;
};

test('Clean XMI supports the new metaclasses and valid anonymous features without diagnostics', () => {
  assert.deepEqual(model.issues, []);
});

test('owned target InputPins survive and ObjectFlow endpoints resolve for calls and signals', () => {
  for (const [action, pin] of [['call', 'call-target'], ['send', 'signal-target']]) {
    assert.equal(object(pin).metaClass, 'uml:InputPin');
    assert.equal(object(pin).ownerId, action);
    assert.deepEqual(object(action).references?.target, [pin]);
  }
  assert.equal(model.relations.find(r => r.id === 'flow')?.targetId, 'call-target');
  assert.equal(model.relations.find(r => r.id === 'signal-flow')?.targetId, 'signal-target');
  assert.ok(!model.elements.some(e => e.id.startsWith('generated-')));
});

test('AssociationClass exports endpoints together with classifier children and stereotypes', () => {
  const joint = model.relations.find(r => r.id === 'joint');
  assert.ok(joint);
  assert.deepEqual(joint.endIds, ['end-a', 'end-b']);
  assert.deepEqual(joint.references?.memberEnd, ['end-a', 'end-b']);
  assert.deepEqual(joint.references?.ownedAttribute, ['stiffness']);
  assert.deepEqual(joint.references?.ownedOperation, ['joint-op']);
  assert.deepEqual(joint.references?.ownedRule, ['joint-rule']);
  assert.deepEqual(joint.stereotypes, ['Block']);
  assert.equal(object('joint-expr').textValues?.body?.[0], 'k > 0');
  assert.equal(object('end-a').ownerId, 'joint');
  assert.deepEqual(object('end-b').references?.type, ['types.uml#RemoteType']);
  assert.equal([...model.elements, ...model.relations].filter(o => o.id === 'joint').length, 1);
});

test('InformationFlow retains payload and realization bindings and distinguishes external endpoints', () => {
  const flow = model.relations.find(r => r.id === 'information');
  assert.ok(flow);
  assert.deepEqual(flow.sourceIds, ['port']);
  assert.deepEqual(flow.targetIds, ['port']);
  assert.deepEqual(flow.references?.informationTarget, ['external.uml#port']);
  assert.deepEqual(flow.references?.conveyed, ['type']);
  assert.deepEqual(flow.references?.realizingConnector, ['connector']);
  assert.deepEqual(flow.stereotypes, ['ItemFlow']);
  assert.ok(model.indexes?.externalReferences.some(r => r.href === 'external.uml#port'));
});

test('instance slots retain classifier, defining feature and value bindings including inline literals', () => {
  assert.deepEqual(object('instance').references?.classifier, ['types.uml#Device']);
  assert.deepEqual(object('instance').references?.slot, ['slot', 'inline-slot']);
  assert.deepEqual(object('slot').references?.definingFeature, ['types.uml#level']);
  assert.deepEqual(object('slot').references?.value, ['instance-value']);
  assert.deepEqual(object('instance-value').references?.instance, ['instance']);
  assert.deepEqual(object('inline-slot').references?.definingFeature, ['feature']);
  assert.deepEqual(object('inline-slot').textValues?.['value.value'], ['002']);
});

test('actions retain operated features, signal, classifier and value pin roles', () => {
  for (const id of ['read', 'write', 'clear']) assert.deepEqual(object(id).references?.structuralFeature, ['feature']);
  assert.deepEqual(object('read').references?.object, ['read-object']);
  assert.deepEqual(object('write').references?.value, ['write-value']);
  assert.deepEqual(object('write').references?.insertAt, ['position']);
  assert.deepEqual(object('create').references?.classifier, ['type']);
  assert.deepEqual(object('send').references?.signal, ['signal']);
  assert.deepEqual(object('constant').references?.value, ['constant-value']);
  assert.deepEqual(object('constant-value').textValues?.value, ['001']);
  assert.deepEqual(object('operation').references?.method, ['activity']);
  assert.deepEqual(object('flow').references?.weight, ['weight']);
});

test('InteractionUse and TimeExpression keep coverage, reused interaction and expression roles', () => {
  assert.deepEqual(object('reuse').references?.covered, ['line']);
  assert.deepEqual(object('reuse').references?.refersTo, ['scenarios.uml#subscenario']);
  assert.deepEqual(object('timer').references?.when, ['time']);
  assert.deepEqual(object('time').references?.expr, ['time-value']);
  assert.deepEqual(object('time-value').textValues?.value, ['dt s']);
});

test('owned value references and scalar value text retain their distinct meanings', () => {
  const parsed = parseSysmlXml(`<xmi:XMI>
    <slot xmi:id="slot"><value href="values.uml#v"/></slot>
    <node xmi:type="uml:ValueSpecificationAction" xmi:id="action"><value xmi:idref="literal"/></node>
    <value xmi:type="uml:LiteralString" xmi:id="literal"><value>0003</value></value>
  </xmi:XMI>`);
  assert.deepEqual(parsed.elements.find(e => e.id === 'slot')?.references?.value, ['values.uml#v']);
  assert.deepEqual(parsed.elements.find(e => e.id === 'action')?.references?.value, ['literal']);
  assert.deepEqual(parsed.elements.find(e => e.id === 'literal')?.textValues?.value, ['0003']);
});

test('reference wrappers stay references and genuine missing flow targets still produce errors', () => {
  const parsed = parseSysmlXml(`<xmi:XMI><packagedElement xmi:type="uml:InformationFlow" xmi:id="f" name="F">
    <informationSource href="lib.uml#remote"/><informationTarget xmi:idref="missing"/>
  </packagedElement></xmi:XMI>`);
  assert.equal(parsed.statistics.danglingReferences, 1);
  assert.equal(parsed.issues.find(i => i.code === 'DANGLING_REFERENCE')?.referenceId, 'missing');
});
