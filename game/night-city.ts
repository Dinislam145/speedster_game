import { facadeLights } from './building-lights.js';
import { buildingSize, frontage, spawnBuilding, tower } from './buildings.js';
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
const RESERVE = 2 * TILE;
const WINDOW_SPILL_ROAD_WIDTH = 4.2;
const WINDOW_SPILL_LAYER_HEIGHT = 0.012;
const SIGN_LOD_DISTANCES = [47, 88, 149];
const SIGN_COUNTS = { retail: 3, residential: 1, industrial: 2 };
const LOT_GAP = 1.2;
const MIN_LOT_SCALE = 0.75;
const NIGHT_ROWS = [{ offset: 0, scale: 1 }, { offset: 23, scale: 1 }, { offset: 44, scale: 1.25 }];
const ROAD_TINT = { retail: '#35363d', residential: '#31343d', industrial: '#30343a' };
const MARQUEE_TINT = '#bfc4d1';
const NAMEPLATE_TINT = '#858b99';
const MARQUEE_LIGHT = { radius: 6, intensity: 16 };
const NAMEPLATE_LIGHT = { radius: 3.8, intensity: 7 };
const ROAD_LOD_DISTANCES = [36, 76];
const PAVING_LOD_DISTANCES = [33, 67];
const BRIDGE_LOD_DISTANCES = [62, 120];
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
type Piece = {
    parts: Parts;
    x: number;
    z: number;
    yaw: number;
    textures?: number[];
    thresholds?: number[];
    light?: ReturnType<typeof game.lights.add>;
    key: string;
    fresh: boolean;
};

type Vertex = [number, number, number, number, number, number, number, number];
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

function dress(fragment: Fragment, pool: InstancePool): void {
    const { section, slot, tile, start, end } = fragment;
    const length = end - start;
    const origin = sampleSection(section, (start + end) / 2);
    ribbon(fragment, origin);
    function surface(name: string, color: string, texture?: string, thresholds?: number[], bridge = false) {
        const mesh = bridge ? 'night-crossing-shell' : 'night-' + name + slot;
        const piece = pool.take(mesh, id => [game.spawn({ id, mesh, unlit: true })]);
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
    surface('deck', ROAD_TINT[section.road.surface], 'night-road', ROAD_LOD_DISTANCES);
    surface('paving', '#20222a', 'night-paving', PAVING_LOD_DISTANCES);
    surface('curb', '#05070b');
    surface('ground', '#020305');
    let frontages = 0;
    for (const side of [-1, 1]) {
        const seed = routeHash(tileSeed ^ Math.imul(side, 0x27d4eb2d));
        for (const [row, layout] of NIGHT_ROWS.entries()) {
            const key = row === 0 ? frontage(section.environment.district, seed) : tower(routeHash(seed + row));
            const size = buildingSize(key);
            const setback = origin.width / 2 + WALK + layout.offset;
            // On the inside of a bend, successive lots are closer than their road centres.
            const innerEdge = setback + size.z * layout.scale;
            const room = length * (1 - innerEdge / NIGHT_PROFILE.radius[0]) - LOT_GAP;
            const scale = Math.min(layout.scale, room / size.x);
            if (scale < MIN_LOT_SCALE) continue;
            const offset = side * (setback + size.z * scale / 2);
            const piece = pool.take(key, id => spawnBuilding(key, id, 1, 0, side).parts);
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
    }
    if (frontages === 2 && length >= 18 && mod(tile, 9) === 4)
        surface('skybridge', '#101218', 'night-crossing', BRIDGE_LOD_DISTANCES, true);
}

export function buildNightCity(route: NightRoute) {
    // Sample opaque paint for caps and undersides, and reserve the patterned UVs for vertical panels.
    defineCladBox('night-crossing-shell', 'front', 2 / 64, 53 / 64);
    defineSignBox();
    game.background.picture('night-sky', 'stretch');
    game.render3d.lighting.preset('night');
    game.render3d.lighting.set({
        sun: { x: 0.4, y: -1, z: -0.65 },
        sunColor: '#c6cfee',
        sunIntensity: 0,
        skyColor: '#8c9dc7',
        groundColor: '#2d3547',
        ambient: 0.08,
        environment: 0.025,
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
        const goal = distance + NIGHT_PROFILE.forward + RESERVE;
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
            dress(fragment, pool);
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
