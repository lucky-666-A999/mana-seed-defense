import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url)));
const specs = load('specs.json');
const classes = load('classes.json');

test('기본 직업이 아닌 직업마다 2차 전직 2갈래, 3~5차 이름', () => {
  for (const [id, c] of Object.entries(classes)) {
    if (!c.base) assert.equal(specs.filter((s) => s.classId === id).length, 2, id);
  }
  for (const s of specs) assert.deepEqual(s.ascend.map((a) => a.tier), [3, 4, 5]);
});
