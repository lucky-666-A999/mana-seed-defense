import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Combo, comboProfile, comboAspd, crossed } from '../src/systems/Combo.js';

const classes = JSON.parse(readFileSync(new URL('../data/classes.json', import.meta.url)));
const specs = JSON.parse(readFileSync(new URL('../data/specs.json', import.meta.url)));
const base = classes.monk.combo;
const spec = (id) => specs.find((s) => s.id === id);

test('콤보: 때리면 쌓이고, 창을 넘기면 0, 맞으면 절반', () => {
  const c = new Combo();
  for (let i = 0; i < 25; i++) c.add();
  assert.equal(c.count, 25);
  c.hurt();
  assert.equal(c.count, 12);
  c.tick(2, 2.5);
  assert.equal(c.count, 12);
  c.add();
  c.tick(2, 2.5);
  assert.equal(c.count, 13);
  c.tick(0.6, 2.5);
  assert.equal(c.count, 0);
  assert.equal(c.best, 25);
});

test('콤보 공속: 10콤보마다 +10%, 최대 +50%', () => {
  const p = comboProfile(base, null, 1);
  assert.equal(comboAspd(9, p), 0);
  assert.equal(comboAspd(10, p), 0.1);
  assert.equal(comboAspd(200, p), 0.5);
});

test('구간 넘기: 9→12는 10을 한 번, 8→31은 세 번', () => {
  assert.equal(crossed(9, 12, 10), 1);
  assert.equal(crossed(8, 31, 10), 3);
  assert.equal(crossed(8, 31, 0), 0);
});

test('전직별 콤보 성능: 기공사 장풍, 잔상권사 잔상, 카드 보정', () => {
  assert.equal(comboProfile(base, null, 1).waveEvery, 0);
  assert.equal(comboProfile(base, spec('qigong'), 2).waveEvery, 10);
  assert.equal(comboProfile(base, spec('qigong'), 4).waveEvery, 8);
  assert.equal(comboProfile(base, spec('qigong'), 5).waves, 3);
  assert.equal(comboProfile(base, spec('phantom'), 2).clones, 1);
  assert.equal(comboProfile(base, spec('phantom'), 4).clones, 2);
  assert.equal(comboProfile(base, spec('phantom'), 5).clones, 3);
  const p = comboProfile(base, null, 1, { comboWindow: 1, ironBody: 0.3, whiteHeat: 1 });
  assert.equal(p.window, 3.5);
  assert.equal(p.ironBody, 0.3);
  assert.equal(p.burstEvery, 50);
});
