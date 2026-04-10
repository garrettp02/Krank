import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  createStartingSnake,
  isCellInBombBlast,
  getSnakeSegmentConnections,
  getSnakeSegmentMeta,
  moveWorm,
  reverseSnake,
  spawnBomb,
  spawnFood,
  spawnFoods,
  spawnWorm,
  stepGame,
  turn,
} from "../src/snake.js";
import {
  BASE_TICK_MS,
  MAX_TICK_MS,
  MIN_TICK_MS,
  getAppleBatchSize,
  getLevelBoardSize,
  getLevelTarget,
  getNextLevelProgress,
  getNextTickMsAfterApple,
  shouldBlackoutAfterApple,
  shouldDropTurnInput,
  shouldSpawnBombAfterApple,
  shouldReverseSnakeAfterApple,
  shouldSpawnWormAfterApple,
} from "../src/levels.js";
import { getSpeedrunScoreBreakdown } from "../src/scoring.js";

test("moves the snake one cell in the current direction", () => {
  const state = {
    width: 6,
    height: 6,
    snake: [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ],
    direction: "right",
    foods: [{ x: 5, y: 5 }],
    score: 0,
    gameOver: false,
  };

  const next = stepGame(state, "right");

  assert.deepEqual(next.snake, [
    { x: 3, y: 2 },
    { x: 2, y: 2 },
    { x: 1, y: 2 },
  ]);
  assert.equal(next.score, 0);
  assert.equal(next.gameOver, false);
});

test("grows and increments the score when eating food", () => {
  const state = {
    width: 6,
    height: 6,
    snake: [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ],
    direction: "right",
    foods: [{ x: 3, y: 2 }],
    score: 0,
    gameOver: false,
  };

  const next = stepGame(state, "right", () => 0);

  assert.equal(next.snake.length, 4);
  assert.deepEqual(next.snake[0], { x: 3, y: 2 });
  assert.equal(next.score, 1);
  assert.deepEqual(next.foods, []);
});

test("eats one food while leaving other spawned foods in place", () => {
  const state = {
    width: 6,
    height: 6,
    snake: [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ],
    direction: "right",
    foods: [
      { x: 3, y: 2 },
      { x: 5, y: 5 },
    ],
    score: 0,
    gameOver: false,
  };

  const next = stepGame(state, "right");

  assert.equal(next.score, 1);
  assert.deepEqual(next.foods, [{ x: 5, y: 5 }]);
  assert.deepEqual(next.food, { x: 5, y: 5 });
});

test("eats a worm and counts cleared apples toward score", () => {
  const state = {
    width: 6,
    height: 6,
    snake: [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ],
    direction: "right",
    foods: [
      { x: 5, y: 5 },
      { x: 4, y: 4 },
    ],
    worm: { x: 3, y: 2 },
    score: 7,
    gameOver: false,
  };

  const next = stepGame(state, "right");

  assert.equal(next.score, 9);
  assert.deepEqual(next.foods, []);
  assert.equal(next.food, null);
  assert.equal(next.worm, null);
  assert.equal(next.lastEvent, "worm");
  assert.equal(next.applesConsumedThisTick, 2);
});

test("hits a bomb and ends the game without consuming apples", () => {
  const state = {
    width: 6,
    height: 6,
    snake: [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ],
    direction: "right",
    foods: [{ x: 5, y: 5 }],
    bomb: { x: 3, y: 2 },
    score: 4,
    gameOver: false,
  };

  const next = stepGame(state, "right");

  assert.equal(next.score, 4);
  assert.equal(next.gameOver, true);
  assert.equal(next.bomb, null);
  assert.equal(next.lastEvent, "bomb");
  assert.equal(next.applesConsumedThisTick, 0);
});

test("detects wall collisions", () => {
  const state = {
    width: 4,
    height: 4,
    snake: [{ x: 3, y: 1 }],
    direction: "right",
    foods: [{ x: 0, y: 0 }],
    score: 0,
    gameOver: false,
  };

  const next = stepGame(state, "right");

  assert.equal(next.gameOver, true);
});

test("detects self collisions while allowing the tail to move away", () => {
  const blocked = {
    width: 5,
    height: 5,
    snake: [
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
    direction: "left",
    foods: [{ x: 4, y: 4 }],
    score: 0,
    gameOver: false,
  };

  assert.equal(stepGame(blocked, "up").gameOver, true);

  const tailMoves = {
    width: 5,
    height: 5,
    snake: [
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
    direction: "left",
    foods: [{ x: 4, y: 4 }],
    score: 0,
    gameOver: false,
  };

  assert.equal(stepGame(tailMoves, "left").gameOver, false);
});

test("does not allow direct reversal", () => {
  assert.equal(turn("right", "left"), "right");
  assert.equal(turn("right", "up"), "up");
});

test("reverses snake movement from the previous tail", () => {
  const state = {
    snake: [
      { x: 5, y: 3 },
      { x: 5, y: 2 },
      { x: 4, y: 2 },
      { x: 3, y: 2 },
    ],
    direction: "down",
  };

  assert.deepEqual(reverseSnake(state), {
    snake: [
      { x: 3, y: 2 },
      { x: 4, y: 2 },
      { x: 5, y: 2 },
      { x: 5, y: 3 },
    ],
    direction: "left",
  });
});

test("classifies snake segment roles and orientations for rendering", () => {
  const snake = [
    { x: 4, y: 2 },
    { x: 3, y: 2 },
    { x: 2, y: 2 },
    { x: 2, y: 3 },
  ];

  assert.deepEqual(getSnakeSegmentMeta(snake, 0, "right"), {
    role: "head",
    orientation: "right",
  });
  assert.deepEqual(getSnakeSegmentMeta(snake, 1, "right"), {
    role: "straight",
    orientation: "horizontal",
  });
  assert.deepEqual(getSnakeSegmentMeta(snake, 2, "right"), {
    role: "corner",
    orientation: "right-down",
  });
  assert.deepEqual(getSnakeSegmentMeta(snake, 3, "right"), {
    role: "tail",
    orientation: "down",
  });
});

test("classifies connected sides for snake segment rendering", () => {
  const snake = [
    { x: 4, y: 2 },
    { x: 3, y: 2 },
    { x: 2, y: 2 },
    { x: 2, y: 3 },
  ];

  assert.deepEqual(getSnakeSegmentConnections(snake, 1), ["right", "left"]);
  assert.deepEqual(getSnakeSegmentConnections(snake, 2), ["right", "down"]);
  assert.deepEqual(getSnakeSegmentConnections(snake, 3), ["up"]);
});

test("classifies head and tail after snake reversal", () => {
  const state = {
    snake: [
      { x: 5, y: 3 },
      { x: 5, y: 2 },
      { x: 4, y: 2 },
      { x: 3, y: 2 },
    ],
    direction: "down",
  };
  const reversed = reverseSnake(state);

  assert.deepEqual(getSnakeSegmentMeta(reversed.snake, 0, reversed.direction), {
    role: "head",
    orientation: "left",
  });
  assert.deepEqual(getSnakeSegmentMeta(reversed.snake, 3, reversed.direction), {
    role: "tail",
    orientation: "down",
  });
});

test("spawns food only in an empty cell", () => {
  const state = {
    width: 2,
    height: 2,
    snake: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
  };

  assert.deepEqual(spawnFood(state, () => 0), { x: 1, y: 1 });
});

test("spawns multiple food cells without overlapping the snake", () => {
  const state = {
    width: 3,
    height: 3,
    snake: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
  };

  assert.deepEqual(spawnFoods(state, 2, () => 0), [
    { x: 2, y: 0 },
    { x: 1, y: 1 },
  ]);
});

test("spawns a worm without overlapping the snake or apples", () => {
  const state = {
    width: 3,
    height: 3,
    snake: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
    foods: [
      { x: 2, y: 0 },
      { x: 1, y: 1 },
    ],
  };

  assert.deepEqual(spawnWorm(state, () => 0), { x: 2, y: 1 });
});

test("moves the worm to an adjacent open cell", () => {
  const state = {
    width: 5,
    height: 5,
    snake: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
    foods: [{ x: 2, y: 2 }],
    worm: { x: 2, y: 1 },
    bomb: { x: 4, y: 4 },
  };

  assert.deepEqual(moveWorm(state, () => 0), { x: 2, y: 0 });
});

test("keeps the worm in place when no adjacent cells are open", () => {
  const state = {
    width: 3,
    height: 3,
    snake: [
      { x: 1, y: 0 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
      { x: 0, y: 1 },
    ],
    foods: [],
    worm: { x: 1, y: 1 },
    bomb: null,
  };

  assert.deepEqual(moveWorm(state, () => 0), { x: 1, y: 1 });
});

test("spawns a bomb without overlapping the snake, apples, or worm", () => {
  const state = {
    width: 3,
    height: 3,
    snake: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
    foods: [
      { x: 2, y: 0 },
      { x: 1, y: 1 },
    ],
    worm: { x: 2, y: 1 },
  };

  assert.deepEqual(spawnBomb(state, () => 0), { x: 0, y: 2 });
});

test("treats the bomb cell and adjacent cells as inside the blast radius", () => {
  const bomb = { x: 3, y: 3 };

  assert.equal(isCellInBombBlast({ x: 3, y: 3 }, bomb), true);
  assert.equal(isCellInBombBlast({ x: 4, y: 3 }, bomb), true);
  assert.equal(isCellInBombBlast({ x: 2, y: 2 }, bomb), true);
  assert.equal(isCellInBombBlast({ x: 5, y: 3 }, bomb), false);
  assert.equal(isCellInBombBlast({ x: 3, y: 5 }, bomb), false);
});

test("creates a playable initial state with food off the snake", () => {
  const state = createInitialState({ width: 8, height: 8, rng: () => 0 });

  assert.equal(state.snake.length, 3);
  assert.equal(state.score, 0);
  assert.equal(state.gameOver, false);
  assert.equal(state.foods.length, 1);
  assert.equal(
    state.snake.some((segment) => segment.x === state.food.x && segment.y === state.food.y),
    false,
  );
});

test("creates an initial state with a requested food count", () => {
  const state = createInitialState({ width: 8, height: 8, foodCount: 3, rng: () => 0 });

  assert.equal(state.foods.length, 3);
  assert.deepEqual(state.food, state.foods[0]);
});

test("creates a valid 3x3 starting snake", () => {
  const state = createInitialState({ width: 3, height: 3, rng: () => 0 });

  assert.deepEqual(state.snake, [
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
  ]);
  assert.equal(state.snake.some((segment) => segment.x < 0 || segment.y < 0), false);
  assert.equal(stepGame(state, "right").gameOver, false);
});

test("rejects boards smaller than 3x3", () => {
  assert.throws(() => createStartingSnake(2, 3), /at least a 3x3/);
});

test("uses the level number as the apple target", () => {
  assert.equal(getLevelTarget(1), 1);
  assert.equal(getLevelTarget(30), 30);
});

test("randomizes apple batch size up to half the level target", () => {
  assert.equal(getAppleBatchSize(5, 0, () => 0.99), 0);
  assert.equal(getAppleBatchSize(1, 1, () => 0.99), 1);
  assert.equal(getAppleBatchSize(5, 5, () => 0), 1);
  assert.equal(getAppleBatchSize(5, 5, () => 0.99), 2);
  assert.equal(getAppleBatchSize(9, 2, () => 0.99), 2);
});

test("keeps speed stable before level 5", () => {
  assert.equal(getNextTickMsAfterApple(4, BASE_TICK_MS, () => 0), BASE_TICK_MS);
});

test("randomly stacks speed changes starting at level 5", () => {
  const fasterRolls = [0, 0];
  const slowerRolls = [0, 0.99];
  const noChangeRolls = [0.99];

  assert.equal(getNextTickMsAfterApple(5, 175, () => fasterRolls.shift()), 158);
  assert.equal(getNextTickMsAfterApple(5, 175, () => slowerRolls.shift()), 193);
  assert.equal(getNextTickMsAfterApple(5, 175, () => noChangeRolls.shift()), 175);
});

test("clamps stacked speed changes to playable bounds", () => {
  const fasterRolls = [0, 0];
  const slowerRolls = [0, 0.99];

  assert.equal(
    getNextTickMsAfterApple(5, MIN_TICK_MS, () => fasterRolls.shift()),
    MIN_TICK_MS,
  );
  assert.equal(
    getNextTickMsAfterApple(5, MAX_TICK_MS, () => slowerRolls.shift()),
    MAX_TICK_MS,
  );
});

test("spawns worms only from level 10 onward at a 25 percent chance", () => {
  assert.equal(shouldSpawnWormAfterApple(9, () => 0), false);
  assert.equal(shouldSpawnWormAfterApple(10, () => 0.24), true);
  assert.equal(shouldSpawnWormAfterApple(10, () => 0.25), false);
});

test("spawns bombs only from level 10 onward at a 25 percent chance", () => {
  assert.equal(shouldSpawnBombAfterApple(9, () => 0), false);
  assert.equal(shouldSpawnBombAfterApple(10, () => 0.24), true);
  assert.equal(shouldSpawnBombAfterApple(10, () => 0.25), false);
});

test("blacks out the screen from level 15 onward", () => {
  assert.equal(shouldBlackoutAfterApple(14, () => 0), false);
  assert.equal(shouldBlackoutAfterApple(15, () => 0.24), true);
  assert.equal(shouldBlackoutAfterApple(15, () => 0.25), false);
});

test("drops turn inputs only from level 20 onward at a 25 percent chance", () => {
  assert.equal(shouldDropTurnInput(19, () => 0), false);
  assert.equal(shouldDropTurnInput(20, () => 0.24), true);
  assert.equal(shouldDropTurnInput(20, () => 0.25), false);
});

test("reverses snakes only from level 25 onward at a 25 percent chance", () => {
  assert.equal(shouldReverseSnakeAfterApple(24, () => 0), false);
  assert.equal(shouldReverseSnakeAfterApple(25, () => 0.24), true);
  assert.equal(shouldReverseSnakeAfterApple(25, () => 0.25), false);
});

test("sizes level boards to the smallest balanced playable grid", () => {
  assert.deepEqual(getLevelBoardSize(1), { width: 9, height: 9 });
  assert.deepEqual(getLevelBoardSize(6), { width: 9, height: 9 });
  assert.deepEqual(getLevelBoardSize(7), { width: 11, height: 11 });
  assert.deepEqual(getLevelBoardSize(10), { width: 11, height: 11 });
  assert.deepEqual(getLevelBoardSize(30), { width: 21, height: 28 });
});

test("advances levels when the apple target is met", () => {
  assert.deepEqual(getNextLevelProgress(3, 2), {
    level: 4,
    applesInLevel: 0,
    advanced: true,
    completedAllLevels: false,
  });
  assert.deepEqual(getNextLevelProgress(3, 1), {
    level: 3,
    applesInLevel: 2,
    advanced: false,
    completedAllLevels: false,
  });
});

test("caps progression after level 30 is cleared", () => {
  assert.deepEqual(getNextLevelProgress(30, 29), {
    level: 30,
    applesInLevel: 30,
    advanced: false,
    completedAllLevels: true,
  });
});

test("suppresses time rewards for fast early failed runs", () => {
  const scoreBreakdown = getSpeedrunScoreBreakdown({
    runTimeSeconds: 30,
    levelsCompleted: 0,
    currentLevelApplesCollected: 1,
    progressPercent: 1 / 465,
    completed: false,
    maxSnakeLength: 4,
    startingSnakeLength: 3,
    powerUpsConsumed: 0,
  });

  assert.equal(scoreBreakdown.progressScore, 100);
  assert.ok(scoreBreakdown.adjustedTimeBonus < 5);
  assert.ok(scoreBreakdown.finalScore < 150);
});

test("scores deep failed runs above shallow fast failed runs", () => {
  const earlyFailedRun = getSpeedrunScoreBreakdown({
    runTimeSeconds: 30,
    levelsCompleted: 0,
    currentLevelApplesCollected: 1,
    progressPercent: 1 / 465,
    completed: false,
    maxSnakeLength: 4,
    startingSnakeLength: 3,
    powerUpsConsumed: 0,
  });
  const deepFailedRun = getSpeedrunScoreBreakdown({
    runTimeSeconds: 900,
    levelsCompleted: 19,
    currentLevelApplesCollected: 10,
    progressPercent: 200 / 465,
    completed: false,
    maxSnakeLength: 200,
    startingSnakeLength: 3,
    powerUpsConsumed: 10,
  });

  assert.ok(deepFailedRun.progressScore > earlyFailedRun.progressScore);
  assert.ok(deepFailedRun.finalScore > earlyFailedRun.finalScore);
});

test("keeps time dominant for completed runs while bonuses stay secondary", () => {
  const fastCompletedRun = getSpeedrunScoreBreakdown({
    runTimeSeconds: 700,
    levelsCompleted: 30,
    currentLevelApplesCollected: 0,
    progressPercent: 1,
    completed: true,
    maxSnakeLength: 468,
    startingSnakeLength: 3,
    powerUpsConsumed: 5,
  });
  const slowerBonusHeavyCompletedRun = getSpeedrunScoreBreakdown({
    runTimeSeconds: 850,
    levelsCompleted: 30,
    currentLevelApplesCollected: 0,
    progressPercent: 1,
    completed: true,
    maxSnakeLength: 468,
    startingSnakeLength: 3,
    powerUpsConsumed: 100,
  });

  assert.equal(fastCompletedRun.progressScore, 30000);
  assert.equal(fastCompletedRun.completionBonus, 30000);
  assert.equal(fastCompletedRun.adjustedTimeBonus, 50000);
  assert.ok(fastCompletedRun.finalScore > slowerBonusHeavyCompletedRun.finalScore);
});

test("keeps completed runs clearly above nearly completed failed runs by default", () => {
  const slowCompletedRun = getSpeedrunScoreBreakdown({
    runTimeSeconds: 1300,
    levelsCompleted: 30,
    currentLevelApplesCollected: 0,
    progressPercent: 1,
    completed: true,
    maxSnakeLength: 468,
    startingSnakeLength: 3,
    powerUpsConsumed: 0,
  });
  const nearlyCompletedFailedRun = getSpeedrunScoreBreakdown({
    runTimeSeconds: 1000,
    levelsCompleted: 29,
    currentLevelApplesCollected: 29,
    progressPercent: 464 / 465,
    completed: false,
    maxSnakeLength: 467,
    startingSnakeLength: 3,
    powerUpsConsumed: 20,
  });

  assert.equal(slowCompletedRun.adjustedTimeBonus, 0);
  assert.ok(slowCompletedRun.finalScore > nearlyCompletedFailedRun.finalScore);
});
