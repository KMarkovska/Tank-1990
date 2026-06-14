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

const TILE = 32;
const GRID = 26;
const WORLD = TILE * GRID;
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

function makeGame() {
  return {
    state: "ready",
    stage: 1,
    score: 0,
    lives: 3,
    enemiesRemaining: 18,
    enemiesKilled: 0,
    spawnTimer: 0,
    spawnIndex: 0,
    playerInvincible: 120,
    message: "Tank 1990",
    map: createMap(),
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

function createMap() {
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

  return map;
}

function resetGame() {
  game = makeGame();
  pauseButton.textContent = "Pause";
  mobilePauseButton.textContent = "Pause";
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
    if (!tile || tile === 4) continue;
    if (tile === 1) {
      game.map[cell.y][cell.x] = 0;
      bullet.dead = true;
      addSparks(cell.x * TILE + 16, cell.y * TILE + 16, "#b56942", 8);
      return true;
    }
    if (tile === 2 || tile === 3) {
      bullet.dead = true;
      addSparks(bullet.x + 4, bullet.y + 4, tile === 2 ? "#b8b8a8" : "#7bb8c8", 6);
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
    game.map = createMap();
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
  ctx.fillStyle = "#11130f";
  ctx.fillRect(0, 0, WORLD, WORLD);
  ctx.strokeStyle = "rgba(255,255,255,0.035)";
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
  ctx.fillStyle = "#8e4933";
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = "#b86942";
  for (let row = 0; row < 4; row += 1) {
    const offset = row % 2 === 0 ? 0 : 8;
    for (let col = -1; col < 4; col += 1) {
      ctx.fillRect(x + offset + col * 16 + 1, y + row * 8 + 1, 14, 6);
    }
  }
}

function drawSteel(x, y) {
  ctx.fillStyle = "#9fa49c";
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = "#60665f";
  ctx.fillRect(x + 4, y + 4, 10, 10);
  ctx.fillRect(x + 18, y + 4, 10, 10);
  ctx.fillRect(x + 4, y + 18, 10, 10);
  ctx.fillRect(x + 18, y + 18, 10, 10);
}

function drawWater(x, y) {
  ctx.fillStyle = "#275f73";
  ctx.fillRect(x, y, TILE, TILE);
  ctx.strokeStyle = "#79bed0";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + 10);
  ctx.quadraticCurveTo(x + 12, y + 4, x + 20, y + 10);
  ctx.quadraticCurveTo(x + 26, y + 15, x + 32, y + 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y + 23);
  ctx.quadraticCurveTo(x + 8, y + 17, x + 16, y + 23);
  ctx.quadraticCurveTo(x + 24, y + 29, x + 32, y + 23);
  ctx.stroke();
}

function drawTrees(x, y) {
  ctx.fillStyle = "rgba(30, 94, 45, 0.84)";
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = "rgba(88, 145, 68, 0.72)";
  ctx.beginPath();
  ctx.arc(x + 10, y + 11, 9, 0, Math.PI * 2);
  ctx.arc(x + 21, y + 12, 10, 0, Math.PI * 2);
  ctx.arc(x + 16, y + 22, 9, 0, Math.PI * 2);
  ctx.fill();
}

function drawBase() {
  const base = game.base;
  const plaqueColor = base.alive ? "#d1c27b" : "#5a342d";
  const eagleColor = base.alive ? "#504521" : "#221816";

  ctx.fillStyle = plaqueColor;
  ctx.fillRect(base.x + 8, base.y + 5, 48, 22);
  ctx.fillStyle = shade(plaqueColor, 20);
  ctx.fillRect(base.x + 8, base.y + 5, 48, 3);
  ctx.fillStyle = shade(plaqueColor, -22);
  ctx.fillRect(base.x + 8, base.y + 24, 48, 3);

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
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dirAngle(tank.dir));
  ctx.fillStyle = "#191c17";
  ctx.fillRect(-14, -14, 7, 28);
  ctx.fillRect(7, -14, 7, 28);
  ctx.fillStyle = tank.color;
  ctx.fillRect(-9, -12, 18, 24);
  ctx.fillStyle = shade(tank.color, -35);
  ctx.fillRect(-5, -8, 10, 16);
  ctx.fillStyle = "#dad6ab";
  ctx.fillRect(-3, -21, 6, 18);
  ctx.fillStyle = "#0b0c0a";
  for (let y = -11; y <= 9; y += 8) {
    ctx.fillRect(-13, y, 5, 4);
    ctx.fillRect(8, y, 5, 4);
  }
  ctx.restore();
}

function drawBullets() {
  for (const bullet of game.bullets) {
    ctx.fillStyle = bullet.owner === "player" ? "#fff3a5" : "#ff8b66";
    ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
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

resetGame();
requestAnimationFrame(frame);
