// localStorage 접근 자체가 막힌 환경(사파리 비공개 등)에서도 게임은 돌아가야 한다
export function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => {} };
  }
}
