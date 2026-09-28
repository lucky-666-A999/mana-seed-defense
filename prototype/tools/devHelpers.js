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
  if (s.overlay.kind === 'branch') {
    s.overlay.destroy();
    s.resume();
    s.transform(s.db.recipes.find((r) => r.id === 'swordsman'), '막대 수련');
    return;
  }
  if (s.overlay.kind === 'transform') {
    s.overlay.destroy();
    s.resume();
    s.checkFlow();
    return;
  }
  if (s.run.state === 'cleared' && s.progress.pendingLevelups === 0) {
    s.overlay.destroy();
    s.continueRun();
    return;
  }
  // 손패에 아이템이 있으면 아이템 우선(조합·전직 테스트), 없으면 최대단계 안 찬 일반 카드
  const itemCard = (s.lastHand || []).find((c) => c.isItem && !(c.itemId in s.owned));
  const card = itemCard || s.db.cards.find((c) => c.grade === 'common' && (s.ranks[c.id] || 0) < 5) || s.db.cards.find((c) => c.id === 'heal');
  s.lastHand = null;
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


// 봇용: 출전 시 마나 스킬 선택 화면을 무작위 마나 스킬로 처리
function takeStarter(s) {
  if (!s.overlay || s.run.state !== 'prep') return;
  s.overlay.destroy();
  s.resume();
  const mana = s.cardList.filter((c) => c.mana);
  s.applyCard(mana[Math.floor(Math.random() * mana.length)]);
  s.checkFlow();
}

// 무적 없는 생존 봇 (보통 실력 가정): 사거리 끝 유지, 돌진 경고선·탄환 옆으로 회피, 위험하면 대시, 모이면 스킬.
export function survive(maxWave = 25, maxSec = 1800) {
  const s = S();
  tick(1);
  takeStarter(s);
  s.run.skipPrep();
  let t = 0;
  while (!s.ended && s.run.wave <= maxWave && t < maxSec * 6) {
    t++;
    if (s.run.state === 'prep') s.run.skipPrep();
    const p = s.player;
    const alive = s.monsters.alive();
    const dist = (m) => Math.hypot(m.x - p.x, m.y - p.y);
    const near = (r) => alive.filter((m) => dist(m) < r + m.def.radius);
    const keep = s.hero.range() * 0.8;
    let vx = 0;
    let vy = 0;
    // 1) 목표: 코어 근처 위협 우선, 사거리 끝 유지
    const threats = alive.filter((m) => Math.hypot(m.x - s.core.x, m.y - s.core.y) < 300 || m.def.behavior === 'ranged' || m.def.behavior === 'avenger');
    const pool = threats.length ? threats : alive;
    let best = null;
    for (const m of pool) if (!best || dist(m) < dist(best)) best = m;
    const crystal = s.crystals?.list[0];
    const coreSafe = !alive.some((m) => Math.hypot(m.x - s.core.x, m.y - s.core.y) < 200);
    if (crystal && (coreSafe || !best)) {
      const dx = crystal.x - p.x;
      const dy = crystal.y - p.y;
      const l = Math.hypot(dx, dy);
      if (l > 20) { vx = dx / l; vy = dy / l; }
    } else if (best) {
      const d = dist(best);
      const want = d - (keep + best.def.radius);
      vx = ((best.x - p.x) / d) * Math.sign(want) * Math.min(1, Math.abs(want) / 20);
      vy = ((best.y - p.y) / d) * Math.sign(want) * Math.min(1, Math.abs(want) / 20);
    } else {
      const dx = s.core.x - p.x;
      const dy = s.core.y + 70 - p.y;
      const l = Math.hypot(dx, dy);
      if (l > 10) { vx = dx / l; vy = dy / l; }
    }
    // 2) 너무 가까운 적에게서 밀려나기
    for (const m of near(40)) {
      const d = dist(m) || 1;
      vx += ((p.x - m.x) / d) * 1.2;
      vy += ((p.y - m.y) / d) * 1.2;
    }
    // 3) 나를 겨눈 돌진 경고선이면 수직으로 회피
    for (const m of alive) {
      if (m.state !== 'aim' || dist(m) > 600) continue;
      const toMe = Math.atan2(p.y - m.y, p.x - m.x);
      if (Math.abs(Phaser.Math.Angle.Wrap(toMe - m.dir)) < 0.35) {
        vx += -Math.sin(m.dir) * 2;
        vy += Math.cos(m.dir) * 2;
      }
    }
    // 4) 다가오는 탄환 회피
    for (const b of s.projectiles.list) {
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (d > 90) continue;
      const bd = Math.atan2(b.vy, b.vx);
      vx += -Math.sin(bd) * 1.5;
      vy += Math.cos(bd) * 1.5;
    }
    const len = Math.hypot(vx, vy);
    s.joystick.vec = len > 0.05 ? { x: vx / Math.max(1, len), y: vy / Math.max(1, len) } : { x: 0, y: 0 };
    if (p.hp < s.maxHp() * 0.4 && near(70).length) {
      const m = near(70)[0];
      const a = Math.atan2(p.y - m.y, p.x - m.x);
      s.hero.lastDir = { x: Math.cos(a), y: Math.sin(a) };
      s.hero.tryDash();
    }
    if (near(130).length >= 3 || near(120).some((m) => m.def.elite || m.def.boss)) s.hero.trySkill();
    tick(10);
    auto();
  }
  s.joystick.vec = { x: 0, y: 0 };
  return { wave: s.run.wave, level: s.progress.level, outcome: s.ended ? (s.player.hp <= 0 ? 'dead' : 'coreLost') : 'alive', min: Math.round(t / 360), coreHp: Math.round(s.core.hp), form: s.spec?.name || s.cls.name };
}

// 캠핑 봇: 코어 위에서 절대 움직이지 않고 스킬만 쓴다 (캠핑이 막혔는지 확인용)
export function camp(maxWave = 25, maxSec = 1800) {
  const s = S();
  tick(1);
  takeStarter(s);
  s.run.skipPrep();
  let t = 0;
  while (!s.ended && s.run.wave <= maxWave && t < maxSec * 6) {
    t++;
    if (s.run.state === 'prep') s.run.skipPrep();
    s.joystick.vec = { x: 0, y: 0 };
    s.player.x = s.core.x;
    s.player.y = s.core.y;
    const near = s.monsters.alive().filter((m) => Math.hypot(m.x - s.player.x, m.y - s.player.y) < 130);
    if (near.length >= 3) s.hero.trySkill();
    tick(10);
    auto();
  }
  return { wave: s.run.wave, level: s.progress.level, outcome: s.ended ? (s.player.hp <= 0 ? 'dead' : 'coreLost') : 'alive' };
}
