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
const MIN_BIN_GAP = 2;
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

export function curbFitting(seed: number): Placement {
    return seed % 3 === 0 ? GROUPS.drain[0] : GROUPS.curb[0];
}

export function loadNightProps() {
    const models = new Set(Object.values(GROUPS).flat().map(p => p.model));
    for (const key of [LANTERNS, POST.model, ...GARAGE_PROPS]) models.add(key);
    return Promise.all(Array.from(models, key => game.modelFiles.load(key, 'assets/world/night_city/' + key + '.glb')));
}
