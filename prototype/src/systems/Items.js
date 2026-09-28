// 지금 위치(직업·전직)에서 갈 수 있는 조합의 재료 중 아직 없는 것
export function itemPool(items, recipes, classId, specId, owned) {
  // 2차 전직 뒤엔 누구나 쓰는 유물
  if (specId) return items.filter((i) => i.relic && !(i.id in owned));
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

// 강화에 드는 강화석 (웨이브를 돌수록 모이는 재화)
export function enhanceStones(level, balance) {
  const s = balance.items.enhanceStones;
  return level < s.length ? s[level] : null;
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

// 강화 판정. 대성공이면 두 단계(최대치 제한), 실패 시 높은 단계에선 확률로 한 단계 하락.
export function rollEnhance(level, balance, rng = Math.random) {
  const b = balance.items;
  const max = b.enhancePrices.length;
  if (rng() < b.greatChance) return { result: 'great', level: Math.min(max, level + 2) };
  if (rng() < b.enhanceRates[level]) return { result: 'success', level: level + 1 };
  if (level + 1 >= b.dropFromLevel && level > 0 && rng() < b.dropChance) return { result: 'drop', level: level - 1 };
  return { result: 'fail', level };
}

// 2차 전직 재료 두 개 중 낮은 강화 단계로 3~5차를 판정
export function ascendTier(owned, recipe, balance) {
  const minLevel = Math.min(...recipe.items.map((id) => owned[id] ?? 0));
  let tier = 2;
  for (const [t, need] of Object.entries(balance.items.ascend)) {
    if (minLevel >= need) tier = Math.max(tier, Number(t));
  }
  return tier;
}

// 다음 차수 목표: 2차 재료 두 개가 각각 몇 강인지, 몇 강이 필요한지 (5차면 null)
export function nextAscend(owned, recipe, tier, balance) {
  const next = tier + 1;
  const need = balance.items.ascend[next];
  if (tier < 2 || !need) return null;
  return { tier: next, need, items: recipe.items.map((id) => ({ id, level: owned[id] ?? 0 })) };
}
