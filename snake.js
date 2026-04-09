export const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const DEFAULT_GRID = { width: 16, height: 16 };
export const DEFAULT_STARTING_LENGTH = 3;

export function createInitialState(options = {}) {
  const width = options.width ?? DEFAULT_GRID.width;
  const height = options.height ?? DEFAULT_GRID.height;
  const snake = createStartingSnake(width, height, options.startingLength);
  const foods = spawnFoods(
    { width, height, snake },
    options.foodCount ?? 1,
    options.rng,
  );

  return {
    width,
    height,
    snake,
    direction: "right",
    food: foods[0] ?? null,
    foods,
    score: 0,
    gameOver: false,
  };
}

export function createStartingSnake(
  width,
  height,
  startingLength = DEFAULT_STARTING_LENGTH,
) {
  if (startingLength !== DEFAULT_STARTING_LENGTH) {
    throw new Error("Only the standard starting snake length is supported.");
  }

  if (width < 3 || height < 3) {
    throw new Error("Snake needs at least a 3x3 grid to start.");
  }

  const head = {
    x: Math.max(1, Math.min(width - 2, Math.floor(width / 2))),
    y: Math.floor(height / 2),
  };
  const body = { x: head.x - 1, y: head.y };
  const tailY = body.y + 1 < height ? body.y + 1 : body.y - 1;

  return [head, body, { x: body.x, y: tailY }];
}

export function turn(currentDirection, nextDirection) {
  if (!DIRECTIONS[nextDirection]) {
    return currentDirection;
  }

  const current = DIRECTIONS[currentDirection];
  const next = DIRECTIONS[nextDirection];

  if (current.x + next.x === 0 && current.y + next.y === 0) {
    return currentDirection;
  }

  return nextDirection;
}

export function reverseSnake(state) {
  const snake = [...state.snake].reverse();

  return {
    ...state,
    snake,
    direction: getDirectionAwayFromNextSegment(snake) ?? state.direction,
  };
}

export function getSnakeSegmentMeta(snake, index, direction = "right") {
  const segment = snake[index];

  if (!segment) {
    return { role: "body", orientation: "horizontal" };
  }

  if (index === 0) {
    return { role: "head", orientation: direction };
  }

  if (index === snake.length - 1) {
    return {
      role: "tail",
      orientation: getDirectionBetween(snake[index - 1], segment) ?? direction,
    };
  }

  const previous = snake[index - 1];
  const next = snake[index + 1];

  if (previous.x === next.x) {
    return { role: "straight", orientation: "vertical" };
  }

  if (previous.y === next.y) {
    return { role: "straight", orientation: "horizontal" };
  }

  return {
    role: "corner",
    orientation: getCornerOrientation(
      getDirectionBetween(segment, previous),
      getDirectionBetween(segment, next),
    ),
  };
}

export function getSnakeSegmentConnections(snake, index) {
  const segment = snake[index];

  if (!segment) {
    return [];
  }

  return [
    getDirectionBetween(segment, snake[index - 1]),
    getDirectionBetween(segment, snake[index + 1]),
  ].filter(Boolean);
}

export function stepGame(state, requestedDirection = state.direction, rng = Math.random) {
  if (state.gameOver) {
    return state;
  }

  const direction = turn(state.direction, requestedDirection);
  const movement = DIRECTIONS[direction];
  const head = state.snake[0];
  const nextHead = { x: head.x + movement.x, y: head.y + movement.y };
  const foods = getFoods(state);
  const eatenFoodIndex = foods.findIndex((food) => sameCell(nextHead, food));
  const eatsFood = eatenFoodIndex >= 0;
  const eatsWorm = sameCell(nextHead, state.worm);
  const hitsBomb = sameCell(nextHead, state.bomb);
  const collisionBody = eatsFood ? state.snake : state.snake.slice(0, -1);

  if (isOutOfBounds(nextHead, state) || containsCell(collisionBody, nextHead)) {
    return {
      ...state,
      direction,
      gameOver: true,
    };
  }

  const snake = eatsFood
    ? [nextHead, ...state.snake]
    : [nextHead, ...state.snake.slice(0, -1)];
  const nextState = {
    ...state,
    snake,
    direction,
    score: state.score + getConsumedAppleCount(eatsFood, eatsWorm, foods),
  };
  const nextFoods = eatsWorm
    ? []
    : eatsFood
    ? foods.filter((_, index) => index !== eatenFoodIndex)
    : foods;

  return {
    ...nextState,
    food: nextFoods[0] ?? null,
    foods: nextFoods,
    worm: eatsWorm ? null : state.worm,
    bomb: hitsBomb ? null : state.bomb,
    gameOver: hitsBomb ? true : nextState.gameOver,
    lastEvent: eatsFood ? "food" : eatsWorm ? "worm" : hitsBomb ? "bomb" : null,
    applesConsumedThisTick: getConsumedAppleCount(eatsFood, eatsWorm, foods),
  };
}

function getConsumedAppleCount(eatsFood, eatsWorm, foods) {
  if (eatsWorm) {
    return foods.length;
  }

  return eatsFood ? 1 : 0;
}

export function spawnFood(state, rng = Math.random) {
  return spawnFoods(state, 1, rng)[0] ?? null;
}

export function spawnWorm(state, rng = Math.random) {
  if (state.worm) {
    return state.worm;
  }

  return spawnFoods(
    {
      ...state,
      foods: [...getFoods(state), state.worm].filter(Boolean),
    },
    1,
    rng,
  )[0] ?? null;
}

export function spawnBomb(state, rng = Math.random) {
  if (state.bomb) {
    return state.bomb;
  }

  return spawnFoods(state, 1, rng)[0] ?? null;
}

export function moveWorm(state, rng = Math.random) {
  if (!state.worm) {
    return null;
  }

  const candidateDirections = [
    DIRECTIONS.up,
    DIRECTIONS.right,
    DIRECTIONS.down,
    DIRECTIONS.left,
  ];
  const reservedCells = [...getFoods(state), state.bomb].filter(Boolean);
  const candidates = candidateDirections
    .map((direction) => ({
      x: state.worm.x + direction.x,
      y: state.worm.y + direction.y,
    }))
    .filter(
      (cell) =>
        !isOutOfBounds(cell, state) &&
        !containsCell(state.snake, cell) &&
        !containsCell(reservedCells, cell),
    );

  if (candidates.length === 0) {
    return state.worm;
  }

  return candidates[Math.floor(rng() * candidates.length) % candidates.length];
}

export function isCellInBombBlast(cell, bomb) {
  if (!cell || !bomb) {
    return false;
  }

  return (
    Math.abs(cell.x - bomb.x) <= 1 &&
    Math.abs(cell.y - bomb.y) <= 1
  );
}

export function spawnFoods(state, count = 1, rng = Math.random) {
  const openCells = [];
  const reservedCells = [
    ...getFoods(state),
    state.worm,
    state.bomb,
  ].filter(Boolean);

  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      const cell = { x, y };
      if (
        !containsCell(state.snake, cell) &&
        !containsCell(reservedCells, cell)
      ) {
        openCells.push(cell);
      }
    }
  }

  const foods = [];
  const foodCount = Math.min(count, openCells.length);

  for (let foodIndex = 0; foodIndex < foodCount; foodIndex += 1) {
    const index = Math.floor(rng() * openCells.length) % openCells.length;
    foods.push(openCells[index]);
    openCells.splice(index, 1);
  }

  return foods;
}

export function isOutOfBounds(cell, state) {
  return (
    cell.x < 0 ||
    cell.y < 0 ||
    cell.x >= state.width ||
    cell.y >= state.height
  );
}

export function containsCell(cells, cell) {
  return cells.some((candidate) => sameCell(candidate, cell));
}

export function sameCell(a, b) {
  return Boolean(a && b && a.x === b.x && a.y === b.y);
}

export function getFoods(state) {
  if (Array.isArray(state.foods)) {
    return state.foods;
  }

  return state.food ? [state.food] : [];
}

function getDirectionAwayFromNextSegment(snake) {
  if (snake.length < 2) {
    return null;
  }

  const head = snake[0];
  const next = snake[1];
  const delta = {
    x: head.x - next.x,
    y: head.y - next.y,
  };

  return Object.entries(DIRECTIONS).find(([, movement]) => (
    movement.x === delta.x && movement.y === delta.y
  ))?.[0] ?? null;
}

function getDirectionBetween(from, to) {
  if (!from || !to) {
    return null;
  }

  const delta = {
    x: to.x - from.x,
    y: to.y - from.y,
  };

  return Object.entries(DIRECTIONS).find(([, movement]) => (
    movement.x === delta.x && movement.y === delta.y
  ))?.[0] ?? null;
}

function getCornerOrientation(a, b) {
  const directions = new Set([a, b]);

  if (directions.has("up") && directions.has("right")) {
    return "up-right";
  }

  if (directions.has("right") && directions.has("down")) {
    return "right-down";
  }

  if (directions.has("down") && directions.has("left")) {
    return "down-left";
  }

  return "left-up";
}
