import { game } from './engine.js';

type Brush = Parameters<Parameters<typeof game.paint>[3]>[0];
export const NEON = ['#57d6e3', '#ee60a8', '#ffb566', '#aeff00', '#00ac4a', '#ff0000'];
export const NAMES = ['SORA', 'LOOP', 'KILO', 'VELA', 'AXON', 'NOVA'];
const SHOP_TYPES = ['OPTICS', 'TRANSIT', 'WORKS', 'RADIO', 'SYSTEMS', 'HOTEL'];
const W = 384,
    H = 768;
export const NIGHT_HAZE = '#0b081a';
function noise(seed: number) {
    return () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
}
function sign(c: Brush, k: number) {
    const hue = NEON[k % 6];
    c.fillStyle = '#111425';
    c.fillRect(0, 0, 128, 384);
    c.strokeStyle = hue;
    c.lineWidth = 3;
    c.strokeRect(6, 6, 116, 372);
    c.fillStyle = hue;
    c.fillRect(12, 12, 104, 54);
    c.fillStyle = '#1c1524';
    c.font = '900 35px Arial';
    c.textAlign = 'center';
    c.fillText('0' + (k + 1), 64, 51);
    c.fillStyle = hue;
    c.font = '900 58px Arial';
    for (let j = 0; j < 4; j++) c.fillText(NAMES[k][j], 64, 131 + j * 57);
    c.fillRect(20, 326, 88, 2);
    c.font = 'bold 13px Arial';
    c.fillText(SHOP_TYPES[k], 64, 351);
    for (let j = 0; j < 8; j++) c.fillRect(23 + j * 11, 361, 6, 5);
}
function windows(c: Brush, k: number) {
    const rand = noise(932 + k * 191);
    const colors = ['#273347', '#372e41', '#23303e', '#3a3642', '#283347', '#243744'];
    c.fillStyle = colors[k];
    c.fillRect(0, 0, 256, 512);
    const columns = [7, 4, 6, 5, 4, 8][k],
        rows = [12, 10, 15, 14, 11, 13][k];
    const stepX = 256 / columns,
        stepY = 512 / rows;
    for (let floor = 0; floor < rows; floor++) {
        const y = floor * stepY;
        const start = Math.floor(rand() * columns),
            span = 1 + Math.floor(rand() * 3);
        for (let i = 0; i < columns; i++) {
            const lit = (i >= start && i < start + span && rand() > 0.2) || (i === 1 && k === 5);
            c.fillStyle = lit
                ? ['#83abb9', '#d2ad90', '#467a90', '#a77a8e'][Math.floor(rand() * 4)]
                : '#192535';
            const paneWidth = stepX * (k % 2 ? 0.48 : 0.77),
                paneHeight = stepY * (k % 2 ? 0.71 : 0.43);
            c.fillRect(i * stepX + 4, y + 4, paneWidth, paneHeight);
            c.fillStyle = lit ? '#686879' : '#303847';
            c.fillRect(i * stepX + 4, y + 4 + paneHeight * 0.74, paneWidth, 2);
        }
        if (k % 3 === 0) {
            c.fillStyle = '#192034';
            c.fillRect(0, y + stepY - 4, 256, 4);
        }
    }
    if (k % 3 === 1) {
        // Recessed mechanical spine with stacked extractor louvres.
        c.fillStyle = '#171e2c';
        c.fillRect(146, 0, 47, 512);
        for (let y = 12; y < 500; y += 12) {
            c.fillStyle = y % 36 ? '#414153' : '#6d6972';
            c.fillRect(150, y, 37, 3);
        }
    } else if (k % 3 === 2) {
        c.fillStyle = '#4e4350';
        c.fillRect(34, 0, 9, 512);
        c.fillRect(207, 0, 9, 512);
    }
    c.fillStyle = '#43505d';
    c.fillRect(0, 0, 3, 512);
    c.fillRect(247, 0, 3, 512);
}
function shop(c: Brush, k: number) {
    const light = NEON[k % 3],
        type = k % 3;
    c.fillStyle = '#1e2532';
    c.fillRect(0, 0, 512, 192);
    c.fillStyle = '#48505c';
    c.fillRect(0, 4, 512, 4);
    c.fillStyle = '#121a29';
    c.fillRect(14, 16, 484, 37);
    c.fillStyle = light;
    c.font = 'bold 26px Arial';
    c.fillText(NAMES[k] + '   /   ' + SHOP_TYPES[k], 25, 44);
    c.fillRect(14, 53, 484, 3);
    for (let i = 0; i < 5; i++) {
        const x = 16 + i * 96;
        c.fillStyle = type === 1 ? '#343745' : '#303f50';
        c.fillRect(x, 66, 89, 106);
        if (type === 1 && i > 0) {
            c.fillStyle = '#202837';
            for (let j = 0; j < 10; j++) c.fillRect(x, 70 + j * 10, 89, 3);
        } else {
            const g = c.createLinearGradient(0, 67, 0, 169);
            g.addColorStop(0, type === 2 ? '#8a715e' : light);
            g.addColorStop(0.35, '#425067');
            g.addColorStop(1, '#1b2334');
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
        c.fillStyle = '#ffbb80';
        c.fillRect(189, 82, 84, 5);
        c.fillStyle = '#394452';
        c.fillRect(192, 94, 80, 77);
        c.fillStyle = '#94776a';
        c.fillRect(200, 99, 25, 36);
        c.fillRect(238, 99, 25, 36);
    }
    c.fillStyle = '#495462';
    c.fillRect(0, 178, 512, 5);
}
function pavement(c: Brush) {
    c.fillStyle = '#394252';
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
    c.fillStyle = '#18202d';
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
        glow.addColorStop(0, hue + '73');
        glow.addColorStop(0.49, hue + '23');
        glow.addColorStop(1, hue + '00');
        c.fillStyle = glow;
        c.fillRect(-137, -137, 274, 274);
        c.restore();
        for (let j = 0; j < 480; j++) {
            const x = cx + (rand() - rand()) * 128,
                y = cy + (rand() - rand()) * 330;
            c.fillStyle = hue;
            c.globalAlpha = 0.012 + rand() * 0.075;
            c.fillRect(x, y, 0.6 + rand() * 2, 3 + rand() * 32);
        }
        c.globalAlpha = 1;
    }
    for (let i = 0; i < 2200; i++) {
        c.fillStyle = i % 3 ? '#d2e6ff09' : '#02071925';
        c.fillRect(rand() * W, rand() * H, 1 + rand() * 3, 1 + rand() * 6);
    }
    for (const side of [-1, 1]) {
        const x = W / 2 + (side * W) / 6;
        for (let i = 0; i < 3; i++) {
            const y = ((i + 0.5) * H) / 3,
                h = (3.35 * H) / 24;
            c.save();
            c.shadowColor = '#8cceff';
            c.shadowBlur = 6;
            c.fillStyle = '#ddf5ff';
            c.fillRect(x - 1.76, y - h / 2, 3.52, h);
            c.restore();
            c.fillStyle = '#f2fcff';
            c.fillRect(x - 0.8, y - h / 2, 1.6, h);
        }
        const edge = W / 2 + side * (W / 2 - 6);
        c.fillStyle = '#47aab4';
        c.fillRect(edge - 1.3, 0, 2.6, H);
        c.fillStyle = '#62d5db23';
        c.fillRect(edge - 3, 0, 6, H);
        const localColor = NEON[side < 0 ? left : right];
        const spill = c.createLinearGradient(0, H * 0.36, 0, H * 0.64);
        spill.addColorStop(0, localColor + '00');
        spill.addColorStop(0.5, localColor);
        spill.addColorStop(1, localColor + '00');
        c.fillStyle = spill;
        c.fillRect(edge - 1.4, H * 0.36, 2.8, H * 0.28);
    }
}

export function prepareNightArt(): void {
    game.paint(
        'night-entry-lamp',
        8,
        32,
        (c) => {
            c.fillStyle = '#413743';
            c.fillRect(0, 0, 8, 32);
            c.fillStyle = '#ffc499';
            c.fillRect(2, 3, 4, 25);
        },
        { res: 1 },
    );
    game.paint(
        'night-sky',
        32,
        256,
        (c) => {
            const sky = c.createLinearGradient(0, 0, 0, 256);
            sky.addColorStop(0, '#17132c');
            sky.addColorStop(0.23, '#2b203a');
            sky.addColorStop(0.36, NIGHT_HAZE);
            c.fillStyle = sky;
            c.fillRect(0, 0, 32, 256);
        },
        { res: 1 },
    );
    game.paint(
        'night-crossing',
        512,
        64,
        (c) => {
            c.fillStyle = '#263041';
            c.fillRect(0, 0, 512, 64);
            for (let i = 0; i < 18; i++) {
                const x = 4 + i * 28;
                c.fillStyle = i % 6 < 3 ? '#576270' : '#365463';
                c.fillRect(x, 10, 24, 35);
                c.strokeStyle = '#202938';
                c.lineWidth = 3;
                c.beginPath();
                c.moveTo(x, 44);
                c.lineTo(x + 24, 10);
                c.stroke();
            }
            c.fillStyle = '#152132';
            c.fillRect(0, 46, 512, 13);
            c.fillStyle = '#799aa1';
            c.fillRect(0, 59, 512, 2);
        },
        { res: 1 },
    );
    for (let k = 0; k < NAMES.length; k++) {
        game.paint('night-sign-' + k, 128, 384, (c) => sign(c, k), { res: 1 });
        game.paint('night-windows-' + k, 256, 512, (c) => windows(c, k), { res: 1 });
        game.paint('night-shop-' + k, 512, 192, (c) => shop(c, k), { res: 1 });
    }
    for (let l = 0; l < 3; l++)
        for (let r = 0; r < 3; r++) game.paint('wet-' + l + '-' + r, W, H, (c) => road(c, l, r), { res: 1 });
    game.paint('night-paving', 96, 384, pavement, { res: 1 });
}
