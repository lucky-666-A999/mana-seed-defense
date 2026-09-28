export function levelOf(item, save) {
  return save.upgrades[item.id] || 0;
}

export function priceOf(item, save) {
  const lv = levelOf(item, save);
  return lv < item.prices.length ? item.prices[lv] : null;
}

export function canBuy(item, save) {
  const price = priceOf(item, save);
  return price !== null && save.seeds >= price;
}

export function buy(save, item) {
  if (!canBuy(item, save)) return save;
  return {
    ...save,
    seeds: save.seeds - priceOf(item, save),
    upgrades: { ...save.upgrades, [item.id]: levelOf(item, save) + 1 },
  };
}

export function runModifiers(save, shop) {
  const mods = { hp: 0, atk: 0, move: 0, coreHp: 0, coreRegen: 0, harvest: 0, freeCard: 0 };
  for (const item of shop) {
    if (item.kind !== 'upgrade') continue;
    mods[item.effect.stat] += item.effect.add * levelOf(item, save);
  }
  return mods;
}

// 상점에서 산 카드만 잠금을 풀어 카드풀로 넘긴다
export function cardPool(cards, save, shop) {
  const unlocked = new Set(shop.filter((i) => i.kind === 'card' && levelOf(i, save) > 0).map((i) => i.card));
  return cards
    .filter((c) => !c.locked || unlocked.has(c.id))
    .map((c) => (c.locked ? { ...c, locked: false } : c));
}
