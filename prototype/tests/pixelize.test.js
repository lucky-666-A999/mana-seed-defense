import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pixelize, INK_RGB } from '../src/art/pixelize.js';

// 8×8 그림 가운데 4×4 빨간 사각형 → 4×4로 줄이면 가운데 2×2가 빨강, 둘레는 외곽선
function square() {
  const s = 8;
  const px = new Uint8ClampedArray(s * s * 4);
  for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) px.set([250, 10, 10, 255], (y * s + x) * 4);
  return px;
}

const at = (out, d, x, y) => [...out.slice((y * d + x) * 4, (y * d + x) * 4 + 4)];

test('도트 변환: 가까운 점 추출, 색 단계화, 1px 외곽선', () => {
  const out = pixelize(square(), 8, 4);
  assert.deepEqual(at(out, 4, 1, 1), [255, 0, 0, 255]);
  assert.deepEqual(at(out, 4, 0, 1), [...INK_RGB, 255]);
  assert.deepEqual(at(out, 4, 0, 0), [0, 0, 0, 0]);
});

test('도트 변환: 옅은 부분은 반투명, 아주 옅으면 지움, 외곽선 끄기', () => {
  const src = new Uint8ClampedArray(2 * 2 * 4);
  src.set([0, 0, 0, 90], 0);
  src.set([0, 0, 0, 30], 4);
  const out = pixelize(src, 2, 2, { outline: null });
  assert.equal(out[3], 100);
  assert.equal(out[7], 0);
});
