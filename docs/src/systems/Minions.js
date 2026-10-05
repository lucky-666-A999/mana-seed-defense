// 네크로맨서 망령 성능: 직업 기본값 + 2차 전직(리치/사령관) + 3~5차 + 카드 보정
export function minionProfile(cls, spec, tier, stats = {}) {
  const base = cls.minions;
  const up = Math.max(0, tier - 2);
  const p = {
    max: base.max,
    chance: base.chance,
    hpMul: base.hpMul,
    atkMul: base.atkMul * (1 + 0.25 * up),
    speed: base.speed,
    size: 1,
    attackInterval: base.attackInterval,
    skeletonHp: base.skeletonHp,
    explodeOnDeath: false,
    curse: 0,
    storm: false,
  };
  if (spec?.attackMod === 'lich') {
    p.max = 3 + (tier >= 4 ? 1 : 0);
    p.hpMul *= 1.6;
    p.atkMul *= 1.6;
    p.explodeOnDeath = true;
    p.curse = 0.2;
    p.storm = tier >= 5;
  }
  if (spec?.attackMod === 'legion') {
    p.max = 8 + (tier >= 4 ? 2 : 0);
    p.chance = 0.5;
    p.hpMul *= 0.7;
    p.atkMul *= 0.8;
    p.speed = 95;
    p.size = 0.8;
    if (tier >= 5) {
      p.max = 12;
      p.chance = 1;
    }
  }
  p.chance = Math.min(1, p.chance + (stats.reviveChance || 0));
  p.hpMul *= 1 + (stats.minionHp || 0);
  p.atkMul *= 1 + (stats.minionAtk || 0);
  return p;
}
