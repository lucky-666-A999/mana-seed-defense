const W = 540;
const H = 960;

// 외곽 마나 결정: 곁에 서 있으면 채집 게이지가 차고, 다 차면 보너스 경험치. 웨이브가 끝나면 사라진다.
export class Crystals {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.g = scene.add.graphics().setDepth(3);
  }

  get cfg() {
    return this.scene.db.balance.crystals;
  }

  spawnForWave(wave) {
    this.clear();
    const cfg = this.cfg;
    if (wave < cfg.fromWave) return;
    const s = this.scene;
    const { world } = s.db.balance;
    const base = Math.random() * Math.PI * 2;
    for (let i = 0; i < cfg.count; i++) {
      const a = base + (Math.PI * 2 * i) / cfg.count + Phaser.Math.FloatBetween(-0.5, 0.5);
      const d = Phaser.Math.FloatBetween(cfg.minDist, cfg.maxDist);
      const x = Phaser.Math.Clamp(s.core.x + Math.cos(a) * d, 50, world.width - 50);
      const y = Phaser.Math.Clamp(s.core.y + Math.sin(a) * d, 50, world.height - 50);
      const sprite = s.add.rectangle(x, y, 22, 22, 0x66d9ff).setAngle(45).setStrokeStyle(3, 0xe0f7ff).setDepth(4);
      s.tweens.add({ targets: sprite, scale: 1.2, duration: 700, yoyo: true, repeat: -1 });
      const arrow = s.add.triangle(0, 0, 0, -11, 9, 8, -9, 8, 0x66d9ff).setScrollFactor(0).setDepth(900).setVisible(false);
      this.list.push({ x, y, progress: 0, sprite, arrow, done: false });
    }
  }

  update(dt) {
    const s = this.scene;
    const cfg = this.cfg;
    const p = s.player;
    const view = s.cameras.main.worldView;
    this.g.clear();
    for (const c of this.list) {
      const inside = Math.hypot(p.x - c.x, p.y - c.y) <= cfg.radius;
      c.progress = Phaser.Math.Clamp(c.progress + (inside ? dt : -cfg.decay * dt), 0, cfg.channel);
      this.g.lineStyle(2, 0x66d9ff, 0.35).strokeCircle(c.x, c.y, cfg.radius);
      if (c.progress > 0) {
        this.g.lineStyle(5, 0x66d9ff, 0.95);
        this.g.beginPath();
        this.g.arc(c.x, c.y, cfg.radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * c.progress) / cfg.channel);
        this.g.strokePath();
      }
      if (c.progress >= cfg.channel) this.burst(c);
      const off = !view.contains(c.x, c.y);
      c.arrow.setVisible(off && !c.done);
      if (off) {
        const sx = c.x - view.x;
        const sy = c.y - view.y;
        c.arrow.setPosition(Phaser.Math.Clamp(sx, 26, W - 26), Phaser.Math.Clamp(sy, 150, H - 130))
          .setRotation(Math.atan2(sy - H / 2, sx - W / 2) + Math.PI / 2);
      }
    }
    this.list = this.list.filter((c) => !c.done);
  }

  burst(c) {
    const s = this.scene;
    const cfg = this.cfg;
    const exp = Math.round(cfg.expBase + cfg.expPerWave * s.run.wave);
    const parts = 4;
    for (let i = 0; i < parts; i++) {
      const a = (Math.PI * 2 * i) / parts;
      s.dropSeed(c.x + Math.cos(a) * 16, c.y + Math.sin(a) * 16, exp / parts, 'blue');
    }
    s.blastFx(c.x, c.y, 60, 0x66d9ff);
    s.floatText(c.x, c.y - 30, `마나 결정 +${exp}`, '#66d9ff');
    this.destroyOne(c);
  }

  destroyOne(c) {
    c.done = true;
    c.sprite.destroy();
    c.arrow.destroy();
  }

  clear() {
    for (const c of this.list) this.destroyOne(c);
    this.list = [];
    this.g?.clear();
  }
}
