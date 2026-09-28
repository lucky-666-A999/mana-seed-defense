// 전직 성장 트리 노드 효과 합산 (effect.stat → 스탯, effect.mod → 런 보정)
export function nodeBonus(save, shop, specId) {
  const stats = {};
  const mods = {};
  for (const item of shop) {
    if (item.kind !== 'specNode' || item.specId !== specId) continue;
    const lv = save.upgrades[item.id] || 0;
    if (!lv) continue;
    const { stat, mod, add } = item.effect;
    if (stat) stats[stat] = (stats[stat] || 0) + add * lv;
    if (mod) mods[mod] = (mods[mod] || 0) + add * lv;
  }
  return { stats, mods };
}
