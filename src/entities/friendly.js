import {
  FRIENDLY_HP,
  FRIENDLY_ORBIT_R,
  FRIENDLY_RADIUS,
  FRIENDLY_GUN_COOLDOWN,
  FRIENDLY_GUN_RANGE,
  FRIENDLY_GUN_DMG,
  FRIENDLY_HEAL_RATE,
  PLAYER_HP,
  PALETTE,
} from '../constants.js';
import { rand, wrapX, wrapDX } from '../util.js';
import { Bullet } from './bullet.js';

// A support drone orbiting the player. PERMA-DEATH: enemy fire can destroy
// it, and the item stack is lost (game decrements on death). Rebuyable.
export class FriendlyDrone {
  constructor(kind, phase) {
    this.kind = kind; // 'gunner' | 'repair'
    this.phase = phase; // orbit offset so multiple drones spread out
    this.x = 0;
    this.y = 0;
    this.hp = FRIENDLY_HP;
    this.radius = FRIENDLY_RADIUS;
    this.time = rand(0, 10);
    this.fireTimer = rand(0, FRIENDLY_GUN_COOLDOWN);
    this.hitFlash = 0;
    this.dead = false;
  }

  update(dt, player, enemies, bullets) {
    this.time += dt;
    this.hitFlash -= dt;
    this.fireTimer -= dt;

    // Orbit the player
    const a = this.time * 1.6 + this.phase;
    this.x = wrapX(player.x + Math.cos(a) * FRIENDLY_ORBIT_R);
    this.y = player.y + Math.sin(a) * FRIENDLY_ORBIT_R * 0.7;

    if (this.kind === 'repair') {
      // Heals even during the shield-regen delay — that's its whole value.
      if (!player.dead && player.hp < PLAYER_HP) {
        player.hp = Math.min(PLAYER_HP, player.hp + FRIENDLY_HEAL_RATE * dt);
      }
      return;
    }

    // Gunner: shoot the nearest living enemy in range
    if (this.fireTimer <= 0 && enemies.length > 0) {
      let best = null;
      let bestD = FRIENDLY_GUN_RANGE;
      for (const e of enemies) {
        if (e.dead) continue;
        const d = Math.hypot(wrapDX(e.x - this.x), e.y - this.y);
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      if (best) {
        this.fireTimer = FRIENDLY_GUN_COOLDOWN;
        const aim = Math.atan2(best.y - this.y, wrapDX(best.x - this.x));
        bullets.push(
          new Bullet(
            this.x,
            this.y,
            Math.cos(aim) * 420,
            Math.sin(aim) * 420,
            'player',
            FRIENDLY_GUN_DMG
          )
        );
      }
    }
  }

  hit(dmg) {
    this.hp -= dmg;
    this.hitFlash = 0.08;
    if (this.hp <= 0) this.dead = true;
  }

  render(ctx, cam) {
    const sx = Math.round(cam.sx(this.x));
    const sy = Math.round(cam.sy(this.y));
    const body =
      this.hitFlash > 0
        ? PALETTE.white
        : this.kind === 'gunner'
          ? PALETTE.green
          : PALETTE.greenDark;
    ctx.fillStyle = body;
    ctx.fillRect(sx - 3, sy - 2, 6, 4);
    ctx.fillStyle = PALETTE.white;
    ctx.fillRect(sx - 1, sy - 1, 2, 2); // eye
    // little rotor blur
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(sx - 4, sy - 4, 8, 1);
  }
}
