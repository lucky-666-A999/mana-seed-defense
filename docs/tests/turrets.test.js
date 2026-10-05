import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { turretProfile } from '../src/systems/Turrets.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url)));
const classes = load('classes.json');
const specs = load('specs.json');
const mech = classes.mechanist;
const spec = (id) => specs.find((s) => s.id === id);

test('기본 포탑: 최대 2, 0.8초, 0.8배', () => {
  const p = turretProfile(mech, null, 1);
  assert.equal(p.max, 2);
  assert.equal(p.interval, 0.8);
  assert.equal(p.damageMul, 0.8);
  assert.equal(p.mobile, false);
});

test('포병: 느린 대포 + 착탄 폭발, 2차 +1개, 4차 +1개, 5차 연쇄', () => {
  const p2 = turretProfile(mech, spec('artillerist'), 2);
  assert.equal(p2.max, 3);
  assert.equal(p2.interval, 1.6);
  assert.equal(p2.explodeRadius, 55);
  assert.equal(p2.explodeMul, 1.5);
  assert.equal(turretProfile(mech, spec('artillerist'), 4).max, 4);
  assert.equal(turretProfile(mech, spec('artillerist'), 5).chain, true);
  assert.ok(turretProfile(mech, spec('artillerist'), 3).explodeRadius > 55);
});

test('드론: 따라다님, 빠르고 약함, 5차 +2·레이저', () => {
  const d2 = turretProfile(mech, spec('dronemaster'), 2);
  assert.equal(d2.mobile, true);
  assert.equal(d2.interval, 0.4);
  assert.equal(d2.damageMul, 0.5);
  const d5 = turretProfile(mech, spec('dronemaster'), 5);
  assert.equal(d5.max, 6);
  assert.equal(d5.laser, true);
});

test('포탑 카드 스탯: 체력·공속·피해 보정', () => {
  const p = turretProfile(mech, null, 1, { turretHp: 0.5, turretAspd: 0.25, turretDmg: 0.5 });
  assert.equal(p.hp, 90);
  assert.ok(Math.abs(p.interval - 0.8 / 1.25) < 1e-9);
  assert.ok(Math.abs(p.damageMul - 1.2) < 1e-9);
});
