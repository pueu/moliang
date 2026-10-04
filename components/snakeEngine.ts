export type Direction = 'up' | 'down' | 'left' | 'right';
export type Point = { x: number; y: number };
export type SnakeStatus = 'ready' | 'running' | 'paused' | 'over' | 'won';
export interface SnakeState {
  width: number;
  height: number;
  snake: Point[];
  direction: Direction;
  pending: Direction | null;
  food: Point | null;
  score: number;
  status: SnakeStatus;
}

const vectors: Record<Direction, Point> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};
const opposite: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

/** Select only a free cell; a full board has no food and is a win. */
export function placeFood(snake: Point[], width: number, height: number, random: number): Point | null {
  const occupied = new Set(snake.map(point => point.y * width + point.x));
  const free: Point[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!occupied.has(y * width + x)) free.push({ x, y });
  }
  if (!free.length) return null;
  const unit = Number.isFinite(random) ? Math.max(0, Math.min(0.999999999, random)) : 0;
  return free[Math.floor(unit * free.length)];
}

export function createSnake(): SnakeState {
  return {
    width: 32, height: 14,
    snake: [{ x: 8, y: 7 }, { x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }],
    direction: 'right', pending: null, food: { x: 20, y: 7 }, score: 0, status: 'ready',
  };
}

/** Accept one turn between ticks so rapid keys cannot reverse the snake. */
export function turnSnake(state: SnakeState, direction: Direction): SnakeState {
  if (!['ready', 'running'].includes(state.status) || state.pending || direction === opposite[state.direction] || direction === state.direction) return state;
  return { ...state, pending: direction };
}

export function stepSnake(state: SnakeState, random = 0.5): SnakeState {
  if (state.status !== 'running') return state;
  const direction = state.pending || state.direction;
  const vector = vectors[direction];
  const head = { x: state.snake[0].x + vector.x, y: state.snake[0].y + vector.y };
  const eating = !!state.food && same(head, state.food);
  // On a regular move the tail vacates before collision is evaluated.
  const occupied = eating ? state.snake : state.snake.slice(0, -1);
  if (head.x < 0 || head.y < 0 || head.x >= state.width || head.y >= state.height || occupied.some(point => same(point, head))) {
    return { ...state, direction, pending: null, status: 'over' };
  }
  const snake = [head, ...(eating ? state.snake : state.snake.slice(0, -1))];
  const food = eating ? placeFood(snake, state.width, state.height, random) : state.food;
  return { ...state, snake, direction, pending: null, food, score: state.score + (eating ? 1 : 0), status: food ? 'running' : 'won' };
}
