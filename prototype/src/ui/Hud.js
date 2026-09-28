import { expToNext } from '../systems/Progression.js';

const W = 540;
const H = 960;

function formatTime(sec) {
  const t = Math.max(0, Math.ceil(sec));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

function bar(g, x, y, w, h, ratio, color) {
  g.fillStyle(0x000000, 0.5).fillRect(x, y, w, h);
  g.fillStyle(color, 1).fillRect(x, y, w * Phaser.Math.Clamp(ratio, 0, 1), h);
  g.lineStyle(1, 0xffffff, 0.4).strokeRect(x, y, w, h);
}

export class Hud {
  constructor(scene) {
    this.scene = scene;
    const fixed = (o) => o.setScrollFactor(0).setDepth(900);
    this.title = fixed(scene.add.text(16, 12, '', { fontSize: '22px', fontStyle: 'bold', color: '#ffffff' }));
    this.sub = fixed(scene.add.text(16, 42, '', { fontSize: '16px', color: '#c9b8ff' }));
    this.skipBtn = fixed(scene.add.text(W - 16, 14, '바로 시작 ▶', {
      fontSize: '17px', fontStyle: 'bold', color: '#0a0612', backgroundColor: '#ffd966', padding: { x: 12, y: 8 },
    }).setOrigin(1, 0)).setInteractive({ useHandCursor: true });
    this.skipBtn.on('pointerdown', () => scene.run.skipPrep());
    this.shopBtn = fixed(scene.add.text(W - 150, 14, '거점', {
      fontSize: '17px', fontStyle: 'bold', color: '#0a0612', backgroundColor: '#9dffb0', padding: { x: 12, y: 8 },
    }).setOrigin(1, 0)).setInteractive({ useHandCursor: true });
    this.shopBtn.on('pointerdown', () => scene.openHub());
    this.bars = fixed(scene.add.graphics());
    this.coreLabel = fixed(scene.add.text(244, 72, '', { fontSize: '13px', color: '#9ff0bb' }));
    this.hpLabel = fixed(scene.add.text(244, 96, '', { fontSize: '13px', color: '#ffb0b0' }));
    this.levelText = fixed(scene.add.text(16, 910, '', { fontSize: '17px', fontStyle: 'bold', color: '#9dffb0' }));
    this.seedText = fixed(scene.add.text(16, 886, '', { fontSize: '14px', color: '#4dabf7' }));
    this.comboText = fixed(scene.add.text(W - 16, 66, '', {
      fontSize: '34px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 5,
    }).setOrigin(1, 0));
    this.arrow = fixed(scene.add.triangle(0, 0, 0, -14, 11, 10, -11, 10, 0x57e389)).setVisible(false);
  }

  update() {
    const s = this.scene;
    const run = s.run;
    this.title.setText(`웨이브 ${run.wave}`);
    this.sub.setText(run.state === 'prep' ? `준비 ${formatTime(run.prepLeft)}` : `남은 적 ${run.remaining}`);
    this.skipBtn.setVisible(run.state === 'prep' && !s.paused);
    this.shopBtn.setVisible(run.state === 'prep' && !s.paused);

    const g = this.bars.clear();
    bar(g, 16, 74, 220, 12, s.core.hp / s.core.maxHp, 0x57e389);
    bar(g, 16, 98, 220, 12, s.player.hp / s.maxHp(), 0xff6b6b);
    bar(g, 16, 936, W - 32, 10, s.progress.exp / expToNext(s.progress.level, s.db.balance), 0x9dffb0);
    this.coreLabel.setText(`코어 ${Math.ceil(s.core.hp)}/${s.core.maxHp}`);
    this.hpLabel.setText(`체력 ${Math.ceil(s.player.hp)}/${Math.round(s.maxHp())}`);
    this.seedText.setText(`마나시드 ${s.progress.available}`);
    this.levelText.setText(`Lv ${s.progress.level} · ${s.formName()}`);
    this.updateCombo(g);

    const view = s.cameras.main.worldView;
    const offscreen = !view.contains(s.core.x, s.core.y);
    this.arrow.setVisible(offscreen);
    if (offscreen) {
      const sx = s.core.x - view.x;
      const sy = s.core.y - view.y;
      const px = Phaser.Math.Clamp(sx, 30, W - 30);
      const py = Phaser.Math.Clamp(sy, 140, H - 70);
      this.arrow.setPosition(px, py).setRotation(Math.atan2(sy - H / 2, sx - W / 2) + Math.PI / 2);
    }
  }

  // 무투가 콤보: 숫자가 클수록 뜨거운 색, 맞힐 때마다 튀고, 아래 막대는 끊기기까지 남은 시간
  updateCombo(g) {
    const hero = this.scene.hero;
    const count = hero.combo.count;
    const on = hero.comboOn() && count >= 2;
    this.comboText.setVisible(on);
    if (!on) return;
    const color = count >= 50 ? '#ff6b6b' : count >= 20 ? '#ff922b' : count >= 10 ? '#ffd43b' : '#ffffff';
    this.comboText.setText(`${count} COMBO`).setColor(color).setScale(hero.comboPop > 0 ? 1.2 : 1);
    const left = 1 - hero.combo.idle / hero.comboProfile().window;
    bar(g, W - 136, 108, 120, 5, left, parseInt(color.slice(1), 16));
  }
}
