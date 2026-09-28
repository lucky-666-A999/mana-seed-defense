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
    this.spent = 0;
  }

  // 정비소에 쓸 수 있는(= 마무리 시 환수될) 경험치
  get available() {
    return this.totalExp - this.spent;
  }

  spend(amount) {
    if (amount > this.available) return false;
    this.spent += amount;
    return true;
  }

  refund(amount) {
    this.spent = Math.max(0, this.spent - amount);
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

export function settleRun(outcome, totalExp, balance, harvestBonus = 0) {
  return outcome === 'retire' ? Math.floor(totalExp * balance.expToSeed * (1 + harvestBonus)) : 0;
}

export function defaultSave() {
  return {
    seeds: 0,
    bestWave: 0,
    upgrades: {},
    classes: ['warden'],
    selectedClass: 'warden',
    specs: {},
    ownedSpecs: {},
    retireBest: {},
    kills: {},
    encounters: {},
    discovered: {},
    seenIntro: false,
  };
}

// Phase 1 저장처럼 필드가 빠진 옛 저장도 기본값과 병합해 그대로 쓴다
export function loadSave(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw) return { ...defaultSave(), ...JSON.parse(raw) };
  } catch {
    // 손상된 저장은 버리고 새로 시작
  }
  return defaultSave();
}

export function writeSave(storage, save) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // 사파리 비공개 모드 등 저장 불가 환경: 이번 결과만 화면에 표시
  }
  return save;
}

export function saveRunResult(storage, { seeds, wave, outcome, classId }) {
  const save = loadSave(storage);
  save.seeds += seeds;
  save.bestWave = Math.max(save.bestWave, wave);
  if (outcome === 'retire' && classId) {
    save.retireBest = { ...save.retireBest, [classId]: Math.max(save.retireBest[classId] || 0, wave) };
  }
  return writeSave(storage, save);
}

function updateSave(storage, mutate) {
  const save = loadSave(storage);
  mutate(save);
  return writeSave(storage, save);
}

function bump(field) {
  return (storage, id) => updateSave(storage, (save) => {
    save[field] = { ...(save[field] || {}) };
    save[field][id] = (save[field][id] || 0) + 1;
  })[field][id];
}

export const recordEncounter = bump('encounters');
export const recordKill = bump('kills');

// 숨겨진 전직 조합 발견 기록. 처음 발견이면 first=true
export function recordDiscovery(storage, recipeId) {
  const before = loadSave(storage);
  const first = !before.discovered[recipeId];
  updateSave(storage, (save) => {
    save.discovered = { ...save.discovered, [recipeId]: true };
  });
  return first;
}
