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
  const last = defined[defined.length - 1].monsters;
  const ratio = formulaCount(wave, balance) / formulaCount(defined.length, balance);
  return last.map((m) => ({ id: m.id, count: Math.max(1, Math.round(m.count * ratio)) }));
}

export function monsterStats(def, wave, balance) {
  const s = balance.scaling;
  return {
    hp: def.hp * (1 + s.hpPerWave * (wave - 1)),
    atk: def.atk * (1 + s.atkPerWave * (wave - 1)),
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
    this.queue = [];
    for (const { id, count } of waveComposition(this.wave, this.wavesData, this.balance)) {
      for (let i = 0; i < count; i++) this.queue.push(id);
    }
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

  get remaining() {
    return this.total - this.resolved;
  }

  nextWave() {
    this.wave++;
    this.startPrep();
  }
}
