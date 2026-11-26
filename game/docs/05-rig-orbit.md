# Orbit Camera Rig

The camera rig for a 3D world seen from outside. Dragging turns the camera around the point it is looking at, the wheel pulls it in and out between limits, and `follow` eases that point onto a roster object every step — which is all a chase camera is. It writes only the camera's yaw, pitch, distance and focus, so nothing else has to coordinate with it.

## When to use it

Any 3D game where the camera looks at something rather than out of something: an inspector, a builder, a third-person adventure, a strategy view. Compose it and the drag, zoom and easing are handled; game code calls `follow(player)` once and never touches the camera again. For a first-person eye, set the world camera's `distance` to 0 and drive `yaw`/`pitch` yourself instead.

## Requires

A 3D world (`world:3d`), declared in `pack.json`; the bakery composes rigs after worlds.

## API

| call | what it does |
|---|---|
| `game.rig.follow(handle \| null)` | ease the focus onto an object, or stop |
| `game.rig.focus(x, y, z)` | look at a fixed point |
| `game.rig.distance` | how far back the eye sits; the wheel drives it too |
| `game.rig.yaw` / `.pitch` | the orbit angles, radians; positive pitch looks down |
| `game.rig.height` | how far above the followed object the focus aims |
| `game.rig.drag` | turn drag-to-orbit off while a UI is being used |
| `game.rig.target` | what it is following |

## Options

`distance`, `minDistance`, `maxDistance` bound the zoom; `yaw` and `pitch` start it; `minPitch` and `maxPitch` stop a drag swinging under the floor or past straight down; All four limits are LIVE, so one rig can BE two cameras: swap `minDistance`/`maxDistance` to zero and widen the pitch range and a chase cam becomes a first-person eye, with no second rig to keep in step. `sensitivity` is radians per pixel and `invertY` flips the vertical drag; `zoomSpeed` scales the wheel (0 turns it off; it is live, so `game.rig.zoomSpeed = 0.01` turns on a wheel composed off); `smoothing` is how fast the focus catches a followed object (1 instant, 0.1 lazy); `drag` false hands yaw and pitch to your own code. `pan` (default true) lets right-drag or shift-drag move the focus; `zoomToCursor` (default true) dollies the wheel toward the point under the cursor; `autoRotate` is an idle spin in radians a second (default 0, off); `fly` (default false) turns on WASD, arrows and Q/E flying; `flySpeed` is world units a second (default scaled to `distance`). The gestures are below.

## The four gestures, and the mode flip

| gesture | does |
|---|---|
| left-drag | orbits the focus — or, once you have flown, **looks around** from where the camera is |
| right-drag, or shift-drag | **pans** the focus in the screen plane, one pixel of drag to one pixel of world |
| wheel | dollies **toward the point under the cursor**, not the middle of the screen |
| WASD / arrows, Q/E | **flies**, with shift for three times the speed (`fly: true`) |

Zooming to the centre instead of the cursor is the difference between a camera that
inspects a scene and one that fights you: every zoom then has to be followed by a pan
to put back the thing you were looking at.

**The first fly key sticks the rig into explore mode**, and that is deliberate. From
then on a drag looks around from where the camera is rather than swinging it about
the focus — keys move you through the world, the mouse turns your head. It is the
only model that still makes sense once you have left the thing you were orbiting.
`rig.exploring` reports it, and assigning `false` hands the rig back to orbiting.

`autoRotate` is an idle spin for a showcase shot. It pauses under the hand, pauses
while flying, and stops for good once you are exploring — a drift about a focus the
viewer has stopped thinking in terms of just reads as the camera being broken.

## Keeping the camera out of the ground

```ts
rig.floor = (x, z) => game.terrain.heightAt(x, z);
rig.floorMargin = 1.5;
```

The **eye** never sinks below the floor at its own x/z. The focus and the distance are
untouched, so a low orbit glides along the terrain instead of tunnelling into it —
the rig raises its pitch until the eye clears.

## Limits

One rig per game, and it owns the camera while composed — set `drag` false, or drive `world3d.camera` directly, if something else needs to take over. No collision: the camera passes through geometry rather than pulling in to avoid it. No pointer lock, so a drag needs a held button; first-person mouse look belongs to a separate rig.
