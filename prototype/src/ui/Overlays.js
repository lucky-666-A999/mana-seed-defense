const W = 540;
const H = 960;
const INPUT_GUARD_MS = 300;
const GRADE_COLORS = { common: 0x9aa0a6, rare: 0x57e389, epic: 0xb57bff, legend: 0xffd966, fallback: 0x6fa8ff };
const GRADE_NAMES = { common: '일반', rare: '희귀', epic: '영웅', legend: '전설', fallback: '대체' };
const cssColor = (n) => `#${n.toString(16).padStart(6, '0')}`;

function makeLayer(scene) {
  const objs = [];
  const openedAt = scene.time.now;
  const add = (o, depth = 2001) => {
    objs.push(o.setScrollFactor(0).setDepth(depth));
    return o;
  };
  add(scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setInteractive(), 2000);
  const onTap = (target, fn) => {
    target.setInteractive({ useHandCursor: true });
    target.on('pointerdown', () => {
      if (scene.time.now - openedAt >= INPUT_GUARD_MS) fn();
    });
  };
  return { add, onTap, destroy: () => objs.forEach((o) => o.destroy()) };
}

function text(layer, scene, x, y, str, size, color = '#ffffff', bold = false) {
  return layer.add(scene.add.text(x, y, str, {
    fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color, align: 'center',
  }).setOrigin(0.5), 2002);
}

function button(layer, scene, y, label, color, onClick) {
  const bg = layer.add(scene.add.rectangle(W / 2, y, 300, 60, color).setStrokeStyle(2, 0xffffff, 0.8));
  text(layer, scene, W / 2, y, label, 22, '#0a0612', true);
  layer.onTap(bg, () => {
    layer.destroy();
    onClick();
  });
}

export function showCardPicker(scene, cards, ranks, onPick) {
  const layer = makeLayer(scene);
  text(layer, scene, W / 2, 250, '레벨 업!', 32, '#9dffb0', true);
  text(layer, scene, W / 2, 292, '하나를 고르세요', 18, '#c9b8ff');
  const cardW = 150;
  const cardH = 230;
  const gap = 18;
  const startX = W / 2 - ((cards.length - 1) * (cardW + gap)) / 2;
  cards.forEach((card, i) => {
    const x = startX + i * (cardW + gap);
    const y = 460;
    const color = GRADE_COLORS[card.grade];
    const bg = layer.add(scene.add.rectangle(x, y, cardW, cardH, 0x1b1230).setStrokeStyle(4, color));
    text(layer, scene, x, y - 92, GRADE_NAMES[card.grade], 14, cssColor(color), true);
    layer.add(scene.add.text(x, y - 45, card.name, {
      fontSize: '19px', fontStyle: 'bold', color: '#ffffff', align: 'center', wordWrap: { width: cardW - 16 },
    }).setOrigin(0.5), 2002);
    const rank = ranks[card.id] || 0;
    if (!card.instant) text(layer, scene, x, y + 5, `Lv ${rank} → ${rank + 1}`, 14, '#ffd966');
    layer.add(scene.add.text(x, y + 55, card.desc, {
      fontSize: '14px', color: '#d8d0ee', align: 'center', wordWrap: { width: cardW - 20 },
    }).setOrigin(0.5), 2002);
    layer.onTap(bg, () => {
      layer.destroy();
      onPick(card);
    });
  });
  return layer;
}

export function showWaveClear(scene, info, { onContinue, onRetire }) {
  const layer = makeLayer(scene);
  text(layer, scene, W / 2, 250, `웨이브 ${info.wave} 클리어!`, 32, '#ffd966', true);
  text(layer, scene, W / 2, 330, `이번 판 누적 경험치  ${info.totalExp}`, 19);
  text(layer, scene, W / 2, 368, `지금 마무리하면 → 마나시드 ${info.seeds}개`, 19, '#9dffb0', true);
  text(layer, scene, W / 2, 406,
    `코어 ${Math.ceil(info.coreHp)}/${info.coreMaxHp}  (이어가면 +${Math.round(info.coreRecover * 100)}%)`, 17, '#9ff0bb');
  text(layer, scene, W / 2, 460, '※ 사망하거나 코어가 파괴되면\n이번 판 경험치는 전부 사라집니다', 15, '#ff9a9a');
  button(layer, scene, 580, '이어가기', 0x57e389, onContinue);
  button(layer, scene, 660, '마무리 (환수)', 0xffd966, onRetire);
  return layer;
}

export function showResult(scene, info, onRestart) {
  const titles = { retire: '마무리 성공', dead: '쓰러졌습니다', coreLost: '코어 파괴' };
  const layer = makeLayer(scene);
  text(layer, scene, W / 2, 250, titles[info.outcome], 34, info.outcome === 'retire' ? '#9dffb0' : '#ff7b7b', true);
  text(layer, scene, W / 2, 330, `도달 웨이브  ${info.wave}`, 20);
  text(layer, scene, W / 2, 370,
    info.outcome === 'retire' ? `획득 마나시드  +${info.seeds}` : `경험치 ${info.totalExp} 소멸`,
    20, info.outcome === 'retire' ? '#9dffb0' : '#ff9a9a', true);
  text(layer, scene, W / 2, 430, `보유 마나시드  ${info.save.seeds}`, 18, '#c9b8ff');
  text(layer, scene, W / 2, 462, `최고 웨이브  ${info.save.bestWave}`, 18, '#c9b8ff');
  button(layer, scene, 600, '다시 하기', 0x6fa8ff, onRestart);
  return layer;
}
