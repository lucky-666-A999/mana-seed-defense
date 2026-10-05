import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evolveSkill, skillPower, skillReach } from '../src/systems/SkillPower.js';

test('스킬 진화: 1차 그대로, 2차 위력 +30%, 5차 위력 2.05배·범위 1.48배', () => {
  const slam = { id: 'slam', radius: 100, damageMul: 2, cooldown: 8 };
  assert.deepEqual(evolveSkill(slam, 1), slam);
  assert.equal(skillPower(2), 1.3);
  assert.equal(skillPower(5), 2.05);
  assert.ok(Math.abs(skillReach(5) - 1.48) < 1e-9);
  const s5 = evolveSkill(slam, 5);
  assert.ok(Math.abs(s5.radius - 148) < 1e-9);
  assert.equal(s5.cooldown, 8);
});

test('스킬 진화: 타수·틱·소환 수가 차수를 따라 는다', () => {
  assert.equal(evolveSkill({ id: 'flurryDash', hits: 5 }, 3).hits, 7);
  assert.equal(evolveSkill({ id: 'arrowRain', ticks: 6, duration: 1.5 }, 4).ticks, 9);
  assert.equal(evolveSkill({ id: 'arrowRain', ticks: 6, duration: 1.5 }, 4).duration, 1.5);
  assert.equal(evolveSkill({ id: 'ghostFrenzy', summon: 2, duration: 5 }, 5).summon, 4);
});
