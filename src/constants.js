// ---- Rendering ----
// Internal (pixel-art) resolution is derived from the window size at runtime
// (see main.js): the canvas fills the whole window, and ZOOM_HEIGHT sets how
// many world pixels are visible vertically (bigger = more zoomed out).
export const ZOOM_HEIGHT = 340;
export let VIEW_W = 480; // live bindings, updated on resize
export let VIEW_H = 300;
export function setViewSize(w, h) {
  VIEW_W = w;
  VIEW_H = h;
}

// ---- Palette (from reference screenshot) ----
export const PALETTE = {
  sky: '#7cd6e8',
  cloud: '#eef1f1',
  cloudShadow: '#d3dadb',
  water: '#3d7bc0',
  waterSurface: '#8fc4ec',
  green: '#7ed08f',
  greenDark: '#58b57a',
  coral: '#e8845c',
  coralDark: '#c96a48',
  teal: '#2f6b6b',
  white: '#ffffff',
  enemy: '#3d5a66',
  enemyDark: '#2c414a',
  drone: '#e05252',
  droneDark: '#a83a3a',
  ship: '#4a6472',
  shipDark: '#354a55',
  bomber: '#556472',
  bomberDark: '#3d4a55',
  bullet: '#fff3c4',
  enemyBullet: '#ff9d76',
  hudText: '#ffffff',
  gold: '#f4c95d',
};

// ---- World ----
export const WORLD_W = 3000;
export const WORLD_H = 1400;
export const WATER_LINE = WORLD_H - 320; // y of water surface (y grows downward)

// ---- Physics ----
export const STEP = 1 / 120; // fixed timestep (s)
export const GRAVITY = 220; // px/s^2 downward
export const THRUST = 420; // px/s^2 along facing
export const ROT_SPEED = 3.6; // rad/s (base)
// Inertia: nimble when slow, heavy when fast — turn rate = ROT_SPEED * lerp
export const ROT_MULT_SLOW = 1.5; // multiplier at standstill
export const ROT_MULT_FAST = 0.6; // multiplier at MAX_SPEED
export const AIR_DRAG = 0.35; // 1/s linear drag in air
export const BRAKE_DRAG = 2.2; // 1/s extra drag while holding S (air only) —
// slow enough to aim, but slow too long and lift fades: you stall and drop
export const AIM_DEADZONE = 20; // px: cursor closer than this holds heading
// Aerodynamic lift: air gravity fades with speed, gone at LIFT_SPEED.
// Flying fast & level sustains altitude; stalling makes you drop.
export const LIFT_SPEED = 280; // px/s
export const BUOY_K = 25.0; // buoyancy spring: accel = BUOY_K * depth (1/s^2 * px)
// Float equilibrium = GRAVITY / BUOY_K ≈ 9px, so a calm plane sits ON the
// surface (half out of the water) rather than sinking deep.
export const WATER_CALM_SPEED = 80; // below this speed, water damps (lets you settle/float)
export const WATER_CALM_DRAG = 2.5; // 1/s drag applied only when calm
// Skim ejection: fast, mostly-horizontal movement just under the surface gets
// kicked back out — water is a trampoline, not a highway. Dives are untouched
// (they cross the skim layer with |vy| ~ |vx|, so the condition never fires).
export const SKIM_DEPTH = 15; // px below surface where skimming is detected
export const SKIM_MIN_VX = 120; // need this much horizontal speed
export const SKIM_LIFT = 900; // px/s^2 upward ejection
export const NOSE_LEN = 10; // px from center to the plane's tip
export const SUBMERGED_ALPHA = 0.5; // plane opacity while under water
export const MAX_SPEED = 520; // soft cap, air only

// ---- Player ----
export const PLAYER_HP = 100;
export const FIRE_COOLDOWN = 0.13; // s between shots
export const BULLET_SPEED = 620;
export const BULLET_LIFE = 1.4; // s
export const BULLET_DMG = 12;
export const BULLET_SPREAD = 0.09; // rad, random spread per machine-gun shot

// ---- Ramming (body collision with an enemy) ----
// Damage you deal scales with what you bring: shield + held charge. Costs
// some shield, drains charge, and gives brief invulnerability — an option,
// not free, not spammy.
export const RAM_PLAYER_DMG = 12; // shield cost per ram
export const RAM_DMG_BASE = 16; // dealt to enemy, bare minimum
export const RAM_DMG_CHARGE = 45; // + this * charge
export const RAM_DMG_SHIELD = 25; // + this * (hp / max)
export const RAM_CHARGE_DRAIN = 0.25; // charge lost per ram

// ---- Boost (Shift): charged burst of thrust; tail nozzle blinks when ready ----
export const BOOST_IMPULSE = 340; // px/s instant kick along facing
export const BOOST_RECHARGE = 5.0; // s from empty to ready
export const BOOST_OVERSPEED_TIME = 1.2; // s the speed cap is raised after boosting
export const BOOST_OVERSPEED_MULT = 1.6; // cap multiplier while overspeeding

// ---- Shield (Halo-style): depletes on damage, regens after a calm delay ----
export const SHIELD_REGEN_DELAY = 3.0; // s without taking damage
export const SHIELD_REGEN_RATE = 30; // hp/s

// ---- Charge gun: a ball builds passively at the nose ----
// Spend it as melee (ram enemies with it) or fire it (RMB) as a slow
// piercing ball that explodes into shards at the end of its range.
export const CHARGE_DELAY = 1.2; // s cool-off after a launch/dunk before charging resumes
export const CHARGE_TIME = 7.0; // s from empty to full charge — slow & deliberate
export const CHARGE_ACTIVE = 0.35; // min charge for the ball to melee/fire
export const CHARGE_BALL_OFFSET = 24; // px in front of the plane's center
export const CHARGE_BALL_MIN_R = 1; // radius when charge just starts
export const CHARGE_BALL_MAX_R = 9; // radius at full charge
export const CHARGE_BALL_SPEED = 280; // slow projectile — breaks after ~0.5s
export const CHARGE_BALL_RANGE = 140; // px of travel before breaking — the ball
// leg is short (point-blank vs big ships); the shotgun does the reaching.
export const CHARGE_BALL_DMG = 40; // per enemy pierced, scaled by charge
export const CHARGE_MELEE_DMG = 45; // per melee hit, scaled by charge
export const CHARGE_MELEE_DRAIN = 0.35; // charge lost per melee hit
export const CHARGE_BLOCK_DRAIN = 0.1; // charge lost per enemy bullet absorbed
export const MELEE_TICK = 0.12; // s between melee damage ticks
// Shotgun break: the ball bursts into shards sprayed FORWARD in a cone.
// Ball (~140px) + shards (~340px) ≈ one screen width of total reach.
export const SHARD_COUNT = 10;
export const SHARD_SPEED = 400;
export const SHARD_LIFE = 0.85; // s -> shard range ≈ 340px
export const SHARD_DMG = 8;
export const SHOTGUN_SPREAD = 0.35; // rad, cone half-angle of the break
export const CONTACT_DMG = 18; // enemy touching player
export const CONTACT_KNOCKBACK = 260;
export const HIT_INVULN = 0.6; // s of invulnerability after contact hit

// ---- Enemies: Gunner (the standoff shooter core) ----
export const ENEMY_BASE_HP = 24;
export const ENEMY_BASE_SPEED = 120;
export const ENEMY_RADIUS = 9;
export const ENEMY_MONEY = 12;
export const ENEMY_STANDOFF = 130; // keeps this distance and shoots
export const ENEMY_FIRE_RANGE = 280;
export const ENEMY_FIRE_MIN = 1.3; // s between shots (random in range)
export const ENEMY_FIRE_MAX = 2.4;
export const ENEMY_BULLET_SPEED = 260;
export const ENEMY_BULLET_DMG = 10;
export const ENEMY_BULLET_SPREAD = 0.12;

// ---- Drone: small red kamikaze; explodes on ANY death, hurting everyone ----
export const DRONE_HP = 8;
export const DRONE_SPEED = 210;
export const DRONE_ACCEL = 520;
export const DRONE_RADIUS = 5;
export const DRONE_MONEY = 8;
export const DRONE_FUSE_DIST = 16; // proximity fuse: this close to the player -> boom
export const DRONE_EXPLOSION_RADIUS = 55;
export const DRONE_EXPLOSION_DMG = 18; // applied to player AND enemies (chains)

// ---- Ship: floats on the surface, slow chase, turret ----
export const SHIP_HP = 90;
export const SHIP_SPEED = 45;
export const SHIP_RADIUS = 16;
export const SHIP_MONEY = 35;
export const SHIP_DRAFT = 6; // hull center sits this far above the waterline
export const SHIP_FIRE_MIN = 1.0;
export const SHIP_FIRE_MAX = 1.8;
export const SHIP_FIRE_RANGE = 340;

// ---- Bomber: huge, barely moves, two independent turrets ----
export const BOMBER_HP = 150;
export const BOMBER_SPEED = 22;
export const BOMBER_RADIUS = 20;
export const BOMBER_MONEY = 45;
export const BOMBER_TURRET_OFFSET = 14; // px from center to each turret
export const BOMBER_FIRE_MIN = 1.6;
export const BOMBER_FIRE_MAX = 2.6;
export const BOMBER_FIRE_RANGE = 320;

// ---- Wave composition: rare heavies ----
export const DRONE_FROM_WAVE = 2;
export const SHIP_FROM_WAVE = 3;
export const BOMBER_FROM_WAVE = 5;

// ---- Shop stations (fly through to buy) ----
export const STATION_COUNT_MIN = 2;
export const STATION_COUNT_MAX = 3;
export const STATION_RADIUS = 14; // buy-touch radius
export const STATION_ARM_DELAY = 0.8; // s before a fresh station can be bought
export const PRICE_WAVE_GROWTH = 0.15; // price = base * (1 + this * (wave-1))

// ---- Friendly drones (perma-death: shot down = stack lost) ----
export const FRIENDLY_HP = 20;
export const FRIENDLY_ORBIT_R = 26;
export const FRIENDLY_RADIUS = 4;
export const FRIENDLY_GUN_COOLDOWN = 0.9;
export const FRIENDLY_GUN_RANGE = 260;
export const FRIENDLY_GUN_DMG = 8;
export const FRIENDLY_HEAL_RATE = 6; // hp/s, works during shield regen delay

// ---- Seeker missiles (every Nth machine-gun shot) ----
export const SEEKER_EVERY = 5; // shots per missile volley
export const MISSILE_SPEED = 330;
export const MISSILE_TURN = 4.0; // rad/s homing turn rate
export const MISSILE_DMG = 20;
export const MISSILE_LIFE = 2.5;

// ---- Depth bombs (fire alongside the gun once their cooldown clears) ----
export const BOMB_INTERVAL = 4.0; // s cooldown between volleys
export const BOMB_GRAVITY = 320;
export const BOMB_EXPLOSION_RADIUS = 70;
export const BOMB_EXPLOSION_DMG = 30;
export const BOMB_FIRE_CHARGE = 0.4; // small fire field left at the impact
export const BOMB_LAUNCH_SPEED = 70; // forward kick along the plane's facing
export const BOMB_LAUNCH_SPACING = 35; // extra forward speed per stack, so a volley fans out
export const BOMB_LAUNCH_JITTER = 12; // random forward-speed variance per bomb

// ---- Volatile Kills: your kills explode (never hurts you) ----
export const VOLATILE_BASE_RADIUS = 40;
export const VOLATILE_RADIUS_PER_STACK = 15;
export const VOLATILE_BASE_DMG = 10;
export const VOLATILE_DMG_PER_STACK = 8;

// ---- Fire field: a dunked charge ball erupts on the surface ----
// The absorbed energy becomes a wide strip of flames licking up from the
// water — dive over low enemies with a charge to burn them.
export const FIREFIELD_DURATION = 2.5; // s
export const FIREFIELD_HEIGHT = 36; // px of flame above the surface
export const FIREFIELD_TICK = 0.2; // s between damage ticks
export const FIREFIELD_DMG = 8; // per tick
export const FIREFIELD_BASE_HALFW = 30; // half-width at zero charge
export const FIREFIELD_CHARGE_HALFW = 60; // + this * charge

// ---- Waves (horde mode): clear a wave, breather, next wave is bigger ----
export const WAVE_BASE_COUNT = 4; // enemies in wave 1
export const WAVE_COUNT_GROWTH = 2; // extra enemies per wave
export const WAVE_MAX_COUNT = 24;
export const WAVE_BREAK = 3.0; // s of calm between waves
export const SPAWN_STAGGER = 0.6; // s between spawns within a wave
export const WAVE_DIFF_GROWTH = 0.3; // difficulty = 1 + (wave-1) * this
