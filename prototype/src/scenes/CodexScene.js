import { loadSave } from '../systems/Progression.js';
import { unlockedFragments } from '../systems/Story.js';
import { safeStorage } from '../storage.js';
import { W, label, button, backdrop } from '../ui/widgets.js';

const THRESHOLDS = { elite: [1, 3, 5], boss: [1, 2, 3] };

export class CodexScene extends Phaser.Scene {
  constructor(db) {
    super('codex');
    this.db = db;
  }

  create(data) {
    this.save = loadSave(safeStorage());
    const ids = Object.keys(this.db.story.units);
    this.selected = data?.unit || ids[0];
    backdrop(this);
    label(this, W / 2, 50, '기록', 32, '#b57bff', { bold: true });
    label(this, W / 2, 90, '지워지다 만 기억들', 16, '#8f86a8');
    const gap = 168;
    ids.forEach((id, i) => {
      const unit = this.db.story.units[id];
      const on = id === this.selected;
      button(this, W / 2 - gap + i * gap, 150, 156, 50, unit.name, on ? 0xb57bff : 0x3a3150,
        () => this.scene.restart({ unit: id }), { size: 17, textColor: on ? '#0a0612' : '#ffffff' });
    });
    this.drawUnit(this.selected);
    button(this, W / 2, 910, 240, 54, '로비로', 0x6fa8ff, () => this.scene.start('lobby'));
  }

  drawUnit(id) {
    const unit = this.db.story.units[id];
    const isBoss = Boolean(this.db.monsters[id].boss);
    const kills = this.save.kills[id] || 0;
    const met = this.save.encounters[id] || 0;
    const open = unlockedFragments(kills, isBoss);
    label(this, W / 2, 222, `${unit.title} ${unit.name}`, 26, '#ffd966', { bold: true });
    label(this, W / 2, 258, met ? `만남 ${met}회 · 처치 ${kills}회` : '아직 만나지 못했다', 15, '#c9b8ff');
    const need = isBoss ? THRESHOLDS.boss : THRESHOLDS.elite;
    unit.fragments.forEach((text, i) => {
      const y = 330 + i * 170;
      this.add.rectangle(W / 2, y + 60, W - 40, 150, 0x1b1230).setStrokeStyle(1, i < open ? 0xb57bff : 0x3a3150);
      label(this, 40, y, `기억 조각 ${i + 1}`, 14, i < open ? '#b57bff' : '#6d6485', { bold: true, originX: 0 });
      label(this, 40, y + 26, i < open ? text : `???  (처치 ${need[i]}회 필요)`, 16, i < open ? '#ffffff' : '#6d6485', {
        originX: 0, originY: 0, align: 'left', wrap: W - 90, lineSpacing: 6,
      });
    });
  }
}
