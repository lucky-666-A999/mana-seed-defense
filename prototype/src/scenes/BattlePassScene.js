import { BattlePassRun } from '../systems/BattlePassSystem.js';
import { W, label, button, backdrop } from '../ui/widgets.js';

export class BattlePassScene extends Phaser.Scene {
  constructor(battlePassData) {
    super('battlepass');
    this.battlePassData = battlePassData;
  }

  create() {
    backdrop(this);
    this.battlePass = new BattlePassRun(this.battlePassData);

    const y0 = 80;
    label(this, W / 2, y0, '배틀패스', 36, '#ffaa00', { bold: true });
    label(this, W / 2, y0 + 44, `시즌 1: 마나의 각성 (7일 남음)`, 14, '#ffcc77');

    const progress = this.battlePass.getProgress();

    label(this, 60, 160, `레벨 ${progress.level} / 50`, 20, '#ffffff', { bold: true });
    label(this, 60, 194, `경험치 ${progress.exp} / ${progress.maxExp}`, 14, '#cccccc');

    const expPercent = Math.min(100, (progress.exp / progress.maxExp) * 100);
    const barBg = this.add.rectangle(60, 212, 200, 16, 0x333333);
    const barFill = this.add.rectangle(60 - 100 + (expPercent / 100) * 100, 212, (expPercent / 100) * 200, 16, 0x00ff88);

    label(this, W / 2, 280, '일일 퀘스트', 22, '#ffaa00', { bold: true });
    const dailyQuests = this.battlePassData.quests.daily;
    dailyQuests.forEach((q, i) => {
      const p = progress.dailyQuests[q.id];
      const completed = p && p.progress >= q.target;
      label(this, 60, 320 + i * 44, `${q.name}`, 14, completed ? '#ffaa00' : '#ffffff');
      label(this, 60, 342 + i * 44, `${Math.min(p?.progress || 0, q.target)} / ${q.target} · +${q.reward}exp`, 12, completed ? '#ffaa00' : '#cccccc');
    });

    const questY = 320 + dailyQuests.length * 44 + 20;
    label(this, W / 2, questY, '주간 퀘스트', 22, '#ff66ff', { bold: true });
    const weeklyQuests = this.battlePassData.quests.weekly;
    weeklyQuests.forEach((q, i) => {
      const p = progress.weeklyQuests[q.id];
      const completed = p && p.progress >= q.target;
      label(this, 60, questY + 40 + i * 44, `${q.name}`, 14, completed ? '#ff66ff' : '#ffffff');
      label(this, 60, questY + 62 + i * 44, `${Math.min(p?.progress || 0, q.target)} / ${q.target} · +${q.reward}exp`, 12, completed ? '#ff66ff' : '#cccccc');
    });

    const bottomY = questY + 40 + weeklyQuests.length * 44 + 40;
    button(this, W / 2, bottomY, 200, 48, '돌아가기', 0x666666, () => this.scene.start('lobby'));
  }
}
