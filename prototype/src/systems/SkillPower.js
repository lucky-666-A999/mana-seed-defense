// 전직 차수에 따른 스킬 진화: 2차에 위력 +30%, 3차부터 차수마다 +25%. 범위·거리는 1차 이후 차수마다 +12%.
// 지속·타수·소환 수도 차수를 따라 는다. (쿨다운은 그대로 — 더 세고 넓게)
export function skillPower(tier) {
  return 1 + (tier >= 2 ? 0.3 : 0) + 0.25 * Math.max(0, tier - 2);
}

export function skillReach(tier) {
  return 1 + 0.12 * Math.max(0, tier - 1);
}

export function evolveSkill(skill, tier) {
  const up = Math.max(0, tier - 1);
  const out = { ...skill };
  if (out.damageMul) out.damageMul *= skillPower(tier);
  for (const k of ['radius', 'distance', 'width']) if (out[k]) out[k] *= skillReach(tier);
  if (out.ticks) out.ticks += up;
  if (out.hits) out.hits += up;
  if (out.summon) out.summon += Math.floor(up / 2);
  if (out.id === 'ghostFrenzy') out.duration *= 1 + 0.1 * up;
  return out;
}
