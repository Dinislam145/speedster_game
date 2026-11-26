import { game, type Mesh } from './engine.js';
import { DOOR_LIGHTS, NAMES, NEON, NIGHT_HAZE, TUBE_CORES, signFrames, streetFrames } from './night-art.js';
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
const WINDOW_LIGHT_COUNT = 8;
const WINDOW_LIGHT_RADIUS = 19;
const WINDOW_LIGHT_FULL_DISTANCE = 18;
const WINDOW_LIGHT_FADE_DISTANCE = 38;
const WINDOW_SPILL_ROAD_WIDTH = 4.2;
const WINDOW_SPILL_LAYER_HEIGHT = 0.012;
const WINDOW_LIGHT_INTENSITY = 10;
const WINDOW_LIGHT_Y = 2.5;
const DISTRICTS = {
    retail: { frontage: [0, 3], road: '#e4e4e4', gap: 1.8, height: 1, extraSigns: 2 },
    residential: { frontage: [2, 5], road: '#d3d6e4', gap: 4.8, height: 1.14, extraSigns: 0 },
    industrial: { frontage: [1, 4], road: '#ced7dc', gap: 3, height: 0.73, extraSigns: 1 },
};
const SIGN_LOD_DISTANCES = [47, 88, 149];
const ROAD_LOD_DISTANCES = [36, 76];
const PAVING_LOD_DISTANCES = [33, 67];
const FACADE_LOD_DISTANCES = [46, 97];
const BRIDGE_LOD_DISTANCES = [62, 120];
type Fragment = {
    section: RoadSection;
    start: number;
    end: number;
    tile: number;
    slot: number;
    pieces: Piece[];
    windows: WindowLight[];
};
type WindowLight = { x: number; z: number; color: string };
type InstancePool = ReturnType<typeof makeInstancePool>;
type Piece = {
    obj: Mesh;
    x: number;
    z: number;
    yaw: number;
    textures?: number[];
    thresholds?: number[];
    key: string;
    fresh: boolean;
};

type Vertex = [number, number, number, number, number, number, number, number];
const ROOF_TINTS = ['#d4e7ff', '#efcfee', '#d5e5d4', '#edd5db', '#d9d6f3', '#c9e8e6'];
function mod(n: number, m: number) {
    return ((n % m) + m) % m;
}
function makeInstancePool() {
    const available = new Map<string, Piece[]>();
    let allocated = 0;
    function take(name: string, mesh: string, unlit: boolean): Piece {
        const key = name + '/' + mesh + '/' + unlit;
        return (
            available.get(key)?.pop() ?? {
                key,
                obj: game.spawn({
                    id: 'night-' + name + '-' + allocated++,
                    mesh,
                    unlit,
                    alpha: name === 'window-spill' ? 0.36 : 1,
                    emissive: name === 'cornice' ? 0.2 : 0,
                    rough: 0.85,
                }),
                x: 0,
                z: 0,
                yaw: 0,
                fresh: true,
            }
        );
    }
    function release(piece: Piece): void {
        piece.obj.visible = false;
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
function defineShopNameFaces(): void {
    const primitive = game.world3d.meshVerts(game.world3d.mesh('box'));
    if (!primitive) throw new Error('The box mesh is missing');
    for (const side of [-1, 1]) {
        const vertices: number[] = [];
        for (let i = 0; i < primitive.length; i += 8) {
            const nx = primitive[i + 3];
            if (nx !== -side) continue;
            const y = primitive[i + 1];
            const z = primitive[i + 2];
            // Mirror the UV on the opposite sidewalk so both names read left to right.
            vertices.push(primitive[i], y, z, nx, 0, 0, 0.5 - nx * z, 0.5 - y);
        }
        game.world3d.defineMesh('night-shop-name-' + side, new Float32Array(vertices));
    }
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

function* dress(fragment: Fragment, pool: InstancePool): Generator<void> {
    const { section, slot, tile, start, end } = fragment;
    const profile = DISTRICTS[section.environment.district];
    const mid = (start + end) / 2;
    const length = end - start;
    const origin = sampleSection(section, mid);
    ribbon(fragment, origin);
    function place(
        name: string,
        along: number,
        across: number,
        y: number,
        w: number,
        h: number,
        d: number,
        color: string,
        texture?: string | number,
        yaw = 0,
        mesh = 'box',
    ) {
        const p = along === 0 ? origin : sampleSection(section, mid + along);
        // For objects anchored to a curb, follow the width at their own metre.
        const offset = across + (Math.sign(across) * (p.width - origin.width)) / 2;
        // Roadside surfaces get the authored light spill. Nearby point lights
        // still tint the craft without projecting a bright spot onto the ground.
        const piece = pool.take(name, mesh, texture !== undefined || name === 'curb' || name === 'ground');
        fragment.pieces.push(piece);
        piece.fresh = true;
        piece.x = p.x + offset * p.cos;
        piece.z = p.z + offset * p.sin;
        piece.yaw = p.heading + yaw;
        const o = piece.obj;
        o.y = y;
        o.sx = w;
        o.sy = h;
        o.sz = d;
        o.tint = color;
        o.visible = true;
        piece.textures = typeof texture === 'string' ? streetFrames.get(texture) : undefined;
        piece.thresholds = piece.textures ? FACADE_LOD_DISTANCES : undefined;
        o.frame =
            typeof texture === 'string'
                ? (piece.textures?.[0] ?? game.assets.frame(texture).index)
                : (texture ?? game.assets.frame('white').index);
        return piece;
    }
    function surface(name: string, color: string, texture?: string, thresholds?: number[]) {
        const piece = place(name, 0, 0, 0, 1, 1, 1, color, texture, 0, 'night-' + name + slot);
        piece.yaw = 0;
        piece.thresholds = thresholds;
    }
    const tileSeed = routeHash(section.environment.seed ^ Math.imul(tile, 0x1b873593));
    const styles = [0, 1].map((side) => {
        const random = routeHash(tileSeed ^ (side ? 0x6a09e667 : 0x510e527f));
        return random % 5 === 0 ? random % NAMES.length : profile.frontage[random % profile.frontage.length];
    });
    // Sign and window palettes are independent of the building's architectural style.
    const signOnLeft = routeHash(tileSeed ^ 0xb7e15162) % NAMES.length;
    const signOnRight =
        (signOnLeft + 1 + (routeHash(tileSeed ^ 0x9e3779b9) % (NAMES.length - 1))) % NAMES.length;
    const canopyLeft = routeHash(tileSeed ^ 0x6a09e667) % NEON.length;
    const canopyRight =
        (canopyLeft + 1 + (routeHash(tileSeed ^ 0xbb67ae85) % (NEON.length - 1))) % NEON.length;
    surface(
        'deck',
        DISTRICTS[section.road.surface].road,
        'wet-' + (styles[0] % 3) + '-' + (styles[1] % 3),
        ROAD_LOD_DISTANCES,
    );
    surface('paving', '#b0b3bf', 'night-paving', PAVING_LOD_DISTANCES);
    surface('curb', '#171d2a');
    surface('ground', '#10121b');
    if (length < 7) return;
    yield;
    const frontageDepth = Math.max(4, length - profile.gap - 1.5);
    for (const side of [-1, 1]) {
        const style = styles[(side + 1) / 2],
            seed = routeHash(tileSeed ^ Math.imul(side, 0x27d4eb2d));
        const near = side * (origin.width / 2 + WALK),
            height = (10 + (seed % 31)) * profile.height;
        const width = 7 + ((seed >>> 8) % 6),
            bx = near + side * width * 0.5;
        const signStyle = side < 0 ? signOnLeft : signOnRight;
        const windowStyle = routeHash(seed ^ 0x7f4a7c15) % NAMES.length;
        const doorLight = DOOR_LIGHTS[routeHash(seed ^ 0x85ebca6b) % DOOR_LIGHTS.length];
        const shop = 'night-shop-' + style,
            windows = 'night-windows-' + windowStyle;
        place('shop-block', 0, bx, 2.12, width, 4.24, frontageDepth, '#ffffff', shop, 0, 'night-shop-shell');
        const frontage = style % 3;
        const canopyColor = side < 0 ? canopyLeft : canopyRight;
        const roofColor = routeHash(seed ^ 0xc2b2ae35) % NEON.length;
        place(
            'shop-name',
            0,
            near - side * 0.045,
            4.01,
            0.02,
            0.44,
            Math.min(12, frontageDepth * 0.9),
            TUBE_CORES[canopyColor],
            'night-shop-name-' + style,
            0,
            'night-shop-name-' + side,
        );
        // In the shuttered variant, the only lit pane is near one end.
        const paneDistance = mid + (frontage === 1 ? frontageDepth * 0.26 : 0);
        const color = DOOR_LIGHTS[(style + (frontage === 0 ? 4 : 0)) % DOOR_LIGHTS.length];
        // The broad spill belongs to the storefront, including when no live lamp is assigned yet.
        const spillMesh = defineWindowSpill(fragment, side, paneDistance, origin);
        const spill = place('window-spill', 0, 0, 0, 1, 1, 1, color, 'night-window-spill', 0, spillMesh);
        spill.yaw = 0;
        const paneHalfSpan = frontageDepth * (frontage === 1 ? 0.13 : 0.3);
        for (const offset of [-paneHalfSpan, paneHalfSpan]) {
            const pane = sampleSection(section, paneDistance + offset);
            const glass = side * (pane.width / 2 + WALK - 0.35);
            fragment.windows.push({
                x: pane.x + glass * pane.cos,
                z: pane.z + glass * pane.sin,
                color,
            });
        }
        const canopyLength = Math.min(frontageDepth, [18.8, 9.6, 5.4][frontage]);
        place('canopy', 0, near - side * 0.4, 3.65, 1.05, 0.32, canopyLength, '#354052');
        place(
            'fascia',
            0,
            near - side * 0.96,
            3.56,
            0.075,
            0.23,
            canopyLength - 0.6,
            '#ffffff',
            'night-fascia-' + canopyColor,
            0,
            'night-fascia-shell',
        );
        const variation = (seed >>> 12) % 5;
        const setback = [1.2, 2.8, 1.6][frontage];
        place(
            'tower',
            0,
            bx + side * setback,
            4.24 + height / 2,
            width + 0.3,
            height,
            Math.min(frontageDepth, 18 + variation),
            '#f0eaf7',
            windows,
        );
        place(
            'penthouse',
            -0.8,
            bx + side * (setback + 0.6),
            4.24 + height + 2,
            width * 0.68,
            4,
            Math.min(12, frontageDepth),
            ROOF_TINTS[windowStyle],
            'night-roof-service',
            0,
            'night-roof-service-shell',
        );
        place(
            'cornice',
            0,
            bx + side * setback,
            4.24 + height - 0.25,
            width + 0.65,
            0.48,
            Math.min(frontageDepth, 18.4 + variation),
            '#575167',
        );
        place(
            'roof-trim',
            0,
            bx + side * (setback - (width + 0.65) / 2 - 0.05),
            4.24 + height - 0.25,
            0.08,
            0.34,
            Math.min(frontageDepth, 18.4 + variation) - 0.5,
            '#b1b1b1',
            'night-fascia-' + roofColor,
            0,
            'night-fascia-shell',
        );
        if (seed % 3 === 0)
            place('mast', -0.8, bx + side * setback, 4.24 + height + 5.5, 0.13, 4, 0.13, '#675968');
        const signHeight = [6.2, 4.1, 3.3][frontage] + ((seed >>> 14) % 3);
        const signBottom = [4.05, 7.2, 3.8][frontage];
        if (section.environment.district === 'retail' || seed % 4 === 0) {
            place(
                'sign-bracket',
                0,
                near + side * (setback / 2 - 0.45),
                signBottom + signHeight * 0.64,
                setback + 1.5,
                0.21,
                0.22,
                '#465062',
            );
            const marquee = place(
                'marquee',
                0,
                near - side * 0.95,
                signBottom + signHeight / 2,
                frontage === 1 ? 1.65 : 1.24,
                signHeight,
                0.27,
                '#ffffff',
                signFrames[signStyle][0],
                side * 0.1,
            );
            marquee.textures = signFrames[signStyle];
            marquee.thresholds = SIGN_LOD_DISTANCES;
            if (length >= 18) {
                const count = 1 + (seed % (profile.extraSigns + 1));
                for (let i = 1; i < count; i++) {
                    const frames = signFrames[(signStyle + i) % NAMES.length];
                    const attachment = place(
                        'marquee',
                        i === 1 ? -5 : 5,
                        near - side * 0.95,
                        signBottom + signHeight / 2,
                        0.95,
                        signHeight * 0.75,
                        0.24,
                        '#ffffff',
                        frames[0],
                    );
                    attachment.textures = frames;
                    attachment.thresholds = SIGN_LOD_DISTANCES;
                }
            }
        }
        if (frontage === 1)
            place('duct', -Math.min(6, length / 3), near - side * 0.23, 1.95, 0.54, 3.6, 1.8, '#616575');
        if (frontage === 2)
            place(
                'entry-lamp',
                -Math.min(5.5, length / 3),
                near - side * 0.26,
                2.1,
                0.23,
                1.4,
                0.25,
                doorLight,
                'night-entry-lamp',
            );
        place(
            'door-light',
            Math.min(4.8, length / 3),
            near - side * 0.4,
            2.7,
            0.57,
            0.13,
            1.1,
            doorLight,
            'night-door-fixture',
        );
        const backHeight = height + 12 + ((seed >>> 9) % 32);
        place(
            'rear-tower',
            -Math.min(4, length / 4),
            side * (28 + ((seed >>> 14) % 9)),
            backHeight / 2,
            12,
            backHeight,
            Math.min(15, frontageDepth),
            '#b0acc4',
            'night-windows-' + ((windowStyle + 2) % 6),
        );
        place(
            'distant-tower',
            Math.min(4, length / 4),
            side * (48 + (seed % 13)),
            backHeight * 0.57,
            15,
            backHeight * 1.14,
            Math.min(17, frontageDepth),
            '#8d89a6',
            'night-windows-' + ((windowStyle + 4) % 6),
        );
        yield;
    }
    if (length < 18 || mod(tile, 9) !== 4) return;
    const crossing = place(
        'skybridge',
        0,
        0,
        8.6,
        origin.width + 11,
        1.6,
        1.8,
        '#ffffff',
        'night-crossing',
        0,
        'night-crossing-shell',
    );
    crossing.thresholds = BRIDGE_LOD_DISTANCES;
}

export function buildNightCity(route: NightRoute) {
    // Sample opaque paint for caps and undersides, and reserve the patterned UVs for vertical panels.
    defineCladBox('night-crossing-shell', 'front', 2 / 64, 53 / 64);
    defineCladBox('night-shop-shell', 'walls', 189 / 192);
    defineCladBox('night-roof-service-shell', 'walls', 59 / 64);
    defineShopNameFaces();
    defineCladBox('night-fascia-shell', 'sides', 0.5 / 16);
    game.background.picture('night-sky', 'stretch');
    game.render3d.lighting.preset('night');
    game.render3d.lighting.set({
        sun: { x: 0.4, y: -1, z: -0.65 },
        sunColor: '#c6cfee',
        sunIntensity: 0.1,
        skyColor: '#a3b1db',
        groundColor: '#383345',
        ambient: 0.2,
        environment: 0.15,
        fogColor: NIGHT_HAZE,
        fogStart: 150,
        fogEnd: NIGHT_PROFILE.fogEnd,
        shadows: false,
    });
    const lamps = Array.from({ length: WINDOW_LIGHT_COUNT }, (_, i) =>
        game.lights.add({
            id: 'window-light-' + i,
            radius: WINDOW_LIGHT_RADIUS,
            intensity: WINDOW_LIGHT_INTENSITY,
            y: WINDOW_LIGHT_Y,
        }),
    );
    const pool = makeInstancePool();
    const fragments: Fragment[] = [];
    const freeSlots: number[] = [];
    let slots = 0;
    let loaded = 0;
    let retired = 0;
    let previousDistance = -Infinity;
    let pending: Generator<void> | undefined;

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
            pending = undefined;
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
        if (pending?.next().done) pending = undefined;
        while (cursor < goal && !pending) {
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
                windows: [],
            };
            fragments.push(fragment);
            loaded++;
            cursor = end;
            const work = dress(fragment, pool);
            if (abrupt) {
                for (const _step of work) {
                    /* fill the initial window before the first frame */
                }
            } else if (!work.next().done) {
                pending = work;
            }
            if (!abrupt) break;
        }

        const nearby = fragments
            .flatMap(({ windows }) => windows)
            .map((source) => ({ source, distance: Math.hypot(source.x - here.x, source.z - here.z) }))
            .filter(({ distance }) => distance < WINDOW_LIGHT_FADE_DISTANCE)
            .sort((a, b) => a.distance - b.distance);
        // Fade out against the first lamp outside the pool, so a swap at the cap is continuous.
        const fadeEnd = nearby[WINDOW_LIGHT_COUNT]?.distance ?? WINDOW_LIGHT_FADE_DISTANCE;
        const fadeStart = Math.min(WINDOW_LIGHT_FULL_DISTANCE, fadeEnd * 0.7);
        let windowLights = 0;
        for (const [index, lamp] of lamps.entries()) {
            const candidate = nearby[index];
            lamp.light3d.on = candidate ? 1 : 0;
            if (!candidate) continue;
            const source = candidate.source;
            const dx = source.x - here.x,
                dz = source.z - here.z;
            lamp.x = dx * here.cos + dz * here.sin;
            lamp.z = -dx * here.sin + dz * here.cos;
            lamp.light3d.color = source.color;
            const fade = Math.max(0, (candidate.distance - fadeStart) / Math.max(0.1, fadeEnd - fadeStart));
            lamp.light3d.intensity = WINDOW_LIGHT_INTENSITY * (1 - fade * fade * (3 - 2 * fade));
            windowLights++;
        }
        let objects = 0;
        const sections = new Set<number>();
        for (const fragment of fragments) {
            sections.add(fragment.section.id);
            for (const piece of fragment.pieces) {
                const dx = piece.x - here.x,
                    dz = piece.z - here.z;
                const obj = piece.obj;
                obj.x = dx * here.cos + dz * here.sin;
                obj.z = -dx * here.sin + dz * here.cos;
                obj.yaw = piece.yaw - here.heading;
                if (piece.textures && piece.thresholds) {
                    let viewingDistance = Math.hypot(obj.x - eye.x, obj.y - eye.y, obj.z - eye.z);
                    if (piece.thresholds === SIGN_LOD_DISTANCES) viewingDistance *= 1.24 / obj.sx;
                    let level = 0;
                    while (level < piece.thresholds.length && viewingDistance >= piece.thresholds[level])
                        level++;
                    const frame = piece.textures[level];
                    if (obj.frame !== frame) obj.frame = frame;
                }
                if (piece.fresh) {
                    obj.snap();
                    piece.fresh = false;
                }
                if (obj.visible) objects++;
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
            windowLights,
        };
    };
}
