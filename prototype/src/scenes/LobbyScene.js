import { loadSave } from '../systems/Progression.js';
import { discoveredCount } from '../systems/Shop.js';
import { safeStorage } from '../storage.js';
import { W, label, button, backdrop } from '../ui/widgets.js';
import { heroScale, coreScale, artStyle, setArtStyle } from '../art/Art.js';

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
    const glow = this.add.image(W / 2, 170, 'glow').setScale(3.4).setTint(0x57e389).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.6, scale: 3.9, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const core = this.add.image(W / 2, 160, 'core_seed').setScale(coreScale());
    this.tweens.add({ targets: core, y: 150, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.lineup();
    // 그림체 비교: 치비 ↔ 도트
    const pixel = artStyle() === 'pixel';
    button(this, W - 82, 36, 140, 40, pixel ? '그림체: 도트' : '그림체: 치비', 0x3b2a5a, () => {
      setArtStyle(pixel ? 'chibi' : 'pixel');
      this.scene.restart();
    }, { size: 15, textColor: '#e5dbff' });
    label(this, W / 2, 262, '마나시드 디펜스', 40, '#ffffff', { bold: true });
    label(this, W / 2, 306, '씨앗이 자라면, 탑으로 가는 길이 열린다', 16, '#c9b8ff');
    label(this, W / 2, 360, `결정화 마나시드 ◆ ${this.save.seeds}`, 22, '#9dffb0', { bold: true });
    label(this, W / 2, 392, `최고 기록  웨이브 ${this.save.bestWave}`, 16, '#8f86a8');

    const total = this.db.recipes.length + this.db.specs.length * 3;
    const found = discoveredCount(this.save.discovered);
    label(this, W / 2, 470, `숨겨진 전직 발견  ${found} / ${total}`, 20, '#b57bff', { bold: true });
    label(this, W / 2, 504, found === 0
      ? '모두 초보자로 시작 — 레벨업 카드의 아이템을 모아 전직하라'
      : '모두 초보자로 시작 — 전직을 발견할수록 도감 보상이 쌓인다', 14, '#c9b8ff');

    button(this, W / 2, 652, 320, 70, '출전', 0x57e389, () => this.startRun(), { size: 28 });
    button(this, W / 2, 738, 320, 52, '성장', 0xffd966, () => this.scene.start('shop'));
    button(this, W / 2, 800, 320, 52, '기록', 0xb57bff, () => this.scene.start('codex'));
    button(this, W / 2, 862, 320, 52, '이야기', 0x6fa8ff, () => this.scene.start('intro'));
  }

  // 초보자가 무엇이 될 수 있는지: 직업 치비 줄 세우기 (초보자 가운데)
  lineup() {
    const ids = Object.keys(this.db.classes);
    const order = [...ids.slice(1, 4), ids[0], ...ids.slice(4)];
    const gap = 62;
    order.forEach((id, i) => {
      const x = W / 2 + (i - (order.length - 1) / 2) * gap;
      const r = this.db.classes[id].radius;
      const img = this.add.image(x, 574, `hero_${id}`).setScale(heroScale(r) * (id === 'novice' ? 1.8 : 1.35));
      if (id !== 'novice') img.setAlpha(0.55);
      this.tweens.add({ targets: img, y: 566, duration: 600 + i * 40, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 90 });
    });
  }

  startRun() {
    this.scene.start('game');
  }
}
