import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { priceOf, canBuy, buy, runModifiers, cardPool } from '../src/systems/Shop.js';
import { defaultSave } from '../src/systems/Progression.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url)));
const shop = load('shop.json');
const cards = load('cards.json');
const item = (id) => shop.find((i) => i.id === id);
const withSeeds = (seeds, extra = {}) => ({ ...defaultSave(), seeds, ...extra });

test('가격은 단계별, 최대면 null', () => {
  assert.equal(priceOf(item('vitality'), withSeeds(0)), 15);
  assert.equal(priceOf(item('vitality'), withSeeds(0, { upgrades: { vitality: 2 } })), 60);
  assert.equal(priceOf(item('vitality'), withSeeds(0, { upgrades: { vitality: 5 } })), null);
});

test('구매: 마나시드 차감 + 단계 증가, 원본 불변', () => {
  const save = withSeeds(40);
  assert.equal(canBuy(item('vitality'), save), true);
  const after = buy(save, item('vitality'));
  assert.equal(after.seeds, 25);
  assert.equal(after.upgrades.vitality, 1);
  assert.equal(save.seeds, 40);
  assert.equal(canBuy(item('harvest'), withSeeds(59)), false);
});

test('효과 합산', () => {
  const mods = runModifiers(withSeeds(0, { upgrades: { vitality: 3, harvest: 2, gift: 1 } }), shop);
  assert.ok(Math.abs(mods.hp - 0.3) < 1e-9);
  assert.ok(Math.abs(mods.harvest - 0.2) < 1e-9);
  assert.equal(mods.freeCard, 1);
  assert.equal(mods.atk, 0);
});

test('잠긴 카드는 상점에서 사야 카드풀에 들어온다', () => {
  const base = cardPool(cards, withSeeds(0), shop).map((c) => c.id);
  assert.ok(!base.includes('lifesteal'));
  const unlocked = cardPool(cards, withSeeds(0, { upgrades: { cardLifesteal: 1 } }), shop).map((c) => c.id);
  assert.ok(unlocked.includes('lifesteal'));
  assert.ok(!unlocked.includes('thorns'));
});
