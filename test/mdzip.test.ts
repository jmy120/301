import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseModelInput } from '../src/input.js';

test('imports a MagicDraw 18.5 mdzip archive through the normal input path', async () => {
  const data = await readFile(new URL('../../模型/architecting-spacecraft（MagicDraw18.5）.mdzip', import.meta.url));
  const result = parseModelInput(data, 'architecting-spacecraft（MagicDraw18.5）.mdzip');
  assert.equal(result.source.productVersion, '18.5');
  assert.equal(result.statistics.elements, 4231);
  assert.equal(result.statistics.relations, 1777);
  assert.equal(result.statistics.diagrams, 181);
  assert.equal(result.statistics.views, 5881);
  assert.ok(result.elements.length > 4000);
  assert.ok(result.views.some(view => view.modelElementId && view.diagramId));
});
