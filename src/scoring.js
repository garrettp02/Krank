export const SPEEDRUN_SCORING = Object.freeze({
  parTimeSeconds: 1200,
  levelWeight: 1000,
  appleWeight: 100,
  completionBonus: 30000,
  timeWeight: 100,
  sizeWeight: 40,
  powerWeight: 75,
  failedBonusBaseMultiplier: 0.3,
  failedBonusProgressMultiplier: 0.7,
});

export function getSpeedrunScoreBreakdown({
  runTimeSeconds,
  levelsCompleted,
  currentLevelApplesCollected,
  progressPercent,
  completed,
  maxSnakeLength,
  startingSnakeLength,
  powerUpsConsumed,
  scoring = SPEEDRUN_SCORING,
}) {
  const normalizedProgress = clampProgress(progressPercent);
  const progressScore =
    Math.max(0, levelsCompleted) * scoring.levelWeight +
    Math.max(0, currentLevelApplesCollected) * scoring.appleWeight;
  const completionBonus = completed ? scoring.completionBonus : 0;
  const rawTimeBonus = Math.max(
    0,
    (scoring.parTimeSeconds - runTimeSeconds) * scoring.timeWeight,
  );
  const adjustedTimeBonus = completed
    ? rawTimeBonus
    : rawTimeBonus * normalizedProgress ** 2;
  const rawSizeBonus = Math.max(
    0,
    (maxSnakeLength - startingSnakeLength) * scoring.sizeWeight,
  );
  const rawPowerBonus = Math.max(0, powerUpsConsumed * scoring.powerWeight);
  const failedBonusMultiplier =
    scoring.failedBonusBaseMultiplier +
    scoring.failedBonusProgressMultiplier * normalizedProgress;
  const adjustedSizeBonus = completed
    ? rawSizeBonus
    : rawSizeBonus * failedBonusMultiplier;
  const adjustedPowerBonus = completed
    ? rawPowerBonus
    : rawPowerBonus * failedBonusMultiplier;
  const finalScore =
    progressScore +
    completionBonus +
    adjustedTimeBonus +
    adjustedSizeBonus +
    adjustedPowerBonus;

  return {
    progressScore: Math.round(progressScore),
    completionBonus: Math.round(completionBonus),
    rawTimeBonus: Math.round(rawTimeBonus),
    adjustedTimeBonus: Math.round(adjustedTimeBonus),
    rawSizeBonus: Math.round(rawSizeBonus),
    adjustedSizeBonus: Math.round(adjustedSizeBonus),
    rawPowerBonus: Math.round(rawPowerBonus),
    adjustedPowerBonus: Math.round(adjustedPowerBonus),
    finalScore: Math.round(finalScore),
    progressPercent: normalizedProgress,
  };
}

function clampProgress(progressPercent) {
  return Math.min(1, Math.max(0, progressPercent));
}
