import { VIEW_W, VIEW_H, ZOOM_HEIGHT, setViewSize, STEP } from './constants.js';
import { Input } from './input.js';
import { Game } from './game.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Fill the whole window: pick an integer pixel scale from the window height
// (targeting ~ZOOM_HEIGHT world px vertically), then derive the internal
// resolution from the window size so there's no letterboxing.
function resize() {
  const scale = Math.max(1, Math.round(window.innerHeight / ZOOM_HEIGHT));
  const w = Math.ceil(window.innerWidth / scale);
  const h = Math.ceil(window.innerHeight / scale);
  setViewSize(w, h);
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${w * scale}px`;
  canvas.style.height = `${h * scale}px`;
  ctx.imageSmoothingEnabled = false; // reset by canvas resize
}
window.addEventListener('resize', resize);
resize();

const input = new Input();
const game = new Game(input);

// Fixed-timestep update, render once per frame.
let last = performance.now();
let acc = 0;
function frame(now) {
  acc += Math.min((now - last) / 1000, 0.25); // clamp long tab-away frames
  last = now;
  while (acc >= STEP) {
    game.update(STEP);
    acc -= STEP;
  }
  game.render(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
