import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseSysmlXml } from '../src/parser.js';

test('adapts MagicDraw 2026 XMI semantic model and diagrams', async () => {
  const xml = await readFile(new URL('../../模型/export/test1.xml', import.meta.url), 'utf8');
  const result = parseSysmlXml(xml, 'test1.xml');
  assert.equal(result.source.productVersion, '2026x v2');
  assert.ok(result.elements.some(x => x.metaClass === 'uml:Package'));
  assert.ok(result.elements.some(x => x.stereotypes.includes('Block')));
  assert.ok(result.diagrams.length > 0);
  assert.ok(result.relations.some(x => x.kind === 'uml:Dependency' && x.sourceId && x.targetId));
  assert.ok(result.views.length > 100);
  assert.ok(result.views.some(x => x.bounds && x.modelElementId));
  assert.ok(result.diagrams.some(x => x.viewIds.length > 0));
  const objects = new Set([...result.elements, ...result.relations].map(x => x.id));
  assert.ok(result.diagrams.every(x => !x.ownerId || objects.has(x.ownerId)));
  assert.equal(result.statistics.duplicateIds, 0);
  assert.equal(result.statistics.danglingReferences, 0);
  assert.equal(result.issues.filter(x => x.code === 'MISSING_NAME').length, 0);
  assert.equal(result.issues.filter(x => x.code === 'UNSUPPORTED_ROOT').length, 0);
  assert.equal(result.relations.filter(x => x.relationOrigin === 'diagram').length, 0);
  const connectors = result.relations.filter(x => x.kind === 'uml:Connector');
  assert.equal(connectors.filter(x => x.roleIds?.length).length, 11);
  for (const connector of connectors) {
    const ends = result.elements.filter(x => connector.endIds.includes(x.id));
    const expected = [...new Set(ends.flatMap(end => [end.attributes.role, end.attributes.partWithPort]).filter((id): id is string => Boolean(id)))];
    assert.deepEqual(new Set(connector.roleIds), new Set(expected));
  }
  const edges = result.views.filter(x => x.sourceViewId && x.targetViewId);
  assert.equal(edges.length, 190);
  assert.ok(edges.every(view => result.relations.some(r => r.id === view.modelElementId && r.relationOrigin === 'semantic')));
  // Includes 24 DiagramRepresentationObjects whose type uses the SysML prefix.
  assert.equal(result.views.filter(x => x.presentationKind === 'diagram-structure').length, 162);
  assert.equal(result.views.filter(x => x.modelElementScope === 'diagram').length, 55);
  const formula = result.elements.find(x => x.metaClass === 'uml:OpaqueExpression' && x.textValues?.body?.includes('N_vis = N * (R/(R+H))*El'));
  assert.ok(formula, 'Real MagicDraw formula body must survive parsing');
  assert.deepEqual(formula.textValues?.language, ['English']);
});

test('adapts MagicDraw requirement-diagram containment links', async () => {
  const xml = await readFile(new URL('../../模型/export/test2.xml', import.meta.url), 'utf8');
  const result = parseSysmlXml(xml, 'test2.xml');
  const containmentLinks = result.relations.filter(x => x.kind === 'ContainmentLink');
  assert.ok(containmentLinks.length > 0);
  assert.ok(containmentLinks.every(x => x.sourceId && x.targetId));
  assert.ok(result.views.some(x => x.kind === 'ContainmentLink' && x.bounds?.includes(';')));
});
