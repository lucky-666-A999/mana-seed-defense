import { Joystick } from '../input/Joystick.js';
import { WaveRun, monsterStats } from '../systems/WaveSystem.js';
import { drawCards, applyCards } from '../systems/CardSystem.js';
import { RunProgress, settleRun, saveRunResult } from '../systems/Progression.js';
import { Hud } from '../ui/Hud.js';
import { showCardPicker, showWaveClear, showResult } from '../ui/Overlays.js';

const CLASS_ID = 'warden';
const SEED_COLOR = 0x9dffb0;
const MAX_NEAR_CORE_DR = 0.75;
const SHOCK_RADIUS = 110;
const SHOCK_KNOCKBACK = 260;
const QUAKE_INTERVAL = 10;

const hex = (color) => parseInt(color.replace('#', ''), 16);
const angleDiff = (a, b) => Math.abs(Phaser.Math.Angle.Wrap(a - b));

function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => {} };
  }
}

export class GameScene extends Phaser.Scene {
  constructor(db) {
    super('game');
    this.db = db;
  }

  create() {
    const { balance, waves, classes } = this.db;
    const world = balance.world;
    this.cls = classes[CLASS_ID];
    this.paused = false;
    this.overlay = null;
    this.ended = false;

    this.cameras.main.setBounds(0, 0, world.width, world.height);
    this.drawFloor(world);

    this.core = { x: world.width / 2, y: world.height / 2, hp: balance.core.hp, maxHp: balance.core.hp, radius: balance.core.radius };
    this.add.rectangle(this.core.x, this.core.y, 40, 40, 0x57e389).setAngle(45).setStrokeStyle(3, 0xd8ffe4);

    this.ranks = {};
    this.stats = this.computeStats();
    this.player = { x: this.core.x, y: this.core.y + 90, hp: this.maxHp(), radius: this.cls.radius, attackTimer: 0, swings: 0, hurtFlash: 0 };
    this.playerSprite = this.add.circle(this.player.x, this.player.y, this.player.radius, hex(this.cls.color)).setDepth(10);
    this.cameras.main.startFollow(this.playerSprite, true, 0.15, 0.15);

    this.monsters = [];
    this.seeds = [];
    this.quakeTimer = QUAKE_INTERVAL;

    this.run = new WaveRun(waves, balance);
    this.progress = new RunProgress(balance);
    this.joystick = new Joystick(this);
    this.hud = new Hud(this);
  }

  drawFloor(world) {
    const g = this.add.graphics();
    g.lineStyle(1, 0x2a1f40, 1);
    for (let x = 0; x <= world.width; x += 60) g.lineBetween(x, 0, x, world.height);
    for (let y = 0; y <= world.height; y += 60) g.lineBetween(0, y, world.width, y);
    g.lineStyle(3, 0x5a3f8a, 1).strokeRect(0, 0, world.width, world.height);
  }

  computeStats() {
    const base = {
      atkMul: 1, aspdMul: 1, moveMul: 1, magnetMul: 1, maxHpMul: 1,
      arcDeg: this.cls.arcDeg, shock: 0, nearCoreDR: 0, quake: 0,
    };
    return applyCards(base, this.ranks, this.db.cards);
  }

  maxHp() {
    return this.cls.hp * this.stats.maxHpMul;
  }

  update(_time, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 0.05);
    this.hud.update();
    if (this.paused) return;
    this.updatePlayer(dt);
    for (const req of this.run.update(dt)) this.spawnMonster(req);
    this.updateMonsters(dt);
    this.updateAttack(dt);
    this.updateSeeds(dt);
    this.updateQuake(dt);
    this.checkFlow();
  }

  // ---------- 플레이어 ----------

  updatePlayer(dt) {
    const v = this.joystick.read();
    const speed = this.cls.moveSpeed * this.stats.moveMul;
    const world = this.db.balance.world;
    const p = this.player;
    p.x = Phaser.Math.Clamp(p.x + v.x * speed * dt, p.radius, world.width - p.radius);
    p.y = Phaser.Math.Clamp(p.y + v.y * speed * dt, p.radius, world.height - p.radius);
    this.playerSprite.setPosition(p.x, p.y);
    if (p.hurtFlash > 0) {
      p.hurtFlash -= dt;
      this.playerSprite.setFillStyle(p.hurtFlash > 0 ? 0xff4444 : hex(this.cls.color));
    }
  }

  hurtPlayer(amount) {
    if (this.paused) return;
    const p = this.player;
    const nearCore = Math.hypot(p.x - this.core.x, p.y - this.core.y) < this.db.balance.nearCoreRadius;
    const dr = nearCore ? Math.min(MAX_NEAR_CORE_DR, this.stats.nearCoreDR) : 0;
    p.hp = Math.max(0, p.hp - amount * (1 - dr));
    p.hurtFlash = 0.1;
  }

  // ---------- 몬스터 ----------

  spawnMonster({ id, dirIndex, dirCount }) {
    const { balance, monsters } = this.db;
    const def = monsters[id];
    const { hp, atk } = monsterStats(def, this.run.wave, balance);
    const angle = (Math.PI * 2 * dirIndex) / dirCount - Math.PI / 2 + Phaser.Math.FloatBetween(-0.2, 0.2);
    const world = balance.world;
    const x = Phaser.Math.Clamp(this.core.x + Math.cos(angle) * balance.spawnRadius, def.radius, world.width - def.radius);
    const y = Phaser.Math.Clamp(this.core.y + Math.sin(angle) * balance.spawnRadius, def.radius, world.height - def.radius);
    const color = hex(def.color);
    this.monsters.push({
      def, x, y, hp, atk, color,
      kx: 0, ky: 0, frozen: 0, flash: 0, attackTimer: 0, dead: false,
      sprite: this.add.circle(x, y, def.radius, color).setDepth(5),
    });
  }

  updateMonsters(dt) {
    const { balance } = this.db;
    const p = this.player;
    const decay = Math.exp(-8 * dt);
    for (const m of this.monsters) {
      if (m.dead) continue;
      if (m.flash > 0) {
        m.flash -= dt;
        if (m.flash <= 0) m.sprite.setFillStyle(m.color);
      }
      m.x += m.kx * dt;
      m.y += m.ky * dt;
      m.kx *= decay;
      m.ky *= decay;
      if (m.frozen > 0) {
        m.frozen -= dt;
        m.sprite.setPosition(m.x, m.y);
        continue;
      }
      // 기본 목표는 코어, 플레이어가 가까우면 플레이어
      const chasePlayer = Math.hypot(p.x - m.x, p.y - m.y) < balance.aggroRadius;
      const tx = chasePlayer ? p.x : this.core.x;
      const ty = chasePlayer ? p.y : this.core.y;
      const dist = Math.hypot(tx - m.x, ty - m.y);
      const reach = m.def.radius + (chasePlayer ? p.radius : this.core.radius);
      if (dist > reach) {
        const step = Math.min(m.def.speed * dt, dist - reach);
        m.x += ((tx - m.x) / dist) * step;
        m.y += ((ty - m.y) / dist) * step;
      } else if (chasePlayer) {
        m.attackTimer -= dt;
        if (m.attackTimer <= 0) {
          m.attackTimer = m.def.attackCooldown;
          this.hurtPlayer(m.atk);
        }
      } else {
        this.hitCore(m);
        continue;
      }
      m.sprite.setPosition(m.x, m.y);
    }
    this.monsters = this.monsters.filter((m) => !m.dead);
  }

  hitCore(m) {
    this.core.hp = Math.max(0, this.core.hp - m.def.coreDamage);
    this.cameras.main.shake(120, 0.006);
    this.removeMonster(m);
  }

  removeMonster(m) {
    m.dead = true;
    m.sprite.destroy();
    this.run.markResolved();
  }

  // ---------- 공격 ----------

  nearestMonster(range) {
    let best = null;
    let bestD = Infinity;
    for (const m of this.monsters) {
      if (m.dead) continue;
      const d = Math.hypot(m.x - this.player.x, m.y - this.player.y) - m.def.radius;
      if (d <= range && d < bestD) {
        best = m;
        bestD = d;
      }
    }
    return best;
  }

  updateAttack(dt) {
    const p = this.player;
    p.attackTimer -= dt;
    if (p.attackTimer > 0) return;
    const target = this.nearestMonster(this.cls.range);
    if (!target) return;
    p.attackTimer = this.cls.attackInterval / this.stats.aspdMul;
    const dir = Math.atan2(target.y - p.y, target.x - p.x);
    const half = Phaser.Math.DegToRad(this.stats.arcDeg / 2);
    const dmg = this.cls.atk * this.stats.atkMul;
    for (const m of this.monsters) {
      if (m.dead) continue;
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d > this.cls.range + m.def.radius) continue;
      if (d > 1 && angleDiff(Math.atan2(m.y - p.y, m.x - p.x), dir) > half) continue;
      this.damageMonster(m, dmg, dir, this.cls.knockback);
    }
    this.swingFx(dir, half);
    p.swings++;
    if (this.stats.shock > 0 && p.swings % 3 === 0) this.shockwave();
  }

  // 타격감 3종: 히트스톱(대상만 정지) + 넉백 + 흰색 플래시
  damageMonster(m, dmg, dir, knockback) {
    m.hp -= dmg;
    m.kx += Math.cos(dir) * knockback;
    m.ky += Math.sin(dir) * knockback;
    m.frozen = Math.max(m.frozen, this.db.balance.hitstop);
    m.flash = 0.06;
    m.sprite.setFillStyle(0xffffff);
    this.damageNumber(m.x, m.y - m.def.radius, dmg);
    if (m.hp <= 0) this.killMonster(m);
  }

  killMonster(m) {
    this.dropSeed(m.x, m.y, m.def.exp);
    this.burst(m.x, m.y, m.color);
    this.removeMonster(m);
  }

  shockwave() {
    const p = this.player;
    const dmg = this.cls.atk * this.stats.atkMul * 0.5 * this.stats.shock;
    for (const m of this.monsters) {
      if (m.dead) continue;
      if (Math.hypot(m.x - p.x, m.y - p.y) > SHOCK_RADIUS + m.def.radius) continue;
      this.damageMonster(m, dmg, Math.atan2(m.y - p.y, m.x - p.x), SHOCK_KNOCKBACK);
    }
    this.ring(p.x, p.y, SHOCK_RADIUS, 0x9ad0ff);
  }

  updateQuake(dt) {
    if (this.stats.quake <= 0) return;
    this.quakeTimer -= dt;
    if (this.quakeTimer > 0) return;
    this.quakeTimer = QUAKE_INTERVAL;
    for (const m of this.monsters) if (!m.dead) m.frozen = Math.max(m.frozen, 1);
    this.cameras.main.shake(250, 0.01);
    this.ring(this.player.x, this.player.y, 400, 0xffd966);
  }

  // ---------- 마나시드 ----------

  dropSeed(x, y, exp) {
    this.seeds.push({ x, y, exp, age: 0, done: false, sprite: this.add.circle(x, y, 5, SEED_COLOR).setDepth(4) });
  }

  updateSeeds(dt) {
    const { drops } = this.db.balance;
    const p = this.player;
    const magnet = drops.magnetRadius * this.stats.magnetMul;
    for (const s of this.seeds) {
      s.age += dt;
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      if (d < p.radius + 6) {
        this.progress.addExp(s.exp);
        s.done = true;
      } else if (d < magnet) {
        const step = Math.min(drops.pullSpeed * dt, d);
        s.x += ((p.x - s.x) / d) * step;
        s.y += ((p.y - s.y) / d) * step;
      } else if (s.age > drops.lifetime) {
        s.done = true;
      }
      if (s.done) s.sprite.destroy();
      else s.sprite.setPosition(s.x, s.y);
    }
    this.seeds = this.seeds.filter((s) => !s.done);
  }

  // ---------- 흐름 (레벨업 / 클리어 / 종료) ----------

  checkFlow() {
    if (this.player.hp <= 0) return this.endRun('dead');
    if (this.core.hp <= 0) return this.endRun('coreLost');
    if (this.progress.pendingLevelups > 0) return this.openCardPicker();
    if (this.run.state === 'cleared') {
      // 바닥에 남은 마나시드도 팝업의 환수 금액에 포함되어야 한다
      if (this.seeds.length > 0) {
        this.collectAllSeeds();
        return this.checkFlow();
      }
      return this.openWaveClear();
    }
  }

  collectAllSeeds() {
    for (const s of this.seeds) {
      this.progress.addExp(s.exp);
      s.sprite.destroy();
    }
    this.seeds = [];
  }

  pause() {
    this.paused = true;
    this.joystick.release();
  }

  resume() {
    this.paused = false;
    this.overlay = null;
  }

  openCardPicker() {
    this.progress.takeLevelup();
    const cards = drawCards(this.db.cards, CLASS_ID, this.ranks, this.progress.level, this.db.balance);
    this.pause();
    this.overlay = showCardPicker(this, cards, this.ranks, (card) => {
      this.applyCard(card);
      this.resume();
      this.checkFlow();
    });
  }

  applyCard(card) {
    if (card.instant) {
      const { type, amount } = card.instant;
      if (type === 'heal') this.player.hp = Math.min(this.maxHp(), this.player.hp + this.maxHp() * amount);
      if (type === 'repair') this.core.hp = Math.min(this.core.maxHp, this.core.hp + this.core.maxHp * amount);
      return;
    }
    const oldMax = this.maxHp();
    this.ranks[card.id] = (this.ranks[card.id] || 0) + 1;
    this.stats = this.computeStats();
    this.player.hp += this.maxHp() - oldMax;
  }

  openWaveClear() {
    const { balance } = this.db;
    this.pause();
    this.overlay = showWaveClear(this, {
      wave: this.run.wave,
      totalExp: this.progress.totalExp,
      seeds: settleRun('retire', this.progress.totalExp, balance),
      coreHp: this.core.hp,
      coreMaxHp: this.core.maxHp,
      coreRecover: balance.recovery.coreOnClear,
    }, {
      onContinue: () => this.continueRun(),
      onRetire: () => this.endRun('retire'),
    });
  }

  continueRun() {
    const { recovery } = this.db.balance;
    this.core.hp = Math.min(this.core.maxHp, this.core.hp + this.core.maxHp * recovery.coreOnClear);
    this.run.nextWave();
    this.player.hp = Math.min(this.maxHp(), this.player.hp + this.maxHp() * recovery.playerOnPrep);
    this.resume();
  }

  endRun(outcome) {
    if (this.ended) return;
    this.ended = true;
    this.pause();
    const seeds = settleRun(outcome, this.progress.totalExp, this.db.balance);
    const save = saveRunResult(safeStorage(), { seeds, wave: this.run.wave });
    this.overlay = showResult(this, {
      outcome, wave: this.run.wave, totalExp: this.progress.totalExp, seeds, save,
    }, () => this.scene.restart());
  }

  // ---------- 연출 ----------

  swingFx(dir, half) {
    const g = this.add.graphics().setDepth(15);
    g.fillStyle(0xffffff, 0.35);
    g.slice(this.player.x, this.player.y, this.cls.range, dir - half, dir + half, false);
    g.fillPath();
    this.tweens.add({ targets: g, alpha: 0, duration: 120, onComplete: () => g.destroy() });
  }

  ring(x, y, r, color) {
    const c = this.add.circle(x, y, r).setStrokeStyle(4, color, 0.9).setDepth(15);
    this.tweens.add({ targets: c, alpha: 0, scale: 1.15, duration: 300, onComplete: () => c.destroy() });
  }

  burst(x, y, color) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const c = this.add.circle(x, y, 3, color).setDepth(6);
      this.tweens.add({
        targets: c, x: x + Math.cos(a) * 26, y: y + Math.sin(a) * 26, alpha: 0, duration: 260,
        onComplete: () => c.destroy(),
      });
    }
  }

  damageNumber(x, y, dmg) {
    const t = this.add.text(x, y, String(Math.round(dmg)), {
      fontSize: '16px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: t, y: y - 28, alpha: 0, duration: 500, onComplete: () => t.destroy() });
  }
}
