import { loadSave, writeSave } from '../systems/Progression.js';
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

    this.drawClassPicker(470);
    button(this, W / 2, 610, 320, 70, '출전', 0x57e389, () => this.startRun(), { size: 28 });
    button(this, W / 2, 700, 320, 56, '성장', 0xffd966, () => this.scene.start('shop'));
    button(this, W / 2, 772, 320, 56, '기록', 0xb57bff, () => this.scene.start('codex'));
    button(this, W / 2, 844, 320, 56, '이야기', 0x6fa8ff, () => this.scene.start('intro'));
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
