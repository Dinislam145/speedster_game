# 3D Geometry Builders

A mesh-modelling toolkit as pure functions over interleaved triangle soups (position, normal and uv, eight floats a
vertex): every unit-sized primitive, outline and path builders, smooth forms built at a real size (lathes, sweeps,
vessels, leaves), deformers, scattering and coating, exact plane slicing, polyhedral dice, and CSG (union, subtract,
intersect). Curved surfaces carry smooth normals, so they read as real 3D rather than faceted retro. It touches no
GPU and no roster.

Procedural models (a banana, a glass of juice, a die, a character) are usually `model-3d` specs, which build their
forms from these functions; reach for this pack directly to make a mesh in code, to cut one with CSG, or from a pack.

## When to use it

Whenever you need geometry: `world-3d` imports these builders directly to make its meshes, and any pack that
generates shapes can stand on them. Import the functions in game code (they are the card's helpers), then register
the soup with `game.world3d.defineMesh(name, verts)`, or compose the pack for its runtime API:
`game.geometry3d.build(name, opts)` makes vertices on the spot and `define(name, fn)` adds a builder that
`world3d.mesh(name, opts)` and `spawn({ mesh: name })` then find. A game that only spawns built-in primitives does
not need it composed at all.

## Requires

Nothing. Pure functions over typed arrays; headless and testable.

## API

| call | what it does |
|---|---|
| `game.geometry3d.build(name, opts?)` | vertices for a named primitive |
| `game.geometry3d.define(name, fn)` | register your own builder: `world3d.mesh(name, opts)` and `spawn({ mesh: name })` build it on first use. Defining a name again replaces the builder, and the next `mesh(name, opts)` rebuilds that mesh in place (same id, so objects already wearing it change too); the same builder again changes nothing. A built-in primitive's name is refused |
| `game.geometry3d.has(name)` / `.names` | what is available |
| `MESHES` | the catalogue: name → builder |
| `Builder` | custom triangle soup, winding self-corrected |
| `latheVerts` `tubeVerts` `shapeVerts` `extrudeVerts` `earClip` | the unit-sized outline and path builders |
| `cubeVerts`, `sphereVerts`, `roundedBoxVerts`, `cylinderVerts`, `coneVerts`, `capsuleVerts`, `torusVerts`, … | each primitive as a function (the names below with `Verts`) |
| `transformVerts(verts, { pos, scale, yaw, pitch, roll })` | bake a placement into a soup |

```ts
import { latheForm, toUnitBox, dieSoup, Solid, roundedBoxVerts, sphereVerts } from '@phaser-ae/geometry-3d';
const vase = latheForm([[0, 0], [0.12, 0.02], [0.18, 0.2], [0.08, 0.38], [0.1, 0.42]], { around: 32 });
game.world3d.defineMesh('vase', toUnitBox(vase));        // one mesh for vases of any size
game.world3d.defineMesh('d20', dieSoup(20, { chamfer: 0.04 }));
```

The named primitives: `box`, `roundedBox`, `sphere`, `cylinder`, `cone`, `capsule`, `torus`, `torusKnot`, `wedge`, `plane`, `quad`, `roundedPlane`, `panel`, `disc`, `circle`, `ring`, `tetrahedron`, `octahedron`, `icosahedron`, `dodecahedron`. `plane` faces +y (a floor); `quad` faces +z with x right and y up, which is what a billboard wears.

## Options

Each primitive takes its own knobs, all optional: segment counts (`segs`, `rings`, `sides`), radii (`r`, `major`, `minor`, `rTop`, `rBottom`, `inner`), `arc` (0..1) to cut a wedge out of anything round, `open` to drop a cylinder's caps, and `detail` to subdivide a platonic solid toward a sphere. `world3d.mesh(name, opts)` keys its cache on the options, so two option sets are two meshes and the same options are one.

## Smooth forms — built at a real size

The primitives are unit boxes; these build at a REAL size (meters), so a bend, a wall or a seed keeps its
proportions, and come back as soups you fit with `toUnitBox` when you want one mesh for many sizes. `model-3d` builds
its smooth forms (sweep, vessel, leaf, scatter, coat, deform) from them.

| call | what it makes |
|---|---|
| `latheForm(profile, { around?, maxTurn?, smooth?, crease?, arc? })` | a profile of `[radius, y]` points revolved about y through a smooth centripetal Catmull–Rom curve (a third value 1 is a corner) |
| `sweepForm(path, { radius, section?, squash?, caps?, closed?, twist?, beads?, corners?, … })` | a section swept along a smooth path: `radius` one number or one per point; `section` `'round'`, n sides, `{ star, depth }` or `{ outline }`; `caps` `'round'`, `'flat'`, `'point'` or `'none'`; `beads: { count, depth }` |
| `vesselForm(profile, wall, { fill?: { level, surface? } })` | a hollow lathe, `{ outside, inside, fill }`: a wall `wall` thick, a rim, and contents to a `level` (a `'flat'` or `'dome'` surface) |
| `leafForm(length, width, { widths?, fold?, curl?, twist?, thickness? })` | a blade along +y facing +z: widths base to tip, fold, curl, twist |
| `deformSoup(s, { squash?, lobes?, taper?, twist?, noise?, bend?, bendAxis? })` | squash, lobes (`{ count, depth, sharp? }`), taper, twist, noise (`{ amount, scale?, seed? }`), then bend, along the soup's y |
| `surfaceSamples` `gridSamples` `spiralSamples` `ringPlacements` `linePoints` `volumePoints` | where copies go: evenly over a surface, in rows by its uv, along a spiral, round a ring, along a line, packed in a volume (sphere, cone, box, cylinder, bunch) |
| `placeCopies(item, places)` | one soup copied to many places, each turned to its up and spun, merged |
| `coatSoup(target, { thickness, from?, drips?, dripDepth?, wave?, waves?, seed?, under? })` | a layer over a surface above an edge (icing, snow, slime): thickness, waves, drips, a skirt where it ends |
| `dieSoup(sides, { chamfer })` | a d4, d6, d8, d10, d12 or d20 cut from planes, resting on a face, edges and corners chamfered; each face's number in its uv (`u` = number − 1 + across, `v` = up), the chamfers `u` < 0 |
| `sliceByPlane(s, axis, d, keep?)` | a closed soup cut exactly by a plane, `{ kept, face }`: the triangles clipped and the cut closed from the section's own loops, holes and all (a sliced fruit, a cutaway) |
| `smoothCurve(points, { closed?, corners?, smooth?, maxTurn?, maxStep?, steps? })` `alongPoints` `arcLengths` | the curves under all of them (adaptive: finer where they turn) |
| `soupBounds` `mergeSoups` `flipSoup` `soupVolume` `scaleSoup` `moveSoup` `subdivideSoup` `flatNormals` `smoothNormals` `toUnitBox` `gradientNoise` | soup tools (`gradientNoise(seed)` is procgen's Perlin noise as a function of x, y, z) |

## CSG — cutting shapes out of shapes

Boolean **union**, **subtract** and **intersect** over triangle soups. Soup in, soup out: the result is one more mesh you register and instance, so CSG needs no renderer, shader, pipeline or physics work at all.

```js
import { Solid, roundedBoxVerts, sphereVerts } from '@phaser-ae/geometry-3d';

const body = Solid.fromVerts(roundedBoxVerts(0.18, 3));
const pips = Solid.merge(spots.map(pos => Solid.fromVerts(sphereVerts(10, 6), { pos, scale: 0.18 })));
const die = game.world3d.defineMesh('die', body.subtract(pips).toVerts());
```

It is **bake-time** geometry, never touched per frame. Build the shape once at load, register it, and from then on it is an ordinary instanced mesh with no boolean anywhere near the frame.

Cut edges **interpolate the normal and the uv**, which is the difference between a drilled dimple that lights as a concave bowl and one that reads as a black hole. Textures stay sane across a cut for the same reason.

### Merge the tools, subtract once

Three ways to combine solids, and picking the right one is the difference between instant and stalled:

| | |
|---|---|
| `Solid.merge(solids)` | concatenate, **no boolean**. Correct when the solids do not overlap — and when they do not, it *is* the union |
| `Solid.union(solids)` | a full boolean per pair, so overlapping solids come out as a single skin |
| N sequential `subtract` calls | the slow way: every subtract re-splits everything the last one produced |

A die's twenty-one pips are twenty-one separate balls. `merge` is an array copy; `union` would run twenty BSP booleans to discover they never touch, which is slow enough to stall a page. Then **one** subtract, not twenty-one — the same solid with an order of magnitude less geometry.

### What it is and is not

This is the classic csg.js BSP algorithm: excellent for a convex tool against a convex-ish body — dimples, notches, engraving, windows in walls — and solid in general use. It is **not** a CAD kernel over arbitrary self-intersecting meshes. Keep tools clean and closed.

Every tree walk is iterative over an explicit work stack. The well-known csg.js failure is O(N)-deep recursion blowing the call stack on a large polygon set; an iterative walk lifts that ceiling.

`transformVerts(verts, { pos, scale, yaw, pitch, roll })` bakes a placement into a soup before it joins the shared CSG space — scale, then rotate, then move, with normals rotated and renormalised. `Solid.fromVerts` takes the same placement inline.

## Limits

- Builders return a triangle soup, not indexed geometry: simple and fast to upload, but a sphere costs more
  vertices than an indexed one would.
- The primitives are unit-sized by construction and scaled at spawn; the smooth forms are built at a real size and
  fitted with `toUnitBox` when one mesh should serve many sizes.
- `earClip` handles simple polygons, not holes or self-intersection (`sliceByPlane` closes holed sections itself).
- CSG is the BSP algorithm: right for clean, closed tools against a body, not a CAD kernel over self-intersecting
  meshes.
