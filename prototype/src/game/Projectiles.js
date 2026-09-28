const SHOT_RADIUS = 6;
const MAX_LIFE = 6;

// 적 탄환(피하기만 가능)과 플레이어 투사체(화살·검기)
export class Projectiles {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.shots = [];
  }

  fireShot(x, y, dir, speed, { base, pierce = 0, knockback = 0, maxDist = 300, explodeRadius = 0, explodeBase = null, chain = false, color = 0xffffff, size = 1, bounces = null }) {
    this.shots.push({
      x, y, dir, speed, vx: Math.cos(dir) * speed, vy: Math.sin(dir) * speed, base, pierce, knockback, maxDist, explodeRadius,
      explodeBase, chain, color, size, bounces, travelled: 0, hit: new Set(), done: false,
      sprite: this.scene.add.rectangle(x, y, 16 * size, 4 * size, color).setRotation(dir).setDepth(12),
    });
  }

  // 사냥꾼: 화살로 처치하면 가장 가까운 다음 적에게 튕긴다 (4차부터 두 번)
  ricochet(b, from) {
    const s = this.scene;
    if (s.spec?.attackMod !== 'ricochet') return;
    const left = b.bounces ?? (s.tier >= 4 ? 2 : 1);
    if (left <= 0) return;
    let next = null;
    let best = 250;
    for (const m of s.monsters.alive()) {
      const d = Math.hypot(m.x - from.x, m.y - from.y);
      if (d < best) { best = d; next = m; }
    }
    if (!next) return;
    this.fireShot(from.x, from.y, Math.atan2(next.y - from.y, next.x - from.x), b.speed, {
      base: b.base * s.sigMul(), pierce: 0, knockback: b.knockback, maxDist: 280, color: 0x69db7c, bounces: left - 1,
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
        if (b.explodeRadius) {
          const eb = b.explodeBase ?? b.base * 0.6;
          s.hero.blast(b.x, b.y, b.explodeRadius, eb, 60, b.explodeBase ? b.color : 0xd8ffb0);
          // 5차 마나 캐논: 착탄 주변 연쇄 폭발
          if (b.chain) {
            for (let k = 0; k < 3; k++) {
              const a = (Math.PI * 2 * k) / 3 + Math.random();
              s.hero.blast(b.x + Math.cos(a) * 48, b.y + Math.sin(a) * 48, 34, eb * 0.4, 20, b.color);
            }
          }
        }
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
      if (b.player && s.hero.shieldBlocks(b.x, b.y)) {
        s.ring(b.x, b.y, 10, 0x8ce99a);
        b.done = true;
      } else if (b.player && Math.hypot(b.x - s.player.x, b.y - s.player.y) <= SHOT_RADIUS + s.player.radius && !s.isInvulnerable()) {
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
