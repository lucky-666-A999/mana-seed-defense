import { generateWave } from './WaveGen.js';

export function spawnDirectionCount(wave, balance) {
  let count = balance.spawnDirections[0].count;
  for (const step of balance.spawnDirections) {
    if (wave >= step.fromWave) count = step.count;
  }
  return count;
}

export function prepSecondsFor(wave, wavesData) {
  const def = wavesData.waves[wave - 1];
  return def && def.prepSeconds != null ? def.prepSeconds : wavesData.prepSeconds;
}

export function formulaCount(wave, balance) {
  const s = balance.scaling;
  return s.countBase + Math.floor(wave * s.countPerWave);
}

export function waveComposition(wave, wavesData, balance) {
  const defined = wavesData.waves;
  if (wave <= defined.length) return defined[wave - 1].monsters.map((m) => ({ id: m.id, count: m.count }));
  return generateWave(wave, balance);
}

// 종류를 번갈아 꺼내 섞는다 (정예·보스가 웨이브 초반에 섞여 나오도록)
function interleave(composition) {
  const left = composition.map((m) => ({ id: m.id, n: m.count }));
  const out = [];
  while (left.some((m) => m.n > 0)) {
    for (const m of left) {
      if (m.n > 0) {
        out.push(m.id);
        m.n--;
      }
    }
  }
  return out;
}

export function monsterStats(def, wave, balance) {
  const s = balance.scaling;

  // Random Dice 스타일 난이도 곡선 (완만한 상승)
  let difficultymul = 1;
  if (wave >= 9 && wave <= 15) {
    // 웨이브 9-15: 선형 상승 (1.2배 → 2.4배)
    difficultymul = 1.0 + 0.2 * (wave - 8);
  } else if (wave > 15) {
    // 웨이브 16+: 지수 증가
    difficultymul = 2.4 * Math.pow(1.1, wave - 15);
  }

  return {
    hp: def.hp * (1 + (def.hpPerWave ?? s.hpPerWave) * (wave - 1)) * difficultymul,
    atk: def.atk * (1 + s.atkPerWave * (wave - 1)) * difficultymul,
  };
}

export function spawnInterval(wave, balance) {
  const s = balance.scaling;
  return Math.max(s.spawnIntervalMin, s.spawnIntervalBase - s.spawnIntervalPerWave * wave);
}

export class WaveRun {
  constructor(wavesData, balance) {
    this.wavesData = wavesData;
    this.balance = balance;
    this.wave = 1;
    this.startPrep();
  }

  startPrep() {
    this.state = 'prep';
    this.prepLeft = prepSecondsFor(this.wave, this.wavesData);
    this.queue = [];
    this.total = 0;
    this.spawned = 0;
    this.resolved = 0;
  }

  skipPrep() {
    if (this.state === 'prep') this.prepLeft = 0;
  }

  beginCombat() {
    this.state = 'combat';
    this.queue = interleave(waveComposition(this.wave, this.wavesData, this.balance));
    this.total = this.queue.length;
    this.directions = spawnDirectionCount(this.wave, this.balance);
    this.interval = spawnInterval(this.wave, this.balance);
    this.spawnTimer = 0;
  }

  update(dt) {
    if (this.state === 'prep') {
      this.prepLeft -= dt;
      if (this.prepLeft <= 0) this.beginCombat();
      return [];
    }
    if (this.state !== 'combat') return [];
    const out = [];
    this.spawnTimer -= dt;
    while (this.spawnTimer <= 0 && this.queue.length > 0) {
      out.push({ id: this.queue.shift(), dirIndex: this.spawned % this.directions, dirCount: this.directions });
      this.spawned++;
      this.spawnTimer += this.interval;
    }
    return out;
  }

  // 처치든 코어 도달이든 "처리됨". 그래야 웨이브가 항상 끝난다.
  markResolved() {
    this.resolved++;
    if (this.state === 'combat' && this.resolved >= this.total) this.state = 'cleared';
  }

  // 전투 중 추가로 생긴 개체(분열·부하·떼)도 처리 목표에 넣는다
  addExtra(n) {
    if (this.state === 'combat') this.total += n;
  }

  get remaining() {
    return this.total - this.resolved;
  }

  nextWave() {
    this.wave++;
    this.startPrep();
  }
}
