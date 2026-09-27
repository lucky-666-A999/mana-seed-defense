import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url)));
const balance = load('balance.json');
const waves = load('waves.json');
const monsters = load('monsters.json');
const classes = load('classes.json');
const cards = load('cards.json');

test('준비시간 기본값은 60초', () => {
  assert.equal(waves.prepSeconds, 60);
});

test('수동 정의 웨이브는 10개, 몬스터 id는 monsters.json에 존재', () => {
  assert.equal(waves.waves.length, 10);
  for (const w of waves.waves) {
    for (const m of w.monsters) {
      assert.ok(monsters[m.id], `없는 몬스터 id: ${m.id}`);
      assert.ok(m.count > 0);
    }
  }
});

test('카드 등급은 balance.grades 또는 fallback', () => {
  for (const c of cards) {
    assert.ok(c.grade === 'fallback' || balance.grades[c.grade], `잘못된 등급: ${c.id}`);
  }
});

test('카드는 effect 또는 instant 중 정확히 하나', () => {
  for (const c of cards) {
    assert.ok(Boolean(c.effect) !== Boolean(c.instant), `effect/instant 오류: ${c.id}`);
  }
});

test('카드 class는 any 또는 존재하는 직업', () => {
  for (const c of cards) {
    assert.ok(c.class === 'any' || classes[c.class], `없는 직업: ${c.id}`);
  }
});

test('카드 id 중복 없음, 대체 카드 2장', () => {
  assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
  assert.equal(cards.filter((c) => c.grade === 'fallback').length, 2);
});

test('워든 직업 존재', () => {
  assert.ok(classes.warden);
});
