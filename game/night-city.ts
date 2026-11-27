import { CURB_FITTING, DRAIN_FITTING, DRAIN_SPACING, GARAGE_PROPS, LANTERN_HEIGHT, LANTERNS, MIN_BIN_GAP, MIN_PARK_GAP, parkGap, POST, POST_SPACING, PRODUCT_GLOW, PRODUCT_LIGHTS, serviceGap, streetGap, streetGroup, type Glow, type PropLight } from './night-props.js';
import { facadeLights, garageBays } from './building-lights.js';
import { buildingSize, frontage, tower, type Building } from './buildings.js';
import { game } from './engine.js';
import { DOOR_LIGHTS, NAMES, NEON, NIGHT_HAZE, signFrames, streetFrames } from './night-art.js';
import {
    CAMERA_LOOK_AHEAD,
    FRAGMENT_LENGTH,
    NIGHT_PROFILE,
    routeHash,
    sampleSection,
    type NightRoute,
    type RoadSection,
} from './route.js';

const WALK = 2.8;
const CURB = 0.15;
const STEP = 4;
const TILE = FRAGMENT_LENGTH;
const WINDOW_SPILL_ROAD_WIDTH = 4.2;
const WINDOW_SPILL_LAYER_HEIGHT = 0.012;
const PROP_SPILL_LAYER_HEIGHT = 0.024;
const SIGN_LOD_DISTANCES = [47, 88, 149];
const SIGN_COUNTS = { retail: 3, residential: 1, industrial: 2 };
const LOT_GAP = 1.2;
const MIN_LOT_SCALE = 0.75;
const GAP_EDGE_MARGIN = 0.25;
const PARK_LANTERN_SETBACK = 2.1;
const GARAGE_THRESHOLD = 4.54;
const GARAGE_PROP_CLEARANCE = 0.06;
const GARAGE_FLOOR = 0.18;
const GARAGE_PROP_YAW = [Math.PI / 4, Math.PI / 2];
// Alleys are closed off and dressed with garlands in depth bands of their own.
const GAP_GARLANDS = [
    { depth: 2.1, height: LANTERN_HEIGHT },
    { depth: 5.6, height: 8 },
];
const GAP_FENCE_DEPTHS = [-3.1, -8.2];
const GAP_FENCE_HEIGHT = 1.5;
const GAP_FENCE_SLAT = 0.42;
const GAP_FENCE_TINT = '#5b6784';
const GAP_FENCE_EMISSIVE = 0.18;
const GAP_GROUND_Y = -0.02;
// One knob for every lamp a prop carries: 0 switches them all off (an A/B check).
const PROP_LIGHT_GAIN = 1;
// How many local lights reach the renderer per frame, nearest first.
const LIGHT_BUDGET = 160;
const NIGHT_ROWS = [{ offset: 0, scale: 1 }, { offset: 23, scale: 1 }, { offset: 44, scale: 1.25 }];
const BACKGROUND_BUILDING_SIDE = 1;
const ROAD_TINT = { retail: '#35363d', residential: '#31343d', industrial: '#30343a' };
const FACADE_FILL = 0.42;
const MARQUEE_TINT = '#bfc4d1';
const NAMEPLATE_TINT = '#858b99';
const MARQUEE_LIGHT = { radius: 10, intensity: 23 };
const NAMEPLATE_LIGHT = { radius: 6.5, intensity: 12 };
const ROAD_LOD_DISTANCES = [36, 76];
const PAVING_LOD_DISTANCES = [33, 67];
const BRIDGE_LOD_DISTANCES = [62, 120];
// The road receives local lights and sky fill. Emissive preserves its base brightness.
type Surface = { lit?: boolean; emissive?: number; rough?: number };
const ROAD_SURFACE: Surface = { lit: true, emissive: 0.52, rough: 0.64 };
const PAVING_SURFACE: Surface = { lit: true, rough: 0.92 };
const CURB_SURFACE: Surface = { lit: true, emissive: 0.24, rough: 0.85 };
type Fragment = {
    section: RoadSection;
    start: number;
    end: number;
    tile: number;
    slot: number;
    pieces: Piece[];
};
type Parts = ReturnType<typeof game.modelFiles.spawn>['parts'];
type InstancePool = ReturnType<typeof makeInstancePool>;
// A prop's lamp, carried by the piece: its spot in route space, then moved with the
// piece each frame the way its parts are.
type PlacedLight = {
    obj: ReturnType<typeof game.lights.add>;
    x: number;
    z: number;
    y: number;
    yaw: number;
};
type Piece = {
    parts: Parts;
    x: number;
    z: number;
    yaw: number;
    textures?: number[];
    thresholds?: number[];
    light?: ReturnType<typeof game.lights.add>;
    lights?: PlacedLight[];
    key: string;
    fresh: boolean;
};

type Vertex = [number, number, number, number, number, number, number, number];
const DEGREES = Math.PI / 180;
function mod(n: number, m: number) {
    return ((n % m) + m) % m;
}
function makeInstancePool() {
    const available = new Map<string, Piece[]>();
    let allocated = 0;
    function take(key: string, create: (id: string) => Parts): Piece {
        const cached = available.get(key)?.pop();
        if (cached) return cached;
        const parts = create('night-' + key + '-' + allocated++);
        return { key, parts, x: 0, z: 0, yaw: 0, fresh: true };
    }
    function release(piece: Piece): void {
        for (const part of piece.parts) part.visible = false;
        if (piece.light) piece.light.light3d.on = 0;
        for (const light of piece.lights ?? []) light.obj.light3d.on = 0;
        piece.textures = undefined;
        piece.thresholds = undefined;
        let bank = available.get(piece.key);
        if (!bank) available.set(piece.key, (bank = []));
        bank.push(piece);
    }
    return {
        take,
        release,
        get allocated() {
            return allocated;
        },
    };
}

function defineCladBox(name: string, face: 'walls' | 'front' | 'sides', flatV: number, bottomV = flatV) {
    const primitive = game.world3d.meshVerts(game.world3d.mesh('box'));
    if (!primitive) throw new Error('The box mesh is missing');
    const box = primitive.slice();
    for (let vertex = 0; vertex < box.length; vertex += 8) {
        const nx = box[vertex + 3],
            ny = box[vertex + 4],
            nz = box[vertex + 5];
        const textured = face === 'walls' ? ny === 0 : face === 'front' ? nz !== 0 : nx !== 0;
        if (textured) continue;
        box[vertex + 6] = 0.5;
        box[vertex + 7] = ny < 0 ? bottomV : flatV;
    }
    game.world3d.defineMesh(name, box);
}
function defineSignBox(): void {
    const source = game.world3d.meshVerts(game.world3d.mesh('box'));
    if (!source) throw new Error('The sign mesh is missing');
    const verts = source.slice();
    for (let i = 0; i < verts.length; i += 8) {
        const x = verts[i], z = verts[i + 2], nx = verts[i + 3], nz = verts[i + 5];
        // Box UVs project the same way on opposing faces. Orient each face for reading from outside.
        verts[i + 6] = 0.5 + nz * x - nx * z;
    }
    game.world3d.defineMesh('night-sign-box', verts);
}

// A slatted fence panel that closes an alley off, built in metres: it spans the
// gap between the two buildings, so slats keep their width at every gap width.
function defineGapFence(name: string, width: number, height: number): void {
    const source = game.world3d.meshVerts(game.world3d.mesh('box'));
    if (!source) throw new Error('The box mesh is missing');
    const box: Float32Array = source;
    const verts: number[] = [];
    function part(cx: number, cy: number, cz: number, w: number, h: number, d: number): void {
        for (let i = 0; i < box.length; i += 8)
            verts.push(
                box[i] * w + cx, box[i + 1] * h + cy, box[i + 2] * d + cz,
                box[i + 3], box[i + 4], box[i + 5], 0.5, 0.5,
            );
    }
    const post = 0.1;
    const top = height + 0.08;
    part(-width / 2 + post, top / 2, 0, post * 2, top, post * 2);
    part(width / 2 - post, top / 2, 0, post * 2, top, post * 2);
    part(0, height - 0.09, 0, width - post * 2, 0.08, 0.06);
    part(0, height * 0.42, 0, width - post * 2, 0.05, 0.05);
    const slats = Math.max(2, Math.round((width - 0.4) / GAP_FENCE_SLAT));
    const slatHeight = height - 0.28;
    for (let i = 0; i < slats; i++) {
        const x = -width / 2 + 0.2 + ((width - 0.4) * (i + 0.5)) / slats;
        part(x, 0.1 + slatHeight / 2, 0, 0.07, slatHeight, 0.04);
    }
    game.world3d.defineMesh(name, new Float32Array(verts));
}

function ribbon(fragment: Fragment, origin: ReturnType<typeof sampleSection>): void {
    const { section, start, end, tile, slot } = fragment;
    const deck: number[] = [],
        paving: number[] = [],
        lips: number[] = [],
        ground: number[] = [];
    const count = Math.ceil((end - start) / STEP);
    const samples = Array.from({ length: count + 1 }, (_, i) => {
        const distance = i === count ? end : start + ((end - start) * i) / count;
        return { ...sampleSection(section, distance), v: (distance - tile * TILE) / TILE };
    });
    function strip(out: number[], low: number, y0: number, high: number, y1: number, nx: number, ny: number) {
        function vertex(i: number, curbOffset: number, y: number, u: number): Vertex {
            const p = samples[i];
            const offset = (Math.sign(curbOffset) * p.width) / 2 + curbOffset - Math.sign(curbOffset);
            return [
                p.x - origin.x + offset * p.cos,
                y,
                p.z - origin.z + offset * p.sin,
                nx * p.cos,
                ny,
                nx * p.sin,
                u,
                p.v,
            ];
        }
        for (let i = 0; i < samples.length - 1; i++) {
            const a = vertex(i, low, y0, 0),
                b = vertex(i, high, y1, 1),
                c = vertex(i + 1, high, y1, 1),
                d = vertex(i + 1, low, y0, 0);
            out.push(...a, ...b, ...c, ...a, ...c, ...d);
        }
    }
    // ±1 identifies the road edge. Extra metres beyond it follow the same width profile.
    strip(deck, -1, 0, 1, 0, 0, 1);
    strip(paving, -1 - WALK, CURB, -1, CURB, 0, 1);
    strip(paving, 1, CURB, 1 + WALK, CURB, 0, 1);
    strip(lips, -1, CURB, -1, 0, 1, 0);
    strip(lips, 1, 0, 1, CURB, -1, 0);
    strip(ground, -1 - 62, -0.02, -1, -0.02, 0, 1);
    strip(ground, 1, -0.02, 1 + 62, -0.02, 0, 1);
    for (const [name, data] of [
        ['deck', deck],
        ['paving', paving],
        ['curb', lips],
        ['ground', ground],
    ] as const)
        game.world3d.defineMesh('night-' + name + slot, new Float32Array(data));
}

function defineWindowSpill(
    fragment: Fragment,
    side: number,
    centre: number,
    origin: ReturnType<typeof sampleSection>,
): string {
    const { section, start, end, slot } = fragment;
    const intervals = Math.ceil((end - start) / STEP);
    const samples = Array.from({ length: intervals + 1 }, (_, i) => {
        const distance = i === intervals ? end : start + ((end - start) * i) / intervals;
        const v =
            distance < centre
                ? (distance - start) / (2 * (centre - start))
                : 0.5 + (distance - centre) / (2 * (end - centre));
        return { ...sampleSection(section, distance), v };
    });
    const width = WALK + WINDOW_SPILL_ROAD_WIDTH;
    function vertex(i: number, outward: number, y: number): Vertex {
        const p = samples[i];
        const across = side * (p.width / 2 + outward);
        return [
            p.x - origin.x + across * p.cos,
            y,
            p.z - origin.z + across * p.sin,
            0,
            1,
            0,
            (outward + WINDOW_SPILL_ROAD_WIDTH) / width,
            p.v,
        ];
    }
    const verts: number[] = [];
    for (const [inner, outer, y] of [
        [-WINDOW_SPILL_ROAD_WIDTH, 0, WINDOW_SPILL_LAYER_HEIGHT],
        [0, WALK, CURB + WINDOW_SPILL_LAYER_HEIGHT],
    ] as const) {
        for (let i = 0; i < intervals; i++) {
            const a = vertex(i, inner, y),
                b = vertex(i, outer, y);
            const c = vertex(i + 1, outer, y),
                d = vertex(i + 1, inner, y);
            if (side > 0) verts.push(...a, ...b, ...c, ...a, ...c, ...d);
            else verts.push(...b, ...a, ...d, ...b, ...d, ...c);
        }
    }
    const mesh = 'night-window-spill-' + slot + '-' + side;
    game.world3d.defineMesh(mesh, new Float32Array(verts));
    return mesh;
}

function spawnNightBuilding(key: Building, id: string): Parts {
    const model = game.modelFiles.get(key)!;
    return model.parts.map((part, index) => {
        const original = game.world3d.materialAt(part.material)!;
        const material = game.world3d.material({
            ...original,
            name: 'night-facade/' + original.name,
            // Keep dark enamel textured between pools of neon light.
            emissive: original.emissive + FACADE_FILL,
        });
        const obj = game.spawn({
            id: model.parts.length === 1 ? id : id + '#' + index,
            tags: ['building'],
            mesh: part.mesh,
            material,
            color: part.color,
            alpha: part.alpha,
        });
        obj.frame = part.frame;
        return obj;
    });
}

function frontageLot(section: RoadSection, start: number, end: number, side: number) {
    const centre = (start + end) / 2;
    const origin = sampleSection(section, centre);
    const tileSeed = routeHash(section.environment.seed ^ Math.imul(Math.floor(start / TILE), 0x1b873593));
    const seed = routeHash(tileSeed ^ Math.imul(side, 0x27d4eb2d));
    const key = frontage(section.environment.district, seed);
    const size = buildingSize(key);
    const innerEdge = origin.width / 2 + WALK + size.z;
    const roadToLot = 1 - innerEdge / NIGHT_PROFILE.radius[0];
    const scale = Math.min(1, ((end - start) * roadToLot - LOT_GAP) / size.x);
    const halfWidth = scale >= MIN_LOT_SCALE ? size.x * scale / (2 * roadToLot) : 0;
    return { centre, origin, seed, key, scale, halfWidth, wallHalfWidth: size.x * scale / 2 };
}

function dress(fragment: Fragment, pool: InstancePool, route: NightRoute): void {
    const { section, slot, tile, start, end } = fragment;
    const length = end - start;
    const origin = sampleSection(section, (start + end) / 2);
    ribbon(fragment, origin);
    function surface(name: string, color: string, texture?: string, thresholds?: number[], bridge = false,
        surface3d: Surface = {}) {
        const mesh = bridge ? 'night-crossing-shell' : 'night-' + name + slot;
        const { lit = false, emissive = 0, rough = 0.92 } = surface3d;
        // `unlit` and the material are fixed at spawn, so each surface keeps its own.
        const piece = pool.take(mesh, id => [game.spawn({ id, mesh, unlit: !lit, emissive, rough })]);
        piece.x = origin.x;
        piece.z = origin.z;
        piece.yaw = bridge ? origin.heading : 0;
        piece.fresh = true;
        piece.textures = texture ? streetFrames.get(texture) : undefined;
        piece.thresholds = thresholds;
        const obj = piece.parts[0];
        obj.visible = true;
        obj.tint = color;
        obj.frame = piece.textures?.[0] ?? game.assets.frame('white').index;
        if (bridge) {
            obj.y = 8.6;
            obj.sx = origin.width + 11;
            obj.sy = 1.6;
            obj.sz = 1.8;
        }
        fragment.pieces.push(piece);
    }
    const tileSeed = routeHash(section.environment.seed ^ Math.imul(tile, 0x1b873593));
    surface('deck', ROAD_TINT[section.road.surface], 'night-road', ROAD_LOD_DISTANCES, false, ROAD_SURFACE);
    surface('paving', '#c6c9d1', 'night-paving', PAVING_LOD_DISTANCES, false, PAVING_SURFACE);
    surface('curb', '#05070b', undefined, undefined, false, CURB_SURFACE);
    surface('ground', '#020305');
    function modelAt(model: string, x: number, z: number, yaw: number, floor: number,
        { width, centreY, garage = false, lights, glow }:
            { width?: number; centreY?: number; garage?: boolean; lights?: PropLight[]; glow?: Glow[] } = {}) {
        const definition = game.modelFiles.get(model)!;
        const size = definition.size;
        const span = Math.max(size.x, size.y, size.z);
        // The key carries the lamps and the burning parts, so a lit prop never
        // reuses a dark piece.
        const key = (garage ? 'garage-' : '') + model +
            (lights?.length ? '|' + lights.map(light => light.color + ':' + light.radius).join(',') : '') +
            (glow?.length ? '|' + glow.map(part => part.part + ':' + part.color).join(',') : '');
        const item = pool.take(key, id => game.modelFiles.spawn(model, {
            id, size: span, tags: garage ? ['street-prop', 'garage-prop'] : ['street-prop'],
        }).parts);
        Object.assign(item, { x, z, yaw, fresh: true });
        const centre = centreY ?? floor + size.y / 2;
        for (const [index, part] of item.parts.entries()) {
            part.y = centre;
            part.sx = width === undefined ? span : (span * width) / size.x;
            part.visible = true;
            if (!glow?.length) continue;
            // A handle wears the model part of the same index; its material name
            // says which surface burns, and the tint gives that burn its colour.
            const name = (game.world3d.materialAt(definition.parts[index].material)?.name ?? '').toLowerCase();
            const burn = glow.find(piece => name.includes(piece.part));
            if (burn) part.tint = burn.color;
        }
        // Allocate lamps once and update their route-space pose on each placement.
        if (!item.lights)
            item.lights = (lights ?? []).map(light => ({
                obj: game.lights.add({
                    id: 'night-' + model + '-lamp',
                    radius: light.radius,
                    color: light.color,
                    intensity: light.intensity * PROP_LIGHT_GAIN,
                    cone: light.cone,
                    innerCone: light.innerCone,
                    pitch: light.pitch,
                }),
                x: 0,
                z: 0,
                y: 0,
                yaw: 0,
            }));
        const cos = Math.cos(yaw), sin = Math.sin(yaw);
        for (const [index, placed] of item.lights.entries()) {
            const light = lights?.[index];
            if (!light) {
                placed.obj.light3d.on = 0;
                continue;
            }
            const [ox, oy, oz] = light.offset;
            placed.x = x + ox * cos - oz * sin;
            placed.z = z + ox * sin + oz * cos;
            placed.y = centre + oy;
            placed.yaw = yaw + (light.dir ?? 0) * DEGREES;
            placed.obj.light3d.on = 1;
        }
        fragment.pieces.push(item);
    }
    function stretchLanterns(from: { x: number; z: number }, to: { x: number; z: number },
        height = LANTERN_HEIGHT) {
        const dx = to.x - from.x, dz = to.z - from.z;
        const span = Math.hypot(dx, dz);
        const count = Math.max(1, Math.round(span / game.modelFiles.get(LANTERNS)!.size.x));
        const yaw = Math.atan2(dz, dx);
        for (let i = 0; i < count; i++) {
            const t = (i + 0.5) / count;
            modelAt(LANTERNS, from.x + t * dx, from.z + t * dz, yaw, 0,
                { width: span / count, centreY: height });
        }
    }
    function sidewalk(distance: number, side: number, depth: number) {
        const at = distance < end ? sampleSection(section, distance) : route.sampleRoad(distance);
        const across = side * (at.width / 2 + WALK - depth);
        return { x: at.x + at.cos * across, z: at.z + at.sin * across, heading: at.heading };
    }
    function parkAnchor(lot: ReturnType<typeof frontageLot>, side: number, direction: number,
        setback = PARK_LANTERN_SETBACK) {
        const at = lot.origin;
        const across = side * (at.width / 2 + WALK + setback);
        const along = direction * lot.wallHalfWidth;
        return { x: at.x + at.cos * across + at.sin * along, z: at.z + at.sin * across - at.cos * along };
    }
    function fenceBand(index: number, distance: number, depth: number, span: number, side: number) {
        const mesh = 'gap-fence-' + slot + '-' + side + '-' + index;
        defineGapFence(mesh, span, GAP_FENCE_HEIGHT);
        const at = sidewalk(distance, side, depth);
        const piece = pool.take(mesh, id => [game.spawn({
            id, mesh, rough: 0.88, emissive: GAP_FENCE_EMISSIVE, tags: ['street-prop', 'gap-fence'],
        })]);
        Object.assign(piece, { x: at.x, z: at.z, yaw: at.heading + Math.PI / 2, fresh: true });
        const obj = piece.parts[0];
        obj.visible = true;
        obj.y = GAP_GROUND_Y;
        obj.tint = GAP_FENCE_TINT;
        fragment.pieces.push(piece);
    }
    function propAt(prop: ReturnType<typeof streetGroup>[number], distance: number, side: number) {
        const at = sidewalk(distance - side * (prop.along ?? 0), side, prop.depth);
        const yaw = at.heading + side * Math.PI / 2 + (prop.turn ?? 0);
        const floor = CURB + (prop.base ?? 0);
        modelAt(prop.model, at.x, at.z, yaw, floor, { width: prop.width, lights: prop.lights, glow: prop.glow });
        if (!prop.spill || PROP_LIGHT_GAIN <= 0) return;
        const { color, width, length, forward = 0, alpha } = prop.spill;
        const spill = pool.take('prop-light-spill', id => [game.spawn({
            id, mesh: 'plane', texture: 'night-prop-spill', unlit: true, alpha,
        })]);
        Object.assign(spill, {
            x: at.x - forward * Math.sin(yaw),
            z: at.z + forward * Math.cos(yaw),
            yaw,
            fresh: true,
        });
        const patch = spill.parts[0];
        patch.y = floor + PROP_SPILL_LAYER_HEIGHT;
        patch.sx = width;
        patch.sz = length;
        patch.tint = color;
        patch.alpha = Math.min(1, alpha * PROP_LIGHT_GAIN);
        patch.visible = true;
        fragment.pieces.push(spill);
    }
    const nextSection = route.sectionFor(end);
    const nextEnd = Math.min(nextSection.end, (Math.floor(end / TILE) + 1) * TILE);
    let frontages = 0;
    for (const side of [-1, 1]) {
        const lot = frontageLot(section, start, end, side);
        const { seed } = lot;
        let lotWidth = 0;
        let garage = false;
        for (const [row, layout] of NIGHT_ROWS.entries()) {
            if (row !== 0 && side !== BACKGROUND_BUILDING_SIDE) continue;
            const key = row === 0 ? lot.key : tower(routeHash(seed + row));
            const size = buildingSize(key);
            const setback = origin.width / 2 + WALK + layout.offset;
            // On the inside of a bend, successive lots are closer than their road centres.
            const innerEdge = setback + size.z * layout.scale;
            const room = length * (1 - innerEdge / NIGHT_PROFILE.radius[0]) - LOT_GAP;
            const scale = row === 0 ? lot.scale : Math.min(layout.scale, room / size.x);
            if (scale < MIN_LOT_SCALE) continue;
            const offset = side * (setback + size.z * scale / 2);
            const piece = pool.take(key, id => spawnNightBuilding(key, id));
            piece.x = origin.x + offset * origin.cos;
            piece.z = origin.z + offset * origin.sin;
            piece.yaw = origin.heading + side * Math.PI / 2;
            piece.fresh = true;
            for (const part of piece.parts) {
                part.visible = true;
                part.y = size.y * scale / 2 - 0.02;
                part.sx = part.sy = part.sz = Math.max(size.x, size.y, size.z) * scale;
            }
            fragment.pieces.push(piece);
            const lights = facadeLights(key);
            const fit = game.modelFiles.get(key)!.fit;
            const facadeX = Math.cos(piece.yaw), facadeZ = Math.sin(piece.yaw);
            function position(x: number, z: number) {
                return {
                    x: piece.x + (x * facadeX - z * facadeZ) * scale,
                    z: piece.z + (x * facadeZ + z * facadeX) * scale,
                };
            }
            function detail(mesh: string, name: string, x: number, y: number, z: number,
                w: number, h: number, d: number, color: string, frames?: number[], thresholds?: number[], yaw = 0) {
                const item = pool.take(name + '-' + mesh, id => [game.spawn({ id, mesh, unlit: true })]);
                Object.assign(item, position(x, z), { yaw: piece.yaw + yaw, textures: frames, thresholds, fresh: true });
                const obj = item.parts[0];
                obj.visible = true;
                obj.y = y * scale - 0.02;
                obj.sx = w * scale;
                obj.sy = h * scale;
                obj.sz = d * scale;
                obj.tint = color;
                obj.frame = frames?.[0] ?? game.assets.frame('white').index;
                fragment.pieces.push(item);
                return item;
            }
            const windowPattern = lights.windows[(seed >>> 16) % lights.windows.length];
            const windowMesh = windowPattern[routeHash(seed + row * 47) % windowPattern.length];
            detail(windowMesh, 'windows', -fit.cx, 0, -fit.cz, 1, 1, 1,
                '#ffffff', [game.assets.frame('night-window-glow').index]);
            if (row !== 0) continue;
            frontages++;
            lotWidth = size.x * scale;
            garage = key.startsWith('depot_');
            if (garage) {
                const bays = garageBays(key);
                // Neighbouring open bays take different props, so a garage reads as varied.
                const firstVariant = routeHash(seed) % GARAGE_PROPS.length;
                for (const [index, [x, , , bayWidth]] of bays.entries()) {
                    const variant = (firstVariant + index) % GARAGE_PROPS.length;
                    const model = GARAGE_PROPS[variant];
                    const dimensions = game.modelFiles.get(model)!.size;
                    const turn = GARAGE_PROP_YAW[variant];
                    const halfWidth = (dimensions.x * Math.cos(turn) + dimensions.z * Math.sin(turn)) / 2;
                    const halfDepth = (dimensions.x * Math.sin(turn) + dimensions.z * Math.cos(turn)) / 2;
                    const offset = bayWidth / 2 - (halfWidth + GARAGE_PROP_CLEARANCE) / scale;
                    const depth = GARAGE_THRESHOLD - (halfDepth + GARAGE_PROP_CLEARANCE) / scale;
                    const at = position(x - fit.cx - side * offset, depth - fit.cz);
                    // The products machine lights its cabinet white; the scooter carries nothing.
                    modelAt(model, at.x, at.z, piece.yaw - side * turn, GARAGE_FLOOR * scale - 0.02, {
                        garage: true,
                        lights: model === 'vending-machine' ? PRODUCT_LIGHTS : undefined,
                        glow: model === 'vending-machine' ? PRODUCT_GLOW : undefined,
                    });
                }
            }
            const shopColor = DOOR_LIGHTS[routeHash(seed ^ 0x85ebca6b) % DOOR_LIGHTS.length];
            if (lights.entry) {
                detail(lights.entry, 'storefront', -fit.cx, 0, -fit.cz, 1, 1, 1,
                    shopColor, [game.assets.frame('night-store-glow').index]);
                const mesh = defineWindowSpill(fragment, side, (start + end) / 2, origin);
                const spill = pool.take('window-spill-' + slot + '-' + side, id => [game.spawn({
                    id, mesh, unlit: true, alpha: 0.22,
                })]);
                Object.assign(spill, { x: origin.x, z: origin.z, yaw: 0, fresh: true });
                const obj = spill.parts[0];
                obj.visible = true;
                obj.tint = shopColor;
                obj.frame = game.assets.frame('night-window-spill').index;
                fragment.pieces.push(spill);
            }
            const sign = (routeHash(tileSeed ^ 0xb7e15162) % NAMES.length + (side > 0 ? 1 : 0)) % NAMES.length;
            const front = size.z / 2;
            const nameFrames = streetFrames.get('night-shop-name-' + sign);
            function lightSign(item: Piece, color: string, settings: { radius: number; intensity: number }) {
                const face = item.parts[0];
                const lamp = item.light ??= game.lights.add({ id: face.id + '-neon', follow: face, ...settings });
                lamp.light3d.color = color;
                lamp.light3d.on = 1;
            }
            const nameplate = detail('quad', 'shop-name', 0, key === 'spire' ? 3.1 : 3.85, front + 0.04,
                Math.min(size.x * 0.39, 5.1), 0.54, 1, NAMEPLATE_TINT,
                nameFrames, PAVING_LOD_DISTANCES);
            lightSign(nameplate, NEON[sign], NAMEPLATE_LIGHT);
            if (section.environment.district === 'retail' || seed % 4 === 0) {
                const count = 1 + seed % SIGN_COUNTS[section.environment.district];
                for (let i = 0; i < count; i++) {
                    const x = (i - (count - 1) / 2) * size.x * 0.28;
                    const style = (sign + i) % NAMES.length;
                    const marquee = detail('night-sign-box', 'marquee', x, 5.9 + (seed >>> 14) % 3, front + 0.58,
                        1.24, 4.4 - i * 0.5, 0.2, MARQUEE_TINT, signFrames[style],
                        SIGN_LOD_DISTANCES, side * Math.PI / 2);
                    lightSign(marquee, NEON[style], MARQUEE_LIGHT);
                }
            }
        }
        for (const prop of streetGroup(section.environment.district, seed, garage, lotWidth))
            propAt(prop, lot.centre, side);
        // Distances belong to the route, with each fragment owning [start, end).
        for (let index = Math.ceil(start / POST_SPACING - 0.5); (index + 0.5) * POST_SPACING < end; index++) {
            const distance = (index + 0.5) * POST_SPACING;
            propAt(POST, distance, side);
        }
        // Lit curb strips share the post spacing, offset so the two alternate.
        for (let index = Math.ceil(start / POST_SPACING); index * POST_SPACING < end; index++)
            propAt(CURB_FITTING, index * POST_SPACING, side);
        // Drains carry no light, so they keep a denser cadence of their own.
        for (let index = Math.ceil(start / DRAIN_SPACING); index * DRAIN_SPACING < end; index++)
            propAt(DRAIN_FITTING, index * DRAIN_SPACING, side);
        const next = frontageLot(nextSection, end, nextEnd, side);
        // Own the open space after this frontage up to the next one, even across section seams.
        const gapStart = lot.halfWidth ? lot.centre + lot.halfWidth : start;
        const gapEnd = next.halfWidth ? next.centre - next.halfWidth : end;
        const width = gapEnd - gapStart - 2 * GAP_EDGE_MARGIN;
        const industrial = section.environment.district === 'industrial' || garage ||
            (next.halfWidth > 0 && next.key.startsWith('depot_'));
        const gapCentre = (gapStart + gapEnd) / 2;
        const park = !industrial && width >= MIN_PARK_GAP;
        for (const prop of streetGap(industrial, seed, width)) propAt(prop, gapCentre, side);
        if (park) {
            for (const prop of parkGap(seed, width)) propAt(prop, gapCentre, side);
            // Garlands hang between the two buildings, as deep as their side walls reach.
            if (lot.halfWidth > 0 && next.halfWidth > 0) {
                const buildingDepth = buildingSize(lot.key).z * lot.scale;
                for (const garland of GAP_GARLANDS) {
                    if (garland.depth > buildingDepth - 0.4) continue;
                    stretchLanterns(parkAnchor(lot, side, 1, garland.depth),
                        parkAnchor(next, side, -1, garland.depth), garland.height);
                }
            }
        } else if (industrial && width >= MIN_BIN_GAP) {
            for (const prop of serviceGap(seed, width)) propAt(prop, gapCentre, side);
            for (const [index, depth] of GAP_FENCE_DEPTHS.entries())
                fenceBand(index, gapCentre, depth, gapEnd - gapStart + 0.3, side);
        }
    }
    // Join short strands at their fittings so the lanterns retain their proportions across a wide road.
    if (frontages === 2 && section.environment.district === 'retail' && length >= 18 &&
        mod(tile, 9) !== 4 && routeHash(tileSeed + 37) % 3 !== 0) {
        const centre = (start + end) / 2;
        stretchLanterns(sidewalk(centre, -1, 0), sidewalk(centre, 1, 0));
    }
    if (frontages === 2 && length >= 18 && mod(tile, 9) === 4)
        surface('skybridge', '#101218', 'night-crossing', BRIDGE_LOD_DISTANCES, true);
}

export function buildNightCity(route: NightRoute) {
    // Sample opaque paint for caps and undersides, and reserve the patterned UVs for vertical panels.
    defineCladBox('night-crossing-shell', 'front', 2 / 64, 53 / 64);
    defineSignBox();
    // Street lamps double the number of local lights: keep headroom for the shop neon too.
    game.lights.max = LIGHT_BUDGET;
    game.background.picture('night-sky', 'stretch');
    game.render3d.lighting.preset('night');
    game.render3d.lighting.set({
        // A low angled fill separates the side walls and rooflines from the dark sky.
        sun: { x: 0.55, y: -0.75, z: -0.4 },
        sunColor: '#a4b9ee',
        sunIntensity: 0.12,
        skyColor: '#bbc8e8',
        groundColor: '#8790a9',
        ambient: 0.32,
        environment: 0.09,
        fogColor: NIGHT_HAZE,
        fogStart: 150,
        fogEnd: NIGHT_PROFILE.fogEnd,
        shadows: false,
    });
    const pool = makeInstancePool();
    const fragments: Fragment[] = [];
    const freeSlots: number[] = [];
    let slots = 0;
    let loaded = 0;
    let retired = 0;
    let previousDistance = -Infinity;

    function retire(fragment: Fragment): void {
        for (const piece of fragment.pieces) pool.release(piece);
        freeSlots.push(fragment.slot);
        retired++;
    }

    return (distance: number) => {
        const from = Math.floor((distance - NIGHT_PROFILE.behind) / TILE) * TILE;
        const goal = distance + NIGHT_PROFILE.forward;
        route.cover(from, goal + TILE);
        const here = route.sampleRoad(distance);
        const abrupt = Math.abs(distance - previousDistance) > TILE;
        previousDistance = distance;
        if (abrupt) {
            for (const fragment of fragments) retire(fragment);
            fragments.length = 0;
        }
        const eye = game.world3d.camera.eye;
        const look = route.sampleRoad(distance + CAMERA_LOOK_AHEAD);
        const cosYaw = Math.cos(look.heading - here.heading);
        const sinYaw = Math.sin(look.heading - here.heading);
        for (let i = fragments.length - 1; i >= 0; i--) {
            const fragment = fragments[i];
            if (fragment.end > from) continue;
            const mid = sampleSection(fragment.section, (fragment.start + fragment.end) / 2);
            const dx = mid.x - here.x,
                dz = mid.z - here.z;
            const localX = dx * here.cos + dz * here.sin - eye.x;
            const localZ = -dx * here.sin + dz * here.cos - eye.z;
            // When a bend brings an older building back into view, wait for fog or
            // for the entire cross-section to pass behind the camera plane.
            const extent = NIGHT_PROFILE.corridorHalfWidth + TILE;
            const depth = localX * sinYaw - localZ * cosYaw;
            if (depth > -extent && Math.hypot(localX, localZ) < NIGHT_PROFILE.fogEnd + extent) continue;
            retire(fragment);
            fragments.splice(i, 1);
        }
        let cursor = fragments.at(-1)?.end ?? from;
        while (cursor < goal) {
            const section = route.sectionFor(cursor);
            const tile = Math.floor(cursor / TILE);
            const end = Math.min(section.end, (tile + 1) * TILE);
            const fragment = {
                section,
                start: cursor,
                end,
                tile,
                slot: freeSlots.pop() ?? slots++,
                pieces: [],
            };
            // Publish each fragment only after its buildings, light panels and reflections are ready.
            dress(fragment, pool, route);
            fragments.push(fragment);
            loaded++;
            cursor = end;
            if (!abrupt) break;
        }

        let objects = 0;
        const sections = new Set<number>();
        for (const fragment of fragments) {
            sections.add(fragment.section.id);
            for (const piece of fragment.pieces) {
                const dx = piece.x - here.x,
                    dz = piece.z - here.z;
                for (const obj of piece.parts) {
                    obj.x = dx * here.cos + dz * here.sin;
                    obj.z = -dx * here.sin + dz * here.cos;
                    obj.rot = piece.yaw - here.heading;
                    if (piece.textures && piece.thresholds) {
                        const range = Math.hypot(obj.x - eye.x, obj.y - eye.y, obj.z - eye.z);
                        let level = 0;
                        while (level < piece.thresholds.length && range >= piece.thresholds[level]) level++;
                        obj.frame = piece.textures[level];
                    }
                    if (piece.fresh) obj.snap();
                    objects++;
                }
                for (const light of piece.lights ?? []) {
                    const lx = light.x - here.x, lz = light.z - here.z;
                    light.obj.x = lx * here.cos + lz * here.sin;
                    light.obj.z = -lx * here.sin + lz * here.cos;
                    light.obj.y = light.y;
                    // Use the same route-to-scene rotation for the spot's direction as for the prop.
                    light.obj.light3d.dir = light.yaw - here.heading;
                    if (piece.fresh) light.obj.snap();
                }
                piece.fresh = false;
            }
        }
        return {
            sections: sections.size,
            fragments: fragments.length,
            objects,
            allocated: pool.allocated,
            meshSlots: slots,
            preparedThrough: cursor,
            loaded,
            retired,
        };
    };
}
