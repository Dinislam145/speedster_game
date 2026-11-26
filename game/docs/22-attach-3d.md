# 3D Attachments

Parenting for 3D objects. A child keeps a **local** pose relative to its parent, and each step the chain is composed into the world pose the rest of the engine already understands — so an attached object is still an ordinary roster object to collision, queries, culling and the renderer.

## When to use it

Anything that rides something else: a turret on a tank, a weapon in a hand, a hat on a head, a light on a lamp post, a camera on a mount. For a loaded model whose parts already share an origin, `model-files-3d` moves them together without this.

It is also how you build **one object out of two meshes** — a tile and the number on it, a card and its border, a button and its cap, a crate and its label. With `inheritScale` and `face` the assembly moves, turns and *scales* as a unit, so a single tween of the parent is the whole animation.

## Requires

A 3D world. The composition itself is the kernel's `composeChain`, which is pure and tested.

## API

| call | what it does |
|---|---|
| `game.attach.to(child, parent, offset?)` | attach at a local offset |
| `game.attach.detach(child)` | detach, leaving it where it is |
| `game.attach.offset(child, offset)` | change the local pose |
| `game.attach.parentOf(child)` / `.childrenOf(parent)` | walk the tree |
| `game.attach.count` | live attachments |

An offset is `x`, `y`, `z`, `yaw`, `pitch`, `roll`, the child's own `sx`, `sy`, `sz`, and the three that
make an assembly: `inheritScale`, `face` and `lift`.

### `inheritScale` — the child rides the parent's size

**Scale is not inherited by default**: a crate's size should never inflate its rider, and that is still the
common case. Turn it on and the child's own scale becomes its local scale times the parent's, **per axis**,
so a parent scaled tall makes a tall child rather than a uniformly bigger one.

```ts
game.attach.to(label, crate, { inheritScale: true });
crate.sx = 2; crate.sy = 6; crate.sz = 4;     // the label follows, 2 x 6 x 4
```

A child's local scale is whatever it was wearing when it was attached, so attaching alone never resizes
anything; pass `sx`/`sy`/`sz` in the offset to set it, or spawn a plate that should fill a face at scale 1.

When the child rides the parent's size, its **offset moves into the parent's units** — `{ y: 1 }` means one
parent-height up, not one world unit. A fixed world offset would slide off a parent that resizes, which is
the bug this exists to prevent.

### `face` — lay a plate on a face

```ts
game.attach.to(numberPlate, tile, { face: 'top', inheritScale: true });
```

`face` is `'top'`, `'bottom'`, `'left'`, `'right'`, `'front'` or `'back'`, named by the direction it looks.
The child is placed at the centre of that face of the parent's box, in the parent's units, and turned so its
local **+Y** — the way every `geometry-3d` plane already faces — points out along the face normal. `x`, `y`
and `z` nudge it from there, in the parent's units and the parent's frame; `yaw` spins it in place on the
face rather than tipping it off.

`lift` is how far clear of the surface it sits, in **world** units, default `0.002`. Two exactly coplanar
surfaces fight for the depth buffer and the seam flickers as the camera moves, so a plate needs a hair of
clearance — and it stays a fixed world distance however the parent is scaled, because depth precision does
not care how big the parent is. Put deliberate distance in `y` instead.

Together these two are a whole animation layer. A 2048 tile is a bevelled box wearing the colour and a
rounded plane on its top carrying the number:

```ts
const body = game.world3d.spawn({ mesh: 'roundedBox',   sx: 0.96, sy: 0.26, sz: 0.96, color: tint });
const face = game.world3d.spawn({ mesh: 'roundedPlane', texture: 'nums', textureFrame: n });
game.attach.to(face, body, { face: 'top', inheritScale: true });

game.tween.to(body, { x, z }, { duration: 0.13 });                 // slide
game.tween.to(body, { sx: 1.15, sy: 1.15, sz: 1.15 }, { yoyo: true, loop: 1 });   // merge pop
```

The number slides, pops, spins and shrinks with the tile, and no game code ever mentions it again.

## Options

None at compose time.

## Limits

Chains compose on the fixed step, so a child lags its parent by nothing at 60Hz but is not composed again for a render at a different alpha; a very fast parent can show a hair of separation between steps. A cycle is capped at 32 deep rather than detected and refused. When a parent dies the child is left standing where it was, which is usually what a game wants but is a choice, not a law. There is no per-bone attachment: a model's parts are not addressable individually yet. `face` uses the
parent's **box**: a unit-sized mesh scaled by `sx`/`sy`/`sz`, which is what every `geometry-3d` primitive
is. On a sphere or a torus the face is the bounding box's face, not the surface, which is right for a label
on a crate and wrong for a sticker on a ball. `inheritScale` multiplies scales; it does not shear, so a
child rotated within a non-uniformly scaled parent is scaled in its own axes rather than the parent's.
