// Premium Power Features: 스탯 증가 없음, 확률/편의성만 제공

export const PREMIUM_FEATURES = {
  revive: {
    id: 'revive',
    name: '1회 부활',
    desc: '사망 시 50% HP로 돌아옴',
    usesPerRun: 1,
  },
  cardReroll: {
    id: 'cardReroll',
    name: '선택지 다시보기',
    desc: '레벨업 카드 선택지 3장 재뽑 (1회/run)',
    usesPerRun: 1,
  },
  deathInsurance: {
    id: 'deathInsurance',
    name: '사망 보험',
    desc: '사망 시 현재 exp의 50%를 seeds로 전환',
    usesPerRun: 1,  // 자동 적용, 선택 불가
  },
};

export class PremiumState {
  constructor() {
    this.usedFeatures = {};
    Object.keys(PREMIUM_FEATURES).forEach(key => {
      this.usedFeatures[key] = 0;
    });
  }

  canUse(featureId) {
    const feature = PREMIUM_FEATURES[featureId];
    return feature && this.usedFeatures[featureId] < feature.usesPerRun;
  }

  use(featureId) {
    if (this.canUse(featureId)) {
      this.usedFeatures[featureId]++;
      return true;
    }
    return false;
  }

  reset() {
    Object.keys(this.usedFeatures).forEach(key => {
      this.usedFeatures[key] = 0;
    });
  }
}
