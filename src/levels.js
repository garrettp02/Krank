export const MIN_LEVEL = 1;
export const MAX_LEVEL = 30;
export const MIN_BOARD_SIZE = 9;
export const LEVEL_7_BOARD_SIZE = 11;
export const STARTING_SNAKE_LENGTH = 3;
export const BASE_TICK_MS = 210;
export const SPEED_CHANGE_START_LEVEL = 5;
export const SPEED_CHANGE_CHANCE = 0.5;
export const SPEED_CHANGE_RATE = 0.1;
export const MIN_TICK_MS = 80;
export const MAX_TICK_MS = 350;
export const WORM_START_LEVEL = 10;
export const WORM_SPAWN_CHANCE = 0.25;
export const BOMB_START_LEVEL = 10;
export const BOMB_SPAWN_CHANCE = 0.25;
export const BLACKOUT_START_LEVEL = 15;
export const BLACKOUT_CHANCE = 0.25;
export const INPUT_DROP_START_LEVEL = 20;
export const INPUT_DROP_CHANCE = 0.25;
export const REVERSAL_START_LEVEL = 25;
export const REVERSAL_CHANCE = 0.25;

export const BOARD_SCALE_PROFILES = {
  veryHard: {
    maxFill: 0.88,
    spareCellMultiplier: 0.75,
    minSpareCells: 2,
  },
  balanced: {
    maxFill: 0.8,
    spareCellMultiplier: 1,
    minSpareCells: 2,
  },
  slightlyForgiving: {
    maxFill: 0.7,
    spareCellMultiplier: 1.4,
    minSpareCells: 3,
  },
};

export const DEFAULT_BOARD_SCALE_PROFILE = "balanced";

export function getLevelTarget(level) {
  return clampLevel(level);
}

export function getTotalRunApples() {
  return (MAX_LEVEL * (MAX_LEVEL + 1)) / 2;
}

export function getApplesBeforeLevel(level) {
  const completedLevels = clampLevel(level) - 1;

  return (completedLevels * (completedLevels + 1)) / 2;
}

export function getAppleBatchSize(level, applesRemaining, rng = Math.random) {
  if (applesRemaining <= 0) {
    return 0;
  }

  const maxLevelBatch = Math.max(1, Math.floor(getLevelTarget(level) / 2));
  const maxBatch = Math.max(1, Math.min(applesRemaining, maxLevelBatch));

  return Math.floor(rng() * maxBatch) + 1;
}

export function getNextTickMsAfterApple(level, currentTickMs, rng = Math.random) {
  if (clampLevel(level) < SPEED_CHANGE_START_LEVEL) {
    return currentTickMs;
  }

  if (rng() >= SPEED_CHANGE_CHANCE) {
    return currentTickMs;
  }

  const multiplier = rng() < 0.5
    ? 1 - SPEED_CHANGE_RATE
    : 1 + SPEED_CHANGE_RATE;

  return clampTickMs(Math.round(currentTickMs * multiplier));
}

export function shouldSpawnWormAfterApple(level, rng = Math.random) {
  return clampLevel(level) >= WORM_START_LEVEL && rng() < WORM_SPAWN_CHANCE;
}

export function shouldSpawnBombAfterApple(level, rng = Math.random) {
  return clampLevel(level) >= BOMB_START_LEVEL && rng() < BOMB_SPAWN_CHANCE;
}

export function shouldBlackoutAfterApple(level, rng = Math.random) {
  return clampLevel(level) >= BLACKOUT_START_LEVEL && rng() < BLACKOUT_CHANCE;
}

export function shouldDropTurnInput(level, rng = Math.random) {
  return clampLevel(level) >= INPUT_DROP_START_LEVEL && rng() < INPUT_DROP_CHANCE;
}

export function shouldReverseSnakeAfterApple(level, rng = Math.random) {
  return clampLevel(level) >= REVERSAL_START_LEVEL && rng() < REVERSAL_CHANCE;
}

export function getLevelBoardSize(
  level,
  profileName = DEFAULT_BOARD_SCALE_PROFILE,
) {
  const finalSnakeLength = getSnakeLengthAtLevelEnd(level);
  const profile =
    BOARD_SCALE_PROFILES[profileName] ??
    BOARD_SCALE_PROFILES[DEFAULT_BOARD_SCALE_PROFILE];
  const spareCells = Math.max(
    profile.minSpareCells,
    Math.ceil(Math.sqrt(finalSnakeLength) * profile.spareCellMultiplier),
  );
  const requiredCells = Math.max(
    finalSnakeLength + spareCells,
    Math.ceil(finalSnakeLength / profile.maxFill),
  );

  return getSmallestNearSquareBoard(requiredCells, getMinimumBoardSize(level));
}

export function getSnakeLengthAtLevelEnd(level) {
  const currentLevel = clampLevel(level);
  const applesThroughLevel = (currentLevel * (currentLevel + 1)) / 2;

  return STARTING_SNAKE_LENGTH + applesThroughLevel;
}

export function getNextLevelProgress(level, applesInLevel) {
  const currentLevel = clampLevel(level);
  const nextApplesInLevel = applesInLevel + 1;

  if (currentLevel === MAX_LEVEL) {
    return {
      level: currentLevel,
      applesInLevel: Math.min(nextApplesInLevel, getLevelTarget(currentLevel)),
      advanced: false,
      completedAllLevels: nextApplesInLevel >= getLevelTarget(currentLevel),
    };
  }

  if (nextApplesInLevel >= getLevelTarget(currentLevel)) {
    return {
      level: currentLevel + 1,
      applesInLevel: 0,
      advanced: true,
      completedAllLevels: false,
    };
  }

  return {
    level: currentLevel,
    applesInLevel: nextApplesInLevel,
    advanced: false,
    completedAllLevels: false,
  };
}

export function clampLevel(level) {
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, level));
}

export function clampTickMs(tickMs) {
  return Math.min(MAX_TICK_MS, Math.max(MIN_TICK_MS, tickMs));
}

function getMinimumBoardSize(level) {
  return clampLevel(level) >= 7 ? LEVEL_7_BOARD_SIZE : MIN_BOARD_SIZE;
}

function getSmallestNearSquareBoard(requiredCells, minimumBoardSize) {
  let best = null;
  const largestCandidate = Math.max(minimumBoardSize, requiredCells);

  for (let width = minimumBoardSize; width <= largestCandidate; width += 1) {
    for (let height = minimumBoardSize; height <= largestCandidate; height += 1) {
      const area = width * height;
      const aspectRatio = Math.max(width, height) / Math.min(width, height);

      if (area < requiredCells || aspectRatio > 1.5) {
        continue;
      }

      if (
        !best ||
        area < best.width * best.height ||
        (area === best.width * best.height &&
          Math.abs(width - height) < Math.abs(best.width - best.height))
      ) {
        best = { width, height };
      }
    }
  }

  return best;
}
