import { BOMB_GRAVITY, WATER_LINE, PALETTE } from '../constants.js';
import { wrapX } from '../util.js';

// Depth bomb: dropped from the plane, falls, detonates on the water surface
// (or a direct enemy hit). game.js handles the explosion + fire field.
export class Bomb {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = 3;
    this.dead = false;
    this.exploded = false; // game turns this into an AoE
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
    this.vy += BOMB_GRAVITY * dt;
    this.vx *= 1 - 0.4 * dt; // air drag straightens the fall
    this.x = wrapX(this.x + this.vx * dt);
    this.y += this.vy * dt;
    if (this.y >= WATER_LINE) {
      this.y = WATER_LINE;
      this.explode();
    }
  }

  explode() {
    if (this.dead) return;
    this.dead = true;
    this.exploded = true;
  }

  render(ctx, cam) {
    const sx = Math.round(cam.sx(this.x));
    const sy = Math.round(cam.sy(this.y));
    ctx.fillStyle = PALETTE.teal;
    ctx.fillRect(sx - 2, sy - 3, 4, 6);
    ctx.fillStyle = PALETTE.enemyDark;
    ctx.fillRect(sx - 1, sy - 5, 2, 2); // fin
    // blinking arm light
    if (Math.floor(this.time * 8) % 2 === 0) {
      ctx.fillStyle = PALETTE.drone;
      ctx.fillRect(sx - 1, sy - 1, 2, 2);
    }
  }
}
