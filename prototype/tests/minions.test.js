import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { minionProfile } from '../src/systems/Minions.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url)));
const necro = load('classes.json').necromancer;
const specs = load('specs.json');
const spec = (id) => specs.find((s) => s.id === id);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('기본 망령: 최대 4, 부활 25%, 체력·공격 0.5배', () => {
  const p = minionProfile(necro, null, 1);
  assert.equal(p.max, 4);
  near(p.chance, 0.25);
  near(p.hpMul, 0.5);
  near(p.atkMul, 0.5);
  assert.equal(p.explodeOnDeath, false);
});

test('리치: 최대 3, 강하고 시체 폭발·저주, 4차 +1, 5차 원혼 폭풍', () => {
  const p = minionProfile(necro, spec('lich'), 2);
  assert.equal(p.max, 3);
  assert.equal(p.explodeOnDeath, true);
  near(p.curse, 0.2);
  assert.ok(p.atkMul > 0.5);
  assert.equal(minionProfile(necro, spec('lich'), 4).max, 4);
  assert.equal(minionProfile(necro, spec('lich'), 5).storm, true);
});

test('사령관: 최대 8, 부활 50%, 4차 +2, 5차 최대 12·부활 100%', () => {
  const p = minionProfile(necro, spec('commander'), 2);
  assert.equal(p.max, 8);
  near(p.chance, 0.5);
  assert.equal(minionProfile(necro, spec('commander'), 4).max, 10);
  const p5 = minionProfile(necro, spec('commander'), 5);
  assert.equal(p5.max, 12);
  near(p5.chance, 1);
});

test('카드 보정: 부활 확률·망령 체력·공격', () => {
  const p = minionProfile(necro, null, 1, { reviveChance: 0.15, minionHp: 0.5, minionAtk: 1 });
  near(p.chance, 0.4);
  near(p.hpMul, 0.75);
  near(p.atkMul, 1);
});
