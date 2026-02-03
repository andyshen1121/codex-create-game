import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, rectsIntersect, TILE_SIZE } from '../src/game.mjs';

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
