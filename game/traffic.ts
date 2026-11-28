import { game } from './engine.js';
import colliders from './assets/npc_cars/colliders.json';
import { CRAFT_BODY, SIDE_MARGIN } from './drive-profile.js';
import { LANES, safeAcross, safeRoute, type SafeSegment } from './safe-route.js';
import { FRAGMENT_LENGTH, NIGHT_PROFILE } from './route.js';
import { RETIRE_DISTANCE, planTraffic, positionAt } from './traffic-plan.js';

const MODELS = [
    'amber_box_van', 'crimson_service_van', 'graphite_crossover', 'lagoon_fastback',
    'midnight_sport', 'saffron_pickup', 'turquoise_pickup', 'violet_sedan',
] as const;
const HOVER_CLEARANCE = 0.30;
const SHADOW_Y = 0.017;
const PATH_MESH = 'traffic-safe-route';
const PATH_Y = 0.035;
const PATH_STEP = 2;

type RoadPose = { x: number; z: number; yaw: number };

export function loadTraffic() {
    return Promise.all(MODELS.map(key => game.modelFiles.load(key, 'assets/npc_cars/' + key + '.glb')));
}

export function trafficAcross(width: number, car: { lane: number; jitter: number }): number {
    return (car.lane * width) / LANES.length + car.jitter;
}

function spawnTrafficParts(key: string, id: string, night: boolean) {
    const { x, y, z } = game.modelFiles.get(key)!.size;
    const model = game.modelFiles.spawn(key, {
        id, tags: ['npc-car'], size: Math.max(x, y, z), y: HOVER_CLEARANCE + y / 2,
    });
    const shadow = game.spawn({
        id: id + '-shadow', mesh: 'cylinder', y: SHADOW_Y,
        size: [x * 0.84, 0.008, z * 0.88],
        color: night ? '#060c18' : '#233b46', alpha: night ? 0.62 : 0.25, unlit: true,
    });
    return [...model.parts, shadow];
}

export type TrafficReport = {
    traffic: number;
    trafficGap: number | null;
    trafficSpeeds: number[];
    safePassage: SafeSegment[];
};

let showTrafficBoxes = true;
export function toggleTrafficBoxes(): boolean {
    showTrafficBoxes = !showTrafficBoxes;
    return showTrafficBoxes;
}

let showSafeRoute = true;
export function toggleSafeRoute(): boolean {
    showSafeRoute = !showSafeRoute;
    return showSafeRoute;
}

function pathVertices(segments: readonly SafeSegment[], from: number, end: number, laneWidth: number,
    place: (distance: number, offset: { lane: number; jitter: number }) => RoadPose,
): Float32Array {
    const vertices: number[] = [];
    const halfWidth = CRAFT_BODY.halfWidth + SIDE_MARGIN;
    for (const segment of segments) {
        const first = Math.max(from, segment.from);
        const last = Math.min(end, segment.to);
        const edge = (along: number, side: number) => {
            const across = safeAcross(segment, along, laneWidth) + side * halfWidth;
            const { x, z } = place(along, { lane: 0, jitter: across });
            return [x, PATH_Y, z, 0, 1, 0, 0, 0];
        };
        for (let along = first; along < last; along += PATH_STEP) {
            const next = Math.min(along + PATH_STEP, last);
            const a = edge(along, -1);
            const b = edge(along, 1);
            const c = edge(next, 1);
            const d = edge(next, -1);
            vertices.push(...a, ...b, ...c, ...a, ...c, ...d);
        }
    }
    return new Float32Array(vertices);
}

export function buildTraffic(seed: number, night: boolean, dayWidth: number) {
    const bodies = MODELS.map(key => {
        const { x, y, z } = game.modelFiles.get(key)!.size;
        const scale = Math.max(x, y, z);
        const { size, offset } = colliders[key];
        return {
            key,
            halfWidth: (size[0] / 2 + Math.abs(offset[0])) * scale,
            halfLength: (size[2] / 2 + Math.abs(offset[2])) * scale,
        };
    });
    const minWidth = night ? Math.min(...NIGHT_PROFILE.widths, NIGHT_PROFILE.startWidth) : dayWidth;
    const maxWidth = night ? Math.max(...NIGHT_PROFILE.widths, NIGHT_PROFILE.startWidth) : dayWidth;
    const laneWidth = minWidth / LANES.length;
    const route = safeRoute(seed);
    const plan = planTraffic(seed, bodies, route, laneWidth, maxWidth / LANES.length);
    let path: ReturnType<typeof game.spawn> | undefined;
    const active = new Map<number, ReturnType<typeof spawnTrafficParts>>();
    const footprints: ReturnType<typeof game.spawn>[] = [];
    let previousDistance = -Infinity;
    return (
        distance: number, elapsed: number, from: number, end: number,
        place: (distance: number, car: { lane: number; jitter: number }) => RoadPose,
    ): TrafficReport => {
        const jumped = Math.abs(distance - previousDistance) > FRAGMENT_LENGTH;
        previousDistance = distance;
        const start = Math.max(from, distance - RETIRE_DISTANCE);
        const present = new Set<number>();
        const lanePositions = LANES.map(() => [] as number[]);
        const trafficSpeeds: number[] = [];
        let visibleFootprints = 0;
        for (const [slot, car] of plan(elapsed)) {
            if (car.launch > elapsed) continue;
            const along = positionAt(car, elapsed);
            if (along < start || along >= end) continue;
            present.add(slot);
            lanePositions[car.lane + 1].push(along);
            trafficSpeeds.push(car.speed);
            const cached = active.get(slot);
            const parts = cached ?? spawnTrafficParts(car.body.key, 'npc-' + slot, night);
            if (!cached) active.set(slot, parts);
            const pose = place(along, car);
            for (const part of parts) {
                part.x = pose.x;
                part.z = pose.z;
                part.rot = pose.yaw;
                if (jumped || !cached) part.snap();
            }
            if (showTrafficBoxes) {
                const footprint = footprints[visibleFootprints] ?? game.spawn({
                    id: 'traffic-box-' + visibleFootprints, mesh: 'box', y: 0.055,
                    tint: '#ff765d', unlit: true, alpha: 0.7,
                });
                footprints[visibleFootprints++] = footprint;
                footprint.sx = car.body.halfWidth * 2;
                footprint.sy = 0.02;
                footprint.sz = car.body.halfLength * 2;
                footprint.x = pose.x;
                footprint.z = pose.z;
                footprint.rot = pose.yaw;
                footprint.visible = true;
                footprint.snap();
            }
        }
        for (const [id, parts] of active) {
            if (present.has(id)) continue;
            for (const part of parts) part.kill();
            active.delete(id);
        }
        let minGap = Infinity;
        for (const positions of lanePositions) {
            positions.sort((a, b) => a - b);
            for (let i = 1; i < positions.length; i++) minGap = Math.min(minGap, positions[i] - positions[i - 1]);
        }
        for (let i = visibleFootprints; i < footprints.length; i++) footprints[i].visible = false;
        const safePassage = route(distance, end);
        if (showSafeRoute && distance < end) {
            game.world3d.defineMesh(PATH_MESH, pathVertices(safePassage, distance, end, laneWidth, place));
            path ??= game.spawn({ id: PATH_MESH, mesh: PATH_MESH, tint: '#35ef58', unlit: true, alpha: 0.65 });
            path.visible = true;
        } else if (path) path.visible = false;
        return { traffic: active.size, trafficGap: Number.isFinite(minGap) ? minGap : null, trafficSpeeds, safePassage };
    };
}

export type TrafficView = ReturnType<typeof buildTraffic>;
