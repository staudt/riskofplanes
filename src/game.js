import {
  VIEW_W,
  VIEW_H,
  WATER_LINE,
  PALETTE,
  CONTACT_KNOCKBACK,
  RAM_PLAYER_DMG,
  RAM_DMG_BASE,
  RAM_DMG_CHARGE,
  RAM_DMG_SHIELD,
  RAM_CHARGE_DRAIN,
  HIT_INVULN,
  FIREFIELD_DURATION,
  FIREFIELD_HEIGHT,
  FIREFIELD_TICK,
  FIREFIELD_DMG,
  FIREFIELD_BASE_HALFW,
  FIREFIELD_CHARGE_HALFW,
  CHARGE_BALL_DMG,
  CHARGE_MELEE_DMG,
  CHARGE_MELEE_DRAIN,
  CHARGE_BLOCK_DRAIN,
  MELEE_TICK,
  SHOTGUN_SPREAD,
  SHARD_COUNT,
  SHARD_SPEED,
  SHARD_LIFE,
  SHARD_DMG,
  DRONE_EXPLOSION_RADIUS,
  DRONE_EXPLOSION_DMG,
  DRONE_FROM_WAVE,
  SHIP_FROM_WAVE,
  BOMBER_FROM_WAVE,
  STATION_COUNT_MIN,
  STATION_COUNT_MAX,
  VOLATILE_BASE_RADIUS,
  VOLATILE_RADIUS_PER_STACK,
  VOLATILE_BASE_DMG,
  VOLATILE_DMG_PER_STACK,
  BOMB_INTERVAL,
  BOMB_EXPLOSION_RADIUS,
  BOMB_EXPLOSION_DMG,
  BOMB_FIRE_CHARGE,
  BOMB_LAUNCH_SPEED,
  BOMB_LAUNCH_SPACING,
  BOMB_LAUNCH_JITTER,
  WAVE_BASE_COUNT,
  WAVE_COUNT_GROWTH,
  WAVE_MAX_COUNT,
  WAVE_BREAK,
  SPAWN_STAGGER,
  WAVE_DIFF_GROWTH,
  PLAYER_HP,
} from './constants.js';
import { clamp, rand, wrapX, wrapDX, drawLabel } from './util.js';
import { World } from './world.js';
import { Camera } from './camera.js';
import { Plane } from './entities/plane.js';
import { Gunner, Drone, Ship, Bomber } from './entities/enemy.js';
import { Bullet } from './entities/bullet.js';
import { Station } from './entities/station.js';
import { FriendlyDrone } from './entities/friendly.js';
import { Missile } from './entities/missile.js';
import { Bomb } from './entities/bomb.js';
import { ITEMS, ITEM_IDS, itemPrice } from './items.js';

// Squared distance using the shortest horizontal path on the wrapped world.
function wrappedDist2(ax, ay, bx, by) {
  const dx = wrapDX(bx - ax);
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export class Game {
  constructor(input) {
    this.input = input;
    this.reset();
  }

  reset() {
    this.world = new World();
    this.camera = new Camera();
    this.player = new Plane(1500, WATER_LINE - 200);
    this.camera.snapTo(this.player);
    this.bullets = [];
    this.balls = []; // fired charge balls
    this.fires = []; // surface fire fields from dunked charge balls
    this.enemies = [];
    this.particles = [];
    this.meleeTimer = 0;
    this.money = 0;
    this.elapsed = 0;
    this.gameOver = false;
    this.wasInWater = false;
    // Wave state: clear all enemies -> breather -> bigger wave.
    this.wave = 0;
    this.spawnQueue = []; // enemy type names waiting to spawn this wave
    this.spawnTimer = 0;
    this.breakTimer = 1.5; // short calm before wave 1
    this.pendingExplosions = []; // AoE queue: {x, y, radius, dmg, hurtPlayer}
    // Shop & items
    this.items = {}; // item id -> stacks owned
    this.stations = [];
    this.friendlies = [];
    this.missiles = [];
    this.bombs = [];
    this.bombTimer = BOMB_INTERVAL;
  }

  get difficulty() {
    return 1 + Math.max(0, this.wave - 1) * WAVE_DIFF_GROWTH;
  }

  update(dt) {
    if (this.gameOver) {
      if (this.input.down('KeyR')) this.reset();
      return;
    }

    this.elapsed += dt;
    this.world.update(dt);

    // --- Player ---
    // Cursor (screen px) -> world target for mouse aim. sx/sy are the
    // inverse of this mapping; wrapX keeps the target on the wrapped world.
    const aim =
      this.input.mouseX == null // null (no move yet) or undefined (headless stub)
        ? null
        : {
            x: wrapX(this.camera.x + this.input.mouseX),
            y: this.camera.y + this.input.mouseY,
          };
    this.player.update(dt, this.input, this.bullets, this.balls, aim);
    if (this.player.dead) this.gameOver = true;

    // Splash particles on water entry/exit
    const inWater = this.player.inWater;
    if (inWater !== this.wasInWater && Math.abs(this.player.vy) > 80) {
      this.splash(this.player.x, WATER_LINE, Math.abs(this.player.vy));
    }
    this.wasInWater = inWater;

    // --- Wave flow ---
    if (this.breakTimer > 0) {
      this.breakTimer -= dt;
      if (this.breakTimer <= 0) this.startWave();
    } else if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = SPAWN_STAGGER;
        this.spawnEnemy(this.spawnQueue.shift());
      }
    } else if (this.enemies.length === 0) {
      this.breakTimer = WAVE_BREAK; // wave cleared
      this.restockStations();
    }

    // --- Enemies (they shoot; body contact = ramming, see below) ---
    for (const e of this.enemies) {
      e.update(dt, this.player, this.bullets);
      // Drone proximity fuse (or any self-death of an exploder)
      if (e.dead && e.explodes) this.queueExplosion(e);
      if (e.dead) continue;
      // Ramming: costs shield + charge, hurts the enemy more the more you
      // bring — melee is an option, not free.
      const rr = (e.radius + this.player.radius) ** 2;
      if (wrappedDist2(e.x, e.y, this.player.x, this.player.y) < rr) {
        const dx = wrapDX(this.player.x - e.x);
        const dy = this.player.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        const ux = dx / d;
        const uy = dy / d;
        // Compute what you deal BEFORE the ram costs you shield/charge.
        const ramDmg =
          RAM_DMG_BASE +
          RAM_DMG_CHARGE * this.player.charge +
          RAM_DMG_SHIELD * (this.player.hp / PLAYER_HP);
        if (
          this.player.hit(
            RAM_PLAYER_DMG,
            ux * CONTACT_KNOCKBACK,
            uy * CONTACT_KNOCKBACK
          )
        ) {
          this.damageEnemy(e, Math.round(ramDmg));
          this.player.charge = Math.max(
            0,
            this.player.charge - RAM_CHARGE_DRAIN
          );
          e.vx -= ux * CONTACT_KNOCKBACK;
          e.vy -= uy * CONTACT_KNOCKBACK;
          this.spark(e.x, e.y, PALETTE.coral);
        }
      }
    }

    // --- Melee: held charge ball damages enemies that touch it ---
    this.meleeTimer -= dt;
    if (this.player.ballActive && this.meleeTimer <= 0) {
      const bx = this.player.ballX;
      const by = this.player.ballY;
      const br = this.player.ballRadius;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (wrappedDist2(bx, by, e.x, e.y) < (br + e.radius) ** 2) {
          this.damageEnemy(
            e,
            Math.ceil(CHARGE_MELEE_DMG * this.player.charge)
          );
          // Shove the enemy off the ball so the plane behind stays safe.
          const dx = wrapDX(e.x - bx);
          const dy = e.y - by;
          const d = Math.hypot(dx, dy) || 1;
          e.vx += (dx / d) * 220;
          e.vy += (dy / d) * 220;
          this.spark(bx, by, PALETTE.gold);
          this.player.charge = Math.max(
            0,
            this.player.charge - CHARGE_MELEE_DRAIN
          );
          this.meleeTimer = MELEE_TICK;
          break; // one melee tick at a time
        }
      }
    }

    // Held charge ball dunked: the energy erupts as a surface fire field
    if (this.player.ballAbsorbed) {
      this.player.ballAbsorbed = false;
      this.splash(this.player.ballX, WATER_LINE, 140);
      this.spawnFireField(this.player.ballX, this.player.absorbedCharge);
    }

    // Boost burst: flame kick from the tail + speed trail while overspeeding
    if (this.player.boostFired) {
      this.player.boostFired = false;
      const back = this.player.angle + Math.PI;
      for (let i = 0; i < 12; i++) {
        const a = back + rand(-0.5, 0.5);
        const s = rand(80, 220);
        this.particles.push({
          x: this.player.x,
          y: this.player.y,
          vx: Math.cos(a) * s + this.player.vx * 0.3,
          vy: Math.sin(a) * s + this.player.vy * 0.3,
          life: rand(0.2, 0.45),
          color: i % 3 ? PALETTE.waterSurface : PALETTE.white,
          size: 2,
        });
      }
    }
    if (this.player.overspeed > 0 && Math.random() < 0.5) {
      this.particles.push({
        x: this.player.x - Math.cos(this.player.angle) * 9,
        y: this.player.y - Math.sin(this.player.angle) * 9,
        vx: rand(-15, 15),
        vy: rand(-15, 15),
        life: rand(0.15, 0.35),
        color: PALETTE.waterSurface,
        size: 1,
      });
    }

    // --- Fired charge balls: pierce, then explode into shards ---
    for (const ball of this.balls) {
      ball.update(dt);
      // Water absorbs fired balls too — no shards, but the energy erupts.
      if (ball.y > WATER_LINE) {
        ball.dead = true;
        this.splash(ball.x, WATER_LINE, 160);
        this.spawnFireField(ball.x, ball.charge);
        continue;
      }
      for (const e of this.enemies) {
        if (e.dead || ball.hitEnemies.has(e)) continue;
        if (wrappedDist2(ball.x, ball.y, e.x, e.y) < (ball.radius + e.radius) ** 2) {
          ball.hitEnemies.add(e);
          this.damageEnemy(e, Math.ceil(CHARGE_BALL_DMG * ball.charge));
          this.spark(ball.x, ball.y, PALETTE.gold);
        }
      }
      if (ball.exploded) this.explodeBall(ball);
    }

    // --- Bullets ---
    for (const b of this.bullets) {
      b.update(dt);
      if (b.dead) continue;
      if (b.owner === 'enemy') {
        // The held charge ball soaks incoming fire, at a cost of charge.
        if (
          this.player.ballActive &&
          wrappedDist2(b.x, b.y, this.player.ballX, this.player.ballY) <
            (this.player.ballRadius + 2) ** 2
        ) {
          b.dead = true;
          this.player.charge = Math.max(
            0,
            this.player.charge - CHARGE_BLOCK_DRAIN
          );
          this.spark(b.x, b.y, PALETTE.gold);
          continue;
        }
        // Enemy fire vs friendly drones (perma-death handled in their loop)
        let hitFriendly = false;
        for (const f of this.friendlies) {
          if (f.dead) continue;
          if (wrappedDist2(b.x, b.y, f.x, f.y) < (f.radius + 2) ** 2) {
            b.dead = true;
            f.hit(b.dmg);
            this.spark(b.x, b.y, PALETTE.green);
            hitFriendly = true;
            break;
          }
        }
        if (hitFriendly) continue;
        // Enemy fire vs player
        if (
          !this.player.dead &&
          wrappedDist2(b.x, b.y, this.player.x, this.player.y) <
            (this.player.radius + 2) ** 2
        ) {
          b.dead = true;
          this.player.hit(b.dmg, b.vx * 0.15, b.vy * 0.15);
          this.spark(b.x, b.y, PALETTE.enemyBullet);
        }
        continue;
      }
      for (const e of this.enemies) {
        if (e.dead) continue;
        const rr = (e.radius + 2) ** 2;
        if (wrappedDist2(b.x, b.y, e.x, e.y) < rr) {
          b.dead = true;
          this.damageEnemy(e, b.dmg);
          this.spark(b.x, b.y, PALETTE.bullet);
          break;
        }
      }
    }

    // --- Explosions: AoE queue (drone deaths, volatile kills, bombs).
    // Iterative so chains can't recurse mid-loop. ---
    while (this.pendingExplosions.length > 0) {
      const ex = this.pendingExplosions.shift();
      this.explosionBurst(ex.x, ex.y);
      const r2 = ex.radius ** 2;
      if (
        ex.hurtPlayer &&
        !this.player.dead &&
        wrappedDist2(ex.x, ex.y, this.player.x, this.player.y) < r2
      ) {
        const dx = wrapDX(this.player.x - ex.x);
        const dy = this.player.y - ex.y;
        const d = Math.hypot(dx, dy) || 1;
        this.player.hit(
          ex.dmg,
          (dx / d) * CONTACT_KNOCKBACK,
          (dy / d) * CONTACT_KNOCKBACK
        );
      }
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (wrappedDist2(ex.x, ex.y, e.x, e.y) < r2) {
          this.damageEnemy(e, ex.dmg); // may queue more explosions
        }
      }
    }

    // --- Fire fields: strips of flame on the surface burn low enemies ---
    for (const f of this.fires) {
      f.life -= dt;
      f.tick -= dt;
      if (f.tick <= 0) {
        f.tick = FIREFIELD_TICK;
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (
            Math.abs(wrapDX(e.x - f.x)) < f.halfW &&
            e.y > WATER_LINE - FIREFIELD_HEIGHT &&
            e.y < WATER_LINE + 20
          ) {
            this.damageEnemy(e, FIREFIELD_DMG);
          }
        }
      }
    }

    // --- Shop stations: fly through with money to buy ---
    for (const s of this.stations) {
      s.update(dt);
      if (s.dead || s.armTimer > 0 || this.player.dead) continue;
      const rr = (s.radius + this.player.radius) ** 2;
      if (wrappedDist2(s.x, s.y, this.player.x, this.player.y) < rr) {
        if (this.money >= s.price) {
          this.money -= s.price;
          this.buyItem(s.item);
          s.dead = true;
        } else {
          s.brokeFlash = 0.5;
        }
      }
    }

    // --- Seeker missiles ---
    if (this.player.seekerRequest > 0) {
      const n = this.player.seekerRequest;
      this.player.seekerRequest = 0;
      for (let i = 0; i < n; i++) {
        this.missiles.push(
          new Missile(
            this.player.x,
            this.player.y,
            this.player.angle + (i - (n - 1) / 2) * 0.25
          )
        );
      }
    }
    for (const m of this.missiles) {
      m.update(dt, this.enemies);
      if (m.dead) continue;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (wrappedDist2(m.x, m.y, e.x, e.y) < (e.radius + 3) ** 2) {
          m.dead = true;
          this.damageEnemy(e, m.dmg);
          this.spark(m.x, m.y, PALETTE.white);
          break;
        }
      }
    }

    // --- Depth bombs: fire alongside the gun once their cooldown clears ---
    this.bombTimer = Math.max(0, this.bombTimer - dt);
    if (this.player.bombFired) {
      this.player.bombFired = false;
      if ((this.items.bombs || 0) > 0 && this.bombTimer <= 0) {
        this.bombTimer = BOMB_INTERVAL;
        const a = this.player.angle;
        for (let i = 0; i < this.items.bombs; i++) {
          const fwd =
            BOMB_LAUNCH_SPEED +
            i * BOMB_LAUNCH_SPACING +
            rand(-BOMB_LAUNCH_JITTER, BOMB_LAUNCH_JITTER);
          this.bombs.push(
            new Bomb(
              wrapX(this.player.x + Math.cos(a) * 6),
              this.player.y + 8,
              Math.cos(a) * fwd + this.player.vx * 0.6,
              Math.max(this.player.vy, 0) + 40
            )
          );
        }
      }
    }
    for (const b of this.bombs) {
      b.update(dt);
      if (!b.dead) {
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (wrappedDist2(b.x, b.y, e.x, e.y) < (e.radius + b.radius) ** 2) {
            b.explode(); // direct hit
            break;
          }
        }
      }
      if (b.exploded) {
        b.exploded = false;
        this.pendingExplosions.push({
          x: b.x,
          y: b.y,
          radius: BOMB_EXPLOSION_RADIUS,
          dmg: BOMB_EXPLOSION_DMG,
          hurtPlayer: false,
        });
        this.explosionBurst(b.x, b.y);
        if (b.y >= WATER_LINE - 2) {
          this.splash(b.x, WATER_LINE, 220);
          this.spawnFireField(b.x, BOMB_FIRE_CHARGE);
        }
      }
    }

    // --- Friendly drones (perma-death: stack lost when shot down) ---
    for (const f of this.friendlies) {
      f.update(dt, this.player, this.enemies, this.bullets);
      if (f.dead) {
        const key = f.kind === 'gunner' ? 'gunnerDrone' : 'repairDrone';
        this.items[key] = Math.max(0, (this.items[key] || 0) - 1);
        this.burst(f.x, f.y);
        this.textPop(f.x, f.y - 10, 'DRONE LOST', PALETTE.drone);
      }
    }

    // --- Particles ---
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.gravity || 0) * dt;
    }

    // --- Cleanup ---
    this.bullets = this.bullets.filter((b) => !b.dead);
    this.balls = this.balls.filter((b) => !b.dead);
    this.fires = this.fires.filter((f) => f.life > 0);
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.stations = this.stations.filter((s) => !s.dead);
    this.missiles = this.missiles.filter((m) => !m.dead);
    this.bombs = this.bombs.filter((b) => !b.dead);
    this.friendlies = this.friendlies.filter((f) => !f.dead);
    this.particles = this.particles.filter((p) => p.life > 0);

    // --- Camera ---
    this.camera.follow(this.player, dt);
  }

  // Single path for hurting enemies so every kill pays out, whatever the weapon.
  damageEnemy(e, dmg) {
    if (e.dead) return;
    e.hit(dmg);
    if (e.dead) {
      this.money += e.money;
      this.burst(e.x, e.y);
      this.moneyPop(e.x, e.y, e.money);
      if (e.explodes) this.queueExplosion(e);
      // Volatile Kills: your kills detonate (never hurts you)
      const v = this.items.volatile || 0;
      if (v > 0) {
        this.pendingExplosions.push({
          x: e.x,
          y: e.y,
          radius: VOLATILE_BASE_RADIUS + VOLATILE_RADIUS_PER_STACK * v,
          dmg: VOLATILE_BASE_DMG + VOLATILE_DMG_PER_STACK * v,
          hurtPlayer: false,
        });
      }
    }
  }

  queueExplosion(e) {
    if (e._exploded) return;
    e._exploded = true;
    this.pendingExplosions.push({
      x: e.x,
      y: e.y,
      radius: DRONE_EXPLOSION_RADIUS,
      dmg: DRONE_EXPLOSION_DMG,
      hurtPlayer: true, // enemy self-destruct hurts everyone
    });
  }

  // ---- Shop ----
  restockStations() {
    this.stations = [];
    const count = Math.round(rand(STATION_COUNT_MIN, STATION_COUNT_MAX));
    // Distinct items per restock
    const pool = [...ITEM_IDS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (let i = 0; i < count; i++) {
      const item = ITEMS[pool[i]];
      const x = wrapX(this.camera.x + VIEW_W / 2 + rand(-500, 500));
      const y = rand(130, WATER_LINE - 130);
      this.stations.push(
        new Station(x, y, item, itemPrice(item, Math.max(1, this.wave)))
      );
    }
  }

  buyItem(item) {
    this.items[item.id] = (this.items[item.id] || 0) + 1;
    this.applyItems();
    if (item.id === 'gunnerDrone' || item.id === 'repairDrone') {
      this.friendlies.push(
        new FriendlyDrone(
          item.id === 'gunnerDrone' ? 'gunner' : 'repair',
          rand(0, Math.PI * 2)
        )
      );
    }
    this.textPop(this.player.x, this.player.y - 16, item.name, item.color);
  }

  // Recompute item-derived stats onto the player (idempotent).
  applyItems() {
    this.player.fireCooldownMult = 1 / (1 + 0.3 * (this.items.rapid || 0));
    this.player.ricochetBounces = this.items.ricochet || 0;
    this.player.seekerStacks = this.items.seeker || 0;
  }

  explosionBurst(x, y) {
    for (let i = 0; i < 14; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(60, 200);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.25, 0.55),
        color: i % 3 === 0 ? PALETTE.white : i % 3 === 1 ? PALETTE.gold : PALETTE.drone,
        size: 2,
      });
    }
  }

  spawnFireField(x, charge) {
    const halfW = FIREFIELD_BASE_HALFW + FIREFIELD_CHARGE_HALFW * charge;
    this.fires.push({ x, halfW, life: FIREFIELD_DURATION, tick: 0 });
    // Eruption: embers thrown up across the whole width
    for (let i = 0; i < 14; i++) {
      this.particles.push({
        x: x + rand(-halfW, halfW),
        y: WATER_LINE,
        vx: rand(-30, 30),
        vy: rand(-170, -60),
        gravity: 240,
        life: rand(0.3, 0.8),
        color: i % 2 ? PALETTE.gold : PALETTE.coral,
        size: 2,
      });
    }
  }

  explodeBall(ball) {
    // Shotgun break: shards spray forward in a cone along the ball's path.
    const dir = Math.atan2(ball.vy, ball.vx);
    for (let i = 0; i < SHARD_COUNT; i++) {
      const a = dir + rand(-SHOTGUN_SPREAD, SHOTGUN_SPREAD);
      const s = SHARD_SPEED * rand(0.8, 1.15);
      this.bullets.push(
        new Bullet(
          ball.x,
          ball.y,
          Math.cos(a) * s,
          Math.sin(a) * s,
          'player',
          SHARD_DMG,
          SHARD_LIFE
        )
      );
    }
    this.burst(ball.x, ball.y);
  }

  startWave() {
    this.wave++;
    const w = this.wave;
    const queue = [];
    const push = (type, n) => {
      for (let i = 0; i < n; i++) queue.push(type);
    };
    // Core: gunners. Drones join early; ships and bombers are rare heavies.
    push(
      'gunner',
      Math.min(WAVE_MAX_COUNT, WAVE_BASE_COUNT + (w - 1) * WAVE_COUNT_GROWTH)
    );
    if (w >= DRONE_FROM_WAVE) push('drone', Math.min(10, 2 + w));
    if (w >= SHIP_FROM_WAVE)
      push('ship', Math.min(3, 1 + Math.floor((w - SHIP_FROM_WAVE) / 2)));
    if (w >= BOMBER_FROM_WAVE)
      push('bomber', Math.min(2, 1 + Math.floor((w - BOMBER_FROM_WAVE) / 3)));
    // Shuffle so types arrive interleaved
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    this.spawnQueue = queue;
    this.spawnTimer = 0;
  }

  spawnEnemy(type) {
    // Spawn just outside the camera view, placed to suit the type.
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = wrapX(
      this.camera.x + VIEW_W / 2 + side * (VIEW_W / 2 + rand(40, 120))
    );
    const d = this.difficulty;
    switch (type) {
      case 'drone':
        this.enemies.push(new Drone(x, rand(60, WATER_LINE - 60), d));
        break;
      case 'ship':
        this.enemies.push(new Ship(x, 0, d)); // y is forced to the surface
        break;
      case 'bomber':
        this.enemies.push(new Bomber(x, rand(80, 260), d));
        break;
      default:
        this.enemies.push(new Gunner(x, rand(60, WATER_LINE - 60), d));
    }
  }

  // ---- Particles ----
  splash(x, y, intensity) {
    const n = clamp(Math.round(intensity / 30), 4, 16);
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x + rand(-6, 6),
        y,
        vx: rand(-50, 50),
        vy: rand(-140, -40) * (intensity / 300),
        gravity: 300,
        life: rand(0.3, 0.7),
        color: PALETTE.waterSurface,
        size: 2,
      });
    }
  }

  spark(x, y, color) {
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        x,
        y,
        vx: rand(-60, 60),
        vy: rand(-60, 60),
        life: rand(0.1, 0.25),
        color,
        size: 1,
      });
    }
  }

  burst(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(40, 140);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.25, 0.5),
        color: i % 2 ? PALETTE.enemy : PALETTE.coral,
        size: 2,
      });
    }
  }

  moneyPop(x, y, amount) {
    this.textPop(x, y - 8, `+$${amount}`, PALETTE.gold);
  }

  textPop(x, y, text, color) {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: -30,
      life: 0.9,
      color,
      size: 0,
      text,
    });
  }

  // ---- Render ----
  render(ctx) {
    const cam = this.camera;
    this.world.render(ctx, cam);
    this.renderFires(ctx, cam);

    for (const s of this.stations) s.render(ctx, cam);
    for (const e of this.enemies) e.render(ctx, cam);
    for (const b of this.bullets) b.render(ctx, cam);
    for (const ball of this.balls) ball.render(ctx, cam);
    for (const m of this.missiles) m.render(ctx, cam);
    for (const b of this.bombs) b.render(ctx, cam);
    for (const f of this.friendlies) f.render(ctx, cam);
    if (!this.player.dead) this.player.render(ctx, cam);

    for (const p of this.particles) {
      if (p.text) {
        ctx.font = '8px monospace';
        drawLabel(
          ctx,
          p.text,
          Math.round(cam.sx(p.x)) - 10,
          Math.round(cam.sy(p.y)),
          p.color
        );
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(
          Math.round(cam.sx(p.x)),
          Math.round(cam.sy(p.y)),
          p.size,
          p.size
        );
      }
    }

    this.renderEnemyIndicators(ctx, cam);
    this.renderVignette(ctx);
    this.renderHud(ctx);
  }

  // Edge triangles pointing at offscreen enemies — size tracks the enemy's
  // size, color matches its body, so bigger threats read at a glance.
  renderEnemyIndicators(ctx, cam) {
    const pad = 8;
    for (const e of this.enemies) {
      const sx = cam.sx(e.x);
      const sy = cam.sy(e.y);
      const m = e.radius + 4; // offscreen margin
      if (sx > -m && sx < VIEW_W + m && sy > -m && sy < VIEW_H + m) continue;
      const cx = clamp(sx, pad, VIEW_W - pad);
      const cy = clamp(sy, pad, VIEW_H - pad);
      const a = Math.atan2(sy - cy, sx - cx); // points toward the enemy
      const size = clamp(e.radius * 0.7, 4, 12);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = e.color; // per-type: red drones read instantly
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.lineTo(-size * 0.6, size * 0.6);
      ctx.lineTo(-size * 0.6, -size * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // Flames licking up from the water surface where a charge ball was dunked.
  renderFires(ctx, cam) {
    const surfaceY = WATER_LINE - cam.y;
    if (surfaceY < -10 || surfaceY > VIEW_H + 10) return;
    for (const f of this.fires) {
      const frac = f.life / FIREFIELD_DURATION; // flames die down over time
      const cols = Math.max(4, Math.round(f.halfW / 4));
      for (let i = 0; i < cols; i++) {
        const wx = f.x + ((i / (cols - 1)) * 2 - 1) * f.halfW;
        const sx = Math.round(cam.sx(wx));
        if (sx < -4 || sx > VIEW_W + 4) continue;
        const h = Math.round(
          (3 + Math.random() * FIREFIELD_HEIGHT * 0.8) * frac
        );
        if (h < 2) continue;
        ctx.fillStyle = Math.random() < 0.35 ? PALETTE.gold : PALETTE.coral;
        ctx.fillRect(sx, Math.round(surfaceY) - h, 2, h);
        if (Math.random() < 0.2) {
          ctx.fillStyle = PALETTE.white;
          ctx.fillRect(sx, Math.round(surfaceY) - h - 2, 1, 2);
        }
      }
    }
  }

  // Danger vignette: screen edges darken as the shield drops, with an extra
  // pulse right after taking a hit — health is always readable at a glance.
  renderVignette(ctx) {
    const hpFrac = clamp(this.player.hp / PLAYER_HP, 0, 1);
    const danger = 1 - hpFrac;
    const hitFlash = Math.max(0, this.player.invuln / HIT_INVULN) * 0.4;
    let intensity = Math.min(1, danger * 0.85 + hitFlash);
    if (hpFrac < 0.35) {
      intensity = Math.min(1, intensity + 0.08 * Math.sin(this.elapsed * 6));
    }
    if (intensity < 0.03) return;

    const cx = VIEW_W / 2;
    const cy = VIEW_H / 2;
    const inner = Math.min(VIEW_W, VIEW_H) * (0.55 - 0.3 * intensity);
    const g = ctx.createRadialGradient(cx, cy, inner, cx, cy, VIEW_W * 0.72);
    g.addColorStop(0, 'rgba(30,8,16,0)');
    g.addColorStop(1, `rgba(30,8,16,${(0.85 * intensity).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  renderHud(ctx) {
    // Shield bar (regenerating)
    const hpFrac = clamp(this.player.hp / PLAYER_HP, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(8, 8, 80, 7);
    ctx.fillStyle = hpFrac > 0.3 ? PALETTE.waterSurface : PALETTE.coral;
    ctx.fillRect(9, 9, Math.round(78 * hpFrac), 5);

    // Money + timer
    ctx.font = '8px monospace';
    drawLabel(ctx, `$${this.money}`, 8, 26, PALETTE.gold);
    const m = Math.floor(this.elapsed / 60);
    const s = Math.floor(this.elapsed % 60)
      .toString()
      .padStart(2, '0');
    ctx.fillStyle = PALETTE.hudText;
    ctx.fillText(`${m}:${s}`, VIEW_W - 34, 14);

    // Wave + enemies remaining
    if (this.wave > 0) {
      drawLabel(ctx, `WAVE ${this.wave}`, VIEW_W - 52, 26, PALETTE.coral);
      const left = this.enemies.length + this.spawnQueue.length;
      if (left > 0) {
        ctx.fillStyle = PALETTE.hudText;
        ctx.fillText(`x${left}`, VIEW_W - 52, 36);
      }
    }

    // Owned items row (bottom-left): colored chip + stack count
    let ix = 8;
    for (const id of Object.keys(this.items)) {
      const stacks = this.items[id];
      if (stacks <= 0) continue;
      ctx.fillStyle = ITEMS[id].color;
      ctx.fillRect(ix, VIEW_H - 14, 6, 6);
      ctx.fillStyle = PALETTE.hudText;
      ctx.font = '8px monospace';
      ctx.fillText(`x${stacks}`, ix + 8, VIEW_H - 7);
      ix += 28;
    }

    // Incoming-wave banner during the breather
    if (!this.gameOver && this.breakTimer > 0 && this.breakTimer < WAVE_BREAK) {
      const next = this.wave + 1;
      if (Math.floor(this.breakTimer * 4) % 2 === 0) {
        ctx.textAlign = 'center';
        ctx.font = '10px monospace';
        drawLabel(ctx, `WAVE ${next} INCOMING`, VIEW_W / 2, 40, PALETTE.coral);
        ctx.textAlign = 'left';
      }
    }

    if (this.gameOver) {
      ctx.fillStyle = 'rgba(20,40,50,0.6)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = PALETTE.white;
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('WRECKED', VIEW_W / 2, VIEW_H / 2 - 12);
      ctx.font = '8px monospace';
      ctx.fillText(
        `wave ${this.wave}  ·  ${m}:${s}  ·  $${this.money}`,
        VIEW_W / 2,
        VIEW_H / 2 + 6
      );
      ctx.fillText('press R to restart', VIEW_W / 2, VIEW_H / 2 + 22);
      ctx.textAlign = 'left';
    }

    // Crosshair at the cursor (the OS cursor is hidden over the canvas).
    if (this.input.mouseX != null) {
      const mx = Math.round(this.input.mouseX);
      const my = Math.round(this.input.mouseY);
      // Dark drop-shadow so it reads on clouds and water alike.
      for (const [color, o] of [
        [PALETTE.enemyDark, 1],
        [PALETTE.white, 0],
      ]) {
        ctx.fillStyle = color;
        ctx.fillRect(mx - 4 + o, my + o, 3, 1);
        ctx.fillRect(mx + 2 + o, my + o, 3, 1);
        ctx.fillRect(mx + o, my - 4 + o, 1, 3);
        ctx.fillRect(mx + o, my + 2 + o, 1, 3);
      }
    }
  }
}
