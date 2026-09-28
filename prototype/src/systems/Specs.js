export function specStatus(save, classId, balance) {
  if (save.ownedSpecs[classId]) return 'owned';
  return (save.retireBest[classId] || 0) >= balance.specUnlock.wave ? 'buyable' : 'locked';
}

export function buySpec(save, classId, specs, balance) {
  const price = balance.specUnlock.price;
  if (specStatus(save, classId, balance) !== 'buyable' || save.seeds < price) return save;
  const first = specs.find((s) => s.classId === classId);
  return {
    ...save,
    seeds: save.seeds - price,
    ownedSpecs: { ...save.ownedSpecs, [classId]: true },
    specs: { ...save.specs, [classId]: first.id },
  };
}

export function selectSpec(save, classId, specId) {
  if (!save.ownedSpecs[classId]) return save;
  return { ...save, specs: { ...save.specs, [classId]: specId } };
}

export function specBonus(save, classId, specs) {
  const spec = save.ownedSpecs[classId] ? specs.find((s) => s.id === save.specs[classId]) : null;
  return { stats: spec?.stats || {}, mods: spec?.mods || {}, spec: spec || null };
}

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
