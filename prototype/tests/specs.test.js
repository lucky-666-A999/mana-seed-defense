import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { specStatus, buySpec, selectSpec, specBonus } from '../src/systems/Specs.js';
import { defaultSave } from '../src/systems/Progression.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url)));
const specs = load('specs.json');
const balance = load('balance.json');
const classes = load('classes.json');
const save = (extra) => ({ ...defaultSave(), ...extra });

test('직업마다 전직 2갈래', () => {
  for (const id of Object.keys(classes)) assert.equal(specs.filter((s) => s.classId === id).length, 2);
});

test('해금 조건: 그 직업으로 10웨이브 이상 마무리', () => {
  assert.equal(specStatus(save({ retireBest: { warden: 9 } }), 'warden', balance), 'locked');
  assert.equal(specStatus(save({ retireBest: { warden: 10 } }), 'warden', balance), 'buyable');
  assert.equal(specStatus(save({ retireBest: { warden: 12 }, ownedSpecs: { warden: true } }), 'warden', balance), 'owned');
});

test('전직 구매: 마나시드 차감, 첫 갈래 자동 선택, 돈 없으면 그대로', () => {
  const s = buySpec(save({ seeds: 200, retireBest: { warden: 10 } }), 'warden', specs, balance);
  assert.equal(s.seeds, 50);
  assert.equal(s.ownedSpecs.warden, true);
  assert.equal(s.specs.warden, 'berserker');
  const poor = save({ seeds: 10, retireBest: { warden: 10 } });
  assert.equal(buySpec(poor, 'warden', specs, balance), poor);
});

test('갈래 전환은 무료, 효과 합산', () => {
  const owned = save({ ownedSpecs: { warden: true }, specs: { warden: 'berserker' } });
  const s = selectSpec(owned, 'warden', 'guardian');
  assert.equal(s.specs.warden, 'guardian');
  assert.deepEqual(specBonus(s, 'warden', specs), { stats: { coreShield: 5 }, mods: { coreHp: 0.3 }, spec: specs[1] });
  assert.deepEqual(specBonus(save(), 'warden', specs), { stats: {}, mods: {}, spec: null });
});
