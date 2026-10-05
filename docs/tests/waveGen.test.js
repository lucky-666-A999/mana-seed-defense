import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateWave, waveSpecials } from '../src/systems/WaveGen.js';
import { formulaCount } from '../src/systems/WaveSystem.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url)));
const balance = load('balance.json');
const monsters = load('monsters.json');
const ids = (comp) => comp.map((m) => m.id);
const count = (comp, id) => (comp.find((m) => m.id === id) || { count: 0 }).count;

test('일반 몬스터 총량은 공식과 같고 비율대로 나뉜다', () => {
  const comp = generateWave(16, balance);
  const regular = comp.filter((m) => !monsters[m.id].elite && !monsters[m.id].boss);
  assert.equal(regular.reduce((a, m) => a + m.count, 0), formulaCount(16, balance));
  assert.ok(count(comp, 'charger') >= count(comp, 'ranged'));
});

test('5의 배수는 보스, 3의 배수는 정예, 겹치면 보스만', () => {
  assert.equal(count(generateWave(25, balance), 'leprechaun'), 1);
  assert.equal(count(generateWave(18, balance), 'bard'), 1);
  assert.equal(count(generateWave(21, balance), 'sera'), 1);
  const w30 = generateWave(30, balance);
  assert.equal(count(w30, 'leprechaun'), 1);
  assert.equal(ids(w30).filter((id) => monsters[id].elite).length, 1);
  const w45 = generateWave(45, balance);
  assert.equal(count(w45, 'leprechaun'), 1);
  assert.equal(ids(w45).filter((id) => monsters[id].elite).length, 0);
  const w16 = generateWave(16, balance);
  assert.equal(ids(w16).filter((id) => monsters[id].elite || monsters[id].boss).length, 0);
});

test('웨이브 특수 개체 목록', () => {
  const comp = [{ id: 'charger', count: 3 }, { id: 'bard', count: 1 }, { id: 'leprechaun', count: 1 }];
  assert.deepEqual(waveSpecials(comp, monsters), { elites: ['bard'], boss: 'leprechaun' });
  assert.deepEqual(waveSpecials([{ id: 'charger', count: 3 }], monsters), { elites: [], boss: null });
});
