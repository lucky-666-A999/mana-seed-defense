import { loadSave, writeSave } from '../systems/Progression.js';
import { safeStorage } from '../storage.js';
import { W, H, label, button, backdrop } from '../ui/widgets.js';

export class IntroScene extends Phaser.Scene {
  constructor(db) {
    super('intro');
    this.db = db;
  }

  create() {
    this.page = 0;
    backdrop(this);
    this.title = label(this, W / 2, 250, '', 30, '#ffd966', { bold: true });
    this.body = label(this, W / 2, 470, '', 20, '#ffffff', { wrap: W - 80, lineSpacing: 10 });
    this.hint = label(this, W / 2, 800, '', 16, '#8f86a8');
    button(this, W - 70, 40, 110, 42, '건너뛰기', 0x3a3150, () => this.finish(), { size: 16, textColor: '#ffffff' });
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.001).setInteractive().on('pointerdown', () => this.next()).setDepth(-1);
    this.input.keyboard.on('keydown-SPACE', () => this.next());
    this.show();
  }

  show() {
    const page = this.db.story.intro[this.page];
    this.title.setText(page.title);
    this.body.setText(page.text).setAlpha(0);
    this.tweens.add({ targets: this.body, alpha: 1, duration: 600 });
    const last = this.page === this.db.story.intro.length - 1;
    this.hint.setText(last ? '화면을 누르면 시작' : `화면을 눌러 계속 (${this.page + 1}/${this.db.story.intro.length})`);
  }

  next() {
    this.page++;
    if (this.page >= this.db.story.intro.length) this.finish();
    else this.show();
  }

  finish() {
    const storage = safeStorage();
    writeSave(storage, { ...loadSave(storage), seenIntro: true });
    this.scene.start('lobby');
  }
}
