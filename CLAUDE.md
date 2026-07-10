# Risk of Planes

A roguelike dogfighting game: **Luftrausers** flight (2D side-view momentum plane, water
at the bottom) × **Risk of Rain** progression (kill enemies → money → items, difficulty
scales with elapsed time). Vanilla JS + Canvas 2D, Vite, targets GitHub Pages.

## Commands

- `npm run dev` — dev server (Vite, HMR) at localhost:5173
- `npm run build` — static bundle in `dist/` (base `./`, GH-Pages ready)
- `npm run preview` — serve the built bundle

## Vision & roadmap

Core mechanics are DONE (flight w/ lift, water trampoline, wrapped world, charge-gun
weapon system, shield regen + vignette, one enemy, money, wave-based horde mode).
Iterate next, roughly in order:

1. Polish: audio, screen shake, better sprites, menus
2. More items, bosses, meta-progression — as the user directs

## Shop & items (src/items.js, src/entities/station.js)
- **Fly-through stations**: balloon-hung crates showing item color + price. 2–3 spawn
  at each wave clear (`game.restockStations`, distinct items), PERSIST through the next
  wave, replaced at the next clear. Touch with money = instant buy (`STATION_ARM_DELAY`
  prevents spawn-accidents; broke touch flashes the price red). Prices escalate:
  `itemPrice(item, wave)` = base × (1 + `PRICE_WAVE_GROWTH`·(wave−1)).
- **Items stack**; owned stacks shown as colored chips bottom-left HUD.
- Effects use a **derived-stats pattern**: `game.applyItems()` recomputes player fields
  (`fireCooldownMult`, `ricochetBounces`, `seekerStacks`) on every purchase. Event flags
  (`seekerRequest`) follow the `boostFired` pattern. Other items hook in game.js.
- Pool (`ITEMS`): **rapid** (+30%/stack fire rate) · **volatile** (kills explode,
  `hurtPlayer:false`) · **ricochet** (bullets skip off water, 1 bounce/stack) ·
  **seeker** (every `SEEKER_EVERY`th shot fires homing missiles, missile.js) ·
  **bombs** (auto-drop depth bombs → water blast + small fire field, bomb.js) ·
  **gunnerDrone**/**repairDrone** (friendly.js: orbiters; gunner shoots nearest, repair
  heals through the regen delay; killable — **PERMA-DEATH** decrements the stack).
- Explosion queue is generalized: `pendingExplosions` entries are
  `{x, y, radius, dmg, hurtPlayer}` — drone deaths hurt everyone, volatile/bombs don't.

## Enemy roster (src/entities/enemy.js: base `Enemy` + subclasses)
All types set: `radius` (drives collisions + edge-indicator size), `money` (payout via
`game.damageEnemy`), `color`/`colorDark` (body + indicator), optional `explodes`.
- **Gunner** (dark teal): standoff shooter, the wave core. `ENEMY_*` constants.
- **Drone** (RED, `DRONE_*`): small fast kamikaze; proximity fuse near the player; ANY
  death → AoE explosion hurting player AND enemies — chains through packs. Explosions
  flow through `game.queueExplosion` → `pendingExplosions` (iterative, chain-safe).
- **Ship** (`SHIP_*`): floats ON the surface (y forced to `WATER_LINE - SHIP_DRAFT` +
  bob), slow x-chase, turret. Vulnerable to fire fields — that's the intended play.
- **Bomber** (`BOMBER_*`): huge, drifts slowly, two independent turret mounts. The
  charge ball's piercing slug is its counter.
Waves (`game.startWave`): gunners always; drones from wave `DRONE_FROM_WAVE` (2),
ships from 3, bombers from 5 (rare heavies, 1–2 each); queue shuffled, spawn-staggered.

Design decisions (agreed with user):
- Arena **wraps horizontally** (seamless/continuous); top is a wall, bottom is water
- **Lift**: air gravity fades with airspeed (zero at `LIFT_SPEED`) — flying fast & level
  sustains altitude, stalling drops you. Full gravity always applies in water.
- **Horde mode**: waves, not timed spawns — clear all enemies → breather → bigger wave.
  Difficulty scales with wave number (`1 + (wave-1)*WAVE_DIFF_GROWTH`), read at spawn.
- Controls: **mouse** aims (plane turns toward the cursor at its normal inertia-scaled
  turn rate — the cursor is a target, not a teleport; `AIM_DEADZONE`px around the plane
  holds heading; pixel crosshair drawn in-game, OS cursor hidden via CSS), **LMB** fire,
  **RMB** special (launch charge ball, edge-triggered), **W** thrust, **S** brake
  (`BRAKE_DRAG`, air only — bleed speed to aim, but stall and you drop; water rules
  untouched), **Shift** boost, **R** restart. Screen→world aim mapping in game.js:
  `wrapX(cam.x + mouseX)`, `cam.y + mouseY`.
- **Boost** (Shift, edge-triggered): instant `BOOST_IMPULSE` kick along facing; recharges
  in `BOOST_RECHARGE`s; raises the speed cap briefly (`BOOST_OVERSPEED_*`). Blocked while
  tip is underwater. Readiness feedback = afterburner nozzle on the tail: grows dim cyan
  while recharging, blinks white/cyan when ready (mirrors the charge ball up front).
- **Charge gun**: LMB = machine gun w/ spread. The charge ball builds **passively**
  (firing does NOT suppress it): full in `CHARGE_TIME`s, active above `CHARGE_ACTIVE`;
  only a launch or a water dunk zeroes it, then a `CHARGE_DELAY` cool-off before it
  regrows. Full charge blinks gold/white + throbs. The held ball melees enemies on
  contact (big dmg, drains charge, shoves them off) AND soaks incoming enemy bullets
  (`CHARGE_BLOCK_DRAIN` each — it's a shield). RMB (edge-triggered) launches the ball:
  slow, pierces (hits each enemy once), flies ~1s (`CHARGE_BALL_RANGE`), then
  **shotgun-breaks**: `SHARD_COUNT` shards spray forward in a `SHOTGUN_SPREAD` cone;
  ball+shards ≈ one screen of total reach.
  Design tension: hold the ball for defense/melee vs launch it and fly naked.
- **Shield** (Halo-style): hp regens at `SHIELD_REGEN_RATE` after `SHIELD_REGEN_DELAY`s
  without damage. Primary feedback = danger **vignette** (screen edges darken as hp
  drops + hit flash + low-hp pulse), see `game.renderVignette`.
- **Inertia turning**: turn rate scales `ROT_MULT_SLOW`→`ROT_MULT_FAST` with speed —
  nimble when slow, wide curves at speed.
- **Enemies are gunners**, not kamikazes: they close to `ENEMY_STANDOFF`, keep distance,
  and shoot (`ENEMY_FIRE_*`, `ENEMY_BULLET_*`). Bullets (all owners) die in water —
  diving is real cover.
- **Ramming** (body contact): player takes `RAM_PLAYER_DMG` + loses `RAM_CHARGE_DRAIN`
  charge; enemy takes `RAM_DMG_BASE + RAM_DMG_CHARGE*charge + RAM_DMG_SHIELD*hpFrac`
  (computed before costs). Gated by the player's hit-invuln, so no per-frame spam.
- **Fire field**: dunking a charge ball (held or fired) erupts a strip of surface flames
  (`FIREFIELD_*`): width scales w/ charge, burns enemies near the surface for its
  duration. Dive over low enemies with a charge = area weapon. `game.spawnFireField`.
- Aesthetic: flat chunky pixel-art, palette from a reference screenshot
  (cyan sky `#7cd6e8`, blue water, coral player plane) — all colors in `src/constants.js` PALETTE
- Rendering fills the whole window: integer pixel scale picked from window height
  (`ZOOM_HEIGHT` = world px visible vertically; bigger = more zoomed out), internal
  resolution derived from window size (no letterbox). `VIEW_W`/`VIEW_H` are **live
  `let` bindings** in constants.js updated on resize — never copy them at module load.
  `imageSmoothingEnabled=false` (reset after every canvas resize).

## The signature mechanic: water trampoline (do not break)

In `src/entities/plane.js`. Water is a **depth-proportional buoyancy spring with no drag**
(energy-conserving): upward accel `= BUOY_K * depth`, gravity still applies.

- Dive at an angle → decelerate → invert → exit at **mirrored angle & equal speed**
  (horizontal velocity untouched in water; vertical is a symmetric spring)
- Gentle entry → bobs at equilibrium depth (`GRAVITY/BUOY_K` ≈ 37px) = floating
- One exception: when total speed < `WATER_CALM_SPEED`, a small drag applies so bobbing
  settles into a real float. Fast bounces are unaffected (at max depth the energy is in
  spring compression, not velocity).
- `BUOY_K` is stiff (25) so the float equilibrium (`GRAVITY/BUOY_K` ≈ 9px) sits ON the
  surface — the plane floats half out of the water.

Water is a safety net, NOT a highway — the underwater rules (all in plane.js):
- **No thrust / no guns while the tip is submerged** (`tipUnderwater` getter — nose is
  `NOSE_LEN`px out). Take off from a float by pointing steeply up so the tip clears.
- **Skim ejection**: fast mostly-horizontal movement in the top `SKIM_DEPTH`px gets
  kicked out (`SKIM_LIFT`). Dives cross the layer with |vy|~|vx| so the mirror is safe.
- **Water absorbs charge**: submerged (or dipping the held ball) zeroes `charge` and
  sets `ballAbsorbed` (game.js shows a fizzle splash). Fired ChargeBalls die in water,
  no shards. So you can't charge while floating — going under has a real cost.
- Plane renders at `SUBMERGED_ALPHA` (50%) while under water.

Verified numerically: 45°@300 → −45°@296; float settles at 8.8px; skim ejects in ~0.2s;
zero thrust/bullets while submerged. Re-verify with a Node sim (Plane is importable
headlessly): stub input `{down:(k)=>..., fireDown:bool, specialDown:bool}`, step
`update(STEP, input, [], [], aim)` — `aim = {x, y}` world target or `null` (holds
heading, mouse-aim skipped).

## Architecture

```
index.html          canvas shell, pixelated CSS scaling
src/main.js         bootstrap: window-filling canvas + zoom, fixed-timestep loop (STEP=1/120)
src/constants.js    ALL tuning knobs + PALETTE (edit here to tweak feel)
src/game.js         Game: reset/update/render, wave flow, collisions, particles, HUD, game over
src/input.js        Input class: held-keys Set (W/S/R/Shift) + mouse (mouseX/mouseY in
                    canvas px, fireDown=LMB, specialDown=RMB); clears on blur
src/camera.js       wrap-aware follow; cam.sx(x)/cam.sy(y) = world->screen (USE THESE);
                    cam.scrollX = continuous scroll for parallax
src/world.js        sky, parallax clouds (wrap-continuous), single-color water (visual only)
src/util.js         clamp/lerp/rand/dist2 + wrapX(x), wrapDX(dx) for the wrapped world
src/entities/
  plane.js          player physics (thrust/lift/water spring), charge state + firing,
                    shield regen, ballX/ballY/ballRadius/ballActive getters for melee
  bullet.js         projectile w/ per-instance dmg & life (shards reuse it), owner tag
  chargeball.js     fired charge ball: pierces via hitEnemies Set, explodes at range end
  enemy.js          chaser: seeks player, contact dmg, hp bar, stats scale w/ difficulty
```

Conventions: y grows downward (angle 0 = right, negative = up). World units = pixels at
the internal resolution. Entities expose `update(dt, ...)` / `render(ctx, cam)` / `dead` flag;
`game.js` filters dead entities each step.

**Wrapped world gotchas**: never compute raw `a.x - b.x` for positions — use `wrapDX()`
(distance/seeking/knockback use `wrappedDist2`/`wrapDX` in game.js & enemy.js). Always
normalize entity x with `wrapX()` after integrating. Render via `cam.sx()`, never `x - cam.x`.

**Damage flow**: all enemy damage goes through `game.damageEnemy(e, dmg)` so every kill
pays out money regardless of weapon (bullets, shards, melee, fired ball).

**Headless testing**: `Game` itself is DOM-free (render aside) — construct with a stub
input `{down:(k)=>keys.has(k)}` (optionally `fireDown`/`specialDown`/`mouseX`/`mouseY`;
missing mouse fields = no aim, heading held), step `game.update(STEP)`, inspect state. Set
`game.breakTimer = 1e9` to suppress wave spawns when isolating a mechanic.

## Verification

- `npm run dev`, fly around: check thrust/rotation feel, water bounce symmetry, floating
- Headless smoke test (catches runtime errors):
  `google-chrome --headless=new --disable-gpu --no-sandbox --enable-logging=stderr --v=0 --virtual-time-budget=6000 --dump-dom http://localhost:5173/ 2>&1 >/dev/null | grep -i 'console\|error'`
- Physics regression: Node sim as described in the water-trampoline section above
- `npm run build` must keep relative (`./assets/…`) paths for GH Pages
