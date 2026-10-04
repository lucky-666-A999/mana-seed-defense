export function gradeWeight(grade, level, balance) {
  const g = balance.grades[grade];
  if (!g || level < g.unlockLevel) return 0;
  return g.weight + g.weightPerLevel * (level - g.unlockLevel);
}

// 한계 돌파: 전직 차수마다 스킬 최대 레벨 +1 (2차 +1 … 5차 +4). 전설은 5차에 +1. 수련·대체 카드는 그대로.
export function maxRank(card, balance, tier = 0) {
  const base = card.maxRank ?? balance.grades[card.grade].maxRank;
  if (card.training || card.grade === 'fallback') return base;
  if (card.grade === 'legend') return base + (tier >= 5 ? 1 : 0);
  return base + Math.max(0, tier - 1);
}

export function cardWeight(card, level, balance) {
  return gradeWeight(card.grade, level, balance) * (card.weightMul || 1);
}

export function availableCards(cards, classId, ranks, level, balance, tier = 0) {
  return cards.filter((c) =>
    c.grade !== 'fallback' &&
    !c.locked &&
    (c.class === 'any' || c.class === classId) &&
    (ranks[c.id] || 0) < maxRank(c, balance, tier) &&
    gradeWeight(c.grade, level, balance) > 0);
}

export function drawCards(cards, classId, ranks, level, balance, rng = Math.random, n = 3, tier = 0) {
  const pool = availableCards(cards, classId, ranks, level, balance, tier);
  const picked = [];
  while (picked.length < n && pool.length > 0) {
    const weights = pool.map((c) => cardWeight(c, level, balance));
    let r = rng() * weights.reduce((a, b) => a + b, 0);
    let i = 0;
    while (i < pool.length - 1 && r >= weights[i]) {
      r -= weights[i];
      i++;
    }
    picked.push(pool.splice(i, 1)[0]);
  }
  for (const fallback of cards.filter((c) => c.grade === 'fallback')) {
    if (picked.length >= n) break;
    picked.push(fallback);
  }
  return picked;
}

export function applyCards(baseStats, ranks, cards) {
  const stats = { ...baseStats };
  for (const c of cards) {
    const rank = ranks[c.id] || 0;
    if (rank && c.effect) stats[c.effect.stat] = (stats[c.effect.stat] || 0) + c.effect.add * rank;
  }
  return stats;
}
