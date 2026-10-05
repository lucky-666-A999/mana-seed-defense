const W = 540;
const H = 960;
const LINE_SECONDS = 2.8;

// 준비 단계 예고 배너, 정예·보스 대사창, 보스전 붉은 테두리
export class Banner {
  constructor(scene) {
    this.scene = scene;
    const fixed = (o) => o.setScrollFactor(0).setDepth(950);
    this.warning = fixed(scene.add.text(W / 2, 134, '', {
      fontSize: '19px', fontStyle: 'bold', color: '#ffd966', backgroundColor: '#2a0f1acc', padding: { x: 14, y: 8 }, align: 'center',
    }).setOrigin(0.5)).setVisible(false);
    this.lineBox = fixed(scene.add.rectangle(W / 2, 752, W - 40, 72, 0x120a20, 0.88).setStrokeStyle(2, 0xffffff, 0.3)).setVisible(false);
    this.lineName = fixed(scene.add.text(40, 726, '', { fontSize: '15px', fontStyle: 'bold', color: '#ffd966' })).setVisible(false);
    this.lineText = fixed(scene.add.text(40, 750, '', { fontSize: '17px', color: '#ffffff', wordWrap: { width: W - 90 } })).setVisible(false);
    this.frame = fixed(scene.add.rectangle(W / 2, H / 2, W - 6, H - 6).setStrokeStyle(8, 0xff2244, 0.55)).setVisible(false);
    this.lineTimer = 0;
    this.pulse = 0;
  }

  setWarning(text) {
    this.warning.setText(text).setVisible(Boolean(text));
  }

  say(unit, text, color = '#ffd966') {
    this.lineName.setText(`${unit.title} ${unit.name}`).setColor(color);
    this.lineText.setText(`"${text}"`);
    for (const o of [this.lineBox, this.lineName, this.lineText]) o.setVisible(true);
    this.lineTimer = LINE_SECONDS;
  }

  setBossFrame(on) {
    this.frame.setVisible(on);
  }

  update(dt) {
    if (this.lineTimer > 0) {
      this.lineTimer -= dt;
      if (this.lineTimer <= 0) for (const o of [this.lineBox, this.lineName, this.lineText]) o.setVisible(false);
    }
    if (this.frame.visible) {
      this.pulse += dt * 4;
      this.frame.setAlpha(0.45 + Math.sin(this.pulse) * 0.25);
    }
  }
}
