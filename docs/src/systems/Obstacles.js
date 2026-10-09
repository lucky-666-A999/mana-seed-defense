export class ObstacleManager {
  constructor(scene, balance) {
    this.scene = scene;
    this.balance = balance;
    this.obstacles = [];
    this.graphics = scene.add.graphics();
    this.setupObstacles();
  }

  setupObstacles() {
    // 맵 중앙에서 반경 내에 장애물 배치 (원형 패턴)
    const positions = [
      { x: 0, y: -100, r: 40 },
      { x: 150, y: -50, r: 40 },
      { x: 150, y: 50, r: 40 },
      { x: 0, y: 150, r: 40 },
      { x: -150, y: -50, r: 40 },
      { x: -150, y: 50, r: 40 },
    ];

    positions.forEach(pos => {
      this.obstacles.push({
        x: this.scene.game.config.width / 2 + pos.x,
        y: this.scene.game.config.height / 2 + pos.y,
        radius: pos.r,
        canPlace: true, // 포탑 배치 가능 여부
      });
    });

    this.draw();
  }

  draw() {
    this.graphics.clear();
    this.graphics.fillStyle(0x4a5568, 0.6);
    this.graphics.lineStyle(2, 0x2d3748, 1);

    this.obstacles.forEach(obs => {
      this.graphics.fillCircle(obs.x, obs.y, obs.radius);
      this.graphics.strokeCircleShape(new Phaser.Geom.Circle(obs.x, obs.y, obs.radius));
    });
  }

  isColliding(x, y, radius) {
    return this.obstacles.some(obs => {
      const dist = Phaser.Math.Distance.Between(x, y, obs.x, obs.y);
      return dist < obs.radius + radius;
    });
  }

  canPlace(x, y, radius) {
    return !this.isColliding(x, y, radius);
  }

  getObstacles() {
    return this.obstacles;
  }

  destroy() {
    this.graphics.destroy();
  }
}
