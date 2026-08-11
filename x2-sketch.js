// Fixed 2× device-pixel renderer.
// p5 creates the HiDPI canvas; artwork is written directly to its backing
// store. One conceptual pixel is always an explicit 2×2 binary block.

const PIXEL_SIZE = 2;

const BAYER_8 = [
  0, 48, 12, 60, 3, 51, 15, 63,
  32, 16, 44, 28, 35, 19, 47, 31,
  8, 56, 4, 52, 11, 59, 7, 55,
  40, 24, 36, 20, 43, 27, 39, 23,
  2, 50, 14, 62, 1, 49, 13, 61,
  34, 18, 46, 30, 33, 17, 45, 29,
  10, 58, 6, 54, 9, 57, 5, 53,
  42, 26, 38, 22, 41, 25, 37, 21,
];

const PATTERNS = [
  { name: 'Checker', render: renderChecker },
  { name: '8×8 Bayer ordered', render: renderBayer },
  { name: '1px line screens', render: renderLines },
  { name: 'Floyd–Steinberg', render: renderFloydSteinberg },
];

let canvas;
let artwork;
let artworkPixels;
let bufferWidth = 0;
let bufferHeight = 0;
let displayDpr = 1;
let dprQuery;
let selectedPattern = -1;
let inverted = false;
let panels = [];

function setup() {
  const host = document.querySelector('#canvas-host');
  displayDpr = readDpr();
  pixelDensity(displayDpr);
  canvas = createCanvas(host.clientWidth, host.clientHeight);
  canvas.parent(host);
  canvas.elt.style.imageRendering = 'pixelated';
  noSmooth();
  noLoop();
  bindControls();
  watchDpr();
}

function draw() {
  drawingContext.imageSmoothingEnabled = false;
  bufferWidth = canvas.elt.width;
  bufferHeight = canvas.elt.height;
  artwork = drawingContext.createImageData(bufferWidth, bufferHeight);
  artworkPixels = artwork.data;
  fillCanvas(false);

  if (selectedPattern < 0) renderGallery();
  else PATTERNS[selectedPattern].render(0, 0, bufferWidth, bufferHeight);

  if (inverted) invertCanvas();
  drawingContext.putImageData(artwork, 0, 0);
  updateUi();
}

function renderGallery() {
  const gap = Math.max(2, Math.round(displayDpr * 3));
  const margin = gap;
  const panelWidth = Math.floor((bufferWidth - margin * 2 - gap) / 2);
  const panelHeight = Math.floor((bufferHeight - margin * 2 - gap) / 2);
  panels = [];

  for (let index = 0; index < PATTERNS.length; index += 1) {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + column * (panelWidth + gap);
    const y = margin + row * (panelHeight + gap);
    const w = column === 1 ? bufferWidth - margin - x : panelWidth;
    const h = row === 1 ? bufferHeight - margin - y : panelHeight;
    drawOutline(x, y, w, h);
    PATTERNS[index].render(x + 1, y + 1, w - 2, h - 2);
    panels.push({ x, y, w, h, index });
  }
}

function renderChecker(x, y, w, h) {
  for (let py = y; py < y + h; py += 1) {
    const sy = Math.floor((py - y) / PIXEL_SIZE);
    for (let px = x; px < x + w; px += 1) {
      const sx = Math.floor((px - x) / PIXEL_SIZE);
      setPixel(px, py, (sx + sy) % 2 === 0);
    }
  }
}

function renderBayer(x, y, w, h) {
  for (let py = y; py < y + h; py += 1) {
    const sy = Math.floor((py - y) / PIXEL_SIZE);
    for (let px = x; px < x + w; px += 1) {
      const sx = Math.floor((px - x) / PIXEL_SIZE);
      const darkness = w <= 1 ? 0.5 : (px - x) / (w - 1);
      const threshold = (BAYER_8[(sy & 7) * 8 + (sx & 7)] + 0.5) / 64;
      setPixel(px, py, darkness > threshold);
    }
  }
}

function renderLines(x, y, w, h) {
  const studies = [
    { direction: 'vertical', gap: 1 },
    { direction: 'horizontal', gap: 2 },
    { direction: 'up', gap: 4 },
    { direction: 'down', gap: 8 },
  ];

  for (let row = 0; row < 2; row += 1) {
    const dotted = row === 1;
    const top = y + Math.floor((h * row) / 2);
    const bottom = y + Math.floor((h * (row + 1)) / 2);

    for (let column = 0; column < studies.length; column += 1) {
      const study = studies[column];
      const left = x + Math.floor((w * column) / studies.length);
      const right = x + Math.floor((w * (column + 1)) / studies.length);
      const period = study.gap + 1;

      for (let py = top; py < bottom; py += 1) {
        const sy = Math.floor((py - top) / PIXEL_SIZE);
        for (let px = left; px < right; px += 1) {
          const sx = Math.floor((px - left) / PIXEL_SIZE);
          const line = isOnLine(study.direction, sx, sy, period);
          const dot = !dotted || isOnDot(study.direction, sx, sy, period);
          setPixel(px, py, line && dot);
        }
      }
      if (column > 0) drawVertical(left, top, bottom - top);
      if (row > 0) drawHorizontal(left, top, right - left);
    }
  }
}

function isOnLine(direction, x, y, period) {
  if (direction === 'vertical') return x % period === 0;
  if (direction === 'horizontal') return y % period === 0;
  if (direction === 'up') return modulo(x + y, period) === 0;
  return modulo(x - y, period) === 0;
}

function isOnDot(direction, x, y, period) {
  if (direction === 'vertical') return modulo(y + Math.floor(x / period), 3) === 0;
  if (direction === 'horizontal') return modulo(x + Math.floor(y / period), 3) === 0;
  if (direction === 'up') return modulo(x - y + Math.floor((x + y) / period) * 2, 6) === 0;
  return modulo(x + y + Math.floor((x - y) / period) * 2, 6) === 0;
}

function renderFloydSteinberg(x, y, w, h) {
  const logicalWidth = Math.max(1, Math.ceil(w / PIXEL_SIZE));
  const logicalHeight = Math.max(1, Math.ceil(h / PIXEL_SIZE));
  const output = new Uint8Array(logicalWidth * logicalHeight);
  let currentError = new Float32Array(logicalWidth + 2);
  let nextError = new Float32Array(logicalWidth + 2);

  for (let row = 0; row < logicalHeight; row += 1) {
    for (let column = 0; column < logicalWidth; column += 1) {
      const nx = logicalWidth <= 1 ? 0 : column / (logicalWidth - 1);
      const ny = logicalHeight <= 1 ? 0 : row / (logicalHeight - 1);
      const wave = 0.14 * Math.sin(nx * Math.PI * 8) * Math.sin(ny * Math.PI * 3);
      const source = clamp01(nx + wave);
      const value = clamp01(source + currentError[column + 1]);
      const bit = value >= 0.5 ? 1 : 0;
      const error = value - bit;
      output[row * logicalWidth + column] = bit;
      currentError[column + 2] += error * (7 / 16);
      nextError[column] += error * (3 / 16);
      nextError[column + 1] += error * (5 / 16);
      nextError[column + 2] += error * (1 / 16);
    }
    currentError = nextError;
    nextError = new Float32Array(logicalWidth + 2);
  }

  for (let py = 0; py < h; py += 1) {
    const sy = Math.min(logicalHeight - 1, Math.floor(py / PIXEL_SIZE));
    for (let px = 0; px < w; px += 1) {
      const sx = Math.min(logicalWidth - 1, Math.floor(px / PIXEL_SIZE));
      setPixel(x + px, y + py, output[sy * logicalWidth + sx] === 1);
    }
  }
}

function mousePressed() {
  if (selectedPattern >= 0) return;
  const px = Math.floor((mouseX / width) * bufferWidth);
  const py = Math.floor((mouseY / height) * bufferHeight);
  const hit = panels.find((panel) => px >= panel.x && px < panel.x + panel.w && py >= panel.y && py < panel.y + panel.h);
  if (hit) selectPattern(hit.index);
}

function keyPressed() {
  if (key >= '1' && key <= '4') selectPattern(Number(key) - 1);
  else if (key === 'g' || key === 'G' || keyCode === ESCAPE) selectPattern(-1);
  else if (key === 'i' || key === 'I') { inverted = !inverted; redraw(); }
  else if (key === 's' || key === 'S') saveCanvas(canvas, `halftone-fixed-2x-${bufferWidth}x${bufferHeight}`, 'png');
}

function bindControls() {
  document.querySelectorAll('[data-pattern]').forEach((button) => {
    button.addEventListener('click', () => selectPattern(Number(button.dataset.pattern)));
  });
  document.querySelector('[data-gallery]').addEventListener('click', () => selectPattern(-1));
}

function selectPattern(index) { selectedPattern = index; redraw(); }

function updateUi() {
  document.querySelector('#display-metrics').textContent =
    `DPR ${formatNumber(displayDpr)} · CSS ${width}×${height} · buffer ${bufferWidth}×${bufferHeight} · conceptual pixel 2×2`;
  document.querySelector('#view-status').textContent = selectedPattern < 0
    ? 'Gallery · Click a panel · I invert · S save'
    : `${PATTERNS[selectedPattern].name} · Esc/G gallery · I invert · S save`;
  document.querySelectorAll('[data-pattern]').forEach((button) => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.pattern) === selectedPattern));
  });
}

function windowResized() {
  const host = document.querySelector('#canvas-host');
  const nextDpr = readDpr();
  if (nextDpr !== displayDpr) {
    displayDpr = nextDpr;
    pixelDensity(displayDpr);
    watchDpr();
  }
  resizeCanvas(host.clientWidth, host.clientHeight, true);
  drawingContext.imageSmoothingEnabled = false;
  redraw();
}

function watchDpr() {
  if (dprQuery) dprQuery.removeEventListener('change', windowResized);
  dprQuery = window.matchMedia(`(resolution: ${displayDpr}dppx)`);
  dprQuery.addEventListener('change', windowResized, { once: true });
}

function setPixel(x, y, black) {
  if (x < 0 || y < 0 || x >= bufferWidth || y >= bufferHeight) return;
  const value = black ? 0 : 255;
  const index = (y * bufferWidth + x) * 4;
  artworkPixels[index] = value;
  artworkPixels[index + 1] = value;
  artworkPixels[index + 2] = value;
  artworkPixels[index + 3] = 255;
}

function fillCanvas(black) {
  const value = black ? 0 : 255;
  for (let index = 0; index < artworkPixels.length; index += 4) {
    artworkPixels[index] = value;
    artworkPixels[index + 1] = value;
    artworkPixels[index + 2] = value;
    artworkPixels[index + 3] = 255;
  }
}

function invertCanvas() {
  for (let index = 0; index < artworkPixels.length; index += 4) {
    artworkPixels[index] = 255 - artworkPixels[index];
    artworkPixels[index + 1] = 255 - artworkPixels[index + 1];
    artworkPixels[index + 2] = 255 - artworkPixels[index + 2];
  }
}

function drawOutline(x, y, w, h) {
  drawHorizontal(x, y, w); drawHorizontal(x, y + h - 1, w);
  drawVertical(x, y, h); drawVertical(x + w - 1, y, h);
}

function drawHorizontal(x, y, length) { for (let px = x; px < x + length; px += 1) setPixel(px, y, true); }
function drawVertical(x, y, length) { for (let py = y; py < y + length; py += 1) setPixel(x, py, true); }
function modulo(value, modulus) { return ((value % modulus) + modulus) % modulus; }
function clamp01(value) { return Math.max(0, Math.min(1, value)); }
function readDpr() { return Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1; }
function formatNumber(value) { return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, ''); }
