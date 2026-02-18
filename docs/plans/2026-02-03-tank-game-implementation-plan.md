# Tank Game Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现可运行的网页版坦克大战（单人闯关 + 本地双人），Canvas 800x600。  
**Architecture:** 以 `src/game.mjs` 为核心逻辑模块，`src/main.mjs` 负责浏览器启动与循环驱动，`index.html` 提供画布与资源加载。逻辑与渲染分离，核心逻辑通过 Node 内置测试覆盖。  
**Tech Stack:** 原生 HTML + Canvas + JS (ES Modules), Node.js `node --test`。

**Assumptions / Exceptions:** DOM 启动与事件绑定难以单测，计划走手工验证；执行前需要用户明确允许此例外。

---

### Task 1: TDD 基础几何碰撞 `rectsIntersect`

**Files:**
- Create: `tests/game.test.mjs`
- Create: `src/game.mjs`

**Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { rectsIntersect } from '../src/game.mjs';

test('rectsIntersect returns true for overlapping rectangles', () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };
  const b = { x: 5, y: 5, w: 10, h: 10 };
  assert.equal(rectsIntersect(a, b), true);
});

test('rectsIntersect returns false for separated rectangles', () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };
  const b = { x: 20, y: 20, w: 5, h: 5 };
  assert.equal(rectsIntersect(a, b), false);
});
```

**Step 2: Run test to verify it fails**
Run: `node --test tests/game.test.mjs`  
Expected: FAIL (ERR_MODULE_NOT_FOUND: `../src/game.mjs`)

**Step 3: Write minimal implementation (stub to reach assertion failure)**

```js
export function rectsIntersect() {
  return false;
}
```

**Step 4: Run test to verify it fails correctly**
Run: `node --test tests/game.test.mjs`  
Expected: FAIL (first test expects `true` but got `false`)

**Step 5: Write minimal implementation**

```js
export function rectsIntersect(a, b) {
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
}
```

**Step 6: Run test to verify it passes**
Run: `node --test tests/game.test.mjs`  
Expected: PASS (2 tests)

**Step 7: Commit**
```bash
git add tests/game.test.mjs src/game.mjs
git commit -m "feat: add rect intersection"
```

---

### Task 2: TDD 初始化 `createGameState` 与关卡常量

**Files:**
- Modify: `src/game.mjs`
- Modify: `tests/game.test.mjs`

**Step 1: Write the failing test**

```js
import { createGameState, TILE_SIZE } from '../src/game.mjs';

test('createGameState creates requested players and base position', () => {
  const state = createGameState({ players: 2 });
  assert.equal(state.players.length, 2);
  assert.equal(state.base.tileX, 8);
  assert.equal(state.base.tileY, 13);
  assert.equal(state.tiles[13][8], 'X');
  assert.equal(TILE_SIZE, 40);
});
```

**Step 2: Run test to verify it fails**
Run: `node --test tests/game.test.mjs`  
Expected: FAIL (createGameState or constants not defined)

**Step 3: Write minimal implementation**

```js
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
```

**Step 4: Run test to verify it passes**
Run: `node --test tests/game.test.mjs`  
Expected: PASS

**Step 5: Commit**
```bash
git add src/game.mjs tests/game.test.mjs
git commit -m "feat: add game state init"
```

---

### Task 3: TDD 子弹命中砖墙/基地

**Files:**
- Modify: `tests/game.test.mjs`
- Modify: `src/game.mjs`

**Step 1: Write the failing tests**

```js
import { stepGame } from '../src/game.mjs';

test('bullet destroys brick tile', () => {
  const state = createGameState({ players: 1 });
  state.tiles[5][5] = 'B';
  state.bullets.push({ x: 5 * TILE_SIZE + 10, y: 5 * TILE_SIZE + 10, w: 6, h: 6, vx: 0, vy: 0, owner: 'p1' });

  stepGame(state, { players: [] }, 0);

  assert.equal(state.tiles[5][5], '.');
  assert.equal(state.bullets.length, 0);
});

test('bullet hitting base ends the game', () => {
  const state = createGameState({ players: 1 });
  state.bullets.push({ x: state.base.x + 2, y: state.base.y + 2, w: 6, h: 6, vx: 0, vy: 0, owner: 'p1' });

  stepGame(state, { players: [] }, 0);

  assert.equal(state.mode, 'lose');
});
```

**Step 2: Run tests to verify they fail**
Run: `node --test tests/game.test.mjs`  
Expected: FAIL (stepGame not defined)

**Step 3: Write minimal implementation**

```js
function tileAt(tiles, x, y) {
  const tileX = Math.floor(x / TILE_SIZE);
  const tileY = Math.floor(y / TILE_SIZE);
  if (tileX < 0 || tileY < 0 || tileY >= tiles.length || tileX >= tiles[0].length) return null;
  return { tileX, tileY, value: tiles[tileY][tileX] };
}

export function stepGame(state, input, dt) {
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
```

**Step 4: Run tests to verify they pass**
Run: `node --test tests/game.test.mjs`  
Expected: PASS

**Step 5: Commit**
```bash
git add src/game.mjs tests/game.test.mjs
git commit -m "feat: handle bullet tile collisions"
```

---

### Task 4: TDD 玩家移动与射击

**Files:**
- Modify: `tests/game.test.mjs`
- Modify: `src/game.mjs`

**Step 1: Write the failing tests**

```js
test('player moves right when input is pressed', () => {
  const state = createGameState({ players: 1 });
  const input = { players: [{ right: true, left: false, up: false, down: false, fire: false }] };
  const beforeX = state.players[0].x;

  stepGame(state, input, 1);

  assert.ok(state.players[0].x > beforeX);
});

test('player fires bullet when cooldown is ready', () => {
  const state = createGameState({ players: 1 });
  const input = { players: [{ right: false, left: false, up: false, down: false, fire: true }] };

  stepGame(state, input, 0.1);

  assert.equal(state.bullets.length, 1);
});
```

**Step 2: Run tests to verify they fail**
Run: `node --test tests/game.test.mjs`  
Expected: FAIL (movement/shooting not implemented)

**Step 3: Write minimal implementation**

```js
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
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
    if (keys.left) { dx = -speed * dt; player.dir = 'left'; }
    else if (keys.right) { dx = speed * dt; player.dir = 'right'; }
    else if (keys.up) { dy = -speed * dt; player.dir = 'up'; }
    else if (keys.down) { dy = speed * dt; player.dir = 'down'; }

    player.x = clamp(player.x + dx, 0, MAP_W * TILE_SIZE - player.w);
    player.y = clamp(player.y + dy, 0, MAP_H * TILE_SIZE - player.h);

    player.cooldown = Math.max(0, player.cooldown - dt);
    if (keys.fire && player.cooldown === 0) {
      state.bullets.push(makeBullet(player));
      player.cooldown = 0.4;
    }
  });
}

export function stepGame(state, input, dt) {
  applyPlayerInput(state, input, dt);
  // 继续保留 Task 3 的子弹碰撞逻辑
}
```

**Step 4: Run tests to verify they pass**
Run: `node --test tests/game.test.mjs`  
Expected: PASS

**Step 5: Commit**
```bash
git add src/game.mjs tests/game.test.mjs
git commit -m "feat: add player movement and shooting"
```

---

### Task 5: TDD 敌人生成与通关判定

**Files:**
- Modify: `tests/game.test.mjs`
- Modify: `src/game.mjs`

**Step 1: Write the failing tests**

```js
test('spawner creates enemies until remaining is zero', () => {
  const state = createGameState({ players: 1 });
  state.spawner = { remaining: 1, cooldown: 0, interval: 0, points: [{ x: 1, y: 1 }] };

  stepGame(state, { players: [] }, 0.1);

  assert.equal(state.enemies.length, 1);
  assert.equal(state.spawner.remaining, 0);
});

test('game wins when no enemies remain and all spawned', () => {
  const state = createGameState({ players: 1 });
  state.spawner = { remaining: 0, cooldown: 0, interval: 0, points: [] };
  state.enemies = [];

  stepGame(state, { players: [] }, 0.1);

  assert.equal(state.mode, 'win');
});
```

**Step 2: Run tests to verify they fail**
Run: `node --test tests/game.test.mjs`  
Expected: FAIL (spawner logic not implemented)

**Step 3: Write minimal implementation**

```js
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

export function stepGame(state, input, dt) {
  applyPlayerInput(state, input, dt);
  updateSpawner(state, dt);
  // 子弹与其它逻辑
  updateWinLose(state);
}
```

**Step 4: Run tests to verify they pass**
Run: `node --test tests/game.test.mjs`  
Expected: PASS

**Step 5: Commit**
```bash
git add src/game.mjs tests/game.test.mjs
git commit -m "feat: add enemy spawner and win condition"
```

---

### Task 6: TDD 渲染 `renderGame`

**Files:**
- Modify: `tests/game.test.mjs`
- Modify: `src/game.mjs`

**Step 1: Write the failing test**

```js
import { renderGame } from '../src/game.mjs';

test('renderGame draws base and players', () => {
  const state = createGameState({ players: 1 });
  const calls = [];
  const ctx = {
    fillStyle: '#000',
    strokeStyle: '#000',
    fillRect: (...args) => calls.push(['fillRect', ...args]),
    strokeRect: (...args) => calls.push(['strokeRect', ...args]),
    fillText: (...args) => calls.push(['fillText', ...args]),
    save: () => {},
    restore: () => {},
    clearRect: () => calls.push(['clearRect']),
  };

  renderGame(ctx, state);

  const hasFillRect = calls.some((c) => c[0] === 'fillRect');
  assert.equal(hasFillRect, true);
});
```

**Step 2: Run tests to verify they fail**
Run: `node --test tests/game.test.mjs`  
Expected: FAIL (renderGame not defined)

**Step 3: Write minimal implementation**

```js
export function renderGame(ctx, state) {
  ctx.clearRect(0, 0, MAP_W * TILE_SIZE, MAP_H * TILE_SIZE);

  for (let y = 0; y < state.tiles.length; y += 1) {
    for (let x = 0; x < state.tiles[y].length; x += 1) {
      const tile = state.tiles[y][x];
      if (tile === '.') continue;
      if (tile === 'G') { ctx.fillStyle = '#3b7a2a'; }
      else if (tile === 'B') { ctx.fillStyle = '#b86b3a'; }
      else if (tile === 'S') { ctx.fillStyle = '#888888'; }
      else if (tile === 'W') { ctx.fillStyle = '#2a6fdb'; }
      else if (tile === 'X') { ctx.fillStyle = '#d9c15b'; }
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
```

**Step 4: Run tests to verify they pass**
Run: `node --test tests/game.test.mjs`  
Expected: PASS

**Step 5: Commit**
```bash
git add src/game.mjs tests/game.test.mjs
git commit -m "feat: render game"
```

---

### Task 7: 浏览器启动与页面结构（需用户允许手工验证）

**Files:**
- Create: `index.html`
- Create: `src/main.mjs`
- Create: `styles.css`

**Step 1: Write minimal HTML**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>坦克大战</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <canvas id="game" width="800" height="600"></canvas>
    <script type="module" src="src/main.mjs"></script>
  </body>
</html>
```

**Step 2: Write minimal CSS**

```css
body {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #1c1b1a;
}

#game {
  border: 4px solid #f2d06b;
  background: #1a1a1a;
  image-rendering: pixelated;
}
```

**Step 3: Write `src/main.mjs`**

```js
import { createGameState, stepGame, renderGame } from './game.mjs';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const keys = new Set();
window.addEventListener('keydown', (e) => keys.add(e.code));
window.addEventListener('keyup', (e) => keys.delete(e.code));

function readInput() {
  const p1 = {
    up: keys.has('KeyW'),
    down: keys.has('KeyS'),
    left: keys.has('KeyA'),
    right: keys.has('KeyD'),
    fire: keys.has('Space'),
  };
  const p2 = {
    up: keys.has('ArrowUp'),
    down: keys.has('ArrowDown'),
    left: keys.has('ArrowLeft'),
    right: keys.has('ArrowRight'),
    fire: keys.has('Enter'),
  };
  return { players: [p1, p2] };
}

const state = createGameState({ players: 2 });
let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  stepGame(state, readInput(), dt);
  renderGame(ctx, state);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
```

**Step 4: Manual verification**
Open `index.html` in browser, verify movement, shooting, collision, win/lose.

**Step 5: Commit**
```bash
git add index.html styles.css src/main.mjs
git commit -m "feat: add browser bootstrap"
```

---

**Plan complete and saved to `docs/plans/2026-02-03-tank-game-implementation-plan.md`. Two execution options:**

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
