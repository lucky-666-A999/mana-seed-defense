import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gradeWeight, availableCards, drawCards, applyCards } from '../src/systems/CardSystem.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url)));
const balance = load('balance.json');
const cards = load('cards.json');
const ids = (list) => list.map((c) => c.id);

function seeded(seed) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

test('등급 가중치: 해금 전 0, 해금 후 레벨 따라 증가', () => {
  assert.equal(gradeWeight('rare', 4, balance), 0);
  assert.equal(gradeWeight('rare', 5, balance), 25);
  assert.equal(gradeWeight('rare', 9, balance), 29);
  assert.equal(gradeWeight('common', 1, balance), 60);
  assert.equal(gradeWeight('legend', 14, balance), 0);
});

test('Lv4에서는 일반 카드만 등장', () => {
  const pool = availableCards(cards, 'warden', {}, 4, balance);
  assert.deepEqual(ids(pool), ['atk', 'aspd', 'move', 'magnet', 'maxhp']);
});

test('Lv5부터 희귀, 직업 전용 카드는 해당 직업만', () => {
  assert.deepEqual(ids(availableCards(cards, 'warden', {}, 5, balance)),
    ['atk', 'aspd', 'move', 'magnet', 'maxhp', 'wide', 'shock']);
  assert.deepEqual(ids(availableCards(cards, 'swordsman', {}, 5, balance)),
    ['atk', 'aspd', 'move', 'magnet', 'maxhp', 'critHone']);
  assert.equal(availableCards(cards, 'warden', {}, 15, balance).length, 9);
});

test('최대 단계 도달 카드는 풀에서 제외', () => {
  assert.ok(!ids(availableCards(cards, 'warden', { atk: 5 }, 1, balance)).includes('atk'));
  assert.ok(ids(availableCards(cards, 'warden', { atk: 4 }, 1, balance)).includes('atk'));
  assert.ok(!ids(availableCards(cards, 'warden', { quake: 1 }, 15, balance)).includes('quake'));
});

test('3장 추첨: 항상 3장, 중복 없음', () => {
  const rng = seeded(42);
  for (let i = 0; i < 200; i++) {
    const hand = drawCards(cards, 'warden', {}, 15, balance, rng);
    assert.equal(hand.length, 3);
    assert.equal(new Set(ids(hand)).size, 3);
  }
});

test('추첨은 가중치 누적 순서를 따른다', () => {
  assert.deepEqual(ids(drawCards(cards, 'warden', {}, 1, balance, () => 0)), ['atk', 'aspd', 'move']);
  assert.deepEqual(ids(drawCards(cards, 'warden', {}, 1, balance, () => 0.999999)), ['maxhp', 'magnet', 'move']);
});

test('뽑을 카드가 모자라면 대체 카드로 채움', () => {
  const ranks = { aspd: 5, move: 5, magnet: 5, maxhp: 5 };
  assert.deepEqual(ids(drawCards(cards, 'warden', ranks, 1, balance, () => 0)), ['atk', 'heal', 'repair']);
});

test('스탯 합산: rank만큼 누적, 대체 카드는 무시', () => {
  const base = { atkMul: 1, arcDeg: 100, shock: 0 };
  const stats = applyCards(base, { atk: 2, wide: 1, heal: 3 }, cards);
  assert.ok(Math.abs(stats.atkMul - 1.3) < 1e-9);
  assert.equal(stats.arcDeg, 120);
  assert.equal(stats.shock, 0);
  assert.equal(base.atkMul, 1);
});
