import { game, type Mesh } from './engine.js';
import { SECTION, SECTION_COUNT, ROAD_WIDTH } from './highway.js';
import { NAMES, NEON, NIGHT_HAZE } from './night-art.js';
import { routeAt } from './route.js';

const HALF = ROAD_WIDTH / 2,
    WALK = 2.8,
    CURB = 0.15,
    STEP = 4;
type Pose = ReturnType<typeof routeAt>;
type Piece = { obj: Mesh; x: number; z: number; yaw: number };
type Slot = { logical: number; used: number; pieces: Piece[] };
type Vertex = [number, number, number, number, number, number, number, number];
const BASES = ['#253341', '#332b3c', '#27303a', '#303143', '#272d40', '#263a41'];
function mod(n: number, m: number) {
    return ((n % m) + m) % m;
}
function mix(n: number) {
    let x = Math.imul(n ^ 0x3f1354e, 0x45d9f3b);
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    return (x ^ (x >>> 16)) >>> 0;
}
function ribbon(slot: number, logical: number, origin: Pose) {
    const deck: number[] = [],
        paving: number[] = [],
        lips: number[] = [];
    const samples = Array.from({ length: SECTION / STEP + 1 }, (_, i) =>
        routeAt(logical * SECTION + i * STEP),
    );
    function strip(out: number[], lo: number, y0: number, hi: number, y1: number, nx: number, ny: number) {
        function vertex(i: number, offset: number, y: number, u: number): Vertex {
            const p = samples[i];
            return [
                p.x - origin.x + offset * p.cos,
                y,
                p.z - origin.z + offset * p.sin,
                nx * p.cos,
                ny,
                nx * p.sin,
                u,
                (i * STEP) / SECTION,
            ];
        }
        for (let i = 0; i < samples.length - 1; i++) {
            const a = vertex(i, lo, y0, 0),
                b = vertex(i, hi, y1, 1),
                c = vertex(i + 1, hi, y1, 1),
                d = vertex(i + 1, lo, y0, 0);
            out.push(...a, ...b, ...c, ...a, ...c, ...d);
        }
    }
    strip(deck, -HALF, 0, HALF, 0, 0, 1);
    strip(paving, -HALF - WALK, CURB, -HALF, CURB, 0, 1);
    strip(paving, HALF, CURB, HALF + WALK, CURB, 0, 1);
    strip(lips, -HALF, CURB, -HALF, 0, 1, 0);
    strip(lips, HALF, 0, HALF, CURB, -1, 0);
    for (const [name, data] of [
        ['deck', deck],
        ['paving', paving],
        ['curb', lips],
    ] as const)
        game.world3d.defineMesh('night-' + name + slot, new Float32Array(data));
}

function dress(slot: Slot, index: number, logical: number) {
    const mid = (logical + 0.5) * SECTION,
        origin = routeAt(mid);
    ribbon(index, logical, origin);
    slot.logical = logical;
    slot.used = 0;
    function place(
        name: string,
        along: number,
        across: number,
        y: number,
        w: number,
        h: number,
        d: number,
        color: string,
        texture?: string,
        yaw = 0,
        mesh = 'box',
        visible = true,
    ) {
        const p = along === 0 ? origin : routeAt(mid + along);
        const id = slot.used++;
        let piece = slot.pieces[id];
        if (!piece) {
            const obj = game.spawn({
                id: 'night-' + index + '-' + name + '-' + id,
                mesh,
                unlit: !!texture,
                rough: 0.85,
            });
            piece = { obj, x: 0, z: 0, yaw: 0 };
            slot.pieces.push(piece);
        }
        piece.x = p.x + across * p.cos;
        piece.z = p.z + across * p.sin;
        piece.yaw = p.heading + yaw;
        const o = piece.obj;
        o.y = y;
        o.sx = w;
        o.sy = h;
        o.sz = d;
        o.tint = color;
        o.visible = visible;
        if (texture) o.frame = game.assets.frame(texture).index;
        return piece;
    }
    function surface(name: string, texture?: string) {
        const piece = place(
            name,
            0,
            0,
            0,
            1,
            1,
            1,
            texture ? '#ffffff' : '#4a5364',
            texture,
            0,
            'night-' + name + index,
        );
        piece.yaw = 0; // Ribbon vertices already include the tangent at every sample.
    }
    const styles = [mix(logical * 2) % NAMES.length, mix(logical * 2 + 1) % NAMES.length];
    surface('deck', 'wet-' + (styles[0] % 3) + '-' + (styles[1] % 3));
    surface('paving', 'night-paving');
    surface('curb');
    for (const side of [-1, 1]) {
        const style = styles[(side + 1) / 2],
            seed = mix(logical * 53 + side * 293),
            tint = NEON[style % 3];
        const near = side * (HALF + WALK),
            height = 10 + (seed % 31);
        const width = 7 + ((seed >>> 8) % 6),
            bx = near + side * width * 0.5;
        const shop = 'night-shop-' + style,
            windows = 'night-windows-' + style;
        // The long ground-floor texture faces the sidewalk. A second, street-facing
        // return and projecting sign catch the eye from the low chase camera.
        place('shop-block', 0, bx, 2.12, width, 4.24, 20.8, '#ffffff', shop);
        const frontage = style % 3;
        const canopyLength = [18.8, 9.6, 5.4][frontage];
        place('canopy', 0, near - side * 0.4, 3.65, 1.05, 0.32, canopyLength, '#354052');
        place('fascia', 0, near - side * 0.9, 3.56, 0.065, 0.1, canopyLength - 0.6, tint);
        const variation = (seed >>> 12) % 5;
        const setback = [1.2, 2.8, 1.6][frontage];
        place(
            'tower',
            0,
            bx + side * setback,
            4.24 + height / 2,
            width + 0.3,
            height,
            18 + variation,
            '#e2dfef',
            windows,
        );
        place(
            'penthouse',
            -0.8,
            bx + side * (setback + 0.6),
            4.24 + height + 2,
            width * 0.68,
            4,
            12,
            BASES[style],
        );
        place(
            'cornice',
            0,
            bx + side * setback,
            4.24 + height - 0.25,
            width + 0.65,
            0.48,
            18.4 + variation,
            '#575167',
        );
        place(
            'mast',
            -0.8,
            bx + side * setback,
            4.24 + height + 5.5,
            0.13,
            4,
            0.13,
            '#675968',
            undefined,
            0,
            'box',
            seed % 3 === 0,
        );
        const signHeight = [6.2, 4.1, 3.3][frontage] + ((seed >>> 14) % 3);
        const signBottom = [4.05, 7.2, 3.8][frontage];
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
        place(
            'marquee',
            0,
            near - side * 0.95,
            signBottom + signHeight / 2,
            frontage === 1 ? 1.65 : 1.24,
            signHeight,
            0.27,
            '#ffffff',
            'night-sign-' + style,
            side * 0.1,
        );
        place(
            'duct',
            -6,
            near - side * 0.23,
            1.95,
            0.54,
            3.6,
            1.8,
            '#616575',
            undefined,
            0,
            'box',
            frontage === 1,
        );
        place(
            'entry-lamp',
            -5.5,
            near - side * 0.26,
            2.1,
            0.23,
            1.4,
            0.25,
            '#ffffff',
            'night-entry-lamp',
            0,
            'box',
            frontage === 2,
        );
        place('door-light', 4.8, near - side * 0.4, 2.7, 0.57, 0.13, 1.1, '#ffc797');
        const backHeight = height + 12 + ((seed >>> 9) % 32);
        place(
            'rear-tower',
            -4,
            side * (28 + ((seed >>> 14) % 9)),
            backHeight / 2,
            12,
            backHeight,
            15,
            '#9299af',
            'night-windows-' + ((style + 2) % 6),
        );
        place(
            'distant-tower',
            4,
            side * (48 + (seed % 13)),
            backHeight * 0.57,
            15,
            backHeight * 1.14,
            17,
            '#716e88',
            'night-windows-' + ((style + 4) % 6),
        );
        place('rear-block', 0, side * 39, -0.18, 62, 0.32, 27, '#202032');
    }
    const bridge = mod(logical, 9) === 4;
    place('skybridge', 0, 0, 8.6, 23, 1.6, 1.8, '#ffffff', 'night-crossing', 0, 'box', bridge);
    place('bridge-strip', 0.01, 0, 8, 21, 0.1, 1.87, '#64b1c2', undefined, 0, 'box', bridge);
}

export function buildNightCity() {
    game.background.picture('night-sky', 'stretch');
    game.render3d.lighting.preset('night');
    game.render3d.lighting.set({
        sun: { x: 0.4, y: -1, z: -0.65 },
        sunColor: '#c6cfee',
        sunIntensity: 0.96,
        skyColor: '#ccd6f8',
        groundColor: '#525071',
        ambient: 0.5,
        environment: 0.32,
        fogColor: NIGHT_HAZE,
        fogStart: 150,
        fogEnd: 320,
        shadows: true,
    });
    const pool: Slot[] = Array.from({ length: SECTION_COUNT }, () => ({ logical: NaN, used: 0, pieces: [] }));
    return (distance: number) => {
        const here = routeAt(distance),
            first = Math.floor(distance / SECTION) - 1;
        for (let j = 0; j < pool.length; j++) {
            const logical = first + j,
                index = mod(logical, SECTION_COUNT),
                slot = pool[index];
            const recycle = slot.logical !== logical;
            if (recycle) dress(slot, index, logical);
            for (const p of slot.pieces) {
                const dx = p.x - here.x,
                    dz = p.z - here.z;
                p.obj.x = dx * here.cos + dz * here.sin;
                p.obj.z = -dx * here.sin + dz * here.cos;
                p.obj.yaw = p.yaw - here.heading;
                if (recycle) p.obj.snap();
            }
        }
        return pool.length;
    };
}
