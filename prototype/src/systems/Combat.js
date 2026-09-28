export function captainShare(damage, shareRatio) {
  return { toEscort: damage * (1 - shareRatio), toCaptain: damage * shareRatio };
}

export function bardAtkMul(escortsAlive, perEscort) {
  return 1 + escortsAlive * perEscort;
}

export function addRage(rage, perKill, max) {
  return Math.min(max, rage + perKill);
}

export function bossPatternInterval(base, hpRatio, enrageRatio, speedup) {
  return hpRatio <= enrageRatio ? base / speedup : base;
}

export function stealRank(ranks, rng = Math.random) {
  const owned = Object.keys(ranks).filter((id) => ranks[id] > 0);
  if (owned.length === 0) return { ranks: { ...ranks }, stolenId: null };
  const stolenId = owned[Math.min(owned.length - 1, Math.floor(rng() * owned.length))];
  const next = { ...ranks, [stolenId]: ranks[stolenId] - 1 };
  if (next[stolenId] === 0) delete next[stolenId];
  return { ranks: next, stolenId };
}

export function returnStolen(ranks, stolenIds) {
  const next = { ...ranks };
  for (const id of stolenIds) next[id] = (next[id] || 0) + 1;
  return next;
}
