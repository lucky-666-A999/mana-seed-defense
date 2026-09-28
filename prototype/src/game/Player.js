import { critRoll, segmentDistance } from '../systems/Combat.js';

const MAX_NEAR_CORE_DR = 0.75;
const SHOCK_RADIUS = 110;
const SHOCK_KNOCKBACK = 260;
const QUAKE_INTERVAL = 10;
const CHAIN_BLAST_RADIUS = 50;
const BURN_SECONDS = 3;
const HASTE_SECONDS = 3;
const SPREAD = Phaser.Math.DegToRad(12);

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
    this.hasteTimer = 0;
    this.zones = [];
    this.pendingBlasts = [];
    this.tele = scene.add.graphics().setDepth(17);
  }

  get stats() {
    return this.scene.stats;
  }

  get cls() {
    return this.scene.cls;
  }

  hpRatio() {
    return this.p.hp / this.scene.maxHp();
  }

  // ---------- 이동 / 대시 ----------

  move(dt) {
    const s = this.scene;
    const p = this.p;
    const { world, dash } = s.db.balance;
    const v = s.joystick.read();
    const len = Math.hypot(v.x, v.y);
    if (len > 0) this.lastDir = { x: v.x / len, y: v.y / len };
    let speed = this.cls.moveSpeed * this.stats.moveMul * (this.hasteTimer > 0 ? 1 + this.stats.killHaste : 1);
    let dir = v;
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      speed *= dash.speedMul;
      dir = this.dashDir;
      s.afterimage(p.x, p.y, p.radius, s.classColor);
      if (this.dashTimer <= 0) s.playerSprite.setAlpha(1);
    }
    const ox = p.x;
    const oy = p.y;
    p.x = Phaser.Math.Clamp(p.x + dir.x * speed * dt, p.radius, world.width - p.radius);
    p.y = Phaser.Math.Clamp(p.y + dir.y * speed * dt, p.radius, world.height - p.radius);
    if (this.dashTimer > 0 && this.stats.dashDamage) this.sweep(ox, oy, p.x, p.y, p.radius * 2, this.baseDamage() * this.stats.dashDamage, 80);
    s.playerSprite.setPosition(p.x, p.y);
    if (p.invuln > 0) p.invuln -= dt;
    if (p.hurtFlash > 0) {
      p.hurtFlash -= dt;
      s.playerSprite.setFillStyle(p.hurtFlash > 0 ? 0xff4444 : s.classColor);
    }
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.skillCd > 0) this.skillCd -= dt;
    if (this.hasteTimer > 0) this.hasteTimer -= dt;
  }

  dashCooldown() {
    return this.scene.db.balance.dash.cooldown * Math.max(0.2, this.stats.dashCdMul);
  }

  tryDash() {
    const { dash } = this.scene.db.balance;
    if (this.dashCd > 0 || this.scene.paused) return false;
    this.dashDir = { ...this.lastDir };
    this.dashTimer = dash.time;
    this.dashCd = this.dashCooldown();
    this.p.invuln = Math.max(this.p.invuln, dash.time + dash.invulnExtra);
    this.scene.playerSprite.setAlpha(0.6);
    this.sweepHit = new Set();
    if (this.attackMod() === 'blinkStrike') this.blinkReady = true;
    return true;
  }

  // ---------- 피해 공통 ----------

  baseDamage() {
    const st = this.stats;
    let mul = st.atkMul;
    if (st.lastStand && this.hpRatio() <= 0.3) mul *= 1 + st.lastStand;
    if (st.berserkAtk && this.hpRatio() <= 0.5) mul *= 1 + st.berserkAtk;
    return this.cls.atk * mul;
  }

  // 치명·정예 보너스·화상까지 적용해 한 대 때린다
  hit(m, base, dir, knockback) {
    if (m.dead) return;
    const st = this.stats;
    let { dmg, crit } = critRoll(base, st.critChance, st.critMul);
    if (m.def.elite || m.def.boss) dmg *= 1 + st.eliteDmg;
    this.scene.monsters.damage(m, dmg, dir, knockback, crit);
    if (st.burn && !m.dead) {
      m.burnDps = base * st.burn;
      m.burnT = BURN_SECONDS;
    }
  }

  blast(x, y, radius, base, knockback, color = 0xc77dff) {
    const s = this.scene;
    s.monsters.beginAttack();
    for (const m of s.monsters.alive()) {
      if (Math.hypot(m.x - x, m.y - y) > radius + m.def.radius) continue;
      this.hit(m, base, Math.atan2(m.y - y, m.x - x), knockback);
    }
    s.blastFx(x, y, radius, color);
  }

  // 선분 위 적 공격 (질풍 베기·그림자 대시). 같은 적은 한 번만.
  sweep(ax, ay, bx, by, width, base, knockback) {
    const s = this.scene;
    s.monsters.beginAttack();
    const dir = Math.atan2(by - ay, bx - ax);
    for (const m of s.monsters.alive()) {
      if (this.sweepHit?.has(m)) continue;
      if (segmentDistance(m.x, m.y, ax, ay, bx, by) > width / 2 + m.def.radius) continue;
      this.sweepHit?.add(m);
      this.hit(m, base, dir, knockback);
    }
  }

  onKill(m) {
    if (this.stats.chainBlast) this.pendingBlasts.push({ x: m.x, y: m.y });
    if (this.stats.killHaste) this.hasteTimer = HASTE_SECONDS;
  }

  // ---------- 공격 ----------

  combat(dt) {
    this.tele.clear();
    this.drawAura();
    this.updateEchoes(dt);
    // 연쇄 폭발은 다음 프레임에 터뜨려 연쇄가 한 프레임에 폭주하지 않게
    const blasts = this.pendingBlasts;
    this.pendingBlasts = [];
    for (const b of blasts) this.blast(b.x, b.y, CHAIN_BLAST_RADIUS * this.stats.aoeMul, this.baseDamage() * 0.5, 60, 0xff9f68);
    this.attack(dt);
    this.updateQuake(dt);
    this.updateSkill(dt);
    this.updateZones(dt);
  }

  // 전직 오라: 전직마다 고유 색. 광전사는 광전 상태에서 맥동, 저격수는 사거리 원
  drawAura() {
    const spec = this.scene.spec;
    if (!spec) return;
    const color = parseInt(spec.color.replace('#', ''), 16);
    const p = this.p;
    const pulse = spec.id === 'berserker' && this.hpRatio() <= 0.5 ? 0.5 + 0.5 * Math.sin(this.scene.time.now / 90) : 0.7;
    this.tele.lineStyle(3, color, pulse).strokeCircle(p.x, p.y, p.radius + 6);
    if (spec.id === 'sniper') this.tele.lineStyle(1, color, 0.18).strokeCircle(p.x, p.y, this.range());
  }

  updateEchoes(dt) {
    if (!this.echoes?.length) return;
    for (const e of this.echoes) {
      e.t -= dt;
      if (e.t <= 0) this.blast(e.x, e.y, e.radius, e.base, 60, 0xb197fc);
    }
    this.echoes = this.echoes.filter((e) => e.t > 0);
  }

  swingColor() {
    return this.scene.spec ? parseInt(this.scene.spec.color.replace('#', ''), 16) : 0xffffff;
  }

  range() {
    return this.cls.range * this.stats.rangeMul;
  }

  attackInterval() {
    let aspd = this.stats.aspdMul;
    if (this.stats.berserkAspd && this.hpRatio() <= 0.5) aspd *= 1 + this.stats.berserkAspd;
    return (this.cls.attackInterval / aspd) * this.stats.intervalMul;
  }

  attack(dt) {
    const s = this.scene;
    const p = this.p;
    p.attackTimer -= dt;
    if (p.attackTimer > 0) return;
    const target = s.monsters.nearest(p.x, p.y, this.range());
    if (!target) return;
    p.attackTimer = this.attackInterval();
    const third = p.swings % 3 === 2;
    const mod = this.attackMod();
    if (mod === 'blinkStrike' && this.blinkReady) blinkStrike.call(this, target);
    else if (mod === 'comboFinisher' && third) spinSlash.call(this);
    else if (mod === 'chargedShot' && third) chargedShot.call(this, target);
    else ATTACKS[this.cls.attack].call(this, target);
    if (mod === 'guardWave' && third) guardWave.call(this);
    p.swings++;
    if (this.stats.shock > 0 && p.swings % 3 === 0) this.shockwave();
  }

  shockwave() {
    const p = this.p;
    this.scene.monsters.beginAttack();
    const base = this.baseDamage() * 0.5 * this.stats.shock;
    for (const m of this.scene.monsters.alive()) {
      if (Math.hypot(m.x - p.x, m.y - p.y) > SHOCK_RADIUS + m.def.radius) continue;
      this.hit(m, base, Math.atan2(m.y - p.y, m.x - p.x), SHOCK_KNOCKBACK);
    }
    this.scene.ring(p.x, p.y, SHOCK_RADIUS, 0x9ad0ff);
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

  // 직업 스킬 + 전직 스킬 강화(skillMod) 합산
  skill() {
    const merged = { ...this.cls.skill };
    for (const [k, v] of Object.entries(this.scene.spec?.skillMod || {})) merged[k] = (merged[k] || 0) + v;
    return merged;
  }

  attackMod() {
    return this.scene.spec?.attackMod || null;
  }

  skillCooldown() {
    return this.cls.skill.cooldown * Math.max(0.2, this.stats.skillCdMul);
  }

  trySkill() {
    if (this.skillCd > 0 || this.skillWindup > 0 || this.scene.paused) return false;
    const skill = this.skill();
    this.skillCd = this.skillCooldown();
    if (this.stats.coreShield) this.scene.shieldCore(this.stats.coreShield);
    if (skill.windup > 0) this.skillWindup = skill.windup;
    else this.castSkill(skill);
    return true;
  }

  updateSkill(dt) {
    if (this.skillWindup <= 0) return;
    const skill = this.skill();
    this.skillWindup -= dt;
    const t = 1 - Math.max(0, this.skillWindup) / skill.windup;
    this.tele.lineStyle(3, 0xffffff, 0.7).strokeCircle(this.p.x, this.p.y, (skill.radius || 60) * t);
    if (this.skillWindup <= 0) this.castSkill(skill);
  }

  castSkill(skill) {
    SKILLS[skill.id].call(this, skill);
    if (this.attackMod() === 'fireGround') this.fireZone(this.p.x, this.p.y, skill.radius || 120);
  }

  fireZone(x, y, radius) {
    this.zones.push({ x, y, radius, base: this.baseDamage() * 0.3, every: 0.5, left: 4, t: 0, color: 0xff922b });
  }

  updateZones(dt) {
    for (const z of this.zones) {
      z.t += dt;
      const color = z.color || 0x9be15d;
      this.tele.lineStyle(2, color, 0.8).strokeCircle(z.x, z.y, z.radius);
      if (z.color) this.tele.fillStyle(color, 0.15).fillCircle(z.x, z.y, z.radius);
      while (z.t >= z.every && z.left > 0) {
        z.t -= z.every;
        z.left--;
        this.blast(z.x, z.y, z.radius, z.base, z.color ? 0 : 30, color);
      }
    }
    this.zones = this.zones.filter((z) => z.left > 0);
  }

  skillReadyRatio() {
    return this.skillCd > 0 ? 1 - this.skillCd / this.skillCooldown() : 1;
  }

  dashReadyRatio() {
    return this.dashCd > 0 ? 1 - this.dashCd / this.dashCooldown() : 1;
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
  s.monsters.beginAttack();
  const dir = Math.atan2(target.y - p.y, target.x - p.x);
  const half = Phaser.Math.DegToRad(this.stats.arcDeg / 2);
  const base = this.baseDamage();
  const range = this.range();
  for (const m of s.monsters.alive()) {
    const d = Math.hypot(m.x - p.x, m.y - p.y);
    if (d > range + m.def.radius) continue;
    if (d > 1 && angleDiff(Math.atan2(m.y - p.y, m.x - p.x), dir) > half) continue;
    this.hit(m, base, dir, this.cls.knockback);
  }
  s.swingFx(p.x, p.y, range, dir, half, this.swingColor());
  if (this.stats.swordWave) {
    s.projectiles.fireShot(p.x, p.y, dir, 420, { base: base * 0.6, pierce: 2, knockback: 30, maxDist: 200, color: 0xffd0a8 });
  }
}

function projectile(target) {
  const s = this.scene;
  const p = this.p;
  const dir = Math.atan2(target.y - p.y, target.x - p.x);
  const shots = 1 + this.stats.extraShots;
  for (let i = 0; i < shots; i++) {
    const offset = (i - (shots - 1) / 2) * SPREAD;
    s.projectiles.fireShot(p.x, p.y, dir + offset, this.cls.shotSpeed, {
      base: this.baseDamage(), pierce: this.stats.pierce, knockback: this.cls.knockback,
      maxDist: this.range() * 1.15, explodeRadius: this.stats.explodeRadius, color: 0xd8ffb0,
    });
  }
}

function blast(target) {
  const radius = this.cls.blastRadius * this.stats.aoeMul;
  this.blast(target.x, target.y, radius, this.baseDamage(), this.cls.knockback, this.scene.spec ? this.swingColor() : 0xc77dff);
  const mod = this.attackMod();
  if (mod === 'echoBlast') (this.echoes ||= []).push({ x: target.x, y: target.y, radius, base: this.baseDamage() * 0.6, t: 0.35 });
  if (mod === 'fireGround') this.fireZone(target.x, target.y, radius);
}

// ---------- 전직 공격 변화 ----------

function spinSlash() {
  const s = this.scene;
  const p = this.p;
  const radius = this.range() * 1.4;
  s.monsters.beginAttack();
  for (const m of s.monsters.alive()) {
    if (Math.hypot(m.x - p.x, m.y - p.y) > radius + m.def.radius) continue;
    this.hit(m, this.baseDamage() * 2, Math.atan2(m.y - p.y, m.x - p.x), 160);
  }
  s.swingFx(p.x, p.y, radius, 0, Math.PI, this.swingColor());
  s.cameras.main.shake(80, 0.004);
}

function chargedShot(target) {
  const s = this.scene;
  const p = this.p;
  s.projectiles.fireShot(p.x, p.y, Math.atan2(target.y - p.y, target.x - p.x), 900, {
    base: this.baseDamage() * 2.5, pierce: 99, knockback: 120, maxDist: this.range() * 1.4, color: 0xffd43b, size: 2.2,
  });
}

function blinkStrike(target) {
  const s = this.scene;
  const p = this.p;
  this.blinkReady = false;
  const dir = Math.atan2(target.y - p.y, target.x - p.x);
  s.afterimage(p.x, p.y, p.radius, s.classColor);
  p.x = target.x + Math.cos(dir) * (target.def.radius + p.radius + 4);
  p.y = target.y + Math.sin(dir) * (target.def.radius + p.radius + 4);
  s.playerSprite.setPosition(p.x, p.y);
  s.monsters.beginAttack();
  this.hit(target, this.baseDamage() * 2, dir, 120);
  s.swingFx(p.x, p.y, 50, dir + Math.PI, 0.9, this.swingColor());
}

function guardWave() {
  const s = this.scene;
  const p = this.p;
  s.monsters.beginAttack();
  for (const m of s.monsters.alive()) {
    if (Math.hypot(m.x - p.x, m.y - p.y) > 110 + m.def.radius) continue;
    this.hit(m, this.baseDamage() * 0.3, Math.atan2(m.y - p.y, m.x - p.x), 260);
  }
  s.ring(p.x, p.y, 110, this.swingColor());
}

const ATTACKS = { cone, projectile, blast };

// ---------- 직업 스킬 ----------

function slam(skill) {
  const s = this.scene;
  const p = this.p;
  s.monsters.beginAttack();
  const base = this.baseDamage() * skill.damageMul;
  for (const m of s.monsters.alive()) {
    if (Math.hypot(m.x - p.x, m.y - p.y) > skill.radius + m.def.radius) continue;
    this.hit(m, base, Math.atan2(m.y - p.y, m.x - p.x), skill.knockback);
    if (!m.dead) m.frozen = Math.max(m.frozen, skill.stun);
  }
  s.ring(p.x, p.y, skill.radius, 0xffffff);
  s.cameras.main.shake(180, 0.012);
}

function galeSlash(skill) {
  const s = this.scene;
  const p = this.p;
  const { world } = s.db.balance;
  const nearest = s.monsters.nearest(p.x, p.y, skill.distance);
  const dir = nearest ? Math.atan2(nearest.y - p.y, nearest.x - p.x) : Math.atan2(this.lastDir.y, this.lastDir.x);
  const ax = p.x;
  const ay = p.y;
  p.x = Phaser.Math.Clamp(p.x + Math.cos(dir) * skill.distance, p.radius, world.width - p.radius);
  p.y = Phaser.Math.Clamp(p.y + Math.sin(dir) * skill.distance, p.radius, world.height - p.radius);
  p.invuln = Math.max(p.invuln, 0.3);
  this.sweepHit = new Set();
  this.sweep(ax, ay, p.x, p.y, skill.width, this.baseDamage() * skill.damageMul, skill.knockback);
  for (let i = 0; i <= 6; i++) s.afterimage(ax + ((p.x - ax) * i) / 6, ay + ((p.y - ay) * i) / 6, p.radius, s.classColor);
  s.playerSprite.setPosition(p.x, p.y);
  s.cameras.main.shake(120, 0.008);
}

function arrowRain(skill) {
  const p = this.p;
  const target = this.scene.monsters.nearest(p.x, p.y, 420);
  const x = target ? target.x : p.x + this.lastDir.x * 150;
  const y = target ? target.y : p.y + this.lastDir.y * 150;
  this.zones.push({
    x, y, radius: skill.radius * this.stats.aoeMul, base: this.baseDamage() * skill.damageMul,
    every: skill.duration / skill.ticks, left: skill.ticks, t: 0,
  });
}

function manaBurst(skill) {
  this.blast(this.p.x, this.p.y, skill.radius * this.stats.aoeMul, this.baseDamage() * skill.damageMul, skill.knockback);
  this.scene.cameras.main.shake(220, 0.014);
}

const SKILLS = { slam, galeSlash, arrowRain, manaBurst };
