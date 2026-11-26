# 3D tag collision rules

Overlap rules by tag in a 3D world, with no dynamics: the same calls as the 2D `collision` pack, measured in x, y
and z. Every object is a box the size of its mesh by default (meshes are unit-sized and scaled, so a box is |sx| by
|sy| by |sz|); a rule names two tags and what happens when one of each overlap. Rules run every fixed step after
the game's own steps; callbacks fire inside the step.

```ts
game.collide.on('player', 'coin', (p, coin) => { coin.destroy(); score += 1; });
game.collide.solid('player', 'wall');                       // keep the player out of walls
game.collide.solid('crate', 'crate', { push: 'both' });
game.spawn({ id: 'ball', mesh: 'sphere', x, y, z, tags: ['ball'], collide: { shape: 'sphere' } });
game.spawn({ id: 'hero', model: 'hero', x, y: 0, z, tags: ['hero'], collide: { size: [0.6, 1.8, 0.4], offset: [0, 0.9, 0] } });
const hit = game.collide.raycast(x, y, z, dx, dy, dz, 50, 'enemy');   // nearest along the ray, or null
```

## When to use it

Whenever two kinds of thing in a 3D game must notice each other: pickups, bullets, enemies that touch the player,
triggers, a player who walks on floors and stops at walls without physics. `core-3d` includes it. Reach for
`physics-3d` only when things need mass, gravity and spin; a pickup never pays for physics. It replaces the 2D
`collision` pack in a 3D game: both are `game.collide`, so a game composes one or the other.

## Requires

`world:3d`. Objects are measured by their position and their scale (`x y z`, `sx sy sz`); y is up.

## API

| call | what it does |
|---|---|
| `on(tagA, tagB, (a, b, contact) => …)` | every overlapping pair, every fixed step, `a` from the first tag |
| `solid(tagA, tagB, { push?, cb? })` | keep A out of B by moving A (`'a'`, default), B or `'both'`, along the shallowest axis |
| `overlaps(h, tag?)` | every live object overlapping `h` now |
| `test(a, b)` | do these two overlap now |
| `contact(a, b)` | `{ side, overlap }` or null: the side of `a` that `b` is against |
| `raycast(x, y, z, dx, dy, dz, maxDist, tag?)` | `{ handle, distance, x, y, z }` of the nearest box along the ray, or null |
| `shape(h, { … })` | give an object a shape after spawning it |

**Shapes** are spawn data, `collide: { shape, size, radius, offset }`, in the object's own units so its scale
multiplies them:
- `shape`: `'box'` (default) or `'sphere'`.
- `size: [w, h, d]`: a box of another size than the mesh (default `[1, 1, 1]`, the mesh).
- `radius`: a sphere's (default half the box's largest side).
- `offset: [x, y, z]`: the shape's center from the object's origin, for a model whose origin is its feet.

**Sides** are `'left'` and `'right'` (x), `'bottom'` and `'top'` (y, up), `'back'` and `'front'` (z). A player whose
contact with a floor is `'bottom'` is standing on it.

Rules belong to the scene that made them and leave with it. Destroying either object inside a callback is safe:
the pair is not separated, and the object meets nothing else that step.

## Options

None.

## Limits

- Boxes stay upright: a turned box is tested as its unturned self, and a sphere does not care. Use `physics-3d` for
  turned boxes that must rest on each other.
- `solid` separates a sphere as its bounding box.
- Every pair of a rule's two tags is tested each step, so rules are for tens to hundreds of objects, not thousands.
- Positional only: `solid` moves things apart and never changes a velocity the game keeps.
- `raycast` tests boxes (a sphere as its box).
