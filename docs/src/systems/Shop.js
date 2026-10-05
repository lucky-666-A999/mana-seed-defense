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
  const mods = {
    hp: 0, atk: 0, move: 0, coreHp: 0, coreRegen: 0, harvest: 0, freeCard: 0,
    itemChance: 0, partnerBonus: 0, enhanceBonus: 0, greatBonus: 0, dropGuard: 0, firstItem: 0, startSeeds: 0, startItem: 0,
  };
  for (const item of shop) {
    if (item.kind !== 'upgrade' && item.kind !== 'explore') continue;
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

export function discoveredCount(discovered) {
  return Object.values(discovered).filter(Boolean).length;
}

// 도감 수집 보상: 발견마다 공격력 +1%, 발견 수 마일스톤마다 영구 효과
export function collectionBonus(discovered, balance) {
  const cfg = balance.collection;
  const count = discoveredCount(discovered);
  const bonus = { atk: count * cfg.perDiscoveryAtk, hp: 0, coreHp: 0, startSeeds: 0, startItem: 0, reached: [], next: null, count };
  for (const m of cfg.milestones) {
    if (count >= m.count) {
      bonus[m.effect.stat] += m.effect.add;
      bonus.reached.push(m.name);
    } else if (!bonus.next) {
      bonus.next = m;
    }
  }
  return bonus;
}
