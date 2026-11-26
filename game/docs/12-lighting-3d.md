# 3D Point and Spot Lights

Point and spot lights as **roster objects**. A light lives in a scene, can follow an object, is killed by a tag sweep and is tweened like anything else, because it is an object carrying a `light3d` column rather than an entry in a list the game has to keep in step with the world.

## When to use it

Anywhere the sun is not enough: torches in a dungeon, a lamp over a table, headlights, a spell glowing in someone's hand, a muzzle flash. The sun, ambient and fog stay on `render3d.lighting`; this pack is for everything local.

## Requires

A 3D world and `render-3d`, which binds the buffer this pack fills. Without the renderer the lights still exist — they simply light nothing.

## API

| call | what it does |
|---|---|
| `game.lights.add(spec?)` | a light: position, `radius`, `color`, `intensity` |
| `game.lights.all` | every live light |
| `game.lights.active` | how many reached the renderer last frame |
| `game.lights.max` | the cap; default 64, ceiling 256 |

A light handle carries `light3d`: `radius`, `color` (css), `intensity`, `cone`, `innerCone`, `dir`, `pitch`, `on`, `flicker`, `flickerSpeed` — all live.

## Options

`radius` is how far it reaches, fading smoothly to nothing rather than stopping at an edge. The falloff is a **windowed inverse square** — `((1 - (d/R)^4)^2) / (d^2 + 1)` — so brightness drops the way light actually does and the window term still takes it cleanly to zero AT the radius, which is what stops a light popping when it crosses a cull boundary. It matters for AUTHORING: `intensity` is in inverse-square units, so a lamp meant to read at 20 units away needs roughly 400 times what one at 1 unit does. Reach for a big number and check it at the distance the light is doing its work, not next to the bulb. Give it a `cone` in degrees and it becomes a **spot**, aimed by `dir` (yaw) and `pitch`, with a soft rim. Optional `innerCone` is the full-brightness half-angle in degrees; it is clamped between zero and the outer `cone`. Omit it to retain the existing automatic soft rim. Live `light3d.cone` and `light3d.innerCone` fields use radians, with `innerCone: -1` selecting automatic falloff. Meshes and water share the same light record and falloff shader. `flicker` 0..1 with `flickerSpeed` beats two sines together, so a torch reads as fire rather than as a strobe. `follow` ties it to an object.

Each frame the live lights are sorted by distance from the camera and the nearest `max` are packed — a scene may hold far more lights than the renderer takes, and the ones dropped are the ones behind you.

`max` is how many lights are SENT. What they cost depends on how `render-3d` shades them, and from 24 lights on it **clusters**: the screen is cut into tiles and the view depth into slices, each light is binned into the cells its sphere touches, and a fragment loops its own cell alone — usually none, sometimes one. Below that threshold it shades a flat list, where every lit fragment loops over every light sent, because under a couple of dozen the grid's own clear-and-bin costs more than the loop it saves.

`render3d.clustered` forces it either way (`'auto'` is the default) and `render3d.clustering` says what auto decided. `lights3d` at two hundred lights measures a median frame of **47.6 ms flat against 20.8 ms clustered** — the same picture, in less than half the time.

## Limits

The default submission cap is 64, configurable up to 256; clustered rendering handles dense scenes. On WebGL2 `render-3d` shades only the nearest eight. Lights do not cast shadows — only the sun does. They illuminate meshes, the water surface, and lit CPU 3D particles. GPU particle lighting is a separate renderer capability. There is no light-probe or bounce: this is direct light plus hemisphere ambient.
