// 도트 변환: 큰 캔버스 그림(RGBA)을 작은 격자로 가장 가까운 점만 뽑아 줄이고,
// 경계는 딱 떨어지게(반투명 제거), 색은 단계로 끊고, 실루엣에 1px 외곽선을 두른다.
export const INK_RGB = [42, 24, 56];
const SOLID = 128;
const SOFT = 70; // 그림자처럼 옅은 부분은 반투명으로 남긴다

const posterize = (v, levels) => Math.round((Math.round((v / 255) * (levels - 1)) * 255) / (levels - 1));

export function pixelize(src, size, target, { levels = 6, outline = INK_RGB } = {}) {
  const out = new Uint8ClampedArray(target * target * 4);
  const k = size / target;
  for (let y = 0; y < target; y++) {
    for (let x = 0; x < target; x++) {
      const i = (Math.floor((y + 0.5) * k) * size + Math.floor((x + 0.5) * k)) * 4;
      const o = (y * target + x) * 4;
      const a = src[i + 3];
      if (a < SOFT) continue;
      for (let c = 0; c < 3; c++) out[o + c] = a >= SOLID ? posterize(src[i + c], levels) : src[i + c];
      out[o + 3] = a >= SOLID ? 255 : 100;
    }
  }
  if (!outline) return out;
  const solid = (x, y) => x >= 0 && y >= 0 && x < target && y < target && out[(y * target + x) * 4 + 3] === 255;
  const edges = [];
  for (let y = 0; y < target; y++) {
    for (let x = 0; x < target; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) edges.push((y * target + x) * 4);
    }
  }
  for (const o of edges) {
    out.set(outline, o);
    out[o + 3] = 255;
  }
  return out;
}
