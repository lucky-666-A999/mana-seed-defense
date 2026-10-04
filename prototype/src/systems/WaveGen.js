import { formulaCount } from './WaveSystem.js';

// 최대 잔여 방식: 비율대로 나눈 뒤 남는 수는 소수점이 큰 종류부터 1씩
function splitByMix(total, mix) {
  const entries = Object.entries(mix).map(([id, share]) => {
    const exact = total * share;
    return { id, count: Math.floor(exact), frac: exact - Math.floor(exact) };
  });
  let left = total - entries.reduce((a, e) => a + e.count, 0);
  for (const e of [...entries].sort((a, b) => b.frac - a.frac)) {
    if (left <= 0) break;
    e.count++;
    left--;
  }
  return entries.filter((e) => e.count > 0).map(({ id, count }) => ({ id, count }));
}

export function generateWave(wave, balance) {
  const cfg = balance.autoWave;
  const mixForWave = getMixForWave(wave, cfg);
  const comp = splitByMix(formulaCount(wave, balance), mixForWave);
  const eliteFor = (n) => cfg.elites[n % cfg.elites.length];
  if (wave % cfg.bossEvery === 0) {
    comp.push({ id: cfg.boss, count: 1 });
    if (wave % cfg.bossEliteEvery === 0) comp.push({ id: eliteFor(wave / cfg.bossEliteEvery), count: 1 });
  } else if (wave % cfg.eliteEvery === 0) {
    comp.push({ id: eliteFor(wave / cfg.eliteEvery), count: 1 });
  }
  return comp;
}

function getMixForWave(wave, cfg) {
  const mixByWave = cfg.mixByWave;
  if (!mixByWave) return cfg.mix;
  let mix = mixByWave[0].mix;
  for (const entry of mixByWave) {
    if (wave >= entry.fromWave) mix = entry.mix;
  }
  return mix;
}

export function waveSpecials(composition, monsters) {
  const elites = composition.filter((m) => monsters[m.id]?.elite).map((m) => m.id);
  const boss = composition.find((m) => monsters[m.id]?.boss)?.id ?? null;
  return { elites, boss };
}
