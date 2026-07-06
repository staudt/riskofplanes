import {
  ENEMY_BASE_HP,
  ENEMY_BASE_SPEED,
  ENEMY_RADIUS,
  ENEMY_MONEY,
  ENEMY_STANDOFF,
  ENEMY_FIRE_RANGE,
  ENEMY_FIRE_MIN,
  ENEMY_FIRE_MAX,
  ENEMY_BULLET_SPEED,
  ENEMY_BULLET_DMG,
  ENEMY_BULLET_SPREAD,
  DRONE_HP,
  DRONE_SPEED,
  DRONE_ACCEL,
  DRONE_RADIUS,
  DRONE_MONEY,
  DRONE_FUSE_DIST,
  SHIP_HP,
  SHIP_SPEED,
  SHIP_RADIUS,
  SHIP_MONEY,
  SHIP_DRAFT,
  SHIP_FIRE_MIN,
  SHIP_FIRE_MAX,
  SHIP_FIRE_RANGE,
  BOMBER_HP,
  BOMBER_SPEED,
  BOMBER_RADIUS,
  BOMBER_MONEY,
  BOMBER_TURRET_OFFSET,
  BOMBER_FIRE_MIN,
  BOMBER_FIRE_MAX,
  BOMBER_FIRE_RANGE,
  WATER_LINE,
  PALETTE,
} from '../constants.js';
import { clamp, rand, wrapX, wrapDX } from '../util.js';
import { Bullet } from './bullet.js';

// Shared base: hp/hit/hitFlash, per-type color & payout, hp bar. Subclasses
// implement update(dt, player, bullets) and renderBody(ctx).
class Enemy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = 0;
    this.dead = false;
    this.hitFlash = 0;
    this.explodes = false; // drones: AoE on death (handled by game.js)
    // subclasses set: radius, maxHp/hp, speed, money, color, colorDark
  }

  hit(dmg) {
    this.hp -= dmg;
    this.hitFlash = 0.08;
    if (this.hp <= 0) this.dead = true;
  }

  // Aim at the player and fire one bullet from (fx, fy).
  shoot(bullets, player, fx, fy, speed = ENEMY_BULLET_SPEED) {
    const aim =
      Math.atan2(player.y - fy, wrapDX(player.x - fx)) +
      rand(-ENEMY_BULLET_SPREAD, ENEMY_BULLET_SPREAD);
    bullets.push(
      new Bullet(
        fx,
        fy,
        Math.cos(aim) * speed,
        Math.sin(aim) * speed,
        'enemy',
        ENEMY_BULLET_DMG
      )
    );
  }

  capSpeed() {
    const s = Math.hypot(this.vx, this.vy);
    if (s > this.speed) {
      this.vx *= this.speed / s;
      this.vy *= this.speed / s;
    }
  }

  render(ctx, cam) {
    const sx = Math.round(cam.sx(this.x));
    const sy = Math.round(cam.sy(this.y));

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.angle);
    this.renderBody(
      ctx,
      this.hitFlash > 0 ? PALETTE.white : this.color,
      this.hitFlash > 0 ? PALETTE.white : this.colorDark
    );
    ctx.restore();

    // HP bar when damaged, width tracks the enemy's size
    if (this.hp < this.maxHp) {
      const w = Math.max(12, this.radius * 1.5);
      const frac = clamp(this.hp / this.maxHp, 0, 1);
      const by = sy - this.radius - 4;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(sx - w / 2, by, w, 2);
      ctx.fillStyle = PALETTE.coral;
      ctx.fillRect(sx - w / 2, by, Math.round(w * frac), 2);
    }
  }
}

// ---- Gunner: closes to standoff range, keeps distance, shoots ----
export class Gunner extends Enemy {
  constructor(x, y, difficulty) {
    super(x, y);
    this.radius = ENEMY_RADIUS;
    this.maxHp = Math.round(ENEMY_BASE_HP * (0.7 + 0.3 * difficulty));
    this.hp = this.maxHp;
    this.speed = ENEMY_BASE_SPEED * (0.85 + 0.15 * difficulty);
    this.money = ENEMY_MONEY;
    this.color = PALETTE.enemy;
    this.colorDark = PALETTE.enemyDark;
    this.fireTimer = rand(0.6, ENEMY_FIRE_MAX);
  }

  update(dt, player, bullets) {
    this.hitFlash -= dt;
    this.fireTimer -= dt;

    const dx = wrapDX(player.x - this.x);
    const dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const accel = 300 * (d > ENEMY_STANDOFF ? 1 : -0.8);
    this.vx += ux * accel * dt;
    this.vy += uy * accel * dt;

    // Avoid the water
    if (this.y > WATER_LINE - 6) this.vy -= 500 * dt;

    this.capSpeed();
    this.x = wrapX(this.x + this.vx * dt);
    this.y += this.vy * dt;
    this.angle = Math.atan2(dy, dx); // faces the player (it's aiming)

    if (this.fireTimer <= 0 && d < ENEMY_FIRE_RANGE && !player.dead) {
      this.fireTimer = rand(ENEMY_FIRE_MIN, ENEMY_FIRE_MAX);
      this.shoot(bullets, player, this.x + ux * 8, this.y + uy * 8);
    }
  }

  renderBody(ctx, body, dark) {
    ctx.fillStyle = dark;
    ctx.fillRect(-6, -2, 12, 5);
    ctx.fillStyle = body;
    ctx.fillRect(-6, -3, 12, 4);
    ctx.fillRect(6, -1, 2, 2); // nose
    ctx.fillStyle = dark;
    ctx.fillRect(-7, -5, 3, 3); // tail
  }
}

// ---- Drone: red kamikaze; rushes the player, explodes on any death ----
export class Drone extends Enemy {
  constructor(x, y, difficulty) {
    super(x, y);
    this.radius = DRONE_RADIUS;
    this.maxHp = Math.round(DRONE_HP * (0.8 + 0.2 * difficulty));
    this.hp = this.maxHp;
    this.speed = DRONE_SPEED * (0.9 + 0.1 * difficulty);
    this.money = DRONE_MONEY;
    this.color = PALETTE.drone;
    this.colorDark = PALETTE.droneDark;
    this.explodes = true;
    this.time = rand(0, 10); // desync the wobble
  }

  update(dt, player, _bullets) {
    this.hitFlash -= dt;
    this.time += dt;

    const dx = wrapDX(player.x - this.x);
    const dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    // Straight at the player with a nervous wobble
    const wob = Math.sin(this.time * 9) * 60;
    this.vx += ((dx / d) * DRONE_ACCEL + (-dy / d) * wob) * dt;
    this.vy += ((dy / d) * DRONE_ACCEL + (dx / d) * wob) * dt;

    if (this.y > WATER_LINE - 4) this.vy -= 600 * dt;

    this.capSpeed();
    this.x = wrapX(this.x + this.vx * dt);
    this.y += this.vy * dt;
    this.angle = Math.atan2(this.vy, this.vx);

    // Proximity fuse — dying here triggers the explosion via game.damageEnemy
    if (d < DRONE_FUSE_DIST + player.radius && !player.dead) {
      this.dead = true;
    }
  }

  renderBody(ctx, body, dark) {
    // Stubby red dart with a blinking fuse light
    ctx.fillStyle = dark;
    ctx.fillRect(-4, -1, 8, 3);
    ctx.fillStyle = body;
    ctx.fillRect(-4, -2, 8, 3);
    ctx.fillRect(4, -1, 2, 1); // nose
    const blink = Math.floor(this.time * 6) % 2 === 0;
    ctx.fillStyle = blink ? PALETTE.white : dark;
    ctx.fillRect(-1, -3, 2, 2); // fuse light
  }
}

// ---- Ship: floats on the surface, slow horizontal chase, turret ----
export class Ship extends Enemy {
  constructor(x, y, difficulty) {
    super(x, WATER_LINE - SHIP_DRAFT);
    this.radius = SHIP_RADIUS;
    this.maxHp = Math.round(SHIP_HP * (0.8 + 0.2 * difficulty));
    this.hp = this.maxHp;
    this.speed = SHIP_SPEED;
    this.money = SHIP_MONEY;
    this.color = PALETTE.ship;
    this.colorDark = PALETTE.shipDark;
    this.fireTimer = rand(0.8, SHIP_FIRE_MAX);
    this.time = rand(0, 10);
  }

  update(dt, player, bullets) {
    this.hitFlash -= dt;
    this.fireTimer -= dt;
    this.time += dt;

    // Chase the player's x only; the hull rides the surface with a bob.
    const dx = wrapDX(player.x - this.x);
    this.vx += Math.sign(dx) * 60 * dt;
    this.vx = clamp(this.vx, -this.speed, this.speed);
    this.x = wrapX(this.x + this.vx * dt);
    this.y = WATER_LINE - SHIP_DRAFT + Math.sin(this.time * 1.6) * 1.5;
    this.angle = 0; // hulls don't roll

    const d = Math.hypot(dx, player.y - this.y);
    if (this.fireTimer <= 0 && d < SHIP_FIRE_RANGE && !player.dead) {
      this.fireTimer = rand(SHIP_FIRE_MIN, SHIP_FIRE_MAX);
      this.shoot(bullets, player, this.x, this.y - 6); // from the turret
    }
  }

  renderBody(ctx, body, dark) {
    // Hull sitting on the water + bridge + turret
    ctx.fillStyle = dark;
    ctx.fillRect(-16, 2, 32, 4); // waterline hull shadow
    ctx.fillStyle = body;
    ctx.fillRect(-15, -2, 30, 5); // hull
    ctx.fillRect(-14, 3, 28, 2); // hull base
    ctx.fillRect(-6, -7, 9, 5); // bridge
    ctx.fillStyle = dark;
    ctx.fillRect(2, -6, 6, 2); // turret barrel
    ctx.fillRect(9, -3, 4, 3); // bow gun
  }
}

// ---- Bomber: huge slow drifter with two independent turrets ----
export class Bomber extends Enemy {
  constructor(x, y, difficulty) {
    super(x, y);
    this.radius = BOMBER_RADIUS;
    this.maxHp = Math.round(BOMBER_HP * (0.8 + 0.2 * difficulty));
    this.hp = this.maxHp;
    this.speed = BOMBER_SPEED;
    this.money = BOMBER_MONEY;
    this.color = PALETTE.bomber;
    this.colorDark = PALETTE.bomberDark;
    this.time = rand(0, 10);
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.turretTimers = [rand(0.5, BOMBER_FIRE_MAX), rand(0.5, BOMBER_FIRE_MAX)];
  }

  update(dt, player, bullets) {
    this.hitFlash -= dt;
    this.time += dt;

    // Barely maneuvers: slow drift + gentle sine wander, never dives low.
    this.vx = this.dir * this.speed;
    this.vy = Math.sin(this.time * 0.7) * 8;
    this.x = wrapX(this.x + this.vx * dt);
    this.y = clamp(this.y + this.vy * dt, 60, WATER_LINE - 80);
    this.angle = 0;

    // Two turrets fire independently from their mounts
    for (let i = 0; i < 2; i++) {
      this.turretTimers[i] -= dt;
      const tx = wrapX(this.x + (i === 0 ? -1 : 1) * BOMBER_TURRET_OFFSET);
      const ty = this.y + 4;
      const d = Math.hypot(wrapDX(player.x - tx), player.y - ty);
      if (this.turretTimers[i] <= 0 && d < BOMBER_FIRE_RANGE && !player.dead) {
        this.turretTimers[i] = rand(BOMBER_FIRE_MIN, BOMBER_FIRE_MAX);
        this.shoot(bullets, player, tx, ty);
      }
    }
  }

  renderBody(ctx, body, dark) {
    // Long fuselage, big wing, twin turret pods underneath
    ctx.fillStyle = dark;
    ctx.fillRect(-20, -2, 40, 7);
    ctx.fillStyle = body;
    ctx.fillRect(-20, -4, 40, 7); // fuselage
    ctx.fillRect(-8, -8, 22, 4); // wing
    ctx.fillStyle = dark;
    ctx.fillRect(-22, -7, 5, 5); // tail
    ctx.fillRect(-16, 3, 4, 3); // turret pods
    ctx.fillRect(12, 3, 4, 3);
    ctx.fillStyle = PALETTE.white;
    ctx.fillRect(14, -3, 4, 2); // cockpit
  }
}
