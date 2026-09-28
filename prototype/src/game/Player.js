import { critRoll, segmentDistance } from '../systems/Combat.js';
import { Combo, comboProfile, comboAspd, crossed, IRON_BODY_AT } from '../systems/Combo.js';

const MAX_NEAR_CORE_DR = 0.75;
const SHOCK_RADIUS = 110;
const SHOCK_KNOCKBACK = 260;
const QUAKE_INTERVAL = 10;
const CHAIN_BLAST_RADIUS = 50;
const BURN_SECONDS = 3;
const HASTE_SECONDS = 3;
const SPREAD = Phaser.Math.DegToRad(12);
const SHIELD_HALF = Phaser.Math.DegToRad(45);
const QIGONG_RANGE = 340;
const WHITE_HEAT_RADIUS = 160;

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
    this.weaponG = scene.add.graphics().setDepth(11);
    this.facing = -Math.PI / 2;
    this.swing = null;
    this.combo = new Combo();
    this.comboPop = 0;
    this.comboFx = [];
    this.flurries = [];
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
    if (len > 0 && !this.swing) this.facing = Math.atan2(v.y, v.x);
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
    this.drawWeapon(dt);
  }

  // ---------- 무기 모션 ----------

  // 공격 모션 시작: from→to 각도로 duration초 동안 휘두른다
  startSwing(from, to, duration = 0.15) {
    this.swing = { from, to, t: 0, duration };
  }

  drawWeapon(dt) {
    const g = this.weaponG;
    const p = this.p;
    g.clear();
    let angle = this.facing;
    let pull = 0;
    if (this.swing) {
      this.swing.t += dt;
      const k = Math.min(1, this.swing.t / this.swing.duration);
      angle = this.swing.from + (this.swing.to - this.swing.from) * k;
      pull = Math.sin(k * Math.PI);
      if (k >= 1) {
        this.facing = this.swing.to;
        this.swing = null;
      }
    }
    const spec = this.scene.spec;
    const accent = spec ? parseInt(spec.color.replace('#', ''), 16) : 0xffffff;
    const cx = p.x + Math.cos(angle) * (p.radius - 2);
    const cy = p.y + Math.sin(angle) * (p.radius - 2);
    const tip = (len) => ({ x: cx + Math.cos(angle) * len, y: cy + Math.sin(angle) * len });
    if (this.ascended() >= 1) {
      const t = tip(30);
      g.lineStyle(8 + this.ascended() * 4, accent, 0.25).lineBetween(cx, cy, t.x, t.y);
    }
    switch (this.cls.weaponStyle) {
      case 'stick': {
        const t = tip(20);
        g.lineStyle(4, 0xc8a27a, 1).lineBetween(cx, cy, t.x, t.y);
        break;
      }
      case 'club': {
        const t = tip(26);
        g.lineStyle(7, 0x8d5a3b, 1).lineBetween(cx, cy, t.x, t.y);
        g.fillStyle(spec ? accent : 0x6b4226, 1).fillCircle(t.x, t.y, 7);
        break;
      }
      case 'blade': {
        const t = tip(34);
        const gx = Math.cos(angle + Math.PI / 2) * 7;
        const gy = Math.sin(angle + Math.PI / 2) * 7;
        g.lineStyle(3, spec ? accent : 0xe9ecef, 1).lineBetween(cx, cy, t.x, t.y);
        g.lineStyle(3, 0x868e96, 1).lineBetween(cx - gx, cy - gy, cx + gx, cy + gy);
        break;
      }
      case 'bow': {
        const r = 15;
        const bx = p.x + Math.cos(angle) * (p.radius + 2);
        const by = p.y + Math.sin(angle) * (p.radius + 2);
        g.lineStyle(3, spec ? accent : 0x9be15d, 1);
        g.beginPath();
        g.arc(bx, by, r, angle - 1.2, angle + 1.2);
        g.strokePath();
        const sx = bx + Math.cos(angle - 1.2) * r;
        const sy = by + Math.sin(angle - 1.2) * r;
        const ex = bx + Math.cos(angle + 1.2) * r;
        const ey = by + Math.sin(angle + 1.2) * r;
        const mx = bx - Math.cos(angle) * (4 + pull * 8);
        const my = by - Math.sin(angle) * (4 + pull * 8);
        g.lineStyle(1, 0xffffff, 0.9).lineBetween(sx, sy, mx, my).lineBetween(mx, my, ex, ey);
        break;
      }
      case 'wrench': {
        const t = tip(22);
        g.lineStyle(5, 0xadb5bd, 1).lineBetween(cx, cy, t.x, t.y);
        const jaw = (d) => ({ x: t.x + Math.cos(angle + d) * 8, y: t.y + Math.sin(angle + d) * 8 });
        const a = jaw(0.6);
        const b = jaw(-0.6);
        g.lineStyle(4, spec ? accent : 0xffa94d, 1).lineBetween(t.x, t.y, a.x, a.y).lineBetween(t.x, t.y, b.x, b.y);
        break;
      }
      case 'skullStaff': {
        const t = tip(28 + pull * 4);
        g.lineStyle(3, 0x5f3dc4, 1).lineBetween(cx, cy, t.x, t.y);
        g.fillStyle(0xe9ecef, 1).fillCircle(t.x, t.y, 6);
        g.fillStyle(0x1b1230, 1).fillCircle(t.x - 2, t.y - 1, 1.5).fillCircle(t.x + 2, t.y - 1, 1.5);
        if (spec) g.lineStyle(2, accent, 0.8).strokeCircle(t.x, t.y, 9);
        break;
      }
      case 'fists': {
        // 좌우 주먹이 번갈아 뻗는다
        const lead = this.p.swings % 2 ? 1 : -1;
        for (const k of [-1, 1]) {
          const reach = p.radius + 3 + (k === lead ? pull * 16 : 0);
          const fx = p.x + Math.cos(angle) * reach + Math.cos(angle + Math.PI / 2) * k * 8;
          const fy = p.y + Math.sin(angle) * reach + Math.sin(angle + Math.PI / 2) * k * 8;
          g.fillStyle(spec ? accent : 0xc92a2a, 1).fillCircle(fx, fy, 5.5);
          g.lineStyle(1.5, 0xffffff, 0.8).strokeCircle(fx, fy, 5.5);
        }
        break;
      }
      case 'staff': {
        const t = tip(28 + pull * 6);
        g.lineStyle(3, 0xa07ae0, 1).lineBetween(cx, cy, t.x, t.y);
        g.fillStyle(spec ? accent : 0xc77dff, 1).fillCircle(t.x, t.y, 6 + pull * 3);
        break;
      }
      default:
        break;
    }
    // 수호자: 정면 방패 (적 탄환을 막는다)
    if (this.attackMod() === 'shieldBash') {
      g.lineStyle(6, accent, 0.9);
      g.beginPath();
      g.arc(p.x, p.y, p.radius + 12, this.facing - this.shieldHalf(), this.facing + this.shieldHalf());
      g.strokePath();
    }
  }

  // 수호자 방패가 정면에서 오는 탄환을 막는가
  shieldBlocks(x, y) {
    if (this.attackMod() !== 'shieldBash') return false;
    const d = Math.hypot(x - this.p.x, y - this.p.y);
    if (d > this.p.radius + 22) return false;
    return angleDiff(Math.atan2(y - this.p.y, x - this.p.x), this.facing) <= this.shieldHalf();
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
    if (this.comboOn()) this.addCombo();
    // 리치: 저주 — 맞은 적은 3초간 받는 피해 증가
    const curse = this.attackMod() === 'lich' ? this.scene.minions.profile()?.curse : 0;
    if (curse && !m.dead) {
      m.curseT = 3;
      m.curseMul = curse;
    }
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
    this.updateCombo(dt);
    this.updateFlurries(dt);
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
    const up = this.ascended();
    const pulse = spec.id === 'berserker' && this.hpRatio() <= 0.5 ? 0.5 + 0.5 * Math.sin(this.scene.time.now / 90) : 0.7;
    this.tele.lineStyle(3 + up, color, pulse).strokeCircle(p.x, p.y, p.radius + 6 + up * 3);
    if (up >= 1) this.tele.lineStyle(2, color, 0.25 + 0.1 * Math.sin(this.scene.time.now / 200)).strokeCircle(p.x, p.y, p.radius + 16 + up * 4);
    if (up >= 3 && Math.random() < 0.3) this.scene.burst(p.x + (Math.random() - 0.5) * 30, p.y + (Math.random() - 0.5) * 30, color);
    if (spec.id === 'sniper') this.tele.lineStyle(1, color, 0.18).strokeCircle(p.x, p.y, this.range());
  }

  // 5차 각성: 3타마다 전직 색의 파동
  awakenNova() {
    const s = this.scene;
    const color = this.swingColor();
    this.blast(this.p.x, this.p.y, 130, this.baseDamage(), 180, color);
    s.ring(this.p.x, this.p.y, 150, color);
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
    if (this.comboOn()) aspd *= 1 + comboAspd(this.combo.count, this.comboProfile());
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
    const dir = Math.atan2(target.y - p.y, target.x - p.x);
    if (mod === 'blinkStrike' && this.blinkReady) blinkStrike.call(this, target);
    else if (mod === 'whirlwind') whirlwind.call(this);
    else if (mod === 'comboFinisher' && third) spinSlash.call(this);
    else if (mod === 'chargedShot' && third) chargedShot.call(this, target);
    else ATTACKS[this.cls.attack].call(this, target);
    if (mod === 'afterimage' && third) this.cloneFlurry(target.x, target.y, 1, 0.15);
    if (!this.swing) this.startSwing(dir, dir, 0.18);
    if (this.scene.tier >= 5 && third) this.awakenNova();
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

  // 3차 이상 오른 단계 수 (0~3)
  ascended() {
    return Math.max(0, (this.scene.tier || 0) - 2);
  }

  sig() {
    return this.scene.sigMul();
  }

  shieldHalf() {
    return SHIELD_HALF + Phaser.Math.DegToRad(10) * this.ascended();
  }

  skillCooldown() {
    return this.cls.skill.cooldown * Math.max(0.2, this.stats.skillCdMul);
  }

  trySkill() {
    if (this.skillCd > 0 || this.skillWindup > 0 || this.scene.paused) return false;
    const skill = this.skill();
    this.skillCd = this.skillCooldown();
    // 기계학자: 준비 단계에선 포탑을 쿨다운 없이 자유 배치
    if (skill.id === 'deployTurret' && this.scene.run.state === 'prep') this.skillCd = 0;
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
    this.zones.push({ x, y, radius, base: this.baseDamage() * 0.3 * this.sig(), every: 0.5, left: 4 + 2 * this.ascended(), t: 0, color: 0xff922b });
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
    const iron = this.comboOn() && this.combo.count >= IRON_BODY_AT ? this.comboProfile().ironBody : 0;
    return amount * (1 - dr) * (1 - iron);
  }

  // ---------- 무투가 콤보 ----------

  // 무투가, 또는 권법 수련 중인 초보자
  comboOn() {
    const s = this.scene;
    return Boolean(this.cls.combo || (s.classId === 'novice' && s.stats.trainFist));
  }

  comboProfile() {
    const s = this.scene;
    return comboProfile(s.db.classes.monk.combo, s.spec, s.tier, s.stats);
  }

  // 장풍·백열권은 다음 프레임에 (그 타격이 다시 콤보를 올려 한 프레임에 폭주하지 않게)
  addCombo() {
    const p = this.comboProfile();
    const before = this.combo.add();
    this.comboPop = 0.12;
    for (let i = crossed(before, this.combo.count, p.waveEvery); i > 0; i--) this.comboFx.push('wave');
    if (crossed(before, this.combo.count, p.burstEvery)) this.comboFx.push('burst');
  }

  onHurt() {
    if (this.comboOn()) this.combo.hurt();
  }

  updateCombo(dt) {
    if (this.comboPop > 0) this.comboPop -= dt;
    if (!this.comboOn()) {
      this.combo.count = 0;
      return;
    }
    this.combo.tick(dt, this.comboProfile().window);
    const fx = this.comboFx;
    this.comboFx = [];
    for (const kind of fx) (kind === 'wave' ? this.qigongWave() : this.whiteHeat());
  }

  // 기공사: 앞으로 관통 장풍
  qigongWave() {
    const s = this.scene;
    const p = this.p;
    const target = s.monsters.nearest(p.x, p.y, QIGONG_RANGE);
    const dir = target ? Math.atan2(target.y - p.y, target.x - p.x) : this.facing;
    const n = this.comboProfile().waves;
    for (let i = 0; i < n; i++) {
      s.projectiles.fireShot(p.x, p.y, dir + (i - (n - 1) / 2) * SPREAD * 1.4, 460, {
        base: this.baseDamage() * 1.5 * this.sig(), pierce: 99, knockback: 80, maxDist: QIGONG_RANGE, color: this.swingColor(), size: 2.4,
      });
    }
    this.startSwing(dir, dir, 0.18);
    s.ring(p.x, p.y, 34, this.swingColor());
  }

  // 백열권: 50콤보마다 주변 대폭발
  whiteHeat() {
    const s = this.scene;
    const p = this.p;
    this.blast(p.x, p.y, WHITE_HEAT_RADIUS, this.baseDamage() * 3, 200, 0xffd43b);
    s.ring(p.x, p.y, WHITE_HEAT_RADIUS + 20, 0xffd43b);
    s.cameras.main.shake(200, 0.012);
    s.floatText(p.x, p.y - 44, '백열권!', '#ffd43b');
  }

  // 연타: follow면 플레이어 앞, 아니면 그 자리(잔상)에서 every초마다 한 대씩
  updateFlurries(dt) {
    const s = this.scene;
    const p = this.p;
    for (const f of this.flurries) {
      if (f.delay > 0) {
        f.delay -= dt;
        continue;
      }
      f.t += dt;
      while (f.t >= f.every && f.left > 0) {
        f.t -= f.every;
        f.left--;
        if (f.follow) {
          const near = s.monsters.nearest(p.x, p.y, f.radius * 2);
          const dir = near ? Math.atan2(near.y - p.y, near.x - p.x) : this.facing;
          this.blast(p.x + Math.cos(dir) * f.radius * 0.5, p.y + Math.sin(dir) * f.radius * 0.5, f.radius, f.base, f.knockback, f.color);
          this.startSwing(dir, dir, f.every);
          p.swings++;
        } else {
          s.afterimage(f.x, f.y, p.radius, f.color);
          this.blast(f.x, f.y, f.radius, f.base, f.knockback, f.color);
        }
      }
    }
    this.flurries = this.flurries.filter((f) => f.left > 0);
  }

  // 잔상권사: 적 둘레에 잔상을 세워 연타를 따라 친다
  cloneFlurry(x, y, hits, delay) {
    const n = this.comboProfile().clones;
    const base = this.baseDamage() * 0.8 * this.sig();
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random();
      this.flurries.push({
        x: x + Math.cos(a) * 24, y: y + Math.sin(a) * 24, left: hits, every: 0.08, t: 0.08, delay: delay + 0.1 * i,
        radius: 45, base, knockback: 20, color: this.swingColor(),
      });
    }
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
  const bash = this.attackMod() === 'shieldBash';
  for (const m of s.monsters.alive()) {
    const d = Math.hypot(m.x - p.x, m.y - p.y);
    if (d > range + m.def.radius) continue;
    if (d > 1 && angleDiff(Math.atan2(m.y - p.y, m.x - p.x), dir) > half) continue;
    this.hit(m, base, dir, this.cls.knockback * (bash ? 2.4 * this.sig() : 1));
  }
  s.swingFx(p.x, p.y, range, dir, half, this.swingColor());
  if (bash) s.ring(p.x + Math.cos(dir) * 30, p.y + Math.sin(dir) * 30, 26, this.swingColor());
  this.startSwing(dir - half, dir + half, 0.14);
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
  if (mod === 'echoBlast') (this.echoes ||= []).push({ x: target.x, y: target.y, radius, base: this.baseDamage() * 0.6 * this.sig(), t: 0.35 });
  if (mod === 'fireGround') this.fireZone(target.x, target.y, radius);
}

// ---------- 전직 공격 변화 ----------

function spinSlash() {
  const s = this.scene;
  const p = this.p;
  const radius = this.range() * 1.4 * (1 + 0.15 * this.ascended());
  s.monsters.beginAttack();
  for (const m of s.monsters.alive()) {
    if (Math.hypot(m.x - p.x, m.y - p.y) > radius + m.def.radius) continue;
    this.hit(m, this.baseDamage() * 2 * this.sig(), Math.atan2(m.y - p.y, m.x - p.x), 160);
  }
  s.swingFx(p.x, p.y, radius, 0, Math.PI, this.swingColor());
  this.startSwing(this.facing, this.facing + Math.PI * 2, 0.22);
  s.cameras.main.shake(80, 0.004);
}

function chargedShot(target) {
  const s = this.scene;
  const p = this.p;
  s.projectiles.fireShot(p.x, p.y, Math.atan2(target.y - p.y, target.x - p.x), 900, {
    base: this.baseDamage() * 2.5 * this.sig(), pierce: 99, knockback: 120, maxDist: this.range() * 1.4, color: 0xffd43b, size: 2.2 + 0.4 * this.ascended(),
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
  this.hit(target, this.baseDamage() * 2 * this.sig(), dir, 120);
  s.swingFx(p.x, p.y, 50, dir + Math.PI, 0.9, this.swingColor());
}

// 광전사: 매 공격이 360° 회전베기
function whirlwind() {
  const s = this.scene;
  const p = this.p;
  const radius = this.range() * 1.15 * (1 + 0.15 * this.ascended());
  s.monsters.beginAttack();
  for (const m of s.monsters.alive()) {
    if (Math.hypot(m.x - p.x, m.y - p.y) > radius + m.def.radius) continue;
    this.hit(m, this.baseDamage() * this.sig(), Math.atan2(m.y - p.y, m.x - p.x), this.cls.knockback);
  }
  s.swingFx(p.x, p.y, radius, this.facing, Math.PI, this.swingColor());
  this.startSwing(this.facing, this.facing + Math.PI * 2, 0.24);
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

function deployTurret() {
  this.scene.turrets.deploy(this.p.x, this.p.y);
}

function ghostFrenzy(skill) {
  this.scene.minions.frenzy(skill.duration, skill.summon);
}

// 무투가: 가장 가까운 적에게 순간 돌진해 연타 (돌진·연타 중 무적)
function flurryDash(skill) {
  const s = this.scene;
  const p = this.p;
  const { world } = s.db.balance;
  const target = s.monsters.nearest(p.x, p.y, skill.distance);
  const dir = target ? Math.atan2(target.y - p.y, target.x - p.x) : Math.atan2(this.lastDir.y, this.lastDir.x);
  const reach = target ? Math.max(0, Math.hypot(target.x - p.x, target.y - p.y) - target.def.radius - p.radius - 4) : 120;
  const ax = p.x;
  const ay = p.y;
  p.x = Phaser.Math.Clamp(p.x + Math.cos(dir) * reach, p.radius, world.width - p.radius);
  p.y = Phaser.Math.Clamp(p.y + Math.sin(dir) * reach, p.radius, world.height - p.radius);
  p.invuln = Math.max(p.invuln, skill.hits * skill.every + 0.2);
  for (let i = 0; i <= 5; i++) s.afterimage(ax + ((p.x - ax) * i) / 5, ay + ((p.y - ay) * i) / 5, p.radius, s.classColor);
  s.playerSprite.setPosition(p.x, p.y);
  this.flurries.push({
    follow: true, left: skill.hits, every: skill.every, t: skill.every, delay: 0,
    radius: skill.radius, base: this.baseDamage() * skill.damageMul, knockback: skill.knockback, color: this.swingColor(),
  });
  if (target) this.cloneFlurry(target.x, target.y, skill.hits, 0.2);
  s.cameras.main.shake(100, 0.006);
}

const SKILLS = { slam, galeSlash, arrowRain, manaBurst, deployTurret, ghostFrenzy, flurryDash };
