export const W = 540;
export const H = 960;

export function label(scene, x, y, str, size, color = '#ffffff', opts = {}) {
  return scene.add.text(x, y, str, {
    fontSize: `${size}px`, fontStyle: opts.bold ? 'bold' : 'normal', color, align: opts.align || 'center',
    wordWrap: opts.wrap ? { width: opts.wrap } : undefined, lineSpacing: opts.lineSpacing || 0,
  }).setOrigin(opts.originX ?? 0.5, opts.originY ?? 0.5);
}

// 사각 버튼. enabled=false면 흐리게 + 입력 무시
export function button(scene, x, y, w, h, text, color, onClick, { enabled = true, size = 20, textColor = '#0a0612' } = {}) {
  const bg = scene.add.rectangle(x, y, w, h, color, enabled ? 1 : 0.25).setStrokeStyle(2, 0xffffff, enabled ? 0.8 : 0.2);
  const t = label(scene, x, y, text, size, enabled ? textColor : '#8a8199', { bold: true });
  if (enabled) {
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', onClick);
  }
  return { bg, t, destroy: () => { bg.destroy(); t.destroy(); } };
}

export function backdrop(scene) {
  scene.add.rectangle(W / 2, H / 2, W, H, 0x0a0612);
  const g = scene.add.graphics();
  g.lineStyle(1, 0x2a1f40, 1);
  for (let x = 0; x <= W; x += 60) g.lineBetween(x, 0, x, H);
  for (let y = 0; y <= H; y += 60) g.lineBetween(0, y, W, y);
}
