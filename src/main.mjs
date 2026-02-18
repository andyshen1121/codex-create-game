import { createGameState, renderGame, stepGame } from './game.mjs';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const keys = new Set();
window.addEventListener('keydown', (event) => keys.add(event.code));
window.addEventListener('keyup', (event) => keys.delete(event.code));

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
