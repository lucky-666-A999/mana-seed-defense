import { Joystick } from '../input/Joystick.js';
import { WaveRun, waveComposition } from '../systems/WaveSystem.js';
import { waveSpecials } from '../systems/WaveGen.js';
import { drawCards, applyCards } from '../systems/CardSystem.js';
import { RunProgress, settleRun, saveRunResult, recordEncounter, recordKill } from '../systems/Progression.js';
import { stealRank, returnStolen } from '../systems/Combat.js';
import { lineFor } from '../systems/Story.js';
import { Monsters } from '../game/Monsters.js';
import { Projectiles } from '../game/Projectiles.js';
import { Player } from '../game/Player.js';
import { Hud } from '../ui/Hud.js';
import { Banner } from '../ui/Banner.js';
import { ActionButtons } from '../ui/ActionButtons.js';
import { showCardPicker, showWaveClear, showResult } from '../ui/Overlays.js';

const CLASS_ID = 'warden';
const SEED_STYLES = {
  green: { color: 0x9dffb0, radius: 5 },
  blue: { color: 0x4dabf7, radius: 7 },
  gold: { color: 0xffd43b, radius: 10 },
};

const hex = (color) => parseInt(color.replace('#', ''), 16);

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
    this.classColor = hex(this.cls.color);
    this.paused = false;
    this.overlay = null;
    this.ended = false;

    this.cameras.main.setBounds(0, 0, world.width, world.height);
    this.drawFloor(world);

    this.core = { x: world.width / 2, y: world.height / 2, hp: balance.core.hp, maxHp: balance.core.hp, radius: balance.core.radius };
    this.add.rectangle(this.core.x, this.core.y, 40, 40, 0x57e389).setAngle(45).setStrokeStyle(3, 0xd8ffe4);

    this.ranks = {};
    this.stats = this.computeStats();
    this.player = { x: this.core.x, y: this.core.y + 90, hp: this.maxHp(), radius: this.cls.radius, attackTimer: 0, swings: 0, hurtFlash: 0, invuln: 0 };
    this.playerSprite = this.add.circle(this.player.x, this.player.y, this.player.radius, this.classColor).setDepth(10);
    this.cameras.main.startFollow(this.playerSprite, true, 0.15, 0.15);

    this.seeds = [];
    this.stolen = [];
    this.storage = safeStorage();

    this.run = new WaveRun(waves, balance);
    this.progress = new RunProgress(balance);
    this.monsters = new Monsters(this);
    this.projectiles = new Projectiles(this);
    this.joystick = new Joystick(this);
    this.hero = new Player(this);
    this.hud = new Hud(this);
    this.banner = new Banner(this);
    this.buttons = new ActionButtons(this);
    this.announceWave();
  }

  // 준비 단계에 이번 웨이브의 정예·보스를 예고
  announceWave() {
    const { waves, balance, monsters, story } = this.db;
    const { elites, boss } = waveSpecials(waveComposition(this.run.wave, waves, balance), monsters);
    const label = (id) => `${story.units[id].title} ${story.units[id].name}`;
    if (boss) this.banner.setWarning(`⚠ 보스 — ${label(boss)}`);
    else if (elites.length) this.banner.setWarning(`⚠ 정예 접근 — ${elites.map(label).join(' · ')}`);
    else this.banner.setWarning('');
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
    this.buttons.update();
    this.banner.update(dt);
    if (this.paused) return;
    this.hero.move(dt);
    const wasPrep = this.run.state === 'prep';
    for (const req of this.run.update(dt)) this.monsters.spawnFromRequest(req);
    if (wasPrep && this.run.state === 'combat') this.banner.setWarning('');
    this.monsters.update(dt);
    this.projectiles.update(dt);
    this.hero.combat(dt);
    this.updateSeeds(dt);
    this.checkFlow();
  }

  // ---------- 플레이어 ----------

  isInvulnerable() {
    return this.paused || this.player.invuln > 0;
  }

  hurtPlayer(amount) {
    if (this.isInvulnerable()) return;
    const p = this.player;
    p.hp = Math.max(0, p.hp - this.hero.incomingDamage(amount));
    p.hurtFlash = 0.1;
  }

  damageCore(amount) {
    if (amount <= 0) return;
    this.core.hp = Math.max(0, this.core.hp - amount);
    this.cameras.main.shake(120, 0.006);
  }

  // ---------- 정예·보스 훅 ----------

  onUnitSpawn(m) {
    const unit = this.db.story.units[m.id];
    if (!unit) return;
    m.encounter = recordEncounter(this.storage, m.id);
    this.banner.say(unit, lineFor(unit, 'spawn', m.encounter), m.def.boss ? '#ffd166' : '#ff8fab');
    if (m.def.boss) this.banner.setBossFrame(true);
  }

  onUnitKilled(m) {
    if (this.stats.lifesteal) this.healPlayer(this.stats.lifesteal);
    const unit = this.db.story.units[m.id];
    if (!unit) return;
    recordKill(this.storage, m.id);
    this.banner.say(unit, lineFor(unit, 'death', m.encounter || 1), '#c9b8ff');
    if (m.def.boss) {
      if (this.stolen.length) {
        this.setRanks(returnStolen(this.ranks, this.stolen));
        this.stolen = [];
        this.floatText(this.player.x, this.player.y - 40, '기억이 돌아왔다', '#b57bff');
      }
      if (!this.monsters.alive().some((o) => o.def.boss)) this.banner.setBossFrame(false);
    }
  }

  stealCard() {
    if (this.isInvulnerable()) return;
    const { ranks, stolenId } = stealRank(this.ranks);
    if (!stolenId) return;
    this.setRanks(ranks);
    this.stolen.push(stolenId);
    const card = this.db.cards.find((c) => c.id === stolenId);
    this.floatText(this.player.x, this.player.y - 40, `기억을 빼앗겼다 — ${card.name}`, '#b57bff');
    this.cameras.main.shake(200, 0.008);
  }

  setRanks(ranks) {
    this.ranks = ranks;
    this.stats = this.computeStats();
    this.player.hp = Math.min(this.player.hp, this.maxHp());
  }

  healPlayer(amount) {
    this.player.hp = Math.min(this.maxHp(), this.player.hp + amount);
  }

  // ---------- 마나시드 ----------

  dropSeed(x, y, exp, kind = 'green') {
    const style = SEED_STYLES[kind];
    this.seeds.push({ x, y, exp, age: 0, done: false, sprite: this.add.circle(x, y, style.radius, style.color).setDepth(4) });
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
    // 한 번에 여러 레벨이 오르면 대기 중인 카드마다 해당 레벨 기준으로 등급 해금
    const drawLevel = this.progress.level - this.progress.pendingLevelups;
    const cards = drawCards(this.db.cards, CLASS_ID, this.ranks, drawLevel, this.db.balance);
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
    this.announceWave();
    this.resume();
  }

  endRun(outcome) {
    if (this.ended) return;
    this.ended = true;
    this.pause();
    const seeds = settleRun(outcome, this.progress.totalExp, this.db.balance);
    const save = saveRunResult(this.storage, { seeds, wave: this.run.wave });
    this.overlay = showResult(this, {
      outcome, wave: this.run.wave, totalExp: this.progress.totalExp, seeds, save,
    }, () => this.scene.restart());
  }

  // ---------- 연출 ----------

  swingFx(x, y, range, dir, half) {
    const g = this.add.graphics().setDepth(15);
    g.fillStyle(0xffffff, 0.35);
    g.slice(x, y, range, dir - half, dir + half, false);
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

  afterimage(x, y, r, color) {
    const c = this.add.circle(x, y, r, color, 0.6).setDepth(6);
    this.tweens.add({ targets: c, alpha: 0, scaleX: 1.6, scaleY: 0.2, duration: 350, onComplete: () => c.destroy() });
  }

  floatText(x, y, text, color) {
    const t = this.add.text(x, y, text, {
      fontSize: '18px', fontStyle: 'bold', color, stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(31);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 1400, onComplete: () => t.destroy() });
  }

  damageNumber(x, y, dmg) {
    const t = this.add.text(x, y, String(Math.round(dmg)), {
      fontSize: '16px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: t, y: y - 28, alpha: 0, duration: 500, onComplete: () => t.destroy() });
  }
}
