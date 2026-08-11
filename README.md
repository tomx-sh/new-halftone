# Device Pixel Halftone Lab

A black-and-white p5.js 2 experiment that writes directly to the canvas backing
store. Every generated sample is exactly `0` or `255`; p5 shape drawing and
browser canvas interpolation are bypassed.

The header reports:

- `DPR`: the browser's current `window.devicePixelRatio`.
- `CSS`: the p5 canvas size in logical CSS pixels.
- `BUFFER`: the addressable canvas backing-store size.

`devicePixelRatio` is the closest web-platform mapping to physical screen
pixels, but it is affected by OS display scaling and browser page zoom. A web
page cannot independently query a panel's native pixel grid.

## Getting Started

Open `index.html` in your web browser and start editing `sketch.js`.

Click a pattern (or press `1`–`4`) to fill the canvas. Press `G` or Escape to
return to the gallery, `I` to invert black and white, and `S` to save a PNG at
the backing-store resolution.

Use the calibration slider to compensate for display-pipeline scaling. It uses
discrete stops corresponding to common 4K macOS HiDPI modes, from `1920×1080`
at `1.000×` through `3840×2160` at `2.000×`. Move it until the vertical and
horizontal one-pixel stripe targets appear crisp and evenly spaced;
double-click the slider to reset it to `1.000×`.

## Running Locally

For projects with media files, use a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server

# Using VS Code Live Server extension
# Right-click index.html -> "Open with Live Server"
```

## Resources

- [p5.js 2.0](https://beta.p5js.org/)
- [p5.js Reference](https://p5js.org/reference/)
