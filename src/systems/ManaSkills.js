const MAX_LEVEL = 5;

// lv1·lv5 사이를 선형 보간한 수치 + 고정 수치를 합쳐 돌려준다. 개수(count)는 정수로 반올림.
export function manaSkillParams(data, id, level) {
  const def = data[id];
  const t = (Math.min(Math.max(level, 1), MAX_LEVEL) - 1) / (MAX_LEVEL - 1);
  const out = {};
  for (const [k, v] of Object.entries(def)) {
    if (k !== 'lv1' && k !== 'lv5') out[k] = v;
  }
  for (const k of Object.keys(def.lv1)) {
    const v = def.lv1[k] + (def.lv5[k] - def.lv1[k]) * t;
    out[k] = k === 'count' ? Math.round(v) : v;
  }
  return out;
}
