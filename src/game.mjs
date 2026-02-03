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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeBullet(tank) {
  const size = 6;
  const speed = 200;
  const centerX = tank.x + tank.w / 2 - size / 2;
  const centerY = tank.y + tank.h / 2 - size / 2;
  let vx = 0;
  let vy = 0;
  if (tank.dir === 'up') vy = -speed;
  if (tank.dir === 'down') vy = speed;
  if (tank.dir === 'left') vx = -speed;
  if (tank.dir === 'right') vx = speed;
  return { x: centerX, y: centerY, w: size, h: size, vx, vy, owner: tank.id };
}

function applyPlayerInput(state, input, dt) {
  state.players.forEach((player, index) => {
    const keys = input.players?.[index] || {};
    const speed = player.speed;
    let dx = 0;
    let dy = 0;
    if (keys.left) {
      dx = -speed * dt;
      player.dir = 'left';
    } else if (keys.right) {
      dx = speed * dt;
      player.dir = 'right';
    } else if (keys.up) {
      dy = -speed * dt;
      player.dir = 'up';
    } else if (keys.down) {
      dy = speed * dt;
      player.dir = 'down';
    }

    player.x = clamp(player.x + dx, 0, MAP_W * TILE_SIZE - player.w);
    player.y = clamp(player.y + dy, 0, MAP_H * TILE_SIZE - player.h);

    player.cooldown = Math.max(0, player.cooldown - dt);
    if (keys.fire && player.cooldown === 0) {
      state.bullets.push(makeBullet(player));
      player.cooldown = 0.4;
    }
  });
}

function tileAt(tiles, x, y) {
  const tileX = Math.floor(x / TILE_SIZE);
  const tileY = Math.floor(y / TILE_SIZE);
  if (tileX < 0 || tileY < 0 || tileY >= tiles.length || tileX >= tiles[0].length) {
    return null;
  }
  return { tileX, tileY, value: tiles[tileY][tileX] };
}

export function stepGame(state, input, dt) {
  applyPlayerInput(state, input, dt);
  const nextBullets = [];

  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;

    const hit = tileAt(state.tiles, bullet.x + bullet.w / 2, bullet.y + bullet.h / 2);
    if (hit) {
      if (hit.value === 'B') {
        state.tiles[hit.tileY][hit.tileX] = '.';
        continue;
      }
      if (hit.value === 'S') {
        continue;
      }
      if (hit.value === 'X') {
        state.mode = 'lose';
        continue;
      }
    }

    nextBullets.push(bullet);
  }

  state.bullets = nextBullets;
}
