import {
  CHARGE_BALL_SPEED,
  CHARGE_BALL_RANGE,
  CHARGE_BALL_MIN_R,
  CHARGE_BALL_MAX_R,
  PALETTE,
} from '../constants.js';
import { wrapX } from '../util.js';

// A fired charge ball: slow, pierces enemies (hits each once), travels a
// limited range, then explodes into shards (spawned by game.js).
export class ChargeBall {
  constructor(x, y, angle, pvx, pvy, charge) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * CHARGE_BALL_SPEED + pvx * 0.5;
    this.vy = Math.sin(angle) * CHARGE_BALL_SPEED + pvy * 0.5;
    this.charge = charge;
    this.radius =
      CHARGE_BALL_MIN_R + (CHARGE_BALL_MAX_R - CHARGE_BALL_MIN_R) * charge;
    this.range = CHARGE_BALL_RANGE; // fixed: ~1s of flight, then shotgun break
    this.traveled = 0;
    this.time = 0;
    this.dead = false;
    this.exploded = false; // set true when range runs out -> game spawns shards
    this.hitEnemies = new Set(); // pierce: damage each enemy only once
  }

  update(dt) {
    this.time += dt;
    const dx = this.vx * dt;
    const dy = this.vy * dt;
    this.x = wrapX(this.x + dx);
    this.y += dy;
    this.traveled += Math.hypot(dx, dy);
    if (this.traveled >= this.range) {
      this.exploded = true;
      this.dead = true;
    }
  }

  render(ctx, cam) {
    const sx = cam.sx(this.x);
    const sy = cam.sy(this.y);
    const pulse = 1 + Math.sin(this.time * 18) * 0.15;
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.arc(sx, sy, this.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.white;
    ctx.beginPath();
    ctx.arc(sx, sy, this.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
