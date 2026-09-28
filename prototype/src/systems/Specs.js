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
