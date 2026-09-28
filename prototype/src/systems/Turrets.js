// 기계학자 포탑 성능: 직업 기본값 + 2차 전직 모드(대포/드론) + 3~5차 보정
export function turretProfile(cls, spec, tier) {
  const base = cls.turret;
  const up = Math.max(0, tier - 2);
  const p = {
    max: base.max + (spec ? 1 : 0) + (tier >= 4 ? 1 : 0),
    hp: base.hp,
    range: base.range,
    interval: base.interval,
    damageMul: base.damageMul * (1 + 0.25 * up),
    shotSpeed: base.shotSpeed,
    radius: base.radius,
    mobile: false,
    explodeRadius: 0,
    explodeMul: 0,
    chain: false,
    laser: false,
  };
  if (spec?.attackMod === 'cannon') {
    p.interval = 1.6;
    p.damageMul = 1 * (1 + 0.25 * up);
    p.explodeRadius = 55 + 10 * up;
    p.explodeMul = 1.5 * (1 + 0.25 * up);
    p.chain = tier >= 5;
  }
  if (spec?.attackMod === 'drone') {
    p.mobile = true;
    p.interval = 0.4;
    p.damageMul = 0.5 * (1 + 0.25 * up);
    if (tier >= 5) {
      p.max += 2;
      p.laser = true;
    }
  }
  return p;
}
