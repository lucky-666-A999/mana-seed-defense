export const SAVE_KEY = 'manaSeedDefense.save.v1';

export function expToNext(level, balance) {
  return balance.levelCurve.base + balance.levelCurve.perLevel * (level - 1);
}

export class RunProgress {
  constructor(balance) {
    this.balance = balance;
    this.level = 1;
    this.exp = 0;
    this.totalExp = 0;
    this.pendingLevelups = 0;
  }

  addExp(amount) {
    this.totalExp += amount;
    this.exp += amount;
    let gained = 0;
    while (this.exp >= expToNext(this.level, this.balance)) {
      this.exp -= expToNext(this.level, this.balance);
      this.level++;
      gained++;
    }
    this.pendingLevelups += gained;
    return gained;
  }

  takeLevelup() {
    if (this.pendingLevelups === 0) return false;
    this.pendingLevelups--;
    return true;
  }
}

export function settleRun(outcome, totalExp, balance) {
  return outcome === 'retire' ? Math.floor(totalExp * balance.expToSeed) : 0;
}

export function loadSave(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw) return { seeds: 0, bestWave: 0, ...JSON.parse(raw) };
  } catch {
    // 손상된 저장은 버리고 새로 시작
  }
  return { seeds: 0, bestWave: 0 };
}

export function saveRunResult(storage, { seeds, wave }) {
  const save = loadSave(storage);
  save.seeds += seeds;
  save.bestWave = Math.max(save.bestWave, wave);
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // 사파리 비공개 모드 등 저장 불가 환경: 이번 결과만 화면에 표시
  }
  return save;
}
