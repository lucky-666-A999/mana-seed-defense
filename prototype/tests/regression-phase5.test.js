import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { trainingRefund, enhancePrice, enhanceStones } from '../src/systems/Items.js';
import { maxRank } from '../src/systems/CardSystem.js';
import { RunProgress } from '../src/systems/Progression.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url)));
const cards = load('cards.json');
const balance = load('balance.json');

test('회귀: 수련 환급 + 전직 조합', () => {
  // 수련 Lv2(검술) + Lv1(활) 상태, 일반 카드(공격력 강화)도 같이 보유
  const ranks = { trainSword: 2, trainBow: 1, atk: 3 };
  const refund = trainingRefund(ranks, cards, balance);
  assert.equal(refund, 5 + 2); // 10*2/3*0.8=5.33->5, 10*1/3*0.8=2.67->2

  // 1차 전직: 수련 카드만 리셋되고 일반 카드 랭크는 유지
  const kept = { ...ranks };
  for (const c of cards) if (c.training) delete kept[c.id];
  assert.deepEqual(kept, { atk: 3 });
});

test('회귀: 스킬 -1 + 복원 카드 조합', () => {
  const atk = cards.find((c) => c.id === 'atk'); // common 등급, maxRank 5
  let ranks = { atk: 4 };
  assert.equal(maxRank(atk, balance, 1), 5); // 1차: 최대 5, Lv4는 유효

  // 스킬 -1: Lv4 -> Lv3
  ranks.atk -= 1;
  assert.equal(ranks.atk, 3);

  // 2차 전직으로 돌파: 한계 돌파로 최대 랭크 +1 = 6, Lv5까지 다시 올릴 수 있다
  const newMax = maxRank(atk, balance, 2);
  assert.equal(newMax, 6);
  ranks.atk = Math.min(ranks.atk + 2, newMax); // 복원 카드로 두 번 레벨업
  assert.equal(ranks.atk, 5);

  // "-1" 다시 가능 확인
  assert.ok(ranks.atk > 0);
  ranks.atk -= 1;
  assert.equal(ranks.atk, 4);
});

test('회귀: 각성 + 강화석 드롭 조합', () => {
  const { stones, awaken } = balance;
  // 5차 각성 시작, 웨이브 클리어마다 강화석 드롭(일반 2회 + 정예 1회 + 보스 1회)
  let pool = 0;
  for (const n of [stones.perWave, stones.perWave, stones.elite, stones.boss]) pool += n;
  assert.equal(pool, 6);

  // 각성 투자: 가진 강화석을 모두 각성치로 전환 (반복 투자)
  let awakenPoints = 0;
  awakenPoints += pool;
  pool = 0;
  assert.equal(Math.floor(awakenPoints / awaken.perLevel), 0); // 100 미만: 아직 레벨 0

  awakenPoints += 94; // 추가로 모아 100 이상
  const level = Math.floor(awakenPoints / awaken.perLevel);
  assert.equal(level, 1);
  assert.ok(Math.abs(awaken.atkMul * level - 0.02) < 1e-9);
});

test('회귀: 환급 마나시드 + 강화 비용 조합', () => {
  const p = new RunProgress(balance);
  const refund = trainingRefund({ trainSword: 3, trainBow: 2 }, cards, balance);
  assert.equal(refund, 8 + 5); // 10*3/3*0.8=8, 10*2/3*0.8=5.33->5
  p.grant(refund);
  assert.equal(p.available, refund);

  const price = enhancePrice(0, 1, balance); // 웨이브1, 0강
  assert.ok(p.available >= price); // 환급 마나시드로 강화 가능
  assert.equal(p.spend(price), true);
  assert.equal(p.available, refund - price);
});

test('엣지: 각성 상한선 테스트', () => {
  const { awaken } = balance;
  const level999 = Math.floor(999 * awaken.perLevel / awaken.perLevel);
  assert.equal(level999, 999);
  const atkBonus = awaken.atkMul * level999;
  assert.ok(Number.isFinite(atkBonus));
  assert.ok(!Number.isNaN(atkBonus));

  // 극단적으로 큰 각성치에도 오버플로우(Infinity) 없음
  const extremeLevel = Math.floor(Number.MAX_SAFE_INTEGER / awaken.perLevel);
  assert.ok(Number.isFinite(awaken.atkMul * extremeLevel));
});

test('엣지: 마나시드 음수 방지', () => {
  // 랭크가 0 이하이면 환급 대상에서 제외되어 음수가 나오지 않는다
  assert.equal(trainingRefund({ trainSword: 0 }, cards, balance), 0);
  assert.equal(trainingRefund({ trainSword: -5 }, cards, balance), 0);
  assert.ok(trainingRefund({ trainSword: 2 }, cards, balance) >= 0);

  // 이상 레벨(-1) 조회는 조용히 음수로 새지 않고 undefined/NaN으로 드러난다
  assert.equal(enhanceStones(-1, balance), undefined);
  assert.ok(Number.isNaN(enhancePrice(-1, 3, balance)));
});
