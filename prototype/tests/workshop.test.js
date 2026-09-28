import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { priceFor, canUse, recordUse } from '../src/systems/Workshop.js';
import { manaSkillParams } from '../src/systems/ManaSkills.js';
import { RunProgress } from '../src/systems/Progression.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url)));
const items = load('workshop.json');
const mana = load('manaSkills.json');
const balance = load('balance.json');
const item = (id) => items.find((i) => i.id === id);
const fresh = () => ({ prep: {}, run: {} });

test('정비 가격은 웨이브에 비례', () => {
  assert.equal(priceFor(item('repair'), 1), 10);
  assert.equal(priceFor(item('supply'), 5), 27);
});

test('정비 제한: 준비당·판당 횟수, 잔액', () => {
  let used = fresh();
  assert.equal(canUse(item('repair'), 1, 100, used), true);
  used = recordUse(recordUse(used, item('repair')), item('repair'));
  assert.equal(canUse(item('repair'), 1, 100, used), false);
  used = { ...used, prep: {} };
  assert.equal(canUse(item('repair'), 1, 100, used), true);
  assert.equal(canUse(item('repair'), 1, 9, used), false);
  let run = fresh();
  for (let i = 0; i < 3; i++) run = { ...recordUse(run, item('hone')), prep: {} };
  assert.equal(canUse(item('hone'), 1, 999, run), false);
});

test('정비에 쓴 경험치는 환수액에서 빠지고 레벨엔 영향 없음', () => {
  const p = new RunProgress(balance);
  p.addExp(30);
  assert.equal(p.spend(12), true);
  assert.equal(p.spend(99), false);
  assert.equal(p.available, 18);
  assert.equal(p.level, 3);
  assert.equal(p.totalExp, 30);
});

test('마나 스킬 수치: Lv1→Lv5 선형', () => {
  assert.equal(manaSkillParams(mana, 'meteor', 1).interval, 4);
  assert.equal(manaSkillParams(mana, 'meteor', 5).interval, 2.4);
  assert.ok(Math.abs(manaSkillParams(mana, 'meteor', 3).interval - 3.2) < 1e-9);
  assert.equal(manaSkillParams(mana, 'orbit', 3).count, 4);
  assert.equal(manaSkillParams(mana, 'meteor', 1).windup, 0.5);
});

test('스킬 되돌리기 환불은 환수 가능 마나시드로 돌아온다', () => {
  const p = new RunProgress(balance);
  p.addExp(30);
  p.spend(20);
  p.refund(8);
  assert.equal(p.available, 18);
  p.refund(999);
  assert.equal(p.available, 30);
});
