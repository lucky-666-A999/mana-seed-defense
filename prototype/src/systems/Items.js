// 지금 위치(직업·전직)에서 갈 수 있는 조합의 재료 중 아직 없는 것
export function itemPool(items, recipes, classId, specId, owned) {
  if (specId) return [];
  const wanted = new Set(recipes.filter((r) => r.from === classId).flatMap((r) => r.items));
  return items.filter((i) => wanted.has(i.id) && !(i.id in owned));
}

// 짝 재료를 이미 들고 있으면 더 잘 나오게
export function itemWeight(itemId, owned, recipes, balance) {
  const partnered = recipes.some((r) => r.items.includes(itemId) && r.items.some((x) => x !== itemId && x in owned));
  return partnered ? balance.items.partnerMul : 1;
}

export function pickItem(pool, owned, recipes, balance, rng = Math.random) {
  if (pool.length === 0) return null;
  const weights = pool.map((i) => itemWeight(i.id, owned, recipes, balance));
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    if (r < weights[i]) return pool[i];
    r -= weights[i];
  }
  return pool[pool.length - 1];
}

export function matchRecipe(owned, recipes, classId, specId) {
  if (specId) return null;
  return recipes.find((r) => r.from === classId && r.items.every((id) => id in owned)) || null;
}

// owned = { itemId: 강화단계(0~3) }
export function itemStats(owned, items, balance) {
  const stats = {};
  for (const [id, lv] of Object.entries(owned)) {
    const item = items.find((i) => i.id === id);
    const { stat, add } = item.effect;
    stats[stat] = (stats[stat] || 0) + add * (1 + balance.items.enhanceMul * lv);
  }
  return stats;
}

export function enhancePrice(level, wave, balance) {
  const b = balance.items;
  return level < b.enhancePrices.length ? b.enhancePrices[level] + b.enhancePerWave * wave : null;
}

export function gachaPrice(wave, balance) {
  return balance.items.gacha.base + balance.items.gacha.perWave * wave;
}

export function tunePrice(rank, wave, balance) {
  const t = balance.items.tune;
  return t.base + t.perRank * rank + t.perWave * wave;
}

export function tuneRefund(rank, wave, balance) {
  return Math.floor(tunePrice(rank - 1, wave, balance) * balance.items.tune.refund);
}
