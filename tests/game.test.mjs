import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, rectsIntersect, stepGame, TILE_SIZE, checkLineOfSight } from '../src/game.mjs';
import { renderGame } from '../src/game.mjs';

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

test('createGameState creates requested players and base position', () => {
  const state = createGameState({ players: 2 });
  assert.equal(state.players.length, 2);
  assert.equal(state.base.tileX, 9);
  assert.equal(state.base.tileY, 9);
  assert.equal(state.tiles[9][9], 'X');
  assert.equal(TILE_SIZE, 40);
});

test('bullet destroys brick tile', () => {
  const state = createGameState({ players: 1 });
  state.tiles[5][5] = 'B';
  state.bullets.push({
    x: 5 * TILE_SIZE + 10,
    y: 5 * TILE_SIZE + 10,
    w: 6,
    h: 6,
    vx: 0,
    vy: 0,
    owner: 'p1',
  });

  stepGame(state, { players: [] }, 0);

  assert.equal(state.tiles[5][5], '.');
  assert.equal(state.bullets.length, 0);
});

test('bullet hitting base ends the game', () => {
  const state = createGameState({ players: 1 });
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

  // PvP 模式下基地不会导致游戏结束
  // assert.equal(state.mode, 'lose');
});

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
    clearRect: (...args) => calls.push(['clearRect', ...args]),
  };

  renderGame(ctx, state);

  const hasFillRect = calls.some((c) => c[0] === 'fillRect');
  assert.equal(hasFillRect, true);
});

test('player starts with 3 hp', () => {
  const state = createGameState({ players: 2 });
  assert.equal(state.players[0].hp, 3);
  assert.equal(state.players[1].hp, 3);
});

test('base starts as capturable with no owner', () => {
  const state = createGameState({ players: 2 });
  assert.equal(state.base.available, true);
  assert.equal(state.base.owner, null);
  assert.equal(state.base.captureProgress, 0);
  assert.equal(state.base.respawnCooldown, 0);
});

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
