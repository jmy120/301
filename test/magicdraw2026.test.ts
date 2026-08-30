import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseSysmlXml } from '../src/parser.js';

test('adapts MagicDraw 2026 XMI semantic model and diagrams', async () => {
  const xml = await readFile('E:/301/test1.xml', 'utf8');
  const result = parseSysmlXml(xml, 'test1.xml');
  assert.equal(result.source.productVersion, '2026x v2');
  assert.ok(result.elements.some(x => x.metaClass === 'uml:Package'));
  assert.ok(result.elements.some(x => x.stereotypes.includes('Block')));
  assert.ok(result.diagrams.length > 0);
  assert.ok(result.relations.some(x => x.kind === 'uml:Dependency' && x.sourceId && x.targetId));
  assert.ok(result.views.length > 100);
  assert.ok(result.views.some(x => x.bounds && x.modelElementId));
  assert.ok(result.diagrams.some(x => x.viewIds.length > 0));
  assert.equal(result.statistics.duplicateIds, 0);
  assert.equal(result.statistics.danglingReferences, 0);
  assert.equal(result.issues.filter(x => x.code === 'MISSING_NAME').length, 0);
  assert.equal(result.issues.filter(x => x.code === 'UNSUPPORTED_ROOT').length, 0);
});

test('adapts MagicDraw requirement-diagram containment links', async () => {
  const xml = await readFile('E:/301/test2.xml', 'utf8');
  const result = parseSysmlXml(xml, 'test2.xml');
  const containmentLinks = result.relations.filter(x => x.kind === 'ContainmentLink');
  assert.ok(containmentLinks.length > 0);
  assert.ok(containmentLinks.every(x => x.sourceId && x.targetId));
  assert.ok(result.views.some(x => x.kind === 'ContainmentLink' && x.bounds?.includes(';')));
});
