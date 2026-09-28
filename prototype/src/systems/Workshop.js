export function priceFor(item, wave) {
  return item.base + item.perWave * wave;
}

// used = { prep: {id: n}, run: {id: n} } — 준비 단계가 바뀌면 prep만 비운다
export function canUse(item, wave, available, used) {
  const count = used[item.scope][item.id] || 0;
  return count < item.limit && priceFor(item, wave) <= available;
}

export function recordUse(used, item) {
  const bucket = used[item.scope];
  return { ...used, [item.scope]: { ...bucket, [item.id]: (bucket[item.id] || 0) + 1 } };
}
