import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  captainShare, bardAtkMul, addRage, bossPatternInterval, stealRank, returnStolen, critRoll, segmentDistance, cappedShare,
} from '../src/systems/Combat.js';
import { lineFor, unlockedFragments } from '../src/systems/Story.js';

const story = JSON.parse(readFileSync(new URL('../data/story.json', import.meta.url)));

test('대장 헌신: 부하 피해의 절반을 대장이 대신 받음', () => {
  assert.deepEqual(captainShare(20, 0.5), { toEscort: 10, toCaptain: 10 });
});

test('대장 결속: 부하 수만큼 공격력 증가', () => {
  assert.ok(Math.abs(bardAtkMul(6, 0.12) - 1.72) < 1e-9);
  assert.equal(bardAtkMul(0, 0.12), 1);
});

test('세라 분노는 최대치에서 멈춤', () => {
  assert.ok(Math.abs(addRage(0, 0.08, 0.8) - 0.08) < 1e-9);
  assert.equal(addRage(0.78, 0.08, 0.8), 0.8);
});

test('보스 광폭화: 체력 절반 이하에서 패턴 주기 단축', () => {
  assert.equal(bossPatternInterval(3.5, 0.6, 0.5, 1.5), 3.5);
  assert.ok(Math.abs(bossPatternInterval(3.5, 0.5, 0.5, 1.5) - 3.5 / 1.5) < 1e-9);
});

test('기억 강탈: 가진 카드 중 하나를 1단계 뺏고, 반환하면 원상복구', () => {
  const ranks = { atk: 2, move: 1 };
  const { ranks: after, stolenId } = stealRank(ranks, () => 0.99);
  assert.equal(stolenId, 'move');
  assert.deepEqual(after, { atk: 2 });
  assert.deepEqual(ranks, { atk: 2, move: 1 });
  assert.deepEqual(returnStolen(after, ['move']), { atk: 2, move: 1 });
});

test('기억 강탈: 카드가 없으면 아무것도 안 뺏음', () => {
  assert.deepEqual(stealRank({}, () => 0), { ranks: {}, stolenId: null });
});

test('회차별 대사: 3회차 이후는 마지막 대사 반복', () => {
  const bard = story.units.bard;
  assert.equal(lineFor(bard, 'spawn', 1), bard.spawn[0]);
  assert.equal(lineFor(bard, 'death', 2), bard.death[1]);
  assert.equal(lineFor(bard, 'spawn', 9), bard.spawn[2]);
});

test('사연 조각 해금: 정예 1/3/5, 보스 1/2/3 처치', () => {
  assert.equal(unlockedFragments(0, false), 0);
  assert.equal(unlockedFragments(1, false), 1);
  assert.equal(unlockedFragments(4, false), 2);
  assert.equal(unlockedFragments(5, false), 3);
  assert.equal(unlockedFragments(2, true), 2);
});

test('치명타: 확률 안이면 배율 적용', () => {
  assert.deepEqual(critRoll(10, 0.15, 2, () => 0.1), { dmg: 20, crit: true });
  assert.deepEqual(critRoll(10, 0.15, 2, () => 0.5), { dmg: 10, crit: false });
  assert.deepEqual(critRoll(10, 0, 2, () => 0), { dmg: 10, crit: false });
});

test('점과 선분 거리 (질풍 베기 판정)', () => {
  assert.equal(segmentDistance(5, 5, 0, 0, 10, 0), 5);
  assert.equal(segmentDistance(15, 0, 0, 0, 10, 0), 5);
});

test('대장 헌신 상한: 공격 한 번에 대장이 대신 받는 피해는 최대 1대분', () => {
  // 부하 6마리가 36씩 맞는 광역기: 대장 몫 18 × 6 = 108 이지만 상한 36
  let taken = 0;
  let toCaptainTotal = 0;
  for (let i = 0; i < 6; i++) {
    const r = cappedShare(36, 0.5, taken, 36);
    taken += r.toCaptain;
    toCaptainTotal += r.toCaptain;
    assert.equal(r.toEscort, 18);
  }
  assert.equal(toCaptainTotal, 36);
});
