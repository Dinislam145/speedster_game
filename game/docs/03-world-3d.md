# 3D World

The perspective world axis. y is up, the space is right-handed, and a camera at yaw 0 looks along **+z** (increasing yaw turns right — `forward(yaw)` is the heading, exactly). Every 3D object is an ordinary roster object — the difference is the pose (yaw, pitch and roll, and scale on three axes) and the mesh it wears — so scenes, tweens, tags, queries, timers and the rest of the kernel work on meshes exactly as they do on sprites.

## When to use it

Any game seen in perspective. Most games compose it through `core-3d`, which brings it with `render-3d`, lighting, an
orbit camera, models and collisions. Pair it with `render-3d`, which draws the tables it gathers, and add
`world-screen` beside it for a HUD: the kernel composes both worlds against one backend, and the HUD draws over the 3D
as sprites. A 2D game never composes it, which is how a 2D build ships no 3D code at all.

Never drive the camera or pointer control by hand: `rig-orbit` (orbit, chase, top-down, isometric), `rig-fps` (first
person) and `rig-minecraft` move the camera; `aim-3d` turns a thing to face the pointer; `turntable` spins a dragged
object; `pointer` gives objects their own tap and hover handlers.

## Requires

`render-3d`, composed beside it: this pack registers its materials in render-3d's registry and render-3d draws what it
gathers (its package depends on render-3d for that). It imports `geometry-3d`'s builders directly, so that pack only
needs composing when you want its runtime API. A backend that draws meshes (`render-auto`, `render-webgl2`,
`render-webgpu`): the card says it needs `meshes3d`, and the bake refuses a backend that does not draw them.

## API

| call | what it does |
|---|---|
| `game.spawn({ mesh, … })` | the same mesh object through the game's own spawn, so other packs' spawn data (`collide`, a body) comes with it: `game.spawn({ id: 'crate', mesh: 'box', x, y: 0.5, z, size: [2, 1, 1], color: '#c8873a', emissive: 1 })`. `size` is one number or `[w, h, d]`; `material`, `billboard` and `pickable` (for `render3d.pick`) are this pack's; `yaw`, `scale`, `color`, `tags` and `data` are the kernel's |
| `game.world3d.spawn(spec)` | a mesh object: mesh, position, pose, size, colour, texture, billboard |
| `game.world3d.mesh(name, opts?)` | build or reuse a primitive, returning its id |
| `game.world3d.defineMesh(name, verts)` | register your own vertices. Defining a name again keeps its id and replaces the vertices, so the objects wearing it change too (a scene's `enter` can define its meshes every time it runs); the same vertices again change nothing. Any size is fine: author it in world units and spawn it at scale 1, and the cull bounds it by how far its vertices reach and `pick` by the box they fill |
| `game.world3d.meshVerts(id)` | read a registered mesh's vertices back (stride 8, live — do not write) |
| `game.world3d.material(def)` | a named surface, for `spawn({ material })`: render-3d's `Material3dDef` fields, `metallic`, `rough`, `emissive`, `unlit`, texture maps (`normalFrame`, `mrFrame`, `bump`, `tile`, `offset`), `srgbColor`, `isotropic`, `shadow` (false casts none), `soft` (fades a translucent instance against what is behind it) and a procedural `pattern` |
| `game.world3d.materialAt(id)` | a material's live definition: write `rough` or `metallic` and every object wearing it changes |
| `game.world3d.lookAt(h, x, y, z, flat?)` | turn an object to face a world point once (`flat` keeps it upright); to keep facing the pointer, `aim-3d` |
| `game.world3d.camera` | `x y z`, `yaw`, `pitch`, `roll`, `fov`, `distance`, `lookAt`, `snap`, `eye` |
| `game.world3d.toScreen(x, y, z)` | project a world point to logical pixels |
| `game.world3d.toGround(sx, sy)` | where a screen point meets the y = 0 plane |
| `game.world3d.groundAt(sx, sy, h)` | where a screen point meets the horizontal plane at height `h`, or null when it never does: aim at an object at its own height |
| `game.world3d.screenRay(sx, sy)` | the world ray under a screen point |
| `game.world3d.pick(sx, sy, filter?)` | the nearest object under a screen point, and where it was hit |
| `game.world3d.pickAll(sx, sy, filter?)` | everything the ray passes through, nearest first |
| `game.world3d.view` | this frame's matrices |
| `game.world3d.cull`, `culled` | CPU frustum culling on or off, live; how many objects it dropped last frame |
| `registerMesh3d(k, name, verts)`, `replaceMesh3d(k, id, verts)`, `updateMesh3d(k, id, verts)` | for packs: register, replace or update a mesh from inside a pack's `attach`. A name registered again keeps its id and takes the new vertices |

```ts
const tiles = game.world3d.material({ name: 'tiles', rough: 0.9, pattern: { kind: 'checker', colors: ['#8a3a2a'], scale: 0.5 } });
game.spawn({ id: 'floor', mesh: 'box', x: 0, y: -0.05, z: 0, size: [12, 0.1, 12], color: '#e8d8b8', material: tiles });
const p = game.input.pointer;
const at = p ? game.world3d.groundAt(p.x, p.y, 1) : null;     // the pointer at the turret's height
if (at) game.world3d.lookAt(turret, at.x, at.y, at.z, true);
```

The camera has one model for both common rigs: `distance` 0 means `x y z` is the eye (first person, free fly), and above 0 pulls the eye back that far along the look direction so `x y z` is the point it orbits (orbit, chase). Positive `pitch` looks **down**. `roll` banks the view about the line of sight (positive rolls right, so the horizon tips up at its right end), for a flyer banking into its turns; it is a sim value applied each frame, not interpolated between steps, and 0 is exactly the unrolled view.

## Options

`layers` names the draw layers back to front (default one layer, `world`); `near` and `far` are the clip planes; `cull` (default true) culls roster meshes outside the camera's view on the CPU before they are drawn, and `world3d.cull` turns it off or on live. Each object is bounded by a sphere about its origin: the distance to its mesh's farthest vertex (worked out once, and again whenever the vertices change), times its largest scale, and never less than a one-unit cube's. A mesh of any size is culled correctly at scale 1; one centred on its origin is culled most tightly. Tables are gathered sorted near to far, which is what both the depth buffer and the transparent pass want.

## Limits

Ordinary frustum culling is enabled by default. `render-3d` also provides static batches, culling and geometry picking through its ID readback; use those APIs for the corresponding renderer work. World ray picking tests each object's oriented box: the box its mesh's vertices fill (worked out once, and again whenever the vertices change), at its scale and turned by its pose. That is exact for a box and generous for a sphere or a model, and a mesh of any size picks where it is drawn, including one built off to one side of its origin. A flat mesh (`plane`, `quad`, `circle`) has no depth, so a ray along it hits nothing. A billboard turns to face the camera, which its pose does not describe, so it tests a one-unit box at its scale from every side. `pickAll` is linear in objects, so a very large scene should filter candidates. `toGround` returns world x/z in a `{ x, y }` pair, matching the 2D transform's shape.
