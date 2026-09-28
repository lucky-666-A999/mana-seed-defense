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

export function critRoll(base, chance, mul, rng = Math.random) {
  return chance > 0 && rng() < chance ? { dmg: base * mul, crit: true } : { dmg: base, crit: false };
}

export function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
