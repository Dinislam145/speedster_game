import { game, type Mesh } from './engine.js';

export const CRAFT_WIDTH = 2;
type Part = { obj: Mesh; x: number; y: number; z: number };
const HOVER = 0.58;
const BANK_LIMIT = 0.19;
export function spawnVehicle(night: boolean) {
    const parts: Part[] = [];
    function part(
        id: string,
        mesh: string,
        x: number,
        y: number,
        z: number,
        color: string,
        size: [number, number, number] = [1, 1, 1],
        jet = false,
    ) {
        const obj = game.spawn({ id, mesh, x, y: y + HOVER, z, color, size, rough: 0.58, unlit: jet });
        parts.push({ obj, x, y, z });
        return obj;
    }
    const craft = game.modelFiles.spawn('kestrel', { id: 'craft', size: 4.13, y: HOVER });
    for (const side of [-1, 1]) {
        const x = side * 0.56;
        const plume = part('exhaust' + side, 'jet', x, -0.222, 1.965, '#00e1ff', [1, 1, 1], true);
        plume.alpha = 0.63;
        part('exhaust-core' + side, 'jet', x, -0.19, 1.965, '#e80707', [0.6, 0.48, 1], true);
    }
    const shadow = game.spawn({
        id: 'hover-shadow',
        mesh: 'cylinder',
        x: 0,
        y: 0.012,
        z: 0.08,
        size: [1.98, 0.008, 3.25],
        color: night ? '#060c18' : '#233b46',
        alpha: night ? 0.62 : 0.25,
        unlit: true,
    });
    let bank = 0;
    return (x: number, lateralSpeed: number, throttle: number, seconds: number, dt: number) => {
        const target = -Math.max(-1, Math.min(1, lateralSpeed / 9)) * BANK_LIMIT;
        bank += (target - bank) * (1 - Math.exp(-13 * dt));
        const c = Math.cos(bank),
            s = Math.sin(bank),
            lift = HOVER + Math.sin(seconds * 3.2) * 0.035;
        craft.x = x;
        craft.y = lift;
        craft.roll = bank;
        shadow.x = x;
        for (const p of parts) {
            p.obj.x = x + c * p.x - s * p.y;
            p.obj.y = lift + s * p.x + c * p.y;
            p.obj.roll = bank;
            if (p.obj.id.startsWith('exhaust')) {
                const length = 0.09 + throttle * (0.86 + 0.08 * Math.sin(seconds * 32));
                p.obj.sz = p.obj.id.startsWith('exhaust-core') ? length * 0.66 : length;
            }
        }
    };
}
