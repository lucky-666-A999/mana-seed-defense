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

function getMixForWave(baseMix, wave) {
  // wave 10부터 강화, wave 20부터 최대
  if (wave < 10) return baseMix;

  const mix = { ...baseMix };
  const strength = Math.min((wave - 10) / 10, 1);
  const weakTypes = ['charger', 'swarm', 'rabbit', 'fox', 'cat', 'dog', 'octopus', 'alien'];
  const strongTypes = ['ranged', 'dasher', 'splitter', 'artillery'];

  const weakReduction = 0.06 * strength;
  const strongBoost = weakReduction / strongTypes.length;

  weakTypes.forEach(id => { if (mix[id]) mix[id] = Math.max(mix[id] - weakReduction, 0.01); });
  strongTypes.forEach(id => { if (mix[id]) mix[id] += strongBoost; });

  const sum = Object.values(mix).reduce((a, b) => a + b, 0);
  Object.keys(mix).forEach(id => mix[id] /= sum);
  return mix;
}

function getBossForWave(wave, cfg) {
  if (wave >= 20) return 'golem';
  return cfg.boss;
}

export function generateWave(wave, balance) {
  const cfg = balance.autoWave;
  const mix = getMixForWave(cfg.mix, wave);
  const comp = splitByMix(formulaCount(wave, balance), mix);
  const eliteFor = (n) => cfg.elites[n % cfg.elites.length];
  if (wave % cfg.bossEvery === 0) {
    comp.push({ id: getBossForWave(wave, cfg), count: 1 });
    if (wave % cfg.bossEliteEvery === 0) comp.push({ id: eliteFor(wave / cfg.bossEliteEvery), count: 1 });
  } else if (wave % cfg.eliteEvery === 0) {
    comp.push({ id: eliteFor(wave / cfg.eliteEvery), count: 1 });
  }
  return comp;
}

export function waveSpecials(composition, monsters) {
  const elites = composition.filter((m) => monsters[m.id]?.elite).map((m) => m.id);
  const boss = composition.find((m) => monsters[m.id]?.boss)?.id ?? null;
  return { elites, boss };
}
