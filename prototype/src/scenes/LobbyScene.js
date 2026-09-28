import { loadSave, writeSave } from '../systems/Progression.js';
import { specStatus, buySpec, selectSpec } from '../systems/Specs.js';
import { safeStorage } from '../storage.js';
import { W, label, button, backdrop } from '../ui/widgets.js';

const hex = (color) => parseInt(color.replace('#', ''), 16);

export class LobbyScene extends Phaser.Scene {
  constructor(db) {
    super('lobby');
    this.db = db;
  }

  create() {
    this.storage = safeStorage();
    this.save = loadSave(this.storage);
    if (!this.save.seenIntro) {
      this.scene.start('intro');
      return;
    }
    backdrop(this);
    const core = this.add.rectangle(W / 2, 170, 56, 56, 0x57e389).setAngle(45).setStrokeStyle(4, 0xd8ffe4);
    this.tweens.add({ targets: core, scale: 1.12, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    label(this, W / 2, 262, '마나시드 디펜스', 40, '#ffffff', { bold: true });
    label(this, W / 2, 306, '씨앗이 자라면, 탑으로 가는 길이 열린다', 16, '#c9b8ff');
    label(this, W / 2, 360, `보유 마나시드 ◆ ${this.save.seeds}`, 22, '#9dffb0', { bold: true });
    label(this, W / 2, 392, `최고 기록  웨이브 ${this.save.bestWave}`, 16, '#8f86a8');

    this.drawClassPicker(466);
    this.drawSpecRow(550);
    button(this, W / 2, 652, 320, 70, '출전', 0x57e389, () => this.startRun(), { size: 28 });
    const specOpen = this.save.ownedSpecs[this.save.selectedClass];
    const nodesBought = this.db.shop.some((i) => i.kind === 'specNode' && i.specId === this.save.specs[this.save.selectedClass] && this.save.upgrades[i.id]);
    const growLabel = specOpen && !nodesBought ? '성장  (전직 트리 열림!)' : '성장';
    button(this, W / 2, 738, 320, 52, growLabel, 0xffd966, () => this.scene.start('shop', { tab: specOpen ? 'spec' : 'upgrade' }));
    button(this, W / 2, 800, 320, 52, '기록', 0xb57bff, () => this.scene.start('codex'));
    button(this, W / 2, 862, 320, 52, '이야기', 0x6fa8ff, () => this.scene.start('intro'));
  }

  // 전직: 잠김(조건 안내) / 해금 구매 / 두 갈래 중 선택
  drawSpecRow(y) {
    const classId = this.save.selectedClass;
    const { balance, specs } = this.db;
    const status = specStatus(this.save, classId, balance);
    if (status === 'locked') {
      const best = this.save.retireBest[classId] || 0;
      label(this, W / 2, y - 8, '★ 다음 목표: 전직', 16, '#ffd966', { bold: true });
      label(this, W / 2, y + 16, `이 직업으로 ${balance.specUnlock.wave}웨이브 이상에서 마무리하면 해금 (최고 ${best})`, 14, '#c9b8ff');
      return;
    }
    if (status === 'buyable') {
      button(this, W / 2, y, 280, 44, `★ 전직 해금 ◆ ${balance.specUnlock.price}`, 0xb57bff, () => {
        this.save = writeSave(this.storage, buySpec(this.save, classId, specs, balance));
        this.scene.restart();
      }, { enabled: this.save.seeds >= balance.specUnlock.price, size: 17 });
      return;
    }
    const mine = specs.filter((sp) => sp.classId === classId);
    mine.forEach((sp, i) => {
      const on = this.save.specs[classId] === sp.id;
      button(this, W / 2 - 105 + i * 210, y - 8, 196, 40, sp.name, on ? 0xb57bff : 0x3a3150, () => {
        this.save = writeSave(this.storage, selectSpec(this.save, classId, sp.id));
        this.scene.restart();
      }, { size: 16, textColor: on ? '#0a0612' : '#ffffff' });
    });
    const current = mine.find((sp) => sp.id === this.save.specs[classId]);
    label(this, W / 2, y + 30, current.desc, 13, '#c9b8ff');
  }

  drawClassPicker(y) {
    const ids = Object.keys(this.db.classes);
    const gap = 118;
    const startX = W / 2 - ((ids.length - 1) * gap) / 2;
    ids.forEach((id, i) => {
      const cls = this.db.classes[id];
      const owned = this.save.classes.includes(id);
      const selected = this.save.selectedClass === id;
      const x = startX + i * gap;
      const chip = this.add.rectangle(x, y, 104, 74, 0x1b1230).setStrokeStyle(selected ? 4 : 2, selected ? 0xffd966 : 0x5a3f8a);
      this.add.circle(x, y - 12, 13, owned ? hex(cls.color) : 0x3a3150);
      label(this, x, y + 20, owned ? cls.name : '잠김', 15, owned ? '#ffffff' : '#6d6485', { bold: selected });
      if (owned) {
        chip.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          this.save = writeSave(this.storage, { ...this.save, selectedClass: id });
          this.scene.restart();
        });
      }
    });
  }

  startRun() {
    this.scene.start('game', { classId: this.save.selectedClass });
  }
}
