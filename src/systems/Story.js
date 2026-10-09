const ELITE_THRESHOLDS = [1, 3, 5];
const BOSS_THRESHOLDS = [1, 2, 3];

export function lineFor(unit, kind, encounter) {
  const lines = unit[kind];
  return lines[Math.min(Math.max(encounter, 1), lines.length) - 1];
}

export function unlockedFragments(kills, isBoss) {
  return (isBoss ? BOSS_THRESHOLDS : ELITE_THRESHOLDS).filter((t) => kills >= t).length;
}
