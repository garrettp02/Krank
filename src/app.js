import {
  createInitialState,
  isCellInBombBlast,
  moveWorm,
  reverseSnake,
  spawnBomb,
  spawnFoods,
  spawnWorm,
  stepGame,
  turn,
} from "./snake.js?v=20260408-13";
import {
  BASE_TICK_MS,
  DEFAULT_BOARD_SCALE_PROFILE,
  MAX_LEVEL,
  STARTING_SNAKE_LENGTH,
  getAppleBatchSize,
  getApplesBeforeLevel,
  getLevelBoardSize,
  getLevelTarget,
  getNextLevelProgress,
  getNextTickMsAfterApple,
  getTotalRunApples,
  shouldBlackoutAfterApple,
  shouldDropTurnInput,
  shouldSpawnBombAfterApple,
  shouldReverseSnakeAfterApple,
  shouldSpawnWormAfterApple,
} from "./levels.js?v=20260408-13";
import { getSpeedrunScoreBreakdown } from "./scoring.js?v=20260408-13";

const { createClient } = window.supabase ?? {};
const SUPABASE_URL = "https://hulowkzbwfaejyldyjps.supabase.co";
const SUPABASE_KEY = "sb_publishable_aCPRF-d9aTOEnm2T6wYymQ_ag0vBYlx";
const supabaseClient =
  createClient &&
  SUPABASE_URL.startsWith("http") &&
  SUPABASE_KEY !== "YOUR_SUPABASE_PUBLISHABLE_KEY"
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

const keys = new Map([
  ["ArrowUp", "up"],
  ["w", "up"],
  ["W", "up"],
  ["ArrowDown", "down"],
  ["s", "down"],
  ["S", "down"],
  ["ArrowLeft", "left"],
  ["a", "left"],
  ["A", "left"],
  ["ArrowRight", "right"],
  ["d", "right"],
  ["D", "right"],
]);
const DEBUG_MODE_AVAILABLE = true;
const SNAKE_SHADE_BAND_COUNT = 20;
const SNAKE_SHADE_LEVEL_COUNT = 10;
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const BLACKOUT_DURATION_MS = 750;
const BLACKOUT_WARNING_DURATION_MS = 1500;
const BLACKOUT_WARNING_STEP_COUNT = 3;
const BLACKOUT_WARNING_UPDATE_MS = 50;
const BLACKOUT_WARNING_TEXT = "BLACKOUT IN";
const BLACKOUT_WARNING_CLASS = "blackout-warning";
const BLACKOUT_WARNING_TEXT_CLASS = "blackout-warning-text";
const BLACKOUT_WARNING_BOARD_CLASS = "is-blackout-warning";
const REVERSAL_WARNING_DURATION_MS = 2000;
const REVERSAL_WARNING_STEP_COUNT = 2;
const REVERSAL_WARNING_UPDATE_MS = 50;
const REVERSAL_WARNING_TEXT = "REVERSE IN";
const REVERSAL_WARNING_CLASS = "reversal-warning";
const REVERSAL_WARNING_TEXT_CLASS = "reversal-warning-text";
const REVERSAL_WARNING_BOARD_CLASS = "is-reversal-warning";
const LEVEL_CHANGE_POPUP_DURATION_MS = 2400;
const LEVEL_CHANGE_POPUP_CLASS = "level-change-popup";
const LEVEL_CHANGE_POPUP_CARD_CLASS = "level-change-card";
const LEVEL_CHANGE_POPUP_META_CLASS = "level-change-card__meta";
const LEVEL_CHANGE_POPUP_LABEL_CLASS = "level-change-card__label";
const LEVEL_CHANGE_POPUP_MESSAGE_CLASS = "level-change-card__message";
const LEVEL_CHANGE_POPUP_KEYWORD_CLASS = "level-change-card__keyword";
const LEVEL_CHANGE_POPUP_LETTER_CLASS = "level-change-card__letter";
const LEVEL_CHANGE_POPUP_FLICKER_LETTER_CLASS = "level-change-card__letter--flicker";
const LEVEL_CHANGE_POPUP_ACCENT_CLASS = "level-change-card__accent";
const LEVEL_CHANGE_POPUP_BADGE_CLASS = "level-change-card__badge";
const LEVEL_CHANGE_POPUP_PAUSED_CLASS = "is-paused";
const WORM_MOVE_INTERVAL_MS = 900;
const WORM_MOVE_DURATION_MS = 420;
const BOMB_TIMER_DURATION_MS = 3000;
const BOMB_BLAST_DURATION_MS = 1000;
const SWIPE_MIN_DISTANCE_PX = 24;
const SWIPE_DIRECTION_LOCK_RATIO = 1.15;
const LEVEL_CHANGE_POPUP_LEVELS = Object.freeze({
  1: Object.freeze({
    label: "LEVEL 1",
    theme: "classic",
    parts: [
      Object.freeze({ text: "Just Snake", keyword: true }),
    ],
  }),
  5: Object.freeze({
    label: "LEVEL 5",
    theme: "speed",
    parts: [
      Object.freeze({ text: "Watch Your " }),
      Object.freeze({ text: "Speed", keyword: true }),
    ],
  }),
  10: Object.freeze({
    label: "LEVEL 10",
    theme: "worm",
    parts: [
      Object.freeze({ text: "Worm's " }),
      Object.freeze({ text: "LOVE", keyword: true }),
      Object.freeze({ text: " Apples" }),
    ],
  }),
  15: Object.freeze({
    label: "LEVEL 15",
    theme: "outage",
    parts: [
      Object.freeze({ text: "Power Outages", keyword: true }),
      Object.freeze({ text: " Possible" }),
    ],
  }),
  20: Object.freeze({
    label: "LEVEL 20",
    theme: "keyboard",
    durationMs: 2400,
    parts: [
      Object.freeze({ text: "Faulty", keyword: true }),
      Object.freeze({ text: " Keyboard" }),
    ],
  }),
  25: Object.freeze({
    label: "LEVEL 25",
    theme: "wrong-way",
    durationMs: 2400,
    parts: [
      Object.freeze({ text: "Wrong Way", keyword: true }),
    ],
  }),
});
const LEVEL_SCROLLER_MILESTONE_LEVELS = Object.freeze(
  Object.keys(LEVEL_CHANGE_POPUP_LEVELS)
    .map(Number)
    .filter((level) => level > 1),
);
const scoreFormatter = new Intl.NumberFormat("en-US");

const board = document.querySelector("#board");
const boardRocks = document.querySelector(".board-rocks");
const currentLevelText = document.querySelector("#current-level");
const score = document.querySelector("#score");
const levelApples = document.querySelector("#level-apples");
const levelTarget = document.querySelector("#level-target");
const speed = document.querySelector("#speed");
const timer = document.querySelector("#timer");
const levelTimer = document.querySelector("#level-timer");
const levelPanel = document.querySelector(".level-panel");
const levelList = document.querySelector("#level-list");
const status = document.querySelector("#status");
const restart = document.querySelector("#restart");
const pause = document.querySelector("#pause");
const winScreen = document.querySelector("#win-screen");
const winScore = document.querySelector("#win-score");
const winTime = document.querySelector("#win-time");
const winResult = document.querySelector("#win-result");
const winFurthestLevel = document.querySelector("#win-furthest-level");
const winProgressScore = document.querySelector("#win-progress-score");
const winCompletionBonus = document.querySelector("#win-completion-bonus");
const winTimeBonus = document.querySelector("#win-time-bonus");
const winSizeBonus = document.querySelector("#win-size-bonus");
const winPowerBonus = document.querySelector("#win-power-bonus");
const winMaxLength = document.querySelector("#win-max-length");
const winPowerUps = document.querySelector("#win-power-ups");
const winRestart = document.querySelector("#win-restart");
const lossScreen = document.querySelector("#loss-screen");
const lossScore = document.querySelector("#loss-score");
const lossTime = document.querySelector("#loss-time");
const lossResult = document.querySelector("#loss-result");
const lossFurthestLevel = document.querySelector("#loss-furthest-level");
const lossProgressScore = document.querySelector("#loss-progress-score");
const lossCompletionBonus = document.querySelector("#loss-completion-bonus");
const lossTimeBonus = document.querySelector("#loss-time-bonus");
const lossSizeBonus = document.querySelector("#loss-size-bonus");
const lossPowerBonus = document.querySelector("#loss-power-bonus");
const lossMaxLength = document.querySelector("#loss-max-length");
const lossPowerUps = document.querySelector("#loss-power-ups");
const lossRestart = document.querySelector("#loss-restart");
const leaderboardSubmitScreen = document.querySelector("#leaderboard-submit-screen");
const leaderboardNameInput = document.querySelector("#leaderboard-name-input");
const leaderboardSubmitButton = document.querySelector("#leaderboard-submit-button");
const leaderboardSkipButton = document.querySelector("#leaderboard-skip-button");
const topBar = document.querySelector(".top-bar");
const actions = document.querySelector(".actions");
const gameTabButton = document.querySelector("#game-tab-button");
const leaderboardTabButton = document.querySelector("#leaderboard-tab-button");
const gamePanel = document.querySelector("#game-panel");
const leaderboardPanel = document.querySelector("#leaderboard-panel");
const leaderboardList = document.querySelector("#leaderboard-list");

let currentLevel = 1;
let state = createLevelState(currentLevel);
let requestedDirection = state.direction;
let paused = false;
let hasStarted = false;
let applesInLevel = 0;
let maxSnakeLengthReached = state.snake.length;
let powerUpsConsumed = 0;
let completedAllLevels = false;
let lastScrolledLevel = null;
let tickMs = BASE_TICK_MS;
let tickTimerId = null;
let debugMode = false;
let reversalPauseActive = false;
let reversalTimerId = null;
let reversalWarningTickTimerId = null;
let reversalWarningEndsAt = null;
let reversalWarningRemainingMs = 0;
let levelChangePopupTimerId = null;
let levelChangePopupEndsAt = null;
let levelChangePopupRemainingMs = 0;
let runStartedAt = null;
let runEndedAt = null;
let levelStartedAt = null;
let levelSplits = [];
let clockTimerId = null;
let currentCellSize = 24;
let missedInputUntil = 0;
let missedInputFlashTimerId = null;
let blackoutTimerId = null;
let blackoutWarningTimerId = null;
let blackoutWarningTickTimerId = null;
let blackoutWarningEndsAt = null;
let blackoutWarningRemainingMs = 0;
let bombDetonatesAt = null;
let bombRemainingMs = BOMB_TIMER_DURATION_MS;
let bombBlastCells = [];
let bombBlastOrigin = null;
let bombBlastTimerId = null;
let bombBlastEndsAt = null;
let wormMoveDueAt = null;
let wormMoveRemainingMs = WORM_MOVE_INTERVAL_MS;
let snakeBodyAnimation = null;
let snakeBodyAnimationFrameId = null;
let swipeStartPoint = null;
let swipeTrackingId = null;
let leaderboardHandledForGameOver = false;
let resizeRenderFrameId = null;
let lastLevelAdvanceAt = 0;

function getViewportDimensions() {
  const viewport = window.visualViewport;

  if (viewport && viewport.width > 0 && viewport.height > 0) {
    return {
      width: viewport.width,
      height: viewport.height,
    };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function scheduleViewportRender() {
  if (resizeRenderFrameId) {
    cancelAnimationFrame(resizeRenderFrameId);
  }

  resizeRenderFrameId = requestAnimationFrame(() => {
    resizeRenderFrameId = null;
    render();
  });
}

function render() {
  board.style.setProperty("--grid-width", state.width);
  board.style.setProperty("--grid-height", state.height);
  board.style.setProperty("--move-ms", `${Math.max(60, tickMs - 25)}ms`);
  board.style.setProperty("--worm-move-ms", `${WORM_MOVE_DURATION_MS}ms`);

  const scoreBreakdown = getCurrentScoreBreakdown();

  currentLevelText.textContent = String(currentLevel);
  score.textContent = formatScore(scoreBreakdown.finalScore);
  levelApples.textContent = String(applesInLevel);
  levelTarget.textContent = String(getLevelTarget(currentLevel));
  speed.textContent = `${(BASE_TICK_MS / tickMs).toFixed(2)}x`;
  updateClockDisplay();
  pause.textContent = paused ? "Resume" : "Pause";
  renderLevels();
  renderWinScreen();
  renderLossScreen();

  if (state.gameOver) {
    status.textContent = state.lastEvent === "bomb"
      ? "Bomb hit. Press Restart or Enter to play again."
      : "Game over. Press Restart or Enter to play again.";
  } else if (completedAllLevels) {
    status.textContent = "You won.";
  } else if (reversalPauseActive) {
    status.textContent = getReversalWarningText();
  } else if (isBlackoutWarningActive()) {
    status.textContent = getBlackoutWarningText();
  } else if (debugMode) {
    status.textContent = "Debug mode: N advances a level. G completes the game. B tests blackout.";
  } else if (missedInputUntil > performance.now()) {
    status.textContent = "Turn missed.";
  } else if (paused) {
    status.textContent = "Paused.";
  } else if (!hasStarted) {
    status.textContent = "Use arrow keys or WASD to start.";
  } else {
    status.textContent = `${getLevelTarget(currentLevel) - applesInLevel} apple${
      getLevelTarget(currentLevel) - applesInLevel === 1 ? "" : "s"
    } to the next level.`;
  }

  updateBoardViewportSize();
  updateSnakeColor();
  renderSnake();
  renderFood();
  renderWorm();
  renderBomb();
  renderBombBlast();
  document.body.classList.toggle("bombed", state.gameOver && state.lastEvent === "bomb");
}

function renderSnake() {
  renderSnakeBody();

  const pieces = [...board.querySelectorAll(".snake-piece")];
  const endpointCount = state.snake.length > 0 ? 1 : 0;

  while (pieces.length < endpointCount) {
    const piece = document.createElement("div");
    piece.className = "snake-piece";
    piece.setAttribute("aria-hidden", "true");
    piece.append(createSnakeSprite());
    board.append(piece);
    pieces.push(piece);
  }

  while (pieces.length > endpointCount) {
    pieces.pop().remove();
  }

  renderSnakeEndpoint(pieces[0], state.snake[0], "head", state.direction);
}

function renderSnakeEndpoint(piece, segment, role, orientation) {
  if (!piece || !segment) {
    return;
  }

  if (!piece.querySelector(".snake-sprite")) {
    piece.append(createSnakeSprite());
  }

  piece.className = `snake-piece snake-endpoint snake-${role} snake-${orientation}`;
  setCellPosition(piece, segment);
}

function createSnakeSprite() {
  const sprite = document.createElement("span");
  sprite.className = "snake-sprite";
  applyRandomSnakeShadeBands(sprite);
  return sprite;
}

function applyRandomSnakeShadeBands(sprite) {
  const shadeLevels = Array.from({ length: SNAKE_SHADE_BAND_COUNT }, () =>
    getRandomShadeLevel(),
  );
  const bandWidth = 100 / SNAKE_SHADE_BAND_COUNT;
  const shadeStops = shadeLevels
    .map((level, index) => {
      const start = (index * bandWidth).toFixed(2);
      const end = ((index + 1) * bandWidth).toFixed(2);
      return `${getSnakeShadeColor(level)} ${start}% ${end}%`;
    })
    .join(", ");

  sprite.dataset.shadeLevels = shadeLevels.join(",");
  sprite.style.setProperty("--snake-shade-bands", shadeStops);
  sprite.style.setProperty("--snake-shade-map", getRandomSnakeShadeMap());
  sprite.style.setProperty("--snake-scales", getRandomSnakeScaleMap());
}

function getRandomShadeLevel() {
  return Math.floor(Math.random() * SNAKE_SHADE_LEVEL_COUNT) + 1;
}

function getSnakeShadeColor(level) {
  const lightnessOffset = Math.round((level - 5.5) * 2);
  const offsetExpression =
    lightnessOffset >= 0
      ? `+ ${lightnessOffset}%`
      : `- ${Math.abs(lightnessOffset)}%`;

  return `hsl(var(--snake-hue-local) var(--snake-saturation, 72%) calc(var(--snake-body-lightness) ${offsetExpression}))`;
}

function getRandomSnakeShadeMap() {
  const glowX = getRandomPercent(18, 82);
  const glowY = getRandomPercent(18, 82);
  const shadowX = getRandomPercent(18, 82);
  const shadowY = getRandomPercent(18, 82);

  return [
    `radial-gradient(ellipse at ${glowX}% ${glowY}%, ${getSnakeShadeColor(getRandomInt(7, 10))} 0 16%, transparent 42%)`,
    `radial-gradient(ellipse at ${shadowX}% ${shadowY}%, ${getSnakeShadeColor(getRandomInt(1, 4))} 0 14%, transparent 40%)`,
  ].join(", ");
}

function getRandomSnakeScaleMap() {
  return Array.from({ length: 5 }, (_, index) => {
    const width = getRandomInt(9, 15);
    const height = getRandomInt(5, 9);
    const x = getRandomPercent(14, 86);
    const y = getRandomPercent(24, 76);
    const color =
      index % 2 === 0 ? "var(--snake-scale-light)" : "var(--snake-scale-shadow)";

    return `radial-gradient(ellipse ${width}% ${height}% at ${x}% ${y}%, ${color} 0 36%, transparent 39%)`;
  }).join(", ");
}

function getRandomPercent(min, max) {
  return getRandomInt(min, max);
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function renderSnakeBody(now = performance.now()) {
  const {
    svg,
    paths,
    bodyMask,
    scaleFill,
    scalePattern,
    shadeFill,
    shadePattern,
  } = getSnakeBodySvg();
  const width = state.width * currentCellSize;
  const height = state.height * currentCellSize;
  const snakeFrame = getSnakeBodyFrame(now);
  const bodyPath = getSnakeBodyPath(snakeFrame);
  const textureAnchor = getSnakeTextureAnchor(snakeFrame);

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));

  for (const path of paths) {
    path.setAttribute("d", bodyPath);
  }

  bodyMask.setAttribute("d", bodyPath);
  scaleFill.setAttribute("width", String(width));
  scaleFill.setAttribute("height", String(height));
  shadeFill.setAttribute("width", String(width));
  shadeFill.setAttribute("height", String(height));
  scalePattern.setAttribute("width", String(currentCellSize * 0.7));
  scalePattern.setAttribute("height", String(currentCellSize * 0.45));
  shadePattern.setAttribute("width", String(currentCellSize * 1.45));
  shadePattern.setAttribute("height", String(currentCellSize * 0.95));
  scalePattern.setAttribute(
    "patternTransform",
    `translate(${textureAnchor.x} ${textureAnchor.y})`,
  );
  shadePattern.setAttribute(
    "patternTransform",
    `translate(${textureAnchor.x} ${textureAnchor.y})`,
  );
}

function getSnakeBodySvg() {
  let svg = board.querySelector(".snake-body-svg");

  if (svg && !svg.querySelector(".snake-body-shade-fill")) {
    svg.remove();
    svg = null;
  }

  if (!svg) {
    svg = document.createElementNS(SVG_NAMESPACE, "svg");
    svg.classList.add("snake-body-svg");
    svg.setAttribute("aria-hidden", "true");
    svg.append(createSnakeBodyPatternDefs());

    for (const className of [
      "snake-body-outline",
      "snake-body-core",
    ]) {
      const path = document.createElementNS(SVG_NAMESPACE, "path");
      path.classList.add(className);
      svg.append(path);
    }

    const shadeFill = document.createElementNS(SVG_NAMESPACE, "rect");
    shadeFill.classList.add("snake-body-shade-fill");
    shadeFill.setAttribute("fill", "url(#snake-body-shade-pattern)");
    shadeFill.setAttribute("mask", "url(#snake-body-mask)");
    svg.append(shadeFill);

    const scaleFill = document.createElementNS(SVG_NAMESPACE, "rect");
    scaleFill.classList.add("snake-body-scale-fill");
    scaleFill.setAttribute("fill", "url(#snake-scale-pattern)");
    scaleFill.setAttribute("mask", "url(#snake-body-mask)");
    svg.append(scaleFill);

    board.prepend(svg);
  }

  return {
    svg,
    paths: [...svg.querySelectorAll(".snake-body-outline, .snake-body-core")],
    bodyMask: svg.querySelector(".snake-body-mask"),
    scaleFill: svg.querySelector(".snake-body-scale-fill"),
    scalePattern: svg.querySelector("#snake-scale-pattern"),
    shadeFill: svg.querySelector(".snake-body-shade-fill"),
    shadePattern: svg.querySelector("#snake-body-shade-pattern"),
  };
}

function createSnakeBodyPatternDefs() {
  const defs = document.createElementNS(SVG_NAMESPACE, "defs");
  const pattern = document.createElementNS(SVG_NAMESPACE, "pattern");
  const shadePattern = document.createElementNS(SVG_NAMESPACE, "pattern");
  const mask = document.createElementNS(SVG_NAMESPACE, "mask");
  const maskPath = document.createElementNS(SVG_NAMESPACE, "path");

  pattern.id = "snake-scale-pattern";
  pattern.setAttribute("patternUnits", "userSpaceOnUse");
  pattern.setAttribute("viewBox", "0 0 24 16");

  for (const scale of [
    { x: 6, y: 5, rotate: -10 },
    { x: 18, y: 12, rotate: -10 },
  ]) {
    const mark = document.createElementNS(SVG_NAMESPACE, "path");
    mark.classList.add("snake-scale-mark");
    mark.setAttribute(
      "d",
      "M 1 8 C 3.5 2.5 8.5 2.5 11 8 C 8 6.2 4 6.2 1 8 Z",
    );
    mark.setAttribute(
      "transform",
      `translate(${scale.x - 6} ${scale.y - 8}) rotate(${scale.rotate} 6 8)`,
    );
    pattern.append(mark);
  }

  shadePattern.id = "snake-body-shade-pattern";
  shadePattern.setAttribute("patternUnits", "userSpaceOnUse");
  shadePattern.setAttribute("viewBox", "0 0 48 30");

  for (const shade of [
    { className: "snake-shade-light", cx: 8, cy: 8, rx: 9, ry: 4, rotate: -18 },
    { className: "snake-shade-dark", cx: 23, cy: 20, rx: 11, ry: 4.5, rotate: 12 },
    { className: "snake-shade-mid", cx: 34, cy: 7, rx: 7, ry: 3, rotate: -10 },
    { className: "snake-shade-light", cx: 44, cy: 21, rx: 6, ry: 2.8, rotate: 16 },
    { className: "snake-shade-dark", cx: 15, cy: 26, rx: 5, ry: 2.4, rotate: -8 },
  ]) {
    const mark = document.createElementNS(SVG_NAMESPACE, "ellipse");
    mark.classList.add("snake-shade-mark", shade.className);
    mark.setAttribute("cx", String(shade.cx));
    mark.setAttribute("cy", String(shade.cy));
    mark.setAttribute("rx", String(shade.rx));
    mark.setAttribute("ry", String(shade.ry));
    mark.setAttribute("transform", `rotate(${shade.rotate} ${shade.cx} ${shade.cy})`);
    shadePattern.append(mark);
  }

  mask.id = "snake-body-mask";
  mask.setAttribute("maskUnits", "userSpaceOnUse");
  mask.setAttribute("x", "-50%");
  mask.setAttribute("y", "-50%");
  mask.setAttribute("width", "200%");
  mask.setAttribute("height", "200%");
  maskPath.classList.add("snake-body-mask");
  mask.append(maskPath);
  defs.append(pattern, shadePattern, mask);

  return defs;
}

function getSnakeBodyFrame(now) {
  if (!snakeBodyAnimation) {
    return state.snake;
  }

  const progress = Math.min(
    1,
    (now - snakeBodyAnimation.startedAt) / snakeBodyAnimation.durationMs,
  );

  if (progress >= 1) {
    snakeBodyAnimation = null;
    return state.snake;
  }

  return interpolateSnakeFrames(
    snakeBodyAnimation.from,
    snakeBodyAnimation.to,
    progress,
  );
}

function startSnakeBodyAnimation(fromSnake, toSnake) {
  cancelSnakeBodyAnimation();

  snakeBodyAnimation = {
    from: getAlignedSnakeAnimationFrame(fromSnake, toSnake),
    to: cloneSnake(toSnake),
    startedAt: performance.now(),
    durationMs: Math.max(60, tickMs - 25),
  };
  snakeBodyAnimationFrameId = requestAnimationFrame(animateSnakeBody);
}

function animateSnakeBody(now) {
  renderSnakeBody(now);

  if (snakeBodyAnimation) {
    snakeBodyAnimationFrameId = requestAnimationFrame(animateSnakeBody);
    return;
  }

  snakeBodyAnimationFrameId = null;
}

function cancelSnakeBodyAnimation() {
  if (snakeBodyAnimationFrameId) {
    cancelAnimationFrame(snakeBodyAnimationFrameId);
    snakeBodyAnimationFrameId = null;
  }

  snakeBodyAnimation = null;
}

function getAlignedSnakeAnimationFrame(fromSnake, toSnake) {
  if (
    toSnake.length === fromSnake.length + 1 &&
    sameGridCell(toSnake[1], fromSnake[0])
  ) {
    return cloneSnake([fromSnake[0], ...fromSnake]);
  }

  if (toSnake.length === fromSnake.length) {
    return cloneSnake(fromSnake);
  }

  return toSnake.map((_, index) => ({
    ...(fromSnake[Math.min(index, fromSnake.length - 1)] ?? toSnake[index]),
  }));
}

function interpolateSnakeFrames(fromSnake, toSnake, progress) {
  return toSnake.map((toCell, index) => {
    const fromCell = fromSnake[index] ?? toCell;

    return {
      x: fromCell.x + (toCell.x - fromCell.x) * progress,
      y: fromCell.y + (toCell.y - fromCell.y) * progress,
    };
  });
}

function getSnakeBodyPath(snake) {
  const points = snake
    .map(getCellCenterPoint)
    .filter((point, index, allPoints) => (
      index === 0 || !samePoint(point, allPoints[index - 1])
    ));

  if (points.length === 0) {
    return "";
  }

  if (points.length < 3) {
    return points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
  }

  const smoothness = 0.35;
  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const beforePoint = {
      x: current.x - (current.x - previous.x) * smoothness,
      y: current.y - (current.y - previous.y) * smoothness,
    };
    const afterPoint = {
      x: current.x + (next.x - current.x) * smoothness,
      y: current.y + (next.y - current.y) * smoothness,
    };

    path += ` L ${beforePoint.x} ${beforePoint.y} Q ${current.x} ${current.y} ${afterPoint.x} ${afterPoint.y}`;
  }

  const tail = points[points.length - 1];
  path += ` L ${tail.x} ${tail.y}`;
  return path;
}

function getCellCenterPoint(cell) {
  return {
    x: (cell.x + 0.5) * currentCellSize,
    y: (cell.y + 0.5) * currentCellSize,
  };
}

function getSnakeTextureAnchor(snake) {
  if (!snake[0]) {
    return { x: 0, y: 0 };
  }

  return getCellCenterPoint(snake[0]);
}

function samePoint(a, b) {
  return Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001;
}

function sameGridCell(a, b) {
  return Boolean(a && b && a.x === b.x && a.y === b.y);
}

function cloneSnake(snake) {
  return snake.map((cell) => ({ ...cell }));
}

function renderFood() {
  const foods = state.foods ?? [];
  const foodElements = [...board.querySelectorAll(".food")];

  while (foodElements.length < foods.length) {
    const foodElement = document.createElement("div");
    foodElement.className = "food";
    foodElement.setAttribute("aria-hidden", "true");
    board.append(foodElement);
    foodElements.push(foodElement);
  }

  while (foodElements.length > foods.length) {
    foodElements.pop().remove();
  }

  foods.forEach((food, index) => {
    const foodElement = foodElements[index];
    setCellPosition(foodElement, food);
  });
}

function renderWorm() {
  const existingWorm = board.querySelector(".worm");

  if (!state.worm) {
    existingWorm?.remove();
    return;
  }

  const wormElement = existingWorm ?? document.createElement("div");
  wormElement.className = "worm";
  wormElement.setAttribute("aria-hidden", "true");
  setCellPosition(wormElement, state.worm);

  if (!existingWorm) {
    board.append(wormElement);
  }
}

function renderBomb() {
  const existingBomb = board.querySelector(".bomb");

  if (!state.bomb) {
    existingBomb?.remove();
    return;
  }

  const bombElement = existingBomb ?? document.createElement("div");
  const countdownElement =
    bombElement.querySelector(".bomb-countdown") ?? document.createElement("span");
  bombElement.className = "bomb";
  bombElement.setAttribute("aria-hidden", "true");
  bombElement.classList.toggle("is-critical", getBombRemainingMs() <= 1000);
  setCellPosition(bombElement, state.bomb);
  countdownElement.className = "bomb-countdown";
  countdownElement.textContent = String(getBombCountdownValue());

  if (!countdownElement.parentElement) {
    bombElement.append(countdownElement);
  }

  if (!existingBomb) {
    board.append(bombElement);
  }
}

function armBombTimer(durationMs = BOMB_TIMER_DURATION_MS, now = performance.now()) {
  if (!state.bomb) {
    return;
  }

  bombRemainingMs = durationMs;
  bombDetonatesAt = now + durationMs;
}

function pauseBombTimer(now = performance.now()) {
  if (!state.bomb || bombDetonatesAt === null) {
    return;
  }

  bombRemainingMs = Math.max(0, bombDetonatesAt - now);
  bombDetonatesAt = null;
}

function resumeBombTimer(now = performance.now()) {
  if (!state.bomb || bombDetonatesAt !== null) {
    return;
  }

  bombDetonatesAt = now + bombRemainingMs;
}

function clearBombTimer() {
  bombDetonatesAt = null;
  bombRemainingMs = BOMB_TIMER_DURATION_MS;
}

function showBombBlast(bombCell, durationMs = BOMB_BLAST_DURATION_MS) {
  clearBombBlast();
  bombBlastOrigin = bombCell;
  bombBlastCells = getBombBlastCells(bombCell);
  bombBlastEndsAt = performance.now() + durationMs;
  bombBlastTimerId = setTimeout(() => {
    clearBombBlast();
    render();
  }, durationMs);
}

function clearBombBlast() {
  clearTimeout(bombBlastTimerId);
  bombBlastCells = [];
  bombBlastOrigin = null;
  bombBlastTimerId = null;
  bombBlastEndsAt = null;
  board.querySelectorAll(".bomb-blast-cell").forEach((cell) => cell.remove());
}

function isBombBlastActive(now = performance.now()) {
  return (
    bombBlastEndsAt !== null &&
    bombBlastEndsAt > now &&
    bombBlastCells.length > 0
  );
}

function getBombBlastCells(bombCell) {
  if (!bombCell) {
    return [];
  }

  const cells = [];

  for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
    for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
      const cell = {
        x: bombCell.x + xOffset,
        y: bombCell.y + yOffset,
      };

      if (
        cell.x >= 0 &&
        cell.x < state.width &&
        cell.y >= 0 &&
        cell.y < state.height
      ) {
        cells.push(cell);
      }
    }
  }

  return cells;
}

function getBombRemainingMs(now = performance.now()) {
  if (!state.bomb) {
    return 0;
  }

  if (bombDetonatesAt === null) {
    return bombRemainingMs;
  }

  return Math.max(0, bombDetonatesAt - now);
}

function getBombCountdownValue(now = performance.now()) {
  return Math.max(1, Math.ceil(getBombRemainingMs(now) / 1000));
}

function detonateBombIfNeeded(now = performance.now()) {
  if (!state.bomb) {
    clearBombTimer();
    return false;
  }

  if (bombDetonatesAt === null || now < bombDetonatesAt) {
    return false;
  }

  const hitByBlast = isCellInBombBlast(state.snake[0], state.bomb);
  const bombCell = state.bomb;

  state = {
    ...state,
    bomb: null,
    gameOver: hitByBlast ? true : state.gameOver,
    lastEvent: hitByBlast ? "bomb" : state.lastEvent,
  };
  clearBombTimer();
  showBombBlast(bombCell);

  if (!hitByBlast) {
    return false;
  }

  stopRunClock();
  clearReversalPause();
  clearBlackout();
  clearLevelChangePopup();
  cancelSnakeBodyAnimation();
  return true;
}

function renderBombBlast() {
  const blastCells = [...board.querySelectorAll(".bomb-blast-cell")];

  while (blastCells.length < bombBlastCells.length) {
    const blastCell = document.createElement("div");

    blastCell.className = "bomb-blast-cell";
    blastCell.setAttribute("aria-hidden", "true");
    board.append(blastCell);
    blastCells.push(blastCell);
  }

  while (blastCells.length > bombBlastCells.length) {
    blastCells.pop().remove();
  }

  bombBlastCells.forEach((cell, index) => {
    const blastCell = blastCells[index];
    blastCell.classList.toggle(
      "is-center",
      cell.x === bombBlastOrigin?.x && cell.y === bombBlastOrigin?.y,
    );
    setCellPosition(blastCell, cell);
  });
}

function updateBoardViewportSize() {
  const viewport = getViewportDimensions();
  const boardStyles = window.getComputedStyle(board);
  const boardRocksStyles = window.getComputedStyle(boardRocks);
  const boardBorderWidth =
    parseFloat(boardStyles.borderLeftWidth) +
    parseFloat(boardStyles.borderRightWidth);
  const boardFrameWidth =
    parseFloat(boardRocksStyles.paddingLeft) +
    parseFloat(boardRocksStyles.paddingRight) +
    parseFloat(boardRocksStyles.borderLeftWidth) +
    parseFloat(boardRocksStyles.borderRightWidth);
  const boardFrameHeight =
    parseFloat(boardRocksStyles.paddingTop) +
    parseFloat(boardRocksStyles.paddingBottom) +
    parseFloat(boardRocksStyles.borderTopWidth) +
    parseFloat(boardRocksStyles.borderBottomWidth);
  const visibleLevelPanelHeight =
    window.getComputedStyle(levelPanel).display === "none"
      ? 0
      : levelPanel.offsetHeight;
  const reservedHeight =
    topBar.offsetHeight +
    visibleLevelPanelHeight +
    status.offsetHeight +
    actions.offsetHeight +
    boardFrameHeight +
    96;
  const maxBoardHeight = Math.max(1, viewport.height - reservedHeight);
  const maxBoardWidth = Math.max(
    1,
    Math.min(boardRocks.parentElement.clientWidth, viewport.width) - boardBorderWidth - boardFrameWidth,
  );
  const maxCellSize = Math.floor(
    Math.min(maxBoardWidth / state.width, maxBoardHeight / state.height),
  );
  const cellSize = Math.max(6, maxCellSize);

  currentCellSize = cellSize;
  board.style.setProperty("--cell-size", `${cellSize}px`);
  levelPanel.style.width = `${boardRocks.offsetWidth}px`;
}

function setCellPosition(element, cell) {
  element.style.transform = `translate(${cell.x * currentCellSize}px, ${
    cell.y * currentCellSize
  }px)`;
}

function renderLevels() {
  if (!levelList.hasChildNodes()) {
    for (let level = 1; level <= MAX_LEVEL; level += 1) {
      const item = document.createElement("li");
      item.className = "level-item";
      item.dataset.level = String(level);
      item.textContent = `Level ${level}`;
      levelList.append(item);
    }
  }

  const items = [...levelList.querySelectorAll(".level-item")];

  for (const item of items) {
    const level = Number(item.dataset.level);
    item.classList.toggle(
      "is-complete",
      level < currentLevel || (completedAllLevels && level <= currentLevel),
    );
    item.classList.toggle("is-current", level === currentLevel);
    item.classList.toggle(
      "is-newly-unlocked",
      level === currentLevel &&
        !completedAllLevels &&
        performance.now() - lastLevelAdvanceAt <= 2400,
    );
    item.classList.toggle(
      "is-milestone-celebrating",
      level === currentLevel &&
        LEVEL_SCROLLER_MILESTONE_LEVELS.includes(level) &&
        !completedAllLevels &&
        performance.now() - lastLevelAdvanceAt <= 2400,
    );
  }

  if (lastScrolledLevel !== currentLevel) {
    levelList.querySelector(".is-current")?.scrollIntoView({
      block: "nearest",
      inline: "center",
    });
    lastScrolledLevel = currentLevel;
  }
}

function tick() {
  const tickNow = performance.now();

  if (
    !paused &&
    !reversalPauseActive &&
    hasStarted &&
    !state.gameOver &&
    !completedAllLevels
  ) {
    if (detonateBombIfNeeded(tickNow)) {
      if (state.gameOver) {
        void handleGameOverLeaderboard();
      }
      render();
      return;
    }

    const wasGameOver = state.gameOver;
    const wasCompletedAllLevels = completedAllLevels;
    const previousSnake = cloneSnake(state.snake);
    state = stepGame(state, requestedDirection);
    requestedDirection = state.direction;
    const applesConsumed = state.applesConsumedThisTick ?? 0;
    updateMaxSnakeLengthReached();

    if (!wasGameOver && state.gameOver) {
      stopRunClock();
      clearBlackoutWarning();
      clearLevelChangePopup();
      clearBombTimer();
      void handleGameOverLeaderboard();
    }

    if (applesConsumed > 0 && !completedAllLevels) {
      if (isPowerUpEvent(state.lastEvent)) {
        powerUpsConsumed += 1;
      }

      applyConsumedAppleEffects(applesConsumed, {
        allowWormSpawn: state.lastEvent === "food",
      });

      if (!completedAllLevels && state.foods.length === 0) {
        state = spawnAppleBatchForLevel(currentLevel, applesInLevel, state);
      }
    }

    updateWormMovement(tickNow);

    if (!wasCompletedAllLevels && completedAllLevels) {
      void handleGameOverLeaderboard();
    }

    startSnakeBodyAnimation(previousSnake, state.snake);
    render();
  }
}

async function loadLeaderboard() {
  if (!leaderboardList) {
    return;
  }

  if (!supabaseClient) {
    renderLeaderboardUnavailable();
    return;
  }

  const { data, error } = await supabaseClient
    .from("leaderboard")
    .select("player_name, score, level_reached")
    .order("score", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Failed to load leaderboard:", error);
    renderLeaderboardUnavailable();
    return;
  }

  renderLeaderboard(data ?? []);
}

function renderLeaderboard(entries) {
  if (!leaderboardList) {
    return;
  }

  leaderboardList.textContent = "";

  if (!entries.length) {
    const item = document.createElement("li");
    item.textContent = "No scores yet";
    leaderboardList.append(item);
    return;
  }

  entries.forEach((entry, index) => {
    const item = document.createElement("li");
    const rank = document.createElement("span");
    const name = document.createElement("span");
    const scoreValue = document.createElement("span");
    const levelValue = document.createElement("span");

    item.className = "leaderboard-entry";
    rank.className = "leaderboard-entry-rank";
    name.className = "leaderboard-entry-name";
    scoreValue.className = "leaderboard-entry-score";
    levelValue.className = "leaderboard-entry-level";

    rank.textContent = `#${index + 1}`;
    name.textContent = entry.player_name ?? "Anonymous";
    scoreValue.textContent = `Score ${formatScore(entry.score ?? 0)}`;
    levelValue.textContent = `Level ${entry.level_reached ?? 1}`;
    item.append(rank, name, scoreValue, levelValue);
    leaderboardList.append(item);
  });
}

function renderLeaderboardUnavailable() {
  if (!leaderboardList) {
    return;
  }

  leaderboardList.textContent = "";
  const item = document.createElement("li");
  item.textContent = "Leaderboard unavailable";
  leaderboardList.append(item);
}

async function submitScore(name, scoreValue, levelReached) {
  if (!supabaseClient) {
    return;
  }

  const { error } = await supabaseClient.from("leaderboard").insert({
    player_name: name,
    score: scoreValue,
    level_reached: levelReached,
  });

  if (error) {
    throw error;
  }
}

function promptForName() {
  if (
    !leaderboardSubmitScreen ||
    !leaderboardNameInput ||
    !leaderboardSubmitButton ||
    !leaderboardSkipButton
  ) {
    const rawName = window.prompt("Enter your name for the leaderboard (max 20 chars):");
    const fallbackName = rawName?.trim().slice(0, 20) ?? "";
    return Promise.resolve(fallbackName || null);
  }

  return new Promise((resolve) => {
    const finish = (value) => {
      leaderboardSubmitScreen.hidden = true;
      leaderboardNameInput.value = "";
      leaderboardSubmitButton.removeEventListener("click", submitHandler);
      leaderboardSkipButton.removeEventListener("click", skipHandler);
      leaderboardNameInput.removeEventListener("keydown", keyHandler);
      resolve(value);
    };

    const submitHandler = () => {
      const name = leaderboardNameInput.value.trim().slice(0, 20);
      if (!name) {
        leaderboardNameInput.focus();
        return;
      }
      finish(name);
    };

    const skipHandler = () => finish(null);

    const keyHandler = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submitHandler();
      } else if (event.key === "Escape") {
        event.preventDefault();
        skipHandler();
      }
    };

    leaderboardSubmitScreen.hidden = false;
    leaderboardNameInput.focus();
    leaderboardSubmitButton.addEventListener("click", submitHandler);
    leaderboardSkipButton.addEventListener("click", skipHandler);
    leaderboardNameInput.addEventListener("keydown", keyHandler);
  });
}

async function handleGameOverLeaderboard() {
  if (leaderboardHandledForGameOver) {
    return;
  }

  leaderboardHandledForGameOver = true;
  const name = await promptForName();

  if (!name) {
    return;
  }

  try {
    const finalScore = getCurrentScoreBreakdown().finalScore;
    await submitScore(name, finalScore, currentLevel);
    await loadLeaderboard();
  } catch (error) {
    console.error("Failed to submit leaderboard score:", error);
  }
}

function applyConsumedAppleEffects(applesConsumed, options = {}) {
  const allowWormSpawn = options.allowWormSpawn ?? true;
  const startedWithBomb = Boolean(state.bomb);
  let shouldSpawnNewWorm = false;
  let shouldSpawnNewBomb = false;
  let shouldReverse = false;

  for (
    let appleIndex = 0;
    appleIndex < applesConsumed && !completedAllLevels;
    appleIndex += 1
  ) {
    const appleLevel = currentLevel;
    const nextTickMs = getNextTickMsAfterApple(appleLevel, tickMs);

    if (nextTickMs !== tickMs) {
      tickMs = nextTickMs;
      scheduleTick();
    }

    if (shouldBlackoutAfterApple(appleLevel)) {
      startBlackoutWarning();
    }

    if (
      allowWormSpawn &&
      !shouldSpawnNewWorm &&
      !state.worm &&
      shouldSpawnWormAfterApple(appleLevel)
    ) {
      shouldSpawnNewWorm = true;
    }

    if (
      !shouldSpawnNewBomb &&
      !startedWithBomb &&
      !state.bomb &&
      shouldSpawnBombAfterApple(appleLevel)
    ) {
      shouldSpawnNewBomb = true;
    }

    if (!shouldReverse && shouldReverseSnakeAfterApple(appleLevel)) {
      shouldReverse = true;
    }

    applyLevelProgress(getNextLevelProgress(currentLevel, applesInLevel));
  }

  if (!completedAllLevels && shouldSpawnNewWorm && !state.worm) {
    state = {
      ...state,
      worm: spawnWorm(state),
    };
  }

  if (!completedAllLevels && shouldSpawnNewBomb && !state.bomb) {
    state = {
      ...state,
      bomb: spawnBomb(state),
    };
    armBombTimer();
  }

  if (!completedAllLevels && shouldReverse) {
    startReversalPause();
  }
}

function startRunClock() {
  if (runStartedAt || completedAllLevels || state.gameOver) {
    return;
  }

  runStartedAt = performance.now();
  levelStartedAt = runStartedAt;
  runEndedAt = null;
  updateClockDisplay();
  clockTimerId = setInterval(updateClockDisplay, 100);
}

function stopRunClock() {
  if (!runStartedAt || runEndedAt) {
    return;
  }

  runEndedAt = performance.now();
  clearInterval(clockTimerId);
  clockTimerId = null;
  updateClockDisplay();
}

function resetRunClock() {
  clearInterval(clockTimerId);
  runStartedAt = null;
  runEndedAt = null;
  levelStartedAt = null;
  levelSplits = [];
  clockTimerId = null;
}

function recordLevelSplit(level) {
  const now = performance.now();

  if (!levelStartedAt) {
    levelStartedAt = now;
  }

  levelSplits.push({
    level,
    durationMs: now - levelStartedAt,
    endedAtMs: getElapsedRunMs(now),
  });
  levelStartedAt = now;
}

function startReversalPause() {
  if (reversalPauseActive) {
    return;
  }

  reversalPauseActive = true;
  reversalWarningRemainingMs = REVERSAL_WARNING_DURATION_MS;
  showReversalWarning();
  clearTimeout(reversalTimerId);
  pauseBombTimer();
  if (!paused) {
    resumeReversalPause();
  }
}

function showReversalWarning() {
  const warning = document.createElement("div");
  const warningText = document.createElement("span");

  warning.className = REVERSAL_WARNING_CLASS;
  warning.setAttribute("aria-hidden", "true");
  warningText.className = REVERSAL_WARNING_TEXT_CLASS;
  warning.append(warningText);
  board.append(warning);
  board.classList.add(REVERSAL_WARNING_BOARD_CLASS);
  updateReversalWarningText();
}

function pauseReversalPause() {
  if (!reversalTimerId && !reversalWarningTickTimerId) {
    return;
  }

  reversalWarningRemainingMs = Math.max(
    0,
    reversalWarningEndsAt - performance.now(),
  );
  clearTimeout(reversalTimerId);
  clearInterval(reversalWarningTickTimerId);
  reversalTimerId = null;
  reversalWarningTickTimerId = null;
  reversalWarningEndsAt = null;
  updateReversalWarningText();
}

function resumeReversalPause() {
  if (
    !board.querySelector(`.${REVERSAL_WARNING_CLASS}`) ||
    reversalTimerId ||
    reversalWarningTickTimerId
  ) {
    return;
  }

  reversalWarningEndsAt = performance.now() + reversalWarningRemainingMs;
  updateReversalWarningText();
  reversalTimerId = setTimeout(
    finishReversalPause,
    reversalWarningRemainingMs,
  );
  reversalWarningTickTimerId = setInterval(
    updateReversalWarningText,
    REVERSAL_WARNING_UPDATE_MS,
  );
}

function finishReversalPause() {
  clearReversalPause();

  if (!state.gameOver && !completedAllLevels) {
    cancelSnakeBodyAnimation();
    resumeBombTimer();
    state = reverseSnake(state);
    requestedDirection = state.direction;

    board.classList.add("is-resetting");
    render();
    requestAnimationFrame(() => {
      board.classList.remove("is-resetting");
    });
  }
}

function updateReversalWarningText() {
  const warningText = board.querySelector(`.${REVERSAL_WARNING_TEXT_CLASS}`);

  if (!warningText) {
    return;
  }

  warningText.textContent = getReversalWarningText();
}

function getReversalWarningText() {
  const remainingMs = reversalWarningEndsAt
    ? Math.max(0, reversalWarningEndsAt - performance.now())
    : reversalWarningRemainingMs;
  const step = Math.max(
    1,
    Math.ceil(
      (remainingMs / REVERSAL_WARNING_DURATION_MS) * REVERSAL_WARNING_STEP_COUNT,
    ),
  );

  return `${REVERSAL_WARNING_TEXT} ${step}`;
}

function completeCurrentLevel() {
  if (completedAllLevels) {
    return;
  }

  const remainingApples = getLevelTarget(currentLevel) - applesInLevel;
  startRunClock();
  state = {
    ...state,
    score: state.score + remainingApples,
    food: null,
    foods: [],
    worm: null,
    bomb: null,
  };
  clearBombTimer();
  clearBombBlast();
  updateMaxSnakeLengthReached();

  applyLevelProgress(
    getNextLevelProgress(currentLevel, getLevelTarget(currentLevel) - 1),
  );

  if (!completedAllLevels) {
    state = spawnAppleBatchForLevel(currentLevel, applesInLevel, state);
  }

  requestedDirection = state.direction;
  render();
}

function completeGame() {
  if (!runStartedAt) {
    startRunClock();
  }

  if (!completedAllLevels) {
    recordLevelSplit(currentLevel);
  }

  clearReversalPause();
  clearBlackout();
  clearLevelChangePopup();
  clearBombTimer();
  clearBombBlast();
  cancelSnakeBodyAnimation();
  currentLevel = MAX_LEVEL;
  applesInLevel = getLevelTarget(MAX_LEVEL);
  completedAllLevels = true;
  stopRunClock();
  state = {
    ...resizeStateForLevel(currentLevel, state),
    food: null,
    foods: [],
    worm: null,
    bomb: null,
  };
  requestedDirection = state.direction;
  render();
}

function clearReversalPause() {
  clearTimeout(reversalTimerId);
  clearInterval(reversalWarningTickTimerId);
  reversalPauseActive = false;
  reversalTimerId = null;
  reversalWarningTickTimerId = null;
  reversalWarningEndsAt = null;
  reversalWarningRemainingMs = 0;
  board.querySelector(`.${REVERSAL_WARNING_CLASS}`)?.remove();
  board.classList.remove(REVERSAL_WARNING_BOARD_CLASS);
}

function applyLevelProgress(progress) {
  const previousLevel = currentLevel;
  currentLevel = progress.level;
  applesInLevel = progress.applesInLevel;
  completedAllLevels = progress.completedAllLevels;

  if (progress.advanced) {
    recordLevelSplit(previousLevel);
    state = resizeStateForLevel(currentLevel, state);
    requestedDirection = state.direction;
    lastLevelAdvanceAt = performance.now();
    showLevelChangePopup(currentLevel);
  }

  if (completedAllLevels) {
    recordLevelSplit(previousLevel);
    completeGame();
  }
}

function requestTurn(direction) {
  if (state.gameOver || completedAllLevels) {
    return;
  }

  if (shouldDropTurnInput(currentLevel)) {
    missedInputUntil = performance.now() + 650;
    flashMissedInput();
    render();
    return;
  }

  missedInputUntil = 0;
  requestedDirection = turn(state.direction, direction);
  hasStarted = true;
  startRunClock();
  render();
}

function updateWormMovement(now = performance.now()) {
  if (!state.worm) {
    wormMoveDueAt = null;
    wormMoveRemainingMs = WORM_MOVE_INTERVAL_MS;
    return;
  }

  if (wormMoveDueAt === null) {
    wormMoveDueAt = now + wormMoveRemainingMs;
    return;
  }

  if (now < wormMoveDueAt) {
    return;
  }

  state = {
    ...state,
    worm: moveWorm(state),
  };
  wormMoveRemainingMs = WORM_MOVE_INTERVAL_MS;
  wormMoveDueAt = now + WORM_MOVE_INTERVAL_MS;
}

function showLevelChangePopup(level) {
  const config = LEVEL_CHANGE_POPUP_LEVELS[level];

  if (!config) {
    return;
  }

  clearLevelChangePopup();
  levelChangePopupRemainingMs = config.durationMs ?? LEVEL_CHANGE_POPUP_DURATION_MS;

  const popup = document.createElement("div");

  popup.className = LEVEL_CHANGE_POPUP_CLASS;
  popup.setAttribute("aria-hidden", "true");
  popup.style.setProperty("--level-change-duration", `${levelChangePopupRemainingMs}ms`);
  popup.append(createLevelChangeCard(config));
  board.append(popup);

  if (paused) {
    popup.classList.add(LEVEL_CHANGE_POPUP_PAUSED_CLASS);
  } else {
    resumeLevelChangePopup();
  }
}

function createLevelChangeCard(config) {
  const card = document.createElement("div");
  const accent = document.createElement("div");
  const meta = document.createElement("div");
  const label = document.createElement("p");
  const badge = document.createElement("span");
  const message = document.createElement("p");

  card.className = `${LEVEL_CHANGE_POPUP_CARD_CLASS} ${LEVEL_CHANGE_POPUP_CARD_CLASS}--${config.theme}`;
  accent.className = `${LEVEL_CHANGE_POPUP_ACCENT_CLASS} ${LEVEL_CHANGE_POPUP_ACCENT_CLASS}--${config.theme}`;
  meta.className = LEVEL_CHANGE_POPUP_META_CLASS;
  label.className = LEVEL_CHANGE_POPUP_LABEL_CLASS;
  badge.className = `${LEVEL_CHANGE_POPUP_BADGE_CLASS} ${LEVEL_CHANGE_POPUP_BADGE_CLASS}--${config.theme}`;
  message.className = LEVEL_CHANGE_POPUP_MESSAGE_CLASS;

  label.textContent = config.label;
  meta.append(label, badge);
  card.append(accent, meta, message);

  if (config.theme === "keyboard") {
    message.append(createKeyboardTypingMessage());
    return card;
  }

  if (config.theme === "wrong-way") {
    message.append(createWrongWayMessage());
    return card;
  }

  for (const part of config.parts) {
    message.append(createLevelChangeTextPart(config, part));
  }

  return card;
}

function createKeyboardTypingMessage() {
  const typing = document.createElement("span");
  const prefix = document.createElement("span");
  const typo = document.createElement("span");
  const finish = document.createElement("span");

  typing.className = "level-change-card__typing";
  prefix.className = "level-change-card__typing-prefix";
  typo.className = "level-change-card__typing-typo";
  finish.className = "level-change-card__typing-finish";

  prefix.textContent = "Faulty ";
  typo.textContent = "Keyy";
  finish.textContent = "board";

  typing.append(prefix, typo, finish);
  return typing;
}

function createWrongWayMessage() {
  const reversal = document.createElement("span");
  const forward = document.createElement("span");
  const backward = document.createElement("span");

  reversal.className = "level-change-card__reversal";
  forward.className = "level-change-card__reversal-forward";
  backward.className = "level-change-card__reversal-backward";

  forward.textContent = "Wrong Way";
  backward.textContent = "yaW gnorW";

  reversal.append(forward, backward);
  return reversal;
}

function createLevelChangeTextPart(config, part) {
  const span = document.createElement("span");

  span.textContent = part.text;
  if (!part.keyword) {
    return span;
  }

  span.className = LEVEL_CHANGE_POPUP_KEYWORD_CLASS;

  if (config.theme !== "outage") {
    return span;
  }

  span.textContent = "";
  const letters = [...part.text];

  letters.forEach((letter, index) => {
    const letterSpan = document.createElement("span");

    letterSpan.textContent = letter;
    letterSpan.className = LEVEL_CHANGE_POPUP_LETTER_CLASS;
    if (/[A-Za-z]/.test(letter) && index % 3 === 1) {
      letterSpan.classList.add(LEVEL_CHANGE_POPUP_FLICKER_LETTER_CLASS);
      letterSpan.style.setProperty("--letter-flicker-delay", `${index * 90}ms`);
    }
    span.append(letterSpan);
  });

  return span;
}

function pauseLevelChangePopup() {
  const popup = board.querySelector(`.${LEVEL_CHANGE_POPUP_CLASS}`);

  if (!popup || !levelChangePopupTimerId) {
    return;
  }

  popup.classList.add(LEVEL_CHANGE_POPUP_PAUSED_CLASS);
  levelChangePopupRemainingMs = Math.max(
    0,
    levelChangePopupEndsAt - performance.now(),
  );
  clearTimeout(levelChangePopupTimerId);
  levelChangePopupTimerId = null;
  levelChangePopupEndsAt = null;
}

function resumeLevelChangePopup() {
  const popup = board.querySelector(`.${LEVEL_CHANGE_POPUP_CLASS}`);

  if (!popup || levelChangePopupTimerId) {
    return;
  }

  popup.classList.remove(LEVEL_CHANGE_POPUP_PAUSED_CLASS);
  levelChangePopupEndsAt = performance.now() + levelChangePopupRemainingMs;
  levelChangePopupTimerId = setTimeout(
    clearLevelChangePopup,
    levelChangePopupRemainingMs,
  );
}

function clearLevelChangePopup() {
  clearTimeout(levelChangePopupTimerId);
  levelChangePopupTimerId = null;
  levelChangePopupEndsAt = null;
  levelChangePopupRemainingMs = 0;
  board.querySelector(`.${LEVEL_CHANGE_POPUP_CLASS}`)?.remove();
}

function restartGame() {
  clearReversalPause();
  clearMissedInputFeedback();
  clearBlackout();
  clearLevelChangePopup();
  clearBombTimer();
  clearBombBlast();
  wormMoveDueAt = null;
  wormMoveRemainingMs = WORM_MOVE_INTERVAL_MS;
  cancelSnakeBodyAnimation();
  resetRunClock();
  currentLevel = 1;
  state = createLevelState(currentLevel);
  requestedDirection = state.direction;
  paused = false;
  hasStarted = false;
  applesInLevel = 0;
  maxSnakeLengthReached = state.snake.length;
  powerUpsConsumed = 0;
  completedAllLevels = false;
  lastLevelAdvanceAt = performance.now();
  tickMs = BASE_TICK_MS;
  leaderboardHandledForGameOver = false;
  if (leaderboardSubmitScreen) {
    leaderboardSubmitScreen.hidden = true;
  }
  scheduleTick();
  board.classList.add("is-resetting");
  render();
  showLevelChangePopup(currentLevel);
  requestAnimationFrame(() => {
    board.classList.remove("is-resetting");
  });
}

function flashMissedInput() {
  clearTimeout(missedInputFlashTimerId);
  document.body.classList.remove("input-missed");
  void document.body.offsetWidth;
  document.body.classList.add("input-missed");
  missedInputFlashTimerId = setTimeout(() => {
    document.body.classList.remove("input-missed");
    missedInputFlashTimerId = null;
  }, 260);
}

function clearMissedInputFeedback() {
  clearTimeout(missedInputFlashTimerId);
  missedInputFlashTimerId = null;
  missedInputUntil = 0;
  document.body.classList.remove("input-missed");
}

function startBlackoutWarning() {
  if (
    blackoutWarningTimerId ||
    blackoutWarningTickTimerId ||
    board.querySelector(`.${BLACKOUT_WARNING_CLASS}`) ||
    document.body.classList.contains("blackout")
  ) {
    return;
  }

  blackoutWarningRemainingMs = BLACKOUT_WARNING_DURATION_MS;
  showBlackoutWarning();

  if (!paused) {
    resumeBlackoutWarning();
  }
}

function showBlackoutWarning() {
  const warning = document.createElement("div");
  const warningText = document.createElement("span");

  warning.className = BLACKOUT_WARNING_CLASS;
  warning.setAttribute("aria-hidden", "true");
  warningText.className = BLACKOUT_WARNING_TEXT_CLASS;
  warning.append(warningText);
  board.append(warning);
  board.classList.add(BLACKOUT_WARNING_BOARD_CLASS);
  updateBlackoutWarningText();
}

function pauseBlackoutWarning() {
  if (!blackoutWarningTimerId && !blackoutWarningTickTimerId) {
    return;
  }

  blackoutWarningRemainingMs = Math.max(
    0,
    blackoutWarningEndsAt - performance.now(),
  );
  clearTimeout(blackoutWarningTimerId);
  clearInterval(blackoutWarningTickTimerId);
  blackoutWarningTimerId = null;
  blackoutWarningTickTimerId = null;
  blackoutWarningEndsAt = null;
  updateBlackoutWarningText();
}

function resumeBlackoutWarning() {
  if (
    !board.querySelector(`.${BLACKOUT_WARNING_CLASS}`) ||
    blackoutWarningTimerId ||
    blackoutWarningTickTimerId
  ) {
    return;
  }

  blackoutWarningEndsAt = performance.now() + blackoutWarningRemainingMs;
  updateBlackoutWarningText();
  blackoutWarningTimerId = setTimeout(
    finishBlackoutWarning,
    blackoutWarningRemainingMs,
  );
  blackoutWarningTickTimerId = setInterval(
    updateBlackoutWarningText,
    BLACKOUT_WARNING_UPDATE_MS,
  );
}

function finishBlackoutWarning() {
  clearBlackoutWarning();

  if (!state.gameOver && !completedAllLevels) {
    startBlackout();
  }
}

function updateBlackoutWarningText() {
  const warningText = board.querySelector(`.${BLACKOUT_WARNING_TEXT_CLASS}`);

  if (!warningText) {
    return;
  }

  warningText.textContent = getBlackoutWarningText();
}

function getBlackoutWarningText() {
  const remainingMs = blackoutWarningEndsAt
    ? Math.max(0, blackoutWarningEndsAt - performance.now())
    : blackoutWarningRemainingMs;
  const step = Math.max(
    1,
    Math.ceil(
      (remainingMs / BLACKOUT_WARNING_DURATION_MS) * BLACKOUT_WARNING_STEP_COUNT,
    ),
  );

  return `${BLACKOUT_WARNING_TEXT} ${step}`;
}

function isBlackoutWarningActive() {
  return Boolean(board.querySelector(`.${BLACKOUT_WARNING_CLASS}`));
}

function clearBlackoutWarning() {
  clearTimeout(blackoutWarningTimerId);
  clearInterval(blackoutWarningTickTimerId);
  blackoutWarningTimerId = null;
  blackoutWarningTickTimerId = null;
  blackoutWarningEndsAt = null;
  blackoutWarningRemainingMs = 0;
  board.querySelector(`.${BLACKOUT_WARNING_CLASS}`)?.remove();
  board.classList.remove(BLACKOUT_WARNING_BOARD_CLASS);
}

function startBlackout() {
  clearTimeout(blackoutTimerId);
  document.body.classList.add("blackout");
  blackoutTimerId = setTimeout(() => {
    document.body.classList.remove("blackout");
    blackoutTimerId = null;
  }, BLACKOUT_DURATION_MS);
}

function clearBlackout() {
  clearBlackoutWarning();
  clearTimeout(blackoutTimerId);
  blackoutTimerId = null;
  document.body.classList.remove("blackout");
}

function createLevelState(level, score = 0) {
  const boardSize = getLevelBoardSize(level, DEFAULT_BOARD_SCALE_PROFILE);
  const appleCount = getAppleBatchSize(level, getLevelTarget(level));

  return {
    ...createInitialState({ ...boardSize, foodCount: appleCount }),
    worm: null,
    bomb: null,
    score,
  };
}

function resizeStateForLevel(level, currentState) {
  const boardSize = getLevelBoardSize(level, DEFAULT_BOARD_SCALE_PROFILE);

  if (
    boardSize.width === currentState.width &&
    boardSize.height === currentState.height
  ) {
    return currentState;
  }

  return {
    ...currentState,
    width: boardSize.width,
    height: boardSize.height,
  };
}

function spawnAppleBatchForLevel(level, eatenInLevel, currentState) {
  const applesRemaining = getLevelTarget(level) - eatenInLevel;
  const foodCount = getAppleBatchSize(level, applesRemaining);
  const foods = spawnFoods(currentState, foodCount);

  return {
    ...currentState,
    food: foods[0] ?? null,
    foods,
  };
}

function updateMaxSnakeLengthReached() {
  maxSnakeLengthReached = Math.max(maxSnakeLengthReached, state.snake.length);
}

function isPowerUpEvent(eventName) {
  return eventName === "worm";
}

function updateSnakeColor() {
  const speedRatio = BASE_TICK_MS / tickMs;
  const speedOffset = Math.max(-1, Math.min(1, speedRatio - 1));
  const slowOffset = Math.max(0, Math.min(1, 1 - speedRatio));
  const hue = speedOffset >= 0
    ? 140 - speedOffset * 140
    : 140 + slowOffset * 80;
  const saturation = 72 + Math.min(18, Math.abs(speedRatio - 1) * 20);

  board.style.setProperty("--snake-hue", Math.round(hue));
  board.style.setProperty("--snake-saturation", `${Math.round(saturation)}%`);
}

function renderWinScreen() {
  winScreen.hidden = !completedAllLevels;

  if (!completedAllLevels) {
    return;
  }

  renderScoreSummary({
    scoreElement: winScore,
    timeElement: winTime,
    resultElement: winResult,
    furthestLevelElement: winFurthestLevel,
    progressScoreElement: winProgressScore,
    completionBonusElement: winCompletionBonus,
    timeBonusElement: winTimeBonus,
    sizeBonusElement: winSizeBonus,
    powerBonusElement: winPowerBonus,
    maxLengthElement: winMaxLength,
    powerUpsElement: winPowerUps,
  });
}

function renderLossScreen() {
  lossScreen.hidden = !state.gameOver || completedAllLevels || isBombBlastActive();

  if (lossScreen.hidden) {
    return;
  }

  renderScoreSummary({
    scoreElement: lossScore,
    timeElement: lossTime,
    resultElement: lossResult,
    furthestLevelElement: lossFurthestLevel,
    progressScoreElement: lossProgressScore,
    completionBonusElement: lossCompletionBonus,
    timeBonusElement: lossTimeBonus,
    sizeBonusElement: lossSizeBonus,
    powerBonusElement: lossPowerBonus,
    maxLengthElement: lossMaxLength,
    powerUpsElement: lossPowerUps,
  });
}

function renderScoreSummary({
  scoreElement,
  timeElement,
  resultElement,
  furthestLevelElement,
  progressScoreElement,
  completionBonusElement,
  timeBonusElement,
  sizeBonusElement,
  powerBonusElement,
  maxLengthElement,
  powerUpsElement,
}) {
  const progress = getRunProgress();
  const scoreBreakdown = getCurrentScoreBreakdown(progress);

  scoreElement.textContent = formatScore(scoreBreakdown.finalScore);
  timeElement.textContent = formatDuration(getElapsedRunMs());
  if (resultElement) {
    resultElement.textContent = completedAllLevels ? "Completed" : "Finished";
  }
  furthestLevelElement.textContent = completedAllLevels
    ? "Completed"
    : `Level ${progress.furthestLevel}`;
  progressScoreElement.textContent = formatScore(scoreBreakdown.progressScore);
  completionBonusElement.textContent = formatScore(scoreBreakdown.completionBonus);
  timeBonusElement.textContent = formatScore(scoreBreakdown.adjustedTimeBonus);
  sizeBonusElement.textContent = formatScore(scoreBreakdown.adjustedSizeBonus);
  powerBonusElement.textContent = formatScore(scoreBreakdown.adjustedPowerBonus);
  maxLengthElement.textContent = String(maxSnakeLengthReached);
  powerUpsElement.textContent = String(powerUpsConsumed);
}

function getCurrentScoreBreakdown(progress = getRunProgress()) {
  return getSpeedrunScoreBreakdown({
    runTimeSeconds: getElapsedRunMs() / 1000,
    levelsCompleted: progress.levelsCompleted,
    currentLevelApplesCollected: progress.currentLevelApplesCollected,
    progressPercent: progress.progressPercent,
    completed: completedAllLevels,
    maxSnakeLength: maxSnakeLengthReached,
    startingSnakeLength: STARTING_SNAKE_LENGTH,
    powerUpsConsumed,
  });
}

function getRunProgress() {
  const totalRunApples = getTotalRunApples();
  const totalApplesCollected = completedAllLevels
    ? totalRunApples
    : getApplesBeforeLevel(currentLevel) + applesInLevel;
  const progressPercent = totalRunApples > 0
    ? totalApplesCollected / totalRunApples
    : 0;

  return {
    totalApplesCollected,
    progressPercent,
    levelsCompleted: completedAllLevels ? MAX_LEVEL : currentLevel - 1,
    currentLevelApplesCollected: completedAllLevels ? 0 : applesInLevel,
    furthestLevel: completedAllLevels ? MAX_LEVEL : currentLevel,
  };
}

function updateClockDisplay() {
  const now = performance.now();
  timer.textContent = formatDuration(getElapsedRunMs(now));
  levelTimer.textContent = formatDuration(getElapsedLevelMs(now));
}

function getElapsedRunMs(now = performance.now()) {
  if (!runStartedAt) {
    return 0;
  }

  return (runEndedAt ?? now) - runStartedAt;
}

function getElapsedLevelMs(now = performance.now()) {
  if (!levelStartedAt) {
    return 0;
  }

  return (runEndedAt ?? now) - levelStartedAt;
}

function formatDuration(durationMs) {
  const totalTenths = Math.max(0, Math.floor(durationMs / 100));
  const tenths = totalTenths % 10;
  const totalSeconds = Math.floor(totalTenths / 10);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

function formatScore(scoreValue) {
  return scoreFormatter.format(Math.round(scoreValue));
}

function togglePause() {
  if (state.gameOver || completedAllLevels) {
    return;
  }

  paused = !paused;
  if (paused) {
    pauseBombTimer();
    if (wormMoveDueAt !== null) {
      wormMoveRemainingMs = Math.max(0, wormMoveDueAt - performance.now());
      wormMoveDueAt = null;
    }
    pauseBlackoutWarning();
    pauseReversalPause();
    pauseLevelChangePopup();
  } else {
    if (!reversalPauseActive) {
      resumeBombTimer();
    }
    if (state.worm && wormMoveDueAt === null) {
      wormMoveDueAt = performance.now() + wormMoveRemainingMs;
    }
    resumeBlackoutWarning();
    resumeReversalPause();
    resumeLevelChangePopup();
  }
  render();
}

function handleBoardTouchStart(event) {
  if (event.touches.length !== 1) {
    clearSwipeGesture();
    return;
  }

  event.preventDefault();
  const touch = event.touches[0];

  swipeTrackingId = touch.identifier;
  swipeStartPoint = {
    x: touch.clientX,
    y: touch.clientY,
  };
}

function handleBoardTouchMove(event) {
  if (!swipeStartPoint || swipeTrackingId === null) {
    return;
  }

  const touch = getTrackedTouch(event.changedTouches);

  if (!touch) {
    return;
  }

  event.preventDefault();
}

function handleBoardTouchEnd(event) {
  if (!swipeStartPoint || swipeTrackingId === null) {
    return;
  }

  const touch = getTrackedTouch(event.changedTouches);

  if (!touch) {
    return;
  }

  const direction = getSwipeDirection({
    startX: swipeStartPoint.x,
    startY: swipeStartPoint.y,
    endX: touch.clientX,
    endY: touch.clientY,
  });

  clearSwipeGesture();

  if (!direction) {
    return;
  }

  event.preventDefault();
  requestTurn(direction);
}

function handleBoardTouchCancel() {
  clearSwipeGesture();
}

function setActiveTab(tab) {
  const isGameTab = tab === "game";

  gameTabButton.classList.toggle("is-active", isGameTab);
  gameTabButton.setAttribute("aria-selected", String(isGameTab));
  gamePanel.hidden = !isGameTab;

  leaderboardTabButton.classList.toggle("is-active", !isGameTab);
  leaderboardTabButton.setAttribute("aria-selected", String(!isGameTab));
  leaderboardPanel.hidden = isGameTab;
}

function getTrackedTouch(touchList) {
  return [...touchList].find((touch) => touch.identifier === swipeTrackingId) ?? null;
}

function getSwipeDirection({ startX, startY, endX, endY }) {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (Math.max(absX, absY) < SWIPE_MIN_DISTANCE_PX) {
    return null;
  }

  if (absX > absY * SWIPE_DIRECTION_LOCK_RATIO) {
    return deltaX > 0 ? "right" : "left";
  }

  if (absY > absX * SWIPE_DIRECTION_LOCK_RATIO) {
    return deltaY > 0 ? "down" : "up";
  }

  return null;
}

function clearSwipeGesture() {
  swipeStartPoint = null;
  swipeTrackingId = null;
}

document.addEventListener("keydown", (event) => {
  if (DEBUG_MODE_AVAILABLE && event.key === "F2") {
    event.preventDefault();
    debugMode = !debugMode;
    render();
    return;
  }

  if (debugMode && event.key.toLowerCase() === "n") {
    event.preventDefault();
    completeCurrentLevel();
    return;
  }

  if (debugMode && event.key.toLowerCase() === "g") {
    event.preventDefault();
    completeGame();
    return;
  }

  if (debugMode && event.key.toLowerCase() === "b") {
    event.preventDefault();
    startBlackoutWarning();
    render();
    return;
  }

  const direction = keys.get(event.key);

  if (direction) {
    event.preventDefault();
    requestTurn(direction);
    return;
  }

  if (event.key === "Enter" && (state.gameOver || completedAllLevels)) {
    restartGame();
  }

  if (event.key === " ") {
    event.preventDefault();
    togglePause();
  }
});

restart.addEventListener("click", restartGame);
pause.addEventListener("click", togglePause);
winRestart.addEventListener("click", restartGame);
lossRestart.addEventListener("click", restartGame);

boardRocks.addEventListener("touchstart", handleBoardTouchStart, { passive: false });
boardRocks.addEventListener("touchmove", handleBoardTouchMove, { passive: false });
boardRocks.addEventListener("touchend", handleBoardTouchEnd, { passive: false });
boardRocks.addEventListener("touchcancel", handleBoardTouchCancel, { passive: false });
gameTabButton.addEventListener("click", () => setActiveTab("game"));
leaderboardTabButton.addEventListener("click", () => setActiveTab("leaderboard"));

setActiveTab("game");
lastLevelAdvanceAt = performance.now();
render();
requestAnimationFrame(() => {
  scheduleViewportRender();
  setTimeout(scheduleViewportRender, 120);
});
void loadLeaderboard();
showLevelChangePopup(currentLevel);
scheduleTick();
window.addEventListener("resize", scheduleViewportRender);
window.addEventListener("orientationchange", scheduleViewportRender);
window.addEventListener("load", scheduleViewportRender);
window.addEventListener("pageshow", scheduleViewportRender);
window.visualViewport?.addEventListener("resize", scheduleViewportRender);
window.visualViewport?.addEventListener("scroll", scheduleViewportRender);

function scheduleTick() {
  if (tickTimerId) {
    clearInterval(tickTimerId);
  }

  tickTimerId = setInterval(tick, tickMs);
}
