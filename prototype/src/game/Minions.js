import { minionProfile } from '../systems/Minions.js';

const GHOST_TINT = 0x9775fa;
const SEEK_RANGE = 260;
const FOLLOW_DIST = 70;

// 네크로맨서 망령: 쓰러뜨린 적이 확률로 되살아나 아군이 된다. 정예는 확정 부활, 보스는 부활 없음.
export class Minions {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.g = scene.add.graphics().setDepth(8);
  }

  profile() {
    const s = this.scene;
    return s.cls.minions ? minionProfile(s.cls, s.spec, s.tier, s.stats) : null;
  }

  onKill(m) {
    const p = this.profile();
    if (!p || m.def.boss) return;
    if (!m.def.elite && Math.random() >= p.chance) return;
    this.raise(m.x, m.y, m.def.radius * p.size, m.maxHp * p.hpMul, m.color, Boolean(m.def.elite));
  }

  raise(x, y, radius, hp, color, elite = false) {
    const p = this.profile();
    if (!p) return;
    while (this.list.length >= p.max) {
      const weakest = this.list.reduce((a, b) => (a.elite === b.elite ? (a.hp <= b.hp ? a : b) : a.elite ? b : a));
      this.remove(weakest);
    }
    this.list.push({ x, y, radius, hp, maxHp: hp, color, elite, attackTimer: 0, frenzyT: 0, ally: 'minion' });
    this.scene.ring(x, y, radius + 10, GHOST_TINT);
    if (elite) this.scene.floatText(x, y - 30, '정예가 일어섰다', '#b197fc');
  }

  frenzy(duration, summon) {
    const s = this.scene;
    const p = this.profile();
    if (!p) return;
    for (const mn of this.list) mn.frenzyT = duration;
    for (let i = 0; i < summon; i++) {
      const a = Math.random() * Math.PI * 2;
      this.raise(s.player.x + Math.cos(a) * 40, s.player.y + Math.sin(a) * 40, 10 * p.size, p.skeletonHp * p.hpMul * 2, 0xdee2e6);
      this.list[this.list.length - 1].frenzyT = duration;
    }
    s.ring(s.player.x, s.player.y, 90, GHOST_TINT);
  }

  healAll() {
    for (const mn of this.list) mn.hp = mn.maxHp;
  }

  damage(mn, amount) {
    mn.hp -= amount;
    if (mn.hp <= 0) this.die(mn);
  }

  die(mn) {
    const s = this.scene;
    const p = this.profile();
    this.remove(mn);
    if (!p) return;
    const up = Math.max(0, s.tier - 2);
    // 리치: 시체 폭발 / 무덤의 왕: 원혼 폭풍
    if (p.explodeOnDeath) s.hero.blast(mn.x, mn.y, 70 + 10 * up, s.hero.baseDamage() * 1.2 * (1 + 0.25 * up), 80, 0xb197fc);
    if (p.storm) s.hero.blast(mn.x, mn.y, 140, s.hero.baseDamage(), 120, GHOST_TINT);
  }

  remove(mn) {
    this.list = this.list.filter((x) => x !== mn);
    this.scene.burst(mn.x, mn.y, GHOST_TINT);
  }

  update(dt) {
    const s = this.scene;
    const g = this.g;
    g.clear();
    const p = this.profile();
    if (!p) return;
    for (const mn of this.list) {
      const frenzy = mn.frenzyT > 0 ? 2 : 1;
      if (mn.frenzyT > 0) mn.frenzyT -= dt;
      const target = s.monsters.nearest(mn.x, mn.y, SEEK_RANGE);
      if (target) {
        const d = Math.hypot(target.x - mn.x, target.y - mn.y);
        const reach = mn.radius + target.def.radius + 2;
        if (d > reach) {
          const step = Math.min(p.speed * frenzy * dt, d - reach);
          mn.x += ((target.x - mn.x) / d) * step;
          mn.y += ((target.y - mn.y) / d) * step;
        } else {
          mn.attackTimer -= dt;
          if (mn.attackTimer <= 0) {
            mn.attackTimer = p.attackInterval / frenzy;
            s.monsters.beginAttack();
            s.monsters.damage(target, s.hero.baseDamage() * p.atkMul * (mn.elite ? 2 : 1), Math.atan2(target.y - mn.y, target.x - mn.x), 60);
          }
        }
      } else {
        const d = Math.hypot(s.player.x - mn.x, s.player.y - mn.y);
        if (d > FOLLOW_DIST) {
          const step = Math.min(p.speed * dt, d - FOLLOW_DIST);
          mn.x += ((s.player.x - mn.x) / d) * step;
          mn.y += ((s.player.y - mn.y) / d) * step;
        }
      }
      g.fillStyle(mn.color, 0.45).fillCircle(mn.x, mn.y, mn.radius);
      g.lineStyle(mn.elite ? 3 : 2, mn.elite ? 0xffd43b : GHOST_TINT, 0.9).strokeCircle(mn.x, mn.y, mn.radius);
      if (mn.frenzyT > 0) g.lineStyle(2, 0xff6b6b, 0.7).strokeCircle(mn.x, mn.y, mn.radius + 4);
      if (mn.hp < mn.maxHp) {
        g.fillStyle(0x000000, 0.6).fillRect(mn.x - 10, mn.y - mn.radius - 7, 20, 3);
        g.fillStyle(GHOST_TINT, 1).fillRect(mn.x - 10, mn.y - mn.radius - 7, 20 * Math.max(0, mn.hp / mn.maxHp), 3);
      }
    }
  }
}
