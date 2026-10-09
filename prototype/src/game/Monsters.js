import { monsterStats } from '../systems/WaveSystem.js';
import { monScale } from '../art/Art.js';
import { cappedShare, bardAtkMul, addRage, bossPatternInterval } from '../systems/Combat.js';

const hex = (color) => parseInt(color.replace('#', ''), 16);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const SEPARATION_PUSH = 0.5;
const LEADER_LEASH = 90;

// 몬스터 스폰·행동·피해·사망을 한곳에서 관리. 씬에는 훅(hurtPlayer, damageCore, dropSeed…)으로만 알린다.
export class Monsters {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.attackSeq = 0;
    this.tele = scene.add.graphics().setDepth(18);
  }

  // 플레이어 공격 1회(휘두르기·폭발·스킬·화살 1발)의 시작. 대장 헌신 상한을 공격 단위로 센다.
  beginAttack() {
    this.attackSeq++;
  }

  get db() {
    return this.scene.db;
  }

  alive() {
    return this.list.filter((m) => !m.dead);
  }

  // ---------- 스폰 ----------

  spawnFromRequest({ id, dirIndex, dirCount }) {
    const { balance } = this.db;
    const player = this.scene.player;
    // 위쪽에서만 스폰 (±60도)
    const baseAngle = -Math.PI / 2;
    const angle = baseAngle + Phaser.Math.FloatBetween(-Math.PI / 3, Math.PI / 3);
    const def = this.db.monsters[id];
    const x = Phaser.Math.Clamp(player.x + Math.cos(angle) * balance.spawnRadius, def.radius, balance.world.width - def.radius);
    const y = Phaser.Math.Clamp(player.y + Math.sin(angle) * balance.spawnRadius, def.radius, balance.world.height - def.radius);
    const group = def.group || 1;
    for (let i = 0; i < group; i++) {
      const jitter = group > 1 ? 22 : 0;
      this.spawn(id, x + Phaser.Math.FloatBetween(-jitter, jitter), y + Phaser.Math.FloatBetween(-jitter, jitter));
    }
    if (group > 1) this.scene.run.addExtra(group - 1);
  }

  spawn(id, x, y, extra = {}) {
    const def = this.db.monsters[id];
    const { hp, atk } = monsterStats(def, this.scene.run.wave, this.db.balance);
    const color = hex(def.color);
    const special = def.elite || def.boss;
    const m = {
      id, def, x, y, hp, maxHp: hp, atk, color,
      kx: 0, ky: 0, frozen: 0, flash: 0, attackTimer: 0, dead: false,
      state: 'walk', timer: 0, dir: 0, rage: 0, scatter: 0, siegeTimer: 0, hitThisDash: false,
      fireTimer: def.fireInterval || 0, patternTimer: def.patternInterval || 0, patternIndex: 0,
      knockbackMul: def.boss ? 0.15 : def.elite ? 0.4 : 1,
      sprite: this.scene.add.image(x, y, `mon_${id}`).setScale(monScale(def.radius, def.boss)).setDepth(special ? 7 : 5),
      ...extra,
    };
    this.list.push(m);

    if (def.escort) {
      for (let i = 0; i < def.escortCount; i++) {
        const a = (Math.PI * 2 * i) / def.escortCount;
        this.spawn(def.escort, x + Math.cos(a) * 42, y + Math.sin(a) * 42, { leader: m });
      }
      this.scene.run.addExtra(def.escortCount);
    }
    if (special) this.scene.onUnitSpawn(m);
    return m;
  }

  // ---------- 매 프레임 ----------

  update(dt) {
    const { balance } = this.db;
    const decay = Math.exp(-8 * dt);
    // 시간 왜곡 카드: 적의 시간 자체가 느려진다 (이동·조준·발사 모두)
    const mdt = dt * (1 - (this.scene.stats.globalSlow || 0));
    this.tele.clear();
    this.separate();
    for (const m of this.list) {
      if (m.dead) continue;
      if (m.flash > 0) {
        m.flash -= dt;
        if (m.flash <= 0) m.sprite.clearTint();
      }
      m.x = Phaser.Math.Clamp(m.x + m.kx * dt, m.def.radius, balance.world.width - m.def.radius);
      m.y = Phaser.Math.Clamp(m.y + m.ky * dt, m.def.radius, balance.world.height - m.def.radius);
      m.kx *= decay;
      m.ky *= decay;
      if (m.burnT > 0) this.tickBurn(m, dt);
      if (m.curseT > 0) m.curseT -= dt;
      if (m.dead) continue;
      let own = mdt;
      if (m.slowT > 0) {
        m.slowT -= dt;
        own *= 1 - m.slowAmt;
      }
      if (m.frozen > 0) {
        m.frozen -= dt;
      } else {
        BEHAVIORS[m.def.behavior].call(this, m, own);
      }
      if (!m.dead) {
        // 꿈틀거림: 개체마다 박자가 달라 떼가 살아 움직여 보인다
        const wob = Math.sin(this.scene.time.now / 110 + m.x * 0.05) * 0.06;
        const sc = monScale(m.def.radius, m.def.boss);
        m.sprite.setPosition(m.x, m.y).setScale(sc * (1 + wob), sc * (1 - wob));
        if (m.def.elite || m.def.boss) this.drawHpBar(m);
      }
    }
    this.list = this.list.filter((m) => !m.dead);
  }

  // ponytail: O(n²) 겹침 밀어내기, 동시 100마리 넘으면 격자 분할로 교체
  separate() {
    const alive = this.list.filter((m) => !m.dead);
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i];
        const b = alive[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const overlap = a.def.radius + b.def.radius - d;
        if (overlap <= 0) continue;
        const push = (overlap * SEPARATION_PUSH) / d;
        const wa = a.def.boss ? 0 : b.def.boss ? 1 : 0.5;
        a.x -= dx * push * wa;
        a.y -= dy * push * wa;
        b.x += dx * push * (1 - wa);
        b.y += dy * push * (1 - wa);
      }
    }
  }

  // 목표까지 이동. 도달하면 true.
  moveToward(m, tx, ty, reach, speed, dt) {
    const d = Math.hypot(tx - m.x, ty - m.y);
    if (d <= reach) return true;
    const step = Math.min(speed * dt, d - reach);
    const oldX = m.x, oldY = m.y;
    m.x += ((tx - m.x) / d) * step;
    m.y += ((ty - m.y) / d) * step;
    // 장애물 충돌 시 이동 취소
    if (this.scene.obstacles && this.scene.obstacles.isColliding(m.x, m.y, m.def.radius)) {
      m.x = oldX;
      m.y = oldY;
    }
    return false;
  }

  meleePlayer(m, dt, atk = m.atk) {
    m.attackTimer -= dt;
    if (m.attackTimer <= 0) {
      m.attackTimer = m.def.attackCooldown;
      this.scene.hurtPlayer(atk);
    }
  }

  siegeCore(m, dt) {
    m.siegeTimer -= dt;
    if (m.siegeTimer <= 0) {
      m.siegeTimer = m.def.siegeInterval;
      this.scene.damageCore(m.def.coreDamage);
      this.scene.onCoreHitBy(m);
    }
  }

  // ---------- 피해 / 사망 ----------

  slow(m, amount, seconds) {
    m.slowAmt = Math.max(m.slowT > 0 ? m.slowAmt : 0, amount);
    m.slowT = Math.max(m.slowT || 0, seconds);
  }

  tickBurn(m, dt) {
    m.burnT -= dt;
    m.burnAcc = (m.burnAcc || 0) + dt;
    if (m.burnAcc >= 0.5) {
      m.burnAcc -= 0.5;
      this.applyHit(m, m.burnDps * 0.5, 0, 0, { color: '#ff9f43', stagger: false });
    }
  }

  damage(m, dmg, dir, knockback, crit = false) {
    if (m.dead) return;
    let amount = dmg;
    if (m.curseT > 0) amount *= 1 + m.curseMul;
    if (m.state === 'daze') amount *= m.def.dazeDamageMul;
    const leader = m.leader;
    if (leader && !leader.dead && dist(m, leader) <= leader.def.auraRadius) {
      if (leader.shareSeq !== this.attackSeq) {
        leader.shareSeq = this.attackSeq;
        leader.shareTaken = 0;
      }
      const { toEscort, toCaptain } = cappedShare(amount, leader.def.shareRatio, leader.shareTaken, amount);
      amount = toEscort;
      leader.shareTaken += toCaptain;
      if (toCaptain > 0) this.applyHit(leader, toCaptain, dir, 0, { number: false });
    }
    this.applyHit(m, amount, dir, knockback, { crit });
  }

  applyHit(m, amount, dir, knockback, { number = true, crit = false, color, stagger = true } = {}) {
    if (m.dead) return;
    m.hp -= amount;
    m.kx += Math.cos(dir) * knockback * m.knockbackMul;
    m.ky += Math.sin(dir) * knockback * m.knockbackMul;
    if (stagger) m.frozen = Math.max(m.frozen, this.db.balance.hitstop);
    m.flash = 0.06;
    m.sprite.setTintFill(0xffffff);
    if (number) this.scene.damageNumber(m.x, m.y - m.def.radius, amount, crit, color);
    if (m.hp <= 0) this.kill(m);
  }

  kill(m) {
    const def = m.def;
    this.scene.dropSeed(m.x, m.y, def.exp, def.drop);
    this.scene.burst(m.x, m.y, m.color);
    if (def.splitInto) {
      for (let i = 0; i < def.splitCount; i++) {
        const a = (Math.PI * 2 * i) / def.splitCount;
        this.spawn(def.splitInto, m.x + Math.cos(a) * 14, m.y + Math.sin(a) * 14);
      }
      this.scene.run.addExtra(def.splitCount);
    }
    if (def.escort) {
      for (const e of this.list) {
        if (e.leader === m && !e.dead) {
          e.leader = null;
          e.scatter = def.scatterTime;
        }
      }
    }
    for (const s of this.list) {
      if (!s.dead && s !== m && s.def.behavior === 'avenger' && dist(s, m) <= s.def.rageRadius) {
        s.rage = addRage(s.rage, s.def.ragePerKill, s.def.rageMax);
      }
    }
    this.remove(m);
    this.scene.onUnitKilled(m);
  }

  remove(m) {
    m.dead = true;
    m.sprite.destroy();
    this.scene.run.markResolved();
  }

  nearest(x, y, range) {
    let best = null;
    let bestD = Infinity;
    for (const m of this.list) {
      if (m.dead) continue;
      const d = Math.hypot(m.x - x, m.y - y) - m.def.radius;
      if (d <= range && d < bestD) {
        best = m;
        bestD = d;
      }
    }
    return best;
  }

  // ---------- 연출 ----------

  drawHpBar(m) {
    const w = m.def.radius * 2.4;
    const x = m.x - w / 2;
    const y = m.y - m.def.radius - 12;
    this.tele.fillStyle(0x000000, 0.6).fillRect(x, y, w, 5);
    this.tele.fillStyle(m.def.boss ? 0xffd166 : 0xff6b6b, 1).fillRect(x, y, w * Math.max(0, m.hp / m.maxHp), 5);
  }

  warnLine(x, y, dir, length, color = 0xff4d4d) {
    this.tele.lineStyle(3, color, 0.8).lineBetween(x, y, x + Math.cos(dir) * length, y + Math.sin(dir) * length);
  }
}

// ---------- 행동 ----------

function chase(m, dt) {
  const s = this.scene;
  const p = s.player;
  if (m.scatter > 0) {
    m.scatter -= dt;
    const away = Math.atan2(m.y - p.y, m.x - p.x);
    const oldX = m.x, oldY = m.y;
    m.x += Math.cos(away) * m.def.speed * dt;
    m.y += Math.sin(away) * m.def.speed * dt;
    if (s.obstacles && s.obstacles.isColliding(m.x, m.y, m.def.radius)) {
      m.x = oldX;
      m.y = oldY;
    }
    return;
  }
  const leader = m.leader && !m.leader.dead ? m.leader : null;
  const speed = leader ? Math.min(m.def.speed, leader.def.speed) : m.def.speed;
  // 가까운 쪽을 노린다: 플레이어 또는 아군(기계학자 포탑·네크로맨서 망령)
  let foe = p;
  let foeDist = dist(m, p);
  for (const t of [...s.turrets.targets(), ...s.minions.list]) {
    const d = dist(m, t);
    if (d < foeDist) {
      foe = t;
      foeDist = d;
    }
  }
  if (foeDist < this.db.balance.aggroRadius) {
    const reach = m.def.radius + (foe === p ? p.radius : foe.radius || 12);
    if (this.moveToward(m, foe.x, foe.y, reach, speed, dt)) {
      if (foe === p) this.meleePlayer(m, dt);
      else {
        m.attackTimer -= dt;
        if (m.attackTimer <= 0) {
          m.attackTimer = m.def.attackCooldown;
          if (foe.ally === 'minion') s.minions.damage(foe, m.atk);
          else s.turrets.damage(foe, m.atk);
        }
      }
    }
    return;
  }
  if (leader && dist(m, leader) > LEADER_LEASH) {
    this.moveToward(m, leader.x, leader.y, LEADER_LEASH * 0.5, m.def.speed, dt);
    return;
  }
  if (this.moveToward(m, s.player.x, s.player.y, m.def.radius + s.player.radius, speed, dt)) {
    // damageCore removed
    this.remove(m);
  }
}

function ranged(m, dt) {
  const s = this.scene;
  const p = s.player;
  const def = m.def;
  const target = dist(m, p) <= def.range + 40 ? p : s.player;
  const inRange = this.moveToward(m, target.x, target.y, def.range, def.speed, dt);
  if (!inRange) {
    m.fireTimer = Math.max(m.fireTimer, def.aimTime + 0.2);
    return;
  }
  m.fireTimer -= dt;
  const dir = Math.atan2(target.y - m.y, target.x - m.x);
  if (m.fireTimer <= def.aimTime) this.warnLine(m.x, m.y, dir, def.range, 0xffb347);
  if (m.fireTimer <= 0) {
    m.fireTimer = def.fireInterval;
    s.projectiles.fire(m.x, m.y, dir, def.shotSpeed, { player: def.shotPlayerDamage, core: def.shotCoreDamage, color: 0xffb347 });
  }
}

// 추적자·세라 공용: 걷기 → 조준(경고선) → 돌진 → 회복(세라는 멍함)
function dashCycle(m, dt, target, onHitPlayer, recoverState, recoverTime) {
  const s = this.scene;
  const def = m.def;
  if (m.state === 'aim') {
    m.timer -= dt;
    this.warnLine(m.x, m.y, m.dir, def.dashSpeed * def.dashTime);
    if (m.timer <= 0) {
      m.state = 'dash';
      m.timer = def.dashTime;
      m.hitThisDash = false;
    }
    return;
  }
  if (m.state === 'dash') {
    m.timer -= dt;
    m.x = Phaser.Math.Clamp(m.x + Math.cos(m.dir) * def.dashSpeed * dt, def.radius, this.db.balance.world.width - def.radius);
    m.y = Phaser.Math.Clamp(m.y + Math.sin(m.dir) * def.dashSpeed * dt, def.radius, this.db.balance.world.height - def.radius);
    if (!m.hitThisDash && dist(m, s.player) <= def.radius + s.player.radius) {
      m.hitThisDash = true;
      onHitPlayer();
    }
    if (m.timer <= 0) {
      m.state = recoverState;
      m.timer = recoverTime;
    }
    return;
  }
  if (m.state === recoverState) {
    m.timer -= dt;
    if (m.timer <= 0) m.state = 'walk';
    return;
  }
  if (dist(m, target) <= def.triggerRange) {
    m.state = 'aim';
    m.timer = def.aimTime;
    m.dir = Math.atan2(target.y - m.y, target.x - m.x);
  }
}

function dasher(m, dt) {
  const s = this.scene;
  const def = m.def;
  const target = dist(m, s.player) <= def.triggerRange ? s.player : s.player;
  if (m.state === 'dash' && dist(m, s.player) <= def.radius + s.player.radius) {
    // damageCore removed
    this.remove(m);
    return;
  }
  const wasWalking = m.state === 'walk';
  dashCycle.call(this, m, dt, target, () => s.hurtPlayer(m.atk), 'recover', def.recoverTime);
  if (wasWalking && m.state === 'walk') {
    if (this.moveToward(m, s.player.x, s.player.y, def.radius + s.player.radius, def.speed, dt)) {
      // damageCore removed
      this.remove(m);
    }
  }
}

function splitter(m, dt) {
  chase.call(this, m, dt);
}

function captain(m, dt) {
  const s = this.scene;
  const escorts = this.list.filter((e) => e.leader === m && !e.dead).length;
  const atk = m.atk * bardAtkMul(escorts, m.def.atkPerEscort);
  const p = s.player;
  if (dist(m, p) <= m.def.radius + p.radius + 4) {
    this.meleePlayer(m, dt, atk);
    return;
  }
  this.moveToward(m, s.player.x, s.player.y, m.def.radius + s.player.radius, m.def.speed, dt);
}

function avenger(m, dt) {
  const s = this.scene;
  const p = s.player;
  if (m.state === 'walk') {
    this.moveToward(m, p.x, p.y, m.def.radius + p.radius, m.def.speed * (1 + m.rage), dt);
  }
  dashCycle.call(this, m, dt, p, () => s.hurtPlayer(m.atk), 'daze', m.def.dazeTime);
  if (m.state === 'daze') {
    this.tele.lineStyle(2, 0xffffff, 0.6).strokeCircle(m.x, m.y - m.def.radius - 20, 6);
  }
}

function boss(m, dt) {
  const s = this.scene;
  const def = m.def;
  const p = s.player;
  if (m.state === 'steal') {
    m.timer -= dt;
    const r = def.stealRange * (1 - Math.max(0, m.timer) / def.stealWindup);
    this.tele.lineStyle(3, 0xb57bff, 0.9).strokeCircle(m.x, m.y, def.radius + r);
    if (m.timer <= 0) {
      m.state = 'walk';
      if (dist(m, p) <= def.radius + def.stealRange + p.radius) s.stealCard();
    }
    return;
  }
  if (m.state === 'clock') {
    m.timer -= dt;
    for (let i = 0; i < def.clockShots; i++) {
      this.warnLine(m.x, m.y, (Math.PI * 2 * i) / def.clockShots + m.dir, 40, 0xffd166);
    }
    if (m.timer <= 0) {
      m.state = 'walk';
      for (let i = 0; i < def.clockShots; i++) {
        s.projectiles.fire(m.x, m.y, (Math.PI * 2 * i) / def.clockShots + m.dir, def.clockShotSpeed, { player: def.clockShotDamage, core: 0, color: 0xffd166 });
      }
    }
    return;
  }
  m.patternTimer -= dt;
  if (m.patternTimer <= 0) {
    m.patternTimer = bossPatternInterval(def.patternInterval, m.hp / m.maxHp, def.enrageRatio, def.enrageSpeedup);
    // 3박자 순환: [강탈(가까우면) 또는 시계] → 점멸 → 시계
    const slot = m.patternIndex++ % 3;
    if (slot === 0 && dist(m, p) <= def.radius + def.stealRange * 1.8) {
      m.state = 'steal';
      m.timer = def.stealWindup;
      return;
    }
    const pattern = slot === 1 ? 'blink' : 'clock';
    if (pattern === 'blink') {
      s.afterimage(m.x, m.y, def.radius, m.color);
      const a = Math.random() * Math.PI * 2;
      m.x = s.player.x + Math.cos(a) * def.blinkRadius;
      m.y = s.player.y + Math.sin(a) * def.blinkRadius;
    } else {
      m.state = 'clock';
      m.timer = def.clockWindup;
      m.dir = Math.random() * Math.PI;
    }
    return;
  }
  if (dist(m, p) <= def.radius + p.radius + 4) this.meleePlayer(m, dt);
  this.moveToward(m, s.player.x, s.player.y, def.radius + s.player.radius, def.speed, dt);
}

// 포격 프로그램: 모든 직업 사거리 밖(340)에서 멈춰 코어에 포탄. 착탄 원 예고 뒤 폭발.
function artillery(m, dt) {
  const s = this.scene;
  const def = m.def;
  if (!this.moveToward(m, s.player.x, s.player.y, def.range, def.speed, dt)) {
    m.fireTimer = Math.max(m.fireTimer, def.windup + 0.5);
    return;
  }
  m.fireTimer -= dt;
  if (m.fireTimer <= def.windup) {
    const t = 1 - Math.max(0, m.fireTimer) / def.windup;
    this.tele.lineStyle(3, 0xff6b35, 0.9).strokeCircle(s.player.x, s.player.y, def.blastRadius);
    this.tele.fillStyle(0xff6b35, 0.25 * t).fillCircle(s.player.x, s.player.y, def.blastRadius * t);
    this.tele.lineStyle(1, 0xff6b35, 0.4).lineBetween(m.x, m.y, s.player.x, s.player.y);
  }
  if (m.fireTimer <= 0) {
    m.fireTimer = def.fireInterval;
    // damageCore removed
    s.blastFx(s.player.x, s.player.y, def.blastRadius, 0xff6b35);
    if (Math.hypot(s.player.x - s.player.x, s.player.y - s.player.y) <= def.blastRadius + s.player.radius) s.hurtPlayer(m.atk);
  }
}

const BEHAVIORS = { chase, ranged, dasher, splitter, captain, avenger, boss, artillery };
