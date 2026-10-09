export class TurretManager {
  constructor(scene, balance) {
    this.scene = scene;
    this.balance = balance;
    this.turrets = [];
    this.turretGroup = scene.add.group();
    this.projectileGroup = scene.add.group();

    this.TURRET_TYPES = {
      basic: { cost: 50, range: 150, damage: 5, fireRate: 0.5, color: 0x4cc9f0 },
      cannon: { cost: 100, range: 200, damage: 12, fireRate: 1.5, color: 0xff6b35 },
      laser: { cost: 75, range: 250, damage: 8, fireRate: 0.3, color: 0xf72585 },
    };
  }

  createTurret(x, y, type = 'basic') {
    const cfg = this.TURRET_TYPES[type];
    if (!cfg) return null;

    const turret = {
      x,
      y,
      type,
      range: cfg.range,
      damage: cfg.damage,
      fireRate: cfg.fireRate,
      lastFired: 0,
      sprite: this.scene.add.circle(x, y, 12, cfg.color),
      rangeCircle: this.scene.add.graphics(),
    };

    turret.rangeCircle.lineStyle(1, cfg.color, 0.3);
    turret.rangeCircle.strokeCircleShape(new Phaser.Geom.Circle(x, y, cfg.range));

    this.turrets.push(turret);
    this.turretGroup.add(turret.sprite);
    return turret;
  }

  update(time, monsters) {
    this.turrets.forEach(turret => {
      const target = this.findTarget(turret, monsters);
      if (target && time > turret.lastFired + turret.fireRate * 1000) {
        this.fire(turret, target);
        turret.lastFired = time;
      }
    });
  }

  findTarget(turret, monsters) {
    let closest = null;
    let minDist = turret.range;

    monsters.forEach(m => {
      const dist = Phaser.Math.Distance.Between(turret.x, turret.y, m.x, m.y);
      if (dist < minDist) {
        minDist = dist;
        closest = m;
      }
    });

    return closest;
  }

  fire(turret, target) {
    const projectile = this.scene.add.circle(turret.x, turret.y, 3, 0xffd700);
    projectile.target = target;
    projectile.damage = turret.damage;
    projectile.speed = 300;
    this.projectileGroup.add(projectile);
  }

  updateProjectiles(monsters) {
    this.projectileGroup.children.entries.forEach(proj => {
      if (!proj.active) return;

      const speed = proj.speed || 300;
      const dist = Phaser.Math.Distance.Between(proj.x, proj.y, proj.target.x, proj.target.y);

      if (dist < 10) {
        proj.target.hp -= proj.damage;
        proj.destroy();
      } else {
        const angle = Phaser.Math.Angle.Between(proj.x, proj.y, proj.target.x, proj.target.y);
        proj.x += Math.cos(angle) * speed * (1 / 60);
        proj.y += Math.sin(angle) * speed * (1 / 60);
      }
    });
  }

  removeTurret(turret) {
    const idx = this.turrets.indexOf(turret);
    if (idx >= 0) {
      turret.sprite.destroy();
      turret.rangeCircle.destroy();
      this.turrets.splice(idx, 1);
    }
  }

  getTurrets() {
    return this.turrets;
  }

  destroy() {
    this.turrets.forEach(t => {
      t.sprite.destroy();
      t.rangeCircle.destroy();
    });
    this.projectileGroup.destroy(true);
    this.turretGroup.destroy(true);
  }
}
