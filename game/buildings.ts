import { game } from './engine.js';
import type { District } from './route.js';

const GARAGES = ['depot_closed', 'depot_left', 'depot_middle', 'depot_outer', 'depot_all'] as const;
const TOWERS = ['prism', 'spire'] as const;
const MODELS = ['arcade', ...TOWERS, ...GARAGES] as const;
const FRONTAGES = {
    retail: ['arcade', 'arcade', 'prism', 'garage'],
    residential: ['prism', 'spire', 'arcade'],
    industrial: ['garage', 'garage', 'prism'],
} as const;

export type Building = (typeof MODELS)[number];
export function loadBuildings() {
    return Promise.all(MODELS.map((key) => game.modelFiles.load(key, 'assets/' + key + '.glb')));
}
export function frontage(district: District, seed: number): Building {
    const choices = FRONTAGES[district];
    const key = choices[seed % choices.length];
    return key === 'garage' ? GARAGES[(seed >>> 8) % GARAGES.length] : key;
}
export function tower(seed: number): Building {
    return TOWERS[seed % TOWERS.length];
}
export function buildingSize(key: Building) {
    return game.modelFiles.get(key)!.size;
}
export function spawnBuilding(key: Building, id: string, scale: number, base: number, side: number) {
    const { x, y, z } = buildingSize(key);
    return game.modelFiles.spawn(key, {
        id, tags: ['building'], size: Math.max(x, y, z) * scale,
        y: base + y * scale / 2, yaw: side * Math.PI / 2,
    });
}
