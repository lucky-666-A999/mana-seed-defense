import { manaSkillParams } from '../systems/ManaSkills.js';

const hex = (color) => parseInt(color.replace('#', ''), 16);
const ORB_RADIUS = 8;

// 직업과 무관한 자동 발동 마나 스킬(운석·냉기 보호막·집중 레이저·씨앗 궤도). 레벨 = 카드 단계.
export class ManaSkillRunner {
  constructor(scene) {
    this.scene = scene;
    this.g = scene.add.graphics().setDepth(16);
    this.timers = { meteor: 1, frost: 0, laser: 1.5 };
    this.impacts = [];
    this.beam = null;
    this.orbitAngle = 0;
  }

  level(id) {
    return this.scene.stats[id] || 0;
  }

  params(id) {
    return manaSkillParams(this.scene.db.manaSkills, id, this.level(id));
  }

  update(dt) {
    this.g.clear();
    if (this.level('meteor')) this.meteor(dt);
    this.updateImpacts(dt);
    if (this.level('frost')) this.frost(dt);
    if (this.level('laser')) this.laser(dt);
    if (this.level('orbit')) this.orbit(dt);
  }

  base() {
    return this.scene.hero.baseDamage();
  }

  meteor(dt) {
    const s = this.scene;
    const p = this.params('meteor');
    this.timers.meteor -= dt;
    if (this.timers.meteor > 0) return;
    const target = s.monsters.nearest(s.player.x, s.player.y, p.range);
    if (!target) {
      this.timers.meteor = 0.5;
      return;
    }
    this.timers.meteor = p.interval;
    this.impacts.push({ x: target.x, y: target.y, t: p.windup, windup: p.windup, r: p.radius, dmg: this.base() * p.damageMul, color: hex(p.color) });
  }

  updateImpacts(dt) {
    for (const im of this.impacts) {
      im.t -= dt;
      const k = 1 - Math.max(0, im.t) / im.windup;
      this.g.lineStyle(2, im.color, 0.9).strokeCircle(im.x, im.y, im.r);
      this.g.fillStyle(im.color, 0.25 * k).fillCircle(im.x, im.y, im.r * k);
      if (im.t <= 0) {
        this.scene.hero.blast(im.x, im.y, im.r, im.dmg, 120, im.color);
        this.scene.cameras.main.shake(90, 0.005);
      }
    }
    this.impacts = this.impacts.filter((im) => im.t > 0);
  }

  frost(dt) {
    const s = this.scene;
    const p = this.params('frost');
    const pl = s.player;
    this.g.lineStyle(2, hex(p.color), 0.5).strokeCircle(pl.x, pl.y, p.radius);
    this.g.fillStyle(hex(p.color), 0.07).fillCircle(pl.x, pl.y, p.radius);
    const inside = s.monsters.alive().filter((m) => Math.hypot(m.x - pl.x, m.y - pl.y) <= p.radius + m.def.radius);
    for (const m of inside) s.monsters.slow(m, p.slow, 0.3);
    this.timers.frost -= dt;
    if (this.timers.frost > 0) return;
    this.timers.frost = p.tick;
    s.monsters.beginAttack();
    for (const m of inside) s.hero.hit(m, this.base() * p.damageMul, Math.atan2(m.y - pl.y, m.x - pl.x), 0);
  }

  laser(dt) {
    const s = this.scene;
    const p = this.params('laser');
    const pl = s.player;
    this.timers.laser -= dt;
    if (this.beam) {
      this.beam.t -= dt;
      this.g.lineStyle(p.width * (this.beam.t / 0.15), hex(p.color), 0.9).lineBetween(this.beam.ax, this.beam.ay, this.beam.bx, this.beam.by);
      if (this.beam.t <= 0) this.beam = null;
    }
    const target = s.monsters.nearest(pl.x, pl.y, p.range);
    if (!target) {
      this.timers.laser = Math.max(this.timers.laser, p.windup);
      return;
    }
    const dir = Math.atan2(target.y - pl.y, target.x - pl.x);
    const bx = pl.x + Math.cos(dir) * p.length;
    const by = pl.y + Math.sin(dir) * p.length;
    if (this.timers.laser <= p.windup) this.g.lineStyle(2, hex(p.color), 0.6).lineBetween(pl.x, pl.y, bx, by);
    if (this.timers.laser > 0) return;
    this.timers.laser = p.interval;
    s.hero.sweepHit = new Set();
    s.hero.sweep(pl.x, pl.y, bx, by, p.width, this.base() * p.damageMul, 60);
    this.beam = { ax: pl.x, ay: pl.y, bx, by, t: 0.15 };
  }

  orbit(dt) {
    const s = this.scene;
    const p = this.params('orbit');
    const pl = s.player;
    this.orbitAngle += p.spin * dt;
    const now = s.time.now / 1000;
    for (let i = 0; i < p.count; i++) {
      const a = this.orbitAngle + (Math.PI * 2 * i) / p.count;
      const ox = pl.x + Math.cos(a) * p.radius;
      const oy = pl.y + Math.sin(a) * p.radius;
      this.g.fillStyle(hex(p.color), 1).fillCircle(ox, oy, ORB_RADIUS);
      for (const m of s.monsters.alive()) {
        if (Math.hypot(m.x - ox, m.y - oy) > ORB_RADIUS + m.def.radius) continue;
        if (now - (m.orbitHitAt || -9) < p.hitCooldown) continue;
        m.orbitHitAt = now;
        s.monsters.beginAttack();
        s.hero.hit(m, this.base() * p.damageMul, Math.atan2(m.y - pl.y, m.x - pl.x), 50);
      }
    }
  }
}
