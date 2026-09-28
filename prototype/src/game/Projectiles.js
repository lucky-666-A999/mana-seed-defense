const SHOT_RADIUS = 6;
const MAX_LIFE = 6;

// 적 탄환. 플레이어는 부술 수 없고 피해야 한다.
export class Projectiles {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  fire(x, y, dir, speed, { player = 0, core = 0, color = 0xffffff }) {
    this.list.push({
      x, y, vx: Math.cos(dir) * speed, vy: Math.sin(dir) * speed, player, core, life: 0, done: false,
      sprite: this.scene.add.circle(x, y, SHOT_RADIUS, color).setStrokeStyle(2, 0xffffff, 0.8).setDepth(12),
    });
  }

  update(dt) {
    const s = this.scene;
    const { width, height } = s.db.balance.world;
    for (const b of this.list) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life += dt;
      if (b.player && Math.hypot(b.x - s.player.x, b.y - s.player.y) <= SHOT_RADIUS + s.player.radius && !s.isInvulnerable()) {
        s.hurtPlayer(b.player);
        b.done = true;
      } else if (b.core && Math.hypot(b.x - s.core.x, b.y - s.core.y) <= SHOT_RADIUS + s.core.radius) {
        s.damageCore(b.core);
        b.done = true;
      } else if (b.life > MAX_LIFE || b.x < 0 || b.y < 0 || b.x > width || b.y > height) {
        b.done = true;
      }
      if (b.done) b.sprite.destroy();
      else b.sprite.setPosition(b.x, b.y);
    }
    this.list = this.list.filter((b) => !b.done);
  }
}
