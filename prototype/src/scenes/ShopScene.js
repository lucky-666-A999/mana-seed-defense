import { loadSave, writeSave } from '../systems/Progression.js';
import { priceOf, canBuy, buy, levelOf } from '../systems/Shop.js';
import { safeStorage } from '../storage.js';
import { W, label, button, backdrop } from '../ui/widgets.js';

const ROW_H = 74;
const TOP = 200;
const TABS = [
  { id: 'upgrade', name: '능력', kinds: ['upgrade'] },
  { id: 'unlock', name: '해금', kinds: ['card'] },
  { id: 'spec', name: '전직', kinds: ['specNode'] },
];

export class ShopScene extends Phaser.Scene {
  constructor(db) {
    super('shop');
    this.db = db;
  }

  create(data) {
    this.storage = safeStorage();
    this.save = loadSave(this.storage);
    this.tab = TABS.find((t) => t.id === data?.tab) || TABS[0];
    this.specIndex = data?.specIndex || 0;
    backdrop(this);
    label(this, W / 2, 50, '성장', 32, '#ffd966', { bold: true });
    label(this, W / 2, 96, `결정화 마나시드 ◆ ${this.save.seeds}`, 20, '#9dffb0', { bold: true });
    TABS.forEach((t, i) => {
      const on = t.id === this.tab.id;
      button(this, W / 2 - 170 + i * 170, 150, 156, 46, t.name, on ? 0xffd966 : 0x3a3150,
        () => this.scene.restart({ tab: t.id }), { size: 18, textColor: on ? '#0a0612' : '#ffffff' });
    });
    if (this.tab.id === 'spec') {
      this.drawSpecTab();
      return;
    }
    this.db.shop.filter((item) => this.tab.kinds.includes(item.kind))
      .forEach((item, i) => this.drawRow(item, TOP + i * ROW_H));
    this.backButton();
  }

  // 전직 성장 트리: 판 안에서 발견한 전직마다 전용 노드. 발견 전이면 안내만.
  drawSpecTab() {
    const found = this.db.specs.filter((sp) => this.save.discovered[sp.id]);
    if (!found.length) {
      label(this, W / 2, 300, '아직 발견한 2차 전직이 없다', 22, '#ffffff', { bold: true });
      label(this, W / 2, 350, '판 안에서 아이템 조합으로 2차 전직을 하면\n그 전직의 전용 성장 노드가 여기에 열립니다', 16, '#c9b8ff', { lineSpacing: 8 });
      this.backButton();
      return;
    }
    const idx = Math.min(this.specIndex || 0, found.length - 1);
    const spec = found[idx];
    if (found.length > 1) {
      button(this, 60, 236, 70, 40, '◀', 0x3a3150, () => this.scene.restart({ tab: 'spec', specIndex: (idx - 1 + found.length) % found.length }), { textColor: '#ffffff' });
      button(this, W - 60, 236, 70, 40, '▶', 0x3a3150, () => this.scene.restart({ tab: 'spec', specIndex: (idx + 1) % found.length }), { textColor: '#ffffff' });
    }
    const cls = this.db.classes[spec.classId];
    label(this, W / 2, 226, `${cls.name} → ${spec.name}`, 22, spec.color, { bold: true });
    label(this, W / 2, 256, `${idx + 1} / ${found.length}`, 13, '#8f86a8');
    this.db.shop.filter((item) => item.kind === 'specNode' && item.specId === spec.id)
      .forEach((item, i) => this.drawRow(item, 290 + i * ROW_H));
    this.backButton();
  }

  backButton() {
    button(this, W / 2, 910, 240, 54, '로비로', 0x6fa8ff, () => this.scene.start('lobby'));
  }

  drawRow(item, y) {
    const lv = levelOf(item, this.save);
    const price = priceOf(item, this.save);
    this.add.rectangle(W / 2, y + ROW_H / 2 - 4, W - 30, ROW_H - 10, 0x1b1230).setStrokeStyle(1, 0x5a3f8a);
    label(this, 30, y + 16, item.name, 18, '#ffffff', { bold: true, originX: 0 });
    label(this, 30, y + 42, item.desc, 13, '#c9b8ff', { originX: 0, align: 'left', wrap: 300 });
    const pips = item.prices.length > 1 ? `${'●'.repeat(lv)}${'○'.repeat(item.prices.length - lv)}` : lv ? '보유' : '';
    label(this, 350, y + 16, pips, 13, '#ffd966', { originX: 1 });
    if (price === null) {
      label(this, 450, y + ROW_H / 2 - 4, '완료', 16, '#57e389', { bold: true });
      return;
    }
    button(this, 450, y + ROW_H / 2 - 4, 120, 44, `◆ ${price}`, 0x57e389, () => this.purchase(item), {
      enabled: canBuy(item, this.save), size: 17,
    });
  }

  purchase(item) {
    this.save = writeSave(this.storage, buy(this.save, item));
    this.scene.restart({ tab: this.tab.id, specIndex: this.specIndex });
  }
}
