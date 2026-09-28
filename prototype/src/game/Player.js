const MAX_NEAR_CORE_DR = 0.75;
const SHOCK_RADIUS = 110;
const SHOCK_KNOCKBACK = 260;
const QUAKE_INTERVAL = 10;

const angleDiff = (a, b) => Math.abs(Phaser.Math.Angle.Wrap(a - b));

// 플레이어 이동·대시·직업 공격·스킬. 상태는 scene.player에 두고(HUD·몬스터가 읽음) 여기선 조작만.
export class Player {
  constructor(scene) {
    this.scene = scene;
    this.p = scene.player;
    this.lastDir = { x: 0, y: -1 };
    this.dashDir = { x: 0, y: -1 };
    this.dashTimer = 0;
    this.dashCd = 0;
    this.skillCd = 0;
    this.skillWindup = 0;
    this.quakeTimer = QUAKE_INTERVAL;
    this.tele = scene.add.graphics().setDepth(17);
  }

  get stats() {
    return this.scene.stats;
  }

  get cls() {
    return this.scene.cls;
  }

  // ---------- 이동 / 대시 ----------

  move(dt) {
    const s = this.scene;
    const p = this.p;
    const { world, dash } = s.db.balance;
    const v = s.joystick.read();
    const len = Math.hypot(v.x, v.y);
    if (len > 0) this.lastDir = { x: v.x / len, y: v.y / len };
    let speed = this.cls.moveSpeed * this.stats.moveMul;
    let dir = v;
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      speed *= dash.speedMul;
      dir = this.dashDir;
      s.afterimage(p.x, p.y, p.radius, 0x6fa8ff);
      if (this.dashTimer <= 0) s.playerSprite.setAlpha(1);
    }
    p.x = Phaser.Math.Clamp(p.x + dir.x * speed * dt, p.radius, world.width - p.radius);
    p.y = Phaser.Math.Clamp(p.y + dir.y * speed * dt, p.radius, world.height - p.radius);
    s.playerSprite.setPosition(p.x, p.y);
    if (p.invuln > 0) p.invuln -= dt;
    if (p.hurtFlash > 0) {
      p.hurtFlash -= dt;
      s.playerSprite.setFillStyle(p.hurtFlash > 0 ? 0xff4444 : s.classColor);
    }
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.skillCd > 0) this.skillCd -= dt;
  }

  tryDash() {
    const { dash } = this.scene.db.balance;
    if (this.dashCd > 0 || this.scene.paused) return false;
    this.dashDir = { ...this.lastDir };
    this.dashTimer = dash.time;
    this.dashCd = dash.cooldown * (this.stats.dashCdMul || 1);
    this.p.invuln = Math.max(this.p.invuln, dash.time + dash.invulnExtra);
    this.scene.playerSprite.setAlpha(0.6);
    return true;
  }

  // ---------- 공격 ----------

  combat(dt) {
    this.tele.clear();
    this.attack(dt);
    this.updateQuake(dt);
    this.updateSkill(dt);
  }

  attack(dt) {
    const s = this.scene;
    const p = this.p;
    p.attackTimer -= dt;
    if (p.attackTimer > 0) return;
    const target = s.monsters.nearest(p.x, p.y, this.cls.range);
    if (!target) return;
    p.attackTimer = this.cls.attackInterval / this.stats.aspdMul;
    ATTACKS[this.cls.attack].call(this, target);
    p.swings++;
    if (this.stats.shock > 0 && p.swings % 3 === 0) this.shockwave();
  }

  baseDamage() {
    return this.cls.atk * this.stats.atkMul;
  }

  shockwave() {
    const s = this.scene;
    const p = this.p;
    const dmg = this.baseDamage() * 0.5 * this.stats.shock;
    for (const m of s.monsters.alive()) {
      if (Math.hypot(m.x - p.x, m.y - p.y) > SHOCK_RADIUS + m.def.radius) continue;
      s.monsters.damage(m, dmg, Math.atan2(m.y - p.y, m.x - p.x), SHOCK_KNOCKBACK);
    }
    s.ring(p.x, p.y, SHOCK_RADIUS, 0x9ad0ff);
  }

  updateQuake(dt) {
    if (this.stats.quake <= 0) return;
    this.quakeTimer -= dt;
    if (this.quakeTimer > 0) return;
    this.quakeTimer = QUAKE_INTERVAL;
    for (const m of this.scene.monsters.alive()) m.frozen = Math.max(m.frozen, 1);
    this.scene.cameras.main.shake(250, 0.01);
    this.scene.ring(this.p.x, this.p.y, 400, 0xffd966);
  }

  // ---------- 스킬 ----------

  trySkill() {
    if (this.skillCd > 0 || this.skillWindup > 0 || this.scene.paused) return false;
    const skill = this.cls.skill;
    this.skillWindup = skill.windup;
    this.skillCd = skill.cooldown * (this.stats.skillCdMul || 1);
    return true;
  }

  updateSkill(dt) {
    if (this.skillWindup <= 0) return;
    const skill = this.cls.skill;
    this.skillWindup -= dt;
    const t = 1 - Math.max(0, this.skillWindup) / skill.windup;
    this.tele.lineStyle(3, 0xffffff, 0.7).strokeCircle(this.p.x, this.p.y, (skill.radius || 60) * t);
    if (this.skillWindup <= 0) SKILLS[skill.id].call(this, skill);
  }

  skillReadyRatio() {
    return this.skillCd > 0 ? 1 - this.skillCd / (this.cls.skill.cooldown * (this.stats.skillCdMul || 1)) : 1;
  }

  dashReadyRatio() {
    const { dash } = this.scene.db.balance;
    return this.dashCd > 0 ? 1 - this.dashCd / (dash.cooldown * (this.stats.dashCdMul || 1)) : 1;
  }

  // 코어 근처 피해 감소 등 받는 피해 보정
  incomingDamage(amount) {
    const s = this.scene;
    const nearCore = Math.hypot(this.p.x - s.core.x, this.p.y - s.core.y) < s.db.balance.nearCoreRadius;
    const dr = nearCore ? Math.min(MAX_NEAR_CORE_DR, this.stats.nearCoreDR) : 0;
    return amount * (1 - dr);
  }
}

// ---------- 직업별 기본 공격 ----------

function cone(target) {
  const s = this.scene;
  const p = this.p;
  const dir = Math.atan2(target.y - p.y, target.x - p.x);
  const half = Phaser.Math.DegToRad(this.stats.arcDeg / 2);
  const dmg = this.baseDamage();
  for (const m of s.monsters.alive()) {
    const d = Math.hypot(m.x - p.x, m.y - p.y);
    if (d > this.cls.range + m.def.radius) continue;
    if (d > 1 && angleDiff(Math.atan2(m.y - p.y, m.x - p.x), dir) > half) continue;
    s.monsters.damage(m, dmg, dir, this.cls.knockback);
  }
  s.swingFx(p.x, p.y, this.cls.range, dir, half);
}

const ATTACKS = { cone };

// ---------- 직업 스킬 ----------

function slam(skill) {
  const s = this.scene;
  const p = this.p;
  const dmg = this.baseDamage() * skill.damageMul;
  for (const m of s.monsters.alive()) {
    if (Math.hypot(m.x - p.x, m.y - p.y) > skill.radius + m.def.radius) continue;
    s.monsters.damage(m, dmg, Math.atan2(m.y - p.y, m.x - p.x), skill.knockback);
    if (!m.dead) m.frozen = Math.max(m.frozen, skill.stun);
  }
  s.ring(p.x, p.y, skill.radius, 0xffffff);
  s.cameras.main.shake(180, 0.012);
}

const SKILLS = { slam };
