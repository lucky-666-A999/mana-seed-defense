const BASE_RADIUS = 56;
const DEADZONE = 6;

// 참고 스크린샷처럼 누른 자리에 나타나는 반투명 플로팅 조이스틱.
// Phase 1은 우측 버튼이 없어서 화면 어디서 눌러도 된다(버튼 위는 제외).
export class Joystick {
  constructor(scene) {
    this.scene = scene;
    this.vec = { x: 0, y: 0 };
    this.pointerId = null;
    this.origin = { x: 0, y: 0 };
    this.base = scene.add.circle(0, 0, BASE_RADIUS, 0xffffff, 0.12)
      .setStrokeStyle(2, 0xffffff, 0.35).setScrollFactor(0).setDepth(1000).setVisible(false);
    this.knob = scene.add.circle(0, 0, 24, 0xffffff, 0.75)
      .setScrollFactor(0).setDepth(1001).setVisible(false);
    this.keys = scene.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
  }

  onDown(pointer, over) {
    if (this.pointerId !== null || this.scene.paused || over.length > 0) return;
    this.pointerId = pointer.id;
    this.origin = { x: pointer.x, y: pointer.y };
    this.base.setPosition(pointer.x, pointer.y).setVisible(true);
    this.knob.setPosition(pointer.x, pointer.y).setVisible(true);
    this.vec = { x: 0, y: 0 };
  }

  onMove(pointer) {
    if (pointer.id !== this.pointerId) return;
    let dx = pointer.x - this.origin.x;
    let dy = pointer.y - this.origin.y;
    const len = Math.hypot(dx, dy);
    if (len > BASE_RADIUS) {
      dx *= BASE_RADIUS / len;
      dy *= BASE_RADIUS / len;
    }
    this.knob.setPosition(this.origin.x + dx, this.origin.y + dy);
    this.vec = len < DEADZONE ? { x: 0, y: 0 } : { x: dx / BASE_RADIUS, y: dy / BASE_RADIUS };
  }

  onUp(pointer) {
    if (pointer.id === this.pointerId) this.release();
  }

  release() {
    this.pointerId = null;
    this.vec = { x: 0, y: 0 };
    this.base.setVisible(false);
    this.knob.setVisible(false);
  }

  read() {
    const k = this.keys;
    const kx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const ky = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (kx || ky) {
      const len = Math.hypot(kx, ky);
      return { x: kx / len, y: ky / len };
    }
    return this.vec;
  }
}
