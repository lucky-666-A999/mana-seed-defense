export class BattlePassRun {
  constructor(battlePassData) {
    this.data = battlePassData;
    this.currentSeason = battlePassData.seasons[0];
    this.level = 1;
    this.exp = 0;
    this.hasPremium = false;
    this.questProgress = {
      daily: {},
      weekly: {}
    };
    this.claimedRewards = new Set();
    this.lastQuestResetDate = new Date().toDateString();

    this.initializeQuests();
  }

  initializeQuests() {
    this.data.quests.daily.forEach(q => {
      this.questProgress.daily[q.id] = { progress: 0, claimed: false };
    });
    this.data.quests.weekly.forEach(q => {
      this.questProgress.weekly[q.id] = { progress: 0, claimed: false };
    });
  }

  addExp(amount) {
    this.exp += amount;
    const expPerLevel = this.currentSeason.expPerLevel;
    while (this.exp >= expPerLevel && this.level < this.currentSeason.maxLevel) {
      this.exp -= expPerLevel;
      this.level++;
    }
  }

  updateQuestProgress(questId, progress) {
    const quest = this.findQuest(questId);
    if (!quest) return;

    const isDaily = this.data.quests.daily.some(q => q.id === questId);
    const tracker = isDaily ? this.questProgress.daily : this.questProgress.weekly;

    if (!tracker[questId]) tracker[questId] = { progress: 0, claimed: false };
    tracker[questId].progress = Math.max(tracker[questId].progress, progress);
  }

  claimQuestReward(questId) {
    const quest = this.findQuest(questId);
    if (!quest) return 0;

    const isDaily = this.data.quests.daily.some(q => q.id === questId);
    const tracker = isDaily ? this.questProgress.daily : this.questProgress.weekly;

    if (tracker[questId].claimed || tracker[questId].progress < quest.target) {
      return 0;
    }

    tracker[questId].claimed = true;
    this.addExp(quest.reward);
    return quest.reward;
  }

  claimLevelReward(level) {
    if (this.level < level || this.claimedRewards.has(level)) return null;

    this.claimedRewards.add(level);

    const pathKey = this.hasPremium ? 'premium' : 'free';
    const reward = this.data.rewards[pathKey].find(r => r.level === level);

    return reward || null;
  }

  getPremiumPass() {
    this.hasPremium = true;
    const claimable = [];

    this.data.rewards.premium.forEach(r => {
      if (r.level <= this.level && !this.claimedRewards.has(r.level)) {
        claimable.push(this.claimLevelReward(r.level));
      }
    });

    return claimable;
  }

  getProgress() {
    return {
      level: this.level,
      exp: this.exp,
      maxExp: this.currentSeason.expPerLevel,
      hasPremium: this.hasPremium,
      dailyQuests: this.questProgress.daily,
      weeklyQuests: this.questProgress.weekly
    };
  }

  isQuestCompleted(questId) {
    const quest = this.findQuest(questId);
    const isDaily = this.data.quests.daily.some(q => q.id === questId);
    const tracker = isDaily ? this.questProgress.daily : this.questProgress.weekly;
    return tracker[questId]?.progress >= quest.target;
  }

  findQuest(questId) {
    return (
      this.data.quests.daily.find(q => q.id === questId) ||
      this.data.quests.weekly.find(q => q.id === questId)
    );
  }

  resetDailyQuests() {
    const today = new Date().toDateString();
    if (this.lastQuestResetDate !== today) {
      this.data.quests.daily.forEach(q => {
        this.questProgress.daily[q.id] = { progress: 0, claimed: false };
      });
      this.lastQuestResetDate = today;
    }
  }

  resetWeeklyQuests() {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + this.data.settings.weekStart);
    weekStart.setHours(this.data.settings.questRefreshHour, 0, 0, 0);

    if (!this.lastWeeklyResetDate || new Date(this.lastWeeklyResetDate) < weekStart) {
      this.data.quests.weekly.forEach(q => {
        this.questProgress.weekly[q.id] = { progress: 0, claimed: false };
      });
      this.lastWeeklyResetDate = weekStart.toISOString();
    }
  }
}
