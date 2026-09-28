import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PALETTE, HERO_BASE, HERO_WALK, HATS, MON_BASE, MON_PARTS, BOSS, CORE, SPEC_MARKS, CAPE, PAULDRON, HALO, FX, compose } from '../src/art/sprites.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url)));
const known = new Set([...Object.keys(PALETTE), 'A', 'a', 'B', 'X', 'x', '.']);

function check(name, rows, width) {
  for (const [y, row] of rows.entries()) {
    assert.equal(row.length, width, `${name} ${y}줄 길이 ${row.length}`);
    for (const ch of row) assert.ok(known.has(ch), `${name} ${y}줄 모르는 색 '${ch}'`);
  }
}

test('도트: 모든 직업·몬스터 그림이 격자에 맞고 아는 색만 쓴다', () => {
  for (const id of Object.keys(load('classes.json'))) {
    assert.ok(HATS[id], `모자 없음: ${id}`);
    check(`hero ${id}`, compose(HERO_BASE, HATS[id]), 16);
    check(`hero ${id} walk`, compose(compose(HERO_BASE, HERO_WALK), HATS[id]), 16);
  }
  for (const id of Object.keys(load('monsters.json'))) {
    if (BOSS[id]) check(`boss ${id}`, BOSS[id], 24);
    else check(`mon ${id}`, compose(MON_BASE, MON_PARTS[id]), 16);
  }
  check('core', CORE, 24);
  for (const s of load('specs.json')) {
    assert.ok(SPEC_MARKS[s.id], `전직 표식 없음: ${s.id}`);
    check(`spec ${s.id}`, compose(HERO_BASE, SPEC_MARKS[s.id]), 16);
  }
  const padded = [...Array(2).fill('.'.repeat(16)), ...HERO_BASE];
  for (const [name, o] of Object.entries({ CAPE, PAULDRON, HALO })) check(name, compose(padded, o), 16);
  for (const [name, rows] of Object.entries(FX)) check(`fx ${name}`, rows, rows[0].length);
  assert.equal(CORE.length, 24);
});

test('오버레이: 점은 유지, 밑줄은 지움', () => {
  assert.deepEqual(compose(['abc'], { 0: '.x_' }), ['ax.']);
});
