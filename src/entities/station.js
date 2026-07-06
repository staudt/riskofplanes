import {
  STATION_RADIUS,
  STATION_ARM_DELAY,
  PALETTE,
} from '../constants.js';
import { drawLabel } from '../util.js';

// A shop station: a crate hanging from a balloon, floating in the sky.
// Fly through it with enough money to buy its item (game handles the buy).
export class Station {
  constructor(x, y, item, price) {
    this.x = x;
    this.y = y;
    this.item = item; // entry from ITEMS
    this.price = price;
    this.radius = STATION_RADIUS;
    this.armTimer = STATION_ARM_DELAY; // can't buy a just-spawned station
    this.time = Math.random() * 10;
    this.brokeFlash = 0; // flashes the price red on a broke touch
    this.dead = false;
  }

  update(dt) {
    this.time += dt;
    this.armTimer -= dt;
    this.brokeFlash -= dt;
  }

  render(ctx, cam) {
    const sx = Math.round(cam.sx(this.x));
    const sy = Math.round(cam.sy(this.y) + Math.sin(this.time * 1.5) * 2);

    // Balloon
    ctx.fillStyle = PALETTE.coral;
    ctx.beginPath();
    ctx.arc(sx, sy - 16, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.coralDark;
    ctx.fillRect(sx - 1, sy - 10, 2, 4); // knot + rope
    ctx.fillRect(sx - 1, sy - 6, 1, 3);

    // Crate in the item's color
    ctx.fillStyle = this.item.color;
    ctx.fillRect(sx - 6, sy - 3, 12, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(sx - 6, sy + 3, 12, 4);
    ctx.fillStyle = PALETTE.white;
    ctx.fillRect(sx - 2, sy - 1, 4, 3); // latch

    // Price tag
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    const accent =
      this.brokeFlash > 0 && Math.floor(this.brokeFlash * 10) % 2 === 0
        ? PALETTE.drone
        : PALETTE.gold;
    drawLabel(ctx, `$${this.price}`, sx, sy + 18, accent);
    ctx.textAlign = 'left';
  }
}
