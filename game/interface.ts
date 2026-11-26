import { game } from './engine.js';

const INK = '#142d3a',
    PAPER = '#fff4da',
    ORANGE = '#ff692e';
const frames = new Map<string, { frame: number; width: number; height: number }>();
type Brush = Parameters<Parameters<typeof game.paint>[3]>[0];

function paint(key: string, width: number, height: number, draw: (ctx: Brush) => void): void {
    frames.set(key, { frame: game.paint(key, width, height, draw), width, height });
}
function lettering(
    ctx: Brush,
    text: string,
    x: number,
    y: number,
    size: number,
    color: string,
    weight = 700,
): void {
    ctx.font = weight + ' ' + size + 'px Arial, sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}
function cutPanel(ctx: Brush, w: number, h: number, color: string): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, h - 15);
    ctx.lineTo(w - 15, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
}

export function prepareInterface(): void {
    paint('masthead', 628, 154, (c) => {
        cutPanel(c, 628, 154, INK);
        c.fillStyle = ORANGE;
        c.fillRect(0, 0, 8, 154);
        c.save();
        c.translate(28, 0);
        c.transform(1, 0, -0.16, 1, 0, 0);
        lettering(c, 'SPEEDSTER', 12, 96, 94, PAPER, 900);
        c.restore();
        c.fillStyle = ORANGE;
        for (let i = 0; i < 3; i++) {
            c.beginPath();
            c.moveTo(28 + i * 12, 120);
            c.lineTo(36 + i * 12, 120);
            c.lineTo(30 + i * 12, 134);
            c.lineTo(22 + i * 12, 134);
            c.fill();
        }
        lettering(c, 'СВОБОДНЫЙ ЗАЕЗД', 79, 135, 21, '#b6d5cc');
    });
    for (const [key, label] of [
        ['start', 'СТАРТ'],
        ['resume', 'ПРОДОЛЖИТЬ'],
        ['restart', 'НАЧАТЬ СНАЧАЛА'],
    ]) {
        paint(key, 428, 78, (c) => {
            cutPanel(c, 428, 78, key === 'restart' ? INK : ORANGE);
            const color = key === 'restart' ? PAPER : INK;
            lettering(c, label, 26, 50, 31, color, 800);
            c.strokeStyle = color;
            c.lineWidth = 4;
            c.beginPath();
            c.moveTo(376, 39);
            c.lineTo(401, 39);
            c.moveTo(392, 30);
            c.lineTo(402, 39);
            c.lineTo(392, 48);
            c.stroke();
        });
    }
    paint('hint', 486, 60, (c) => {
        cutPanel(c, 486, 60, INK);
        lettering(c, 'Веди пальцем влево и вправо', 27, 39, 28, PAPER);
    });
    paint('telemetry', 218, 92, (c) => {
        cutPanel(c, 218, 92, INK);
        c.fillStyle = ORANGE;
        c.fillRect(0, 0, 6, 92);
        lettering(c, 'ДИСТАНЦИЯ / М', 20, 27, 16, '#b6d5cc');
    });
    paint('pause-key', 74, 74, (c) => {
        cutPanel(c, 74, 74, INK);
        c.fillStyle = PAPER;
        c.fillRect(23, 20, 9, 34);
        c.fillRect(42, 20, 9, 34);
    });
    paint('pause-title', 428, 80, (c) => {
        cutPanel(c, 428, 80, INK);
        lettering(c, 'ПАУЗА', 25, 59, 57, PAPER, 900);
    });
}

export function showGraphic(key: string, x: number, y: number) {
    const graphic = frames.get(key)!;
    return game.spawn({ id: key + '-art', layer: 'hud', x, y, ...graphic });
}
// The painted face supplies the Cyrillic lettering on every platform; the UI
// widget owns pointer capture, keyboard focus, hit testing and activation.
export function control(key: string, x: number, y: number, click: () => void): void {
    const { width, height } = frames.get(key)!;
    showGraphic(key, x, y);
    game.ui.button({
        id: key,
        anchor: 'center',
        x: x - game.screen.width / 2,
        y: y - game.screen.height / 2,
        w: width,
        h: height,
        safeArea: false,
        onClick: click,
        style: {
            fill: '#00000000',
            border: 0,
            shadow: 0,
            gloss: 0,
            bevel: 0,
            radius: 0,
        },
    });
}
