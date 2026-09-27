export function gradeWeight(grade, level, balance) {
  const g = balance.grades[grade];
  if (!g || level < g.unlockLevel) return 0;
  return g.weight + g.weightPerLevel * (level - g.unlockLevel);
}

export function maxRank(card, balance) {
  return balance.grades[card.grade].maxRank;
}

export function availableCards(cards, classId, ranks, level, balance) {
  return cards.filter((c) =>
    c.grade !== 'fallback' &&
    (c.class === 'any' || c.class === classId) &&
    (ranks[c.id] || 0) < maxRank(c, balance) &&
    gradeWeight(c.grade, level, balance) > 0);
}

export function drawCards(cards, classId, ranks, level, balance, rng = Math.random, n = 3) {
  const pool = availableCards(cards, classId, ranks, level, balance);
  const picked = [];
  while (picked.length < n && pool.length > 0) {
    const weights = pool.map((c) => gradeWeight(c.grade, level, balance));
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
