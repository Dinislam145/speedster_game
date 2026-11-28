import { CRAFT_BODY } from './drive-profile.js';
import { game } from './engine.js';

const HOVER = 0.58;
const BANK_LIMIT = 0.19;
const EXHAUST_Y = -0.222;
const NIGHT_EXHAUST_ALPHA = 0.36;
export function spawnVehicle(night: boolean) {
    const craft = game.modelFiles.spawn('kestrel', { id: 'craft', size: CRAFT_BODY.halfLength * 2, y: HOVER });
    const exhausts = [-1, 1].map((side) => {
        const x = side * 0.56;
        const obj = game.spawn({
            id: 'exhaust' + side,
            mesh: 'jet',
            x,
            y: EXHAUST_Y + HOVER,
            z: 1.965,
            unlit: true,
            texture: 'jet-flame',
            alpha: night ? NIGHT_EXHAUST_ALPHA : 0.9,
        });
        return { obj, x };
    });
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
        const length = 0.09 + throttle * (0.86 + 0.08 * Math.sin(seconds * 32));
        for (const jet of exhausts) {
            jet.obj.x = x + c * jet.x - s * EXHAUST_Y;
            jet.obj.y = lift + s * jet.x + c * EXHAUST_Y;
            jet.obj.roll = bank;
            jet.obj.sz = length;
        }
    };
}
