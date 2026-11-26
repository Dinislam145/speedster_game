# 3D model files (.glb, .obj)

Loads glTF 2.0 binary files (`.glb`) and Wavefront OBJ files (`.obj`, with its `.mtl`) and turns them into meshes the 3D world can spawn. The readers themselves are pure: `parseGlb` takes an `ArrayBuffer` and returns plain data — non-indexed triangle soups with the node hierarchy already baked in, materials, embedded images, bounds, and the rig for files that carry skins or animation. This pack is the half that knows about the kernel: it fetches through the loader, fits the model to the unit box, decodes embedded textures into the atlas, and registers the meshes.

## When to use it

**Which model pack?** `model-files-3d` (this one, `game.modelFiles`) loads files an artist made. `model-3d` (`game.models`, part of `core-3d`) builds models from a spec of primitives, the low-poly toy look. They work side by side: a `core-3d` game composes this pack as well to load a `.glb`.

Whenever a game wants authored content rather than primitives. Compose it alongside `world-3d` and `render-3d`, then `await game.modelFiles.load(key, url)` once and `game.modelFiles.spawn(key, …)` as many times as you like — the meshes are registered once, so every copy is another instance in the same draw call.

## Requires

A 3D world (`world:3d`), declared in `pack.json`. It fetches through the kernel loader, so the usual retry, progress and abort behaviour applies.

## API

| call | what it does |
|---|---|
| `game.modelFiles.load(key, url)` | fetch and register a `.glb` or `.obj` (the extension decides); resolves to the model. An `.obj` that names a `mtllib` has its `.mtl` fetched from beside it; a missing `.mtl` leaves the model grey rather than failing it, and is fetched once, in the background, so it never turns the loading screen red. Loading a key twice returns the first |
| `game.modelFiles.add(key, buffer)` | the same from a `.glb` buffer you already have |
| `game.modelFiles.addObj(key, objText, mtlText?)` | the same from OBJ text (and its MTL) you already have |
| `game.modelFiles.spawn(key, spec?)` | spawn it: position, `size`, yaw/pitch/roll, `tint` |
| `game.modelFiles.get(key)` / `.keys` | what is loaded |
| `model.parts[i].verts` | that part's interleaved vertices, so a model can feed something that needs GEOMETRY rather than a mesh id — `vector3d.wireframe(part.verts)` is any model as outline edges |
| `parseGlb(buffer)` | the reader on its own, for tooling or a worker |

A spawned model comes back as a handle with `x`, `y`, `z`, `yaw`, `pitch`, `roll`, `size`, `visible` and `kill()`. Its parts are ordinary roster objects that share one origin, because the file's transforms are baked into the vertices — so setting a pose here sets the same pose on each, and a model moves as one thing without needing parenting.

## Options

None at compose time. Every model is **fitted to the unit box** so `size` means the same thing for a model as for a primitive: it is the largest dimension in world units. The fit is around the model's centre, so half of it sits below its own origin — spawn at `y = size / 2` to stand it on the ground. `model.size` reports the file's own dimensions if you want to restore real-world scale.

## Animation

A `.glb` that carries animations plays them straight off the handle:

```ts
const h = game.modelFiles.spawn('robot', { size: 3 });
h.play('Walk', { loop: true, fade: 0.25 });
```

`clips` lists the names in file order, `play` takes a name or an index, `speed` scales playback, `stop` freezes the pose where it is (it does not return to the rest pose), and `time` says how far into the clip it has got, and can be set to scrub. Starting a new clip **crossfades** from the current one over `fade` seconds, which is what makes idle-to-walk read as a transition rather than a snap. `loop: false` plays it once and holds the last frame.

`play(clip, { at })` starts the clip that many seconds in. It is how a crowd stops marching in lockstep: spawn eight of the same model, play the same clip on each at a different `at`, and they read as eight people rather than one copied.

```ts
for (let i = 0; i < 8; i++) game.modelFiles.spawn('walker', { x: i * 2, y: 1, size: 2 }).play('Walk', { loop: true, at: i * 0.17 });
```

### Two kinds, one mixer

A static model is merged to **one mesh per material**, so it costs as many draws as it has materials rather than as many as it has nodes. Animated content is the exception and is **retained per node**: a part is split out when it is skinned, or when its node — or any ancestor of it — is driven by a channel, because a merged mesh has nowhere to put a node's own moving transform.

- **Node animation** is applied as an ordinary transform. Each animated part's world matrix becomes its position, rotation and scale, so a mechanical rig, a swinging door, a vehicle's wheels and most prop animation cost nothing beyond the sampling. The handle's own `x`, `y`, `z`, `yaw`, `pitch`, `roll` and `size` carry those parts with the rest of the model: a node 2 units out from the model's origin stays 2·`size` units out in the direction the model faces, so a turned car keeps its wheels, and setting a pose property moves them at once rather than on the next step.
- **Skinned animation** is CPU-skinned from the joint palette and the mesh re-uploaded in place. The palette is conjugated by the same unit-fit the rest vertices went through, or a skinned part flies off at file scale.

Both come from the same mixer, so a model with one of each stays in step.

### The pure core

`AnimMixer`, `quatSlerp`, `trsToMat4`, `sampleChannel`, `jointPalette`, `decomposeTRS` and `skinInto` are all exported and pure. They are covered by tests, including the ones that are easy to get quietly wrong: slerp taking the short arc (ignore the sign and a limb swings backwards through the body), STEP versus LINEAR interpolation, a one-shot holding its last frame, and a frozen mixer holding its pose rather than resetting.

## Limits

**What it reads.** A `.glb` (one file: the JSON chunk and its BIN chunk) with float, or normalized unsigned 8- and 16-bit, attributes; indexed or not; triangles; node transforms and hierarchies; skins with up to four joints a vertex; animations on translation, rotation and scale, LINEAR or STEP (CUBICSPLINE samples its key values linearly, without the tangents); base colour, metallic/roughness and normal maps on `TEXCOORD_0`, the emissive factor, and `KHR_materials_pbrSpecularGlossiness`. An `.obj` with `v`, `vt`, `vn`, `f` (polygons are fanned to triangles), `usemtl` and an `.mtl` giving `Kd`, `d` and `Tr`; its `map_Kd` textures are not loaded, so an OBJ wears its diffuse colours.

**What it refuses, by name.** Each of these makes `add` and `parseGlb` throw, and `load` reject, with a message that names what it found, rather than reading something quietly wrong:

- an extension the file *requires* (`extensionsRequired`) that the reader does not implement: KTX2 or WebP textures (`KHR_texture_basisu`, `EXT_texture_webp`), quantized attributes (`KHR_mesh_quantization`), `KHR_texture_transform` and the rest. An extension only *used* leaves the file a fallback, and it loads without it;
- a sparse accessor (often how morph targets are stored): export with the targets applied, or without them;
- data outside the `.glb`'s own BIN chunk — a separate `.gltf` with its `.bin`, or a second buffer: pack it as one `.glb`;
- a signed byte or short attribute (what quantized exporters write), and normalized integer rotations in an animation.

**What it ignores.** Morph targets that are not sparse (the base mesh draws), `TEXCOORD_1`, occlusion and emissive maps, cameras, lights and `KHR_materials_*` beyond specular-glossiness: the file loads without them.

**Textures are capped at 512 pixels** on their longer side as they go into the shared atlas, whatever size the file ships: a PBR model brings three or four maps, and a model on screen does not need a page of atlas for each. A model's maps go in together (`assets.addStrips`), on one atlas page, because a draw reads them all from the page it binds; the atlas opens pages as it fills, so a game with many models never runs out of room. A texture that cannot be decoded is a missing texture, not a failed model.

**Compressed files are refused.** A glTF that uses `KHR_draco_mesh_compression` (Draco) or `EXT_meshopt_compression` (meshopt) makes `add` and `parseGlb` throw, and `load` reject, with a message naming the extension and saying this pack does not decode it. It is not read as empty or garbled geometry, and the uncompressed fallback some meshopt files carry is not read either. Export the model without that compression, or decompress it first. An extension named in `extensionsUsed` that nothing in the file carries compresses nothing, and the file loads.

Skinning runs on the CPU and re-uploads the posed mesh each frame. That is correct and it is what you see on screen, but it is the one thing here that does not scale: a crowd of skinned characters wants the same maths moved into the vertex stage, which is the optimisation this leaves on the table.

Materials register base colour, metallic/roughness and normal maps and the emissive factor for `render-3d`. Node animation and CPU skinning play through the handle animation API described above. A model with many materials can cost multiple draw calls. Headless (no image decoder) a model still loads and spawns without decoded textures; a passing replay therefore does not validate its visual assets.
