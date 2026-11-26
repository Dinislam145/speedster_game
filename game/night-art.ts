import { game } from './engine.js';

type Brush = Parameters<Parameters<typeof game.paint>[3]>[0];
export const NEON = ['#57d6e3', '#ee60a8', '#ffb566', '#aeff00', '#00ac4a', '#ff0000'];
export const DOOR_LIGHTS = ['#f0b276', '#83d5dc', '#c3a6ed', '#d7909c', '#b5d89b', '#dfcda0'];
const DOOR_PAINT = ['#392923', '#233b42', '#352b46', '#432831', '#2a382a', '#3e392a'];
const TOWER_PALETTES = [
    { wall: '#132c43', accent: '#23577c', panes: ['#30ebff', '#35a8ff', '#b2f9ff'] },
    { wall: '#35203f', accent: '#6e2e72', panes: ['#ff49c8', '#c86aff', '#ffc0ec'] },
    { wall: '#283027', accent: '#52652b', panes: ['#c6ff2f', '#83f553', '#eeffa4'] },
    { wall: '#372137', accent: '#783949', panes: ['#ff7148', '#ffba4b', '#ffd69a'] },
    { wall: '#231d46', accent: '#494185', panes: ['#a874ff', '#7095ff', '#ced0ff'] },
    { wall: '#112f37', accent: '#226158', panes: ['#24ffc1', '#26ceff', '#a6ffe4'] },
];
export const NAMES = ['SORA', 'LOOP', 'KILO', 'VELA', 'AXON', 'NOVA'];
const SHOP_TYPES = ['OPTICS', 'TRANSIT', 'WORKS', 'RADIO', 'SYSTEMS', 'HOTEL'];
const SIGN_WIDTH = 128;
const SIGN_HEIGHT = 384;
const SIGN_LEVELS = [
    { res: 1, borderPixels: 3, opacity: 1 },
    { res: 0.375, borderPixels: 2.25, opacity: 0.91 },
    { res: 0.1875, borderPixels: 2, opacity: 0.82 },
    { res: 0.09375, borderPixels: 1.25, opacity: 0.58 },
];
export const TUBE_CORES = ['#d7fcff', '#ffe0f2', '#ffedcf', '#efffce', '#c9ffde', '#ffd1d5'];
// Single strokes model bent tubing. Separate strokes leave room for the ends to read.
const TUBE_LETTERS: Record<string, string> = {
    A: 'M 4 39 L 17 4 Q 19 0 21 4 L 34 39 M 10 26 H 28',
    E: 'M 33 3 H 7 Q 5 3 5 6 V 36 Q 5 39 8 39 H 33 M 6 21 H 27',
    I: 'M 7 3 H 31 M 19 4 V 38 M 7 39 H 31',
    K: 'M 6 3 V 39 M 32 3 L 7 23 M 18 16 L 33 39',
    L: 'M 6 3 V 35 Q 6 39 10 39 H 32',
    N: 'M 5 39 V 5 Q 5 1 8 5 L 31 37 Q 34 41 34 37 V 3',
    O: 'M 34 21 C 34 -3 4 -3 4 21 S 34 45 34 21 Z',
    P: 'M 6 39 V 7 Q 6 3 10 3 H 22 C 38 3 38 23 22 23 H 7',
    R: 'M 6 39 V 7 Q 6 3 10 3 H 22 C 38 3 38 23 22 23 H 7 M 19 24 L 33 39',
    S: 'M 32 7 C 23 -1 7 2 6 11 C 5 22 32 18 32 30 C 32 41 13 42 5 34',
    V: 'M 4 3 L 17 37 Q 19 41 21 37 L 34 3',
    X: 'M 5 3 L 33 39 M 33 3 L 5 39',
};
export const signFrames: number[][] = [];
export const streetFrames = new Map<string, number[]>();
const SURFACE_SCALES = [
    [1, 1],
    [0.5, 0.25],
    [0.25, 0.125],
] as const;
const FACADE_SCALES = [
    [1, 1],
    [0.25, 0.5],
    [0.125, 0.25],
] as const;
const W = 384,
    H = 768;
export const NIGHT_HAZE = '#0b081a';
function noise(seed: number) {
    return () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
}
function sign(c: OffscreenCanvasRenderingContext2D, k: number) {
    const hue = NEON[k % 6];
    c.fillStyle = '#111425';
    c.fillRect(0, 0, SIGN_WIDTH, SIGN_HEIGHT);
    c.fillStyle = '#181d32';
    c.fillRect(12, 12, 104, 54);
    c.fillStyle = hue;
    c.font = '900 35px Arial';
    c.textAlign = 'center';
    c.fillText('0' + (k + 1), 64, 51);
    c.fillRect(20, 326, 88, 2);
    c.font = 'bold 13px Arial';
    c.fillText(SHOP_TYPES[k], 64, 351);
    for (let j = 0; j < 8; j++) c.fillRect(23 + j * 11, 361, 6, 5);
}

function paintTubes(c: Brush, letters: Path2D[], style: number, level: number, resolution: number): void {
    const hue = NEON[style];
    const diameter = [5.5, 6.2, 7.5, 9][level];
    for (const [row, letter] of letters.entries()) {
        c.save();
        c.translate(45, 87 + row * 57);
        c.lineJoin = 'round';
        c.lineCap = 'round';
        c.strokeStyle = hue;
        c.shadowColor = hue;
        c.shadowBlur = 14 * resolution;
        c.globalAlpha = 0.6;
        c.lineWidth = diameter + 2;
        c.stroke(letter);
        c.shadowBlur = 0;
        c.globalAlpha = 0.93;
        c.lineWidth = diameter;
        c.stroke(letter);
        c.strokeStyle = TUBE_CORES[style];
        c.globalAlpha = [1, 0.88, 0.67, 0.52][level];
        c.lineWidth = [1.9, 2.1, 2.8, 4][level];
        c.stroke(letter);
        c.restore();
    }
}

function prepareSign(style: number): number[] {
    // Average the artwork before it goes into the mesh atlas, which has no mip levels.
    const source =
        typeof OffscreenCanvas === 'undefined' ? null : new OffscreenCanvas(SIGN_WIDTH, SIGN_HEIGHT);
    const brush = source?.getContext('2d');
    if (brush) sign(brush, style);
    const letters =
        typeof Path2D === 'undefined'
            ? []
            : Array.from(NAMES[style], (letter) => new Path2D(TUBE_LETTERS[letter]));
    return SIGN_LEVELS.map(({ res, borderPixels, opacity }, level) =>
        game.paint(
            'night-sign-' + style + '-' + level,
            SIGN_WIDTH,
            SIGN_HEIGHT,
            (c) => {
                if (!source) return;
                c.imageSmoothingEnabled = true;
                c.imageSmoothingQuality = 'high';
                c.drawImage(source, 0, 0);
                paintTubes(c, letters, style, level, res);
                // Keep a continuous border in the smaller textures after filtering the lettering.
                c.lineWidth = borderPixels / res;
                const inset = Math.max(6, c.lineWidth / 2 + 0.5 / res);
                c.strokeStyle = NEON[style];
                c.globalAlpha = opacity * 0.66;
                c.strokeRect(inset, inset, SIGN_WIDTH - inset * 2, SIGN_HEIGHT - inset * 2);
            },
            { res },
        ),
    );
}
function windows(c: Brush, k: number) {
    const rand = noise(932 + k * 191);
    const { wall, accent, panes } = TOWER_PALETTES[k];
    c.fillStyle = wall;
    c.fillRect(0, 0, 256, 512);
    const columns = [7, 4, 6, 5, 4, 8][k],
        rows = [12, 10, 15, 14, 11, 13][k];
    const stepX = 256 / columns,
        stepY = 512 / rows;
    const paneWidth = stepX * (k % 2 ? 0.57 : 0.76);
    const paneHeight = stepY * (k % 2 ? 0.69 : 0.49);

    // Keep a dominant hue per building and group the accent colours by floor.
    for (let floor = 0; floor < rows; floor++) {
        const y = floor * stepY;
        const alternate = rand() < 0.34;
        const litFloor = rand() < 0.91;
        const first = Math.floor(rand() * columns);
        for (let i = 0; i < columns; i++) {
            const inGroup = (i - first + columns) % columns < Math.ceil(columns / 2);
            const lit = rand() < (litFloor ? (inGroup ? 0.94 : 0.67) : 0.23);
            const x = (i + 0.5) * stepX - paneWidth / 2;
            const top = y + (stepY - paneHeight) / 2;
            c.fillStyle = '#0d1320';
            c.fillRect(x - 2, top - 2, paneWidth + 4, paneHeight + 4);
            if (!lit) {
                // Dark glass still catches the skyline and the colours of nearby windows.
                const glass = c.createLinearGradient(x, top, x, top + paneHeight);
                glass.addColorStop(0, '#344052');
                glass.addColorStop(0.42, '#222b3d');
                glass.addColorStop(1, '#0b101b');
                c.fillStyle = glass;
                c.fillRect(x, top, paneWidth, paneHeight);
                c.fillStyle = panes[(floor + i) % 2] + '22';
                c.fillRect(x + paneWidth * 0.12, top + 1, paneWidth * 0.57, paneHeight * 0.24);
                c.fillStyle = '#121927';
                c.fillRect(x + paneWidth * 0.65, top, Math.max(1.5, paneWidth * 0.07), paneHeight);
                c.fillStyle = '#48546b';
                c.fillRect(x, top + paneHeight - 1.5, paneWidth, 1.5);
                continue;
            }
            const hue = panes[rand() < 0.13 ? 2 : alternate ? 1 : 0];
            c.fillStyle = hue + '35';
            c.fillRect(x - 2, top - 2, paneWidth + 4, paneHeight + 4);
            c.fillStyle = hue;
            c.fillRect(x, top, paneWidth, paneHeight);
            c.fillStyle = wall + '76';
            c.fillRect(x, top + paneHeight * 0.76, paneWidth, paneHeight * 0.24);
        }
        if (k % 3 === 0) {
            c.fillStyle = '#111723';
            c.fillRect(0, y + stepY - 3, 256, 3);
        }
    }
    if (k % 3 === 1) {
        c.fillStyle = wall;
        c.fillRect(142, 0, 43, 512);
        c.fillStyle = accent;
        c.fillRect(148, 0, 7, 512);
        c.fillRect(175, 0, 6, 512);
        for (let y = 12; y < 500; y += 16) c.fillRect(158, y, 13, 3);
    } else if (k % 3 === 2) {
        c.fillStyle = accent;
        c.fillRect(31, 0, 6, 512);
        c.fillRect(218, 0, 6, 512);
    }
    c.fillStyle = accent;
    c.fillRect(0, 0, 3, 512);
    c.fillRect(253, 0, 3, 512);
}
function shop(c: Brush, k: number) {
    const type = k % 3;
    c.fillStyle = '#141923';
    c.fillRect(0, 0, 512, 192);
    c.fillStyle = '#282d39';
    c.fillRect(0, 4, 512, 4);
    c.fillStyle = '#121a29';
    c.fillRect(14, 16, 484, 37);
    for (let i = 0; i < 5; i++) {
        const x = 16 + i * 96;
        const door = (k + i * 2) % DOOR_LIGHTS.length;
        const glow = DOOR_LIGHTS[door];
        c.fillStyle = DOOR_PAINT[door];
        c.fillRect(x, 66, 89, 106);
        if (type === 1 && i > 0) {
            c.fillStyle = '#202837';
            for (let j = 0; j < 10; j++) c.fillRect(x, 70 + j * 10, 89, 3);
        } else {
            const g = c.createLinearGradient(0, 67, 0, 169);
            g.addColorStop(0, glow);
            g.addColorStop(0.33, DOOR_PAINT[door]);
            g.addColorStop(1, '#10151f');
            c.fillStyle = g;
            c.fillRect(x + 4, 69, 81, 96);
            c.fillStyle = '#293144';
            c.fillRect(x + 41, 68, 3, 97);
            c.fillRect(x + 2, 92, 84, 3);
            c.fillStyle = '#ddbe9c';
            c.fillRect(x + 34, 126, 3, 11);
        }
    }
    if (type === 2) {
        c.fillStyle = '#222737';
        c.fillRect(14, 58, 306, 118);
        c.fillStyle = '#63514d';
        c.fillRect(26, 65, 138, 98);
        for (let j = 0; j < 6; j++) {
            c.fillStyle = j % 2 ? '#7c675b' : '#4c4750';
            c.fillRect(32, 72 + j * 14, 126, 7);
        }
        c.fillStyle = DOOR_LIGHTS[k];
        c.fillRect(189, 82, 84, 5);
        c.fillStyle = DOOR_PAINT[k];
        c.fillRect(192, 94, 80, 77);
        c.fillStyle = DOOR_LIGHTS[k] + '77';
        c.fillRect(200, 99, 25, 36);
        c.fillRect(238, 99, 25, 36);
    }
    c.fillStyle = '#262d39';
    c.fillRect(0, 178, 512, 5);
}
function pavement(c: Brush) {
    c.fillStyle = '#2a303d';
    c.fillRect(0, 0, 96, 384);
    for (let j = 0; j < 12; j++) {
        const y = j * 32;
        c.fillStyle = '#222b39';
        c.fillRect(0, y, 96, 1);
        c.fillRect(j % 2 ? 31 : 63, y, 1, 32);
    }
    c.fillStyle = '#141e2b';
    c.fillRect(9, 125, 23, 37);
    c.fillStyle = '#5e6973';
    for (let j = 0; j < 7; j++) c.fillRect(12, 128 + j * 5, 17, 2);
}

function road(c: Brush, left: number, right: number) {
    const rand = noise(2401 + left * 17 + right);
    c.fillStyle = '#111724';
    c.fillRect(0, 0, W, H);
    // Broad diffused pools break into narrow, lengthwise reflected fragments.
    for (const side of [-1, 1]) {
        const hue = NEON[side < 0 ? left : right];
        const cx = side < 0 ? 49 : W - 49,
            cy = H * 0.5;
        c.save();
        c.translate(cx, cy);
        c.scale(1, 2.5);
        const glow = c.createRadialGradient(0, 0, 2, 0, 0, 136);
        glow.addColorStop(0, hue + '25');
        glow.addColorStop(0.49, hue + '0b');
        glow.addColorStop(1, hue + '00');
        c.fillStyle = glow;
        c.fillRect(-137, -137, 274, 274);
        c.restore();
        for (let j = 0; j < 480; j++) {
            const x = cx + (rand() - rand()) * 128,
                y = cy + (rand() - rand()) * 330;
            c.fillStyle = hue;
            c.globalAlpha = 0.006 + rand() * 0.024;
            c.fillRect(x, y, 0.6 + rand() * 2, 3 + rand() * 32);
        }
        c.globalAlpha = 1;
    }
    for (let i = 0; i < 2200; i++) {
        c.fillStyle = i % 3 ? '#d2e6ff09' : '#02071925';
        c.fillRect(rand() * W, rand() * H, 1 + rand() * 3, 1 + rand() * 6);
    }
}

// Keep the lane cores distinct after filtering the asphalt and its reflections.
function roadMarkings(c: Brush, left: number, right: number, level: number) {
    const coreWidth = [3.52, 4.2, 6.2][level];
    const edgeWidth = [2.6, 3.1, 4.8][level];
    for (const side of [-1, 1]) {
        const x = W / 2 + (side * W) / 6;
        for (let i = 0; i < 3; i++) {
            const y = ((i + 0.5) * H) / 3,
                h = (3.35 * H) / 24;
            c.save();
            c.shadowColor = '#8cceff';
            c.shadowBlur = 6;
            c.fillStyle = ['#ddf5ff', '#dbf2fbea', '#c9e6f4c9'][level];
            c.fillRect(x - coreWidth / 2, y - h / 2, coreWidth, h);
            c.restore();
            if (level === 0) {
                c.fillStyle = '#f2fcff';
                c.fillRect(x - 0.8, y - h / 2, 1.6, h);
            }
        }
        const edge = W / 2 + side * (W / 2 - 6);
        c.fillStyle = ['#47aab4', '#47aab4dd', '#47aab4b6'][level];
        c.fillRect(edge - edgeWidth / 2, 0, edgeWidth, H);
        c.fillStyle = '#62d5db23';
        c.fillRect(edge - 3, 0, 6, H);
        const localColor = NEON[side < 0 ? left : right];
        const spill = c.createLinearGradient(0, H * 0.36, 0, H * 0.64);
        spill.addColorStop(0, localColor + '00');
        spill.addColorStop(0.5, localColor);
        spill.addColorStop(1, localColor + '00');
        c.fillStyle = spill;
        c.fillRect(edge - edgeWidth / 2, H * 0.36, edgeWidth, H * 0.28);
    }
}

function paintStreetLevels(
    key: string,
    width: number,
    height: number,
    scales: ReadonlyArray<readonly [number, number]>,
    paint: (c: Brush) => void,
    accents?: (c: Brush, level: number) => void,
): void {
    const source = typeof OffscreenCanvas === 'undefined' ? null : new OffscreenCanvas(width, height);
    const brush = source?.getContext('2d');
    if (brush) paint(brush as Brush);
    streetFrames.set(
        key,
        scales.map(([scaleX, scaleY], level) =>
            game.paint(
                key + '-' + level,
                width * scaleX,
                height * scaleY,
                (c) => {
                    if (!source) return;
                    c.scale(scaleX, scaleY);
                    c.imageSmoothingEnabled = true;
                    c.imageSmoothingQuality = 'high';
                    c.drawImage(source, 0, 0);
                    accents?.(c, level);
                },
                { res: 1 },
            ),
        ),
    );
}

export function prepareNightArt(): void {
    paintStreetLevels('night-roof-service', 128, 64, FACADE_SCALES, (c) => {
        c.fillStyle = '#2b3344';
        c.fillRect(0, 0, 128, 64);
        c.fillStyle = '#3c475a';
        c.fillRect(0, 5, 128, 5);
        c.fillStyle = '#202839';
        c.fillRect(12, 17, 104, 35);
        c.fillStyle = '#394356';
        for (let i = 0; i < 4; i++) c.fillRect(18 + i * 24, 22, 18, 24);
        c.fillStyle = '#242c3c';
        c.fillRect(0, 56, 128, 8);
    });
    game.paint(
        'night-window-spill',
        96,
        192,
        (c) => {
            const across = c.createLinearGradient(0, 0, 96, 0);
            across.addColorStop(0, '#ffffff00');
            across.addColorStop(0.26, '#ffffff22');
            across.addColorStop(0.6, '#ffffff69');
            across.addColorStop(0.86, '#ffffff8a');
            across.addColorStop(1, '#ffffff65');
            c.fillStyle = across;
            c.fillRect(0, 0, 96, 192);

            c.save();
            c.globalCompositeOperation = 'destination-in';
            const along = c.createLinearGradient(0, 0, 0, 192);
            along.addColorStop(0, '#ffffff00');
            along.addColorStop(0.16, '#ffffff6b');
            along.addColorStop(0.34, '#fffffff2');
            along.addColorStop(0.64, '#ffffffff');
            along.addColorStop(0.83, '#ffffff6b');
            along.addColorStop(1, '#ffffff00');
            c.fillStyle = along;
            c.fillRect(0, 0, 96, 192);
            c.restore();
        },
        { res: 1 },
    );
    game.paint(
        'night-entry-lamp',
        8,
        32,
        (c) => {
            c.fillStyle = '#413743';
            c.fillRect(0, 0, 8, 32);
            c.fillStyle = '#ffffff';
            c.fillRect(2, 3, 4, 25);
        },
        { res: 1 },
    );
    game.paint(
        'night-door-fixture',
        1,
        1,
        (c) => {
            c.fillStyle = '#ffffff';
            c.fillRect(0, 0, 1, 1);
        },
        { res: 1 },
    );
    game.paint(
        'night-sky',
        32,
        256,
        (c) => {
            const sky = c.createLinearGradient(0, 0, 0, 256);
            sky.addColorStop(0, '#100d20');
            sky.addColorStop(0.23, '#1b1629');
            sky.addColorStop(0.36, NIGHT_HAZE);
            c.fillStyle = sky;
            c.fillRect(0, 0, 32, 256);
        },
        { res: 1 },
    );
    paintStreetLevels(
        'night-crossing',
        512,
        64,
        FACADE_SCALES,
        (c) => {
            c.fillStyle = '#263041';
            c.fillRect(0, 0, 512, 64);
            for (let i = 0; i < 18; i++) {
                const x = 4 + i * 28;
                c.fillStyle = i % 6 < 3 ? '#576270' : '#365463';
                c.fillRect(x, 10, 24, 35);
            }
            c.fillStyle = '#152132';
            c.fillRect(0, 46, 512, 13);
        },
        (c, level) => {
            const thickness = [3, 4, 5][level];
            c.fillStyle = ['#799aa1', '#799aa1d9', '#799aa1b3'][level];
            c.fillRect(0, 61 - thickness / 2, 512, thickness);
        },
    );
    for (let k = 0; k < NAMES.length; k++) {
        signFrames[k] = prepareSign(k);
        paintStreetLevels('night-windows-' + k, 256, 512, FACADE_SCALES, (c) => windows(c, k));
        paintStreetLevels('night-shop-' + k, 512, 192, FACADE_SCALES, (c) => shop(c, k));
        paintStreetLevels('night-shop-name-' + k, 256, 40, FACADE_SCALES, (c) => {
            c.fillStyle = '#131925';
            c.fillRect(0, 0, 256, 40);
            c.fillStyle = '#eef5ff';
            c.font = 'bold 24px Arial';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText(NAMES[k] + '  /  ' + SHOP_TYPES[k], 128, 21, 234);
        });
    }
    for (let l = 0; l < 3; l++)
        for (let r = 0; r < 3; r++)
            paintStreetLevels(
                'wet-' + l + '-' + r,
                W,
                H,
                SURFACE_SCALES,
                (c) => road(c, l, r),
                (c, level) => roadMarkings(c, l, r, level),
            );
    paintStreetLevels('night-paving', 96, 384, SURFACE_SCALES, pavement);
    for (let color = 0; color < NEON.length; color++) {
        game.paint(
            'night-fascia-' + color,
            16,
            16,
            (c) => {
                const light = c.createLinearGradient(0, 0, 0, 16);
                const hue = NEON[color];
                light.addColorStop(0, '#354052');
                light.addColorStop(0.23, hue + '90');
                light.addColorStop(0.42, hue);
                light.addColorStop(0.58, hue);
                light.addColorStop(0.77, hue + '90');
                light.addColorStop(1, '#354052');
                c.fillStyle = '#354052';
                c.fillRect(0, 0, 16, 16);
                c.fillStyle = light;
                c.fillRect(0, 0, 16, 16);
            },
            { res: 1 },
        );
    }
}
