import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  WaveRun, spawnDirectionCount, prepSecondsFor, formulaCount,
  waveComposition, monsterStats, spawnInterval,
} from '../src/systems/WaveSystem.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url)));
const balance = load('balance.json');
const waves = load('waves.json');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('준비시간: 기본값, 웨이브별 덮어쓰기', () => {
  const data = { prepSeconds: 60, waves: [{ monsters: [], prepSeconds: 5 }, { monsters: [] }] };
  assert.equal(prepSecondsFor(1, data), 5);
  assert.equal(prepSecondsFor(2, data), 60);
  assert.equal(prepSecondsFor(99, data), 60);
});

test('스폰 방향 수가 웨이브에 따라 늘어난다', () => {
  assert.equal(spawnDirectionCount(1, balance), 2);
  assert.equal(spawnDirectionCount(2, balance), 2);
  assert.equal(spawnDirectionCount(3, balance), 4);
  assert.equal(spawnDirectionCount(6, balance), 6);
  assert.equal(spawnDirectionCount(10, balance), 8);
  assert.equal(spawnDirectionCount(50, balance), 8);
});

test('준비 단계 → 시간이 다 되면 전투', () => {
  const run = new WaveRun(waves, balance);
  assert.equal(run.state, 'prep');
  assert.equal(run.prepLeft, 60);
  run.update(59);
  assert.equal(run.state, 'prep');
  run.update(2);
  assert.equal(run.state, 'combat');
  assert.equal(run.total, 6);
});

test('바로 시작: 다음 틱에 전투', () => {
  const run = new WaveRun(waves, balance);
  run.skipPrep();
  run.update(0.016);
  assert.equal(run.state, 'combat');
});

test('스폰은 간격마다 하나씩, 방향은 순환', () => {
  const run = new WaveRun(waves, balance);
  run.skipPrep();
  run.update(0.016);
  const first = run.update(0.016);
  assert.equal(first.length, 1);
  assert.deepEqual(first[0], { id: 'charger', dirIndex: 0, dirCount: 2 });
  assert.equal(run.update(0.5).length, 0);
  const second = run.update(spawnInterval(1, balance));
  assert.equal(second.length, 1);
  assert.equal(second[0].dirIndex, 1);
});

test('지정 몬스터 전부 처리되어야 클리어', () => {
  const run = new WaveRun(waves, balance);
  run.skipPrep();
  run.update(0.016);
  const spawns = run.update(1000);
  assert.equal(spawns.length, 6);
  for (let i = 0; i < 5; i++) run.markResolved();
  assert.equal(run.state, 'combat');
  assert.equal(run.remaining, 1);
  run.markResolved();
  assert.equal(run.state, 'cleared');
});

test('다음 웨이브: 번호 증가 + 준비 단계 초기화', () => {
  const run = new WaveRun(waves, balance);
  run.nextWave();
  assert.equal(run.wave, 2);
  assert.equal(run.state, 'prep');
  assert.equal(run.prepLeft, 60);
  assert.equal(run.resolved, 0);
});

test('1~15웨이브는 직접 설계, 16부터 자동 생성', () => {
  assert.equal(formulaCount(10, balance), 20);
  assert.deepEqual(waveComposition(3, waves, balance), [{ id: 'charger', count: 4 }, { id: 'bard', count: 1 }]);
  const w16 = waveComposition(16, waves, balance);
  const units = w16.reduce((a, m) => a + m.count, 0);
  assert.equal(units, formulaCount(16, balance));
});

test('큐는 종류를 번갈아 섞는다', () => {
  const run = new WaveRun(waves, balance);
  for (let i = 0; i < 2; i++) run.nextWave();
  run.skipPrep();
  run.update(0.016);
  assert.deepEqual(run.queue, ['charger', 'bard', 'charger', 'charger', 'charger']);
});

test('addExtra: 전투 중 생긴 개체도 처리해야 클리어', () => {
  const run = new WaveRun(waves, balance);
  run.skipPrep();
  run.update(0.016);
  run.update(1000);
  run.addExtra(2);
  for (let i = 0; i < 6; i++) run.markResolved();
  assert.equal(run.state, 'combat');
  run.markResolved();
  run.markResolved();
  assert.equal(run.state, 'cleared');
});

test('몬스터 스탯 스케일', () => {
  const def = { hp: 20, atk: 8 };
  const w1 = monsterStats(def, 1, balance);
  near(w1.hp, 20);
  near(w1.atk, 8);
  const w6 = monsterStats(def, 6, balance);
  near(w6.hp, 20 * 1.9);
  near(w6.atk, 8 * 1.6);
});

test('스폰 간격은 줄어들되 최소값 유지', () => {
  near(spawnInterval(1, balance), 1.9);
  near(spawnInterval(20, balance), 0.4);
});
