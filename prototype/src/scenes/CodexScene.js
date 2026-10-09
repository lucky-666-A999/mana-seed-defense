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
    const ids = [...Object.keys(this.db.story.units), 'recipes'];
    this.selected = data?.unit || ids[0];
    backdrop(this);
    label(this, W / 2, 50, '기록', 32, '#b57bff', { bold: true });
    label(this, W / 2, 90, '지워지다 만 기억들', 16, '#8f86a8');
    const gap = 128;
    ids.forEach((id, i) => {
      const name = id === 'recipes' ? '전직 도감' : this.db.story.units[id].name;
      const on = id === this.selected;
      button(this, W / 2 - gap * 1.5 + i * gap, 150, 118, 48, name, on ? 0xb57bff : 0x3a3150,
        () => this.scene.restart({ unit: id }), { size: 16, textColor: on ? '#0a0612' : '#ffffff' });
    });
    if (this.selected === 'recipes') this.drawRecipes();
    else this.drawUnit(this.selected);
    button(this, W / 2, 910, 240, 54, '로비로', 0x6fa8ff, () => this.scene.start('lobby'));
  }

  // 숨겨진 전직 조합: 발견하면 공개, 아니면 힌트만
  drawRecipes() {
    const { recipes, items, classes, specs } = this.db;
    const nameOf = (id) => classes[id]?.name || specs.find((sp) => sp.id === id)?.name;
    const found = recipes.filter((r) => this.save.discovered[r.id]).length;
    label(this, W / 2, 200, `발견 ${found} / ${recipes.length}`, 16, '#c9b8ff');
    recipes.forEach((r, i) => {
      const y = 236 + i * 58;
      const open = this.save.discovered[r.id];
      this.add.rectangle(W / 2, y + 18, W - 30, 52, 0x1b1230).setStrokeStyle(1, open ? 0xb57bff : 0x3a3150);
      const tier = r.result.type === 'class' ? '1차' : '2차';
      label(this, 30, y + 6, open ? `${tier} ${nameOf(r.result.id)}` : `${tier} ???`, 16, open ? '#ffd966' : '#6d6485', { bold: true, originX: 0 });
      if (r.result.type === 'spec') {
        const spec = specs.find((sp) => sp.id === r.result.id);
        const stars = spec.ascend.map((a) => (this.save.discovered[`${spec.id}@${a.tier}`] ? '★' : '☆')).join('');
        const top = [...spec.ascend].reverse().find((a) => this.save.discovered[`${spec.id}@${a.tier}`]);
        label(this, W - 30, y + 6, top ? `${stars}  ${top.tier}차 ${top.name}` : `${stars}  3~5차: 재료 강화`, 13, '#ffd43b', { originX: 1 });
      }
      const combo = open
        ? `${nameOf(r.from)} + ${r.items.map((id) => items.find((it) => it.id === id).name).join(' + ')}`
        : r.hint;
      const detail = r.altPath ? `${combo}   또는  ${r.altPath}` : combo;
      label(this, 30, y + 30, detail, 12, open ? '#9dffb0' : '#8f86a8', { originX: 0, align: 'left' });
    });
  }

  drawUnit(id) {
    const unit = this.db.story.units[id];
    const isBoss = Boolean(this.db.monsters[id].boss);
    const kills = this.save.kills[id] || 0;
    const met = this.save.encounters[id] || 0;
    const open = unlockedFragments(kills, isBoss, this.save.bestWave);
    label(this, W / 2, 222, `${unit.title} ${unit.name}`, 26, '#ffd966', { bold: true });
    label(this, W / 2, 258, met ? `만남 ${met}회 · 처치 ${kills}회` : '아직 만나지 못했다', 15, '#c9b8ff');
    const need = isBoss ? THRESHOLDS.boss : THRESHOLDS.elite;
    unit.fragments.forEach((text, i) => {
      const y = 330 + i * 170;
      this.add.rectangle(W / 2, y + 60, W - 40, 150, 0x1b1230).setStrokeStyle(1, i < open ? 0xb57bff : 0x3a3150);
      label(this, 40, y, `기억 조각 ${i + 1}`, 14, i < open ? '#b57bff' : '#6d6485', { bold: true, originX: 0 });
      const lockText = i === 2 && this.save.bestWave < 10 ? `??? (웨이브 10 이상 필요)` : `???  (처치 ${need[i]}회 필요)`;
      label(this, 40, y + 26, i < open ? text : lockText, 16, i < open ? '#ffffff' : '#6d6485', {
        originX: 0, originY: 0, align: 'left', wrap: W - 90, lineSpacing: 6,
      });
    });
  }
}
