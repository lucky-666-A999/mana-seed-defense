const DASH = { x: 474, y: 846, r: 44 };
const SKILL = { x: 382, y: 890, r: 36 };

// 우하단 대시·스킬 버튼. 쿨다운은 어두운 부채꼴이 걷히며 표시. 키보드: Space 대시, Q 스킬.
export class ActionButtons {
  constructor(scene) {
    this.scene = scene;
    const fixed = (o) => o.setScrollFactor(0).setDepth(960);
    this.dashBtn = fixed(scene.add.circle(DASH.x, DASH.y, DASH.r, 0x6fa8ff, 0.35).setStrokeStyle(3, 0xffffff, 0.7));
    this.skillBtn = fixed(scene.add.circle(SKILL.x, SKILL.y, SKILL.r, 0xffd966, 0.35).setStrokeStyle(3, 0xffffff, 0.7));
    fixed(scene.add.text(DASH.x, DASH.y, '대시', { fontSize: '17px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5)).setDepth(962);
    fixed(scene.add.text(SKILL.x, SKILL.y, '스킬', { fontSize: '15px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5)).setDepth(962);
    this.cd = fixed(scene.add.graphics()).setDepth(961);
    this.dashBtn.setInteractive({ useHandCursor: true }).on('pointerdown', () => scene.hero.tryDash());
    this.skillBtn.setInteractive({ useHandCursor: true }).on('pointerdown', () => scene.hero.trySkill());
    scene.input.keyboard.on('keydown-SPACE', () => scene.hero.tryDash());
    scene.input.keyboard.on('keydown-Q', () => scene.hero.trySkill());
  }

  update() {
    const hero = this.scene.hero;
    this.cd.clear();
    this.drawCooldown(DASH, hero.dashReadyRatio());
    this.drawCooldown(SKILL, hero.skillReadyRatio());
  }

  drawCooldown(btn, ready) {
    if (ready >= 1) return;
    const start = -Math.PI / 2 + Math.PI * 2 * ready;
    this.cd.fillStyle(0x000000, 0.6);
    this.cd.slice(btn.x, btn.y, btn.r, start, Math.PI * 1.5, false);
    this.cd.fillPath();
  }
}
