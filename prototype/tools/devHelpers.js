// 브라우저 검증용 헬퍼 (게임에는 로드되지 않음). 콘솔에서: await import('/tools/devHelpers.js')
const game = window.__game;
const S = () => game.scene.getScene('game');

export function tick(n) {
  for (let i = 0; i < n; i++) game.step(performance.now(), 16.6);
}

// 오버레이 자동 처리: 카드는 최대단계 안 찬 일반 카드, 클리어는 이어가기
export function auto() {
  const s = S();
  if (!s.overlay || s.ended) return;
  if (s.run.state === 'cleared' && s.progress.pendingLevelups === 0) {
    s.overlay.destroy();
    s.continueRun();
    return;
  }
  const card = s.db.cards.find((c) => c.grade === 'common' && (s.ranks[c.id] || 0) < 5) || s.db.cards.find((c) => c.id === 'heal');
  s.applyCard(card);
  s.overlay.destroy();
  s.resume();
  s.checkFlow();
}

export function reset() {
  const s = S();
  for (const m of s.monsters.list) {
    m.dead = true;
    m.sprite.destroy();
  }
  s.monsters.list = [];
  for (const b of s.projectiles.list) b.sprite.destroy();
  s.projectiles.list = [];
  if (s.overlay) {
    s.overlay.destroy();
    s.resume();
  }
  s.progress.pendingLevelups = 0;
  s.core.hp = s.core.maxHp;
  s.ended = false;
  s.banner.setBossFrame(false);
}

// 웨이브 n을 봇(가장 가까운 적 추격, 무적)으로 끝까지. 멈춤 감지 포함.
export function runWave(n, maxSec = 150) {
  const s = S();
  reset();
  s.run.wave = n - 1;
  s.run.nextWave();
  s.announceWave();
  s.run.skipPrep();
  tick(2);
  for (let i = 0; i < maxSec * 6; i++) {
    s.player.hp = s.maxHp();
    s.core.hp = s.core.maxHp;
    const t = s.monsters.nearest(s.player.x, s.player.y, 9999);
    if (t) {
      s.player.x = t.x;
      s.player.y = t.y + t.def.radius + 30;
    }
    tick(10);
    if (s.run.state === 'cleared') return { n, ok: true, sec: Math.round(i / 6) };
    const alive = s.monsters.list.filter((m) => !m.dead);
    if (alive.length === 0 && s.run.queue.length === 0 && !s.paused) {
      return { n, ok: false, stuck: true, total: s.run.total, resolved: s.run.resolved };
    }
    auto();
  }
  return { n, ok: false, timeout: true, total: s.run.total, resolved: s.run.resolved };
}

Object.assign(window, { S: S(), tick, auto, reset, runWave });
