const hex = (color) => parseInt(color.replace('#', ''), 16);
const DRONE_ORBIT = 40;
const RETRY = 0.3;

// 초보자의 기초 수련: 전직할 직업의 공격을 미리 맛보는 자동 공격. 전직하면 멈춘다.
export class TrainingRunner {
  constructor(scene) {
    this.scene = scene;
    this.timers = {};
    this.droneAngle = 0;
    this.g = scene.add.graphics().setDepth(16);
  }

  update(dt) {
    const s = this.scene;
    this.g.clear();
    if (s.classId !== 'novice') return;
    const skills = s.db.balance.training.skills;
    for (const [id, cfg] of Object.entries(skills)) {
      const lv = s.stats[id] || 0;
      if (!lv) continue;
      const i = Math.min(lv, 3) - 1;
      if (cfg.kind === 'drone') this.moveDrone(dt, cfg);
      this.timers[id] = (this.timers[id] ?? 0.5) - dt;
      if (this.timers[id] > 0) continue;
      this.timers[id] = this.fire(cfg, i) ? cfg.interval[i] : RETRY;
    }
  }

  moveDrone(dt, cfg) {
    const p = this.scene.player;
    this.droneAngle += dt * 2.4;
    this.drone = { x: p.x + Math.cos(this.droneAngle) * DRONE_ORBIT, y: p.y + Math.sin(this.droneAngle) * DRONE_ORBIT };
    this.g.fillStyle(hex(cfg.color), 1).fillCircle(this.drone.x, this.drone.y, 6);
  }

  // 발사했으면 true (대상이 없으면 잠시 뒤 다시 시도)
  fire(cfg, i) {
    const s = this.scene;
    const p = s.player;
    const base = s.hero.baseDamage() * cfg.damageMul[i];
    const color = hex(cfg.color);
    const from = cfg.kind === 'drone' && this.drone ? this.drone : p;
    if (cfg.kind === 'spin') {
      if (!s.monsters.nearest(p.x, p.y, cfg.radius[i])) return false;
      s.hero.blast(p.x, p.y, cfg.radius[i], base, cfg.knockback, color);
      s.hero.startSwing(s.hero.facing, s.hero.facing + Math.PI * 2, 0.22);
      return true;
    }
    const target = s.monsters.nearest(from.x, from.y, cfg.range);
    if (!target) return false;
    const dir = Math.atan2(target.y - from.y, target.x - from.x);
    if (cfg.kind === 'blast') {
      s.hero.blast(target.x, target.y, cfg.radius[i], base, 60, color);
    } else {
      s.projectiles.fireShot(from.x, from.y, dir, cfg.speed || 480, {
        base, pierce: cfg.pierce || 0, knockback: 40, maxDist: cfg.range * 1.1, color, size: cfg.kind === 'wave' ? 1.6 : 1,
      });
    }
    return true;
  }
}
