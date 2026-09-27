import { Joystick } from '../input/Joystick.js';

const hex = (color) => parseInt(color.replace('#', ''), 16);

export class GameScene extends Phaser.Scene {
  constructor(db) {
    super('game');
    this.db = db;
  }

  create() {
    const { balance, classes } = this.db;
    const world = balance.world;
    this.cls = classes.warden;
    this.paused = false;

    this.cameras.main.setBounds(0, 0, world.width, world.height);
    this.drawFloor(world);

    this.core = { x: world.width / 2, y: world.height / 2, radius: balance.core.radius };
    this.add.rectangle(this.core.x, this.core.y, 40, 40, 0x57e389).setAngle(45).setStrokeStyle(3, 0xd8ffe4);

    this.player = { x: this.core.x, y: this.core.y + 90, radius: this.cls.radius };
    this.playerSprite = this.add.circle(this.player.x, this.player.y, this.player.radius, hex(this.cls.color)).setDepth(10);
    this.cameras.main.startFollow(this.playerSprite, true, 0.15, 0.15);

    this.joystick = new Joystick(this);
  }

  drawFloor(world) {
    const g = this.add.graphics();
    g.lineStyle(1, 0x2a1f40, 1);
    for (let x = 0; x <= world.width; x += 60) g.lineBetween(x, 0, x, world.height);
    for (let y = 0; y <= world.height; y += 60) g.lineBetween(0, y, world.width, y);
    g.lineStyle(3, 0x5a3f8a, 1).strokeRect(0, 0, world.width, world.height);
  }

  update(_time, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 0.05);
    const v = this.joystick.read();
    const world = this.db.balance.world;
    const p = this.player;
    p.x = Phaser.Math.Clamp(p.x + v.x * this.cls.moveSpeed * dt, p.radius, world.width - p.radius);
    p.y = Phaser.Math.Clamp(p.y + v.y * this.cls.moveSpeed * dt, p.radius, world.height - p.radius);
    this.playerSprite.setPosition(p.x, p.y);
  }
}
