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
  '.......GGG..........',
  '..B..B.....B..B.....',
  '..B..B.....B..B.....',
  '.........S..........',
  '..S..........S......',
  '.......GGG..........',
  '....B.......B.......',
  '.......GGG..........',
  '..S..........S......',
  '.........X..........',
  '..S..........S......',
  '.......GGG..........',
  '....B.......B.......',
  '.......GGG..........',
  '..B..B.....B..B.....',
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
    hp: 3,
    lives: 3,
    cooldown: 0,
    isPlayer: true,
  };
}

export function createGameState({ players = 2 } = {}) {
  const tiles = parseLevel(LEVEL_1);
  const base = {
    tileX: 9,
    tileY: 9,
    w: 32,
    h: 32,
    available: true,
    owner: null,
    captureProgress: 0,
    capturingPlayer: null,
    respawnCooldown: 0,
  };
  base.x = base.tileX * TILE_SIZE + (TILE_SIZE - base.w) / 2;
  base.y = base.tileY * TILE_SIZE + (TILE_SIZE - base.h) / 2;

  const list = [createPlayer('p1', 1, 13)];
  if (players > 1) list.push(createPlayer('p2', 18, 1));

  return {
    tiles,
    players: list,
    enemies: [],
    bullets: [],
    base,
    spawner: {
      remaining: 10,
      cooldown: 1,
      interval: 5,
      maxActive: 3,
      points: [
        { x: 0, y: 7 },
        { x: 19, y: 7 },
        { x: 9, y: 0 },
        { x: 9, y: 14 },
      ],
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
  updateAI(state, dt);
  updateSpawner(state, dt);
  const nextBullets = [];

  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;

    // 边界检测
    if (bullet.x < 0 || bullet.x > MAP_W * TILE_SIZE ||
        bullet.y < 0 || bullet.y > MAP_H * TILE_SIZE) {
      continue;
    }

    // 地图碰撞
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

    // 击中敌人
    let hitTank = false;
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const enemy = state.enemies[i];
      if (bullet.owner === enemy.id) {
        continue;
      }
      if (rectsIntersect(bullet, enemy)) {
        enemy.hp -= 1;
        if (enemy.hp <= 0) {
          state.enemies.splice(i, 1);
        }
        hitTank = true;
        break;
      }
    }

    // 击中玩家（不能击中自己）
    if (!hitTank) {
      for (const player of state.players) {
        if (player.id !== bullet.owner && rectsIntersect(bullet, player)) {
          player.hp -= 1;
          hitTank = true;
          break;
        }
      }
    }

    if (hitTank) {
      continue;
    }

    nextBullets.push(bullet);
  }

  state.bullets = nextBullets;
  updateBaseCapture(state, dt);
  updateWinLose(state);
}

function isInGrass(tiles, entity) {
  const centerX = entity.x + entity.w / 2;
  const centerY = entity.y + entity.h / 2;
  const tileX = Math.floor(centerX / TILE_SIZE);
  const tileY = Math.floor(centerY / TILE_SIZE);

  if (tileY >= 0 && tileY < tiles.length && tileX >= 0 && tileX < tiles[0].length) {
    return tiles[tileY][tileX] === 'G';
  }
  return false;
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

  if (state.base.available) {
    ctx.fillStyle = '#d9c15b';
    ctx.fillRect(state.base.x, state.base.y, state.base.w, state.base.h);
  }

  state.players.forEach((p, index) => {
    if (!isInGrass(state.tiles, p)) {
      ctx.fillStyle = index === 0 ? '#4aa3ff' : '#4aff6b';
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }
  });

  state.enemies.forEach((e) => {
    if (!isInGrass(state.tiles, e)) {
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(e.x, e.y, e.w, e.h);
    }
  });

  state.bullets.forEach((b) => {
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(b.x, b.y, b.w, b.h);
  });

  ctx.font = '16px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`P1: ${'*'.repeat(state.players[0]?.hp ?? 0)}`, 10, 20);
  if (state.players[1]) {
    const p2Text = `P2: ${'*'.repeat(state.players[1].hp)}`;
    ctx.fillText(p2Text, MAP_W * TILE_SIZE - 100, 20);
  }

  const base = state.base;
  let baseStatus = '';
  if (!base.available) {
    baseStatus = `Base: ${Math.ceil(base.respawnCooldown)}s`;
  } else if (base.capturingPlayer) {
    const progress = Math.floor((base.captureProgress / 3) * 100);
    baseStatus = `Capturing: ${progress}%`;
  } else {
    baseStatus = 'Base: Ready';
  }
  const textWidth = ctx.measureText(baseStatus).width;
  ctx.fillText(baseStatus, (MAP_W * TILE_SIZE - textWidth) / 2, 20);

  if (state.mode === 'win_p1' || state.mode === 'win_p2') {
    ctx.font = '32px monospace';
    const winner = state.mode === 'win_p1' ? 'Player 1 Wins!' : 'Player 2 Wins!';
    const winWidth = ctx.measureText(winner).width;
    ctx.fillText(winner, (MAP_W * TILE_SIZE - winWidth) / 2, MAP_H * TILE_SIZE / 2);
  }
}

function createEnemy(id, tileX, tileY, type = 'basic') {
  const size = 32;
  const speed = type === 'fast' ? 90 : type === 'heavy' ? 50 : 70;
  const hp = type === 'heavy' ? 3 : 1;
  const dirs = ['up', 'down', 'left', 'right'];
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
    aiMode: 'patrol',
    aiTime: 2 + Math.random() * 2,
    targetDir: dirs[Math.floor(Math.random() * 4)],
    chaseTarget: null,
    lostTargetTime: 0,
  };
}

function updateSpawner(state, dt) {
  if (!state.spawner) return;

  state.spawner.cooldown -= dt;
  if (state.spawner.cooldown > 0) return;

  if (state.enemies.length >= state.spawner.maxActive) {
    return;
  }

  const points = state.spawner.points;
  if (!points || points.length === 0) return;

  const point = points[Math.floor(Math.random() * points.length)];
  state.enemies.push(createEnemy(`e${Date.now()}`, point.x, point.y));
  state.spawner.cooldown = state.spawner.interval;
}

function updateWinLose(state) {
  if (state.mode !== 'playing') return;

  if (state.players.length >= 2) {
    if (state.players[0].hp <= 0) {
      state.mode = 'win_p2';
      return;
    }
    if (state.players[1].hp <= 0) {
      state.mode = 'win_p1';
    }
  }
}

function collidesWithWall(tiles, entity) {
  const corners = [
    { x: entity.x, y: entity.y },
    { x: entity.x + entity.w - 1, y: entity.y },
    { x: entity.x, y: entity.y + entity.h - 1 },
    { x: entity.x + entity.w - 1, y: entity.y + entity.h - 1 },
  ];

  for (const corner of corners) {
    const tileX = Math.floor(corner.x / TILE_SIZE);
    const tileY = Math.floor(corner.y / TILE_SIZE);
    if (tileX < 0 || tileY < 0 || tileY >= tiles.length || tileX >= tiles[0].length) {
      continue;
    }
    const tile = tiles[tileY][tileX];
    if (tile === 'B' || tile === 'S' || tile === 'W') {
      return true;
    }
  }
  return false;
}

export function checkLineOfSight(tiles, from, to, maxTiles) {
  const fromCenterX = from.x + from.w / 2;
  const fromCenterY = from.y + from.h / 2;
  const toCenterX = to.x + to.w / 2;
  const toCenterY = to.y + to.h / 2;

  const dx = toCenterX - fromCenterX;
  const dy = toCenterY - fromCenterY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const maxDistance = maxTiles * TILE_SIZE;

  // 超出视野范围
  if (distance > maxDistance) {
    return false;
  }

  // 检查目标是否在草地中
  const toTileX = Math.floor(toCenterX / TILE_SIZE);
  const toTileY = Math.floor(toCenterY / TILE_SIZE);
  if (toTileY >= 0 && toTileY < tiles.length && toTileX >= 0 && toTileX < tiles[0].length) {
    if (tiles[toTileY][toTileX] === 'G') {
      return false;
    }
  }

  // 沿射线检查墙体
  const steps = Math.ceil(distance / (TILE_SIZE / 2));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const checkX = fromCenterX + dx * t;
    const checkY = fromCenterY + dy * t;
    const tileX = Math.floor(checkX / TILE_SIZE);
    const tileY = Math.floor(checkY / TILE_SIZE);

    if (tileY >= 0 && tileY < tiles.length && tileX >= 0 && tileX < tiles[0].length) {
      const tile = tiles[tileY][tileX];
      if (tile === 'B' || tile === 'S') {
        return false;
      }
    }
  }

  return true;
}

function updateAI(state, dt) {
  const dirs = ['up', 'down', 'left', 'right'];

  for (const enemy of state.enemies) {
    enemy.aiTime -= dt;
    enemy.cooldown = Math.max(0, enemy.cooldown - dt);

    // 检测视野内的玩家
    let visiblePlayer = null;
    for (const player of state.players) {
      if (player.hp > 0 && checkLineOfSight(state.tiles, enemy, player, 5)) {
        visiblePlayer = player;
        break;
      }
    }

    // 状态切换
    if (visiblePlayer) {
      enemy.aiMode = 'chase';
      enemy.chaseTarget = visiblePlayer.id;
      enemy.lostTargetTime = 0;
    } else if (enemy.aiMode === 'chase') {
      enemy.lostTargetTime += dt;
      if (enemy.lostTargetTime >= 3) {
        enemy.aiMode = 'patrol';
        enemy.chaseTarget = null;
        enemy.aiTime = 2 + Math.random() * 2;
        enemy.targetDir = dirs[Math.floor(Math.random() * 4)];
      }
    }

    // 行为执行
    if (enemy.aiMode === 'patrol') {
      if (enemy.aiTime <= 0) {
        enemy.targetDir = dirs[Math.floor(Math.random() * 4)];
        enemy.aiTime = 2 + Math.random() * 2;
      }
      if (enemy.cooldown === 0 && Math.random() < 0.02) {
        state.bullets.push(makeBullet(enemy));
        enemy.cooldown = 1 + Math.random();
      }
      enemy.dir = enemy.targetDir;
    } else if (enemy.aiMode === 'chase') {
      const target = state.players.find((p) => p.id === enemy.chaseTarget);
      if (target) {
        const dx = target.x - enemy.x;
        const dy = target.y - enemy.y;
        if (Math.abs(dx) > Math.abs(dy)) {
          enemy.dir = dx > 0 ? 'right' : 'left';
        } else {
          enemy.dir = dy > 0 ? 'down' : 'up';
        }
        if (enemy.cooldown === 0) {
          state.bullets.push(makeBullet(enemy));
          enemy.cooldown = 0.8;
        }
      }
    }

    // 移动
    let moveX = 0;
    let moveY = 0;
    if (enemy.dir === 'up') moveY = -enemy.speed * dt;
    if (enemy.dir === 'down') moveY = enemy.speed * dt;
    if (enemy.dir === 'left') moveX = -enemy.speed * dt;
    if (enemy.dir === 'right') moveX = enemy.speed * dt;

    const newX = clamp(enemy.x + moveX, 0, MAP_W * TILE_SIZE - enemy.w);
    const newY = clamp(enemy.y + moveY, 0, MAP_H * TILE_SIZE - enemy.h);

    if (!collidesWithWall(state.tiles, { ...enemy, x: newX, y: newY })) {
      enemy.x = newX;
      enemy.y = newY;
    } else if (enemy.aiMode === 'patrol') {
      enemy.targetDir = dirs[Math.floor(Math.random() * 4)];
      enemy.aiTime = 2 + Math.random() * 2;
    }
  }
}

function updateBaseCapture(state, dt) {
  const base = state.base;

  if (!base.available) {
    base.respawnCooldown -= dt;
    if (base.respawnCooldown <= 0) {
      base.available = true;
      base.respawnCooldown = 0;
      base.captureProgress = 0;
      base.capturingPlayer = null;
    }
    return;
  }

  let playerOnBase = null;
  for (const player of state.players) {
    if (player.hp > 0 && rectsIntersect(player, base)) {
      playerOnBase = player;
      break;
    }
  }

  if (playerOnBase) {
    if (base.capturingPlayer === playerOnBase.id) {
      base.captureProgress += dt;
    } else {
      base.capturingPlayer = playerOnBase.id;
      base.captureProgress = dt;
    }

    if (base.captureProgress >= 3) {
      playerOnBase.hp = Math.min(3, playerOnBase.hp + 1);
      base.available = false;
      base.respawnCooldown = 15;
      base.captureProgress = 0;
      base.capturingPlayer = null;
    }
  } else {
    base.captureProgress = 0;
    base.capturingPlayer = null;
  }
}
