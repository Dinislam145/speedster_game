# Procedural models

A model as **data**: a tree of the engine's own primitives, each sized, posed and painted, with named clips that move them. `game.models.build(spec)` turns that JSON into live objects — one per part, riding its parent — and hands back the handles and a clip player. Nothing is loaded from a file, so a model is something an agent can write, a tool can edit and a diff can read.

## When to use it

**Which model pack?** `model-3d` (this one, `game.models`, part of `core-3d`) builds models from a spec of primitives. `model-files-3d` (`game.modelFiles`) loads files an artist made, `.glb` and `.obj`. They work side by side.

Characters, vehicles, props, creatures and machines described as primitives — the low-poly, toy-like look, or a blockout that ships. The phaser.io Design Desk's model tool writes exactly this spec, so anything made there drops straight into a game. Not for scanned or sculpted assets: `model-files-3d` loads those from GLB. Not for scene dressing with no hierarchy: `art-3d` and plain `world3d.spawn` are lighter.

## Requires

A 3D world. Meshes and materials are registered through the kernel registry the way `world-3d` and `render-3d` do, so a model's plain box is the world's plain box.

## API

| call | what it does |
|---|---|
| `game.models.define(name, spec)` | name a spec, so `game.spawn({ model: name })` builds it |
| `game.spawn({ id, model, x, y, z, scale, tags })` | build a named model (or a spec) on the spawned object, which is its root: move it, tag it, `destroy()` it, and `root.play('walk')` plays a clip (asking again keeps it playing). It collides, under `collision-3d`, as the box its parts fill |
| `game.models.of(root)` | the `ModelInstance` built on a spawned object, or null |
| `game.models.has(name)` | is there a model by this name |
| `game.models.build(spec, at?)` | build a spec at `{ x, y, z, yaw, scale, layer }`, or on `at.root`; returns a `ModelInstance` |
| `game.models.clean(raw)` | tidy anything spec-shaped into a valid spec (total: never throws) |
| `game.models.bounds(spec)` | rest-pose bounds, for framing a camera |
| `game.models.count` | live instances |

A `ModelInstance`:

| member | what it is |
|---|---|
| `root` | the origin handle: move, turn or scale it and the whole model follows |
| `parts[id]` | each part's PIVOT handle — attach a weapon to `parts.hand`, read a wheel's world pose |
| `meshes[id]` | each part's DRAWN handle — recolour with `.tint` |
| `play(clip, { loop?, speed?, from? })` / `stop()` | play a clip by id; stop returns every part to rest |
| `pose(clip, time)` | hold one moment without playing — a scrubber |
| `time`, `clip`, `playing` | where the player is |
| `kill()` | remove every handle |

```ts
import { game } from './engine.js';
import { hero } from './models/hero.js';          // a ModelSpec

const h = game.models.build(hero, { x: 0, y: 0, z: 0 });
h.play('walk');
game.attach.to(sword, h.parts['hand-r']!, { y: -0.3 });
```

### The spec

A `ModelSpec` is `{ name, version: 1, parts, materials, clips }`; `game.models.clean(raw)` (or `cleanModelSpec`)
turns anything spec-shaped into a valid one and never throws.

| part field | what it is |
|---|---|
| `id`, `name` | the part's id (tracks address it: `torso`, `arm-l`, `wheel-fr`) and what a person calls it |
| `parent` | the part it hangs from; none (or unknown) makes it a root |
| `shape`, `shapeOptions` | a `geometry-3d` primitive by name, or `lathe` (with `profile`), `extrude` (`outline`, `bevel`), `tube` (`path`, `radius`), `sweep`, `vessel`, `leaf`, `scatter`, `coat`, `die`, or `none` (a pure pivot) |
| `position` | the pivot, in the parent's frame (world units at the root) |
| `rotation` | yaw, pitch, roll in degrees about the pivot |
| `size` | width, height, depth in world units: the box the part fills |
| `offset` | the mesh's centre from the pivot, so a leg swings from the hip: `[0, -h/2, 0]` |
| `material`, `color`, `caps` | a material id, a colour for this part alone, a second material for flat ends |
| `mirror` | build a twin across x as `<id>__m`, children and all |
| `visible` | drawn at all (default true) |
| `detail`, `facets`, `smooth`, `deform`, `sweep`, `vessel`, `leaf`, `die`, `scatter`, `coat`, `slice`, `cut`, `cutMaterial`, `tool` | a smooth form and its settings (Smooth forms, below) |

| material field | what it is |
|---|---|
| `id`, `color` | the id parts name, and its colour |
| `rough`, `metallic`, `emissive`, `unlit` | the surface (render-3d's meanings) |
| `opacity` | see-through, 0.05..1 |
| `pattern` | marks over the colour (Patterns, below) |

A clip is `{ id, name, duration, loop, tracks }`, each track `{ part, channel, keys: [{ t, v }], ease }`. Channels
`x y z` move the part (units) and `yaw pitch roll` turn it (degrees), as **deltas** from its rest pose, and
`sx sy sz` scale it as **multipliers**, so editing the rest pose never breaks a clip.

**When a one-shot clip ends.** A clip with `loop: false` holds its last pose: `playing` stays true and `time` stops at
the clip's `duration`, and there is no event. Check `inst.time >= duration` (the clip's, from the spec) to chain the
next one; calling `root.play('jump')` again after it has ended starts it over.

**Collisions.** Under `collision-3d` a model collides as the box its parts fill **at rest**: clips move the parts, not
the box.

### Patterns

A material may carry a `pattern`: marks the renderer paints over its color, so a watermelon's rind is striped, a
cookie speckled and a donut's icing sprinkled without a part for each stripe, seed or sprinkle.

```json
{ "id": "rind", "color": "#7cc35a", "rough": 0.6, "pattern": { "kind": "stripes", "colors": ["#2f6a2a"], "count": 12 } }
```

`kind` is one of `stripes`, `bands`, `swirl`, `rings`, `segments`, `checker`, `grid`, `dots`, `speckle`, `sprinkles`,
`spots`, `grain`, and `pips` and `numbers` for a die's faces (`MODEL_PATTERNS`); `colors` are one to three marks over the material's own color, which is the
ground. The rest is optional: `scale` (meters: one repeat, or the marks' spacing), `count` (stripes, segments and
swirl round the axis), `amount` (0..1, how much of the surface the marks take), `axis` (the part's own, `y` by
default), `angle` (degrees), `pixel` (draw it in square pixels, `scale / pixel` across), `seed`, and `space`;
`MODEL_PATTERN_DEFAULTS` has the defaults and render-3d's docs say what each kind does with them.

`space: 'surface'` measures the pattern along the part's surface instead of in its frame, so it follows a swept tube,
a lathe's profile or a bent shape: a candy cane's swirl winds round its hook. The length is the axis. It needs the
part's surface size, `patternSurface(part)` (round and long in meters at the part's size): sphere, cylinder, capsule,
cone, lathe and tube have one; any other shape falls back to its frame. A new shape whose uv runs round and along
adds its case there.

A pattern is measured on each part **as the spec sizes it**: it sticks to the part when the part turns, squashes in
a clip or the whole model is scaled, and two parts sharing the material show the same stripe width. So a patterned
material becomes one render-3d material per distinct part size, shared by every copy of the model, which still
batches. A part's `color` and a tint change the ground, never the marks. `cleanModelSpec` drops a pattern with an
unknown kind or no usable color and clamps the rest.

### Every primitive fills its box

A part's `size` is the box it fills: every primitive is stretched to its unit box, so a torus is as tall as its
size says (its `minor` is the tube's share of the radius) and a capsule as wide (its `r`, 0..0.5, is how much of the
height each round end takes). What is placed by a box (a seed on a bagel) sits on the surface.

### Smooth forms

A part with `detail` (`low` | `medium` | `high`), or any of the fields below, is a FORM: built at its real size (so a
bend, a wall or a seed keeps its proportions) and then fitted to its box like any part. A part with none of them
builds as it always has.

| field | what it does |
|---|---|
| `detail`, `facets`, `smooth` | how finely it is cut; flat shading; `smooth: false` keeps straight lines between a profile's, outline's or path's points (otherwise a smooth curve through them, a third/fourth value 1 marking a corner) |
| `deform` | `bend` (degrees, toward +x or `bendAxis: 'x'` toward +z), `taper [x, z]`, `twist`, `lobes { count, depth, sharp }`, `noise { amount, scale, seed }`, `squash [x, z]`, in meters along the part's y |
| shape `sweep` + `path`, `sweep` | a section along a smooth path: `radius` (meters, or one per point), `section` (`round`, n sides, `{ star, depth }`, `{ outline }`), `squash`, `caps`, `closed`, `twist`, `beads` — bananas, candy canes, pretzels, croissants |
| shape `vessel` + `profile`, `vessel` | a hollow lathe (the profile is the outside): `wall`, `inside` material, `fill { level, material, surface }` (flat or dome) — cups, bowls, glasses with their drink |
| shape `leaf`, `leaf` | a blade up +y facing +z: `widths`, `fold`, `curl`, `twist` |
| shape `scatter`, `scatter` | many copies of `item` merged into one mesh: `surface`, `grid`, `spiral` over the PARENT's surface (seeds, kernels, scales), `ring`, `line`, `volume` in its own box (a crown of leaves, a bunch of grapes) |
| shape `coat`, `coat` | a layer hugging the PARENT's surface: `thickness`, `from` (its edge, 0..1 of the parent's height), `drips`, `dripDepth`, `wave`, `under` — icing, glaze, chocolate |
| `slice` | up to three planes `{ axis, at, keep, cap }`; the cut face takes the `cap` material; `size` is the box after the cut — a half kiwi |
| `cut`, `cutMaterial`, `tool` | child parts marked `tool` are carved out of their parent (never drawn); the carved faces take `cutMaterial` — holes in cheese, a bite from an apple |
| `caps` | a second material for flat ends |
| shape `die`, `die` | a gaming die resting on a face: `sides` 4, 6, 8, 10, 12 or 20, `chamfer` 0..0.4 (default 0.12; 0 is sharp). Its faces are numbered (opposite faces add to sides + 1) in their uv, and a material with the `pips` or `numbers` pattern paints them; its size is set to its natural box, so it is never stretched |

A coat and a `surface`/`grid`/`spiral` scatter take their parent's box (the cleaner sets their position and size). A
form's second surfaces (a vessel's inside and fill, a slice's face, a cut's faces, flat caps) are drawn as extra
handles on the part's pose, each in its own material.

### Holding together

`modelContacts(spec)` checks a model on the meshes it draws, at rest: `floating` (parts that reach the floor
through nothing that touches: a vertex inside or on another part, or an edge through one of its faces), and
`poking` (parts inside a vessel or a see-through part that come out through its side below the rim), in meters. A
second or two for a big model: a check for tools and galleries, not for a frame.

### Dice faces

The `pips` and `numbers` patterns paint a `die`'s faces from the numbers in its uv: pips in the classic layouts (up
to nine, then the number), or the number in a rounded stroke font, 6 and 9 underlined; `colors[0]` is the ink and
`amount` how bold. On any other shape they draw nothing.

### See-through

`opacity` (0.05..1, default 1) lets what is behind a material show through: glass 0.2–0.4, a drink 0.6–0.85, ice
about 0.7. It is each part's alpha, so render-3d draws those parts after the solid ones, sorted back to front by
their centers, and they cast no shadow. A see-through part sorts as one piece, so a drink inside a glass reads best
when the drink is solid enough (0.8 or more) or the glass much thinner.

## Options

None at compose time.

## Limits

- Hierarchy is composed on the fixed step, before `attach-3d`, and only uniform scale flows down the tree (the
  model's `scale`, and a part's animated `sx/sy/sz` on itself).
- One clip plays at a time per instance: no blending.
- Specs are clamped (`MODEL_LIMITS`): 160 parts, 32 materials, 24 clips, 96 tracks a clip, 64 keys a track, 64
  points a profile, outline or path, and 200 world units a side. Every part is a roster object and every material
  a renderer material, so a model past these is a scene: build it from several models, or as `art-3d` dressing.
- There is no skinning: a part is rigid, and a joint is where two parts overlap. For a skinned character from a file,
  `model-files-3d`.
- Rotation is degrees in the spec only; every handle is radians as usual.
