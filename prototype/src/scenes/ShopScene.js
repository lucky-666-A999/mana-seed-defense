import { loadSave, writeSave } from '../systems/Progression.js';
import { priceOf, canBuy, buy, levelOf } from '../systems/Shop.js';
import { safeStorage } from '../storage.js';
import { W, label, button, backdrop } from '../ui/widgets.js';

const ROW_H = 74;
const TOP = 200;
const TABS = [
  { id: 'upgrade', name: '능력', kinds: ['upgrade'] },
  { id: 'unlock', name: '해금', kinds: ['card', 'class'] },
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
    backdrop(this);
    label(this, W / 2, 50, '성장', 32, '#ffd966', { bold: true });
    label(this, W / 2, 96, `보유 마나시드 ◆ ${this.save.seeds}`, 20, '#9dffb0', { bold: true });
    TABS.forEach((t, i) => {
      const on = t.id === this.tab.id;
      button(this, W / 2 - 90 + i * 180, 150, 168, 46, t.name, on ? 0xffd966 : 0x3a3150,
        () => this.scene.restart({ tab: t.id }), { size: 18, textColor: on ? '#0a0612' : '#ffffff' });
    });
    this.db.shop.filter((item) => this.tab.kinds.includes(item.kind))
      .forEach((item, i) => this.drawRow(item, TOP + i * ROW_H));
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
    this.scene.restart({ tab: this.tab.id });
  }
}
