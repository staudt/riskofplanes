import {
  VIEW_W,
  VIEW_H,
  WORLD_W,
  WATER_LINE,
  PALETTE,
} from './constants.js';
import { rand } from './util.js';

// Pre-generated cloud field in three parallax bands — the near band moves
// almost 1:1 with the world, which is what sells the sense of speed.
function makeClouds() {
  const bands = [
    { n: 14, depth: [0.22, 0.45], w: [90, 220], h: [18, 34] }, // far, huge
    { n: 16, depth: [0.5, 0.8], w: [60, 160], h: [16, 28] }, // mid
    { n: 12, depth: [0.85, 1.0], w: [40, 110], h: [12, 22] }, // near, fast
  ];
  const clouds = [];
  for (const b of bands) {
    for (let i = 0; i < b.n; i++) {
      clouds.push({
        x: rand(0, WORLD_W),
        y: rand(20, WATER_LINE - 140),
        w: rand(b.w[0], b.w[1]),
        h: rand(b.h[0], b.h[1]),
        depth: rand(b.depth[0], b.depth[1]),
        drift: rand(3, 10), // px/s
      });
    }
  }
  return clouds;
}

// World-anchored streaks below the water surface: flying past them is a
// direct speed read, unlike screen-space glints.
function makeWaterLines() {
  const lines = [];
  for (let i = 0; i < 70; i++) {
    lines.push({
      x: rand(0, WORLD_W),
      depth: rand(4, 70), // px below the surface
      len: rand(8, 26),
      drift: rand(-14, 14), // px/s of slow current
      alpha: rand(0.25, 0.65),
    });
  }
  return lines;
}

export class World {
  constructor() {
    this.clouds = makeClouds();
    this.waterLines = makeWaterLines();
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
    for (const c of this.clouds) {
      c.x += c.drift * dt;
      if (c.x > WORLD_W) c.x -= WORLD_W;
    }
  }

  drawCloud(ctx, c, sx, sy) {
    if (sx + c.w < -20 || sx > VIEW_W + 20) return;
    if (sy + c.h < -20 || sy > VIEW_H + 20) return;
    ctx.fillStyle = PALETTE.cloudShadow;
    ctx.fillRect(Math.round(sx + 4), Math.round(sy + c.h - 4), c.w, 4);
    ctx.fillStyle = PALETTE.cloud;
    ctx.fillRect(Math.round(sx), Math.round(sy), c.w, c.h);
    ctx.fillRect(
      Math.round(sx + c.w * 0.2),
      Math.round(sy - c.h * 0.45),
      c.w * 0.5,
      c.h * 0.5
    );
  }

  render(ctx, cam) {
    // Sky
    ctx.fillStyle = PALETTE.sky;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Clouds. Parallax uses the camera's continuous scroll so the wrap seam
    // never makes them jump; each cloud repeats every WORLD_W.
    for (const c of this.clouds) {
      const sx =
        ((((c.x - cam.scrollX * c.depth) % WORLD_W) + WORLD_W) % WORLD_W);
      const sy = c.y - cam.y * c.depth;
      this.drawCloud(ctx, c, sx, sy);
      this.drawCloud(ctx, c, sx - WORLD_W, sy); // wrapped copy near left edge
    }

    // Water: one solid, unmistakable color (no background band).
    const waterScreenY = WATER_LINE - cam.y;
    if (waterScreenY < VIEW_H) {
      const y = Math.max(0, Math.round(waterScreenY));
      const bob = Math.round(Math.sin(this.time * 1.8) * 1);
      ctx.fillStyle = PALETTE.water;
      ctx.fillRect(0, y, VIEW_W, VIEW_H - y);
      // Bright surface line so the boundary always reads clearly
      ctx.fillStyle = PALETTE.waterSurface;
      ctx.fillRect(0, y + bob, VIEW_W, 2);
      // World-anchored streaks: they stream past as you fly along the water.
      for (const l of this.waterLines) {
        const ly = Math.round(WATER_LINE + l.depth - cam.y);
        if (ly < y + 3 || ly >= VIEW_H) continue;
        const sx = Math.round(cam.sx(l.x + l.drift * this.time));
        if (sx + l.len < -10 || sx > VIEW_W + 10) continue;
        // fade with depth so the surface stays the busiest layer
        ctx.globalAlpha = l.alpha * (1 - l.depth / 90);
        ctx.fillRect(sx - l.len / 2, ly, l.len, 1);
      }
      ctx.globalAlpha = 1;
    }

    // Ceiling hint when near the top of the arena
    if (cam.y <= 2) {
      ctx.fillStyle = 'rgba(47,107,107,0.5)';
      ctx.fillRect(0, 0, VIEW_W, 3);
    }
  }
}
