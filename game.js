const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const stageValue = document.getElementById("stageValue");
const livesValue = document.getElementById("livesValue");
const enemiesValue = document.getElementById("enemiesValue");
const scoreValue = document.getElementById("scoreValue");
const overlay = document.getElementById("messageOverlay");
const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const restartButton = document.getElementById("restartButton");
const mobilePauseButton = document.getElementById("mobilePauseButton");
const mobileRestartButton = document.getElementById("mobileRestartButton");
const fireButton = document.getElementById("fireButton");
const stageSelects = [...document.querySelectorAll("[data-stage-select]")];

const TILE = 32;
const GRID = 26;
const WORLD = TILE * GRID;
const MAX_SELECTABLE_STAGE = 10;
const PLAYER_SPAWN_X = 9 * TILE;
const PLAYER_SPAWN_Y = 24 * TILE;
const DIRS = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};
const OPPOSITE = { up: "down", right: "left", down: "up", left: "right" };

const keys = new Set();
const touchDirs = new Set();

let game = null;
let lastTime = 0;
let accumulator = 0;
const STEP = 1000 / 60;
let selectedStage = getInitialStage();

function getInitialStage() {
  const stage = Number.parseInt(new URLSearchParams(window.location.search).get("stage"), 10);
  return normalizeStage(stage);
}

function normalizeStage(stage) {
  if (!Number.isInteger(stage) || stage < 1) return 1;
  return Math.min(stage, MAX_SELECTABLE_STAGE);
}

function getEnemyCountForStage(stage) {
  return stage === 1 ? 18 : 18 + stage * 4;
}

function makeGame() {
  const stage = selectedStage;
  return {
    state: "ready",
    stage,
    score: 0,
    lives: 3,
    enemiesRemaining: getEnemyCountForStage(stage),
    enemiesKilled: 0,
    spawnTimer: 0,
    spawnIndex: 0,
    playerInvincible: 120,
    message: "Tank 1990",
    map: createMap(stage),
    player: {
      type: "player",
      x: PLAYER_SPAWN_X,
      y: PLAYER_SPAWN_Y,
      w: 28,
      h: 28,
      dir: "up",
      speed: 2.05,
      cooldown: 0,
      alive: true,
      color: "#e8d55c",
    },
    enemies: [],
    bullets: [],
    sparks: [],
    base: { x: 12 * TILE, y: 25 * TILE, w: TILE * 2, h: TILE, alive: true },
  };
}

function createMap(stage) {
  const map = Array.from({ length: GRID }, () => Array(GRID).fill(0));

  for (let y = 2; y < 24; y += 2) {
    for (const x of [2, 3, 6, 7, 10, 15, 18, 19, 22, 23]) {
      if (Math.random() > 0.24) map[y][x] = 1;
      if (Math.random() > 0.58 && y + 1 < 24) map[y + 1][x] = 1;
    }
  }

  const steel = [
    [0, 8],
    [1, 8],
    [24, 8],
    [25, 8],
    [7, 12],
    [8, 12],
    [17, 12],
    [18, 12],
    [12, 15],
    [13, 15],
  ];
  const water = [
    [11, 7],
    [12, 7],
    [13, 7],
    [14, 7],
    [11, 8],
    [12, 8],
    [13, 8],
    [14, 8],
  ];
  const trees = [
    [4, 16],
    [5, 16],
    [20, 16],
    [21, 16],
    [4, 17],
    [5, 17],
    [20, 17],
    [21, 17],
  ];

  for (const [x, y] of steel) map[y][x] = 2;
  for (const [x, y] of water) map[y][x] = 3;
  for (const [x, y] of trees) map[y][x] = 4;

  for (const [x, y] of [
    [11, 24],
    [12, 24],
    [13, 24],
    [14, 24],
    [11, 25],
    [14, 25],
  ]) {
    map[y][x] = 1;
  }

  for (const [x, y] of [
    [0, 0],
    [1, 0],
    [12, 0],
    [13, 0],
    [24, 0],
    [25, 0],
    [9, 24],
    [12, 25],
    [13, 25],
  ]) {
    map[y][x] = 0;
  }

  applyStageLayout(map, stage);

  return map;
}

function applyStageLayout(map, stage) {
  if (stage === 1) {
    applyStageOneLayout(map);
  }

  if (stage === 2) {
    applyStageTwoLayout(map);
  }

  if (stage === 3) {
    applyReferenceStageLayout(map, 2, "full");
  }

  if (stage === 4) {
    applyReferenceStageLayout(map, 3, "light");
    setRect(map, 2, 12, 16, 2, 2);
  }

  if (stage === 5) {
    applyStageFiveLayout(map);
  }

  if (stage === 6) {
    applyStageSixLayout(map);
  }

  if (stage === 7) {
    applyStageSevenLayout(map);
  }

  if (stage === 8) {
    applyStageEightLayout(map);
  }

  if (stage === 9) {
    applyStageNineLayout(map);
  }

  if (stage === 10) {
    applyStageTenLayout(map);
  }

  for (const [x, y] of clearGameplayCells()) {
    map[y][x] = 0;
  }
}

function applyReferenceStageLayout(map, barrierTile, grassDensity) {
  clearMap(map);

  for (const x of [2, 6, 10, 14, 18, 22]) {
    setRect(map, 1, x, 0, 2, 4);
    setRect(map, barrierTile, x, 4, 2, 1);
  }

  for (const x of [0, 4, 20, 24]) {
    setRect(map, 1, x, 7, 2, 3);
    setRect(map, barrierTile, x, 10, 2, 1);
  }

  setRect(map, 1, 8, 6, 2, 6);
  setRect(map, barrierTile, 8, 10, 2, 2);
  setRect(map, 1, 12, 8, 2, 3);
  setRect(map, barrierTile, 12, 11, 2, 1);
  setRect(map, 1, 16, 6, 2, 6);
  setRect(map, barrierTile, 16, 10, 2, 2);

  if (grassDensity === "full") {
    setRect(map, 4, 0, 12, 8, 4);
    setRect(map, 4, 10, 12, 6, 4);
    setRect(map, 4, 18, 12, 8, 4);
    setRect(map, 4, 12, 10, 2, 8);
    setRect(map, 4, 8, 14, 10, 2);
  } else {
    setRect(map, 4, 0, 13, 8, 2);
    setRect(map, 4, 10, 13, 6, 2);
    setRect(map, 4, 18, 13, 8, 2);
    setRect(map, 4, 12, 11, 2, 5);
    setRect(map, 4, 9, 14, 8, 1);
  }

  setRect(map, 1, 8, 12, 2, 4);
  setRect(map, 1, 16, 12, 2, 4);
  setRect(map, 1, 9, 13, 3, 1);
  setRect(map, 1, 14, 13, 3, 1);
  setRect(map, 1, 11, 16, 1, 2);
  setRect(map, 1, 14, 16, 1, 2);
  setRect(map, barrierTile, 12, 16, 2, 2);

  for (const x of [2, 6, 18, 22]) {
    setRect(map, 1, x, 19, 2, 5);
  }
  setRect(map, 1, 0, 18, 2, 2);
  setRect(map, barrierTile, 0, 20, 2, 1);
  setRect(map, 1, 10, 22, 4, 2);
  setRect(map, 1, 24, 18, 2, 2);
  setRect(map, barrierTile, 24, 20, 2, 1);

  setRect(map, 1, 11, 24, 4, 1);
  setTiles(map, 1, [
    [11, 25],
    [14, 25],
  ]);
}

function applyStageTwoLayout(map) {
  clearMap(map);

  setRect(map, 3, 0, 4, 4, 2);
  setRect(map, 4, 0, 6, 2, 6);
  setRect(map, 2, 0, 12, 2, 2);
  setRect(map, 4, 0, 14, 2, 4);
  setRect(map, 2, 0, 18, 2, 2);
  setRect(map, 4, 0, 20, 2, 3);
  setRect(map, 1, 0, 24, 4, 2);

  setRect(map, 4, 4, 2, 2, 2);
  setRect(map, 4, 4, 4, 4, 2);
  setRect(map, 2, 6, 6, 2, 12);
  setRect(map, 1, 2, 8, 4, 2);
  setRect(map, 1, 2, 14, 4, 2);
  setRect(map, 1, 4, 20, 2, 4);
  setRect(map, 2, 4, 24, 2, 2);

  setRect(map, 3, 8, 6, 2, 8);
  setRect(map, 1, 10, 2, 8, 2);
  setRect(map, 1, 12, 4, 2, 14);
  setRect(map, 4, 10, 6, 2, 2);
  setRect(map, 4, 10, 10, 2, 2);
  setRect(map, 4, 10, 14, 4, 2);
  setRect(map, 2, 8, 18, 2, 2);
  setRect(map, 1, 10, 18, 4, 2);
  setRect(map, 1, 12, 21, 2, 3);

  setRect(map, 4, 14, 6, 2, 2);
  setRect(map, 4, 14, 10, 2, 2);
  setRect(map, 4, 14, 14, 2, 2);
  setRect(map, 2, 16, 7, 4, 1);
  setRect(map, 2, 16, 10, 2, 2);
  setRect(map, 2, 18, 11, 4, 1);
  setRect(map, 3, 16, 12, 8, 2);
  setRect(map, 2, 18, 14, 2, 1);
  setRect(map, 2, 22, 14, 2, 1);
  setRect(map, 2, 22, 20, 4, 2);

  setRect(map, 1, 20, 0, 2, 4);
  setRect(map, 2, 22, 3, 2, 1);
  setRect(map, 1, 20, 4, 2, 8);
  setRect(map, 1, 20, 14, 2, 8);
  setRect(map, 1, 20, 24, 2, 2);
  setRect(map, 4, 24, 2, 2, 14);
  setRect(map, 1, 22, 16, 4, 2);

  setRect(map, 1, 11, 24, 4, 1);
  setTiles(map, 1, [
    [11, 25],
    [14, 25],
  ]);
}

function applyStageOneLayout(map) {
  clearMap(map);

  setRect(map, 4, 0, 2, 2, 2);
  setRect(map, 2, 0, 4, 2, 8);
  setRect(map, 1, 2, 2, 2, 8);
  setRect(map, 1, 0, 14, 2, 2);
  setRect(map, 4, 0, 16, 4, 6);
  setRect(map, 1, 0, 22, 2, 4);
  setRect(map, 4, 2, 22, 4, 2);

  setRect(map, 2, 6, 0, 2, 4);
  setRect(map, 1, 6, 4, 2, 2);
  setRect(map, 2, 4, 8, 2, 2);
  setRect(map, 1, 4, 10, 2, 2);
  setRect(map, 2, 4, 12, 2, 1);
  setRect(map, 1, 4, 15, 2, 4);
  setRect(map, 4, 4, 18, 2, 4);
  setRect(map, 1, 6, 19, 2, 2);
  setRect(map, 1, 6, 22, 4, 2);

  setRect(map, 1, 10, 0, 2, 2);
  setRect(map, 1, 14, 0, 2, 2);
  setRect(map, 1, 10, 4, 2, 2);
  setRect(map, 2, 12, 4, 2, 2);
  setRect(map, 3, 10, 6, 4, 2);
  setRect(map, 1, 8, 8, 4, 2);
  setRect(map, 2, 8, 10, 2, 2);
  setRect(map, 3, 10, 10, 2, 2);
  setRect(map, 1, 8, 12, 4, 2);
  setRect(map, 3, 12, 14, 8, 2);
  setRect(map, 1, 10, 16, 8, 2);
  setRect(map, 1, 10, 20, 4, 2);
  setRect(map, 1, 10, 24, 4, 1);

  setRect(map, 2, 14, 12, 2, 2);
  setRect(map, 1, 16, 6, 4, 2);
  setRect(map, 2, 16, 10, 2, 2);
  setRect(map, 1, 18, 8, 2, 2);
  setRect(map, 3, 20, 10, 2, 2);
  setRect(map, 1, 20, 8, 2, 6);

  setRect(map, 1, 18, 0, 2, 4);
  setRect(map, 4, 22, 2, 2, 4);
  setRect(map, 2, 24, 4, 2, 2);
  setRect(map, 2, 22, 6, 4, 2);
  setRect(map, 2, 22, 10, 2, 2);
  setRect(map, 1, 22, 8, 2, 7);
  setRect(map, 4, 22, 14, 2, 4);
  setRect(map, 2, 24, 18, 2, 2);
  setRect(map, 4, 22, 18, 2, 6);
  setRect(map, 1, 24, 20, 2, 6);

  setRect(map, 1, 11, 24, 4, 1);
  setTiles(map, 1, [
    [11, 25],
    [14, 25],
  ]);
}

function applyStageFiveLayout(map) {
  clearMap(map);

  setRect(map, 1, 2, 1, 2, 3);
  setRect(map, 2, 6, 0, 2, 4);
  setRect(map, 2, 14, 0, 2, 2);
  setRect(map, 1, 14, 2, 2, 4);
  setRect(map, 1, 18, 2, 2, 7);
  setRect(map, 1, 22, 2, 2, 3);
  setRect(map, 2, 20, 4, 2, 4);

  setRect(map, 4, 0, 7, 2, 4);
  setRect(map, 1, 6, 5, 2, 10);
  setRect(map, 2, 12, 7, 2, 3);
  setRect(map, 2, 24, 7, 2, 2);
  setRect(map, 1, 22, 7, 2, 2);
  setRect(map, 4, 20, 7, 2, 6);

  setRect(map, 1, 2, 11, 8, 2);
  setRect(map, 4, 8, 11, 6, 3);
  setRect(map, 2, 14, 10, 2, 3);
  setRect(map, 2, 6, 13, 2, 4);
  setRect(map, 1, 10, 13, 2, 7);
  setRect(map, 1, 14, 13, 2, 7);
  setRect(map, 1, 18, 13, 2, 2);
  setRect(map, 1, 22, 11, 2, 7);

  setRect(map, 1, 2, 16, 2, 9);
  setRect(map, 1, 6, 17, 2, 6);
  setRect(map, 1, 10, 19, 6, 3);
  setRect(map, 1, 18, 18, 4, 2);
  setRect(map, 2, 20, 18, 2, 2);
  setRect(map, 1, 18, 22, 2, 3);
  setRect(map, 1, 22, 22, 2, 3);
  setRect(map, 1, 6, 25, 2, 1);

  setRect(map, 1, 11, 24, 4, 1);
  setTiles(map, 1, [
    [11, 25],
    [14, 25],
  ]);
}

function applyStageSixLayout(map) {
  clearMap(map);

  setRect(map, 4, 2, 0, 4, 4);
  setRect(map, 4, 4, 4, 2, 4);
  setRect(map, 1, 2, 6, 2, 2);
  setRect(map, 1, 6, 3, 2, 2);
  setRect(map, 1, 4, 8, 2, 2);
  setRect(map, 1, 0, 10, 2, 2);

  setRect(map, 2, 6, 9, 4, 2);
  setRect(map, 1, 10, 7, 2, 4);
  setRect(map, 1, 12, 6, 2, 2);
  setRect(map, 2, 12, 8, 2, 2);
  setRect(map, 3, 12, 10, 2, 8);
  setRect(map, 3, 8, 14, 2, 10);

  setRect(map, 1, 2, 14, 6, 2);
  setRect(map, 4, 2, 16, 2, 4);
  setRect(map, 1, 4, 16, 2, 8);
  setRect(map, 1, 2, 23, 7, 2);
  setRect(map, 2, 0, 24, 2, 2);
  setRect(map, 4, 2, 25, 6, 1);

  setRect(map, 4, 16, 0, 4, 2);
  setRect(map, 4, 16, 2, 2, 5);
  setRect(map, 1, 14, 1, 2, 2);
  setRect(map, 1, 18, 4, 2, 2);
  setRect(map, 1, 14, 6, 4, 2);
  setRect(map, 2, 12, 6, 2, 2);

  setRect(map, 1, 14, 11, 2, 6);
  setRect(map, 2, 16, 11, 2, 2);
  setRect(map, 1, 18, 11, 2, 2);
  setRect(map, 1, 18, 13, 2, 8);
  setRect(map, 4, 16, 16, 2, 2);
  setRect(map, 1, 12, 18, 8, 2);
  setRect(map, 3, 12, 20, 2, 3);

  setRect(map, 1, 21, 0, 2, 4);
  setRect(map, 2, 24, 4, 2, 2);
  setRect(map, 1, 24, 6, 2, 3);
  setRect(map, 1, 20, 8, 2, 2);
  setRect(map, 2, 20, 10, 2, 1);
  setRect(map, 1, 22, 14, 4, 2);
  setRect(map, 1, 24, 17, 2, 3);
  setRect(map, 1, 22, 20, 4, 2);

  setRect(map, 4, 16, 23, 4, 2);
  setRect(map, 1, 11, 24, 4, 1);
  setTiles(map, 1, [
    [11, 25],
    [14, 25],
  ]);
}

function applyStageSevenLayout(map) {
  clearMap(map);

  setRect(map, 4, 4, 0, 4, 4);
  setRect(map, 4, 4, 4, 2, 4);
  setRect(map, 1, 2, 3, 2, 2);
  setRect(map, 1, 6, 5, 2, 2);
  setRect(map, 2, 0, 8, 2, 2);
  setRect(map, 1, 2, 8, 4, 2);
  setRect(map, 3, 0, 10, 2, 10);
  setRect(map, 1, 2, 12, 2, 6);
  setRect(map, 2, 4, 12, 2, 2);
  setRect(map, 1, 6, 12, 2, 7);
  setRect(map, 4, 4, 17, 2, 2);
  setRect(map, 1, 0, 20, 8, 2);
  setRect(map, 3, 0, 22, 2, 4);
  setRect(map, 4, 2, 25, 6, 1);

  setRect(map, 1, 10, 2, 2, 5);
  setRect(map, 1, 14, 2, 2, 5);
  setRect(map, 2, 12, 6, 2, 2);
  setRect(map, 1, 12, 8, 2, 3);
  setRect(map, 1, 8, 9, 2, 2);
  setRect(map, 2, 8, 10, 2, 1);
  setRect(map, 1, 16, 9, 2, 2);
  setRect(map, 1, 10, 13, 6, 2);
  setRect(map, 1, 10, 15, 2, 3);
  setRect(map, 1, 12, 17, 2, 2);
  setRect(map, 1, 14, 19, 2, 2);
  setRect(map, 1, 10, 21, 6, 2);

  setRect(map, 4, 18, 0, 4, 4);
  setRect(map, 4, 20, 4, 2, 4);
  setRect(map, 1, 22, 3, 2, 2);
  setRect(map, 1, 18, 5, 2, 2);
  setRect(map, 1, 20, 8, 2, 2);
  setRect(map, 2, 22, 8, 4, 2);
  setRect(map, 1, 18, 12, 6, 2);
  setRect(map, 4, 18, 14, 2, 4);
  setRect(map, 1, 22, 14, 2, 6);
  setRect(map, 3, 24, 12, 2, 10);
  setRect(map, 1, 18, 20, 8, 2);
  setRect(map, 3, 24, 22, 2, 2);
  setRect(map, 4, 20, 25, 4, 1);
  setRect(map, 2, 18, 25, 2, 1);

  setRect(map, 1, 11, 24, 4, 1);
  setTiles(map, 1, [
    [11, 25],
    [14, 25],
  ]);
}

function applyStageEightLayout(map) {
  clearMap(map);

  setRect(map, 1, 0, 3, 4, 3);
  setRect(map, 1, 0, 6, 1, 8);
  setRect(map, 1, 2, 7, 2, 4);
  setRect(map, 1, 0, 16, 4, 2);
  setRect(map, 2, 0, 16, 2, 2);
  setRect(map, 1, 0, 18, 2, 7);
  setRect(map, 1, 4, 18, 2, 8);
  setRect(map, 2, 5, 25, 1, 1);

  setRect(map, 4, 4, 4, 8, 2);
  setRect(map, 4, 4, 6, 2, 12);
  setRect(map, 4, 6, 10, 5, 2);
  setRect(map, 4, 10, 6, 2, 4);
  setRect(map, 4, 10, 12, 2, 4);
  setRect(map, 2, 8, 12, 2, 2);
  setRect(map, 2, 12, 12, 2, 2);
  setRect(map, 1, 8, 6, 2, 4);

  setRect(map, 1, 8, 16, 8, 2);
  setRect(map, 1, 10, 18, 8, 2);
  setRect(map, 4, 14, 14, 2, 4);
  setRect(map, 4, 16, 12, 2, 4);
  setRect(map, 2, 16, 14, 2, 2);

  setRect(map, 1, 8, 22, 4, 1);
  setRect(map, 1, 14, 22, 4, 1);

  setRect(map, 1, 8, 1, 8, 2);
  setRect(map, 1, 14, 3, 4, 2);
  setRect(map, 1, 14, 5, 2, 2);
  setRect(map, 1, 14, 8, 4, 2);
  setRect(map, 1, 14, 10, 2, 4);
  setRect(map, 2, 16, 13, 2, 2);

  setRect(map, 4, 18, 4, 2, 12);
  setRect(map, 1, 20, 4, 4, 2);
  setRect(map, 1, 20, 6, 2, 4);
  setRect(map, 1, 20, 12, 6, 2);
  setRect(map, 4, 22, 6, 3, 6);
  setRect(map, 4, 22, 12, 2, 4);

  setRect(map, 1, 22, 1, 4, 4);
  setRect(map, 1, 24, 5, 2, 4);
  setRect(map, 1, 24, 18, 2, 8);
  setRect(map, 1, 20, 16, 6, 2);
  setRect(map, 1, 20, 18, 2, 4);
  setRect(map, 1, 20, 24, 6, 2);

  setRect(map, 1, 11, 24, 4, 1);
  setTiles(map, 1, [
    [11, 25],
    [14, 25],
  ]);
}

function applyStageNineLayout(map) {
  clearMap(map);

  setRect(map, 2, 4, 0, 4, 1);
  setRect(map, 2, 0, 2, 2, 2);
  setRect(map, 1, 2, 2, 6, 2);
  setRect(map, 2, 8, 2, 4, 2);
  setRect(map, 1, 12, 2, 4, 2);

  setRect(map, 2, 6, 4, 2, 2);
  setRect(map, 1, 10, 4, 2, 4);
  setRect(map, 2, 14, 4, 2, 2);
  setRect(map, 1, 16, 4, 2, 2);
  setRect(map, 3, 18, 4, 2, 2);
  setRect(map, 2, 20, 3, 4, 1);
  setRect(map, 4, 20, 4, 4, 4);

  setRect(map, 2, 2, 6, 2, 2);
  setRect(map, 1, 4, 6, 4, 2);
  setRect(map, 1, 6, 8, 2, 4);
  setRect(map, 4, 2, 10, 4, 2);
  setRect(map, 2, 8, 10, 2, 2);
  setRect(map, 1, 10, 10, 6, 2);
  setRect(map, 2, 16, 10, 2, 4);
  setRect(map, 2, 20, 10, 2, 2);
  setRect(map, 1, 22, 10, 4, 2);

  setRect(map, 2, 0, 12, 2, 2);
  setRect(map, 1, 2, 12, 4, 2);
  setRect(map, 2, 6, 12, 2, 4);
  setRect(map, 2, 10, 12, 4, 2);
  setRect(map, 4, 14, 14, 2, 4);
  setRect(map, 4, 16, 14, 2, 2);
  setRect(map, 1, 18, 12, 4, 2);
  setRect(map, 1, 20, 14, 2, 4);
  setRect(map, 1, 24, 12, 2, 6);

  setRect(map, 4, 2, 14, 2, 2);
  setRect(map, 3, 2, 16, 2, 5);
  setRect(map, 2, 4, 14, 2, 5);
  setRect(map, 2, 10, 14, 2, 2);
  setRect(map, 4, 12, 14, 2, 4);
  setRect(map, 2, 12, 18, 4, 2);
  setRect(map, 2, 18, 16, 1, 2);
  setRect(map, 2, 20, 16, 1, 2);

  setRect(map, 3, 0, 20, 4, 2);
  setRect(map, 1, 2, 22, 2, 2);
  setRect(map, 2, 0, 25, 8, 1);
  setRect(map, 1, 14, 20, 6, 2);
  setRect(map, 1, 18, 18, 2, 3);
  setRect(map, 2, 20, 21, 4, 2);
  setRect(map, 2, 18, 23, 4, 2);
  setRect(map, 2, 24, 25, 2, 1);

  setRect(map, 1, 11, 24, 4, 1);
  setTiles(map, 1, [
    [11, 25],
    [14, 25],
  ]);
}

function applyStageTenLayout(map) {
  clearMap(map);

  setRect(map, 2, 4, 0, 2, 2);
  setRect(map, 1, 6, 0, 2, 4);
  setRect(map, 2, 6, 2, 2, 2);
  setRect(map, 3, 0, 6, 4, 2);
  setRect(map, 1, 4, 6, 4, 2);
  setRect(map, 2, 8, 6, 2, 2);

  setRect(map, 4, 8, 2, 6, 2);
  setRect(map, 4, 10, 4, 6, 2);
  setRect(map, 1, 10, 6, 4, 2);
  setRect(map, 1, 12, 8, 2, 4);
  setRect(map, 2, 14, 8, 2, 1);
  setRect(map, 4, 10, 10, 2, 2);
  setRect(map, 4, 14, 10, 2, 2);

  setRect(map, 1, 8, 14, 4, 2);
  setRect(map, 1, 10, 12, 2, 2);
  setRect(map, 1, 12, 16, 8, 2);
  setRect(map, 1, 10, 18, 2, 5);
  setRect(map, 1, 12, 22, 4, 1);

  setRect(map, 2, 6, 12, 2, 2);
  setRect(map, 2, 6, 16, 2, 2);
  setRect(map, 2, 4, 20, 2, 2);
  setRect(map, 1, 4, 23, 6, 2);
  setRect(map, 2, 6, 25, 2, 1);

  setRect(map, 1, 16, 0, 2, 2);
  setRect(map, 2, 18, 0, 2, 2);
  setRect(map, 1, 18, 2, 4, 4);
  setRect(map, 2, 16, 4, 2, 2);
  setRect(map, 1, 16, 6, 2, 3);
  setRect(map, 3, 18, 6, 4, 2);
  setRect(map, 2, 24, 7, 2, 2);

  setRect(map, 1, 16, 8, 4, 2);
  setRect(map, 1, 18, 10, 2, 6);
  setRect(map, 2, 20, 16, 4, 2);
  setRect(map, 1, 22, 16, 4, 2);
  setRect(map, 1, 22, 18, 2, 4);
  setRect(map, 1, 24, 20, 2, 2);
  setRect(map, 1, 24, 22, 2, 2);

  setRect(map, 2, 20, 8, 4, 6);
  setRect(map, 2, 18, 14, 2, 4);
  setRect(map, 2, 20, 18, 4, 2);
  setRect(map, 4, 24, 10, 2, 6);

  setRect(map, 1, 18, 23, 4, 3);
  setRect(map, 1, 24, 24, 2, 1);

  setRect(map, 4, 0, 12, 2, 4);
  setRect(map, 2, 2, 10, 2, 8);
  setRect(map, 2, 1, 18, 2, 4);
  setRect(map, 2, 0, 21, 2, 2);

  setRect(map, 1, 11, 24, 4, 1);
  setTiles(map, 1, [
    [11, 25],
    [14, 25],
  ]);
}

function addTiles(map, tile, cells) {
  for (const [x, y] of cells) {
    if (map[y]?.[x] === 0) map[y][x] = tile;
  }
}

function clearMap(map) {
  for (const row of map) row.fill(0);
}

function setRect(map, tile, x, y, width, height) {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      if (map[yy]?.[xx] !== undefined) map[yy][xx] = tile;
    }
  }
}

function setTiles(map, tile, cells) {
  for (const [x, y] of cells) {
    if (map[y]?.[x] !== undefined) map[y][x] = tile;
  }
}

function clearGameplayCells() {
  return [
    [0, 0],
    [1, 0],
    [12, 0],
    [13, 0],
    [24, 0],
    [25, 0],
    [9, 24],
    [12, 25],
    [13, 25],
  ];
}

function resetGame() {
  game = makeGame();
  pauseButton.textContent = "Pause";
  mobilePauseButton.textContent = "Pause";
  syncStageSelects();
  syncHud();
  showOverlay("Tank 1990", "Defend the base. Clear all enemy tanks.", "Start Battle");
}

function startGame() {
  if (!game) resetGame();
  if (game.state === "won" || game.state === "lost") {
    game = makeGame();
  }
  game.state = "playing";
  pauseButton.textContent = "Pause";
  mobilePauseButton.textContent = "Pause";
  overlay.classList.add("hidden");
  syncHud();
}

function togglePause() {
  if (!game || (game.state !== "playing" && game.state !== "paused")) return;
  game.state = game.state === "playing" ? "paused" : "playing";
  pauseButton.textContent = game.state === "paused" ? "Resume" : "Pause";
  mobilePauseButton.textContent = game.state === "paused" ? "Resume" : "Pause";
  if (game.state === "paused") {
    showOverlay("Paused", "Take a breath, then return to the field.", "Resume");
  } else {
    overlay.classList.add("hidden");
  }
}

function showOverlay(title, body, buttonText) {
  overlay.querySelector("h1").textContent = title;
  overlay.querySelector("p").textContent = body;
  startButton.textContent = buttonText;
  overlay.classList.remove("hidden");
}

function chooseStage(stage) {
  selectedStage = normalizeStage(Number.parseInt(stage, 10));
  syncStageSelects();
  updateStageUrl();
  resetGame();
}

function syncStageSelects() {
  for (const select of stageSelects) {
    select.value = String(selectedStage);
  }
}

function updateStageUrl() {
  const url = new URL(window.location.href);
  if (selectedStage === 1) {
    url.searchParams.delete("stage");
  } else {
    url.searchParams.set("stage", String(selectedStage));
  }
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function syncHud() {
  stageValue.textContent = game.stage;
  livesValue.textContent = game.lives;
  enemiesValue.textContent = game.enemiesRemaining + game.enemies.length;
  scoreValue.textContent = game.score;
}

function update() {
  if (!game || game.state !== "playing") return;

  game.spawnTimer -= 1;
  if (game.spawnTimer <= 0 && game.enemiesRemaining > 0 && game.enemies.length < 4) {
    spawnEnemy();
    game.enemiesRemaining -= 1;
    game.spawnTimer = 110;
  }

  updatePlayer();
  for (const enemy of game.enemies) updateEnemy(enemy);
  updateBullets();
  updateSparks();
  cleanup();
  checkEndState();
  syncHud();
}

function updatePlayer() {
  const player = game.player;
  if (!player.alive) return;
  if (player.cooldown > 0) player.cooldown -= 1;
  if (game.playerInvincible > 0) game.playerInvincible -= 1;

  const dir = getInputDirection();
  if (dir) {
    player.dir = dir;
    moveEntity(player, DIRS[dir].x * player.speed, DIRS[dir].y * player.speed);
  }

  if ((keys.has(" ") || keys.has("Enter")) && player.cooldown <= 0) {
    fire(player);
  }
}

function getInputDirection() {
  const priority = ["up", "left", "down", "right"];
  for (const dir of priority) {
    if (touchDirs.has(dir)) return dir;
  }
  if (keys.has("ArrowUp") || keys.has("w") || keys.has("W")) return "up";
  if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) return "left";
  if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) return "down";
  if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) return "right";
  return null;
}

function spawnEnemy() {
  const points = [
    { x: 0, y: 0 },
    { x: 12 * TILE, y: 0 },
    { x: 24 * TILE, y: 0 },
  ];
  const point = points[game.spawnIndex % points.length];
  game.spawnIndex += 1;
  const enemy = {
    type: "enemy",
    x: point.x + 2,
    y: point.y + 2,
    w: 28,
    h: 28,
    dir: "down",
    speed: 1.15 + game.stage * 0.06,
    cooldown: 70,
    turnTimer: 30,
    alive: true,
    color: game.spawnIndex % 3 === 0 ? "#91c66d" : "#d88349",
  };
  game.enemies.push(enemy);
  addSparks(enemy.x + 14, enemy.y + 14, "#f4c23c", 18);
}

function updateEnemy(enemy) {
  enemy.cooldown -= 1;
  enemy.turnTimer -= 1;

  const baseDir = chooseBaseDirection(enemy);
  if (enemy.turnTimer <= 0) {
    enemy.dir = Math.random() < 0.62 ? baseDir : randomDir(enemy.dir);
    enemy.turnTimer = 28 + Math.random() * 80;
  }

  const moved = moveEntity(enemy, DIRS[enemy.dir].x * enemy.speed, DIRS[enemy.dir].y * enemy.speed);
  if (!moved) {
    enemy.dir = randomDir(OPPOSITE[enemy.dir]);
    enemy.turnTimer = 18;
  }

  if (enemy.cooldown <= 0 && hasLineOfSight(enemy)) {
    fire(enemy);
  }
}

function chooseBaseDirection(enemy) {
  const tx = game.base.x + game.base.w / 2;
  const ty = game.base.y + game.base.h / 2;
  const cx = enemy.x + enemy.w / 2;
  const cy = enemy.y + enemy.h / 2;
  if (Math.abs(tx - cx) > Math.abs(ty - cy)) return tx > cx ? "right" : "left";
  return ty > cy ? "down" : "up";
}

function randomDir(except) {
  const dirs = Object.keys(DIRS).filter((dir) => dir !== except);
  return dirs[Math.floor(Math.random() * dirs.length)];
}

function hasLineOfSight(enemy) {
  const player = game.player;
  const enemyCenter = center(enemy);
  const playerCenter = center(player);
  const baseCenter = center(game.base);
  const alignedWithPlayer =
    Math.abs(enemyCenter.x - playerCenter.x) < TILE * 0.55 ||
    Math.abs(enemyCenter.y - playerCenter.y) < TILE * 0.55;
  const alignedWithBase =
    Math.abs(enemyCenter.x - baseCenter.x) < TILE * 0.55 ||
    Math.abs(enemyCenter.y - baseCenter.y) < TILE * 0.55;
  return alignedWithPlayer || alignedWithBase || Math.random() < 0.012;
}

function moveEntity(entity, dx, dy) {
  const next = { ...entity, x: entity.x + dx, y: entity.y + dy };
  if (next.x < 0 || next.y < 0 || next.x + next.w > WORLD || next.y + next.h > WORLD) return false;
  if (collidesMap(next, true)) return false;
  const blockers = entity.type === "enemy" ? [game.player, ...game.enemies.filter((e) => e !== entity)] : game.enemies;
  for (const other of blockers) {
    if (rectsOverlap(next, other)) {
      const wasAlreadyOverlapping = rectsOverlap(entity, other);
      if (!wasAlreadyOverlapping || !overlapIsShrinking(entity, next, other)) return false;
    }
  }
  entity.x = snapToGridAxis(entity.x, next.x, dx);
  entity.y = snapToGridAxis(entity.y, next.y, dy);
  return true;
}

function overlapIsShrinking(current, next, other) {
  return overlapArea(next, other) < overlapArea(current, other);
}

function overlapArea(a, b) {
  const width = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return Math.max(0, width) * Math.max(0, height);
}

function snapToGridAxis(oldValue, nextValue, delta) {
  if (delta === 0) {
    const nearest = Math.round(oldValue / TILE) * TILE + 2;
    if (Math.abs(oldValue - nearest) < 3) return nearest;
  }
  return nextValue;
}

function fire(shooter) {
  const d = DIRS[shooter.dir];
  const cx = shooter.x + shooter.w / 2;
  const cy = shooter.y + shooter.h / 2;
  const offset = shooter.w / 2 + 5;
  game.bullets.push({
    owner: shooter.type,
    x: cx + d.x * offset - 4,
    y: cy + d.y * offset - 4,
    w: 8,
    h: 8,
    dir: shooter.dir,
    speed: shooter.type === "player" ? 5.6 : 4.4,
  });
  shooter.cooldown = shooter.type === "player" ? 22 : 82;
}

function updateBullets() {
  for (const bullet of game.bullets) {
    const d = DIRS[bullet.dir];
    bullet.x += d.x * bullet.speed;
    bullet.y += d.y * bullet.speed;

    if (bullet.x < -8 || bullet.y < -8 || bullet.x > WORLD + 8 || bullet.y > WORLD + 8) {
      bullet.dead = true;
      continue;
    }

    if (hitMap(bullet)) continue;
    if (rectsOverlap(bullet, game.base)) {
      bullet.dead = true;
      game.base.alive = false;
      addSparks(game.base.x + game.base.w / 2, game.base.y + game.base.h / 2, "#dd5d46", 36);
      continue;
    }

    if (bullet.owner === "player") {
      for (const enemy of game.enemies) {
        if (rectsOverlap(bullet, enemy)) {
          bullet.dead = true;
          enemy.dead = true;
          game.score += 100;
          game.enemiesKilled += 1;
          addSparks(enemy.x + 14, enemy.y + 14, "#f4c23c", 24);
          break;
        }
      }
    } else if (game.playerInvincible <= 0 && rectsOverlap(bullet, game.player)) {
      bullet.dead = true;
      damagePlayer();
    }

    for (const other of game.bullets) {
      if (other !== bullet && other.owner !== bullet.owner && rectsOverlap(bullet, other)) {
        bullet.dead = true;
        other.dead = true;
        addSparks(bullet.x, bullet.y, "#f2f0db", 8);
      }
    }
  }
}

function hitMap(bullet) {
  const cells = touchedCells(bullet);
  for (const cell of cells) {
    const tile = game.map[cell.y]?.[cell.x];
    if (!tile || tile === 3 || tile === 4) continue;
    if (tile === 1) {
      game.map[cell.y][cell.x] = 0;
      bullet.dead = true;
      addSparks(cell.x * TILE + 16, cell.y * TILE + 16, "#b56942", 8);
      return true;
    }
    if (tile === 2) {
      bullet.dead = true;
      addSparks(bullet.x + 4, bullet.y + 4, "#b8b8a8", 6);
      return true;
    }
  }
  return false;
}

function damagePlayer() {
  game.lives -= 1;
  addSparks(game.player.x + 14, game.player.y + 14, "#dd5d46", 32);
  if (game.lives <= 0) {
    game.player.alive = false;
    return;
  }
  game.player.x = PLAYER_SPAWN_X;
  game.player.y = PLAYER_SPAWN_Y;
  game.player.dir = "up";
  game.playerInvincible = 160;
}

function collidesMap(rect, blocksWater) {
  for (const cell of touchedCells(rect)) {
    const tile = game.map[cell.y]?.[cell.x];
    if (tile === 1 || tile === 2 || (blocksWater && tile === 3)) return true;
  }
  return false;
}

function touchedCells(rect) {
  const left = Math.max(0, Math.floor(rect.x / TILE));
  const right = Math.min(GRID - 1, Math.floor((rect.x + rect.w - 1) / TILE));
  const top = Math.max(0, Math.floor(rect.y / TILE));
  const bottom = Math.min(GRID - 1, Math.floor((rect.y + rect.h - 1) / TILE));
  const cells = [];
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) cells.push({ x, y });
  }
  return cells;
}

function cleanup() {
  game.bullets = game.bullets.filter((bullet) => !bullet.dead);
  game.enemies = game.enemies.filter((enemy) => !enemy.dead);
}

function checkEndState() {
  if (!game.base.alive || !game.player.alive) {
    game.state = "lost";
    showOverlay("Base Lost", "The defense line has fallen. Try again.", "Restart");
    return;
  }
  if (game.enemiesRemaining === 0 && game.enemies.length === 0) {
    game.stage += 1;
    game.enemiesRemaining = 18 + game.stage * 4;
    game.playerInvincible = 160;
    game.spawnTimer = 120;
    game.map = createMap(game.stage);
    game.player.x = PLAYER_SPAWN_X;
    game.player.y = PLAYER_SPAWN_Y;
    game.base.alive = true;
    for (const [x, y] of [
      [11, 24],
      [12, 24],
      [13, 24],
      [14, 24],
      [11, 25],
      [14, 25],
    ]) {
      game.map[y][x] = 1;
    }
  }
}

function updateSparks() {
  for (const spark of game.sparks) {
    spark.x += spark.vx;
    spark.y += spark.vy;
    spark.life -= 1;
  }
  game.sparks = game.sparks.filter((spark) => spark.life > 0);
}

function addSparks(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 2.4;
    game.sparks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 12 + Math.random() * 22,
      color,
    });
  }
}

function render() {
  ctx.clearRect(0, 0, WORLD, WORLD);
  drawBackdrop();
  drawMap(false);
  drawBase();
  drawTank(game.player);
  for (const enemy of game.enemies) drawTank(enemy);
  drawBullets();
  drawMap(true);
  drawSparks();
}

function drawBackdrop() {
  const floor = ctx.createLinearGradient(0, 0, WORLD, WORLD);
  floor.addColorStop(0, "#10160f");
  floor.addColorStop(0.55, "#080d0a");
  floor.addColorStop(1, "#060806");
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, WORLD, WORLD);
  ctx.fillStyle = "rgba(116, 130, 88, 0.06)";
  ctx.fillRect(0, 0, WORLD, 18);
  ctx.fillRect(0, 0, 18, WORLD);
  ctx.strokeStyle = "rgba(154, 170, 126, 0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= WORLD; i += TILE) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, WORLD);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(WORLD, i);
    ctx.stroke();
  }
}

function drawMap(onlyTrees) {
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      const tile = game.map[y][x];
      if (!tile) continue;
      if (onlyTrees && tile !== 4) continue;
      if (!onlyTrees && tile === 4) continue;
      const px = x * TILE;
      const py = y * TILE;
      if (tile === 1) drawBrick(px, py);
      if (tile === 2) drawSteel(px, py);
      if (tile === 3) drawWater(px, py);
      if (tile === 4) drawTrees(px, py);
    }
  }
}

function drawBrick(x, y) {
  ctx.fillStyle = "#422416";
  ctx.fillRect(x, y, TILE, TILE);

  for (let row = 0; row < 4; row += 1) {
    const offset = row % 2 === 0 ? 0 : 8;
    for (let col = -1; col < 4; col += 1) {
      const bx = x + offset + col * 16 + 1;
      const by = y + row * 8 + 1;
      if (bx < x - 1 || bx >= x + TILE) continue;
      ctx.fillStyle = "#c96f3e";
      ctx.fillRect(bx, by, 14, 6);
      ctx.fillStyle = "#ee9456";
      ctx.fillRect(bx + 1, by + 1, 11, 1);
      ctx.fillRect(bx + 1, by + 2, 1, 2);
      ctx.fillStyle = "#7d351f";
      ctx.fillRect(bx + 1, by + 5, 13, 1);
      ctx.fillRect(bx + 13, by + 2, 1, 4);
      ctx.fillStyle = "rgba(71, 30, 18, 0.5)";
      ctx.fillRect(bx + 5, by + 3, 2, 1);
      ctx.fillRect(bx + 10, by + 4, 1, 1);
    }
  }
}

function drawSteel(x, y) {
  ctx.fillStyle = "#565b56";
  ctx.fillRect(x, y, TILE, TILE);
  for (const [px, py] of [
    [2, 2],
    [17, 2],
    [2, 17],
    [17, 17],
  ]) {
    ctx.fillStyle = "#c2c4be";
    ctx.fillRect(x + px, y + py, 13, 13);
    ctx.fillStyle = "#7b817a";
    ctx.fillRect(x + px + 2, y + py + 2, 9, 9);
    ctx.fillStyle = "#d8d9d2";
    ctx.fillRect(x + px + 3, y + py + 3, 6, 1);
    ctx.fillRect(x + px + 3, y + py + 3, 1, 6);
    ctx.fillStyle = "#3d423d";
    ctx.fillRect(x + px + 10, y + py + 5, 2, 2);
    ctx.fillRect(x + px + 5, y + py + 10, 2, 2);
  }
}

function drawWater(x, y) {
  ctx.fillStyle = "#113c53";
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = "rgba(54, 152, 179, 0.35)";
  ctx.fillRect(x, y + 1, TILE, 5);
  ctx.fillStyle = "rgba(7, 28, 42, 0.32)";
  ctx.fillRect(x, y + 24, TILE, 8);
  ctx.strokeStyle = "#54c7e6";
  ctx.lineWidth = 2;
  for (const yy of [8, 17, 26]) {
    ctx.beginPath();
    ctx.moveTo(x - 2, y + yy);
    ctx.quadraticCurveTo(x + 5, y + yy - 5, x + 12, y + yy);
    ctx.quadraticCurveTo(x + 19, y + yy + 5, x + 26, y + yy);
    ctx.quadraticCurveTo(x + 31, y + yy - 4, x + 36, y + yy);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(183, 239, 245, 0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 5, y + 11);
  ctx.quadraticCurveTo(x + 12, y + 7, x + 19, y + 11);
  ctx.stroke();
}

function drawTrees(x, y) {
  ctx.fillStyle = "#1c4b2b";
  ctx.fillRect(x, y, TILE, TILE);
  const leaves = [
    [6, 8, 7, "#3f8b38"],
    [14, 7, 8, "#55a843"],
    [23, 10, 7, "#347b34"],
    [9, 18, 8, "#4fa043"],
    [19, 20, 9, "#2f7433"],
    [25, 23, 6, "#58a94a"],
  ];
  for (const [cx, cy, r, color] of leaves) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + cx, y + cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(196, 236, 104, 0.32)";
    ctx.fillRect(x + cx - 2, y + cy - 3, 3, 2);
  }
  ctx.fillStyle = "rgba(9, 30, 17, 0.35)";
  ctx.fillRect(x, y + 27, TILE, 5);
}

function drawBase() {
  const base = game.base;
  const plaqueColor = base.alive ? "#d1c27b" : "#5a342d";
  const eagleColor = base.alive ? "#504521" : "#221816";

  ctx.fillStyle = "#14100a";
  ctx.fillRect(base.x + 5, base.y + 2, 54, 28);
  ctx.fillStyle = base.alive ? "#3b2b18" : "#1c1210";
  ctx.fillRect(base.x + 7, base.y + 4, 50, 24);
  ctx.fillStyle = plaqueColor;
  ctx.fillRect(base.x + 8, base.y + 5, 48, 22);
  ctx.fillStyle = shade(plaqueColor, 20);
  ctx.fillRect(base.x + 8, base.y + 5, 48, 3);
  ctx.fillStyle = shade(plaqueColor, -22);
  ctx.fillRect(base.x + 8, base.y + 24, 48, 3);
  ctx.fillStyle = shade(plaqueColor, -36);
  ctx.fillRect(base.x + 8, base.y + 5, 2, 22);
  ctx.fillRect(base.x + 54, base.y + 5, 2, 22);

  drawPixelEagle(base.x + 12, base.y + 7, eagleColor, plaqueColor);
}

function drawPixelEagle(x, y, color, plaqueColor) {
  const pixels = [
    "1111111111111100000000000011111111111111",
    "1111111111111100011111100011111111111111",
    "0001111111111100111111100011111111111000",
    "0111111111111100001111100011111111111110",
    "0011111111111110001111100111111111111100",
    "0000011111111110011111101111111111100000",
    "0001111111111111111111111111111111111000",
    "0000000111111111111111111111111110000000",
    "0000011111111111111111111111111111100000",
    "0000011111111111111111111111111111100000",
    "0000000000111111111111111111110000000000",
    "0000000000000011111111111100000000000000",
    "0000000000000001111111111000000000000000",
    "0000000000000000111111110000000000000000",
    "0000000000000000011111100000000000000000",
    "0000000000000000111111110000000000000000",
    "0000000000000000111111111000000000000000",
    "0000000000000001111111111100000000000000",
  ];
  const size = 1;

  ctx.fillStyle = color;
  for (let row = 0; row < pixels.length; row += 1) {
    for (let col = 0; col < pixels[row].length; col += 1) {
      if (pixels[row][col] === "1") {
        ctx.fillRect(x + col * size, y + row * size, size, size);
      }
    }
  }

  ctx.fillStyle = shade(plaqueColor, 30);
  ctx.fillRect(x + 20, y + 2, 2, 1);
}

function drawTank(tank) {
  if (tank.alive === false) return;
  if (tank.type === "player" && game.playerInvincible > 0 && Math.floor(game.playerInvincible / 6) % 2 === 0) return;

  const cx = tank.x + tank.w / 2;
  const cy = tank.y + tank.h / 2;
  const accent = tank.type === "player" ? "#f8e778" : shade(tank.color, 38);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dirAngle(tank.dir));

  ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
  ctx.fillRect(-13, 11, 26, 4);

  ctx.fillStyle = "#11130f";
  ctx.fillRect(-14, -14, 7, 28);
  ctx.fillRect(7, -14, 7, 28);
  ctx.fillStyle = "#686b5f";
  for (let y = -12; y <= 10; y += 5) {
    ctx.fillRect(-13, y, 5, 2);
    ctx.fillRect(8, y, 5, 2);
  }

  ctx.fillStyle = shade(tank.color, -42);
  ctx.fillRect(-10, -13, 20, 26);
  ctx.fillStyle = tank.color;
  ctx.fillRect(-9, -12, 18, 24);
  ctx.fillStyle = shade(tank.color, 32);
  ctx.fillRect(-7, -10, 14, 2);
  ctx.fillRect(-7, -10, 2, 12);
  ctx.fillStyle = shade(tank.color, -28);
  ctx.fillRect(6, -10, 2, 20);
  ctx.fillRect(-7, 9, 14, 2);

  ctx.fillStyle = shade(tank.color, -55);
  ctx.fillRect(-5, -6, 10, 12);
  ctx.fillStyle = accent;
  ctx.fillRect(-3, -4, 6, 8);
  ctx.fillStyle = shade(tank.color, -68);
  ctx.fillRect(-1, -2, 2, 4);

  ctx.fillStyle = "#d8d7c7";
  ctx.fillRect(-2, -22, 4, 13);
  ctx.fillStyle = "#8e9185";
  ctx.fillRect(2, -21, 2, 10);
  ctx.fillStyle = "#e8e6d1";
  ctx.fillRect(-3, -23, 6, 3);

  ctx.fillStyle = shade(tank.color, -65);
  for (const [bx, by] of [
    [-8, -11],
    [6, -11],
    [-8, 9],
    [6, 9],
  ]) {
    ctx.fillRect(bx, by, 2, 2);
  }

  ctx.restore();
}

function drawBullets() {
  for (const bullet of game.bullets) {
    const glow = bullet.owner === "player" ? "rgba(86, 190, 255, 0.35)" : "rgba(255, 111, 54, 0.35)";
    ctx.fillStyle = glow;
    ctx.fillRect(bullet.x - 3, bullet.y - 3, bullet.w + 6, bullet.h + 6);
    ctx.fillStyle = bullet.owner === "player" ? "#84d9ff" : "#ff9c38";
    ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
    ctx.fillStyle = "#fffbd0";
    ctx.fillRect(bullet.x + 1, bullet.y + 1, Math.max(1, bullet.w - 2), Math.max(1, bullet.h - 2));
  }
}

function drawSparks() {
  for (const spark of game.sparks) {
    ctx.globalAlpha = Math.max(0, spark.life / 30);
    ctx.fillStyle = spark.color;
    ctx.fillRect(spark.x, spark.y, 3, 3);
  }
  ctx.globalAlpha = 1;
}

function dirAngle(dir) {
  if (dir === "right") return Math.PI / 2;
  if (dir === "down") return Math.PI;
  if (dir === "left") return -Math.PI / 2;
  return 0;
}

function shade(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (value >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((value >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (value & 255) + amount));
  return `rgb(${r}, ${g}, ${b})`;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function center(rect) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

function frame(time) {
  if (!lastTime) lastTime = time;
  accumulator += Math.min(100, time - lastTime);
  lastTime = time;
  while (accumulator >= STEP) {
    update();
    accumulator -= STEP;
  }
  render();
  requestAnimationFrame(frame);
}

function pressDir(dir, pressed) {
  if (pressed) touchDirs.add(dir);
  else touchDirs.delete(dir);
}

window.addEventListener("keydown", (event) => {
  if (event.target?.matches?.("[data-stage-select]")) return;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Enter"].includes(event.key)) {
    event.preventDefault();
  }
  keys.add(event.key);
  if ((event.key === "p" || event.key === "P") && game?.state !== "ready") togglePause();
  if (event.key === " " && game?.state === "ready") startGame();
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key);
});

document.querySelectorAll(".touch-button").forEach((button) => {
  const dir = button.dataset.dir;
  let activePointerId = null;

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    activePointerId = event.pointerId;
    button.setPointerCapture(event.pointerId);
    pressDir(dir, true);
  });

  const releaseDirection = (event) => {
    if (activePointerId !== event.pointerId) return;
    activePointerId = null;
    pressDir(dir, false);
  };

  button.addEventListener("pointerup", releaseDirection);
  button.addEventListener("pointercancel", releaseDirection);
  button.addEventListener("lostpointercapture", releaseDirection);
});

let firePointerId = null;

fireButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  firePointerId = event.pointerId;
  fireButton.setPointerCapture(event.pointerId);
  keys.add(" ");
});

const releaseFire = (event) => {
  if (firePointerId !== event.pointerId) return;
  firePointerId = null;
  keys.delete(" ");
};

fireButton.addEventListener("pointerup", releaseFire);
fireButton.addEventListener("pointercancel", releaseFire);
fireButton.addEventListener("lostpointercapture", releaseFire);

startButton.addEventListener("click", () => {
  if (game?.state === "paused") {
    togglePause();
  } else {
    startGame();
  }
});
pauseButton.addEventListener("click", togglePause);
mobilePauseButton.addEventListener("click", togglePause);
restartButton.addEventListener("click", () => {
  resetGame();
  startGame();
});
mobileRestartButton.addEventListener("click", () => {
  resetGame();
  startGame();
});
stageSelects.forEach((select) => {
  select.addEventListener("change", () => chooseStage(select.value));
});

resetGame();
requestAnimationFrame(frame);
