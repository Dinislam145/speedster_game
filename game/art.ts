import { game } from './engine.js';

type Point = [x: number, y: number, z: number, u: number];
// Each cross-section narrows at its upper and lower shoulders. Flat normals keep
// the change of plane visible even on the small screen.
type Station = [z: number, halfWidth: number, bottom: number, top: number];
function hull(name: string, stations: Station[]): void {
    const verts: number[] = [];
    const rings = stations.map(([z, w, low, high]): Point[] => [
        [-w * 0.65, low, z, 0.175],
        [w * 0.65, low, z, 0.825],
        [w, low + (high - low) * 0.42, z, 1],
        [w * 0.69, high, z, 0.845],
        [-w * 0.69, high, z, 0.155],
        [-w, low + (high - low) * 0.42, z, 0],
    ]);
    function triangle(a: Point, b: Point, c: Point): void {
        const ab = b.slice(0, 3).map((v, i) => v - a[i]),
            ac = c.slice(0, 3).map((v, i) => v - a[i]);
        const n = [
            ab[1] * ac[2] - ab[2] * ac[1],
            ab[2] * ac[0] - ab[0] * ac[2],
            ab[0] * ac[1] - ab[1] * ac[0],
        ];
        const length = Math.hypot(...n);
        // Each ring spans the same UV width, so the centreline and the edges
        // of the colour gradient taper together through the length of the jet.
        for (const [x, y, z, u] of [a, b, c]) {
            const v = 0.015 + (z + 0.01) * 0.96;
            verts.push(x, y, z, n[0] / length, n[1] / length, n[2] / length, u, v);
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

            const coreLength = 78;
            for (let y = 0; y < coreLength; y++) {
                const t = y / coreLength;
                const radius = 13 * (1 - t * t);
                const strength = (1 - t) ** 1.35;
                const glow = c.createLinearGradient(32 - radius, 0, 32 + radius, 0);
                glow.addColorStop(0, 'rgba(255, 94, 66, 0)');
                glow.addColorStop(0.27, 'rgba(255, 94, 66, 0.65)');
                glow.addColorStop(0.5, '#fff2cb');
                glow.addColorStop(0.73, 'rgba(255, 94, 66, 0.65)');
                glow.addColorStop(1, 'rgba(255, 94, 66, 0)');
                c.globalAlpha = strength;
                c.fillStyle = glow;
                c.fillRect(32 - radius, y, 2 * radius, 1);
            }
            c.globalAlpha = 1;
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
