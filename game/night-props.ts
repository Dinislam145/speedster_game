import { game } from './engine.js';
import { routeHash, type District } from './route.js';

type Placement = {
    model: string;
    along?: number;
    // Distance of the model centre from the back edge of the sidewalk towards the road.
    depth: number;
    base?: number;
    turn?: number;
    width?: number;
};
const BENCH_PLANTER_OFFSET = 1.28;
const BIN_DEPTH = 0.52;
const BAG_SLOTS = [
    { along: 0.56, depth: 0, turn: 0.24 },
    { along: -0.56, depth: -0.03, turn: -0.4 },
    { along: 0.13, depth: 0.46, turn: 0.65 },
];
export const MIN_BIN_GAP = 2;
const MIN_DOUBLE_BIN_GAP = 5;
export const MIN_PARK_GAP = 3.25;
const MIN_DOUBLE_BENCH_GAP = 7.8;
const PARK_BENCH_DEPTH = -0.55;
const PARK_TREE_DEPTH = -2.05;
const PARK_BENCH_SPACING = 3.35;
export const POST_SPACING = 6;
export const LANTERNS = 'market-lantern-string';
export const LANTERN_HEIGHT = 8.8;
export const GARAGE_PROPS = ['vending-machine', 'parked-scooter'] as const;
export const POST: Placement = { model: 'illuminated-bollard', depth: 2.37 };
// The alley between two frontages is dressed in depth bands, so the lot behind the
// sidewalk never reads as bare ground.
const GAP_FLOOR = -0.15;
const GAP_PATH_MODEL = 'paving-module';
const GAP_PATH_DEPTHS = [-4.3, -7.3, -10.3, -13.3, -16.3];
const GAP_PATH_ACROSS = 2.7;
const GAP_COLUMN = 3.2;
const GAP_TREE_INSET = 0.85;
const GAP_TREE_TURNS = 8;
const GAP_BENCH_INSET = 0.62;
const GAP_BENCH_TURN = Math.PI / 2;
const GAP_BENCH_MIN_WIDTH = 4.6;
const GAP_YARD_DEPTHS = [-4.1, -5.6];
const GROUPS = {
    ramen: [
        { model: 'ramen-counter-facade', depth: 0.44 },
        { model: 'menu-board', along: 2.05, depth: 1.28, turn: 0.23 },
    ],
    bar: [
        { model: 'takeaway-bar-facade', depth: 0.28 },
        { model: 'menu-board', along: 1.46, depth: 1.06, turn: -0.18 },
    ],
    market: [
        { model: 'minimart-facade', depth: 0.28 },
        { model: 'delivery-crate', along: 2.42, depth: 0.42 },
    ],
    pharmacy: [{ model: 'pharmacy-blade-sign', depth: 0.06, base: 2.85, turn: -Math.PI / 2 }],
    drinks: [{ model: 'vending-machine', depth: 0.37 }],
    rest: [
        { model: 'slatted-bench', depth: 0.46 },
        { model: 'leaf-planter', depth: 0.46, along: -BENCH_PLANTER_OFFSET },
        { model: 'leaf-planter', depth: 0.46, along: BENCH_PLANTER_OFFSET },
    ],
    greenery: [{ model: 'leaf-planter', depth: 0.70 }],
    delivery: [{ model: 'delivery-crate', depth: 0.54 }],
    scooter: [{ model: 'parked-scooter', depth: 0.68, turn: 0.16 }],
    refuse: [{ model: 'recycling-bin', depth: BIN_DEPTH }],
    bags: [{ model: 'tied-trash-bag', depth: BIN_DEPTH }],
    drain: [{ model: 'storm-drain', depth: 2.45, base: -0.021 }],
    curb: [{ model: 'curb-light', depth: 2.72, base: -0.143 }],
    paving: [{ model: 'paving-module', depth: -1.38, base: -0.15 }],
    tree: [{ model: 'flowering-street-tree', depth: 1.45 }],
} satisfies Record<string, Placement[]>;
type Group = keyof typeof GROUPS;
type Layout = { primary: Group[]; opposite: Group[] };
const DISTRICTS: Record<District, Layout> = {
    retail: {
        primary: ['ramen', 'market', 'bar'],
        opposite: ['market', 'drinks', 'bar', 'drinks', 'ramen'],
    },
    residential: {
        primary: ['rest', 'bar', 'drinks', 'ramen'],
        opposite: ['rest', 'greenery', 'scooter', 'drinks'],
    },
    industrial: {
        primary: ['drinks', 'bar', 'refuse'],
        opposite: ['delivery', 'refuse', 'scooter'],
    },
};

function refuse(seed: number, along: number, depth: number, minimum = 1): Placement[] {
    const hand = (seed & 1) ? 1 : -1;
    const count = minimum + (seed >>> 1) % (4 - minimum);
    return [
        { ...GROUPS.refuse[0], along, depth },
        ...BAG_SLOTS.slice(0, count).map(bag => ({
            ...GROUPS.bags[0], along: along + hand * bag.along, depth: depth + bag.depth, turn: hand * bag.turn,
        })),
    ];
}

export function streetGroup(district: District, seed: number, garage: boolean, lotWidth: number): Placement[] {
    if (!lotWidth || garage) return [];
    const layout = DISTRICTS[district];
    const placements: Placement[] = [];
    const hand = (routeHash(seed + 81) & 1) ? 1 : -1;
    const pick = (choices: Group[], salt: number) => choices[routeHash(seed + salt) % choices.length];
    function place(group: Group, at: number, facing = 1) {
        if (group === 'refuse') {
            placements.push(...refuse(routeHash(seed + facing), hand * at, BIN_DEPTH));
            return;
        }
        for (const prop of GROUPS[group] as Placement[]) {
            placements.push({ ...prop, along: hand * (at + facing * (prop.along ?? 0)) });
        }
    }

    const bay = Math.min(3.55, lotWidth * 0.25);
    const main = pick(layout.primary, 59);
    place(main, bay);
    const options = layout.opposite.filter(group => group !== main);
    place(pick(options, 13), -bay, -1);
    if (district === 'retail' && lotWidth > 9 && routeHash(seed + 31) % 3 === 0)
        place('pharmacy', -bay, -1);
    return placements;
}

export function streetGap(industrial: boolean, seed: number, width: number): Placement[] {
    if (industrial) {
        if (width < MIN_BIN_GAP) return [];
        if (width < MIN_DOUBLE_BIN_GAP) return refuse(seed, 0, -0.65, 2);
        return [
            ...refuse(seed, -width * 0.25, -0.65, 2),
            ...refuse(routeHash(seed), width * 0.25, -1.6, 2),
            { ...GROUPS.delivery[0], depth: -1.95 },
        ];
    }
    if (width < MIN_PARK_GAP) return width >= MIN_BIN_GAP ? GROUPS.greenery : [];
    const benches = width < MIN_DOUBLE_BENCH_GAP ? [0] : [-PARK_BENCH_SPACING / 2, PARK_BENCH_SPACING / 2];
    return [
        { ...GROUPS.paving[0], width: Math.min(width, 9) },
        { ...GROUPS.tree[0], depth: PARK_TREE_DEPTH, turn: (seed % 8) * Math.PI / 4 },
        ...benches.flatMap(at => GROUPS.rest.map(prop => ({
            ...prop, along: at + (prop.along ?? 0), depth: PARK_BENCH_DEPTH,
        }))),
    ];
}

// A park alley: a paved path down the middle, flowering trees alternating sides,
// benches and planters facing it from the walls, band after band into the lot.
export function parkGap(seed: number, width: number): Placement[] {
    const placements: Placement[] = [];
    const columns = Math.max(1, Math.round(width / GAP_COLUMN));
    const columnWidth = width / columns;
    const rim = Math.max(0, width / 2 - GAP_TREE_INSET);
    for (const [band, depth] of GAP_PATH_DEPTHS.entries()) {
        const row = routeHash(seed + band * 131);
        for (let column = 0; column < columns; column++) {
            placements.push({
                model: GAP_PATH_MODEL,
                along: -width / 2 + (column + 0.5) * columnWidth,
                depth,
                base: GAP_FLOOR,
                width: Math.min(GAP_PATH_ACROSS, columnWidth - 0.1),
            });
        }
        // Sakura, one per column in a staggered grid, every tree turned differently.
        const tree = (along: number) => placements.push({
            model: 'flowering-street-tree',
            along,
            depth: depth + 0.4,
            base: GAP_FLOOR,
            turn: (routeHash(row + Math.round(along * 10)) % GAP_TREE_TURNS) * Math.PI / GAP_TREE_TURNS,
        });
        if (columns === 1) tree((row & 1 ? 1 : -1) * rim * (0.75 + ((row >>> 8) % 25) / 100));
        else for (let column = 0; column < columns; column++) {
            if ((column + band) % 2) continue;
            tree(-width / 2 + (column + 0.5) * columnWidth);
        }
        if (width < GAP_BENCH_MIN_WIDTH || band % 2 !== 0) continue;
        // Benches stand along both walls, turned to face the middle of the alley.
        for (const wall of [-1, 1]) {
            const along = wall * (width / 2 - GAP_BENCH_INSET);
            placements.push({
                model: 'slatted-bench', along, depth: depth + 0.9, base: GAP_FLOOR,
                turn: wall * GAP_BENCH_TURN,
            });
            placements.push({ model: 'leaf-planter', along, depth: depth - 0.9, base: GAP_FLOOR });
        }
    }
    return placements;
}

// A service yard: crates, bins and bags between the sidewalk and the fences that
// close the alley off.
export function serviceGap(seed: number, width: number): Placement[] {
    if (width < MIN_BIN_GAP) return [];
    const row = routeHash(seed + 613);
    const hand = row & 1 ? 1 : -1;
    const along = Math.min(width / 4, 1.1);
    const [crates, bins] = GAP_YARD_DEPTHS;
    return [
        { model: 'delivery-crate', along: hand * along, depth: crates, base: GAP_FLOOR },
        { model: 'delivery-crate', along: hand * along, depth: crates, base: GAP_FLOOR + 0.4, turn: 0.18 },
        { model: 'delivery-crate', along: -hand * along, depth: bins + 0.5, base: GAP_FLOOR, turn: 0.35 },
        { model: 'recycling-bin', along: -hand * along, depth: bins, base: GAP_FLOOR },
        { model: 'tied-trash-bag', along: hand * along * 1.3, depth: bins + 0.9, base: GAP_FLOOR, turn: 0.4 },
        { model: 'tied-trash-bag', along: hand * along * 1.3 + 0.5, depth: bins + 1.1, base: GAP_FLOOR, turn: -0.5 },
    ];
}

export function curbFitting(seed: number): Placement {
    return seed % 3 === 0 ? GROUPS.drain[0] : GROUPS.curb[0];
}

export function loadNightProps() {
    const models = new Set(Object.values(GROUPS).flat().map(p => p.model));
    for (const key of [LANTERNS, POST.model, ...GARAGE_PROPS]) models.add(key);
    return Promise.all(Array.from(models, key => game.modelFiles.load(key, 'assets/world/night_city/' + key + '.glb')));
}
