import { game } from './engine.js';

type Point = [number, number, number];
// Each cross-section narrows at its upper and lower shoulders. Flat normals keep
// the change of plane visible even on the small screen.
type Station = [z: number, halfWidth: number, bottom: number, top: number];
function hull(name: string, stations: Station[]): void {
    const verts: number[] = [];
    const rings = stations.map(([z, w, low, high]): Point[] => [
        [-w * 0.65, low, z],
        [w * 0.65, low, z],
        [w, low + (high - low) * 0.42, z],
        [w * 0.69, high, z],
        [-w * 0.69, high, z],
        [-w, low + (high - low) * 0.42, z],
    ]);
    function triangle(a: Point, b: Point, c: Point): void {
        const ab = b.map((v, i) => v - a[i]),
            ac = c.map((v, i) => v - a[i]);
        const n = [
            ab[1] * ac[2] - ab[2] * ac[1],
            ab[2] * ac[0] - ab[0] * ac[2],
            ab[0] * ac[1] - ab[1] * ac[0],
        ];
        const length = Math.hypot(...n);
        // Project both colours onto one hull so the outer flame cannot cover its red core.
        for (const p of [a, b, c]) {
            const u = 0.5 + p[0] * 3.1;
            const v = 0.015 + (p[2] + 0.01) * 0.96;
            verts.push(...p, n[0] / length, n[1] / length, n[2] / length, u, v);
        }
    }
    for (let row = 1; row < rings.length; row++) {
        const front = rings[row - 1],
            rear = rings[row];
        for (let i = 0; i < 6; i++) {
            const j = (i + 1) % 6;
            triangle(front[i], front[j], rear[j]);
            triangle(front[i], rear[j], rear[i]);
        }
    }
    const front = rings[0],
        rear = rings[rings.length - 1];
    for (let i = 1; i < 5; i++) {
        triangle(front[0], front[i + 1], front[i]);
        triangle(rear[0], rear[i], rear[i + 1]);
    }
    game.world3d.defineMesh(name, new Float32Array(verts));
}

export function makeArt(): void {
    hull('jet', [
        [-0.01, 0.155, -0.09, 0.09],
        [0.38, 0.105, -0.065, 0.065],
        [1, 0.006, -0.008, 0.008],
    ]);
    game.paint(
        'jet-flame',
        64,
        128,
        (c) => {
            const plume = c.createLinearGradient(0, 0, 0, 128);
            plume.addColorStop(0, '#9ef6ff');
            plume.addColorStop(0.4, '#21d9ff');
            plume.addColorStop(1, '#009eff');
            c.fillStyle = plume;
            c.fillRect(0, 0, 64, 128);

            const core = c.createLinearGradient(0, 0, 0, 94);
            core.addColorStop(0, '#ff775b');
            core.addColorStop(0.22, '#ff3d39');
            core.addColorStop(0.8, '#ed263f');
            core.addColorStop(1, '#ed263f00');
            c.fillStyle = core;
            c.beginPath();
            c.moveTo(20, 0);
            c.quadraticCurveTo(13, 34, 32, 94);
            c.quadraticCurveTo(51, 34, 44, 0);
            c.closePath();
            c.fill();
        },
        { res: 1 },
    );
    game.paint(
        'daylight',
        720,
        1280,
        (ctx) => {
            const sky = ctx.createLinearGradient(0, 0, 0, 500);
            sky.addColorStop(0, '#66b7d4');
            sky.addColorStop(0.65, '#b8dedf');
            sky.addColorStop(1, '#e0e8da');
            ctx.fillStyle = sky;
            ctx.fillRect(0, 0, 720, 1280);
            ctx.fillStyle = '#fff1c4';
            ctx.beginPath();
            ctx.arc(519, 222, 48, 0, Math.PI * 2);
            ctx.fill();
            // Long flat cloud banks echo the horizontal tiers of the city.
            for (const [x, y, w] of [
                [45, 152, 136],
                [316, 104, 88],
                [434, 246, 155],
                [117, 226, 61],
            ]) {
                ctx.fillStyle = '#eff4e7';
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + w * 0.22, y - 3);
                ctx.lineTo(x + w * 0.31, y - 9);
                ctx.lineTo(x + w * 0.51, y - 9);
                ctx.lineTo(x + w * 0.58, y - 4);
                ctx.lineTo(x + w * 0.84, y - 4);
                ctx.lineTo(x + w, y);
                ctx.closePath();
                ctx.fill();
            }
        },
        { res: 1 },
    );
}
