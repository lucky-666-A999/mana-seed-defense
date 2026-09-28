import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SAVE_KEY, expToNext, RunProgress, settleRun, loadSave, saveRunResult, recordEncounter, recordKill, defaultSave, recordDiscovery,
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

test('환수: 마무리만 100%(수확 보너스 반영), 사망/코어파괴는 0', () => {
  assert.equal(settleRun('retire', 31, balance), 31);
  assert.equal(settleRun('retire', 30, balance, 0.2), 36);
  assert.equal(settleRun('dead', 31, balance), 0);
  assert.equal(settleRun('coreLost', 31, balance), 0);
});

test('저장: 마나시드 누적, 최고 웨이브 유지', () => {
  const storage = memoryStorage();
  assert.deepEqual(loadSave(storage), defaultSave());
  saveRunResult(storage, { seeds: 30, wave: 5, outcome: 'retire', classId: 'warden' });
  const save = saveRunResult(storage, { seeds: 0, wave: 3, outcome: 'dead', classId: 'warden' });
  assert.equal(save.seeds, 30);
  assert.equal(save.bestWave, 5);
  assert.equal(save.retireBest.warden, 5);
  assert.equal(JSON.parse(storage.getItem(SAVE_KEY)).seeds, 30);
});

test('손상된 저장 데이터는 초기값으로', () => {
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, '{broken');
  assert.deepEqual(loadSave(storage), defaultSave());
});

test('옛 저장(Phase 1 형식)도 새 기본값과 병합된다', () => {
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({ seeds: 28, bestWave: 2 }));
  const save = loadSave(storage);
  assert.equal(save.seeds, 28);
  assert.deepEqual(save.classes, ['warden']);
  assert.deepEqual(save.upgrades, {});
});

test('만난 횟수·처치 수는 저장에 누적된다', () => {
  const storage = memoryStorage();
  assert.equal(recordEncounter(storage, 'bard'), 1);
  assert.equal(recordEncounter(storage, 'bard'), 2);
  recordKill(storage, 'bard');
  const save = loadSave(storage);
  assert.equal(save.encounters.bard, 2);
  assert.equal(save.kills.bard, 1);
  saveRunResult(storage, { seeds: 5, wave: 2 });
  assert.equal(loadSave(storage).encounters.bard, 2);
});

test('전직 조합 발견: 처음만 first', () => {
  const storage = memoryStorage();
  assert.equal(recordDiscovery(storage, 'archer'), true);
  assert.equal(recordDiscovery(storage, 'archer'), false);
  assert.equal(loadSave(storage).discovered.archer, true);
});
