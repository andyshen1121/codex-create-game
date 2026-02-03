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
    spawner: {
      remaining: 10,
      cooldown: 1,
      interval: 2,
      points: [{ x: 9, y: 1 }, { x: 3, y: 1 }, { x: 15, y: 1 }],
    },
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
  updateSpawner(state, dt);
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
  updateWinLose(state);
}

export function renderGame(ctx, state) {
  ctx.clearRect(0, 0, MAP_W * TILE_SIZE, MAP_H * TILE_SIZE);

  for (let y = 0; y < state.tiles.length; y += 1) {
    for (let x = 0; x < state.tiles[y].length; x += 1) {
      const tile = state.tiles[y][x];
      if (tile === '.') continue;
      if (tile === 'G') {
        ctx.fillStyle = '#3b7a2a';
      } else if (tile === 'B') {
        ctx.fillStyle = '#b86b3a';
      } else if (tile === 'S') {
        ctx.fillStyle = '#888888';
      } else if (tile === 'W') {
        ctx.fillStyle = '#2a6fdb';
      } else if (tile === 'X') {
        ctx.fillStyle = '#d9c15b';
      }
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  ctx.fillStyle = '#d9c15b';
  ctx.fillRect(state.base.x, state.base.y, state.base.w, state.base.h);

  state.players.forEach((p) => {
    ctx.fillStyle = '#4aa3ff';
    ctx.fillRect(p.x, p.y, p.w, p.h);
  });

  state.enemies.forEach((e) => {
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(e.x, e.y, e.w, e.h);
  });

  state.bullets.forEach((b) => {
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(b.x, b.y, b.w, b.h);
  });

  ctx.fillStyle = '#ffffff';
  ctx.fillText(`P1:${state.players[0]?.lives ?? 0}`, 10, 18);
  ctx.fillText(`EN:${state.enemies.length}`, 80, 18);
}

function createEnemy(id, tileX, tileY, type = 'basic') {
  const size = 32;
  const speed = type === 'fast' ? 90 : type === 'heavy' ? 50 : 70;
  const hp = type === 'heavy' ? 3 : 1;
  return {
    id,
    x: tileX * TILE_SIZE + (TILE_SIZE - size) / 2,
    y: tileY * TILE_SIZE + (TILE_SIZE - size) / 2,
    w: size,
    h: size,
    dir: 'down',
    speed,
    hp,
    cooldown: 0.8,
    isPlayer: false,
    aiTime: 0,
  };
}

function updateSpawner(state, dt) {
  if (!state.spawner || state.spawner.remaining <= 0) return;
  state.spawner.cooldown -= dt;
  if (state.spawner.cooldown > 0) return;

  const point = state.spawner.points[0];
  if (!point) return;
  state.enemies.push(createEnemy(`e${Date.now()}`, point.x, point.y));
  state.spawner.remaining -= 1;
  state.spawner.cooldown = state.spawner.interval;
}

function updateWinLose(state) {
  if (state.mode !== 'playing') return;
  if (state.spawner && state.spawner.remaining === 0 && state.enemies.length === 0) {
    state.mode = 'win';
  }
}
