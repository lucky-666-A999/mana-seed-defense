// 정식 도트 시안: 한 픽셀씩 찍은 스프라이트. 글자 하나 = 픽셀 하나.
// 대문자 A/a/B = 그 캐릭터 고유 색(기본/그림자/빛), 나머지는 PALETTE. '.' = 투명.
// 오버레이(모자·뿔 등)에서 '.' = 아래 그림 유지.
export const PALETTE = {
  k: '#2a1838', // 먹선
  s: '#ffe0c2', // 피부
  p: '#ff9aa2', // 볼터치
  w: '#ffffff',
  h: '#8d5a3b', // 갈색 머리
  n: '#3b2a4a', // 검은 머리
  m: '#dee2e6', // 쇠
  M: '#868e96', // 어두운 쇠
  y: '#ffd43b', // 금
  Y: '#c99a2e', // 어두운 금
  g: '#40c057', // 레프리콘 초록
  G: '#2b8a3e',
  o: '#ffa94d', // 고글 테
  q: '#74c0fc', // 유리
  v: '#3d2a66', // 후드
  V: '#120b20', // 후드 속 어둠
  r: '#e03131', // 머리띠
  P: '#ffdeeb', // 목도리
  l: '#8ce99a', // 잎
  L: '#2f9e44',
  i: '#d8ffe4', // 마나 결정 빛
  e: '#57e389',
  E: '#1b7a45',
  u: 'rgba(230,220,255,0.6)', // 날개
  z: 'rgba(0,0,0,0.35)', // 그림자
  c: '#50fff0', // 버그 픽셀
  f: '#ff3cc8',
};

// ---------- 플레이어 (16×17, 마지막 줄 그림자) ----------

export const HERO_BASE = [
  '................',
  '................',
  '.....kkkkkk.....',
  '....kssssssk....',
  '...kssssssssk...',
  '...kssssssssk...',
  '...kskssssksk...',
  '...kskssssksk...',
  '...kpssssssspk..',
  '....kssssssk....',
  '.....kkkkkk.....',
  '....kAAAAAAk....',
  '...kAAABBAAAk...',
  '...kaAAAAAAak...',
  '....kaakkaak....',
  '.....kk..kk.....',
  '....zzzzzzzz....',
];

// 걷기 2번째 프레임: 발을 벌린다
export const HERO_WALK = { 14: '....kaak.kaak...', 15: '....kk....kk....' };

export const HATS = {
  novice: {
    1: '.....kkk.kk.....',
    2: '....khhhkhhk....',
    3: '...khhhhhhhhk...',
    4: '...khhhhhhhhk...',
    5: '...kh......hk...',
  },
  warden: {
    0: '......kAAk......',
    1: '.....kkAAkk.....',
    2: '....kmmmmmmk....',
    3: '...kmmmmmmmmk...',
    4: '...kMMMMMMMMk...',
    5: '...kM..MM..Mk...',
  },
  swordsman: {
    1: '....k..k...k....',
    2: '...knkknkkknk...',
    3: '...knnnnnnnnk...',
    4: '...kAAAAAAAAkAk.',
    5: '...kn......nkAAk',
  },
  archer: {
    1: '......kkkk......',
    2: '....kkaaaakk....',
    3: '...kaAAAAAAak...',
    4: '..kaAAAAAAAAak..',
    5: '..kaA......Aak..',
    6: '..ka........ak..',
    7: '..ka........ak..',
    8: '..kk........kk..',
  },
  mage: {
    0: '.........kk.....',
    1: '.......kkAk.....',
    2: '......kAAAk.....',
    3: '.....kAAyAAk....',
    4: '..kkkaaaaaakkk..',
    5: '..kaaaaaaaaaak..',
  },
  mechanist: {
    2: '....khhhhhhk....',
    3: '...khhhhhhhhk...',
    4: '...kMMMMMMMMk...',
    5: '...koqoMMoqok...',
  },
  necromancer: {
    1: '......kkkk......',
    2: '....kkvvvvkk....',
    3: '...kvvvvvvvvk...',
    4: '..kvvvvvvvvvvk..',
    5: '..kvvVVVVVVvvk..',
    6: '..kvVAVVVVAVvk..',
    7: '..kvVVVVVVVVvk..',
    8: '..kvvVVVVVVvvk..',
    9: '...kvvvvvvvvk...',
    10: '....kvvvvvvk....',
  },
  monk: {
    3: '......w.........',
    4: '...krrrrrrrrk...',
    5: '.rr.............',
    6: 'rr..............',
  },
};

// ---------- 몬스터 (16×16, "버그" 젤리) ----------

export const MON_BASE = [
  '................',
  '................',
  '................',
  '.....kkkkkk.....',
  '...kkBBBBAAkk...',
  '..kBBkkAAkkAak..',
  '..kBAwwAAwwAak..',
  '.kBAAwkAAkwAAak.',
  '.kAAAAAAAAAAaak.',
  '.kaAAAAAAAAAaak.',
  '.kaaAAAAAAAaaak.',
  '..kaaaaaaaaaak..',
  '...kkkkkkkkkk...',
  '..zzzzzzzzzzzz..',
  '................',
  '................',
];

export const MON_PARTS = {
  charger: {
    1: '...w........w...',
    2: '...kw......wk...',
    3: '....kw....wk....',
  },
  swarm: {
    1: '..uuu......uuu..',
    2: '...uuu....uuu...',
    3: '....uu....uu....',
  },
  ranged: {
    0: '.......yy.......',
    1: '.......yy.......',
    2: '........k.......',
    5: '......kkkk......',
    6: '.....kwwwwk.....',
    7: '.....kwkkwk.....',
    8: '.....kwkkwk.....',
    9: '......kkkk......',
  },
  dasher: {
    1: '....k..kk..k....',
    2: '...kak.kk.kak...',
  },
  splitter: {
    4: '.......k........',
    5: '........k.......',
    8: '.......k........',
    9: '........k.......',
    10: '.......k........',
    11: '........k.......',
  },
  splitling: {
    1: '......l.l.......',
    2: '.......L........',
  },
  artillery: {
    0: '......kkkk......',
    1: '......kMMk......',
    2: '......kMMk......',
    3: '......kMMk......',
    10: '.kMMMMMMMMMMMMk.',
  },
  // 대장 바르드: 선장 모자와 흉터
  bard: {
    1: '..kkkkkkkkkkkk..',
    2: '.knnnnnyynnnnnk.',
    3: '..knnnnnnnnnnk..',
    4: '...kkkkkkkkkk...',
    6: '............w...',
    7: '...........w....',
    8: '............w...',
  },
  // 복수자 세라: 두건과 날리는 목도리
  sera: {
    2: '....kkkkkkkk....',
    3: '...kaaaaaaaak...',
    4: '..kaaaaaaaaaak..',
    5: '..kaa......aak..',
    9: '.kPPPPPPPPPPPPk.',
    10: '..............PP',
    11: '...............P',
  },
};

// 보스 레프리콘 (24×24): 금색 망토, 늘 웃는 얼굴
export const BOSS = {
  leprechaun: [
    '........................',
    '........kkkkkkkk........',
    '........kGGGGGGk........',
    '........kGGGGGGk........',
    '........kGGGGGGk........',
    '......kkkyyyyyykkk......',
    '.....kGGGGGGGGGGGGk.....',
    '......kkggggggggkk......',
    '.....kggggggggggggk.....',
    '....kgggwwggggwwgggk....',
    '....kgggwkggggkwgggk....',
    '....kggggggggggggggk....',
    '....kgkggggggggggkgk....',
    '....kggkwwwwwwwwkggk....',
    '....kgggkkkkkkkkgggk....',
    '.....kggggggggggggk.....',
    '...kyyyykkkkkkkkyyyyk...',
    '..kyyyyYggggggggYyyyyk..',
    '..kyyyYYggggggggYYyyyk..',
    '.kyyyYYYggggggggYYYyyyk.',
    '.kyyYYYYkggkkggkYYYYyyk.',
    '.kkkkkkkk.kk..kk.kkkkkkk',
    '....zzzzzzzzzzzzzzzz....',
    '........................',
  ],
};

// ---------- 코어: 새싹 난 마나 씨앗 (24×24) ----------

export const CORE = [
  '........................',
  '.....llll......llll.....',
  '....lLLLLl....lLLLLl....',
  '.....lLLLLl..lLLLLl.....',
  '.......llLLllLLll.......',
  '...........LL...........',
  '...........LL...........',
  '..........kkkk..........',
  '.........kiiek..........',
  '........kiiieek.........',
  '.......kiwieeeek........',
  '......kiiieeeeeEk.......',
  '.....kiiieeeeeeeEk......',
  '....kiiieeeeeeeeeEk.....',
  '.....kieeeeeeeeeEk......',
  '......keeeeeeeeEk.......',
  '.......keeeeeeEk........',
  '........keeeeEk.........',
  '.........keeEk..........',
  '..........kEk...........',
  '...........k............',
  '......zzzzzzzzzzzz......',
  '........................',
  '........................',
];

// 오버레이를 덮어 새 그림을 만든다 ('.' 유지, '_' 지움)
export function compose(base, overlay = {}) {
  return base.map((row, y) => {
    const over = overlay[y];
    if (!over) return row;
    return [...row].map((ch, x) => (over[x] === '.' || over[x] === undefined ? ch : over[x] === '_' ? '.' : over[x])).join('');
  });
}
