export function rectsIntersect(a, b) {
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
}

export const TILE_SIZE = 40;
export const MAP_W = 20;
export const MAP_H = 15;

const LEVEL_1 = [
  '....................',
  '..B....B....B....B..',
  '..B....B....B....B..',
  '....................',
  '.S..S......S..S.....',
  '..GGGG..............',
  '...B......B......B..',
  '....................',
  '..S.....W.W.....S...',
  '....................',
  '...B..B......B..B...',
  '....................',
  '.....BBBB....BBBB...',
  '........X...........',
  '....................',
];

function parseLevel(rows) {
  return rows.map((row) => row.split(''));
}

function createPlayer(id, tileX, tileY) {
  const size = 32;
  return {
    id,
    x: tileX * TILE_SIZE + (TILE_SIZE - size) / 2,
    y: tileY * TILE_SIZE + (TILE_SIZE - size) / 2,
    w: size,
    h: size,
    dir: 'up',
    speed: 80,
    hp: 1,
    lives: 3,
    cooldown: 0,
    isPlayer: true,
  };
}

export function createGameState({ players = 2 } = {}) {
  const tiles = parseLevel(LEVEL_1);
  const base = { tileX: 8, tileY: 13, w: 32, h: 32 };
  base.x = base.tileX * TILE_SIZE + (TILE_SIZE - base.w) / 2;
  base.y = base.tileY * TILE_SIZE + (TILE_SIZE - base.h) / 2;

  const list = [createPlayer('p1', 3, 13)];
  if (players > 1) list.push(createPlayer('p2', 15, 13));

  return {
    tiles,
    players: list,
    enemies: [],
    bullets: [],
    base,
    mode: 'playing',
  };
}
