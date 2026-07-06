import {
  MISSILE_SPEED,
  MISSILE_TURN,
  MISSILE_DMG,
  MISSILE_LIFE,
  WATER_LINE,
  PALETTE,
} from '../constants.js';
import { wrapX, wrapDX } from '../util.js';

// Heat-seeking missile: homes on the nearest living enemy with a limited
// turn rate. Dies in water.
export class Missile {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.dmg = MISSILE_DMG;
    this.life = MISSILE_LIFE;
    this.dead = false;
  }

  update(dt, enemies) {
    this.life -= dt;

    // Retarget the nearest living enemy every step (cheap at our counts)
    let best = null;
    let bestD = Infinity;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = Math.hypot(wrapDX(e.x - this.x), e.y - this.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (best) {
      const want = Math.atan2(best.y - this.y, wrapDX(best.x - this.x));
      let diff = want - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const maxTurn = MISSILE_TURN * dt;
      this.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));
    }

    this.x = wrapX(this.x + Math.cos(this.angle) * MISSILE_SPEED * dt);
    this.y += Math.sin(this.angle) * MISSILE_SPEED * dt;

    if (this.life <= 0 || this.y > WATER_LINE || this.y < -20) {
      this.dead = true;
    }
  }

  render(ctx, cam) {
    const sx = cam.sx(this.x);
    const sy = cam.sy(this.y);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.angle);
    ctx.fillStyle = PALETTE.white;
    ctx.fillRect(-4, -1, 8, 2);
    ctx.fillStyle = PALETTE.coral;
    ctx.fillRect(3, -1, 2, 2); // warhead
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(-6 - Math.random() * 2, -1, 3, 2); // exhaust
    ctx.restore();
  }
}
