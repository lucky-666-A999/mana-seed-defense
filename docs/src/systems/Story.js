const ELITE_THRESHOLDS = [1, 3, 5];
const BOSS_THRESHOLDS = [1, 2, 3];

export function lineFor(unit, kind, encounter) {
  const lines = unit[kind];
  return lines[Math.min(Math.max(encounter, 1), lines.length) - 1];
}

export function unlockedFragments(kills, isBoss, maxWaveReached = 0) {
  const count = (isBoss ? BOSS_THRESHOLDS : ELITE_THRESHOLDS).filter((t) => kills >= t).length;
  // 3번째 fragment는 Wave 10 이상 도달 필수
  if (count === 3 && maxWaveReached < 10) {
    return 2;
  }
  return count;
}
