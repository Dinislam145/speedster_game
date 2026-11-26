# 3D Mesh Renderer

The renderer for 3D worlds, on WebGPU and WebGL2: instanced meshes in a depth-tested scene pass drawn before the
sprites and the HUD, so a 3D game with a 2D HUD is one backend drawing two worlds. Physically based shading,
lighting presets, cascaded sun shadows, fog, an environment for reflections, materials with texture maps and
procedural patterns, flat-mesh surfaces (cards, banners, sails) that bend and wear effects, glow halos, static
batches for crowds of thousands, and picking by the triangles actually drawn.

## When to use it

Any game with a 3D world; `core-3d` composes it. It draws what `world-3d` gathers and knows nothing about how
geometry is made: meshes reach it through the `mesh3d` registry, so a pack that builds its own geometry is drawn for
free. Beside it: `lighting-3d` for lamps and torches (the sun, ambient and fog are here), `sky-3d` for a time-of-day
sky that also lights reflections, `mesh-shaders` for one object with a shader of its own (lava, a force field),
`post-bloom` for glow across the whole screen, and `terrain-3d`, `water-3d` and `forest-3d` for landscapes.

## Requires

A 3D world (`world:3d`, from `world-3d`) composed before it, and a backend that draws meshes: `render-auto` (which
picks WebGPU or WebGL2), `render-webgl2` or `render-webgpu`. On WebGPU it shares the backend's device and command
encoder, opening its own depth-tested pass between the backend's `begin` and `sprites` passes.

## API

| call | what it does |
|---|---|
| `game.render3d.lighting` | the sun, sky and ground colours, ambient, fog, curvature, shadows, tone map and exposure, all live |
| `lighting.set(config)` / `lighting.preset(name, over?)` | write many at once / a whole named setup with overrides |
| `game.world3d.material(def)` | a named material: pass its id as `spawn({ material })` (see Materials) |
| `game.render3d.surface(handle, opts \| null)` | give one flat mesh a decal, a back face, a bend, an msdf, glow or one of eight effects |
| `game.render3d.staticBatch(spec)` | thousands of instances that never move, culled and drawn on the GPU |
| `await game.render3d.pick(x, y, opts?)` | the pickable object under a screen point, by the triangles drawn |
| `near`, `far` | clip planes |
| `clustered` / `clustering` | how lamps are shaded: `'auto'`, `true` or `false`, and what auto chose |
| `cull`, `staticInstances`, `staticDrawn` | GPU culling of static batches; how many they hold; how many survived last frame |
| `drawCalls`, `instances`, `surfaces` | what last frame cost; how many extended surfaces are in use |
| `LIGHTING_PRESETS` | what each preset sets |

```ts
game.render3d.lighting.preset('golden', { fogEnd: 120 });
const lacquer = game.world3d.material({ name: 'lacquer', rough: 0.25, metallic: 0 });
const box = game.spawn({ id: 'gift', mesh: 'roundedBox', x: 0, y: 0.5, z: 0, color: '#c0392b', material: lacquer });
game.render3d.surface(card, { decal: true, bend: { kind: 'curl', amount: 0.18 }, effect: { kind: 'holo' } });
const hit = await game.render3d.pick(pointer.x, pointer.y);
```

## Light

```ts
game.render3d.lighting.set({
    sun: { x: -0.42, y: -1, z: -0.46 }, sunIntensity: 1.05, ambient: 0.32,
    skyColor: '#9db4dd', groundColor: '#4a3a2c', exposure: 0.95,
    shadows: true, shadowRadius: 14, shadowSize: 2048,
});
game.render3d.lighting.preset('boardgame');      // most of that is one word
game.render3d.lighting.sunIntensity = 0.6;       // and any field is live
```

`set` writes the fields it is given and leaves the rest; the `sun` direction is copied, so a vector the game keeps
and edits does not steer the renderer. Every field is read each frame, so animating the sun is assignment.

### Presets

`preset(name, over?)` applies a whole coherent setup, then any overrides. The dials are not independent: the
failures come from mixing settings that belong to different scenes.

| name | for |
|---|---|
| `boardgame` | a small lit table: a board, tiles, cards, pieces. Restrained, so pale palettes keep their colour |
| `studio` | a model viewer or product shot: neutral, even, no fog, the shadow budget on one small subject |
| `noon` | outdoors under a high sun: hard shadows, cool sky, distance haze |
| `golden` | a low warm sun: long shadows, strong rim light, warm haze |
| `overcast` | flat daylight: high ambient, weak sun, shadows barely there |
| `night` | moonlight: dim and cool, so lamps and torches from `lighting-3d` carry the scene |
| `dungeon` | no daylight: ambient near zero and sun shadows off, because the lamps are the light |

Reach for one when a pale palette washes out (turning the light down brings the colour back: `boardgame`,
`overcast`) or when the subject is small (the default `shadowRadius` of 120 units across three cascades is sized for
terrain; `boardgame` and `studio` put one cascade over a table at 2048). A game that only wants a preset needs no
code: `{ "id": "render-3d", "options": { "lighting": "boardgame" } }`, a preset name or a patch, applied before the
first frame.

### Sun, sky, fog and curvature

The sun is a directional light over hemisphere ambient: `skyColor` from above, `groundColor` bounced from below,
`ambient` their strength. Fog eases in between `fogStart` and `fogEnd` on an S-curve, towards `fogColor`; `fogEnd: 0`
turns it off. `curvature` bends the drawn world into a globe of that radius: each vertex is drawn lower by d² / 2R with
its distance d from the eye, so the horizon falls away on every side (Magic Carpet's look, R = the world's
circumference / 2π); lighting, fog and queries keep the true positions, 0 is flat, and companion passes with their own
vertex shaders (water, grass) are not bent.

### Shadows

The sun casts shadows into cascaded depth maps on WebGPU (`shadowCascades`, default 3) and one map on WebGL2,
sampled with a soft 3×3 filter. They cover `shadowRadius` world units round what the camera looks at, at
`shadowSize` texels, with `shadowStrength` darkness. `shadowBias` is in texels of the map (default 2), so it holds at
any scale. Transparent meshes do not cast. `shadows: false` drops the pass and its texture.

A caster thinner than a texel casts nothing: the texel's world size is about `shadowRadius / shadowSize` (with the
defaults, roughly 0.12 units), so a mast, a railing or a wire thinner than that has no shadow, and one to two texels
wide flickers. Make thin uprights at least a texel wide, or raise `shadowSize` or lower `shadowRadius`. A caster that
stops short of the ground casts a shadow that starts away from it: plant objects on the floor.

### Tone map and exposure

`toneMap` (default on) is a shoulder: below 0.8 the colour is untouched, so a scene lands where it was authored,
and above it the excess rolls off towards 1 instead of clipping, scaled by the channel that would clip first so hue and
saturation survive. `exposure` (default 1) scales the scene before it.

### Lamps and clustering

Lamps come from `lighting-3d`. Up to a couple of dozen are shaded flat, each lit pixel looping over all of them; past
that (`clustered: 'auto'`) a compute pass bins them into a froxel grid, 24 × 12 screen tiles by 32 depth slices
(9,216 cells), and a pixel loops over its own cell's few (two hundred lamps: 47.6 ms flat against 20.8 ms clustered in
`lights3d`). A cell holds 64 lamps; past that a lamp is dropped for that cell alone. WebGL2 shades up to eight lamps,
flat.

### The environment

Reflections come from an equirect environment map, roughness choosing its blur and Fresnel its weight.
`sky-3d` publishes one baked from its time of day; with none, the renderer bakes a small one from the scene's own
ambient and sun colours, because without an environment a metal is black. `lighting.environment` scales it (default 1).

## Materials

Surfaces are shaded physically (GGX distribution, Smith-Schlick geometry, Schlick Fresnel, energy-conserving diffuse),
so roughness reads as a property of the material and a metal needs its environment to be legible.

An instance carries a material **index**. The simple way: `game.spawn({ mesh: 'box', metallic: 1, rough: 0.3,
emissive: 0, unlit: false })` interns a material with those values for you. For a material with texture maps or a
pattern, or one to name and share, define it with `game.world3d.material({ name, … })` and pass the id it returns as
`spawn({ material })`; `game.world3d.materialAt(id)` is its live definition, so writing `rough` there retunes every
object wearing it.

- `metallic` 0 dielectric to 1 metal (a metal's colour is its reflectance); `rough` 0 mirror to 1 chalk (default
  0.75); `emissive` unlit colour added on top (still fogged); `unlit` the tint times the texture with no lighting.
- `normalFrame` and `bump` a normal map from the atlas and its strength (no tangent channel needed); `mrFrame` a
  metallic-roughness map in glTF's packing (green rough, blue metal) multiplying the factors. A mesh's frames may be on
  any atlas page (the atlas opens pages as it fills), but one draw binds one page on WebGPU, so a material's maps must
  share the page of the colour frame it is worn with: add pictures drawn together with `assets.addStrips`, as
  model-files-3d does for a model's maps. render-3d warns once when they do not.
- `tile: { x, y }` repeats the texture over the mesh's own uv, and `offset` scrolls it (a conveyor, a river); both
  reach the normal and metallic-roughness maps too, and the repeat stays inside the frame's slice of the atlas.
- `srgbColor` de-gammas an sRGB-authored colour map (a glTF base colour) in the linear atlas; `isotropic` shades local
  lights without a surface normal, for smoke, fog and other volumes.
- `shadow: false` casts no sun shadow even when drawn opaque (particles-3d's materials, a marker, a glow card); a
  translucent instance never casts either way.
- `soft` fades a translucent instance out as it closes on the geometry behind it, over that many times its own size
  (the smaller of its width and height): soft particles, what stops a big smoke quad cutting the floor with a hard
  line. 0, the default, is off. A frame that draws a soft material moves its translucent draws into a second pass
  that holds the depth read-only (WebGL2 copies the depth instead); a frame without one is unchanged.
- `pattern`: marks painted over the colour, below.

A mesh wears a picture with `spawn({ texture: 'key' })`: the frame's rect is mapped by the mesh's own uv, and the
instance colour multiplies over it, so one crate texture tinted three ways is one draw. A billboard
(`billboard: true`, or `'y'` to turn about the vertical only) faces the camera in the vertex stage, so a forest of
them is still one draw, and casts the shape it shows; a negative `sx` or `sy` mirrors its texture. Textures with
holes are cut out: the opaque pass discards texels below half alpha, and so does the shadow pass, so a cut-out tree
casts a tree.

### Patterns

```ts
const rind = game.world3d.material({ name: 'rind', rough: 0.6, pattern: { kind: 'stripes', colors: ['#2f6a2a'], count: 12 } });
game.spawn({ id: 'melon', mesh: 'sphere', x: 0, y: 1, z: 0, size: 2, color: '#6fbf4a', material: rind });
```

A pattern is drawn over the object's own colour before it is lit, so a patterned mesh shades, shadows and fogs like a
plain one and stays in the batch. The tint is the ground and the pattern's `colors` (one to three, any CSS colour) are
the marks.

| kind | what, about the pattern's `axis` | knobs |
|---|---|---|
| `stripes` | lines along the axis, `count` round it | `count`, `amount` = width |
| `bands` | bands across the axis, stacked along it; `angle` tilts them into diagonals | `scale` = repeat, `amount` |
| `swirl` | stripes winding round the axis, one turn per `scale`; a spiral on a face across it | `count`, `scale` |
| `rings` | circles round the axis | `scale`, `amount` |
| `segments` | `count` wedges round the axis, split by lines `scale × amount` wide | `count`, `scale`, `amount` |
| `checker` | squares `scale` wide | `scale` |
| `grid` | lines `scale` apart | `scale`, `amount` = thickness |
| `dots` | even polka dots on a square grid | `scale` = spacing, `amount` = size |
| `speckle` | tiny random flecks | `scale`, `amount` = how many |
| `sprinkles` | short rods at random angles, in up to three colours | `scale`, `amount` |
| `spots` | soft blotches | `scale`, `amount` |
| `grain` | wavy lines along the axis: wood | `scale`, `amount` = strength |
| `pips` | a die's faces: each face's pips (up to nine, then its number), from the face its uv names (`geometry-3d`'s `dieSoup`) | `amount` = how bold; give `surface: { around: 1, along: 1 }` |
| `numbers` | a die's faces as numbers, the same way | as `pips` |

`axis` (`'y'` by default) is the mesh's own; `angle` turns the pattern about it; `seed` scatters the random kinds
differently; `pixel: n` draws it in hard square pixels `scale / n` across. A pattern is measured from the mesh's own
position times a size in world units: `frame` when given (the object's rest size, so it sticks through squash and
scale), else the instance's scale. On a swept or bent mesh give `surface: { around, along, uAlong? }` instead and it is
measured in the mesh's uv, unrolled onto a cylinder that size, so stripes follow a candy cane's hook. Patterns are the
same maths on both backends, antialiased to a pixel and settling to their average colour when finer than one.

## Surfaces for flat meshes

`game.render3d.surface(handle, opts)` gives one mesh what a flat mesh (a card, a banner, a leaf, a sail) needs and a
box never does, plus one of eight effects; `null` takes it all off. A mesh with no surface pays nothing: the extended
pipeline is not even compiled until something wears one.

```ts
game.render3d.surface(card, {
  decal: true,                             // the paper is the mesh; the texture is only the ink
  backFrame: backArt,                      // a different frame on the −Y face, flipped to read the right way round
  bend: { kind: 'curl', amount: 0.18 },    // and lighting that follows the curl
  effect: { kind: 'holo' },
});
game.render3d.surface(plate, { msdf: true, transparent: true });                    // a number that is sharp at any zoom
game.render3d.surface(sword, { glow: { color: '#7ddcff', size: 22, strength: 1.4, rim: 2 } });   // a halo outside it
```

- `decal`: the texture sits on the mesh colour instead of multiplying it, so the mesh is the paper (any colour, crisp
  corners) and the texture carries only the ink. `cutout` (a threshold) is the other way round, for a texture that
  carries the silhouette (a round chip on a square frame, foliage): without it those regions render black. The two
  are alternatives.
- `backFrame`: a different atlas frame on the back sheet of a plane, mirrored so it reads the right way round.
- `bend`: `{ kind, amount }`, `amount` the lift at the edge in world units, with exact normals; `curl` lifts two sides,
  `bowl` every edge, `corners` the corners, `dome` the middle. For planes only: use `roundedPlane`, a grid with
  rounded-rectangle corners, so the bend is smooth.
- `msdf`: the texture is a multi-channel distance field, so text and symbols on a mesh stay sharp at any size and
  angle. The ink is the object's tint; `weight` thickens or thins it (about ±0.3 before letters close up) and
  `sharpness` scales the edge. Bake labels into the atlas from a loaded MSDF font with `msdf.atlas({ font, labels })`,
  and add `transparent: true`.
- `glow`: `{ color, size, strength, rim? }`, a soft halo outside the silhouette, the one highlight that reads as
  "selected" (the `glow` effect lights the object's own pixels; `post-bloom` glows everything bright). It is occluded
  by the scene, and costs nothing until something glows, then one stamp, four half-resolution blurs and one composite
  however many glow. `rim` adds a solid outline.
- `transparent`: blend soft texture alpha even at alpha 1. `depthOnly`: write depth without colour, an invisible
  occluder for hidden lines.
- `effect`: `{ kind, amount?, speed?, color?, param? }`, every field live (tween `amount` and a card burns away):

  | kind | what it is | `param` |
  |---|---|---|
  | `holo` | iridescent foil, shifting with tilt, never by itself | rainbow bands per unit of tilt |
  | `glow` | a pulsing highlight, brightest at the rim | rim tightness |
  | `dissolve` | burning away: `amount` is the progress | hot edge width |
  | `fire` | flames licking up the face | flame scale |
  | `shine` | a bar of light sweeping across | bar width |
  | `gild` | metal leaf on the artwork only (keyed off its luminance) | sweep frequency |
  | `ripple` | a liquid surface: the art bends under travelling waves | wave frequency |
  | `frost` | cracked ice plates with glowing veins, glinting with tilt | cell scale (lower is chunkier) |

## Static batches

```ts
const trees = game.render3d.staticBatch({
  mesh: game.world3d.mesh('icosahedron'),
  instances: spots.map(([x, y, z]) => ({ x, y, z, size: 2.4, color: '#3f6a2e' })),
});
trees.rebuild(moved);    // repack, when the population changes
```

For thousands of things that never move (a forest, rocks, grass tufts): packed once into a GPU buffer, frustum-culled
each frame by a compute pass (the camera's frustum joined with the shadow volume, so a caster behind the camera still
throws into view; each instance bounded by its mesh's own reach times its scale, so a mesh can be any size) and drawn with an indirect draw, with no CPU work per frame. The landscape example draws 32,598
static instances in two batches. A batch's `count` is what it holds, not what drew; `staticDrawn` reports survivors a
frame late. A static instance is not a roster object: no handle, tags, body or queries, and moving one means
`rebuild`. A pack plants its own through the registry: `k.registry.get<Static3dService>('static3d', 'render-3d')!.staticBatch(spec)`.

## Picking

```ts
game.spawn({ id: 'unit', mesh: 'capsule', x, y: 1, z, pickable: true });
const p = game.input.pointer;
if (p?.pressed) { const hit = await game.render3d.pick(p.x, p.y); if (hit) select(hit); }
```

`pick(x, y)` replays the last frame into a one-texel id buffer under the pointer, so what you click is what you see:
a mesh's holes, its cut-out silhouette and its bend all count, and nothing is pickable where it was not drawn. Only
objects spawned with `pickable: true` are returned. `opts.occlude` (default true) makes the rest solid, so clicking a wall
selects nothing; `false` makes them see-through, to select a unit through foliage. It resolves after a GPU readback,
about a frame later, with `null` before the first frame, for a miss, and for a pick started while one is in flight.
Billboards, grass, water, particles, terrain patches and static batches are not picked. For a world-space ray (a
bullet, a line of sight) use `game.world3d.screenRay` and your own tests, or `world3d.pick`, which tests boxes.

## For packs that draw in 3D

- **MSAA.** The 3D scene draws at 4x multisampling by default. Draw into `r3.colorView` (the multisampled target, or
  the swapchain with MSAA off), declare `multisample: { count: r3.sampleCount }` on every pipeline that targets it,
  and order passes `before: 'resolve3d'`. A shader that samples scene depth needs `msDepth(wgsl, r3.sampleCount)` and
  `multisampled: true` on its layout entry. What was drawn before the 3D scene (a backdrop, a sky) is copied into
  the target first, so nothing else has to know MSAA exists.
- **A shader of its own** (`mesh-shaders`): register a `Mesh3dShaderHook` under `mesh3dShader`. `claim(slot)` answers
  `MESH3D_CLAIM` bits (`opaque`, `blended`, `shadow`) and `plain(slot)` the alpha the object's own look still draws
  at; the hook's `drawGpu` / `drawGl` run inside the scene pass in the object's place. A claimed object still sorts,
  picks and glows, and casts as the plain mesh when it says `shadow`.
- **Caustics and ground grain**: `underwater-3d` and `terrain-3d` publish a texture the mesh shader projects in world
  space (the caustic net on a seabed; a speckle over sandy terrain).
- **Materials from a pack**: `registerMaterial3d(k, def)`, the same definitions as `game.world3d.material`.
- **WebGL2**: companion renderers read `ctx.backend.render3dGl` for the camera, lighting, clip distances and sun, and
  draw into the backend's scene framebuffer; depth sampling uses a copy.

## Options

- `msaa`: `true` or `4` (default) multisamples the 3D scene; `false` or `1` turns it off for a fill-bound scene.
- `lighting`: a preset name or a patch over the defaults, applied before the first frame. Anything written to
  `game.render3d.lighting` afterwards wins.

## Limits

- One shadow-casting light, the sun. WebGL2 has one shadow map instead of cascades and up to eight lamps instead of
  clusters, and picks against the CPU triangles and bend (texture alpha is not part of its pick).
- A transparent mesh is sorted by its origin, not per triangle, so a large one that interpenetrates another can
  resolve in the wrong order. Every instance sorts by its own position, so the particles of two emitters (a flame and
  its smoke) interleave back to front rather than one emitter drawing whole over the other. An additive instance is
  drawn through the same premultiplied over-blend writing no alpha, which adds its light exactly as before, so additive
  and alpha particles of one mesh and surface merge into one draw. WebGPU carries the material per instance; WebGL2
  merges plain materials (no maps, pattern, sRGB colour or uv offset), lit and unlit alike, and splits on any other.
- An instance whose scale collapses to 0 (or is not finite) on any axis is dropped rather than drawn, so a pop-in
  tweened from 0 never flashes its back faces.
- Back faces of opaque, shadow-casting and glowing meshes are culled on both backends, so triangles are expected
  counter-clockwise from outside, as `geometry-3d` builds them; a transparent mesh draws both sides. A `plane` is two
  sheets back to back, each seen from its own side.
- Texture filtering is the screen policy's, one rule for the game.
- Nothing in CI runs the shaders: tests check the structure and keep the WGSL and GLSL constants equal.
