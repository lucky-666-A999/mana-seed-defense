import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url)));
const balance = load('balance.json');
const waves = load('waves.json');
const monsters = load('monsters.json');
const classes = load('classes.json');
const cards = load('cards.json');
const story = load('story.json');
const BEHAVIORS = ['chase', 'ranged', 'dasher', 'splitter', 'captain', 'avenger', 'boss', 'artillery'];

test('준비시간 기본값은 60초', () => {
  assert.equal(waves.prepSeconds, 60);
});

test('수동 정의 웨이브는 15개, 몬스터 id는 monsters.json에 존재', () => {
  assert.equal(waves.waves.length, 15);
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

test('몬스터 behavior는 허용 목록, 참조 id는 존재', () => {
  for (const [id, m] of Object.entries(monsters)) {
    assert.ok(BEHAVIORS.includes(m.behavior), `잘못된 behavior: ${id}`);
    if (m.splitInto) assert.ok(monsters[m.splitInto], `없는 분열체: ${id}`);
    if (m.escort) assert.ok(monsters[m.escort], `없는 부하: ${id}`);
  }
});

test('정예·보스는 대사 3회차분과 사연 조각 3개를 가진다', () => {
  for (const [id, m] of Object.entries(monsters)) {
    if (!m.elite && !m.boss) continue;
    const s = story.units[id];
    assert.ok(s, `사연 없음: ${id}`);
    assert.equal(s.spawn.length, 3);
    assert.equal(s.death.length, 3);
    assert.equal(s.fragments.length, 3);
  }
});

test('인트로는 3장', () => {
  assert.equal(story.intro.length, 3);
});

test('잠긴 카드마다 상점 해금 항목이 있다', () => {
  const shop = load('shop.json');
  for (const c of cards.filter((x) => x.locked)) {
    assert.ok(shop.some((i) => i.kind === 'card' && i.card === c.id), `상점 항목 없음: ${c.id}`);
  }
});

test('모든 직업은 공격 타입·스킬을 가진다', () => {
  for (const [id, c] of Object.entries(classes)) {
    assert.ok(['cone', 'projectile', 'blast'].includes(c.attack), `공격 타입 오류: ${id}`);
    assert.ok(c.skill && c.skill.id && c.skill.cooldown > 0, `스킬 오류: ${id}`);
  }
});


test('마나 스킬 카드는 마나 스킬 데이터와 짝', () => {
  const shop = load('shop.json');
  const specs = load('specs.json');
  const mana = load('manaSkills.json');
  const manaCards = cards.filter((c) => c.mana).map((c) => c.id).sort();
  assert.deepEqual(manaCards, Object.keys(mana).sort());
});
