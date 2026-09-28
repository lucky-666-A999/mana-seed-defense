import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nodeBonus } from '../src/systems/Specs.js';
import { defaultSave } from '../src/systems/Progression.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url)));
const specs = load('specs.json');
const classes = load('classes.json');
const save = (extra) => ({ ...defaultSave(), ...extra });

test('직업마다 전직 2갈래', () => {
  for (const id of Object.keys(classes)) assert.equal(specs.filter((s) => s.classId === id).length, 2);
});

test('전직 노드 효과 합산: 해당 전직 노드만, 단계만큼', () => {
  const shop = load('shop.json');
  const s = save({ upgrades: { node_bulwark: 2, node_ward: 1, node_frenzy: 3 } });
  const g = nodeBonus(s, shop, 'guardian');
  assert.ok(Math.abs(g.mods.coreHp - 0.2) < 1e-9);
  assert.equal(g.stats.coreShield, 1);
  assert.equal(g.stats.berserkAtk, undefined);
});
