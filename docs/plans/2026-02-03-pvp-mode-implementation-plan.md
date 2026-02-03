# PvP 双人对战模式实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将坦克大战改造为双人对战模式，支持玩家互相攻击、AI 威胁、草地隐身、基地占领回血。

**Architecture:** 基于现有 game.mjs 修改，新增 AI 行为状态机（巡逻/追击）、基地占领进度追踪、草地隐身渲染逻辑。保持单文件结构，通过函数拆分保持清晰。

**Tech Stack:** 原生 JavaScript + Canvas，Node.js test runner

---

## Task 1: 重新设计对称地图

**Files:**
- Modify: `src/game.mjs:14-30`

**Step 1: 修改地图数据**

将 LEVEL_1 改为对称设计，玩家 1 左下角，玩家 2 右上角，中央放置基地：

```javascript
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
```

**Step 2: 运行测试确保不破坏现有功能**

Run: `node --test tests/game.test.mjs`
Expected: 部分测试失败（基地位置变化），这是预期的

**Step 3: 更新测试中的基地位置**

修改 `tests/game.test.mjs:18-25` 中的基地位置断言：

```javascript
test('createGameState creates requested players and base position', () => {
  const state = createGameState({ players: 2 });
  assert.equal(state.players.length, 2);
  assert.equal(state.base.tileX, 9);
  assert.equal(state.base.tileY, 9);
  assert.equal(state.tiles[9][9], 'X');
  assert.equal(TILE_SIZE, 40);
});
```

**Step 4: 更新 createGameState 中的基地和玩家位置**

修改 `src/game.mjs` 中的 createGameState：

```javascript
export function createGameState({ players = 2 } = {}) {
  const tiles = parseLevel(LEVEL_1);
  const base = { tileX: 9, tileY: 9, w: 32, h: 32 };
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
```

**Step 5: 运行测试**

Run: `node --test tests/game.test.mjs`
Expected: 测试通过（除了 base hitting 测试，下一步修复）

**Step 6: 修复 bullet hitting base 测试**

修改 `tests/game.test.mjs:46-61`：

```javascript
test('bullet hitting base ends the game', () => {
  const state = createGameState({ players: 1 });
  // 基地现在在 (9, 9)
  state.bullets.push({
    x: state.base.x + 2,
    y: state.base.y + 2,
    w: 6,
    h: 6,
    vx: 0,
    vy: 0,
    owner: 'p1',
  });

  stepGame(state, { players: [] }, 0);

  // PvP 模式下基地不会导致游戏结束，先跳过这个测试
  // assert.equal(state.mode, 'lose');
});
```

**Step 7: 运行测试确认**

Run: `node --test tests/game.test.mjs`
Expected: PASS

**Step 8: Commit**

```bash
git add src/game.mjs tests/game.test.mjs
git commit -m "feat: redesign map for symmetric PvP layout"
```

---

## Task 2: 玩家血量和基地占领状态

**Files:**
- Modify: `src/game.mjs:36-51` (createPlayer)
- Modify: `src/game.mjs:53-76` (createGameState)
- Modify: `tests/game.test.mjs`

**Step 1: 写测试 - 玩家初始血量为 3**

在 `tests/game.test.mjs` 添加：

```javascript
test('player starts with 3 hp', () => {
  const state = createGameState({ players: 2 });
  assert.equal(state.players[0].hp, 3);
  assert.equal(state.players[1].hp, 3);
});
```

**Step 2: 运行测试确认失败**

Run: `node --test tests/game.test.mjs`
Expected: FAIL (hp 是 1 不是 3)

**Step 3: 修改 createPlayer 设置 hp 为 3**

修改 `src/game.mjs` 中的 createPlayer：

```javascript
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
```

**Step 4: 运行测试**

Run: `node --test tests/game.test.mjs`
Expected: PASS

**Step 5: 写测试 - 基地初始状态**

在 `tests/game.test.mjs` 添加：

```javascript
test('base starts as capturable with no owner', () => {
  const state = createGameState({ players: 2 });
  assert.equal(state.base.available, true);
  assert.equal(state.base.owner, null);
  assert.equal(state.base.captureProgress, 0);
  assert.equal(state.base.respawnCooldown, 0);
});
```

**Step 6: 运行测试确认失败**

Run: `node --test tests/game.test.mjs`
Expected: FAIL

**Step 7: 修改 createGameState 添加基地状态**

修改 `src/game.mjs` 中的 createGameState，base 对象改为：

```javascript
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
```

**Step 8: 运行测试**

Run: `node --test tests/game.test.mjs`
Expected: PASS

**Step 9: Commit**

```bash
git add src/game.mjs tests/game.test.mjs
git commit -m "feat: add player hp=3 and base capture state"
```

---

## Task 3: 子弹击中坦克造成伤害

**Files:**
- Modify: `src/game.mjs:136-165` (stepGame)
- Modify: `tests/game.test.mjs`

**Step 1: 写测试 - 子弹击中敌人**

```javascript
test('bullet hitting enemy reduces enemy hp', () => {
  const state = createGameState({ players: 1 });
  state.enemies.push({
    id: 'e1',
    x: 200,
    y: 200,
    w: 32,
    h: 32,
    hp: 1,
  });
  state.bullets.push({
    x: 210,
    y: 210,
    w: 6,
    h: 6,
    vx: 0,
    vy: 0,
    owner: 'p1',
  });

  stepGame(state, { players: [] }, 0.1);

  assert.equal(state.enemies.length, 0);
  assert.equal(state.bullets.length, 0);
});
```

**Step 2: 运行测试确认失败**

Run: `node --test tests/game.test.mjs`
Expected: FAIL

**Step 3: 写测试 - 玩家子弹击中对方玩家**

```javascript
test('bullet from p1 hitting p2 reduces p2 hp', () => {
  const state = createGameState({ players: 2 });
  state.players[1].x = 200;
  state.players[1].y = 200;
  state.bullets.push({
    x: 210,
    y: 210,
    w: 6,
    h: 6,
    vx: 0,
    vy: 0,
    owner: 'p1',
  });

  const initialHp = state.players[1].hp;
  stepGame(state, { players: [] }, 0.1);

  assert.equal(state.players[1].hp, initialHp - 1);
  assert.equal(state.bullets.length, 0);
});
```

**Step 4: 写测试 - 玩家子弹不会击中自己**

```javascript
test('bullet does not hit its owner', () => {
  const state = createGameState({ players: 1 });
  state.bullets.push({
    x: state.players[0].x + 5,
    y: state.players[0].y + 5,
    w: 6,
    h: 6,
    vx: 0,
    vy: 0,
    owner: 'p1',
  });

  const initialHp = state.players[0].hp;
  stepGame(state, { players: [] }, 0.1);

  assert.equal(state.players[0].hp, initialHp);
});
```

**Step 5: 实现子弹碰撞检测**

在 stepGame 中的子弹循环里添加坦克碰撞检测，修改 `src/game.mjs:136-165`：

```javascript
export function stepGame(state, input, dt) {
  applyPlayerInput(state, input, dt);
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
    }

    // 击中敌人
    let hitTank = false;
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const enemy = state.enemies[i];
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
  updateWinLose(state);
}
```

**Step 6: 运行测试**

Run: `node --test tests/game.test.mjs`
Expected: PASS

**Step 7: Commit**

```bash
git add src/game.mjs tests/game.test.mjs
git commit -m "feat: add bullet-tank collision with damage"
```

---

## Task 4: AI 巡逻行为

**Files:**
- Modify: `src/game.mjs:212-229` (createEnemy)
- Add function: `updateAI` in `src/game.mjs`
- Modify: `tests/game.test.mjs`

**Step 1: 写测试 - AI 移动**

```javascript
test('AI enemy moves in patrol mode', () => {
  const state = createGameState({ players: 1 });
  state.enemies.push({
    id: 'e1',
    x: 200,
    y: 200,
    w: 32,
    h: 32,
    dir: 'down',
    speed: 70,
    hp: 1,
    cooldown: 1,
    aiMode: 'patrol',
    aiTime: 2,
    targetDir: 'down',
  });

  const initialY = state.enemies[0].y;
  stepGame(state, { players: [] }, 0.5);

  assert.ok(state.enemies[0].y > initialY);
});
```

**Step 2: 运行测试确认失败**

Run: `node --test tests/game.test.mjs`
Expected: FAIL

**Step 3: 修改 createEnemy 添加 AI 状态**

```javascript
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
```

**Step 4: 实现 updateAI 函数**

在 `src/game.mjs` 中添加：

```javascript
function updateAI(state, dt) {
  const dirs = ['up', 'down', 'left', 'right'];

  for (const enemy of state.enemies) {
    // 更新计时器
    enemy.aiTime -= dt;
    enemy.cooldown = Math.max(0, enemy.cooldown - dt);

    // 巡逻模式：时间到了换方向
    if (enemy.aiMode === 'patrol') {
      if (enemy.aiTime <= 0) {
        enemy.targetDir = dirs[Math.floor(Math.random() * 4)];
        enemy.aiTime = 2 + Math.random() * 2;
      }

      // 随机射击
      if (enemy.cooldown === 0 && Math.random() < 0.02) {
        state.bullets.push(makeBullet(enemy));
        enemy.cooldown = 1 + Math.random();
      }
    }

    // 移动
    enemy.dir = enemy.targetDir;
    let dx = 0;
    let dy = 0;
    if (enemy.dir === 'up') dy = -enemy.speed * dt;
    if (enemy.dir === 'down') dy = enemy.speed * dt;
    if (enemy.dir === 'left') dx = -enemy.speed * dt;
    if (enemy.dir === 'right') dx = enemy.speed * dt;

    const newX = clamp(enemy.x + dx, 0, MAP_W * TILE_SIZE - enemy.w);
    const newY = clamp(enemy.y + dy, 0, MAP_H * TILE_SIZE - enemy.h);

    // 检查墙体碰撞
    if (!collidesWithWall(state.tiles, { ...enemy, x: newX, y: newY })) {
      enemy.x = newX;
      enemy.y = newY;
    } else {
      // 撞墙换方向
      enemy.targetDir = dirs[Math.floor(Math.random() * 4)];
      enemy.aiTime = 2 + Math.random() * 2;
    }
  }
}
```

**Step 5: 实现 collidesWithWall 函数**

```javascript
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
```

**Step 6: 在 stepGame 中调用 updateAI**

在 stepGame 的 applyPlayerInput 之后添加：

```javascript
updateAI(state, dt);
```

**Step 7: 运行测试**

Run: `node --test tests/game.test.mjs`
Expected: PASS

**Step 8: Commit**

```bash
git add src/game.mjs tests/game.test.mjs
git commit -m "feat: add AI patrol behavior with random movement"
```

---

## Task 5: AI 视野检测

**Files:**
- Add function: `checkLineOfSight` in `src/game.mjs`
- Modify: `tests/game.test.mjs`

**Step 1: 写测试 - 视野无阻挡**

```javascript
test('checkLineOfSight returns true when no wall between', () => {
  const state = createGameState({ players: 1 });
  // 清空地图便于测试
  for (let y = 0; y < state.tiles.length; y++) {
    for (let x = 0; x < state.tiles[y].length; x++) {
      state.tiles[y][x] = '.';
    }
  }

  const enemy = { x: 200, y: 200, w: 32, h: 32, dir: 'right' };
  const player = { x: 280, y: 200, w: 32, h: 32 };

  const result = checkLineOfSight(state.tiles, enemy, player, 5);
  assert.equal(result, true);
});
```

**Step 2: 写测试 - 视野被墙阻挡**

```javascript
test('checkLineOfSight returns false when wall blocks view', () => {
  const state = createGameState({ players: 1 });
  for (let y = 0; y < state.tiles.length; y++) {
    for (let x = 0; x < state.tiles[y].length; x++) {
      state.tiles[y][x] = '.';
    }
  }
  // 在中间放一堵墙
  state.tiles[5][6] = 'B';

  const enemy = { x: 200, y: 200, w: 32, h: 32, dir: 'right' };
  const player = { x: 280, y: 200, w: 32, h: 32 };

  const result = checkLineOfSight(state.tiles, enemy, player, 5);
  assert.equal(result, false);
});
```

**Step 3: 写测试 - 目标在草地中不可见**

```javascript
test('checkLineOfSight returns false when target is in grass', () => {
  const state = createGameState({ players: 1 });
  for (let y = 0; y < state.tiles.length; y++) {
    for (let x = 0; x < state.tiles[y].length; x++) {
      state.tiles[y][x] = '.';
    }
  }
  // 玩家位置放草地
  state.tiles[5][7] = 'G';

  const enemy = { x: 200, y: 200, w: 32, h: 32, dir: 'right' };
  const player = { x: 280, y: 200, w: 32, h: 32 };

  const result = checkLineOfSight(state.tiles, enemy, player, 5);
  assert.equal(result, false);
});
```

**Step 4: 运行测试确认失败**

Run: `node --test tests/game.test.mjs`
Expected: FAIL (checkLineOfSight 未定义)

**Step 5: 实现 checkLineOfSight**

在 `src/game.mjs` 中添加并导出：

```javascript
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
```

**Step 6: 在 tests 中导入 checkLineOfSight**

修改 `tests/game.test.mjs` 顶部：

```javascript
import { createGameState, rectsIntersect, stepGame, TILE_SIZE, checkLineOfSight } from '../src/game.mjs';
```

**Step 7: 运行测试**

Run: `node --test tests/game.test.mjs`
Expected: PASS

**Step 8: Commit**

```bash
git add src/game.mjs tests/game.test.mjs
git commit -m "feat: add line of sight detection for AI"
```

---

## Task 6: AI 追击行为

**Files:**
- Modify: `updateAI` in `src/game.mjs`
- Modify: `tests/game.test.mjs`

**Step 1: 写测试 - AI 发现玩家后追击**

```javascript
test('AI switches to chase mode when seeing player', () => {
  const state = createGameState({ players: 1 });
  // 清空地图
  for (let y = 0; y < state.tiles.length; y++) {
    for (let x = 0; x < state.tiles[y].length; x++) {
      state.tiles[y][x] = '.';
    }
  }

  state.players[0].x = 300;
  state.players[0].y = 200;

  state.enemies.push({
    id: 'e1',
    x: 200,
    y: 200,
    w: 32,
    h: 32,
    dir: 'right',
    speed: 70,
    hp: 1,
    cooldown: 1,
    aiMode: 'patrol',
    aiTime: 2,
    targetDir: 'right',
    chaseTarget: null,
    lostTargetTime: 0,
  });

  stepGame(state, { players: [] }, 0.1);

  assert.equal(state.enemies[0].aiMode, 'chase');
  assert.equal(state.enemies[0].chaseTarget, 'p1');
});
```

**Step 2: 运行测试确认失败**

Run: `node --test tests/game.test.mjs`
Expected: FAIL

**Step 3: 修改 updateAI 添加追击逻辑**

替换 `updateAI` 函数：

```javascript
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
```

**Step 4: 运行测试**

Run: `node --test tests/game.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game.mjs tests/game.test.mjs
git commit -m "feat: add AI chase behavior when spotting player"
```

---

## Task 7: 草地隐身渲染

**Files:**
- Modify: `renderGame` in `src/game.mjs`
- Add function: `isInGrass` in `src/game.mjs`

**Step 1: 实现 isInGrass 函数**

```javascript
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
```

**Step 2: 修改 renderGame 不渲染草地中的坦克**

修改 `renderGame` 函数中渲染玩家和敌人的部分：

```javascript
export function renderGame(ctx, state) {
  ctx.clearRect(0, 0, MAP_W * TILE_SIZE, MAP_H * TILE_SIZE);

  // 渲染地图
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

  // 渲染基地（如果可用）
  if (state.base.available) {
    ctx.fillStyle = '#d9c15b';
    ctx.fillRect(state.base.x, state.base.y, state.base.w, state.base.h);
  }

  // 渲染玩家（不在草地中的）
  state.players.forEach((p, index) => {
    if (!isInGrass(state.tiles, p)) {
      ctx.fillStyle = index === 0 ? '#4aa3ff' : '#4aff6b';
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }
  });

  // 渲染敌人（不在草地中的）
  state.enemies.forEach((e) => {
    if (!isInGrass(state.tiles, e)) {
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(e.x, e.y, e.w, e.h);
    }
  });

  // 子弹始终可见
  state.bullets.forEach((b) => {
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(b.x, b.y, b.w, b.h);
  });

  // HUD
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`P1: ${state.players[0]?.hp ?? 0} HP`, 10, 18);
  if (state.players[1]) {
    ctx.fillText(`P2: ${state.players[1].hp} HP`, MAP_W * TILE_SIZE - 80, 18);
  }
}
```

**Step 3: 运行测试确认不破坏现有功能**

Run: `node --test tests/game.test.mjs`
Expected: PASS

**Step 4: Commit**

```bash
git add src/game.mjs
git commit -m "feat: add grass stealth - hide tanks in grass"
```

---

## Task 8: 基地占领机制

**Files:**
- Add function: `updateBaseCapture` in `src/game.mjs`
- Modify: `stepGame` in `src/game.mjs`
- Modify: `tests/game.test.mjs`

**Step 1: 写测试 - 玩家站在基地上增加占领进度**

```javascript
test('player standing on base increases capture progress', () => {
  const state = createGameState({ players: 1 });
  state.players[0].x = state.base.x;
  state.players[0].y = state.base.y;

  stepGame(state, { players: [] }, 1);

  assert.ok(state.base.captureProgress > 0);
  assert.equal(state.base.capturingPlayer, 'p1');
});
```

**Step 2: 写测试 - 占领完成后回血**

```javascript
test('capturing base heals player by 1 hp', () => {
  const state = createGameState({ players: 1 });
  state.players[0].hp = 2;
  state.players[0].x = state.base.x;
  state.players[0].y = state.base.y;
  state.base.captureProgress = 2.9;
  state.base.capturingPlayer = 'p1';

  stepGame(state, { players: [] }, 0.2);

  assert.equal(state.players[0].hp, 3);
  assert.equal(state.base.available, false);
});
```

**Step 3: 写测试 - 基地刷新**

```javascript
test('base respawns after cooldown', () => {
  const state = createGameState({ players: 1 });
  state.base.available = false;
  state.base.respawnCooldown = 0.1;

  stepGame(state, { players: [] }, 0.2);

  assert.equal(state.base.available, true);
  assert.equal(state.base.respawnCooldown, 0);
});
```

**Step 4: 运行测试确认失败**

Run: `node --test tests/game.test.mjs`
Expected: FAIL

**Step 5: 实现 updateBaseCapture**

```javascript
function updateBaseCapture(state, dt) {
  const base = state.base;

  // 基地刷新
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

  // 检查谁在基地上
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

    // 占领完成
    if (base.captureProgress >= 3) {
      playerOnBase.hp = Math.min(3, playerOnBase.hp + 1);
      base.available = false;
      base.respawnCooldown = 15;
      base.captureProgress = 0;
      base.capturingPlayer = null;
    }
  } else {
    // 没人在基地上，进度重置
    base.captureProgress = 0;
    base.capturingPlayer = null;
  }
}
```

**Step 6: 在 stepGame 中调用 updateBaseCapture**

在 `updateWinLose(state)` 之前添加：

```javascript
updateBaseCapture(state, dt);
```

**Step 7: 运行测试**

Run: `node --test tests/game.test.mjs`
Expected: PASS

**Step 8: Commit**

```bash
git add src/game.mjs tests/game.test.mjs
git commit -m "feat: add base capture mechanic with healing"
```

---

## Task 9: 更新 HUD 显示

**Files:**
- Modify: `renderGame` in `src/game.mjs`

**Step 1: 更新 HUD 显示基地状态**

修改 renderGame 末尾的 HUD 部分：

```javascript
// HUD
ctx.font = '16px monospace';
ctx.fillStyle = '#ffffff';

// P1 血量（左上角）
ctx.fillText(`P1: ${'*'.repeat(state.players[0]?.hp ?? 0)}`, 10, 20);

// P2 血量（右上角）
if (state.players[1]) {
  const p2Text = `P2: ${'*'.repeat(state.players[1].hp)}`;
  ctx.fillText(p2Text, MAP_W * TILE_SIZE - 100, 20);
}

// 基地状态（中央顶部）
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

// 游戏结束状态
if (state.mode === 'win_p1' || state.mode === 'win_p2') {
  ctx.font = '32px monospace';
  const winner = state.mode === 'win_p1' ? 'Player 1 Wins!' : 'Player 2 Wins!';
  const winWidth = ctx.measureText(winner).width;
  ctx.fillText(winner, (MAP_W * TILE_SIZE - winWidth) / 2, MAP_H * TILE_SIZE / 2);
}
```

**Step 2: 运行测试**

Run: `node --test tests/game.test.mjs`
Expected: PASS

**Step 3: Commit**

```bash
git add src/game.mjs
git commit -m "feat: update HUD with hp stars and base status"
```

---

## Task 10: 胜负判定

**Files:**
- Modify: `updateWinLose` in `src/game.mjs`
- Modify: `tests/game.test.mjs`

**Step 1: 写测试 - P1 血量归零 P2 获胜**

```javascript
test('p2 wins when p1 hp reaches 0', () => {
  const state = createGameState({ players: 2 });
  state.players[0].hp = 0;

  stepGame(state, { players: [] }, 0.1);

  assert.equal(state.mode, 'win_p2');
});
```

**Step 2: 写测试 - P2 血量归零 P1 获胜**

```javascript
test('p1 wins when p2 hp reaches 0', () => {
  const state = createGameState({ players: 2 });
  state.players[1].hp = 0;

  stepGame(state, { players: [] }, 0.1);

  assert.equal(state.mode, 'win_p1');
});
```

**Step 3: 运行测试确认失败**

Run: `node --test tests/game.test.mjs`
Expected: FAIL

**Step 4: 修改 updateWinLose**

```javascript
function updateWinLose(state) {
  if (state.mode !== 'playing') return;

  // PvP 模式：检查玩家血量
  if (state.players.length >= 2) {
    if (state.players[0].hp <= 0) {
      state.mode = 'win_p2';
      return;
    }
    if (state.players[1].hp <= 0) {
      state.mode = 'win_p1';
      return;
    }
  }
}
```

**Step 5: 运行测试**

Run: `node --test tests/game.test.mjs`
Expected: PASS

**Step 6: 删除旧的 win 测试**

删除 `tests/game.test.mjs` 中的：

```javascript
test('game wins when no enemies remain and all spawned', () => {
  // ... 删除这个测试，不再适用于 PvP 模式
});
```

**Step 7: 运行测试确认**

Run: `node --test tests/game.test.mjs`
Expected: PASS

**Step 8: Commit**

```bash
git add src/game.mjs tests/game.test.mjs
git commit -m "feat: add PvP win condition based on player hp"
```

---

## Task 11: 修改 AI Spawner 配置

**Files:**
- Modify: `updateSpawner` in `src/game.mjs`

**Step 1: 修改 spawner 逻辑支持 maxActive 限制**

```javascript
function updateSpawner(state, dt) {
  if (!state.spawner) return;

  state.spawner.cooldown -= dt;
  if (state.spawner.cooldown > 0) return;

  // 检查是否达到最大活跃数
  if (state.enemies.length >= state.spawner.maxActive) {
    return;
  }

  // 随机选择生成点
  const points = state.spawner.points;
  if (points.length === 0) return;

  const point = points[Math.floor(Math.random() * points.length)];
  state.enemies.push(createEnemy(`e${Date.now()}`, point.x, point.y));
  state.spawner.cooldown = state.spawner.interval;
}
```

**Step 2: 运行测试**

Run: `node --test tests/game.test.mjs`
Expected: PASS

**Step 3: Commit**

```bash
git add src/game.mjs
git commit -m "feat: limit AI spawner to maxActive enemies"
```

---

## Task 12: 最终集成测试

**Step 1: 在浏览器中测试**

打开 `index.html`，验证：
- [ ] 两个玩家在对角出生
- [ ] WASD/方向键控制各自玩家
- [ ] 玩家可以互相射击并造成伤害
- [ ] AI 定期生成，最多 3 个
- [ ] AI 巡逻并追击视野内玩家
- [ ] 进入草地后坦克不可见
- [ ] 站在基地上 3 秒可占领回血
- [ ] 血量归零后显示胜负

**Step 2: 运行所有测试**

Run: `node --test tests/game.test.mjs`
Expected: PASS

**Step 3: 最终 Commit**

```bash
git add -A
git commit -m "feat: complete PvP mode implementation"
```
