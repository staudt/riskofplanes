import {
  GRAVITY,
  THRUST,
  ROT_SPEED,
  ROT_MULT_SLOW,
  ROT_MULT_FAST,
  AIR_DRAG,
  BRAKE_DRAG,
  AIM_DEADZONE,
  LIFT_SPEED,
  BUOY_K,
  WATER_CALM_SPEED,
  WATER_CALM_DRAG,
  SKIM_DEPTH,
  SKIM_MIN_VX,
  SKIM_LIFT,
  NOSE_LEN,
  SUBMERGED_ALPHA,
  SEEKER_EVERY,
  MAX_SPEED,
  BOOST_IMPULSE,
  BOOST_RECHARGE,
  BOOST_OVERSPEED_TIME,
  BOOST_OVERSPEED_MULT,
  WORLD_H,
  WATER_LINE,
  PLAYER_HP,
  FIRE_COOLDOWN,
  BULLET_SPEED,
  BULLET_SPREAD,
  HIT_INVULN,
  SHIELD_REGEN_DELAY,
  SHIELD_REGEN_RATE,
  CHARGE_DELAY,
  CHARGE_TIME,
  CHARGE_ACTIVE,
  CHARGE_BALL_OFFSET,
  CHARGE_BALL_MIN_R,
  CHARGE_BALL_MAX_R,
  PALETTE,
} from '../constants.js';
import { clamp, lerp, rand, wrapX, wrapDX, wrapAngle } from '../util.js';
import { Bullet } from './bullet.js';
import { ChargeBall } from './chargeball.js';

export class Plane {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = -Math.PI / 4; // facing up-right; y grows downward
    this.hp = PLAYER_HP;
    this.radius = 7;
    this.fireTimer = 0;
    this.invuln = 0;
    this.dead = false;
    this.thrusting = false;
    this.charge = 0; // 0..1, builds while not shooting
    this.chargeDelay = 0; // countdown after shooting before charging resumes
    // Item-derived stats, recomputed by game.applyItems on every purchase
    this.fireCooldownMult = 1; // Rapid Fire
    this.ricochetBounces = 0; // Ricochet Rounds
    this.seekerStacks = 0; // Seeker Missiles
    this.shotCount = 0; // counts machine-gun shots for the seeker rhythm
    this.seekerRequest = 0; // game consumes: spawn this many missiles
    this.bombFired = false; // game consumes: try to drop depth bombs (own cooldown)
    this.boost = 1; // 0..1, Shift burst; starts ready
    this.prevShift = false; // edge detection so held Shift fires only once
    this.prevSpecial = false; // edge detection for the RMB charge-ball launch
    this.braking = false; // S held in air, for render feedback
    this.overspeed = 0; // s left of raised speed cap after boosting
    this.boostFired = false; // game reads this to spawn the burst effect
    this.ballAbsorbed = false; // set when water eats the held ball (game shows fizzle)
    this.absorbedCharge = 0; // how much charge the water ate (fuels the fire field)
    this.muzzleFlash = 0; // s left of muzzle flash after a shot
    this.sinceHit = Infinity; // s since last damage, for shield regen
  }

  // The plane's tip; guns and engine only work with the tip out of the water.
  get tipUnderwater() {
    return this.y + Math.sin(this.angle) * NOSE_LEN > WATER_LINE;
  }

  // World position of the charge ball held ahead of the nose.
  get ballX() {
    return wrapX(this.x + Math.cos(this.angle) * CHARGE_BALL_OFFSET);
  }

  get ballY() {
    return this.y + Math.sin(this.angle) * CHARGE_BALL_OFFSET;
  }

  get ballRadius() {
    return (
      CHARGE_BALL_MIN_R + (CHARGE_BALL_MAX_R - CHARGE_BALL_MIN_R) * this.charge
    );
  }

  get ballActive() {
    return !this.dead && this.charge >= CHARGE_ACTIVE;
  }

  get inWater() {
    return this.y > WATER_LINE;
  }

  // aim = {x, y} world-space cursor target, or null (no mouse yet / headless).
  update(dt, input, bullets, balls, aim = null) {
    if (this.dead) return;

    this.fireTimer -= dt;
    this.invuln -= dt;
    this.muzzleFlash -= dt;

    // Shield regen: heal back after a calm spell without damage.
    this.sinceHit += dt;
    if (this.hp < PLAYER_HP && this.sinceHit > SHIELD_REGEN_DELAY) {
      this.hp = Math.min(PLAYER_HP, this.hp + SHIELD_REGEN_RATE * dt);
    }

    // --- Rotation: chase the cursor at the inertia-scaled turn rate —
    // nimble when slow, wide curves when fast. The mouse is a target, not a
    // teleport: aim across the screen and watch the plane carve toward it. ---
    const speedFrac = clamp(Math.hypot(this.vx, this.vy) / MAX_SPEED, 0, 1);
    const rot = ROT_SPEED * lerp(ROT_MULT_SLOW, ROT_MULT_FAST, speedFrac);
    if (aim) {
      const dx = wrapDX(aim.x - this.x);
      const dy = aim.y - this.y;
      // Dead zone: cursor sitting on the plane holds heading (no jitter).
      if (dx * dx + dy * dy > AIM_DEADZONE * AIM_DEADZONE) {
        const diff = wrapAngle(Math.atan2(dy, dx) - this.angle);
        this.angle += clamp(diff, -rot * dt, rot * dt);
      }
    }

    // --- Thrust: engine is dead while the tip is submerged — you can't fly
    // under water. Point the nose up out of the water to take off. ---
    this.thrusting = input.down('KeyW') && !this.tipUnderwater;
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    // --- Brake (S, air only): bleed speed to line up a shot. Costs lift —
    // hold it too long and you stall and drop. Water keeps its own rules. ---
    this.braking = input.down('KeyS') && !this.inWater;
    if (this.braking) {
      const brake = 1 - BRAKE_DRAG * dt;
      this.vx *= brake;
      this.vy *= brake;
    }

    // --- Boost (Shift): charged instant kick along facing ---
    this.boost = Math.min(1, this.boost + dt / BOOST_RECHARGE);
    this.overspeed -= dt;
    const shift = input.down('ShiftLeft') || input.down('ShiftRight');
    if (shift && !this.prevShift && this.boost >= 1 && !this.tipUnderwater) {
      this.vx += Math.cos(this.angle) * BOOST_IMPULSE;
      this.vy += Math.sin(this.angle) * BOOST_IMPULSE;
      this.boost = 0;
      this.overspeed = BOOST_OVERSPEED_TIME;
      this.boostFired = true;
    }
    this.prevShift = shift;

    if (this.inWater) {
      // Full gravity in water (needed for the buoyancy equilibrium).
      this.vy += GRAVITY * dt;
      // --- Water: energy-conserving buoyancy spring, NO drag. ---
      // Depth-proportional upward force. Gravity above cancels this at the
      // equilibrium depth, so a slow entry bobs/floats; a fast dive
      // decelerates, inverts, and exits at mirrored angle & equal speed.
      const depth = this.y - WATER_LINE;
      this.vy -= BUOY_K * depth * dt;
      // Low-speed damping so gentle entries settle into a float instead of
      // bobbing forever. Fast trampoline bounces are barely affected: at the
      // bottom of a dive the energy sits in spring compression, not velocity.
      if (Math.hypot(this.vx, this.vy) < WATER_CALM_SPEED) {
        const calm = 1 - WATER_CALM_DRAG * dt;
        this.vx *= calm;
        this.vy *= calm;
      }
      // Skim ejection: fast, mostly-horizontal movement just under the
      // surface gets kicked back out. Dives never trigger this (|vy|~|vx|
      // while crossing the layer), so the trampoline mirror is preserved.
      if (
        depth < SKIM_DEPTH &&
        Math.abs(this.vx) > SKIM_MIN_VX &&
        Math.abs(this.vx) > 2 * Math.abs(this.vy)
      ) {
        this.vy -= SKIM_LIFT * dt;
      }
    } else {
      // --- Air: aerodynamic lift — gravity fades with airspeed, gone at
      // LIFT_SPEED. Flying fast & level holds altitude; stalling drops. ---
      const lift = clamp(Math.hypot(this.vx, this.vy) / LIFT_SPEED, 0, 1);
      this.vy += GRAVITY * (1 - lift) * dt;
      // Light linear drag + soft speed cap for control
      const drag = 1 - AIR_DRAG * dt;
      this.vx *= drag;
      this.vy *= drag;
      // Soft speed cap, temporarily raised right after a boost; over-cap
      // speed eases down instead of snapping.
      const cap =
        this.overspeed > 0 ? MAX_SPEED * BOOST_OVERSPEED_MULT : MAX_SPEED;
      const speed = Math.hypot(this.vx, this.vy);
      if (speed > cap) {
        const s = Math.max(cap / speed, 1 - 2.5 * dt);
        this.vx *= s;
        this.vy *= s;
      }
    }

    // --- Integrate ---
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // --- World bounds: x wraps seamlessly; top is a wall, bottom is water ---
    this.x = wrapX(this.x);
    if (this.y < 0) {
      this.y = 0;
      if (this.vy < 0) this.vy = 0;
    }
    // Hard floor far below water surface (shouldn't normally be reached).
    if (this.y > WORLD_H) {
      this.y = WORLD_H;
      if (this.vy > 0) this.vy = 0;
    }

    // --- Fire (LMB): machine gun along the facing. Guns only work with the
    // tip out of the water. ---
    if (input.fireDown && !this.tipUnderwater && this.fireTimer <= 0) {
      this.fireTimer = FIRE_COOLDOWN * this.fireCooldownMult;
      this.muzzleFlash = 0.06;
      const a = this.angle + rand(-BULLET_SPREAD, BULLET_SPREAD);
      const b = new Bullet(
        this.x + Math.cos(this.angle) * 10,
        this.y + Math.sin(this.angle) * 10,
        Math.cos(a) * BULLET_SPEED + this.vx * 0.5,
        Math.sin(a) * BULLET_SPEED + this.vy * 0.5,
        'player'
      );
      b.bounces = this.ricochetBounces;
      bullets.push(b);
      this.bombFired = true; // game consumes: drop depth bombs if their cooldown is up
      // Seeker rhythm: every SEEKER_EVERY-th shot also launches missiles
      this.shotCount++;
      if (this.seekerStacks > 0 && this.shotCount % SEEKER_EVERY === 0) {
        this.seekerRequest = this.seekerStacks;
      }
    }

    // --- Special (RMB, edge-triggered): launch the charge ball (slow,
    // piercing, shotgun-breaks at range end). ---
    const special = !!input.specialDown;
    if (
      special &&
      !this.prevSpecial &&
      this.ballActive &&
      !this.tipUnderwater
    ) {
      balls.push(
        new ChargeBall(
          this.ballX,
          this.ballY,
          this.angle,
          this.vx,
          this.vy,
          this.charge
        )
      );
      this.charge = 0;
      this.chargeDelay = CHARGE_DELAY; // recovery beat before recharging
    }
    this.prevSpecial = special;

    // --- Charge: builds passively (firing no longer suppresses it); only a
    // launch or a dunk resets it, with a cool-off before it regrows. ---
    if (this.chargeDelay > 0) {
      this.chargeDelay -= dt;
    } else {
      this.charge = Math.min(1, this.charge + dt / CHARGE_TIME);
    }

    // Water absorbs the charge: being submerged (or dipping the ball in)
    // eats it — the penalty for going under. No charging while floating.
    if (this.charge > 0 && (this.inWater || this.ballY > WATER_LINE)) {
      if (this.ballActive) {
        this.ballAbsorbed = true;
        this.absorbedCharge = this.charge;
      }
      this.charge = 0;
      this.chargeDelay = CHARGE_DELAY;
    }
  }

  hit(dmg, kx, ky) {
    if (this.invuln > 0 || this.dead) return false;
    this.hp -= dmg;
    this.invuln = HIT_INVULN;
    this.sinceHit = 0;
    this.vx += kx;
    this.vy += ky;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
    return true;
  }

  render(ctx, cam) {
    const sx = Math.round(cam.sx(this.x));
    const sy = Math.round(cam.sy(this.y));

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.angle);

    // Half-transparent while covered by water
    if (this.inWater) ctx.globalAlpha *= SUBMERGED_ALPHA;
    // Blink while invulnerable
    if (this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0) {
      ctx.globalAlpha *= 0.35;
    }

    // Thrust flame
    if (this.thrusting && !this.dead) {
      ctx.fillStyle = PALETTE.gold;
      const flick = Math.random() * 3;
      ctx.fillRect(-11 - flick, -1, 4 + flick, 2);
    }

    // Chunky pixel plane: body + nose + wing + tail (coral, pops on cyan/blue)
    ctx.fillStyle = PALETTE.coralDark;
    ctx.fillRect(-7, -2, 14, 4); // fuselage shadow
    ctx.fillStyle = PALETTE.coral;
    ctx.fillRect(-7, -3, 14, 4); // fuselage
    ctx.fillRect(7, -2, 3, 3); // nose
    ctx.fillStyle = PALETTE.white;
    ctx.fillRect(1, -2, 3, 2); // canopy

    // Muzzle flash right after a shot
    if (this.muzzleFlash > 0) {
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(10, -2, 4, 4);
      ctx.fillStyle = PALETTE.white;
      ctx.fillRect(11, -1, 2, 2);
    }
    ctx.fillStyle = PALETTE.coralDark;
    ctx.fillRect(-3, 1, 6, 2); // wing (below)
    ctx.fillRect(-8, -6, 3, 4); // tail fin

    // Afterburner nozzle at the tail: grows as boost recharges, blinks
    // white/cyan when the burst is ready (mirrors the charge ball up front).
    if (this.boost >= 1) {
      const blink = Math.floor(performance.now() / 100) % 2 === 0;
      ctx.fillStyle = blink ? PALETTE.white : PALETTE.waterSurface;
      ctx.fillRect(-11, -2, 3, 4);
    } else if (this.boost > 0.1) {
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = prev * (0.3 + 0.4 * this.boost);
      ctx.fillStyle = PALETTE.waterSurface;
      const h = Math.max(1, Math.round(4 * this.boost));
      ctx.fillRect(-10, -Math.ceil(h / 2), 2, h);
      ctx.globalAlpha = prev;
    }

    // Charge ball forming ahead of the nose: starts tiny and grows with
    // charge; translucent until it's usable (>= CHARGE_ACTIVE).
    if (!this.dead && this.charge > 0.03) {
      const full = this.charge >= 1;
      // Full charge: bigger throb + fast gold/white blink so it's unmissable.
      const pulse = full
        ? 1 + Math.sin(performance.now() / 45) * 0.25
        : 1 + Math.sin(performance.now() / 60) * 0.12;
      const r = this.ballRadius * pulse;
      const blink = full && Math.floor(performance.now() / 90) % 2 === 0;
      if (!this.ballActive) ctx.globalAlpha *= 0.45;
      ctx.fillStyle = blink ? PALETTE.white : PALETTE.gold;
      ctx.beginPath();
      ctx.arc(CHARGE_BALL_OFFSET, 0, r, 0, Math.PI * 2);
      ctx.fill();
      if (this.ballActive) {
        ctx.fillStyle = blink ? PALETTE.gold : PALETTE.white;
        ctx.beginPath();
        ctx.arc(CHARGE_BALL_OFFSET, 0, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}
