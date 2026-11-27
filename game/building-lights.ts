import { game } from './engine.js';
import openings from './building-openings.json';
import type { Building } from './buildings.js';
import { WINDOW_COLORS } from './night-art.js';
import { routeHash } from './route.js';

type Pane = number[]; // x, y, z, width, height in the GLB's metre coordinates, optional swatch U
const PATTERNS = 4;
const COLOR_PATTERNS = 4;
// The authored panels sit at the back of the recess. Place the luminous
// glazing at the outer frame so the jambs don't mask it on corner approaches.
const WINDOW_GLASS_OFFSET = 0.505;
const SHOP_GLASS_OFFSET = 0.905;
const geometry = new Map<Building, { windows: string[][]; entry: string | undefined }>();

// Only the bays a variant actually leaves open; a fully shuttered depot has none.
export function garageBays(key: Building) {
    const source = openings[key];
    return 'entries' in source ? source.entries : [];
}

function paneMesh(name: string, panes: Pane[], faceOffset = 0): string | undefined {
    if (!panes.length) return undefined;
    const verts: number[] = [];
    for (const [x, y, z, width, height, swatch] of panes) {
        for (const [u, v] of [[0, 1], [1, 1], [1, 0], [0, 1], [1, 0], [0, 0]]) {
            verts.push(x + (u - 0.5) * width, y + (0.5 - v) * height, z + faceOffset, 0, 0, 1, swatch ?? u, v);
        }
    }
    game.world3d.defineMesh(name, new Float32Array(verts));
    return name;
}

export function facadeLights(key: Building) {
    const cached = geometry.get(key);
    if (cached) return cached;
    const source = openings[key];
    const windows = 'windows' in source ? source.windows : openings.depot_closed.windows;
    const columns = Math.max(...windows.map(([, column]) => column));
    const patterns = Array.from({ length: PATTERNS }, (_, pattern) => {
        const lit = windows.filter(([floor, column]) => {
            const row = routeHash(floor + pattern * 197);
            const group = (column + row % columns) % columns < Math.ceil(columns / 2);
            const limit = row % 7 === 0 ? 18 : group ? 86 : 41;
            return routeHash(row ^ column) % 100 < limit;
        });
        return Array.from({ length: COLOR_PATTERNS }, (_, colors) => {
            const panes = lit.map(([floor, column, ...pane]) => {
                const color = routeHash((floor * 31 + column) ^ Math.imul(colors + 1, 0x85ebca6b));
                // Sample the centre of the swatch to avoid blending adjacent colours.
                return [...pane, (color % WINDOW_COLORS.length + 0.5) / WINDOW_COLORS.length];
            });
            return paneMesh(key + '-windows-' + pattern + '-' + colors, panes, WINDOW_GLASS_OFFSET)!;
        });
    });
    const entryOffset = key.startsWith('depot_') ? 0 : SHOP_GLASS_OFFSET;
    const result = { windows: patterns, entry: paneMesh(key + '-entry', source.entries, entryOffset) };
    geometry.set(key, result);
    return result;
}
