const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/breakoutEngine.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} };
vm.runInNewContext(code, context);
const { createBreakout, movePaddle, stepBreakout } = context.exports;
const brick = { pixel: 0, x: 140, y: 70, width: 6, height: 6 };

test('fast ball hits a thin glyph pixel and clears it', () => {
  const game = createBreakout([brick], 300, 280);
  Object.assign(game.ball, { x: 143, y: 110, vx: 0, vy: -1000 });
  stepBreakout(game, 0.05);
  assert.equal(game.bricks[0].alive, false);
  assert.equal(game.remaining, 0);
  assert.equal(game.score, 10);
  assert.equal(game.status, 'won');
  assert.ok(game.ball.vy > 0);
});

test('paddle bounce sends the ball upward and aiming at its edge changes direction', () => {
  const game = createBreakout([brick], 300, 280);
  Object.assign(game.ball, { x: game.paddle.x + game.paddle.width - 5, y: game.paddle.y - game.ball.radius - 1, vx: 0, vy: 250 });
  stepBreakout(game, 0.02);
  assert.ok(game.ball.vy < 0);
  assert.ok(game.ball.vx > 0);
});

test('paddle stays inside the playfield', () => {
  const game = createBreakout([brick], 300, 280);
  movePaddle(game, -100);
  assert.equal(game.paddle.x, 0);
  movePaddle(game, 1000);
  assert.equal(game.paddle.x + game.paddle.width, 300);
});

test('paused game does not change ball, bricks or lives', () => {
  const game = createBreakout([brick], 300, 280);
  game.status = 'paused';
  const before = JSON.stringify(game);
  stepBreakout(game, 0.05);
  assert.equal(JSON.stringify(game), before);
});

test('a missed ball consumes one life; the third miss ends the game', () => {
  const game = createBreakout([brick], 300, 280);
  for (let miss = 1; miss <= 3; miss++) {
    Object.assign(game.ball, { x: 4, y: 290, vx: 0, vy: 200 });
    stepBreakout(game, 0.01);
    assert.equal(game.lives, 3 - miss);
    assert.equal(game.status, miss === 3 ? 'over' : 'running');
  }
});

test('nearby glyph pixels break together, distant letters stay intact', () => {
  const game = createBreakout([brick, { ...brick, pixel: 1, x: 146 }, { ...brick, pixel: 2, x: 220 }], 300, 280);
  Object.assign(game.ball, { x: 143, y: 90, vx: 0, vy: -250 });
  stepBreakout(game, 0.05);
  assert.equal(game.remaining, 1);
  assert.equal(game.bricks[2].alive, true);
  assert.equal(game.score, 20);
});
