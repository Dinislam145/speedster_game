import { game } from './engine.js';

type Brush = Parameters<Parameters<typeof game.paint>[3]>[0];
export const NEON = ['#57d6e3', '#ee60a8', '#ffb566', '#aeff00', '#00ac4a', '#ff0000'];
export const DOOR_LIGHTS = ['#f0b276', '#83d5dc', '#c3a6ed', '#d7909c', '#b5d89b', '#dfcda0'];
export const WINDOW_COLORS = ['#33dfea', '#5e9dff', '#bb86ff', '#f881c7', '#f5b666', '#a5e467'];
export const NAMES = ['天穹', '环线', '千机', '幻波', '轴心', '新星'];
const SHOP_TYPES = ['光学', '交通', '工坊', '电台', '系统', '酒店'];
const SIGN_WIDTH = 128;
const SIGN_HEIGHT = 384;
const SIGN_LEVELS = [
    { res: 1, borderPixels: 3, opacity: 1 },
    { res: 0.375, borderPixels: 2.25, opacity: 0.91 },
    { res: 0.1875, borderPixels: 2, opacity: 0.82 },
    { res: 0.09375, borderPixels: 1.25, opacity: 0.58 },
];
export const TUBE_CORES = ['#d7fcff', '#ffe0f2', '#ffedcf', '#efffce', '#c9ffde', '#ffd1d5'];
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
export const NIGHT_HAZE = '#020308';
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
    c.font = '700 16px "Speedster Chinese", sans-serif';
    c.fillText(SHOP_TYPES[k], 64, 351);
    for (let j = 0; j < 8; j++) c.fillRect(23 + j * 11, 361, 6, 5);
}

function paintSignName(c: Brush, style: number, level: number, resolution: number): void {
    const hue = NEON[style];
    c.save();
    c.font = '700 74px "Speedster Chinese", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    for (const [row, character] of Array.from(NAMES[style]).entries()) {
        const y = 133 + row * 116;
        c.strokeStyle = hue;
        c.shadowColor = hue;
        c.shadowBlur = 12 * resolution;
        c.lineWidth = [6, 7, 8, 10][level];
        c.strokeText(character, 64, y);
        c.shadowBlur = 0;
        c.fillStyle = TUBE_CORES[style];
        c.fillText(character, 64, y);
    }
    c.restore();
}

function prepareSign(style: number): number[] {
    // Average the artwork before it goes into the mesh atlas, which has no mip levels.
    const source =
        typeof OffscreenCanvas === 'undefined' ? null : new OffscreenCanvas(SIGN_WIDTH, SIGN_HEIGHT);
    const brush = source?.getContext('2d');
    if (brush) sign(brush, style);
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
                paintSignName(c, style, level, res);
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

function road(c: Brush) {
    const rand = noise(2401);
    c.fillStyle = '#111724';
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < 2200; i++) {
        c.fillStyle = i % 3 ? '#d2e6ff09' : '#02071925';
        c.fillRect(rand() * W, rand() * H, 1 + rand() * 3, 1 + rand() * 6);
    }
}

// The lane markings are paint. Light on the asphalt comes from the storefront spill.
function roadMarkings(c: Brush, level: number) {
    const width = [3.52, 4.2, 6.2][level];
    const edgeWidth = [2.6, 3.1, 4.8][level];
    for (const side of [-1, 1]) {
        const x = W / 2 + (side * W) / 6;
        c.fillStyle = ['#a8b3c1', '#9ba6b5', '#8490a0'][level];
        for (let i = 0; i < 3; i++) {
            const y = ((i + 0.5) * H) / 3;
            const height = (3.35 * H) / 24;
            c.fillRect(x - width / 2, y - height / 2, width, height);
        }
        const edge = W / 2 + side * (W / 2 - 6);
        c.fillStyle = '#546a76';
        c.fillRect(edge - edgeWidth / 2, 0, edgeWidth, H);
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
    const swatchWidth = 16;
    const glowHeight = 32;
    const propSpillSize = 64;
    game.paint('night-prop-spill', propSpillSize, propSpillSize, c => {
        const centre = propSpillSize / 2;
        const glow = c.createRadialGradient(centre, centre, 0, centre, centre, centre);
        glow.addColorStop(0, '#ffffff');
        glow.addColorStop(0.4, '#ffffff88');
        glow.addColorStop(0.75, '#ffffff24');
        glow.addColorStop(1, '#ffffff00');
        c.fillStyle = glow;
        c.fillRect(0, 0, propSpillSize, propSpillSize);
    });
    game.paint('night-window-glow', swatchWidth * WINDOW_COLORS.length, glowHeight, c => {
        WINDOW_COLORS.forEach((color, index) => {
            const glow = c.createLinearGradient(0, 0, 0, glowHeight);
            glow.addColorStop(0, color);
            glow.addColorStop(0.48, color);
            glow.addColorStop(1, '#202635');
            c.fillStyle = glow;
            c.fillRect(index * swatchWidth, 0, swatchWidth, glowHeight);
        });
    }, { res: 1 });
    game.paint('night-store-glow', 16, glowHeight, c => {
        const glow = c.createLinearGradient(0, 0, 0, glowHeight);
        glow.addColorStop(0, '#ffffff');
        glow.addColorStop(0.48, '#a0a0a0');
        glow.addColorStop(1, '#272727');
        c.fillStyle = glow;
        c.fillRect(0, 0, 16, glowHeight);
    }, { res: 1 });
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
        'night-sky',
        32,
        256,
        (c) => {
            const sky = c.createLinearGradient(0, 0, 0, 256);
            sky.addColorStop(0, '#03040a');
            sky.addColorStop(0.23, '#04050d');
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
        paintStreetLevels('night-shop-name-' + k, 256, 40, FACADE_SCALES, (c) => {
            c.fillStyle = '#131925';
            c.fillRect(0, 0, 256, 40);
            c.fillStyle = '#eef5ff';
            c.font = '700 24px "Speedster Chinese", sans-serif';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText(NAMES[k] + '  /  ' + SHOP_TYPES[k], 128, 21, 234);
        });
    }
    paintStreetLevels('night-road', W, H, SURFACE_SCALES, road, roadMarkings);
    paintStreetLevels('night-paving', 96, 384, SURFACE_SCALES, pavement);
}
