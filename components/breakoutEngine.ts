export type Brick = { x: number; y: number; width: number; height: number; pixel: number; alive: boolean };
export type Breakout = {
  width: number; height: number;
  bricks: Brick[];
  ball: { x: number; y: number; vx: number; vy: number; radius: number };
  paddle: { x: number; y: number; width: number; height: number };
  score: number; lives: number; remaining: number;
  status: 'running' | 'paused' | 'won' | 'over';
};

function serve(game: Breakout) {
  const speed = Math.max(190, Math.min(370, game.width * 0.45));
  game.ball.x = game.paddle.x + game.paddle.width / 2;
  game.ball.y = game.paddle.y - game.ball.radius - 8;
  game.ball.vx = speed * 0.36;
  game.ball.vy = -speed * Math.sqrt(1 - 0.36 ** 2);
}

export function createBreakout(bricks: Omit<Brick, 'alive'>[], width: number, height: number): Breakout {
  const paddleWidth = Math.min(width - 24, Math.max(66, width * 0.16));
  const game: Breakout = {
    width, height, bricks: bricks.map(brick => ({ ...brick, alive: true })),
    ball: { x: 0, y: 0, vx: 0, vy: 0, radius: Math.max(3, Math.min(5, width / 140)) },
    paddle: { x: (width - paddleWidth) / 2, y: height - 22, width: paddleWidth, height: 7 },
    score: 0, lives: 3, remaining: bricks.length, status: bricks.length ? 'running' : 'won',
  };
  serve(game);
  return game;
}

export function movePaddle(game: Breakout, center: number) {
  game.paddle.x = Math.max(0, Math.min(game.width - game.paddle.width, center - game.paddle.width / 2));
}

/** Small physics steps prevent the ball tunneling through individual glyph pixels. */
export function stepBreakout(game: Breakout, seconds: number): Breakout {
  if (game.status !== 'running' || !Number.isFinite(seconds) || seconds <= 0) return game;
  const duration = Math.min(seconds, 0.05);
  const speed = Math.hypot(game.ball.vx, game.ball.vy);
  const steps = Math.max(1, Math.ceil(speed * duration / (game.ball.radius / 2)));
  const dt = duration / steps;
  for (let step = 0; step < steps && game.status === 'running'; step++) {
    const ball = game.ball;
    const previousX = ball.x, previousY = ball.y;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (ball.x < ball.radius) { ball.x = ball.radius; ball.vx = Math.abs(ball.vx); }
    if (ball.x > game.width - ball.radius) { ball.x = game.width - ball.radius; ball.vx = -Math.abs(ball.vx); }
    if (ball.y < ball.radius) { ball.y = ball.radius; ball.vy = Math.abs(ball.vy); }
    const paddle = game.paddle;
    if (ball.vy > 0 && previousY + ball.radius <= paddle.y && ball.y + ball.radius >= paddle.y && ball.x + ball.radius >= paddle.x && ball.x - ball.radius <= paddle.x + paddle.width) {
      const hit = Math.max(-1, Math.min(1, (ball.x - paddle.x - paddle.width / 2) / (paddle.width / 2)));
      ball.vx = speed * hit * 0.85;
      ball.vy = -Math.sqrt(speed ** 2 - ball.vx ** 2);
      ball.y = paddle.y - ball.radius - 0.01;
    }
    const hit = game.bricks.find(brick => {
      if (!brick.alive) return false;
      const x = Math.max(brick.x, Math.min(brick.x + brick.width, ball.x));
      const y = Math.max(brick.y, Math.min(brick.y + brick.height, ball.y));
      return (ball.x - x) ** 2 + (ball.y - y) ** 2 <= ball.radius ** 2;
    });
    if (hit) {
      if (previousY + ball.radius <= hit.y || previousY - ball.radius >= hit.y + hit.height) ball.vy *= -1;
      else ball.vx *= -1;
      ball.x = previousX;
      ball.y = previousY;
      // Clear a small cluster so densely sampled font pixels are fun to break.
      const radius = Math.max(ball.radius * 1.5, hit.width * 2.2);
      for (const brick of game.bricks) {
        if (brick.alive && Math.hypot(brick.x + brick.width / 2 - hit.x - hit.width / 2, brick.y + brick.height / 2 - hit.y - hit.height / 2) <= radius) {
          brick.alive = false;
          game.remaining--;
          game.score += 10;
        }
      }
      if (!game.remaining) game.status = 'won';
    }
    if (ball.y - ball.radius > game.height) {
      game.lives--;
      if (!game.lives) game.status = 'over';
      else serve(game);
      break;
    }
  }
  return game;
}
