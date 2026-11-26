# 3D Particles

The 3D particle system: fire, smoke, sparks, explosions, weather, magic and dust in a 3D world. An emitter is a roster object like any other: it lives in a scene, can follow an object, is killed by a tag sweep, and sorts with everything else. When the gather reaches it, it emits its live particles as quads through the aggregate seam, so they draw with the renderer that is already there: no second pipeline, and one instanced draw for a whole emitter. Effects (several emitters together) are data, registered by the `vfx3d-*` packs or by the game.

## When to use it

Any 3D effect made of many small things that come and go: a campfire, a muzzle flash, a blast, rain around the camera, sparks crawling over a model. Build an emitter with `game.particles3d.emitter(config)`, or spawn a registered effect by name with `game.particles3d.effect('fire', { x, y, z })`. The ready effects come from `vfx3d-fire` (fire, torch, campfire, inferno), `vfx3d-smoke` (smoke, steam, puff, exhaust, mist), `vfx3d-explosion`, `vfx3d-magic`, `vfx3d-weather` (rain, snow, leaves, ash, motes) and `vfx3d-lightning`. A name can be registered once, so a game's own effect takes a name of its own.

When not:

- **A standing field of tens of thousands** (a snowstorm everywhere, a galaxy): `particles-gpu-3d`, simulated on the GPU.
- **A ribbon behind a moving object**: `trails-3d`. **A standing smoke column without particles**: `wisps-3d`.
- **2D**: `particles-2d`, which shares the op vocabulary.

<!-- shared: which-particles -->
### Which particles?

| For | Compose | What it is |
|---|---|---|
| 2D effects: fire, smoke, sparks, confetti, debris, trails | `particles-2d` (in `core-2d`), effects from the `vfx-*` packs | emitters as roster objects on the CPU, deterministic and headless, every value an op, with sub-emitters, collision and callbacks |
| 3D effects: blasts, flames, magic, a puff of dust | `particles-3d` (in `core-3d`), effects from the `vfx3d-*` packs | the same op vocabulary as camera-facing quads in the 3D world, lit by the scene |
| A 2D field past about twenty thousand particles: a snowstorm, a nova, a dense background | `particles-gpu` | a GPU-simulated pool of up to two million, drawn in its emitter's place; a subset of the options, no callbacks, not headless |
| A 3D field of tens of thousands to a million: rain, snow, ash, blossom, stars around the camera | `particles-gpu-3d` | a GPU-simulated field that wraps around its emitter, so a bounded pool reads as weather over an unlimited world |
| A ribbon behind something moving in 3D: a sword swipe, a comet tail, a light trail | `trails-3d`, looks from `vfx3d-trails` | shader-drawn ribbons with turbulence, erosion, a hot core and shed sparks |
<!-- /shared: which-particles -->

## Requires

A 3D world and `render-3d` (both declared), plus `particle-textures` for the `particle:*` frames the effects draw with, and `color` for the ramps.

## API

| call | what it does |
|---|---|
| `game.particles3d.emitter(config)` | build an emitter from an `Emitter3dConfig`; returns its handle |
| `game.particles3d.effect(name, opts?)` | spawn a registered effect; throws naming the effects that are composed |
| `game.particles3d.available` / `.defs` | the registered effect names / their definitions, for a menu |
| `game.particles3d.alive` | particles alive across every emitter |
| `game.particles3d.surface(verts)` | a `SurfaceSampler` over a triangle soup, for a mesh emit zone |
| `registerVfx3d(k, def)` | register an effect: a `vfx3d-*` pack's attach, or a game's own with `registerVfx3d(game.kernel, def)` |

An emitter handle's `emitter` has live `rate`, `emitting`, `timeScale` and `lit`, read-only `alive`, and `burst(n)`, `clear()`, `moveTo(x, y, z)` and `jump(x, y, z)` (a move that is not travel: see rate over distance). A pack that builds on particles-3d finds the same API under registry kind `particles3d`, name `particles-3d` (`k.registry.get('particles3d', 'particles-3d').api`), as `trails-3d` does for its sparks.

```ts
const sparks = game.particles3d.emitter({
    x: 0, y: 1, z: 0, rate: 0, max: 200,
    frame: 'particle:spark', blend: 'add', facing: 'velocity', stretch: 0.04, lit: false,
    lifespan: [0.3, 0.7], speed: [4, 9], angle: [0, 360], elevation: [20, 70],
    gravityY: -9.8, killBelowY: 0,
    size: 0.12, alpha: { start: 1, end: 0 }, color: ['#fff3c0', '#ff8a2a'],
});
sparks.emitter.moveTo(hit.x, hit.y, hit.z);
sparks.emitter.burst(40);   // a one-shot burst from a kept emitter
```

### Effects

```ts
const fire = game.particles3d.effect('campfire', { x: 4, y: 0, z: -2, scale: 1.5 });
const rain = game.particles3d.effect('rain', { follow: player });                    // rain falls around the player
const smoke = game.particles3d.effect('exhaust', { follow: car, offset: { y: 0.4 }, yaw: 180 }); // aimed backwards
fire.moveTo(0, 0, 0); fire.stop(); fire.start(); fire.kill();
```

`Effect3dOptions`: `x y z` (the effect's position), `follow` and `offset` (follow an object, with an offset), `scale` (every size, speed, distance, zone and force, so the motion keeps its shape), `yaw pitch roll` (degrees, added to each emitter's own, so zones and launch directions turn), `layer` and `timeScale`. Each emitter's own `x y z` (and `offset`) in the def is its place in the effect, scaled: kept when the effect is placed, moved or following, so rain born 14 units up stays 14 units above the player.

The handle is not the 2D one: `emitters` is an array in def order (2D has a record by name and an `anchor` object), and it has `moveTo(x, y, z)`, `stop()`, `start()`, `kill()` and `alive` over all of them; there is no `complete` flag, an effect is over when `alive` is false.

A `Vfx3dDef` is `{ name, description?, duration?, loop?, emitters: [{ name, ...Emitter3dConfig }] }`:

```ts
import { registerVfx3d } from '@phaser-ae/particles-3d';
registerVfx3d(game.kernel, { name: 'kettle', emitters: [{ name: 'puffs', rate: 20, lifespan: [1, 2], speed: [0.5, 1], elevation: [70, 90], size: { start: 0.3, end: 1.4 }, alpha: { values: [0, 0.4, 0] }, frame: 'particle:smoke' }] });
```

### The config (`Emitter3dConfig`)

Every value that can vary takes an **op**, the same shape `particles-2d` uses: a constant, a `[min, max]` range, a `{ random: [...] }` pick, a `{ start, end, ease }` curve over life, `{ values: [...] }` keyframes, or a callback (`{ onEmit(p, key, value), onUpdate?(p, key, t, value) }`, which sees the particle: at birth, as far as it is decided, where it is born, which way it goes, how long it lives and its roll). Angles in **degrees**, distances in world units (y up), times in seconds. Colours are any CSS colour.

| group | keys (default) |
|---|---|
| placement | `x y z` (0), `layer`, `follow`, `offset`, `space` (`'world'`; `'local'` particles move with the emitter), `yaw pitch roll` (0, degrees, composed yaw → pitch → roll as an object's pose is, so yaw 90 faces −x and positive pitch tips the nose down, turning the zone and launch) |
| emission | `rate` (0, bursts only), `rateOverDistance` (0, particles per world unit the emitter moves), `quantity` (1, particles per emission), `bursts` (`{ at, count, every?, probability? }`), `duration` (0, forever), `loop`, `delay`, `stopAfter`, `max` (500, the pool), `maxAlive`, `prewarm`, `emitting` (true), `timeScale` (1), `seed` |
| birth | `lifespan` (1), `emitZone` (`{ shape, fill?, radial? }`, default a point), `deathZone` (`{ shape, when? }`), `killBelowY` |
| launch | `speed` (0), and a direction: `angle` (a yaw in the emitter's frame, [0, 360], 0 is +z and 90 is −x, as `yaw` turns) and `elevation` (0, 90 straight up); or a cone, `direction` (`{ x, y, z }`, up when only `spread` is given) and `spread` (its full angle, degrees: 0 a jet, 360 every way); or `radial: false` with `velocityX velocityY velocityZ`; `inheritVelocity` (0) |
| motion | `gravityX gravityY gravityZ` (0; negative y falls), `drag` (0, per second), `maxVelocity` (0, none), `forces`, `sway` and `swayFreq` (0.25, cycles a second), `twinkle` and `twinkleFreq` (11 / 2π, about 1.75 cycles a second) |
| look | `size` (1), `scale` (1), `aspect` (1), `alpha` (1), `rotate` and `spin` (degrees), `facing` (`'camera'`, `'upright'`, `'velocity'`, `'flat'`: the ground plane, turned by the emitter's `yaw pitch roll`, so `pitch: 90` stands a ring on a wall), `stretch` (0), `color` (white), `hue` (± degrees), `frame` (`'particle:soft'`), `blend` (`'normal'` or `'add'`), `lit` (true), `soft` (0.5; 0 for `'flat'`) |
| children | `on: { birth?, death? }`: `{ effect, chance?, inheritVelocity?, scale? }` |
| code | `onEmit onDeath` |

**Zones.** Particles are born in a shape in emitter space: `point`, `sphere` (`r`, `inner`), `box` (`hx hy hz`), `disc` (`r`, `inner`, the XZ ground plane), `cylinder` (`r h`, `inner`), `cone` (`r h`, opening upward), `ring` (`r`, `t`), `line` (`a b`), `path` (a polyline sampled by length), `rect` (`hx hz`), or a **mesh's own surface**. `fill` is `'volume'` (default), `'surface'` or `'edge'`; `radial: true` launches along the shape's outward normal instead of by `angle`. On a `path`, `line` or `ring`, `fill: 'edge'` with `quantity` (so many to a lap) or `stepRate` (one every so many units) places particles in order along it, a tracer running round a track, and `yoyo: true` runs it back and forth; `shapeLength()` and `alongShape()` give a curve's length and a point along it. A death zone kills `'inside'` (default, a drain) or `'outside'` (a leash).

```ts
const skin = game.particles3d.surface(game.geometry3d.build('torus'));   // once, and keep it
game.particles3d.emitter({
    follow: statue, rate: 120,
    emitZone: { shape: { kind: 'mesh', surface: skin, scale: [statue.width, statue.height, statue.depth] }, fill: 'surface', radial: true },
});
```

The sampler is weighted by **area**: picking a triangle at random would put as many particles on a model's tiny chamfer faces as on its whole flank. The CDF is built once over the *unit* geometry, so it survives the object moving, turning and scaling; build it once and keep it, never per frame. `scale` sizes it to the object, and a normal takes the **inverse** scale, so a mesh flattened into a plate still throws its sparks straight up.

**Cone launch.** `direction` and `spread` throw each particle along a direction drawn uniformly over the cone's solid angle, so a spray fills its cone evenly (`elevation: [80, 90]` would crowd the axis, a spike rather than a cone). The cone is in the emitter's frame, so `yaw pitch roll` (and an effect's `yaw pitch roll`) aim it; with either key set, `angle` and `elevation` are not read. A zone with `radial: true` still launches along its normal instead.

```ts
// a hose: a 25° spray along the nozzle, which the emitter's yaw and pitch turn with it
game.particles3d.emitter({ follow: nozzle, rate: 200, speed: [8, 11], direction: { z: 1 }, spread: 25, gravityY: -9.8, lifespan: 1.2 });
// a wheel's dust: two puffs per unit the cart rolls, thrown up and back
game.particles3d.emitter({ follow: wheel, rateOverDistance: 2, speed: [0.5, 1.5], direction: { y: 1, z: -1 }, spread: 60, lifespan: 1.5, size: [0.3, 0.6] });
```

**Rate over distance.** `rateOverDistance` lays particles along the way a moving emitter went, evenly, whatever the frame rate: a wake, a dust trail, sparks off a blade. It counts while the emitter is emitting, beside any `rate`; the first step only records where it is, and a step that would lay more than a quarter of the pool is taken as a jump (a respawn or a teleport) and lays none. `emitter.jump(x, y, z)` says so outright, however short the move: it lays nothing and lends `inheritVelocity` nothing, so an emitter fed a path point by point jumps to the first point and moves to the rest. `trails-3d`'s sparks are such an emitter.

```ts
// a wake fed a path one point a step: three particles a unit along it, and nothing laid up to where it starts
const wake = game.particles3d.emitter({ rateOverDistance: 3, lifespan: 1, speed: [0, 0.5], spread: 360, size: 0.2 });
wake.emitter.jump(path[0]!.x, path[0]!.y, path[0]!.z);
let next = 1;
game.step('wake', () => { const p = path[next++]; if (p) wake.emitter.moveTo(p.x, p.y, p.z); });
```

**Forces** are data: `accel` (`x y z`), `drag` (`strength`), `wind` (`x y z`, `gust`, `speed`), `attract` (a point, `strength`, `radius`; negative pushes), `vortex` (a point, `strength`, `radius`, `axis`), `orbit` (a point, `strength`), `noise` (curl, what makes smoke lick rather than pour: `strength scale speed`) and `turbulence` (rougher jitter). `sway` is a lateral XZ wander on two frequencies (snow, dust motes, a smoke column that does not rise like a ruler) and `twinkle` cuts the opacity on a per-particle beat (fireflies, embers), `twinkleFreq` times a second: the default breathes, five or more crackles like a sparkler.

**Facing**: `camera`, `upright` (y-locked, for a flame), `velocity` (stretched along travel by `stretch` world units per unit of speed, the frame's width along the path as in 2D: a spark or a raindrop; `aspect` lengthens it too) or `flat` (the XZ ground plane, for an expanding shockwave ring). `blend: 'add'` is what makes fire and sparks glow.

**Lighting**: `lit: true` (the default) makes a puff take the scene's sun, ambient and point and spot lights. Local lights accumulate **isotropically**: smoke is a volume, so its colour cannot depend on which way its camera-facing quad points. Set `lit: false` for art with its lighting baked in. The property is live; changing `emitter.lit` retints particles already in flight.

**Soft particles**: `soft` fades a particle out as it closes on the geometry behind it, over that many times its own size, so a big smoke quad meets the floor or a wall softly instead of cutting it with a hard line. It is on by default (0.5) and off for `facing: 'flat'`, whose quads lie on the ground and would fade to nothing against it; set `soft: 0` for any other emitter whose particles must sit crisp on a surface.

**Colour**: a plain colour array is a ramp over life; a `{ random: [...] }` palette is sampled once at birth and kept for the particle's life. Rendering never advances the emitter's random stream.

## Options

| option | meaning | default |
|---|---|---|
| `maxEmitters` | a cap on emitters alive at once, checked only when a particle's `on.birth` or `on.death` would spawn a sub-effect: past it the sub-effect is skipped. Emitters and effects the game makes are never refused | `64` |

## Limits

- **CPU-simulated**: the right trade at a few thousand particles an emitter, drawn in one call, but not the hundreds of thousands `particles-gpu-3d` reaches.
- **Quads, not meshes or ribbons**: trails are `trails-3d`, beams `beams-3d`.
- **Sorting** is per particle, across emitters, by distance from the camera (render-3d), so smoke does not draw over the flame it rises from; a particle is sorted by its centre, so two big quads that cross can still order oddly. Particles cast no shadows (their materials say `shadow: false`).
- **The emitter's rotation turns its emit zone, its launch and a flat quad's plane only**: gravity, force positions and the death zone stay in world axes around the emitter.
- **A mesh emit zone samples the geometry it is given**, not the deformed or skinned result: an animated model sheds particles from its bind pose. A death zone over a mesh is not supported (a zero-thickness shell nothing is ever inside).
- **An unknown frame name draws the atlas's frame 0** rather than throwing (`particles-2d` throws): check the name when particles look like the wrong picture.
