import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import colliders from '../game/assets/npc_cars/colliders.json';
import { ACCEL_TIME, CRAFT_BODY, CRUISE, craftLimit, distanceAt, timeAt } from '../game/drive-profile.js';
import { safeAcross, safeRoute } from '../game/safe-route.js';
import { planTraffic, positionAt, RETIRE_DISTANCE } from '../game/traffic-plan.js';

const bodies = Object.entries(colliders).map(([key, { size, offset }]) => {
    const file = readFileSync(new URL('../game/assets/npc_cars/' + key + '.glb', import.meta.url));
    // The NPC exports bake their transforms into the POSITION accessors.
    const glb = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)).toString());
    const positions = glb.meshes.flatMap((mesh: { primitives: { attributes: { POSITION: number } }[] }) =>
        mesh.primitives.map(primitive => glb.accessors[primitive.attributes.POSITION] as { min: number[]; max: number[] }));
    const scale = Math.max(...[0, 1, 2].map(axis =>
        Math.max(...positions.map(item => item.max[axis])) - Math.min(...positions.map(item => item.min[axis]))));
    return { key, halfWidth: scale * (size[0] / 2 + Math.abs(offset[0])),
        halfLength: scale * (size[2] / 2 + Math.abs(offset[2])) };
});

function encounterBoundary(car: Parameters<typeof positionAt>[0], offset: number): number {
    let low = car.launch;
    let high = low + 20;
    for (let step = 0; step < 40; step++) {
        const time = (low + high) / 2;
        if (distanceAt(time) < positionAt(car, time) + offset) low = time;
        else high = time;
    }
    return (low + high) / 2;
}

test('1,000 seeds preserve the reserved route and gaps between NPCs through 10 km', () => {
    const models = new Set<string>();
    const speeds = new Set<number>();
    const lanes = new Set<number>();
    let fasterFollowers = 0;
    let carsStartingOnRoute = 0;
    let clearDuringLaneChange = 0;
    for (let seed = 0; seed < 1_000; seed++) {
        const width = seed % 2 ? 12 : 10;
        const route = safeRoute(seed);
        const maxWidth = width === 10 ? 14 : 12;
        const plan = planTraffic(seed, bodies, route, width / 3, maxWidth / 3);
        const segments = route(0, 10_000);
        assert.equal(segments[0].lane, 0);
        for (const [i, segment] of segments.entries()) {
            const startX = safeAcross(segment, segment.from, width / 3);
            const endX = safeAcross(segment, segment.to, width / 3);
            assert.ok(Math.max(Math.abs(startX), Math.abs(endX)) <= craftLimit(width));
            const length = segment.to - segment.from;
            if (segment.lane === segment.nextLane) {
                assert.ok(length >= 5 - 1e-9 && length <= 50 + 1e-9);
            } else {
                assert.equal(Math.abs(segment.nextLane - segment.lane), 1);
                assert.ok(Math.abs(length - 1.5 * (2 * CRAFT_BODY.halfLength)) < 1e-9);
            }
            if (i > 0) {
                assert.equal(segments[i - 1].nextLane, segment.lane);
                assert.equal(segments[i - 1].to, segment.from);
            }
        }
        const trailing = new Map<number, { car: Parameters<typeof positionAt>[0]; retire: number }>();
        let lastSlot = -1;
        for (let time = 0; time <= timeAt(10_000); time++) {
            for (const [slot, car] of plan(time)) {
                if (slot <= lastSlot) continue;
                lastSlot = slot;
                assert.ok(car.speed >= 15 && car.speed <= 25);
                models.add(car.body.key);
                speeds.add(car.speed);
                lanes.add(car.lane);
                const reach = 4.13 / 2 + Math.hypot(car.body.halfWidth, car.body.halfLength) + 1.25;
                const from = distanceAt(encounterBoundary(car, -reach));
                const end = distanceAt(encounterBoundary(car, reach));
                const xAtNarrowest = car.lane * width / 3 + car.jitter;
                const xAtWidest = car.lane * maxWidth / 3 + car.jitter;
                const halfBodies = CRAFT_BODY.halfWidth + car.body.halfWidth;
                if (route(car.start, car.start).some(segment =>
                    Math.abs(safeAcross(segment, car.start, width / 3) - xAtNarrowest) < halfBodies
                )) carsStartingOnRoute++;
                for (const segment of route(from, end)) {
                    const low = Math.max(segment.from, from);
                    const high = Math.min(segment.to, end);
                    for (const along of [low, (low + high) / 2, high]) {
                        const x = safeAcross(segment, along, width / 3);
                        const separation = Math.max(x - Math.max(xAtNarrowest, xAtWidest),
                            Math.min(xAtNarrowest, xAtWidest) - x);
                        assert.ok(separation > halfBodies + 0.30);
                    }
                    if (segment.lane === car.lane || segment.nextLane === car.lane) clearDuringLaneChange++;
                }
                const retire = (car.start - car.speed * car.launch + RETIRE_DISTANCE + CRUISE * ACCEL_TIME / 2)
                    / (CRUISE - car.speed);
                const follower = trailing.get(car.lane);
                if (follower && follower.retire >= car.launch) {
                    const gap = Math.max(5.5, car.body.halfLength + follower.car.body.halfLength + 0.75);
                    for (const at of [car.launch, Math.min(retire, follower.retire)]) {
                        assert.ok(positionAt(car, at) - positionAt(follower.car, at) >= gap - 1e-8);
                    }
                    if (follower.car.speed > car.speed) fasterFollowers++;
                }
                trailing.set(car.lane, { car, retire });
            }
        }
        assert.ok(lastSlot > 1_900, 'traffic must continue through the 5 m slots');
    }
    assert.equal(models.size, bodies.length);
    assert.equal(speeds.size, 11);
    assert.equal(lanes.size, 3);
    assert.ok(fasterFollowers > 0, 'a faster follower is allowed when there is enough room');
    assert.ok(carsStartingOnRoute > 0, 'NPCs can spawn on the route and leave it before the encounter');
    assert.ok(clearDuringLaneChange > 0, 'a lane change does not reserve the full width of both lanes');
});

test('same seed restores identical active cars after moving forward and backward', () => {
    const make = (seed: number) => planTraffic(seed, bodies, safeRoute(seed), 10 / 3, 14 / 3);
    const live = make(42);
    const activeAt = (plan: ReturnType<typeof planTraffic>, time: number) =>
        [...plan(time)].filter(([, car]) => positionAt(car, time) >= distanceAt(time) - RETIRE_DISTANCE);
    const initial = activeAt(live, 5);
    const distant = activeAt(live, timeAt(100_000));
    assert.deepEqual(activeAt(live, 5), initial);
    assert.deepEqual(activeAt(live, timeAt(100_000)), distant);
    assert.deepEqual(distant, activeAt(make(42), timeAt(100_000)));
    assert.notDeepEqual(initial, activeAt(make(43), 5));
});
