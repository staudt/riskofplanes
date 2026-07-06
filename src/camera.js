import { VIEW_W, VIEW_H, WORLD_H } from './constants.js';
import { clamp, lerp, wrapX, wrapDX } from './util.js';

export class Camera {
  constructor() {
    this.x = 0; // top-left of view in world coords (x wraps around the world)
    this.y = 0;
    // Continuous (never-wrapping) horizontal scroll, for parallax layers.
    this.scrollX = 0;
  }

  follow(plane, dt) {
    // Center on plane with a bit of velocity lookahead.
    const targetX = plane.x + plane.vx * 0.25 - VIEW_W / 2;
    const targetY = plane.y + plane.vy * 0.15 - VIEW_H / 2;
    const t = 1 - Math.exp(-6 * dt); // framerate-independent smoothing
    const dx = wrapDX(targetX - this.x) * t;
    this.x = wrapX(this.x + dx);
    this.scrollX += dx;
    this.y = clamp(lerp(this.y, targetY, t), 0, WORLD_H - VIEW_H);
  }

  snapTo(plane) {
    this.x = wrapX(plane.x - VIEW_W / 2);
    this.scrollX = this.x;
    this.y = clamp(plane.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
  }

  // World x -> screen x, picking the wrapped copy nearest the view center.
  sx(worldX) {
    return VIEW_W / 2 + wrapDX(worldX - (this.x + VIEW_W / 2));
  }

  sy(worldY) {
    return worldY - this.y;
  }
}
