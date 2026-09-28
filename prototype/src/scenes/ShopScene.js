import { loadSave, writeSave } from '../systems/Progression.js';
import { priceOf, canBuy, buy, levelOf } from '../systems/Shop.js';
import { safeStorage } from '../storage.js';
import { W, label, button, backdrop } from '../ui/widgets.js';

const ROW_H = 74;
const TOP = 200;
const TABS = [
  { id: 'upgrade', name: '능력', kinds: ['upgrade'] },
  { id: 'unlock', name: '해금', kinds: ['card', 'class'] },
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
    backdrop(this);
    if (data?.notice) label(this, W / 2, 858, data.notice, 16, '#9dffb0', { bold: true });
    label(this, W / 2, 50, '성장', 32, '#ffd966', { bold: true });
    label(this, W / 2, 96, `보유 마나시드 ◆ ${this.save.seeds}`, 20, '#9dffb0', { bold: true });
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

  // 전직 성장 트리: 로비에서 고른 직업의 현재 전직 전용 노드만
  drawSpecTab() {
    const classId = this.save.selectedClass;
    const cls = this.db.classes[classId];
    const specId = this.save.ownedSpecs[classId] ? this.save.specs[classId] : null;
    if (!specId) {
      label(this, W / 2, 300, `${cls.name}은(는) 아직 전직 전`, 22, '#ffffff', { bold: true });
      label(this, W / 2, 346, `${cls.name}으로 ${this.db.balance.specUnlock.wave}웨이브 이상에서 마무리하고\n로비에서 전직을 해금하면 전용 성장 트리가 열립니다`, 16, '#c9b8ff', { lineSpacing: 8 });
      this.backButton();
      return;
    }
    const spec = this.db.specs.find((s) => s.id === specId);
    label(this, W / 2, 226, `${cls.name} → ${spec.name}`, 22, '#b57bff', { bold: true });
    label(this, W / 2, 256, spec.desc, 13, '#c9b8ff');
    this.db.shop.filter((item) => item.kind === 'specNode' && item.specId === specId)
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
    const notice = item.kind === 'class'
      ? `${this.db.classes[item.classId].name} 해금! 로비에서 출전하면 ${this.db.classes[item.classId].name}(으)로 시작`
      : null;
    this.scene.restart({ tab: this.tab.id, notice });
  }
}
