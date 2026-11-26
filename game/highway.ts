import { game, type Mesh } from './engine.js';

export const ROAD_WIDTH = 12;
export const SECTION = 24, SECTION_COUNT = 13;
export const CIRCUIT_LENGTH = SECTION * SECTION_COUNT;
const TOWER_COLORS = ['#6c9da8', '#85a7a1', '#9eaab5', '#7096a2', '#b4b9ac'];
type Piece = { mesh: Mesh; offset: number };

export function buildHighway() {
    game.render3d.lighting.preset('noon');
    game.render3d.lighting.set({
        sun: { x: 0.65, y: -1, z: -0.38 },
        sunIntensity: 1.1,
        ambient: 0.66,
        skyColor: '#e3f7ff',
        groundColor: '#a2a29e',
        fogColor: '#d5e8e4',
        fogStart: 54,
        fogEnd: 210,
        shadows: false,
        environment: 0.32,
    });
    game.background.picture('daylight', 'stretch');
    game.spawn({
        id: 'city-floor',
        mesh: 'box',
        x: 0,
        y: -11,
        z: -126,
        size: [390, 2, 420],
        color: '#668889',
    });

    const sections: Piece[][] = [];
    for (let i = 0; i < SECTION_COUNT; i++) {
        const pieces: Piece[] = [];
        sections.push(pieces);
        function box(
            name: string,
            x: number,
            y: number,
            z: number,
            w: number,
            h: number,
            d: number,
            color: string,
            roll = 0,
        ) {
            const mesh = game.spawn({
                id: name + '-' + i + '-' + pieces.length,
                mesh: 'box',
                x,
                y,
                z,
                size: [w, h, d],
                color,
                roll,
                rough: 1,
            });
            pieces.push({ mesh, offset: z });
        }
        box('deck', 0, -0.5, 0, ROAD_WIDTH, 1, SECTION, '#415464');
        box('expansion-joint', 0, 0.003, -11.9, ROAD_WIDTH, 0.002, 0.055, '#354957');
        box('crossbeam', 0, -0.87, 0, 16.6, 0.63, 1.3, '#657c81');
        for (const side of [-1, 1]) {
            const rail = side * 6.13;
            box('parapet', rail, 0.18, 0, 0.26, 0.5, SECTION, '#e4ddbf');
            box('rail-inset', side * 5.984, 0.2, -2, 0.025, 0.105, 17, '#127b8d');
            box('edge', side * 5.7, 0.013, 0, 0.076, 0.014, SECTION, '#f6e4a7');
            for (let k = 0; k < 3; k++) {
                box('lane', side * 2, 0.014, k * 8 - 8, 0.11, 0.012, 3.35, '#e5eee8');
                box('reflector', side * 5.982, 0.23, k * 8 - 8, 0.03, 0.14, 1.25, '#f08039');
            }
            box('pier', side * 4.7, -7.4, 0, 0.85, 13.2, 1.35, '#879b9a');
            const n = i * 2 + (side === 1 ? 1 : 0),
                height = 14 + ((n * 19) % 33);
            const x = side * (22 + ((n * 11) % 18)),
                w = 4 + ((n * 7) % 7.5),
                depth = 5 + ((n * 3) % 5),
                base = -9;
            const facade = TOWER_COLORS[n % TOWER_COLORS.length];
            box('tower', x, base + height / 2, 0, w, height, depth, facade);
            box('podium', side * 22, -7.7, 0, 20, 4.6, 21, '#839999');
            box('terrace', side * 22, -5.27, 0, 20.4, 0.38, 21.4, '#b1c2ae');
            box('garden', side * 18, -4.97, 5, 7, 0.3, 3.7, '#73a68a');
            for (let tree = 0; tree < 2; tree++) {
                const tx = side * (17.2 + tree * 1.9),
                    tz = 4 + tree * 1.35;
                box('trunk', tx, -4.15, tz, 0.19, 1.5, 0.19, '#776953');
                const crown = game.spawn({
                    id: 'tree-' + n + '-' + tree,
                    mesh: 'icosahedron',
                    x: tx,
                    y: -3.25,
                    z: tz,
                    size: [1.62, 1.85, 1.56],
                    color: tree ? '#3f947d' : '#76ac83',
                });
                pieces.push({ mesh: crown, offset: tz });
            }
            box(
                'annex',
                x - side * (w * 0.5 + 1.9),
                base + height * 0.2,
                2.1,
                4.4,
                height * 0.4,
                depth * 0.57,
                '#759098',
            );
            box(
                'service-line',
                x + w * 0.24,
                base + height * 0.54,
                depth * 0.5 + 0.04,
                0.2,
                height * 0.79,
                0.14,
                n % 4 === 0 ? '#e78f5d' : '#c7d4bc',
            );
            box('crown', x, base + height + 0.65, 0, w * 0.78, 1.3, depth * 0.85, '#d1d6c9');
            box(
                'glass',
                x - side * (w * 0.5 + 0.015),
                base + height * 0.52,
                0,
                0.05,
                height * 0.78,
                depth * 0.55,
                '#456f83',
            );
            for (let floor = 1; floor <= 4; floor++) {
                box('ribbon', x, base + (height * floor) / 5, 0, w + 0.18, 0.32, depth + 0.16, '#b8cec9');
            }
            if (n % 3 === 0) box('mast', x, base + height + 2.7, 0, 0.12, 4, 0.12, '#637b83');
            const farHeight = 22 + ((n * 23) % 48);
            box('skyline', side * (49 + (n % 6) * 4), farHeight / 2 - 12, -6, 10, farHeight, 13, '#a3bbc3');
        }
        if (i % 4 === 3) {
            for (const side of [-1, 1]) {
                box('gantry-leg', side * 7.45, 3.1, 0, 0.46, 7.3, 0.64, '#375e68', side * 0.12);
                box('orange-foot', side * 7.7, 0.9, 0, 0.74, 2, 0.9, '#e78242');
            }
            box('gantry', 0, 6.68, 0, 14.6, 0.48, 0.61, '#37616b');
            box('signal', 0, 6.36, 0.02, 3.8, 0.32, 0.44, '#193944');
            for (const x of [-1, 0, 1]) box('lamp', x, 6.36, 0.255, 0.47, 0.09, 0.02, '#93ffe0');
        }
    }
    return (distance: number) => {
        const travel = distance % CIRCUIT_LENGTH;
        for (let i = 0; i < sections.length; i++) {
            const center = SECTION - ((i * SECTION - travel + CIRCUIT_LENGTH) % CIRCUIT_LENGTH);
            for (const p of sections[i]) {
                const z = center + p.offset,
                    wrap = Math.abs(p.mesh.z - z) > SECTION;
                p.mesh.z = z;
                if (wrap) p.mesh.snap();
            }
        }
        return sections.length;
    };
}
