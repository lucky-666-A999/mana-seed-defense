const SHOT_RADIUS = 6;
const MAX_LIFE = 6;

// 적 탄환(피하기만 가능)과 플레이어 투사체(화살·검기)
export class Projectiles {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.shots = [];
  }

  fireShot(x, y, dir, speed, { base, pierce = 0, knockback = 0, maxDist = 300, explodeRadius = 0, color = 0xffffff, size = 1, ricocheted = false }) {
    this.shots.push({
      x, y, dir, speed, vx: Math.cos(dir) * speed, vy: Math.sin(dir) * speed, base, pierce, knockback, maxDist, explodeRadius,
      color, size, ricocheted, travelled: 0, hit: new Set(), done: false,
      sprite: this.scene.add.rectangle(x, y, 16 * size, 4 * size, color).setRotation(dir).setDepth(12),
    });
  }

  // 사냥꾼: 화살로 처치하면 가장 가까운 다음 적에게 한 번 튕긴다
  ricochet(b, from) {
    const s = this.scene;
    if (b.ricocheted || s.spec?.attackMod !== 'ricochet') return;
    let next = null;
    let best = 250;
    for (const m of s.monsters.alive()) {
      const d = Math.hypot(m.x - from.x, m.y - from.y);
      if (d < best) { best = d; next = m; }
    }
    if (!next) return;
    this.fireShot(from.x, from.y, Math.atan2(next.y - from.y, next.x - from.x), b.speed, {
      base: b.base, pierce: 0, knockback: b.knockback, maxDist: 280, color: 0x69db7c, ricocheted: true,
    });
  }

  updateShots(dt) {
    const s = this.scene;
    for (const b of this.shots) {
      const step = Math.hypot(b.vx, b.vy) * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.travelled += step;
      for (const m of s.monsters.alive()) {
        if (b.done || b.hit.has(m)) continue;
        if (Math.hypot(m.x - b.x, m.y - b.y) > m.def.radius + 5) continue;
        b.hit.add(m);
        s.monsters.beginAttack();
        s.hero.hit(m, b.base, b.dir, b.knockback);
        if (m.dead) this.ricochet(b, m);
        if (b.explodeRadius) s.hero.blast(b.x, b.y, b.explodeRadius, b.base * 0.6, 60, 0xd8ffb0);
        if (--b.pierce < 0) b.done = true;
      }
      if (b.travelled >= b.maxDist) b.done = true;
      if (b.done) b.sprite.destroy();
      else b.sprite.setPosition(b.x, b.y);
    }
    this.shots = this.shots.filter((b) => !b.done);
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
    this.updateShots(dt);
  }
}
