# Make a 3D game

This page is the engine for a 3D game: meshes, models, light, a camera, text, backgrounds, input, motion, sound,
collisions and scenes. Import `game` from `./engine.js`; everything below is on it. The other pages in `docs/` are
reference.

## A whole game

A hero walks a field picking up coins while rocks roll across it. Each part is explained below.

```ts
import { game, type Mesh } from './engine.js';

const W = game.screen.width;
const SPEED = 6, FIELD = 14;

// Models and sounds: defined once, by name.
game.models.define('hero', {
    name: 'hero', version: 1,
    materials: [{ id: 'suit', color: '#3a7bd5' }, { id: 'skin', color: '#f2c9a0' }],
    parts: [
        { id: 'body', name: 'Body', shape: 'capsule', position: [0, 0.8, 0], size: [0.35, 1.2, 0.35], material: 'suit' },
        { id: 'head', name: 'Head', parent: 'body', shape: 'sphere', position: [0, 0.85, 0], size: [0.5, 0.5, 0.5], material: 'skin' },
    ],
    clips: [{ id: 'walk', name: 'Walk', duration: 0.4, tracks: [
        { part: 'body', channel: 'y', keys: [{ t: 0, v: 0 }, { t: 0.2, v: 0.1 }, { t: 0.4, v: 0 }] },
    ] }],
});
game.sound.defineAll({
    coin: { notes: [880, 1320], duration: 0.12, type: 'triangle' },
    hit: { type: 'noise', duration: 0.4, filter: { type: 'lowpass', freq: 1800, freqEnd: 200 }, volume: 0.8 },
});
game.render3d.lighting.preset('noon');

type Rock = { vx: number; vz: number };

game.scenes.register({
    name: 'play',
    enter() {
        game.background.gradient('#6fb8ff', '#e6f4ff');
        game.spawn({ id: 'ground', mesh: 'box', x: 0, y: -0.5, z: 0, size: [FIELD * 2, 1, FIELD * 2], color: '#5fa04e' });
        const hero = game.spawn({ id: 'hero', model: 'hero', x: 0, y: 0, z: 0, tags: ['hero'] });
        game.rig.follow(hero);
        game.rig.distance = 12;
        game.rig.pitch = 0.75;

        let points = 0;
        const score = game.text('0', W / 2, 40, { size: 40, stroke: { color: '#000000', width: 3 } });
        const sparks = game.particles3d.emitter({ emitting: false, lit: false, blend: 'add', size: 0.3,
            speed: [2, 5], elevation: [30, 90], lifespan: [0.3, 0.6], gravityY: -9, scale: { start: 1, end: 0 },
            color: ['#fff3b0', '#ffb000'] });

        const coin = (): void => {
            game.spawn({ id: 'coin', mesh: 'cylinder', x: game.rng.between(-FIELD, FIELD), y: 0.8, z: game.rng.between(-FIELD, FIELD),
                size: [0.9, 0.15, 0.9], pitch: Math.PI / 2, color: '#ffcc33', metallic: 0.5, rough: 0.35, emissive: 0.5, tags: ['coin'] });
        };
        for (let i = 0; i < 8; i++) coin();

        game.every(1.2, () => {
            const fromLeft = game.rng.chance(0.5);
            game.spawn({ id: 'rock', mesh: 'sphere', x: fromLeft ? -FIELD : FIELD, y: 0.6, z: game.rng.between(-FIELD, FIELD),
                size: 1.2, color: '#8a5a44', tags: ['rock'], collide: { shape: 'sphere' },
                data: { vx: (fromLeft ? 1 : -1) * game.rng.between(4, 8), vz: game.rng.between(-1, 1) } });
        });

        game.step('play', dt => {
            let ax = 0, az = 0;
            if (game.input.keyDown('ArrowLeft') || game.input.keyDown('KeyA')) ax -= 1;
            if (game.input.keyDown('ArrowRight') || game.input.keyDown('KeyD')) ax += 1;
            if (game.input.keyDown('ArrowUp') || game.input.keyDown('KeyW')) az += 1;
            if (game.input.keyDown('ArrowDown') || game.input.keyDown('KeyS')) az -= 1;
            let d = game.moveDir(ax, az);
            const p = game.input.pointer;
            if (p?.down) {
                const at = game.world3d.groundAt(p.x, p.y, 0);
                if (at) { const dx = at.x - hero.x, dz = at.z - hero.z, len = Math.hypot(dx, dz); if (len > 0.3) d = { x: dx / len, z: dz / len }; }
            }
            if (d.x || d.z) {
                hero.x = Math.max(-FIELD, Math.min(FIELD, hero.x + d.x * SPEED * dt));
                hero.z = Math.max(-FIELD, Math.min(FIELD, hero.z + d.z * SPEED * dt));
                hero.yaw = Math.atan2(-d.x, d.z);
                hero.play('walk');
            }
            for (const c of game.roster.tagged('coin')) c.yaw += 3 * dt;
            for (const r of game.roster.tagged('rock') as Iterable<Mesh<Rock>>) {
                r.x += r.data.vx * dt; r.z += r.data.vz * dt;
                r.roll -= r.data.vx * dt / 0.6;
                if (Math.abs(r.x) > FIELD + 2) r.destroy();
            }
        });

        game.collide.on('hero', 'coin', (_, c) => {
            sparks.emitter.moveTo(c.x, c.y, c.z);
            sparks.emitter.burst(24);
            c.destroy();
            game.sound.play('coin');
            points += 1;
            score.text = String(points);
            game.tween.from(score, { scale: 1.5 }, { duration: 0.2 });
            coin();
        });
        game.collide.on('hero', 'rock', () => {
            game.sound.play('hit');
            game.feel.shake(10, 0.4);
            game.save.write('best', Math.max(game.save.read('best', 0), points));
            game.scenes.go('over');
        });
    },
});

game.scenes.register({
    name: 'over',
    enter() {
        game.background.color('#20141c');
        game.text('Game over', W / 2, 300, { size: 72, font: 'sans-bold', color: '#ff6a6a' });
        game.text(`Best ${game.save.read('best', 0)}`, W / 2, 390, { size: 32 });
        game.text('Space to play again', W / 2, 460, { size: 24 });
        game.step('over', () => { if (game.input.keyPressed('Space') || game.input.pointer?.pressed) game.scenes.go('play'); });
    },
});

await game.start();
game.scenes.go('play');
```

## The world

Positions are in world units (think metres): `x` across, **`y` up**, `z` across the other way. A thing's `x, y, z`
is its **center**, except a model, whose origin is where its parts say (its feet, for a character). Angles are
radians: `yaw` turns about y (0 faces +z, and more turns it to its right), `pitch` tips it forward and `roll` leans it.
The screen is separate: `game.screen.width` and `game.screen.height` are the HUD's pixels, where text and buttons go.

## Meshes

A plain thing is a mesh: a primitive by name, one unit across, sized by `size`.

```ts
const crate = game.spawn({ id: 'crate', mesh: 'box', x: 0, y: 0.5, z: 4, size: 1, color: '#c8873a', tags: ['crate'] });
game.spawn({ id: 'wall', mesh: 'box', x: 5, y: 1.5, z: 0, size: [1, 3, 12], color: '#9a9a9a', tags: ['wall'] });
game.spawn({ id: 'lamp', mesh: 'sphere', x: 0, y: 3, z: 0, size: 0.3, color: '#fff2c0', emissive: 3 });
crate.x += 2 * dt; crate.yaw += dt; crate.color = '#ff0000'; crate.scale = 2; crate.visible = false;
crate.destroy();
```

- Meshes: `'box'`, `'sphere'`, `'cylinder'`, `'cone'`, `'capsule'`, `'torus'`, `'plane'` (flat, facing up), `'quad'`
  (flat, facing +z), `'wedge'`, `'roundedBox'`. A mesh that should stand on the ground at `y = 0` sits at half its
  height: a box of size 1 at `y: 0.5`.
- `size` is one number for all three sides, or `[width, height, depth]`. `scale` multiplies it; `sx`, `sy`, `sz` are
  each side's.
- The surface: `color`, `metallic` (0..1), `rough` (0 mirror, 1 chalk; default 0.75), `emissive` (0 ordinary, 1 lit
  from within, 3–4 a lamp; it lights nothing else), `unlit` (flat color, no shading), `alpha` below 1 for see-through.
- A picture on a mesh: `texture: 'bark'`, a picture by name, painted with `game.paint` or loaded.
- `tags`, `data` and `id` work as for any object: find things with `game.roster.tagged('coin')`, keep a thing's state
  on `data`. Name the type where you must: `Mesh<{ hp: number }>` from `./engine.js`.

## Models

A thing made of parts that move together (a character, a vehicle, a creature) is a model: a tree of primitives with
named clips. Define it once, by name, then spawn it.

```ts
game.models.define('hero', { name: 'hero', version: 1, materials: [...], parts: [...], clips: [...] });
const hero = game.spawn({ id: 'hero', model: 'hero', x: 0, y: 0, z: 0, scale: 1.5, tags: ['hero'] });
hero.play('walk');                       // a clip; calling it every step keeps it playing
game.models.of(hero)!.parts['head'];     // a part, to attach a hat to
```

- A part: `id`, `name`, `parent` (another part's id), `shape` (a mesh name), `position` from its parent, `size`,
  `rotation` in degrees, `offset` of the mesh from the part's pivot (so a leg swings from the hip), `material`,
  `color`, `mirror: true` for a matching part across x.
- A clip: `tracks` of `{ part, channel, keys: [{ t, v }] }`; channels `x y z` move (units), `yaw pitch roll` turn
  (degrees) and `sx sy sz` scale, each from the part's rest pose.
- The spawned object is the model: move it, turn it, tag it, `destroy()` it, and it collides as the box its parts
  fill. A model from the design's Models page is a spec like this one.

A model an artist made as a file (`.glb` or `.obj`) comes from another pack: add `model-files-3d` to the manifest, then

```ts
await game.modelFiles.load('duck', 'assets/duck.glb');                  // once; meshes register, textures join the atlas
const duck = game.modelFiles.spawn('duck', { x: 2, size: 1.5, yaw: 0.5 });   // as often as you like
duck.play('Walk', { loop: true, fade: 0.2 });                            // when the file has clips
```

## Light

```ts
game.render3d.lighting.preset('noon');            // or 'golden', 'overcast', 'night', 'dungeon', 'studio', 'boardgame'
game.render3d.lighting.set({ sunIntensity: 1.2, ambient: 0.3, fogEnd: 80 });
const torch = game.lights.add({ x: 2, y: 2, z: 0, radius: 8, color: '#ffb060', intensity: 40, flicker: 0.4 });
```

The sun, the ambient light, fog and shadows are one setup: start from a preset, then `set` what differs. Lamps are
objects: put them where they glow, move them, `destroy()` them. A lamp's `intensity` falls off with distance, so
one meant to light things 5 units away needs about 25 times what one at 1 unit does. A glowing thing that lights
nothing else is cheaper as a mesh with `emissive`.

## The camera

```ts
game.rig.follow(hero);                    // keep it in view as it moves
game.rig.distance = 12;                   // how far back the camera sits
game.rig.pitch = 0.75;                    // how far it looks down, radians
game.rig.yaw = Math.PI;                   // which way round: 0 looks along +z
game.rig.focus(0, 0, 0);                  // or look at a fixed point
game.rig.drag = true;                     // let the player turn it by dragging (off by default)
```

The camera always looks at a point (`focus`, or what it follows) from `distance` away, at `yaw` and `pitch`. The
wheel is off in a new game; `game.rig.zoomSpeed = 0.01` turns it on, and `game.rig.minDistance` and `maxDistance`
bound it.

One orbit camera frames most genres by its angles alone:

| the game | `pitch` | `yaw` | `distance` |
|---|---|---|---|
| a chase camera behind a hero | 0.3 to 0.5 | the hero's facing + π | 8 to 14 |
| top-down (a twin-stick, a board) | 1.3 to 1.45 | 0 | 15 to 30 |
| isometric (a tactics map, a city) | 0.62 (about 35°) | π / 4 | 20 to 40, with a narrow `game.world3d.camera.fov` |
| side-on (a 2.5D platformer) | 0.05 to 0.15 | π / 2 or -π / 2 | 12 to 20 |

For a first-person game add `rig-fps` (mouse look, a body that walks) or `rig-minecraft` (block-world flying and
walking) in its place. For a camera of your own (a cutscene, a rail), set `game.rig.enabled = false` and write
`game.world3d.camera` (`x y z`, `lookAt(x, y, z)`, `fov`).

## Text

```ts
const score = game.text('Score 0', W / 2, 40, { size: 32, color: '#ffffff', stroke: { color: '#000000', width: 2 } });
score.text = `Score ${points}`;
game.text('Lives 3', 16, 16, { align: 'left', baseline: 'top' });
const at = game.world3d.toScreen(hero.x, hero.y + 2.4, hero.z);   // a label over a thing: move it there each step
```

Text is on the HUD, in screen pixels, over the 3D world. `x, y` is its **center** unless `align` or `baseline` say
otherwise; `size` in pixels, `font` `'sans'`, `'serif'` or `'mono'` (each with `-bold`), colors hex, `stroke` and
`shadow` for outlines. Change `text`, `x`, `y`, `color`, `alpha`, `scale` or `visible` at any time, and `destroy()` it.

## Backgrounds

```ts
game.background.gradient('#6fb8ff', '#e6f4ff');   // a sky: top color, bottom color
game.background.color('#10162a');                 // or one color
game.background.stars({ density: 0.8 });          // a night: over a dark color
```

The background is behind every mesh. Set it in each scene's `enter()`. Fog (`game.render3d.lighting.set({ fogEnd })`)
fades far meshes toward it.

## Input

```ts
const d = game.moveDir(ax, az);                   // arrows as a direction on the ground
hero.x += d.x * SPEED * dt; hero.z += d.z * SPEED * dt;
hero.yaw = Math.atan2(-d.x, d.z);                 // face the way it moves
const p = game.input.pointer;
const ground = p ? game.world3d.groundAt(p.x, p.y, 0) : null;   // the point on the ground under the pointer
const hit = p?.pressed ? game.world3d.pick(p.x, p.y) : null;    // the thing under it: hit.handle
```

- **Arrows go through `game.moveDir(right, forward)`.** It turns "right" into the screen's right and "forward" into
  away from the camera, whichever way the camera faces. Adding to `x` directly does not do that: seen from the
  camera's default side, +x is the screen's **left**.
- Keys: `game.input.keyDown('ArrowLeft')` while held, `keyPressed('Space')` for one step; names are
  `KeyboardEvent.code`. `game.input.bind('jump', ['Space'])` then `game.input.action('jump').pressed`.
- A gamepad: `game.input.gamepads[0]`, `pad.axis('lx')`, `pad.button('a')`.
- The pointer is in screen pixels: `groundAt(x, y, height)` is where it meets a level at that height, `pick(x, y)`
  the nearest thing under it.
- Pointer control has packs of its own; use them rather than writing it from `groundAt`: `aim-3d` turns a thing to
  face the pointer on the ground (a twin-stick turret, a hero that looks where you point) and `turntable` spins an
  object you drag (a model viewer, an inventory item).
- **On a phone**, add `controls-touch`: a thumb stick and buttons that press key codes (`Touch:left`, `Touch:jump`).
  Bind them beside the keys (`game.input.bind('jump', ['Space', 'Touch:jump'])`) and read the stick's codes as
  arrows: `game.moveDir(right, forward)` takes any -1..1 pair, so feed it from the codes held.
  `docs/controls-touch.md` has the manifest entry; the controls show only on a touch device.

<!-- shared: every-step -->
## Every step

```ts
game.step('enemies', dt => { /* dt is the fixed step in seconds */ });
game.after(2, () => spawnBoss());              // once, in 2 seconds
const wave = game.every(0.5, spawnRock);       // repeatedly; wave.cancel() stops it
game.rng.between(0, 10); game.rng.int(1, 6); game.rng.pick(list); game.rng.chance(0.2);
```

Time is the game's: steps, timers and tweens all pause with it. Use `game.rng`, `game.after` and `game.every` for
chance and time, never `Math.random`, `setTimeout` or the clock. A step, a timer and a frame belong to the scene that
made them, and stop with it.
<!-- /shared: every-step -->

## Motion and juice

```ts
game.tween.to(door, { y: 3 }, { duration: 0.6, ease: 'easeOutQuad' });
game.tween.to(coin, { yaw: coin.yaw + Math.PI * 2 }, { duration: 1, loop: true });
game.feel.shake(8, 0.3); game.feel.flash('#ffffff', 0.2); game.feel.hitstop(0.06);
const sparks = game.particles3d.emitter({ x, y, z, emitting: false, blend: 'add', lit: false, size: 0.3,
    speed: [2, 5], elevation: [30, 90], lifespan: [0.3, 0.6], gravityY: -9, color: ['#fff3b0', '#ffb000'] });
sparks.emitter.burst(24);                          // a burst; `rate: 30` instead makes it flow
game.attach.to(sword, game.models.of(hero)!.parts['hand']!, { y: -0.3 });   // carry one thing on another
```

Particles: `speed`, `lifespan`, `size` and the rest take a number, a range `[min, max]` or `{ start, end }` over a
particle's life; `elevation` is the launch angle up from the ground in degrees, `angle` round it. An emitter can
`follow: hero`.

## Collisions

```ts
game.collide.on('hero', 'coin', (h, coin) => { coin.destroy(); });   // every step they overlap
game.collide.solid('hero', 'wall');                                  // keep the hero out of walls
const c = game.collide.contact(hero, floor);                         // c?.side === 'bottom': standing on it
game.spawn({ id: 'ball', mesh: 'sphere', x, y, z, tags: ['ball'], collide: { shape: 'sphere' } });
```

Every thing is a box the size of its mesh (a model, the box its parts fill); `collide: { shape: 'sphere' }` makes it
a ball, `collide: { size: [w, h, d], offset: [x, y, z] }` a box of its own. Rules belong to the scene that made them.
`game.collide.raycast(x, y, z, dx, dy, dz, maxDist, tag)` finds the first thing along a line.

## Sound

```ts
game.sound.defineAll({
    jump: { type: 'square', freq: 300, freqEnd: 600, duration: 0.1 },
    tune: [{ type: 'square', tempo: 140, notes: 'C4 E4 G4 C5 - G4 E4 C4', volume: 0.4 }],
});
game.sound.play('jump');
game.sound.music('theme', { loop: true, fadeIn: 1 });   // a music file from assets.json
game.commands.mute(); game.commands.unmute();           // what the sound button does
```

<!-- shared: scenes -->
## Scenes

```ts
game.scenes.register({ name: 'play', enter() { /* build it */ }, exit() { /* rarely needed */ } });
game.scenes.go('play');          // replaces the scene
game.scenes.push('pause');       // the pause menu over it, 'play' held beneath; game.scenes.pop() resumes
```

Leaving a scene removes everything it made: meshes, models, lamps, text, backgrounds, steps, timers, tweens and collision rules.
So `go('play')` again is a clean restart. The camera and the light stay as they were set.

For a scene change that covers the screen (a fade, an iris, a wipe), add `transition` to the manifest and call
`game.transition.go('play', { kind: 'fade' })`; for a whole animated title screen as one data file, `title-screen`.
<!-- /shared: scenes -->

<!-- shared: tail -->
## Saving

```ts
const best = game.save.read('best', 0);
game.save.write('best', Math.max(best, points));
```

## Buttons and menus

```ts
game.ui.theme = 'candy';                         // main.ts, once: the skin the manifest composes (ui-skin-candy)
game.ui.label({ anchor: 'center', y: -160, w: 640, h: 140, text: 'Game over', style: 'heading' });
game.ui.button({ anchor: 'center', h: 96, text: 'Play', style: 'good', icon: 'play', onClick: () => game.scenes.go('play') });
game.ui.pauseButton(); game.ui.muteButton();     // top right, round icon buttons: the pause menu, and the sound
game.ui.button({ parent: menu, h: 64, text: 'Restart', icon: 'restart', onClick: () => game.scenes.go('play') });
```

`game.ui` has windows, panels, buttons, toggles, sliders and progress bars, on the HUD; its page in `docs/` has the
rest. A button shows one of the engine's icons with `icon`: `pause play sound-on sound-off music-on music-off restart
home settings close fullscreen fullscreen-exit back`, tinted with the button's text colour. A symbol on a button is
always an icon, never letters standing in for it ("II", "SND"). The skeleton's `Play.ts` already has the pause and
sound buttons, and `Pause.ts` the pause menu they open; when the design has its own art for them, `icon` takes the
picture's name. Widgets answer the keyboard and a gamepad as well as the pointer: Tab and the arrows move the focus,
Enter or Space presses.

**The menus wear a skin.** A new game's manifest composes `ui-skins` and one skin pack, `ui-skin-candy`, and
`main.ts` chooses it (`game.ui.theme = 'candy'`): every button, window and heading is a glossy game button on a lip
that presses down, with a chunky stroked caption. Style widgets with the skin's styles, never with style data of
your own: `style: 'good'` for the way into play, `'warn'`, `'bad'`, `'flat'` or a colour name (`'orange'`, `'pink'`,
`'blue'`…) for the others, `'icon'` for a round icon button, `'heading'` for a title, which grows with its height
and shrinks to its width. Never give a button a width: without one it fits its icon and caption, and in a column
that stretches it (`align: 'stretch'`) it shrinks them to fit. Recolour the skin with its pack's options in the
manifest, `{ "id": "ui-skin-candy", "options": { "color": "pink", "radius": 18 } }` (`color`, `surface`, `radius`,
`depth`, `roles`, `colors`), or live with `game.skins.use({ material: 'candy', color: 'pink' })`. For another look,
put another skin pack in its place: `ui-skin-jelly`, `-glossy`, `-bubble`, `-block`, `-cartoon`, `-wood`,
`-timber`, `-metal`, `-bezel` or `-candystripe`, and choose its name. Compose one: a game carries every skin it
composes. Their pages in `docs/` have the rest. A speech box that matches the skin is `dialogue`
(`game.dialogue.open({ lines })`), and a framed picture that stretches without blurring its corners is `nine-slice`.

## Bars and meters

A game's health, timers, XP, ammo, loading and cooldowns are the `bars` pack: add `{ "id": "bars" }` to the
manifest. One call makes a styled bar; set its value and it animates there.

```ts
const hp = game.bars.create({ anchor: 'top-left', x: 16, y: 16, width: 240, height: 22, max: 100, label: '{value}/{max}' });
hp.value -= 10;                                   // eases there; ghost: true leaves a chunk that drains, as in a fighting game
const time = game.bars.create({ shape: 'ring', anchor: 'top', y: 12, width: 72, max: 60, label: '{time}',   // top right is the pause button's
    zones: [{ below: 0.2, fill: '#ff3b30', pulse: 2 }] });
time.to(0, 60, () => endRound());                 // a countdown that turns red and pulses at the end
```

Ten styles (`style: 'glossy' | 'neon' | 'blocks' | 'fighter' …`), any colour or gradient, segments, glow, stripes,
labels inside, outside or riding the fill; they live on the HUD, over the 3D view. Use `bars` for a game's meters, never `game.ui.progress` (a
menu widget) or rectangles; its page in `docs/` has the rest.

## Debug controls

```ts
game.cheats.add({ name: 'level', does: 'Start at level n', args: 'n', run: n => { startAt(Number(n)); return `level ${n}`; } });
game.inspect.state(() => run);   // the run's state, for whoever checks the game
```

Add them once in `debug.ts`: a jump to any level or screen, a power-up, win or lose now. A jump starts the game
as a player would find it there.
<!-- /shared: tail -->

## The rules

- No `document`, `window`, `Math.random`, `setTimeout` or `Date.now`: the engine gives each of them.
- y is up. Move with `game.moveDir`, never by adding to `x` for "right".
- One model per name; define it before a thing spawns it.
- Keep a thing's state on it (`data`), and find things by tag.
- Add a pack to the manifest for what this page does not cover: HUD bars and meters (`bars`), physics (`physics-3d`), terrain (`terrain-3d`),
  water (`water-3d`), a time-of-day sky (`sky-3d`), post effects, a first-person camera (`rig-fps`), a genre's rules.
  Its page appears in `docs/` when the game is baked.
