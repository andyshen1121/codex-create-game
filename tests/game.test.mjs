import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, rectsIntersect, stepGame, TILE_SIZE } from '../src/game.mjs';

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
  assert.equal(state.base.tileX, 8);
  assert.equal(state.base.tileY, 13);
  assert.equal(state.tiles[13][8], 'X');
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

  assert.equal(state.mode, 'lose');
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
