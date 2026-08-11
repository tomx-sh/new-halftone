// Device-pixel halftone experiments for p5.js 2.
//
// p5's width/height use CSS pixels. canvas.elt.width/height are the actual
// backing-store samples. All artwork below is written to those samples
// directly, so no shape rasterizer, antialiasing, or interpolation is involved.

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

const GLYPHS = {
  ' ': ['000', '000', '000', '000', '000', '000', '000'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  '.': ['000', '000', '000', '000', '000', '000', '010'],
  ':': ['000', '010', '000', '000', '010', '000', '000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '+': ['000', '010', '010', '111', '010', '010', '000'],
  '-': ['000', '000', '000', '111', '000', '000', '000'],
  '=': ['000', '000', '111', '000', '111', '000', '000'],
};

const PATTERNS = [
  { title: '1  PHYSICAL PIXEL CHECKER', render: renderChecker },
  { title: '2  8X8 BAYER ORDERED', render: renderBayer },
  { title: '3  1PX LINE SCREEN STUDIES', render: renderLines },
  { title: '4  FLOYD-STEINBERG', render: renderFloydSteinberg },
];

let canvas;
let imageData;
let buffer;
let bufferWidth = 0;
let bufferHeight = 0;
let reportedDpr = 1;
let dprQuery;
let selectedPattern = -1;
let inverted = false;
let panelRects = [];
let calibrationScale = 1;
let calibrationRedrawPending = false;

function setup() {
  reportedDpr = readDevicePixelRatio();
  pixelDensity(reportedDpr);
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.elt.setAttribute('aria-label', 'A gallery of four black and white device-pixel halftone patterns.');
  canvas.elt.style.imageRendering = 'pixelated';
  noSmooth();
  noLoop();
  createCalibrationControls();
  watchDevicePixelRatio();
}

function draw() {
  drawingContext.imageSmoothingEnabled = false;
  bufferWidth = canvas.elt.width;
  bufferHeight = canvas.elt.height;
  imageData = drawingContext.createImageData(bufferWidth, bufferHeight);
  buffer = imageData.data;
  fillBuffer(255);

  if (selectedPattern < 0) renderGallery();
  else renderSolo(selectedPattern);

  if (inverted) invertBuffer();
  drawingContext.putImageData(imageData, 0, 0);
}

function renderGallery() {
  const scale = Math.max(1, Math.round(reportedDpr));
  const margin = 8 * scale;
  const gap = 5 * scale;
  const headerHeight = 82 * scale;
  const columns = windowWidth >= 680 ? 2 : 1;
  const rows = Math.ceil(PATTERNS.length / columns);
  const panelWidth = Math.floor((bufferWidth - margin * 2 - gap * (columns - 1)) / columns);
  const panelHeight = Math.floor((bufferHeight - headerHeight - margin - gap * (rows - 1)) / rows);

  drawText('DEVICE PIXEL HALFTONE LAB', margin, 7 * scale, scale, 0);
  const metrics = `DPR ${formatDpr(reportedDpr)}  CSS ${windowWidth}X${windowHeight}  BUFFER ${bufferWidth}X${bufferHeight}`;
  drawText(metrics, margin, 20 * scale, scale, 0);
  drawText('1 SAMPLE = 1 CANVAS BACKING PIXEL  /  CLICK A PANEL  /  I INVERTS', margin, 33 * scale, scale, 0);
  drawText(`CALIBRATION ${formatScale(calibrationScale)}X  /  VERTICAL AND HORIZONTAL 1PX STRIPES`, margin, 46 * scale, scale, 0);
  renderCalibrationStrip(margin, 58 * scale, calibrationTargetWidth(margin), 16 * scale);
  drawHorizontalLine(0, headerHeight - 1, bufferWidth, 0);

  panelRects = [];
  for (let i = 0; i < PATTERNS.length; i += 1) {
    const column = i % columns;
    const row = Math.floor(i / columns);
    const x = margin + column * (panelWidth + gap);
    const y = headerHeight + row * (panelHeight + gap);
    const w = column === columns - 1 ? bufferWidth - margin - x : panelWidth;
    const h = row === rows - 1 ? bufferHeight - margin - y : panelHeight;
    renderPanel(i, x, y, w, h, scale);
    panelRects.push({ x, y, w, h, index: i });
  }
}

function renderPanel(index, x, y, w, h, scale) {
  const labelHeight = 13 * scale;
  drawRectOutline(x, y, w, h, 0);
  drawText(PATTERNS[index].title, x + 5 * scale, y + 3 * scale, scale, 0);
  drawHorizontalLine(x, y + labelHeight, w, 0);
  PATTERNS[index].render(x + 1, y + labelHeight + 1, w - 2, h - labelHeight - 2);
}

function renderSolo(index) {
  const scale = Math.max(1, Math.round(reportedDpr));
  const headerHeight = 54 * scale;
  drawText(`${PATTERNS[index].title}  /  ESC GALLERY  /  I INVERTS`, 7 * scale, 8 * scale, scale, 0);
  drawText(`CALIBRATION ${formatScale(calibrationScale)}X  /  1PX VERTICAL AND HORIZONTAL STRIPES`, 7 * scale, 21 * scale, scale, 0);
  renderCalibrationStrip(7 * scale, 33 * scale, calibrationTargetWidth(7 * scale), 14 * scale);
  drawHorizontalLine(0, headerHeight - 1, bufferWidth, 0);
  PATTERNS[index].render(0, headerHeight, bufferWidth, bufferHeight - headerHeight);
  panelRects = [];
}

// Each renderer receives backing-store coordinates, not p5/CSS coordinates.
function renderChecker(x, y, w, h) {
  for (let py = y; py < y + h; py += 1) {
    for (let px = x; px < x + w; px += 1) {
      const sampleX = calibratedCoordinate(px - x);
      const sampleY = calibratedCoordinate(py - y);
      setMono(px, py, (sampleX + sampleY) % 2 === 0);
    }
  }
}

function renderBayer(x, y, w, h) {
  for (let py = y; py < y + h; py += 1) {
    for (let px = x; px < x + w; px += 1) {
      const darkness = w <= 1 ? 0.5 : (px - x) / (w - 1);
      const sampleX = calibratedCoordinate(px - x);
      const sampleY = calibratedCoordinate(py - y);
      const threshold = (BAYER_8[(sampleY & 7) * 8 + (sampleX & 7)] + 0.5) / 64;
      setMono(px, py, darkness > threshold);
    }
  }
}

function renderLines(x, y, w, h) {
  // Four coherent direction studies. Each column keeps the same direction and
  // spacing; the top row is solid and the bottom row is its dotted counterpart.
  // `gap` is the exact number of white backing pixels between 1px lines.
  const studies = [
    { name: 'V', direction: 'vertical', gap: 1 },
    { name: 'H', direction: 'horizontal', gap: 2 },
    { name: '+45', direction: 'up', gap: 4 },
    { name: '-45', direction: 'down', gap: 8 },
  ];
  const scale = Math.max(1, Math.round(reportedDpr));
  const labelHeight = 12 * scale;
  const rows = 2;
  const columns = studies.length;

  for (let row = 0; row < rows; row += 1) {
    const dotted = row === 1;
    const cellY = y + Math.floor((h * row) / rows);
    const nextY = y + Math.floor((h * (row + 1)) / rows);

    for (let column = 0; column < columns; column += 1) {
      const study = studies[column];
      const cellX = x + Math.floor((w * column) / columns);
      const nextX = x + Math.floor((w * (column + 1)) / columns);
      const cellWidth = nextX - cellX;
      const cellHeight = nextY - cellY;
      const patternY = cellY + labelHeight;
      const patternHeight = cellHeight - labelHeight;
      const period = study.gap + 1;

      fillRectMono(cellX, cellY, cellWidth, cellHeight, false);
      drawText(`${study.name} ${dotted ? 'DOTTED' : 'SOLID'} GAP ${study.gap}`, cellX + 4 * scale, cellY + 3 * scale, scale, 0);
      drawHorizontalLine(cellX, patternY - 1, cellWidth, 0);

      for (let py = patternY; py < patternY + patternHeight; py += 1) {
        for (let px = cellX; px < cellX + cellWidth; px += 1) {
          const localX = calibratedCoordinate(px - cellX);
          const localY = calibratedCoordinate(py - patternY);
          const onLine = isOnOnePixelLine(study.direction, localX, localY, period);
          const onDot = !dotted || isOnDot(study.direction, localX, localY, period);
          setMono(px, py, onLine && onDot);
        }
      }

      if (column > 0) drawVerticalLine(cellX, cellY, cellHeight, 0);
      if (row > 0) drawHorizontalLine(cellX, cellY, cellWidth, 0);
    }
  }
}

function isOnOnePixelLine(direction, x, y, period) {
  if (direction === 'vertical') return x % period === 0;
  if (direction === 'horizontal') return y % period === 0;
  if (direction === 'up') return positiveModulo(x + y, period) === 0;
  return positiveModulo(x - y, period) === 0;
}

function isOnDot(direction, x, y, period) {
  // Offset each neighboring line's dot phase. Without this offset, dotted
  // verticals accidentally form horizontal stripes (and vice versa).
  if (direction === 'vertical') {
    const lineIndex = Math.floor(x / period);
    return positiveModulo(y + lineIndex, 3) === 0;
  }
  if (direction === 'horizontal') {
    const lineIndex = Math.floor(y / period);
    return positiveModulo(x + lineIndex, 3) === 0;
  }
  if (direction === 'up') {
    const lineIndex = Math.floor((x + y) / period);
    return positiveModulo(x - y + lineIndex * 2, 6) === 0;
  }
  const lineIndex = Math.floor((x - y) / period);
  return positiveModulo(x + y + lineIndex * 2, 6) === 0;
}

function renderFloydSteinberg(x, y, w, h) {
  const logicalWidth = Math.max(1, Math.ceil(w / calibrationScale));
  const logicalHeight = Math.max(1, Math.ceil(h / calibrationScale));
  const outputPixels = new Uint8Array(logicalWidth * logicalHeight);
  let currentError = new Float32Array(logicalWidth + 2);
  let nextError = new Float32Array(logicalWidth + 2);

  for (let row = 0; row < logicalHeight; row += 1) {
    for (let column = 0; column < logicalWidth; column += 1) {
      const nx = logicalWidth <= 1 ? 0 : column / (logicalWidth - 1);
      const ny = logicalHeight <= 1 ? 0 : row / (logicalHeight - 1);
      const wave = 0.14 * Math.sin(nx * Math.PI * 8) * Math.sin(ny * Math.PI * 3);
      const source = clampValue(nx + wave, 0, 1);
      const value = clampValue(source + currentError[column + 1], 0, 1);
      const output = value >= 0.5 ? 1 : 0;
      const error = value - output;
      outputPixels[row * logicalWidth + column] = output;
      currentError[column + 2] += error * (7 / 16);
      nextError[column] += error * (3 / 16);
      nextError[column + 1] += error * (5 / 16);
      nextError[column + 2] += error * (1 / 16);
    }
    currentError = nextError;
    nextError = new Float32Array(logicalWidth + 2);
  }

  for (let py = 0; py < h; py += 1) {
    const sampleY = Math.min(logicalHeight - 1, calibratedCoordinate(py));
    for (let px = 0; px < w; px += 1) {
      const sampleX = Math.min(logicalWidth - 1, calibratedCoordinate(px));
      setMono(x + px, y + py, outputPixels[sampleY * logicalWidth + sampleX] === 1);
    }
  }
}

function renderCalibrationStrip(x, y, w, h) {
  const half = Math.floor(w / 2);
  for (let py = y + 1; py < y + h - 1; py += 1) {
    for (let px = x + 1; px < x + w - 1; px += 1) {
      const isVerticalTarget = px < x + half;
      const coordinate = isVerticalTarget ? px - x - 1 : py - y - 1;
      setMono(px, py, calibratedCoordinate(coordinate) % 2 === 0);
    }
  }
  drawRectOutline(x, y, w, h, 0);
  drawVerticalLine(x + half, y, h, 0);
}

function calibrationTargetWidth(x) {
  const scale = Math.max(1, Math.round(reportedDpr));
  const controlsWidthCss = Math.min(390, windowWidth - 20) + 20;
  const unobscuredRight = bufferWidth - Math.ceil(controlsWidthCss * reportedDpr);
  return Math.max(80 * scale, unobscuredRight - x);
}

function createCalibrationControls() {
  const controls = document.createElement('section');
  controls.id = 'calibration-controls';
  controls.setAttribute('aria-label', 'Physical pixel calibration');

  const label = document.createElement('label');
  label.htmlFor = 'calibration-scale';
  label.innerHTML = 'Move until the 1px lines are pixel-perfect <output id="calibration-value">1.000×</output>';

  const slider = document.createElement('input');
  slider.id = 'calibration-scale';
  slider.type = 'range';
  slider.min = '0.5';
  slider.max = '2';
  slider.step = '0.001';
  slider.value = String(calibrationScale);
  slider.setAttribute('aria-describedby', 'calibration-help');

  const help = document.createElement('small');
  help.id = 'calibration-help';
  help.textContent = 'Left: vertical · Right: horizontal · Double-click to reset';

  slider.addEventListener('input', () => {
    calibrationScale = Number(slider.value);
    label.querySelector('output').textContent = `${formatScale(calibrationScale)}×`;
    scheduleCalibrationRedraw();
  });
  slider.addEventListener('dblclick', () => {
    calibrationScale = 1;
    slider.value = '1';
    label.querySelector('output').textContent = '1.000×';
    scheduleCalibrationRedraw();
  });

  controls.append(label, slider, help);
  document.body.append(controls);
}

function scheduleCalibrationRedraw() {
  if (calibrationRedrawPending) return;
  calibrationRedrawPending = true;
  requestAnimationFrame(() => {
    calibrationRedrawPending = false;
    redraw();
  });
}

function mousePressed() {
  if (selectedPattern >= 0) return;
  const px = Math.floor((mouseX / width) * bufferWidth);
  const py = Math.floor((mouseY / height) * bufferHeight);
  const hit = panelRects.find((panel) => px >= panel.x && px < panel.x + panel.w && py >= panel.y && py < panel.y + panel.h);
  if (hit) {
    selectedPattern = hit.index;
    redraw();
  }
}

function keyPressed() {
  if (key >= '1' && key <= '4') selectedPattern = Number(key) - 1;
  else if (key === 'g' || key === 'G' || keyCode === ESCAPE) selectedPattern = -1;
  else if (key === 'i' || key === 'I') inverted = !inverted;
  else if (key === 's' || key === 'S') saveCanvas(canvas, `halftone-${bufferWidth}x${bufferHeight}`, 'png');
  else return;
  redraw();
}

function windowResized() {
  rebuildCanvas();
}

function rebuildCanvas() {
  const nextDpr = readDevicePixelRatio();
  if (nextDpr !== reportedDpr) {
    reportedDpr = nextDpr;
    pixelDensity(reportedDpr);
    watchDevicePixelRatio();
  }
  resizeCanvas(windowWidth, windowHeight, true);
  drawingContext.imageSmoothingEnabled = false;
  redraw();
}

// devicePixelRatio can change when zoom changes or the window moves to another
// display. A resolution media query is the browser-supported change detector.
function watchDevicePixelRatio() {
  if (dprQuery) dprQuery.removeEventListener('change', rebuildCanvas);
  dprQuery = window.matchMedia(`(resolution: ${reportedDpr}dppx)`);
  dprQuery.addEventListener('change', rebuildCanvas, { once: true });
}

function readDevicePixelRatio() {
  return Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0
    ? window.devicePixelRatio
    : 1;
}

function setMono(x, y, black) {
  if (x < 0 || y < 0 || x >= bufferWidth || y >= bufferHeight) return;
  const value = black ? 0 : 255;
  const index = (y * bufferWidth + x) * 4;
  buffer[index] = value;
  buffer[index + 1] = value;
  buffer[index + 2] = value;
  buffer[index + 3] = 255;
}

function fillBuffer(value) {
  for (let i = 0; i < buffer.length; i += 4) {
    buffer[i] = value;
    buffer[i + 1] = value;
    buffer[i + 2] = value;
    buffer[i + 3] = 255;
  }
}

function invertBuffer() {
  for (let i = 0; i < buffer.length; i += 4) {
    buffer[i] = 255 - buffer[i];
    buffer[i + 1] = 255 - buffer[i + 1];
    buffer[i + 2] = 255 - buffer[i + 2];
  }
}

function drawText(text, x, y, scale, value) {
  let cursor = x;
  for (const character of text.toUpperCase()) {
    const glyph = GLYPHS[character] || GLYPHS[' '];
    const glyphWidth = glyph[0].length;
    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyphWidth; column += 1) {
        if (glyph[row][column] === '1') fillRectMono(cursor + column * scale, y + row * scale, scale, scale, value === 0);
      }
    }
    cursor += (glyphWidth + 1) * scale;
    if (cursor >= bufferWidth) break;
  }
}

function fillRectMono(x, y, w, h, black) {
  const right = Math.min(bufferWidth, x + w);
  const bottom = Math.min(bufferHeight, y + h);
  for (let py = Math.max(0, y); py < bottom; py += 1) {
    for (let px = Math.max(0, x); px < right; px += 1) setMono(px, py, black);
  }
}

function drawRectOutline(x, y, w, h, value) {
  drawHorizontalLine(x, y, w, value);
  drawHorizontalLine(x, y + h - 1, w, value);
  drawVerticalLine(x, y, h, value);
  drawVerticalLine(x + w - 1, y, h, value);
}

function drawHorizontalLine(x, y, length, value) {
  for (let px = x; px < x + length; px += 1) setMono(px, y, value === 0);
}

function drawVerticalLine(x, y, length, value) {
  for (let py = y; py < y + length; py += 1) setMono(x, py, value === 0);
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function calibratedCoordinate(backingCoordinate) {
  return Math.floor(backingCoordinate / calibrationScale);
}

function clampValue(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function formatDpr(value) {
  return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function formatScale(value) {
  return value.toFixed(3);
}
