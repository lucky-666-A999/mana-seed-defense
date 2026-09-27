import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SAVE_KEY, expToNext, RunProgress, settleRun, loadSave, saveRunResult,
} from '../src/systems/Progression.js';

const balance = JSON.parse(readFileSync(new URL('../data/balance.json', import.meta.url)));

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

test('레벨 곡선', () => {
  assert.equal(expToNext(1, balance), 10);
  assert.equal(expToNext(3, balance), 22);
});

test('경험치 누적 → 레벨업 대기열', () => {
  const p = new RunProgress(balance);
  assert.equal(p.addExp(9), 0);
  assert.equal(p.level, 1);
  assert.equal(p.addExp(1), 1);
  assert.equal(p.level, 2);
  assert.equal(p.exp, 0);
  assert.equal(p.pendingLevelups, 1);
});

test('한 번에 여러 레벨, 누적 경험치는 레벨업에 쓴 것 포함', () => {
  const p = new RunProgress(balance);
  assert.equal(p.addExp(31), 2);
  assert.equal(p.level, 3);
  assert.equal(p.exp, 5);
  assert.equal(p.totalExp, 31);
  assert.equal(p.takeLevelup(), true);
  assert.equal(p.takeLevelup(), true);
  assert.equal(p.takeLevelup(), false);
});

test('환수: 마무리만 100%, 사망/코어파괴는 0', () => {
  assert.equal(settleRun('retire', 31, balance), 31);
  assert.equal(settleRun('dead', 31, balance), 0);
  assert.equal(settleRun('coreLost', 31, balance), 0);
});

test('저장: 마나시드 누적, 최고 웨이브 유지', () => {
  const storage = memoryStorage();
  assert.deepEqual(loadSave(storage), { seeds: 0, bestWave: 0 });
  saveRunResult(storage, { seeds: 30, wave: 5 });
  const save = saveRunResult(storage, { seeds: 0, wave: 3 });
  assert.deepEqual(save, { seeds: 30, bestWave: 5 });
  assert.deepEqual(JSON.parse(storage.getItem(SAVE_KEY)), { seeds: 30, bestWave: 5 });
});

test('손상된 저장 데이터는 초기값으로', () => {
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, '{broken');
  assert.deepEqual(loadSave(storage), { seeds: 0, bestWave: 0 });
});
