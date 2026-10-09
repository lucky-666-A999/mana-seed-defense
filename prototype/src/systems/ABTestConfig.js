// A/B 테스트 설정: Random Dice 2 스타일 과금 전략
export const AB_TEST_VARIANTS = {
  // 1. 과금 타이밍 (웨이브 번호)
  chargeTiming: {
    control: 8,    // 웨이브 8에서 배틀패스 추천
    early: 5,      // 초기: 웨이브 5에서 추천
    late: 12,      // 후기: 웨이브 12에서 추천
  },

  // 2. 배틀패스 가격 (USD)
  battlepassPrice: {
    control: 9.99,
    cheap: 4.99,
    premium: 19.99,
  },

  // 3. 광고 빈도 (1판 당 광고 수)
  adFrequency: {
    control: 3,    // 1판 3회 광고
    low: 1,        // 적극적: 1회만
    high: 5,       // 수익 극대: 5회
  },

  // 4. 배틀패스 보상 가치
  rewardValue: {
    control: 100,  // 기본값
    generous: 150, // 25% 보너스
    lean: 75,      // 25% 감소
  },

  // 5. 프리미엄 차등화 (premium-only 보상 개수)
  premiumDifferentiation: {
    control: 5,    // 10개 레벨 중 5개만 프리미엄
    aggressive: 8, // 더 많이 차등화
    generous: 3,   // 더 적게 차등화
  },
};

export class ABTestAssignment {
  constructor(userId) {
    this.userId = userId;
    this.assignments = this.generateAssignments();
  }

  generateAssignments() {
    // 간단한 해시 기반 할당 (실제로는 서버에서 할당)
    const hash = this.hashId(this.userId);
    return {
      chargeTiming: this.selectVariant(hash, 'chargeTiming', 0),
      battlepassPrice: this.selectVariant(hash, 'battlepassPrice', 1),
      adFrequency: this.selectVariant(hash, 'adFrequency', 2),
      rewardValue: this.selectVariant(hash, 'rewardValue', 3),
      premiumDifferentiation: this.selectVariant(hash, 'premiumDifferentiation', 4),
    };
  }

  selectVariant(hash, key, offset) {
    const variants = Object.keys(AB_TEST_VARIANTS[key]);
    const variantIndex = (hash + offset) % variants.length;
    return variants[variantIndex];
  }

  hashId(id) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  getConfig() {
    const config = {};
    Object.entries(this.assignments).forEach(([key, variant]) => {
      config[key] = AB_TEST_VARIANTS[key][variant];
    });
    return config;
  }

  trackEvent(event, value) {
    // 이벤트 추적 (실제로는 분석 서버로 전송)
    console.log(`[ABTest] ${event}:`, value, 'Variant:', this.assignments);
  }
}

// 전환율 측정용 메트릭
export const METRICS_TEMPLATE = {
  // 수익 관련
  premiumPurchases: 0,
  totalRevenue: 0,
  arpu: 0, // Average Revenue Per User

  // 참여도 관련
  dailyActiveUsers: 0,
  sessionLength: 0, // 초
  wavesClearedPerSession: 0,
  questCompletionRate: 0, // %

  // 행동 관련
  battlepassClicks: 0,
  premiumSkipClicks: 0,
  adWatchRate: 0, // %
  churnRate: 0, // % (7일 이상 미접속)

  // 목표 추적
  payingUserRetention: {}, // day1, day7, day30
};
