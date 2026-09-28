import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  itemPool, itemWeight, pickItem, matchRecipe, itemStats, enhancePrice, gachaPrice, tunePrice, tuneRefund,
} from '../src/systems/Items.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url)));
const items = load('items.json');
const recipes = load('recipes.json');
const balance = load('balance.json');
const specs = load('specs.json');
const classes = load('classes.json');
const ids = (list) => list.map((i) => i.id).sort();

test('데이터: 조합 재료는 존재하는 아이템, 결과는 존재하는 직업/전직, 아이템은 한 조합에만', () => {
  const used = new Set();
  for (const r of recipes) {
    for (const id of r.items) {
      assert.ok(items.some((i) => i.id === id), id);
      assert.ok(!used.has(id), `중복 재료 ${id}`);
      used.add(id);
    }
    if (r.result.type === 'class') assert.ok(classes[r.result.id]);
    else assert.ok(specs.some((s) => s.id === r.result.id));
  }
  assert.equal(used.size, items.length);
});

test('아이템 풀: 워든은 1차 재료 6 + 워든 2차 재료 4, 궁수는 궁수 재료 4, 2차 후엔 없음', () => {
  assert.equal(itemPool(items, recipes, 'warden', null, {}).length, 10);
  assert.deepEqual(ids(itemPool(items, recipes, 'archer', null, {})), ['goldArrow', 'huntHorn', 'scope', 'trap']);
  assert.equal(itemPool(items, recipes, 'archer', 'sniper', {}).length, 0);
  assert.equal(itemPool(items, recipes, 'warden', null, { bow: 0 }).length, 9);
});

test('짝 아이템을 가지고 있으면 가중치 ×3', () => {
  assert.equal(itemWeight('quiver', {}, recipes, balance), 1);
  assert.equal(itemWeight('quiver', { bow: 0 }, recipes, balance), 3);
});

test('가중치 추첨', () => {
  const pool = itemPool(items, recipes, 'warden', null, { bow: 0 });
  assert.equal(pickItem(pool, { bow: 0 }, recipes, balance, () => 0).id, pool[0].id);
  assert.equal(pickItem([], {}, recipes, balance, () => 0), null);
});

test('조합 판정: 현재 직업에서 출발하는 조합만, 재료가 모두 있으면', () => {
  assert.equal(matchRecipe({ bow: 0 }, recipes, 'warden', null), null);
  assert.equal(matchRecipe({ bow: 0, quiver: 1 }, recipes, 'warden', null).id, 'archer');
  assert.equal(matchRecipe({ scope: 0, goldArrow: 0 }, recipes, 'warden', null), null);
  assert.equal(matchRecipe({ scope: 0, goldArrow: 0 }, recipes, 'archer', null).id, 'sniper');
  assert.equal(matchRecipe({ scope: 0, goldArrow: 0 }, recipes, 'archer', 'sniper'), null);
});

test('아이템 스탯: 강화 단계마다 효과 ×(1 + 0.5×단계)', () => {
  const st = itemStats({ bow: 0, quiver: 2 }, items, balance);
  assert.ok(Math.abs(st.rangeMul - 0.1) < 1e-9);
  assert.ok(Math.abs(st.aspdMul - 0.1) < 1e-9);
});

test('거점 가격', () => {
  assert.equal(enhancePrice(0, 3, balance), 18);
  assert.equal(enhancePrice(2, 3, balance), 46);
  assert.equal(enhancePrice(3, 3, balance), null);
  assert.equal(gachaPrice(4, balance), 27);
  assert.equal(tunePrice(0, 2, balance), 12);
  assert.equal(tunePrice(2, 2, balance), 24);
  assert.equal(tuneRefund(3, 2, balance), 12);
});
