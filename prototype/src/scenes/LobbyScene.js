import { loadSave } from '../systems/Progression.js';
import { safeStorage } from '../storage.js';
import { W, label, button, backdrop } from '../ui/widgets.js';

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
    label(this, W / 2, 360, `결정화 마나시드 ◆ ${this.save.seeds}`, 22, '#9dffb0', { bold: true });
    label(this, W / 2, 392, `최고 기록  웨이브 ${this.save.bestWave}`, 16, '#8f86a8');

    const recipes = this.db.recipes;
    const found = recipes.filter((r) => this.save.discovered[r.id]).length;
    label(this, W / 2, 470, `숨겨진 전직 발견  ${found} / ${recipes.length}`, 20, '#b57bff', { bold: true });
    label(this, W / 2, 504, found === 0
      ? '모두 초보자로 시작 — 레벨업 카드의 아이템을 모아 전직하라'
      : '모두 초보자로 시작 — 발견한 전직은 성장 > 전직 연구에서 강화', 14, '#c9b8ff');

    button(this, W / 2, 652, 320, 70, '출전', 0x57e389, () => this.startRun(), { size: 28 });
    const growable = this.db.specs.some((sp) => this.save.discovered[sp.id]
      && !this.db.shop.some((i) => i.kind === 'specNode' && i.specId === sp.id && this.save.upgrades[i.id]));
    button(this, W / 2, 738, 320, 52, growable ? '성장  (전직 트리 열림!)' : '성장', 0xffd966,
      () => this.scene.start('shop', { tab: growable ? 'spec' : 'upgrade' }));
    button(this, W / 2, 800, 320, 52, '기록', 0xb57bff, () => this.scene.start('codex'));
    button(this, W / 2, 862, 320, 52, '이야기', 0x6fa8ff, () => this.scene.start('intro'));
  }

  startRun() {
    this.scene.start('game');
  }
}
