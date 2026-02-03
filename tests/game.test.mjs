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
