import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

// Exercise the shipped TypeScript engine directly, without another test dependency.
const source = await readFile(new URL('../components/snakeEngine.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { createSnake, stepSnake, turnSnake, placeFood } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);

test('reverse and a second queued turn cannot reverse within one tick', () => {
  const state = { ...createSnake(), status: 'running' };
  assert.equal(turnSnake(state, 'left'), state);
  const first = turnSnake(state, 'up');
  assert.equal(turnSnake(first, 'left'), first);
  assert.deepEqual(stepSnake(first).snake[0], { x: 8, y: 6 });
});

test('wall and body collisions finish the game', () => {
  const state = { ...createSnake(), status: 'running' };
  assert.equal(stepSnake({ ...state, snake: [{ x: 31, y: 0 }, { x: 30, y: 0 }] }).status, 'over');
  assert.equal(stepSnake({ ...state, snake: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }] }).status, 'over');
});

test('the vacated tail is a legal destination unless eating', () => {
  const state = { ...createSnake(), status: 'running', direction: 'left', snake: [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 2 }, { x: 0, y: 1 }] };
  const next = stepSnake(state);
  assert.equal(next.status, 'running');
  assert.deepEqual(next.snake[0], { x: 0, y: 1 });
  assert.equal(next.snake.length, 4);
  assert.equal(stepSnake({ ...state, food: { x: 0, y: 1 } }).status, 'over');
});

test('food grows the body, scores once, and never spawns in it', () => {
  const state = { ...createSnake(), status: 'running', food: { x: 9, y: 7 } };
  const next = stepSnake(state, 0);
  assert.equal(next.score, 1);
  assert.equal(next.snake.length, 5);
  assert.ok(!next.snake.some(point => point.x === next.food.x && point.y === next.food.y));
  assert.equal(placeFood([{ x: 0, y: 0 }], 1, 1, 0), null);
  assert.equal(stepSnake({ ...state, width: 2, height: 1, snake: [{ x: 0, y: 0 }], food: { x: 1, y: 0 } }).status, 'won');
});

test('ready, paused, game-over states do not move or mutate input', () => {
  for (const status of ['ready', 'paused', 'over', 'won']) {
    const state = { ...createSnake(), status };
    assert.equal(stepSnake(state), state);
  }
  const state = { ...createSnake(), status: 'running' };
  const original = JSON.stringify(state);
  stepSnake(state);
  assert.equal(JSON.stringify(state), original);
});
