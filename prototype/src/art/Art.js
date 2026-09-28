// 아트: 이미지 파일 없이 캔버스로 텍스처를 그려 등록한다. 스타일 가이드: docs/art/style-guide.md
// 그림체 두 가지: 'pixel' = 정식 도트(sprites.js, 기본), 'chibi' = 1차 초벌 매끈한 치비(비교용).
import {
  PALETTE, HERO_BASE, HERO_WALK, HATS as PIXEL_HATS, MON_BASE, MON_PARTS, BOSS, CORE, SPEC_MARKS, CAPE, PAULDRON, HALO, HERO_PAD, FX, compose,
} from './sprites.js';

export const HERO_SIZE = 64;
export const MON_SIZE = 64;
const MON_BODY = 22;
const INK = '#2a1838';
const SKIN = '#ffe0c2';
const STYLE_KEY = 'manaSeedDefense.artStyle';
const PIXEL_FLOOR = 64;
const FLOOR_PIXEL_SCALE = 3;

let style = initialStyle();
let built = null;
const keys = [];
let heroTex = HERO_SIZE;

// 링크 끝 #pixel / #chibi 가 우선, 없으면 지난번 고른 그림체, 처음이면 도트
function initialStyle() {
  const hash = location.hash.slice(1);
  if (hash === 'pixel' || hash === 'chibi') return hash;
  try {
    return localStorage.getItem(STYLE_KEY) || 'pixel';
  } catch {
    return 'pixel';
  }
}

export const artStyle = () => style;

export function setArtStyle(next) {
  style = next;
  try {
    localStorage.setItem(STYLE_KEY, next);
  } catch {
    // 저장이 막혀도 이번 판에는 적용된다
  }
}

// 표시 배율: 충돌 반경(radius)에 맞춰 텍스처 크기를 맞춘다 (도트 몬스터 몸통 폭: 16px 그림 14, 보스 24px 그림 22)
export const heroScale = (radius) => (radius * 3.6) / heroTex;
export const monScale = (radius, boss = false) => (built === 'pixel' ? (radius * 2.6) / (boss ? 22 : 14) : radius / MON_BODY);
export const floorScale = () => (built === 'pixel' ? FLOOR_PIXEL_SCALE : 1);
export const coreScale = () => (built === 'pixel' ? 112 / 24 : 1);

export function makeTextures(scene) {
  const tex = scene.textures;
  if (built === style && tex.exists('floor')) return;
  for (const k of keys.splice(0)) if (tex.exists(k)) tex.remove(k);
  built = style;
  const { classes, monsters } = scene.db;
  if (style === 'pixel') {
    heroTex = HERO_BASE[0].length;
    for (const [id, cls] of Object.entries(classes)) {
      sprite(tex, `hero_${id}`, heroRows(id, null, 1, false), cls.color);
      sprite(tex, `hero_${id}_1`, heroRows(id, null, 1, true), cls.color);
    }
    for (const [id, def] of Object.entries(monsters)) {
      sprite(tex, `mon_${id}`, bugged(BOSS[id] || compose(MON_BASE, MON_PARTS[id]), id, def.elite || def.boss), def.color);
    }
    sprite(tex, 'core_seed', CORE, '#57e389');
    paint(tex, 'floor', PIXEL_FLOOR, pixelFloor).setFilter(Phaser.Textures.FilterMode.NEAREST);
  } else {
    heroTex = HERO_SIZE;
    for (const [id, cls] of Object.entries(classes)) paint(tex, `hero_${id}`, HERO_SIZE, (ctx) => drawHero(ctx, id, cls.color));
    for (const [id, def] of Object.entries(monsters)) paint(tex, `mon_${id}`, MON_SIZE, (ctx) => drawMonster(ctx, id, def));
    paint(tex, 'core_seed', 112, drawCore);
    paint(tex, 'floor', 128, drawFloorTile);
  }
  for (const [name, rows] of Object.entries(FX)) sprite(tex, `fx_${name}`, rows, '#ffffff');
  paint(tex, 'glow', 64, (ctx) => radial(ctx, 32, 32, 32, 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0)'));
}

function paint(tex, key, size, fn) {
  keys.push(key);
  const c = tex.createCanvas(key, size, size);
  fn(c.getContext(), size);
  c.refresh();
  return c;
}

// ---------- 도트 ----------

// 글자 격자 → 픽셀. A/a/B는 고유 색(기본/그림자/빛)
function sprite(tex, key, rows, color, alt = color) {
  keys.push(key);
  const c = tex.createCanvas(key, rows[0].length, rows.length);
  const ctx = c.getContext();
  const own = { A: color, a: shade(color, -0.3), B: shade(color, 0.35), X: alt, x: shade(alt, -0.3) };
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const col = own[ch] || PALETTE[ch];
    if (!col) return;
    ctx.fillStyle = col;
    ctx.fillRect(x, y, 1, 1);
  }));
  c.refresh();
  c.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

// 캐릭터 도트: 몸 + 직업 모자 (+ 2차 전직 표식, 3차 망토, 4차 어깨갑, 5차 후광). 머리 위 2줄은 후광 자리.
function heroRows(classId, spec, tier, walk) {
  let rows = compose(compose(HERO_BASE, walk ? HERO_WALK : {}), PIXEL_HATS[classId]);
  if (spec) rows = compose(rows, SPEC_MARKS[spec.id]);
  rows = [...Array(HERO_PAD).fill('.'.repeat(rows[0].length)), ...rows];
  if (spec && tier >= 3) rows = compose(rows, CAPE);
  if (spec && tier >= 4) rows = compose(rows, PAULDRON);
  if (spec && tier >= 5) rows = compose(rows, HALO);
  return rows;
}

// 지금 모습의 텍스처 키 (도트에선 전직·차수별로 처음 필요할 때 그린다). 걷기 프레임 = 키 + '_1'
export function heroKey(scene, classId, spec, tier) {
  if (built !== 'pixel' || !spec) return `hero_${classId}`;
  const key = `hero_${classId}_${spec.id}_${tier}`;
  if (!scene.textures.exists(key)) {
    const base = scene.db.classes[classId].color;
    sprite(scene.textures, key, heroRows(classId, spec, tier, false), spec.color, base);
    sprite(scene.textures, `${key}_1`, heroRows(classId, spec, tier, true), spec.color, base);
  }
  return key;
}

// 버그라는 증거: 바깥 먹선 몇 칸이 청록·자홍으로 깨져 있다. 정예·보스는 바깥 먹선이 금빛.
function bugged(rows, id, special) {
  const grid = rows.map((r) => [...r]);
  const open = (x, y) => !grid[y]?.[x] || grid[y][x] === '.' || grid[y][x] === 'z';
  const edge = [];
  grid.forEach((row, y) => row.forEach((ch, x) => {
    if (ch === 'k' && (open(x - 1, y) || open(x + 1, y) || open(x, y - 1) || open(x, y + 1))) edge.push([x, y]);
  }));
  if (special) for (const [x, y] of edge) grid[y][x] = 'y';
  let seed = [...id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  for (let i = 0; i < 3 && edge.length; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    const [x, y] = edge[seed % edge.length];
    grid[y][x] = i % 2 ? 'f' : 'c';
  }
  return grid.map((r) => r.join(''));
}

// 어두운 흙 바닥: 점 노이즈 + 흙 얼룩 + 돌 + 마나 이끼 (타일 64px, 3배로 깔아 반복이 덜 보이게)
function pixelFloor(ctx, s) {
  let seed = 11;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const px = (x, y, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(((x % s) + s) % s, ((y % s) + s) % s, 1, 1);
  };
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const r = rand();
    px(x, y, r < 0.7 ? '#0e0919' : r < 0.9 ? '#110b1f' : '#0b0714');
  }
  for (let i = 0; i < 7; i++) {
    const x = Math.floor(rand() * s);
    const y = Math.floor(rand() * s);
    for (let j = 0; j < 7; j++) px(x + Math.floor(rand() * 5), y + Math.floor(rand() * 3), '#171029');
  }
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rand() * s);
    const y = Math.floor(rand() * s);
    px(x, y, '#2a1f40');
    px(x + 1, y, '#2a1f40');
    px(x, y - 1, '#3a2d55');
  }
  for (let i = 0; i < 5; i++) px(Math.floor(rand() * s), Math.floor(rand() * s), i % 2 ? 'rgba(87,227,137,0.45)' : 'rgba(181,123,255,0.45)');
}

// ---------- 공통 붓 ----------

function circle(ctx, x, y, r, fill, stroke = INK, width = 2) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = width;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function poly(ctx, pts, fill, stroke = INK, width = 2) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = width;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function radial(ctx, x, y, r, inner, outer) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function shadow(ctx, x, y, rx) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, rx * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
}

// 위가 밝은 둥근 몸통 (빛이 위에서 온다)
function body(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r);
  g.addColorStop(0, shade(color, 0.45));
  g.addColorStop(0.55, color);
  g.addColorStop(1, shade(color, -0.35));
  circle(ctx, x, y, r, g);
}

function eyes(ctx, x, y, gap, r, { angry = false, glow = null } = {}) {
  for (const k of [-1, 1]) {
    const ex = x + k * gap;
    if (glow) {
      circle(ctx, ex, y, r, glow, null);
      continue;
    }
    circle(ctx, ex, y, r, '#ffffff', INK, 1.5);
    circle(ctx, ex + k * 0.5, y + 0.8, r * 0.55, INK, null);
    circle(ctx, ex - r * 0.25, y - r * 0.3, r * 0.22, '#ffffff', null);
    if (angry) {
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.moveTo(ex - k * r * 1.1, y - r * 1.5);
      ctx.lineTo(ex + k * r * 1.0, y - r * 0.8);
      ctx.stroke();
    }
  }
}

// 색을 밝게(+)/어둡게(-)
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt));
  const r = mix(n >> 16);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `rgb(${r},${g},${b})`;
}

// ---------- 플레이어 (치비) ----------

function drawHero(ctx, id, color) {
  const cx = 32;
  shadow(ctx, cx, 56, 15);
  // 몸(옷) → 머리 → 직업 장식
  body(ctx, cx, 44, 12, color);
  circle(ctx, cx, 25, 14, SKIN);
  ctx.fillStyle = 'rgba(255,120,140,0.45)';
  ctx.fillRect(cx - 11, 29, 4, 2);
  ctx.fillRect(cx + 7, 29, 4, 2);
  HATS[id]?.(ctx, cx, color);
  if (id !== 'necromancer') eyes(ctx, cx, 26, 5, 2.6);
}

const HATS = {
  novice(ctx, x) {
    poly(ctx, [[x - 13, 22], [x - 9, 12], [x - 2, 9], [x + 6, 10], [x + 13, 18], [x + 12, 22], [x + 4, 16], [x - 4, 18]], '#8d5a3b');
  },
  warden(ctx, x, c) {
    ctx.beginPath();
    ctx.arc(x, 24, 15, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = shade(c, -0.2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.fillStyle = '#dee2e6';
    ctx.fillRect(x - 15, 21, 30, 4);
    ctx.fillRect(x - 2, 9, 4, 13);
  },
  swordsman(ctx, x, c) {
    poly(ctx, [[x - 14, 20], [x - 12, 8], [x - 6, 13], [x - 2, 5], [x + 3, 12], [x + 9, 6], [x + 14, 19], [x, 15]], '#3b2a4a');
    ctx.fillStyle = c;
    ctx.fillRect(x - 14, 17, 28, 4);
    poly(ctx, [[x + 13, 18], [x + 22, 14], [x + 20, 21]], c, INK, 1.5);
  },
  archer(ctx, x, c) {
    ctx.beginPath();
    ctx.arc(x, 25, 16, Math.PI * 0.95, Math.PI * 2.05);
    ctx.lineTo(x + 14, 34);
    ctx.lineTo(x + 10, 24);
    ctx.arc(x, 25, 10, 0, Math.PI, true);
    ctx.lineTo(x - 14, 34);
    ctx.closePath();
    ctx.fillStyle = shade(c, -0.25);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
  },
  mage(ctx, x, c) {
    poly(ctx, [[x - 18, 17], [x + 18, 17], [x + 12, 13], [x - 12, 13]], shade(c, -0.3));
    poly(ctx, [[x - 11, 14], [x + 11, 14], [x + 6, 0], [x + 12, -4], [x + 1, 1]], shade(c, -0.1));
    circle(ctx, x + 1, 9, 2.2, '#ffd43b', null);
  },
  mechanist(ctx, x) {
    poly(ctx, [[x - 13, 19], [x - 10, 10], [x, 8], [x + 10, 10], [x + 13, 19]], '#5c3d2e');
    ctx.fillStyle = '#495057';
    ctx.fillRect(x - 14, 15, 28, 3);
    circle(ctx, x - 6, 16, 4.5, '#74c0fc', '#ffa94d', 2.5);
    circle(ctx, x + 6, 16, 4.5, '#74c0fc', '#ffa94d', 2.5);
  },
  necromancer(ctx, x, c) {
    ctx.beginPath();
    ctx.arc(x, 25, 16, Math.PI, 0);
    ctx.lineTo(x + 16, 38);
    ctx.lineTo(x - 16, 38);
    ctx.closePath();
    ctx.fillStyle = '#2b1d4a';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    circle(ctx, x, 28, 10, '#120b20', null);
    eyes(ctx, x, 27, 4, 2.2, { glow: c });
  },
  monk(ctx, x, c) {
    ctx.fillStyle = c;
    ctx.fillRect(x - 14, 17, 28, 4);
    poly(ctx, [[x - 13, 19], [x - 22, 24], [x - 19, 27]], c, INK, 1.5);
    poly(ctx, [[x - 13, 19], [x - 20, 30], [x - 16, 31]], c, INK, 1.5);
    circle(ctx, x - 4, 13, 2, 'rgba(255,255,255,0.6)', null);
  },
};

// ---------- 몬스터 (시뮬레이션의 "버그") ----------

function drawMonster(ctx, id, def) {
  const cx = 32;
  const cy = 34;
  const r = MON_BODY;
  const special = def.elite || def.boss;
  if (special) radial(ctx, cx, cy, 31, hexA(def.color, 0.55), hexA(def.color, 0));
  shadow(ctx, cx, cy + r - 1, r * 0.9);
  const art = MONSTERS[id] || MONSTERS.default;
  art(ctx, cx, cy, r, def.color);
  glitch(ctx, cx, cy, r, id);
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// 버그라는 증거: 몸 가장자리의 깨진 픽셀
function glitch(ctx, x, y, r, id) {
  let seed = [...id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 4; i++) {
    const a = rand() * Math.PI * 2;
    ctx.fillStyle = i % 2 ? 'rgba(80,255,240,0.85)' : 'rgba(255,60,200,0.85)';
    ctx.fillRect(x + Math.cos(a) * r * 0.95 - 2, y + Math.sin(a) * r * 0.95 - 2, 4 + rand() * 3, 3);
  }
}

const MONSTERS = {
  default(ctx, x, y, r, c) {
    body(ctx, x, y, r, c);
    eyes(ctx, x, y - 3, 7, 4.5, { angry: true });
  },
  charger(ctx, x, y, r, c) {
    poly(ctx, [[x - 14, y - 14], [x - 20, y - 28], [x - 6, y - 18]], '#f8f9fa');
    poly(ctx, [[x + 14, y - 14], [x + 20, y - 28], [x + 6, y - 18]], '#f8f9fa');
    body(ctx, x, y, r, c);
    eyes(ctx, x, y - 3, 7, 4.5, { angry: true });
  },
  swarm(ctx, x, y, r, c) {
    ctx.fillStyle = 'rgba(230,220,255,0.55)';
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + k * 18, y - 10, 12, 7, k * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    body(ctx, x, y, r * 0.9, c);
    eyes(ctx, x, y - 2, 7, 5);
  },
  ranged(ctx, x, y, r, c) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + 6, y - r - 9);
    ctx.stroke();
    circle(ctx, x + 6, y - r - 10, 3.5, '#fff3bf');
    body(ctx, x, y, r, c);
    circle(ctx, x, y - 2, 9, '#ffffff', INK, 2);
    circle(ctx, x, y - 1, 5, INK, null);
    circle(ctx, x - 2, y - 4, 1.8, '#ffffff', null);
  },
  dasher(ctx, x, y, r, c) {
    for (let i = -1; i <= 1; i++) poly(ctx, [[x + i * 9 - 5, y - r + 5], [x + i * 9, y - r - 8], [x + i * 9 + 5, y - r + 5]], shade(c, -0.3));
    body(ctx, x, y, r, c);
    eyes(ctx, x, y - 2, 7, 4, { angry: true });
  },
  splitter(ctx, x, y, r, c) {
    body(ctx, x, y, r, c);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(x - 3, y - r);
    [[4, -12], [-2, -4], [5, 4], [-1, 12], [3, r]].forEach(([dx, dy]) => ctx.lineTo(x + dx, y + dy));
    ctx.stroke();
    eyes(ctx, x, y - 4, 9, 4);
  },
  splitling(ctx, x, y, r, c) {
    body(ctx, x, y, r * 0.85, c);
    circle(ctx, x, y - 2, 7, '#ffffff', INK, 2);
    circle(ctx, x + 1, y - 1, 4, INK, null);
  },
  artillery(ctx, x, y, r, c) {
    ctx.fillStyle = '#343a40';
    ctx.fillRect(x - 5, y - r - 10, 10, 18);
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.strokeRect(x - 5, y - r - 10, 10, 18);
    body(ctx, x, y, r, c);
    ctx.fillStyle = shade(c, -0.35);
    ctx.fillRect(x - r + 4, y + 2, (r - 4) * 2, 4);
    eyes(ctx, x, y - 5, 7, 4, { angry: true });
  },
  // 대장 바르드: 선장 모자와 흉터
  bard(ctx, x, y, r, c) {
    body(ctx, x, y + 2, r - 2, c);
    poly(ctx, [[x - 24, y - 10], [x, y - 30], [x + 24, y - 10], [x, y - 16]], '#3b2a4a');
    circle(ctx, x, y - 20, 3, '#ffd43b', null);
    eyes(ctx, x, y - 1, 7, 4.2, { angry: true });
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff5f5';
    ctx.beginPath();
    ctx.moveTo(x + 10, y - 6);
    ctx.lineTo(x + 5, y + 6);
    ctx.stroke();
  },
  // 복수자 세라: 분홍 두건과 날리는 목도리
  sera(ctx, x, y, r, c) {
    poly(ctx, [[x + 8, y + 10], [x + 30, y + 16], [x + 26, y + 22], [x + 6, y + 16]], '#ffdeeb');
    body(ctx, x, y, r - 2, c);
    ctx.beginPath();
    ctx.arc(x, y - 2, r - 1, Math.PI * 1.05, Math.PI * 1.95);
    ctx.lineTo(x + 10, y - 6);
    ctx.lineTo(x - 10, y - 6);
    ctx.closePath();
    ctx.fillStyle = shade(c, -0.35);
    ctx.fill();
    eyes(ctx, x, y + 1, 7, 4, { angry: true });
  },
  // 보스 레프리콘: 금색 망토, 늘 웃는 얼굴, 시계바늘 손
  leprechaun(ctx, x, y, r, c) {
    poly(ctx, [[x - 26, y + 22], [x - 18, y - 8], [x + 18, y - 8], [x + 26, y + 22]], shade(c, -0.25));
    body(ctx, x, y, r - 3, '#40c057');
    poly(ctx, [[x - 12, y - 16], [x - 10, y - 32], [x + 10, y - 32], [x + 12, y - 16]], '#2b8a3e');
    ctx.fillStyle = c;
    ctx.fillRect(x - 12, y - 20, 24, 4);
    eyes(ctx, x, y - 6, 6, 3.6);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.arc(x, y + 2, 9, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.strokeStyle = c;
    ctx.beginPath();
    ctx.moveTo(x + 18, y + 6);
    ctx.lineTo(x + 28, y - 2);
    ctx.moveTo(x + 18, y + 6);
    ctx.lineTo(x + 26, y + 12);
    ctx.stroke();
  },
};

// ---------- 코어: 마나 씨앗 ----------

function drawCore(ctx, s) {
  const c = s / 2;
  radial(ctx, c, c + 6, 54, 'rgba(87,227,137,0.55)', 'rgba(87,227,137,0)');
  shadow(ctx, c, c + 34, 26);
  // 씨앗 결정
  const g = ctx.createLinearGradient(c - 20, c - 20, c + 20, c + 30);
  g.addColorStop(0, '#d8ffe4');
  g.addColorStop(0.5, '#57e389');
  g.addColorStop(1, '#1b7a45');
  poly(ctx, [[c, c - 18], [c + 20, c + 6], [c, c + 32], [c - 20, c + 6]], g, '#0b3d23', 2.5);
  poly(ctx, [[c, c - 18], [c + 6, c + 6], [c, c + 32], [c - 6, c + 6]], 'rgba(255,255,255,0.25)', null);
  // 새싹
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#2f9e44';
  ctx.beginPath();
  ctx.moveTo(c, c - 16);
  ctx.quadraticCurveTo(c + 2, c - 28, c - 1, c - 36);
  ctx.stroke();
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(c + k * 9, c - 34, 10, 5, k * -0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#8ce99a';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1b5e20';
    ctx.stroke();
  }
}

// ---------- 바닥: 어두운 땅과 마나 흔적 ----------

function drawFloorTile(ctx, s) {
  ctx.fillStyle = '#0e0919';
  ctx.fillRect(0, 0, s, s);
  let seed = 7;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  // 흙 얼룩
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = `rgba(${40 + rand() * 20},${24 + rand() * 12},${60 + rand() * 30},0.18)`;
    ctx.beginPath();
    ctx.ellipse(rand() * s, rand() * s, 8 + rand() * 16, 5 + rand() * 9, rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // 돌 조각
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = 'rgba(70,55,100,0.5)';
    ctx.fillRect(rand() * s, rand() * s, 2 + rand() * 3, 2);
  }
  // 마나 이끼
  for (let i = 0; i < 3; i++) {
    const x = rand() * s;
    const y = rand() * s;
    ctx.fillStyle = 'rgba(87,227,137,0.18)';
    ctx.fillRect(x, y, 2, 2);
    ctx.fillStyle = 'rgba(181,123,255,0.22)';
    ctx.fillRect(x + 5, y + 3, 2, 2);
  }
  // 옛 격자의 흔적 (시뮬레이션 세계)
  ctx.strokeStyle = 'rgba(90,63,138,0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, s, s);
}
