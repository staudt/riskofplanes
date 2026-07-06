import {
  BULLET_LIFE,
  BULLET_DMG,
  PALETTE,
  WATER_LINE,
} from '../constants.js';
import { clamp, wrapX } from '../util.js';

export class Bullet {
  constructor(x, y, vx, vy, owner, dmg = BULLET_DMG, life = BULLET_LIFE) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.owner = owner; // 'player' | 'enemy'
    this.dmg = dmg;
    this.life = life;
    this.bounces = 0; // Ricochet Rounds: skips off the water this many times
    this.dead = false;
  }

  update(dt) {
    this.life -= dt;
    this.x = wrapX(this.x + this.vx * dt);
    this.y += this.vy * dt;
    // Water swallows bullets — diving is a real cover option...
    if (this.y > WATER_LINE) {
      if (this.bounces > 0) {
        // ...unless they ricochet: skip off the surface like a stone.
        this.bounces--;
        this.y = WATER_LINE;
        this.vy = -Math.abs(this.vy);
      } else {
        this.dead = true;
      }
    }
    if (this.life <= 0 || this.y < -20) {
      this.dead = true;
    }
  }

  render(ctx, cam) {
    const sx = cam.sx(this.x);
    const sy = cam.sy(this.y);
    const speed = Math.hypot(this.vx, this.vy) || 1;
    const len = clamp(speed * 0.02, 3, 12);

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(Math.atan2(this.vy, this.vx));
    // Tracer line: dim tail, bright head
    ctx.fillStyle =
      this.owner === 'player' ? PALETTE.bullet : PALETTE.enemyBullet;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(-len, -1, len, 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.owner === 'player' ? PALETTE.white : PALETTE.enemyBullet;
    ctx.fillRect(-2, -1, 3, 2);
    ctx.restore();
  }
}
