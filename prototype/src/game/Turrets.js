import { turretProfile } from '../systems/Turrets.js';

const hex = (color) => parseInt(color.replace('#', ''), 16);
const DRONE_ORBIT = 62;

// 기계학자 포탑·대포·드론. 고정 포탑은 웨이브가 끝나도 남고, 몬스터가 공격 대상으로 삼는다.
export class Turrets {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.g = scene.add.graphics().setDepth(9);
  }

  profile() {
    const s = this.scene;
    return s.cls.turret ? turretProfile(s.cls, s.spec, s.tier) : null;
  }

  color() {
    const s = this.scene;
    return hex(s.spec ? s.spec.color : s.cls.color);
  }

  deploy(x, y) {
    const p = this.profile();
    if (!p) return;
    while (this.list.length >= p.max) this.remove(this.list[0]);
    this.list.push({ x, y, hp: p.hp, maxHp: p.hp, timer: 0.3, angle: -Math.PI / 2, beam: 0 });
    this.scene.ring(x, y, 22, this.color());
  }

  remove(t) {
    this.list = this.list.filter((x) => x !== t);
    this.scene.burst(t.x, t.y, this.color());
  }

  repairAll() {
    for (const t of this.list) t.hp = t.maxHp;
  }

  // 몬스터가 노릴 수 있는 포탑 (드론은 떠 있어서 제외)
  targets() {
    const p = this.profile();
    return p && !p.mobile ? this.list : [];
  }

  damage(t, amount) {
    t.hp -= amount;
    if (t.hp <= 0) this.remove(t);
  }

  update(dt) {
    const s = this.scene;
    const g = this.g;
    g.clear();
    const p = this.profile();
    if (!p || !this.list.length) return;
    const color = this.color();
    const spin = s.time.now / 1000;
    this.list.forEach((t, i) => {
      if (p.mobile) {
        const a = spin * 1.5 + (Math.PI * 2 * i) / this.list.length;
        t.x = s.player.x + Math.cos(a) * DRONE_ORBIT;
        t.y = s.player.y + Math.sin(a) * DRONE_ORBIT;
      }
      t.timer -= dt;
      const target = s.monsters.nearest(t.x, t.y, p.range);
      if (target) {
        t.angle = Math.atan2(target.y - t.y, target.x - t.x);
        if (t.timer <= 0) {
          t.timer = p.interval / s.stats.aspdMul;
          this.fire(t, p);
        }
      }
      this.draw(t, p, color);
    });
  }

  fire(t, p) {
    const s = this.scene;
    const base = s.hero.baseDamage() * p.damageMul;
    if (p.laser) {
      const bx = t.x + Math.cos(t.angle) * p.range;
      const by = t.y + Math.sin(t.angle) * p.range;
      s.hero.sweepHit = new Set();
      s.hero.sweep(t.x, t.y, bx, by, 12, base, 30);
      t.beam = 0.1;
      t.beamTo = { x: bx, y: by };
      return;
    }
    s.projectiles.fireShot(t.x, t.y, t.angle, p.shotSpeed, {
      base, pierce: 0, knockback: p.explodeRadius ? 60 : 30, maxDist: p.range * 1.2,
      explodeRadius: p.explodeRadius, explodeBase: s.hero.baseDamage() * p.explodeMul, chain: p.chain,
      color: this.color(), size: p.explodeRadius ? 1.6 : 0.8,
    });
  }

  draw(t, p, color) {
    const g = this.g;
    if (p.mobile) {
      g.fillStyle(color, 1).fillCircle(t.x, t.y, 7);
      const r = this.scene.time.now / 60;
      g.lineStyle(2, 0xffffff, 0.8)
        .lineBetween(t.x + Math.cos(r) * 10, t.y + Math.sin(r) * 10, t.x - Math.cos(r) * 10, t.y - Math.sin(r) * 10);
    } else {
      const size = p.explodeRadius ? 24 : 20;
      g.fillStyle(0x343a40, 1).fillRect(t.x - size / 2, t.y - size / 2, size, size);
      g.lineStyle(2, color, 1).strokeRect(t.x - size / 2, t.y - size / 2, size, size);
      g.lineStyle(p.explodeRadius ? 8 : 5, color, 1)
        .lineBetween(t.x, t.y, t.x + Math.cos(t.angle) * (size * 0.9), t.y + Math.sin(t.angle) * (size * 0.9));
      if (t.hp < t.maxHp) {
        g.fillStyle(0x000000, 0.6).fillRect(t.x - 12, t.y - size / 2 - 8, 24, 4);
        g.fillStyle(0x8ce99a, 1).fillRect(t.x - 12, t.y - size / 2 - 8, 24 * Math.max(0, t.hp / t.maxHp), 4);
      }
    }
    if (t.beam > 0) {
      t.beam -= 1 / 60;
      g.lineStyle(4, color, 0.9).lineBetween(t.x, t.y, t.beamTo.x, t.beamTo.y);
    }
  }
}
