import { GameScene } from './scenes/GameScene.js';
import { LobbyScene } from './scenes/LobbyScene.js';
import { IntroScene } from './scenes/IntroScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { CodexScene } from './scenes/CodexScene.js';

const DATA_FILES = ['balance', 'waves', 'monsters', 'classes', 'cards', 'story', 'shop', 'specs', 'workshop', 'manaSkills', 'items', 'recipes'];

async function loadData() {
  const entries = await Promise.all(DATA_FILES.map(async (name) => {
    const res = await fetch(`data/${name}.json`);
    if (!res.ok) throw new Error(`데이터 로드 실패: ${name}.json (${res.status})`);
    return [name, await res.json()];
  }));
  return Object.fromEntries(entries);
}

const db = await loadData();

window.__game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0a0612',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 540, height: 960 },
  input: { activePointers: 3 },
  scene: [new LobbyScene(db), new IntroScene(db), new ShopScene(db), new CodexScene(db), new GameScene(db)],
});
