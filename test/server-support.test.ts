import test from 'node:test';
import assert from 'node:assert/strict';
import { buildModelTree } from '../src/model-tree.js';
import { decodeXmlBody } from '../src/encoding.js';

test('exposes cyclic ownership groups in the model tree', () => {
  const items = [
    { id: 'a', metaClass: 'uml:Package', ownerId: 'b', childrenIds: [], stereotypes: [], attributes: {}, sourceXPath: '/a' },
    { id: 'b', metaClass: 'uml:Package', ownerId: 'a', childrenIds: [], stereotypes: [], attributes: {}, sourceXPath: '/b' }
  ];
  const tree = buildModelTree(items);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].id, 'a');
  assert.equal(tree[0].children[0].children[0].cycle, true);
});

test('decodes declared Latin-1 XML and UTF-16 XML without a BOM', () => {
  const latin1 = Buffer.from('<?xml version="1.0" encoding="ISO-8859-1"?><x name="caf\u00e9"/>', 'latin1');
  assert.match(decodeXmlBody(latin1), /caf\u00e9/);
  const utf16 = Buffer.from('<?xml version="1.0" encoding="UTF-16"?><x name="ok"/>', 'utf16le');
  assert.match(decodeXmlBody(utf16), /name="ok"/);
});
