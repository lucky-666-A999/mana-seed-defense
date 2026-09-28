// 무투가 콤보: 때릴수록 쌓이고, 쉬면 0, 맞으면 절반. 쌓인 콤보가 공속과 전직 기술을 부른다.
export const IRON_BODY_AT = 20;
export const WHITE_HEAT_EVERY = 50;

export function comboProfile(base, spec, tier, stats = {}) {
  const mod = spec?.attackMod;
  return {
    window: base.window + (stats.comboWindow || 0),
    step: base.step,
    aspdPer: base.aspdPer,
    aspdMax: base.aspdMax,
    // 기공사: n콤보마다 장풍
    waveEvery: mod === 'qigong' ? (tier >= 4 ? 8 : 10) : 0,
    waves: mod === 'qigong' && tier >= 5 ? 3 : 1,
    // 잔상권사: 돌진 때 남는 잔상 수
    clones: mod === 'afterimage' ? (tier >= 5 ? 3 : tier >= 4 ? 2 : 1) : 0,
    ironBody: stats.ironBody || 0,
    burstEvery: stats.whiteHeat ? WHITE_HEAT_EVERY : 0,
  };
}

// 콤보 공속 보너스 (step마다 aspdPer, 최대 aspdMax)
export function comboAspd(count, p) {
  return Math.min(p.aspdMax, Math.floor(count / p.step) * p.aspdPer);
}

// before→after 사이에 every의 배수를 몇 번 넘었나
export function crossed(before, after, every) {
  return every ? Math.floor(after / every) - Math.floor(before / every) : 0;
}

export class Combo {
  constructor() {
    this.count = 0;
    this.idle = 0;
    this.best = 0;
  }

  // 반환값: 더하기 전 콤보 (넘은 구간 계산용)
  add(n = 1) {
    const before = this.count;
    this.count += n;
    this.idle = 0;
    this.best = Math.max(this.best, this.count);
    return before;
  }

  tick(dt, window) {
    if (!this.count) return;
    this.idle += dt;
    if (this.idle > window) this.count = 0;
  }

  hurt() {
    this.count = Math.floor(this.count / 2);
  }
}
