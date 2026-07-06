import { WORLD_W } from './constants.js';

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
// Horizontal world wrap: normalize an x coordinate into [0, WORLD_W)
export const wrapX = (x) => ((x % WORLD_W) + WORLD_W) % WORLD_W;
// Signed shortest horizontal delta on the wrapped world, in (-W/2, W/2]
export const wrapDX = (dx) =>
  ((dx % WORLD_W) + WORLD_W * 1.5) % WORLD_W - WORLD_W / 2;
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (lo, hi) => lo + Math.random() * (hi - lo);
export const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));
export const dist2 = (ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
};

// Draws text in black with a color copy offset down-right behind it, so HUD
// text stays readable against busy sky/water backgrounds while keeping its
// color-coding (money gold, wave coral, item colors, etc) as a shadow accent.
export const drawLabel = (ctx, text, x, y, accentColor, offset = 1) => {
  ctx.fillStyle = accentColor;
  ctx.fillText(text, x + offset, y + offset);
  ctx.fillStyle = '#000';
  ctx.fillText(text, x, y);
};
